using FiveM.Nui.Callbacks;
using FiveM.Nui.Hosting;
using FiveM.Nui.Serialization;

namespace FiveM.Nui.Tests.Callbacks;

/// <summary>
/// Covers the callback registry: registration, duplicate rejection, removal, and
/// the serialization gates that keep a callback's executions one at a time.
/// </summary>
/// <remarks>
/// The gate is per callback by default, but callbacks that share a
/// <c>SerializationGroup</c> serialize against each other too, which is what the
/// cross-callback test pins down.
/// </remarks>
public class CallbackTests
{
    private readonly NuiJsonSerializer _serializer = new();
    private readonly NuiCallbackRegistry _registry = new(NullNuiLogger.Instance);

    [Fact]
    public void Register_Should_StoreHandler()
    {
        _registry.Register<string, string>("test:event", (_, _) =>
            Task.FromResult(NuiResult<string>.Ok("response")));

        var handler = _registry.GetHandler("test:event");
        Assert.NotNull(handler);
    }

    [Fact]
    public void Register_Duplicate_ShouldThrow()
    {
        _registry.Register<string, string>("test:event", (_, _) =>
            Task.FromResult(NuiResult<string>.Ok("response")));

        Assert.Throws<InvalidOperationException>(() =>
        {
            _registry.Register<string, string>("test:event", (_, _) =>
                Task.FromResult(NuiResult<string>.Ok("response2")));
        });
    }

    [Fact]
    public void Unregister_Should_RemoveHandler()
    {
        _registry.Register<string, string>("test:event", (_, _) =>
            Task.FromResult(NuiResult<string>.Ok("response")));

        _registry.Unregister("test:event");

        var handler = _registry.GetHandler("test:event");
        Assert.Null(handler);
    }

    [Fact]
    public async Task ExecuteAsync_Should_InvokeHandler()
    {
        _registry.Register<string, string>("test:event", async (req, _) =>
        {
            await Task.CompletedTask;
            return NuiResult<string>.Ok($"echo:{req}");
        });

        var handler = _registry.GetHandler("test:event");
        var resultJson = await handler!.ExecuteAsync("\"test\"", _serializer, CancellationToken.None);
        var resultMessage = _serializer.Deserialize<NuiMessage>(resultJson);

        Assert.NotNull(resultMessage);
        Assert.True(resultMessage.Success);
        Assert.NotNull(resultMessage.Payload);
    }

    [Fact]
    public async Task ExecuteAsync_WithException_ShouldReturnError()
    {
        _registry.Register<string, string>("test:event", (_, _) =>
            throw new InvalidOperationException("Test exception"));

        var handler = _registry.GetHandler("test:event");
        var resultJson = await handler!.ExecuteAsync("test", _serializer, CancellationToken.None);

        Assert.NotNull(resultJson);
        Assert.Contains("CALLBACK_ERROR", resultJson);
    }

    [Fact]
    public async Task Serialize_Should_RunExecutionsOneAtATime()
    {
        var concurrent = 0;
        var maxConcurrent = 0;
        var sync = new object();

        _registry.Register<string, string>("test:serialized", async (_, ct) =>
        {
            lock (sync)
            {
                concurrent++;
                maxConcurrent = Math.Max(maxConcurrent, concurrent);
            }

            await Task.Delay(50, ct);

            lock (sync)
            {
                concurrent--;
            }

            return NuiResult<string>.Ok("ok");
        }, new NuiCallbackOptions { Serialize = true });

        var handler = _registry.GetHandler("test:serialized")!;
        var first = handler.ExecuteAsync("\"x\"", _serializer, CancellationToken.None);
        var second = handler.ExecuteAsync("\"x\"", _serializer, CancellationToken.None);

        await Task.WhenAll(first, second);

        Assert.Equal(1, maxConcurrent);
    }

    [Fact]
    public async Task Serialize_WithSameGroup_Should_SerializeAcrossCallbacks()
    {
        var firstStarted = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var release = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var secondEntered = false;

        var options = new NuiCallbackOptions { Serialize = true, SerializationGroup = "shared" };

        _registry.Register<string, string>("test:a", async (_, _) =>
        {
            firstStarted.SetResult();
            await release.Task;
            return NuiResult<string>.Ok("a");
        }, options);

        _registry.Register<string, string>("test:b", (_, _) =>
        {
            secondEntered = true;
            return Task.FromResult(NuiResult<string>.Ok("b"));
        }, options);

        var a = _registry.GetHandler("test:a")!;
        var b = _registry.GetHandler("test:b")!;

        var taskA = a.ExecuteAsync("\"x\"", _serializer, CancellationToken.None);
        await firstStarted.Task;

        var taskB = b.ExecuteAsync("\"x\"", _serializer, CancellationToken.None);
        await Task.Delay(50);

        // "a" still holds the shared gate, so "b" must not have entered.
        Assert.False(secondEntered);

        release.SetResult();
        await Task.WhenAll(taskA, taskB);

        Assert.True(secondEntered);
    }

    [Fact]
    public async Task WithoutSerialize_Should_AllowOverlap()
    {
        var concurrent = 0;
        var maxConcurrent = 0;
        var sync = new object();

        _registry.Register<string, string>("test:free", async (_, ct) =>
        {
            lock (sync)
            {
                concurrent++;
                maxConcurrent = Math.Max(maxConcurrent, concurrent);
            }

            await Task.Delay(50, ct);

            lock (sync)
            {
                concurrent--;
            }

            return NuiResult<string>.Ok("ok");
        });

        var handler = _registry.GetHandler("test:free")!;
        var first = handler.ExecuteAsync("\"x\"", _serializer, CancellationToken.None);
        var second = handler.ExecuteAsync("\"x\"", _serializer, CancellationToken.None);

        await Task.WhenAll(first, second);

        Assert.Equal(2, maxConcurrent);
    }
}
