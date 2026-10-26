using System.Collections.Concurrent;
using System.Text;
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
    /// <param name="cancellationToken">Cancellation token; an already canceled token returns a canceled task without sending.</param>
    public Task SendAsync(NuiMessage message, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(message);
        if (cancellationToken.IsCancellationRequested)
        {
            if (logger.IsEnabled(NuiLogLevel.Debug))
                logger.LogDebug("Send cancelled for '{Event}'", message.Event);
            return Task.FromCanceled(cancellationToken);
        }

        var json = serializer.Serialize(message);
        return SendSerializedAsync(message, json, cancellationToken);
    }

    /// <summary>
    /// Sends an envelope already serialized by the client for payload-limit
    /// validation, avoiding a second JSON serialization on the hot path.
    /// </summary>
    internal Task SendSerializedAsync(
        NuiMessage message,
        string json,
        CancellationToken cancellationToken = default)
    {
        if (cancellationToken.IsCancellationRequested)
            return Task.FromCanceled(cancellationToken);

        if (logger.IsEnabled(NuiLogLevel.Debug))
        {
            logger.LogDebug("Transport -> type={Type} event='{Event}' id={CorrelationId} ({Bytes} bytes)",
                message.Type,
                message.Event,
                message.Id ?? "-",
                Encoding.UTF8.GetByteCount(json));
        }

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
        ArgumentNullException.ThrowIfNull(handler);
        _handlers.TryAdd(handler, 0);
        if (logger.IsEnabled(NuiLogLevel.Debug))
            logger.LogDebug("Transport subscriber added (total={Count})", _handlers.Count);

        return new DisposableAction(() =>
        {
            if (_handlers.TryRemove(handler, out _))
            {
                if (logger.IsEnabled(NuiLogLevel.Debug))
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
        ArgumentNullException.ThrowIfNull(json);
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

        if (logger.IsEnabled(NuiLogLevel.Debug))
        {
            logger.LogDebug("Transport <- type={Type} event='{Event}' id={CorrelationId}",
                message.Type,
                message.Event,
                message.Id ?? "-");
        }

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
