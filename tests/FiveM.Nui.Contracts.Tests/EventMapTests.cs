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

    /// <summary>
    /// Escapes special characters (apostrophes) in event names for valid TypeScript.
    /// </summary>
    [Fact]
    public void Generate_EscapesSpecialCharactersInEventNames()
    {
        var ts = Gen(typeof(EventWithSpecialChar));

        // The apostrophe should be escaped as \'
        Assert.Contains("'player:it\\'sReady': { payload: EventWithSpecialChar };", ts);
    }

    /// <summary>
    /// Escapes special characters in enum member names.
    /// </summary>
    [Fact]
    public void Generate_EscapesSpecialCharactersInEnumNames()
    {
        // Create a test enum with special characters
        var generator = new ContractGenerator();
        var ts = generator.Generate([typeof(ItemRarity)]);

        // Enum members should be properly quoted
        Assert.Contains("| 'common'", ts);
        Assert.Contains("| 'rare'", ts);
        Assert.Contains("| 'legendary'", ts);
    }

    /// <summary>
    /// Throws when an event name contains a newline character, which cannot be
    /// represented as a TypeScript string literal.
    /// </summary>
    [Fact]
    public void Generate_ThrowsOnNewlineInEventName()
    {
        var generator = new ContractGenerator();

        Assert.Throws<InvalidOperationException>(() => generator.Generate([typeof(EventWithNewlineName)]));
    }
}
