# Parisian Laundry (المصبغة الباريسية)

Premium, API-first ordering platform for Parisian Laundry — a customer ordering app plus an admin/driver operations dashboard. Built with Next.js (App Router), Tailwind CSS v4, and Supabase (Postgres, Auth, Storage, Row Level Security). Fully trilingual: Arabic (RTL), English, French.

## Feature summary

**Customer app** — sign in with Google, email/password, or phone/OTP (all three on one login page, each fully independent — see Auth below), multiple saved addresses, a 5-category luxury service menu (Clothes, Upholstery, Shoes, Bags, Haute Couture), per-item customization (fold/hanger, starch level, stain notes), a native-feel per-item photo upload (one slot per physical item, camera capture), live dynamic pricing (Normal/Express/Urgent), manual Whish Money (transfer + screenshot + transaction ID, staff-verified) or Cash on Delivery, and a WhatsApp fallback. A dashboard order list plus a per-order detail page let a customer track every order (including past/completed ones) and adjust an item's fold/starch/notes right up until pickup — locked automatically once the order is picked up.

**Admin dashboard** — an order queue with status/branch filters and search, a full order detail view (customer, address, items, payments — including reviewing/confirming manual Whish proof screenshots, status history), one-click order status advancement, driver assignment (pickup + dropoff, any branch), per-item status control, printable QR/barcode tag sheets, a **Catalog** page (any staff) to add/edit categories and services with per-service trilingual names and prices, and a **Users** page (admin/super_admin only) to create staff/driver/admin accounts directly, change roles/branch/active status, and reset anyone's password — no SQL needed for day-to-day team or catalog management. `super_admin` additionally gets a **Customers** tab on the Users page to see and manage every customer account (incl. Google/email sign-ups), including password resets for "I forgot my password" requests — plain `admin` and `staff` never see the customer list.

**Anti-loss (QR/barcode) system** — every physical item gets a unique barcode at order creation (`PLI-########`). `/admin/tags/[orderId]` renders a printable QR label per item. `/admin/scan` looks an item up by barcode — via a physical USB/Bluetooth scanner (acts as a keyboard, just scan into the input), by typing the code, or with the device camera (native `BarcodeDetector` API where supported) — and shows the customer's pre-upload photos plus lets staff move the item's status forward or flag it lost/damaged, with an optional staff-taken photo attached.

**Driver view** — a mobile-friendly task list (pickup/dropoff), one-click status updates (assigned → en route → completed/failed), tap-to-navigate (Google Maps), tap-to-call, and a WhatsApp shortcut. Completing a task automatically advances the parent order's status.

**Auth** — `/login` shows all three sign-in methods (Google, email/password, phone/OTP) at once, each with fully isolated loading/error state — a phone OTP send failing (e.g. no SMS provider configured yet) can never disable or block the Google or email/password sections on the same page, and vice versa. All three land the user on the same role-based redirect (`app/[locale]/page.tsx`). See **Setup → 3** below for the one-time Supabase configuration each method needs.

## Tech stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript 5 · Tailwind CSS v4 · next-intl (i18n/RTL) · Supabase (`@supabase/ssr`, `@supabase/supabase-js`) · `qrcode` (QR label generation).

## Architecture

Headless/API-first: reads go straight from client/server components to Supabase, gated entirely by Postgres Row Level Security (RLS) — there is no app-level authorization layer to keep in sync. Privileged or multi-step business logic (order creation with server-authoritative pricing, payments, staff status transitions, driver-task-triggered order sync) goes through Next.js Route Handlers under `app/api/`, so the same backend is ready to serve a future React Native/Flutter app without any changes.

## Project structure

