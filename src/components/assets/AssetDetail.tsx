import { useCallback, useEffect, useRef, useState } from "react";
import { useAction, useConvex, useMutation } from "convex/react";
import { Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { triggerDownload } from "@/lib/download";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/utils";
import { assetError } from "./useRawAssetUploads";
type Data = FunctionReturnType<typeof api.contentItems.list>;
export function AssetDetail({
  assetId,
  data,
  close,
  onChanged,
}: {
  assetId: Id<"rawAssets">;
  data: Data;
  close: () => void;
  onChanged: () => void;
}) {
  const convex = useConvex(),
    readUrl = useAction(api.rawAssetActions.readUrl),
    reuse = useMutation(api.rawAssets.useInAssignment),
    remove = useMutation(api.rawAssets.remove);
  const [asset, setAsset] = useState<FunctionReturnType<
      typeof api.rawAssets.get
    > | null>(null),
    [grant, setGrant] = useState<FunctionReturnType<
      typeof api.rawAssetActions.readUrl
    > | null>(null),
    [error, setError] = useState(""),
    [mediaError, setMediaError] = useState(false),
    [busy, setBusy] = useState(false),
    [item, setItem] = useState(""),
    [saved, setSaved] = useState("");
  const request = useRef(0);
  const preview = useCallback(async () => {
    const version = ++request.current;
    setBusy(true);
    setError("");
    setGrant(null);
    setMediaError(false);
    try {
      const [metadata, url] = await Promise.all([
        convex.query(api.rawAssets.get, { assetId }),
        readUrl({ assetId, download: false }),
      ]);
      if (request.current !== version) return;
      setAsset(metadata);
      setGrant(url);
    } catch (e) {
      if (request.current === version) setError(assetError(e));
    } finally {
      if (request.current === version) setBusy(false);
    }
  }, [assetId, convex, readUrl]);
  useEffect(() => {
    void preview();
    return () => {
      request.current++;
    };
  }, [preview]);
  useEffect(() => {
    if (!grant) return;
    const timer = setTimeout(
      () => {
        setGrant(null);
        setError(
          "The preview link expired. Retry preview to check current access and storage.",
        );
      },
      Math.max(0, grant.expiresAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [grant]);
  const action = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(assetError(e));
    } finally {
      setBusy(false);
    }
  };
  const targets = data.items.filter(
    (row) =>
      row.canProduce &&
      (!asset?.projectId || row.projectId === asset.projectId),
  );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="break-words pr-5">
            {asset?.filename ?? "Source asset"}
          </DialogTitle>
          <DialogDescription>
            {asset?.projectId
              ? data.projects.find((p) => p._id === asset.projectId)?.name
              : "Shared across clients"}
            {asset ? ` · ${formatBytes(asset.fileSize)}` : ""}
          </DialogDescription>
        </DialogHeader>
        {busy && (
          <p role="status" className="text-sm text-muted">
            Checking the original…
          </p>
        )}
        {error && (
          <div role="alert" className="space-y-3">
            <p className="break-words text-sm">{error}</p>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void preview()}
            >
              Retry preview
            </Button>
          </div>
        )}
        {asset && grant && (
          <div className="overflow-hidden rounded-xl bg-black">
            {asset.kind === "photo" ? (
              <img
                src={grant.url}
                alt={asset.filename}
                className="max-h-[45vh] w-full object-contain"
                onError={() => setMediaError(true)}
              />
            ) : asset.kind === "audio" ? (
              <audio
                className="w-full"
                controls
                src={grant.url}
                onError={() => setMediaError(true)}
              />
            ) : (
              <video
                className="max-h-[45vh] w-full"
                controls
                playsInline
                src={grant.url}
                onError={() => setMediaError(true)}
              />
            )}
          </div>
        )}
        {mediaError && (
          <p role="status" className="text-sm text-muted">
            This browser could not preview the file. Retry preview, or download
            the original to use it in your editor.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={busy || !asset}
            onClick={() =>
              void action(async () => {
                try {
                  const file = await readUrl({ assetId, download: true });
                  triggerDownload(file.url, file.filename);
                } catch (e) {
                  setGrant(null);
                  throw e;
                }
              })
            }
          >
            <Download />
            Download original
          </Button>
          {mediaError && !error && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void preview()}
            >
              Retry preview
            </Button>
          )}
          {asset?.canRemove && (
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    "Remove this source asset from the shared library? Existing assignment references will become unavailable. Previously issued links keep their original expiry.",
                  )
                )
                  void action(async () => {
                    await remove({ assetId });
                    onChanged();
                    close();
                  });
              }}
            >
              Remove asset
            </Button>
          )}
        </div>
        {asset && (
          <div className="space-y-3 border-t border-line pt-4">
            <label className="block text-sm font-medium">
              Use in assignment
              <select
                aria-label="Use in assignment"
                className="agency-select mt-2"
                value={item}
                onChange={(e) => {
                  setItem(e.target.value);
                  setSaved("");
                }}
              >
                <option value="">Choose assigned work…</option>
                {targets.map((row) => (
                  <option key={row._id} value={row._id}>
                    {row.title}
                  </option>
                ))}
              </select>
            </label>
            <Button
              variant="outline"
              disabled={busy || !item || !grant}
              onClick={() =>
                void action(async () => {
                  await reuse({ assetId, itemId: item as Id<"contentItems"> });
                  setSaved("Source reference attached. No copy was created.");
                })
              }
            >
              Attach source
            </Button>
            {saved && (
              <p role="status" className="text-sm text-[var(--success)]">
                {saved}
              </p>
            )}
            {targets.length === 0 && (
              <p className="text-sm text-muted">
                No assigned work for this client is available to you. You can
                still download the original.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
