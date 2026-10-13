using FiveM.Nui.Abstractions.Contracts;

namespace FiveM.Nui.Contracts.Tests.Samples;

/// <summary>
/// A command that requests an item use.
/// </summary>
[NuiEvent("inventory:use")]
public sealed record UseItemCommand : INuiRequest<UseItemResponse>
{
    /// <summary>
    /// The identifier of the item to use.
    /// </summary>
    public required string ItemId { get; init; }
}

/// <summary>
/// The response to an item use command.
/// </summary>
public sealed record UseItemResponse
{
    /// <summary>
    /// A value indicating whether the command succeeded.
    /// </summary>
    public bool Ok { get; init; }
}

/// <summary>
/// Notifies that a player's health changed.
/// </summary>
[NuiEvent("player:healthChanged")]
public sealed record HealthChanged
{
    /// <summary>
    /// The new health value.
    /// </summary>
    public int Health { get; init; }
}

/// <summary>
/// A command that requests saving the settings.
/// </summary>
[NuiEvent("settings:save", Response = typeof(SaveSettingsResponse))]
public sealed record SaveSettingsRequest
{
    /// <summary>
    /// The theme to save.
    /// </summary>
    public required string Theme { get; init; }
}

/// <summary>
/// The response to a save settings command.
/// </summary>
public sealed record SaveSettingsResponse
{
    /// <summary>
    /// A value indicating whether the settings were saved.
    /// </summary>
    public bool Saved { get; init; }
}

/// <summary>
/// A duplicate of the item use event, used to exercise duplicate warnings.
/// </summary>
[NuiEvent("inventory:use")]
public sealed record DuplicateUseItemEvent
{
    /// <summary>
    /// The number of items.
    /// </summary>
    public int Amount { get; init; }
}

/// <summary>
/// Notifies that a player statistic changed or reset.
/// </summary>
[NuiEvent("player:statChanged")]
[NuiEvent("player:statReset")]
public sealed record StatChanged
{
    /// <summary>
    /// The current statistic value.
    /// </summary>
    public int Value { get; init; }
}

/// <summary>
/// An event with a special character in the name (apostrophe).
/// Used to test string literal escaping in TypeScript output.
/// </summary>
[NuiEvent("player:it'sReady")]
public sealed record EventWithSpecialChar
{
    /// <summary>
    /// A value for the event.
    /// </summary>
    public string Message { get; init; } = string.Empty;
}
