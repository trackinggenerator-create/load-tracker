# Load Tracking

Customer tracking links for brokered loads. Paste a carrier's Samsara share link, add the load # and
trailer #, and get your own tracking link to send the customer. The page shows your company name, a map
and the truck's latest location. The carrier and driver names are never shown or stored.

## How it works

- **Broker dashboard** (`/loads`): add loads, copy customer links, refresh, mark delivered, delete.
- **Customer page** (`/t/<code>`): branded map, moving or stopped, and location (no speed). It reads
  Samsara again a random 5 to 10 minutes after the last read, and only while someone has the page open.
  The broker's Refresh button reads it right away.
- **Hidden browser** (`src/lib/samsara.ts`): opens the Samsara link the way a customer would and reads
  the location the page loads. On this PC it uses Edge; on Vercel it uses `@sparticuz/chromium`.
- **Delivered or expired loads** (14 days after they're added) stop showing a location.

## First-time setup

1. **Supabase**: create a free project at supabase.com. Open **SQL Editor**, paste all of
   `supabase/migrations/0001_loads.sql` and click **Run**.
2. **Keys**: copy `.env.example` to `.env.local` and fill in the three Supabase values from
   **Project Settings > API Keys**. Keep them in that file only.
3. **Email links**: in Supabase, open **Authentication > URL Configuration** and add
   `http://localhost:3001/auth/callback` (and later your live address + `/auth/callback`) to Redirect URLs.
4. **Run it**: `npm run dev -- -p 3001`, then open http://localhost:3001 and create your account.

To see the customer page for any Samsara link without saving anything (only on this PC):
`http://localhost:3001/dev/preview?link=<samsara link>`

## Going live (Vercel)

Import the repo in Vercel and add the same settings from `.env.local` under **Settings > Environment
Variables**. Hobby (free) is enough for light use.

## Rules for this project

- Database changes go in a new file under `supabase/migrations/`. Every table has Row Level Security.
- Customer-facing data goes through `toPublic()` in `src/lib/tracking.ts`. Never send the Samsara link,
  carrier name or driver name to the browser.
- Brand colors live only in `src/app/globals.css`. Check every screen at 375px wide.
