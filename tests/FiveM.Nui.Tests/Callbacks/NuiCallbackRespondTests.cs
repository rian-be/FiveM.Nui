using System.Text.Json;

namespace FiveM.Nui.Tests.Callbacks;

/// <summary>
/// Covers answering raw NUI invocation, the exact contract that cannot be
/// simulated without the runtime.
/// </summary>
/// <remarks>
/// The runtime hands the handler two arguments: the request and a response
/// function. Registering a single-argument delegate drops the second, so the
/// POST never completes and times out in the browser. These tests pin down that
/// every path answers: success, bad body, and a throwing handler.
/// </remarks>
public sealed class NuiCallbackRespondTests
{
    /// <summary>
    /// Mirrors the delegate registered by <c>NuiCallbackBridge</c>: two
    /// arguments, with the response in the <c>finally</c>-equivalent.
    /// </summary>
    private static Action<object, Action<object>> Bridge(Action<string> handler) =>
        (request, respond) =>
        {
            string body;
            try
            {
                body = BodyOf(request);
            }
            catch (JsonException)
            {
                respond(new { code = "bad_request" });
                return;
            }

            try
            {
                handler(body);
            }
            catch (Exception exception)
            {
                respond(new { code = "handler_error", message = exception.Message });
                return;
            }

            respond(new { code = "ok", message = string.Empty });
        };

    private static string BodyOf(object? request) => request switch
    {
        IDictionary<object, object> untyped when untyped.TryGetValue("body", out var body) =>
            body as string ?? string.Empty,
        IDictionary<string, object> typed when typed.TryGetValue("body", out var typedBody) =>
            typedBody as string ?? string.Empty,
        JsonElement { ValueKind: JsonValueKind.Object } element
            when element.TryGetProperty("body", out var jsonBody) =>
            jsonBody.GetString() ?? string.Empty,
        string raw => raw,
        _ => throw new JsonException("unsupported request shape"),
    };

    [Fact]
    public void SuccessfulHandler_MustAnswer()
    {
        object? answer = null;
        var bridge = Bridge(_ => { });

        bridge(new Dictionary<object, object> { ["body"] = "{}" }, response => answer = response);

        Assert.NotNull(answer);
    }

    [Fact]
    public void AnsweredRequest_MustSatisfyPendingPost()
    {
        // Simulates the fetch promise: it settles only when the runtime
        // receives the response-function call.
        object? answer = null;
        var settled = false;
        var bridge = Bridge(_ => { });

        bridge(
            new Dictionary<object, object> { ["body"] = "{\"action\":\"loaded\"}" },
            response =>
            {
                answer = response;
                settled = true;
            });

        Assert.True(settled, "POST was left pending: the UI would time out");
        Assert.NotNull(answer);
    }

    [Fact]
    public void ThrowingHandler_MustAnswerWithError()
    {
        object? answer = null;
        var bridge = Bridge(_ => throw new InvalidOperationException("boom"));

        bridge(new Dictionary<object, object> { ["body"] = "{}" }, response => answer = response);

        Assert.NotNull(answer);
    }

    [Fact]
    public void UnreadableBody_MustAnswer()
    {
        object? answer = null;
        var bridge = Bridge(_ => { });

        bridge(new object(), response => answer = response);

        Assert.NotNull(answer);
    }

    [Fact]
    public void EveryPath_MustAnswerExactlyOnce()
    {
        foreach (var request in new[]
                 {
                     new Dictionary<object, object> { ["body"] = "{}" },
                     new object(),
                 })
        {
            var calls = 0;
            var bridge = request is not Dictionary<object, object>
                ? Bridge(_ => throw new InvalidOperationException("boom"))
                : Bridge(_ => { });

            bridge(request, _ => calls += 1);

            Assert.Equal(1, calls);
        }
    }
}