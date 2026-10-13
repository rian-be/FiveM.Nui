namespace FiveM.Nui.Abstractions.Contracts;

/// <summary>
/// Registers a contract as an NUI event, so the TypeScript contract generator
/// adds it to the generated <c>NuiEventMap</c>.
/// </summary>
/// <remarks>
/// <para>
/// The event shape is inferred from the marked type and, optionally, the
/// <see cref="Request"/> and <see cref="Response"/> properties:
/// </para>
/// <list type="bullet">
/// <item>
/// <description>
/// When neither property is set and the type implements
/// <see cref="INuiRequest{TResponse}"/>, the entry pairs the marked type as the
/// request with its response: <c>'name': { request: TheType; response: TResponse }</c>.
/// </description>
/// </item>
/// <item>
/// <description>
/// When neither property is set and the type is not a request, the entry is a
/// fire and forget event: <c>'name': { payload: TheType }</c>.
/// </description>
/// </item>
/// <item>
/// <description>
/// When <see cref="Response"/> is set, the marked type is the request (unless
/// <see cref="Request"/> overrides it) and the entry is
/// <c>'name': { request: TheType; response: TheResponse }</c>.
/// </description>
/// </item>
/// </list>
/// <para>
/// A type carrying <see cref="NuiEventAttribute"/> is emitted as a contract even
/// without <see cref="NuiContractAttribute"/>, and the types it references are
/// emitted transitively.
/// </para>
/// <para>
/// The attribute is repeatable, so a single contract can back several event
/// names (for example, shared event payload published on more than one
/// channel).
/// </para>
/// </remarks>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Struct, AllowMultiple = true, Inherited = false)]
public sealed class NuiEventAttribute : Attribute
{
    /// <summary>
    /// Initializes a new instance of the <see cref="NuiEventAttribute"/> class.
    /// </summary>
    /// <param name="name">The event name as it appears on the wire.</param>
    public NuiEventAttribute(string name)
    {
        Name = name;
    }

    /// <summary>
    /// Gets the event name as it appears on the wire.
    /// </summary>
    public string Name { get; }

    /// <summary>
    /// Gets or sets the request contract, or <see langword="null"/> to use the
    /// marked type.
    /// </summary>
    public Type? Request { get; set; }

    /// <summary>
    /// Gets or sets the response contract, or <see langword="null"/> to infer it
    /// from <see cref="INuiRequest{TResponse}"/>.
    /// </summary>
    public Type? Response { get; set; }
}
