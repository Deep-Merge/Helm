import { PageHeader } from "@/components/layout";
import { getBids } from "@/lib/api";

export default async function ProposalsPage() {
  let bids: Awaited<ReturnType<typeof getBids>>["bids"] = [];
  try {
    ({ bids } = await getBids());
  } catch {
    // empty
  }

  return (
    <>
      <PageHeader
        title="Proposals"
        description="Every AI-generated proposal across all projects."
      />

      {bids.length === 0 ? (
        <div className="glass rounded-2xl py-16 text-center text-zinc-500">
          No proposals yet. Generate your first bid from a Freelancer project page.
        </div>
      ) : (
        <div className="space-y-4">
          {bids.map((bid) => (
            <article key={bid.id} className="glass rounded-2xl p-6">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-medium text-zinc-200">
                    {bid.project_title || "Untitled project"}
                  </h2>
                  {bid.project_url && (
                    <a
                      href={bid.project_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-indigo-400 hover:underline"
                    >
                      {bid.project_url}
                    </a>
                  )}
                </div>
                <span className="text-xs text-zinc-500">
                  v{bid.version} · {new Date(bid.created_at).toLocaleString()}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">
                {bid.proposal_text}
              </p>
              {bid.questions?.length > 0 && (
                <div className="mt-4 rounded-xl bg-white/[0.03] p-4">
                  <p className="mb-2 text-xs font-medium uppercase text-zinc-500">
                    Client questions
                  </p>
                  <ul className="space-y-1 text-sm text-zinc-400">
                    {bid.questions.map((q, i) => (
                      <li key={i}>• {q}</li>
                    ))}
                  </ul>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
