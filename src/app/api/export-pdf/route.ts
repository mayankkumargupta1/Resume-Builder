import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getOptionalUser, SESSION_COOKIE_NAME } from "@/lib/auth";
import { getTailoredDraftById } from "@/lib/db";
import { loadProfile } from "@/lib/profile-store";
import { generatePdfFromUrl } from "@/lib/pdf-generator";

export async function GET(req: Request) {
  try {
    const user = await getOptionalUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please sign in to export PDF." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "base";
    const draftId = searchParams.get("id");

    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
    const protocol = req.headers.get("x-forwarded-proto") || "http";
    const cookieDomain = host.split(":")[0];

    const profile = await loadProfile(user.id);
    const candidateName = profile.basics.name?.trim() || user.name?.trim() || "Resume";
    let sanitizedName = candidateName.replace(/[^a-zA-Z0-9_\-]/g, "_") || "Resume";

    let targetPath = "/print/base";
    let filename = `${sanitizedName}_Resume.pdf`;

    if (type === "tailored") {
      if (!draftId) {
        return NextResponse.json(
          { success: false, error: "Draft ID is required for tailored PDF export." },
          { status: 400 }
        );
      }

      const draft = await getTailoredDraftById(user.id, draftId, true);
      if (!draft) {
        return NextResponse.json(
          { success: false, error: "Tailored draft not found." },
          { status: 404 }
        );
      }

      targetPath = `/print/tailored/${draftId}`;
      const draftOwnerProfile = await loadProfile(draft.user_id);
      const ownerCandidateName = draftOwnerProfile.basics.name?.trim() || "Candidate";
      sanitizedName = ownerCandidateName.replace(/[^a-zA-Z0-9_\-]/g, "_") || "Candidate";
      const company = draft.company?.trim().replace(/[^a-zA-Z0-9_\-]/g, "_") || "Tailored";
      filename = `${sanitizedName}_${company}_Resume.pdf`;
    }

    const targetUrl = `${protocol}://${host}${targetPath}`;

    const pdfBuffer = await generatePdfFromUrl({
      url: targetUrl,
      sessionToken,
      cookieDomain,
    });

    return new NextResponse(Buffer.from(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": pdfBuffer.byteLength.toString(),
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (err: any) {
    console.error("PDF Export Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to generate PDF." },
      { status: 500 }
    );
  }
}
