# 🚀 Moiney

A **kickstarter** for any project that wants to build a React Native app with **Expo** + **Convex**. Comes with a complete custom JWT auth system — sign-up, sign-in, refresh tokens, and sign-out — already wired up and ready to go.

## ✨ Features

- ⚛️ **Expo SDK 54** — React Native 0.81, React 19, New Architecture enabled
- 🗺️ **Expo Router** — file-based routing in `src/app/`
- 🎨 **NativeWind v4** — Tailwind CSS utility classes
- ⚡ **Convex** — reactive backend-as-a-service with schema, queries, mutations, and actions
- 🔐 **Custom JWT auth** — RSA256-signed access tokens (15 min) + refresh tokens (30 days)
- 💾 **Persistent sessions** — refresh tokens stored in `expo-secure-store`, sessions tracked in Convex
- 🔄 **Auto-refresh** — expired access tokens are silently refreshed before API calls
- 🧩 **Shared UI** — reusable `Button`, `InputText` (with password toggle), `Icon`, `ErrorBoundary`, `AuthScreenLayout`
- ✅ **Form validation** — `useForm` hook with per-field validation on blur
- 🐛 **Error handling** — server errors mapped to user-friendly messages
- 🧪 **Tests** — Vitest with 20+ tests (cn utility, error mapping, password hashing, form hook)

## 🏗️ Stack

| Layer | Choice |
| --- | --- |
| 🧭 Framework | Expo SDK 54 |
| 🗺️ Routing | Expo Router (file-based) |
| 🎨 Styling | NativeWind v4 (Tailwind CSS v3) |
| ⚡ Backend | Convex v1.42 |
| 🔐 Auth | Custom JWT (RS256) |
| 💾 Storage | expo-secure-store |
| 📦 Bundler | Metro |
| 🧪 Testing | Vitest |

## 📁 Project structure

```
moiney/
├── src/
│   ├── app/            # 🖥️ Expo Router screens (_layout, index, login, sign-up)
│   ├── components/     # 🧩 Reusable UI + features
│   │   ├── ui/         # Alert, Button, Input, Icon, Modal, ErrorBoundary, etc.
│   │   └── features/   # Feature modules (pipes, transactions, SpentForm)
│   └── lib/            # 🔧 Hooks, utils, auth state, storage, test files
├── convex/
│   ├── schema.ts       # 🗃️ Database schema (users + sessions tables)
│   ├── auth.ts         # 🔑 signUp, signIn, refreshAccess, signOut actions
│   ├── accounts.ts     # 👤 User queries/mutations
│   ├── sessions.ts     # 🔄 Session CRUD (internal)
│   ├── http.ts         # 🌐 JWKS + OpenID endpoints for Convex auth
│   ├── crons.ts        # 🧹 Monthly cleanup of expired sessions
│   └── lib/            # 🛠️ Server-side utilities (JWT, password hashing)
├── assets/             # 🖼️ Static assets
├── .env / .env.local   # 🔒 Environment variables
└── app.json            # 📱 Expo config
```

## 🏁 Getting started

### 📋 Prerequisites

