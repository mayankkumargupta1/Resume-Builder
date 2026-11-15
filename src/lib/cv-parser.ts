import { extractText, extractLinks, getDocumentProxy } from "unpdf";
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
 * Extracts plain text along with embedded hyperlinks from an uploaded CV file buffer.
 * Supports PDF (with link annotations), DOCX (Word), TXT, MD, and JSON Resume.
 */
export async function extractCvTextFromFile(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<string> {
  const lowerName = fileName.toLowerCase();

  // 1. PDF with embedded hyperlink extraction
  if (mimeType.includes("pdf") || lowerName.endsWith(".pdf")) {
    try {
      return await extractPdfTextWithLinks(new Uint8Array(buffer));
    } catch (err: any) {
      console.warn("Detailed PDF extraction failed, attempting simple extractText:", err);
      try {
        const { text } = await extractText(new Uint8Array(buffer));
        const { links } = await extractLinks(new Uint8Array(buffer));
        let baseText = Array.isArray(text) ? text.join("\n\n") : String(text || "");
        if (links && links.length > 0) {
          baseText +=
            "\n\n--- DETECTED PDF HYPERLINKS ---\n" +
            links.map((l) => `- ${l}`).join("\n");
        }
        return baseText;
      } catch (innerErr: any) {
        throw new Error(`Failed to read PDF file: ${innerErr.message || "Unknown error"}`);
      }
    }
  }

  // 2. Word (.docx) with markdown hyperlink extraction
  if (
    mimeType.includes("word") ||
    mimeType.includes("officedocument") ||
    lowerName.endsWith(".docx")
  ) {
    try {
      // convertToMarkdown preserves [Anchor Text](https://...) from Word documents
      const mdResult = await (mammoth as any).convertToMarkdown({ buffer });
      if (mdResult.value && mdResult.value.trim().length > 20) {
        return mdResult.value;
      }
      const rawResult = await mammoth.extractRawText({ buffer });
      return rawResult.value || "";
    } catch (err: any) {
      console.warn("mammoth docx text extraction failed:", err);
      throw new Error(`Failed to read Word document: ${err.message || "Unknown error"}`);
    }
  }

  // 3. JSON or plain text / markdown
  return buffer.toString("utf-8");
}

/**
 * Extracts text from a PDF buffer while mapping link annotations to the overlapping text,
 * inlining them as markdown `[Text](url)` and compiling a list of all discovered URLs.
 */
async function extractPdfTextWithLinks(pdfData: Uint8Array): Promise<string> {
  const discoveredLinks = new Set<string>();
  let coordinateText = "";

  try {
    const pdf = await getDocumentProxy(pdfData);
    const pageTexts: string[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const [textContent, annotations] = await Promise.all([
        page.getTextContent(),
        page.getAnnotations(),
      ]);

      // Collect link annotations with their destination URLs and bounding rects
      const linkAnnotations = (annotations || [])
        .filter((a: any) => a.subtype === "Link" && a.url)
        .map((a: any) => {
          const url = String(a.url).trim();
          discoveredLinks.add(url);
          return {
            url,
            rect: a.rect as [number, number, number, number],
          };
        });

      // Helper to check if text coordinate overlaps with a link annotation rect
      const findLinkForCoord = (x: number, y: number) => {
        return linkAnnotations.find(({ rect }) => {
          if (!rect || rect.length < 4) return false;
          const minX = Math.min(rect[0], rect[2]) - 4;
          const maxX = Math.max(rect[0], rect[2]) + 4;
          const minY = Math.min(rect[1], rect[3]) - 4;
          const maxY = Math.max(rect[1], rect[3]) + 4;
          return x >= minX && x <= maxX && y >= minY && y <= maxY;
        });
      };

      const items = (textContent?.items || []) as any[];
      let currentLineY: number | null = null;
      const pageLines: string[] = [];
      let currentLineTokens: string[] = [];

      for (const item of items) {
        if (!item.str) continue;
        const tx = item.transform?.[4] ?? 0;
        const ty = item.transform?.[5] ?? 0;

        if (currentLineY === null || Math.abs(ty - currentLineY) > 5) {
          if (currentLineTokens.length > 0) {
            pageLines.push(currentLineTokens.join(" "));
            currentLineTokens = [];
          }
          currentLineY = ty;
        }

        const link = findLinkForCoord(tx, ty);
        if (
          link &&
          !item.str.includes(link.url) &&
          !link.url.startsWith("mailto:" + item.str) &&
          item.str.trim().length > 1
        ) {
          currentLineTokens.push(`[${item.str}](${link.url})`);
        } else {
          currentLineTokens.push(item.str);
        }
      }

      if (currentLineTokens.length > 0) {
        pageLines.push(currentLineTokens.join(" "));
      }

      pageTexts.push(pageLines.join("\n"));
    }

    coordinateText = pageTexts.join("\n\n");
  } catch (err) {
    console.warn("Detailed PDF coordinate link extraction error:", err);
  }

  // Fallback or verify with extractText
  let baseText = coordinateText.trim();
  if (baseText.length < 30) {
    try {
      const { text } = await extractText(pdfData);
      baseText = Array.isArray(text) ? text.join("\n\n") : String(text || "");
    } catch {}
  }

  // Ensure all links from unpdf extractLinks are also collected
  try {
    const { links } = await extractLinks(pdfData);
    for (const l of links || []) {
      if (l) discoveredLinks.add(String(l).trim());
    }
  } catch {}

  // Append explicit section with all detected links
  if (discoveredLinks.size > 0) {
    baseText +=
      "\n\n--- DETECTED PDF HYPERLINKS ---\n" +
      Array.from(discoveredLinks)
        .map((link) => `- ${link}`)
        .join("\n");
  }

  return baseText;
}

/**
 * Extracts all URLs from text, markdown links, or the detected hyperlinks section.
 */
function extractAllUrlsFromText(text: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  const add = (u: string) => {
    let clean = u.replace(/[,\.\)\]'"]+$/, "").trim();
    if (clean && (clean.startsWith("http://") || clean.startsWith("https://"))) {
      if (!seen.has(clean.toLowerCase())) {
        seen.add(clean.toLowerCase());
        urls.push(clean);
      }
    }
  };

  // 1. Markdown links: [text](url)
  const mdRegex = /\[([^\]]*)\]\((https?:\/\/[^\s\)]+)\)/g;
  let mdMatch;
  while ((mdMatch = mdRegex.exec(text)) !== null) {
    add(mdMatch[2]);
  }

  // 2. Detected hyperlinks section (- url)
  const detectedSection = text.split("--- DETECTED PDF HYPERLINKS ---")[1] || "";
  const listRegex = /^[*-]\s+(https?:\/\/[^\s]+)/gm;
  let listMatch;
  while ((listMatch = listRegex.exec(detectedSection)) !== null) {
    add(listMatch[1]);
  }

  // 3. Any raw URLs
  const urlRegex = /(https?:\/\/[a-zA-Z0-9\-_.]+\.[a-zA-Z]{2,}[^\s\)\],"'<>]*)/g;
  let urlMatch;
  while ((urlMatch = urlRegex.exec(text)) !== null) {
    add(urlMatch[1]);
  }

  return urls;
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
      const mapped = mapJsonResumeToProfile(directJson, cleanText);
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

