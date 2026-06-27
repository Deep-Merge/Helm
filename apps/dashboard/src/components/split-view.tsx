"use client";

import {
  Children,
  isValidElement,
  useCallback,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

const MIN_RATIO = 12;

function clampRatio(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeRatios(ratios: number[], minRatio: number): number[] {
  const minTotal = minRatio * ratios.length;
  if (minTotal >= 100) {
    return ratios.map(() => 100 / ratios.length);
  }

  let next = ratios.map((r) => clampRatio(r, minRatio, 100 - minRatio));
  let total = next.reduce((sum, r) => sum + r, 0);
  next = next.map((r) => (r / total) * 100);
  total = next.reduce((sum, r) => sum + r, 0);
  return next.map((r) => (r / total) * 100);
}

function SplitDivider({
  direction,
  containerRef,
  onDrag,
}: {
  direction: "horizontal" | "vertical";
  containerRef: React.RefObject<HTMLDivElement | null>;
  onDrag: (deltaRatio: number) => void;
}) {
  const dragging = useRef(false);
  const startPos = useRef(0);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    startPos.current = direction === "horizontal" ? e.clientX : e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
    document.body.style.cursor = direction === "horizontal" ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const current = direction === "horizontal" ? e.clientX : e.clientY;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const size = direction === "horizontal" ? rect.width : rect.height;
    onDrag(((current - startPos.current) / size) * 100);
    startPos.current = current;
  };

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  };

  const isHorizontal = direction === "horizontal";

  return (
    <div
      role="separator"
      aria-orientation={isHorizontal ? "vertical" : "horizontal"}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className={`group relative z-10 shrink-0 ${
        isHorizontal ? "w-3 cursor-col-resize" : "h-3 cursor-row-resize"
      }`}
    >
      <div
        className={`absolute bg-white/10 transition group-hover:bg-indigo-400/50 ${
          isHorizontal
            ? "inset-y-2 left-1/2 w-px -translate-x-1/2 group-active:bg-indigo-400"
            : "inset-x-2 top-1/2 h-px -translate-y-1/2 group-active:bg-indigo-400"
        }`}
      />
    </div>
  );
}

export function SplitGroup({
  direction,
  defaultRatios,
  className = "",
  children,
}: {
  direction: "horizontal" | "vertical";
  defaultRatios: number[];
  className?: string;
  children: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const panes = Children.toArray(children).filter(isValidElement);

  const [ratios, setRatios] = useState(() =>
    normalizeRatios(defaultRatios, MIN_RATIO),
  );

  const adjustPair = useCallback((index: number, deltaRatio: number) => {
    setRatios((prev) => {
      const next = [...prev];
      next[index] = clampRatio(next[index] + deltaRatio, MIN_RATIO, 100 - MIN_RATIO);
      next[index + 1] = clampRatio(next[index + 1] - deltaRatio, MIN_RATIO, 100 - MIN_RATIO);
      return normalizeRatios(next, MIN_RATIO);
    });
  }, []);

  const isHorizontal = direction === "horizontal";

  const nodes: ReactNode[] = [];
  panes.forEach((pane, index) => {
    nodes.push(
      <div
        key={`pane-${index}`}
        className="flex min-h-0 min-w-0 flex-col overflow-hidden"
        style={{ flex: `${ratios[index]} 1 0%` }}
      >
        {pane}
      </div>,
    );
    if (index < panes.length - 1) {
      nodes.push(
        <SplitDivider
          key={`divider-${index}`}
          direction={direction}
          containerRef={containerRef}
          onDrag={(d) => adjustPair(index, d)}
        />,
      );
    }
  });

  return (
    <div
      ref={containerRef}
      className={`flex min-h-0 min-w-0 ${isHorizontal ? "h-full flex-row" : "w-full flex-col"} ${className}`}
    >
      {nodes}
    </div>
  );
}
