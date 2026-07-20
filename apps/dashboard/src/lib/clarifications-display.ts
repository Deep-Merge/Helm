import type { ClarificationEntry } from "@/lib/api";

const CLARIFICATION_TIME_RE =
  /(\d+\s*(?:m|h|d|mo|yr|min|sec|hour|day|week|month|year)s?|less than\s+\d+\s*\w+)/i;

const FREELANCER_META_RE =
  /^([A-Za-z][A-Za-z.'-]*(?:\s+[A-Za-z][A-Za-z.'-]*){0,2})\s+@([A-Za-z0-9_]+)\s*(?:[·\-–|]\s*)?(\d+\s*\w?|less than\s+\d+\s*\w+)?\s*(.*)$/s;

const CLIENT_META_RE =
  /^client\s*(?:[·\-–|]\s*)?(\d+\s*\w?|less than\s+\d+\s*\w+)?\s*(.*)$/is;

function stripMetaPrefixFromText(text: string): string {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^client\s*(?:[·\-–|]\s*)?\d+\s*\w?\s*/i, "");
  cleaned = cleaned.replace(
    /^[A-Za-z][A-Za-z.'-]*(?:\s+[A-Za-z][A-Za-z.'-]*){0,2}\s+@[A-Za-z0-9_]+\s*(?:[·\-–|]\s*)?\d+\s*\w?\s*/i,
    "",
  );
  return cleaned.trim();
}

function parseMetaFromText(text: string): {
  author: string;
  username: string | null;
  posted_at: string | null;
  is_employer_reply: boolean;
  body: string;
} | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const clientMatch = trimmed.match(CLIENT_META_RE);
  if (clientMatch) {
    const body = (clientMatch[2] ?? "").trim();
    if (!body) return null;
    return {
      author: "Client",
      username: null,
      posted_at: clientMatch[1]?.trim() || null,
      is_employer_reply: true,
      body,
    };
  }

  const freelancerMatch = trimmed.match(FREELANCER_META_RE);
  if (freelancerMatch) {
    const body = (freelancerMatch[4] ?? "").trim();
    if (!body) return null;
    return {
      author: freelancerMatch[1].trim(),
      username: freelancerMatch[2],
      posted_at: freelancerMatch[3]?.trim() || null,
      is_employer_reply: false,
      body,
    };
  }

  const lines = trimmed
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length >= 2) {
    const header = lines[0];
    const headerClient = header.match(/^client\s*(?:[·\-–|]\s*)?(\d+\s*\w?)?\s*$/i);
    if (headerClient) {
      return {
        author: "Client",
        username: null,
        posted_at: headerClient[1]?.trim() || extractTime(lines[1]) || null,
        is_employer_reply: true,
        body: lines.slice(headerClient[1] ? 1 : 2).join("\n").trim() || lines.slice(1).join("\n").trim(),
      };
    }

    const headerFreelancer = header.match(
      /^([A-Za-z][A-Za-z.'-]*(?:\s+[A-Za-z][A-Za-z.'-]*){0,2})\s+@([A-Za-z0-9_]+)\s*(?:[·\-–|]\s*)?(\d+\s*\w?)?\s*$/,
    );
    if (headerFreelancer) {
      return {
        author: headerFreelancer[1].trim(),
        username: headerFreelancer[2],
        posted_at: headerFreelancer[3]?.trim() || extractTime(lines[1]) || null,
        is_employer_reply: false,
        body: lines.slice(1).join("\n").trim(),
      };
    }
  }

  return null;
}

function extractTime(text: string): string | null {
  const m = CLARIFICATION_TIME_RE.exec(text);
  return m?.[1] ?? null;
}

function countEmbeddedMessages(text: string): number {
  const matches = text.match(
    /(?:^|\n)(?:Client\s*[·\-–|]\s*\d|[A-Za-z][A-Za-z.'-]*(?:\s+[A-Za-z][A-Za-z.'-]*){0,2}\s+@[A-Za-z0-9_]+)/gi,
  );
  return matches?.length ?? 0;
}

function splitEmbeddedMessages(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed || countEmbeddedMessages(trimmed) <= 1) return [trimmed];

  const parts = trimmed
    .split(
      /(?=(?:^|\n)(?:Client\s*[·\-–|]\s*\d|[A-Za-z][A-Za-z.'-]*(?:\s+[A-Za-z][A-Za-z.'-]*){0,2}\s+@[A-Za-z0-9_]+))/m,
    )
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.length > 1 ? parts : [trimmed];
}

