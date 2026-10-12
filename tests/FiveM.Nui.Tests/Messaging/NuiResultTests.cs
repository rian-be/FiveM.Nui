namespace FiveM.Nui.Tests.Messaging;

/// <summary>
/// Covers the <c>NuiResult&lt;T&gt;</c> factories and the C# 14 extension members
/// (<c>IsFailure</c>, <c>ValueOrDefault</c>, <c>ValueOrThrow</c> and
/// <c>FromNullable</c>) layered on top of them.
/// </summary>
public class NuiResultTests
{
    [Fact]
    public void Ok_Should_CreateSuccessfulResult()
    {
        var result = NuiResult<string>.Ok("test value");

        Assert.True(result.Success);
        Assert.Equal("test value", result.Value);
        Assert.Null(result.Error);
    }

    [Fact]
    public void Fail_WithError_Should_CreateFailedResult()
    {
        var error = new NuiError("TEST_ERROR", "Test error message");
        var result = NuiResult<string>.Fail(error);

        Assert.False(result.Success);
        Assert.Null(result.Value);
        Assert.Equal(error, result.Error);
    }

    [Fact]
    public void Fail_WithCodeAndMessage_Should_CreateFailedResult()
    {
        var result = NuiResult<string>.Fail("TEST_ERROR", "Test error message");

        Assert.False(result.Success);
        Assert.Null(result.Value);
        Assert.NotNull(result.Error);
        Assert.Equal("TEST_ERROR", result.Error.Code);
        Assert.Equal("Test error message", result.Error.Message);
    }

    [Fact]
    public void ExtensionMembers_Should_ExposeFailureAndValueHelpers()
    {
        var ok = NuiResult<string>.Ok("value");
        var fail = NuiResult<string>.Fail("NOPE", "no");

        // C# 14 extension properties.
        Assert.False(ok.IsFailure);
        Assert.True(fail.IsFailure);
        Assert.Equal("value", ok.ValueOrDefault);
        Assert.Null(fail.ValueOrDefault);
        Assert.Equal("value", ok.ValueOrThrow());
        Assert.Throws<NuiException>(fail.ValueOrThrow);
    }

    [Fact]
    public void StaticExtensionMember_FromNullable_Should_Discriminate()
    {
        // C# 14 static extension member.
        Assert.Equal("value", NuiResult<string>.FromNullable("value").ValueOrDefault);

        var missing = NuiResult<string>.FromNullable(null);
        Assert.True(missing.IsFailure);
        Assert.Equal("NO_VALUE", missing.Error!.Code);
    }
}
