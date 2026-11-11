import type { Unit } from "@/lib/application-data";
import { ageLabel, ENGLISH_LABELS, languagesLine, type DocumentLabels } from "@/lib/document-labels";
import { publicationHref, publicationLink } from "@/lib/citation";
import { ageOn, formatDateRange, resumePublications, type Basics, type ProfileData } from "@/lib/profile";
import { inEditorOrder, skillsText } from "@/lib/skill-groups";

// What a resume shows, worked out from the profile (the base resume) or from
// a tailored document's units, so the renderer only has to lay it out.

export type ResumeContent = {
  name: string;
  headline: string;
  /** The profile photo's data URL, or null when the resume has none (#224). */
  photo: string | null;
  /** Email, phone, "City, Country", website, LinkedIn and "Age N", whichever are filled in. */
  contacts: string[];
  summary: string;
  experience: {
    id: string;
    role: string;
    company: string;
    /** A line about the company or the role (#257), as written; never tailored. */
    descriptor: string;
    dates: string;
    bullets: string[];
    /** The skills used in the role (RES-6). */
    skills: string[];
  }[];
  /** Projects (PRO-13), laid out like roles. */
  projects: {
    id: string;
    name: string;
    /** "github.com/jane/tidewater", without "https://". */
    link: string;
    dates: string;
    bullets: string[];
    skills: string[];
  }[];
  education: { id: string; degree: string; school: string; dates: string; notes: string }[];
  /** Certifications in the profile's order. */
  certifications: {
    id: string;
    name: string;
    issuer: string;
    dates: string;
    link: string;
    href: string | null;
  }[];
  /** Legacy alias for backward compatibility */
  publications: {
    id: string;
    /** As written, with **bold** and *italic*. */
    citation: string;
    /** "doi.org/10.1038/…", without "https://". */
    link: string;
    /** What the link opens, or null when it isn't a web address. */
    href: string | null;
  }[];
  /** "Figma · User research · …" */
  skills: string;
  /** "Dutch: Native · English: Fluent (C2)" */
  languages: string;
  references: { id: string; name: string; role: string; contact: string }[];
};

export type ResumeOptions = {
  /** A tailored document's units; they replace the profile's text (APP-4). */
  units?: Unit[];
  /** Settings → "Include references" (SET-9). */
  includeReferences?: boolean;
  /** An application's Photo switch (#224); null or left out follows the profile's "Show on resumes". */
  showPhoto?: boolean | null;
  /** For "Age N"; defaults to now. */
  today?: Date;
};

/** The separator between contact details on one line. */
export const CONTACT_SEPARATOR = "  ·  ";

/** Contact details in the order the resume header lists them. */
export function contactItems(basics: Basics, today = new Date(), labels = ENGLISH_LABELS): string[] {
  const age = basics.showAge ? ageOn(basics.dob, today) : null;
  return [
    basics.email,
    basics.phone,
    [basics.city, basics.country].map((part) => part.trim()).filter(Boolean).join(", "),
    basics.website,
    basics.linkedin,
    age === null ? "" : ageLabel(age, labels),
  ]
    .map((item) => item.trim())
    .filter(Boolean);
}

/** A link as a resume shows it: "https://www.example.com/x/" is "example.com/x". */
export const displayLink = (link: string) =>
  link
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/$/, "");

const lines = (text: string) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

