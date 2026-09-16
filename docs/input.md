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

## Validation

Inputs own their displayed errors through an optional synchronous, pure
`validator(value): string | undefined`. The argument is the variant's controlled
value type, including empty values (`null` for date/single select, `""` for icon).
Decimal validators receive signed strings, including partial drafts; multiple
select validators receive readonly string arrays. Only `undefined` means valid.

- Errors start hidden. Text, number, decimal, and typed text-select become dirty
  on blur. Dirty means the input has been interacted with; once dirty, validation
  stays live until remount, including after an error clears. The controlled `value`
  is the sole validation source; edits are validated when the parent updates it.
  Number blur emits a clamped value, which is validated after the parent accepts it.
- Date, icon, and single-select choices, text-select suggestions, checkbox, and
  toggle changes become dirty and validate on commit. Multiple select becomes
  dirty on picker close and then validates on every selection change. Opening a picker,
  searching icons, or cancelling a date/icon/single-select picker does not validate.
- Controlled value or validator changes revalidate dirty inputs; pristine inputs
  keep errors hidden. Cross-field rules and asynchronous results can be captured
  by a synchronous validator. Rejected edits do not change the displayed error.
  Removing the validator clears its displayed error. Remount to reset validation.
- Optional `onError(error)` reports the current displayed error after mount and
  whenever that error changes, independently of `onChange(value)`. Callback identity
  changes do not emit notifications. This supports Form page indicators. A hidden error
  does not imply validity: submission owners must check the rules independently.

## Form Composition

`src/components/ui/Form` exports the controlled `Form` component and its
`FormProps`, `FormField`, and `FormValue` types. Form renders content only;
callers own modal visibility, backdrop dismissal, submission, and value state.
Its optional `header` is a JSX element, not a string.
An optional JSX `finalAction` replaces Next on the last step, or appears below
the fields for a single-step form. The caller owns its callback, eligibility,
and loading state; Form does not submit or validate on its behalf.

- `form` contains uniquely keyed definitions with `input`, optional `description`,
  and optional `step`. Validators live in `input.validator`. Input configuration
  excludes `value`, `onChange`, and `onError`; Form supplies these
  through the public Input dispatcher for every variant.
- `value` supplies each configured key's value. `onChange` emits all and only
  configured keys, not a patch. Define every managed key in `form`; unrelated
  keys supplied in `value` are omitted from the emitted record.
- Inputs follow the validation timing above; Form observes their displayed errors
  for page indicators. Errors never block navigation. Remount Form to reset
  validation and navigation.
- Missing steps default to `0`. Distinct step numbers are sorted numerically;
  field order within a step follows the array. Gaps do not create empty pages.
  Input-level number `step` still means the increment size, not the form page.
- Multiple steps support horizontal paging and Next/Back, with no implicit
  submit action. Dots use `muted`/`text` when unselected/selected, overridden
  by `errorDark`/`error` if any field on that step displays an error. A single step
  has no pager, navigation buttons, or dots.
