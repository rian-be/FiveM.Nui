using System.Reflection;
using FiveM.Nui.Contracts.Metadata;

namespace FiveM.Nui.Contracts;

/// <summary>
/// Command-line entry point for the contract generator.
/// </summary>
internal static class Program
{
    private static int Main(string[] args)
    {
        if (!TryParse(args, out var request, out var exitCode))
        {
            if (exitCode == 0)
            {
                PrintUsage();
            }

            return exitCode;
        }

        try
        {
            return Run(request);
        }
        catch (Exception exception)
        {
            Console.Error.WriteLine($"error: {exception.Message}");
            return 1;
        }
    }

    private static int Run(Request request)
    {
        var probeDirectories = request.Assemblies
            .Select(path => Path.GetDirectoryName(Path.GetFullPath(path))!)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Append(AppContext.BaseDirectory)
            .ToList();

        AppDomain.CurrentDomain.AssemblyResolve += (_, eventArgs) =>
        {
            var simpleName = new AssemblyName(eventArgs.Name).Name;
            if (simpleName is null)
            {
                return null;
            }

            foreach (var directory in probeDirectories)
            {
                var candidate = Path.Combine(directory, simpleName + ".dll");
                if (File.Exists(candidate))
                {
                    try
                    {
                        return Assembly.LoadFrom(candidate);
                    }
                    catch (BadImageFormatException)
                    {
                        // Not a managed assembly; try the next probe directory.
                    }
                }
            }

            return null;
        };

        var assemblies = new List<Assembly>();
        foreach (var path in request.Assemblies)
        {
            var fullPath = Path.GetFullPath(path);
            if (!File.Exists(fullPath))
            {
                Console.Error.WriteLine($"error: assembly not found: {fullPath}");
                return 1;
            }

            assemblies.Add(Assembly.LoadFrom(fullPath));
        }

        var roots = ResolveRoots(assemblies, request.TypeNames, request.Namespace);
        if (roots.Length == 0)
        {
            Console.Error.WriteLine(
                "error: no contract types found. Mark DTOs with [NuiContract] or [NuiEvent], or pass --type.");
            return 1;
        }

        var docs = LoadDocs(request);

        var generator = new ContractGenerator(new ContractGeneratorOptions
        {
            Nullability = request.Nullability,
            EmitEventMap = request.EmitEventMap,
            CoreModuleName = request.CoreModuleName,
            Docs = docs,
        });

        var source = generator.Generate(roots);

        foreach (var warning in generator.Warnings)
        {
            Console.Error.WriteLine($"warning: {warning}");
        }

        if (request.ToStdout)
        {
            Console.Out.Write(source);
            return 0;
        }

        var output = Path.GetFullPath(request.Output ?? "contracts.ts");
        File.WriteAllText(output, source);
        Console.WriteLine(
            $"Wrote {roots.Length} contract type(s) and {generator.EventCount} event(s) to {output}");
        return 0;
    }

    private static XmlDocComments LoadDocs(Request request)
    {
        var paths = new List<string>();

        if (request.Docs.Count > 0)
        {
            foreach (var doc in request.Docs)
            {
                var fullPath = Path.GetFullPath(doc);
                if (File.Exists(fullPath))
                {
                    paths.Add(fullPath);
                }
                else
                {
                    Console.Error.WriteLine($"warning: documentation file not found: {fullPath}");
                }
            }
        }
        else
        {
            foreach (var assembly in request.Assemblies)
            {
                var candidate = Path.ChangeExtension(Path.GetFullPath(assembly), ".xml");
                if (File.Exists(candidate))
                {
                    paths.Add(candidate);
                }
            }
        }

        var docs = XmlDocComments.LoadFiles(paths);
        if (docs.IsEmpty)
        {
            Console.Error.WriteLine(
                "warning: no XML documentation found; generated types have no TSDoc comments. "
                + "Enable <GenerateDocumentationFile>true</GenerateDocumentationFile> or pass --doc.");
        }

        return docs;
    }

    private static Type[] ResolveRoots(IEnumerable<Assembly> assemblies, List<string> typeNames, string? namespaceFilter)
    {
        var all = assemblies.SelectMany(GetLoadableTypes).ToList();

        if (typeNames.Count > 0)
        {
            var resolved = new List<Type>();
            foreach (var name in typeNames)
            {
                var match = all.FirstOrDefault(type => type.FullName == name || type.Name == name)
                    ?? throw new InvalidOperationException($"type '{name}' was not found in the given assemblies.");

                resolved.Add(match);
            }

            return [.. resolved];
        }

        return [.. all
            .Where(type => ContractAttributes.HasContract(type)
                || ContractAttributes.HasEvent(type))
            .Where(type => namespaceFilter is null
                || (type.Namespace?.StartsWith(namespaceFilter, StringComparison.Ordinal) ?? false))
            .OrderBy(type => type.FullName, StringComparer.Ordinal)];
    }

