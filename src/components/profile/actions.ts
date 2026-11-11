"use server";

import { z } from "zod";
import { action, ActionError } from "@/lib/action";
import { loadProfile, saveProfile } from "@/lib/profile-store";
import { LanguageLevel } from "@/lib/enums";
import { ExperienceItem, ProjectItem, EducationItem } from "@/lib/profile";

const id = z.string().min(1);
const text = (max: number) => z.string().max(max);

// ─── Basics ──────────────────────────────────────────────────────────────────
export const saveBasics = action(
  z.object({
    name: text(200),
    headline: text(300),
    email: text(320),
    phone: text(60),
    dob: z.union([z.literal(""), z.string()]),
    website: text(500),
    address: text(300),
    city: text(120),
    country: text(120),
    linkedin: text(500),
    summary: text(5000),
    showAge: z.boolean(),
  }),
  async (basics) => {
    const profile = await loadProfile();
    profile.basics = { ...profile.basics, ...basics };
    await saveProfile(profile);
    return null;
  },
);

// ─── Photo ───────────────────────────────────────────────────────────────────
export const savePhoto = action(
  z.object({ src: z.string(), onResumes: z.boolean() }),
  async ({ src, onResumes }) => {
    const profile = await loadProfile();
    profile.photo = { src, onResumes };
    await saveProfile(profile);
    return null;
  },
);

export const removePhoto = action(z.object({}), async () => {
  const profile = await loadProfile();
  profile.photo = null;
  await saveProfile(profile);
  return null;
});

export const setPhotoOnResumes = action(z.object({ onResumes: z.boolean() }), async ({ onResumes }) => {
  const profile = await loadProfile();
  if (profile.photo) {
    profile.photo.onResumes = onResumes;
    await saveProfile(profile);
  }
  return null;
});

// ─── Experience ──────────────────────────────────────────────────────────────
const experienceFields = z.object({
  id,
  role: text(200),
  company: text(200),
  location: text(200),
  descriptor: text(300),
  bullets: text(5000),
  startYear: z.number().nullable(),
  startMonth: z.number().nullable(),
  endYear: z.number().nullable(),
  endMonth: z.number().nullable(),
  current: z.boolean(),
});

export const createExperience = action(z.object({}), async () => {
  const profile = await loadProfile();
  const newExp: ExperienceItem = {
    id: `exp-${Date.now()}`,
    role: "",
    company: "",
    location: "",
    descriptor: "",
    bullets: "",
    startYear: new Date().getFullYear(),
    startMonth: null,
    endYear: null,
    endMonth: null,
    current: true,
    skillIds: [],
  };
  profile.experience.unshift(newExp);
  await saveProfile(profile);
  return newExp;
});

export const saveExperience = action(experienceFields, async (data) => {
  const profile = await loadProfile();
  const index = profile.experience.findIndex((e) => e.id === data.id);
  if (index >= 0) {
    profile.experience[index] = { ...profile.experience[index], ...data };
    await saveProfile(profile);
  }
  return null;
});

export const removeExperience = action(z.object({ id }), async ({ id }) => {
  const profile = await loadProfile();
  profile.experience = profile.experience.filter((e) => e.id !== id);
  await saveProfile(profile);
  return null;
});

export const restoreExperience = action(z.any(), async (entry: ExperienceItem) => {
  const profile = await loadProfile();
  profile.experience.push(entry);
  await saveProfile(profile);
  return entry;
});

export const setExperienceSkill = action(
  z.object({ experienceId: id, skillId: id, attached: z.boolean() }),
  async ({ experienceId, skillId, attached }) => {
    const profile = await loadProfile();
    const exp = profile.experience.find((e) => e.id === experienceId);
    if (exp) {
      if (attached) {
        if (!exp.skillIds.includes(skillId)) exp.skillIds.push(skillId);
      } else {
        exp.skillIds = exp.skillIds.filter((s) => s !== skillId);
      }
      await saveProfile(profile);
    }
    return null;
  },
);

