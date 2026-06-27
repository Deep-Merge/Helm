export async function deleteProjectClient(projectId: string): Promise<boolean> {
  const res = await fetch(`/api/projects/${projectId}`, {
    method: "DELETE",
    cache: "no-store",
    credentials: "same-origin",
  });
  return res.ok;
}
