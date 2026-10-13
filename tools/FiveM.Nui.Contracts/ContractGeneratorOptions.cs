namespace FiveM.Nui.Contracts;

/// <summary>
/// Controls how a nullable C# member is represented in TypeScript.
/// </summary>
public enum NullabilityMode
{
    /// <summary>
    /// A nullable member becomes an optional property (<c>name?: T</c>). This
    /// matches the wire format, where null values are omitted on write.
    /// </summary>
    Optional,

    /// <summary>
    /// A nullable member becomes a required property that admits null
    /// (<c>name: T | null</c>).
    /// </summary>
    Nullable
}

/// <summary>
/// Options for <see cref="ContractGenerator"/>.
/// </summary>
public sealed record ContractGeneratorOptions
{
    /// <summary>
    /// Gets how nullable members are emitted. Defaults to
    /// <see cref="NullabilityMode.Optional"/>.
    /// </summary>
    public NullabilityMode Nullability { get; init; } = NullabilityMode.Optional;

    /// <summary>
    /// Gets free-form text placed under the auto-generated banner, or
    /// <see langword="null"/> for no extra header.
    /// </summary>
    public string? Header { get; init; }

    /// <summary> 
    /// Gets the string used for one level of indentation. Defaults to two spaces.
    /// </summary>
    public string Indent { get; init; } = "  ";

    /// <summary>
    /// Gets a value indicating whether the module reference for
    /// <c>[NuiEvent]</c> types is emitted. Defaults to <see langword="true"/>.
    /// </summary>
    public bool EmitEventMap { get; init; } = true;

    /// <summary>
    /// Gets the module augmented with the event map. Defaults to
    /// <c>@fivem-nui/core</c>.
    /// </summary>
    public string CoreModuleName { get; init; } = "@fivem-nui/core";

    /// <summary>
    /// Gets the XML documentation summaries used to emit TSDoc comments, or
    /// <see langword="null"/> to emit no comments. Defaults to
    /// <see langword="null"/>.
    /// </summary>
    public XmlDocComments? Docs { get; init; }
}
