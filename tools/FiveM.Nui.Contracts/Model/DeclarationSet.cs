namespace FiveM.Nui.Contracts.Model;

/// <summary>
/// The contract types discovered for a single generation run, keyed by their
/// generic type definition, with TypeScript name resolution.
/// </summary>
internal sealed class DeclarationSet
{
    private readonly Dictionary<Type, Declaration> _declarations = [];

    /// <summary>
    /// Gets the number of discovered declarations.
    /// </summary>
    public int Count => _declarations.Count;

    /// <summary>
    /// Gets every discovered declaration.
    /// </summary>
    public IEnumerable<Declaration> Declarations => _declarations.Values;

    /// <summary>
    /// Gets a value indicating whether a type definition is present.
    /// </summary>
    /// <param name="type">The generic type definition to look up.</param>
    /// <returns><see langword="true"/> when present.</returns>
    public bool ContainsKey(Type type) => _declarations.ContainsKey(type);

    /// <summary>
    /// Adds or replaces the declaration for a type definition.
    /// </summary>
    /// <param name="type">The generic type definition.</param>
    /// <param name="declaration">The declaration to store.</param>
    public void Add(Type type, Declaration declaration) => _declarations[type] = declaration;

    /// <summary>
    /// Adds the declaration only when the type definition is not present yet.
    /// </summary>
    /// <param name="type">The generic type definition.</param>
    /// <param name="declaration">The declaration to store.</param>
    /// <returns><see langword="true"/> when the declaration was added.</returns>
    public bool TryAdd(Type type, Declaration declaration) => _declarations.TryAdd(type, declaration);

    /// <summary>
    /// Resolves the emitted TypeScript name of a type, falling back to its simple
    /// name when the type is not part of the set.
    /// </summary>
    /// <param name="type">The type to resolve.</param>
    /// <returns>The emitted name, or the simple name when unknown.</returns>
    public string ResolveName(Type type)
    {
        var key = type.IsGenericType ? type.GetGenericTypeDefinition() : type;
        return _declarations.TryGetValue(key, out var declaration) ? declaration.Name : TsNames.KeyName(key);
    }
}