- 🥟 [Bun](https://bun.sh) (or Node.js 20+)
- 📱 [Expo CLI](https://docs.expo.dev/get-started/installation/)
- ☁️ A Convex account (free at [convex.dev](https://convex.dev))

### 1. 📦 Install dependencies

```bash
bun install
```

### 2. ⚡ Set up Convex

Open two terminals.

**Terminal A — Convex dev server:**

```bash
bun run convex:dev
```

This will:
- Prompt you to log in to Convex (or create an account)
- Create a new Convex project if one doesn't exist
- Deploy the schema and functions
- Output a **deployment URL** (e.g. `https://giant-mosquito-763.convex.cloud`)

**Terminal B — after Convex is running:**

Copy the deployment URL and the site URL into `.env.local`:

```bash
# .env.local
CONVEX_DEPLOYMENT=dev:your-project-name
EXPO_PUBLIC_CONVEX_URL=https://your-project.convex.cloud
EXPO_PUBLIC_CONVEX_SITE_URL=https://your-project.convex.site
```

### 3. 🔑 Generate RSA keys for JWT

The auth system uses RS256-signed JWTs. You need a private key to sign tokens and a public key for Convex to verify them.

Generate a key pair (or use an existing one):

```bash
openssl genpkey -algorithm RSA -out private_key.pem -pkeyopt rsa_keygen_bits:2048
openssl rsa -pubout -in private_key.pem -out public_key.pem
```

Add the keys to `.env`:

```bash
# Private key (single-line base64 or PEM — PEM format is used here)
JWT_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nMIIEvA...\n-----END PRIVATE KEY-----

# Public key (used by Convex to verify tokens)
JWT_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----\nMIIBIj...\n-----END PUBLIC KEY-----
```

> 💡 **Note for Expo:** Variables prefixed with `EXPO_PUBLIC_` are available on the client. The private key stays server-side only.

### 4. 🌐 Expose JWKS endpoint

The `convex/http.ts` file serves `/.well-known/openid-configuration` and `/.well-known/jwks.json` endpoints. These tell Convex's auth system how to verify the JWTs you issue.

Make sure `CONVEX_SITE_URL` is set in `.env` so the Convex auth config can discover these endpoints:

```bash
# convex/auth.config.ts reads CONVEX_SITE_URL
CONVEX_SITE_URL=https://your-project.convex.site
```

The auth config in `convex/auth.config.ts` uses this URL to point Convex to your custom OIDC provider (which is your own app's HTTP endpoints).

### 5. 🚀 Start the app

```bash
bun start
```

Or for a specific platform:

```bash
bun run ios
bun run android
bun run web
```

### 6. 🧪 Run tests

```bash
bun test
```

### 7. ☁️ Deploy Convex to production

```bash
bun run convex:deploy
```

## 🔐 How auth works

1. 📝 **Sign-up / Sign-in** — The `auth.signUp` and `auth.signIn` actions validate credentials, create a user + session in Convex, and return `{ accessToken, refreshToken }`.

2. 🎫 **Access tokens** — Short-lived (15 min) RS256 JWTs containing `sub` (userId) and `sessionId`. Signed with your private key.

3. 🔑 **Refresh tokens** — Random 32-byte hex strings, stored hashed in the `sessions` table. The raw token is returned to the client and stored in `expo-secure-store`.

4. 🔄 **Auto-refresh** — `useCustomAuth` wraps `ConvexProviderWithAuth`. When an access token is missing or expired, `fetchAccessToken` calls the `auth.refreshAccess` action to get a fresh one.

5. 🚪 **Sign-out** — The `auth.signOut` action deletes the session from Convex. The client clears both tokens from memory and storage.

6. 🧹 **Cleanup** — A monthly cron (`crons.ts`) deletes expired sessions from the database.

## 🔒 Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `EXPO_PUBLIC_CONVEX_URL` | ✅ Yes | Convex deployment URL (exposed to client) |
| `CONVEX_SITE_URL` | ✅ Yes | Convex site URL for HTTP endpoints and OIDC |
| `JWT_PRIVATE_KEY` | ✅ Yes | RSA private key (PEM format) for signing JWTs |
| `JWT_PUBLIC_KEY` | ✅ Yes | RSA public key for Convex JWT verification |

## 🎨 Customizing

- 🎨 **Colors** — Edit `tailwind.config.js` under `theme.extend.colors`
- 🖥️ **Auth screens** — Modify `src/app/login.tsx` and `src/app/sign-up.tsx`
- 🧩 **Components** — All shared components are in `src/components/`
- 🗃️ **Schema** — Add tables in `convex/schema.ts` and functions in `convex/`
- 🐛 **Error messages** — Edit the map in `src/lib/errors.ts`

## 📜 Scripts

| Command | Description |
| --- | --- |
| `bun start` / `bun run dev` | 🚀 Start Expo dev server |
| `bun run ios` | 📱 Start Expo on iOS simulator |
| `bun run android` | 🤖 Start Expo on Android emulator |
| `bun run web` | 🌐 Start Expo on web browser |
| `bun run convex:dev` | ⚡ Start Convex dev server (deploys schema + functions) |
| `bun run convex:deploy` | ☁️ Deploy Convex functions to production |
| `bun test` | 🧪 Run Vitest tests |

## 🔗 Path aliases

| Alias | Maps to |
| --- | --- |
| `@/` | `./src/` |
| `@convex/` | `./convex/` |

These are configured in `tsconfig.json` and resolved by `babel-preset-expo` and Vitest.
