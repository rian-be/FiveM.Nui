using System.Text.Json.Serialization;

namespace FiveM.Nui.Contracts.Tests.Samples;

/// <summary>
/// A request to use an inventory item.
/// </summary>
[NuiContract]
public sealed record UseItemRequest
{
    /// <summary>
    /// The identifier of the item to use.
    /// </summary>
    public required string ItemId { get; init; }

    /// <summary>
    /// The number of items to use.
    /// </summary>
    public int Quantity { get; init; }

    /// <summary>
    /// The total weight of the used items.
    /// </summary>
    public double Weight { get; init; }

    /// <summary>
    /// A value indicating whether the item is consumed.
    /// </summary>
    public bool Consume { get; init; }

    /// <summary>
    /// The rarity of the item.
    /// </summary>
    public ItemRarity Rarity { get; init; }

    /// <summary>
    /// The inventory target, if any.
    /// </summary>
    public InventoryTarget? Target { get; init; }

    /// <summary>
    /// The tags applied to the item.
    /// </summary>
    public IReadOnlyList<string> Tags { get; init; } = [];

    /// <summary>
    /// The per-tag numeric modifiers.
    /// </summary>
    public Dictionary<string, int> Modifiers { get; init; } = [];

    /// <summary>
    /// The icon of the item.
    /// </summary>
    public byte[] Icon { get; init; } = [];

    /// <summary>
    /// The moment the item expires.
    /// </summary>
    public DateTime ExpiresAt { get; init; }

    /// <summary>
    /// The tracking identifier of the item.
    /// </summary>
    public Guid TrackingId { get; init; }
}

/// <summary>
/// How rare an item is.
/// </summary>
[NuiContract]
public enum ItemRarity
{
    /// <summary>
    /// The common tier.
    /// </summary>
    Common,

    /// <summary>
    /// The rare tier.
    /// </summary>
    Rare,

    /// <summary>
    /// The legendary tier.
    /// </summary>
    Legendary,
}

/// <summary>
/// The inventory a request targets.
/// </summary>
public sealed record InventoryTarget
{
    /// <summary>
    /// The identifier of the container.
    /// </summary>
    public required string ContainerId { get; init; }

    /// <summary>
    /// The weight of the container, if known.
    /// </summary>
    public double? Weight { get; init; }
}

/// <summary>
/// A generic envelope contract.
/// </summary>
/// <typeparam name="T">The type of the payload.</typeparam>
[NuiContract]
public sealed record Envelope<T>
{
    /// <summary>
    /// The kind discriminator of the envelope.
    /// </summary>
    public string Kind { get; init; } = string.Empty;

    /// <summary>
    /// The payload, if any.
    /// </summary>
    public T? Data { get; init; }
}

/// <summary>
/// A wrapper around an envelope payload.
/// </summary>
[NuiContract]
public sealed record Wrapper
{
    /// <summary>
    /// The wrapped envelope payload.
    /// </summary>
    public required Envelope<InventoryTarget> Payload { get; init; }
}

/// <summary>
/// A contract whose members are renamed or ignored during serialization.
/// </summary>
[NuiContract]
public sealed record RenamedDto
{
    /// <summary>
    /// The display name serialized as <c>display_name</c>.
    /// </summary>
    [JsonPropertyName("display_name")]
    public required string DisplayName { get; init; }

    /// <summary>
    /// A value that is conditionally ignored during serialization when writing default.
    /// This property should still appear in the TypeScript interface.
    /// </summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public string? Secret { get; init; }
}

/// <summary>
/// A contract with explicit JsonIgnore.Always to always exclude a property.
/// </summary>
[NuiContract]
public sealed record IgnoreAlwaysDto
{
    /// <summary>
    /// The name that is always serialized.
    /// </summary>
    public required string Name { get; init; }

    /// <summary>
    /// A value that is always ignored.
    /// </summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.Always)]
    public string? Secret { get; init; }
}

/// <summary>
/// A contract with a member that maps to an opaque type.
/// </summary>
[NuiContract]
public sealed record OpaqueDto
{
    /// <summary>
    /// An opaque binary payload.
    /// </summary>
    public object? Blob { get; init; }
}

