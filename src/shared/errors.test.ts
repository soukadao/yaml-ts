import { describe, it, expect } from "vitest";
import { YamlError, ScanError, ParseError } from "./errors.js";

describe("error classes", () => {
  it("YamlError includes location in message", () => {
    const err = new YamlError("unexpected char", 3, 5);
    expect(err.message).toBe("unexpected char at line 3, column 5");
    expect(err.name).toBe("YamlError");
    expect(err.line).toBe(3);
    expect(err.column).toBe(5);
  });

  it("ScanError extends YamlError", () => {
    const err = new ScanError("bad token", 1, 2);
    expect(err).toBeInstanceOf(YamlError);
    expect(err.name).toBe("ScanError");
    expect(err.line).toBe(1);
  });

  it("ParseError extends YamlError", () => {
    const err = new ParseError("unexpected token", 4, 10);
    expect(err).toBeInstanceOf(YamlError);
    expect(err.name).toBe("ParseError");
    expect(err.column).toBe(10);
  });
});
