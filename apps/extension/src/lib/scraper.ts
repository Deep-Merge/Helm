export type BudgetType = "fixed" | "hourly" | "unknown";

export type ClientInfo = {
  client_location?: string | null;
  client_country?: string | null;
  client_country_flag?: string | null;
  client_rating?: number | null;
  client_review_count?: number | null;
};

export type ScrapedProject = {
  freelancer_project_id: string;
  url: string;
  title: string;
  description: string;
  budget_text: string | null;
  budget_type: BudgetType;
  budget_min?: number | null;
  budget_max?: number | null;
  skills: string[];
  clarifications: ClarificationEntry[];
} & ClientInfo;

export type ClarificationEntry = {
  id: string;
  author: string;
  username: string | null;
  posted_at: string | null;
  text: string;
  is_employer_reply: boolean;
};

function extractProjectIdFromDom(): string | null {
  const match = document.body?.innerText?.match(/Project\s+ID\s*:\s*(\d+)/i);
  return match ? match[1] : null;
}

function extractSeoUrl(): string | null {
  const match = window.location.pathname.match(/^\/projects\/(.+?)(?:\/details)?\/?$/i);
  if (!match) return null;
  const seo = match[1];
  return /^\d+$/.test(seo) ? null : seo;
}

export function extractProjectId(): string | null {
  const slug = window.location.pathname.match(/\/projects\/([^/]+)/i)?.[1];
  if (slug) {
    const slugNumeric = slug.match(/-(\d{6,})$/)?.[1] ?? (/^\d{6,}$/.test(slug) ? slug : null);
    if (slugNumeric) return slugNumeric;
  }

  const numericPath = window.location.pathname.match(/\/projects\/[^/]+\/(\d+)/);
  if (numericPath) return numericPath[1];

  const domId = extractProjectIdFromDom();
  if (domId) return domId;

  const seo = extractSeoUrl();
  return seo ? seo.toLowerCase() : null;
}

function findProjectDescriptionInJson(obj: unknown, depth = 0): string | null {
  if (depth > 10 || obj == null || typeof obj !== "object") return null;

  const record = obj as Record<string, unknown>;
  const description = record.description;
  if (
    typeof description === "string" &&
    description.trim().length > 80 &&
    (typeof record.title === "string" ||
      typeof record.seo_url === "string" ||
      typeof record.id === "number")
  ) {
    return description.trim();
  }

  for (const value of Object.values(record)) {
    const found = findProjectDescriptionInJson(value, depth + 1);
    if (found) return found;
  }
  return null;
}

function scrapeDescriptionFromDom(): string {
  const candidates: string[] = [];

  const ogDesc = document.querySelector('meta[property="og:description"]')?.getAttribute("content");
  if (ogDesc?.trim() && ogDesc.trim().length > 40) candidates.push(ogDesc.trim());

  const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute("content");
  if (metaDesc?.trim() && metaDesc.trim().length > 40) candidates.push(metaDesc.trim());

  for (const script of Array.from(document.querySelectorAll('script[type="application/ld+json"]'))) {
    try {
      const json = JSON.parse(script.textContent || "");
      const desc =
        (typeof json.description === "string" && json.description) ||
        (typeof json.about === "object" &&
          json.about &&
          typeof (json.about as { description?: string }).description === "string" &&
          (json.about as { description: string }).description);
      if (typeof desc === "string" && desc.trim().length > 40) candidates.push(desc.trim());
    } catch {
      /* ignore malformed JSON-LD */
    }
  }

  const nextData = document.getElementById("__NEXT_DATA__");
  if (nextData?.textContent) {
    try {
      const parsed = findProjectDescriptionInJson(JSON.parse(nextData.textContent));
      if (parsed) candidates.push(parsed);
    } catch {
      /* ignore malformed __NEXT_DATA__ */
    }
  }

  for (const script of Array.from(document.querySelectorAll("script:not([src])"))) {
    const text = script.textContent || "";
    if (!/description/i.test(text) || text.length > 500_000) continue;
    const jsonMatch = text.match(/\{[\s\S]*"description"\s*:\s*"[\s\S]{80,}?"[\s\S]*\}/);
    if (!jsonMatch) continue;
    try {
      const parsed = findProjectDescriptionInJson(JSON.parse(jsonMatch[0]));
      if (parsed) candidates.push(parsed);
    } catch {
      /* ignore inline script JSON fragments */
    }
  }

  const bodyDesc = extractDescriptionFromBodyText();
  if (bodyDesc) candidates.push(bodyDesc);

  const descSelectors = [
    ".PageProject-description",
    '[data-project-description]',
    '[class*="ProjectDescription"]',
    '[class*="project-description"]',
    '[class*="PageProject"] [class*="description"]',
  ];
  for (const sel of descSelectors) {
    document.querySelectorAll(sel).forEach((el) => {
      if (isExtensionElement(el) || el.closest("form, textarea, input, .ba-panel")) return;
      const text = el.textContent?.trim();
      if (text && text.length > 40) candidates.push(text);
    });
  }

  document.querySelectorAll('[class*="description"]').forEach((el) => {
    if (isExtensionElement(el) || el.closest("form, textarea, input, .ba-panel")) return;
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) return;
    const text = el.textContent?.trim();
    if (text && text.length > 80) candidates.push(text);
  });

  const article = document.querySelector("article")?.textContent?.trim();
  if (article && article.length > 80) candidates.push(article.slice(0, 8000));

  return [...new Set(candidates)].sort((a, b) => b.length - a.length)[0]?.slice(0, 8000) || "";
}

