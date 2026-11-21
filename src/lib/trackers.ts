import "server-only";
import { existsSync } from "node:fs";
import puppeteer, { type Browser, type Page } from "puppeteer-core";

/**
 * Carrier tracking links we can read. Each is opened in a hidden browser, the same way a customer
 * would open it, and we keep only the location data the page itself loads.
 *
 * Samsara: https://cloud.samsara.com/o/18208/fleet/viewer/xcwq0Zs2G6nD6GTydxWw
 * Monarch (GPS Insight): https://portal.monarchtracking.com/d/publicmap.php?key=gpsi6a9853efba218
 */
const SAMSARA = /^https:\/\/cloud(\.[a-z0-9-]+)?\.samsara\.com\/o\/[0-9]+\/fleet\/viewer\/[A-Za-z0-9_-]+$/;
const MONARCH = /^https:\/\/portal\.(monarchtracking|gpsinsight)\.com\/d\/publicmap\.php\?key=[A-Za-z0-9]+$/;

export type TrackerKind = "samsara" | "monarch";

export function trackerKind(link: string): TrackerKind | null {
  if (SAMSARA.test(link)) return "samsara";
  if (MONARCH.test(link)) return "monarch";
  return null;
}

/** Cleans up a pasted link (spaces, trailing slash, extra ?query) and returns it if we can read it. */
export function normalizeTrackingLink(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  const host = url.host.toLowerCase();
  const path = url.pathname.replace(/\/+$/, "");
  const key = url.searchParams.get("key");
  const clean = key && /publicmap\.php$/.test(path) ? `${url.protocol}//${host}${path}?key=${key}` : `${url.protocol}//${host}${path}`;
  return trackerKind(clean) ? clean : null;
}

export type TrackingReading = {
  lat: number;
  lng: number;
  heading: number | null;
  speedMph: number | null;
  address: string | null;
  positionAt: string;
  destination: { name: string | null; address: string | null; lat: number | null; lng: number | null } | null;
};

/** A problem the broker should see, written for them (expired link, truck not reporting…). */
export class TrackingLinkError extends Error {}

/** The installed browsers on this PC, in the order we try them. */
const LOCAL_BROWSERS = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
];

async function launchBrowser(): Promise<Browser> {
  if (process.env.VERCEL) {
    // On Vercel: a slim Chromium build made for serverless functions.
    const chromium = (await import("@sparticuz/chromium")).default;
    return puppeteer.launch({
      args: await puppeteer.defaultArgs({ args: chromium.args, headless: "shell" }),
      executablePath: await chromium.executablePath(),
      headless: "shell",
    });
  }
  // On this PC: Chrome (or Edge) that's already installed.
  const executablePath = LOCAL_BROWSERS.find((p) => p && existsSync(p));
  if (!executablePath) throw new Error("No Chrome or Edge found. Set CHROME_PATH in .env.local.");
  return puppeteer.launch({ executablePath, headless: true });
}

/** Opens the page and waits for the first response whose address contains `match`. */
async function captureResponse(page: Page, link: string, match: string, label: string): Promise<string> {
  // Skip pictures, map tiles and fonts: they aren't needed and make the page slower.
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const type = req.resourceType();
    if (type === "image" || type === "font" || type === "media") req.abort().catch(() => {});
    else req.continue().catch(() => {});
  });
  const body = new Promise<string>((resolve) => {
    page.on("response", async (res) => {
      if (!res.url().includes(match)) return;
      try {
        resolve(await res.text());
      } catch {
        // Not readable; wait for the next one.
      }
    });
  });
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new TrackingLinkError(`${label} didn't answer in time. Try again in a minute.`)), 40_000),
  );
  await page.goto(link, { waitUntil: "domcontentloaded", timeout: 40_000 });
  return Promise.race([body, timeout]);
}

type SamsaraResponse = {
  data?: {
    fleetViewerToken?: {
      destinationName?: string;
      destinationAddress?: string;
      destinationLatitude?: number;
      destinationLongitude?: number;
      devices?: {
        location?: { time: number; latitude: number; longitude: number; heading?: number; speed?: number; formatted?: string }[];
      }[];
    } | null;
  };
};

/** Samsara: keeps position, speed, heading, address and destination; drops carrier and driver names. */
async function readSamsara(page: Page, link: string): Promise<TrackingReading> {
  const json = JSON.parse(await captureResponse(page, link, "/r/graphql?q=FleetViewer", "Samsara")) as SamsaraResponse;
  const token = json.data?.fleetViewerToken;
  if (!token) throw new TrackingLinkError("This Samsara link has expired or was turned off by the carrier.");

  const points = (token.devices ?? []).flatMap((d) => d.location ?? []);
  const latest = points.sort((a, b) => b.time - a.time)[0];
  if (!latest) throw new TrackingLinkError("The truck isn't sending its location right now.");

  const hasDest = Boolean(token.destinationAddress || token.destinationName || token.destinationLatitude);
  return {
    lat: latest.latitude,
    lng: latest.longitude,
    heading: typeof latest.heading === "number" ? Math.round(latest.heading) : null,
    speedMph: typeof latest.speed === "number" ? Math.round(latest.speed) : null,
    address: latest.formatted?.trim() || null,
    positionAt: new Date(latest.time).toISOString(),
    destination: hasDest
      ? {
          name: token.destinationName?.trim() || null,
          address: token.destinationAddress?.trim() || null,
          lat: token.destinationLatitude || null,
          lng: token.destinationLongitude || null,
        }
      : null,
  };
}

type MonarchResponse = {
  head?: { status?: string };
  data?: { lat?: number; lon?: number; heading?: number; address?: string; speed?: string; description?: string }[];
};

const MONTHS: Record<string, number> = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };

