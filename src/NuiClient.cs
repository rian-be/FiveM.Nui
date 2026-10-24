using FiveM.Nui.Callbacks;
using FiveM.Nui.Diagnostics;
using FiveM.Nui.Hosting;
using FiveM.Nui.Lifecycle;
using FiveM.Nui.Messaging;
using FiveM.Nui.Serialization;
using FiveM.Nui.Transport;
using FiveM.Nui.Windows;

namespace FiveM.Nui;

/// <summary>
/// Main implementation of the outbound/inbound NUI coordination surface.
/// Implements <see cref="INuiMessenger"/>, <see cref="INuiCallbackServer"/>,
/// <see cref="INuiEventRouter"/>, <see cref="INuiInboundHandler"/>,
/// <see cref="INuiLifecycleObserver"/>, <see cref="INuiDiagnosticsProvider"/>,
/// and <see cref="INuiWindowManager"/> — pick the narrowest interface you need.
/// </summary>
/// <remarks>
/// <para>
/// <strong>DIP</strong> — all volatile collaborators (transport, serializer,
/// callback registry, diagnostics, lifecycle, request coordinator, event bus)
/// are accepted through abstractions in the secondary constructor. The
/// parameterless convenience overload composes sensible defaults and delegates.
/// </para>
/// <para>
/// <strong>SRP</strong> — inbound message dispatch (envelope → callback /
/// request-completion / event-publish) lives in <see cref="NuiInboundHandler"/>,
/// leaving this class as a thin facade over outbound messaging, window
/// management, and lifecycle observation. To keep any single file small, 
/// interface splits the facade across partials: this file holds composition,
/// construction, inbound entry, and disposal, while
/// <c>NuiClient.Messaging.cs</c>, <c>NuiClient.Routing.cs</c> and
/// <c>NuiClient.Windows.cs</c> hold the per-interface members.
/// </para>
/// </remarks>
public partial class NuiClient :
    INuiMessenger,
    INuiCallbackServer,
    INuiEventRouter,
    INuiInboundHandler,
    INuiLifecycleObserver,
    INuiDiagnosticsProvider,
    INuiWindowManager,
    IAsyncDisposable
{
    private INuiTransport _transport = null!;
    private INuiSerializer _serializer = null!;
    private INuiCallbackRegistry _callbackRegistry = null!;
    private INuiWindowManager _windowManager = null!;
    private INuiRequestCoordinator _requestManager = null!;
    private INuiEventBus _eventManager = null!;
    private INuiDiagnosticsCollector _diagnostics = null!;
    private NuiStateMachine _lifecycle = null!;
    private NuiInboundHandler _inboundHandler = null!;
    private NuiOptions _options = null!;
    private INuiLogger _logger = null!;
    private CancellationTokenSource _cts = new();
    private IDisposable? _transportSubscription;
    private readonly SemaphoreSlim _configurationGate = new(1, 1);
    private int _disposed;

    /// <summary>
    /// The full collaborator graph, built once by <see cref="Compose"/> so the
    /// convenience constructor and <see cref="Reconfigure"/> never repeat the
    /// default wiring. The DI-friendly constructor injects collaborators
    /// field-by-field instead.
    /// </summary>
    private sealed record Components(
        INuiLogger Logger,
        INuiSerializer Serializer,
        INuiTransport Transport,
        INuiCallbackRegistry CallbackRegistry,
        INuiWindowManager WindowManager,
        INuiRequestCoordinator RequestManager,
        INuiEventBus EventManager,
        INuiDiagnosticsCollector Diagnostics,
        NuiStateMachine Lifecycle);

    /// <summary>
    /// Builds the default collaborator graph for the given options.
    /// </summary>
    /// <param name="opts">Options driving the default implementations.</param>
    /// <returns>The composed collaborator graph.</returns>
    private static Components Compose(NuiOptions opts)
    {
        var logger = ResolveLogger(opts);
        var serializer = new NuiJsonSerializer();

        // Default to the real FiveM runtime, the caller only overrides it to
        // substitute fake (tests).
        var runtime = opts.Runtime ?? new FiveMNuiRuntime();

        return new Components(
            Logger: logger,
            Serializer: serializer,
            Transport: new FiveMNuiTransport(serializer, logger, runtime),
            CallbackRegistry: new NuiCallbackRegistry(logger),
            WindowManager: new NuiWindowManager(logger, runtime, serializer),
            RequestManager: new ConcurrentRequestManager(logger),
            EventManager: new EventManager(logger),
            Diagnostics: new NuiDiagnostics(opts, logger),
            Lifecycle: new NuiStateMachine(logger));
    }

    /// <summary>
    /// Normalizes an injected lifecycle collaborator to the concrete machine;
    /// a non <see cref="NuiStateMachine"/> implementation falls back to a fresh
    /// machine, so the façade always has validated state machine to drive.
    /// </summary>
    /// <param name="lifecycle">The injected lifecycle collaborator.</param>
    /// <param name="logger">Logger used only when a fallback machine must be created.</param>
    /// <returns>The lifecycle as a <see cref="NuiStateMachine"/>, or a fresh machine otherwise.</returns>
    private static NuiStateMachine ToStateMachine(INuiLifecycleMachine lifecycle, INuiLogger logger) =>
        lifecycle as NuiStateMachine ?? new NuiStateMachine(logger);

    // ------------------------------------------------------------------
    // Constructors
    // ------------------------------------------------------------------

    /// <summary>
    /// Convenience constructor that composes all default implementations.
    /// </summary>
    /// <param name="options">Options to apply; defaults are used when omitted.</param>
    public NuiClient(NuiOptions? options = null)
    {
        var opts = options ?? new NuiOptions();
        Initialize(opts, Compose(opts));
    }

    /// <summary>
    /// DI-friendly constructor that accepts every collaborator through its
    /// abstraction. Use this when wiring the client into an <see cref="IServiceProvider"/>.
    /// </summary>
    /// <param name="options">Configuration for timeout, payload ceiling, logging, and runtime.</param>
    /// <param name="logger">Diagnostic logger.</param>
    /// <param name="serializer">Serializer used for envelope payloads.</param>
    /// <param name="transport">Transport carrying messages to and from the NUI page.</param>
    /// <param name="callbackRegistry">Registry resolving inbound callback names to handlers.</param>
    /// <param name="windowManager">Manager driving NUI window open/close/focus state.</param>
    /// <param name="requestManager">Coordinator correlating requests with their responses.</param>
    /// <param name="eventManager">Bus routing published events to subscribers.</param>
    /// <param name="diagnostics">Collector gathering metrics.</param>
    /// <param name="lifecycle">State machine tracking page-load progression.</param>
    public NuiClient(
        NuiOptions options,
        INuiLogger logger,
        INuiSerializer serializer,
        INuiTransport transport,
        INuiCallbackRegistry callbackRegistry,
        INuiWindowManager windowManager,
        INuiRequestCoordinator requestManager,
        INuiEventBus eventManager,
        INuiDiagnosticsCollector diagnostics,
        INuiLifecycleMachine lifecycle)
    {
        Initialize(options, new Components(
            logger, serializer, transport, callbackRegistry, windowManager,
            requestManager, eventManager, diagnostics, ToStateMachine(lifecycle, logger)));
    }

    /// <summary>
    /// Rebuilds runtime collaborators while preserving callback registrations,
    /// event subscriptions and their disposers. Cancels pending requests. Used by host
    /// layers (e.g., NuiGateway) that need to swap configuration at runtime
    /// without replacing the whole client instance.
    /// </summary>
    /// <param name="options">The options describing the collaborator graph to rebuild.</param>
    public void Reconfigure(NuiOptions options)
    {
        ReconfigureAsync(options).AsTask().GetAwaiter().GetResult();
    }

    /// <summary>
    /// Asynchronously rebuilds runtime collaborators while preserving callback
    /// registrations and event subscriptions. Reconfiguration and disposal are
    /// serialized so neither can tear down collaborators being installed by the other.
    /// </summary>
    /// <param name="options">The options describing the collaborator graph to rebuild.</param>
    /// <param name="cancellationToken">Cancels while waiting to start or releasing window focus.</param>
    public async ValueTask ReconfigureAsync(
        NuiOptions options,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(options);
        ValidateOptions(options);
        ThrowIfDisposed();

        await _configurationGate.WaitAsync(cancellationToken);
        try
        {
            ThrowIfDisposed();
            var components = Compose(options) with
            {
                CallbackRegistry = _callbackRegistry,
                EventManager = _eventManager
            };

            var previousCts = _cts;
            var previousRequestManager = _requestManager;

            if (_windowManager.GetFocusedWindow() is { } focused)
                await _windowManager.UnfocusAsync(focused, cancellationToken);

            _transportSubscription?.Dispose();
            await previousCts.CancelAsync();
            previousCts.Dispose();
            _cts = new CancellationTokenSource();

            Initialize(options, components);
            await previousRequestManager.DisposeAsync();
        }
        finally
        {
            _configurationGate.Release();
        }
    }
    
    /// <summary>
    /// Binds a composed collaborator graph to its fields and starts inbound
    /// dispatch by subscribing a fresh <see cref="NuiInboundHandler"/> to the
    /// transport. Shared by both constructors and by <see cref="Reconfigure"/>.
    /// </summary>
    /// <param name="options">Options captured alongside the collaborators.</param>
    /// <param name="components">The collaborator graph to bind.</param>
    private void Initialize(NuiOptions options, Components components)
    {
        ValidateOptions(options);
        ArgumentNullException.ThrowIfNull(components.Logger);
        ArgumentNullException.ThrowIfNull(components.Serializer);
        ArgumentNullException.ThrowIfNull(components.Transport);
        ArgumentNullException.ThrowIfNull(components.CallbackRegistry);
        ArgumentNullException.ThrowIfNull(components.WindowManager);
        ArgumentNullException.ThrowIfNull(components.RequestManager);
        ArgumentNullException.ThrowIfNull(components.EventManager);
        ArgumentNullException.ThrowIfNull(components.Diagnostics);
        ArgumentNullException.ThrowIfNull(components.Lifecycle);

        _options = options;
        _logger = components.Logger;
        _serializer = components.Serializer;
        _transport = components.Transport;
        _callbackRegistry = components.CallbackRegistry;
        _windowManager = components.WindowManager;
        _requestManager = components.RequestManager;
        _eventManager = components.EventManager;
        _diagnostics = components.Diagnostics;
        _lifecycle = components.Lifecycle;

        _inboundHandler = new NuiInboundHandler(
            _serializer, _logger, _callbackRegistry, _transport,
            _requestManager, _eventManager, _diagnostics, options, _cts.Token);

        _transportSubscription = _transport.Subscribe(_inboundHandler.HandleIncomingMessage);

        _logger.LogInformation(
            "Initialized. timeout={Timeout}s diagnostics={Diagnostics} debug={Debug} payloads={Payloads} runtime={Runtime}",
            _options.DefaultTimeout.TotalSeconds,
            _options.EnableDiagnostics,
            _options.EnableDebugLogging,
            _options.LogPayloads,
            _options.Runtime?.GetType().Name ?? "null");
    }
    
    /// <summary>
    /// Receives a raw envelope posted by the NUI page. Call this from the
    /// resource's raw NUI callback registration; it is the entry point that
    /// makes callbacks, events, and request responses work.
    /// </summary>
    /// <remarks>
    /// Any traffic from the page is proof it booted, so this is also where the
    /// lifecycle leaves <see cref="NuiLifecycleState.Loading"/>. That matters
    /// because a page that never loads leaves the client stuck in
    /// <c>Loading</c>, which is visible rather than indistinguishable from a
    /// message that silently went nowhere.
    /// </remarks>
    /// <param name="json">The raw JSON envelope posted by the page.</param>
    public void ReceiveFromNui(string json)
    {
        ThrowIfDisposed();
        ArgumentNullException.ThrowIfNull(json);
        _lifecycle.MarkReady("page sent traffic");
        _transport.OnMessageReceived(json);
    }
    
    /// <summary>
    /// Shuts the client down: marks the lifecycle disposed, cancels in flight work,
    /// and releases the transport and request coordinator.
    /// </summary>
    /// <remarks>
    /// Marking the lifecycle before cancellation makes a canceled request read as a
    /// deliberate stop rather than live client failing.
    /// </remarks>
    /// <returns>A task that completes once the client has released its resources.</returns>
    public async ValueTask DisposeAsync()
    {
        if (Interlocked.Exchange(ref _disposed, 1) != 0) return;
        await _configurationGate.WaitAsync();
        try
        {
            _logger.LogInformation("Disposing.");

            _lifecycle.MarkDisposed();
            _transportSubscription?.Dispose();
            try
            {
                if (_windowManager.GetFocusedWindow() is { } focused)
                    await _windowManager.UnfocusAsync(focused);
            }
            finally
            {
                await _cts.CancelAsync();
                _cts.Dispose();
                await _requestManager.DisposeAsync();
            }

            _logger.LogInformation("Disposed.");
            _diagnostics.LogSnapshot();
        }
        finally
        {
            _configurationGate.Release();
        }
    }

    private void ThrowIfDisposed() =>
        ObjectDisposedException.ThrowIf(Volatile.Read(ref _disposed) != 0, this);

    private static void ValidateOptions(NuiOptions options)
    {
        ArgumentNullException.ThrowIfNull(options);

        if (options.MaxPayloadSize <= 0)
            throw new ArgumentOutOfRangeException(nameof(NuiOptions.MaxPayloadSize),
                options.MaxPayloadSize, "Payload size limit must be greater than zero.");

        if (options.DefaultTimeout < TimeSpan.Zero &&
            options.DefaultTimeout != Timeout.InfiniteTimeSpan)
            throw new ArgumentOutOfRangeException(nameof(NuiOptions.DefaultTimeout),
                options.DefaultTimeout, "Timeout must be non-negative or Timeout.InfiniteTimeSpan.");

        if (options.PendingRequestTimeout < TimeSpan.Zero)
            throw new ArgumentOutOfRangeException(nameof(NuiOptions.PendingRequestTimeout),
                options.PendingRequestTimeout, "Pending request timeout cannot be negative.");
    }
}
