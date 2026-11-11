"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Sparkles,
  Search,
  Eye,
  Printer,
  Trash2,
  X,
  FileText,
  ExternalLink,
  BarChart3,
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
  initialDrafts: TailoredDraftRecord[];
  themes: ThemeData[];
  baseThemeId: string;
  initialPaper: PaperSize;
  includeReferences?: boolean;
  language?: string | null;
  initialSelectedId?: string | null;
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
}: ApplicationsTrackerProps) {
  const [drafts, setDrafts] = useState<TailoredDraftRecord[]>(initialDrafts);
  const [searchQuery, setSearchQuery] = useState("");
  const [previewDraft, setPreviewDraft] = useState<TailoredDraftRecord | null>(
    initialSelectedId
      ? initialDrafts.find((d) => d.id === initialSelectedId) || null
      : null
  );
  const [selectedReportDraft, setSelectedReportDraft] = useState<TailoredDraftRecord | null>(null);

  // Preview styling state
  const [activeThemeId, setActiveThemeId] = useState(baseThemeId);
  const [paper, setPaper] = useState<PaperSize>(initialPaper);

  const activeTheme = useMemo(
    () => themes.find((t) => t.id === activeThemeId) || themes[0],
    [themes, activeThemeId]
  );

  // Filtered list
  const filteredDrafts = useMemo(() => {
    if (!searchQuery.trim()) return drafts;
    const q = searchQuery.toLowerCase();
    return drafts.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.company.toLowerCase().includes(q)
    );
  }, [drafts, searchQuery]);

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
        {/* Compact search & count bar */}
        {drafts.length > 0 && (
          <div className="flex items-center justify-between gap-3 pt-2">
            <div className="relative w-72">
              <Search className="absolute left-3 top-2.5 size-3.5 text-muted" />
              <input
                type="text"
                placeholder="Filter by role or company..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-control border border-line bg-card pl-8 pr-3 py-1.5 text-xs text-ink placeholder:text-muted focus:border-primary focus:outline-none"
              />
            </div>
            <span className="text-xs text-muted">
              {filteredDrafts.length} {filteredDrafts.length === 1 ? "resume" : "resumes"}
            </span>
          </div>
        )}

        {/* ─── Resumes List ──────────────────────────────────────────────── */}
        {filteredDrafts.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-line p-12 text-center bg-card/30 mt-4">
            <div className="flex size-10 items-center justify-center rounded-full bg-track text-muted">
              <FileText className="size-5 text-muted" />
            </div>
            <div className="flex flex-col gap-0.5 max-w-sm">
              <p className="font-semibold text-sm text-ink">
                {drafts.length === 0 ? "No tailored resumes yet" : "No matching resumes found"}
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
            {filteredDrafts.map((draft) => {
              const displayTitle = cleanJobTitle(draft.title);
              const displayCompany = draft.company && draft.company !== "Target Company" ? draft.company : "";

              return (
                <div
                  key={draft.id}
                  onClick={() => setPreviewDraft(draft)}
                  className="flex items-center justify-between gap-4 p-4 hover:bg-hover transition-colors cursor-pointer group"
                >
                  {/* Left: Role, Company, Date */}
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
                    </div>
                    <span className="text-[11px] text-muted">
                      Created {draft.created_at?.slice(0, 10)}
                    </span>
                  </div>

                  {/* Right: Match Score & Action Buttons */}
                  <div className="flex items-center gap-3 shrink-0">
                    {/* Match Score */}
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

                    {/* View ATS Report Button */}
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

                    {/* View Resume Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewDraft(draft);
                      }}
                      className="flex items-center gap-1.5 rounded-control border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:bg-hover transition-colors cursor-pointer"
                    >
                      <Eye className="size-3.5 text-primary" />
                      <span>View</span>
                    </button>

                    {/* Standalone Print */}
                    <Link
                      href={`/print/tailored/${draft.id}`}
                      target="_blank"
                      onClick={(e) => e.stopPropagation()}
                      title="Open print view in new tab"
                      className="p-1.5 rounded-control text-muted hover:text-ink hover:bg-surface border border-transparent hover:border-line transition-colors cursor-pointer"
                    >
                      <Printer className="size-3.5" />
                    </Link>

                    {/* Delete */}
                    <button
                      type="button"
                      title="Delete resume"
                      onClick={(e) => handleDeleteDraft(draft.id, e)}
                      className="p-1.5 rounded-control text-muted hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
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

              {/* Print */}
              <Button
                variant="primary"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="size-3.5" />
                <span>Print / PDF</span>
              </Button>
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
                profile={profile}
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
              profile,
              selectedReportDraft.job_text || "",
              selectedReportDraft.analysis || {},
              profile.basics.headline,
              profile.basics.summary
            )
          }
          roleTitle={selectedReportDraft.title || "Target Role"}
          companyName={selectedReportDraft.company || "Target Company"}
        />
      )}
    </div>
  );
}
