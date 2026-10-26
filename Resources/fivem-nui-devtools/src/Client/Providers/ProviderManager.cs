using System.Text.Json;
using FiveM.Nui.Abstractions.DevTools;
using FiveM.Nui.DevTools.Client.Abstractions;
using FiveM.Nui.DevTools.Client.Models;

namespace FiveM.Nui.DevTools.Client.Providers;

/// <summary>
/// Manages diagnostic provider sample ingestion, rate-limiting, and provider freshness.
/// </summary>
/// <param name="platform">Platform abstraction providing runtime convar and resource inspection natives.</param>
public sealed class ProviderManager(IDevToolsPlatform platform) : IProviderManager
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true
    };

    private readonly Lock _lock = new();
    private readonly Dictionary<string, ProviderState> _providers = new(StringComparer.Ordinal);
    private readonly IDevToolsPlatform _platform = platform ?? throw new ArgumentNullException(nameof(platform));

    /// <summary>Gets the total number of currently tracked diagnostic telemetry providers.</summary>
    public int ProviderCount
    {
        get
        {
            lock (_lock) return _providers.Count;
        }
    }

    /// <summary>Determines whether a provider with the specified resource name is currently tracked.</summary>
    /// <param name="source">Name of the resource to check.</param>
    /// <returns><see langword="true"/> if the provider is registered; otherwise, <see langword="false"/>.</returns>
    public bool HasProvider(string source)
    {
        if (string.IsNullOrWhiteSpace(source)) return false;
        lock (_lock) return _providers.ContainsKey(source);
    }

    /// <summary>Ingests, validates, and stores a raw diagnostic telemetry sample emitted by a resource.</summary>
    /// <param name="json">Raw JSON payload of the emitted telemetry sample.</param>
    /// <param name="sample">When this method returns, contains the deserialized sample if valid; otherwise, <see langword="null"/>.</param>
    /// <returns><see langword="true"/> if the sample was successfully ingested and admitted; otherwise, <see langword="false"/>.</returns>
    public bool Ingest(string json, out NuiDevToolsSample? sample)
    {
        sample = null;
        if (string.IsNullOrWhiteSpace(json)) return false;

        // Security: reject oversized JSON envelopes
        if (json.Length > NuiDevToolsProtocol.MaxDiagnosticsJsonBytes)
        {
            return false;
        }

        try
        {
            var parsed = JsonSerializer.Deserialize<NuiDevToolsSample>(json, JsonOptions);
            if (parsed is null || parsed.Version != NuiDevToolsProtocol.ProtocolVersion || string.IsNullOrWhiteSpace(parsed.Source))
            {
                return false;
            }

            // Security: discard samples claiming to be from non-existent resources
            var resourceState = _platform.GetResourceState(parsed.Source);
            if (string.IsNullOrEmpty(resourceState) || resourceState is "missing" or "uninitialized")
            {
                return false;
            }

            var now = Environment.TickCount64;

            lock (_lock)
            {
                // Rate limiting per provider
                if (_providers.TryGetValue(parsed.Source, out var existing) &&
                    now - existing.ReceivedAt < NuiDevToolsProtocol.MinSampleIntervalMs)
                {
                    return false;
                }

                // Bound timeline operations if needed
                var sanitized = parsed;
                if (parsed.Operations is { Count: > NuiDevToolsProtocol.MaxOperationsPerSample })
                {
                    sanitized = parsed with
                    {
                        Operations = parsed.Operations.Take(NuiDevToolsProtocol.MaxOperationsPerSample).ToArray()
                    };
                }

                if (existing is not null)
                {
                    existing.Sample = sanitized;
                    existing.ReceivedAt = now;
                }
                else
                {
                    _providers[parsed.Source] = new ProviderState(sanitized, now);
                }

                sample = sanitized;
                return true;
            }
        }
        catch
        {
            return false;
        }
    }

    /// <summary>Removes a diagnostic provider by its resource name.</summary>
    /// <param name="source">Name of the FiveM resource acting as the provider.</param>
    /// <returns><see langword="true"/> if the provider was found and removed; otherwise, <see langword="false"/>.</returns>
    public bool Remove(string source)
    {
        if (string.IsNullOrWhiteSpace(source)) return false;
        lock (_lock)
        {
            return _providers.Remove(source);
        }
    }

    /// <summary>Identifies and removes providers that have exceeded the timeout threshold without emitting samples.</summary>
    /// <param name="timeoutMs">Timeout duration in milliseconds after which an inactive provider is pruned.</param>
    /// <returns>A read-only collection of resource names for all pruned providers.</returns>
    public IReadOnlyList<string> PruneExpired(int timeoutMs)
    {
        var now = Environment.TickCount64;
        lock (_lock)
        {
            var expired = _providers
                .Where(pair => now - pair.Value.ReceivedAt >= timeoutMs)
                .Select(static pair => pair.Key)
                .ToArray();

            foreach (var source in expired)
            {
                _providers.Remove(source);
            }

            return expired;
        }
    }

    /// <summary>Evaluates providers against the staleness threshold and triggers alerts for newly stale providers.</summary>
    /// <param name="staleThresholdMs">Elapsed duration in milliseconds after which a provider is considered stale.</param>
    /// <param name="onStaleAlert">Callback invoked for each newly identified stale provider alert.</param>
    public void EvaluateStale(int staleThresholdMs, Action<NuiDiagnosticAlert> onStaleAlert)
    {
        ArgumentNullException.ThrowIfNull(onStaleAlert);
        var now = Environment.TickCount64;
        var alertsToSend = new List<NuiDiagnosticAlert>();

        lock (_lock)
        {
            foreach (var (source, state) in _providers)
            {
                if (now - state.ReceivedAt >= staleThresholdMs && !state.ReportedStale)
                {
                    state.ReportedStale = true;
                    alertsToSend.Add(new NuiDiagnosticAlert(
                        source,
                        "warning",
                        "PROVIDER_STALE",
                        $"Provider '{source}' stopped sending diagnostics.",
                        DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()));
                }
                else if (now - state.ReceivedAt < staleThresholdMs)
                {
                    state.ReportedStale = false;
                }
            }
        }

        foreach (var alert in alertsToSend)
        {
            onStaleAlert(alert);
        }
    }

    /// <summary>Retrieves the most recent telemetry sample snapshot from each active provider.</summary>
    /// <returns>A read-only list containing the latest sample from each registered provider.</returns>
    public IReadOnlyList<NuiDevToolsSample> GetSnapshots()
    {
        lock (_lock)
        {
            return _providers.Values.Select(static state => state.Sample).ToArray();
        }
    }

    /// <summary>Computes and returns the health and staleness status of all registered providers.</summary>
    /// <param name="staleThresholdMs">Threshold in milliseconds to classify a provider as stale.</param>
    /// <returns>A read-only list of provider health records sorted alphabetically by source name.</returns>
    public IReadOnlyList<ProviderHealth> GetProviderHealth(int staleThresholdMs)
    {
        var now = Environment.TickCount64;
        lock (_lock)
        {
            return _providers
                .Select(pair => new ProviderHealth(
                    pair.Key,
                    Math.Max(0, now - pair.Value.ReceivedAt),
                    now - pair.Value.ReceivedAt >= staleThresholdMs))
                .OrderBy(static provider => provider.Source, StringComparer.OrdinalIgnoreCase)
                .ToArray();
        }
    }
}
