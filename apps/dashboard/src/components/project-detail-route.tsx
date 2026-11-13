"use client";

import { useEffect, useState } from "react";
import { ProjectDetailClient } from "@/components/project-detail-client";
import { getCachedProject } from "@/lib/project-cache";
import type { Bid, Project } from "@/lib/api";

function hasSavedProposal(bids: Bid[]): boolean {
  return bids.some((bid) => Boolean(bid.proposal_text?.trim()) || (bid.questions?.length ?? 0) > 0);
}

function DetailSkeleton() {
  return (
    <>
      <div className="shrink-0 animate-pulse space-y-3">
        <div className="h-4 w-28 rounded bg-white/[0.06]" />
        <div className="h-8 max-w-2xl rounded-lg bg-white/10" />
        <div className="h-4 max-w-md rounded bg-white/[0.06]" />
        <div className="flex gap-2">
          <div className="h-6 w-24 rounded-full bg-white/[0.06]" />
          <div className="h-6 w-20 rounded-full bg-white/[0.06]" />
        </div>
      </div>
      <div className="min-h-0 flex-1 animate-pulse rounded-2xl bg-white/[0.03] ring-1 ring-white/[0.06]" />
    </>
  );
}

export function ProjectDetailRoute({
  id,
  backHref,
  backLabel,
  generateOnOpen = false,
}: {
  id: string;
  backHref: string;
  backLabel: string;
  generateOnOpen?: boolean;
}) {
  const [project, setProject] = useState<Project | null>(() => getCachedProject(id));
  const [bids, setBids] = useState<Bid[]>([]);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const cached = getCachedProject(id);
    if (cached) setProject(cached);

    void (async () => {
      try {
        const [detailRes, profileRes] = await Promise.all([
          fetch(`/api/projects/${id}`, { cache: "no-store" }),
          fetch("/api/profile", { cache: "no-store" }).catch(() => null),
        ]);
        if (cancelled) return;

        if (!detailRes.ok) {
          if (!getCachedProject(id)) setError("Project not found.");
          return;
        }

        const detail = await detailRes.json();
        if (cancelled) return;
        if (detail?.project) {
          setProject(detail.project);
          setBids(Array.isArray(detail.bids) ? detail.bids : []);
        }

        if (profileRes && profileRes.ok) {
          const profile = await profileRes.json().catch(() => null);
          if (!cancelled && profile) {
            setDisplayName(profile.profile?.display_name ?? null);
          }
        }
      } catch {
        if (!cancelled && !getCachedProject(id)) {
          setError("Could not load project.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const hasProposal = hasSavedProposal(bids);

  useEffect(() => {
    if (hasProposal) return;

    let cancelled = false;
    const startedAt = Date.now();

    const poll = async () => {
      if (cancelled || Date.now() - startedAt > 60000) return;
      try {
        const res = await fetch(`/api/projects/${id}`, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const detail = await res.json();
        if (cancelled) return;
        if (detail?.project) {
          setProject(detail.project);
          const nextBids = Array.isArray(detail.bids) ? detail.bids : [];
          setBids(nextBids);
          if (hasSavedProposal(nextBids)) return;
        }
      } catch {
        /* keep polling */
      }
      if (!cancelled) window.setTimeout(() => void poll(), 2000);
    };

    const timer = window.setTimeout(() => void poll(), 2000);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [id, hasProposal]);

  if (error && !project) {
    return <div className="text-sm text-zinc-500">{error}</div>;
  }

  if (!project) {
    return <DetailSkeleton />;
  }

  return (
    <ProjectDetailClient
      project={project}
      initialBids={bids}
      displayName={displayName}
      backHref={backHref}
      backLabel={backLabel}
      generateOnOpen={generateOnOpen}
    />
  );
}
