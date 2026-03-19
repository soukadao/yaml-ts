import type { YamlValue } from "./shared/index.js";
import { scan } from "./features/scanner/index.js";
import { parseTokens } from "./features/parser/index.js";

export type { YamlValue } from "./shared/index.js";
export { YamlError, ScanError, ParseError } from "./shared/index.js";

export function parse(source: string): YamlValue | undefined {
  const tokens = scan(source);
  return parseTokens(tokens);
}
