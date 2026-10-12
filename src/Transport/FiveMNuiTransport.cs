using System.Collections.Concurrent;
using FiveM.Nui.Common;

namespace FiveM.Nui.Transport;

/// <summary>
/// FiveM specific implementation of NUI transport.
/// Sends envelopes through <see cref="INuiRuntime"/> and dispatches inbound
/// envelopes from the host's raw NUI callback to subscribers.
/// </summary>
public sealed class FiveMNuiTransport(INuiSerializer serializer, INuiLogger logger, INuiRuntime runtime)
    : INuiTransport
{
    private readonly ConcurrentDictionary<Action<NuiMessage>, byte> _handlers = new();

    /// <summary>
    /// Serializes <paramref name="message"/> and hands it to the runtime.
    /// </summary>
    /// <param name="message">The envelope to send.</param>
    /// <param name="cancellationToken">Cancellation token; an already canceled token skips the sending.</param>
    public Task SendAsync(NuiMessage message, CancellationToken cancellationToken = default)
    {
        if (cancellationToken.IsCancellationRequested)
        {
            logger.LogDebug("Send cancelled for '{Event}'", message.Event);
            return Task.CompletedTask;
        }

        var json = serializer.Serialize(message);

        logger.LogDebug("Transport -> type={Type} event='{Event}' id={CorrelationId} ({Bytes} bytes)",
            message.Type,
            message.Event,
            message.Id ?? "-",
            json.Length);

        runtime.SendNuiMessage(json);
        return Task.CompletedTask;
    }

    /// <summary>
    /// Registers <paramref name="handler"/> to receive inbound envelopes.
    /// </summary>
    /// <param name="handler">Invoked for every envelope received from the page.</param>
    /// <returns>An <see cref="IDisposable"/> that removes the subscription.</returns>
    public IDisposable Subscribe(Action<NuiMessage> handler)
    {
        _handlers.TryAdd(handler, 0);
        logger.LogDebug("Transport subscriber added (total={Count})", _handlers.Count);

        return new DisposableAction(() =>
        {
            if (_handlers.TryRemove(handler, out _))
            {
                logger.LogDebug("Transport subscriber removed (total={Count})", _handlers.Count);
            }
        });
    }

    /// <summary>
    /// Dispatches raw inbound envelope to every subscriber.
    /// </summary>
    /// <remarks>
    /// A malformed envelope and throwing subscriber are logged and skipped, so one
    /// bad message or handler cannot stop delivery to the others.
    /// </remarks>
    /// <param name="json">The raw envelope posted by the page.</param>
    public void OnMessageReceived(string json)
    {
        NuiMessage? message;

        try
        {
            message = serializer.Deserialize<NuiMessage>(json);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to deserialize NUI message");
            return;
        }

        if (message is null)
        {
            logger.LogWarning("Transport received an empty envelope");
            return;
        }

        logger.LogDebug("Transport <- type={Type} event='{Event}' id={CorrelationId}",
            message.Type,
            message.Event,
            message.Id ?? "-");

        foreach (var handler in _handlers.Keys)
        {
            try
            {
                handler(message);
            }
            catch (Exception ex)
            {
                // One faulty subscriber must not starve the others.
                logger.LogError(ex, "Transport subscriber threw for '{Event}'",
                    message.Event ?? message.Type);
            }
        }
    }
}
