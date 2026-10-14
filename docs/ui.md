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
- Every modal requests dismissal on backdrop tap. Pipe creation and editing
  confirm discarding unsaved changes before dismissal, including system Back;
  step navigation preserves drafts. Modal content has no close button,
  close icon, or other dismissal-only control; domain actions remain allowed.
- `ModalShell` bottom-anchors content above reserved keyboard space. Content hugs
  its height and grows upward within safe-area bounds; a keyboard that overlaps
  the reserved anchor reduces the available region. Accessories sit below the
  content in that same region. Content owns overflow scrolling; do not wrap forms
  or virtualized lists in another shell-level ScrollView.
- Mandatory [app updates](app-updates.md) use a screen-level gate, not a modal.
- Pipe list minimization is an account-scoped, device-local display preference.
  It survives sign-out and app restarts, is not synchronized through Convex,
  and removes saved IDs only after a complete pipe catalog load.

## Naming

Use PascalCase for React component modules. For non-component modules, follow
the convention already established in that feature directory. Do not perform
naming-only sweeps.

## Verification

Test behavior and accessibility rather than exact utility classes. Navigation,
keyboard, modal, and platform-sensitive behavior should use native-oriented
tools where practical.
