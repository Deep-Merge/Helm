import { CountryFlag } from "@/components/country-flag";
import { clientCountryDisplay } from "@/lib/client-display";

export function ClientCountryCell({
  country,
  countryFlag,
  size = "sm",
}: {
  country?: string | null;
  countryFlag?: string | null;
  size?: "sm" | "md";
}) {
  const label = clientCountryDisplay(country);
  if (!label) return <span className="text-zinc-500">—</span>;

  return (
    <span className={`inline-flex items-center gap-2 text-zinc-300 ${size === "md" ? "text-[17px]" : ""}`}>
      <CountryFlag countryCode={countryFlag} countryName={country} size={size === "md" ? "md" : "sm"} />
      <span>{label}</span>
    </span>
  );
}

export function ClientRatingStars({
  rating,
  size = "sm",
}: {
  rating?: number | null;
  size?: "sm" | "md";
}) {
  if (rating == null) return <span className="text-zinc-500">—</span>;

  const raw = Math.max(0, Math.min(5, rating));
  const display = Math.round(raw * 10) / 10;
  const starValue = Math.round(raw * 2) / 2;
  const starClass = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";
  const valueClass = size === "md" ? "text-sm" : "text-xs";

  return (
    <span
      className="inline-flex items-center gap-2"
      title={`${display.toFixed(1)} / 5`}
    >
      <span className="inline-flex items-center gap-0.5" aria-hidden>
        {Array.from({ length: 5 }, (_, i) => {
          const filled = starValue >= i + 1;
          const half = !filled && starValue >= i + 0.5;
          return (
            <svg
              key={i}
              viewBox="0 0 16 16"
              className={`${starClass} ${
                filled
                  ? "text-amber-400"
                  : half
                    ? "text-amber-400/50"
                    : "text-zinc-600"
              }`}
              fill="currentColor"
            >
              <path d="M8 1.2 9.9 5.8l5 .4-3.8 3.2 1.2 4.9L8 11.8 3.7 14.3l1.2-4.9L1.1 6.2l5-.4L8 1.2z" />
            </svg>
          );
        })}
      </span>
      <span className={`tabular-nums text-zinc-400 ${valueClass}`}>{display.toFixed(1)}</span>
    </span>
  );
}

export function ClientReviewCount({
  count,
  size = "sm",
}: {
  count?: number | null;
  size?: "sm" | "md";
}) {
  if (count == null) return <span className="text-zinc-500">—</span>;

  const hasReviews = count > 0;
  const iconClass = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";
  const textClass = size === "md" ? "text-[17px]" : "";

  return (
    <span
      className={`inline-flex items-center gap-1.5 ${hasReviews ? "text-zinc-200" : "text-zinc-500"} ${textClass}`}
      title={hasReviews ? `${count} review${count === 1 ? "" : "s"}` : "No reviews yet"}
    >
      {hasReviews ? (
        <svg viewBox="0 0 16 16" className={`${iconClass} text-indigo-400`} fill="currentColor" aria-hidden>
          <path d="M2.5 3.5A1.5 1.5 0 0 1 4 2h8a1.5 1.5 0 0 1 1.5 1.5v5A1.5 1.5 0 0 1 12 10H6.5L3.5 12.5V10H4A1.5 1.5 0 0 1 2.5 8.5v-5Z" />
        </svg>
      ) : (
        <svg
          viewBox="0 0 16 16"
          fill="none"
          className={`${iconClass} text-zinc-600`}
          aria-hidden
        >
          <path
            d="M2.5 3.5A1.5 1.5 0 0 1 4 2h8a1.5 1.5 0 0 1 1.5 1.5v5A1.5 1.5 0 0 1 12 10H6.5L3.5 12.5V10H4A1.5 1.5 0 0 1 2.5 8.5v-5Z"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinejoin="round"
          />
        </svg>
      )}
      <span className={`tabular-nums ${hasReviews ? "text-zinc-300" : "text-zinc-500"}`}>{count}</span>
    </span>
  );
}
