using FiveM.Nui.Abstractions.DevTools;

namespace FiveM.Nui.DevTools.Client.Providers;

/// <summary>Tracks live state and staleness tracking flags of a single connected diagnostics provider.</summary>
/// <param name="sample">Initial telemetry sample from the provider.</param>
/// <param name="receivedAt">Tick count timestamp when the sample was admitted.</param>
public sealed class ProviderState(NuiDevToolsSample sample, long receivedAt)
{
    /// <summary>Gets or sets the most recent telemetry sample emitted by this provider.</summary>
    public NuiDevToolsSample Sample { get; set; } = sample;

    /// <summary>Gets or sets the tick count timestamp when the most recent sample was received.</summary>
    public long ReceivedAt { get; set; } = receivedAt;

    /// <summary>Gets or sets a value indicating whether a staleness alert has already been emitted for this provider.</summary>
    public bool ReportedStale { get; set; }
}
