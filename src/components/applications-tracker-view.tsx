"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Search,
  Eye,
  Printer,
  Download,
  Trash2,
  X,
  FileText,
  ExternalLink,
  BarChart3,
  Users,
} from "lucide-react";
import { AtsReportModal } from "@/components/ats-report-modal";
import { generateAtsReport } from "@/lib/ats-engine";
import { PageHeader } from "@/components/page-header";
import { toast } from "@/components/toast";
import { Button, buttonClassName } from "@/components/ui/button";
import { DocumentPreview } from "@/components/documents/document-preview";
import { ResumeDocument } from "@/components/documents/resume-document";
import { PaperSize } from "@/lib/enums";
import type { ProfileData } from "@/lib/profile";
import { PAPER_SIZES, type ThemeData } from "@/lib/themes";
import type { TailoredDraftRecord } from "@/lib/db";

export type ApplicationsTrackerProps = {
  profile: ProfileData;
  initialDrafts: (TailoredDraftRecord & { userName?: string; userEmail?: string })[];
  themes: ThemeData[];
  baseThemeId: string;
  initialPaper: PaperSize;
  includeReferences?: boolean;
  language?: string | null;
  initialSelectedId?: string | null;
  isAdmin?: boolean;
  candidates?: { id: string; name: string; email: string }[];
  selectedCandidateId?: string;
};

// Clean title if it contains multi-line text or prefix
function cleanJobTitle(title: string): string {
  if (!title) return "Target Role";
  const firstLine = title.split("\n")[0].trim();
  const cleaned = firstLine.replace(/^(Role|Position|Job Title):\s*/i, "").trim();
  return cleaned.length > 70 ? cleaned.slice(0, 67) + "..." : cleaned;
}

