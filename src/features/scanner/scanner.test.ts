import { describe, it, expect } from "vitest";
import { scan } from "./index.js";
import { TokenType } from "../../entities/token/index.js";

function tokenTypes(source: string) {
  return scan(source).map((t) => t.type);
}

function scalarValues(source: string) {
  return scan(source)
    .filter((t) => t.type === TokenType.Scalar)
    .map((t) => t.value);
}

describe("Scanner", () => {
  describe("empty input", () => {
    it("produces only EOF for empty string", () => {
      expect(tokenTypes("")).toEqual([TokenType.EOF]);
    });

    it("produces only EOF for whitespace-only input", () => {
      expect(tokenTypes("   \n  \n")).toEqual([TokenType.EOF]);
    });

    it("produces only EOF for comment-only input", () => {
      expect(tokenTypes("# comment\n# another")).toEqual([TokenType.EOF]);
    });
  });

  describe("plain scalars", () => {
    it("scans a single word", () => {
      const tokens = scan("hello");
      expect(tokens[0]).toMatchObject({
        type: TokenType.Scalar,
        value: "hello",
        indent: 0,
        line: 1,
      });
      expect(tokens[1]).toMatchObject({ type: TokenType.EOF });
    });

    it("scans a scalar with spaces", () => {
      expect(scalarValues("hello world")).toEqual(["hello world"]);
    });

    it("scans a numeric string", () => {
      expect(scalarValues("42")).toEqual(["42"]);
    });

    it("ignores trailing newline", () => {
      expect(scalarValues("hello\n")).toEqual(["hello"]);
    });

    it("trims trailing whitespace from scalar", () => {
      expect(scalarValues("hello   ")).toEqual(["hello"]);
    });
  });

  describe("comments", () => {
    it("skips full-line comments", () => {
      expect(scalarValues("# comment\nhello")).toEqual(["hello"]);
    });

    it("strips inline comments from scalars", () => {
      expect(scalarValues("hello # comment")).toEqual(["hello"]);
    });

    it("does not treat # without preceding space as comment", () => {
      expect(scalarValues("color:#fff")).toEqual(["color:#fff"]);
    });
  });

  describe("block mappings", () => {
    it("scans a single key-value pair", () => {
      const types = tokenTypes("key: value");
      expect(types).toEqual([
        TokenType.Scalar,
        TokenType.MappingValue,
        TokenType.Scalar,
        TokenType.EOF,
      ]);
    });

    it("scans key and value text correctly", () => {
      const tokens = scan("name: Alice");
      expect(tokens[0]).toMatchObject({
        type: TokenType.Scalar,
        value: "name",
        indent: 0,
      });
      expect(tokens[1]).toMatchObject({ type: TokenType.MappingValue });
      expect(tokens[2]).toMatchObject({
        type: TokenType.Scalar,
        value: "Alice",
      });
    });

    it("scans multiple key-value pairs", () => {
      expect(scalarValues("a: 1\nb: 2")).toEqual(["a", "1", "b", "2"]);
    });

    it("scans key with empty value", () => {
      const types = tokenTypes("key:");
      expect(types).toEqual([TokenType.Scalar, TokenType.MappingValue, TokenType.EOF]);
    });

    it("scans key with value containing colon", () => {
      expect(scalarValues("url: http://example.com")).toEqual(["url", "http://example.com"]);
    });

    it("handles colon without space as part of scalar", () => {
      expect(scalarValues("key:value")).toEqual(["key:value"]);
    });

    it("scans indented mapping entries", () => {
      const tokens = scan("  name: Alice");
      expect(tokens[0]).toMatchObject({ indent: 2 });
    });

    it("scans inline comment after value", () => {
      expect(scalarValues("key: value # comment")).toEqual(["key", "value"]);
    });
  });

  describe("block sequences", () => {
    it("scans a single sequence entry", () => {
      const types = tokenTypes("- hello");
      expect(types).toEqual([TokenType.SequenceEntry, TokenType.Scalar, TokenType.EOF]);
    });

    it("scans a sequence entry indent correctly", () => {
      const tokens = scan("- hello");
      expect(tokens[0]).toMatchObject({
        type: TokenType.SequenceEntry,
        indent: 0,
        line: 1,
      });
      expect(tokens[1]).toMatchObject({
        type: TokenType.Scalar,
        value: "hello",
        indent: 2,
      });
    });

    it("scans multiple sequence entries", () => {
      const types = tokenTypes("- a\n- b\n- c");
      expect(types).toEqual([
        TokenType.SequenceEntry,
        TokenType.Scalar,
        TokenType.SequenceEntry,
        TokenType.Scalar,
        TokenType.SequenceEntry,
        TokenType.Scalar,
        TokenType.EOF,
      ]);
    });

    it("scans sequence entry with mapping", () => {
      const types = tokenTypes("- name: Alice");
      expect(types).toEqual([
        TokenType.SequenceEntry,
        TokenType.Scalar,
        TokenType.MappingValue,
        TokenType.Scalar,
        TokenType.EOF,
      ]);
    });

    it("scans nested sequence entries on same line", () => {
      const types = tokenTypes("- - a");
      expect(types).toEqual([
        TokenType.SequenceEntry,
        TokenType.SequenceEntry,
        TokenType.Scalar,
        TokenType.EOF,
      ]);
    });

    it("scans dash without space as scalar", () => {
      expect(scalarValues("-notsequence")).toEqual(["-notsequence"]);
    });

    it("scans empty sequence entry", () => {
      const types = tokenTypes("-");
      expect(types).toEqual([TokenType.SequenceEntry, TokenType.EOF]);
    });
  });

  describe("nested structures", () => {
    it("scans nested mapping with correct indents", () => {
      const tokens = scan("person:\n  name: Alice\n  age: 30");
      const scalars = tokens.filter((t) => t.type === TokenType.Scalar);
      expect(scalars.map((t) => [t.value, t.indent])).toEqual([
        ["person", 0],
        ["name", 2],
        ["Alice", 8],
        ["age", 2],
        ["30", 7],
      ]);
    });

    it("scans sequence inside mapping", () => {
      const types = tokenTypes("items:\n  - a\n  - b");
      expect(types).toEqual([
        TokenType.Scalar,
        TokenType.MappingValue,
        TokenType.SequenceEntry,
        TokenType.Scalar,
        TokenType.SequenceEntry,
        TokenType.Scalar,
        TokenType.EOF,
      ]);
    });
  });

  describe("blank lines", () => {
    it("skips blank lines between entries", () => {
      expect(scalarValues("a: 1\n\nb: 2")).toEqual(["a", "1", "b", "2"]);
    });

    it("skips whitespace-only lines", () => {
      expect(scalarValues("a: 1\n   \nb: 2")).toEqual(["a", "1", "b", "2"]);
    });
  });

  describe("quoted scalars", () => {
    it("scans single-quoted scalar", () => {
      const tokens = scan("'hello'");
      expect(tokens[0]).toMatchObject({
        type: TokenType.QuotedScalar,
        value: "hello",
      });
    });

    it("scans double-quoted scalar", () => {
      const tokens = scan('"hello"');
      expect(tokens[0]).toMatchObject({
        type: TokenType.QuotedScalar,
        value: "hello",
      });
    });

    it("scans quoted key with value", () => {
      const types = tokenTypes("'key': value");
      expect(types).toEqual([
        TokenType.QuotedScalar,
        TokenType.MappingValue,
        TokenType.Scalar,
        TokenType.EOF,
      ]);
    });

    it("scans key with quoted value", () => {
      const types = tokenTypes("key: 'value'");
      expect(types).toEqual([
        TokenType.Scalar,
        TokenType.MappingValue,
        TokenType.QuotedScalar,
        TokenType.EOF,
      ]);
    });
  });

  describe("document markers", () => {
    it("scans document start", () => {
      const types = tokenTypes("---\na: 1");
      expect(types[0]).toBe(TokenType.DocumentStart);
    });

    it("scans document end", () => {
      const types = tokenTypes("a: 1\n...");
      expect(types).toContain(TokenType.DocumentEnd);
    });

    it("does not treat --- in middle as document marker", () => {
      const values = scalarValues("key: ---value");
      expect(values).toContain("---value");
    });
  });

  describe("flow collections", () => {
    it("scans empty flow sequence", () => {
      const types = tokenTypes("[]");
      expect(types).toEqual([
        TokenType.FlowSequenceStart,
        TokenType.FlowSequenceEnd,
        TokenType.EOF,
      ]);
    });

    it("scans flow sequence with items", () => {
      const types = tokenTypes("[a, b, c]");
      expect(types).toEqual([
        TokenType.FlowSequenceStart,
        TokenType.Scalar,
        TokenType.FlowEntry,
        TokenType.Scalar,
        TokenType.FlowEntry,
        TokenType.Scalar,
        TokenType.FlowSequenceEnd,
        TokenType.EOF,
      ]);
    });

    it("scans empty flow mapping", () => {
      const types = tokenTypes("{}");
      expect(types).toEqual([TokenType.FlowMappingStart, TokenType.FlowMappingEnd, TokenType.EOF]);
    });

    it("scans flow mapping with entries", () => {
      const types = tokenTypes("{a: 1, b: 2}");
      expect(types).toEqual([
        TokenType.FlowMappingStart,
        TokenType.Scalar,
        TokenType.MappingValue,
        TokenType.Scalar,
        TokenType.FlowEntry,
        TokenType.Scalar,
        TokenType.MappingValue,
        TokenType.Scalar,
        TokenType.FlowMappingEnd,
        TokenType.EOF,
      ]);
    });

    it("scans quoted scalar inside flow sequence", () => {
      const tokens = scan('["a", "b"]');
      expect(tokens[1]).toMatchObject({
        type: TokenType.QuotedScalar,
        value: "a",
      });
    });

    it("scans quoted key inside flow mapping", () => {
      const tokens = scan('{"key": 1}');
      expect(tokens[1]).toMatchObject({
        type: TokenType.QuotedScalar,
        value: "key",
      });
      expect(tokens[2]).toMatchObject({ type: TokenType.MappingValue });
    });

    it("handles inline comment in flow plain value", () => {
      const tokens = scan("[a #comment]");
      const scalars = tokens.filter((t) => t.type === TokenType.Scalar);
      expect(scalars[0].value).toBe("a");
    });
  });

  describe("double-quoted escape sequences", () => {
    it("handles \\r escape", () => {
      const tokens = scan('"a\\rb"');
      expect(tokens[0].value).toBe("a\rb");
    });

    it("handles \\' escape", () => {
      const tokens = scan(`"a\\'b"`);
      expect(tokens[0].value).toBe("a'b");
    });

    it("handles \\a escape (bell)", () => {
      const tokens = scan('"\\a"');
      expect(tokens[0].value).toBe("\x07");
    });

    it("handles \\b escape (backspace)", () => {
      const tokens = scan('"\\b"');
      expect(tokens[0].value).toBe("\b");
    });

    it("handles \\e escape", () => {
      const tokens = scan('"\\e"');
      expect(tokens[0].value).toBe("\x1b");
    });

    it("handles \\v escape", () => {
      const tokens = scan('"\\v"');
      expect(tokens[0].value).toBe("\v");
    });

    it("handles \\f escape", () => {
      const tokens = scan('"\\f"');
      expect(tokens[0].value).toBe("\f");
    });

    it("handles \\\\ (space) escape", () => {
      const tokens = scan('"\\ "');
      expect(tokens[0].value).toBe(" ");
    });

    it("handles \\/ escape", () => {
      const tokens = scan('"\\/"');
      expect(tokens[0].value).toBe("/");
    });

    it("handles unknown escape as literal", () => {
      const tokens = scan('"\\z"');
      expect(tokens[0].value).toBe("z");
    });

    it("handles \\x hex escape", () => {
      const tokens = scan('"\\x41"');
      expect(tokens[0].value).toBe("A");
    });

    it("handles \\U 8-digit hex escape", () => {
      const tokens = scan('"\\U00000041"');
      expect(tokens[0].value).toBe("A");
    });
  });

  describe("block scalars", () => {
    it("scans block scalar followed by next entry (rewind)", () => {
      const tokens = scan("a: |\n  line1\nb: 2");
      const scalars = tokens.filter(
        (t) => t.type === TokenType.Scalar || t.type === TokenType.QuotedScalar,
      );
      expect(scalars.map((t) => t.value)).toEqual(["a", "line1\n", "b", "2"]);
    });

    it("scans block scalar with explicit indent indicator", () => {
      const tokens = scan("a: |2\n  line1");
      const qs = tokens.find((t) => t.type === TokenType.QuotedScalar);
      expect(qs?.value).toBe("line1\n");
    });

    it("scans block scalar at EOF with trailing spaces", () => {
      const tokens = scan("a: |\n  line1\n   ");
      const qs = tokens.find((t) => t.type === TokenType.QuotedScalar);
      expect(qs).toBeDefined();
    });
  });

  describe("edge cases", () => {
    it("handles unterminated single-quoted string", () => {
      const tokens = scan("'unterminated");
      expect(tokens[0]).toMatchObject({
        type: TokenType.QuotedScalar,
        value: "unterminated",
      });
    });

    it("handles unterminated double-quoted string", () => {
      const tokens = scan('"unterminated');
      expect(tokens[0]).toMatchObject({
        type: TokenType.QuotedScalar,
        value: "unterminated",
      });
    });

    it("handles backslash at end of unterminated double-quoted", () => {
      const tokens = scan('"test\\');
      expect(tokens[0]).toMatchObject({
        type: TokenType.QuotedScalar,
        value: "test",
      });
    });

    it("handles hex escape truncated by EOF", () => {
      const tokens = scan('"\\u41"');
      expect(tokens[0]).toMatchObject({ type: TokenType.QuotedScalar });
    });

    it("handles sequence entry followed by comment", () => {
      const types = tokenTypes("- # comment");
      expect(types).toEqual([TokenType.SequenceEntry, TokenType.EOF]);
    });

    it("handles block scalar indicator at EOF", () => {
      const tokens = scan("|");
      expect(tokens[0]).toMatchObject({ type: TokenType.QuotedScalar });
    });

    it("scans content after empty line in scanContent", () => {
      const types = tokenTypes("-\n  value");
      expect(types).toContain(TokenType.SequenceEntry);
      expect(types).toContain(TokenType.Scalar);
    });

    it("scanContent returns for # after sequence entry", () => {
      // "- " followed by "# comment" on same line after indent calc
      const types = tokenTypes("- # just a comment\nvalue");
      expect(types[0]).toBe(TokenType.SequenceEntry);
    });

    it("scanKeyOrValue returns on empty line", () => {
      // Tests line 110: scanKeyOrValue when isAtEnd() or \n
      const types = tokenTypes("\n\nhello");
      expect(types).toContain(TokenType.Scalar);
    });

    it("readPlainKey returns empty for bare colon", () => {
      // ': value' with nothing before colon — scanner skips it
      const tokens = scan("  : value");
      expect(tokens[0]).toMatchObject({ type: TokenType.EOF });
    });

    it("handles unterminated flow collection (EOF)", () => {
      // Tests line 348: flow EOF without closing bracket
      const tokens = scan("[a, b");
      expect(tokens[0]).toMatchObject({ type: TokenType.FlowSequenceStart });
      const scalars = tokens.filter((t) => t.type === TokenType.Scalar);
      expect(scalars.length).toBe(2);
    });

    it("handles unexpected ] in flow mapping", () => {
      // Tests line 361: unexpected closing bracket
      const tokens = scan("{a: 1]");
      expect(tokens[0]).toMatchObject({ type: TokenType.FlowMappingStart });
    });

    it("block scalar with explicit indent and chomping combo", () => {
      // Tests lines 461-464: explicit indent parsing in block header
      const tokens = scan("a: |2-\n  x");
      const qs = tokens.find((t) => t.type === TokenType.QuotedScalar);
      expect(qs).toBeDefined();
    });

    it("block scalar EOF during indent reading with rewind", () => {
      // Tests lines 487-489: block scalar content ends with partial indent at EOF
      const tokens = scan("a: |\n  line1\n ");
      const qs = tokens.find((t) => t.type === TokenType.QuotedScalar);
      expect(qs).toBeDefined();
    });

    it("folded block scalar with empty content lines", () => {
      // Tests line 555: foldLines with empty input
      const tokens = scan("a: >\n");
      const qs = tokens.find((t) => t.type === TokenType.QuotedScalar);
      expect(qs).toBeDefined();
      expect(qs!.value).toBe("");
    });

    it("flow value colon at end of input", () => {
      // Tests line 629: isFollowedBySpaceOrFlowIndicator when at EOF
      const tokens = scan("{a:");
      expect(tokens).toContainEqual(expect.objectContaining({ type: TokenType.MappingValue }));
    });
  });
});
