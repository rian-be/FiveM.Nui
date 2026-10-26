namespace FiveM.Nui.Abstractions.DevTools;

/// <summary>
/// Configuration options for the automatic DevTools diagnostic publisher.
/// </summary>
/// <remarks>
/// <para>
/// When enabled, the DevTools publisher periodically samples metrics from
/// <see cref="FiveM.Nui.Abstractions.Diagnostics.INuiDiagnosticsCollector"/>, computes throughput and
/// latency rates, and broadcasts <see cref="NuiDevToolsSample"/> envelopes over the
/// FiveM client event bus using <see cref="NuiDevToolsProtocol.DiagnosticsEvent"/>.
/// </para>
/// <para>
/// These settings govern sampling cadence, timeline retention, and memory/bandwidth
/// overhead. For production servers, consider setting a longer <see cref="SampleInterval"/>
/// or disabling <see cref="IncludeTimeline"/> to minimize JSON serialization and event bus traffic.
/// </para>
/// </remarks>
public sealed class NuiDevToolsOptions
{
    /// <summary>
    /// Cadence at which diagnostic metrics are sampled and published.
    /// </summary>
    /// <remarks>
    /// <para>
    /// Defaults to 1 second (<c>TimeSpan.FromSeconds(1)</c>). If set to <see cref="TimeSpan.Zero"/>
    /// or negative value, the publisher falls back to the default 1 second interval.
    /// Values lower than <see cref="NuiDevToolsProtocol.MinSampleIntervalMs"/> are clamped by the
    /// hosting runtime to avoid saturating the local event dispatcher.
    /// </para>
    /// </remarks>
    /// <value>A <see cref="TimeSpan"/> representing the sampling interval.</value>
    public TimeSpan SampleInterval { get; set; } = TimeSpan.FromSeconds(1);

    /// <summary>
    /// Indicates whether recent transport operations are included in the published diagnostic sample.
    /// </summary>
    /// <remarks>
    /// <para>
    /// When <see langword="true"/>, recent HTTP POST messages, events, callbacks, and correlation
    /// roundtrips are bundled in <see cref="NuiDevToolsSample.Operations"/>, enabling real-time
    /// timeline tracking in the DevTools inspector.
    /// </para>
    /// <para>
    /// When <see langword="false"/>, <see cref="NuiDevToolsSample.Operations"/> will be
    /// <see langword="null"/>, significantly reducing the JSON payload size transmitted over the event bus.
    /// Defaults to <see langword="true"/>.
    /// </para>
    /// </remarks>
    public bool IncludeTimeline { get; set; } = true;

    /// <summary>
    /// Maximum number of recent transport operations retained in the publisher's ring buffer per sample.
    /// </summary>
    /// <remarks>
    /// <para>
    /// Defaults to <c>256</c>. Older operations are evicted in FIFO order when the capacity is exceeded.
    /// This bounds memory usage and ensures that high frequency messaging bursts do not generate
    /// oversized diagnostic packets.
    /// </para>
    /// </remarks>
    /// <value>The maximum operation count allowed in single timeline buffer.</value>
    public int TimelineCapacity { get; set; } = 256;
}
