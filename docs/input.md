# Input Dispatcher

The public application entry point is `src/components/ui/Input/Input.tsx`.
`Input.tsx` owns the top label, wrapper, accessory presentation, validation,
and supporting-text/error footer. Default accessory actions are selected by type
in `input.config.ts`. Variants own their control interiors,
interaction behavior and overlays. They report focus
and completed interactions through private callbacks, not presentation registration
effects. Variants keep their tests and private helpers colocated; application
callers and field-behavior tests use the public Input entry point.
`InputProps` is exported from the public entry point for typed composition.
For select variants, `InputProps<Item>` preserves the item shape through
`items`, `renderItem`, and `itemStyle`; direct calls infer it from `items`.
Unparameterized composition permits only the shared `{ id: string }` shape.

Every variant is controlled through a required `value` and optional `onChange`,
including checkbox's boolean value. `onChange` receives the variant's value,
never a native input event. Text-select uses the same callback for typing and
choosing a suggestion. Native event translation belongs inside each variant;
the dispatcher composes the variants' exported public control props with shared
field props. Private interaction callbacks are added only to implementation
props, not subtracted from the public interface. Text inputs do not expose
`defaultValue` or `onChangeText`.

| `type` | Component folder under `src/components/ui/Input/components/input-types/` |
| --- | --- |
| `text` | `TextInput/` |
| `number` | `NumberInput/` |
| `decimal` | `DecimalInput/` |
| `date` | `DateInput/` |
| `icon` | `IconInput/` |
| `checkbox` | `Checkbox/` |
| `select` | `SelectInput/` |
| `select-multiple` | `SelectInput/` |
| `text-select` | `TextSelectInput/` |
| `toggle` | `ToggleInput/` |