export const attachNewExperienceSkill = action(
  z.object({ experienceId: id, name: text(100) }),
  async ({ experienceId, name }) => {
    const profile = await loadProfile();
    let skill = profile.skills.find((s) => s.name.toLowerCase() === name.toLowerCase());
    let added = false;
    if (!skill) {
      skill = { id: `s-${Date.now()}`, name, group: "" };
      profile.skills.push(skill);
      added = true;
    }
    const exp = profile.experience.find((e) => e.id === experienceId);
    if (exp && !exp.skillIds.includes(skill.id)) {
      exp.skillIds.push(skill.id);
    }
    await saveProfile(profile);
    return { added, skill };
  },
);

// ─── Projects ────────────────────────────────────────────────────────────────
const projectFields = z.object({
  id,
  name: text(200),
  link: text(500),
  bullets: text(5000),
  startYear: z.number().nullable(),
  startMonth: z.number().nullable(),
  endYear: z.number().nullable(),
  endMonth: z.number().nullable(),
  current: z.boolean(),
});

export const createProject = action(z.object({}), async () => {
  const profile = await loadProfile();
  const newProj: ProjectItem = {
    id: `proj-${Date.now()}`,
    name: "",
    link: "",
    bullets: "",
    startYear: new Date().getFullYear(),
    startMonth: null,
    endYear: null,
    endMonth: null,
    current: true,
    skillIds: [],
  };
  profile.projects.unshift(newProj);
  await saveProfile(profile);
  return newProj;
});

export const saveProject = action(projectFields, async (data) => {
  const profile = await loadProfile();
  const index = profile.projects.findIndex((p) => p.id === data.id);
  if (index >= 0) {
    profile.projects[index] = { ...profile.projects[index], ...data };
    await saveProfile(profile);
  }
  return null;
});

export const removeProject = action(z.object({ id }), async ({ id }) => {
  const profile = await loadProfile();
  profile.projects = profile.projects.filter((p) => p.id !== id);
  await saveProfile(profile);
  return null;
});

export const restoreProject = action(z.any(), async (entry: ProjectItem) => {
  const profile = await loadProfile();
  profile.projects.push(entry);
  await saveProfile(profile);
  return entry;
});

export const setProjectSkill = action(
  z.object({ projectId: id, skillId: id, attached: z.boolean() }),
  async ({ projectId, skillId, attached }) => {
    const profile = await loadProfile();
    const proj = profile.projects.find((p) => p.id === projectId);
    if (proj) {
      if (attached) {
        if (!proj.skillIds.includes(skillId)) proj.skillIds.push(skillId);
      } else {
        proj.skillIds = proj.skillIds.filter((s) => s !== skillId);
      }
      await saveProfile(profile);
    }
    return null;
  },
);

export const attachNewProjectSkill = action(
  z.object({ projectId: id, name: text(100) }),
  async ({ projectId, name }) => {
    const profile = await loadProfile();
    let skill = profile.skills.find((s) => s.name.toLowerCase() === name.toLowerCase());
    let added = false;
    if (!skill) {
      skill = { id: `s-${Date.now()}`, name, group: "" };
      profile.skills.push(skill);
      added = true;
    }
    const proj = profile.projects.find((p) => p.id === projectId);
    if (proj && !proj.skillIds.includes(skill.id)) {
      proj.skillIds.push(skill.id);
    }
    await saveProfile(profile);
    return { added, skill };
  },
);

// ─── Education ───────────────────────────────────────────────────────────────
const educationFields = z.object({
  id,
  degree: text(200),
  school: text(200),
  notes: text(1000),
  startYear: z.number().nullable(),
  startMonth: z.number().nullable(),
  endYear: z.number().nullable(),
  endMonth: z.number().nullable(),
  current: z.boolean(),
});

export const createEducation = action(z.object({}), async () => {
  const profile = await loadProfile();
  const newEdu: EducationItem = {
    id: `edu-${Date.now()}`,
    degree: "",
    school: "",
    notes: "",
    startYear: new Date().getFullYear(),
    startMonth: null,
    endYear: null,
    endMonth: null,
    current: false,
  };
  profile.education.unshift(newEdu);
  await saveProfile(profile);
  return newEdu;
});

export const saveEducation = action(educationFields, async (data) => {
  const profile = await loadProfile();
  const index = profile.education.findIndex((e) => e.id === data.id);
  if (index >= 0) {
    profile.education[index] = { ...profile.education[index], ...data };
    await saveProfile(profile);
  }
  return null;
});

