using System.Collections.Concurrent;

namespace FiveM.Nui.Tests.Support;

/// <summary>
/// Captures everything the client sends so envelope invariants can be asserted
/// without a FiveM runtime.
/// </summary>
internal sealed class RecordingRuntime : INuiRuntime
{
    public ConcurrentQueue<string> Sent { get; } = new();
    public List<bool> FocusCalls { get; } = [];

    public string ResourceName => "test_resource";

    public void SendNuiMessage(string json) => Sent.Enqueue(json);

    public void SetNuiFocus(bool focus) => FocusCalls.Add(focus);
}