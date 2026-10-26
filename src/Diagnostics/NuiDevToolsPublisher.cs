using System.Text.Json;
using FiveM.Nui.Abstractions.DevTools;
using FiveM.Nui.Abstractions.Diagnostics;

namespace FiveM.Nui.Diagnostics;

/// <summary>
/// Background publisher that periodically samples <see cref="INuiDiagnosticsCollector"/>
/// and emits <see cref="NuiDevToolsSample"/> envelopes over the local FiveM event bus.
/// </summary>
public sealed class NuiDevToolsPublisher : IDisposable, IAsyncDisposable
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true
    };

    private readonly INuiDiagnosticsCollector _collector;
    private readonly string _resourceName;
    private readonly NuiDevToolsOptions _options;
    private readonly Action<string, string> _emit;
    private readonly CancellationTokenSource _cts = new();
    private readonly Task? _publishLoop;

    private long _lastSampleAt;
    private long _lastMessages;
    private long _lastIncoming;
    private long _lastOutgoing;
    private long _lastBytes;
    private long _lastOperationSequence;
    private int _disposed;

    public NuiDevToolsPublisher(
        INuiDiagnosticsCollector collector,
        string resourceName,
        NuiDevToolsOptions? options = null,
        Action<string, string>? emit = null)
    {
        _collector = collector ?? throw new ArgumentNullException(nameof(collector));
        _resourceName = string.IsNullOrWhiteSpace(resourceName) ? "unknown_resource" : resourceName;
        _options = options ?? new NuiDevToolsOptions();
        _emit = emit ?? DefaultEmit;

        ResetBaseline();

        var interval = _options.SampleInterval <= TimeSpan.Zero
            ? TimeSpan.FromSeconds(1)
            : _options.SampleInterval;

        _publishLoop = Task.Run(() => RunPublishLoopAsync(interval, _cts.Token));
    }

    private void ResetBaseline()
    {
        var diagnostics = _collector.GetDiagnostics();
        _lastSampleAt = Environment.TickCount64;
        _lastIncoming = Counter(diagnostics.Counters, "messages_received");
        _lastOutgoing = Counter(diagnostics.Counters, "messages_sent");
        _lastMessages = _lastIncoming + _lastOutgoing;
        _lastBytes = diagnostics.TotalPayloadSize;
    }

    private async Task RunPublishLoopAsync(TimeSpan interval, CancellationToken ct)
    {
        using var timer = new PeriodicTimer(interval);
        try
        {
            while (!ct.IsCancellationRequested && await timer.WaitForNextTickAsync(ct).ConfigureAwait(false))
            {
                PublishSample();
            }
        }
        catch (OperationCanceledException)
        {
            // Expected on cancellation
        }
    }

    /// <summary>
    /// Forces an immediate generation and broadcast of a diagnostic sample.
    /// </summary>
    public NuiDevToolsSample PublishSample()
    {
        var sample = BuildSample();
        var json = JsonSerializer.Serialize(sample, JsonOptions);
        _emit(NuiDevToolsProtocol.DiagnosticsEvent, json);
        return sample;
    }

    /// <summary>
    /// Builds the current diagnostic sample without emitting it.
    /// </summary>
    public NuiDevToolsSample BuildSample()
    {
        var diagnostics = _collector.GetDiagnostics();
        var now = Environment.TickCount64;
        var elapsedSeconds = Math.Max((now - _lastSampleAt) / 1_000d, 0.001d);

        var incoming = Counter(diagnostics.Counters, "messages_received");
        var outgoing = Counter(diagnostics.Counters, "messages_sent");
        var messages = incoming + outgoing;

        var completedRequests =
            Counter(diagnostics.Counters, "requests_completed") +
            Counter(diagnostics.Counters, "callbacks_succeeded") +
            Counter(diagnostics.Counters, "callbacks_failed");

        var failedMessages =
            Counter(diagnostics.Counters, "requests_failed") +
            Counter(diagnostics.Counters, "requests_timeout") +
            Counter(diagnostics.Counters, "callbacks_threw") +
            Counter(diagnostics.Counters, "events_publish_failed") +
            Counter(diagnostics.Counters, "callback_responses_failed");

        var totalResponseTime = diagnostics.Timings
            .Where(static metric =>
                metric.Key.StartsWith("request:", StringComparison.Ordinal) ||
                metric.Key.StartsWith("callback:", StringComparison.Ordinal))
            .Sum(static metric => metric.Value);

        // Detect if diagnostics were reset (counters or operation sequences decreased)
        var isCounterReset = messages < _lastMessages ||
                             incoming < _lastIncoming ||
                             outgoing < _lastOutgoing ||
                             diagnostics.TotalPayloadSize < _lastBytes;

        if (isCounterReset || (diagnostics.Operations.Count > 0 && diagnostics.Operations[^1].Sequence < _lastOperationSequence))
        {
            _lastOperationSequence = 0;
        }

        IReadOnlyList<NuiDiagnosticOperation> operations;
        if (_options.IncludeTimeline)
        {
            operations = diagnostics.Operations
                .Where(operation => operation.Sequence > _lastOperationSequence)
                .Take(_options.TimelineCapacity)
                .ToArray();

            if (operations.Count > 0)
            {
                _lastOperationSequence = operations[^1].Sequence;
            }
        }
        else
        {
            operations = [];
        }

        var deltaMessages = Math.Max(0, messages < _lastMessages ? messages : messages - _lastMessages);
        var deltaIncoming = Math.Max(0, incoming < _lastIncoming ? incoming : incoming - _lastIncoming);
        var deltaOutgoing = Math.Max(0, outgoing < _lastOutgoing ? outgoing : outgoing - _lastOutgoing);
        var deltaBytes = Math.Max(0, diagnostics.TotalPayloadSize < _lastBytes
            ? diagnostics.TotalPayloadSize
            : diagnostics.TotalPayloadSize - _lastBytes);

        var sample = new NuiDevToolsSample(
            Version: NuiDevToolsProtocol.ProtocolVersion,
            Source: _resourceName,
            Timestamp: DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
            MessagesPerSecond: deltaMessages / elapsedSeconds,
            IncomingPerSecond: deltaIncoming / elapsedSeconds,
            OutgoingPerSecond: deltaOutgoing / elapsedSeconds,
            AverageResponseMs: completedRequests == 0 ? 0 : totalResponseTime / (double)completedRequests,
            BytesPerSecond: deltaBytes / elapsedSeconds,
            TotalMessages: messages,
            TotalBytes: diagnostics.TotalPayloadSize,
            LargestPayloadBytes: diagnostics.LargestPayload,
            CompletedRequests: completedRequests,
            FailedMessages: failedMessages,
            Counters: diagnostics.Counters,
            Timings: diagnostics.Timings,
            Operations: operations);

        _lastSampleAt = now;
        _lastMessages = messages;
        _lastIncoming = incoming;
        _lastOutgoing = outgoing;
        _lastBytes = diagnostics.TotalPayloadSize;

        return sample;
    }

    private static long Counter(IReadOnlyDictionary<string, long> counters, string name) =>
        counters.TryGetValue(name, out var value) ? value : 0;

    private static void DefaultEmit(string eventName, string json)
    {
        try
        {
            CitizenFX.FiveM.Client.API.EmitLocal(eventName, json);
        }
        catch (Exception)
        {
            // Ignored when running outside FiveM native environment (e.g. testing)
        }
    }

    public void Dispose()
    {
        if (Interlocked.Exchange(ref _disposed, 1) != 0) return;
        _cts.Cancel();
        _cts.Dispose();
    }

    public async ValueTask DisposeAsync()
    {
        if (Interlocked.Exchange(ref _disposed, 1) != 0) return;
        await _cts.CancelAsync();
        if (_publishLoop is not null)
        {
            try
            {
                await _publishLoop.ConfigureAwait(false);
            }
            catch (OperationCanceledException)
            {
            }
        }
        _cts.Dispose();
    }
}
