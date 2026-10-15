import { useEffect, useRef, useState } from "react";
import { useAction, useConvex, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { rawAssetFile } from "../../../convex/rawAssetPolicy";

export function assetError(error: unknown) {
  const text =
    error instanceof Error
      ? error.message
      : "The request could not be confirmed. Please retry.";
  return text.split("Uncaught Error: ").at(-1)?.split("\n")[0] ?? text;
}
type Upload = {
  requestKey: string;
  actor: string;
  teamId: Id<"teams">;
  projectId?: Id<"projects">;
  file: File;
  assetId?: Id<"rawAssets">;
  key?: string;
  phase:
    | "preparing"
    | "uploading"
    | "confirming"
    | "unconfirmed"
    | "failed"
    | "complete";
  progress: number;
  error?: string;
};
export function useRawAssetUploads(
  teamId: Id<"teams">,
  actor: string,
  onConfirmed: () => void,
) {
  const convex = useConvex(),
    remove = useMutation(api.rawAssets.remove);
  const create = useMutation(api.rawAssets.create),
    uploadUrl = useAction(api.rawAssetActions.uploadUrl),
    confirm = useAction(api.rawAssetActions.confirm);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const running = useRef(new Set<string>());
  const queue = useRef(Promise.resolve());
  const onReady = useRef(onConfirmed);
  onReady.current = onConfirmed;
  const patch = (id: string, data: Partial<Upload>) =>
    setUploads((rows) =>
      rows.map((row) => (row.requestKey === id ? { ...row, ...data } : row)),
    );
  const perform = async (original: Upload, confirmationOnly = false) => {
    if (running.current.has(original.requestKey)) return;
    running.current.add(original.requestKey);
    let sent = confirmationOnly;
    let assetId = original.assetId,
      key = original.key;
    patch(original.requestKey, {
      phase: confirmationOnly ? "confirming" : "preparing",
      error: undefined,
    });
    try {
      if (!confirmationOnly) {
        const file = rawAssetFile(
          original.file.name,
          original.file.size,
          original.file.type,
        );
        assetId ??= await create({
          teamId: original.teamId,
          projectId: original.projectId,
          filename: original.file.name,
          fileSize: original.file.size,
          contentType: file.contentType,
          requestKey: original.requestKey,
          expectedActorId: original.actor,
        });
        patch(original.requestKey, { assetId });
        const target = await uploadUrl({
          assetId,
          expectedActorId: original.actor,
        });
        key = target.key;
        patch(original.requestKey, { key });
        if (!target.ready && target.url) {
          patch(original.requestKey, { phase: "uploading", progress: 0 });
          await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("PUT", target.url!);
            xhr.setRequestHeader("Content-Type", file.contentType);
            xhr.upload.onprogress = (e) => {
              if (e.lengthComputable)
                patch(original.requestKey, {
                  progress: Math.round((e.loaded / e.total) * 100),
                });
            };
            xhr.onload = () =>
              xhr.status >= 200 && xhr.status < 300
                ? resolve()
                : reject(
                    new Error("Transfer failed. Retry this original file."),
                  );
            xhr.onerror = () =>
              reject(
                new Error("Transfer interrupted. Retry this original file."),
              );
            xhr.timeout = 30 * 60 * 1000;
            xhr.ontimeout = () =>
              reject(
                new Error("Transfer timed out. Retry this original file."),
              );
            xhr.send(original.file);
          });
        }
        sent = true;
      }
      if (!assetId || !key)
        throw new Error(
          "Original upload identity is unavailable. Resume from Unfinished uploads.",
        );
      patch(original.requestKey, { phase: "confirming", progress: 100 });
      await confirm({ assetId, key, expectedActorId: original.actor });
      patch(original.requestKey, { phase: "complete", progress: 100 });
      onReady.current();
    } catch (error) {
      patch(original.requestKey, {
        assetId,
        key,
        phase: sent ? "unconfirmed" : "failed",
        error: assetError(error),
      });
    } finally {
      running.current.delete(original.requestKey);
    }
  };
  const add = (
    files: File[],
    projectId?: Id<"projects">,
    resumed?: { assetId: Id<"rawAssets">; requestKey: string },
  ) => {
    const accepted: Upload[] = [];
    for (const file of files) {
      if (
        [...uploads, ...accepted].some(
          (row) =>
            row.phase !== "complete" &&
            row.file.name === file.name &&
            row.file.size === file.size &&
            row.projectId === projectId,
        )
      )
        continue;
      const entry: Upload = {
        requestKey: resumed?.requestKey ?? crypto.randomUUID(),
        actor,
        teamId,
        projectId,
        file,
        assetId: resumed?.assetId,
        phase: "preparing",
        progress: 0,
      };
      accepted.push(entry);
    }
    setUploads((rows) => [...rows, ...accepted]);
    // A small bounded queue avoids competing transfers on production connections.
    queue.current = queue.current.then(async () => {
      for (const entry of accepted) await perform(entry);
    });
  };
  const pending = uploads.some((row) => row.phase !== "complete");
  useEffect(() => {
    if (!pending) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [pending]);
  const discard = async (upload: Upload) => {
    // A lost create reply may have committed. Resolve its original receipt before
    // abandoning the local key, rather than silently enabling a duplicate retry.
    const found = upload.assetId
      ? { assetId: upload.assetId }
      : await convex.query(api.rawAssets.findUpload, {
          teamId: upload.teamId,
          requestKey: upload.requestKey,
        });
    if (found) await remove({ assetId: found.assetId });
    setUploads((rows) =>
      rows.filter((row) => row.requestKey !== upload.requestKey),
    );
    onReady.current();
  };
  return {
    uploads,
    add,
    discard,
    retry: (upload: Upload) => perform(upload, upload.phase === "unconfirmed"),
    dismiss: (key: string) =>
      setUploads((rows) => rows.filter((row) => row.requestKey !== key)),
    has: (id: Id<"rawAssets">, requestKey?: string) =>
      uploads.some(
        (row) =>
          (row.assetId === id || row.requestKey === requestKey) &&
          row.phase !== "complete",
      ),
  };
}
