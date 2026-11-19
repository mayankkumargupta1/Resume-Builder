import fs from "fs";
import puppeteer from "puppeteer-core";

const CANDIDATE_PATHS = [
  process.env.CHROME_BIN,
  process.env.PUPPETEER_EXECUTABLE_PATH,
  "/usr/bin/google-chrome-stable",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/snap/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
].filter((p): p is string => Boolean(p));

export function getChromeExecutablePath(): string {
  for (const candidate of CANDIDATE_PATHS) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error(
    "Chromium/Chrome executable not found on the server. Please install Chrome or Chromium, or set CHROME_BIN."
  );
}

export interface GeneratePdfOptions {
  url: string;
  sessionToken?: string;
  cookieDomain?: string;
}

export async function generatePdfFromUrl({
  url,
  sessionToken,
  cookieDomain = "localhost",
}: GeneratePdfOptions): Promise<Uint8Array> {
  const executablePath = getChromeExecutablePath();

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-first-run",
      "--font-render-hinting=none",
    ],
  });

  try {
    const page = await browser.newPage();

    if (sessionToken) {
      await page.setCookie({
        name: "rp_session",
        value: sessionToken,
        domain: cookieDomain,
        path: "/",
      });
    }

    // Wait until network is idle so all fonts, styles, and images are loaded
    await page.goto(url, { waitUntil: "networkidle0", timeout: 30_000 });

    // Emulate print media for exact CSS print stylesheets
    await page.emulateMediaType("print");

    const pdfBuffer = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true, // respects @page size and margins from printCss
    });

    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

