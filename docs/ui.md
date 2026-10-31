# UI Contracts

Read for feature UI, forms, inputs, modals, and component organization. The
input dispatcher's detailed public contract is in [Input](input.md). Apply the
global [code-quality guide](engineering-principles.md) to interface and ownership
decisions.

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
- `Popover` uses a native modal for menus. Input choices share the virtualized
  `OptionList` and accessible `OptionRow` primitives; input variants own their
  selection policy and content. `OptionRow` owns standard selected-row
  presentation. Select keeps its modal picker. Collapsible-select overlays its
  anchor in the same native window, while
  text-select uses `AnchoredOptionList` to keep the anchor interactive and bound
  scrolling above or below it around the keyboard. Anchored lists require an
  `OptionListHost` outside clipping containers in the same native window; the app
  root and `ModalShell` provide separate hosts. Do not open a second native modal
  for autocomplete suggestions.
- `Form` sizes to its active page, shrinks when constrained, and owns overflow
  scrolling. It owns page navigation; `navigationStart` is an initial page key
  read on mount, not a controlled selection. Headers use presentation config
  (title, optional icon, accessibility label, and badge); features own domain
  wording and formatting. Actions remain caller-rendered.
- Modal backdrop taps and system Back/Escape first let a hosted overlay consume
  dismissal; expanded collapsible-select behavior is defined in [Input](input.md).
  Otherwise, backdrop taps request modal dismissal. All pipe creation/editing entry
  points and the plus creation modal confirm discarding unsaved changes before dismissal, including
  system Back; plus-modal dismissal checks all drafts, including hidden modes, and is
  blocked while any form is saving. Mode and step navigation preserve drafts
  without confirmation; successful submission closes directly. Displaying a
  validation error alone does not make a draft dirty. Modal content has
  no control whose sole purpose is dismissing the modal; domain actions and inline
  warning dismissal remain allowed.
- `ModalShell` bottom-anchors content 20% above the viewport bottom and permits
  upward growth no farther than 10% from the top. Safe-area bounds and a 24px
  keyboard gap can further constrain this region. Content hugs its height;
  keyboard overlap reduces the available region. Accessories sit below the
  content in that same region. Content owns overflow scrolling; do not wrap forms
  or virtualized lists in another shell-level ScrollView.
- Mandatory [app updates](app-updates.md) use a screen-level gate, not a modal.
- Pipe list minimization is an account-scoped, device-local display preference.
  It survives sign-out and app restarts, is not synchronized through Convex,
  and removes saved IDs only after a complete pipe catalog load.

## Pipe Forms

All creation entry points share one type-driven form. General creation offers
Transaction and Pipe modes, not a separate root form. Pipe choices are grouped as
Feeds (Basic feed, Boiler) and Inner pipes (Manual, Instant, Overflow, Timed,
Self-destruct). These choices combine existing source type and settlement rule;
they do not introduce another persisted pipe type. An inner pipe can be an
intermediate parent or a childless drain.

Creation requires an explicit choice. The plus creation modal starts its type
picker collapsed; Add pipe from the feeds list and Add child pipe start it open,
including after clearing the form. Contextual Add child shows feeds disabled,
preselects a changeable owner, and retains that restriction after owner changes.
Without a feed, inner choices are disabled and their section explains why. Root
creation has one page; inner forms have type, rule explanation, owner, icon, name,
priority, and capacity on the first page, with behavior-specific settings,
contingency, and description on the second. Selection collapses
the picker without advancing. Existing inner editors start on the second page; rule
shortcuts start on the collapsed type overview with a read-only owner and no feed
choices. Parents and roots have details-only editors. Accounting constraints are
owned by [Accounting](domain/accounting.md).

Mode, step, and type changes preserve session drafts; only the active type is
validated and submitted. Explicit local edits, including inactive type options,
survive live updates; untouched fields follow live data. Submit requires a
persistable active change when editing, while dismissal protects raw and inactive
draft edits too. Run now cannot discard those drafts; when the active type has
nothing to save, guidance directs the user to the edited type or Reset changes.
Restored contingency must be eligible under the current owner; owner changes clear
an invalid donor with an explanation. Creating the first child adds a third page
for non-dismissible warnings about the owner's intermediate-pipe transition and
accounting resets. Its “I understand” checkbox must be checked before submitting
from any page. Acknowledgement survives step/mode navigation and unrelated edits,
but resets when the owner or warnings change, on Clear, and on reopening. Owners
with children, root creation, and editing do not show this warning page.
New pipe drafts default to the selected type's icon until the user chooses a
custom icon. Type changes preserve custom selections and existing pipes' saved
icons; clearing the creation form restores automatic defaults.

## Organization And Naming

Follow the global [folder-structure rules](engineering-principles.md#folder-structure)
for component folders, companion files, nesting, and shared ownership. For
non-component filenames, follow the convention established in that feature.
Do not perform naming-only sweeps unrelated to an approved structural change.

## Verification

Interactive primitives expose meaningful names, roles, and applicable selected,
checked, expanded, and disabled states. Use native accessibility properties and
the web aliases required by the supported React Native Web version; names and
state must describe the actual interaction, including loading-disabled controls.

Test interactions, workflows, accessibility states, and meaningful displayed
results. Appearance-only assertions fixing decorative colors, padding, dimensions,
icon artwork, utility classes, or incidental copy are outside automated test scope.
Text assertions remain appropriate for accessible names, validation, warnings,
entered values, and domain outputs; require exact wording only when it is a contract.
Geometry assertions need a usability or quantitative domain contract, such as
keyboard avoidance, reachable content, or proportional financial amounts—not an
arbitrary pixel value. Keep detailed coverage at its owning seam and only necessary
wiring coverage above it.

The current Vitest component suite uses React Native Web; it verifies exposed web
semantics, not VoiceOver/TalkBack announcements or native focus traversal.
Navigation, keyboard, modal, and platform-sensitive behavior should also use
native-oriented tools where practical; report when that verification is unavailable.

## Theme

Prefer semantic theme tokens from `src/lib/styles/colors.js`, directly for native
color props or through NativeWind utilities. Preserve semantic distinctions even
when tokens currently share a value. Derive opacity from a token where needed;
transparent surfaces and framework-default shadows need not become color tokens.
If an intended color has no close semantic token, ask before creating one rather
than silently adding a literal or choosing a misleading token.
