using FiveM.Nui.Contracts.Tests.Samples;

namespace FiveM.Nui.Contracts.Tests;

/// <summary>
/// Tests for TSDoc emission and <see cref="XmlDocComments"/> parsing.
/// </summary>
public class DocumentationTests : ContractGeneratorTestBase
{
    /// <summary>
    /// Emits no TSDoc when no documentation is supplied.
    /// </summary>
    [Fact]
    public void Generate_EmitsNoCommentsWithoutDocs()
    {
        var ts = Gen(typeof(UseItemRequest));

        Assert.DoesNotContain("/**", ts);
    }

    /// <summary>
    /// Emits type and member TSDoc from documentation.
    /// </summary>
    [Fact]
    public void Generate_EmitsTypeAndMemberTdocFromDocs()
    {
        var docs = XmlDocComments.Parse(
            """
            <doc>
              <members>
                <member name="T:FiveM.Nui.Contracts.Tests.Samples.UseItemRequest">
                  <summary>An item use request.</summary>
                </member>
                <member name="P:FiveM.Nui.Contracts.Tests.Samples.UseItemRequest.ItemId">
                  <summary>The <see cref="T:System.String"/> id to use.</summary>
                </member>
              </members>
            </doc>
            """);

        var generator = new ContractGenerator(new ContractGeneratorOptions { Docs = docs });

        var ts = generator.Generate([typeof(UseItemRequest)]);

        Assert.Contains("/** An item use request. */", ts);
        Assert.Contains("  /** The String id to use. */", ts);
    }

    /// <summary>
    /// Emits member TSDoc from a record's constructor parameter docs.
    /// </summary>
    [Fact]
    public void Generate_EmitsRecordPropertyTdocFromConstructorParams()
    {
        var docs = XmlDocComments.Parse(
            """
            <doc>
              <members>
                <member name="T:FiveM.Nui.Contracts.Tests.Samples.DocSample">
                  <summary>Doc sample.</summary>
                </member>
                <member name="M:FiveM.Nui.Contracts.Tests.Samples.DocSample.#ctor(System.String,System.Int32)">
                  <param name="Name">The name.</param>
                  <param name="Count">The count.</param>
                </member>
              </members>
            </doc>
            """);

        var generator = new ContractGenerator(new ContractGeneratorOptions { Docs = docs });

        var ts = generator.Generate([typeof(DocSample)]);

        Assert.Contains("/** Doc sample. */", ts);
        Assert.Contains("  /** The name. */", ts);
        Assert.Contains("  /** The count. */", ts);
    }

    /// <summary>
    /// Emits TSDoc for enum types and their members.
    /// </summary>
    [Fact]
    public void Generate_EmitsEnumMemberTdocFromDocs()
    {
        var docs = XmlDocComments.Parse(
            """
            <doc>
              <members>
                <member name="T:FiveM.Nui.Contracts.Tests.Samples.ItemRarity">
                  <summary>How rare an item is.</summary>
                </member>
                <member name="F:FiveM.Nui.Contracts.Tests.Samples.ItemRarity.Common">
                  <summary>The common tier.</summary>
                </member>
              </members>
            </doc>
            """);

        var generator = new ContractGenerator(new ContractGeneratorOptions { Docs = docs });

        var ts = generator.Generate([typeof(ItemRarity)]);

        Assert.Contains("/** How rare an item is. */", ts);
        Assert.Contains("  /** The common tier. */", ts);
        Assert.Contains("  | 'common'", ts);
    }

    /// <summary>
    /// Flattens inline tags and collapses whitespace.
    /// </summary>
    [Fact]
    public void XmlDocComments_FlattensInlineTagsAndWhitespace()
    {
        var docs = XmlDocComments.Parse(
            """
            <doc>
              <members>
                <member name="T:FiveM.Nui.Contracts.Tests.Samples.DocSample">
                  <summary>
                    Uses <c>Name</c> and <see cref="P:FiveM.Nui.Contracts.Tests.Samples.DocSample.Count"/>.
                  </summary>
                </member>
              </members>
            </doc>
            """);

        Assert.Equal("Uses `Name` and Count.", docs.ForType(typeof(DocSample)));
    }

    /// <summary>
    /// Ignores members that have no summary.
    /// </summary>
    [Fact]
    public void XmlDocComments_IgnoresMembersWithoutSummary()
    {
        var docs = XmlDocComments.Parse(
            """
            <doc>
              <members>
                <member name="T:FiveM.Nui.Contracts.Tests.Samples.DocSample" />
              </members>
            </doc>
            """);

        Assert.True(docs.IsEmpty);
        Assert.Null(docs.ForType(typeof(DocSample)));
    }
}
