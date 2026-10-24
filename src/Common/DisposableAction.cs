namespace FiveM.Nui.Common;

/// <summary>
/// A reusable <see cref="IDisposable"/> adapter that runs a captured
/// <see cref="Action"/> on disposal. Used by transport and event subscription
/// sites that need to return an <see cref="IDisposable"/> handle.
/// </summary>
internal sealed class DisposableAction : IDisposable
{
    private Action? _action;

    public DisposableAction(Action action)
    {
        _action = action ?? throw new ArgumentNullException(nameof(action));
    }

    /// <summary>
    /// Disposes the <see cref="IDisposable"/> adapter and executes the captured <see cref="Action"/> if it has not been invoked yet.
    /// </summary>
    public void Dispose()
    {
        Interlocked.Exchange(ref _action, null)?.Invoke();
    }
}
