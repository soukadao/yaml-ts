import type { Token } from "../../entities/token/index.js";
import { TokenType } from "../../entities/token/index.js";

export class Scanner {
  private readonly source: string;
  private pos = 0;
  private line = 1;
  private column = 0;
  private readonly tokens: Token[] = [];

  constructor(source: string) {
    this.source = source;
  }

  scan(): Token[] {
    while (this.pos < this.source.length) {
      this.scanLine();
    }
    this.tokens.push({
      type: TokenType.EOF,
      value: "",
      indent: 0,
      line: this.line,
      column: this.column,
    });
    return this.tokens;
  }

  private scanLine(): void {
    this.skipSpaces();
    const indent = this.column;
    const startLine = this.line;

    if (this.isAtEnd() || this.current() === "\n") {
      if (!this.isAtEnd()) this.advance();
      return;
    }

    if (this.current() === "#") {
      this.skipToEndOfLine();
      return;
    }

    this.scanContent(indent);

    if (this.line === startLine) {
      this.skipToEndOfLine();
    }
  }

  private scanContent(indent: number): void {
    if (this.isAtEnd() || this.current() === "\n" || this.current() === "#") {
      return;
    }

    // Document markers (only at column 0)
    if (indent === 0) {
      if (this.matchDocumentMarker("-")) {
        this.emitDocumentMarker(TokenType.DocumentStart, "---");
        return;
      }
      if (this.matchDocumentMarker(".")) {
        this.emitDocumentMarker(TokenType.DocumentEnd, "...");
        return;
      }
    }

    // Sequence entry: - followed by space/newline/EOF
    if (this.current() === "-" && this.isFollowedBySpaceOrEnd()) {
      this.pushToken(TokenType.SequenceEntry, "-", indent, this.line);
      this.advance();
      if (!this.isAtEnd() && this.current() === " ") this.advance();
      if (!this.isAtEnd() && this.current() !== "\n" && this.current() !== "#") {
        this.scanContent(this.column);
      }
      return;
    }

    // Flow collections at root/entry level
    if (this.current() === "[" || this.current() === "{") {
      this.scanFlowCollection(indent);
      return;
    }

    // Block scalar at root/entry level
    if ((this.current() === "|" || this.current() === ">") && this.isBlockScalarIndicator()) {
      this.scanBlockScalar(indent);
      return;
    }

    this.scanKeyOrValue(indent);
  }

  // --- Key / Value scanning ---

  private scanKeyOrValue(indent: number): void {
    if (this.isAtEnd() || this.current() === "\n") return;

    if (this.current() === "'" || this.current() === '"') {
      this.scanQuotedKeyOrValue(indent);
      return;
    }

    const startLine = this.line;
    const key = this.readPlainScalar(true);
    if (key === "") return;

    if (this.isMappingIndicator()) {
      this.pushToken(TokenType.Scalar, key, indent, startLine);
      this.emitMappingValueAndScanInline(indent);
    } else {
      this.pushToken(TokenType.Scalar, key, indent, startLine);
    }
  }

  private scanQuotedKeyOrValue(indent: number): void {
    const startLine = this.line;
    const value = this.readQuotedScalar();
    this.pushToken(TokenType.QuotedScalar, value, indent, startLine);
    this.skipSpaces();

    if (this.isMappingIndicator()) {
      this.emitMappingValueAndScanInline(indent);
    }
  }

  private emitMappingValueAndScanInline(indent: number): void {
    const colonColumn = this.column;
    const colonLine = this.line;
    this.advance();
    this.pushToken(TokenType.MappingValue, ":", colonColumn, colonLine);
    if (!this.isAtEnd() && this.current() === " ") this.advance();
    this.scanInlineValue(indent);
  }

