namespace FiveM.Nui.Common;

/// <summary>
/// A reusable <see cref="IDisposable"/> adapter that runs a captured
/// <see cref="Action"/> on disposal. Used by transport and event subscription
/// sites that need to return an <see cref="IDisposable"/> handle.
/// </summary>
internal sealed class DisposableAction(Action action) : IDisposable
{
    public void Dispose()
    {
        action();
    }
}
