import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import type { FunctionReturnType } from "convex/server";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type Data = FunctionReturnType<typeof api.contentItems.list>;
type Request = {
  projectId: Id<"projects">;
  productionTeamId: Id<"productionTeams">;
  quantity: number;
  dueDate: string;
  notes: string;
  requestKey: string;
  expectedActorId: string;
};
const selectClass =
  "w-full min-w-0 border-2 border-[#ccc] bg-[#f0f0e8] px-3 py-2 text-sm";
const keyFor = (team: string, actor: string) =>
  `lawn:pending-workload:${team}:${actor}`;
function restored(team: string, actor: string): Request | null {
  try {
    const value = JSON.parse(
      sessionStorage.getItem(keyFor(team, actor)) || "null",
    );
    return value?.expectedActorId === actor &&
      typeof value.requestKey === "string" &&
      typeof value.projectId === "string" &&
      typeof value.productionTeamId === "string" &&
      typeof value.dueDate === "string" &&
      typeof value.notes === "string" &&
      Number.isInteger(value.quantity)
      ? value
      : null;
  } catch {
    return null;
  }
}
export function WorkloadIntake({
  data,
  teamId,
  connected,
  onCreated,
}: {
  data: Data;
  teamId: Id<"teams">;
  connected: boolean;
  onCreated: (id: Id<"contentBatches">) => void;
}) {
  const create = useMutation(api.contentBatches.create),
    saveTeam = useMutation(api.contentBatches.saveProductionTeam);
  const [pending, setPending] = useState<Request | null>(() =>
    restored(teamId, data.subject),
  );
  const [mode, setMode] = useState<"request" | "teams" | null>(() =>
    restored(teamId, data.subject) ? "request" : null,
  );
  const [project, setProject] = useState(
    () => pending?.projectId ?? data.projects[0]?._id ?? "",
  );
  const [pair, setPair] = useState(
    () =>
      pending?.productionTeamId ??
      data.batches.find((b) => b.projectId === project)?.productionTeamId ??
      data.productionTeams[0]?._id ??
      "",
  );
  const [quantity, setQuantity] = useState(pending?.quantity ?? 0),
    [due, setDue] = useState(pending?.dueDate ?? ""),
    [notes, setNotes] = useState(pending?.notes ?? "");
  const [teamEdit, setTeamEdit] = useState<
      Data["productionTeams"][number] | null
    >(null),
    [name, setName] = useState(""),
    [director, setDirector] = useState(""),
    [producer, setProducer] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const saving = useRef(false);
  const close = () => {
    if (busy || pending) return;
    if (
      (mode === "request" && (due || notes)) ||
      (mode === "teams" && (name || director || producer))
    ) {
      if (!window.confirm("Discard these unsaved changes?")) return;
    }
    setMode(null);
    setError("");
  };
  const submit = async () => {
    if (saving.current || !connected) return;
    saving.current = true;
    setBusy(true);
    setError("");
    let request = pending;
    try {
      request ??= {
        projectId: project as Id<"projects">,
        productionTeamId: pair as Id<"productionTeams">,
        quantity,
        dueDate: due,
        notes,
        requestKey: crypto.randomUUID(),
        expectedActorId: data.subject,
      };
      // Persist before dispatch. Refresh never silently starts another batch key.
      sessionStorage.setItem(
        keyFor(teamId, request.expectedActorId),
        JSON.stringify(request),
      );
      setPending(request);
      const id = await create(request);
      sessionStorage.removeItem(keyFor(teamId, request.expectedActorId));
      setPending(null);
      setMode(null);
      setDue("");
      setNotes("");
      onCreated(id);
    } catch (reason) {
      if (
        reason instanceof ConvexError &&
        !String(reason.data).includes("account changed")
      ) {
        if (request)
          sessionStorage.removeItem(keyFor(teamId, request.expectedActorId));
        setPending(null);
      }
      setError(
        reason instanceof Error
          ? reason.message.split("\n")[0]
          : "Could not confirm this workload. Retry its original request.",
      );
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };
  const storeTeam = async () => {
    if (saving.current || !connected) return;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      const id = await saveTeam({
        teamId,
        productionTeamId: teamEdit?._id,
        expectedUpdatedAt: teamEdit?.updatedAt,
        name,
        directorClerkId: director,
        producerClerkId: producer,
      });
      setPair(id);
      setName("");
      setDirector("");
      setProducer("");
      setTeamEdit(null);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message.split("\n")[0]
          : "Could not save this content team.",
      );
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={!connected || !data.projects.length}
          onClick={() => {
            setMode("request");
            setError("");
          }}
        >
          Assign client workload
        </Button>
        <Button
          variant="outline"
          disabled={!connected || !!pending}
          onClick={() => {
            setMode("teams");
            setError("");
          }}
        >
          Content teams
        </Button>
      </div>
      <Dialog
        open={!!mode}
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {mode === "teams" ? "Content teams" : "Assign client workload"}
            </DialogTitle>
            <DialogDescription>
              {mode === "teams"
                ? "Set up director/producer pairs once. Existing work keeps its assigned people when a roster changes."
                : "Choose the client, count, deadline and team. Lawn creates the delivery slots; directors plan each ad."}
            </DialogDescription>
          </DialogHeader>
          {mode === "request" ? (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
            >
              <fieldset
                disabled={busy || !!pending}
                className="space-y-4 disabled:opacity-70"
              >
                <label className="block text-sm font-bold">
                  Client / project
                  <select
                    aria-label="Client / project"
                    className={selectClass}
                    required
                    value={project}
                    onChange={(e) => {
                      setProject(e.target.value as Id<"projects">);
                      const previous = data.batches.find(
                        (b) => b.projectId === e.target.value,
                      );
                      if (previous) setPair(previous.productionTeamId);
                    }}
                  >
                    <option value="">Choose client</option>
                    {data.projects.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm font-bold">
                    Deliverable count
                    <Input
                      type="number"
                      required
                      min={1}
                      max={100}
                      value={quantity || ""}
                      onChange={(e) => setQuantity(Number(e.target.value))}
                    />
                  </label>
                  <label className="block text-sm font-bold">
                    Due date
                    <Input
                      type="date"
                      required
                      value={due}
                      onChange={(e) => setDue(e.target.value)}
                    />
                  </label>
                </div>
                <label className="block text-sm font-bold">
                  Content team
                  <select
                    aria-label="Content team"
                    required
                    className={selectClass}
                    value={pair}
                    onChange={(e) =>
                      setPair(e.target.value as Id<"productionTeams">)
                    }
                  >
                    <option value="">Choose team</option>
                    {data.productionTeams.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-bold">
                  Workload notes (optional)
                  <Textarea
                    aria-label="Workload notes (optional)"
                    rows={3}
                    maxLength={20000}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </label>
              </fieldset>
              {!data.productionTeams.length && (
                <p className="text-sm">
                  Set up your director/producer pairs in Content teams first.
                </p>
              )}
              {pending && (
                <p role="status" className="break-words text-sm">
                  Original workload retained. Confirm it before starting another
                  request; refreshing this tab keeps the same request.
                </p>
              )}
              {error && (
                <p role="alert" className="break-words text-sm text-red-700">
                  {error}
                </p>
              )}
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || !!pending}
                  onClick={close}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={busy || !connected || !project || !pair || !due}
                >
                  {busy
                    ? "Confirming…"
                    : pending
                      ? "Confirm workload"
                      : "Assign workload"}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              {data.productionTeams.map((t) => (
                <button
                  key={t._id}
                  className="w-full border-2 border-[#ccc] p-3 text-left text-sm"
                  disabled={busy}
                  onClick={() => {
                    setTeamEdit(t);
                    setName(t.name);
                    setDirector(t.directorClerkId);
                    setProducer(t.producerClerkId);
                  }}
                >
                  <strong>{t.name}</strong>
                  <span className="block text-xs text-[#888]">
                    {data.members.find(
                      (m) => m.userClerkId === t.directorClerkId,
                    )?.userName ?? "Former member"}{" "}
                    ·{" "}
                    {data.members.find(
                      (m) => m.userClerkId === t.producerClerkId,
                    )?.userName ?? "Former member"}
                  </span>
                </button>
              ))}
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void storeTeam();
                }}
              >
                <h3 className="font-bold">
                  {teamEdit ? "Edit content team" : "Add content team"}
                </h3>
                <fieldset disabled={busy} className="space-y-3">
                  <label className="block text-sm font-bold">
                    Team name
                    <Input
                      required
                      maxLength={100}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </label>
                  {[
                    ["Director", director, setDirector],
                    ["Producer", producer, setProducer],
                  ].map(([label, value, set]) => (
                    <label
                      key={label as string}
                      className="block text-sm font-bold"
                    >
                      {label as string}
                      <select
                        aria-label={label as string}
                        required
                        className={selectClass}
                        value={value as string}
                        onChange={(e) =>
                          (set as typeof setDirector)(e.target.value)
                        }
                      >
                        <option value="">Choose member</option>
                        {data.members
                          .filter((m) => m.role !== "viewer")
                          .map((m) => (
                            <option key={m.userClerkId} value={m.userClerkId}>
                              {m.userName}
                            </option>
                          ))}
                      </select>
                    </label>
                  ))}
                </fieldset>
                {error && (
                  <p role="alert" className="text-sm text-red-700">
                    {error}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={busy || !connected}>
                    Save content team
                  </Button>
                  {teamEdit && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setTeamEdit(null);
                        setName("");
                        setDirector("");
                        setProducer("");
                      }}
                    >
                      Add another team
                    </Button>
                  )}
                </div>
              </form>
              <Button variant="outline" disabled={busy} onClick={close}>
                Done
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
