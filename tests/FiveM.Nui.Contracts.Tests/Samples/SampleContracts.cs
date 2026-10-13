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
    /// A value that is ignored during serialization.
    /// </summary>
    [JsonIgnore]
    public string? Secret { get; init; }
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
/// A positional record used to exercise TSDoc emission from constructor
/// parameter documentation.
/// </summary>
/// <param name="Name">The name.</param>
/// <param name="Count">The count.</param>
[NuiContract]
public sealed record DocSample(string Name, int Count);
