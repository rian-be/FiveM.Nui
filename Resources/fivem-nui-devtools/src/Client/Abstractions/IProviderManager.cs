using FiveM.Nui.Abstractions.DevTools;
using FiveM.Nui.DevTools.Client.Models;

namespace FiveM.Nui.DevTools.Client.Abstractions;

/// <summary>Ingests diagnostic samples, applies rate-limiting, and tracks provider freshness.</summary>
public interface IProviderManager
{
    /// <summary>Gets the total number of currently tracked diagnostic telemetry providers.</summary>
    int ProviderCount { get; }

    /// <summary>Ingests, validates, and stores a raw diagnostic telemetry sample emitted by a resource.</summary>
    /// <param name="json">Raw JSON payload of the emitted telemetry sample.</param>
    /// <param name="sample">When this method returns, contains the deserialized sample if valid; otherwise, <see langword="null"/>.</param>
    /// <returns><see langword="true"/> if the sample was successfully ingested and admitted; otherwise, <see langword="false"/>.</returns>
    bool Ingest(string json, out NuiDevToolsSample? sample);

    /// <summary>Removes a diagnostic provider by its resource name.</summary>
    /// <param name="source">Name of the FiveM resource acting as the provider.</param>
    /// <returns><see langword="true"/> if the provider was found and removed; otherwise, <see langword="false"/>.</returns>
    bool Remove(string source);

    /// <summary>Identifies and removes providers that have exceeded the timeout threshold without emitting samples.</summary>
    /// <param name="timeoutMs">Timeout duration in milliseconds after which an inactive provider is pruned.</param>
    /// <returns>A read-only collection of resource names for all pruned providers.</returns>
    IReadOnlyList<string> PruneExpired(int timeoutMs);

    /// <summary>Evaluates providers against the staleness threshold and triggers alerts for newly stale providers.</summary>
    /// <param name="staleThresholdMs">Elapsed duration in milliseconds after which a provider is considered stale.</param>
    /// <param name="onStaleAlert">Callback invoked for each newly identified stale provider alert.</param>
    void EvaluateStale(int staleThresholdMs, Action<NuiDiagnosticAlert> onStaleAlert);

    /// <summary>Retrieves the most recent telemetry sample snapshot from each active provider.</summary>
    /// <returns>A read-only list containing the latest sample from each registered provider.</returns>
    IReadOnlyList<NuiDevToolsSample> GetSnapshots();

    /// <summary>Computes and returns the health and staleness status of all registered providers.</summary>
    /// <param name="staleThresholdMs">Threshold in milliseconds to classify a provider as stale.</param>
    /// <returns>A read-only list of provider health records sorted alphabetically by source name.</returns>
    IReadOnlyList<ProviderHealth> GetProviderHealth(int staleThresholdMs);

    /// <summary>Determines whether a provider with the specified resource name is currently tracked.</summary>
    /// <param name="source">Name of the resource to check.</param>
    /// <returns><see langword="true"/> if the provider is registered; otherwise, <see langword="false"/>.</returns>
    bool HasProvider(string source);
}
