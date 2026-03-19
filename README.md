# yaml-ts

A YAML 1.2.2 parser written in TypeScript.

## Install

```sh
npm install yaml-ts
```

## Usage

```ts
import { parse } from "yaml-ts";

parse("hello: world");
// { hello: "world" }

parse("- 1\n- 2\n- 3");
// [1, 2, 3]

parse("count: 42");
// { count: 42 }

parse("enabled: true");
// { enabled: true }
```

## Supported Features

- Plain scalars (strings, integers, floats, booleans, null)
- Block mappings (`key: value`)
- Block sequences (`- item`)
- Nested structures
- Single-quoted strings (`'...'`)
- Double-quoted strings with escape sequences (`"..."`)
- Flow sequences (`[a, b, c]`)
- Flow mappings (`{a: 1, b: 2}`)
- Literal block scalars (`|`, `|-`, `|+`)
- Folded block scalars (`>`, `>-`, `>+`)
- Document markers (`---`, `...`)
- Comments (`#`)

## YAML 1.2.2 Core Schema

Scalar values are resolved according to the [YAML 1.2.2 Core Schema](https://yaml.org/spec/1.2.2/#103-core-schema):

| YAML | TypeScript |
|---|---|
| `null`, `Null`, `NULL`, `~` | `null` |
| `true`, `True`, `TRUE` | `true` |
| `false`, `False`, `FALSE` | `false` |
| `42`, `-17`, `+5` | `number` (integer) |
| `0o17` | `number` (octal) |
| `0xFF` | `number` (hex) |
| `3.14`, `1.5e+3` | `number` (float) |
| `.inf`, `-.inf` | `Infinity`, `-Infinity` |
| `.nan` | `NaN` |
| `'42'`, `"true"` | `string` (quoted = no type resolution) |

## Development

```sh
bun install
bun run test
bun run coverage
bun run build
```

## License

MIT
