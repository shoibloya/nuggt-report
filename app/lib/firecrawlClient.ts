/* app/lib/firecrawlClient.ts
 *
 * Actual code for calling Firecrawl with retries.
 * Make sure you have installed `@mendable/firecrawl-js`
 * and have FIRECRAWL_API_KEY in your environment variables.
 */
"use server"
import FirecrawlApp, { ScrapeResponse } from "@mendable/firecrawl-js";

const firecrawlApp = new FirecrawlApp({
  apiKey: process.env.FIRECRAWL_API_KEY || "",
});

const MAX_TRIES = 3;

/**
 * scrapeWithRetries
 * @param {string} url - The URL to scrape
 * @param {any} options - e.g. { formats: ['markdown'] }
 * @returns {Promise<ScrapeResponse | null>}
 */
export async function scrapeWithRetries(
  url: string,
  options: any
): Promise<ScrapeResponse | null> {
  for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
    try {
      console.log(`[Firecrawl] Attempt ${attempt}: Scraping => ${url}`);
      const result = (await firecrawlApp.scrapeUrl(url, options)) as ScrapeResponse;
      if (result.success) {
        console.log(`[Firecrawl] Success on attempt ${attempt} =>`, url);
        return result;
      } else {
        console.error(
          `[Firecrawl] Attempt ${attempt}: Failed to scrape ${url}:`,
          result.error
        );
      }
    } catch (error) {
      console.error(`[Firecrawl] Attempt ${attempt}: Unexpected error =>`, error);
    }
    // Optional: Add a delay before retrying (exponential backoff or simple)
    await new Promise((res) => setTimeout(res, 1000 * attempt));
  }
  console.error(`[Firecrawl] All ${MAX_TRIES} attempts failed for => ${url}`);
  return null;
}
