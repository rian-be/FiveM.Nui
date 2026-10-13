using System.Text;
using System.Xml.Linq;

namespace FiveM.Nui.Contracts.Documentation;

/// <summary>
/// Flattens XML documentation nodes into plain text: summaries become
/// paragraph-separated text, inline tags are replaced by their referenced name,
/// and lists become bullet points.
/// </summary>
internal static class XmlDocRenderer
{
    /// <summary>
    /// Renders the text of a summary element, or <see langword="null"/> when
    /// there is no summary.
    /// </summary>
    /// <param name="summary">The summary element, or <see langword="null"/>.</param>
    /// <returns>The normalized summary text, or <see langword="null"/>.</returns>
    public static string? RenderSummary(XElement? summary) =>
        summary is null ? null : Normalize(Render(summary));

    /// <summary>
    /// Renders the text content of an element, flattening inline tags.
    /// </summary>
    /// <param name="element">The element to render.</param>
    /// <returns>The rendered text.</returns>
    public static string Render(XElement element)
    {
        var builder = new StringBuilder();
        AppendNodes(element, builder);
        return builder.ToString();
    }

    /// <summary>
    /// Normalizes rendered text into a single string: wrapped lines are joined
    /// into paragraphs and paragraphs are separated by blank lines.
    /// </summary>
    /// <param name="text">The raw rendered text.</param>
    /// <returns>The normalized text.</returns>
    public static string Normalize(string text)
    {
        var lines = text
            .Replace("\r\n", "\n", StringComparison.Ordinal)
            .Replace('\r', '\n')
            .Split('\n');

        var paragraphs = new List<string>();
        var current = new StringBuilder();
        foreach (var raw in lines)
        {
            var line = Collapse(raw.Trim());
            if (line.Length == 0)
            {
                if (current.Length > 0)
                {
                    paragraphs.Add(current.ToString());
                    current.Clear();
                }

                continue;
            }

            if (current.Length > 0)
            {
                current.Append(' ');
            }

            current.Append(line);
        }

        if (current.Length > 0)
        {
            paragraphs.Add(current.ToString());
        }

        return string.Join("\n\n", paragraphs);
    }

    private static void AppendNodes(XElement element, StringBuilder builder)
    {
        foreach (var node in element.Nodes())
        {
            switch (node)
            {
                case XText text:
                    builder.Append(text.Value);
                    break;

                case XElement child:
                    AppendElement(child, builder);
                    break;
            }
        }
    }

    private static void AppendElement(XElement element, StringBuilder builder)
    {
        switch (element.Name.LocalName)
        {
            case "see":
            case "seealso":
                var langword = element.Attribute("langword")?.Value;
                var cref = element.Attribute("cref")?.Value;
                if (!string.IsNullOrEmpty(langword))
                {
                    builder.Append(langword);
                }
                else if (!string.IsNullOrEmpty(cref))
                {
                    builder.Append(ShortReference(cref));
                }

                break;

            case "paramref":
            case "typeparamref":
                builder.Append(element.Attribute("name")?.Value);
                break;

            case "c":
            case "code":
                builder.Append('`');
                AppendNodes(element, builder);
                builder.Append('`');
                break;

            case "para":
                builder.Append("\n\n");
                AppendNodes(element, builder);
                break;

            case "list":
                AppendList(element, builder);
                break;

            default:
                AppendNodes(element, builder);
                break;
        }
    }

    private static void AppendList(XElement list, StringBuilder builder)
    {
        foreach (var item in list.Elements("item"))
        {
            var term = item.Element("term") is { } termElement ? Render(termElement).Trim() : null;
            var description = item.Element("description") is { } descriptionElement
                ? Render(descriptionElement).Trim()
                : null;

            builder.Append("\n\n- ");
            if (!string.IsNullOrEmpty(term))
            {
                builder.Append(term);
                if (!string.IsNullOrEmpty(description))
                {
                    builder.Append(": ");
                }
                else
                {
                    continue;
                }
            }

            if (!string.IsNullOrEmpty(description))
            {
                builder.Append(description);
            }
        }
    }

    private static string ShortReference(string cref)
    {
        var colon = cref.IndexOf(':');
        var body = colon >= 0 ? cref[(colon + 1)..] : cref;

        var paren = body.IndexOf('(');
        if (paren >= 0)
        {
            body = body[..paren];
        }

        var dot = body.LastIndexOf('.');
        var name = dot >= 0 ? body[(dot + 1)..] : body;

        var tick = name.IndexOf('`');
        return tick >= 0 ? name[..tick] : name;
    }

    private static string Collapse(string line)
    {
        var builder = new StringBuilder(line.Length);
        var previousSpace = false;
        foreach (var character in line)
        {
            if (character is ' ' or '\t')
            {
                if (!previousSpace)
                {
                    builder.Append(' ');
                }

                previousSpace = true;
                continue;
            }

            builder.Append(character);
            previousSpace = false;
        }

        return builder.ToString();
    }
}
