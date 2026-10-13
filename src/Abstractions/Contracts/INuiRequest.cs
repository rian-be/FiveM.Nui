namespace FiveM.Nui.Abstractions.Contracts;

/// <summary>
/// Marks contract as the request half of a request/response NUI event and
/// names the response type, so <see cref="NuiEventAttribute"/> can pair the two
/// without the event name being repeated.
/// </summary>
/// <typeparam name="TResponse">The contract returned for this request.</typeparam>
/// <remarks>
/// <para>
/// A type marked <c>[NuiEvent("name")]</c> that implements <c>INuiRequest&lt;T&gt;</c>
/// becomes an entry in the generated <c>NuiEventMap</c> whose <c>request</c> is
/// the marked type and whose <c>response</c> is <typeparamref name="TResponse"/>.
/// </para>
/// <para>
/// The interface is only marker it carries no members and is never
/// serialized. Use the <see cref="NuiEventAttribute.Response"/> property instead
/// when the request type cannot implement the interface.
/// </para>
/// </remarks>
public interface INuiRequest<TResponse>
{
}
