namespace FiveM.Nui.Abstractions.Diagnostics;

/// <summary>
/// Provides diagnostic snapshot of the NUI pipeline.
/// </summary>
public interface INuiDiagnosticsProvider
{
    /// <summary>
    /// Gets the current diagnostics snapshot.
    /// </summary>
    NuiDiagnosticsSnapshot GetDiagnostics();
}