Text-select suggestions use the shared [anchored option list](ui.md#shared-primitives),
outside the form's scrolling area. Typing
keeps input focus, and a suggestion commits with one tap without first dismissing
the keyboard.

Every type accepts an optional top `label` and optional `accessibilityLabel`.
Omitted or empty labels render no visible label; the control's accessible name
is `accessibilityLabel ?? label`. Supply `accessibilityLabel` when omitting the
visible label, unless a checkbox's `checkboxLabel` or toggle's option labels
provide its accessible name. The shared
`components/InputLabel/InputLabel.tsx` owns visible label presentation.

Inputs accept optional `prefix` and `suffix` buttons described by
`{ content, accessibilityLabel, onPress, disabled? }`. Each side resolves
independently: omission uses the variant's default, a description replaces it,
and `null` hides it. Number defaults to decrement/increment buttons with its
existing bounds; Decimal defaults to its sign prefix when `allowNegative` is true.
The shared wrapper owns button presentation. Input configuration owns the default
actions; variants identify completed interactions. Input owns validation timing. Custom
callbacks own their effects. Buttons are disabled
when either the input or the button is disabled. Accessory presses do not also
activate the central control. Informational status and decorative icons remain
separate from these buttons.

Every type supports `appearance="outlined" | "borderless"`. Checkbox and Toggle
default to borderless; other types default to outlined. Borderless removes the
background, outline, and accessory dividers while retaining standard padding.
Inner controls retain their own selection styling. Checkbox's optional
`checkboxLabel` appears beside its square and belongs to the clickable row,
independently of the top label. Toggle selection stays on its two segments.
Accessory buttons remain independent.

Toggle inputs take two icon options with optional labels: the first represents
`false`, the second `true`. The selected label, when supplied, appears beside the toggle.
Each option may supply `selectedBackgroundClassName`; otherwise the selected
segment uses the shared primary background.

`type="select"` controls one ID (`string | null`); `type="select-multiple"`
controls a readonly ID array and emits mutable ID arrays. The public interface
has no `multiple` flag; both types share a picker implementation internally.
Select inputs accept `renderItem(item)` for custom option content. All selects
open a bounded, virtualized picker from the shared field; there is no inline
presentation. Pickers fit their contents up to the available modal height, then
scroll; short lists remain compact. Multiple selections expose checkbox semantics. Optional `loading`
displays a loading indicator in the trigger and prevents selection while loading.
Empty lists display an empty state inside the picker.
Optional `itemStyle(item)` styles option rows; the
standard selected background remains owned by `OptionRow`. Domain-specific colors belong in
feature renderers and style callbacks, not in Select.

Every type accepts optional `supportingText` (text or JSX). Text receives shared
muted styling; JSX owns its presentation. When omitted, text and text-select
fields with `maxLength` show an automatic character counter. An explicit `null`
hides that counter. Displayed validation errors replace supporting content and
counters; clearing an error restores the configured supporting content.

## Validation

Inputs own their displayed errors through an optional synchronous, pure
`validator(value): string | undefined`. The argument is the variant's controlled
value type, including empty values (`null` for date/single select, `""` for icon).
Decimal validators receive signed strings, including partial drafts; multiple
select validators receive readonly string arrays. Only `undefined` means valid.

- Errors start hidden, including for prefilled values. `validateOn` supports
  `"change"` and `"blur"` (default). Change mode activates validation when a
  control emits a value change; blur mode activates it when interaction completes.
  Dirty means validation has activated; once dirty, validation
  stays live until remount, including after an error clears. The controlled `value`
  is the sole validation source; edits are validated when the parent updates it.
  Number blur emits a clamped value, which is validated after the parent accepts it.
- In blur mode, text-like controls complete interaction on native blur. Date,
  icon, and single-select choices, text-select suggestions, checkbox, and toggle
  complete it on commit. Multiple select completes it on picker close and then
  validates on every selection change. Opening a picker,
  searching icons, or cancelling a date/icon/single-select picker does not validate.
- Controlled value or validator changes revalidate dirty inputs; pristine inputs
  keep errors hidden. Cross-field rules and asynchronous results can be captured
  by a synchronous validator. Rejected edits do not change the displayed error.
  Removing the validator clears its displayed error. Remount (for example, with
  a caller-owned key) to reset validation.
- Optional `onError(error)` reports the current displayed error after mount and
  whenever that error changes, independently of `onChange(value)`. Callback identity
  changes do not emit notifications. This supports Form page indicators. A hidden error
  does not imply validity: submission owners must check the rules independently.

## Form Composition

`src/components/ui/Form` exports the controlled `Form` component and its
`FormProps`, `FormPage`, `FormRow`, `FormField`, `FormNavigation`, and `FormValue`
types. Form renders content only;
callers own modal visibility, backdrop dismissal, submission, and value state.
Its optional `header` is a JSX element, not a string.
An optional JSX `actions` renders below the fields on every step, including
single-step forms. The caller owns its callbacks, eligibility, and loading
state; Form does not submit or infer submit readiness from displayed errors.
Optional `warnings: readonly string[]` supplies messages rendered below the
actions. Form owns their shared styling and top-right dismiss buttons; callers
do not compose warning JSX. Message text is warning identity: duplicate messages
share one card, and dismissed messages stay hidden through step changes and
rerenders, even if temporarily removed and reintroduced. Dismissal resets when
the form remounts, including on modal reopen. New messages remain visible.
Validation and submission errors are not dismissible warnings; caller-owned
submission errors and action guidance belong with `actions`. On multi-step forms,
only the fields are flanked by chevrons; actions, warnings, and step indicators
sit below them at full form width with space between each section.
The optional `fill` layout fills a height-constrained parent and gives remaining
space to the scrollable fields, keeping the header and actions outside that
scroll area. Content-sized modal forms omit it.

- `pages` contains uniquely keyed pages, each with `rows` of uniquely keyed field
  definitions. Page keys are stable numeric identities, not positions; array order
  determines page order. Field keys are unique across the entire form. Empty rows
  and pages with no fields are omitted; a form with no fields renders only its
  header. Fields contain `input` and optional `description` and `reveal`.
  Validators live in `input.validator`. Input configuration
  excludes `value`, `onChange`, and `onError`; Form supplies these
  through the public Input dispatcher for every variant.
- Descriptions accept text or JSX; text receives the standard muted styling,
  while JSX owns its presentation. Non-input controls such as a mode toggle can
  be composed in the JSX header slot without becoming form values.
- Optional `reveal: { label, icon?, expanded, onReveal }` renders a muted button
  in place of a collapsed field. The caller owns expansion and reset behavior;
  revealing never changes the value. Disabled inputs also disable their reveal
  button. Collapsed fields remain in emitted value records, but their input and
  description are unmounted and their errors do not mark the step. Revealing
  again mounts fresh input validation state.
- `value` supplies each configured key's value. `onChange` emits all and only
  configured keys, not a patch. Define every managed key in `pages`; unrelated
  keys supplied in `value` are omitted from the emitted record.
- Inputs follow the validation timing above; Form observes their displayed errors
  for page indicators. Errors never block navigation. Remount Form to reset
  validation and navigation.
- Each row is an ordered array of fields rendered as equal-width, top-aligned
  columns. Use a single-field row for full-width content. Labels, descriptions,
  and errors stay in their field's column. Field definitions have no page or row
  identifiers; shared configuration can return rows for a caller-owned page.
  Input-level number `step` still means the increment size.
- Multiple steps support horizontal paging and full-height side chevrons,
  absent at the first/last step respectively, with no implicit submit action.
  Dots use `muted`/`text` when unselected/selected, overridden by
  `errorDark`/`error` if any field on that step displays an error. A single step
  has no pager, navigation chevrons, or dots.
- Content-sized multi-step forms size their pager to the active step's measured
  content, including changes from validation and revealed fields. Inactive steps
  stay mounted to preserve input state but do not determine the modal height.
  Tall steps remain constrained by the modal; `fill` forms keep using available
  height rather than hugging each step's content.
- Navigation is internal by default. Supply `navigation: { step, onChange }`
  to control it; `step` refers to a page key, not its index. Chevrons and swipes
  request page keys through the callback, while external `step` changes align
  the pager. An unavailable step displays
  the first page. Auto-advance belongs in the caller's selection handler, not
  an effect that would also fire when navigating Back.
- Form steps remain vertically scrollable; Select option lists scroll separately
  inside their pickers.

### Configuration Helpers

`formBuilder<Values>()` from `@ui/Form` supplies `form`, `page`, `row`, and
`input` functions. They compose ordinary Form configuration, not mutable builder
state:

```ts
const { form, page, row, input } = formBuilder<Draft>({
  defaults: { disabled },
});

const ownerPage = editing ? null : page(0, row(input("ownerId", ownerInput)));

const pages = form(
  ownerPage,
  page(1,
    row(input("name", { label: "Name" })),
    row(input("icon", { type: "icon" }), input("priority", { type: "number" })),
  ),
);
```

- `input(key, configuration, metadata?)` preserves field/value compatibility and
  contextual callback types, including the original select item shape. Construct
  select fields through `input()` even inside manually composed `FormField` or
  `FormRow` arrays. It binds each item's rendering and styling lazily before
  heterogeneous fields share storage; stored items are presentation data, not
  domain models. Raw non-select field definitions remain supported.
  Optional metadata contains `description` and `reveal`.
  The shared `disabled` default applies when creating inputs; explicit input
  settings override it. Reusable row factories own their inputs' defaults.
- `row`, `page`, and `form` accept `false`, `null`, and `undefined` children as
  omissions. Reusable rows remain ordinary readonly arrays; compose collections
  with `page(...rows)`.
- `page(...rows)` receives the next number during `form(...)`, starting at zero.
  `page(key, ...rows)` uses that key and continues numbering from `key + 1`.
  Omitted pages consume no number. Use explicit keys where conditional page
  presence must not change later page identities or `navigationStart` targets.
- `form(...)` finalizes immediately, rejecting duplicate page keys, duplicate
  field keys across the form, and empty rows or pages after omissions. These
  stricter authoring checks do not change Form's handling of raw configuration.
