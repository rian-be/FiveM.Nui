namespace FiveM.Nui.Abstractions.Messaging;

/// <summary>
/// Accept raw JSON envelopes delivered by the FiveM runtime and feed them
/// through the deserialization + dispatch pipeline.
/// </summary>
public interface INuiInboundHandler
{
    /// <summary>
    /// Forwards a raw JSON envelope received from the NUI page.
    /// </summary>
    void ReceiveFromNui(string json);

    /// <summary>
    /// Inspects the raw JSON of an incoming envelope before dispatch.
    /// </summary>
    void TraceIncoming(string json);

    /// <summary>
    /// Inspects the raw JSON of an outgoing envelope after dispatch.
    /// </summary>
    void TraceOutgoing(NuiMessage message);
}
