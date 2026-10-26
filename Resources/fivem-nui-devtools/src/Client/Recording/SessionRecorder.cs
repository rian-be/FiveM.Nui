using FiveM.Nui.Abstractions.DevTools;
using FiveM.Nui.DevTools.Client.Abstractions;
using FiveM.Nui.DevTools.Client.Models;

namespace FiveM.Nui.DevTools.Client.Recording;

/// <summary>
/// Manages diagnostic frame buffers, recording session state, and export preparation.
/// </summary>
/// <param name="maxFrames">Maximum number of frames retained in the circular recording buffer. Defaults to 300.</param>
public sealed class SessionRecorder(int maxFrames = 300) : ISessionRecorder
{
    private readonly Lock _lock = new();
    private readonly Queue<RecordedDiagnosticsFrame> _frames = new(maxFrames);
    private bool _isRecording;
    private long _startedAt;

    /// <summary>Gets a value indicating whether a diagnostic recording session is currently active.</summary>
    public bool IsRecording
    {
        get
        {
            lock (_lock) return _isRecording;
        }
    }

    /// <summary>Gets the total count of telemetry frames recorded in the current session.</summary>
    public int FrameCount
    {
        get
        {
            lock (_lock) return _frames.Count;
        }
    }

    /// <summary>Gets the elapsed duration of the current recording session in milliseconds.</summary>
    public long DurationMs
    {
        get
        {
            lock (_lock)
            {
                return _isRecording ? Math.Max(0, DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() - _startedAt) : 0;
            }
        }
    }

    /// <summary>Starts or restarts a diagnostic recording session, clearing existing frames.</summary>
    public void Start()
    {
        lock (_lock)
        {
            _isRecording = true;
            _startedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            _frames.Clear();
        }
    }

    /// <summary>Stops the active recording session.</summary>
    /// <returns>The total number of frames captured during the session.</returns>
    public int Stop()
    {
        lock (_lock)
        {
            _isRecording = false;
            return _frames.Count;
        }
    }

    /// <summary>Clears all recorded frames and resets recording state.</summary>
    public void Clear()
    {
        lock (_lock)
        {
            _frames.Clear();
            _isRecording = false;
            _startedAt = 0;
        }
    }

    /// <summary>Records a diagnostic telemetry sample as a new timeline frame if recording is active.</summary>
    /// <param name="sample">The telemetry sample to record.</param>
    public void RecordFrame(NuiDevToolsSample sample)
    {
        ArgumentNullException.ThrowIfNull(sample);

        var frame = new RecordedDiagnosticsFrame(sample.Timestamp, [sample]);
        lock (_lock)
        {
            if (!_isRecording) return;

            _frames.Enqueue(frame);
            while (_frames.Count > maxFrames)
            {
                _frames.Dequeue();
            }
        }
    }

    /// <summary>Gets the current session state snapshot.</summary>
    /// <returns>A new <see cref="SessionState"/> record.</returns>
    public SessionState GetSessionState()
    {
        lock (_lock)
        {
            var duration = _isRecording ? Math.Max(0, DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() - _startedAt) : 0;
            return new SessionState(_isRecording, _frames.Count, duration);
        }
    }

    /// <summary>Exports the recorded session frames into a transferable session export package.</summary>
    /// <param name="currentFallbackSnapshots">Current provider snapshots used as fallback if no frames were recorded.</param>
    /// <returns>A new <see cref="RecordedSessionExport"/> instance.</returns>
    public RecordedSessionExport Export(IReadOnlyList<NuiDevToolsSample> currentFallbackSnapshots)
    {
        RecordedDiagnosticsFrame[] frames;
        long startedAt;

        lock (_lock)
        {
            frames = _frames.ToArray();
            startedAt = _startedAt;
        }

        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        if (frames.Length == 0)
        {
            startedAt = now;
            if (currentFallbackSnapshots.Count > 0)
            {
                frames = [new RecordedDiagnosticsFrame(now, currentFallbackSnapshots)];
            }
        }

        return new RecordedSessionExport(
            startedAt,
            now,
            frames.Length,
            frames);
    }
}
