import type { Project } from "@/lib/api";
import { markProjectViewedClient } from "@/lib/discover-client";
import { pipelineStatus } from "@/lib/project-status";

export type MarkProjectSeenOptions = {
  /** Skip PATCH — opening project detail already marks viewed via GET /projects/:id */
  skipServer?: boolean;
};

export function markProjectAsSeen(
  project: Project,
  markProjectSeen: (projectId: string) => void,
  confirmProjectSeenOnServer: (projectId: string) => void,
  options?: MarkProjectSeenOptions,
) {
  if (pipelineStatus(project.status) !== "new") return;
  markProjectSeen(project.id);
  if (options?.skipServer) return;
  void markProjectViewedClient(project.id).then((ok) => {
    if (ok) confirmProjectSeenOnServer(project.id);
  });
}
