# Input Dispatcher

The public application entry point is `src/components/ui/Input/Input.tsx`.
Variants keep their tests and private helpers colocated; application callers
do not import variants directly.

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
