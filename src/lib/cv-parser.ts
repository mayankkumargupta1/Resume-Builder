import { extractText } from "unpdf";
import mammoth from "mammoth";
import { LanguageLevel } from "@/lib/enums";
import type {
  ProfileData,
  ExperienceItem,
  ProjectItem,
  EducationItem,
  SkillItem,
  LanguageItem,
  CertificationItem,
} from "@/lib/profile";
import { createEmptyProfile } from "@/lib/default-profile-data";
import {
  DEFAULT_GATEWAY_KEY,
  DEFAULT_GATEWAY_URL,
  DEFAULT_MODEL,
  resolveModelName,
} from "@/lib/ai-agent";

/**
 * Extracts plain text from an uploaded CV file buffer (PDF, DOCX, TXT, MD, JSON).
 */
export async function extractCvTextFromFile(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<string> {
  const lowerName = fileName.toLowerCase();

  // 1. PDF
  if (mimeType.includes("pdf") || lowerName.endsWith(".pdf")) {
    try {
      const { text } = await extractText(new Uint8Array(buffer));
      return Array.isArray(text) ? text.join("\n\n") : String(text || "");
    } catch (err: any) {
      console.warn("unpdf text extraction failed:", err);
      throw new Error(`Failed to read PDF file: ${err.message || "Unknown error"}`);
    }
  }

  // 2. Word (.docx)
  if (
    mimeType.includes("word") ||
    mimeType.includes("officedocument") ||
    lowerName.endsWith(".docx")
  ) {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value || "";
    } catch (err: any) {
      console.warn("mammoth docx text extraction failed:", err);
      throw new Error(`Failed to read Word document: ${err.message || "Unknown error"}`);
    }
  }

  // 3. JSON or plain text / markdown
  return buffer.toString("utf-8");
}

/**
 * Parses raw CV text into structured ProfileData using AI, falling back to heuristic parsing.
 */
export async function parseCvToProfile(
  cvText: string,
  baseProfile?: ProfileData
): Promise<ProfileData> {
  const cleanText = cvText.trim();
  if (!cleanText) {
    throw new Error("No CV text or file content provided to parse.");
  }

  // Check if text is directly a JSON Resume or ProfileData export
  if (cleanText.startsWith("{")) {
    try {
      const directJson = JSON.parse(cleanText);
      const mapped = mapJsonResumeToProfile(directJson);
      if (mapped) return mapped;
    } catch {
      // Continue to AI parsing
    }
  }

  // Attempt AI parsing with gateway / openrouter / openai
  let aiResult: ProfileData | null = null;
  if (DEFAULT_GATEWAY_KEY) {
    try {
      aiResult = await callAiParser(cleanText);
    } catch (err) {
      console.warn("AI CV parser failed, falling back to heuristic parser:", err);
    }
  }

  if (aiResult) {
    return aiResult;
  }

  // Fallback to heuristic parser
  return heuristicCvParser(cleanText, baseProfile);
}

// ─── AI Parser Implementation ────────────────────────────────────────────────

