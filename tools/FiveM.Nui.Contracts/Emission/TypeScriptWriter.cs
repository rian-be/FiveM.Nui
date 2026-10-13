using System.Text;
using FiveM.Nui.Contracts.Mapping;
using FiveM.Nui.Contracts.Metadata;
using FiveM.Nui.Contracts.Model;

namespace FiveM.Nui.Contracts.Emission;

/// <summary>
/// Renders a TypeScript module: the auto-generated banner and the declarations,
/// plus the <c>NuiEventMap</c> module augmentation.
/// </summary>
/// <param name="mapper">The type mapper used for member and event types.</param>
/// <param name="docs">The XML documentation used for TSDoc comments.</param>
/// <param name="options">The generation options.</param>
internal sealed class TypeScriptWriter(
    ITypeMapper mapper,
    XmlDocComments docs,
    ContractGeneratorOptions options)
{
    /// <summary>
    /// Renders the banner and every declaration, in the given order.
    /// </summary>
    /// <param name="declarations">The ordered declarations.</param>
    /// <returns>The rendered declarations block.</returns>
    public string WriteDeclarations(IReadOnlyList<Declaration> declarations)
    {
        var builder = new StringBuilder();
        WriteHeader(builder);

        for (var i = 0; i < declarations.Count; i++)
        {
            if (i > 0)
            {
                builder.Append('\n');
            }

            WriteDeclaration(builder, declarations[i]);
        }

        return builder.ToString();
    }

    /// <summary>
    /// Renders the <c>NuiEventMap</c> module augmentation, preceded by the blank
    /// line that separates it from the declarations.
    /// </summary>
    /// <param name="events">The ordered events.</param>
    /// <returns>The rendered event map block.</returns>
    public string WriteEventMap(IReadOnlyList<EventDefinition> events)
    {
        var builder = new StringBuilder();
        builder.Append('\n');
        builder.Append("declare module '").Append(options.CoreModuleName).Append("' {\n");
        builder.Append(options.Indent).Append("interface NuiEventMap {\n");

        foreach (var @event in events)
        {
            var members = new List<string>(3);
            if (@event.Request is not null)
            {
                members.Add("request: " + mapper.MapNonNullable(@event.Request));
            }

            if (@event.Response is not null)
            {
                members.Add("response: " + mapper.MapNonNullable(@event.Response));
            }

            if (@event.Payload is not null)
            {
                members.Add("payload: " + mapper.MapNonNullable(@event.Payload));
            }

            builder.Append(options.Indent).Append(options.Indent)
                .Append(ContractMembers.EscapeStringLiteral(@event.Name)).Append(": { ")
                .Append(string.Join("; ", members)).Append(" };\n");
        }

        builder.Append(options.Indent).Append("}\n");
        builder.Append("}\n");
        return builder.ToString();
    }

    private void WriteDeclaration(StringBuilder builder, Declaration declaration)
    {
        if (declaration.Type.IsEnum)
        {
            WriteEnum(builder, declaration);
            return;
        }

        WriteInterface(builder, declaration);
    }

    private void WriteInterface(StringBuilder builder, Declaration declaration)
    {
        WriteComment(builder, string.Empty, docs.ForType(declaration.Type));

        builder.Append("export interface ").Append(declaration.Name);

        if (declaration.Type.IsGenericType)
        {
            builder.Append('<');
            builder.Append(string.Join(", ", declaration.Type.GetGenericArguments().Select(p => p.Name)));
            builder.Append('>');
        }

        builder.Append(" {\n");

        foreach (var property in ContractMembers.Properties(declaration.Type))
        {
            WriteComment(builder, options.Indent, docs.ForMember(declaration.Type, property.Name));

            var (text, nullable) = mapper.Map(property.PropertyType, TypeIntrospection.CreateNullability(property));

            builder.Append(options.Indent).Append(ContractMembers.PropertyName(property));

            if (nullable && options.Nullability == NullabilityMode.Optional)
            {
                builder.Append('?');
            }

            builder.Append(": ").Append(text);

            if (nullable && options.Nullability == NullabilityMode.Nullable)
            {
                builder.Append(" | null");
            }

            builder.Append(";\n");
        }

        builder.Append("}\n");
    }

    private void WriteEnum(StringBuilder builder, Declaration declaration)
    {
        var members = ContractMembers.EnumMembers(declaration.Type).ToList();

        WriteComment(builder, string.Empty, docs.ForType(declaration.Type));

        builder.Append("export type ").Append(declaration.Name).Append(" =\n");

        if (members.Count == 0)
        {
            builder.Append(options.Indent).Append("never;\n");
            return;
        }

        for (var i = 0; i < members.Count; i++)
        {
            WriteComment(builder, options.Indent, docs.ForMember(declaration.Type, members[i].Name));

            builder.Append(options.Indent).Append("| ").Append(ContractMembers.EnumLiteral(members[i]));
            builder.Append(i < members.Count - 1 ? "\n" : ";\n");
        }
    }

    private void WriteHeader(StringBuilder builder)
    {
        builder.Append("// <auto-generated>\n");
        builder.Append("//   This file was generated by FiveM.Nui.Contracts from C# contract types.\n");
        builder.Append("//   Do not edit; rerun the generator instead.\n");
        builder.Append("// </auto-generated>\n");

        if (!string.IsNullOrWhiteSpace(options.Header))
        {
            builder.Append("//\n");
            foreach (var line in options.Header.Split('\n'))
            {
                builder.Append("// ").Append(line.TrimEnd()).Append('\n');
            }
        }

        builder.Append('\n');
    }

    private static void WriteComment(StringBuilder builder, string indent, string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return;
        }

        var lines = text
            .Replace("*/", "*\\/", StringComparison.Ordinal)
            .Replace("\r\n", "\n", StringComparison.Ordinal)
            .Replace('\r', '\n')
            .Split('\n');

        if (lines.Length == 1)
        {
            builder.Append(indent).Append("/** ").Append(lines[0]).Append(" */\n");
            return;
        }

        builder.Append(indent).Append("/**\n");
        foreach (var line in lines)
        {
            builder.Append(indent).Append(" *");
            if (line.Length > 0)
            {
                builder.Append(' ').Append(line);
            }

            builder.Append('\n');
        }

        builder.Append(indent).Append(" */\n");
    }
}
