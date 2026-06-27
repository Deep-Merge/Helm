"use client";

import type { ReactNode } from "react";
import { ContentPanel, ScrollPanel } from "@/components/project-panel";
import { SplitGroup } from "@/components/split-view";

export function ProjectPanelsLayout({
  descriptionCopy,
  description,
  clarificationsCopy,
  clarifications,
  proposalCopy,
  proposal,
  questionsCopy,
  questions,
}: {
  descriptionCopy: string;
  description: ReactNode;
  clarificationsCopy: string;
  clarifications: ReactNode;
  proposalCopy: string;
  proposal: ReactNode;
  questionsCopy: string;
  questions: ReactNode;
}) {
  return (
    <div className="min-h-0 flex-1">
      <SplitGroup direction="horizontal" defaultRatios={[60, 40]} className="h-full">
        <SplitGroup direction="vertical" defaultRatios={[70, 30]} className="h-full w-full min-h-0">
          <ScrollPanel title="Description" copyText={descriptionCopy} className="h-full min-h-0">
            {description}
          </ScrollPanel>
          <ScrollPanel title="Clarification board" copyText={clarificationsCopy} className="h-full min-h-0">
            {clarifications}
          </ScrollPanel>
        </SplitGroup>

        <SplitGroup direction="vertical" defaultRatios={[72, 28]} className="h-full w-full min-h-0">
          <ScrollPanel title="My proposal" copyText={proposalCopy} className="h-full min-h-0">
            {proposal}
          </ScrollPanel>
          <ContentPanel title="My questions" copyText={questionsCopy} className="h-full min-h-0">
            {questions}
          </ContentPanel>
        </SplitGroup>
      </SplitGroup>
    </div>
  );
}
