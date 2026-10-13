using FiveM.Nui.Contracts.Emission;
using FiveM.Nui.Contracts.Generation;
using FiveM.Nui.Contracts.Mapping;
using FiveM.Nui.Contracts.Model;

namespace FiveM.Nui.Contracts;

/// <summary>
/// Generates TypeScript declarations from C# contract types. This facade wires
/// the discovery, naming, mapping, and emission stages together.
/// </summary>
/// <remarks>
/// The mapping mirrors <c>NuiJsonSerializer</c>: member names use the camelCase
/// policy, enums become string-literal unions, and null is expressed either as an
/// optional member or as a null union depending on <see cref="ContractGeneratorOptions.Nullability"/>.
/// </remarks>
public sealed class ContractGenerator
{
    private readonly ContractGeneratorOptions _options;
    private readonly XmlDocComments _docs;
    private readonly List<string> _warnings = [];

    /// <summary>
    /// Initializes a new instance of the <see cref="ContractGenerator"/> class.
    /// </summary>
    /// <param name="options">Generation options, or <see langword="null"/> for defaults.</param>
    public ContractGenerator(ContractGeneratorOptions? options = null)
    {
        _options = options ?? new ContractGeneratorOptions();
        _docs = _options.Docs ?? XmlDocComments.Empty;
    }

    /// <summary>
    /// Gets the warnings collected during the last <see cref="Generate"/> call,
    /// such as types that were mapped to <c>unknown</c>.
    /// </summary>
    public IReadOnlyList<string> Warnings => _warnings;

    /// <summary>
    /// Gets the number of NUI events emitted by the last <see cref="Generate"/>
    /// call.
    /// </summary>
    public int EventCount { get; private set; }

    /// <summary>
    /// Generates a single TypeScript module for the given root contract types.
    /// </summary>
    /// <param name="rootTypes">The types to emit. Referenced contract types are added transitively.</param>
    /// <returns>The generated TypeScript source.</returns>
    /// <exception cref="ArgumentNullException">A root type is <see langword="null"/>.</exception>
    /// <exception cref="InvalidOperationException">No contract types were supplied.</exception>
    public string Generate(IEnumerable<Type> rootTypes)
    {
        ArgumentNullException.ThrowIfNull(rootTypes);
        _warnings.Clear();
        EventCount = 0;

        var declarations = new DeclarationSet();
        var graph = new TypeGraphBuilder(declarations);
        var events = new List<EventDefinition>();

        foreach (var root in rootTypes)
        {
            ArgumentNullException.ThrowIfNull(root);
            graph.Collect(root);
            EventCollector.Collect(root, events);
        }

        foreach (var @event in events)
        {
            if (@event.Request is not null)
            {
                graph.Collect(@event.Request);
            }

            if (@event.Response is not null)
            {
                graph.Collect(@event.Response);
            }

            if (@event.Payload is not null)
            {
                graph.Collect(@event.Payload);
            }
        }

        if (declarations.Count == 0)
        {
            throw new InvalidOperationException("No contract types were found to generate.");
        }

        DeclarationNamer.Assign(declarations.Declarations);

        var mapper = new TypeMapper(declarations, _options, _warnings);
        var writer = new TypeScriptWriter(mapper, _docs, _options);
        var ordered = declarations.Declarations
            .OrderBy(declaration => declaration.Name, StringComparer.Ordinal)
            .ToList();

        var source = writer.WriteDeclarations(ordered);

        var map = new EventMapBuilder(_warnings).Build(events);
        EventCount = map.Count;

        if (_options.EmitEventMap && map.Count > 0)
        {
            source += writer.WriteEventMap(map);
        }

        return source;
    }
}
