import { describe, it, expect } from "vitest";
import { parse } from "./index.js";

describe("parse (integration)", () => {
  describe("empty and whitespace", () => {
    it("returns undefined for empty input", () => {
      expect(parse("")).toBeUndefined();
    });

    it("returns undefined for whitespace-only input", () => {
      expect(parse("  \n  \n")).toBeUndefined();
    });

    it("returns undefined for comment-only input", () => {
      expect(parse("# just a comment")).toBeUndefined();
    });
  });

  describe("plain scalars", () => {
    it("parses a string", () => {
      expect(parse("hello")).toBe("hello");
    });

    it("parses a string with spaces", () => {
      expect(parse("hello world")).toBe("hello world");
    });

    it("parses an integer", () => {
      expect(parse("42")).toBe(42);
    });

    it("parses a negative integer", () => {
      expect(parse("-17")).toBe(-17);
    });

    it("parses a float", () => {
      expect(parse("3.14")).toBe(3.14);
    });

    it("parses true", () => {
      expect(parse("true")).toBe(true);
    });

    it("parses false", () => {
      expect(parse("false")).toBe(false);
    });

    it("parses null", () => {
      expect(parse("null")).toBeNull();
    });

    it("parses ~ as null", () => {
      expect(parse("~")).toBeNull();
    });

    it("parses .inf", () => {
      expect(parse(".inf")).toBe(Infinity);
    });

    it("parses -.inf", () => {
      expect(parse("-.inf")).toBe(-Infinity);
    });

    it("parses .nan", () => {
      expect(parse(".nan")).toBeNaN();
    });

    it("parses octal", () => {
      expect(parse("0o17")).toBe(15);
    });

    it("parses hex", () => {
      expect(parse("0xFF")).toBe(255);
    });
  });

  describe("block mappings", () => {
    it("parses a single key-value pair", () => {
      expect(parse("name: Alice")).toEqual({ name: "Alice" });
    });

    it("parses multiple key-value pairs", () => {
      expect(parse("name: Alice\nage: 30")).toEqual({
        name: "Alice",
        age: 30,
      });
    });

    it("parses key with empty value as null", () => {
      expect(parse("key:")).toEqual({ key: null });
    });

    it("parses key with boolean values", () => {
      expect(parse("active: true\ndeleted: false")).toEqual({
        active: true,
        deleted: false,
      });
    });

    it("parses value containing colon", () => {
      expect(parse("url: http://example.com")).toEqual({
        url: "http://example.com",
      });
    });

    it("parses value with inline comment", () => {
      expect(parse("key: value # comment")).toEqual({ key: "value" });
    });

    it("parses key with spaces in value", () => {
      expect(parse("greeting: hello world")).toEqual({
        greeting: "hello world",
      });
    });
  });

  describe("block sequences", () => {
    it("parses a single-item sequence", () => {
      expect(parse("- hello")).toEqual(["hello"]);
    });

    it("parses a multi-item sequence", () => {
      expect(parse("- a\n- b\n- c")).toEqual(["a", "b", "c"]);
    });

    it("parses a sequence of numbers", () => {
      expect(parse("- 1\n- 2\n- 3")).toEqual([1, 2, 3]);
    });

    it("parses a sequence with mixed types", () => {
      expect(parse("- hello\n- 42\n- true\n- null")).toEqual(["hello", 42, true, null]);
    });
  });

  describe("nested structures", () => {
    it("parses nested mapping", () => {
      const input = "person:\n  name: Alice\n  age: 30";
      expect(parse(input)).toEqual({
        person: { name: "Alice", age: 30 },
      });
    });

    it("parses sequence inside mapping", () => {
      const input = "colors:\n  - red\n  - green\n  - blue";
      expect(parse(input)).toEqual({
        colors: ["red", "green", "blue"],
      });
    });

    it("parses mapping inside sequence", () => {
      const input = "- name: Alice\n  age: 30\n- name: Bob\n  age: 25";
      expect(parse(input)).toEqual([
        { name: "Alice", age: 30 },
        { name: "Bob", age: 25 },
      ]);
    });

    it("parses deeply nested structures", () => {
      const input = [
        "database:",
        "  host: localhost",
        "  ports:",
        "    - 5432",
        "    - 5433",
        "  credentials:",
        "    username: admin",
        "    password: secret",
      ].join("\n");
      expect(parse(input)).toEqual({
        database: {
          host: "localhost",
          ports: [5432, 5433],
          credentials: {
            username: "admin",
            password: "secret",
          },
        },
      });
    });

    it("parses sibling mappings after nested content", () => {
      expect(parse("a:\n  b: 1\nc: 2")).toEqual({
        a: { b: 1 },
        c: 2,
      });
    });

    it("parses multiple dedent levels at once", () => {
      expect(parse("a:\n  b:\n    c: 1\nd: 2")).toEqual({
        a: { b: { c: 1 } },
        d: 2,
      });
    });

    it("parses nested sequences", () => {
      const input = "- - a\n  - b\n- - c\n  - d";
      expect(parse(input)).toEqual([
        ["a", "b"],
        ["c", "d"],
      ]);
    });
  });

  describe("quoted strings", () => {
    it("parses single-quoted scalar", () => {
      expect(parse("'hello'")).toBe("hello");
    });

    it("preserves type in single-quoted", () => {
      expect(parse("'true'")).toBe("true");
    });

    it("preserves number in single-quoted", () => {
      expect(parse("'42'")).toBe("42");
    });

    it("handles escaped single quote", () => {
      expect(parse("'it''s'")).toBe("it's");
    });

    it("parses single-quoted key", () => {
      expect(parse("'key': value")).toEqual({ key: "value" });
    });

    it("parses single-quoted value", () => {
      expect(parse("key: 'value'")).toEqual({ key: "value" });
    });

    it("parses single-quoted key with colon", () => {
      expect(parse("'key: with colon': value")).toEqual({
        "key: with colon": "value",
      });
    });

    it("parses empty single-quoted string", () => {
      expect(parse("''")).toBe("");
    });

    it("parses double-quoted scalar", () => {
      expect(parse('"hello"')).toBe("hello");
    });

    it("preserves type in double-quoted", () => {
      expect(parse('"true"')).toBe("true");
    });

    it("handles newline escape", () => {
      expect(parse('"hello\\nworld"')).toBe("hello\nworld");
    });

    it("handles tab escape", () => {
      expect(parse('"hello\\tworld"')).toBe("hello\tworld");
    });

    it("handles backslash escape", () => {
      expect(parse('"path\\\\to"')).toBe("path\\to");
    });

    it("handles quote escape", () => {
      expect(parse('"say \\"hi\\""')).toBe('say "hi"');
    });

    it("handles null byte escape", () => {
      expect(parse('"null\\0byte"')).toBe("null\0byte");
    });

    it("handles unicode escape", () => {
      expect(parse('"\\u0041"')).toBe("A");
    });

    it("parses double-quoted key", () => {
      expect(parse('"key": value')).toEqual({ key: "value" });
    });

    it("parses double-quoted value", () => {
      expect(parse('key: "value"')).toEqual({ key: "value" });
    });

    it("parses empty double-quoted string", () => {
      expect(parse('""')).toBe("");
    });

    it("preserves null in single-quoted", () => {
      expect(parse("'null'")).toBe("null");
    });
  });

  describe("flow collections", () => {
    it("parses empty flow sequence", () => {
      expect(parse("[]")).toEqual([]);
    });

    it("parses flow sequence with items", () => {
      expect(parse("[a, b, c]")).toEqual(["a", "b", "c"]);
    });

    it("parses flow sequence with numbers", () => {
      expect(parse("[1, 2, 3]")).toEqual([1, 2, 3]);
    });

    it("parses flow sequence with mixed types", () => {
      expect(parse("[hello, 42, true, null]")).toEqual(["hello", 42, true, null]);
    });

    it("parses nested flow sequences", () => {
      expect(parse("[[1, 2], [3, 4]]")).toEqual([
        [1, 2],
        [3, 4],
      ]);
    });

    it("parses flow sequence as mapping value", () => {
      expect(parse("items: [a, b, c]")).toEqual({
        items: ["a", "b", "c"],
      });
    });

    it("parses flow sequence in block sequence", () => {
      expect(parse("- [1, 2]\n- [3, 4]")).toEqual([
        [1, 2],
        [3, 4],
      ]);
    });

    it("handles trailing comma", () => {
      expect(parse("[a, b,]")).toEqual(["a", "b"]);
    });

    it("handles spaces around brackets", () => {
      expect(parse("[ a , b , c ]")).toEqual(["a", "b", "c"]);
    });

    it("parses empty flow mapping", () => {
      expect(parse("{}")).toEqual({});
    });

    it("parses flow mapping with entries", () => {
      expect(parse("{a: 1, b: 2, c: 3}")).toEqual({ a: 1, b: 2, c: 3 });
    });

    it("parses nested flow mappings", () => {
      expect(parse("{a: {b: 1}}")).toEqual({ a: { b: 1 } });
    });

    it("parses flow mapping as mapping value", () => {
      expect(parse("person: {name: Alice, age: 30}")).toEqual({
        person: { name: "Alice", age: 30 },
      });
    });

    it("parses mixed flow collections", () => {
      expect(parse("{items: [1, 2], name: test}")).toEqual({
        items: [1, 2],
        name: "test",
      });
    });

    it("handles trailing comma in mapping", () => {
      expect(parse("{a: 1, b: 2,}")).toEqual({ a: 1, b: 2 });
    });

    it("handles spaces around braces", () => {
      expect(parse("{ a: 1 , b: 2 }")).toEqual({ a: 1, b: 2 });
    });

    it("parses flow sequence with one item", () => {
      expect(parse("[a]")).toEqual(["a"]);
    });

    it("parses flow mapping with one entry", () => {
      expect(parse("{a: 1}")).toEqual({ a: 1 });
    });
  });

  describe("block scalars", () => {
    it("literal block preserves newlines", () => {
      const input = "text: |\n  line1\n  line2\n  line3";
      expect(parse(input)).toEqual({ text: "line1\nline2\nline3\n" });
    });

    it("literal block with different indentation", () => {
      const input = "text: |\n    line1\n    line2";
      expect(parse(input)).toEqual({ text: "line1\nline2\n" });
    });

    it("literal block strip chomping", () => {
      const input = "text: |-\n  line1\n  line2";
      expect(parse(input)).toEqual({ text: "line1\nline2" });
    });

    it("literal block keep chomping", () => {
      const input = "text: |+\n  line1\n  line2\n\n";
      expect(parse(input)).toEqual({ text: "line1\nline2\n\n" });
    });

    it("literal block as root", () => {
      const input = "|\n  line1\n  line2";
      expect(parse(input)).toBe("line1\nline2\n");
    });

    it("literal block preserves extra indentation", () => {
      const input = "text: |\n  line1\n    indented\n  line3";
      expect(parse(input)).toEqual({
        text: "line1\n  indented\nline3\n",
      });
    });

    it("folded block folds newlines", () => {
      const input = "text: >\n  line1\n  line2\n  line3";
      expect(parse(input)).toEqual({ text: "line1 line2 line3\n" });
    });

    it("folded block strip chomping", () => {
      const input = "text: >-\n  line1\n  line2";
      expect(parse(input)).toEqual({ text: "line1 line2" });
    });

    it("folded block keep chomping", () => {
      const input = "text: >+\n  line1\n  line2\n\n";
      expect(parse(input)).toEqual({ text: "line1 line2\n\n" });
    });

    it("folded block preserves blank lines", () => {
      const input = "text: >\n  para1\n\n  para2";
      expect(parse(input)).toEqual({ text: "para1\npara2\n" });
    });

    it("folded block preserves more-indented lines", () => {
      const input = "text: >\n  line1\n    indented\n  line3";
      expect(parse(input)).toEqual({
        text: "line1\n  indented\nline3\n",
      });
    });
  });

  describe("document markers", () => {
    it("handles document start", () => {
      expect(parse("---\na: 1")).toEqual({ a: 1 });
    });

    it("handles document start with no content", () => {
      expect(parse("---")).toBeUndefined();
    });

    it("handles document end", () => {
      expect(parse("a: 1\n...")).toEqual({ a: 1 });
    });

    it("handles both start and end", () => {
      expect(parse("---\na: 1\n...")).toEqual({ a: 1 });
    });

    it("handles document start with comment", () => {
      expect(parse("---\n# comment\na: 1")).toEqual({ a: 1 });
    });
  });

  describe("edge cases", () => {
    it("handles blank lines between entries", () => {
      expect(parse("a: 1\n\nb: 2")).toEqual({ a: 1, b: 2 });
    });

    it("handles whitespace-only lines between entries", () => {
      expect(parse("a: 1\n   \nb: 2")).toEqual({ a: 1, b: 2 });
    });

    it("handles trailing newlines", () => {
      expect(parse("a: 1\n\n\n")).toEqual({ a: 1 });
    });

    it("handles trailing whitespace in values", () => {
      expect(parse("key: value   ")).toEqual({ key: "value" });
    });

    it("block scalar followed by sibling mapping", () => {
      const input = "a: |\n  line1\n  line2\nb: 2";
      expect(parse(input)).toEqual({ a: "line1\nline2\n", b: 2 });
    });

    it("sequence with block value on next line", () => {
      expect(parse("-\n  a: 1")).toEqual([{ a: 1 }]);
    });

    it("sequence with inline flow mapping", () => {
      expect(parse("- {a: 1}")).toEqual([{ a: 1 }]);
    });

    it("sequence with inline quoted scalar", () => {
      expect(parse("- 'hello'")).toEqual(["hello"]);
    });

    it("flow sequence with quoted strings", () => {
      expect(parse('["a", "b"]')).toEqual(["a", "b"]);
    });

    it("flow mapping with quoted key", () => {
      expect(parse('{"key": 1}')).toEqual({ key: 1 });
    });
  });
});
