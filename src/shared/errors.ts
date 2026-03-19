export class YamlError extends Error {
  constructor(
    message: string,
    public readonly line: number,
    public readonly column: number,
  ) {
    super(`${message} at line ${line}, column ${column}`);
    this.name = "YamlError";
  }
}

export class ScanError extends YamlError {
  constructor(message: string, line: number, column: number) {
    super(message, line, column);
    this.name = "ScanError";
  }
}

export class ParseError extends YamlError {
  constructor(message: string, line: number, column: number) {
    super(message, line, column);
    this.name = "ParseError";
  }
}
