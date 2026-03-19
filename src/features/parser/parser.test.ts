import { describe, it, expect } from "vitest";
import { Parser } from "./parser.js";
import { TokenType } from "../../entities/token/index.js";
import type { Token } from "../../entities/token/index.js";

function tok(type: TokenType, value: string, indent = 0, line = 1): Token {
  return { type, value, indent, line, column: indent };
}

function eof(line = 1): Token {
  return tok(TokenType.EOF, "", 0, line);
}

describe("Parser", () => {
  describe("empty input", () => {
    it("returns undefined for EOF-only stream", () => {
      expect(new Parser([eof()]).parse()).toBeUndefined();
    });
  });

  describe("scalar resolution", () => {
    it("resolves a plain string", () => {
      const result = new Parser([tok(TokenType.Scalar, "hello"), eof()]).parse();
      expect(result).toBe("hello");
    });

    it("resolves an integer", () => {
      const result = new Parser([tok(TokenType.Scalar, "42"), eof()]).parse();
      expect(result).toBe(42);
    });

    it("resolves a negative integer", () => {
      const result = new Parser([tok(TokenType.Scalar, "-17"), eof()]).parse();
      expect(result).toBe(-17);
    });

    it("resolves a float", () => {
      const result = new Parser([tok(TokenType.Scalar, "3.14"), eof()]).parse();
      expect(result).toBe(3.14);
    });

    it("resolves octal", () => {
      const result = new Parser([tok(TokenType.Scalar, "0o17"), eof()]).parse();
      expect(result).toBe(15);
    });

    it("resolves hex", () => {
      const result = new Parser([tok(TokenType.Scalar, "0xFF"), eof()]).parse();
      expect(result).toBe(255);
    });

    it("resolves true", () => {
      const result = new Parser([tok(TokenType.Scalar, "true"), eof()]).parse();
      expect(result).toBe(true);
    });

    it("resolves True", () => {
      const result = new Parser([tok(TokenType.Scalar, "True"), eof()]).parse();
      expect(result).toBe(true);
    });

    it("resolves false", () => {
      const result = new Parser([tok(TokenType.Scalar, "false"), eof()]).parse();
      expect(result).toBe(false);
    });

    it("resolves null", () => {
      const result = new Parser([tok(TokenType.Scalar, "null"), eof()]).parse();
      expect(result).toBeNull();
    });

    it("resolves ~ as null", () => {
      const result = new Parser([tok(TokenType.Scalar, "~"), eof()]).parse();
      expect(result).toBeNull();
    });

    it("resolves Null", () => {
      const result = new Parser([tok(TokenType.Scalar, "Null"), eof()]).parse();
      expect(result).toBeNull();
    });

    it("resolves .inf", () => {
      const result = new Parser([tok(TokenType.Scalar, ".inf"), eof()]).parse();
      expect(result).toBe(Infinity);
    });

    it("resolves -.inf", () => {
      const result = new Parser([tok(TokenType.Scalar, "-.inf"), eof()]).parse();
      expect(result).toBe(-Infinity);
    });

    it("resolves .nan", () => {
      const result = new Parser([tok(TokenType.Scalar, ".nan"), eof()]).parse();
      expect(result).toBeNaN();
    });

    it("resolves scientific notation", () => {
      const result = new Parser([tok(TokenType.Scalar, "1.5e+3"), eof()]).parse();
      expect(result).toBe(1500);
    });
  });

  describe("quoted scalars", () => {
    it("returns quoted scalar as-is (no type resolution)", () => {
      const result = new Parser([tok(TokenType.QuotedScalar, "true"), eof()]).parse();
      expect(result).toBe("true");
    });

    it("returns quoted number as string", () => {
      const result = new Parser([tok(TokenType.QuotedScalar, "42"), eof()]).parse();
      expect(result).toBe("42");
    });
  });

  describe("block mapping", () => {
    it("parses a single key-value pair", () => {
      const result = new Parser([
        tok(TokenType.Scalar, "name", 0, 1),
        tok(TokenType.MappingValue, ":", 4, 1),
        tok(TokenType.Scalar, "Alice", 6, 1),
        eof(1),
      ]).parse();
      expect(result).toEqual({ name: "Alice" });
    });

    it("parses multiple key-value pairs", () => {
      const result = new Parser([
        tok(TokenType.Scalar, "a", 0, 1),
        tok(TokenType.MappingValue, ":", 1, 1),
        tok(TokenType.Scalar, "1", 3, 1),
        tok(TokenType.Scalar, "b", 0, 2),
        tok(TokenType.MappingValue, ":", 1, 2),
        tok(TokenType.Scalar, "2", 3, 2),
        eof(2),
      ]).parse();
      expect(result).toEqual({ a: 1, b: 2 });
    });

    it("parses key with null value (no value token)", () => {
      const result = new Parser([
        tok(TokenType.Scalar, "key", 0, 1),
        tok(TokenType.MappingValue, ":", 3, 1),
        eof(1),
      ]).parse();
      expect(result).toEqual({ key: null });
    });

    it("parses key with null value (value on next line at same indent)", () => {
      const result = new Parser([
        tok(TokenType.Scalar, "a", 0, 1),
        tok(TokenType.MappingValue, ":", 1, 1),
        tok(TokenType.Scalar, "b", 0, 2),
        tok(TokenType.MappingValue, ":", 1, 2),
        tok(TokenType.Scalar, "2", 3, 2),
        eof(2),
      ]).parse();
      expect(result).toEqual({ a: null, b: 2 });
    });

    it("parses quoted key", () => {
      const result = new Parser([
        tok(TokenType.QuotedScalar, "my key", 0, 1),
        tok(TokenType.MappingValue, ":", 8, 1),
        tok(TokenType.Scalar, "value", 10, 1),
        eof(1),
      ]).parse();
      expect(result).toEqual({ "my key": "value" });
    });
  });

  describe("block sequence", () => {
    it("parses a single-item sequence", () => {
      const result = new Parser([
        tok(TokenType.SequenceEntry, "-", 0, 1),
        tok(TokenType.Scalar, "hello", 2, 1),
        eof(1),
      ]).parse();
      expect(result).toEqual(["hello"]);
    });

    it("parses a multi-item sequence", () => {
      const result = new Parser([
        tok(TokenType.SequenceEntry, "-", 0, 1),
        tok(TokenType.Scalar, "a", 2, 1),
        tok(TokenType.SequenceEntry, "-", 0, 2),
        tok(TokenType.Scalar, "b", 2, 2),
        tok(TokenType.SequenceEntry, "-", 0, 3),
        tok(TokenType.Scalar, "c", 2, 3),
        eof(3),
      ]).parse();
      expect(result).toEqual(["a", "b", "c"]);
    });

    it("parses empty sequence entry as null", () => {
      const result = new Parser([
        tok(TokenType.SequenceEntry, "-", 0, 1),
        tok(TokenType.SequenceEntry, "-", 0, 2),
        tok(TokenType.Scalar, "b", 2, 2),
        eof(2),
      ]).parse();
      expect(result).toEqual([null, "b"]);
    });
  });

  describe("nested structures", () => {
    it("parses nested mapping", () => {
      const result = new Parser([
        tok(TokenType.Scalar, "person", 0, 1),
        tok(TokenType.MappingValue, ":", 6, 1),
        tok(TokenType.Scalar, "name", 2, 2),
        tok(TokenType.MappingValue, ":", 6, 2),
        tok(TokenType.Scalar, "Alice", 8, 2),
        eof(2),
      ]).parse();
      expect(result).toEqual({ person: { name: "Alice" } });
    });

    it("parses sequence inside mapping", () => {
      const result = new Parser([
        tok(TokenType.Scalar, "items", 0, 1),
        tok(TokenType.MappingValue, ":", 5, 1),
        tok(TokenType.SequenceEntry, "-", 2, 2),
        tok(TokenType.Scalar, "a", 4, 2),
        tok(TokenType.SequenceEntry, "-", 2, 3),
        tok(TokenType.Scalar, "b", 4, 3),
        eof(3),
      ]).parse();
      expect(result).toEqual({ items: ["a", "b"] });
    });

    it("parses mapping inside sequence", () => {
      const result = new Parser([
        tok(TokenType.SequenceEntry, "-", 0, 1),
        tok(TokenType.Scalar, "name", 2, 1),
        tok(TokenType.MappingValue, ":", 6, 1),
        tok(TokenType.Scalar, "Alice", 8, 1),
        tok(TokenType.Scalar, "age", 2, 2),
        tok(TokenType.MappingValue, ":", 5, 2),
        tok(TokenType.Scalar, "30", 7, 2),
        eof(2),
      ]).parse();
      expect(result).toEqual([{ name: "Alice", age: 30 }]);
    });

    it("parses sibling mappings after nested content", () => {
      const result = new Parser([
        tok(TokenType.Scalar, "a", 0, 1),
        tok(TokenType.MappingValue, ":", 1, 1),
        tok(TokenType.Scalar, "b", 2, 2),
        tok(TokenType.MappingValue, ":", 3, 2),
        tok(TokenType.Scalar, "1", 5, 2),
        tok(TokenType.Scalar, "c", 0, 3),
        tok(TokenType.MappingValue, ":", 1, 3),
        tok(TokenType.Scalar, "2", 3, 3),
        eof(3),
      ]).parse();
      expect(result).toEqual({ a: { b: 1 }, c: 2 });
    });

    it("parses nested sequence inside sequence", () => {
      const result = new Parser([
        tok(TokenType.SequenceEntry, "-", 0, 1),
        tok(TokenType.SequenceEntry, "-", 2, 1),
        tok(TokenType.Scalar, "a", 4, 1),
        tok(TokenType.SequenceEntry, "-", 2, 2),
        tok(TokenType.Scalar, "b", 4, 2),
        eof(2),
      ]).parse();
      expect(result).toEqual([["a", "b"]]);
    });
  });

  describe("document markers", () => {
    it("skips DocumentStart token", () => {
      const result = new Parser([
        tok(TokenType.DocumentStart, "---", 0, 1),
        tok(TokenType.Scalar, "hello", 0, 2),
        eof(2),
      ]).parse();
      expect(result).toBe("hello");
    });

    it("skips DocumentEnd token", () => {
      const result = new Parser([
        tok(TokenType.Scalar, "hello", 0, 1),
        tok(TokenType.DocumentEnd, "...", 0, 2),
        eof(2),
      ]).parse();
      expect(result).toBe("hello");
    });

    it("returns undefined for only DocumentStart", () => {
      const result = new Parser([tok(TokenType.DocumentStart, "---", 0, 1), eof(1)]).parse();
      expect(result).toBeUndefined();
    });
  });

  describe("flow collections", () => {
    it("parses flow sequence", () => {
      const result = new Parser([
        tok(TokenType.FlowSequenceStart, "[", 0, 1),
        tok(TokenType.Scalar, "a", 1, 1),
        tok(TokenType.FlowEntry, ",", 2, 1),
        tok(TokenType.Scalar, "b", 4, 1),
        tok(TokenType.FlowSequenceEnd, "]", 5, 1),
        eof(1),
      ]).parse();
      expect(result).toEqual(["a", "b"]);
    });

    it("parses flow mapping", () => {
      const result = new Parser([
        tok(TokenType.FlowMappingStart, "{", 0, 1),
        tok(TokenType.Scalar, "a", 1, 1),
        tok(TokenType.MappingValue, ":", 2, 1),
        tok(TokenType.Scalar, "1", 4, 1),
        tok(TokenType.FlowMappingEnd, "}", 5, 1),
        eof(1),
      ]).parse();
      expect(result).toEqual({ a: 1 });
    });

    it("parses flow mapping key without value", () => {
      const result = new Parser([
        tok(TokenType.FlowMappingStart, "{", 0, 1),
        tok(TokenType.Scalar, "a", 1, 1),
        tok(TokenType.FlowMappingEnd, "}", 2, 1),
        eof(1),
      ]).parse();
      expect(result).toEqual({ a: null });
    });

    it("parses quoted scalar in flow value", () => {
      const result = new Parser([
        tok(TokenType.FlowSequenceStart, "[", 0, 1),
        tok(TokenType.QuotedScalar, "hello", 1, 1),
        tok(TokenType.FlowSequenceEnd, "]", 8, 1),
        eof(1),
      ]).parse();
      expect(result).toEqual(["hello"]);
    });

    it("returns null for unexpected token in flow value", () => {
      const result = new Parser([
        tok(TokenType.FlowSequenceStart, "[", 0, 1),
        tok(TokenType.FlowEntry, ",", 1, 1),
        tok(TokenType.FlowSequenceEnd, "]", 2, 1),
        eof(1),
      ]).parse();
      expect(result).toEqual([]);
    });
  });

  describe("edge cases", () => {
    it("parseNode returns null when indent <= minIndent", () => {
      // Scalar at indent 0 with minIndent 0 should return null
      const result = new Parser([
        tok(TokenType.Scalar, "a", 0, 1),
        tok(TokenType.MappingValue, ":", 1, 1),
        // value is on next line at same indent => null
        tok(TokenType.Scalar, "next", 0, 2),
        tok(TokenType.MappingValue, ":", 4, 2),
        tok(TokenType.Scalar, "val", 6, 2),
        eof(2),
      ]).parse();
      expect(result).toEqual({ a: null, next: "val" });
    });

    it("parseNode returns null for unrecognized token type", () => {
      const result = new Parser([tok(TokenType.MappingValue, ":", 0, 1), eof(1)]).parse();
      expect(result).toBeNull();
    });

    it("sequence entry at EOF pushes null", () => {
      const result = new Parser([tok(TokenType.SequenceEntry, "-", 0, 1), eof(2)]).parse();
      expect(result).toEqual([null]);
    });

    it("sequence entry with block value on next line", () => {
      // -
      //   a: 1
      const result = new Parser([
        tok(TokenType.SequenceEntry, "-", 0, 1),
        tok(TokenType.Scalar, "a", 2, 2),
        tok(TokenType.MappingValue, ":", 3, 2),
        tok(TokenType.Scalar, "1", 5, 2),
        eof(2),
      ]).parse();
      expect(result).toEqual([{ a: 1 }]);
    });

    it("sequence entry with flow mapping inline", () => {
      const result = new Parser([
        tok(TokenType.SequenceEntry, "-", 0, 1),
        tok(TokenType.FlowMappingStart, "{", 2, 1),
        tok(TokenType.Scalar, "a", 3, 1),
        tok(TokenType.MappingValue, ":", 4, 1),
        tok(TokenType.Scalar, "1", 6, 1),
        tok(TokenType.FlowMappingEnd, "}", 7, 1),
        eof(1),
      ]).parse();
      expect(result).toEqual([{ a: 1 }]);
    });

    it("sequence entry with quoted scalar inline", () => {
      const result = new Parser([
        tok(TokenType.SequenceEntry, "-", 0, 1),
        tok(TokenType.QuotedScalar, "hello", 2, 1),
        eof(1),
      ]).parse();
      expect(result).toEqual(["hello"]);
    });

    it("parseSequenceInlineValue returns null for unrecognized token", () => {
      const result = new Parser([
        tok(TokenType.SequenceEntry, "-", 0, 1),
        tok(TokenType.MappingValue, ":", 2, 1),
        eof(1),
      ]).parse();
      expect(result).toEqual([null]);
    });

    it("parseMappingValue returns null for DocumentEnd", () => {
      const result = new Parser([
        tok(TokenType.Scalar, "a", 0, 1),
        tok(TokenType.MappingValue, ":", 1, 1),
        tok(TokenType.DocumentEnd, "...", 0, 2),
        eof(2),
      ]).parse();
      expect(result).toEqual({ a: null });
    });

    it("parseInlineValue returns null for unexpected inline token", () => {
      const result = new Parser([
        tok(TokenType.Scalar, "a", 0, 1),
        tok(TokenType.MappingValue, ":", 1, 1),
        tok(TokenType.DocumentEnd, "...", 3, 1),
        eof(1),
      ]).parse();
      expect(result).toEqual({ a: null });
    });

    it("parseNode returns null when token indent <= minIndent", () => {
      // Tests line 34: nested mapping where value indent is not greater
      // a:
      //   b: 1
      //     c:  <-- value for c has nothing indented further
      // d: 2
      const result = new Parser([
        tok(TokenType.Scalar, "a", 0, 1),
        tok(TokenType.MappingValue, ":", 1, 1),
        tok(TokenType.Scalar, "b", 2, 2),
        tok(TokenType.MappingValue, ":", 3, 2),
        tok(TokenType.Scalar, "1", 5, 2),
        tok(TokenType.Scalar, "c", 2, 3),
        tok(TokenType.MappingValue, ":", 3, 3),
        // Next token at indent 0 (not greater than parent indent 2)
        tok(TokenType.Scalar, "d", 0, 4),
        tok(TokenType.MappingValue, ":", 1, 4),
        tok(TokenType.Scalar, "2", 3, 4),
        eof(4),
      ]).parse();
      expect(result).toEqual({ a: { b: 1, c: null }, d: 2 });
    });

    it("inline SequenceEntry as mapping value", () => {
      // Tests line 124: parseInlineValue with SequenceEntry
      // This happens when scanner produces:
      // key: - item  (on the same line)
      const result = new Parser([
        tok(TokenType.Scalar, "a", 0, 1),
        tok(TokenType.MappingValue, ":", 1, 1),
        tok(TokenType.SequenceEntry, "-", 3, 1),
        tok(TokenType.Scalar, "x", 5, 1),
        tok(TokenType.SequenceEntry, "-", 3, 2),
        tok(TokenType.Scalar, "y", 5, 2),
        eof(2),
      ]).parse();
      expect(result).toEqual({ a: ["x", "y"] });
    });

    it("parseFlowValue returns null for FlowEntry", () => {
      // Tests line 262: parseFlowValue with no valid value token
      const result = new Parser([
        tok(TokenType.FlowSequenceStart, "[", 0, 1),
        tok(TokenType.FlowMappingEnd, "}", 1, 1),
        tok(TokenType.FlowSequenceEnd, "]", 2, 1),
        eof(1),
      ]).parse();
      expect(result).toEqual([null]);
    });
  });
});
