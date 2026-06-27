import { COUNTRY_CODES } from "@/lib/countries";

export function normalizeCountryName(text: string | null | undefined): string | null {
  if (!text) return null;
  const cleaned = text
    .replace(/member since.*/i, "")
    .replace(/^[A-Za-z]{2}\s+/, "")
    .trim();
  return cleaned || null;
}

/** Resolve ISO 3166-1 alpha-2 code from stored flag field or country name. */
export function resolveCountryCode(
  flag: string | null | undefined,
  country: string | null | undefined,
): string | null {
  if (flag && /^[A-Za-z]{2}$/.test(flag.trim())) {
    return flag.trim().toUpperCase();
  }
  const name = normalizeCountryName(country);
  if (name && COUNTRY_CODES[name]) return COUNTRY_CODES[name];
  return null;
}

/** Flag icon URL (PNG) — works on all platforms unlike emoji flags. */
export function countryFlagIconUrl(code: string | null | undefined): string | null {
  if (!code || !/^[A-Za-z]{2}$/.test(code)) return null;
  return `https://flagcdn.com/24x18/${code.toLowerCase()}.png`;
}

export function clientCountryDisplay(country: string | null | undefined): string | null {
  return normalizeCountryName(country);
}