function extractDescriptionFromBodyText(): string {
  const text = document.body?.innerText ?? "";
  const idMatch = text.match(/Project\s+ID\s*:\s*\d+/i);
  if (!idMatch?.index || idMatch.index < 100) return "";

  let chunk = text.slice(0, idMatch.index).trim();
  const afterEnds = chunk.match(/Ends in[^\n]*\n+([\s\S]+)/i);
  if (afterEnds?.[1]) chunk = afterEnds[1].trim();

  const stopAt = chunk.search(/\n(?:About the project|Place your bid|Open for bidding|Bid amount)\b/i);
  if (stopAt > 80) chunk = chunk.slice(0, stopAt);

  chunk = chunk.replace(/^[^\n]+\n(?:[₹$€£][^\n]+\n)?(?:Open\n)?(?:Posted[^\n]*\n)?(?:•\n)?(?:Ends in[^\n]*\n)?/i, "");

  const lines = chunk
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const descLines: string[] = [];
  for (const line of lines) {
    if (
      descLines.length > 2 &&
      line.length < 40 &&
      !/[.!?:]$/.test(line) &&
      !/^[-•*]/.test(line)
    ) {
      break;
    }
    descLines.push(line);
  }

  const result = descLines.join("\n").trim();
  return result.length >= 80 ? result : "";
}

function detectBudgetTypeFromText(text: string | null | undefined): BudgetType {
  if (!text) return "unknown";
  const lower = text.toLowerCase();
  if (/\/\s*hour|per\s*hour|hourly/.test(lower)) return "hourly";
  if (/fixed|lump\s*sum|total\s*budget/.test(lower)) return "fixed";
  if (/[\$€£₹][\d,.]+[\s–-]+[\$€£₹]?[\d,.]+/.test(text) && !/\/\s*hour|per\s*hour/i.test(text)) {
    return "fixed";
  }
  return "unknown";
}

function parseBudgetTypeFromApi(project: Record<string, unknown>): BudgetType {
  if (project.type === "hourly") return "hourly";
  if (project.type === "fixed") return "fixed";
  return detectBudgetTypeFromText(formatBudgetFromApi(project));
}

function formatBudgetFromApi(project: Record<string, unknown>): string | null {
  const budget = project.budget as { minimum?: number; maximum?: number } | undefined;
  const currency = project.currency as { sign?: string; code?: string } | undefined;
  if (!budget?.minimum && !budget?.maximum) return null;
  const sign = currency?.sign ?? "";
  const code = currency?.code ?? "";
  const min = budget.minimum ?? budget.maximum;
  const max = budget.maximum ?? budget.minimum;
  const type = project.type === "hourly" ? " / hour" : "";
  return `${sign}${min} – ${sign}${max} ${code}${type}`.trim();
}

function parseBudgetBoundsFromApi(project: Record<string, unknown>): {
  budget_min: number | null;
  budget_max: number | null;
} {
  const budget = project.budget as { minimum?: number; maximum?: number } | undefined;
  return {
    budget_min: budget?.minimum ?? budget?.maximum ?? null,
    budget_max: budget?.maximum ?? budget?.minimum ?? null,
  };
}

function parseCountryFromApi(project: Record<string, unknown>): string | null {
  const readCountry = (node: unknown): string | null => {
    if (!node || typeof node !== "object") return null;
    const record = node as Record<string, unknown>;
    const country = record.country as Record<string, unknown> | undefined;
    if (typeof country?.name === "string") return country.name;
    if (typeof record.country_name === "string") return record.country_name;
    if (typeof record.name === "string" && record.code) return record.name;
    return null;
  };
  return (
    readCountry(project.location) ||
    readCountry((project.owner as Record<string, unknown> | undefined)?.location) ||
    null
  );
}

function parseCountryCodeFromLocation(node: unknown): string | null {
  if (!node || typeof node !== "object") return null;
  const record = node as Record<string, unknown>;
  const country = record.country as Record<string, unknown> | undefined;
  const code = country?.code ?? country?.country_code ?? record.country_code;
  if (typeof code === "string" && /^[A-Za-z]{2}$/.test(code)) return code.toUpperCase();
  return null;
}

function countryCodeToFlag(code: string | null | undefined): string | null {
  if (!code || !/^[A-Za-z]{2}$/.test(code)) return null;
  const upper = code.toUpperCase();
  return [...upper]
    .map((ch) => String.fromCodePoint(0x1f1e6 + ch.charCodeAt(0) - 65))
    .join("");
}

