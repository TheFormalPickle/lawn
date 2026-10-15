import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { ContentTracker } from "@/components/tracker/ContentTracker";
import { DashboardHeader } from "@/components/DashboardHeader";
import { teamHomePath } from "@/lib/routes";

export const Route = createFileRoute("/dashboard/$teamSlug/tracker")({
  component: TrackerPage,
  errorComponent: ({ error, reset }) => (
    <main className="p-6">
      <h1 className="text-2xl font-black">Content tracker unavailable</h1>
      <p className="my-4">{error.message}</p>
      <button
        className="border-2 border-[#1a1a1a] px-4 py-2 font-bold"
        onClick={reset}
      >
        Retry
      </button>
    </main>
  ),
});
function TrackerPage() {
  const { teamSlug } = useParams({ from: "/dashboard/$teamSlug/tracker" });
  const context = useQuery(api.workspace.resolveContext, { teamSlug });
  if (context === undefined)
    return (
      <p role="status" className="p-6">
        Loading team…
      </p>
    );
  if (!context)
    return <p className="p-6">Team not found or you don’t have access.</p>;
  return (
    <div className="flex h-full flex-col">
      <DashboardHeader
        paths={[
          { label: context.team.name, href: teamHomePath(context.team.slug) },
          { label: "Content tracker" },
        ]}
      />
      <ContentTracker teamId={context.team._id} teamSlug={context.team.slug} />
    </div>
  );
}
