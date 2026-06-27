"use client";

import { useState } from "react";
import { FilterSelect } from "@/components/filter-field";
import type { Bid } from "@/lib/api";

export function BidCompare({ bids }: { bids: Bid[] }) {
  const [a, setA] = useState(bids[0]?.id || "");
  const [b, setB] = useState(bids[1]?.id || "");

  if (bids.length < 2) return null;

  const bidA = bids.find((x) => x.id === a);
  const bidB = bids.find((x) => x.id === b);

  return (
    <div className="glass mt-6 rounded-2xl p-6">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-zinc-500">
        Compare versions
      </h2>
      <div className="mb-4 flex gap-3">
        <FilterSelect
          value={a}
          onChange={setA}
          options={bids.map((bid) => ({ value: bid.id, label: `v${bid.version}` }))}
          className="w-28"
          aria-label="Compare version A"
        />
        <span className="self-center text-zinc-500">vs</span>
        <FilterSelect
          value={b}
          onChange={setB}
          options={bids.map((bid) => ({ value: bid.id, label: `v${bid.version}` }))}
          className="w-28"
          aria-label="Compare version B"
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {[bidA, bidB].map((bid, i) => (
          <div key={i} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <p className="mb-2 text-xs text-zinc-500">
              v{bid?.version} · ${bid?.bid_amount} · {bid?.delivery_days}d
            </p>
            <p className="whitespace-pre-wrap text-sm text-zinc-300">{bid?.proposal_text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
