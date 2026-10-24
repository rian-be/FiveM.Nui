using FiveM.Nui.Callbacks;
using FiveM.Nui.Transport;

namespace FiveM.Nui;

/// <summary>
/// Gateway over <see cref="NuiClient"/> that adds one call
/// bootstrapping and window lifecycle helpers.
/// </summary>
/// <remarks>
/// <para>
/// Inheriting from <see cref="NuiClient"/> instead of wrapping it means
/// every outbound/inbound operation — <see cref="INuiMessenger.SendAsync"/>,
/// <see cref="INuiMessenger.RequestAsync"/>, <see cref="INuiMessenger.Publish"/>,
/// <see cref="INuiEventRouter.Subscribe"/>, <see cref="INuiCallbackServer.RegisterCallback"/>,
/// <see cref="INuiWindowManager.OpenAsync"/>, … — is inherited directly.
/// Resources use <c>_gateway.SendAsync(...)</c>, never a <c>Client</c> intermediary.
/// </para>
/// <para>
/// The only things added here are CitizenFX-specific bootstrapping:
/// <list type="bullet">
/// <item><description><see cref="Bootstrap"/> — registers the envelope callback plus
///   "ready"/"close" lifecycle hooks in one call.</description></item>
/// <item><description><see cref="ShowAsync"/> / <see cref="HideAsync"/> — collapse
///   the common open+focus / unfocus+close window lifecycle into one call.</description></item>
/// <item><description><see cref="Run"/> / <see cref="RegisterCallback"/> — static helpers
///   for fire and forget execution and raw callback registration.</description></item>
/// </list>
/// </para>
/// </remarks>
public class NuiGateway : NuiClient
{
    /// <summary>The default envelope callback name, matching the TypeScript bridge default.</summary>
    public const string EnvelopeCallback = "nui";

    /// <summary>The name of the window this gateway manages (passed to Open/Close/Focus).</summary>
    /// <remarks>
    /// Uses the C# 14 <see langword="field"/> keyword so the <c>init</c>
    /// accessor can reject a blank name while the getter stays trivial.
    /// </remarks>
    public string Window
    {
        get => field;
        init => field = string.IsNullOrWhiteSpace(value)
            ? throw new ArgumentException("Window name must be non-empty.", nameof(Window))
            : value;
    }

    /// <summary>
    /// Creates a gateway for <paramref name="window"/> with custom options.
    /// </summary>
    public NuiGateway(string window, NuiOptions? options = null)
        : base(options ?? DefaultOptions)
    {
        Window = window;
    }

    /// <summary>The default options used when the caller doesn't supply any.</summary>
    protected static NuiOptions DefaultOptions => new()
    {
        DefaultTimeout = TimeSpan.FromSeconds(30),
        MaxPayloadSize = 1024 * 1024,
        EnableDiagnostics = true,
        EnableDebugLogging = true,
        Runtime = new FiveMNuiRuntime()
    };
    
    /// <summary>
    /// Auto registers the envelope callback and NUI lifecycle hooks.
    /// </summary>
    /// <param name="onReady">
    /// Runs after <see cref="NuiClient.MarkNuiReady"/> on "ready". Use it to push the initial state.
    /// </param>
    /// <param name="onClose">
    /// Runs on "close". Defaults to <see cref="HideAsync"/> with <see cref="Window"/>.
    /// </param>
    public void Bootstrap(Func<Task>? onReady = null, Func<Task>? onClose = null)
    {
        RegisterCallback(EnvelopeCallback, ReceiveFromNui);

        RegisterCallbackAsync("ready", _ =>
        {
            MarkNuiReady();
            return onReady?.Invoke() ?? Task.CompletedTask;
        });

        var closeHandler = onClose ?? (() => HideAsync(Window));
        RegisterCallbackAsync("close", _ => closeHandler());
    }

    /// <summary>
    /// Opens, focuses, and optionally pushes state in one call.
    /// </summary>
    public async Task ShowAsync(string windowName, Func<Task>? onShown = null)
    {
        await OpenAsync(windowName);
        await FocusAsync(windowName);
        if (onShown != null) await onShown();
    }

    /// <summary>
    /// Unfocuses and closes the window, releasing the cursor.
    /// </summary>
    public async Task HideAsync(string windowName)
    {
        await UnfocusAsync(windowName);
        await CloseAsync(windowName);
    }
    
    /// <summary>
    /// Registers a raw NUI callback whose handlers receives the request body as a string.
    /// </summary>
    /// <param name="callback">The callback name the page posts to.</param>
    /// <param name="handler">The handler receiving the raw request body.</param>
    public static void RegisterCallback(string callback, Action<string> handler) =>
        NuiCallbackBridge.Register(callback, handler);

    /// <summary>Registers a raw callback that responds after its handler completes.</summary>
    public static void RegisterCallbackAsync(string callback, Func<string, Task> handler) =>
        NuiCallbackBridge.RegisterAsync(callback, handler);

    /// <summary>
    /// Runs a handler without blocking the command loop. Failures are logged
    /// instead of escaping as an unobserved task.
    /// </summary>
    /// <param name="action">The asynchronous handler to run.</param>
    public static async void Run(Func<Task> action)
    {
        try
        {
            await action();
        }
        catch (NuiException exception)
        {
            NuiCallbackBridge.Logger.LogWarning("{ErrorCode} - {Message}",
                exception.ErrorCode, exception.Message);
        }
        catch (Exception exception)
        {
            NuiCallbackBridge.Logger.LogError(exception, "{Message}", exception.Message);
        }
    }
}