function flagCodeFromImageSrc(src: string | null | undefined): string | null {
  if (!src) return null;
  const match = src.match(/\/flags\/([a-z]{2})(?:\.|[/?])/i) || src.match(/flag[_-]?([a-z]{2})/i);
  return match ? match[1].toUpperCase() : null;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function parseReviewCount(value: unknown): number | null {
  const n = parseNumber(value);
  if (n == null) return null;
  return Math.max(0, Math.round(n));
}

function normalizeClientRating(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (value < 0 || value > 5) return null;
  return Math.round(value * 10) / 10;
}

function parseClientReputation(owner: Record<string, unknown> | undefined): {
  client_rating: number | null;
  client_review_count: number | null;
} {
  if (!owner) return { client_rating: null, client_review_count: null };

  const employerRep = owner.employer_reputation as Record<string, unknown> | undefined;
  const reputation = owner.reputation as Record<string, unknown> | undefined;
  const entire =
    (employerRep?.entire_history as Record<string, unknown> | undefined) ||
    (reputation?.entire_history as Record<string, unknown> | undefined) ||
    (reputation?.all as Record<string, unknown> | undefined) ||
    employerRep ||
    reputation;

  const rating = normalizeClientRating(
    parseNumber(entire?.overall) ??
      parseNumber(entire?.rating) ??
      parseNumber(employerRep?.overall) ??
      parseNumber(owner.rating),
  );

  const reviewCount =
    parseReviewCount(entire?.reviews) ??
    parseReviewCount(entire?.review_count) ??
    parseReviewCount(entire?.reviews_count) ??
    parseReviewCount(employerRep?.reviews) ??
    parseReviewCount(reputation?.review_count);

  return { client_rating: rating, client_review_count: reviewCount };
}

function parseClientFromApi(project: Record<string, unknown>): ClientInfo {
  const owner = project.owner as Record<string, unknown> | undefined;
  const location = (owner?.location ?? project.location) as Record<string, unknown> | undefined;
  const city =
    (typeof location?.city === "string" && location.city) ||
    (typeof location?.locality === "string" && location.locality) ||
    null;
  const country = parseCountryFromApi(project);
  const countryCode =
    parseCountryCodeFromLocation(location) ||
    parseCountryCodeFromLocation(project.location) ||
    parseCountryCodeFromLocation(owner?.location);
  const { client_rating, client_review_count } = parseClientReputation(owner);

  return {
    client_location: city,
    client_country: country,
    client_country_flag: countryCode,
    client_rating,
    client_review_count,
  };
}

async function fetchOwnerFromFreelancerApi(
  ownerId: string | number | null | undefined,
): Promise<ClientInfo | null> {
  if (ownerId == null) return null;
  const id = String(ownerId);
  if (!/^\d+$/.test(id)) return null;

  try {
    const res = await fetch(
      `https://www.freelancer.com/api/users/0.1/users/?users[]=${id}&avatar=true&country_details=true&employer_reputation=true`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { result?: { users?: Record<string, unknown>[] } };
    const user = data.result?.users?.[0];
    if (!user) return null;
    return parseClientFromApi({ owner: user, location: user.location });
  } catch {
    return null;
  }
}

function findAboutClientRoot(): HTMLElement | null {
  const headingCandidates = Array.from(
    document.querySelectorAll(
      'h1,h2,h3,h4,h5,h6,fl-heading,[class*="Heading"],[class*="heading"],legend,span,div,p',
    ),
  );

  for (const el of headingCandidates) {
    if (isExtensionElement(el)) continue;
    const text = el.textContent?.trim() || "";
    if (!/^about the client$/i.test(text)) continue;
    return (
      (el.closest(
        "section, fl-card, [class*='Card'], [class*='card'], [class*='client'], [class*='Client'], aside, main, article",
      ) as HTMLElement | null) || (el.parentElement?.parentElement as HTMLElement | null)
    );
  }

  return document.querySelector<HTMLElement>(
    '[data-testid*="about-client" i], [class*="about-client" i], [class*="AboutClient" i], [class*="employer-info" i]',
  );
}

function normalizeCountryName(text: string | null | undefined): string | null {
  if (!text) return null;
  const cleaned = text
    .replace(/member since.*/i, "")
    .replace(/^[A-Za-z]{2}\s+/, "")
    .trim();
  return cleaned || null;
}

function scrapeClientFromDom(): ClientInfo {
  const root = findAboutClientRoot();
  if (!root || isExtensionElement(root)) return {};

  const flagImg = root.querySelector<HTMLImageElement>(
    'img[src*="flag" i], img[src*="/flags/" i], img[alt*="flag" i]',
  );
  let client_country_flag = flagCodeFromImageSrc(flagImg?.src) || null;

  const rawLines = (root.innerText || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const lines = rawLines.filter(
    (l) =>
      !/^about the client$/i.test(l) &&
      !/^client engagement$/i.test(l) &&
      !/upgrade your membership/i.test(l),
  );

  let client_location: string | null = null;
  let client_country: string | null = null;
  let client_rating: number | null = null;
  let client_review_count: number | null = null;

  for (const line of lines) {
    if (/^member since/i.test(line)) continue;

    if (
      /^(United States|United Kingdom|Canada|Australia|India|Germany|France|Philippines|Netherlands|Brazil|Mexico|Spain|Italy|Japan|China|Singapore|Malaysia|Pakistan|Bangladesh|Nigeria|South Africa|New Zealand|Ireland|Sweden|Norway|Denmark|Finland|Belgium|Austria|Switzerland|Portugal|Poland|Romania|Ukraine|Russia|Indonesia|Vietnam|Thailand|Turkey|Saudi Arabia|United Arab Emirates|Israel|Egypt|Argentina|Colombia|Chile|Peru|Venezuela)\b/i.test(
        line,
      ) ||
      /^[A-Za-z]{2}\s+[A-Z]/.test(line)
    ) {
      client_country = normalizeCountryName(line);
      if (!client_country_flag) {
        const codeMatch = line.match(/^([A-Za-z]{2})\s+/);
        if (codeMatch) client_country_flag = codeMatch[1].toUpperCase();
      }
      continue;
    }

    const ratingReviews = line.match(/^(\d+\.\d+)\s+(\d+)\s*$/);
    if (ratingReviews) {
      client_rating = normalizeClientRating(parseNumber(ratingReviews[1]));
      client_review_count = parseReviewCount(ratingReviews[2]);
      continue;
    }

    const ratingOnly = line.match(/^(\d+\.\d+)\s*$/);
    if (ratingOnly) {
      client_rating = normalizeClientRating(parseNumber(ratingOnly[1]));
      continue;
    }

    const reviewsOnly = line.match(/^(\d+)\s*$/);
    if (reviewsOnly && client_rating != null && client_review_count == null) {
      client_review_count = parseReviewCount(reviewsOnly[1]);
      continue;
    }

    if (
      !client_location &&
      line.length > 1 &&
      line.length < 50 &&
      !/^\d/.test(line) &&
      !/\d+\.\d+/.test(line) &&
      !/member|review|rating|engagement|upgrade/i.test(line)
    ) {
      client_location = line;
    }
  }

  const ratingRow = root.querySelector(
    '[class*="rating" i], [class*="reputation" i], fl-rating, [class*="Review"]',
  );
  if (ratingRow && !isExtensionElement(ratingRow)) {
    const rowText = ratingRow.textContent?.replace(/\s+/g, " ").trim() || "";
    const ratingMatch = rowText.match(/(\d+\.\d+)/);
    if (ratingMatch && client_rating == null) {
      client_rating = normalizeClientRating(parseNumber(ratingMatch[1]));
    }
    const reviewMatch = rowText.match(/(\d+)\s*$/);
    if (reviewMatch && client_review_count == null) {
      client_review_count = parseReviewCount(reviewMatch[1]);
    }
  }

  if (client_review_count == null && client_rating != null) {
    const bubbleMatch = (root.innerText || "").match(/\d+\.\d+[^\d]*(\d+)\s*(?:\n|$)/);
    if (bubbleMatch) client_review_count = parseReviewCount(bubbleMatch[1]);
  }

  if (!client_country_flag && client_country) {
    const known: Record<string, string> = {
      "United States": "US",
      "United Kingdom": "GB",
      Canada: "CA",
      Australia: "AU",
      India: "IN",
    };
    client_country_flag = known[client_country] ?? null;
  }

  return {
    client_location,
    client_country,
    client_country_flag,
    client_rating,
    client_review_count,
  };
}

function mergeClientInfo(...sources: Array<Partial<ClientInfo> | null | undefined>): ClientInfo {
  const merged: ClientInfo = {};
  for (const source of sources) {
    if (!source) continue;
    if (source.client_location) merged.client_location = source.client_location;
    if (source.client_country) merged.client_country = normalizeCountryName(source.client_country);
    if (source.client_country_flag) {
      const flag = source.client_country_flag.trim();
      if (/^[A-Za-z]{2}$/.test(flag)) {
        merged.client_country_flag = flag.toUpperCase();
      }
    }
    if (source.client_rating != null) {
      const rating = normalizeClientRating(source.client_rating);
      if (rating != null) merged.client_rating = rating;
    }
    if (source.client_review_count != null) {
      merged.client_review_count = source.client_review_count;
    }
  }
  if (!merged.client_country_flag && merged.client_country) {
    const known: Record<string, string> = {
      "United States": "US",
      "United Kingdom": "GB",
      Canada: "CA",
      Australia: "AU",
      India: "IN",
    };
    merged.client_country_flag = known[merged.client_country] ?? null;
  }
  return merged;
}

async function fetchProjectFromFreelancerApi(
  projectId?: string | null,
  seoUrl?: string | null,
): Promise<Partial<ScrapedProject> | null> {
  let apiUrl: string | null = null;
  if (projectId && /^\d+$/.test(projectId)) {
    apiUrl = `https://www.freelancer.com/api/projects/0.1/projects/?projects[]=${projectId}&full_description=true`;
  } else if (seoUrl) {
    apiUrl = `https://www.freelancer.com/api/projects/0.1/projects/?seo_urls[]=${encodeURIComponent(seoUrl)}&full_description=true`;
  }
  if (!apiUrl) return null;

  try {
    const res = await fetch(apiUrl);
    if (!res.ok) return null;
    const data = (await res.json()) as { result?: { projects?: Record<string, unknown>[] } };
    const project = data.result?.projects?.[0];
    if (!project) return null;

    const jobs = project.jobs as { name?: string }[] | null | undefined;
    const skills = Array.isArray(jobs)
      ? jobs.map((j) => j.name).filter((s): s is string => !!s)
      : [];
    const bounds = parseBudgetBoundsFromApi(project);
    let clientInfo = parseClientFromApi(project);

    const ownerId =
      (project.owner_id as number | string | undefined) ??
      ((project.owner as Record<string, unknown> | undefined)?.id as number | string | undefined);
    if ((clientInfo.client_rating == null || !clientInfo.client_country) && ownerId != null) {
      const ownerInfo = await fetchOwnerFromFreelancerApi(ownerId);
      if (ownerInfo) clientInfo = mergeClientInfo(clientInfo, ownerInfo);
    }

    return {
      freelancer_project_id: String(project.id),
      title: typeof project.title === "string" ? project.title : undefined,
      description: typeof project.description === "string" ? project.description.trim() : "",
      budget_text: formatBudgetFromApi(project),
      budget_type: parseBudgetTypeFromApi(project),
      budget_min: bounds.budget_min,
      budget_max: bounds.budget_max,
      ...clientInfo,
      skills,
      url:
        typeof project.seo_url === "string"
          ? `https://www.freelancer.com/projects/${project.seo_url}`
          : undefined,
    };
  } catch {
    return null;
  }
}

export function scrapeProject(): ScrapedProject {
  const title =
    document.querySelector("h1")?.textContent?.trim() ||
    document.querySelector('[class*="title"]')?.textContent?.trim() ||
    "Untitled Project";

  const description = scrapeDescriptionFromDom();

  const budget =
    document.querySelector('[class*="budget"]')?.textContent?.trim() ||
    document.querySelector('[class*="Budget"]')?.textContent?.trim() ||
    null;

  const budgetType = detectBudgetTypeFromText(budget);

  const skillEls = document.querySelectorAll('[class*="skill"], .Skill, a[href*="/jobs/"]');
  const skills = Array.from(skillEls)
    .map((el) => el.textContent?.trim())
    .filter((s): s is string => !!s && s.length < 40)
    .slice(0, 10);

  const projectId = extractProjectId() || title.slice(0, 30);

  return {
    freelancer_project_id: projectId,
    url: window.location.href.split("/details")[0] || window.location.href,
    title,
    description,
    budget_text: budget,
    budget_type: budgetType,
    skills: [...new Set(skills)],
    clarifications: [],
    ...scrapeClientFromDom(),
  };
}

function clarificationEntryId(entry: Omit<ClarificationEntry, "id">): string {
  const base = `${entry.username || entry.author}:${entry.posted_at || ""}:${entry.text.slice(0, 120)}`;
  let hash = 0;
  for (let i = 0; i < base.length; i += 1) {
    hash = (hash * 31 + base.charCodeAt(i)) >>> 0;
  }
  return `cb-${hash.toString(36)}`;
}

function findClarificationBoardRoot(): HTMLElement | null {
  const headingCandidates = Array.from(
    document.querySelectorAll(
      'h1,h2,h3,h4,h5,h6,fl-heading,[class*="Heading"],[class*="heading"],legend,span,div,p',
    ),
  );

  for (const el of headingCandidates) {
    if (isExtensionElement(el)) continue;
    const text = el.textContent?.trim() || "";
    if (!/^clarification\s+board$/i.test(text) && !/^public\s+clarification\s+board$/i.test(text)) {
      continue;
    }
    return (
      (el.closest(
        "section, fl-card, fl-project-comments, [class*='Card'], [class*='card'], [class*='board'], [class*='Board'], main, article",
      ) as HTMLElement | null) ||
      (el.parentElement?.parentElement as HTMLElement | null)
    );
  }

  const byAttr = document.querySelector<HTMLElement>(
    '[data-testid*="clarification" i], [class*="clarification-board" i], [class*="ClarificationBoard" i], fl-project-comments',
  );
  return byAttr && !isExtensionElement(byAttr) ? byAttr : null;
}

function dedupeClarificationBlocks(blocks: HTMLElement[]): HTMLElement[] {
  return blocks.filter((block, idx) => {
    for (let j = 0; j < blocks.length; j += 1) {
      if (idx !== j && blocks[j].contains(block)) return false;
    }
    return true;
  });
}

function parseCommentBlock(el: HTMLElement): ClarificationEntry | null {
  const raw = el.innerText?.trim() || "";
  if (raw.length < 20) return null;
  if (/clarification\s+board|no spam|get verified|report project/i.test(raw) && raw.length < 120) {
    return null;
  }

  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return null;

  let author = "";
  let username: string | null = null;
  let postedAt: string | null = null;
  let bodyStart = 0;

  for (let i = 0; i < Math.min(lines.length, 6); i += 1) {
    const line = lines[i];
    const userMatch = line.match(/^@([A-Za-z0-9_]+)$/);
    if (userMatch) {
      username = userMatch[1];
      continue;
    }
    if (/^\d+\s*(m|h|d|mo|yr|min|sec|hour|day|week|month|year)s?\b/i.test(line) || /^less than/i.test(line)) {
      postedAt = line;
      bodyStart = i + 1;
      break;
    }
    if (!author && line.length <= 60 && !/[.!?]$/.test(line)) {
      author = line;
    }
  }

  if (!postedAt) {
    for (let i = 0; i < Math.min(lines.length, 4); i += 1) {
      if (/^\d+\s*(m|h|d|mo|yr|min|sec)s?\b/i.test(lines[i])) {
        postedAt = lines[i];
        bodyStart = i + 1;
        break;
      }
    }
  }

  const text = lines.slice(bodyStart).join("\n").trim();
  if (text.length < 15) return null;

  const authorFromUser = username || author || "Unknown";
  const isEmployerReply =
    /employer|client|project owner|buyer/i.test(authorFromUser) ||
    !!el.querySelector('[class*="employer" i], [class*="owner" i], [class*="buyer" i]');

  const entry = {
    author: author || authorFromUser,
    username,
    posted_at: postedAt,
    text,
    is_employer_reply: isEmployerReply,
  };

  return { id: clarificationEntryId(entry), ...entry };
}

function findCommentBlocks(root: HTMLElement): HTMLElement[] {
  const selectors = [
    "fl-project-comment",
    "fl-comment",
    '[class*="ProjectComment"]',
    '[class*="project-comment"]',
    '[class*="CommentItem"]',
    '[class*="comment-item"]',
    '[class*="Clarification"]',
    '[class*="MessageRow"]',
    '[class*="message-row"]',
    "li",
    "article",
  ];

  const blocks: HTMLElement[] = [];
  for (const sel of selectors) {
    root.querySelectorAll(sel).forEach((el) => {
      if (!(el instanceof HTMLElement) || isExtensionElement(el)) return;
      if (!isVisible(el)) return;
      const parsed = parseCommentBlock(el);
      if (parsed) blocks.push(el);
    });
    if (blocks.length >= 2) break;
  }

  if (blocks.length < 2) {
    root.querySelectorAll("div").forEach((el) => {
      if (isExtensionElement(el)) return;
      const text = el.innerText?.trim() || "";
      if (text.length < 40 || text.length > 4000) return;
      if (!/@\w/.test(text)) return;
      if (el.querySelectorAll("div").length > 12) return;
      if (parseCommentBlock(el)) blocks.push(el);
    });
  }

  return dedupeClarificationBlocks(blocks);
}

function scrapeClarificationBoardFromDom(): ClarificationEntry[] {
  const root = findClarificationBoardRoot();
  if (!root) return [];

  const entries: ClarificationEntry[] = [];
  const seen = new Set<string>();

  for (const block of findCommentBlocks(root)) {
    const entry = parseCommentBlock(block);
    if (!entry || seen.has(entry.id)) continue;
    seen.add(entry.id);
    entries.push(entry);
  }

  return entries;
}

function normalizeApiClarification(raw: Record<string, unknown>): ClarificationEntry | null {
  const text =
    (typeof raw.message === "string" && raw.message) ||
    (typeof raw.comment === "string" && raw.comment) ||
    (typeof raw.text === "string" && raw.text) ||
    (typeof raw.description === "string" && raw.description) ||
    "";
  if (!text.trim() || text.trim().length < 10) return null;

  const author =
    (typeof raw.author_name === "string" && raw.author_name) ||
    (typeof raw.display_name === "string" && raw.display_name) ||
    (typeof raw.username === "string" && raw.username) ||
    "Unknown";
  const username =
    (typeof raw.username === "string" && raw.username) ||
    (typeof raw.author_username === "string" && raw.author_username) ||
    null;
  const postedAt =
    (typeof raw.time === "string" && raw.time) ||
    (typeof raw.time_submitted === "string" && raw.time_submitted) ||
    (typeof raw.posted_at === "string" && raw.posted_at) ||
    (typeof raw.time_submitted === "number" && new Date(raw.time_submitted * 1000).toISOString()) ||
    null;

  const entry = {
    author,
    username,
    posted_at: postedAt,
    text: text.trim(),
    is_employer_reply: Boolean(raw.is_employer || raw.is_owner || raw.from_owner),
  };
  return { id: clarificationEntryId(entry), ...entry };
}

async function fetchClarificationBoardFromApi(projectId: string): Promise<ClarificationEntry[]> {
  if (!/^\d+$/.test(projectId)) return [];

  const urls = [
    `https://www.freelancer.com/api/projects/0.1/projects/${projectId}/contest_comments/?limit=200`,
    `https://www.freelancer.com/api/projects/0.1/contest_comments/?projects[]=${projectId}&limit=200`,
    `https://www.freelancer.com/api/projects/0.1/projects/contest_comments/?projects[]=${projectId}&limit=200`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) continue;
      const data = (await res.json()) as { result?: Record<string, unknown> };
      const result = data.result || {};
      const list =
        (Array.isArray(result.contest_comments) && result.contest_comments) ||
        (Array.isArray(result.comments) && result.comments) ||
        (Array.isArray(result.project_comments) && result.project_comments) ||
        [];
      const entries = list
        .map((item) => normalizeApiClarification(item as Record<string, unknown>))
        .filter((item): item is ClarificationEntry => !!item);
      if (entries.length) return entries;
    } catch {
      /* try next endpoint */
    }
  }
  return [];
}

export async function scrapeClarificationBoardAsync(
  projectId?: string | null,
): Promise<ClarificationEntry[]> {
  const numericId =
    projectId && /^\d+$/.test(projectId) ? projectId : extractProjectIdFromDom();

  if (numericId) {
    const fromApi = await fetchClarificationBoardFromApi(numericId);
    if (fromApi.length) return fromApi;
  }

  return scrapeClarificationBoardFromDom();
}

export async function scrapeProjectAsync(cached?: Partial<ScrapedProject>): Promise<ScrapedProject> {
  const dom = scrapeProject();
  let result: ScrapedProject = { ...dom };

  const numericId =
    extractProjectIdFromDom() ||
    (/^\d+$/.test(dom.freelancer_project_id) ? dom.freelancer_project_id : null);
  const seoUrl = extractSeoUrl();
  const apiData = await fetchProjectFromFreelancerApi(numericId, seoUrl);

  if (apiData) {
    result = {
      ...result,
      freelancer_project_id: apiData.freelancer_project_id || result.freelancer_project_id,
      title: apiData.title || result.title,
      description: apiData.description || result.description,
      budget_text: apiData.budget_text || result.budget_text,
      budget_type: apiData.budget_type || result.budget_type,
      budget_min: apiData.budget_min ?? result.budget_min,
      budget_max: apiData.budget_max ?? result.budget_max,
      skills: apiData.skills?.length ? apiData.skills : result.skills,
      url: apiData.url || result.url,
      ...mergeClientInfo(apiData, cached, result),
    };
  } else {
    result = { ...result, ...mergeClientInfo(result, cached) };
  }

  if ((!result.description || result.description.length < 50) && cached?.description?.trim()) {
    result.description = cached.description.trim();
  }

  if (!result.description || result.description.length < 50) {
    result.description = dom.description;
  }

  const clarifications = await scrapeClarificationBoardAsync(result.freelancer_project_id);
  if (clarifications.length) {
    result.clarifications = clarifications;
  } else if (cached?.clarifications?.length) {
    result.clarifications = cached.clarifications;
  } else {
    result.clarifications = dom.clarifications;
  }

  return result;
}

function isExtensionElement(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return !!el.closest(".ba-panel, .ba-fab") || el.id.startsWith("ba-");
}

function isVisible(el: HTMLElement): boolean {
  if (isExtensionElement(el)) return false;
  return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
}

function dispatchInputEvents(el: HTMLElement) {
  el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: "" }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function setFieldValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  el.focus();
  const tracker = (el as unknown as { _valueTracker?: { setValue: (v: string) => void } })
    ._valueTracker;
  if (tracker) tracker.setValue(el.value);

  const proto =
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
  dispatchInputEvents(el);
}

