namespace FiveM.Nui.Abstractions.DevTools;

/// <summary>
/// Constants and wire protocol definitions for the FiveM NUI DevTools diagnostic pipeline.
/// </summary>
/// <remarks>
/// <para>
/// FiveM.Nui diagnostic telemetry relies on a decentralized pub/sub architecture. Individual
/// game resources hosting an active <see cref="FiveM.Nui.Abstractions.Diagnostics.INuiDiagnosticsCollector"/>
/// periodically publish structured <see cref="NuiDevToolsSample"/> JSON envelopes over the local
/// client event bus using <see cref="DiagnosticsEvent"/>.
/// </para>
/// <para>
/// A centralized DevTools inspector dashboard subscribes to these broadcasts, computes rolling
/// aggregates, evaluates threshold alerts, tracks resource lifecycle changes, and pushes
/// formatted UI events to the DevTools NUI frontend using the <c>devtools:*</c> envelope events.
/// </para>
/// <para>
/// Operators can tune sampling intervals, stale/dead provider timeouts, and timeline retention
/// dynamically via server and client console variables (<c>nui_devtools_*</c>).
/// </para>
/// </remarks>
public static class NuiDevToolsProtocol
{
    /// <summary>
    /// Local FiveM client event name used by client resources to broadcast serialized diagnostic telemetry samples.
    /// </summary>
    /// <remarks>
    /// Payloads dispatched under this event are JSON formatted <see cref="NuiDevToolsSample"/> structures.
    /// </remarks>
    public const string DiagnosticsEvent = "fivem-nui:diagnostics";

    /// <summary>
    /// Current schema version of the DevTools diagnostic wire protocol.
    /// </summary>
    /// <remarks>
    /// Consumers verify this version against incoming payloads to guard against mismatched data layouts.
    /// </remarks>
    public const int ProtocolVersion = 1;

    // NUI Envelope Events

    /// <summary>
    /// NUI message event identifier used to deliver an individual provider's diagnostic snapshot to the UI.
    /// </summary>
    public const string EventSnapshot = "devtools:snapshot";

    /// <summary>
    /// NUI message event identifier used for batch synchronization of all known provider snapshots upon UI initialization.
    /// </summary>
    public const string EventSnapshots = "devtools:snapshots";

    /// <summary>
    /// NUI message event identifier used to toggle or synchronize the visibility state of the DevTools overlay window.
    /// </summary>
    public const string EventVisibility = "devtools:visibility";

    /// <summary>
    /// NUI message event identifier dispatched when a diagnostic provider has stopped emitting telemetry or has been stopped.
    /// </summary>
    public const string EventProviderRemoved = "devtools:providerRemoved";

    /// <summary>
    /// NUI message event identifier communicating the real-time health and responsiveness state of an active provider.
    /// </summary>
    public const string EventProviderHealth = "devtools:providerHealth";

    /// <summary>
    /// NUI message event identifier conveying the complete inventory of installed resources and their capabilities.
    /// </summary>
    public const string EventResources = "devtools:resources";

    /// <summary>
    /// NUI message event identifier emitted when a resource lifecycle state change occurs (e.g. started, stopped).
    /// </summary>
    public const string EventResourceLifecycle = "devtools:resourceLifecycle";

    /// <summary>
    /// NUI message event identifier delivering threshold alerts and operational warnings to the frontend.
    /// </summary>
    public const string EventAlerts = "devtools:alerts";

    /// <summary>
    /// NUI message event identifier used to synchronize active session state, filter criteria, and recording settings.
    /// </summary>
    public const string EventSessionState = "devtools:sessionState";

    // ===== Console Variables (ConVars) =====

    /// <summary>
    /// Console variable governing the sampling and refresh interval in milliseconds (<c>nui_devtools_refresh_ms</c>).
    /// </summary>
    public const string ConVarRefreshMs = "nui_devtools_refresh_ms";

    /// <summary>
    /// Console variable defining the timeout in milliseconds before an inactive provider is pruned (<c>nui_devtools_provider_timeout_ms</c>).
    /// </summary>
    public const string ConVarProviderTimeoutMs = "nui_devtools_provider_timeout_ms";

    /// <summary>
    /// Console variable defining the threshold in milliseconds after which a provider is marked stale (<c>nui_devtools_provider_stale_ms</c>).
    /// </summary>
    public const string ConVarProviderStaleMs = "nui_devtools_provider_stale_ms";

    /// <summary>
    /// Console variable overriding the capacity limit of the recent operations timeline buffer (<c>nui_devtools_timeline_capacity</c>).
    /// </summary>
    public const string ConVarTimelineCapacity = "nui_devtools_timeline_capacity";

    /// <summary>
    /// Console variable controlling whether detailed message payloads may be inspected and transmitted (<c>nui_devtools_allow_payloads</c>).
    /// </summary>
    public const string ConVarAllowPayloads = "nui_devtools_allow_payloads";

    // ===== Default Values & Operational Limits =====

    /// <summary>
    /// Default telemetry sample interval in milliseconds (<c>1,000 ms</c> / 1 second).
    /// </summary>
    public const int DefaultRefreshIntervalMs = 1_000;

    /// <summary>
    /// Default duration in milliseconds (<c>3,500 ms</c>) without heartbeats before a provider is flagged as stale.
    /// </summary>
    public const int DefaultProviderStaleMs = 3_500;

    /// <summary>
    /// Default duration in milliseconds (<c>30,000 ms</c>) before an unresponsive provider is deemed dead and removed.
    /// </summary>
    public const int DefaultProviderTimeoutMs = 30_000;

    /// <summary>
    /// Default capacity (<c>300</c>) for the ring buffer storing recent transport operations in the DevTools aggregator.
    /// </summary>
    public const int DefaultTimelineCapacity = 300;

    /// <summary>
    /// Maximum allowed payload size in bytes (<c>256 KB</c>) for serialized diagnostic JSON packets.
    /// </summary>
    /// <remarks>
    /// Packets exceeding this size are truncated or rejected to prevent local event queue saturation.
    /// </remarks>
    public const int MaxDiagnosticsJsonBytes = 256 * 1024;

    /// <summary>
    /// Maximum number of operation timeline entries (<c>500</c>) that can be included in a single telemetry sample.
    /// </summary>
    public const int MaxOperationsPerSample = 500;

    /// <summary>
    /// Hard minimum sample interval in milliseconds (<c>200 ms</c>) to prevent excessive CPU consumption from runaway refresh loops.
    /// </summary>
    public const long MinSampleIntervalMs = 200;
}
