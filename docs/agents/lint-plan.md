# Code-Quality Lint Plan

Implement these guardrails in a separate ESLint change. The
[engineering guide](../engineering-principles.md) owns the quality rules;
this document owns the proposed enforcement scope, not alternative rules.

| Guardrail | Candidate mechanism using installed tools | Required checks |
| --- | --- | --- |
| Dependency direction | `import/no-restricted-paths` plus targeted `no-restricted-imports` | Cover resolved relative paths and all aliases; keep UI independent of features/backend and pure domain code independent of framework runtimes. |
| Public module entry points | Scoped `import/no-internal-modules` or path restrictions | Identify actual module entry points; permit owner-local imports and framework-required entries. Do not equate every directory with a public module. |
| Dependency cycles | `import/no-cycle` | Verify TypeScript/alias resolution and distinguish runtime cycles from type-only dependencies. |
| Type safety | `@typescript-eslint/no-explicit-any`; type-aware unsafe-operation rules | Configure typed linting first; preserve generic inference rather than replacing `any` with assertions. |
| Hooks correctness | Existing React/React Hooks rules | Make correctness failures blocking; assess each currently warning-only rule rather than promoting every stylistic warning. |

## Coverage And Verification

- Lint all handwritten source intended to be governed, including `domain/` and
  `convex/`. `expo lint` without explicit paths currently selects `src/`, so
  merely adding backend/domain config overrides does not exercise them.
- Keep generated artifacts excluded. Distinguish configuration files, Router
  entry points, platform adapters, and tests where their contracts require it.
- Verify restrictions against forbidden imports expressed as aliases and
  relative paths, as well as permitted public and owner-local imports.
- Classify each rule as a blocking error or advisory warning. Warnings do not
  currently fail verification.
- Inventory existing violations before enabling global errors. Existing-folder
  refactors are separate work; do not silently rewrite them in the lint change.

Ownership, small interfaces, extraction thresholds, accessible interaction design,
and performance benefit remain review decisions. Do not approximate them with
line-count limits, component-count limits, or mandatory memoization. Cosmetic
keyword, quote, and import-order preferences are outside this plan.
