# Contributing

These guidelines apply across the workspace. Follow any additional guidance in the package you
are changing.

## Setup and checks

Use Node.js 22 and the pnpm version specified in [package.json](./package.json). Install workspace
dependencies with `pnpm install`.

Before submitting changes, run the workspace quality checks:

```sh
pnpm format:check
pnpm lint
pnpm typecheck
```

Run the relevant package's tests and build when its code or configuration changes. For example,
use `pnpm --filter <package-name> test` and `pnpm --filter <package-name> build` when those
scripts exist. Add or update tests for behavior changes and cover relevant edge cases.

The lint scripts build workspace packages first so their dependencies and types can be resolved
on a fresh checkout.

`pnpm format` formats the workspace, and `pnpm lint:fix` applies available ESLint fixes. Review
automated changes before submitting them. To check specific files, pass paths to
`pnpm format:files <paths>` and `pnpm lint:files <paths>`. `pnpm lint:files` without paths checks
the whole workspace without building packages first.

## Code style

- Write clear, descriptive names. Use PascalCase for types, camelCase for variables, functions,
  methods, and properties, and descriptive `T`-prefixed PascalCase names such as `TValue` for
  generic parameters. Do not prefix interface names with `I`.
- Prefer natural boolean names such as `active`, `visible`, and `enabled` over redundant
  prefixes such as `is`, `has`, `can`, or `should`.
- Prefer immutable values and `readonly` properties where practical. Declare class member
  accessibility and field types explicitly, and specify return types at module boundaries.
- Prefix private class fields, including constructor parameter properties, with `_` followed by
  camelCase; for example, `_onAdd`. Private methods remain camelCase without the prefix.
- Name files using their directory's context rather than repeating it: for example, use
  `time/context.ts` for `UpdateContext` and `input/devices/device.ts` for `InputDevice`.
  This convention applies to filenames, not type names.
- Import other source domains through the package's internal `#/` subpath, which points at
  `source`, for example `#/core/node/node.js` and `#/math/primitives/vectors/vector2.js`. Code
  inside a domain, such as `core` or `math`, uses relative paths. The subpath is declared in the
  package's `imports` field, so Node, Vite, Vitest, and TypeScript resolve it without consumer
  configuration. The package build rewrites it with `tsc-alias`, keeping published output on plain
  relative imports.
- Preserve type safety: avoid `any`, unsafe assertions, non-null assertions, and unhandled
  promises. Handle errors explicitly and throw `Error` objects.
- Keep APIs predictable and changes focused. Prefer simple functions or composition over
  abstractions and inheritance that do not provide a clear benefit.
- Use type-only imports where appropriate and avoid circular dependencies. Declare dependencies
  in the package that uses them.
- Document public behavior, parameters, return values, and relevant edge cases. Keep comments
  useful and avoid duplicating inherited documentation.

[eslint.config.mjs](./eslint.config.mjs) is the authoritative source for lint rules and
[.prettierrc.json](./.prettierrc.json) for formatting. Prettier owns token-level formatting;
ESLint enforces structure and quality, and its stylistic rules only manage blank lines, so the
two tools never format the same text. Do not add ESLint rules that duplicate Prettier. Omit
optional semicolons in JavaScript and TypeScript; Prettier retains them where needed for correct
parsing. `TODO` and `FIXME` comments are reported as warnings, so use them deliberately.

## Code organization

The conventions below are enforced by ESLint and applied with `pnpm lint:fix`. `.editorconfig`
mirrors the formatting settings for editors, and the checked-in VS Code settings format with
Prettier and apply ESLint fixes on save.

### Imports and exports

Imports are sorted into groups separated by one blank line:

1. Node.js built-in modules
2. External packages
3. Internal modules: the package's `#/` subpath and workspace packages such as `@dotm4x/`
4. Parent-directory imports (`../`)
5. Sibling and index imports (`./`)

Named imports and exports are sorted, type-only imports stay inline with value imports, and
re-export statements are sorted by module path. Side-effect imports keep their position.

### Class members

Classes declare members in this order, preserving declaration order within each group:

1. Index signatures and static blocks
2. Static fields
3. Instance fields
4. Constructors
5. Getters and setters
6. Static methods
7. Public methods
8. Protected methods
9. Private methods

Private backing fields come before the public fields and accessors that expose them. Separate
multi-line members with a blank line, but keep consecutive single-line fields compact.

### Interfaces, types, and objects

Interface and object type members list required members before optional members, preserving
declaration order within each group. Object literals keep their authored order because option
objects mirror the constructor or function they configure; only type declarations are reordered.

### Blank lines

Use a single blank line between logical sections: after a multi-line `if`, `for`, `while`,
`switch`, or `try` block, after a multi-line function declaration, and between multi-line class
members. Do not stack blank lines; Prettier keeps at most one. Single-line guard clauses stay next
to the statement they protect.

## Workspace packages

Keep package-specific dependencies and scripts in the relevant package. See
[packages/README.md](./packages/README.md) for workspace and TypeScript project configuration.
Do not commit generated output, dependencies, or secrets.

Run `pnpm --filter @fable/sandbox dev` to open the web sandbox. Its Vite server loads Fable
source directly, so changes to the package are reflected during development. Use
`pnpm --filter @fable/sandbox build` for a production build and
`pnpm --filter @fable/sandbox preview` to preview it.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/) messages, for example
`feat: add input validation` or `fix: handle empty input`. The pre-commit hook formats and lints
staged files, and the commit-message hook checks the message with Commitlint. Keep each commit
focused on one logical change; do not combine unrelated changes in the same commit.
