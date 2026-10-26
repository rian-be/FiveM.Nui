namespace FiveM.Nui.Abstractions.Diagnostics;

/// <summary>One observable operation in the C# and NUI transport pipeline.</summary>
public sealed record NuiDiagnosticOperation(
    long Sequence,
    long Timestamp,
    string Direction,
    string Type,
    string Event,
    int PayloadBytes,
    long? DurationMs,
    string Status,
    string? CorrelationId = null,
    string? ErrorCode = null);
