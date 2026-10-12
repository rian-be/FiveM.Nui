namespace FiveM.Nui.Abstractions.Hosting;

/// <summary>
/// Configuration options for NUI client.
/// </summary>
public sealed class NuiOptions
{
    /// <summary>
    /// Gets or sets the default timeout for requests.
    /// </summary>
    public TimeSpan DefaultTimeout { get; init; } = TimeSpan.FromSeconds(30);

    /// <summary>
    /// Gets or sets the maximum payload size in bytes.
    /// </summary>
    public int MaxPayloadSize { get; init; } = 1024 * 1024; // 1MB

    /// <summary>
    /// Gets or sets whether diagnostics are enabled.
    /// </summary>
    public bool EnableDiagnostics { get; init; } = false;

    /// <summary>
    /// Gets or sets the logger to use. When <c>null</c>, the client falls back
    /// to a no-op logger (or a console-backed logger when
    /// <see cref="EnableDebugLogging"/> is on).
    /// </summary>
    public INuiLogger? Logger { get; init; }

    /// <summary>
    /// Gets or sets the host bindings used to reach NUI. When <c>null</c>, the
    /// client uses <c>FiveMNuiRuntime</c>, which posts through the FiveM client
    /// natives.
    /// </summary>
    public INuiRuntime? Runtime { get; init; }

    /// <summary>
    /// Gets or sets whether verbose protocol logging is enabled. When on and no
    /// logger was supplied, the client switches to a console-backed logger so
    /// message envelopes show up in the client console.
    /// </summary>
    public bool EnableDebugLogging { get; init; } = false;

    /// <summary>
    /// Gets or sets whether inbound payloads are logged verbatim. Can contain
    /// player-supplied data, so it is off unless explicitly enabled.
    /// </summary>
    public bool LogPayloads { get; init; } = false;
}