  private scanInlineValue(parentIndent: number): void {
    if (this.isAtEnd() || this.current() === "\n" || this.isInlineComment()) {
      return;
    }

    if (this.current() === "'" || this.current() === '"') {
      const valueIndent = this.column;
      const valueLine = this.line;
      const value = this.readQuotedScalar();
      this.pushToken(TokenType.QuotedScalar, value, valueIndent, valueLine);
      return;
    }

    if (this.current() === "[" || this.current() === "{") {
      this.scanFlowCollection(this.column);
      return;
    }

    if ((this.current() === "|" || this.current() === ">") && this.isBlockScalarIndicator()) {
      this.scanBlockScalar(parentIndent);
      return;
    }

    const valueIndent = this.column;
    const valueLine = this.line;
    const value = this.readPlainScalar(false);
    if (value !== "") {
      this.pushToken(TokenType.Scalar, value, valueIndent, valueLine);
    }
  }

  // --- Plain scalar reading (slice-based) ---

  private readPlainScalar(breakOnColon: boolean): string {
    const start = this.pos;
    while (!this.isAtEnd() && this.current() !== "\n") {
      if (breakOnColon && this.isMappingIndicator()) break;
      if (this.isInlineComment()) break;
      this.advance();
    }
    return this.source.slice(start, this.pos).trimEnd();
  }

  // --- Quoted scalar reading ---

  private readQuotedScalar(): string {
    const quote = this.current();
    this.advance();
    if (quote === "'") {
      return this.readSingleQuotedContent();
    }
    return this.readDoubleQuotedContent();
  }

  private readSingleQuotedContent(): string {
    let result = "";
    while (!this.isAtEnd()) {
      if (this.current() === "'") {
        if (this.pos + 1 < this.source.length && this.source[this.pos + 1] === "'") {
          result += "'";
          this.advance();
          this.advance();
        } else {
          this.advance();
          return result;
        }
      } else {
        result += this.current();
        this.advance();
      }
    }
    return result;
  }

  private readDoubleQuotedContent(): string {
    let result = "";
    while (!this.isAtEnd()) {
      if (this.current() === '"') {
        this.advance();
        return result;
      }
      if (this.current() === "\\") {
        this.advance();
        if (this.isAtEnd()) break;
        const ch = this.current();
        if (ch === "x" || ch === "u" || ch === "U") {
          const digits = ch === "x" ? 2 : ch === "u" ? 4 : 8;
          result += this.readHexEscape(digits);
          this.advance();
        } else {
          result += this.resolveBasicEscape(ch);
          this.advance();
        }
      } else {
        result += this.current();
        this.advance();
      }
    }
    return result;
  }

  private resolveBasicEscape(ch: string): string {
    switch (ch) {
      case "n":
        return "\n";
      case "t":
        return "\t";
      case "r":
        return "\r";
      case "\\":
        return "\\";
      case '"':
        return '"';
      case "'":
        return "'";
      case "0":
        return "\0";
      case "a":
        return "\x07";
      case "b":
        return "\b";
      case "e":
        return "\x1b";
      case "v":
        return "\v";
      case "f":
        return "\f";
      case " ":
        return " ";
      case "/":
        return "/";
      default:
        return ch;
    }
  }

  private readHexEscape(digits: number): string {
    let hex = "";
    for (let i = 0; i < digits; i++) {
      this.advance();
      if (this.isAtEnd()) break;
      hex += this.current();
    }
    const codePoint = parseInt(hex, 16);
    return isNaN(codePoint) ? "" : String.fromCodePoint(codePoint);
  }

  // --- Flow collection scanning ---

  private scanFlowCollection(indent: number): void {
    const opening = this.current();
    const closing = opening === "[" ? "]" : "}";
    const startType = opening === "[" ? TokenType.FlowSequenceStart : TokenType.FlowMappingStart;
    const endType = opening === "[" ? TokenType.FlowSequenceEnd : TokenType.FlowMappingEnd;

    this.pushToken(startType, opening, indent, this.line);
    this.advance();

    while (!this.isAtEnd()) {
      const loopStart = this.pos;
      this.skipFlowWhitespace();
      if (this.isAtEnd()) break;

      if (this.current() === closing) {
        this.pushToken(endType, closing, this.column, this.line);
        this.advance();
        return;
      }

      // Unexpected closing bracket — treat as end
      if (this.current() === "]" || (this.current() === "}" && closing !== "}")) {
        break;
      }

      if (this.current() === ",") {
        this.pushToken(TokenType.FlowEntry, ",", this.column, this.line);
        this.advance();
        continue;
      }

      if (this.current() === "[" || this.current() === "{") {
        this.scanFlowCollection(this.column);
        continue;
      }

      if (this.current() === "'" || this.current() === '"') {
        const vi = this.column;
        const vl = this.line;
        const val = this.readQuotedScalar();
        this.pushToken(TokenType.QuotedScalar, val, vi, vl);
        this.skipFlowWhitespace();
        this.checkFlowMappingValue();
        continue;
      }

      this.scanFlowPlainScalar();

      // Safety: prevent infinite loop
      if (this.pos === loopStart) {
        this.advance();
      }
    }
  }

