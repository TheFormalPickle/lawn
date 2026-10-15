import { useConvex } from "convex/react";
import {
  createFileRoute,
  useNavigate,
  Link,
  Navigate,
} from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Users, Plus, ArrowRight, Folder } from "lucide-react";
import { CreateTeamDialog } from "@/components/teams/CreateTeamDialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  teamHomePath,
  teamTrackerPath,
  teamSettingsPath,
  projectPath,
} from "@/lib/routes";
import { useRoutePrewarmIntent } from "@/lib/useRoutePrewarmIntent";
import { prewarmProject } from "./-project.data";
import { useDashboardIndexData } from "./-index.data";
import { Id } from "@convex/_generated/dataModel";
import { DashboardHeader } from "@/components/DashboardHeader";

export const Route = createFileRoute("/dashboard/")({
  validateSearch: (search: Record<string, unknown>) => ({
    manage:
      search.manage === "workspaces" ? ("workspaces" as const) : undefined,
  }),
  component: DashboardPage,
});

type DashboardProjectCardProps = {
  teamSlug: string;
  project: {
    _id: Id<"projects">;
    name: string;
    videoCount: number;
  };
  onOpen: () => void;
};

function formatTeamPlanLabel(
  plan: string,
  billingStatus?: string,
  stripeSubscriptionId?: string,
  billingMode?: string,
) {
  if (billingMode === "internal") return "Agency";
  if (!stripeSubscriptionId && billingStatus !== "active") {
    return "Unpaid";
  }

  if (
    billingStatus &&
    billingStatus !== "active" &&
    billingStatus !== "trialing" &&
    billingStatus !== "past_due"
  ) {
    return "Unpaid";
  }
  if (plan === "pro" || plan === "team") return "Pro";
  return "Basic";
}

function DashboardProjectCard({
  teamSlug,
  project,
  onOpen,
}: DashboardProjectCardProps) {
  const convex = useConvex();
  const prewarmIntentHandlers = useRoutePrewarmIntent(() =>
    prewarmProject(convex, {
      teamSlug,
      projectId: project._id,
    }),
  );

  return (
    <Card
      className="group cursor-pointer hover:bg-[#e8e8e0] transition-colors"
      onClick={onOpen}
      {...prewarmIntentHandlers}
    >
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div className="flex-1 min-w-0">
          <CardTitle className="text-base truncate">{project.name}</CardTitle>
          <CardDescription className="mt-1">
            {project.videoCount} video{project.videoCount !== 1 ? "s" : ""}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between text-sm text-[#888] group-hover:text-[#1a1a1a] transition-colors">
          <span>Open project</span>
          <ArrowRight className="h-4 w-4" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { teams } = useDashboardIndexData();
  const { manage } = Route.useSearch();
  const navigate = useNavigate({});
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [stayInManager, setStayInManager] = useState(false);
  const openCreateWorkspace = () => {
    // A reactive first-membership update may arrive before create returns.
    // Keep this explicit setup action mounted until its own navigation completes.
    setStayInManager(true);
    setCreateDialogOpen(true);
  };

  const isLoading = teams === undefined;

  if (isLoading) {
    return (
      <p role="status" className="p-6 text-muted">
        Loading workspaces…
      </p>
    );
  }

  // A single agency workspace should open daily work, not a management grid.
  // The team URL remains an explicit administration/client-management destination.
  if (teams?.length === 1 && manage !== "workspaces" && !stayInManager) {
    return <Navigate to={teamTrackerPath(teams[0].slug)} replace />;
  }

  // Empty state - no teams
  if (teams && teams.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <DashboardHeader paths={[{ label: "Workspaces" }]} />

        <div className="flex-1 flex items-center justify-center p-8 animate-in fade-in duration-300">
          <Card className="max-w-sm w-full text-center">
            <CardHeader>
              <div className="mx-auto w-12 h-12 bg-[#e8e8e0] flex items-center justify-center mb-2">
                <Users className="h-6 w-6 text-[#888]" />
              </div>
              <CardTitle className="text-lg">
                Create your agency workspace
              </CardTitle>
              <CardDescription>
                One workspace connects your clients, content teams, review and
                shared library.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={openCreateWorkspace}>
                <Plus className="mr-1.5 h-4 w-4" />
                Create workspace
              </Button>
            </CardContent>
          </Card>
        </div>

        <CreateTeamDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <DashboardHeader paths={[{ label: "Workspaces" }]}>
        <Button onClick={openCreateWorkspace}>
          <Plus className="mr-1.5 h-4 w-4" />
          New workspace
        </Button>
      </DashboardHeader>

      <div className="flex-1 overflow-auto p-6 space-y-12">
        <div
          className={cn(
            "transition-opacity duration-300",
            isLoading ? "opacity-0" : "opacity-100",
          )}
        >
          {teams?.map((team) => {
            if (!team) return null;
            return (
              <div key={team._id} className="mb-12 last:mb-0">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-black text-[#1a1a1a]">
                      {team.name}
                    </h2>
                    <Badge variant="secondary">
                      {formatTeamPlanLabel(
                        team.plan,
                        team.billingStatus,
                        team.stripeSubscriptionId,
                        team.billingMode,
                      )}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <Button asChild>
                      <Link to={teamTrackerPath(team.slug)}>
                        Open content workspace
                      </Link>
                    </Button>
                    <Link
                      to={teamSettingsPath(team.slug)}
                      className="text-[#888] hover:text-[#1a1a1a] text-sm font-bold transition-colors"
                    >
                      {team.billingMode === "internal" ? "Settings" : "Billing"}
                    </Link>
                    <Link
                      to={teamHomePath(team.slug)}
                      className="text-[#888] hover:text-[#1a1a1a] text-sm font-bold flex items-center gap-1 transition-colors"
                    >
                      Manage workspace <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>

                {team.projects.length === 0 ? (
                  <Card className="max-w-sm text-center">
                    <CardHeader>
                      <div className="mx-auto w-12 h-12 bg-[#e8e8e0] flex items-center justify-center mb-2">
                        <Folder className="h-6 w-6 text-[#888]" />
                      </div>
                      <CardTitle className="text-lg">No projects yet</CardTitle>
                      <CardDescription>
                        Head over to the team page to create your first project.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() =>
                          navigate({ to: teamHomePath(team.slug) })
                        }
                      >
                        Open team
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {team.projects.map((project) => (
                      <DashboardProjectCard
                        key={project._id}
                        teamSlug={team.slug}
                        project={project}
                        onOpen={() =>
                          navigate({ to: projectPath(team.slug, project._id) })
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <CreateTeamDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </div>
  );
}
