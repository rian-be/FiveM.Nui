using FiveM.Nui.Contracts.Model;

namespace FiveM.Nui.Contracts.Generation;

/// <summary>
/// Assigns a unique TypeScript name to each declaration, disambiguating
/// collisions with a namespace-derived prefix and a numeric suffix.
/// </summary>
internal static class DeclarationNamer
{
    /// <summary>
    /// Mutates <see cref="Declaration.Name"/> on every declaration so the names
    /// are unique and deterministic.
    /// </summary>
    /// <param name="declarations">The declarations to name.</param>
    public static void Assign(IEnumerable<Declaration> declarations)
    {
        var used = new HashSet<string>(StringComparer.Ordinal);

        var groups = declarations
            .GroupBy(declaration => declaration.ProvisionalName, StringComparer.Ordinal)
            .OrderBy(group => group.Key, StringComparer.Ordinal);

        foreach (var group in groups)
        {
            var members = group
                .OrderBy(declaration => declaration.Type.FullName ?? declaration.Type.Name, StringComparer.Ordinal)
                .ToList();

            if (members.Count == 1)
            {
                members[0].Name = Unique(members[0].ProvisionalName, used);
                used.Add(members[0].Name);
                continue;
            }

            foreach (var member in members)
            {
                member.Name = Unique(Qualify(member, used), used);
                used.Add(member.Name);
            }
        }
    }

    private static string Qualify(Declaration declaration, HashSet<string> used)
    {
        var segments = declaration.Type.Namespace?.Split('.') ?? [];
        for (var count = 1; count <= segments.Length; count++)
        {
            var candidate = string.Concat(segments[^count..]) + declaration.ProvisionalName;
            if (!used.Contains(candidate))
            {
                return candidate;
            }
        }

        return declaration.ProvisionalName;
    }

    private static string Unique(string candidate, HashSet<string> used)
    {
        if (!used.Contains(candidate))
        {
            return candidate;
        }

        var suffix = 2;
        while (used.Contains(candidate + suffix))
        {
            suffix++;
        }

        return candidate + suffix;
    }
}