async function callAiParser(cvText: string): Promise<ProfileData | null> {
  const endpoint = `${DEFAULT_GATEWAY_URL.replace(/\/+$/, "")}/chat/completions`;
  const actualModel = resolveModelName(DEFAULT_MODEL, DEFAULT_GATEWAY_URL);

  const prompt = `You are an expert resume parsing engine.
Parse the following raw CV/Resume text into structured profile JSON. Extract every experience, project, skill, education, language, and certification accurately.

Candidate CV Text:
"""
${cvText.slice(0, 16000)}
"""

Output strictly valid JSON matching this exact structure:
{
  "basics": {
    "name": "Full Name",
    "headline": "Professional title / Headline (e.g. Senior Software Engineer)",
    "email": "email@example.com",
    "phone": "Phone number",
    "city": "City",
    "country": "Country",
    "website": "Personal website or portfolio URL",
    "linkedin": "LinkedIn profile URL",
    "summary": "Professional summary or career overview"
  },
  "skills": [
    { "name": "Skill Name", "group": "Languages | Frameworks | Database & Cloud | AI & ML | Tools | Other" }
  ],
  "experience": [
    {
      "role": "Job Title",
      "company": "Company Name",
      "location": "City, Country or Remote",
      "descriptor": "One sentence about the company or product",
      "startMonth": 1,
      "startYear": 2022,
      "endMonth": 12,
      "endYear": 2023,
      "current": false,
      "bullets": "Bullet 1\\nBullet 2\\nBullet 3",
      "skillsUsed": ["Skill 1", "Skill 2"]
    }
  ],
  "projects": [
    {
      "name": "Project Name",
      "link": "https://github.com/... or project link",
      "startMonth": 1,
      "startYear": 2023,
      "endMonth": null,
      "endYear": null,
      "current": true,
      "bullets": "Bullet 1\\nBullet 2",
      "skillsUsed": ["Skill 1"]
    }
  ],
  "education": [
    {
      "degree": "Degree / Field of Study",
      "school": "University or Institution",
      "location": "City, Country",
      "startYear": 2018,
      "startMonth": 9,
      "endYear": 2022,
      "endMonth": 5,
      "current": false,
      "notes": "Honors, GPA, coursework or activities"
    }
  ],
  "certifications": [
    {
      "name": "Certification Name",
      "issuer": "Issuing Organization",
      "issueDate": "Year or Month Year",
      "link": "Credential URL if any"
    }
  ],
  "languages": [
    {
      "name": "Language Name",
      "level": "NATIVE" // Choose one: NATIVE, C2, C1, B2, B1, A2, A1
    }
  ]
}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${DEFAULT_GATEWAY_KEY}`,
  };

  if (DEFAULT_GATEWAY_URL.includes("openrouter.ai")) {
    headers["HTTP-Referer"] = "https://resumepipeline.com";
    headers["X-Title"] = "Resume Pipeline";
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: actualModel,
        messages: [
          {
            role: "system",
            content:
              "You are a specialized CV/Resume parser. You convert unstructured resumes into complete, high-fidelity JSON. Return raw JSON only.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 3500,
        temperature: 0.1,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AI Gateway HTTP ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const parsed = parseJsonResiliently(content);
    if (!parsed) return null;

    return formatParsedJsonToProfile(parsed);
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

// ─── JSON to ProfileData Normalization ────────────────────────────────────────

function formatParsedJsonToProfile(data: any): ProfileData {
  const profile = createEmptyProfile();

  // 1. Basics
  if (data.basics && typeof data.basics === "object") {
    profile.basics = {
      name: String(data.basics.name || "").trim(),
      headline: String(data.basics.headline || "").trim(),
      email: String(data.basics.email || "").trim(),
      phone: String(data.basics.phone || "").trim(),
      dob: String(data.basics.dob || "").trim(),
      website: String(data.basics.website || "").trim(),
      address: String(data.basics.address || "").trim(),
      city: String(data.basics.city || "").trim(),
      country: String(data.basics.country || "").trim(),
      linkedin: String(data.basics.linkedin || "").trim(),
      summary: String(data.basics.summary || "").trim(),
      showAge: false,
    };
  }

  // 2. Skills Map
  const skillMap = new Map<string, string>(); // lowercase name -> skill.id
  if (Array.isArray(data.skills)) {
    data.skills.forEach((s: any, idx: number) => {
      const name = String(s.name || s || "").trim();
      if (!name) return;
      const lower = name.toLowerCase();
      if (!skillMap.has(lower)) {
        const id = `s-${idx + 1}-${Date.now().toString(36)}`;
        skillMap.set(lower, id);
        profile.skills.push({
          id,
          name,
          group: String(s.group || "Other").trim(),
        });
      }
    });
  }

  // Helper to map skill names to IDs (and add if missing)
  const getOrCreateSkillIds = (names: any[]): string[] => {
    if (!Array.isArray(names)) return [];
    const ids: string[] = [];
    for (const raw of names) {
      const name = String(raw).trim();
      if (!name) continue;
      const lower = name.toLowerCase();
      let id = skillMap.get(lower);
      if (!id) {
        id = `s-${profile.skills.length + 1}-${Date.now().toString(36)}`;
        skillMap.set(lower, id);
        profile.skills.push({ id, name, group: "Other" });
      }
      ids.push(id);
    }
    return ids;
  };

  // 3. Experience
  if (Array.isArray(data.experience)) {
    profile.experience = data.experience.map((e: any, idx: number): ExperienceItem => {
      const bullets = Array.isArray(e.bullets)
        ? e.bullets.filter(Boolean).join("\n")
        : String(e.bullets || "").trim();

      return {
        id: `exp-${idx + 1}-${Date.now().toString(36)}`,
        role: String(e.role || "").trim(),
        company: String(e.company || "").trim(),
        location: String(e.location || "").trim(),
        descriptor: String(e.descriptor || "").trim(),
        startMonth: typeof e.startMonth === "number" ? e.startMonth : null,
        startYear: typeof e.startYear === "number" ? e.startYear : null,
        endMonth: typeof e.endMonth === "number" ? e.endMonth : null,
        endYear: typeof e.endYear === "number" ? e.endYear : null,
        current: Boolean(e.current),
        bullets,
        skillIds: getOrCreateSkillIds(e.skillsUsed || []),
      };
    });
  }

  // 4. Projects
  if (Array.isArray(data.projects)) {
    profile.projects = data.projects.map((p: any, idx: number): ProjectItem => {
      const bullets = Array.isArray(p.bullets)
        ? p.bullets.filter(Boolean).join("\n")
        : String(p.bullets || "").trim();

      return {
        id: `proj-${idx + 1}-${Date.now().toString(36)}`,
        name: String(p.name || "").trim(),
        link: String(p.link || "").trim(),
        startMonth: typeof p.startMonth === "number" ? p.startMonth : null,
        startYear: typeof p.startYear === "number" ? p.startYear : null,
        endMonth: typeof p.endMonth === "number" ? p.endMonth : null,
        endYear: typeof p.endYear === "number" ? p.endYear : null,
        current: Boolean(p.current),
        bullets,
        skillIds: getOrCreateSkillIds(p.skillsUsed || []),
      };
    });
  }

  // 5. Education
  if (Array.isArray(data.education)) {
    profile.education = data.education.map((edu: any, idx: number): EducationItem => {
      return {
        id: `edu-${idx + 1}-${Date.now().toString(36)}`,
        degree: String(edu.degree || "").trim(),
        school: String(edu.school || "").trim(),
        location: String(edu.location || "").trim(),
        startMonth: typeof edu.startMonth === "number" ? edu.startMonth : null,
        startYear: typeof edu.startYear === "number" ? edu.startYear : null,
        endMonth: typeof edu.endMonth === "number" ? edu.endMonth : null,
        endYear: typeof edu.endYear === "number" ? edu.endYear : null,
        current: Boolean(edu.current),
        notes: String(edu.notes || "").trim(),
      };
    });
  }

  // 6. Certifications
  if (Array.isArray(data.certifications)) {
    profile.certifications = data.certifications.map((c: any, idx: number): CertificationItem => {
      return {
        id: `cert-${idx + 1}-${Date.now().toString(36)}`,
        name: String(c.name || "").trim(),
        issuer: String(c.issuer || "").trim(),
        issueDate: String(c.issueDate || "").trim(),
        link: String(c.link || "").trim(),
        onResumes: true,
      };
    });
    profile.publications = [...profile.certifications];
  }

  // 7. Languages
  if (Array.isArray(data.languages)) {
    const validLevels = Object.values(LanguageLevel);
    profile.languages = data.languages.map((l: any, idx: number): LanguageItem => {
      const levelStr = String(l.level || "").toUpperCase();
      const level = validLevels.includes(levelStr as LanguageLevel)
        ? (levelStr as LanguageLevel)
        : LanguageLevel.C1;
      return {
        id: `lang-${idx + 1}-${Date.now().toString(36)}`,
        name: String(l.name || "").trim(),
        level,
      };
    });
  }

  return profile;
}

// ─── JSON Resume Format Mapper ───────────────────────────────────────────────

function mapJsonResumeToProfile(json: any): ProfileData | null {
  if (!json || typeof json !== "object") return null;

  // Check if it's already a ProfileData object
  if (json.basics && (Array.isArray(json.experience) || Array.isArray(json.skills))) {
    return formatParsedJsonToProfile(json);
  }

  // Standard JSON Resume schema support (jsonresume.org)
  if (json.basics && (json.work || json.education || json.skills)) {
    const adapted: any = {
      basics: {
        name: json.basics.name,
        headline: json.basics.label,
        email: json.basics.email,
        phone: json.basics.phone,
        website: json.basics.url,
        summary: json.basics.summary,
        city: json.basics.location?.city,
        country: json.basics.location?.countryCode || json.basics.location?.country,
      },
      skills: (json.skills || []).flatMap((s: any) =>
        (s.keywords || [s.name]).map((k: string) => ({ name: k, group: s.name || "Other" }))
      ),
      experience: (json.work || []).map((w: any) => ({
        role: w.position,
        company: w.name,
        location: w.location,
        descriptor: w.summary,
        current: !w.endDate,
        bullets: Array.isArray(w.highlights) ? w.highlights.join("\n") : w.summary || "",
      })),
      education: (json.education || []).map((e: any) => ({
        degree: [e.studyType, e.area].filter(Boolean).join(" in "),
        school: e.institution,
        notes: Array.isArray(e.courses) ? e.courses.join(", ") : "",
      })),
      projects: (json.projects || []).map((p: any) => ({
        name: p.name,
        link: p.url,
        bullets: Array.isArray(p.highlights) ? p.highlights.join("\n") : p.description || "",
      })),
      certifications: (json.certificates || []).map((c: any) => ({
        name: c.name,
        issuer: c.issuer,
        issueDate: c.date,
        link: c.url,
      })),
      languages: (json.languages || []).map((l: any) => ({
        name: l.language,
        level: LanguageLevel.C1,
      })),
    };
    return formatParsedJsonToProfile(adapted);
  }

  return null;
}

// ─── Fallback Heuristic CV Parser ────────────────────────────────────────────

export function heuristicCvParser(text: string, baseProfile?: ProfileData): ProfileData {
  const profile = baseProfile ? { ...baseProfile } : createEmptyProfile();
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // 1. Contact information regexes
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) profile.basics.email = emailMatch[0];

  const phoneMatch = text.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  if (phoneMatch) profile.basics.phone = phoneMatch[0];

  const linkedinMatch = text.match(/https?:\/\/(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+/i);
  if (linkedinMatch) profile.basics.linkedin = linkedinMatch[0];

  const githubMatch = text.match(/https?:\/\/(?:www\.)?github\.com\/[a-zA-Z0-9_-]+/i);
  if (githubMatch && !profile.basics.website) profile.basics.website = githubMatch[0];

  // 2. Name extraction: usually first line without an @ or URL
  for (const line of lines.slice(0, 5)) {
    if (
      line.length > 2 &&
      line.length < 40 &&
      !line.includes("@") &&
      !line.includes("http") &&
      !/resume|curriculum|cv|page/i.test(line)
    ) {
      profile.basics.name = line;
      break;
    }
  }

  // 3. Section breakdown
  type SectionType = "summary" | "experience" | "education" | "skills" | "projects" | "certifications" | "other";
  let currentSection: SectionType = "other";
  const sectionContent: Record<SectionType, string[]> = {
    summary: [],
    experience: [],
    education: [],
    skills: [],
    projects: [],
    certifications: [],
    other: [],
  };

  const sectionHeaders: { regex: RegExp; section: SectionType }[] = [
    { regex: /^(?:summary|professional summary|about me|profile|overview)\b/i, section: "summary" },
    { regex: /^(?:experience|work experience|employment|history|professional experience)\b/i, section: "experience" },
    { regex: /^(?:education|academic background|academics|qualifications)\b/i, section: "education" },
    { regex: /^(?:skills|technical skills|competencies|technologies)\b/i, section: "skills" },
    { regex: /^(?:projects|personal projects|key projects)\b/i, section: "projects" },
    { regex: /^(?:certifications|certificates|licenses)\b/i, section: "certifications" },
  ];

  for (const line of lines) {
    let matchedHeader = false;
    for (const h of sectionHeaders) {
      if (h.regex.test(line) && line.length < 40) {
        currentSection = h.section;
        matchedHeader = true;
        break;
      }
    }
    if (!matchedHeader) {
      sectionContent[currentSection].push(line);
    }
  }

  // 4. Fill summary
  if (sectionContent.summary.length > 0) {
    profile.basics.summary = sectionContent.summary.join(" ").slice(0, 1000);
  }

  // 5. Fill skills
  if (sectionContent.skills.length > 0) {
    const rawSkillsText = sectionContent.skills.join(", ");
    const skillTokens = rawSkillsText
      .split(/[,•|·\n\t]+/)
      .map((s) => s.replace(/^[-*•\s]+/, "").trim())
      .filter((s) => s.length > 1 && s.length < 35);

    const seen = new Set<string>();
    for (const token of skillTokens) {
      const lower = token.toLowerCase();
      if (!seen.has(lower) && profile.skills.length < 30) {
        seen.add(lower);
        profile.skills.push({
          id: `s-${profile.skills.length + 1}`,
          name: token,
          group: "Technical Skills",
        });
      }
    }
  }

  // 6. Experience items
  if (sectionContent.experience.length > 0) {
    const expLines = sectionContent.experience;
    let currentExp: Partial<ExperienceItem> | null = null;
    let currentBullets: string[] = [];

    for (const line of expLines) {
      const dateMatch = line.match(/(?:(?:19|20)\d{2})/);
      const isBullet = /^[-*•·]/.test(line);

      if (dateMatch && !isBullet && line.length < 80) {
        if (currentExp && (currentExp.role || currentExp.company)) {
          profile.experience.push({
            id: `exp-${profile.experience.length + 1}`,
            role: currentExp.role || "Role",
            company: currentExp.company || "Company",
            location: currentExp.location || "",
            descriptor: "",
            startYear: currentExp.startYear ?? null,
            startMonth: null,
            endYear: currentExp.endYear ?? null,
            endMonth: null,
            current: Boolean(currentExp.current),
            bullets: currentBullets.join("\n"),
            skillIds: [],
          });
          currentBullets = [];
        }

        const years = line.match(/(?:19|20)\d{2}/g)?.map(Number) || [];
        const isCurrent = /present|current|now/i.test(line);

        currentExp = {
          role: line.replace(/(?:19|20)\d{2}.*/, "").replace(/[-|·]/g, "").trim(),
          company: "",
          startYear: years[0] || null,
          endYear: years[1] || null,
          current: isCurrent,
        };
      } else if (isBullet) {
        currentBullets.push(line.replace(/^[-*•·\s]+/, "").trim());
      } else if (currentExp && !currentExp.company) {
        currentExp.company = line;
      }
    }

    if (currentExp && (currentExp.role || currentExp.company)) {
      profile.experience.push({
        id: `exp-${profile.experience.length + 1}`,
        role: currentExp.role || "Role",
        company: currentExp.company || "Company",
        location: currentExp.location || "",
        descriptor: "",
        startYear: currentExp.startYear ?? null,
        startMonth: null,
        endYear: currentExp.endYear ?? null,
        endMonth: null,
        current: Boolean(currentExp.current),
        bullets: currentBullets.join("\n"),
        skillIds: [],
      });
    }
  }

  // 7. Education items
  if (sectionContent.education.length > 0) {
    const eduLines = sectionContent.education;
    let school = "";
    let degree = "";

    for (const line of eduLines) {
      if (/bachelor|master|phd|b\.s|m\.s|b\.a|degree|diploma/i.test(line)) {
        degree = line;
      } else if (/university|college|institute|school|academy/i.test(line)) {
        school = line;
      }
    }

    if (school || degree) {
      profile.education.push({
        id: `edu-1`,
        degree: degree || "Degree",
        school: school || "University",
        notes: "",
        startYear: null,
        startMonth: null,
        endYear: null,
        endMonth: null,
        current: false,
      });
    }
  }

  return profile;
}

function parseJsonResiliently(str: string): any {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch {}

  const firstBrace = str.indexOf("{");
  const lastBrace = str.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(str.slice(firstBrace, lastBrace + 1));
    } catch {}
  }
  return null;
}

