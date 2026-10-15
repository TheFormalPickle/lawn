import { useCallback, useEffect, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { hasFileDrop } from "@/lib/useGlobalFileDrop";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RAW_ASSET_ACCEPT, rawAssetFile } from "../../../convex/rawAssetPolicy";
import { assetError, useRawAssetUploads } from "./useRawAssetUploads";
import { RawCatalog } from "./RawCatalog";
import { AssetDetail } from "./AssetDetail";
type Data = FunctionReturnType<typeof api.contentItems.list>;
export function RawAssetLibrary({
  teamId,
  data,
  active,
  focusedId,
  onFocus,
  initialScope,
  returnLabel,
}: {
  teamId: Id<"teams">;
  data: Data;
  active: boolean;
  focusedId: Id<"rawAssets"> | null;
  onFocus: (id: Id<"rawAssets"> | null) => void;
  initialScope: string;
  returnLabel?: string;
}) {
  const [scope, setScope] = useState(initialScope),
    [kind, setKind] = useState(""),
    [search, setSearch] = useState(""),
    [debounced, setDebounced] = useState(""),
    [refreshKey, setRefreshKey] = useState(0),
    [error, setError] = useState(""),
    [restoring, setRestoring] = useState(false);
  const [dragging, setDragging] = useState(false);
  const confirmed = useCallback(() => setRefreshKey((n) => n + 1), []);
  const uploads = useRawAssetUploads(teamId, data.subject, confirmed);
  const unfinished = useQuery(api.rawAssets.unfinished, { teamId }),
    confirm = useAction(api.rawAssetActions.confirm),
    remove = useMutation(api.rawAssets.remove);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(timer);
  }, [search]);
  const projectName = (id?: Id<"projects">) =>
    id
      ? (data.projects.find((p) => p._id === id)?.name ?? "Unavailable client")
      : "Shared across clients";
  const restore = async (fn: () => Promise<void>) => {
    setRestoring(true);
    setError("");
    try {
      await fn();
      confirmed();
    } catch (e) {
      setError(assetError(e));
    } finally {
      setRestoring(false);
    }
  };
  const receiveFiles = (files: File[]) => {
    setError("");
    if (files.length > 100) {
      setError("Upload up to 100 source files at a time.");
      return;
    }
    const projectId =
      scope && scope !== "shared" ? (scope as Id<"projects">) : undefined;
    const fresh: File[] = [];
    for (const file of files) {
      const pending = unfinished?.items.find(
        (row) =>
          row.canConfirm &&
          row.filename === file.name &&
          row.fileSize === file.size &&
          row.projectId === projectId,
      );
      if (pending)
        uploads.add([file], projectId, {
          assetId: pending._id,
          requestKey: pending.requestKey,
        });
      else fresh.push(file);
    }
    uploads.add(fresh, projectId);
  };
  return (
    <section
      hidden={!active}
      data-file-drop="raw-library"
      data-dragging={dragging}
      onDragOver={(e) => {
        if (!hasFileDrop(e.dataTransfer)) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "copy";
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        if (!hasFileDrop(e.dataTransfer)) return;
        e.preventDefault();
        e.stopPropagation();
        setDragging(false);
        receiveFiles(Array.from(e.dataTransfer.files));
      }}
      className="px-4 pb-6 sm:px-7"
      aria-label="Raw asset library"
    >
      <div className="agency-panel mb-5 grid grid-cols-2 items-end gap-3 p-4 lg:grid-cols-[minmax(180px,1fr)_minmax(160px,220px)_140px_auto]">
        <Input
          className="col-span-2 lg:col-span-1"
          aria-label="Search raw assets"
          placeholder="Search source filenames…"
          value={search}
          maxLength={200}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label className="text-xs text-muted">
          Client
          <select
            aria-label="Raw asset client"
            className="agency-select mt-1"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
          >
            <option value="">All clients</option>
            <option value="shared">Shared across clients</option>
            {data.projects.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <select
          aria-label="Media type"
          className="agency-select"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          <option value="">All media</option>
          <option value="video">Video</option>
          <option value="photo">Photos</option>
          <option value="audio">Audio</option>
        </select>
        <label className="col-span-2 lg:col-span-1 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--ring)] inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-medium text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)]">
          <Upload size={16} />
          Upload source files
          <input
            aria-label="Upload source files"
            type="file"
            multiple
            accept={RAW_ASSET_ACCEPT}
            className="sr-only"
            onChange={(e) => {
              receiveFiles(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
        </label>
      </div>
      <p className="mb-5 text-sm text-muted">
        Drop raw video, photos or audio here, or choose Upload source files.
        Uploads in All clients go to Shared across clients. Approved ads stay in
        Ready to use.
      </p>
      {error && (
        <p role="alert" className="mb-4 text-sm text-[var(--destructive)]">
          {error}
        </p>
      )}
      {uploads.uploads.length > 0 && (
        <div
          className="agency-panel mb-5 divide-y divide-line"
          aria-label="Source uploads"
        >
          {uploads.uploads.map((upload) => (
            <div key={upload.requestKey} className="space-y-2 p-4 text-sm">
              <p className="break-words font-medium">{upload.file.name}</p>
              <p className="text-muted">
                {upload.phase === "complete"
                  ? "Ready in the source library"
                  : upload.phase === "uploading"
                    ? `Uploading ${upload.progress}%`
                    : upload.phase === "unconfirmed"
                      ? "File sent; confirmation unavailable"
                      : upload.phase === "failed"
                        ? "Upload interrupted"
                        : upload.phase === "confirming"
                          ? "Checking stored original…"
                          : "Preparing upload…"}
              </p>
              {upload.error && (
                <p role="alert" className="break-words">
                  {upload.error}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {(upload.phase === "failed" ||
                  upload.phase === "unconfirmed") && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void uploads.retry(upload)}
                  >
                    {upload.phase === "unconfirmed"
                      ? "Confirm source upload"
                      : "Retry source upload"}
                  </Button>
                )}
                {upload.phase === "complete" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => uploads.dismiss(upload.requestKey)}
                  >
                    Dismiss
                  </Button>
                )}
                {(upload.phase === "failed" ||
                  upload.phase === "unconfirmed") && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={restoring}
                    onClick={() => {
                      if (
                        window.confirm("Discard this unfinished source upload?")
                      )
                        void restore(async () => {
                          await uploads.discard(upload);
                        });
                    }}
                  >
                    Discard upload
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {unfinished &&
        unfinished.items.some(
          (row) => !uploads.has(row._id, row.requestKey),
        ) && (
          <details className="agency-panel mb-5 p-4" open>
            <summary className="cursor-pointer text-sm font-medium">
              Unfinished uploads
            </summary>
            <p className="mt-2 text-xs text-muted">
              Recovered saved upload requests. Confirm files already sent,
              resume the original file, or discard the request.
            </p>
            {unfinished.items
              .filter((row) => !uploads.has(row._id, row.requestKey))
              .map((row) => (
                <div
                  key={row._id}
                  className="mt-4 space-y-2 border-t border-line pt-3 text-sm"
                >
                  <p className="break-words font-medium">
                    {row.filename} · {projectName(row.projectId)}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {row.canConfirm && row.storageKey && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={restoring}
                        onClick={() =>
                          void restore(async () => {
                            await confirm({
                              assetId: row._id,
                              key: row.storageKey!,
                              expectedActorId: data.subject,
                            });
                          })
                        }
                      >
                        Confirm stored file
                      </Button>
                    )}
                    {row.canConfirm && (
                      <label className="cursor-pointer rounded-xl border border-line px-3 py-2 text-xs">
                        Resume original file
                        <input
                          aria-label={`Resume ${row.filename}`}
                          type="file"
                          accept={RAW_ASSET_ACCEPT}
                          disabled={restoring}
                          className="sr-only"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              try {
                                const type = rawAssetFile(
                                  file.name,
                                  file.size,
                                  file.type,
                                );
                                if (
                                  file.name !== row.filename ||
                                  file.size !== row.fileSize ||
                                  type.contentType !== row.contentType
                                )
                                  throw new Error(
                                    "Select the original file with the saved name, size and type.",
                                  );
                                uploads.add([file], row.projectId, {
                                  assetId: row._id,
                                  requestKey: row.requestKey,
                                });
                              } catch (err) {
                                setError(assetError(err));
                              }
                            }
                            e.target.value = "";
                          }}
                        />
                      </label>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={restoring}
                      onClick={() => {
                        if (
                          window.confirm(
                            "Discard this unfinished source upload?",
                          )
                        )
                          void restore(async () => {
                            await remove({ assetId: row._id });
                          });
                      }}
                    >
                      Discard upload
                    </Button>
                  </div>
                </div>
              ))}
            {unfinished.hasMore && (
              <p className="mt-3 text-xs text-muted">
                Showing the newest 100 unfinished uploads. Resolve these to
                reach older requests.
              </p>
            )}
          </details>
        )}
      <RawCatalog
        key={`${teamId}:${data.subject}:${scope}:${kind}:${debounced}`}
        teamId={teamId}
        scope={scope}
        kind={kind}
        search={debounced}
        refreshKey={refreshKey}
        open={onFocus}
        projectName={projectName}
      />
      {focusedId && (
        <AssetDetail
          key={focusedId}
          returnLabel={returnLabel}
          assetId={focusedId}
          data={data}
          close={() => onFocus(null)}
          onChanged={confirmed}
        />
      )}
    </section>
  );
}
