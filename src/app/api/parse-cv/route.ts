import { NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth";
import { extractCvTextFromFile, parseCvToProfile } from "@/lib/cv-parser";

export const maxDuration = 120; // 2 minutes max for LLM parsing

export async function POST(req: Request) {
  try {
    const user = await getOptionalUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please sign in to import your CV." },
        { status: 401 }
      );
    }

    const contentType = req.headers.get("content-type") || "";
    let cvText = "";
    let originalFileName = "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const textParam = formData.get("text") as string | null;

      if (file && file.size > 0) {
        if (file.size > 15 * 1024 * 1024) {
          return NextResponse.json(
            { success: false, error: "File exceeds 15MB limit. Please upload a smaller document." },
            { status: 400 }
          );
        }
        originalFileName = file.name;
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        cvText = await extractCvTextFromFile(buffer, file.type, file.name);
      } else if (textParam && textParam.trim()) {
        cvText = textParam.trim();
      }
    } else if (contentType.includes("application/json")) {
      const body = await req.json();
      cvText = (body.text || "").trim();
    }

    if (!cvText || cvText.trim().length < 20) {
      return NextResponse.json(
        {
          success: false,
          error: "Could not extract sufficient text from the CV. Please upload a clear PDF, DOCX, or paste your resume text.",
        },
        { status: 400 }
      );
    }

    const parsedProfile = await parseCvToProfile(cvText);

    return NextResponse.json({
      success: true,
      profile: parsedProfile,
      originalFileName,
      extractedSnippet: cvText.slice(0, 300),
    });
  } catch (error: any) {
    console.error("Error in /api/parse-cv:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to parse CV." },
      { status: 500 }
    );
  }
}

