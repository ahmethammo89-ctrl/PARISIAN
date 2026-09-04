# Parisian Laundry (المصبغة الباريسية)

Premium, API-first ordering platform for Parisian Laundry — a customer ordering app plus an admin/driver operations dashboard. Built with Next.js (App Router), Tailwind CSS v4, and Supabase (Postgres, Auth, Storage, Row Level Security). Fully trilingual: Arabic (RTL), English, French.

## Feature summary

**Customer app** — phone/OTP login, multiple saved addresses, a 5-category luxury service menu (Clothes, Upholstery, Shoes, Bags, Haute Couture), per-item customization (fold/hanger, starch level, stain notes), a native-feel per-item photo upload (one slot per physical item, camera capture), live dynamic pricing (Normal/Express/Urgent), Whish Money + Cash on Delivery checkout, and a WhatsApp fallback.

**Admin dashboard** — an order queue with status/branch filters and search, a full order detail view (customer, address, items, payments, status history), one-click order status advancement, driver assignment (pickup + dropoff, any branch), per-item status control, and printable QR/barcode tag sheets.

**Anti-loss (QR/barcode) system** — every physical item gets a unique barcode at order creation (`PLI-########`). `/admin/tags/[orderId]` renders a printable QR label per item. `/admin/scan` looks an item up by barcode — via a physical USB/Bluetooth scanner (acts as a keyboard, just scan into the input), by typing the code, or with the device camera (native `BarcodeDetector` API where supported) — and shows the customer's pre-upload photos plus lets staff move the item's status forward or flag it lost/damaged, with an optional staff-taken photo attached.

**Driver view** — a mobile-friendly task list (pickup/dropoff), one-click status updates (assigned → en route → completed/failed), tap-to-navigate (Google Maps), tap-to-call, and a WhatsApp shortcut. Completing a task automatically advances the parent order's status.

## Tech stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript 5 · Tailwind CSS v4 · next-intl (i18n/RTL) · Supabase (`@supabase/ssr`, `@supabase/supabase-js`) · `qrcode` (QR label generation).

## Architecture

Headless/API-first: reads go straight from client/server components to Supabase, gated entirely by Postgres Row Level Security (RLS) — there is no app-level authorization layer to keep in sync. Privileged or multi-step business logic (order creation with server-authoritative pricing, payments, staff status transitions, driver-task-triggered order sync) goes through Next.js Route Handlers under `app/api/`, so the same backend is ready to serve a future React Native/Flutter app without any changes.

## Project structure

```
app/[locale]/(customer)/...   customer ordering flow (dashboard, order wizard, checkout)
app/[locale]/(admin)/...      admin dashboard (orders, scan, tags)
app/[locale]/(driver)/...     driver task list
app/[locale]/(auth)/...       phone/OTP login + verify
app/api/...                   Route Handlers (orders, payments, admin, driver)
lib/                          pricing, Whish adapter, Supabase clients, order status flow
supabase/                     SQL migrations — run these against your Supabase project
messages/{ar,en,fr}.json      all UI copy, per locale
types/database.ts             hand-written types mirroring supabase/01_schema.sql
```

## Setup

### 1. Create a Supabase project

At [supabase.com](https://supabase.com), create a new project (any region close to Lebanon, e.g. `eu-central-1`, works well).

### 2. Run the SQL migrations

In the Supabase SQL editor, run these **in order**:

1. `supabase/01_schema.sql` — full schema: tables, enums, RLS policies, the `item-photos` storage bucket and its policies, and the two known branches (Sakiet Al-Janzir, Clemenceau).
2. `supabase/02_seed_catalog.sql` — the 5 service categories and 16 starter services (trilingual). Edit prices/names directly in the Supabase table editor afterwards as needed — this file only seeds a starting catalog.

`supabase/03_promote_roles.example.sql` is a **reference**, not a migration — read it when you need to turn a signed-up customer into staff/admin/driver (see step 5).

### 3. Enable phone/OTP auth

Supabase Dashboard → Authentication → Providers → Phone → enable it, and connect an SMS provider (Twilio, Vonage, or MessageBird — Supabase needs one to actually send OTP codes).

### 4. Configure environment variables

```
cp .env.local.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from Supabase Dashboard → Project Settings → API, and `SUPABASE_SERVICE_ROLE_KEY` from the same page (**server-only** — never expose this to the browser; it's used by `lib/supabase/admin.ts` for the small set of privileged writes documented there).

Leave the `WHISH_*` variables unset until you have live Whish Money merchant credentials — the app runs a clearly-labeled mock checkout automatically when they're absent, so the full order → pay flow is testable end to end without them. **The exact request/response shape in `lib/whish.ts` has not been verified against Whish's live API docs — confirm it against your merchant dashboard before setting these and going live.**

`NEXT_PUBLIC_WHATSAPP_NUMBER` defaults to `9613703442` (the business card's first branch line, in `wa.me` format) if left unset.

### 5. Install, run, and create your first staff account

```
npm install
npm run dev
```

Sign up once through the app with your own phone number (as a normal customer), then in the Supabase SQL editor run (see `supabase/03_promote_roles.example.sql` for the full reference):

```sql
update profiles set role = 'admin' where phone = '+<your-e164-phone>';
```

Reload — you'll land on `/admin/dashboard`. Repeat with `role = 'driver'` for driver test accounts.

### 6. Deploy to Vercel

Push this repo to GitHub, import it in Vercel, and set the same environment variables from `.env.local` in Vercel's Project Settings → Environment Variables (all of them — `NEXT_PUBLIC_*` as well as `SUPABASE_SERVICE_ROLE_KEY`). Vercel auto-detects Next.js; no build config changes are needed.

## Known limitations (by design, documented rather than silently glossed over)

- **Orphaned empty orders**: if the `order_items` bulk-insert in `POST /api/orders` fails after the parent `orders` row was already created, the customer is left with an empty `pending_confirmation` order. Not auto-cleaned yet — a good candidate for a scheduled cleanup job or converting order creation into a single Postgres function for atomicity.
- **Whish Money integration runs in mock mode** until real merchant credentials are set (see step 4 above) — the request/response contract in `lib/whish.ts` is unverified against Whish's actual API.
- **Camera barcode scanning** (`/admin/scan`) uses the native `BarcodeDetector` Web API, currently supported on Chromium-based browsers (Chrome/Edge, most Android devices). Where it's unavailable, the same screen still works fully via a physical USB/Bluetooth barcode scanner or manual entry — no functionality is lost, only the camera shortcut.
- **Order list pagination**: `/admin/orders` currently shows the latest 50 matching orders; add real pagination if/when order volume regularly exceeds that.
