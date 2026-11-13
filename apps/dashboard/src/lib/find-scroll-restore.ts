const STORAGE_KEY = "bidautomation_find_scroll_restore";

let findListScroller: HTMLElement | null = null;

export function registerFindListScroller(node: HTMLElement | null) {
  findListScroller = node;
}

function currentListScrollTop() {
  return findListScroller?.scrollTop ?? (typeof window === "undefined" ? 0 : window.scrollY);
}

type ScrollRestorePayload = {
  returnTo: string;
  scrollY: number;
};

function normalizeFindPath(path: string): string | null {
  try {
    const url = new URL(path, "http://local");
    if (url.pathname !== "/find") return null;
    const params = new URLSearchParams(url.searchParams);
    params.sort();
    const qs = params.toString();
    return qs ? `/find?${qs}` : "/find";
  } catch {
    return null;
  }
}

export function saveFindScrollRestore(returnTo: string) {
  if (typeof window === "undefined") return;
  const normalized = normalizeFindPath(returnTo);
  if (!normalized) return;
  try {
    const payload: ScrollRestorePayload = {
      returnTo: normalized,
      scrollY: currentListScrollTop(),
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function consumeFindScrollRestore(currentReturnTo: string): number | null {
  if (typeof window === "undefined") return null;
  const current = normalizeFindPath(currentReturnTo);
  if (!current) return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const payload = JSON.parse(raw) as ScrollRestorePayload;
    sessionStorage.removeItem(STORAGE_KEY);
    if (payload.returnTo !== current) return null;
    if (!Number.isFinite(payload.scrollY) || payload.scrollY < 0) return null;
    return payload.scrollY;
  } catch {
    return null;
  }
}

export function restoreFindScroll(scrollY: number) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (findListScroller) {
        findListScroller.scrollTop = scrollY;
        return;
      }
      window.scrollTo({ top: scrollY, left: 0, behavior: "auto" });
    });
  });
}
