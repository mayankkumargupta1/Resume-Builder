import { parse } from "node-html-parser";

export interface ScrapedJob {
  success: boolean;
  url?: string;
  title?: string;
  company?: string;
  content: string;
  error?: string;
}

export async function fetchJobPosting(urlString: string): Promise<ScrapedJob> {
  let url = urlString.trim();
  if (!url) {
    return { success: false, content: "", error: "No URL provided." };
  }

  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    clearTimeout(timeout);

    if (!res.ok) {
      return {
        success: false,
        url,
        content: "",
        error: `Failed to fetch URL: HTTP ${res.status} ${res.statusText}. Please copy and paste the job description directly.`,
      };
    }

    const html = await res.text();
    const root = parse(html);

    // Remove noise
    root.querySelectorAll("script, style, noscript, nav, header, footer, svg, iframe, form, button").forEach((el) =>
      el.remove()
    );

    // Extract title from meta or title tag
    let pageTitle =
      root.querySelector('meta[property="og:title"]')?.getAttribute("content") ||
      root.querySelector('meta[name="twitter:title"]')?.getAttribute("content") ||
      root.querySelector("title")?.textContent?.trim() ||
      "";

    // Extract company
    let company =
      root.querySelector('meta[property="og:site_name"]')?.getAttribute("content") ||
      root.querySelector('meta[name="author"]')?.getAttribute("content") ||
      "";

    // Attempt to locate primary job container
    const candidates = [
      '[id*="job-description"]',
      '[class*="job-description"]',
      '[class*="jobDescription"]',
      '[id*="jobDescription"]',
      '[class*="posting-requirements"]',
      '[class*="description"]',
      "main",
      "article",
    ];

    let targetElement = null;
    for (const selector of candidates) {
      const match = root.querySelector(selector);
      if (match && match.text.trim().length > 200) {
        targetElement = match;
        break;
      }
    }

    const container = targetElement || root.querySelector("body") || root;

    // Clean text lines
    const textLines = container.text
      .split("\n")
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter((line) => line.length > 0);

    const fullContent = textLines.join("\n");

    if (fullContent.length < 50) {
      return {
        success: false,
        url,
        content: "",
        error:
          "The webpage loaded, but very little text was found (it may be rendered via heavy client-side JavaScript or login-protected). Please paste the job description text directly.",
      };
    }

    return {
      success: true,
      url,
      title: pageTitle.replace(/\s*[-|–]\s*.*$/, "").trim() || pageTitle,
      company: company.trim(),
      content: fullContent.slice(0, 30000), // Cap reasonable payload for LLM
    };
  } catch (err: any) {
    console.error("Job scrape error:", err);
    return {
      success: false,
      url,
      content: "",
      error: `Could not reach job link: ${err?.message || "Network error"}. Please paste the job description text directly.`,
    };
  }
}