export const removeEducation = action(z.object({ id }), async ({ id }) => {
  const profile = await loadProfile();
  profile.education = profile.education.filter((e) => e.id !== id);
  await saveProfile(profile);
  return null;
});

export const restoreEducation = action(z.any(), async (entry: EducationItem) => {
  const profile = await loadProfile();
  profile.education.push(entry);
  await saveProfile(profile);
  return entry;
});

// ─── Skills ──────────────────────────────────────────────────────────────────
export const addSkill = action(
  z.object({ name: text(100), group: text(100).optional() }),
  async ({ name, group = "" }) => {
    const profile = await loadProfile();
    const existing = profile.skills.find((s) => s.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      if (group && existing.group !== group) {
        existing.group = group;
        await saveProfile(profile);
      }
      return { skill: existing };
    }
    const skill = { id: `s-${Date.now()}`, name, group };
    profile.skills.push(skill);
    await saveProfile(profile);
    return { skill };
  },
);

export const removeSkill = action(z.object({ id }), async ({ id }) => {
  const profile = await loadProfile();
  profile.skills = profile.skills.filter((s) => s.id !== id);
  profile.experience.forEach((e) => {
    e.skillIds = e.skillIds.filter((sid) => sid !== id);
  });
  profile.projects.forEach((p) => {
    p.skillIds = p.skillIds.filter((sid) => sid !== id);
  });
  await saveProfile(profile);
  return null;
});

export const setSkillGroup = action(
  z.object({ id, group: text(100) }),
  async ({ id, group }) => {
    const profile = await loadProfile();
    const skill = profile.skills.find((s) => s.id === id);
    if (skill) {
      skill.group = group;
      await saveProfile(profile);
    }
    return null;
  },
);

export const renameSkillGroup = action(
  z.object({ from: text(100), to: text(100) }),
  async ({ from, to }) => {
    const profile = await loadProfile();
    profile.skills.forEach((s) => {
      if (s.group === from) s.group = to;
    });
    await saveProfile(profile);
    return null;
  },
);

// ─── Languages ───────────────────────────────────────────────────────────────
export const addLanguage = action(
  z.object({ name: text(100), level: z.nativeEnum(LanguageLevel) }),
  async ({ name, level }) => {
    const profile = await loadProfile();
    const lang = { id: `l-${Date.now()}`, name, level };
    profile.languages.push(lang);
    await saveProfile(profile);
    return { language: lang };
  },
);

export const removeLanguage = action(z.object({ id }), async ({ id }) => {
  const profile = await loadProfile();
  profile.languages = profile.languages.filter((l) => l.id !== id);
  await saveProfile(profile);
  return null;
});

export const setLanguageLevel = action(
  z.object({ id, level: z.nativeEnum(LanguageLevel) }),
  async ({ id, level }) => {
    const profile = await loadProfile();
    const lang = profile.languages.find((l) => l.id === id);
    if (lang) {
      lang.level = level;
      await saveProfile(profile);
    }
    return null;
  },
);

// ─── Reordering ──────────────────────────────────────────────────────────────
export const reorderEntries = action(
  z.object({ section: z.enum(["experience", "project", "education"]), ids: z.array(z.string()) }),
  async ({ section, ids }) => {
    const profile = await loadProfile();
    const idMap = new Map(ids.map((id, index) => [id, index]));
    if (section === "experience") {
      profile.experience.sort((a, b) => (idMap.get(a.id) ?? 999) - (idMap.get(b.id) ?? 999));
    } else if (section === "project") {
      profile.projects.sort((a, b) => (idMap.get(a.id) ?? 999) - (idMap.get(b.id) ?? 999));
    } else if (section === "education") {
      profile.education.sort((a, b) => (idMap.get(a.id) ?? 999) - (idMap.get(b.id) ?? 999));
    }
    await saveProfile(profile);
    return null;
  },
);