```
app/[locale]/(customer)/...   customer ordering flow (dashboard, order wizard, checkout)
app/[locale]/(admin)/...      admin dashboard (orders, scan, tags)
app/[locale]/(driver)/...     driver task list
app/[locale]/(auth)/...       login (Google/email/phone) + OTP verify
app/auth/callback/            OAuth + email-confirmation redirect target (outside [locale] on purpose)
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
2. `supabase/02_seed_catalog.sql` — the 5 service categories and 16 starter services (trilingual), just a starting point. Manage categories/services (add, rename, reprice, deactivate) from **Admin → Catalog** in the app from now on — no SQL or table editor needed.

**Modeling "iron only" vs "wash & iron" for the same item**: there's no separate service-type field — each variant is its own catalog entry with its own price (e.g. "Shirt — Iron only" and "Shirt — Wash & Iron" as two rows under Clothes). Add both from Admin → Catalog; the customer picks whichever one matches what they need, per item.

`supabase/03_promote_roles.example.sql` is a **reference**, not a migration — read it when you need to turn a signed-up customer into staff/admin/driver (see step 5).

3. `supabase/04_manual_whish_and_item_edits.sql` — adds the `payments.proof_photo_url` column and the RLS policies for manual Whish proof-of-payment (customer submits) and the wider pre-pickup item-edit window (customer can adjust fold/starch/notes any time before pickup, not just while `pending_confirmation`). **Required** for the Whish proof-upload flow and the customer order-edit feature to work — run it once against your existing project.

### 3. Configure sign-in methods

All three appear on `/login` regardless of what's configured — each is independent, so enable them in any order (or leave phone unconfigured indefinitely; the UI note in `.env.local.example` explains why that's safe).

- **Google** — Supabase Dashboard → Authentication → Providers → Google → add your Google Cloud OAuth Client ID + Secret (create these in [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → OAuth client ID → Web application).
- **Email/password** — enabled by default (Authentication → Providers → Email). If "Confirm email" is on there, new sign-ups get a confirmation link before they can sign in.
- **Phone/OTP** — Authentication → Providers → Phone → enable it, and connect an SMS provider (Twilio, Vonage, or MessageBird — Supabase needs one to actually send codes).
- **Redirect URL (required for Google + email confirmation)** — Authentication → URL Configuration → Redirect URLs → add `http://localhost:3000/auth/callback` for local dev and `https://<your-vercel-domain>/auth/callback` once deployed. Without this, Google sign-in and the confirmation-email link will both fail to complete.

### 4. Configure environment variables

```
cp .env.local.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from Supabase Dashboard → Project Settings → API, and `SUPABASE_SERVICE_ROLE_KEY` from the same page (**server-only** — never expose this to the browser; it's used by `lib/supabase/admin.ts` for the small set of privileged writes documented there).

Whish is run **manually** by design (no live merchant API integration) — set `NEXT_PUBLIC_WHISH_NUMBER` to the real Whish number customers should transfer to; it defaults to `+9613703442` if unset. The `WHISH_*` (`WHISH_API_BASE_URL`/`WHISH_CHANNEL`/`WHISH_SECRET`/`WHISH_API_KEY`) variables and `lib/whish.ts` are leftover scaffolding for a future automated integration — they're unused by the current manual flow and can stay unset.

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

Reload — you'll land on `/admin/dashboard`. This one SQL promotion is a one-time bootstrap step (there has to be a first admin). From then on, that admin creates every other staff/driver/admin account from `/admin/users` in the UI — no more SQL needed.

### 6. Deploy to Vercel

Push this repo to GitHub, import it in Vercel, and set the same environment variables from `.env.local` in Vercel's Project Settings → Environment Variables (all of them — `NEXT_PUBLIC_*` as well as `SUPABASE_SERVICE_ROLE_KEY`). Vercel auto-detects Next.js; no build config changes are needed.

## Known limitations (by design, documented rather than silently glossed over)

- **Orphaned empty orders**: if the `order_items` bulk-insert in `POST /api/orders` fails after the parent `orders` row was already created, the customer is left with an empty `pending_confirmation` order. Not auto-cleaned yet — a good candidate for a scheduled cleanup job or converting order creation into a single Postgres function for atomicity.
- **Whish Money is manual by design** (transfer + screenshot + transaction ID, staff confirms in Admin → order → Payments) — there is no live Whish merchant API integration. `lib/whish.ts` / `WHISH_*` env vars are unused scaffolding kept for a possible future automated integration.
- **Customer order-item edits are staff-visible immediately** (direct RLS-gated write, no approval queue) but limited to fold/starch/notes — service, quantity, address and schedule can't be changed by the customer after submission; contact them (or have them message you) if those need to change.
- **Camera barcode scanning** (`/admin/scan`) uses the native `BarcodeDetector` Web API, currently supported on Chromium-based browsers (Chrome/Edge, most Android devices). Where it's unavailable, the same screen still works fully via a physical USB/Bluetooth barcode scanner or manual entry — no functionality is lost, only the camera shortcut.
- **`profiles.phone` for Google/email accounts**: the auto-provisioning trigger (`handle_new_auth_user()` in `01_schema.sql`) falls back to the email address when a sign-up has no phone number, so a customer who joined via Google or email/password won't have a real phone on file. The admin/driver UI already accounts for this — call/WhatsApp buttons only render when the value actually looks like a phone number (`lib/format.ts#isPhoneLike`) — but if collecting a real phone from these customers matters operationally, add a "confirm your phone" prompt to the customer dashboard, or a `profiles.email` column + an updated trigger, as a follow-up.
- **Order list pagination**: `/admin/orders` currently shows the latest 50 matching orders; add real pagination if/when order volume regularly exceeds that.
- **New accounts created from `/admin/users`** go through Supabase's Admin API with `email_confirm: true`, so they're usable immediately with no confirmation email — but they inherit the same `profiles.phone` quirk above if no phone is given at creation (email stored there instead).