function setEditableValue(el: HTMLElement, value: string) {
  el.focus();
  document.execCommand("selectAll", false);
  if (!document.execCommand("insertText", false, value)) {
    el.textContent = value;
  }
  dispatchInputEvents(el);
}

function fieldLabel(el: HTMLElement): string {
  const id = el.id;
  if (id) {
    const label = document.querySelector(`label[for="${id}"]`);
    if (label?.textContent) return label.textContent.toLowerCase();
  }
  const labelled = el.getAttribute("aria-label") || el.getAttribute("placeholder") || "";
  const near = el.closest("div, section, fieldset, label")?.textContent?.slice(0, 120) || "";
  return `${labelled} ${near}`.toLowerCase();
}

function isQuestionField(el: HTMLElement): boolean {
  const key = fieldLabel(el);
  return /question|clarification/.test(key);
}

function isProposalField(el: HTMLElement): boolean {
  const key = fieldLabel(el);
  if (isQuestionField(el)) return false;
  return /proposal|describe|comment|cover letter|bid description|your bid|write your/.test(key);
}

function findQuestionFields(): HTMLTextAreaElement[] {
  const found = new Set<HTMLTextAreaElement>();
  const selectors = [
    'textarea[name*="question" i]',
    'textarea[placeholder*="question" i]',
    'textarea[aria-label*="question" i]',
    'textarea[id*="question" i]',
  ];

  for (const sel of selectors) {
    document.querySelectorAll<HTMLTextAreaElement>(sel).forEach((el) => {
      if (!isExtensionElement(el) && (el.offsetWidth || el.offsetHeight)) found.add(el);
    });
  }

  if (!found.size) {
    for (const label of Array.from(document.querySelectorAll("label, legend, h3, h4, span, p"))) {
      if (isExtensionElement(label)) continue;
      const text = label.textContent?.toLowerCase() || "";
      if (!text.includes("question")) continue;
      const container = label.closest("form, section, fieldset, div") || label.parentElement;
      container?.querySelectorAll<HTMLTextAreaElement>("textarea").forEach((el) => {
        if (!isExtensionElement(el) && (el.offsetWidth || el.offsetHeight)) found.add(el);
      });
    }
  }

  return [...found];
}

