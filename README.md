# fridgeEssences

fridgeEssences is a mobile app for households that share food: keep a common fridge inventory, track expiry dates, and record what gets used or thrown away. Items can be entered manually, identified by barcode, or extracted from a receipt photo for review before saving.

**Status:** work in progress with implemented mobile workflows and an iOS build/submission recorded in the repository. Public availability and current TestFlight access are unconfirmed. The backend schema is missing from the checkout, so a fresh clone cannot independently reproduce the full system yet.

The application and its npm scripts live in **[`fridge-app/`](fridge-app/)**. This root README describes the project; the nested README is the original Expo starter guide.

## Contents

- [Features](#features)
- [Project story](#project-story)
- [Stack and architecture](#stack-and-architecture)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Usage](#usage)
- [Development and testing](#development-and-testing)
- [Deployment and operations](#deployment-and-operations)
- [Security and data handling](#security-and-data-handling)
- [Troubleshooting](#troubleshooting)
- [Limitations and next steps](#limitations-and-next-steps)
- [Contributing, credits, and license](#contributing-credits-and-license)

## Features

- **Shared household inventory:** sign up or sign in with email and password, create a named fridge, or join with a 10-character invite code. Settings supports joining additional fridges, selecting an active fridge, renaming, and an owner-only invite regeneration control.
- **Three ways to add food:** type a name; scan a barcode to fill the name from Open Food Facts; or photograph/select a receipt, edit extracted names, exclude unwanted rows, and save the selected items together.
- **Categories and expiry:** eight categories organize the inventory. Small inventories use a sectioned list; at 15 active items the screen switches to a category overview and stays there for that screen session. Category details support correcting categories and editing expiry dates.
- **AI suggestions:** Gemini supplies categories, typical shelf life, and estimated US grocery prices through two Supabase Edge Functions. Manual additions are saved before enrichment, so an AI failure can leave an item uncategorized or without an expiry/price. Settings can backfill active items with missing categories.
- **Local expiry reminders:** device notifications are scheduled for 9 a.m. local time two days before expiry, when that time is still in the future. Permission is required; there is no implemented remote push workflow.
- **Consumption and waste history:** mark an item **Used** or **Toss**. The Stats tab displays individual wasted/expired items, estimated waste value, used counts, and category summaries for rolling 7-day, 30-day, or all-time views.
- **Guided onboarding:** share a fridge code, read a self-paced introduction, add a first item, and dismiss an inventory tip. The walkthrough can be replayed from Settings.

These capabilities depend on the expected Supabase tables, RPCs, policies, and Realtime configuration. AI dates are suggestions; verify them against the food's condition and packaging. Waste values are estimates, not actual receipt spending or measured savings.

## Project story

### The problem

A household can lose track of what is already in its fridge and what needs using soon. The project focuses on a shared inventory with expiry and outcome tracking, rather than a shopping list.

### The goal

The documented goal is to make repeated inventory entry practical through manual, barcode, and receipt input, then surface food that expires or goes unused. Project guidance targets a light visual design for v1 and defers remote push notifications. The engineering brief documents a zero monthly service budget; this is a constraint, not a guarantee that external usage is free.

### The approach

The mobile client talks directly to Supabase for authentication and inventory data. Realtime events trigger refetches so household changes can appear on other devices. AI calls go through server functions, keeping the Gemini key out of client configuration, while receipt results remain editable before insertion.

Inventory insertion and enrichment are separate operations: this reduces waiting before a newly entered item appears, but enrichment can fail without retrying automatically. Stats derives its headline value, item list, and category totals from one query, including both explicitly tossed and automatically expired items. This keeps those views consistent, but the query is capped at 500 settled rows and filters date ranges locally.

### The outcome

The source implements the entry, shared inventory, expiry editing, onboarding, and waste-history workflows described above. Repository engineering notes record the onboarding and item-level waste improvements. There are no measured food-waste reductions, user adoption figures, or performance benchmarks to report, and current end-to-end behavior has not been verified by running this checkout.

## Stack and architecture

- **Expo SDK 54, React Native 0.81.5, React 19.1:** mobile UI and native camera, image picker, and notification integrations. The npm lockfile resolves Expo to 54.0.34.
- **Expo Router 6:** file-based tabs, onboarding routes, and category detail navigation; `expo-router/entry` is the package entry point.
- **TypeScript 5.9 and ESLint 9:** strict client type checking and Expo lint configuration. Deno function files explicitly disable TypeScript checking with `@ts-nocheck`.
- **Supabase:** email/password Auth, Postgres access through `supabase-js`, Realtime subscriptions, and Deno Edge Functions. Database definitions are not versioned in this checkout.
- **Gemini 2.5 Flash:** receipt image parsing and grocery enrichment. **Open Food Facts:** public barcode lookup directly from the client.
- **AsyncStorage:** persisted authentication session and selected fridge ID. React hooks/local state hold screen data; there is no shared application state store.
- **Lucide, Fraunces, and Inter:** interface icons and fonts, with design tokens in [`lib/theme.ts`](fridge-app/lib/theme.ts).

### How data moves

1. [`app/_layout.tsx`](fridge-app/app/_layout.tsx) loads fonts without blocking rendering and sets the navigation theme. The home route gates inventory access on a session, fridge availability, and onboarding state.
2. [`lib/supabase.ts`](fridge-app/lib/supabase.ts) initializes the client with public configuration and persistent sessions. [`useActiveFridge`](fridge-app/lib/useActiveFridge.ts) loads accessible fridges and restores the stored selection, falling back to the first returned fridge.
3. [`screens/Fridge.tsx`](fridge-app/screens/Fridge.tsx) inserts and updates `inventory_items`. A load first calls `sweep_expired_items`, then reads active items sorted by expiry. Realtime inventory changes trigger another load and notification rescheduling.
4. Receipt images go to `parse-receipt`; item names go to `enrich-item`. Both functions call Gemini. Enrichment results are written back by the client; this is a background async task in the app, not a durable job queue.
5. [`screens/Stats.tsx`](fridge-app/screens/Stats.tsx) queries settled inventory directly, refetching on focus. It uses `settled_at`, falling back to `updated_at`, and treats both `wasted` and `expired` as waste. It no longer calls the `fridge_stats` RPC described in older notes.

### Database contract and household boundaries

Current client reads/writes require:

- `profiles`: the current user's `id` and `onboarded_at`; profile creation must be supplied by the backend.
- `fridges`: `id`, `name`, `created_by`, `created_at`, and `invite_code`.
- `fridge_members`: membership changes are subscribed to through Realtime.
- `inventory_items`: `id`, `fridge_id`, `name`, `quantity`, `unit`, `expiry_date`, `status`, `category`, `estimated_price`, `added_by`, `created_at`, `updated_at`, and `settled_at`.
- `shelf_life_adjustments`: backfill reads `category` and `offset_days` for a fridge.

The client calls `create_fridge(_name)`, `join_fridge(p_code)`, `rename_fridge(_fridge_id, _new_name)`, `regenerate_invite_code(p_fridge_id)`, `sweep_expired_items(_fridge_id)`, and `record_shelf_life_adjustment(_fridge_id, _category, _delta_days)`. A backend must also supply compatible defaults, relationships, and settlement behavior.

Fridges are the intended household boundary. Inventory queries filter by `fridge_id`, but fridge discovery queries do **not** filter by the current user: isolation depends on server-side row-level security (RLS). Project notes describe membership-based policies and RPC checks; their SQL is absent, so these checks cannot be confirmed from this repository. Hiding an owner control in the UI does not replace authorization on the server.

Local architecture/database notes contain stale details and are excluded from uploads because they include private household information. In particular, they describe a different join parameter, shorter invite codes, and different owner/adjustment columns. Use current source for the client contract; those notes do not supply an executable schema.

### Project structure

```text
.
├── README.md
└── fridge-app/
│   ├── app/                 # Router: tabs, category details, onboarding
│   ├── screens/             # Auth, inventory, scanners, settings, stats
│   ├── components/          # Category/item tiles, expiry picker, intro tip
│   ├── lib/                 # Supabase client, hooks, AI helpers, theme, dates
│   ├── assets/images/       # App logo
│   ├── supabase/
│   │   ├── config.toml      # Edge Function configuration only
│   │   └── functions/       # enrich-item and parse-receipt
│   ├── package.json
│   ├── package-lock.json
│   └── eas.json             # Cloud native build/submission profiles
```

## Getting started

### 1. Check prerequisites

- **Node.js and npm.** Locked React Native packages require Node **>=20.19.4**. No `.nvmrc`, `.node-version`, or root `engines` field pins a preferred runtime. TODO: confirm the maintained Node/npm versions.
- An Expo Go installation compatible with SDK 54, or a compatible development build, for mobile development. A physical device is needed to exercise the notification permission path in this app. Device and development machine need connectivity to Metro and the configured services.
- For native local builds: Android Studio/Android SDK and a compatible JDK for Android; macOS with Xcode for iOS. See the existing [Expo starter instructions](fridge-app/README.md) for Expo development options.
- Access to a **compatible Supabase development backend** with email/password Auth. Gemini access and deployed functions are required for receipt parsing and AI enrichment; manual inventory operations can work without AI if the database is available.

### 2. Confirm the backend before attempting a full run

There is no `supabase/migrations/`, schema SQL, seed script, or complete local Supabase service configuration in the checkout. `config.toml` defines only the two Edge Functions. Starting an empty Supabase project is insufficient.

Obtain an approved development backend with the database contract above, membership RLS, profile provisioning, and settlement behavior. Enable the required Realtime publication for `inventory_items`, `fridges`, and `fridge_members`; the client listens to these tables. For AI workflows, provision both functions and their server-side key before using the scanners.

**TODO: confirm and version the authoritative schema, policies, triggers, migrations, and safe seed data so a new developer can initialize an independent backend.** Until then, there is no reproducible database initialization command to give. Do not reset an existing database to try to resolve this gap.

### 3. Install application dependencies

From the repository root:

```sh
cd fridge-app
npm ci
```

Use the included npm lockfile. All subsequent commands below run from `fridge-app/` unless stated otherwise.

### 4. Supply public client configuration

Create your own untracked `fridge-app/.env` with values for your approved development project. No example environment file is provided. Do not overwrite someone else's existing configuration.

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_PROJECT_ANON_KEY
```

Only the project's public client key belongs here. See [Configuration](#configuration) for the server secret.

### 5. Start the app

```sh
npm start
```

Metro prints a QR code and connection address. Open it with the compatible Expo client, or use the terminal's emulator options. The app opens at the sign-in screen when no session is stored. This is a mobile client; there is no separate Node API server to start.

Optional browser entry:

```sh
npm run web
```

Use the local URL printed by Expo. A web script and static output configuration exist, but browser parity for camera, date picking, and notifications has not been established.

**Startup check:** the sign-in screen confirms that the bundle loads. Using synthetic data in a development backend, sign up/sign in, create a fridge named `Demo Kitchen`, and add `Milk`. Seeing the item after refresh confirms a basic Auth/database path. Category/expiry suggestions additionally require working enrichment. These checks are instructions for the developer; they were not executed for this README.

## Configuration

- **`EXPO_PUBLIC_SUPABASE_URL` — required, client-visible, no default.** Your project's Supabase URL from its connection/API settings. Format: `https://YOUR_PROJECT_REF.supabase.co`. Read in [`lib/supabase.ts`](fridge-app/lib/supabase.ts).
- **`EXPO_PUBLIC_SUPABASE_ANON_KEY` — required, client-visible, no default.** The same project's legacy public anon key from its API settings. Placeholder: `YOUR_PROJECT_ANON_KEY`. The exact variable name is required by this client. Never substitute a service-role or secret key.
- **`GEMINI_API_KEY` — required for AI only, server secret, no default.** Define it in the Edge Functions' server environment; obtain it from your Google AI project. Placeholder: `YOUR_SERVER_GEMINI_KEY`. Both functions return HTTP 500 when it is missing. Do not give it an `EXPO_PUBLIC_` prefix or include it in the mobile `.env`.

Expo public variables are bundled into the application, so they cannot protect secrets. The two Edge Functions are enabled with `verify_jwt = true` in [`supabase/config.toml`](fridge-app/supabase/config.toml).

The same client variable names apply to local development and release builds. `eas.json` supplies no environment values or test environment; release builders must supply the intended public backend settings separately. Use an isolated backend for development/testing. No dedicated test configuration is included.

## Usage

1. Sign up with a test email and password. If Supabase returns no session, the app asks you to verify your email before signing in.
2. Create `Demo Kitchen`, or enter a 10-character code shared by a household member. Join input is uppercased and whitespace is removed.
3. Follow the intro, then add `Milk`. In the main Fridge tab, optionally select a known expiry date before adding an item; background enrichment preserves a manually chosen date.
4. For a barcode, tap **Scan item**, grant camera permission, and scan an EAN/UPC or Code 128 barcode. Review the populated name and press add. An unknown product becomes `Item <barcode>` for manual correction.
5. For a receipt, tap **Scan receipt**, take a clear photo or choose one from the library, review/edit names, deselect unwanted rows, and confirm. Quantity and unit come from parsing; the review screen does not provide a quantity editor.
6. Tap an item's expiry to edit it. In category details, use the item menu to correct a misclassification. Mark food **Used** or **Toss**, then open **Stats** to inspect the recorded outcomes.

The Stats labels “This week” and “This month” represent the last 7 and 30 days, rather than calendar periods. Dollar totals sum available per-row `estimated_price` values without multiplying by quantity; missing prices contribute zero and are identified in the UI. Automatically expired items count as waste even without an explicit Toss action.

## Development and testing

Available commands from `fridge-app/`:

```sh
npm start          # Expo development server
npm run android    # Local native Android build/run
npm run ios        # Local native iOS build/run; requires macOS/Xcode
npm run web        # Browser development entry
npm run lint       # Expo ESLint configuration
npx tsc --noEmit   # Client type check using the installed TypeScript compiler
```

No automated test suite, `test` script, dedicated formatter script, CI workflow, or npm production-build script is included. Native cloud build profiles are described below. Deno function files are excluded from effective type checking by `@ts-nocheck`; a passing client typecheck would not validate them or database authorization.

For manual regression checks, use a separate backend and exercise sign-in, create/join, receipt review, expiry edits, Used/Toss, Stats range changes, and two accounts sharing inventory. Check unauthorized household access separately once the actual RLS definitions are available. Remote calls and writes are part of these checks; they are not offline tests.

**Do not use `npm run reset-project` as setup or troubleshooting.** It is a retained Expo starter utility that moves or deletes application directories and replaces routes with blank starter screens.

This README was verified by inspecting source, scripts, lockfile entries, configuration, and local link targets. Application startup, lint, builds, and typechecking were not run: `node --version` and `npm --version` failed because those executables were not available on the inspection shell's PATH.

## Deployment and operations

[`eas.json`](fridge-app/eas.json) defines internal `development` and `preview` builds and a `production` profile with automatic version increments. It requires EAS CLI >=20.1.0 and uses remote app versioning. [`app.json`](fridge-app/app.json) contains an EAS project association, app identity, native permission plugins, and static web output configuration.

An iOS build/submission is recorded in repository release notes; that does not establish current App Store publication or tester access. There is no public demo link documented here. Older TestFlight preparation notes contain outdated identity/profile advice; the current production profile already exists.

For an authorized release operator with Expo/EAS access and the necessary Apple signing/submission setup, the profile-based iOS flow is:

```sh
eas build --platform ios --profile production
eas submit --platform ios --profile production --latest
```

These are external build/submission operations, not local setup checks. Internal preview distribution is a separate profile. Configure the release's public Supabase variables, and confirm the target backend and server secret before building.

Existing backend deployment instructions name these commands, run from `fridge-app/` with an appropriately configured Supabase CLI/account:

```sh
supabase functions deploy parse-receipt
supabase functions deploy enrich-item
```

They deploy function code to an external project; they do not provision the missing database schema. There is no automated migration/deployment pipeline or checked-in web hosting infrastructure.

Inventory persists in Supabase, while local storage holds sessions and active selection. Expiry sweeping occurs on inventory loads, not through a checked-in scheduled worker. Logs are mainly client console warnings and returned function errors; there is no application health endpoint, documented backup/restore procedure, or monitoring setup. Realtime refetches and per-item enrichment updates can multiply requests during bulk scans. Function, database, and Gemini quotas/costs must be checked for the configured accounts; the repository establishes no guaranteed free operation.

## Security and data handling

- Email/password sessions persist in **AsyncStorage**, with token refresh enabled. There is no secure-keystore integration in the client code inspected.
- Server-side membership isolation depends on missing RLS/RPC definitions. Client filters and UI checks alone do not prove authorization. No complete security audit or tenant-isolation test suite is included.
- Both AI function configs require JWT verification, but their handlers contain **no explicit signed-in-user, household membership, or per-user rate-limit check**. Do not equate the configuration flag with verified user authorization.
- The Gemini key stays server-side, but function code currently puts it in an upstream URL query string and returns raw upstream/error details. Error/log redaction and key handling are documented release concerns.
- Receipt photos are sent as base64 to the Edge Function and then to Google Gemini; item names are also sent to Gemini, and barcode strings go to Open Food Facts. The receipt prompt asks for grocery data only, but the full image is still transmitted. No receipt upload to Supabase Storage is implemented in this path; external retention behavior is not defined in the repository.
- `fridge-app/.gitignore` excludes `.env`, local environment files, and several key/certificate formats. Keep credentials and real user data out of commits, examples, logs, and screenshots.

No password-reset route, in-app account deletion flow, security policy, or privacy policy is included. Invite codes grant household access and should be shared deliberately; regenerating a code invalidates the previous invitation according to the UI workflow, with enforcement delegated to the RPC.

## Troubleshooting

- **`node` or `npm` is not recognized:** install/provide the supported runtime and ensure its executable directory is on PATH; reopen the shell and check versions before installing dependencies.
- **Supabase initialization or network failure:** confirm both public variables are present and refer to the same reachable project. Restart Expo after changing configuration.
- **Create/join fails, inventory is empty, or onboarding returns on every launch:** confirm the actual backend contract, profile row/`onboarded_at` column, RPC parameter names, and membership policies. The included database notes are not a reliable schema installer.
- **Another household member's change does not appear:** check Realtime publication/subscription availability and connectivity. Joining from the initial Create/Join screen also depends on a Realtime event to refresh membership; a reload can distinguish a stale screen from a failed join.
- **Receipt parsing fails or suggestions never appear:** inspect function deployment and `GEMINI_API_KEY` configuration. Functions return 502 on failed/empty/non-JSON Gemini responses. Receipt errors surface in the UI; enrichment errors may only appear in the console. Retry with a clearer image, or use manual entry and category backfill after restoring the service.
- **Barcode produces a placeholder name:** the lookup was unavailable or Open Food Facts has no matching product; enter the name manually before adding.
- **No expiry reminder:** check device notification permission and that the two-days-before trigger is still in the future. This app skips permission requests on simulators. Repository notes also describe Expo Go notification warnings; use a compatible native build to assess device behavior.
- **Email links point to localhost or password recovery cannot complete:** older notes report an incorrect Supabase Site URL. Backend redirect configuration needs review, and this checkout has no reset-password route; correcting a URL alone does not supply that workflow.

## Limitations and next steps

Known implementation limits:

- Backend schema, policies, triggers, seed data, and bootstrap commands are missing.
- AI enrichment has no durable retry queue and can leave incomplete rows. Receipt output is largely prompt-constrained rather than comprehensively validated; enrichment accepts at most 60 names per call.
- Household shelf-life learning is partial: list-view expiry edits call the adjustment RPC, but category-detail edits do not. Offsets are applied by the backfill helper, while ordinary manual/receipt additions use model shelf life directly. The adjustment algorithm is not available as SQL.
- “All time” Stats is limited to the fetched 500 settled rows. Estimates are not actual purchase values or quantity-adjusted costs.
- Inventory has no offline write queue. Local notification rescheduling cancels all scheduled notifications and rebuilds them from the currently loaded inventory; overlapping reloads and multiple fridges need further verification.
- Password recovery, account deletion, explicit Edge Function user authorization, and automated tests are absent. Web feature parity is unverified.
- The main navigation is light themed, but native appearance remains `automatic`; Android configuration still includes an unused microphone permission and a placeholder package identity.

Local engineering notes track backend recovery, release configuration/security work, and reducing repeated queries and notification rescheduling. Those private notes are excluded from uploads, and some entries are stale. Remote push and category-correction learning are documented future ideas, not available features.

Unresolved documentation requirements:

- **TODO: confirm** the maintained Node/npm versions and a repeatable backend initialization path.
- **TODO: confirm** live RPC signatures, RLS/trigger definitions, authorization behavior, and release environment configuration.
- **TODO: confirm** current release/TestFlight availability and the privacy, account-deletion, and backup/restore procedures.

## Contributing, credits, and license

No standalone contribution guide is included. Existing project guidance asks for small changes, [`lib/theme.ts`](fridge-app/lib/theme.ts) tokens, Lucide icons, light-mode v1 UI, explicit ternaries for conditional React Native JSX, and `npx expo install <package>` for SDK-compatible additions. Private assistant instructions are excluded from uploads. The active source still has some legacy deviations from those rules.

Run lint and client typechecking when tooling is available, review the diff, and describe relevant manual checks and known gaps. Do not commit credentials or test against shared household data without authorization. The project notes describe local Git usage; no hosted contribution/PR destination is established here.

The app began with `create-expo-app` and retains Expo starter files. It uses Open Food Facts product lookup, Lucide icons, and the Fraunces/Inter font packages; their upstream data/asset terms apply separately. An app logo exists in `assets/images/`, but its authorship/license is not documented. Existing screenshots show earlier UI and household data and are not presented as a current demo.

**No project license file is present.** Dependency license entries do not assign a license to this project's code or assets. TODO: confirm the intended project license and any required logo/asset attribution before redistribution.
