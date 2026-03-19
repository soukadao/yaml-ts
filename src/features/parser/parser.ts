import type { Token } from "../../entities/token/index.js";
import { TokenType } from "../../entities/token/index.js";
import type { YamlValue } from "../../shared/index.js";

export class Parser {
  private readonly tokens: Token[];
  private pos = 0;

  private static readonly EOF_TOKEN: Token = {
    type: TokenType.EOF,
    value: "",
    indent: 0,
    line: 0,
    column: 0,
  };

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): YamlValue | undefined {
    while (this.peek().type === TokenType.DocumentStart) this.consume();

    if (this.peek().type === TokenType.EOF || this.peek().type === TokenType.DocumentEnd) {
      return undefined;
    }

    const result = this.parseNode(-1);

    while (this.peek().type === TokenType.DocumentEnd) this.consume();

    return result;
  }

  private parseNode(minIndent: number): YamlValue {
    const token = this.peek();

    if (token.type === TokenType.EOF || token.indent <= minIndent) {
      return null;
    }

    if (token.type === TokenType.FlowSequenceStart) {
      return this.parseFlowSequence();
    }
    if (token.type === TokenType.FlowMappingStart) {
      return this.parseFlowMapping();
    }
    if (token.type === TokenType.SequenceEntry) {
      return this.parseSequence(token.indent);
    }

    if (token.type === TokenType.Scalar || token.type === TokenType.QuotedScalar) {
      if (this.isFollowedByMappingValue(token)) {
        return this.parseMapping(token.indent);
      }
      return token.type === TokenType.QuotedScalar
        ? this.consume().value
        : this.resolveScalar(this.consume().value);
    }

    return null;
  }

  private isFollowedByMappingValue(token: Token): boolean {
    const next = this.peekAt(1);
    return next.type === TokenType.MappingValue && next.line === token.line;
  }

  // --- Block mapping ---

  private parseMapping(indent: number): Record<string, YamlValue> {
    const result: Record<string, YamlValue> = {};

    while (this.isMappingEntry(indent)) {
      const keyToken = this.consume();
      const mappingValueToken = this.consume();
      result[keyToken.value] = this.parseMappingValue(indent, mappingValueToken.line);
    }

    return result;
  }

  private isMappingEntry(indent: number): boolean {
    const current = this.peek();
    return (
      (current.type === TokenType.Scalar || current.type === TokenType.QuotedScalar) &&
      current.indent === indent &&
      this.isFollowedByMappingValue(current)
    );
  }

  private parseMappingValue(parentIndent: number, colonLine: number): YamlValue {
    const next = this.peek();
    if (next.type === TokenType.EOF || next.type === TokenType.DocumentEnd) {
      return null;
    }

    if (next.line === colonLine) {
      return this.parseInlineValue();
    }

    if (next.indent > parentIndent) {
      return this.parseNode(parentIndent);
    }

    return null;
  }

  private parseInlineValue(): YamlValue {
    const next = this.peek();
    if (next.type === TokenType.Scalar) {
      return this.resolveScalar(this.consume().value);
    }
    if (next.type === TokenType.QuotedScalar) {
      return this.consume().value;
    }
    if (next.type === TokenType.SequenceEntry) {
      return this.parseSequence(next.indent);
    }
    if (next.type === TokenType.FlowSequenceStart) {
      return this.parseFlowSequence();
    }
    if (next.type === TokenType.FlowMappingStart) {
      return this.parseFlowMapping();
    }
    return null;
  }

  // --- Block sequence ---

  private parseSequence(indent: number): YamlValue[] {
    const result: YamlValue[] = [];

    while (this.peek().type === TokenType.SequenceEntry && this.peek().indent === indent) {
      const entryToken = this.consume();
      const next = this.peek();

      if (next.type === TokenType.EOF || next.type === TokenType.DocumentEnd) {
        result.push(null);
        continue;
      }

      if (next.line === entryToken.line) {
        result.push(this.parseSequenceInlineValue());
      } else if (next.indent > indent) {
        result.push(this.parseNode(indent));
      } else {
        result.push(null);
      }
    }

    return result;
  }

  private parseSequenceInlineValue(): YamlValue {
    const next = this.peek();
    if (next.type === TokenType.SequenceEntry) {
      return this.parseSequence(next.indent);
    }
    if (next.type === TokenType.FlowSequenceStart) {
      return this.parseFlowSequence();
    }
    if (next.type === TokenType.FlowMappingStart) {
      return this.parseFlowMapping();
    }
    if (next.type === TokenType.QuotedScalar) {
      return this.consume().value;
    }
    if (next.type === TokenType.Scalar) {
      if (this.isFollowedByMappingValue(next)) {
        return this.parseMapping(next.indent);
      }
      return this.resolveScalar(this.consume().value);
    }
    return null;
  }

  // --- Flow collections ---

  private parseFlowSequence(): YamlValue[] {
    this.consume(); // FlowSequenceStart
    const result: YamlValue[] = [];

    while (this.peek().type !== TokenType.FlowSequenceEnd && this.peek().type !== TokenType.EOF) {
      if (this.peek().type === TokenType.FlowEntry) {
        this.consume();
        continue;
      }
      const before = this.pos;
      result.push(this.parseFlowValue());
      if (this.pos === before) this.consume();
    }

    if (this.peek().type === TokenType.FlowSequenceEnd) this.consume();
    return result;
  }

  private parseFlowMapping(): Record<string, YamlValue> {
    this.consume(); // FlowMappingStart
    const result: Record<string, YamlValue> = {};

    while (this.peek().type !== TokenType.FlowMappingEnd && this.peek().type !== TokenType.EOF) {
      if (this.peek().type === TokenType.FlowEntry) {
        this.consume();
        continue;
      }

      const keyToken = this.consume();
      const key = keyToken.value;

      if (this.peek().type === TokenType.MappingValue) {
        this.consume();
        result[key] = this.parseFlowValue();
      } else {
        result[key] = null;
      }
    }

    if (this.peek().type === TokenType.FlowMappingEnd) this.consume();
    return result;
  }

  private parseFlowValue(): YamlValue {
    const token = this.peek();
    if (token.type === TokenType.FlowSequenceStart) {
      return this.parseFlowSequence();
    }
    if (token.type === TokenType.FlowMappingStart) {
      return this.parseFlowMapping();
    }
    if (token.type === TokenType.QuotedScalar) {
      return this.consume().value;
    }
    if (token.type === TokenType.Scalar) {
      return this.resolveScalar(this.consume().value);
    }
    return null;
  }

  // --- Scalar resolution (YAML 1.2.2 Core Schema) ---

  private resolveScalar(value: string): YamlValue {
    if (value === "null" || value === "Null" || value === "NULL" || value === "~") {
      return null;
    }

    if (value === "true" || value === "True" || value === "TRUE") return true;
    if (value === "false" || value === "False" || value === "FALSE") return false;

    const first = value[0];
    if (first === "." || first === "-" || first === "+" || (first >= "0" && first <= "9")) {
      return this.resolveNumericScalar(value);
    }

    return value;
  }

  private resolveNumericScalar(value: string): YamlValue {
    if (/^[-+]?[0-9]+$/.test(value)) return parseInt(value, 10);
    if (/^0o[0-7]+$/.test(value)) return parseInt(value.slice(2), 8);
    if (/^0x[0-9a-fA-F]+$/.test(value)) return parseInt(value.slice(2), 16);

    if (value === ".inf" || value === ".Inf" || value === ".INF") return Infinity;
    if (value === "-.inf" || value === "-.Inf" || value === "-.INF") return -Infinity;
    if (value === ".nan" || value === ".NaN" || value === ".NAN") return NaN;

    if (/^[-+]?(\.[0-9]+|[0-9]+(\.[0-9]*)?)([eE][-+]?[0-9]+)?$/.test(value)) {
      if (value.includes(".") || value.toLowerCase().includes("e")) {
        return parseFloat(value);
      }
    }

    return value;
  }

  // --- Helpers ---

  private peek(): Token {
    return this.tokens[this.pos] ?? Parser.EOF_TOKEN;
  }

  private peekAt(offset: number): Token {
    return this.tokens[this.pos + offset] ?? Parser.EOF_TOKEN;
  }

  private consume(): Token {
    return this.tokens[this.pos++] ?? Parser.EOF_TOKEN;
  }
}
