import type { Token } from "../../entities/token/index.js";
import { Scanner } from "./scanner.js";

export { Scanner } from "./scanner.js";

export function scan(source: string): Token[] {
  return new Scanner(source).scan();
}
