using System.Reflection;
using System.Runtime.Loader;
using System.Text.Json;
using CitizenFX.FiveM.Client;
using CitizenFX.FiveM.Shared;
using FiveM.Nui.Hosting;

namespace FiveM.Nui.Callbacks;

/// <summary>
/// Registers raw NUI callbacks and hands the body to a handler as a JSON string.
/// </summary>
/// <remarks>
/// <para>
/// This is the FiveM-specific half of the bridge: the runtime passes the request
/// as a dictionary or a <see cref="JsonElement"/> depending on build, so every
/// shape is normalised here and the rest of the library only ever sees a string.
/// </para>
/// <para>
/// A throwing handler is logged instead of propagating, because an exception
/// escaping into the function reference would break the callback for the rest of
/// the session.
/// </para>
/// </remarks>
public static class NuiCallbackBridge
{
    /// <summary>
    /// Logger for registration and invocation diagnostics. Set once at startup;
    /// defaults to the library's own console-backed logger so a host that never
    /// configures anything still sees errors.
    /// </summary>
    /// <remarks>
    /// Backed by the C# 14 <see langword="field"/> keyword: the setter rejects a
    /// <see langword="null"/> logger so the property stays non-null for callers,
    /// while the initializer preserves the default.
    /// </remarks>
    /// <exception cref="ArgumentNullException">The assigned logger is <see langword="null"/>.</exception>
    public static INuiLogger Logger
    {
        get;
        set => field = value ?? throw new ArgumentNullException(nameof(Logger));
    } = FiveMNuiLogger.Shared;

    /// <summary>
    /// Verbose callback tracing. Off by default: it logs every NUI POST.
    /// </summary>
    public static bool TraceCallbacks { get; set; }
    
    /// <summary>
    /// Registers <paramref name="callback"/> and forwards each request body to
    /// <paramref name="handler"/>.
    /// </summary>
    /// <remarks>
    /// <para>
    /// The handler is registered as a two-argument delegate rather than a one-argument
    /// one: the runtime binds the incoming arguments positionally to the method
    /// signature, so the reference must accept both the request and the reply
    /// function it is handed.
    /// </para>
    /// <para>
    /// A single argument delegate would drop that second function, so the POST would
    /// never get a reply and would expire after <c>postTimeoutMs</c> on the page
    /// side - a <c>POST_TIMEOUT</c> in the NUI console while the C# side reports a
    /// clean call. It looks like a lost message, but it is an uncalled reply callback.
    /// That is why the reply is sent exactly once, after handling completes: no reply
    /// guarantees a browser timeout, and a handler error must surface as an error
    /// rather than silence.
    /// </para>
    /// </remarks>
    public static void Register(string callback, Action<string> handler)
    {
        ArgumentNullException.ThrowIfNull(handler);
        RegisterAsync(callback, body =>
        {
            handler(body);
            return Task.CompletedTask;
        });
    }

    /// <summary>Registers callback whose ack waits for asynchronous processing.</summary>
    public static void RegisterAsync(string callback, Func<string, Task> handler)
    {
        ArgumentNullException.ThrowIfNull(handler);
        // The native boundary requires a void delegate all asynchronous work and
        // failures are handled inside the awaited invocation.
        async void Invoker(object? request, Action<object>? respond) =>
            await NuiCallbackInvocation.InvokeAsync(callback, request, respond, handler, Logger, TraceCallbacks);

        Action<object?, Action<object>?> invoker = Invoker;

        var manager = ResolveFunctionReferences();
        var reference = RegisterFunctionReference(manager, invoker);
        Native.RegisterRawNuiCallback(callback, unchecked((int)reference));

        // Always logged at information level: the reference number is what tells
        // us whether a callback that never fires was registered at all, and
        // whether two callbacks ended up sharing one function reference.
        Logger.LogInformation(
            "registered '{Callback}' funcRef={FuncRef} manager={Manager}",
            callback, reference, manager.GetType().FullName ?? "<unknown>");
    }

    /// <summary>
    /// Hands <paramref name="handler"/> to a runtime function-reference manager and
    /// returns the reference the NUI native calls back through.
    /// </summary>
    /// <remarks>
    /// Both Enhanced runtimes put the manager behind a different name, and neither
    /// ships it in the reference assembly - it is wiring, not API. Each candidate is
    /// probed in turn and the resolved manager is cached.
    /// </remarks>
    private static uint RegisterFunctionReference(object manager, Delegate handler)
    {
        // Matched on the parameter type: the SDK's manager overloads Register on
        // (WrappedCall), (MethodInfo, object) and (Delegate), and a name-only
        // lookup would throw AmbiguousMatchException before it ever registers.
        var register = manager.GetType().GetMethod(
                "Register",
                BindingFlags.Instance | BindingFlags.Public,
                binder: null,
                types: [typeof(Delegate)],
                modifiers: null)
            ?? throw new InvalidOperationException(
                $"'{manager.GetType().FullName}' does not expose Register(Delegate).");

        return Convert.ToUInt32(register.Invoke(manager, [handler]));
    }

    private static object? _functionReferences;

    private static object ResolveFunctionReferences()
    {
        // Only a successful lookup is cached: the runtime assigns the manager while
        // it boots, so an early miss has to be retried rather than remembered.
        if (_functionReferences is not null)
        {
            return _functionReferences;
        }

