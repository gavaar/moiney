# Moiney - Financial Companion App

## Stack
- **Framework**: Expo SDK 54 (React Native 0.81, React 19)
- **Routing**: Expo Router (file-based, `app/` directory)
- **Styling**: NativeWind v4 (Tailwind CSS v3)
- **Backend**: Convex (reactive backend-as-a-service)
- **Package Manager**: Bun

## Project Structure
```
moikickstarter/
├── src/              # Application source code
│   ├── app/          # Expo Router screens
│   │   ├── _layout.tsx
│   │   └── index.tsx
│   ├── components/   # Reusable UI components
│   └── lib/          # Shared utilities and hooks
├── convex/           # Convex backend
│   └── schema.ts     # Database schema
├── assets/           # Static assets
├── .agents/skills/   # AI agent skills (Expo, Convex, RN)
├── app.json          # Expo config
├── tailwind.config.js
├── babel.config.js
├── metro.config.js
└── convex.json       # Convex CLI config
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
- Use `@/` path alias to import from `src/` (e.g. `@/app/...`, `@/components/...`)
- Convex schema in `convex/schema.ts`, functions in `convex/`
