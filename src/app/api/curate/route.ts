import { NextResponse } from "next/server";
import { curateResumeForJob } from "@/lib/ai-agent";
import { getOptionalUser } from "@/lib/auth";
import { saveTailoredDraft } from "@/lib/db";
import type { ProfileData } from "@/lib/profile";

export async function POST(req: Request) {
  try {
    const user = await getOptionalUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please sign in to curate resumes." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { profile, jobText, provider, apiKey, modelName } = body as {
      profile: ProfileData;
      jobText: string;
      provider?: "deepseek" | "gateway" | "ollama" | "openai" | "anthropic";
      apiKey?: string;
      modelName?: string;
    };

    if (!jobText || jobText.trim().length < 20) {
      return NextResponse.json(
        { success: false, error: "Please provide a valid job description (at least 20 characters)." },
        { status: 400 }
      );
    }

    if (!profile) {
      return NextResponse.json({ success: false, error: "Profile data is required." }, { status: 400 });
    }

    const uid = user.id;

    const { analysis, tailored } = await curateResumeForJob({
      profile,
      jobText,
      provider: provider || "deepseek",
      apiKey,
      modelName: modelName || "deepseek-v4.1",
    });

    // Persist the curated resume and the full job description in PostgreSQL for tracking
    const draftId = await saveTailoredDraft(uid, {
      title: analysis.title || "Target Role",
      company: analysis.company || "Target Company",
      job_text: jobText,
      match_score: tailored.matchScore,
      units: tailored.units,
      analysis: {
        ...analysis,
        atsReport: tailored.atsReport,
      },
    });

    return NextResponse.json({
      success: true,
      draftId,
      analysis,
      tailored,
    });
  } catch (error: any) {
    console.error("Curation API error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