function needsClarificationRepair(entry: ClarificationEntry): boolean {
  const text = entry.text.trim();
  if (!text) return false;
  if (!entry.author || /^unknown$/i.test(entry.author)) return true;
  if (entry.username && entry.author.toLowerCase() === entry.username.toLowerCase()) return true;
  if (entry.author === "Freelancer" && /@/.test(text)) return true;
  if (/^(client\s*[·\-–|]|[A-Za-z][A-Za-z.'-]+\s+@)/i.test(text)) return true;
  if (countEmbeddedMessages(text) > 1) return true;
  return false;
}

export function normalizeClarificationEntry(entry: ClarificationEntry): ClarificationEntry {
  if (needsClarificationRepair(entry)) {
    const parsed = parseMetaFromText(entry.text);
    if (parsed) {
      return {
        ...entry,
        author: parsed.author,
        username: parsed.is_employer_reply ? null : parsed.username,
        posted_at: parsed.posted_at ?? entry.posted_at,
        text: parsed.body,
        is_employer_reply: parsed.is_employer_reply,
      };
    }
  }

  const stripped = stripMetaPrefixFromText(entry.text);
  if (stripped && stripped !== entry.text.trim()) {
    return { ...entry, text: stripped };
  }

  if (/^client$/i.test(entry.author) || entry.is_employer_reply) {
    return { ...entry, author: "Client", username: null, is_employer_reply: true };
  }

  return entry;
}

export function normalizeClarificationEntries(entries: ClarificationEntry[]): ClarificationEntry[] {
  const expanded: ClarificationEntry[] = [];

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    if (countEmbeddedMessages(entry.text) <= 1) {
      expanded.push({ ...normalizeClarificationEntry(entry), sort_order: entry.sort_order ?? i });
      continue;
    }

    for (const part of splitEmbeddedMessages(entry.text)) {
      const parsed = parseMetaFromText(part);
      if (!parsed) continue;
      expanded.push(
        normalizeClarificationEntry({
          ...entry,
          author: parsed.author,
          username: parsed.is_employer_reply ? null : parsed.username,
          posted_at: parsed.posted_at ?? entry.posted_at,
          text: parsed.body,
          is_employer_reply: parsed.is_employer_reply,
          sort_order: entry.sort_order ?? i,
        }),
      );
    }
  }

  return expanded;
}

function sortByDocumentOrder(entries: ClarificationEntry[]): ClarificationEntry[] {
  return [...entries].sort((a, b) => {
    const orderA = a.sort_order ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.sort_order ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    return (a.depth ?? 0) - (b.depth ?? 0);
  });
}

function inferThreadsFromOrder(entries: ClarificationEntry[]): ClarificationEntry[][] {
  const threads: ClarificationEntry[][] = [];
  let current: ClarificationEntry[] = [];
  let threadFreelancer: string | null = null;

  for (const entry of entries) {
    if (!entry.is_employer_reply && threadFreelancer && entry.author !== threadFreelancer) {
      threads.push(current);
      current = [];
      threadFreelancer = null;
    }

    current.push(entry);
    if (!entry.is_employer_reply) {
      threadFreelancer = entry.author;
    }
  }

  if (current.length) threads.push(current);
  return threads;
}

export function groupClarificationThreads(entries: ClarificationEntry[]): ClarificationEntry[][] {
  const normalized = normalizeClarificationEntries(entries);
  if (normalized.length === 0) return [];

  const hasThreadMeta = normalized.some((entry) => entry.thread_id);
  if (!hasThreadMeta) {
    return inferThreadsFromOrder(sortByDocumentOrder(normalized));
  }

  const threads = new Map<string, ClarificationEntry[]>();
  const threadOrder: string[] = [];

  for (const entry of normalized) {
    const threadId = entry.thread_id ?? entry.id;
    if (!threads.has(threadId)) {
      threads.set(threadId, []);
      threadOrder.push(threadId);
    }
    threads.get(threadId)!.push(entry);
  }

  return threadOrder.map((threadId) => sortByDocumentOrder(threads.get(threadId)!));
}

export function formatClarificationsCopy(entries: ClarificationEntry[] | undefined): string {
  if (!entries?.length) return "";

  return groupClarificationThreads(entries)
    .map((thread) =>
      thread
        .map((entry) => {
          const meta = [entry.author, entry.posted_at].filter(Boolean).join(" · ");
          const prefix = (entry.depth ?? 0) > 0 ? "  ↳ " : "";
          return `${prefix}${meta ? `${meta}\n` : ""}${entry.text}`;
        })
        .join("\n"),
    )
    .join("\n\n---\n\n");
}