function findProposalTextareas(): HTMLTextAreaElement[] {
  const questionFields = new Set(findQuestionFields());
  const selectors = [
    'textarea[name="description"]',
    'textarea[name="comment"]',
    'textarea[placeholder*="proposal" i]',
    'textarea[placeholder*="describe" i]',
    'textarea[placeholder*="bid" i]',
    'textarea[class*="proposal" i]',
    'textarea.tw-textarea',
  ];

  const found: HTMLTextAreaElement[] = [];
  for (const sel of selectors) {
    document.querySelectorAll<HTMLTextAreaElement>(sel).forEach((el) => {
      if (isExtensionElement(el) || questionFields.has(el)) return;
      if (el.offsetWidth || el.offsetHeight) found.push(el);
    });
  }
  return found;
}

function findProposalContentEditables(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(
      '[contenteditable="true"][role="textbox"], [contenteditable="true"]',
    ),
  ).filter((el) => !isExtensionElement(el) && isProposalField(el) && isVisible(el));
}

function findProposalField(): HTMLElement | null {
  const questionFields = new Set(findQuestionFields());

  for (const el of findProposalTextareas()) {
    if (!questionFields.has(el)) return el;
  }

  for (const el of findProposalContentEditables()) {
    return el;
  }

  const byLabel = Array.from(document.querySelectorAll<HTMLTextAreaElement>("textarea"))
    .filter(
      (el) =>
        !isExtensionElement(el) &&
        !questionFields.has(el) &&
        (el.offsetWidth || el.offsetHeight) &&
        isProposalField(el),
    )
    .sort((a, b) => b.offsetHeight - a.offsetHeight);

  if (byLabel[0]) return byLabel[0];

  const fallback = Array.from(document.querySelectorAll<HTMLTextAreaElement>("textarea"))
    .filter(
      (el) =>
        !isExtensionElement(el) &&
        !questionFields.has(el) &&
        (el.offsetWidth || el.offsetHeight),
    )
    .sort((a, b) => b.offsetHeight - a.offsetHeight || b.getBoundingClientRect().top - a.getBoundingClientRect().top);

  if (fallback[0]) return fallback[0];

  const editableFallback = Array.from(
    document.querySelectorAll<HTMLElement>('[contenteditable="true"]'),
  ).filter((el) => !isExtensionElement(el) && !isQuestionField(el) && isVisible(el));

  return editableFallback[0] ?? null;
}

