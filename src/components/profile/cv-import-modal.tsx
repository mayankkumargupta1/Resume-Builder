"use client";

import { useState, useRef, useId, type ChangeEvent, type DragEvent } from "react";
import {
  UploadCloud,
  FileText,
  Sparkles,
  Check,
  X,
  Trash2,
  Plus,
  ArrowLeft,
  Briefcase,
  GraduationCap,
  FolderGit2,
  Wrench,
  User,
  Award,
  Globe,
  Loader2,
} from "lucide-react";
import { Button, buttonClassName } from "@/components/ui/button";
import { toast } from "@/components/toast";
import { cn } from "@/lib/cn";
import {
  type ProfileData,
  type ExperienceItem,
  type EducationItem,
  type ProjectItem,
  type SkillItem,
  type CertificationItem,
  type LanguageItem,
  LANGUAGE_LEVELS,
} from "@/lib/profile";
import { LanguageLevel } from "@/lib/enums";

export interface CvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (importedProfile: ProfileData) => void;
  currentProfile?: ProfileData;
}

type TabType = "basics" | "experience" | "education" | "projects" | "skills" | "certifications";

export function CvImportModal({
  isOpen,
  onClose,
  onImportSuccess,
  currentProfile,
}: CvImportModalProps) {
  const [step, setStep] = useState<"upload" | "review">("upload");
  const [inputMode, setInputMode] = useState<"file" | "text">("file");
  const [file, setFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // Review & Confirmation State
  const [draftProfile, setDraftProfile] = useState<ProfileData | null>(null);
  const [activeReviewTab, setActiveReviewTab] = useState<TabType>("basics");
  const [newSkillName, setNewSkillName] = useState("");
  const [newSkillGroup, setNewSkillGroup] = useState("Technical Skills");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  if (!isOpen) return null;

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      setFile(droppedFile);
      setParseError(null);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setParseError(null);
    }
  };

  const handleParse = async () => {
    if (inputMode === "file" && !file) {
      setParseError("Please select a CV/Resume file (PDF, DOCX, TXT, or JSON).");
      return;
    }
    if (inputMode === "text" && !rawText.trim()) {
      setParseError("Please paste your CV or resume text.");
      return;
    }

    setIsParsing(true);
    setParseError(null);

    try {
      let res: Response;
      if (inputMode === "file" && file) {
        const formData = new FormData();
        formData.append("file", file);
        res = await fetch("/api/parse-cv", {
          method: "POST",
          body: formData,
        });
      } else {
        res = await fetch("/api/parse-cv", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: rawText }),
        });
      }

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to parse CV.");
      }

      setDraftProfile(data.profile);
      setStep("review");
      toast("CV parsed successfully! Review the extracted data below.");
    } catch (err: any) {
      setParseError(err.message || "Failed to parse CV. Please verify the file and try again.");
    } finally {
      setIsParsing(false);
    }
  };

  const handleConfirmSave = async () => {
    if (!draftProfile) return;

    try {
      // Save directly to the user's profile in the database
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftProfile),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save profile.");
      }

      onImportSuccess(draftProfile);
      toast("CV imported and profile updated successfully!");
      onClose();
    } catch (err: any) {
      toast(err.message || "Failed to save imported profile.");
    }
  };

  // ─── Draft Modification Helpers ──────────────────────────────────────────

  const updateBasics = (field: keyof ProfileData["basics"], value: string) => {
    if (!draftProfile) return;
    setDraftProfile({
      ...draftProfile,
      basics: {
        ...draftProfile.basics,
        [field]: value,
      },
    });
  };

  const updateExperience = (index: number, patch: Partial<ExperienceItem>) => {
    if (!draftProfile) return;
    const updated = [...draftProfile.experience];
    updated[index] = { ...updated[index], ...patch };
    setDraftProfile({ ...draftProfile, experience: updated });
  };

  const deleteExperience = (index: number) => {
    if (!draftProfile) return;
    const updated = draftProfile.experience.filter((_, i) => i !== index);
    setDraftProfile({ ...draftProfile, experience: updated });
  };

  const addExperience = () => {
    if (!draftProfile) return;
    const newExp: ExperienceItem = {
      id: `exp-${Date.now()}`,
      role: "Job Title",
      company: "Company Name",
      location: "",
      descriptor: "",
      startMonth: 1,
      startYear: new Date().getFullYear(),
      endMonth: null,
      endYear: null,
      current: true,
      bullets: "",
      skillIds: [],
    };
    setDraftProfile({ ...draftProfile, experience: [newExp, ...draftProfile.experience] });
  };

  const updateEducation = (index: number, patch: Partial<EducationItem>) => {
    if (!draftProfile) return;
    const updated = [...draftProfile.education];
    updated[index] = { ...updated[index], ...patch };
    setDraftProfile({ ...draftProfile, education: updated });
  };

  const deleteEducation = (index: number) => {
    if (!draftProfile) return;
    const updated = draftProfile.education.filter((_, i) => i !== index);
    setDraftProfile({ ...draftProfile, education: updated });
  };

  const addEducation = () => {
    if (!draftProfile) return;
    const newEdu: EducationItem = {
      id: `edu-${Date.now()}`,
      degree: "Degree / Program",
      school: "University / Institution",
      location: "",
      startMonth: null,
      startYear: null,
      endMonth: null,
      endYear: null,
      current: false,
      notes: "",
    };
    setDraftProfile({ ...draftProfile, education: [newEdu, ...draftProfile.education] });
  };

  const updateProject = (index: number, patch: Partial<ProjectItem>) => {
    if (!draftProfile) return;
    const updated = [...draftProfile.projects];
    updated[index] = { ...updated[index], ...patch };
    setDraftProfile({ ...draftProfile, projects: updated });
  };

  const deleteProject = (index: number) => {
    if (!draftProfile) return;
    const updated = draftProfile.projects.filter((_, i) => i !== index);
    setDraftProfile({ ...draftProfile, projects: updated });
  };

  const addProject = () => {
    if (!draftProfile) return;
    const newProj: ProjectItem = {
      id: `proj-${Date.now()}`,
      name: "Project Name",
      link: "",
      startMonth: null,
      startYear: null,
      endMonth: null,
      endYear: null,
      current: false,
      bullets: "",
      skillIds: [],
    };
    setDraftProfile({ ...draftProfile, projects: [newProj, ...draftProfile.projects] });
  };

  const deleteSkill = (id: string) => {
    if (!draftProfile) return;
    setDraftProfile({
      ...draftProfile,
      skills: draftProfile.skills.filter((s) => s.id !== id),
    });
  };

  const addSkill = () => {
    if (!draftProfile || !newSkillName.trim()) return;
    const newSkill: SkillItem = {
      id: `s-${Date.now()}`,
      name: newSkillName.trim(),
      group: newSkillGroup.trim() || "Technical Skills",
    };
    setDraftProfile({ ...draftProfile, skills: [...draftProfile.skills, newSkill] });
    setNewSkillName("");
  };

  const deleteCertification = (index: number) => {
    if (!draftProfile) return;
    const updated = draftProfile.certifications.filter((_, i) => i !== index);
    setDraftProfile({ ...draftProfile, certifications: updated, publications: updated });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isParsing) onClose();
      }}
    >
      <div className="relative flex flex-col w-full max-w-4xl max-h-[92vh] rounded-card border border-line bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-6 py-4 bg-paper/60">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-control bg-primary/10 text-primary">
              <Sparkles className="size-5" />
            </div>
            <div>
              <h2 className="font-serif text-lg font-bold text-ink">
                {step === "upload" ? "Import Profile from CV / Resume" : "Review & Confirm Extracted Data"}
              </h2>
              <p className="text-xs text-muted">
                {step === "upload"
                  ? "Upload your existing CV (PDF, Word, or text) to populate your profile automatically"
                  : "Verify and adjust any details before saving directly to your profile"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isParsing}
            className="p-1.5 rounded-control text-muted hover:text-ink hover:bg-hover cursor-pointer transition-colors disabled:opacity-50"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Step 1: Upload / Input View */}
        {step === "upload" && (
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
            {/* Input Mode Selector */}
            <div className="flex gap-2 border-b border-line pb-3">
              <button
                type="button"
                onClick={() => setInputMode("file")}
                className={cn(
                  "px-4 py-1.5 text-sm font-medium rounded-control transition-colors cursor-pointer",
                  inputMode === "file" ? "bg-primary text-on-primary font-semibold" : "text-muted hover:text-ink"
                )}
              >
                Upload File (PDF / DOCX)
              </button>
              <button
                type="button"
                onClick={() => setInputMode("text")}
                className={cn(
                  "px-4 py-1.5 text-sm font-medium rounded-control transition-colors cursor-pointer",
                  inputMode === "text" ? "bg-primary text-on-primary font-semibold" : "text-muted hover:text-ink"
                )}
              >
                Paste Text
              </button>
            </div>

            {inputMode === "file" ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "flex flex-col items-center justify-center rounded-panel border-2 border-dashed p-10 text-center transition-colors cursor-pointer",
                  isDragging
                    ? "border-primary bg-primary/5"
                    : file
                    ? "border-primary/40 bg-card"
                    : "border-line-strong hover:border-primary/60 hover:bg-hover"
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.doc,.txt,.md,.json"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
                  <UploadCloud className="size-7" />
                </div>
                {file ? (
                  <div className="flex flex-col items-center">
                    <p className="text-base font-semibold text-ink">{file.name}</p>
                    <p className="text-xs text-muted mt-1">
                      {(file.size / 1024 / 1024).toFixed(2)} MB · Click or drag another file to replace
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <p className="text-base font-semibold text-ink">
                      Click to browse or drag and drop your CV
                    </p>
                    <p className="text-xs text-muted mt-1.5">
                      Supports PDF, DOCX (Word), TXT, Markdown, or JSON Resume (Max 15MB)
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Paste Resume Content
                </label>
                <textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="Paste your resume or LinkedIn career text here..."
                  rows={10}
                  className="w-full rounded-control border border-line-field bg-input p-4 font-mono text-xs text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            )}

            {parseError && (
              <div className="rounded-control border border-danger-control bg-danger-surface p-3.5 text-xs text-error-strong flex items-start gap-2.5">
                <X className="size-4 shrink-0 mt-0.5" />
                <span>{parseError}</span>
              </div>
            )}

            {isParsing && (
              <div className="rounded-card border border-primary/20 bg-primary/5 p-4 flex items-center gap-3.5">
                <Loader2 className="size-5 text-primary animate-spin" />
                <div className="text-xs">
                  <p className="font-semibold text-ink">Analyzing CV with AI...</p>
                  <p className="text-muted">
                    Extracting work experience, education history, skills, and projects into structured format.
                  </p>
                </div>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="flex items-center justify-between border-t border-line pt-4 mt-auto">
              <Button variant="secondary" onClick={onClose} disabled={isParsing}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleParse}
                disabled={isParsing || (inputMode === "file" && !file) || (inputMode === "text" && !rawText.trim())}
                className="flex items-center gap-2 cursor-pointer"
              >
                {isParsing ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Parsing CV...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" />
                    <span>Parse CV with AI →</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Review, Edit & Confirm View */}
        {step === "review" && draftProfile && (
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Review Section Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto border-b border-line bg-paper/40 px-6 py-2">
              <button
                type="button"
                onClick={() => setActiveReviewTab("basics")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-control whitespace-nowrap transition-colors cursor-pointer",
                  activeReviewTab === "basics"
                    ? "bg-selected font-semibold text-ink shadow-xs"
                    : "text-muted hover:text-ink hover:bg-hover"
                )}
              >
                <User className="size-3.5" />
                <span>Basics</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveReviewTab("experience")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-control whitespace-nowrap transition-colors cursor-pointer",
                  activeReviewTab === "experience"
                    ? "bg-selected font-semibold text-ink shadow-xs"
                    : "text-muted hover:text-ink hover:bg-hover"
                )}
              >
                <Briefcase className="size-3.5" />
                <span>Experience ({draftProfile.experience.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveReviewTab("education")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-control whitespace-nowrap transition-colors cursor-pointer",
                  activeReviewTab === "education"
                    ? "bg-selected font-semibold text-ink shadow-xs"
                    : "text-muted hover:text-ink hover:bg-hover"
                )}
              >
                <GraduationCap className="size-3.5" />
                <span>Education ({draftProfile.education.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveReviewTab("projects")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-control whitespace-nowrap transition-colors cursor-pointer",
                  activeReviewTab === "projects"
                    ? "bg-selected font-semibold text-ink shadow-xs"
                    : "text-muted hover:text-ink hover:bg-hover"
                )}
              >
                <FolderGit2 className="size-3.5" />
                <span>Projects ({draftProfile.projects.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveReviewTab("skills")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-control whitespace-nowrap transition-colors cursor-pointer",
                  activeReviewTab === "skills"
                    ? "bg-selected font-semibold text-ink shadow-xs"
                    : "text-muted hover:text-ink hover:bg-hover"
                )}
              >
                <Wrench className="size-3.5" />
                <span>Skills ({draftProfile.skills.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveReviewTab("certifications")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-control whitespace-nowrap transition-colors cursor-pointer",
                  activeReviewTab === "certifications"
                    ? "bg-selected font-semibold text-ink shadow-xs"
                    : "text-muted hover:text-ink hover:bg-hover"
                )}
              >
                <Award className="size-3.5" />
                <span>Certs & Languages</span>
              </button>
            </div>

            {/* Tab Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Basics Tab */}
              {activeReviewTab === "basics" && (
                <div className="flex flex-col gap-4 max-w-2xl mx-auto">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-muted">Full Name</label>
                      <input
                        type="text"
                        value={draftProfile.basics.name}
                        onChange={(e) => updateBasics("name", e.target.value)}
                        className="rounded-control border border-line-field bg-input px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-muted">Professional Headline</label>
                      <input
                        type="text"
                        value={draftProfile.basics.headline}
                        onChange={(e) => updateBasics("headline", e.target.value)}
                        placeholder="e.g. Senior Software Engineer"
                        className="rounded-control border border-line-field bg-input px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-muted">Email</label>
                      <input
                        type="email"
                        value={draftProfile.basics.email}
                        onChange={(e) => updateBasics("email", e.target.value)}
                        className="rounded-control border border-line-field bg-input px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-muted">Phone</label>
                      <input
                        type="text"
                        value={draftProfile.basics.phone}
                        onChange={(e) => updateBasics("phone", e.target.value)}
                        className="rounded-control border border-line-field bg-input px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-muted">City</label>
                      <input
                        type="text"
                        value={draftProfile.basics.city}
                        onChange={(e) => updateBasics("city", e.target.value)}
                        className="rounded-control border border-line-field bg-input px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-muted">Country</label>
                      <input
                        type="text"
                        value={draftProfile.basics.country}
                        onChange={(e) => updateBasics("country", e.target.value)}
                        className="rounded-control border border-line-field bg-input px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-muted">LinkedIn URL</label>
                      <input
                        type="text"
                        value={draftProfile.basics.linkedin}
                        onChange={(e) => updateBasics("linkedin", e.target.value)}
                        placeholder="https://linkedin.com/in/..."
                        className="rounded-control border border-line-field bg-input px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-muted">Website / Portfolio</label>
                      <input
                        type="text"
                        value={draftProfile.basics.website}
                        onChange={(e) => updateBasics("website", e.target.value)}
                        placeholder="https://..."
                        className="rounded-control border border-line-field bg-input px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1 mt-2">
                    <label className="text-xs font-semibold text-muted">Professional Summary</label>
                    <textarea
                      value={draftProfile.basics.summary}
                      onChange={(e) => updateBasics("summary", e.target.value)}
                      rows={4}
                      className="rounded-control border border-line-field bg-input p-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                </div>
              )}

              {/* Experience Tab */}
              {activeReviewTab === "experience" && (
                <div className="flex flex-col gap-4">
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-muted">
                      Extracted roles and responsibilities. You can adjust bullet points, titles, or dates.
                    </p>
                    <Button variant="secondary" size="sm" onClick={addExperience} className="flex items-center gap-1">
                      <Plus className="size-3.5" />
                      Add Role
                    </Button>
                  </div>

                  {draftProfile.experience.length === 0 ? (
                    <div className="rounded-panel border border-dashed border-line p-8 text-center text-sm text-muted">
                      No experience entries detected. Click "Add Role" to add one manually.
                    </div>
                  ) : (
                    draftProfile.experience.map((exp, idx) => (
                      <div key={exp.id || idx} className="rounded-card border border-line-card bg-card p-4 flex flex-col gap-3 shadow-xs">
                        <div className="flex justify-between items-start">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1 pr-4">
                            <input
                              type="text"
                              value={exp.role}
                              onChange={(e) => updateExperience(idx, { role: e.target.value })}
                              placeholder="Role / Title"
                              className="font-semibold text-sm text-ink rounded-control border border-line px-2.5 py-1.5 bg-input"
                            />
                            <input
                              type="text"
                              value={exp.company}
                              onChange={(e) => updateExperience(idx, { company: e.target.value })}
                              placeholder="Company Name"
                              className="text-sm text-ink rounded-control border border-line px-2.5 py-1.5 bg-input"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => deleteExperience(idx)}
                            className="text-muted hover:text-danger p-1.5 rounded-control transition-colors"
                            title="Remove role"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <input
                            type="text"
                            value={exp.location}
                            onChange={(e) => updateExperience(idx, { location: e.target.value })}
                            placeholder="Location (e.g. Remote, City)"
                            className="text-xs text-ink rounded-control border border-line px-2 py-1 bg-input"
                          />
                          <div className="flex items-center gap-1 text-xs">
                            <input
                              type="number"
                              value={exp.startYear ?? ""}
                              onChange={(e) => updateExperience(idx, { startYear: Number(e.target.value) || null })}
                              placeholder="Start Year"
                              className="w-20 rounded-control border border-line px-2 py-1 bg-input text-ink"
                            />
                            <span>to</span>
                            {exp.current ? (
                              <span className="font-semibold text-primary px-2">Present</span>
                            ) : (
                              <input
                                type="number"
                                value={exp.endYear ?? ""}
                                onChange={(e) => updateExperience(idx, { endYear: Number(e.target.value) || null })}
                                placeholder="End Year"
                                className="w-20 rounded-control border border-line px-2 py-1 bg-input text-ink"
                              />
                            )}
                          </div>
                          <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer">
                            <input
                              type="checkbox"
                              checked={exp.current}
                              onChange={(e) => updateExperience(idx, { current: e.target.checked })}
                              className="rounded-control"
                            />
                            <span>Current Role</span>
                          </label>
                        </div>

                        <div>
                          <label className="text-xs font-semibold text-muted block mb-1">
                            Achievements & Responsibilities (one per line)
                          </label>
                          <textarea
                            value={exp.bullets}
                            onChange={(e) => updateExperience(idx, { bullets: e.target.value })}
                            rows={3}
                            className="w-full text-xs text-ink rounded-control border border-line p-2.5 bg-input focus:outline-none"
                            placeholder="Bullet points describing achievements..."
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Education Tab */}
              {activeReviewTab === "education" && (
                <div className="flex flex-col gap-4">
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-muted">Degrees, institutions, and academic history.</p>
                    <Button variant="secondary" size="sm" onClick={addEducation} className="flex items-center gap-1">
                      <Plus className="size-3.5" />
                      Add Education
                    </Button>
                  </div>

                  {draftProfile.education.length === 0 ? (
                    <div className="rounded-panel border border-dashed border-line p-8 text-center text-sm text-muted">
                      No education detected. Click "Add Education" to add one.
                    </div>
                  ) : (
                    draftProfile.education.map((edu, idx) => (
                      <div key={edu.id || idx} className="rounded-card border border-line-card bg-card p-4 flex flex-col gap-3 shadow-xs">
                        <div className="flex justify-between items-start">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1 pr-4">
                            <input
                              type="text"
                              value={edu.degree}
                              onChange={(e) => updateEducation(idx, { degree: e.target.value })}
                              placeholder="Degree / Program"
                              className="font-semibold text-sm text-ink rounded-control border border-line px-2.5 py-1.5 bg-input"
                            />
                            <input
                              type="text"
                              value={edu.school}
                              onChange={(e) => updateEducation(idx, { school: e.target.value })}
                              placeholder="University / School"
                              className="text-sm text-ink rounded-control border border-line px-2.5 py-1.5 bg-input"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => deleteEducation(idx)}
                            className="text-muted hover:text-danger p-1.5 rounded-control transition-colors"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <input
                            type="text"
                            value={edu.location || ""}
                            onChange={(e) => updateEducation(idx, { location: e.target.value })}
                            placeholder="Location"
                            className="text-xs text-ink rounded-control border border-line px-2 py-1 bg-input"
                          />
                          <input
                            type="text"
                            value={edu.notes || ""}
                            onChange={(e) => updateEducation(idx, { notes: e.target.value })}
                            placeholder="Honors, GPA, or notes"
                            className="text-xs text-ink rounded-control border border-line px-2 py-1 bg-input"
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Projects Tab */}
              {activeReviewTab === "projects" && (
                <div className="flex flex-col gap-4">
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-muted">Key technical projects and open-source contributions.</p>
                    <Button variant="secondary" size="sm" onClick={addProject} className="flex items-center gap-1">
                      <Plus className="size-3.5" />
                      Add Project
                    </Button>
                  </div>

                  {draftProfile.projects.length === 0 ? (
                    <div className="rounded-panel border border-dashed border-line p-8 text-center text-sm text-muted">
                      No projects detected. Click "Add Project" to add one.
                    </div>
                  ) : (
                    draftProfile.projects.map((proj, idx) => (
                      <div key={proj.id || idx} className="rounded-card border border-line-card bg-card p-4 flex flex-col gap-3 shadow-xs">
                        <div className="flex justify-between items-start">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1 pr-4">
                            <input
                              type="text"
                              value={proj.name}
                              onChange={(e) => updateProject(idx, { name: e.target.value })}
                              placeholder="Project Name"
                              className="font-semibold text-sm text-ink rounded-control border border-line px-2.5 py-1.5 bg-input"
                            />
                            <input
                              type="text"
                              value={proj.link}
                              onChange={(e) => updateProject(idx, { link: e.target.value })}
                              placeholder="Project Link (GitHub/Demo)"
                              className="text-sm text-ink rounded-control border border-line px-2.5 py-1.5 bg-input"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => deleteProject(idx)}
                            className="text-muted hover:text-danger p-1.5 rounded-control transition-colors"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                        <textarea
                          value={proj.bullets}
                          onChange={(e) => updateProject(idx, { bullets: e.target.value })}
                          rows={2}
                          className="w-full text-xs text-ink rounded-control border border-line p-2.5 bg-input focus:outline-none"
                          placeholder="Project highlights and tech stack..."
                        />
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Skills Tab */}
              {activeReviewTab === "skills" && (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-center gap-2 border-b border-line pb-4">
                    <input
                      type="text"
                      value={newSkillName}
                      onChange={(e) => setNewSkillName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addSkill();
                        }
                      }}
                      placeholder="Add a new skill (e.g. Next.js, Docker)..."
                      className="rounded-control border border-line-field bg-input px-3 py-1.5 text-xs text-ink focus:outline-none w-64"
                    />
                    <select
                      value={newSkillGroup}
                      onChange={(e) => setNewSkillGroup(e.target.value)}
                      className="rounded-control border border-line-field bg-input px-3 py-1.5 text-xs text-ink focus:outline-none"
                    >
                      <option value="Languages">Languages</option>
                      <option value="Frameworks">Frameworks</option>
                      <option value="Database & Cloud">Database & Cloud</option>
                      <option value="AI & ML">AI & ML</option>
                      <option value="Technical Skills">Technical Skills</option>
                      <option value="Tools">Tools</option>
                    </select>
                    <Button variant="secondary" size="sm" onClick={addSkill}>
                      Add Skill
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2">
                    {draftProfile.skills.map((skill) => (
                      <span
                        key={skill.id}
                        className="inline-flex items-center gap-1.5 rounded-pill border border-line-field bg-paper px-3 py-1 text-xs text-ink shadow-xs"
                      >
                        <span className="font-medium">{skill.name}</span>
                        <span className="text-[10px] text-muted">({skill.group})</span>
                        <button
                          type="button"
                          onClick={() => deleteSkill(skill.id)}
                          className="text-muted hover:text-danger ml-0.5"
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Certifications Tab */}
              {activeReviewTab === "certifications" && (
                <div className="flex flex-col gap-6">
                  {/* Certifications */}
                  <div className="flex flex-col gap-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
                      Certifications ({draftProfile.certifications.length})
                    </h3>
                    {draftProfile.certifications.length === 0 ? (
                      <p className="text-xs text-muted">No certifications detected in the CV.</p>
                    ) : (
                      draftProfile.certifications.map((cert, idx) => (
                        <div key={cert.id || idx} className="rounded-card border border-line p-3 flex justify-between items-center bg-input">
                          <div>
                            <p className="text-sm font-semibold text-ink">{cert.name}</p>
                            <p className="text-xs text-muted">{cert.issuer} {cert.issueDate ? `· ${cert.issueDate}` : ""}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => deleteCertification(idx)}
                            className="text-muted hover:text-danger p-1"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Languages */}
                  <div className="flex flex-col gap-3 border-t border-line pt-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
                      Languages ({draftProfile.languages.length})
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {draftProfile.languages.map((lang) => (
                        <span
                          key={lang.id}
                          className="inline-flex items-center gap-1.5 rounded-pill border border-line bg-paper px-3 py-1 text-xs text-ink"
                        >
                          <Globe className="size-3 text-muted" />
                          <span className="font-medium">{lang.name}</span>
                          <span className="text-[10px] text-muted">({lang.level})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Step 2 Footer */}
            <div className="flex items-center justify-between border-t border-line px-6 py-4 bg-paper/60">
              <Button
                variant="secondary"
                onClick={() => setStep("upload")}
                className="flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="size-3.5" />
                <span>Back to Upload</span>
              </Button>

              <div className="flex items-center gap-2.5">
                <Button variant="secondary" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleConfirmSave}
                  className="flex items-center gap-2 cursor-pointer font-semibold shadow-cta"
                >
                  <Check className="size-4" />
                  <span>Confirm & Save to Profile</span>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

