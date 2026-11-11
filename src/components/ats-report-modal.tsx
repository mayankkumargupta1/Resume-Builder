"use client";

import { useState } from "react";
import {
  X,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  BarChart3,
  Check,
  Copy,
  Printer,
  Sparkles,
  Layers,
  ChevronRight,
  Info,
} from "lucide-react";
import type { AtsReport, PlatformAudit } from "@/lib/ats-engine";
import { toast } from "@/components/toast";

export interface AtsReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  report?: AtsReport | null;
  roleTitle?: string;
  companyName?: string;
}

export function AtsReportModal({
  isOpen,
  onClose,
  report,
  roleTitle = "Target Role",
  companyName = "Target Company",
}: AtsReportModalProps) {
  const [activePlatformTab, setActivePlatformTab] = useState<string>("Workday");

  if (!isOpen || !report) return null;

  const currentPlatform: PlatformAudit =
    report.platforms.find((p) => p.platform === activePlatformTab) || report.platforms[0];

  const handleCopySummary = () => {
    const text = `ATS Match Report for ${roleTitle} at ${companyName}
Overall Score: ${report.overallScore}%
- Skills Coverage: ${report.breakdown.skillsMatchScore}%
- Experience Context: ${report.breakdown.experienceRelevanceScore}%
- Role Alignment: ${report.breakdown.roleAlignmentScore}%
- Formatting Compliance: ${report.breakdown.parsingComplianceScore}%

Matched Skills: ${report.matchedSkills.join(", ")}
Missing Keywords: ${report.missingSkills.join(", ") || "None"}
`;
    navigator.clipboard.writeText(text);
    toast("ATS Diagnostic Summary copied to clipboard!");
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative flex flex-col w-full max-w-4xl max-h-[90vh] rounded-card border border-line bg-card shadow-2xl overflow-hidden">
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-line px-6 py-4 bg-paper/60">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-control bg-primary/10 text-primary">
              <BarChart3 className="size-5" />
            </div>
            <div>
              <h2 className="font-serif text-lg font-bold text-ink">
                Enterprise ATS Diagnostic Audit
              </h2>
              <p className="text-xs text-muted">
                {roleTitle} · <span className="font-medium text-ink">{companyName}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopySummary}
              title="Copy Summary"
              className="flex items-center gap-1.5 rounded-control border border-line bg-card px-2.5 py-1 text-xs text-muted hover:text-ink cursor-pointer transition-colors"
            >
              <Copy className="size-3.5" />
              <span className="hidden sm:inline">Copy Report</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-control text-muted hover:text-ink hover:bg-hover cursor-pointer transition-colors"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Top Score Banner & 4 Pillars */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch">
            {/* Overall Score Circle */}
            <div className="md:col-span-4 flex flex-col items-center justify-center rounded-card border border-line bg-gradient-to-b from-primary/5 via-card to-card p-6 text-center">
              <span className="text-xs font-semibold text-muted uppercase tracking-wider">
                Composite ATS Score
              </span>
              <div className="flex items-baseline gap-1 my-2">
                <span className="font-serif text-5xl font-black text-primary tracking-tight">
                  {report.overallScore}%
                </span>
              </div>
              <span
                className={`rounded-full px-3 py-0.5 text-xs font-bold ${
                  report.overallScore >= 85
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                    : report.overallScore >= 70
                    ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                    : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                }`}
              >
                {report.overallScore >= 85
                  ? "Tier-1 Auto-Qualified"
                  : report.overallScore >= 70
                  ? "Competitive Applicant"
                  : "Needs Optimization"}
              </span>
              <p className="text-[11px] text-muted mt-3 leading-relaxed">
                Deterministic calculation combining skill overlap, bullet context, and enterprise parsing standards.
              </p>
            </div>

            {/* 4 Pillars Grid */}
            <div className="md:col-span-8 grid grid-cols-2 gap-3">
              <div className="flex flex-col justify-between rounded-control border border-line bg-paper/50 p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-ink">Hard Skills Coverage</span>
                  <span className="font-mono text-xs font-bold text-primary">
                    {report.breakdown.skillsMatchScore}%
                  </span>
                </div>
                <div className="w-full bg-track rounded-full h-1.5 my-2 overflow-hidden">
                  <div
                    className="bg-primary h-full rounded-full transition-all duration-500"
                    style={{ width: `${report.breakdown.skillsMatchScore}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted">
                  {report.matchedSkills.length} matched vs {report.missingSkills.length} missing from JD
                </span>
              </div>

              <div className="flex flex-col justify-between rounded-control border border-line bg-paper/50 p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-ink">Bullet Context Proof</span>
                  <span className="font-mono text-xs font-bold text-accent">
                    {report.breakdown.experienceRelevanceScore}%
                  </span>
                </div>
                <div className="w-full bg-track rounded-full h-1.5 my-2 overflow-hidden">
                  <div
                    className="bg-accent h-full rounded-full transition-all duration-500"
                    style={{ width: `${report.breakdown.experienceRelevanceScore}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted">
                  Skills validated inside authentic work experiences
                </span>
              </div>

              <div className="flex flex-col justify-between rounded-control border border-line bg-paper/50 p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-ink">Role &amp; Title Persona</span>
                  <span className="font-mono text-xs font-bold text-success">
                    {report.breakdown.roleAlignmentScore}%
                  </span>
                </div>
                <div className="w-full bg-track rounded-full h-1.5 my-2 overflow-hidden">
                  <div
                    className="bg-success h-full rounded-full transition-all duration-500"
                    style={{ width: `${report.breakdown.roleAlignmentScore}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted">
                  Targeted headline and tailored summary alignment
                </span>
              </div>

              <div className="flex flex-col justify-between rounded-control border border-line bg-paper/50 p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-ink">ATS Format Compliance</span>
                  <span className="font-mono text-xs font-bold text-emerald-400">
                    {report.breakdown.parsingComplianceScore}%
                  </span>
                </div>
                <div className="w-full bg-track rounded-full h-1.5 my-2 overflow-hidden">
                  <div
                    className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                    style={{ width: `${report.breakdown.parsingComplianceScore}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted">
                  Standard headings, single-stream text, clean dates
                </span>
              </div>
            </div>
          </div>

          {/* Keyword & Skills Breakdown */}
          <div className="flex flex-col gap-3 rounded-card border border-line bg-paper/40 p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink flex items-center gap-2">
              <Layers className="size-4 text-primary" />
              <span>Keyword &amp; Technical Skills Intersect</span>
            </h3>

            {/* Matched Skills */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold text-success flex items-center gap-1">
                <Check className="size-3" />
                <span>Verified Matching Skills ({report.matchedSkills.length})</span>
              </span>
              <div className="flex flex-wrap gap-1.5">
                {report.matchedSkills.map((skill, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 rounded-full bg-success/15 border border-success/30 px-2.5 py-0.5 text-xs font-medium text-success"
                  >
                    <Check className="size-3 shrink-0" />
                    <span>{skill}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Missing Skills */}
            {report.missingSkills.length > 0 && (
              <div className="flex flex-col gap-1.5 mt-2 pt-2 border-t border-line">
                <span className="text-[11px] font-semibold text-amber-400 flex items-center gap-1">
                  <AlertCircle className="size-3" />
                  <span>JD Requirements Not in Profile ({report.missingSkills.length})</span>
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {report.missingSkills.map((skill, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 text-xs text-amber-300"
                    >
                      <span>{skill}</span>
                    </span>
                  ))}
                </div>
                <p className="text-[10px] text-muted italic mt-0.5">
                  Note: Under our zero-hallucination policy, missing skills are never fabricated. If you have experience with these, add them to your Master Profile.
                </p>
              </div>
            )}
          </div>

          {/* Platform-Specific ATS Simulator */}
          <div className="flex flex-col gap-3 rounded-card border border-line bg-paper/40 p-4">
            <div className="flex items-center justify-between border-b border-line pb-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-ink">
                  Enterprise ATS Parser Simulation
                </h3>
              </div>
              <span className="text-[11px] text-muted">Modeled after real vendor specs</span>
            </div>

            {/* Platform Selector Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {report.platforms.map((p) => {
                const isSelected = p.platform === currentPlatform.platform;
                return (
                  <button
                    key={p.platform}
                    type="button"
                    onClick={() => setActivePlatformTab(p.platform)}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium cursor-pointer transition-all ${
                      isSelected
                        ? "bg-primary text-on-primary font-bold shadow-xs"
                        : "bg-card text-muted border border-line hover:text-ink hover:border-line-strong"
                    }`}
                  >
                    <span>{p.platform}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        isSelected ? "bg-black/20 text-white" : "bg-track text-muted"
                      }`}
                    >
                      {p.score}%
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Active Platform Breakdown Box */}
            <div className="flex flex-col gap-3 rounded-control border border-line-card bg-card p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-serif font-bold text-sm text-ink">
                    {currentPlatform.platform} Simulator
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      currentPlatform.rating === "Excellent"
                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                        : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                    }`}
                  >
                    {currentPlatform.rating} ({currentPlatform.score}%)
                  </span>
                </div>
              </div>

              <p className="text-xs text-muted leading-relaxed">
                {currentPlatform.verdict}
              </p>

              {/* Checklist */}
              <div className="flex flex-col gap-2 mt-1">
                {currentPlatform.checks.map((chk, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2.5 rounded-control bg-paper/60 border border-line p-2.5 text-xs"
                  >
                    {chk.passed ? (
                      <CheckCircle2 className="size-4 text-success shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="size-4 text-amber-400 shrink-0 mt-0.5" />
                    )}
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold text-ink">{chk.name}</span>
                      <span className="text-[11px] text-muted">{chk.note}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Actionable Recommendations */}
          <div className="flex flex-col gap-2 rounded-card bg-track/40 border border-line p-4 text-xs">
            <span className="font-bold text-ink flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-accent" />
              <span>ATS Optimization Summary:</span>
            </span>
            <ul className="space-y-1.5 text-muted pl-4 list-disc text-[11px] leading-relaxed">
              {report.recommendations.map((rec, idx) => (
                <li key={idx}>{rec}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-line px-6 py-3 bg-paper/60">
          <div className="flex items-center gap-1 text-[11px] text-muted">
            <ShieldCheck className="size-3.5 text-success" />
            <span>Zero-Hallucination Verified · Authenticity Protected</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-control bg-primary text-on-primary px-4 py-1.5 text-xs font-semibold hover:bg-primary/90 cursor-pointer transition-colors"
          >
            Close Report
          </button>
        </div>
      </div>
    </div>
  );
}