        var probes = new List<string>();

        foreach (var (source, manager) in EnumerateFunctionReferenceManagers(probes))
        {
            _functionReferences = manager;
            Logger.LogInformation(
                "function-reference manager resolved from {Source}",
                source);
            return manager;
        }

        throw new InvalidOperationException(
            "No function-reference manager found; raw NUI callbacks cannot be registered. Probes: " +
            string.Join(" | ", probes));
    }

    /// <summary>
    /// Manager shapes: the FiveM for GTAV Enhanced SDK hangs its manager off the
    /// shared API, while the older core keeps it on the entrypoint - neither one
    /// is published in the reference assembly, so the legacy shape stays a probe.
    /// </summary>
    private static readonly (string Type, string Member)[] FunctionReferenceManagerPaths =
    [
        ("CitizenFX.Core.SharedEntrypoint", "FunctionReferences"),
    ];

    /// <summary>
    /// The SDK's own accessor, called directly instead of probed by name.
    /// </summary>
    private static object? TryGetSharedApiFunctionReferences(List<string> probes)
    {
        try
        {
#pragma warning disable FIVEM001 // GetCore() is marked internal-usage, but 0.0.4-alpha exposes FuncRefManager nowhere else.
            var core = SharedAPI.GetCore();
#pragma warning restore FIVEM001
            var manager = core?.FuncRefManager;

            if (manager is not null)
            {
                return manager;
            }

            probes.Add($"SharedAPI.GetCore().FuncRefManager is null (core={(core is null ? "null" : "set")})");
            return null;
        }
        catch (Exception exception)
        {
            probes.Add($"SharedAPI.GetCore().FuncRefManager threw {exception.GetType().Name}");
            return null;
        }
    }

    /// <summary>
    /// Probes every loaded assembly that declares a candidate manager, not just the
    /// first one.
    /// </summary>
    /// <remarks>
    /// The resource is loaded into its own
    /// <see cref="System.Runtime.Loader.AssemblyLoadContext"/>, and that
    /// context carries its own copy of the CitizenFX runtime assembly - the copy the
    /// host initialises. The default context holds a second, untouched copy whose
    /// statics were never assigned. Picking the first type found can therefore land
    /// on the copy where the manager is still <see langword="null"/>, which reads as
    /// "manager missing" even though the live one is one assembly further down.
    /// Every match is probed, in load order, and only non-null values are yielded.
    /// </remarks>
    private static IEnumerable<(string Source, object Manager)> EnumerateFunctionReferenceManagers(
        List<string> probes)
    {
        var typed = TryGetSharedApiFunctionReferences(probes);

        if (typed is not null)
        {
            yield return ("SharedAPI.GetCore().FuncRefManager", typed);
        }

        foreach (var (typeName, memberPath) in FunctionReferenceManagerPaths)
        {
            // Type.GetType with a bare name only probes the calling assembly and the
            // core library, so the type has to be looked up across the loaded ones.
            foreach (var assembly in CandidateAssemblies())
            {
                var type = assembly.GetType(typeName, throwOnError: false);

                if (type is null)
                {
                    continue;
                }

                var where = $"{assembly.GetName().Name}#{assembly.GetHashCode()}";
                object? owner = type;

                foreach (var step in memberPath.Split('.'))
                {
                    if (owner is null)
                    {
                        break;
                    }

                    var memberInfo = owner.GetType().GetMember(step,
                        BindingFlags.Static | BindingFlags.Instance | BindingFlags.Public)
                        .FirstOrDefault();

                    if (memberInfo is null)
                    {
                        probes.Add($"{typeName}.{step} missing in {where}");
                        owner = null;
                        break;
                    }

                    try
                    {
                        owner = memberInfo switch
                        {
                            PropertyInfo property => property.GetValue(null),
                            MethodInfo method => method.Invoke(null, null),
                            _ => null,
                        };
                    }
                    catch (TargetInvocationException)
                    {
                        // A reference-assembly stub throws from its getter; that build
                        // is not the live one, so this copy simply does not apply.
                        probes.Add($"{typeName} getter threw in {where}");
                        owner = null;
                    }
                }

                if (owner is null)
                {
                    probes.Add($"{typeName} is null in {where}");
                    continue;
                }

                yield return ($"{typeName} ({where})", owner);
            }
        }
    }

    /// <summary>
    /// Every loaded assembly, with the ones outside the default load context first.
    /// </summary>
    /// <remarks>
    /// The resource runs in a host-created context and the runtime assembly it
    /// initialises is the copy loaded there; the default context's copy of the same
    /// assembly is left untouched. Ordering by context keeps a never-initialised
    /// copy from shadowing the live one.
    /// </remarks>
    private static IEnumerable<Assembly> CandidateAssemblies()
    {
        var loaded = AppDomain.CurrentDomain.GetAssemblies();

        return loaded.Where(assembly => !IsDefaultContext(assembly))
            .Concat(loaded.Where(IsDefaultContext));
    }

    private static bool IsDefaultContext(Assembly assembly)
    {
        try
        {
            return AssemblyLoadContext.GetLoadContext(assembly) == AssemblyLoadContext.Default;
        }
        catch (Exception)
        {
            return true;
        }
    }

}