function scrollToBidField(el: HTMLElement | null): boolean {
  if (!el || isExtensionElement(el)) return false;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  window.setTimeout(() => {
    if ("focus" in el && typeof el.focus === "function") {
      try {
        el.focus({ preventScroll: true });
      } catch {
        el.focus();
      }
    }
  }, 350);
  return true;
}

export function scrollToProposalField(): boolean {
  return scrollToBidField(findProposalField());
}

export function scrollToQuestionsField(): boolean {
  const fields = findQuestionFields();
  return scrollToBidField(fields[0] ?? null);
}

export function fillProposal(text: string): boolean {
  const el = findProposalField();
  if (!el) return false;

  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    setFieldValue(el, text);
  } else {
    setEditableValue(el, text);
  }
  return true;
}

export function fillQuestions(text: string): boolean {
  const lines = text
    .split("\n")
    .map((line) => line.trim().replace(/^[-–•]\s*/, ""))
    .filter(Boolean);
  if (!lines.length) return true;

  const fields = findQuestionFields();
  if (fields.length > 1) {
    lines.slice(0, fields.length).forEach((line, i) => setFieldValue(fields[i], line));
    return true;
  }
  if (fields.length === 1) {
    setFieldValue(fields[0], lines.join("\n"));
    return true;
  }
  return false;
}

