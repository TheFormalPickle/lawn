import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConvex } from "convex/react";
import { Film, Image, Music2, RefreshCw } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/utils";
import { assetError } from "./useRawAssetUploads";
type Page = FunctionReturnType<typeof api.rawAssets.list>;
type Kind = "video" | "photo" | "audio";
const icons = { video: Film, photo: Image, audio: Music2 };
export function RawCatalog({
  teamId,
  scope,
  kind,
  search,
  refreshKey,
  open,
  projectName,
}: {
  teamId: Id<"teams">;
  scope: string;
  kind: string;
  search: string;
  refreshKey: number;
  open: (id: Id<"rawAssets">) => void;
  projectName: (id?: Id<"projects">) => string;
}) {
  const convex = useConvex();
  const [rows, setRows] = useState<Page["page"]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [done, setDone] = useState(false),
    [loaded, setLoaded] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [stale, setStale] = useState(false);
  const failedCursor = useRef<string | undefined>(undefined);
  const epoch = useRef(0),
    inFlight = useRef(false),
    expiry = useRef<ReturnType<typeof setTimeout> | null>(null);
  const args = useMemo(
    () => ({
      teamId,
      projectId:
        scope && scope !== "shared" ? (scope as Id<"projects">) : undefined,
      sharedOnly: scope === "shared",
      kind: kind ? (kind as Kind) : undefined,
      search,
    }),
    [teamId, scope, kind, search],
  );
  const load = useCallback(
    async (next?: string) => {
      if (next && inFlight.current) return;
      const request = ++epoch.current;
      inFlight.current = true;
      setBusy(true);
      setError("");
      try {
        const page = await convex.query(api.rawAssets.list, {
          ...args,
          paginationOpts: { cursor: next ?? null, numItems: 50 },
        });
        if (request !== epoch.current) return;
        setRows((old) =>
          next
            ? [
                ...new Map(
                  [...old, ...page.page].map((row) => [row._id, row]),
                ).values(),
              ]
            : page.page,
        );
        setCursor(page.continueCursor);
        setDone(page.isDone);
        setLoaded(true);
        if (!next) {
          setStale(false);
          if (expiry.current) clearTimeout(expiry.current);
          expiry.current = setTimeout(() => setStale(true), 60_000);
        }
      } catch (e) {
        if (request !== epoch.current) return;
        failedCursor.current = next;
        const message = assetError(e);
        setError(message);
        if (/role|authenticated|member/i.test(message)) {
          setRows([]);
          setLoaded(false);
        }
      } finally {
        if (request === epoch.current) {
          setBusy(false);
          inFlight.current = false;
        }
      }
    },
    [convex, args],
  );
  useEffect(() => {
    void load();
    return () => {
      epoch.current++;
      if (expiry.current) clearTimeout(expiry.current);
    };
  }, [load, refreshKey]);
  return (
    <div className="agency-panel">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <h2 className="font-semibold">Source files</h2>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => void load()}
        >
          <RefreshCw />
          Refresh
        </Button>
      </div>
      {error && (
        <div
          role="alert"
          className="space-y-2 border-b border-line p-4 text-sm"
        >
          <p>Library unavailable: {error}</p>
          {rows.length > 0 && (
            <p className="text-muted">
              Last loaded files are shown. Preview and download check current
              access and storage.
            </p>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void load(failedCursor.current)}
          >
            Retry library
          </Button>
        </div>
      )}
      {stale && !error && (
        <p
          role="status"
          className="border-b border-line p-4 text-sm text-muted"
        >
          This catalog snapshot may have changed. Refresh to check for new
          files.
        </p>
      )}
      {!loaded && busy && (
        <p role="status" className="p-6 text-sm text-muted">
          Loading source files…
        </p>
      )}
      {loaded && !error && !busy && rows.length === 0 && (
        <div className="p-6">
          <h3 className="font-medium">
            {done
              ? "No source files match this view"
              : "No matches on this page"}
          </h3>
          <p className="mt-2 text-sm text-muted">
            {done
              ? "Upload raw footage, photos or audio, or change the filters."
              : "Continue loading to look through the remaining files."}
          </p>
        </div>
      )}
      {rows.map((row) => {
        const Icon = icons[row.kind];
        return (
          <button
            type="button"
            key={row._id}
            className="grid w-full grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 border-b border-line px-5 py-4 text-left last:border-b-0 hover:bg-[var(--surface-alt)]"
            onClick={() => open(row._id)}
          >
            <Icon className="h-5 w-5 text-muted" />
            <div className="min-w-0">
              <p className="break-words text-sm font-medium">{row.filename}</p>
              <p className="mt-1 text-xs text-muted">
                {projectName(row.projectId)} · {row.kind} · {row.uploadedByName}
              </p>
            </div>
            <span className="text-xs text-muted">
              {formatBytes(row.fileSize)}
            </span>
          </button>
        );
      })}
      {!done && loaded && (
        <div className="p-4">
          <Button
            variant="outline"
            disabled={busy || !cursor}
            onClick={() => void load(cursor!)}
          >
            {busy ? "Loading…" : "Load more source files"}
          </Button>
        </div>
      )}
    </div>
  );
}
