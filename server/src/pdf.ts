import { chromium, type Browser } from 'playwright-core';

let browser: Promise<Browser> | null = null;

function starteBrowser(): Promise<Browser> {
  if (!browser) {
    browser = chromium
      .launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] })
      .catch((e) => {
        browser = null;
        throw new Error(
          `Chromium für den PDF-Export nicht gefunden (${(e as Error).message.split('\n')[0]}). ` +
            'Lokal: „npx playwright install chromium“ oder CHROMIUM_PATH setzen. Im Docker-Image ist es enthalten.',
        );
      });
  }
  return browser;
}

/** Rendert die Druckansicht als genau eine A4-Seite. */
export async function erzeugePdf(url: string): Promise<Buffer> {
  const b = await starteBrowser();
  const page = await b.newPage({ viewport: { width: 794, height: 1123 } });
  try {
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => (window as unknown as { __druckFertig?: boolean }).__druckFertig === true, null, { timeout: 15000 });
    return await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true, pageRanges: '1' });
  } finally {
    await page.close();
  }
}