function fieldKey(el: HTMLInputElement): string {
  return `${el.name} ${el.id} ${el.placeholder ?? ""} ${el.getAttribute("aria-label") ?? ""}`.toLowerCase();
}

function isDayInput(el: HTMLInputElement): boolean {
  return /day|period|delivery|duration|complete|timeline/.test(fieldKey(el));
}

function isAmountInput(el: HTMLInputElement): boolean {
  const key = fieldKey(el);
  return /amount|bid|price|budget|\$|total|offer/.test(key) && !isDayInput(el);
}

export function fillBidAmount(amount: number): boolean {
  const selectors = [
    'input[name="amount"]',
    'input[name="bid"]',
    'input[name="bidvalue"]',
    'input[placeholder*="amount" i]',
    'input[placeholder*="bid" i]',
    'input[aria-label*="bid" i]',
    'input[aria-label*="amount" i]',
  ];
  for (const sel of selectors) {
    const el = document.querySelector<HTMLInputElement>(sel);
    if (el && !isExtensionElement(el) && isVisible(el) && !isDayInput(el)) {
      setFieldValue(el, String(amount));
      return true;
    }
  }

  const fallback = Array.from(
    document.querySelectorAll<HTMLInputElement>('input[type="number"], input[type="text"]'),
  )
    .filter((el) => !isExtensionElement(el) && isVisible(el) && isAmountInput(el))
    .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);

  if (fallback[0]) {
    setFieldValue(fallback[0], String(amount));
    return true;
  }
  return false;
}

export function fillDeliveryDays(days: number): boolean {
  const selectors = [
    'input[name="period"]',
    'input[name="days"]',
    'input[name="days2c"]',
    'input[placeholder*="day" i]',
    'input[placeholder*="delivery" i]',
    'input[aria-label*="day" i]',
    'input[aria-label*="delivery" i]',
  ];
  for (const sel of selectors) {
    const el = document.querySelector<HTMLInputElement>(sel);
    if (el && !isExtensionElement(el) && isVisible(el)) {
      setFieldValue(el, String(days));
      return true;
    }
  }

  const fallback = Array.from(
    document.querySelectorAll<HTMLInputElement>('input[type="number"], input[type="text"]'),
  )
    .filter((el) => !isExtensionElement(el) && isVisible(el) && isDayInput(el))
    .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);

  if (fallback[0]) {
    setFieldValue(fallback[0], String(days));
    return true;
  }
  return false;
}

function readInputValue(
  selectors: string[],
  predicate?: (el: HTMLInputElement) => boolean,
): string | null {
  for (const sel of selectors) {
    const el = document.querySelector<HTMLInputElement>(sel);
    if (el && !isExtensionElement(el) && (el.offsetWidth || el.offsetHeight)) {
      if (!predicate || predicate(el)) return el.value;
    }
  }
  const fallback = Array.from(
    document.querySelectorAll<HTMLInputElement>('input[type="number"], input[type="text"]'),
  ).filter((el) => !isExtensionElement(el) && (el.offsetWidth || el.offsetHeight) && (!predicate || predicate(el)));
  return fallback[0]?.value ?? null;
}

