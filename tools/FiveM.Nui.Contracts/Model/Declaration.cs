namespace FiveM.Nui.Contracts.Model;

/// <summary>
/// A contract type scheduled for emission, carrying its provisional name (the
/// declared or simple name) and the final, disambiguated TypeScript name
/// assigned by <see cref="FiveM.Nui.Contracts.Generation.DeclarationNamer"/>.
/// </summary>
/// <param name="type">The contract type.</param>
internal sealed class Declaration(Type type)
{
    /// <summary>
    /// Gets the contract type.
    /// </summary>
    public Type Type { get; } = type;

    /// <summary>
    /// Gets the name requested before collision resolution.
    /// </summary>
    public string ProvisionalName { get; } = TsNames.DeclaredName(type);

    /// <summary>
    /// Gets or sets the unique TypeScript name written to the output.
    /// </summary>
    public string Name { get; set; } = string.Empty;
}
