# UI Contracts

Read for feature UI, forms, inputs, modals, and component organization. The
input dispatcher's detailed public contract is in [Input](input.md).

## Ownership

- Routes compose parameters, providers, and navigation. Feature screens own
  queries, mutations, application state, and backend-data normalization.
- `src/components/ui/` primitives are independent of feature contexts and
  generated Convex types.
- Direct generated Convex hooks are appropriate for simple feature operations.
  Add a feature-owned hook or adapter only when it hides normalization,
  orchestration, or reusable policy.

## Shared Primitives

- Application code uses `src/components/ui/Input/Input.tsx`, not its variant
  components directly. Preserve the dispatcher contract unless an approved
  refactor replaces it.
- Every modal dismisses on backdrop tap. Modal content has no close button,
  close icon, or other dismissal-only control; domain actions remain allowed.

## Naming

Use PascalCase for React component modules. For non-component modules, follow
the convention already established in that feature directory. Do not perform
naming-only sweeps.

## Verification

Test behavior and accessibility rather than exact utility classes. Navigation,
keyboard, modal, and platform-sensitive behavior should use native-oriented
tools where practical.
