# Input Dispatcher

The public application entry point is `src/components/ui/Input/Input.tsx`.
Variants keep their tests and private helpers colocated; application callers
do not import variants directly.
`InputProps` is exported from the public entry point for typed composition.

Every variant is controlled through a required `value` and optional `onChange`,
including checkbox's boolean value. `onChange` receives the variant's value,
never a native input event. Text-select uses the same callback for typing and
choosing a suggestion. Native event translation belongs inside each variant;
the dispatcher derives its props from the variants rather than duplicating
their interfaces. Text inputs do not expose `defaultValue` or `onChangeText`.

| `type` | Component folder under `src/components/ui/Input/components/` |
| --- | --- |
| `text` | `TextInput/` |
| `number` | `NumberInput/` |
| `decimal` | `DecimalInput/` |
| `date` | `DateInput/` |
| `icon` | `IconInput/` |
| `checkbox` | `Checkbox/` |
| `select` | `SelectInput/` |
| `text-select` | `TextSelectInput/` |
| `toggle` | `ToggleInput/` |

Toggle inputs take two labeled icon options: the first represents `false`,
the second `true`. The selected label is displayed beside the toggle.

## Form Composition

`src/components/ui/Form` exports the controlled `Form` component and its
`FormProps`, `FormField`, and `FormValue` types. Form renders content only;
callers own modal visibility, backdrop dismissal, submission, and value state.
Its optional `header` is a JSX element, not a string.
An optional JSX `finalAction` replaces Next on the last step, or appears below
the fields for a single-step form. The caller owns its callback, eligibility,
and loading state; Form does not submit or validate on its behalf.

- `form` contains uniquely keyed definitions with `input`, a synchronous pure
  `validator(value): string | null`, optional `description`, and optional `step`.
  Input configuration excludes controlled values and change callbacks; Form
  supplies these through the public Input dispatcher for every variant.
- `value` supplies each configured key's value. `onChange` emits all and only
  configured keys, not a patch. Define every managed key in `form`; unrelated
  keys supplied in `value` are omitted from the emitted record.
- Validation starts on edits, including edits awaiting a parent update. Edited
  fields are revalidated against subsequent controlled values. A validation
  error overrides `input.error`; otherwise a supplied Input error is retained.
  Errors never block navigation. Remount Form to reset validation and navigation.
- Missing steps default to `0`. Distinct step numbers are sorted numerically;
  field order within a step follows the array. Gaps do not create empty pages.
  Input-level number `step` still means the increment size, not the form page.
- Multiple steps support horizontal paging and Next/Back, with no implicit
  submit action. Dots use `surface`/`text` when unselected/selected, overridden
  by `errorDark`/`error` if any field on that step has an error. A single step
  has no pager, navigation buttons, or dots.