  private scanFlowPlainScalar(): void {
    const indent = this.column;
    const line = this.line;
    const value = this.readFlowPlainValue();
    if (value === "") return;
    this.pushToken(TokenType.Scalar, value, indent, line);
    this.skipFlowWhitespace();
    this.checkFlowMappingValue();
  }

  private readFlowPlainValue(): string {
    const start = this.pos;
    while (!this.isAtEnd()) {
      const ch = this.current();
      if (ch === "," || ch === "]" || ch === "}" || ch === "[" || ch === "{" || ch === "\n") {
        break;
      }
      if (ch === ":" && this.isFollowedBySpaceOrFlowIndicator()) {
        break;
      }
      if (this.isInlineComment()) {
        break;
      }
      this.advance();
    }
    return this.source.slice(start, this.pos).trim();
  }

  private checkFlowMappingValue(): void {
    if (!this.isAtEnd() && this.current() === ":" && this.isFollowedBySpaceOrFlowIndicator()) {
      this.pushToken(TokenType.MappingValue, ":", this.column, this.line);
      this.advance();
    }
  }

  // --- Block scalar scanning ---

  private scanBlockScalar(parentIndent: number): void {
    const startLine = this.line;
    const style = this.current() as "|" | ">";
    this.advance();

    let chomping: "clip" | "strip" | "keep" = "clip";
    let explicitIndent = 0;

    while (!this.isAtEnd() && this.current() !== "\n") {
      if (this.current() === "-") {
        chomping = "strip";
        this.advance();
      } else if (this.current() === "+") {
        chomping = "keep";
        this.advance();
      } else if (this.current() >= "1" && this.current() <= "9") {
        explicitIndent = parseInt(this.current(), 10);
        this.advance();
      } else if (this.current() === " " || this.current() === "#") {
        break;
      } else {
        break;
      }
    }

    this.skipToEndOfLine();

    const lines: string[] = [];
    let contentIndent = explicitIndent > 0 ? parentIndent + explicitIndent : -1;

    while (!this.isAtEnd()) {
      const savedPos = this.pos;
      const savedLine = this.line;
      const savedColumn = this.column;

      let lineIndent = 0;
      while (!this.isAtEnd() && this.current() === " ") {
        lineIndent++;
        this.advance();
      }

      if (this.isAtEnd()) {
        if (contentIndent >= 0 && lineIndent < contentIndent) {
          this.pos = savedPos;
          this.line = savedLine;
          this.column = savedColumn;
        }
        break;
      }

      if (this.current() === "\n") {
        lines.push("");
        this.advance();
        continue;
      }

      if (contentIndent < 0) {
        contentIndent = lineIndent;
      }

      if (lineIndent < contentIndent) {
        this.pos = savedPos;
        this.line = savedLine;
        this.column = savedColumn;
        break;
      }

      const prefix = " ".repeat(lineIndent - contentIndent);
      const lineStart = this.pos;
      while (!this.isAtEnd() && this.current() !== "\n") {
        this.advance();
      }
      lines.push(prefix + this.source.slice(lineStart, this.pos));
      if (!this.isAtEnd()) this.advance();
    }

    const content = this.processBlockContent(lines, style, chomping);
    this.pushToken(TokenType.QuotedScalar, content, parentIndent, startLine);
  }

