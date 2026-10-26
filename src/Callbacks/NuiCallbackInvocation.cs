using System.Text.Json;

namespace FiveM.Nui.Callbacks;

/// <summary>Runtime-independent implementation used by the raw callback bridge.</summary>
internal static class NuiCallbackInvocation
{
    internal static async Task InvokeAsync(
        string callback, object? request, Action<object>? respond,
        Func<string, Task> handler, INuiLogger logger, bool trace = false)
    {
        string code;
        string message;
        try
        {
            var body = BodyOf(request);
            if (trace) logger.LogInformation("callback '{Callback}' ENTER", callback);
            try
            {
                await handler(body);
                code = "ok";
                message = string.Empty;
            }
            catch (Exception exception)
            {
                logger.LogError(exception, "callback '{Callback}' THREW", callback);
                code = "handler_error";
                message = "Callback processing failed.";
            }
            finally
            {
                if (trace) logger.LogInformation("callback '{Callback}' EXIT", callback);
            }
        }
        catch (Exception exception)
        {
            logger.LogError(exception, "callback '{Callback}': could not read body", callback);
            code = "bad_request";
            message = "could not read body";
        }

        Respond(respond, new { code, message }, logger);
    }

    private static void Respond(Action<object>? respond, object payload, INuiLogger logger)
    {
        if (respond is null)
        {
            return;
        }

        try
        {
            respond(payload);
        }
        catch (Exception exception)
        {
            logger.LogWarning(exception, "callback response could not be delivered");
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

        return JsonSerializer.Serialize(request);
    }

    private static string BodyValue(object? body) => body switch
    {
        string text => text,
        JsonElement { ValueKind: JsonValueKind.String } element => element.GetString() ?? string.Empty,
        JsonElement element => element.GetRawText(),
        _ => string.Empty,
    };
}