/** What the resume shows, with its dates and levels in the words of `labels`. */
export function resumeContent(
  profile: ProfileData,
  { units, includeReferences = false, showPhoto, today = new Date() }: ResumeOptions = {},
  labels: DocumentLabels = ENGLISH_LABELS,
): ResumeContent {
  const { basics } = profile;
  const skillNames = new Map(profile.skills.map((skill) => [skill.id, skill.name]));
  const dates = { locale: labels.locale, present: labels.present };

  const experience = (entry: ProfileData["experience"][number], bullets: string) => ({
    id: entry.id,
    role: entry.role.trim(),
    company: entry.company.trim(),
    descriptor: entry.descriptor.trim(),
    dates: formatDateRange(entry, dates),
    bullets: lines(bullets),
    skills: entry.skillIds.flatMap((id) => skillNames.get(id) ?? []),
  });
  const project = (entry: ProfileData["projects"][number], bullets: string) => ({
    id: entry.id,
    name: entry.name.trim(),
    link: displayLink(entry.link),
    dates: formatDateRange(entry, dates),
    bullets: lines(bullets),
    skills: entry.skillIds.flatMap((id) => skillNames.get(id) ?? []),
  });
  const certification = (entry: any) => {
    const rawName = entry.name || (entry.citation ? entry.citation.replace(/\*\*/g, "").split(" — ")[0] : "");
    const rawIssuer = entry.issuer || (entry.citation && entry.citation.includes(" — ") ? entry.citation.replace(/\*\*/g, "").split(" — ")[1]?.replace(/\s*\([^)]+\)$/, "") : "");
    const rawDate = entry.issueDate || entry.dates || "";
    return {
      id: entry.id,
      name: rawName.trim(),
      issuer: rawIssuer.trim(),
      dates: rawDate.trim(),
      link: displayLink(publicationLink(entry.link || "")),
      href: publicationHref(entry.link || ""),
    };
  };
  const publication = (entry: any, citation: string) => {
    const c = certification(entry);
    return {
      id: entry.id,
      citation: citation || (c.issuer ? `**${c.name}** — ${c.issuer}` : c.name),
      link: c.link,
      href: c.href,
    };
  };
  const education = (entry: ProfileData["education"][number], notes: string) => ({
    id: entry.id,
    degree: entry.degree.trim(),
    school: entry.school.trim(),
    dates: formatDateRange(entry, dates),
    notes: notes.trim(),
  });

  const rawCerts = (profile.certifications && profile.certifications.length > 0)
    ? profile.certifications
    : (profile.publications || []);
  const activeCertList = (rawCerts as any[]).filter((c) => c.onResumes && ((c.name && c.name.trim()) || (c.citation && c.citation.trim())));
  const renderedCerts = activeCertList.map(certification);

  const content: ResumeContent = {
    name: basics.name.trim() || "Your name",
    headline: basics.headline.trim(),
    photo: profile.photo && (showPhoto ?? profile.photo.onResumes) ? profile.photo.src : null,
    contacts: contactItems(basics, today, labels),
    summary: basics.summary.trim(),
    experience: profile.experience.map((entry) => experience(entry, entry.bullets)),
    projects: profile.projects.map((entry) => project(entry, entry.bullets)),
    education: profile.education.map((entry) => education(entry, entry.notes)),
    certifications: renderedCerts,
    publications: renderedCerts.map((c) => ({
      id: c.id,
      citation: c.issuer ? `**${c.name}** — ${c.issuer}${c.dates ? ` (${c.dates})` : ""}` : c.name,
      link: c.link,
      href: c.href,
    })),
    // A line per group, as Profile → Skills shows them (#280).
    skills: skillsText(inEditorOrder(profile.skills)),
    languages: languagesLine(profile.languages, labels),
    references: includeReferences
      ? profile.references.map((reference) => ({
          id: reference.id,
          name: reference.name.trim(),
          role: [reference.relation, reference.company].map((part) => part.trim()).filter(Boolean).join(", "),
          contact: [reference.email, reference.phone].map((part) => part.trim()).filter(Boolean).join(" · "),
        }))
      : [],
  };

  if (units) {
    // A tailored resume only customizes the profile headline and summary;
    // all skills, experiences, projects, education, and certifications remain 100% present and authentic.
    const text = (id: string) => units.find((unit) => unit.id === id)?.text ?? "";
    const withUnit = <T extends { id: string }>(prefix: string, entries: T[]) =>
      units.flatMap((unit) => {
        if (!unit.id.startsWith(prefix)) return [];
        const entry = entries.find(({ id }) => `${prefix}${id}` === unit.id);
        return entry ? [{ entry, text: unit.text }] : [];
      });

    if (text("headline").trim()) {
      content.headline = text("headline").trim();
    }
    if (text("summary").trim()) {
      content.summary = text("summary").trim();
    }

    // All skills are always present - never hidden or stripped
    content.skills = skillsText(inEditorOrder(profile.skills));
    content.languages = text("languages").trim() || languagesLine(profile.languages, labels);

    const tailoredExp = withUnit("experience:", profile.experience);
    content.experience =
      tailoredExp.length > 0
        ? tailoredExp.map(({ entry, text }) => experience(entry, text))
        : profile.experience.map((entry) => experience(entry, entry.bullets));

    const tailoredProj = withUnit("project:", profile.projects);
    content.projects =
      tailoredProj.length > 0
        ? tailoredProj.map(({ entry, text }) => project(entry, text))
        : profile.projects.map((entry) => project(entry, entry.bullets));

    const tailoredEdu = withUnit("education:", profile.education);
    content.education =
      tailoredEdu.length > 0
        ? tailoredEdu.map(({ entry, text }) => education(entry, text))
        : profile.education.map((entry) => education(entry, entry.notes));

    // Certifications remain authentic and present across all tailored resumes
    content.certifications = renderedCerts;
    content.publications = renderedCerts.map((c) => ({
      id: c.id,
      citation: c.issuer ? `**${c.name}** — ${c.issuer}${c.dates ? ` (${c.dates})` : ""}` : c.name,
      link: c.link,
      href: c.href,
    }));
  }

  return content;
}
