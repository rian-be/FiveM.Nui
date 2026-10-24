namespace FiveM.Nui.Contracts.Tests;

public sealed class ReadmeExamplesTests
{
    [Fact]
    public void SpawnVehicleTypeScriptExample_UsesSerializedCamelCaseNames()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "README.md")))
            directory = directory.Parent;

        var readme = File.ReadAllText(Path.Combine(directory!.FullName, "README.md"));
        Assert.Contains("vehicleModel: 'banshee'", readme);
        Assert.Contains("plate: 'OUTLAW'", readme);
        Assert.Contains("result.netId", readme);
        Assert.DoesNotContain("result.NetId", readme);
    }
}