  private processBlockContent(
    lines: string[],
    style: "|" | ">",
    chomping: "clip" | "strip" | "keep",
  ): string {
    let lastContentIndex = lines.length - 1;
    while (lastContentIndex >= 0 && lines[lastContentIndex] === "") {
      lastContentIndex--;
    }

    const contentLines = lines.slice(0, lastContentIndex + 1);
    const trailingEmptyCount = lines.length - lastContentIndex - 1;

    let content: string;
    if (style === "|") {
      content = contentLines.join("\n");
    } else {
      content = this.foldLines(contentLines);
    }

    switch (chomping) {
      case "strip":
        return content;
      case "keep":
        return content + "\n" + "\n".repeat(trailingEmptyCount);
      default:
        return content.length > 0 ? content + "\n" : "";
    }
  }

  private foldLines(lines: string[]): string {
    if (lines.length === 0) return "";

    let result = "";
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line === "") {
        result += "\n";
      } else if (line.startsWith(" ")) {
        if (result.length > 0 && !result.endsWith("\n")) {
          result += "\n";
        }
        result += line + "\n";
      } else {
        if (result.length > 0 && !result.endsWith("\n")) {
          result += " ";
        }
        result += line;
      }
    }
    return result;
  }

  // --- Document markers ---

  private matchDocumentMarker(ch: string): boolean {
    return (
      this.pos + 2 < this.source.length &&
      this.source[this.pos] === ch &&
      this.source[this.pos + 1] === ch &&
      this.source[this.pos + 2] === ch &&
      (this.pos + 3 >= this.source.length ||
        this.source[this.pos + 3] === " " ||
        this.source[this.pos + 3] === "\n")
    );
  }

  private emitDocumentMarker(type: TokenType, value: string): void {
    this.pushToken(type, value, 0, this.line);
    this.advance();
    this.advance();
    this.advance();
  }

  // --- Helpers ---

  private isMappingIndicator(): boolean {
    return !this.isAtEnd() && this.current() === ":" && this.isFollowedBySpaceOrEnd();
  }

  private isBlockScalarIndicator(): boolean {
    const nextPos = this.pos + 1;
    if (nextPos >= this.source.length) return true;
    const next = this.source[nextPos];
    return (
      next === "\n" || next === " " || next === "-" || next === "+" || (next >= "1" && next <= "9")
    );
  }

  private isFollowedBySpaceOrEnd(): boolean {
    const nextPos = this.pos + 1;
    return (
      nextPos >= this.source.length || this.source[nextPos] === " " || this.source[nextPos] === "\n"
    );
  }

  private isFollowedBySpaceOrFlowIndicator(): boolean {
    if (this.isFollowedBySpaceOrEnd()) return true;
    const ch = this.source[this.pos + 1];
    return ch === "," || ch === "]" || ch === "}" || ch === "[" || ch === "{";
  }

  private isInlineComment(): boolean {
    return this.current() === "#" && this.pos > 0 && this.source[this.pos - 1] === " ";
  }

  private skipSpaces(): void {
    while (!this.isAtEnd() && this.current() === " ") {
      this.advance();
    }
  }

  private skipFlowWhitespace(): void {
    while (
      !this.isAtEnd() &&
      (this.current() === " " ||
        this.current() === "\n" ||
        this.current() === "\r" ||
        this.current() === "\t")
    ) {
      this.advance();
    }
  }

  private skipToEndOfLine(): void {
    while (!this.isAtEnd() && this.current() !== "\n") {
      this.advance();
    }
    if (!this.isAtEnd()) this.advance();
  }

  private pushToken(type: TokenType, value: string, indent: number, line: number): void {
    this.tokens.push({ type, value, indent, line, column: indent });
  }

  private current(): string {
    return this.source[this.pos];
  }

  private isAtEnd(): boolean {
    return this.pos >= this.source.length;
  }

  private advance(): void {
    if (this.isAtEnd()) return;
    if (this.current() === "\n") {
      this.line++;
      this.column = 0;
    } else {
      this.column++;
    }
    this.pos++;
  }
}
