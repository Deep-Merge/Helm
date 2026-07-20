"use client";

import { useEffect, useState } from "react";
import {
  generationProgressFromStartedAt,
  getProposalGenerationError,
  getProposalGenerationStartedAt,
  getProposalGenerationStatus,
  subscribeProposalGeneration,
  type ProposalGenerationStatus,
} from "@/lib/proposal-generation-store";

export function useProposalGeneration(projectId?: string) {
  const [, tick] = useState(0);

  useEffect(() => subscribeProposalGeneration(() => tick((n) => n + 1)), []);

  const status: ProposalGenerationStatus = projectId
    ? getProposalGenerationStatus(projectId)
    : "idle";
  const startedAt = projectId ? getProposalGenerationStartedAt(projectId) : null;
  const error = projectId ? getProposalGenerationError(projectId) : null;
  const isGenerating = status === "generating";

  const [progress, setProgress] = useState(() =>
    generationProgressFromStartedAt(startedAt, status),
  );

  useEffect(() => {
    if (!isGenerating) {
      setProgress(generationProgressFromStartedAt(startedAt, status));
      return;
    }

    const update = () => {
      setProgress(generationProgressFromStartedAt(startedAt, status));
    };
    update();
    const id = window.setInterval(update, 120);
    return () => window.clearInterval(id);
  }, [isGenerating, startedAt, status]);

  return { status, isGenerating, error, progress };
}