export function ApplicationsTrackerView({
  profile,
  initialDrafts,
  themes,
  baseThemeId,
  initialPaper,
  includeReferences = false,
  language = null,
  initialSelectedId = null,
  isAdmin = false,
  candidates = [],
  selectedCandidateId = "all",
}: ApplicationsTrackerProps) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<(TailoredDraftRecord & { userName?: string; userEmail?: string })[]>(initialDrafts);
  const [activeProfile, setActiveProfile] = useState<ProfileData>(profile);
  const [candidateFilter, setCandidateFilter] = useState(selectedCandidateId);
  const [searchQuery, setSearchQuery] = useState("");
  const [previewDraft, setPreviewDraft] = useState<(TailoredDraftRecord & { userName?: string; userEmail?: string }) | null>(
    initialSelectedId
      ? initialDrafts.find((d) => d.id === initialSelectedId) || null
      : null
  );
  const [selectedReportDraft, setSelectedReportDraft] = useState<TailoredDraftRecord | null>(null);

  useEffect(() => {
    setActiveProfile(profile);
  }, [profile]);

  useEffect(() => {
    setDrafts(initialDrafts);
  }, [initialDrafts]);

  // Preview styling state
  const [activeThemeId, setActiveThemeId] = useState(baseThemeId);
  const [paper, setPaper] = useState<PaperSize>(initialPaper);

  const activeTheme = useMemo(
    () => themes.find((t) => t.id === activeThemeId) || themes[0],
    [themes, activeThemeId]
  );

  // Switch preview draft and dynamically fetch candidate profile if admin
  const handleSelectPreviewDraft = async (draft: TailoredDraftRecord & { userName?: string; userEmail?: string }) => {
    setPreviewDraft(draft);
    if (isAdmin && draft.user_id) {
      try {
        const res = await fetch(`/api/profile?userId=${draft.user_id}`);
        const data = await res.json();
        if (data.success && data.profile) {
          setActiveProfile(data.profile);
        }
      } catch {
        // ignore
      }
    }
  };

  // Filtered list
  const filteredDrafts = useMemo(() => {
    let list = drafts;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.company.toLowerCase().includes(q) ||
          (d.userName && d.userName.toLowerCase().includes(q))
      );
    }
    return list;
  }, [drafts, searchQuery]);

  // Group drafts by generation so there is only ONE entry per generation run
  const filteredGenerations = useMemo(() => {
    const map = new Map<
      string,
      {
        generationId: string;
        title: string;
        company: string;
        job_text: string;
        created_at: string;
        candidates: (TailoredDraftRecord & { userName?: string; userEmail?: string })[];
      }
    >();

    for (const draft of filteredDrafts) {
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
  }, [filteredDrafts]);

  // Sibling drafts in the same generation for switching in preview modal
  const siblingDrafts = useMemo(() => {
    if (!previewDraft) return [];
    const genId = previewDraft.generation_id || previewDraft.id;
    return drafts.filter((d) => (d.generation_id || d.id) === genId);
  }, [previewDraft, drafts]);

  // Delete generation
  const handleDeleteGeneration = async (genId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this tailored job application and all candidate resumes generated for it?")) return;

    try {
      const res = await fetch(`/api/tailored-drafts?id=${genId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setDrafts((prev) =>
          prev.filter((d) => (d.generation_id || d.id) !== genId && d.id !== genId)
        );
        if (
          previewDraft &&
          ((previewDraft.generation_id || previewDraft.id) === genId || previewDraft.id === genId)
        ) {
          setPreviewDraft(null);
        }
        toast("Application deleted.");
      } else {
        toast("Failed to delete application.");
      }
    } catch {
      toast("Error deleting application.");
    }
  };

  // Delete draft
  const handleDeleteDraft = async (draftId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this tailored resume?")) return;

    try {
      const res = await fetch(`/api/tailored-drafts?id=${draftId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setDrafts((prev) => prev.filter((d) => d.id !== draftId));
        if (previewDraft?.id === draftId) setPreviewDraft(null);
        toast("Resume deleted.");
      } else {
        toast("Failed to delete resume.");
      }
    } catch {
      toast("Error deleting resume.");
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      {/* ─── Minimal Page Header ────────────────────────────────────────── */}
      <PageHeader
        title="Tailored Resumes"
        actions={
          <Link
            href="/tailor"
            className={buttonClassName("primary", "sm", "flex items-center gap-1.5")}
          >
            <Sparkles className="size-3.5" />
            <span>Tailor for New Job</span>
          </Link>
        }
      />

      <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-4 px-8 pb-16">
        {/* Compact search, candidate filter & count bar */}
        {drafts.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-3 flex-wrap flex-1">
              <div className="relative w-64">
                <Search className="absolute left-3 top-2.5 size-3.5 text-muted" />
                <input
                  type="text"
                  placeholder="Filter by role, company, or person..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-control border border-line bg-card pl-8 pr-3 py-1.5 text-xs text-ink placeholder:text-muted focus:border-primary focus:outline-none"
                />
              </div>

              {candidates.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <Users className="size-3.5 text-muted shrink-0" />
                  <select
                    id="candidate-filter"
                    value={candidateFilter}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCandidateFilter(val);
                      if (val && val !== "all") {
                        router.push(`/applications?candidateId=${val}`);
                      } else {
                        router.push("/applications");
                      }
                    }}
                    className="h-8 rounded-control border border-line bg-card px-2.5 text-xs font-medium text-ink focus:border-primary focus:outline-none cursor-pointer"
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
            </div>

            <span className="text-xs text-muted">
              {filteredGenerations.length} {filteredGenerations.length === 1 ? "application" : "applications"}
            </span>
          </div>
        )}

        {/* ─── Applications List ────────────────────────────────────────── */}
        {filteredGenerations.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-line p-12 text-center bg-card/30 mt-4">
            <div className="flex size-10 items-center justify-center rounded-full bg-track text-muted">
              <FileText className="size-5 text-muted" />
            </div>
            <div className="flex flex-col gap-0.5 max-w-sm">
              <p className="font-semibold text-sm text-ink">
                {drafts.length === 0 ? "No tailored resumes yet" : "No matching applications found"}
              </p>
              <p className="text-xs text-muted">
                {drafts.length === 0
                  ? "Paste a job description in Tailor for Job to generate and save a tailored version here."
                  : "Try a different search query."}
              </p>
            </div>
            {drafts.length === 0 && (
              <Link
                href="/tailor"
                className={buttonClassName("primary", "sm", "flex items-center gap-1.5 mt-2")}
              >
                <Sparkles className="size-3.5" />
                <span>Tailor a Resume</span>
              </Link>
            )}
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-line rounded-card border border-line bg-card overflow-hidden shadow-xs">
            {filteredGenerations.map((gen) => {
              const displayTitle = cleanJobTitle(gen.title);
              const displayCompany = gen.company && gen.company !== "Target Company" ? gen.company : "";

              // Single candidate generation
              if (gen.candidates.length === 1) {
                const draft = gen.candidates[0];
                return (
                  <div
                    key={gen.generationId}
                    onClick={() => handleSelectPreviewDraft(draft)}
                    className="flex items-center justify-between gap-4 p-4 hover:bg-hover transition-colors cursor-pointer group"
                  >
                    {/* Left: Role, Company, Candidate, Date */}
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-ink group-hover:text-primary transition-colors">
                          {displayTitle}
                        </span>
                        {displayCompany && (
                          <span className="rounded bg-track px-2 py-0.5 text-xs text-muted font-medium">
                            {displayCompany}
                          </span>
                        )}
                        {draft.userName && (
                          <span className="rounded-full bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 text-[10px] font-semibold flex items-center gap-1">
                            <Users className="size-2.5" />
                            <span>{draft.userName}</span>
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-muted">
                        Created {draft.created_at?.slice(0, 10)}
                      </span>
                    </div>

                    {/* Right: Match Score & Action Buttons */}
                    <div className="flex items-center gap-3 shrink-0">
                      {draft.match_score > 0 && (
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            draft.match_score >= 85
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          }`}
                        >
                          {draft.match_score}%
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedReportDraft(draft);
                        }}
                        className="flex items-center gap-1.5 rounded-control border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-muted hover:text-ink hover:bg-hover transition-colors cursor-pointer"
                      >
                        <BarChart3 className="size-3.5 text-primary" />
                        <span className="hidden sm:inline">ATS Report</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectPreviewDraft(draft);
                        }}
                        className="flex items-center gap-1.5 rounded-control border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:bg-hover transition-colors cursor-pointer"
                      >
                        <Eye className="size-3.5 text-primary" />
                        <span>View</span>
                      </button>

                      <a
                        href={`/api/export-pdf?type=tailored&id=${draft.id}`}
                        download
                        onClick={(e) => e.stopPropagation()}
                        title="Download PDF directly"
                        className="p-1.5 rounded-control text-muted hover:text-ink hover:bg-surface border border-transparent hover:border-line transition-colors cursor-pointer"
                      >
                        <Download className="size-3.5" />
                      </a>

                      <button
                        type="button"
                        title="Delete application"
                        onClick={(e) => handleDeleteGeneration(gen.generationId, e)}
                        className="p-1.5 rounded-control text-muted hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                );
              }

              // Multi-candidate generation (Unified 1 Entry per Generation)
              return (
                <div
                  key={gen.generationId}
                  className="flex flex-col p-4 gap-3 hover:bg-hover/40 transition-colors group"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-ink group-hover:text-primary transition-colors">
                        {displayTitle}
                      </span>
                      {displayCompany && (
                        <span className="rounded bg-track px-2 py-0.5 text-xs text-muted font-medium">
                          {displayCompany}
                        </span>
                      )}
                      <span className="rounded-full bg-track px-2 py-0.5 text-[10px] font-semibold text-muted">
                        {gen.candidates.length} Profiles
                      </span>
                      <span className="text-[11px] text-muted">
                        Created {gen.created_at?.slice(0, 10)}
                      </span>
                    </div>

                    <button
                      type="button"
                      title="Delete application"
                      onClick={(e) => handleDeleteGeneration(gen.generationId, e)}
                      className="p-1.5 rounded-control text-muted hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>

                  {/* Candidates nested in this unified generation entry */}
                  <div className="flex flex-col gap-2 pl-3 border-l-2 border-line">
                    {gen.candidates.map((draft) => (
                      <div
                        key={draft.id}
                        onClick={() => handleSelectPreviewDraft(draft)}
                        className="flex items-center justify-between gap-3 p-2 rounded-control bg-surface/80 hover:bg-surface border border-line/50 hover:border-line cursor-pointer transition-all"
                      >
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-primary/10 text-primary border border-primary/20 px-2.5 py-0.5 text-xs font-semibold flex items-center gap-1.5">
                            <Users className="size-3" />
                            <span>{draft.userName || "Candidate"}</span>
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {draft.match_score > 0 && (
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                                draft.match_score >= 85
                                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                  : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                              }`}
                            >
                              {draft.match_score}%
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedReportDraft(draft);
                            }}
                            className="flex items-center gap-1 rounded-control border border-line bg-card px-2 py-1 text-xs font-medium text-muted hover:text-ink transition-colors cursor-pointer"
                          >
                            <BarChart3 className="size-3 text-primary" />
                            <span>ATS Report</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectPreviewDraft(draft);
                            }}
                            className="flex items-center gap-1 rounded-control border border-line bg-card px-2.5 py-1 text-xs font-medium text-ink transition-colors cursor-pointer"
                          >
                            <Eye className="size-3 text-primary" />
                            <span>View</span>
                          </button>

                          <a
                            href={`/api/export-pdf?type=tailored&id=${draft.id}`}
                            download
                            onClick={(e) => e.stopPropagation()}
                            title="Download PDF directly"
                            className="p-1 rounded-control text-muted hover:text-ink hover:bg-card border border-transparent hover:border-line transition-colors cursor-pointer"
                          >
                            <Download className="size-3.5" />
                          </a>

                          <button
                            type="button"
                            title="Remove candidate"
                            onClick={(e) => handleDeleteDraft(draft.id, e)}
                            className="p-1 rounded-control text-muted hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Clean Resume Preview Modal ──────────────────────────────────── */}
      {previewDraft && (
        <div className="fixed inset-0 z-50 flex flex-col bg-paper/95 backdrop-blur-md">
          {/* Minimal Preview Header */}
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-line bg-card px-6">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setPreviewDraft(null)}
                className="flex items-center gap-1 rounded-control border border-line px-2.5 py-1.5 text-xs text-muted hover:text-ink hover:bg-hover transition-colors cursor-pointer shrink-0"
              >
                <X className="size-4" />
                <span>Close</span>
              </button>

              <div className="h-4 w-px bg-line shrink-0" />

              <span className="font-serif font-bold text-ink truncate">
                {cleanJobTitle(previewDraft.title)}
              </span>
              {previewDraft.company && previewDraft.company !== "Target Company" && (
                <span className="text-xs text-muted shrink-0">at {previewDraft.company}</span>
              )}
              {previewDraft.userName && (
                <span className="rounded-full bg-primary/10 text-primary border border-primary/20 px-2.5 py-0.5 text-xs font-semibold flex items-center gap-1 shrink-0">
                  <Users className="size-3" />
                  <span>{previewDraft.userName}</span>
                </span>
              )}

              {/* Sibling candidates switcher within the same generation */}
              {siblingDrafts.length > 1 && (
                <div className="flex items-center gap-1 bg-surface p-0.5 rounded-control border border-line shrink-0">
                  {siblingDrafts.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => handleSelectPreviewDraft(d)}
                      className={`px-2 py-0.5 text-xs rounded-[5px] font-medium transition-all cursor-pointer ${
                        previewDraft.id === d.id
                          ? "bg-primary text-on-primary font-semibold shadow-xs"
                          : "text-muted hover:text-ink"
                      }`}
                    >
                      {d.userName || "Candidate"} ({d.match_score}%)
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3 shrink-0">
              {/* Theme Picker */}
              <select
                aria-label="Theme"
                value={activeThemeId}
                onChange={(e) => setActiveThemeId(e.target.value)}
                className="rounded border border-line bg-surface px-2.5 py-1 text-xs text-ink focus:outline-none cursor-pointer"
              >
                {themes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>

              {/* Paper Size */}
              <div className="flex gap-1 rounded-control border border-line bg-surface p-0.5">
                {(["LETTER", "A4"] as PaperSize[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPaper(p)}
                    className={`rounded-[5px] px-2 py-0.5 text-xs font-medium cursor-pointer ${
                      paper === p
                        ? "bg-primary text-on-primary font-semibold"
                        : "text-muted hover:text-ink"
                    }`}
                  >
                    {p === "LETTER" ? "Letter" : "A4"}
                  </button>
                ))}
              </div>

              {/* ATS Diagnostic Report */}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedReportDraft(previewDraft)}
                className="flex items-center gap-1.5 cursor-pointer"
              >
                <BarChart3 className="size-3.5 text-primary" />
                <span>ATS Report</span>
              </Button>

              {/* Direct PDF Download */}
              <a
                href={`/api/export-pdf?type=tailored&id=${previewDraft.id}`}
                download
                className={buttonClassName("primary", "sm") + " flex items-center gap-1.5 cursor-pointer shadow-raised"}
              >
                <Download className="size-3.5" />
                <span>Download PDF</span>
              </a>
            </div>
          </div>

          {/* Document Canvas */}
          <div className="flex-1 overflow-auto bg-surface p-6 flex justify-center">
            <DocumentPreview
              label={activeTheme.name}
              meta={(pages) =>
                `${PAPER_SIZES[paper].label} · ${pages} ${pages === 1 ? "page" : "pages"}`
              }
            >
              <ResumeDocument
                theme={activeTheme}
                profile={activeProfile}
                paper={paper}
                includeReferences={includeReferences}
                language={language}
                units={previewDraft.units}
              />
            </DocumentPreview>
          </div>
        </div>
      )}

      {/* Complete ATS Diagnostic Report Modal */}
      {selectedReportDraft && (
        <AtsReportModal
          isOpen={Boolean(selectedReportDraft)}
          onClose={() => setSelectedReportDraft(null)}
          report={
            selectedReportDraft.analysis?.atsReport ||
            generateAtsReport(
              activeProfile,
              selectedReportDraft.job_text || "",
              selectedReportDraft.analysis || {},
              activeProfile.basics.headline,
              activeProfile.basics.summary
            )
          }
          roleTitle={selectedReportDraft.title || "Target Role"}
          companyName={selectedReportDraft.company || "Target Company"}
        />
      )}
    </div>
  );
}
