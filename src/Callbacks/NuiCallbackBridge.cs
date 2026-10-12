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
    /// The handler is registered as an Action object,
    /// rather than Action: the runtime passes <b>two</b>
    /// arguments to the reference - the request and the function that must be
    /// invoked to finish the HTTP call.
    /// </para>
    /// <para>
    /// A single argument delegate drops that second function, so the POST never
    /// gets a reply and expires after <c>postTimeoutMs</c> on the page side - with
    /// a <c>POST_TIMEOUT</c> log in the NUI console, while on the C# side the
    /// callback entered and returned without error. It looks like a lost message,
    /// but it is an uncalled reply callback. That is why the reply is sent exactly
    /// once, after handling completes: no reply guarantees a browser timeout, and
    /// a handler error must surface as an error rather than silence.
    /// </para>
    /// </remarks>
    public static void Register(string callback, Action<string> handler)
    {
        void Invoker(object? request, Action<object> respond)
        {
            string code;
            string message;

            try
            {
                var body = BodyOf(request);

                if (TraceCallbacks)
                {
                    Logger.LogInformation(
                        "callback '{Callback}' ENTER bodyType={Type} bodyLen={Length}",
                        callback, request?.GetType().FullName ?? "<null>", body.Length);
                }

                try
                {
                    handler(body);
                    code = "ok";
                    message = string.Empty;
                }
                catch (Exception exception)
                {
                    Logger.LogError(exception, "callback '{Callback}' THREW", callback);
                    code = "handler_error";
                    message = exception.Message;
                }
                finally
                {
                    if (TraceCallbacks)
                    {
                        Logger.LogInformation("callback '{Callback}' EXIT", callback);
                    }
                }
            }
            catch (Exception exception)
            {
                Logger.LogError(exception,
                    "callback '{Callback}': could not read body, type={Type}",
                    callback, request?.GetType().FullName ?? "<null>");
                code = "bad_request";
                message = "could not read body";
            }

            // Exactly one reply: named callbacks have no response contract, the
            // panel only waits for the POST to complete.
            Respond(respond, code, message);
        }

        Action<object?, Action<object>> invoker = Invoker;

        #pragma warning disable FIVEM001
        var reference = SharedAPI.GetCore().FuncRefManager.Register(invoker);
        #pragma warning restore FIVEM001
        
        var native = (int)reference;
        Native.RegisterRawNuiCallback(callback, native);

        // Always logged at information level: the reference number is what tells
        // us whether a callback that never fires was registered at all, and
        // whether two callbacks ended up sharing one function reference.
        #pragma warning disable FIVEM001
        Logger.LogInformation(
            "registered '{Callback}' funcRef={FuncRef} runtime={Runtime}",
            callback, native, SharedAPI.GetCore().GetType().Name);
        #pragma warning restore FIVEM001
    }

    /// <summary>
    /// Invokes the runtime reply function, finishing the HTTP request on the NUI side.
    /// </summary>
    /// <remarks>
    /// Exceptions are swallowed: the reply function does not exist when the
    /// runtime did not pass it through the function reference (e.g. an older
    /// client). If an exception escaped from here it would abort the callback and
    /// leave the POST without a reply - exactly the bug this method fixes.
    /// </remarks>
    private static void Respond(Action<object>? respond, string code, string message)
    {
        if (respond is null)
        {
            return;
        }

        try
        {
            respond(new { code, message });
        }
        catch (Exception exception)
        {
            Logger.LogWarning(exception, "callback response could not be delivered");
        }
    }

    private static string BodyOf(object? request)
    {
        if (request is IDictionary<object, object> untyped &&
            untyped.TryGetValue("body", out var body))
        {
            return BodyValue(body);
        }

        if (request is IDictionary<string, object> typed &&
            typed.TryGetValue("body", out var typedBody))
        {
            return BodyValue(typedBody);
        }

        if (request is JsonElement element &&
            element.ValueKind == JsonValueKind.Object &&
            element.TryGetProperty("body", out var jsonBody))
        {
            return BodyValue(jsonBody);
        }

        if (request is string raw)
        {
            return raw;
        }

        try
        {
            return JsonSerializer.Serialize(request);
        }
        catch (JsonException)
        {
            return string.Empty;
        }
    }

    private static string BodyValue(object? body) => body switch
    {
        string text => text,
        JsonElement { ValueKind: JsonValueKind.String } element => element.GetString() ?? string.Empty,
        JsonElement element => element.GetRawText(),
        _ => string.Empty,
    };
}
