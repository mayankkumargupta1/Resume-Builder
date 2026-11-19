import { NextResponse } from "next/server";
import crypto from "crypto";
import { curateResumeForJob, analyzeJobPosting } from "@/lib/ai-agent";
import { getOptionalUser } from "@/lib/auth";
import { saveTailoredDraft, getUserById } from "@/lib/db";
import { loadProfile } from "@/lib/profile-store";
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
    const { profile, jobText, targetUserId, targetUserIds, provider, apiKey, modelName } = body as {
      profile?: ProfileData;
      jobText: string;
      targetUserId?: string;
      targetUserIds?: string[];
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

    // ─── Batch Curation across Multiple Candidates (1-Click) ────────────────
    if (Array.isArray(targetUserIds) && targetUserIds.length > 0) {
      // 1. Analyze the job posting once to guarantee identical title and company across all candidates
      const sharedAnalysis = await analyzeJobPosting(jobText, {
        provider: provider || "gateway",
        apiKey,
        modelName,
      });

      // 2. Assign ONE unique generation ID for this run
      const generationId = `gen_${crypto.randomBytes(8).toString("hex")}`;

      const results = await Promise.allSettled(
        targetUserIds.map(async (candidateId) => {
          const candidateUser = await getUserById(candidateId);
          if (!candidateUser) {
            throw new Error(`Candidate ${candidateId} not found`);
          }
          const candidateProfile = await loadProfile(candidateId);
          const { analysis, tailored } = await curateResumeForJob({
            profile: candidateProfile,
            jobText,
            jobAnalysis: sharedAnalysis,
            provider: provider || "gateway",
            apiKey,
            modelName,
          });

          const draftId = await saveTailoredDraft(candidateId, {
            generation_id: generationId,
            title: sharedAnalysis.title || "Target Role",
            company: sharedAnalysis.company || "Target Company",
            job_text: jobText,
            match_score: tailored.matchScore,
            units: tailored.units,
            analysis: {
              ...sharedAnalysis,
              atsReport: tailored.atsReport,
            },
          });

          return {
            userId: candidateId,
            userName: candidateUser.name || candidateUser.email,
            userEmail: candidateUser.email,
            draftId,
            generationId,
            analysis: sharedAnalysis,
            tailored,
            matchScore: tailored.matchScore,
          };
        })
      );

      const successful = results
        .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
        .map((r) => r.value);

      return NextResponse.json({
        success: successful.length > 0,
        batch: true,
        generationId,
        sharedTitle: sharedAnalysis.title,
        sharedCompany: sharedAnalysis.company,
        results: successful,
        totalRequested: targetUserIds.length,
        totalSucceeded: successful.length,
      });
    }

    let uid = user.id;
    let candidateProfile = profile;

    // If generating a resume for a specific candidate:
    if (targetUserId && targetUserId !== user.id) {
      const targetUser = await getUserById(targetUserId);
      if (!targetUser) {
        return NextResponse.json({ success: false, error: "Target candidate not found." }, { status: 404 });
      }
      uid = targetUser.id;
      // Load candidate authentic master profile from DB (read-only)
      candidateProfile = await loadProfile(uid);
    }

    if (!candidateProfile) {
      return NextResponse.json({ success: false, error: "Profile data is required." }, { status: 400 });
    }

    const { analysis, tailored } = await curateResumeForJob({
      profile: candidateProfile,
      jobText,
      provider: provider || "gateway",
      apiKey,
      modelName,
    });

    const generationId = `gen_${crypto.randomBytes(8).toString("hex")}`;

    // Persist the curated resume and the full job description in PostgreSQL for tracking
    const draftId = await saveTailoredDraft(uid, {
      generation_id: generationId,
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
      generationId,
      targetUserId: uid,
      analysis,
      tailored,
    });
  } catch (error: any) {
    console.error("Curation API error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
