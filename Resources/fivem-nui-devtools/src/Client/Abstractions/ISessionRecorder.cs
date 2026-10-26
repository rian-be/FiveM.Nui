using FiveM.Nui.Abstractions.DevTools;
using FiveM.Nui.DevTools.Client.Models;

namespace FiveM.Nui.DevTools.Client.Abstractions;

/// <summary>Records diagnostics sessions and exports timeline snapshots.</summary>
public interface ISessionRecorder
{
    /// <summary>Gets a value indicating whether a diagnostic recording session is currently active.</summary>
    bool IsRecording { get; }

    /// <summary>Gets the total count of telemetry frames recorded in the current session.</summary>
    int FrameCount { get; }

    /// <summary>Gets the elapsed duration of the current recording session in milliseconds.</summary>
    long DurationMs { get; }

    /// <summary>Starts or restarts a diagnostic recording session, clearing existing frames.</summary>
    void Start();

    /// <summary>Stops the active recording session.</summary>
    /// <returns>The total number of frames captured during the session.</returns>
    int Stop();

    /// <summary>Clears all recorded frames and resets recording state.</summary>
    void Clear();

    /// <summary>Records a diagnostic telemetry sample as a new timeline frame if recording is active.</summary>
    /// <param name="sample">The telemetry sample to record.</param>
    void RecordFrame(NuiDevToolsSample sample);

    /// <summary>Gets the current session state snapshot.</summary>
    /// <returns>A new <see cref="SessionState"/> record.</returns>
    SessionState GetSessionState();

    /// <summary>Exports the recorded session frames into a transferable session export package.</summary>
    /// <param name="currentFallbackSnapshots">Current provider snapshots used as fallback if no frames were recorded.</param>
    /// <returns>A new <see cref="RecordedSessionExport"/> instance.</returns>
    RecordedSessionExport Export(IReadOnlyList<NuiDevToolsSample> currentFallbackSnapshots);
}