/** "Nov 20, 2026 19:08:01" as a clock reading (year, month, day, hour, minute, second) packed in a UTC number. */
function clockTime(text: string | undefined): number | null {
  const m = text?.match(/([A-Z][a-z]{2}) (\d{1,2}), (\d{4}) (\d{1,2}):(\d{2}):(\d{2})/);
  if (!m || MONTHS[m[1]] === undefined) return null;
  return Date.UTC(+m[3], MONTHS[m[1]], +m[2], +m[4], +m[5], +m[6]);
}

/** Each state's main time zone (a few states are split; the edges can be an hour off). */
const STATE_ZONES: Record<string, string> = {
  CT: "America/New_York", DE: "America/New_York", DC: "America/New_York", FL: "America/New_York", GA: "America/New_York",
  IN: "America/New_York", KY: "America/New_York", ME: "America/New_York", MD: "America/New_York", MA: "America/New_York",
  MI: "America/New_York", NH: "America/New_York", NJ: "America/New_York", NY: "America/New_York", NC: "America/New_York",
  OH: "America/New_York", PA: "America/New_York", RI: "America/New_York", SC: "America/New_York", VT: "America/New_York",
  VA: "America/New_York", WV: "America/New_York",
  AL: "America/Chicago", AR: "America/Chicago", IL: "America/Chicago", IA: "America/Chicago", KS: "America/Chicago",
  LA: "America/Chicago", MN: "America/Chicago", MS: "America/Chicago", MO: "America/Chicago", NE: "America/Chicago",
  ND: "America/Chicago", OK: "America/Chicago", SD: "America/Chicago", TN: "America/Chicago", TX: "America/Chicago",
  WI: "America/Chicago",
  AZ: "America/Phoenix", CO: "America/Denver", ID: "America/Boise", MT: "America/Denver", NM: "America/Denver",
  UT: "America/Denver", WY: "America/Denver",
  CA: "America/Los_Angeles", NV: "America/Los_Angeles", OR: "America/Los_Angeles", WA: "America/Los_Angeles",
  AK: "America/Anchorage", HI: "Pacific/Honolulu",
};

/** The truck's local time zone: from the state in its address, or roughly from its longitude. */
function truckZone(address: string | undefined, lng: number): string {
  const state = address?.match(/,\s*([A-Z]{2})\s+\d{5}(?:-\d{4})?\s*$/)?.[1];
  if (state && STATE_ZONES[state]) return STATE_ZONES[state];
  if (lng > -87.5) return "America/New_York";
  if (lng > -101.5) return "America/Chicago";
  if (lng > -114.5) return "America/Denver";
  return "America/Los_Angeles";
}

/** How far ahead of UTC a time zone is at a given moment (negative for the US), in milliseconds. */
function zoneOffset(zone: string, at: number): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: zone, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" })
      .formatToParts(new Date(at))
      .map((p) => [p.type, Number(p.value)]),
  );
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - Math.floor(at / 1000) * 1000;
}

/** A clock reading in a time zone → the real moment it happened (handles daylight saving). */
function zonedToUtc(clock: number, zone: string): number {
  const first = clock - zoneOffset(zone, clock);
  return clock - zoneOffset(zone, first);
}

/**
 * Monarch: keeps position, heading, address and speed. The truck number, driver name, VIN and the
 * rest of the vehicle details are dropped here. The "Recorded" time is the truck's local clock time
 * (the page's "Current" time uses another zone, so the two can't simply be subtracted), so we read it
 * in the time zone of the truck's location.
 */
async function readMonarch(page: Page, link: string): Promise<TrackingReading> {
  const raw = await captureResponse(page, link, "/vehiclegroup/locationpublic", "Monarch");
  // The data comes wrapped as callback({...}).
  const json = JSON.parse(raw.slice(raw.indexOf("(") + 1, raw.lastIndexOf(")"))) as MonarchResponse;
  if (json.head?.status && json.head.status !== "OK") throw new TrackingLinkError("This Monarch link has expired or was turned off by the carrier.");
  const trucks = (json.data ?? []).filter((v) => typeof v.lat === "number" && typeof v.lon === "number");
  if (trucks.length === 0) throw new TrackingLinkError("The truck isn't sending its location right now, or this Monarch link was turned off.");
  if (trucks.length > 1) throw new TrackingLinkError(`This Monarch link shows ${trucks.length} trucks. Ask the carrier for a link to just your truck.`);
  const v = trucks[0];

  const details = (v.description ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const recorded = clockTime(details.match(/Recorded:\s*([^|]+?\d{2}:\d{2}:\d{2})/)?.[1]);
  const at = recorded != null ? zonedToUtc(recorded, truckZone(v.address, v.lon as number)) : Date.now();
  // Never in the future (clock differences of a few seconds).
  const ageMs = Math.max(0, Date.now() - at);

  const mph = v.speed?.match(/(\d+(?:\.\d+)?)\s*mph/i);
  return {
    lat: v.lat as number,
    lng: v.lon as number,
    heading: typeof v.heading === "number" ? Math.round(v.heading) : null,
    speedMph: mph ? Math.round(Number(mph[1])) : null,
    address: v.address?.trim() || null,
    positionAt: new Date(Date.now() - ageMs).toISOString(),
    destination: null,
  };
}

/** Opens a Samsara or Monarch tracking link in a hidden browser and returns the truck's position. */
export async function readTrackingLink(input: string): Promise<TrackingReading> {
  const link = normalizeTrackingLink(input);
  const kind = link && trackerKind(link);
  if (!link || !kind) throw new TrackingLinkError("That isn't a Samsara or Monarch tracking link.");

  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    return kind === "samsara" ? await readSamsara(page, link) : await readMonarch(page, link);
  } finally {
    await browser.close().catch(() => {});
  }
}
