import {
  useAction,
  useConvexConnectionState,
  useMutation,
  useQuery,
} from "convex/react";
import { useRef, useState, type FormEvent } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { ConvexError } from "convex/values";
import type { FunctionReturnType } from "convex/server";
import {
  CONTENT_STAGES,
  CONTENT_STAGE_LABELS,
} from "../../../convex/contentWorkflow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDashboardUploadContext } from "@/lib/dashboardUploadContext";
import { triggerDownload } from "@/lib/download";
import { videoPath } from "@/lib/routes";
import { ListTodo, FolderCheck, ChevronRight, Library } from "lucide-react";
import { WorkloadIntake } from "./WorkloadIntake";
import { RawAssetLibrary } from "@/components/assets/RawAssetLibrary";

type Data = FunctionReturnType<typeof api.contentItems.list>;
type Item = Data["items"][number];
type Draft = {
  projectId: Id<"projects"> | "";
  title: string;
  brief: string;
  producerClerkId: string;
  directorClerkId: string;
  cmoClerkId: string;
  dueDate: string;
};
const emptyDraft = (): Draft => ({
  projectId: "",
  title: "",
  brief: "",
  producerClerkId: "",
  directorClerkId: "",
  cmoClerkId: "",
  dueDate: "",
});
const selectClass = "agency-select";
function errorMessage(error: unknown) {
  return error instanceof Error
    ? (error.message.split("Uncaught Error: ").at(-1)?.split("\n")[0] ??
        "Couldn’t save. Please try again.")
    : "Couldn’t save. Please try again.";
}

