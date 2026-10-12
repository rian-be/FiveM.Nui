namespace FiveM.Nui.Abstractions.Callbacks;

/// <summary>
/// Optional per-callback registration settings.
/// </summary>
/// <remarks>
/// <para>
/// Inbound callbacks are dispatched without waiting for the previous one to
/// finish, so two requests from the page can run their handlers concurrently.
/// That is desirable for independent, read-only handlers, but unsafe for
/// handlers that mutate shared state (a wallet, an entity, a shop). Setting
/// <see cref="Serialize"/> makes the bridge admit only one such execution at a
/// time, so the resource does not have to guard its own callbacks.
/// </para>
/// </remarks>
public sealed record NuiCallbackOptions
{
    /// <summary>
    /// When <see langword="true"/>, executions of this callback are serialized:
    /// the bridge runs at most one at a time and queues the rest.
    /// </summary>
    public bool Serialize { get; init; }

    /// <summary>
    /// Name of the shared gate used when <see cref="Serialize"/> is
    /// <see langword="true"/>. Callbacks with the same group serialize against
    /// each other, which lets a set of related operations (for example apply,
    /// purchase and cancel on the same shop) share one gate. When
    /// <see langword="null"/> the gate is private to the callback's own name.
    /// </summary>
    public string? SerializationGroup { get; init; }
}
