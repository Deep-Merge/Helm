import { PageHeader } from "@/components/layout";
import { ProjectsTable } from "@/components/projects-table";
import { getProjects } from "@/lib/api";

export default async function IgnoredPage() {
  let projects: Awaited<ReturnType<typeof getProjects>>["projects"] = [];
  try {
    ({ projects } = await getProjects("ignored"));
  } catch { /* empty */ }

  return (
    <>
      <PageHeader title="Ignored" description="Projects you chose to skip." />
      <ProjectsTable projects={projects} />
    </>
  );
}
