namespace FiveM.Nui.Abstractions.Contracts;

/// <summary>
/// Marks a type as part of the NUI wire contract, so the TypeScript contract
/// generator emits a matching declaration for it.
/// </summary>
/// <remarks>
/// <para>
/// The generator mirrors every public instance property of a marked type in
/// TypeScript, using the same camelCase naming and string-enum policy as
/// <c>NuiJsonSerializer</c>. A property annotated with
/// <see cref="System.Text.Json.Serialization.JsonIgnoreAttribute"/> is skipped,
/// and <see cref="System.Text.Json.Serialization.JsonPropertyNameAttribute"/>
/// overrides the generated member name.
/// </para>
/// <para>
/// Contract types referenced by a marked type are emitted transitively, so
/// marking the request and response records of a feature is enough to generate
/// its whole contract surface.
/// </para>
/// </remarks>
[AttributeUsage(
    AttributeTargets.Class | AttributeTargets.Struct | AttributeTargets.Enum,
    Inherited = false)]
public sealed class NuiContractAttribute : Attribute
{
    /// <summary>
    /// Initializes a new instance of the <see cref="NuiContractAttribute"/> class.
    /// </summary>
    public NuiContractAttribute()
    {
    }

    /// <summary>
    /// Initializes a new instance of the <see cref="NuiContractAttribute"/> class
    /// with an explicit TypeScript type name.
    /// </summary>
    /// <param name="name">The TypeScript type name to emit instead of the CLR type name.</param>
    public NuiContractAttribute(string name)
    {
        Name = name;
    }

    /// <summary>
    /// Gets the TypeScript type name to emit, or <see langword="null"/> to derive
    /// the name from the CLR type name.
    /// </summary>
    public string? Name { get; }
}
