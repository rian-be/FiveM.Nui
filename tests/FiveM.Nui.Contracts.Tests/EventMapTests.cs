using FiveM.Nui.Contracts.Tests.Samples;

namespace FiveM.Nui.Contracts.Tests;

/// <summary>
/// Tests for the <c>NuiEventMap</c> module augmentation emitted for
/// <c>[NuiEvent]</c> types.
/// </summary>
public class EventMapTests : ContractGeneratorTestBase
{
    /// <summary>
    /// Emits a request/response entry for an <c>INuiRequest</c> event.
    /// </summary>
    [Fact]
    public void Generate_EmitsEventMapForRequestResponse()
    {
        var ts = Gen(typeof(UseItemCommand));

        Assert.Contains("declare module '@fivem-nui/core' {", ts);
        Assert.Contains("interface NuiEventMap {", ts);
        Assert.Contains("'inventory:use': { request: UseItemCommand; response: UseItemResponse };", ts);
        Assert.Contains("export interface UseItemResponse {", ts);
    }

    /// <summary>
    /// Emits a payload entry for a fire-and-forget event.
    /// </summary>
    [Fact]
    public void Generate_EmitsPayloadEvent()
    {
        var ts = Gen(typeof(HealthChanged));

        Assert.Contains("'player:healthChanged': { payload: HealthChanged };", ts);
    }

    /// <summary>
    /// Honors an explicitly declared response type.
    /// </summary>
    [Fact]
    public void Generate_HonorsExplicitResponseType()
    {
        var ts = Gen(typeof(SaveSettingsRequest));

        Assert.Contains("'settings:save': { request: SaveSettingsRequest; response: SaveSettingsResponse };", ts);
    }

    /// <summary>
    /// Omits the event map when there are no events.
    /// </summary>
    [Fact]
    public void Generate_OmitsEventMapWhenNoEventsExist()
    {
        var ts = Gen(typeof(UseItemRequest));

        Assert.DoesNotContain("NuiEventMap", ts);
        Assert.DoesNotContain("declare module", ts);
    }

    /// <summary>
    /// Augments the configured core module.
    /// </summary>
    [Fact]
    public void Generate_HonorsCustomCoreModuleName()
    {
        var generator = new ContractGenerator(new ContractGeneratorOptions
        {
            CoreModuleName = "./core",
        });

        var ts = generator.Generate([typeof(HealthChanged)]);

        Assert.Contains("declare module './core' {", ts);
    }

    /// <summary>
    /// Omits the event map when disabled.
    /// </summary>
    [Fact]
    public void Generate_OmitsEventMapWhenDisabled()
    {
        var generator = new ContractGenerator(new ContractGeneratorOptions
        {
            EmitEventMap = false,
        });

        var ts = generator.Generate([typeof(HealthChanged)]);

        Assert.DoesNotContain("NuiEventMap", ts);
        Assert.Contains("export interface HealthChanged {", ts);
    }

    /// <summary>
    /// Warns and keeps the first declaration for a duplicate event name.
    /// </summary>
    [Fact]
    public void Generate_WarnsOnDuplicateEventName()
    {
        var generator = new ContractGenerator();

        var ts = generator.Generate([typeof(UseItemCommand), typeof(DuplicateUseItemEvent)]);

        Assert.Equal(1, generator.EventCount);
        Assert.Contains(generator.Warnings, warning => warning.Contains("inventory:use"));
        Assert.Contains("'inventory:use': { request: UseItemCommand; response: UseItemResponse };", ts);
        Assert.DoesNotContain("payload: DuplicateUseItemEvent", ts);
    }

    /// <summary>
    /// Emits one entry per <c>[NuiEvent]</c> declared on a single type.
    /// </summary>
    [Fact]
    public void Generate_EmitsMultipleEventsForSingleType()
    {
        var generator = new ContractGenerator();

        var ts = generator.Generate([typeof(StatChanged)]);

        Assert.Equal(2, generator.EventCount);
        Assert.Contains("'player:statChanged': { payload: StatChanged };", ts);
        Assert.Contains("'player:statReset': { payload: StatChanged };", ts);
    }

    /// <summary>
    /// Produces an identical event map across runs.
    /// </summary>
    [Fact]
    public void Generate_EventMapIsDeterministic()
    {
        Assert.Equal(
            Gen(typeof(UseItemCommand), typeof(HealthChanged)),
            Gen(typeof(UseItemCommand), typeof(HealthChanged)));
    }
}
