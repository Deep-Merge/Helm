import { countryFlagIconUrl, resolveCountryCode } from "@/lib/client-display";

export function CountryFlag({
  countryCode,
  countryName,
  size = "md",
  className = "",
}: {
  countryCode?: string | null;
  countryName?: string | null;
  size?: "sm" | "md";
  className?: string;
}) {
  const code = resolveCountryCode(countryCode, countryName);
  const src = countryFlagIconUrl(code);
  if (!src) return null;

  const dims = size === "sm" ? "h-3 w-4" : "h-[18px] w-6";

  return (
    <img
      src={src}
      alt={countryName ? `${countryName} flag` : "Country flag"}
      width={24}
      height={18}
      className={`inline-block shrink-0 rounded-sm object-cover ring-1 ring-white/15 ${dims} ${className}`}
      loading="lazy"
    />
  );
}
