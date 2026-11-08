# Packages

Workspace packages live in their own directories and include a `package.json`.
TypeScript packages can extend the shared settings with `"extends": "../../tsconfig.base.json"`.
Package-specific tools and scripts, including test runners, belong in that package's `package.json`.

ESLint uses the nearest `tsconfig.json` for type-aware checks. Include each package's
source, tests, and configuration files in that project; use a separate build configuration
to limit emitted files. JavaScript files should be included with `allowJs` enabled.
Run `pnpm lint` from the workspace root to check all packages and configuration files.
