@AGENTS.md

# Load Tracking

- Read README.md first.
- Next.js 16 with `cacheComponents: true`: read the bundled docs in `node_modules/next/dist/docs/` before using an API. Uncached data or runtime APIs (cookies, headers, params) need a `<Suspense>` boundary.
- Customer pages must never receive the Samsara link, carrier name or driver name: everything goes through `toPublic()` in `src/lib/tracking.ts`.
- Samsara is read only by opening the share page in a hidden browser (`src/lib/samsara.ts`). Don't call Samsara's internal endpoints directly or get around its protections.
- Database changes go in a new file under `supabase/migrations/`. Every table has Row Level Security.
- Never ask Isaac to paste keys into chat. Phone-first: check every screen at 375px wide.
- Windows PowerShell 5: write files as UTF-8 without a byte-order mark.
