# Moiney

Moiney is a financial companion app for managing pipe-based money allocation,
transactions, rules, and transaction history.

## Stack

- Expo SDK 57, React Native 0.86, and React 19
- Expo Router routes under `src/app/`
- NativeWind v4 with Tailwind CSS v3
- Convex 1.44 backend
- Custom JWT authentication with refresh-token rotation
- Vitest with Testing Library
- Bun package manager

## Structure

```text
moiney/
|-- domain/                 # Framework-independent money, transaction, pipe, and schedule logic
|-- src/
|   |-- app/                # Expo Router route composition only
|   |-- components/
|   |   |-- ui/             # Reusable presentation primitives
|   |   `-- features/       # Feature-owned screens, state, and components
|   `-- lib/                # Cross-feature infrastructure and utilities
|-- convex/                 # Schema, registered functions, and backend model operations
|-- benchmarks/             # Repeatable performance measurements
|-- docs/                   # Engineering principles and domain decisions
|-- assets/
`-- app.json
```

## Prerequisites

- [Bun](https://bun.sh)
- An Expo-supported simulator or device for native development
- A Convex account for backend development

## Setup

Install dependencies:

```bash
bun install
```

Start the Convex development deployment:

```bash
bun run convex:dev
```

Set the deployment values in `.env.local`:

```bash
CONVEX_DEPLOYMENT=dev:your-project-name
EXPO_PUBLIC_CONVEX_URL=https://your-project.convex.cloud
EXPO_PUBLIC_CONVEX_SITE_URL=https://your-project.convex.site
```

Configure the server-side JWT variables in the Convex environment:

```text
JWT_PRIVATE_KEY
JWT_PUBLIC_KEY
CONVEX_SITE_URL
```

Start the app:

```bash
bun start
bun run ios
bun run android
bun run web
```

## Commands

| Command | Purpose |
| --- | --- |
| `bun run convex:dev` | Start the Convex development deployment |
| `bun run convex:deploy` | Verify and deploy Convex functions |
| `bun run test` | Run the Vitest suite |
| `bun run typecheck` | Run the TypeScript check |
| `bun run verify` | Run tests and type checking |
| `bun run benchmark:performance` | Run the Update 15 performance benchmark |

## Authentication

`src/lib/auth/auth.tsx` owns the client auth provider. Access tokens are short
lived, refresh tokens are rotated and stored in platform-specific secure
storage, and account keys scope the transaction cache. The native adapter uses
`expo-secure-store`; the web adapter uses browser storage.

## Development Rules

- Persist and calculate money as whole integer cents.
- Keep pure domain calculations under `domain/`.
- Keep route files thin and feature behavior under `src/components/features/`.
- Validate authorization and financial invariants in Convex functions.
- Run `bun run verify` before completing a production change.
