import type { Project } from "@/lib/api";

const cache = new Map<string, Project>();

export function cacheProject(project: Project): void {
  cache.set(project.id, project);
}

export function getCachedProject(id: string): Project | null {
  return cache.get(id) ?? null;
}
