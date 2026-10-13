using FiveM.Nui.Contracts.Documentation;

namespace FiveM.Nui.Contracts;

/// <summary>
/// Reads the XML documentation file produced by the C# compiler (enabled with
/// <c>GenerateDocumentationFile</c>) and exposes the summaries for contract
/// types and members so <see cref="ContractGenerator"/> can emit matching TSDoc
/// comments.
/// </summary>
/// <remarks>
/// <para>
/// The reader understands the standard member ID scheme: <c>T:</c> for types,
/// <c>P:</c> for properties, <c>F:</c> for fields (enum members) and the
/// <c>param</c> elements of a record's primary constructor, whose names
/// match the generated properties. When both a property and a constructor
/// parameter are documented, the property wins.
/// </para>
/// </remarks>
public sealed class XmlDocComments
{
    private readonly Dictionary<string, string> _types;
    private readonly Dictionary<string, Dictionary<string, string>> _members;
    private readonly Dictionary<string, Dictionary<string, string>> _parameters;

    internal XmlDocComments(
        Dictionary<string, string> types,
        Dictionary<string, Dictionary<string, string>> members,
        Dictionary<string, Dictionary<string, string>> parameters)
    {
        _types = types;
        _members = members;
        _parameters = parameters;
    }

    /// <summary>
    /// Gets an instance that carries no documentation.
    /// </summary>
    public static XmlDocComments Empty { get; } = new(
        new Dictionary<string, string>(StringComparer.Ordinal),
        new Dictionary<string, Dictionary<string, string>>(StringComparer.Ordinal),
        new Dictionary<string, Dictionary<string, string>>(StringComparer.Ordinal));

    /// <summary>
    /// Gets a value indicating whether no summaries are available.
    /// </summary>
    public bool IsEmpty => _types.Count == 0 && _members.Count == 0 && _parameters.Count == 0;

    /// <summary>
    /// Loads documentation from a single XML file.
    /// </summary>
    /// <param name="path">The path to the compiler-generated XML documentation file.</param>
    /// <returns>The parsed documentation.</returns>
    public static XmlDocComments Load(string path)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(path);
        return Parse(File.ReadAllText(path));
    }

    /// <summary>
    /// Loads and merges documentation from every existing file in
    /// <paramref name="paths"/>, ignoring the ones that do not exist.
    /// </summary>
    /// <param name="paths">The candidate documentation file paths.</param>
    /// <returns>The merged documentation.</returns>
    public static XmlDocComments LoadFiles(IEnumerable<string> paths)
    {
        ArgumentNullException.ThrowIfNull(paths);
        return XmlDocParser.FromFiles(paths);
    }

    /// <summary>
    /// Parses documentation from an XML string.
    /// </summary>
    /// <param name="xml">The documentation XML.</param>
    /// <returns>The parsed documentation.</returns>
    public static XmlDocComments Parse(string xml)
    {
        ArgumentNullException.ThrowIfNull(xml);
        return XmlDocParser.FromXml(xml);
    }

    /// <summary>
    /// Gets the summary for a type, or <see langword="null"/> when none exists.
    /// </summary>
    /// <param name="type">The type to look up.</param>
    /// <returns>The summary text, or <see langword="null"/>.</returns>
    public string? ForType(Type type) =>
        _types.TryGetValue(TypeKey(type), out var text) ? text : null;

    /// <summary>
    /// Gets the summary for a member of a type (a property, field, or record
    /// constructor parameter), or <see langword="null"/> when none exists.
    /// </summary>
    /// <param name="declaringType">The type declaring the member.</param>
    /// <param name="memberName">The member name (property, field, or parameter).</param>
    /// <returns>The summary text, or <see langword="null"/>.</returns>
    public string? ForMember(Type declaringType, string memberName)
    {
        ArgumentNullException.ThrowIfNull(declaringType);
        ArgumentException.ThrowIfNullOrEmpty(memberName);

        var key = TypeKey(declaringType);
        if (_members.TryGetValue(key, out var members) && members.TryGetValue(memberName, out var text))
        {
            return text;
        }

        return _parameters.TryGetValue(key, out var parameters)
            && parameters.TryGetValue(memberName, out var parameterText)
                ? parameterText
                : null;
    }

    private static string TypeKey(Type type)
    {
        // XML member IDs separate nested types with '.', reflection uses '+'.
        return (type.FullName ?? type.Name).Replace('+', '.');
    }
}
