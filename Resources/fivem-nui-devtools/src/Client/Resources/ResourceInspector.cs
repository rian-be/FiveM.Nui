using FiveM.Nui.Abstractions.DevTools;
using FiveM.Nui.DevTools.Client.Abstractions;

namespace FiveM.Nui.DevTools.Client.Resources;

/// <summary>
/// Inspects installed FiveM resources, manifest metadata, and lifecycle transitions.
/// </summary>
/// <param name="platform">Platform abstraction providing runtime convar and resource inspection natives.</param>
/// <param name="lifecycleCapacity">Maximum number of lifecycle transition entries kept in memory. Defaults to 100.</param>
public sealed class ResourceInspector(IDevToolsPlatform platform, int lifecycleCapacity = 100) : IResourceInspector
{
    private readonly Lock _lock = new();
    private readonly IDevToolsPlatform _platform = platform ?? throw new ArgumentNullException(nameof(platform));
    private readonly Queue<NuiResourceLifecycleEntry> _lifecycle = new(lifecycleCapacity);
    private readonly Dictionary<string, NuiResourceInfo> _metadataCache = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, string> _trackedStates = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, (string State, long Timestamp)> _debounce = new(StringComparer.OrdinalIgnoreCase);

    /// <summary>Performs initial discovery of all available resources and registers running resources into the lifecycle history.</summary>
    public void DiscoverInitial()
    {
        var count = _platform.GetNumResources();
        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var startedList = new List<string>();

        for (var index = 0; index < count; index++)
        {
            var name = _platform.GetResourceByFindIndex(index);
            if (string.IsNullOrWhiteSpace(name)) continue;

            var state = _platform.GetResourceState(name);
            lock (_lock)
            {
                _trackedStates[name] = state;
            }

            if (string.Equals(state, "started", StringComparison.OrdinalIgnoreCase))
            {
                startedList.Add(name);
            }
        }

        lock (_lock)
        {
            foreach (var name in startedList)
            {
                _lifecycle.Enqueue(new NuiResourceLifecycleEntry(now, name, "started"));
            }
        }
    }

    /// <summary>Records a resource lifecycle state transition if not debounced.</summary>
    /// <param name="resourceName">Name of the resource changing state.</param>
    /// <param name="state">New lifecycle state (e.g., "started", "stopped").</param>
    /// <returns>A new <see cref="NuiResourceLifecycleEntry"/> if recorded; otherwise, <see langword="null"/> if debounced.</returns>
    public NuiResourceLifecycleEntry? RecordLifecycle(string resourceName, string state)
    {
        if (string.IsNullOrWhiteSpace(resourceName)) return null;

        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        NuiResourceLifecycleEntry entry;

        lock (_lock)
        {
            if (_debounce.TryGetValue(resourceName, out var last) &&
                string.Equals(last.State, state, StringComparison.OrdinalIgnoreCase) &&
                now - last.Timestamp < 1200)
            {
                return null;
            }

            _debounce[resourceName] = (state, now);
            _trackedStates[resourceName] = state;
            _metadataCache.Remove(resourceName);

            entry = new NuiResourceLifecycleEntry(now, resourceName, state);
            _lifecycle.Enqueue(entry);
            while (_lifecycle.Count > lifecycleCapacity)
            {
                _lifecycle.Dequeue();
            }
        }

        return entry;
    }

    /// <summary>Scans all discovered resources, updating state transitions and gathering metadata.</summary>
    /// <param name="isProviderPredicate">Predicate determining whether a given resource is an active diagnostics provider.</param>
    /// <returns>A complete <see cref="NuiResourceInventory"/> snapshot.</returns>
    public NuiResourceInventory ScanResources(Func<string, bool> isProviderPredicate)
    {
        ArgumentNullException.ThrowIfNull(isProviderPredicate);

        var resources = new List<NuiResourceInfo>();
        var count = _platform.GetNumResources();
        var detectedTransitions = new List<(string Name, string State)>();

        for (var index = 0; index < count; index++)
        {
            var name = _platform.GetResourceByFindIndex(index);
            if (string.IsNullOrWhiteSpace(name)) continue;

            var state = _platform.GetResourceState(name);
            resources.Add(GetOrQueryResourceInfo(name, state, isProviderPredicate(name)));

            lock (_lock)
            {
                if (_trackedStates.TryGetValue(name, out var oldState))
                {
                    if (!string.Equals(oldState, state, StringComparison.OrdinalIgnoreCase))
                    {
                        detectedTransitions.Add((name, state));
                    }
                }
                else
                {
                    detectedTransitions.Add((name, state));
                }
            }
        }

        foreach (var (changeName, changeState) in detectedTransitions)
        {
            RecordLifecycle(changeName, changeState);
        }

        resources.Sort(static (left, right) =>
            StringComparer.OrdinalIgnoreCase.Compare(left.Name, right.Name));

        return new NuiResourceInventory(
            DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
            resources,
            GetLifecycleHistory());
    }

    /// <summary>Gets the chronological history of resource lifecycle transitions in reverse order.</summary>
    /// <returns>A read-only collection of lifecycle entries.</returns>
    public IReadOnlyList<NuiResourceLifecycleEntry> GetLifecycleHistory()
    {
        lock (_lock)
        {
            return _lifecycle.Reverse().ToArray();
        }
    }

    /// <summary>Invalidates cached metadata for a resource, forcing a re-query on the next scan.</summary>
    /// <param name="resourceName">Name of the resource whose cache entry should be invalidated.</param>
    public void InvalidateMetadata(string resourceName)
    {
        if (string.IsNullOrWhiteSpace(resourceName)) return;
        lock (_lock)
        {
            _metadataCache.Remove(resourceName);
        }
    }

    private NuiResourceInfo GetOrQueryResourceInfo(string resourceName, string state, bool isDiagnosticsProvider)
    {
        lock (_lock)
        {
            if (_metadataCache.TryGetValue(resourceName, out var cached) &&
                cached.State == state &&
                cached.IsDiagnosticsProvider == isDiagnosticsProvider)
            {
                return cached;
            }
        }

        var depCount = _platform.GetNumResourceMetadata(resourceName, "dependency");
        var dependencies = new List<string>(depCount);
        for (var i = 0; i < depCount; i++)
        {
            var dep = _platform.GetResourceMetadata(resourceName, "dependency", i);
            if (!string.IsNullOrWhiteSpace(dep))
            {
                dependencies.Add(dep);
            }
        }

        var uiPage = _platform.GetResourceMetadata(resourceName, "ui_page");
        var hasNui = !string.IsNullOrWhiteSpace(uiPage);

        var info = new NuiResourceInfo(
            Name: resourceName,
            State: state,
            Version: _platform.GetResourceMetadata(resourceName, "version"),
            Author: _platform.GetResourceMetadata(resourceName, "author"),
            Description: _platform.GetResourceMetadata(resourceName, "description"),
            Dependencies: dependencies,
            HasNui: hasNui,
            IsDiagnosticsProvider: isDiagnosticsProvider);

        lock (_lock)
        {
            _metadataCache[resourceName] = info;
        }

        return info;
    }
}
