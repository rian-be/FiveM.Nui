using System.Text.Json;
using FiveM.Nui.Callbacks;
using FiveM.Nui.Hosting;

namespace FiveM.Nui.Tests.Callbacks;

public sealed class NuiCallbackRespondTests
{
    [Fact]
    public async Task Invocation_WaitsForHandlerAndAnswersExactlyOnce()
    {
        var release = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var calls = 0;
        object? answer = null;
        var invocation = NuiCallbackInvocation.InvokeAsync(
            "ready", new Dictionary<object, object> { ["body"] = "{}" },
            response => { calls++; answer = response; }, _ => release.Task,
            NullNuiLogger.Instance);

        Assert.False(invocation.IsCompleted);
        Assert.Equal(0, calls);
        release.SetResult();
        await invocation;

        Assert.Equal(1, calls);
        Assert.Equal("ok", Property(answer, "code"));
    }

    [Fact]
    public async Task Invocation_DoesNotExposeExceptionDetails()
    {
        object? answer = null;
        await NuiCallbackInvocation.InvokeAsync(
            "ready", "{}", response => answer = response,
            _ => throw new InvalidOperationException("internal database password"),
            NullNuiLogger.Instance);

        Assert.Equal("handler_error", Property(answer, "code"));
        Assert.Equal("Callback processing failed.", Property(answer, "message"));
        Assert.DoesNotContain("password", JsonSerializer.Serialize(answer));
    }

    private static string? Property(object? value, string name) =>
        value?.GetType().GetProperty(name)?.GetValue(value) as string;
}
