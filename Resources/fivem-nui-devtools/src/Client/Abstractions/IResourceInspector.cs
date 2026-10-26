using FiveM.Nui.Abstractions.DevTools;

namespace FiveM.Nui.DevTools.Client.Abstractions;

/// <summary>Scans FiveM resources, inspects manifest metadata, and tracks resource lifecycle state.</summary>
public interface IResourceInspector
{
    /// <summary>Performs initial discovery of all available resources and registers running resources into the lifecycle history.</summary>
    void DiscoverInitial();

    /// <summary>Records a resource lifecycle state transition if not debounced.</summary>
    /// <param name="resourceName">Name of the resource changing state.</param>
    /// <param name="state">New lifecycle state (e.g., "started", "stopped").</param>
    /// <returns>A new <see cref="NuiResourceLifecycleEntry"/> if recorded; otherwise, <see langword="null"/> if debounced.</returns>
    NuiResourceLifecycleEntry? RecordLifecycle(string resourceName, string state);

    /// <summary>Scans all discovered resources, updating state transitions and gathering metadata.</summary>
    /// <param name="isProviderPredicate">Predicate determining whether a given resource is an active diagnostics provider.</param>
    /// <returns>A complete <see cref="NuiResourceInventory"/> snapshot.</returns>
    NuiResourceInventory ScanResources(Func<string, bool> isProviderPredicate);

    /// <summary>Gets the chronological history of resource lifecycle transitions in reverse order.</summary>
    /// <returns>A read-only collection of lifecycle entries.</returns>
    IReadOnlyList<NuiResourceLifecycleEntry> GetLifecycleHistory();

    /// <summary>Invalidates cached metadata for a resource, forcing a re-query on the next scan.</summary>
    /// <param name="resourceName">Name of the resource whose cache entry should be invalidated.</param>
    void InvalidateMetadata(string resourceName);
}