export const sortEntriesByDate = action(
  z.object({ section: z.enum(["experience", "project", "education"]) }),
  async ({ section }) => {
    const profile = await loadProfile();
    const dateScore = (entry: any) =>
      entry.current ? 999999 : (entry.endYear ?? entry.startYear ?? 0) * 100 + (entry.endMonth ?? entry.startMonth ?? 0);
    if (section === "experience") {
      profile.experience.sort((a, b) => dateScore(b) - dateScore(a));
      await saveProfile(profile);
      return profile.experience.map((e) => e.id);
    } else if (section === "project") {
      profile.projects.sort((a, b) => dateScore(b) - dateScore(a));
      await saveProfile(profile);
      return profile.projects.map((p) => p.id);
    } else {
      profile.education.sort((a, b) => dateScore(b) - dateScore(a));
      await saveProfile(profile);
      return profile.education.map((e) => e.id);
    }
  },
);

// ─── Certifications ──────────────────────────────────────────────────────────
export const createCertification = action(z.object({}), async () => {
  const profile = await loadProfile();
  const cert = {
    id: `cert-${Date.now()}`,
    name: "",
    issuer: "",
    issueDate: "",
    link: "",
    onResumes: true,
  };
  if (!profile.certifications) profile.certifications = [];
  profile.certifications.unshift(cert);
  profile.publications = profile.certifications;
  await saveProfile(profile);
  return cert;
});

export const saveCertification = action(
  z.object({
    id,
    name: text(500),
    issuer: text(500),
    issueDate: text(200),
    link: text(500),
    onResumes: z.boolean(),
  }),
  async (data) => {
    const profile = await loadProfile();
    if (!profile.certifications) profile.certifications = [];
    const index = profile.certifications.findIndex((c) => c.id === data.id);
    if (index >= 0) {
      profile.certifications[index] = { ...profile.certifications[index], ...data };
    } else {
      profile.certifications.push(data);
    }
    profile.publications = profile.certifications;
    await saveProfile(profile);
    return null;
  },
);

export const removeCertification = action(z.object({ id }), async ({ id }) => {
  const profile = await loadProfile();
  if (!profile.certifications) profile.certifications = [];
  profile.certifications = profile.certifications.filter((c) => c.id !== id);
  profile.publications = profile.certifications;
  await saveProfile(profile);
  return null;
});

export const restoreCertification = action(z.any(), async (entry: any) => {
  const profile = await loadProfile();
  if (!profile.certifications) profile.certifications = [];
  profile.certifications.push(entry);
  profile.publications = profile.certifications;
  await saveProfile(profile);
  return entry;
});

export const reorderCertifications = action(z.object({ ids: z.array(z.string()) }), async ({ ids }) => {
  const profile = await loadProfile();
  if (!profile.certifications) profile.certifications = [];
  const idMap = new Map(ids.map((id, index) => [id, index]));
  profile.certifications.sort((a, b) => (idMap.get(a.id) ?? 999) - (idMap.get(b.id) ?? 999));
  profile.publications = profile.certifications;
  await saveProfile(profile);
  return null;
});

// Backward compatibility aliases
export const createPublication = createCertification;
export const savePublication = saveCertification;
export const removePublication = removeCertification;
export const restorePublication = restoreCertification;
export const reorderPublications = reorderCertifications;

// ─── References ──────────────────────────────────────────────────────────────
export const createReference = action(z.object({}), async () => {
  const profile = await loadProfile();
  const ref = { id: `ref-${Date.now()}`, name: "", relation: "", company: "", email: "", phone: "" };
  profile.references.unshift(ref);
  await saveProfile(profile);
  return ref;
});

export const saveReference = action(
  z.object({ id, name: text(200), relation: text(200), company: text(200), email: text(320), phone: text(60) }),
  async (data) => {
    const profile = await loadProfile();
    const index = profile.references.findIndex((r) => r.id === data.id);
    if (index >= 0) {
      profile.references[index] = { ...profile.references[index], ...data };
      await saveProfile(profile);
    }
    return null;
  },
);

export const removeReference = action(z.object({ id }), async ({ id }) => {
  const profile = await loadProfile();
  profile.references = profile.references.filter((r) => r.id !== id);
  await saveProfile(profile);
  return null;
});

export const restoreReference = action(z.any(), async (entry: any) => {
  const profile = await loadProfile();
  profile.references.push(entry);
  await saveProfile(profile);
  return entry;
});