/// <summary>
/// A contract exercising the conditional <c>[JsonIgnore]</c> modes.
/// The conditional members stay in the contract but may be absent on the wire,
/// so they are emitted as optional; the <c>Never</c> member is always written
/// and therefore stays required.
/// </summary>
[NuiContract]
public sealed record ConditionalIgnoreDto
{
    /// <summary>
    /// A value type omitted when it equals zero.
    /// </summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public int Quantity { get; init; }

    /// <summary>
    /// A nullable value type omitted when it equals zero or null.
    /// </summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public int? OptionalQuantity { get; init; }

    /// <summary>
    /// A nullable reference omitted when it is null.
    /// </summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Description { get; init; }

    /// <summary>
    /// A nullable reference that is always written, even when null.
    /// </summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.Never)]
    public string? Label { get; init; }

    /// <summary>
    /// A nullable reference with no ignore rule.
    /// </summary>
    public string? Unconditional { get; init; }
}

/// <summary>
/// A contract with a member ignored through the no-argument <c>[JsonIgnore]</c>,
/// which defaults to <c>Always</c> and must not appear in the interface.
/// </summary>
[NuiContract]
public sealed record NoArgumentIgnoreDto
{
    /// <summary>
    /// The name that is always serialized.
    /// </summary>
    public required string Name { get; init; }

    /// <summary>
    /// A value excluded because the no-argument attribute defaults to Always.
    /// </summary>
    [JsonIgnore]
    public string InternalId { get; init; } = string.Empty;
}

/// <summary>
/// A contract with an explicit TypeScript name.
/// </summary>
[NuiContract("PlayerState")]
public sealed record PlayerStateDto
{
    /// <summary>
    /// The current health.
    /// </summary>
    public int Health { get; init; }
}

/// <summary>
/// A positional record used to exercise TSDoc emission from constructor
/// parameter documentation.
/// </summary>
/// <param name="Name">The name.</param>
/// <param name="Count">The count.</param>
[NuiContract]
public sealed record DocSample(string Name, int Count);

/// <summary>
/// A contract with property names that require quoting in TypeScript.
/// Used to test escaping of special characters in property names.
/// </summary>
[NuiContract]
public sealed record SpecialPropertyNameDto
{
    /// <summary>
    /// A property with a hyphen in the name.
    /// </summary>
    [JsonPropertyName("display-name")]
    public string DisplayName { get; init; } = string.Empty;

    /// <summary>
    /// A property with an apostrophe in the name.
    /// </summary>
    [JsonPropertyName("user's-id")]
    public string UserId { get; init; } = string.Empty;

    /// <summary>
    /// A property with a space in the name.
    /// </summary>
    [JsonPropertyName("first name")]
    public string FirstName { get; init; } = string.Empty;

    /// <summary>
    /// A property with a leading digit (invalid identifier start).
    /// </summary>
    [JsonPropertyName("1stAttempt")]
    public int FirstAttempt { get; init; }

    /// <summary>
    /// A valid identifier that doesn't need quoting.
    /// </summary>
    public string ValidName { get; init; } = string.Empty;
}

/// <summary>
/// An enum whose serialized member names contain characters that require
/// escaping in the generated TypeScript string literals.
/// </summary>
[NuiContract]
public enum SpecialEnum
{
    /// <summary>
    /// A member whose wire name contains an apostrophe.
    /// </summary>
    [JsonStringEnumMemberName("it's")]
    Apostrophe,

    /// <summary>
    /// A member whose wire name contains a backslash.
    /// </summary>
    [JsonStringEnumMemberName("back\\slash")]
    Backslash,
}

/// <summary>
/// A contract declaring a TypeScript name via <c>[NuiContract("...")]</c>.
/// </summary>
/// <param name="Value">The value.</param>
[NuiContract("Bad Name")]
public sealed record InvalidContractNameDto(string Value);

/// <summary>
/// An enum with a member name containing a newline, which cannot be represented
/// as a TypeScript string literal. Used to test that generation rejects it.
/// </summary>
[NuiContract]
public enum NewlineEnum
{
    /// <summary>
    /// A member whose wire name contains a newline.
    /// </summary>
    [JsonStringEnumMemberName("line\nbreak")]
    Newline,
}