CRITICAL HYPERLINK RULES:
- Inspect all markdown hyperlinks (e.g. [Project Alpha](https://github.com/...) or [Portfolio](https://...)) AND any URLs listed under '--- DETECTED PDF HYPERLINKS ---'.
- Candidate's LinkedIn profile URL -> basics.linkedin
- Candidate's personal portfolio / website / GitHub profile -> basics.website
- Project repositories or live demo URLs -> projects[i].link (Match each project with its repository, demo, or GitHub link)
- Certification verification or Credly links -> certifications[i].link
- mailto: links -> basics.email
- Never omit project links or profile links if they are present anywhere in the document.

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
      "link": "https://github.com/... or live demo link",
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
      "level": "NATIVE"
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

    return formatParsedJsonToProfile(parsed, cvText);
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

// ─── JSON to ProfileData Normalization with Smart Link Resolution ─────────────

function formatParsedJsonToProfile(data: any, rawCvText: string = ""): ProfileData {
  const profile = createEmptyProfile();
  const allUrls = extractAllUrlsFromText(rawCvText);

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

  // Smart Link Matching for Basics:
  if (!profile.basics.linkedin) {
    const li = allUrls.find((u) => u.includes("linkedin.com/in/"));
    if (li) profile.basics.linkedin = li;
  }

  if (!profile.basics.website) {
    const web = allUrls.find(
      (u) =>
        !u.includes("linkedin.com") &&
        !u.includes("credly.com") &&
        (u.includes("github.io") ||
          u.includes(".dev") ||
          u.includes(".me") ||
          u.includes("portfolio") ||
          u.includes("vercel.app") ||
          /^https?:\/\/(?:www\.)?github\.com\/[a-zA-Z0-9_-]+\/?$/.test(u))
    );
    if (web) profile.basics.website = web;
  }

  // 2. Skills Map
  const skillMap = new Map<string, string>();
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

  // 4. Projects with Link Resolution
  const projectUrls = allUrls.filter(
    (u) =>
      u !== profile.basics.linkedin &&
      u !== profile.basics.website &&
      !u.includes("linkedin.com") &&
      !u.includes("credly.com")
  );

  if (Array.isArray(data.projects)) {
    profile.projects = data.projects.map((p: any, idx: number): ProjectItem => {
      const bullets = Array.isArray(p.bullets)
        ? p.bullets.filter(Boolean).join("\n")
        : String(p.bullets || "").trim();

      let link = String(p.link || "").trim();

      // If link is empty, match with available extracted project/GitHub URLs
      if (!link && projectUrls.length > 0) {
        const nameTokens = String(p.name || "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, " ")
          .split(" ")
          .filter((t) => t.length > 2);

        const matched = projectUrls.find((u) => {
          const lowerUrl = u.toLowerCase();
          return nameTokens.some((token) => lowerUrl.includes(token));
        });

        if (matched) {
          link = matched;
        }
      }

      return {
        id: `proj-${idx + 1}-${Date.now().toString(36)}`,
        name: String(p.name || "").trim(),
        link,
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

  // 6. Certifications with Link Resolution
  if (Array.isArray(data.certifications)) {
    profile.certifications = data.certifications.map((c: any, idx: number): CertificationItem => {
      let link = String(c.link || "").trim();
      if (!link) {
        const certUrl = allUrls.find(
          (u) => u.includes("credly.com") || u.includes("verify") || u.includes("certificate")
        );
        if (certUrl) link = certUrl;
      }

      return {
        id: `cert-${idx + 1}-${Date.now().toString(36)}`,
        name: String(c.name || "").trim(),
        issuer: String(c.issuer || "").trim(),
        issueDate: String(c.issueDate || "").trim(),
        link,
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

function mapJsonResumeToProfile(json: any, rawText: string = ""): ProfileData | null {
  if (!json || typeof json !== "object") return null;

  if (json.basics && (Array.isArray(json.experience) || Array.isArray(json.skills))) {
    return formatParsedJsonToProfile(json, rawText);
  }

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
    return formatParsedJsonToProfile(adapted, rawText);
  }

  return null;
}

// ─── Fallback Heuristic CV Parser with Link Detection ────────────────────────

export function heuristicCvParser(text: string, baseProfile?: ProfileData): ProfileData {
  const profile = baseProfile ? { ...baseProfile } : createEmptyProfile();
  const allUrls = extractAllUrlsFromText(text);

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // 1. Contact & Link extraction
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) profile.basics.email = emailMatch[0];

  const phoneMatch = text.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  if (phoneMatch) profile.basics.phone = phoneMatch[0];

  const linkedinUrl = allUrls.find((u) => u.includes("linkedin.com/in/"));
  if (linkedinUrl) profile.basics.linkedin = linkedinUrl;

  const websiteUrl = allUrls.find(
    (u) =>
      u !== linkedinUrl &&
      !u.includes("linkedin.com") &&
      !u.includes("credly.com") &&
      (u.includes("github.io") ||
        u.includes(".dev") ||
        u.includes(".me") ||
        u.includes("portfolio") ||
        u.includes("vercel.app") ||
        /^https?:\/\/(?:www\.)?github\.com\/[a-zA-Z0-9_-]+\/?$/.test(u))
  );
  if (websiteUrl) profile.basics.website = websiteUrl;

  // 2. Name extraction
  for (const line of lines.slice(0, 5)) {
    if (
      line.length > 2 &&
      line.length < 40 &&
      !line.includes("@") &&
      !line.includes("http") &&
      !/resume|curriculum|cv|page/i.test(line)
    ) {
      profile.basics.name = line.replace(/\[.*?\]/g, "").trim();
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
    if (line.startsWith("--- DETECTED PDF HYPERLINKS ---")) {
      break;
    }
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

  // 7. Projects with Link Extraction
  if (sectionContent.projects.length > 0) {
    const projLines = sectionContent.projects;
    let currentProj: Partial<ProjectItem> | null = null;
    let projBullets: string[] = [];

    for (const line of projLines) {
      const isBullet = /^[-*•·]/.test(line);
      const mdLinkMatch = line.match(/\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/);
      const rawUrlMatch = line.match(/(https?:\/\/[^\s\)]+)/);

      if (!isBullet && line.length < 80 && (mdLinkMatch || !currentProj)) {
        if (currentProj && currentProj.name) {
          profile.projects.push({
            id: `proj-${profile.projects.length + 1}`,
            name: currentProj.name,
            link: currentProj.link || "",
            bullets: projBullets.join("\n"),
            startYear: null,
            startMonth: null,
            endYear: null,
            endMonth: null,
            current: false,
            skillIds: [],
          });
          projBullets = [];
        }

        let name = line;
        let link = "";
        if (mdLinkMatch) {
          name = mdLinkMatch[1];
          link = mdLinkMatch[2];
        } else if (rawUrlMatch) {
          link = rawUrlMatch[1];
          name = line.replace(rawUrlMatch[1], "").replace(/[-|·]/g, "").trim();
        }

        currentProj = {
          name: name.trim() || "Project",
          link,
        };
      } else if (isBullet) {
        projBullets.push(line.replace(/^[-*•·\s]+/, "").trim());
      } else if (rawUrlMatch && currentProj && !currentProj.link) {
        currentProj.link = rawUrlMatch[1];
      }
    }

    if (currentProj && currentProj.name) {
      profile.projects.push({
        id: `proj-${profile.projects.length + 1}`,
        name: currentProj.name,
        link: currentProj.link || "",
        bullets: projBullets.join("\n"),
        startYear: null,
        startMonth: null,
        endYear: null,
        endMonth: null,
        current: false,
        skillIds: [],
      });
    }
  }

  // 8. Education items
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

  // Final Link matching for projects that don't have links
  const availableProjectUrls = allUrls.filter(
    (u) =>
      u !== profile.basics.linkedin &&
      u !== profile.basics.website &&
      !u.includes("linkedin.com") &&
      !u.includes("credly.com")
  );

  profile.projects.forEach((p) => {
    if (!p.link && availableProjectUrls.length > 0) {
      const nameTokens = p.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .split(" ")
        .filter((t) => t.length > 2);

      const matched = availableProjectUrls.find((u) => {
        const lowerUrl = u.toLowerCase();
        return nameTokens.some((token) => lowerUrl.includes(token));
      });

      if (matched) {
        p.link = matched;
      }
    }
  });

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
