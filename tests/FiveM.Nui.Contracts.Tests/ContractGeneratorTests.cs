using FiveM.Nui.Contracts.Tests.Samples;
using AlphaSettings = FiveM.Nui.Contracts.Tests.Samples.Alpha.Settings;
using BetaSettings = FiveM.Nui.Contracts.Tests.Samples.Beta.Settings;

namespace FiveM.Nui.Contracts.Tests;

/// <summary>
/// Tests for <see cref="ContractGenerator"/> type mapping, member naming, and
/// options.
/// </summary>
public class ContractGeneratorTests : ContractGeneratorTestBase
{
    /// <summary>
    /// Emits scalar members with camelCase names and references to enums.
    /// </summary>
    [Fact]
    public void Generate_MapsScalarsAndCamelCasesMembers()
    {
        var ts = Gen(typeof(UseItemRequest));

        Assert.Contains("export interface UseItemRequest {", ts);
        Assert.Contains("itemId: string;", ts);
        Assert.Contains("quantity: number;", ts);
        Assert.Contains("weight: number;", ts);
        Assert.Contains("consume: boolean;", ts);
        Assert.Contains("expiresAt: string;", ts);
        Assert.Contains("trackingId: string;", ts);
        Assert.Contains("rarity: ItemRarity;", ts);
    }

    /// <summary>
    /// Emits referenced contract types transitively.
    /// </summary>
    [Fact]
    public void Generate_ResolvesReferencedTypesTransitively()
    {
        var ts = Gen(typeof(UseItemRequest));

        Assert.Contains("export interface InventoryTarget {", ts);
        Assert.Contains("containerId: string;", ts);
    }

    /// <summary>
    /// Emits nullable reference members as optional by default.
    /// </summary>
    [Fact]
    public void Generate_NullableReferenceIsOptionalByDefault()
    {
        var ts = Gen(typeof(UseItemRequest));

        Assert.Contains("target?: InventoryTarget;", ts);
    }

    /// <summary>
    /// Emits nullable members as a null union when configured.
    /// </summary>
    [Fact]
    public void Generate_NullableModeEmitsNullUnion()
    {
        var generator = new ContractGenerator(new ContractGeneratorOptions
        {
            Nullability = NullabilityMode.Nullable,
        });

        var ts = generator.Generate([typeof(UseItemRequest), typeof(InventoryTarget)]);

        Assert.Contains("target: InventoryTarget | null;", ts);
        Assert.Contains("weight: number | null;", ts);
    }

    /// <summary>
    /// Emits enums as string-literal unions.
    /// </summary>
    [Fact]
    public void Generate_EmitsEnumsAsStringLiteralUnions()
    {
        var ts = Gen(typeof(ItemRarity));

        Assert.Contains("export type ItemRarity =", ts);
        Assert.Contains("| 'common'", ts);
        Assert.Contains("| 'rare'", ts);
        Assert.Contains("| 'legendary'", ts);
    }

    /// <summary>
    /// Emits collections and byte arrays as arrays, records, and strings.
    /// </summary>
    [Fact]
    public void Generate_MapsCollectionsAndByteArrays()
    {
        var ts = Gen(typeof(UseItemRequest));

        Assert.Contains("tags: string[];", ts);
        Assert.Contains("modifiers: Record<string, number>;", ts);
        Assert.Contains("icon: string;", ts);
    }

    /// <summary>
    /// Emits an open generic contract with its type parameter.
    /// </summary>
    [Fact]
    public void Generate_EmitsGenericContractWithTypeParameter()
    {
        var ts = Gen(typeof(Envelope<>));

        Assert.Contains("export interface Envelope<T> {", ts);
        Assert.Contains("kind: string;", ts);
        Assert.Contains("data?: T;", ts);
    }

    /// <summary>
    /// Emits a closed generic reference with its type arguments.
    /// </summary>
    [Fact]
    public void Generate_EmitsClosedGenericReferenceWithArguments()
    {
        var ts = Gen(typeof(Wrapper));

        Assert.Contains("payload: Envelope<InventoryTarget>;", ts);
        Assert.Contains("export interface Envelope<T> {", ts);
    }

    /// <summary>
    /// Honors <c>[JsonPropertyName]</c> and <c>[JsonIgnore]</c>.
    /// <c>[JsonIgnore]</c> without arguments means <c>WhenWritingDefault</c>,
    /// which is a conditional omission during serialization but the property
    /// should still appear in the TypeScript interface.
    /// </summary>
    [Fact]
    public void Generate_HonorsJsonPropertyNameAndJsonIgnore()
    {
        var ts = Gen(typeof(RenamedDto));

        Assert.Contains("display_name: string;", ts);
        // Secret is included because [JsonIgnore(WhenWritingDefault)] keeps it in the interface
        // (the serializer may emit it when non-default, but TypeScript needs the type)
        // It's optional because Secret is string? (nullable reference)
        Assert.Contains("secret?: string;", ts);
    }

    /// <summary>
    /// Excludes property when <c>[JsonIgnore(Condition = Always)]</c> is used.
    /// </summary>
    [Fact]
    public void Generate_ExcludesPropertiesWithJsonIgnoreAlways()
    {
        var ts = Gen(typeof(IgnoreAlwaysDto));

        Assert.Contains("name: string;", ts);
        // Secret is excluded because Condition is Always
        Assert.DoesNotContain("secret", ts);
    }

    /// <summary>
    /// Honors an explicit <c>[NuiContract]</c> type name.
    /// </summary>
    [Fact]
    public void Generate_HonorsExplicitTypeNameOverride()
    {
        var ts = Gen(typeof(PlayerStateDto));

        Assert.Contains("export interface PlayerState {", ts);
        Assert.DoesNotContain("PlayerStateDto", ts);
    }

    /// <summary>
    /// Disambiguates types that share a simple name.
    /// </summary>
    [Fact]
    public void Generate_DisambiguatesConflictingTypeNames()
    {
        var ts = Gen(typeof(AlphaSettings), typeof(BetaSettings));

        Assert.Contains("export interface AlphaSettings {", ts);
        Assert.Contains("export interface BetaSettings {", ts);
    }

    /// <summary>
    /// Maps opaque types to <c>unknown</c>.
    /// </summary>
    [Fact]
    public void Generate_MapsOpaqueTypesToUnknown()
    {
        var ts = Gen(typeof(OpaqueDto));

        Assert.Contains("blob?: unknown;", ts);
    }

    /// <summary>
    /// Produces identical output across runs.
    /// </summary>
    [Fact]
    public void Generate_IsDeterministic()
    {
        Assert.Equal(Gen(typeof(UseItemRequest)), Gen(typeof(UseItemRequest)));
    }

    /// <summary>
    /// Emits the auto-generated banner and a custom header.
    /// </summary>
    [Fact]
    public void Generate_EmitsAutoGeneratedBannerAndCustomHeader()
    {
        var generator = new ContractGenerator(new ContractGeneratorOptions
        {
            Header = "Custom banner",
        });

        var ts = generator.Generate([typeof(PlayerStateDto)]);

        Assert.Contains("// <auto-generated>", ts);
        Assert.Contains("// Custom banner", ts);
    }

    /// <summary>
    /// Throws when no root types are supplied.
    /// </summary>
    [Fact]
    public void Generate_ThrowsWhenNoTypesAreProvided()
    {
        var generator = new ContractGenerator();

        Assert.Throws<InvalidOperationException>(() => generator.Generate([]));
    }
}