    private static IEnumerable<Type> GetLoadableTypes(Assembly assembly)
    {
        try
        {
            return assembly.GetTypes();
        }
        catch (ReflectionTypeLoadException exception)
        {
            return exception.Types.Where(type => type is not null).Cast<Type>();
        }
    }

    private static bool TryParse(string[] args, out Request request, out int exitCode)
    {
        request = new Request();
        exitCode = 0;

        for (var index = 0; index < args.Length; index++)
        {
            var current = args[index];

            string? Value()
            {
                if (index + 1 >= args.Length)
                {
                    Console.Error.WriteLine($"error: missing value for {current}");
                    return null;
                }

                return args[++index];
            }

            switch (current)
            {
                case "--assembly" or "-a":
                    var assembly = Value();
                    if (assembly is null)
                    {
                        exitCode = 2;
                        return false;
                    }

                    request.Assemblies.Add(assembly);
                    break;

                case "--output" or "-o":
                    var output = Value();
                    if (output is null)
                    {
                        exitCode = 2;
                        return false;
                    }

                    request.Output = output;
                    break;

                case "--namespace" or "-n":
                    var @namespace = Value();
                    if (@namespace is null)
                    {
                        exitCode = 2;
                        return false;
                    }

                    request.Namespace = @namespace;
                    break;

                case "--doc" or "-d":
                    var doc = Value();
                    if (doc is null)
                    {
                        exitCode = 2;
                        return false;
                    }

                    request.Docs.Add(doc);
                    break;

                case "--type" or "-t":
                    var type = Value();
                    if (type is null)
                    {
                        exitCode = 2;
                        return false;
                    }

                    request.TypeNames.Add(type);
                    break;

                case "--null":
                    var mode = Value();
                    if (mode is null)
                    {
                        exitCode = 2;
                        return false;
                    }

                    if (!Enum.TryParse<NullabilityMode>(mode, ignoreCase: true, out var parsed))
                    {
                        Console.Error.WriteLine($"error: unknown --null value '{mode}' (use 'optional' or 'nullable').");
                        exitCode = 2;
                        return false;
                    }

                    request.Nullability = parsed;
                    break;

                case "--no-event-map":
                    request.EmitEventMap = false;
                    break;

                case "--core-module":
                    var coreModule = Value();
                    if (coreModule is null)
                    {
                        exitCode = 2;
                        return false;
                    }

                    request.CoreModuleName = coreModule;
                    break;

                case "--stdout":
                    request.ToStdout = true;
                    break;

                case "--help" or "-h":
                    PrintUsage();
                    exitCode = 0;
                    return false;

                default:
                    Console.Error.WriteLine($"error: unknown argument '{current}'.");
                    exitCode = 2;
                    return false;
            }
        }

        if (request.Assemblies.Count == 0)
        {
            Console.Error.WriteLine("error: at least one --assembly is required.");
            exitCode = 2;
            return false;
        }

        return true;
    }

    private static void PrintUsage()
    {
        Console.WriteLine(
            """
            fivem-nui-contracts - generate TypeScript contract declarations from C# NUI DTOs.

            Usage:
              fivem-nui-contracts --assembly <path> [options]

            Options:
              -a, --assembly <path>   Assembly to scan. Repeatable; required.
              -o, --output <path>     Output file. Defaults to contracts.ts.
              -n, --namespace <ns>    Only generate [NuiContract]/[NuiEvent] types under this namespace.
              -t, --type <full-name>  Generate a specific type instead of scanning. Repeatable.
              -d, --doc <path>        XML documentation file for TSDoc comments. Repeatable;
                                      defaults to the assembly's sibling .xml when present.
                  --null <mode>       Nullable member style: optional (default) or nullable.
                  --no-event-map      Do not emit the NuiEventMap module augmentation.
                  --core-module <m>   Module augmented with the event map. Defaults to @fivem-nui/core.
                  --stdout            Write to standard output instead of a file.
              -h, --help              Show this help.

            Exit codes: 0 success, 1 generation error, 2 usage error.
            """);
    }

    private sealed class Request
    {
        public List<string> Assemblies { get; } = [];

        public List<string> TypeNames { get; } = [];

        public List<string> Docs { get; } = [];

        public string? Namespace { get; set; }

        public string? Output { get; set; }

        public NullabilityMode Nullability { get; set; } = NullabilityMode.Optional;

        public bool EmitEventMap { get; set; } = true;

        public string CoreModuleName { get; set; } = "@fivem-nui/core";

        public bool ToStdout { get; set; }
    }
}