export function ContentTracker({
  teamId,
  teamSlug,
}: {
  teamId: Id<"teams">;
  teamSlug: string;
}) {
  const data = useQuery(api.contentItems.list, { teamId });
  const connection = useConvexConnectionState();
  const create = useMutation(api.contentItems.create);
  const update = useMutation(api.contentItems.update);
  const plan = useMutation(api.contentItems.plan);
  const detachSource = useMutation(api.rawAssets.detachFromAssignment);
  const start = useMutation(api.contentItems.start);
  const link = useMutation(api.contentItems.linkVideo);
  const download = useAction(api.videoActions.getDownloadUrl);
  const { requestUpload } = useDashboardUploadContext();
  const [tab, setTab] = useState<"work" | "library" | "raw" | null>(null);
  const [rawOpened, setRawOpened] = useState(false);
  const [rawFocus, setRawFocus] = useState<Id<"rawAssets"> | null>(null);
  const openRaw = (id: Id<"rawAssets"> | null = null) => {
    setRawOpened(true);
    setRawFocus(id);
    setSelectedId(null);
    setTab("raw");
  };
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [mine, setMine] = useState(false);
  const [batchFilter, setBatchFilter] = useState("");
  const [selectedId, setSelectedId] = useState<Id<"contentItems"> | null>(null);
  const selected = data?.items.find((item) => item._id === selectedId);
  const [editing, setEditing] = useState<Item | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const initialDraft = useRef("");
  const pendingCreate = useRef<Parameters<typeof create>[0] | null>(null);
  const requestKey = useRef("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState("");
  const connected = connection.isWebSocketConnected;
  const openForm = (item: Item | "new") => {
    const next =
      item === "new"
        ? {
            ...emptyDraft(),
            projectId: (projectFilter ||
              data?.projects[0]?._id ||
              "") as Draft["projectId"],
          }
        : {
            projectId: item.projectId,
            title: item.title,
            brief: item.brief,
            producerClerkId: item.producerClerkId ?? "",
            directorClerkId: item.directorClerkId ?? "",
            cmoClerkId: item.cmoClerkId ?? "",
            dueDate: item.dueDate ?? "",
          };
    setDraft(next);
    initialDraft.current = JSON.stringify(next);
    pendingCreate.current = null;
    requestKey.current = crypto.randomUUID();
    setFormError(null);
    setEditing(item);
  };
  const closeForm = () => {
    if (busy || pendingCreate.current) return;
    if (
      JSON.stringify(draft) !== initialDraft.current &&
      !window.confirm("Discard this unsaved assignment draft?")
    )
      return;
    setEditing(null);
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (inFlight.current || !editing || !draft.projectId || !connected) return;
    inFlight.current = true;
    setBusy(true);
    setFormError(null);
    const input = {
      title: draft.title,
      brief: draft.brief,
      producerClerkId: draft.producerClerkId || undefined,
      directorClerkId: draft.directorClerkId || undefined,
      cmoClerkId: draft.cmoClerkId || undefined,
      dueDate: draft.dueDate || undefined,
    };
    try {
      if (editing === "new") {
        pendingCreate.current ??= {
          ...input,
          projectId: draft.projectId,
          requestKey: requestKey.current,
          expectedActorId: data!.subject,
        };
        const id = await create(pendingCreate.current);
        pendingCreate.current = null;
        setSelectedId(id);
      } else if (!data?.canManage) {
        await plan({
          itemId: editing._id,
          expectedUpdatedAt: editing.updatedAt,
          title: input.title,
          brief: input.brief,
        });
      } else
        await update({
          ...input,
          itemId: editing._id,
          expectedUpdatedAt: editing.updatedAt,
        });
      setEditing(null);
    } catch (error) {
      if (
        error instanceof ConvexError &&
        !String(error.data).includes("account changed")
      )
        pendingCreate.current = null;
      setFormError(errorMessage(error));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  const act = async (action: () => Promise<unknown>) => {
    if (inFlight.current || !connected) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  const field = (name: keyof Draft, value: string) =>
    setDraft((previous) => ({ ...previous, [name]: value }));
  if (data === undefined)
    return (
      <p role="status" className="p-6 text-[#888]">
        Loading assignments and approved content…
      </p>
    );
  const activeTab =
    !data.canBrowseRaw && (tab === null || tab === "raw")
      ? "library"
      : (tab ?? "work");
  const name = (subject?: string) =>
    data.members.find((member) => member.userClerkId === subject)?.userName ??
    (subject ? "Former team member" : "Unassigned");
  const projectName = (id: Id<"projects">) =>
    data.projects.find((project) => project._id === id)?.name ??
    "Unavailable project";
  const matches = (title: string, projectId: Id<"projects">) =>
    (!projectFilter || projectId === projectFilter) &&
    `${title} ${projectName(projectId)}`
      .toLowerCase()
      .includes(search.toLowerCase());
  const items = data.items.filter(
    (item) =>
      (!batchFilter || item.batchId === batchFilter) &&
      matches(item.title, item.projectId) &&
      (!stageFilter || item.stage === stageFilter) &&
      (!mine ||
        [item.producerClerkId, item.directorClerkId, item.cmoClerkId].includes(
          data.subject,
        )),
  );
  const readyTitle = (video: Data["readyVideos"][number]) =>
    data.items.find((item) => item.currentVideoId === video._id)?.title ??
    video.title;
  const ready = data.readyVideos.filter(
    (video) =>
      matches(`${readyTitle(video)} ${video.title}`, video.projectId) &&
      (!mine ||
        data.items.some(
          (item) =>
            item.currentVideoId === video._id &&
            [
              item.producerClerkId,
              item.directorClerkId,
              item.cmoClerkId,
            ].includes(data.subject),
        )),
  );
  return (
    <div className="agency-shell">
      <nav className="agency-nav" aria-label="Content views">
        <p className="agency-nav-label">Lawn</p>
        <button
          type="button"
          aria-pressed={activeTab === "work"}
          onClick={() => setTab("work")}
        >
          <ListTodo size={18} />
          Assignments
        </button>
        <button
          type="button"
          aria-pressed={activeTab === "library"}
          onClick={() => setTab("library")}
        >
          <FolderCheck size={18} />
          Ready to use
        </button>
        {data.canBrowseRaw && (
          <button
            type="button"
            aria-pressed={activeTab === "raw"}
            onClick={() => openRaw()}
          >
            <Library size={18} />
            Raw assets
          </button>
        )}
      </nav>
      <div className="agency-main">
        <div className="px-4 pt-7 pb-5 sm:px-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                {activeTab === "raw"
                  ? "Raw assets"
                  : activeTab === "library"
                    ? "Ready to use"
                    : "Content tracker"}
              </h1>
              <p className="mt-1 text-sm text-[#888]">
                {activeTab === "raw"
                  ? "Find source material. Preview it. Use it in the next edit."
                  : activeTab === "library"
                    ? "Approved originals, ready for your client accounts."
                    : "Assign client workloads. Directors plan the ads."}
              </p>
            </div>
            {data.canManage && activeTab === "work" && (
              <WorkloadIntake
                data={data}
                teamId={teamId}
                connected={connected}
                onCreated={(id) => {
                  setBatchFilter(id);
                  setTab("work");
                  setMine(false);
                  setSearch("");
                  setProjectFilter("");
                  setStageFilter("");
                }}
              />
            )}
          </div>
          {activeTab === "work" && batchFilter && data.batches.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              <select
                aria-label="Client workload"
                className={selectClass + " sm:max-w-md"}
                value={batchFilter}
                onChange={(e) => setBatchFilter(e.target.value)}
              >
                <option value="">All client workloads</option>
                {data.batches.map((batch) => (
                  <option key={batch._id} value={batch._id}>
                    {projectName(batch.projectId)} · {batch.quantity}{" "}
                    deliverables · {batch.productionTeamName} · due{" "}
                    {batch.dueDate}
                  </option>
                ))}
              </select>
              {batchFilter && (
                <Button variant="outline" onClick={() => setBatchFilter("")}>
                  Show all work
                </Button>
              )}
            </div>
          )}
          {activeTab !== "raw" && (
            <div className="agency-panel mt-5 grid items-center gap-3 p-4 lg:grid-cols-[minmax(140px,1fr)_minmax(140px,190px)_minmax(120px,160px)_auto]">
              <Input
                aria-label="Search content"
                placeholder="Search content or clients…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <select
                aria-label="Filter by project"
                className={selectClass}
                value={projectFilter}
                onChange={(event) => setProjectFilter(event.target.value)}
              >
                <option value="">All clients</option>
                {data.projects.map((project) => (
                  <option key={project._id} value={project._id}>
                    {project.name}
                  </option>
                ))}
              </select>
              {activeTab === "work" ? (
                <select
                  aria-label="Filter by status"
                  className={selectClass}
                  value={stageFilter}
                  onChange={(event) => setStageFilter(event.target.value)}
                >
                  <option value="">All statuses</option>
                  {CONTENT_STAGES.map((stage) => (
                    <option key={stage} value={stage}>
                      {CONTENT_STAGE_LABELS[stage]}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="self-center text-xs text-[#888]">
                  Approved, current versions only
                </p>
              )}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={mine}
                  onChange={(event) => setMine(event.target.checked)}
                />
                My work
              </label>
            </div>
          )}
        </div>
        {!connected && (
          <p
            role="status"
            className="mx-4 rounded-xl bg-[var(--warning-subtle)] p-3 text-sm text-[var(--warning)]"
          >
            Connection interrupted. Showing the last loaded work; changes and
            downloads will resume when reconnected.
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="border-b-2 border-red-700 p-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}
        <div
          hidden={activeTab === "raw"}
          className="flex-1 overflow-auto px-4 pb-6 sm:px-7"
        >
          {activeTab === "work" ? (
            <>
              {!batchFilter && data.batches.length > 0 && (
                <div
                  className="agency-panel mb-6"
                  aria-label="Client workloads"
                >
                  <h2 className="agency-section-title">Workload overview</h2>
                  {data.batches
                    .filter(
                      (batch) =>
                        (!projectFilter || batch.projectId === projectFilter) &&
                        (!mine ||
                          data.items.some(
                            (item) =>
                              item.batchId === batch._id &&
                              [
                                item.producerClerkId,
                                item.directorClerkId,
                                item.cmoClerkId,
                              ].includes(data.subject),
                          )),
                    )
                    .map((batch) => {
                      const slots = data.items.filter(
                        (item) => item.batchId === batch._id,
                      );
                      const done = slots.filter(
                        (item) => item.stage === "done",
                      ).length;
                      return (
                        <button
                          key={batch._id}
                          className="agency-workload-row"
                          onClick={() => setBatchFilter(batch._id)}
                        >
                          <div className="min-w-0">
                            <strong className="block break-words font-medium">
                              {projectName(batch.projectId)}
                            </strong>
                            <span className="mt-1 block text-xs text-muted">
                              {batch.quantity} deliverables ·{" "}
                              {batch.productionTeamName}
                            </span>
                          </div>
                          <span className="text-sm text-muted">
                            Due {batch.dueDate}
                          </span>
                          <span className="text-sm text-muted">
                            {done} approved
                          </span>
                          <ChevronRight
                            aria-hidden="true"
                            className="h-4 w-4 text-muted"
                          />
                        </button>
                      );
                    })}
                </div>
              )}
              {items.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-line p-8">
                  <h2 className="font-bold">
                    {data.items.length
                      ? "No assignments match these filters"
                      : "Plan the work before the upload"}
                  </h2>
                  <p className="mt-2 text-sm text-[#888]">
                    {data.items.length
                      ? "Change a filter to see more work."
                      : data.projects.length
                        ? "The Head CMO assigns a client workload. Lawn creates the slots, and directors plan the individual ads."
                        : "Create a project first, then add its content assignments here."}
                  </p>
                </div>
              ) : (
                <div className="agency-panel">
                  <h2 className="agency-section-title">Deliverables</h2>
                  <div
                    aria-hidden="true"
                    className="hidden grid-cols-[minmax(0,2fr)_minmax(100px,1fr)_minmax(120px,1fr)_120px] gap-3 border-t border-line px-5 py-3 text-xs text-muted sm:grid"
                  >
                    <span>Deliverable / client</span>
                    <span>Producer</span>
                    <span>Stage</span>
                    <span>Due date</span>
                  </div>
                  {items.map((item) => (
                    <button
                      key={item._id}
                      type="button"
                      className="grid w-full items-center gap-3 border-t border-line px-5 py-4 text-left hover:bg-[var(--surface-alt)] sm:grid-cols-[minmax(0,2fr)_minmax(100px,1fr)_minmax(120px,1fr)_120px]"
                      onClick={() => {
                        setSelectedId(item._id);
                        setError(null);
                        setSelectedVideo("");
                      }}
                    >
                      <div className="col-span-2 min-w-0 sm:col-span-1">
                        <p className="break-words text-sm font-medium">
                          {item.title}
                        </p>
                        <p className="mt-1 text-xs text-[#888]">
                          {projectName(item.projectId)}
                          {item.batchId
                            ? item.plannedAt
                              ? " · Plan ready"
                              : " · Needs planning"
                            : ""}
                        </p>
                      </div>
                      <p className="text-sm">{name(item.producerClerkId)}</p>
                      <div>
                        <span data-stage={item.stage} className="agency-stage">
                          {CONTENT_STAGE_LABELS[item.stage]}
                        </span>
                        {item.video && item.video.status !== "ready" && (
                          <p className="mt-1 text-xs text-[#888]">
                            {item.video.status === "failed"
                              ? "Upload failed — replace the edit"
                              : "Upload processing"}
                          </p>
                        )}
                      </div>
                      <p className="text-xs text-muted">
                        {item.dueDate || "No due date"}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : ready.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line p-8">
              <h2 className="font-bold">No approved content here yet</h2>
              <p className="mt-2 text-sm text-[#888]">
                Finished, playable edits marked Done appear here. Processing
                files and older tracked versions stay out.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {ready.map((video) => (
                <article key={video._id} className="agency-panel min-w-0 p-5">
                  <p className="text-xs font-medium text-[var(--success)]">
                    READY TO USE
                  </p>
                  <h2 className="mt-2 break-words text-lg font-semibold">
                    {readyTitle(video)}
                  </h2>
                  <p className="mt-1 text-sm text-[#888]">
                    {projectName(video.projectId)}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <a
                      className="rounded-xl border border-line px-3 py-2 text-sm font-medium hover:bg-[#e8e8e0]"
                      href={videoPath(teamSlug, video.projectId, video._id)}
                    >
                      Open review
                    </a>
                    <Button
                      disabled={busy || !connected}
                      onClick={() =>
                        void act(async () => {
                          const result = await download({
                            videoId: video._id,
                            approvedOnly: true,
                          });
                          triggerDownload(result.url, result.filename);
                        })
                      }
                    >
                      Download original
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
        {rawOpened && data.canBrowseRaw && (
          <RawAssetLibrary
            key={`${teamId}:${data.subject}`}
            teamId={teamId}
            data={data}
            active={activeTab === "raw"}
            focusedId={rawFocus}
            onFocus={setRawFocus}
            initialScope={projectFilter}
          />
        )}
      </div>
      <Dialog
        open={!!selected && !editing}
        onOpenChange={(open) => {
          if (!open && !busy) setSelectedId(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selected?.title}</DialogTitle>
            <DialogDescription>
              {selected && projectName(selected.projectId)} ·{" "}
              {selected && CONTENT_STAGE_LABELS[selected.stage]}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <>
              <p className="whitespace-pre-wrap break-words text-sm">
                {selected.brief || "No brief provided."}
              </p>
              <dl className="grid grid-cols-2 gap-3 border-y border-line py-4 text-sm">
                {[
                  ["Producer", name(selected.producerClerkId)],
                  ["Director / reviewer", name(selected.directorClerkId)],
                  ["CMO", name(selected.cmoClerkId)],
                  ["Due date", selected.dueDate || "Not set"],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs text-[#888]">{label}</dt>
                    <dd className="break-words text-sm font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
              {data.canBrowseRaw && selected.sourceAssets.length > 0 && (
                <div className="space-y-2 border-t border-line pt-3">
                  <h3 className="text-sm font-medium">Source assets</h3>
                  {selected.sourceAssets.map((source) => (
                    <div
                      key={source._id}
                      className="flex flex-wrap items-center justify-between gap-2"
                    >
                      <button
                        type="button"
                        disabled={!source.available}
                        className="min-w-0 break-words text-left text-sm text-[var(--accent)] underline-offset-4 hover:underline disabled:text-muted"
                        onClick={() => openRaw(source._id)}
                      >
                        {source.filename}
                      </button>
                      {selected.canProduce && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy || !connected}
                          aria-label={`Remove reference to ${source.filename}`}
                          onClick={() =>
                            void act(() =>
                              detachSource({
                                itemId: selected._id,
                                assetId: source._id,
                              }),
                            )
                          }
                        >
                          Remove reference
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {error && (
                <p role="alert" className="text-sm text-red-700">
                  {error}
                </p>
              )}
              {selected.video && selected.video.status !== "ready" && (
                <p
                  role={selected.video.status === "failed" ? "alert" : "status"}
                  className="text-sm"
                >
                  {selected.video.status === "failed"
                    ? "This upload failed. Upload a new version to retry; it must finish processing before review."
                    : selected.video.status === "uploading"
                      ? "Uploading the original file. Review opens when processing finishes."
                      : "Processing this edit. Review opens when it is ready."}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {(data.canManage || selected.canPlan) && (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => openForm(selected)}
                  >
                    {data.canManage ? "Edit assignment" : "Plan ad"}
                  </Button>
                )}
                {selected.canProduce && (
                  <>
                    {selected.stage === "planned" && (
                      <Button
                        disabled={busy || !connected}
                        onClick={() =>
                          void act(() => start({ itemId: selected._id }))
                        }
                      >
                        Start work
                      </Button>
                    )}
                    <label
                      className={`cursor-pointer rounded-xl border border-line px-3 py-2 text-sm font-medium ${busy || !connected ? "opacity-50" : "hover:bg-[#e8e8e0]"}`}
                    >
                      Upload {selected.video ? "new version" : "edit"}
                      <input
                        className="sr-only"
                        type="file"
                        accept="video/*,.mp4,.mov,.m4v,.webm"
                        disabled={busy || !connected}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file)
                            requestUpload(
                              [file],
                              selected.projectId,
                              selected._id,
                            );
                          event.target.value = "";
                        }}
                      />
                    </label>
                  </>
                )}
                {selected.video?.status === "ready" && (
                  <a
                    className="rounded-xl border border-line px-3 py-2 text-sm font-medium hover:bg-[#e8e8e0]"
                    href={videoPath(
                      teamSlug,
                      selected.projectId,
                      selected.video._id,
                    )}
                  >
                    Open{" "}
                    {selected.stage === "done" ? "approved edit" : "review"}
                  </a>
                )}
              </div>
              {selected.canProduce && (
                <div className="mt-3 space-y-2 border-t border-line pt-4">
                  <label
                    className="block text-sm font-bold"
                    htmlFor="link-edit"
                  >
                    Or attach an existing edit from this project
                  </label>
                  <select
                    id="link-edit"
                    className={selectClass}
                    value={selectedVideo}
                    disabled={busy || !connected}
                    onChange={(event) => setSelectedVideo(event.target.value)}
                  >
                    <option value="">Choose a video…</option>
                    {data.linkableVideos
                      .filter(
                        (video) =>
                          video.projectId === selected.projectId &&
                          (!video.contentItemId ||
                            video.contentItemId === selected._id),
                      )
                      .map((video) => (
                        <option key={video._id} value={video._id}>
                          {video.title} · {video.status}
                        </option>
                      ))}
                  </select>
                  <Button
                    variant="outline"
                    disabled={!selectedVideo || busy || !connected}
                    onClick={() =>
                      void act(async () => {
                        await link({
                          itemId: selected._id,
                          videoId: selectedVideo as Id<"videos">,
                        });
                        setSelectedVideo("");
                      })
                    }
                  >
                    Attach edit
                  </Button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) closeForm();
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing === "new"
                ? "New assignment"
                : data.canManage
                  ? "Edit assignment"
                  : "Plan ad"}
            </DialogTitle>
            <DialogDescription>
              The brief, owners, and deadline stay with the edit through review.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={save}>
            <fieldset
              disabled={busy || !!pendingCreate.current}
              className="space-y-4 disabled:opacity-70"
            >
              <label className="block text-sm font-bold">
                Project
                <select
                  className={selectClass}
                  required
                  disabled={editing !== "new"}
                  value={draft.projectId}
                  onChange={(event) => field("projectId", event.target.value)}
                >
                  <option value="">Choose a project</option>
                  {data.projects.map((project) => (
                    <option key={project._id} value={project._id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-bold">
                Title
                <Input
                  required
                  maxLength={200}
                  value={draft.title}
                  onChange={(event) => field("title", event.target.value)}
                />
              </label>
              <label className="block text-sm font-bold">
                Brief
                <Textarea
                  aria-label="Brief"
                  rows={5}
                  maxLength={20000}
                  value={draft.brief}
                  onChange={(event) => field("brief", event.target.value)}
                  placeholder="What are we making, for whom, and what does the edit need to deliver?"
                />
              </label>
              {data.canManage && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      ["producerClerkId", "Producer"],
                      ["directorClerkId", "Director / reviewer"],
                      ["cmoClerkId", "CMO"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="block text-sm font-bold">
                      {label}
                      <select
                        aria-label={label}
                        className={selectClass}
                        value={draft[key]}
                        onChange={(event) => field(key, event.target.value)}
                      >
                        <option value="">Unassigned</option>
                        {data.members
                          .filter(
                            (member) =>
                              key === "cmoClerkId" || member.role !== "viewer",
                          )
                          .map((member) => (
                            <option
                              key={member.userClerkId}
                              value={member.userClerkId}
                            >
                              {member.userName}
                            </option>
                          ))}
                      </select>
                    </label>
                  ))}
                  <label className="block text-sm font-bold">
                    Due date
                    <Input
                      type="date"
                      value={draft.dueDate}
                      onChange={(event) => field("dueDate", event.target.value)}
                    />
                  </label>
                </div>
              )}
            </fieldset>
            {formError && (
              <p role="alert" className="text-sm text-red-700">
                {formError}
                {pendingCreate.current &&
                  " Your original request is retained. Confirm it before starting another assignment."}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                type="button"
                disabled={busy || !!pendingCreate.current}
                onClick={closeForm}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  busy || !connected || !draft.title.trim() || !draft.projectId
                }
              >
                {busy
                  ? "Saving…"
                  : pendingCreate.current
                    ? "Confirm assignment"
                    : data.canManage
                      ? "Save assignment"
                      : "Save plan"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
