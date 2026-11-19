"use client";

import { useState, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { UploadCloud, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SavedIndicator } from "@/components/saved-indicator";
import { Button, buttonClassName } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { factTexts, filledBasics, REQUIRED_BASICS, type EntryOrder, type ProfileData } from "@/lib/profile";
import { BasicsSection } from "./basics-section";
import { EducationSection } from "./education-section";
import { ExperienceSection } from "./experience-section";
import { FactsSection } from "./facts-section";
import { ProjectsSection } from "./projects-section";
import { CertificationsSection } from "./certifications-section";
import { ReferencesSection } from "./references-section";
import { TrackSaveContext, useSaveTracker } from "@/components/save-tracker";
import { SkillsSection } from "./skills-section";
import { StrengthMeter } from "./strength-meter";
import { SECTIONS, type SectionId } from "./sections";
import { CvImportModal } from "./cv-import-modal";

export type ProfileOrder = { experience: EntryOrder; projects: EntryOrder; education: EntryOrder };

export function ProfileEditor({
  initial,
  initialSection = "basics",
  order = { experience: "date", projects: "date", education: "date" },
  onUpdateProfile,
  onNavigateToResume,
}: {
  initial: ProfileData;
  initialSection?: SectionId;
  order?: ProfileOrder;
  onUpdateProfile?: (updated: ProfileData) => void;
  onNavigateToResume?: () => void;
}) {
  const [profile, setProfile] = useState(initial);
  const [section, setSection] = useState<SectionId>(initialSection);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [dismissedPrompt, setDismissedPrompt] = useState(false);
  const saves = useSaveTracker();

  useEffect(() => {
    if (typeof window !== "undefined") {
      setDismissedPrompt(localStorage.getItem("dismissed_cv_prompt") === "true");
    }
  }, []);

  useEffect(() => {
    setProfile(initial);
  }, [initial]);

  useEffect(() => {
    if (initialSection) {
      setSection(initialSection);
    }
  }, [initialSection]);

  const handleUpdate = (updater: ProfileData | ((prev: ProfileData) => ProfileData)) => {
    setProfile((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      onUpdateProfile?.(next);
      return next;
    });
  };

  const isNewUser =
    profile.experience.length === 0 &&
    profile.projects.length === 0 &&
    profile.education.length === 0 &&
    profile.skills.length === 0;

  const showPrompt = isNewUser && !dismissedPrompt;

  const index = SECTIONS.findIndex((entry) => entry.id === section);
  const current = SECTIONS[index] || SECTIONS[0];
  const previous = SECTIONS[index - 1];
  const next = SECTIONS[index + 1];

  const counts: Record<SectionId, string> = {
    basics: `${filledBasics(profile.basics)}/${REQUIRED_BASICS.length}`,
    skills: String(profile.skills.length + profile.languages.length),
    experience: String(profile.experience.length),
    projects: String(profile.projects.length),
    education: String(profile.education.length),
    certifications: String((profile.certifications || profile.publications || []).length),
    references: String(profile.references.length),
    facts: String(factTexts(profile.facts).length),
  };

  const body: Record<SectionId, ReactNode> = {
    basics: (
      <BasicsSection
        basics={profile.basics}
        onChange={(basics) => handleUpdate((c) => ({ ...c, basics }))}
        photo={profile.photo}
        onPhotoChange={(photo) => handleUpdate((c) => ({ ...c, photo }))}
      />
    ),
    skills: <SkillsSection profile={profile} update={handleUpdate} />,
    experience: <ExperienceSection profile={profile} update={handleUpdate} order={order.experience} />,
    projects: <ProjectsSection profile={profile} update={handleUpdate} order={order.projects} />,
    education: <EducationSection profile={profile} update={handleUpdate} order={order.education} />,
    certifications: <CertificationsSection profile={profile} update={handleUpdate} />,
    references: <ReferencesSection profile={profile} update={handleUpdate} />,
    facts: <FactsSection profile={profile} update={handleUpdate} />,
  };

  return (
    <TrackSaveContext value={saves.track}>
      <div className="flex flex-1 flex-col min-w-0 bg-paper">
        <PageHeader
          title="Your profile"
          description="Everything here feeds your resumes and cover letters. Fill in what you like. All your projects, experience, and skills are saved directly."
          actions={
            <div className="flex items-center gap-3">
              <SavedIndicator status={saves.status} savedAt={saves.savedAt} />
              <Button
                variant="secondary"
                onClick={() => setIsImportModalOpen(true)}
                className="flex items-center gap-1.5 cursor-pointer"
              >
                <UploadCloud className="size-3.5 text-primary" />
                <span>Import CV</span>
              </Button>
              {onNavigateToResume ? (
                <Button variant="primary" onClick={onNavigateToResume}>
                  See base resume →
                </Button>
              ) : (
                <Link href="/resume" className={buttonClassName("primary", "md", "hover:text-on-primary")}>
                  See base resume →
                </Link>
              )}
            </div>
          }
        />

        {showPrompt && (
          <div className="mx-8 mt-4 rounded-card border border-primary/30 bg-primary/5 p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="flex size-10 items-center justify-center rounded-control bg-primary/10 text-primary shrink-0">
                  <Sparkles className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-ink">Import data from your existing CV</h3>
                  <p className="text-sm text-muted">
                    Welcome! Upload your existing CV or resume (PDF, Word, or text) to automatically fill in your profile, projects, and skills. You'll be able to review and edit everything before saving.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <Button
                  variant="primary"
                  onClick={() => setIsImportModalOpen(true)}
                  className="flex items-center gap-2 cursor-pointer font-semibold shadow-cta"
                >
                  <UploadCloud className="size-4" />
                  <span>Import from CV</span>
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setDismissedPrompt(true);
                    try {
                      localStorage.setItem("dismissed_cv_prompt", "true");
                    } catch {}
                  }}
                  className="cursor-pointer"
                >
                  Start from scratch
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-1 flex-row items-start justify-center gap-x-12 gap-y-10 px-8 pt-4 pb-24 max-w-[1240px] mx-auto w-full">
          {/* Left Column: Strength meter & Section Nav */}
          <div className="w-[240px] shrink-0 sticky top-20 flex flex-col gap-6">
            <StrengthMeter profile={profile} />
            <nav aria-label="Profile sections" className="flex flex-col gap-0.5 rounded-card border border-line-card bg-card/60 p-1.5 shadow-xs">
              {SECTIONS.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setSection(entry.id)}
                  aria-current={entry.id === section ? "page" : undefined}
                  className={cn(
                    "flex items-center justify-between rounded-control px-3 py-[9px] text-sm text-ink hover:bg-hover hover:text-ink text-left w-full cursor-pointer transition-colors",
                    entry.id === section && "bg-selected font-semibold text-ink shadow-xs",
                  )}
                >
                  <span>{entry.label}</span>
                  <span className="text-xs text-muted font-normal tabular-nums">{counts[entry.id]}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* Right Column: Section Form */}
          <section aria-labelledby="section-heading" className="flex-1 min-w-0 max-w-[760px] flex flex-col gap-8">
            <div className="flex flex-col gap-1 border-b border-line pb-4">
              <h2 id="section-heading" className="font-serif text-2xl font-semibold text-ink">
                {current.label}
              </h2>
              <p className="text-sm text-muted">{current.hint}</p>
            </div>

            {body[section]}

            <div className="flex items-center justify-between border-t border-line pt-6">
              {previous ? (
                <Button variant="secondary" onClick={() => setSection(previous.id)}>
                  ← {previous.label}
                </Button>
              ) : <span />}
              {next ? (
                <Button variant="secondary" onClick={() => setSection(next.id)}>
                  {next.label} →
                </Button>
              ) : onNavigateToResume ? (
                <Button variant="primary" onClick={onNavigateToResume}>
                  See base resume →
                </Button>
              ) : (
                <Link href="/resume" className={buttonClassName("primary", "md", "hover:text-on-primary")}>
                  See base resume →
                </Link>
              )}
            </div>
          </section>
        </div>

        <CvImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onImportSuccess={(imported) => {
            handleUpdate(imported);
            setDismissedPrompt(true);
            try {
              localStorage.setItem("dismissed_cv_prompt", "true");
            } catch {}
          }}
          currentProfile={profile}
        />
      </div>
    </TrackSaveContext>
  );
}
