namespace FiveM.Nui.Callbacks;

/// <summary>
/// Decorator that admits at most one execution of the wrapped handler at a
/// time, serializing callbacks that register with <c>Serialize</c>.
/// </summary>
/// <remarks>
/// The dispatcher runs each inbound request as an independent background task,
/// so without this a page that fires several requests in quick succession can
/// have their handlers overlap. Handlers that mutate shared state (a wallet, a
/// vehicle, a shop) rely on this gate; read-only handlers stay unserialized and
/// keep running concurrently. Handlers that name the same serialization group
/// share one gate, so a set of related operations serializes as a unit.
/// </remarks>
internal sealed class SerializedCallbackHandler(
    INuiCallbackHandler inner,
    SemaphoreSlim gate) : INuiCallbackHandler
{
    /// <summary>
    /// Waits for the gate, runs the wrapped handler, then releases the gate.
    /// </summary>
    public async Task<string> ExecuteAsync(
        object? payload,
        INuiSerializer serializer,
        CancellationToken cancellationToken)
    {
        await gate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            return await inner.ExecuteAsync(payload, serializer, cancellationToken).ConfigureAwait(false);
        }
        finally
        {
            gate.Release();
        }
    }
}
