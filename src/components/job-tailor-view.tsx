"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Button, buttonClassName } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/toast";
import type { ProfileData } from "@/lib/profile";
import {
  Sparkles,
  Search,
  ArrowRight,
  CheckCircle2,
  FolderGit2,
  Clock,
  FileText,
  Trash2,
  Copy,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Check,
  X,
  Briefcase,
  Code,
  Eye,
  Award,
  BarChart3,
  Users,
  Download,
  Loader2,
} from "lucide-react";
import { AtsReportModal } from "@/components/ats-report-modal";
import { generateAtsReport, type AtsReport } from "@/lib/ats-engine";

export function JobTailorView({
  profile,
  onApplyTailored,
  onNavigateToResume,
  isAdmin = false,
  candidates = [],
  activeCandidateId: initialCandidateId,
  activeCandidateName: initialCandidateName,
  currentUserId,
}: {
  profile: ProfileData;
  onApplyTailored?: (result: {
    target: { title: string; company: string };
    units: { id: string; text: string }[];
  }) => void;
  onNavigateToResume?: () => void;
  isAdmin?: boolean;
  candidates?: { id: string; name: string; email: string }[];
  activeCandidateId?: string;
  activeCandidateName?: string;
  currentUserId?: string;
}) {
  const router = useRouter();
  const [currentCandidateId, setCurrentCandidateId] = useState<string>(initialCandidateId || "");
  const [activeCandidateName, setActiveCandidateName] = useState<string | undefined>(initialCandidateName);
  const [currentProfile, setCurrentProfile] = useState<ProfileData>(profile);
  const [jobText, setJobText] = useState("");
  const [isCurating, setIsCurating] = useState(false);
  const [curationResult, setCurationResult] = useState<any | null>(null);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>(() =>
    candidates.map((c) => c.id)
  );
  const [batchResults, setBatchResults] = useState<any[] | null>(null);
  const [savedFilterUserId, setSavedFilterUserId] = useState<string>("all");

  useEffect(() => {
    setCurrentProfile(profile);
    setCurrentCandidateId(initialCandidateId || "");
    setActiveCandidateName(initialCandidateName);
  }, [profile, initialCandidateId, initialCandidateName]);

  useEffect(() => {
    if (candidates.length > 0 && selectedCandidateIds.length === 0) {
      setSelectedCandidateIds(candidates.map((c) => c.id));
    }
  }, [candidates]);

  const toggleCandidate = (id: string) => {
    setSelectedCandidateIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Interactive Switch ON / OFF states
  const [selectedExpIds, setSelectedExpIds] = useState<string[]>([]);
  const [selectedProjIds, setSelectedProjIds] = useState<string[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [tailoredHeadline, setTailoredHeadline] = useState("");
  const [tailoredSummary, setTailoredSummary] = useState("");

  // Saved Drafts & JDs
  const [savedDrafts, setSavedDrafts] = useState<any[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [expandedJdId, setExpandedJdId] = useState<string | null>(null);

  // ATS Diagnostic Report Modal
  const [showAtsReport, setShowAtsReport] = useState(false);
  const [selectedDraftForReport, setSelectedDraftForReport] = useState<any | null>(null);

  // Group drafts by generation so there is only ONE entry per generation run
  const displayedGenerations = useMemo(() => {
    const list =
      savedFilterUserId === "all"
        ? savedDrafts
        : savedDrafts.filter((d: any) => d.user_id === savedFilterUserId);

    const map = new Map<
      string,
      {
        generationId: string;
        title: string;
        company: string;
        job_text: string;
        created_at: string;
        candidates: any[];
      }
    >();

    for (const draft of list) {
      const genId = draft.generation_id || draft.id;
      let group = map.get(genId);
      if (!group) {
        group = {
          generationId: genId,
          title: draft.title || "Target Role",
          company: draft.company || "Target Company",
          job_text: draft.job_text,
          created_at: draft.created_at,
          candidates: [],
        };
        map.set(genId, group);
      }
      group.candidates.push(draft);
    }

    return Array.from(map.values());
  }, [savedDrafts, savedFilterUserId]);

  const fetchDrafts = async () => {
    try {
      setLoadingDrafts(true);
      const res = await fetch("/api/tailored-drafts");
      const data = await res.json();
      if (data.success) {
        setSavedDrafts(data.drafts || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingDrafts(false);
    }
  };

  useEffect(() => {
    fetchDrafts();
  }, []);

  const computeAndPersistUnits = (
    headline: string,
    summary: string,
    expIds: string[],
    projIds: string[],
    skills: string[],
    targetInfo?: { title: string; company: string }
  ) => {
    const units: { id: string; text: string }[] = [];
    if (headline.trim()) units.push({ id: "headline", text: headline.trim() });
    if (summary.trim()) units.push({ id: "summary", text: summary.trim() });

    // Verbatim untouched experiences
    for (const expId of expIds) {
      const exp = currentProfile.experience.find((e) => e.id === expId);
      if (exp) {
        units.push({ id: `experience:${exp.id}`, text: exp.bullets });
      }
    }

    // Verbatim untouched projects
    for (const projId of projIds) {
      const proj = currentProfile.projects.find((p) => p.id === projId);
      if (proj) {
        units.push({ id: `project:${proj.id}`, text: proj.bullets });
      }
    }

    const draftData = {
      target: targetInfo || {
        title: curationResult?.analysis?.title || "Target Role",
        company: curationResult?.analysis?.company || "Target Company",
      },
      units,
    };

    if (typeof window !== "undefined") {
      localStorage.setItem("rp_tailored_draft", JSON.stringify(draftData));
    }

    if (onApplyTailored) {
      onApplyTailored(draftData);
    }

    return units;
  };

  const handleCurate = async () => {
    if (!jobText.trim()) {
      toast("Please paste a job description first.");
      return;
    }
    if (candidates.length > 0 && selectedCandidateIds.length === 0) {
      toast("Please select at least one candidate to tailor for.");
      return;
    }

    setIsCurating(true);
    setBatchResults(null);
    try {
      const isBatch = candidates.length > 0 && selectedCandidateIds.length > 0;
      const res = await fetch("/api/curate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: currentProfile,
          jobText,
          targetUserIds: isBatch ? selectedCandidateIds : undefined,
          targetUserId: !isBatch ? currentCandidateId || undefined : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.batch && data.results) {
          setBatchResults(data.results);
          toast(`Tailored resumes generated for ${data.results.length} candidate(s)!`);
          fetchDrafts();
        } else {
          setCurationResult(data);

          const expIds: string[] =
            data.tailored.selectedExperienceIds || currentProfile.experience.map((e) => e.id);
          const projIds: string[] =
            data.tailored.selectedProjectIds || currentProfile.projects.map((p) => p.id);
          const skills: string[] =
            data.tailored.selectedSkills || currentProfile.skills.map((s) => s.name);
          const hLine = data.tailored.headline || currentProfile.basics.headline;
          const sum = data.tailored.summary || currentProfile.basics.summary;

          setSelectedExpIds(expIds);
          setSelectedProjIds(projIds);
          setSelectedSkills(skills);
          setTailoredHeadline(hLine);
          setTailoredSummary(sum);

          computeAndPersistUnits(hLine, sum, expIds, projIds, skills, {
            title: data.analysis?.title || "Target Role",
            company: data.analysis?.company || "Target Company",
          });

          toast("Resume curated! Headline & summary generated; items switched ON for this JD.");
          fetchDrafts();
        }
      } else {
        toast(data.error || "Curation failed.");
      }
    } catch (e: any) {
      toast(e?.message || "Failed to curate resume.");
    } finally {
      setIsCurating(false);
    }
  };

  const summaryWords = tailoredSummary.trim() ? tailoredSummary.trim().split(/\s+/).length : 0;
  const summarySentences = tailoredSummary.trim()
    ? tailoredSummary.trim().split(/(?<=[.!?])\s+/).filter(Boolean).length
    : 0;
  const isHealthyLength =
    summaryWords >= 45 && summaryWords <= 90 && summarySentences >= 2 && summarySentences <= 5;

  const activeAtsReport: AtsReport | null = selectedDraftForReport
    ? (selectedDraftForReport.analysis?.atsReport ||
       generateAtsReport(
         profile,
         selectedDraftForReport.job_text || "",
         selectedDraftForReport.analysis || {},
         profile.basics.headline,
         profile.basics.summary
       ))
    : curationResult?.tailored?.atsReport ||
      (curationResult
        ? generateAtsReport(
            profile,
            jobText,
            curationResult.analysis,
            tailoredHeadline,
            tailoredSummary
          )
        : null);

  const handleApplySavedDraft = (draft: any) => {
    const draftData = {
      target: {
        title: draft.title || "Target Role",
        company: draft.company || "Target Company",
      },
      units: draft.units || [],
    };

    if (typeof window !== "undefined") {
      localStorage.setItem("rp_tailored_draft", JSON.stringify(draftData));
    }

    if (onApplyTailored) {
      onApplyTailored(draftData);
    }

    toast(`Loaded tailored resume for ${draft.company || draft.title}!`);
  };

  const handleDeleteGeneration = async (genId: string) => {
    if (!confirm("Delete this tailored job application and all candidate resumes generated for it?")) return;
    try {
      const res = await fetch(`/api/tailored-drafts?id=${genId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setSavedDrafts((prev) =>
          prev.filter((d) => (d.generation_id || d.id) !== genId && d.id !== genId)
        );
        toast("Application deleted from database.");
      }
    } catch {
      toast("Failed to delete application.");
    }
  };

  const handleDeleteDraft = async (id: string) => {
    if (!confirm("Delete this candidate's tailored resume?")) return;
    try {
      const res = await fetch(`/api/tailored-drafts?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setSavedDrafts((prev) => prev.filter((d) => d.id !== id));
        toast("Candidate resume deleted.");
      }
    } catch {
      toast("Failed to delete resume.");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast("Job Description copied to clipboard!");
  };

  return (
    <div className="flex flex-1 flex-col overflow-y-auto pb-24 bg-paper">
      <PageHeader
        title="Job-curated resume agent"
        description="Provide a target job description. The AI tailors your professional headline and a healthy 3-to-4 sentence summary aligned with the role. All your authentic experiences, projects, and skills remain 100% present, verbatim, and untampered with."
        actions={
          <div className="flex items-center gap-2">
            <Link href="/applications" className={buttonClassName("secondary")}>
              Tailored Resumes →
            </Link>
            <Link href="/resume" className={buttonClassName("secondary")}>
              See base resume →
            </Link>
          </div>
        }
      />

      <div className="mx-auto flex w-full max-w-[940px] flex-col gap-8 px-8 pt-2 pb-24">
        {/* Input box */}
        <div className="flex flex-col gap-5 rounded-card border border-line-card bg-card p-6 shadow-xs">
          {/* Registered Candidates Multi-Select Option */}
          {candidates.length > 0 && (
            <div className="flex flex-col gap-3 rounded-control border border-line bg-surface/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2.5">
                <div className="flex items-center gap-2">
                  <Users className="size-4 text-primary" />
                  <span className="text-xs font-bold text-ink">
                    Registered Candidates (Select to Tailor for in 1-Click)
                  </span>
                  <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-bold">
                    {selectedCandidateIds.length} of {candidates.length} Selected
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setSelectedCandidateIds(candidates.map((c) => c.id))}
                    className="font-medium text-primary hover:underline cursor-pointer"
                  >
                    Select All
                  </button>
                  <span className="text-muted">·</span>
                  <button
                    type="button"
                    onClick={() => setSelectedCandidateIds([])}
                    className="font-medium text-muted hover:text-ink cursor-pointer"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {/* Checkboxes Grid for Candidates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
                {candidates.map((candidate) => {
                  const isChecked = selectedCandidateIds.includes(candidate.id);
                  const candidateDraft = savedDrafts.find((d) => d.user_id === candidate.id);
                  return (
                    <div
                      key={candidate.id}
                      onClick={() => toggleCandidate(candidate.id)}
                      className={`flex flex-col justify-between gap-2.5 rounded-control border p-3 cursor-pointer select-none transition-all ${
                        isChecked
                          ? "border-primary bg-primary/10 text-ink shadow-xs"
                          : "border-line bg-card/60 text-muted hover:border-line-strong hover:bg-hover"
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // handled by parent onClick
                          className="mt-0.5 size-4 rounded border-line text-primary focus:ring-primary cursor-pointer shrink-0"
                        />
                        <div className="flex flex-col min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1.5">
                            <span
                              className={`text-xs font-bold truncate ${
                                isChecked ? "text-ink" : "text-muted"
                              }`}
                            >
                              {candidate.name || candidate.email}
                            </span>
                            {candidateDraft?.match_score !== undefined && (
                              <span className="rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 px-1.5 py-0.2 text-[10px] font-bold shrink-0">
                                {candidateDraft.match_score}% ATS
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-muted truncate">
                            {candidate.email}
                          </span>
                        </div>
                      </div>

                      {/* Profile Options: ATS Report & PDF Download */}
                      {candidateDraft && (
                        <div
                          className="flex items-center justify-between border-t border-line/50 pt-2 text-[11px]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDraftForReport(candidateDraft);
                              setShowAtsReport(true);
                            }}
                            className="flex items-center gap-1 text-primary hover:underline cursor-pointer font-medium"
                          >
                            <BarChart3 className="size-3" />
                            <span>ATS Report</span>
                          </button>

                          <a
                            href={`/api/export-pdf?type=tailored&id=${candidateDraft.id}`}
                            download
                            className="flex items-center gap-1 text-primary hover:underline cursor-pointer font-medium"
                          >
                            <Download className="size-3" />
                            <span>Download PDF</span>
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Job description textarea */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-ink">Job Description</label>
              {jobText.length > 0 && <span className="text-xs text-muted">{jobText.length} characters</span>}
            </div>
            <Textarea
              rows={8}
              placeholder="Paste full job description or requirements here..."
              value={jobText}
              onChange={(e) => setJobText(e.target.value)}
              className="w-full font-mono text-xs leading-relaxed"
            />
          </div>

          {/* Action Bar */}
          <div className="flex items-center justify-between border-t border-line pt-4 flex-wrap gap-3">
            <div className="flex items-center gap-2 text-xs text-muted">
              {candidates.length > 0 && selectedCandidateIds.length > 0 && (
                <span>
                  Will curate authentic profiles for{" "}
                  <strong className="text-ink">{selectedCandidateIds.length} candidate(s)</strong> in parallel.
                </span>
              )}
            </div>

            <Button
              variant="primary"
              disabled={
                isCurating ||
                !jobText.trim() ||
                (candidates.length > 0 && selectedCandidateIds.length === 0)
              }
              onClick={handleCurate}
              className="flex items-center gap-2 px-6 py-2 cursor-pointer shadow-raised shrink-0 font-semibold"
            >
              {isCurating ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>
                    {candidates.length > 0 && selectedCandidateIds.length > 1
                      ? `Tailoring ${selectedCandidateIds.length} Resumes in Parallel…`
                      : "Tailoring Resume…"}
                  </span>
                </>
              ) : (
                <>
                  <Sparkles className="size-4" />
                  <span>
                    {candidates.length > 0 && selectedCandidateIds.length > 1
                      ? `Tailor Resumes for ${selectedCandidateIds.length} Candidates (1-Click)`
                      : candidates.length > 0 && selectedCandidateIds.length === 1
                      ? "Tailor Resume for 1 Candidate"
                      : "Tailor Resume"}
                  </span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* 1-Click Batch Curation Results Breakdown */}
        {batchResults && batchResults.length > 0 && (
          <div className="flex flex-col gap-5 rounded-card border border-primary/30 bg-card p-6 shadow-raised animate-in fade-in duration-300">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-control bg-success/15 text-success">
                  <CheckCircle2 className="size-5" />
                </div>
                <div className="flex flex-col">
                  <h3 className="font-serif text-lg font-bold text-ink">
                    1-Click Batch Tailoring Complete
                  </h3>
                  <p className="text-xs text-muted">
                    Successfully curated tailored resumes for {batchResults.length} registered candidate(s).
                  </p>
                </div>
              </div>

              <Link
                href="/applications"
                className={buttonClassName("secondary", "sm", "flex items-center gap-1.5 shadow-xs")}
              >
                <FileText className="size-3.5 text-primary" />
                <span>Open in Applications Tracker →</span>
              </Link>
            </div>

            {/* Batch Results Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
              {batchResults.map((item) => (
                <div
                  key={item.draftId}
                  className="flex flex-col justify-between gap-3.5 rounded-control border border-line bg-surface/70 p-4 hover:border-line-strong transition-all shadow-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                        <Users className="size-3.5 text-primary" />
                        {item.userName}
                      </span>
                      <span className="text-[11px] text-muted">{item.userEmail}</span>
                    </div>
                    <span className="rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 text-[11px] font-bold shrink-0">
                      {item.matchScore}% Match
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-t border-line/60 pt-3">
                    <span className="text-xs font-medium text-ink truncate max-w-[190px]">
                      {item.analysis?.title || "Target Role"}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDraftForReport({
                            id: item.draftId,
                            title: item.analysis?.title || "Target Role",
                            company: item.analysis?.company || "Target Company",
                            job_text: jobText,
                            analysis: item.analysis,
                          });
                          setShowAtsReport(true);
                        }}
                        className={buttonClassName("secondary", "sm", "flex items-center gap-1 text-xs py-1 px-2.5 cursor-pointer")}
                      >
                        <BarChart3 className="size-3 text-primary" />
                        <span>ATS Report</span>
                      </button>
                      <Link
                        href={`/applications?id=${item.draftId}`}
                        className={buttonClassName("secondary", "sm", "flex items-center gap-1 text-xs py-1 px-2.5")}
                      >
                        <Eye className="size-3 text-primary" />
                        <span>View</span>
                      </Link>
                      <a
                        href={`/api/export-pdf?type=tailored&id=${item.draftId}`}
                        download
                        className={buttonClassName(
                          "primary",
                          "sm",
                          "flex items-center gap-1 text-xs py-1 px-2.5 shadow-raised"
                        )}
                      >
                        <Download className="size-3" />
                        <span>Download PDF</span>
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Curation Results Breakdown */}
        {curationResult && (
          <div className="flex flex-col gap-6 rounded-card border border-line-card bg-card p-6 shadow-xs animate-in fade-in duration-300">
            {/* Fact Guard Shield Banner */}
            <div className="flex items-start gap-2.5 rounded-control bg-success/10 border border-success/30 p-3 text-xs text-success">
              <ShieldCheck className="size-4 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-0.5">
                <span className="font-semibold text-ink">Zero-Hallucination Fact Guard Active</span>
                <span className="text-muted leading-relaxed">
                  The AI only generated your profile headline and summary. All experience bullets, company names,
                  dates, and personal contact details are 100% authentic and untouched from your profile.
                </span>
              </div>
            </div>

            {/* Target Role & Match Header */}
            <div className="flex items-start justify-between border-b border-line pb-4 flex-wrap gap-4">
              <div>
                <span className="text-xs font-semibold text-accent uppercase tracking-wider">Curation Complete</span>
                <h3 className="font-serif text-2xl font-bold text-ink">
                  {curationResult.analysis.title} · {curationResult.analysis.company}
                </h3>
                <p className="text-xs text-muted mt-1">{curationResult.analysis.summary}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-serif text-3xl font-bold text-primary">
                    {curationResult.tailored.matchScore}%
                  </span>
                  <span className="text-xs text-muted font-medium">ATS Match</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDraftForReport(null);
                    setShowAtsReport(true);
                  }}
                  className="flex items-center gap-1.5 rounded-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 px-3 py-1 text-xs font-semibold cursor-pointer transition-all shadow-xs"
                >
                  <BarChart3 className="size-3.5" />
                  <span>View Complete ATS Report</span>
                </button>
              </div>
            </div>

            {/* Quick Keyword Match Snapshot Bar */}
            {activeAtsReport && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-control bg-paper/60 border border-line p-3 text-xs">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1 text-success font-medium">
                    <Check className="size-3.5" />
                    <span>{activeAtsReport.matchedSkills.length} Matched Skills</span>
                  </div>
                  {activeAtsReport.missingSkills.length > 0 && (
                    <div className="flex items-center gap-1 text-amber-400 font-medium">
                      <span className="size-1.5 rounded-full bg-amber-400" />
                      <span>{activeAtsReport.missingSkills.length} Missing JD Skills</span>
                    </div>
                  )}
                  <span className="text-muted">·</span>
                  <span className="text-muted">Simulated across Workday, Taleo, Greenhouse &amp; Lever</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDraftForReport(null);
                    setShowAtsReport(true);
                  }}
                  className="text-primary hover:underline font-semibold cursor-pointer text-xs"
                >
                  Open Complete Audit Breakdown →
                </button>
              </div>
            )}

            {/* AI Generated Profile Description & Headline */}
            <div className="flex flex-col gap-3 rounded-card border border-line bg-paper/70 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                  AI-Curated Profile Description (Targeted for this JD)
                </span>
                <span className="text-[11px] text-muted italic">Only editable section</span>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-muted uppercase">Curated Headline</label>
                  <input
                    type="text"
                    value={tailoredHeadline}
                    onChange={(e) => {
                      setTailoredHeadline(e.target.value);
                      computeAndPersistUnits(e.target.value, tailoredSummary, selectedExpIds, selectedProjIds, selectedSkills);
                    }}
                    className="h-8 w-full rounded-control border border-line bg-card px-2.5 text-xs font-semibold text-ink focus:border-primary focus:outline-hidden"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-muted uppercase">
                      Curated Summary (3–4 impactful sentences, ~55–80 words)
                    </label>
                    <span
                      className={`font-mono text-[10px] px-2 py-0.5 rounded-full ${
                        isHealthyLength
                          ? "bg-success/15 text-success font-semibold"
                          : "bg-track text-muted"
                      }`}
                    >
                      {summaryWords} words · {summarySentences} sentences{" "}
                      {isHealthyLength ? "✓ Healthy Length" : "(Aim for 3-4 sentences)"}
                    </span>
                  </div>
                  <textarea
                    rows={4}
                    value={tailoredSummary}
                    onChange={(e) => {
                      setTailoredSummary(e.target.value);
                      computeAndPersistUnits(tailoredHeadline, e.target.value, selectedExpIds, selectedProjIds, selectedSkills);
                    }}
                    className="w-full rounded-control border border-line bg-card p-2.5 text-xs leading-relaxed text-ink focus:border-primary focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* Verified Career Assets Confirmation Card */}
            <div className="flex flex-col gap-3 rounded-card border border-line bg-paper/70 p-4">
              <div className="flex items-center justify-between border-b border-line pb-2">
                <div className="flex items-center gap-2">
                  <Briefcase className="size-4 text-primary" />
                  <span className="text-xs font-semibold text-ink uppercase tracking-wider">
                    Master Career History (100% Preserved Verbatim)
                  </span>
                </div>
                <span className="flex items-center gap-1 text-xs font-medium text-success">
                  <Check className="size-3.5" /> All Assets Present
                </span>
              </div>
              <p className="text-[11px] text-muted leading-relaxed">
                In accordance with zero-hallucination policy, all {profile.experience.length} experiences, {profile.projects.length} projects, {profile.skills.length} categorized skills, and {(profile.certifications || profile.publications || []).length} certifications remain authentic, complete, and unhidden for every application. The agent only tailors your professional headline and summary.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
                <div className="flex items-center gap-2 rounded-control bg-card border border-line p-2.5">
                  <Briefcase className="size-3.5 text-primary shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-ink">{profile.experience.length} Experiences</span>
                    <span className="text-[10px] text-muted">All bullets verbatim</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-control bg-card border border-line p-2.5">
                  <FolderGit2 className="size-3.5 text-accent shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-ink">{profile.projects.length} Projects</span>
                    <span className="text-[10px] text-muted">Untouched descriptions</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-control bg-card border border-line p-2.5">
                  <Code className="size-3.5 text-success shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-ink">{profile.skills.length} Technical Skills</span>
                    <span className="text-[10px] text-muted">All categories present</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-control bg-card border border-line p-2.5">
                  <Award className="size-3.5 text-amber-500 shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-ink">{(profile.certifications || profile.publications || []).length} Certifications</span>
                    <span className="text-[10px] text-muted">Verified credentials</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Reasoning list */}
            {curationResult.tailored.reasoning && (
              <div className="flex flex-col gap-1.5 rounded-card bg-track/50 p-4 text-xs text-muted">
                <span className="font-semibold text-ink">Curation Insights &amp; Strategy:</span>
                {curationResult.tailored.reasoning.map((r: string, idx: number) => (
                  <p key={idx}>• {r}</p>
                ))}
              </div>
            )}

            {/* Action button */}
            <div className="flex items-center justify-end gap-3 border-t border-line pt-4">
              <Link
                href="/applications"
                className={buttonClassName("primary", "md", "flex items-center gap-2 hover:text-on-primary")}
              >
                <span>View in Tailored Resumes</span>
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        )}

        {/* Saved Tailored Resumes in Database */}
        <div className="flex flex-col gap-4 rounded-card border border-line-card bg-card p-6 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-primary" />
              <h2 className="font-serif text-lg font-semibold text-ink">
                Saved Tailored Resumes
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {candidates.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <Users className="size-3.5 text-muted shrink-0" />
                  <select
                    value={savedFilterUserId}
                    onChange={(e) => setSavedFilterUserId(e.target.value)}
                    className="h-7 rounded-control border border-line bg-card px-2 text-xs font-medium text-ink focus:border-primary focus:outline-none cursor-pointer"
                  >
                    <option value="all">All Profiles</option>
                    {candidates.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name ? `${c.name} (${c.email})` : c.email}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <span className="rounded-full bg-track px-2.5 py-0.5 text-xs font-semibold text-ink">
                {displayedGenerations.length} {displayedGenerations.length === 1 ? "Saved Application" : "Saved Applications"}
              </span>
            </div>
          </div>

          <p className="text-xs text-muted">
            All curated resumes and their original Job Descriptions are saved in your database. You can retrieve, inspect the JD, or reload any targeted resume at any time.
          </p>

          {loadingDrafts && (
            <div className="py-6 text-center text-xs text-muted">Loading saved applications…</div>
          )}

          {!loadingDrafts && displayedGenerations.length === 0 && (
            <div className="py-8 text-center text-xs text-muted border border-dashed border-line rounded-card">
              No saved job applications yet. Paste a job description above and click &quot;Analyze &amp; Curate Resume&quot; to create your first targeted resume.
            </div>
          )}

          <div className="flex flex-col gap-4">
            {displayedGenerations.map((gen: any) => {
              const isExpanded = expandedJdId === gen.generationId;
              return (
                <div
                  key={gen.generationId}
                  className="flex flex-col rounded-card border border-line bg-paper/60 p-4 transition-all hover:border-line-strong shadow-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-serif font-bold text-base text-ink">
                          {gen.title || "Target Role"}
                        </span>
                        <span className="text-muted">·</span>
                        <span className="text-xs font-semibold text-primary">
                          {gen.company || "Target Company"}
                        </span>
                        <span className="rounded-full bg-track px-2 py-0.5 text-[10px] font-medium text-muted">
                          {gen.candidates.length} {gen.candidates.length === 1 ? "Profile" : "Profiles"}
                        </span>
                      </div>
                      <span className="text-[11px] text-muted mt-0.5">
                        Created{" "}
                        {new Date(gen.created_at).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setExpandedJdId(isExpanded ? null : gen.generationId)}
                        className="flex items-center gap-1 rounded-control border border-line-card bg-card px-2.5 py-1 text-xs text-muted hover:text-ink cursor-pointer transition-colors"
                      >
                        <FileText className="size-3.5" />
                        <span>{isExpanded ? "Hide JD" : "View Stored JD"}</span>
                        {isExpanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                      </button>

                      <button
                        type="button"
                        title="Delete application"
                        onClick={() => handleDeleteGeneration(gen.generationId)}
                        className="p-1.5 rounded-control text-muted hover:text-danger hover:bg-danger-surface cursor-pointer transition-colors"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Candidate Profiles within this Generation */}
                  <div className="mt-3 flex flex-col gap-2 border-t border-line/60 pt-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                      Tailored Candidate Profiles:
                    </span>
                    <div className="flex flex-col gap-2">
                      {gen.candidates.map((draft: any) => (
                        <div
                          key={draft.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-control bg-card/70 p-2.5 border border-line/50 hover:border-line transition-all"
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="rounded-full bg-primary/10 text-primary border border-primary/20 px-2.5 py-0.5 text-xs font-semibold flex items-center gap-1.5">
                              <Users className="size-3" />
                              <span>{draft.userName || "Candidate"}</span>
                            </span>
                            <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[11px] font-bold">
                              {draft.match_score}% Match
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedDraftForReport(draft);
                                setShowAtsReport(true);
                              }}
                              className="flex items-center gap-1 rounded-control border border-line-card bg-card px-2.5 py-1 text-xs text-muted hover:text-ink cursor-pointer transition-colors"
                            >
                              <BarChart3 className="size-3.5 text-primary" />
                              <span>ATS Report</span>
                            </button>

                            <Link
                              href={`/applications?id=${draft.id}`}
                              className={buttonClassName("secondary", "sm", "flex items-center gap-1 cursor-pointer")}
                            >
                              <Eye className="size-3 text-primary" />
                              Preview &amp; Print
                            </Link>

                            <a
                              href={`/api/export-pdf?type=tailored&id=${draft.id}`}
                              download
                              className={buttonClassName("primary", "sm", "flex items-center gap-1 cursor-pointer shadow-raised")}
                            >
                              <Download className="size-3" />
                              <span>Download PDF</span>
                            </a>

                            {gen.candidates.length > 1 && (
                              <button
                                type="button"
                                title="Remove candidate profile"
                                onClick={() => handleDeleteDraft(draft.id)}
                                className="p-1 rounded-control text-muted hover:text-danger hover:bg-danger-surface cursor-pointer transition-colors"
                              >
                                <Trash2 className="size-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Expandable Stored Job Description */}
                  {isExpanded && (
                    <div className="mt-3 border-t border-line pt-3 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-ink">Original Stored Job Description:</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(gen.job_text)}
                          className="flex items-center gap-1 text-[11px] text-accent hover:underline cursor-pointer"
                        >
                          <Copy className="size-3" />
                          Copy JD Text
                        </button>
                      </div>
                      <pre className="max-h-60 overflow-y-auto whitespace-pre-wrap font-mono text-[11px] text-muted bg-card p-3 rounded-control border border-line leading-relaxed">
                        {gen.job_text}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Complete ATS Diagnostic Report Modal */}
      <AtsReportModal
        isOpen={showAtsReport}
        onClose={() => {
          setShowAtsReport(false);
          setSelectedDraftForReport(null);
        }}
        report={activeAtsReport}
        roleTitle={selectedDraftForReport?.title || curationResult?.analysis?.title || "Target Role"}
        companyName={selectedDraftForReport?.company || curationResult?.analysis?.company || "Target Company"}
      />
    </div>
  );
}
