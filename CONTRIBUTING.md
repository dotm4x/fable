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

`pnpm format` formats the workspace, and `pnpm lint:fix` applies available ESLint fixes.
Review automated changes before submitting them.

## Code style

- Write clear, descriptive names. Use PascalCase for types, camelCase for variables, functions,
  methods, and properties, and descriptive `T`-prefixed PascalCase names such as `TValue` for
  generic parameters. Do not prefix interface names with `I`.
- Prefer natural boolean names such as `active`, `visible`, and `enabled` over redundant
  prefixes such as `is`, `has`, `can`, or `should`.
- Prefer immutable values and `readonly` properties where practical. Declare class member
  accessibility and field types explicitly, and specify return types at module boundaries.
- Preserve type safety: avoid `any`, unsafe assertions, non-null assertions, and unhandled
  promises. Handle errors explicitly and throw `Error` objects.
- Keep APIs predictable and changes focused. Prefer simple functions or composition over
  abstractions and inheritance that do not provide a clear benefit.
- Group and sort imports, use type-only imports where appropriate, and avoid circular
  dependencies. Declare dependencies in the package that uses them.
- Document public behavior, parameters, return values, and relevant edge cases. Keep comments
  useful and avoid duplicating inherited documentation.
- Avoid `console.log` in production code; intentional warnings and errors are allowed.

[eslint.config.mjs](./eslint.config.mjs) is the authoritative source for lint rules and
[.prettierrc.json](./.prettierrc.json) for formatting. Prettier handles formatting; do not
introduce conflicting ESLint formatting rules. `TODO` and `FIXME` comments are reported as
warnings, so use them deliberately.

## Workspace packages

Keep package-specific dependencies and scripts in the relevant package. See
[packages/README.md](./packages/README.md) for workspace and TypeScript project configuration.
Do not commit generated output, dependencies, or secrets.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/) messages, for example
`feat: add input validation` or `fix: handle empty input`. The pre-commit hook formats and lints
staged files, and the commit-message hook checks the message with Commitlint.
