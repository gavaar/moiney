# Moiney - Financial Companion App

## Stack
- **Framework**: Expo SDK 54 (React Native 0.81, React 19)
- **Routing**: Expo Router (file-based, `app/` directory)
- **Styling**: NativeWind v4 (Tailwind CSS v3)
- **Backend**: Convex (reactive backend-as-a-service)
- **Package Manager**: Bun

## Project Structure
```
moiney/
├── src/                  # Application source code
│   ├── app/              # Expo Router screens (file-based)
│   │   ├── _layout.tsx
│   │   ├── index.tsx
│   │   ├── (auth)/       # Auth flow (login, sign-up)
│   │   └── (main)/       # Main app (tabs: history, pipes, profile)
│   ├── components/       # All components (ui primitives + features)
│   │   ├── ui/           # Alert, Button, Icon, Input, Modal, PipeBox, ScreenHeader, etc.
│   │   │   └── Input/
│   │   │       ├── Input.tsx          # polymorphic dispatcher (switches on `type`)
│   │   │       └── components/        # one folder per variant (TextInput, NumberInput, DateInput, ...)
│   │   └── features/     # Feature modules (feature-first colocation)
│   │       ├── AmountForm/ # Shared feature-level component
│   │       ├── pipes/     # Pipes feature: screens, contexts, sub-components
│   │       └── transactions/ # Transactions feature: context
│   ├── lib/              # Shared utilities and hooks
│   │   ├── auth/         # Auth provider, token storage (platform variants)
│   │   ├── errors/       # Error handling utilities
│   │   ├── forms/        # useForm hook
│   │   ├── hooks/        # useDebounce, useKeyboardHeight
│   │   ├── styles/       # cn() utility, color tokens
│   │   └── dates.ts      # Date helpers
│   ├── global.css
│   └── globals.d.ts
├── convex/               # Convex backend
│   ├── lib/              # Shared backend utilities (auth, jwt, pipes, transactions, etc.)
│   ├── _generated/       # Auto-generated Convex types
│   ├── schema.ts         # Database schema
│   ├── auth.ts / auth.config.ts
│   ├── http.ts / crons.ts
│   ├── pipes.ts / transactions.ts / accounts.ts / sessions.ts
│   └── migrations.ts
├── assets/               # Static assets
├── .agents/skills/       # AI agent skills (Expo, Convex, RN)
├── app.json              # Expo config
├── tailwind.config.js
├── babel.config.js
├── metro.config.js
└── convex.json           # Convex CLI config
```

## Commands
- `bun start` / `bun run dev` - Start Expo dev server
- `bun run convex:dev` - Start Convex dev server
- `bun run convex:deploy` - Deploy Convex functions
- `bun run ios` / `bun run android` / `bun run web`

## Convex Setup
1. Run `bun run convex:dev` to create a Convex project and get your deployment URL
2. Copy the `CONVEX_URL` to `.env.local` as `EXPO_PUBLIC_CONVEX_URL`

## Conventions
- Use Expo Router file-based routing (`src/app/` directory)
- Style with NativeWind/Tailwind utility classes
- Use `@/` path alias to import from `src/` (e.g. `@/app/...`, `@/lib/...`)
- Use `@ui/` path alias to import from `src/components/ui/` (e.g. `@ui/Button`, `@ui/Icon`, `@ui/Alert`)
- Use `@features/` path alias to import from `src/components/features/` (e.g. `@features/pipes/...`)
- Use `@convex/` path alias to import from `convex/`
- Feature colocation: screens, contexts, and sub-components live in `src/components/features/<feature>/`; shared feature components sit alongside them
- Component pattern: each component directory has `ComponentName.tsx`, `ComponentName.test.tsx`, and an `index.ts` barrel file
- Platform files: use `.native.ts` / `.web.ts` suffixes for platform-specific variants (e.g. `storage.ts`)
- Convex schema in `convex/schema.ts`, domain functions in `convex/*.ts`, shared helpers in `convex/lib/`
- For testing use `bun run test` instead of `bun test`

### `Input` component (polymorphic form fields)
`src/components/ui/Input/Input.tsx` is a single dispatcher component: it renders one of several field variants based on its `type` prop. Screens and features use `<Input type="..." />` — they never import variant components directly.

- Variant mapping (`type` → component in `src/components/ui/Input/components/`):

  | `type` | Component | Folder |
  | --- | --- | --- |
  | `"text"` | `TextInput` | `TextInput/` |
  | `"number"` | `NumberInput` | `NumberInput/` |
  | `"decimal"` | `DecimalInput` | `DecimalInput/` |
  | `"date"` | `DateInput` | `DateInput/` |
  | `"icon"` | `IconInput` | `IconInput/` |
  | `"checkbox"` | `CheckboxInput` | `Checkbox/` |
  | `"select"` | `SelectInput` | `SelectInput/` |
  | `"text-select"` | `TextSelectInput` | `TextSelectInput/` |

  Note: the `type` string does **not** always match the folder name (e.g. `"checkbox"` → `Checkbox/`, `"date"` → `DateInput`).
- Each variant folder holds `<Variant>.tsx`, `<Variant>.test.tsx`, and an `index.ts` barrel, re-exported from `Input/components/index.ts`.
- Each variant declares its own Props type in `Input.tsx` (e.g. `DateProps`, `SelectProps`); all of them are unioned into `Props` and dispatched via a `switch (props.type)`.
- Complex variants colocate their internals inside their own folder (e.g. `DateInput/components/Calendar.tsx` modal + `DateInput/calendar.ts` pure date helpers).
- Adding a new variant: create the folder under `components/`, re-export it in `components/index.ts`, then add its Props union + `case` in `Input.tsx`.
