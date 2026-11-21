-- Allow Monarch (GPS Insight) public map links as well as Samsara share links.
-- The column keeps its old name, samsara_url, but now holds either kind of link.
-- Paste this into Supabase > SQL Editor and click Run.

alter table public.loads drop constraint loads_samsara_url_check;

alter table public.loads add constraint loads_tracking_url_check check (
  samsara_url ~ '^https://cloud(\.[a-z0-9-]+)?\.samsara\.com/o/[0-9]+/fleet/viewer/[A-Za-z0-9_-]+$'
  or samsara_url ~ '^https://portal\.(monarchtracking|gpsinsight)\.com/d/publicmap\.php\?key=[A-Za-z0-9]+$'
);