function readFreelancerProposalText(): string {
  const questionFields = new Set(findQuestionFields());
  const candidates: string[] = [];

  const addCandidate = (text: string | null | undefined) => {
    const trimmed = text?.trim();
    if (trimmed) candidates.push(trimmed);
  };

  for (const el of findProposalTextareas()) {
    if (questionFields.has(el)) continue;
    addCandidate(el.value);
  }

  for (const el of findProposalContentEditables()) {
    addCandidate(el.innerText || el.textContent);
  }

  const textareas = Array.from(document.querySelectorAll<HTMLTextAreaElement>("textarea"))
    .filter(
      (el) =>
        !isExtensionElement(el) &&
        !questionFields.has(el) &&
        isVisible(el) &&
        (isProposalField(el) || el.offsetHeight > 80),
    )
    .sort((a, b) => b.offsetHeight - a.offsetHeight);
  for (const el of textareas) {
    addCandidate(el.value);
  }

  const editables = Array.from(
    document.querySelectorAll<HTMLElement>('[contenteditable="true"]'),
  ).filter((el) => !isExtensionElement(el) && !isQuestionField(el) && isVisible(el));
  for (const el of editables) {
    addCandidate(el.innerText || el.textContent);
  }

  const unique = [...new Set(candidates)];
  return unique.sort((a, b) => b.length - a.length)[0] || "";
}

export function readBidFormValues(): {
  proposal: string;
  bid_amount: number | null;
  delivery_days: number | null;
  questions: string;
} {
  const proposal = readFreelancerProposalText();

  const amountRaw = readInputValue(
    [
      'input[name="amount"]',
      'input[name="bid"]',
      'input[name="bidvalue"]',
      'input[placeholder*="amount" i]',
      'input[placeholder*="bid" i]',
    ],
    isAmountInput,
  );
  const daysRaw = readInputValue(
    [
      'input[name="period"]',
      'input[name="days"]',
      'input[name="days2c"]',
      'input[placeholder*="day" i]',
      'input[placeholder*="delivery" i]',
    ],
    isDayInput,
  );

  const qFields = findQuestionFields();
  const questions = qFields
    .map((f) => f.value.trim())
    .filter(Boolean)
    .join("\n");

  return {
    proposal,
    bid_amount: amountRaw ? Number(amountRaw) : null,
    delivery_days: daysRaw ? Number(daysRaw) : null,
    questions,
  };
}

function buttonLabel(el: HTMLElement): string {
  return `${el.textContent || ""} ${(el as HTMLInputElement).value || ""} ${el.getAttribute("aria-label") || ""} ${el.getAttribute("title") || ""}`.toLowerCase();
}

function isActionButton(el: Element, pattern: RegExp): boolean {
  if (!(el instanceof HTMLElement) || isExtensionElement(el)) return false;
  if (el.offsetWidth === 0 && el.offsetHeight === 0) return false;
  return pattern.test(buttonLabel(el));
}

function findActionButtons(pattern: RegExp): HTMLElement[] {
  const selectors = "button, input[type='submit'], a, fl-button, [role='button'], [type='submit']";
  return Array.from(document.querySelectorAll<HTMLElement>(selectors)).filter((el) =>
    isActionButton(el, pattern),
  );
}

export function isBidSubmitButton(el: Element): boolean {
  if (!(el instanceof HTMLElement) || isExtensionElement(el)) return false;

  const interactive = el.closest(
    "button, input[type='submit'], a, fl-button, [role='button'], [type='submit']",
  ) as HTMLElement | null;
  if (!interactive || isExtensionElement(interactive)) return false;

  const label = `${interactive.textContent || ""} ${(interactive as HTMLInputElement).value || ""} ${interactive.getAttribute("aria-label") || ""} ${interactive.getAttribute("title") || ""} ${interactive.getAttribute("name") || ""}`.toLowerCase();
  return /place\s*bid|submit\s*bid|update\s*bid|confirm\s*bid|placebid|place_bid|updatebid|update_bid/.test(
    label,
  );
}

export function findPlaceBidButton(): HTMLElement | null {
  const matches = findActionButtons(/place\s*bid|submit\s*bid|update\s*bid|confirm\s*bid/);
  if (matches.length) {
    return matches.sort(
      (a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top,
    )[0];
  }

  const named = document.querySelector<HTMLElement>(
    'input[name*="placebid" i], button[name*="placebid" i], input[name*="place_bid" i], input[name*="updatebid" i], button[name*="updatebid" i], input[name*="update_bid" i]',
  );
  if (named && !isExtensionElement(named) && (named.offsetWidth || named.offsetHeight)) {
    return named;
  }
  return null;
}

export function canPlaceBidOnPage(): boolean {
  return findActionButtons(/place\s*bid|submit\s*bid/).some((el) => {
    const label = buttonLabel(el);
    return /place\s*bid|submit\s*bid/.test(label) && !/update\s*bid|withdraw\s*bid/.test(label);
  });
}

export function isBidAlreadyPlacedOnPage(): boolean {
  if (canPlaceBidOnPage()) return false;

  const actionLabels = findActionButtons(
    /place\s*bid|submit\s*bid|update\s*bid|withdraw\s*bid|edit\s*bid|view\s*bid/,
  )
    .map((el) => buttonLabel(el))
    .join(" ");

  if (/update\s*bid|withdraw\s*bid|edit\s*(your\s*)?bid|view\s*(your\s*)?bid/.test(actionLabels)) {
    return true;
  }

  return false;
}

export function findPostQuestionsButton(): HTMLElement | null {
  const matches = findActionButtons(
    /post\s*(a\s*)?(question|questions)|ask\s*(a\s*)?question|submit\s*question/,
  );
  if (matches.length) {
    return matches.sort(
      (a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top,
    )[0];
  }
  return null;
}

export function scrollToBidActions(): void {
  const placeBid = findPlaceBidButton();
  const postQuestions = findPostQuestionsButton();

  if (placeBid && postQuestions) {
    const placeTop = placeBid.getBoundingClientRect().top;
    const questionTop = postQuestions.getBoundingClientRect().top;
    const anchor = placeTop >= questionTop ? placeBid : postQuestions;
    anchor.scrollIntoView({ behavior: "smooth", block: "end" });
    window.setTimeout(() => {
      window.scrollBy({ top: -Math.min(window.innerHeight * 0.35, 280), behavior: "smooth" });
    }, 350);
    return;
  }

  const target = placeBid || postQuestions;
  target?.scrollIntoView({ behavior: "smooth", block: "center" });
}
