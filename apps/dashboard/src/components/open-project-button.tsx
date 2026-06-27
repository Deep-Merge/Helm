"use client";

export function OpenProjectButton({
  size = "md",
  className = "",
  onClick,
}: {
  size?: "sm" | "md";
  className?: string;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  const sizeClass = size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm";

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick(event);
      }}
      className={`inline-flex shrink-0 items-center rounded-lg bg-white/5 font-medium text-indigo-300 ring-1 ring-white/10 transition hover:bg-indigo-500/15 hover:text-indigo-200 hover:ring-indigo-500/30 ${sizeClass} ${className}`}
    >
      Open project
    </button>
  );
}
