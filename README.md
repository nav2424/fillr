# Fillr

**Know what's filling your food.**

Fillr is a premium, AI-assisted food scanner app that helps users understand packaged products: barcode lookup, ingredient context, allergen and sensitivity callouts, and personalized insights.

**Important:** Fillr is an **informational tool, not a medical device**. Users must always read the physical label and consult qualified professionals for medical or dietary decisions. In-app copy reinforces this on onboarding, scan, home, product results, and profile.

## Features

- **Barcode scanning** – Camera or manual entry for retail barcodes
- **Allergen & sensitivity detection** – Profile-driven flags (e.g. milk, wheat, peanuts, celiac mode)
- **Ingredient breakdown** – Plain-language cards; rules plus AI via a secure backend path
- **Personalized profiles** – Allergies, sensitivities, preferences, goals (synced with Supabase when signed in)
- **Safety summaries** – SAFE, CAUTION, NOT SAFE, and label-review states
- **Scan history & saved products**
- **Subscriptions** – RevenueCat (see env vars below)

## Tech Stack

- React Native + Expo (SDK 55)
- TypeScript, Expo Router
- Zustand (client state)
- TanStack Query (data fetching)
- **Supabase** – Auth, user profiles, acknowledgments, Edge Functions
- **Open Food Facts** – Product data when available; mock fallbacks for some barcodes
- **Ingredient analysis** – OpenAI (or configured model) invoked from **Supabase Edge Functions**; API key kept server-side (`OPENAI_API_KEY` secret), not in `EXPO_PUBLIC_*`

## Getting Started

```bash
cd allergy-scanner
npm install
npx expo start
```

Use Expo Go or a dev client; press `i` / `a` for simulators.

### Environment variables

Copy `.env.example` to `.env` and set:

- `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_REVENUECAT_IOS_KEY` (and Android key when shipping Android)
- Optional: `EXPO_PUBLIC_TERMS_URL`, `EXPO_PUBLIC_PRIVACY_URL`, `EXPO_PUBLIC_IOS_APP_STORE_URL`
- **Do not** put `OPENAI_API_KEY` in public env vars; set it as a Supabase secret for the ingredient-analysis function.

EAS Build injects secrets from the Expo dashboard / `eas secret` as needed.

### Mock / fallback barcodes

When Open Food Facts has no match, the app may use local mock products for specific barcodes (see `services/mockProducts.ts`).

## Project Structure

```
app/              # Expo Router screens (tabs, onboarding, product, auth)
components/       # UI (FillrButton, IngredientCard, SafetyBanner, …)
constants/        # Theme, legal URLs, health disclaimer copy
lib/              # Allergen engine, adapters, Supabase, personalization
services/         # Product pipeline, mock data, paywall/RevenueCat
store/            # Zustand stores
supabase/         # SQL schema (and Edge Function sources if present)
types/            # TypeScript types
```

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com)
2. Run `supabase/schema.sql` in the SQL Editor
3. Deploy the **ingredient-analysis** (or equivalent) Edge Function and set `OPENAI_API_KEY` via `supabase secrets set`
4. Point the app at your project with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`

## Auth

Email sign-up, login, password reset, and session persistence use **Supabase Auth** with a React Native storage adapter (`lib/storage.ts` + `lib/supabase.ts`). New users complete onboarding and an in-app **disclaimer** acknowledgment (also recorded server-side when possible).

## Tests

```bash
npm test
```

Runs ingredient matcher and celiac matcher tests (uses `tsx` for TypeScript suites).

## Roadmap / ideas

- OCR for full-label capture
- Family or shared profiles
- Push notifications
- Broader automated E2E tests
