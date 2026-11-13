import { ProjectDetailRoute } from "@/components/project-detail-route";
import { ReturnFocusToOpener } from "@/components/return-focus-to-opener";
import { safeReturnPath } from "@/lib/return-to";

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const generateOnOpen = sp.generate === "1";
  const stayOnList = sp.stay === "1";
  const backHref = safeReturnPath(sp.returnTo, "/submitted");
  const backLabel = backHref.startsWith("/find") ? "Back to find" : "Back to submitted";

  return (
    <div className="-mb-[calc(2rem-10px)] flex h-[calc(100dvh-2rem-10px)] flex-col gap-3 overflow-hidden">
      {stayOnList ? (
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(window.opener&&!window.opener.closed)window.opener.focus()}catch(e){}",
          }}
        />
      ) : null}
      <ReturnFocusToOpener enabled={stayOnList} />
      <ProjectDetailRoute
        id={id}
        backHref={backHref}
        backLabel={backLabel}
        generateOnOpen={generateOnOpen}
      />
    </div>
  );
}
