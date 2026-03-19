import type { Token } from "../../entities/token/index.js";
import type { YamlValue } from "../../shared/index.js";
import { Parser } from "./parser.js";

export { Parser } from "./parser.js";

export function parseTokens(tokens: Token[]): YamlValue | undefined {
  return new Parser(tokens).parse();
}
