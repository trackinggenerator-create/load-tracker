import "server-only";
import puppeteer, { type Browser } from "puppeteer-core";

/** Only real Samsara share links, e.g. https://cloud.samsara.com/o/18208/fleet/viewer/xcwq0Zs2G6nD6GTydxWw */
const SHARE_LINK = /^https:\/\/cloud(\.[a-z0-9-]+)?\.samsara\.com\/o\/[0-9]+\/fleet\/viewer\/[A-Za-z0-9_-]+$/;

/** Cleans up a pasted link (spaces, trailing slash, ?query) and returns it if it's a Samsara share link. */
export function normalizeShareLink(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  const clean = `${url.protocol}//${url.host.toLowerCase()}${url.pathname.replace(/\/+$/, "")}`;
  return SHARE_LINK.test(clean) ? clean : null;
}

export type SamsaraReading = {
  lat: number;
  lng: number;
  heading: number | null;
  speedMph: number | null;
  address: string | null;
  positionAt: string;
  destination: { name: string | null; address: string | null; lat: number | null; lng: number | null } | null;
};

type FleetViewerResponse = {
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

export class SamsaraError extends Error {}

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
  // On this PC: the Edge or Chrome that's already installed.
  return puppeteer.launch({
    executablePath: process.env.CHROME_PATH || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    headless: true,
  });
}

/**
 * Opens the share link in a hidden browser, the same way a customer would, and reads the location
 * data the page loads. Keeps only position, speed, heading, address and destination: the carrier's
 * company name and the driver's name are dropped here and never leave this function.
 */
export async function readSamsaraLink(shareLink: string): Promise<SamsaraReading> {
  const link = normalizeShareLink(shareLink);
  if (!link) throw new SamsaraError("That isn't a Samsara share link.");

  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    // Skip pictures, map tiles and fonts: they aren't needed and make the page slower.
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const type = req.resourceType();
      if (type === "image" || type === "font" || type === "media") req.abort().catch(() => {});
      else req.continue().catch(() => {});
    });

    const response = new Promise<FleetViewerResponse>((resolve) => {
      page.on("response", async (res) => {
        if (!res.url().includes("/r/graphql?q=FleetViewer")) return;
        try {
          resolve((await res.json()) as FleetViewerResponse);
        } catch {
          // Not readable; wait for the next one.
        }
      });
    });
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new SamsaraError("Samsara didn't answer in time. Try again in a minute.")), 40_000),
    );

    await page.goto(link, { waitUntil: "domcontentloaded", timeout: 40_000 });
    const json = await Promise.race([response, timeout]);

    const token = json.data?.fleetViewerToken;
    if (!token) throw new SamsaraError("This Samsara link has expired or was turned off by the carrier.");

    const points = (token.devices ?? []).flatMap((d) => d.location ?? []);
    const latest = points.sort((a, b) => b.time - a.time)[0];
    if (!latest) throw new SamsaraError("The truck isn't sending its location right now.");

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
  } finally {
    await browser.close().catch(() => {});
  }
}
