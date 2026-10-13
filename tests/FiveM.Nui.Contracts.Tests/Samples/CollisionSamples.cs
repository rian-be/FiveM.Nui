namespace FiveM.Nui.Contracts.Tests.Samples.Alpha
{
    /// <summary>
    /// An alpha settings contract used to exercise name collisions.
    /// </summary>
    [NuiContract]
    public sealed record Settings
    {
        /// <summary>
        /// The alpha value.
        /// </summary>
        public int Alpha { get; init; }
    }
}

namespace FiveM.Nui.Contracts.Tests.Samples.Beta
{
    /// <summary>
    /// A beta settings contract used to exercise name collisions.
    /// </summary>
    [NuiContract]
    public sealed record Settings
    {
        /// <summary>
        /// The beta value.
        /// </summary>
        public int Beta { get; init; }
    }
}
