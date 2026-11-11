import { NextResponse } from "next/server";
import { fetchJobPosting } from "@/lib/job-scraper";
import { getOptionalUser } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = await getOptionalUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please sign in to scrape job descriptions." },
        { status: 401 }
      );
    }

    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ success: false, error: "Please enter a valid job URL." }, { status: 400 });
    }

    // SSRF Guard: Validate URL scheme and block local/private network addresses
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return NextResponse.json({ success: false, error: "Malformed URL provided." }, { status: 400 });
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return NextResponse.json({ success: false, error: "Only http and https protocols are supported." }, { status: 400 });
    }

    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname.endsWith(".local") ||
      hostname.startsWith("127.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") ||
      hostname === "169.254.169.254" ||
      hostname === "::1" ||
      hostname === "0.0.0.0"
    ) {
      return NextResponse.json({ success: false, error: "Requests to internal or private networks are prohibited." }, { status: 403 });
    }

    const result = await fetchJobPosting(url);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
