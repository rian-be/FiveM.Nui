using System.Xml.Linq;

namespace FiveM.Nui.Contracts.Documentation;

/// <summary>
/// Builds <see cref="XmlDocComments"/> from compiler-generated XML documentation
/// by understanding the standard member ID scheme: <c>T:</c> for types,
/// <c>P:</c> for properties, <c>F:</c> for fields (enum members) and the
/// <c>&lt;param&gt;</c> elements of a record's primary constructor, whose names
/// match the generated properties. When both a property and a constructor
/// parameter are documented, the property wins.
/// </summary>
internal sealed class XmlDocParser
{
    private readonly Dictionary<string, string> _types = new(StringComparer.Ordinal);
    private readonly Dictionary<string, Dictionary<string, string>> _members = new(StringComparer.Ordinal);
    private readonly Dictionary<string, Dictionary<string, string>> _parameters = new(StringComparer.Ordinal);

    /// <summary>
    /// Loads and merges documentation from every existing file in
    /// <paramref name="paths"/>, ignoring the ones that do not exist.
    /// </summary>
    /// <param name="paths">The candidate documentation file paths.</param>
    /// <returns>The merged documentation.</returns>
    public static XmlDocComments FromFiles(IEnumerable<string> paths)
    {
        var parser = new XmlDocParser();
        foreach (var path in paths)
        {
            if (File.Exists(path))
            {
                parser.Add(XDocument.Load(path));
            }
        }

        return parser.Build();
    }

    /// <summary>
    /// Parses documentation from an XML string.
    /// </summary>
    /// <param name="xml">The documentation XML.</param>
    /// <returns>The parsed documentation.</returns>
    public static XmlDocComments FromXml(string xml)
    {
        var parser = new XmlDocParser();
        using var reader = new StringReader(xml);
        parser.Add(XDocument.Load(reader));
        return parser.Build();
    }

    /// <summary>
    /// Merges the members of an XML documentation document into the parser.
    /// </summary>
    /// <param name="document">The documentation document.</param>
    public void Add(XDocument document)
    {
        foreach (var member in document.Descendants("member"))
        {
            var name = member.Attribute("name")?.Value;
            if (string.IsNullOrEmpty(name))
            {
                continue;
            }

            var summary = XmlDocRenderer.RenderSummary(member.Element("summary"));

            if (name.StartsWith("T:", StringComparison.Ordinal))
            {
                if (summary is not null)
                {
                    _types[name[2..]] = summary;
                }
            }
            else if (name.StartsWith("P:", StringComparison.Ordinal)
                || name.StartsWith("F:", StringComparison.Ordinal))
            {
                AddMember(name[2..], summary);
            }
            else if (name.StartsWith("M:", StringComparison.Ordinal))
            {
                AddParameters(member, name[2..]);
            }
        }
    }

    /// <summary>
    /// Produces the immutable documentation lookup.
    /// </summary>
    /// <returns>The parsed documentation.</returns>
    public XmlDocComments Build() => new(_types, _members, _parameters);

    private void AddMember(string qualifiedName, string? summary)
    {
        if (summary is null)
        {
            return;
        }

        // XML member IDs separate nested types with '.', reflection uses '+'.
        var dot = qualifiedName.LastIndexOf('.');
        if (dot <= 0)
        {
            return;
        }

        var type = qualifiedName[..dot];
        var member = qualifiedName[(dot + 1)..];
        GetBucket(_members, type)[member] = summary;
    }

    private void AddParameters(XElement member, string qualifiedName)
    {
        var paren = qualifiedName.IndexOf('(');
        var signature = paren >= 0 ? qualifiedName[..paren] : qualifiedName;
        const string constructorSuffix = ".#ctor";
        if (!signature.EndsWith(constructorSuffix, StringComparison.Ordinal))
        {
            return;
        }

        var type = signature[..^constructorSuffix.Length];
        foreach (var parameter in member.Elements("param"))
        {
            var name = parameter.Attribute("name")?.Value;
            if (string.IsNullOrEmpty(name))
            {
                continue;
            }

            var text = XmlDocRenderer.Normalize(XmlDocRenderer.Render(parameter));
            if (text.Length == 0)
            {
                continue;
            }

            GetBucket(_parameters, type)[name] = text;
        }
    }

    private static Dictionary<string, string> GetBucket(
        Dictionary<string, Dictionary<string, string>> source,
        string key)
    {
        if (!source.TryGetValue(key, out var bucket))
        {
            bucket = new Dictionary<string, string>(StringComparer.Ordinal);
            source[key] = bucket;
        }

        return bucket;
    }
}
