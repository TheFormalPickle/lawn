import { useAuth } from "@/lib/auth";
import { useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

import { Outlet, useLocation, useParams } from "@tanstack/react-router";
import { isVideoFile, useGlobalFileDrop } from "@/lib/useGlobalFileDrop";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UploadProgress } from "@/components/upload/UploadProgress";
import { useVideoUploadManager } from "./-useVideoUploadManager";
import { DashboardUploadProvider } from "@/lib/dashboardUploadContext";

export default function DashboardLayout() {
  const { isLoaded, userId } = useAuth();
  const location = useLocation();
  const { pathname, searchStr } = location;
  const params = useParams({ strict: false });
  const teamSlug =
    typeof params.teamSlug === "string" ? params.teamSlug : undefined;
  const routeProjectId =
    typeof params.projectId === "string"
      ? (params.projectId as Id<"projects">)
      : undefined;
  const routeVideoId =
    typeof params.videoId === "string" ? params.videoId : undefined;
  const publicPlaybackId = useQuery(
    api.videos.getPublicIdByVideoId,
    routeVideoId ? { videoId: routeVideoId } : "skip",
  );
  const uploadTargets = useQuery(
    api.projects.listUploadTargets,
    teamSlug ? { teamSlug } : {},
  );
  const {
    uploads,
    uploadFilesToProject,
    cancelUpload,
    retryUploadConfirmation,
  } = useVideoUploadManager();
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);
  const uploadableProjectIds = useMemo(
    () => new Set((uploadTargets ?? []).map((target) => target.projectId)),
    [uploadTargets],
  );
  const canUploadToCurrentProject = routeProjectId
    ? uploadableProjectIds.has(routeProjectId)
    : false;

  const requestUpload = useCallback(
    (
      inputFiles: File[],
      preferredProjectId?: Id<"projects">,
      contentItemId?: Id<"contentItems">,
    ) => {
      const files = inputFiles.filter(isVideoFile);
      if (files.length === 0) return;

      if (preferredProjectId) {
        void uploadFilesToProject(preferredProjectId, files, contentItemId);
        return;
      }

      if (
        routeProjectId &&
        (canUploadToCurrentProject || uploadTargets === undefined)
      ) {
        void uploadFilesToProject(routeProjectId, files);
        return;
      }

      if (uploadTargets && uploadTargets.length === 0) {
        window.alert("You do not have upload access to any projects.");
        return;
      }

      setPendingFiles(files);
      setProjectPickerOpen(true);
    },
    [
      canUploadToCurrentProject,
      routeProjectId,
      uploadFilesToProject,
      uploadTargets,
    ],
  );

  const handleProjectSelected = useCallback(
    (projectId: Id<"projects">) => {
      const files = pendingFiles;
      if (!files || files.length === 0) return;

      setProjectPickerOpen(false);
      setPendingFiles(null);
      void uploadFilesToProject(projectId, files);
    },
    [pendingFiles, uploadFilesToProject],
  );

  const handleProjectPickerOpenChange = useCallback((open: boolean) => {
    setProjectPickerOpen(open);
    if (!open) {
      setPendingFiles(null);
    }
  }, []);

  const isGlobalDragActive = useGlobalFileDrop(requestUpload);

  const uploadContext = useMemo(
    () => ({
      requestUpload,
      uploads,
      cancelUpload,
    }),
    [requestUpload, uploads, cancelUpload],
  );
  const isResolvingPublicPlaybackExemption =
    Boolean(isLoaded && !userId && routeVideoId) &&
    publicPlaybackId === undefined;

  useEffect(() => {
    if (!isLoaded || userId) return;
    if (typeof window === "undefined") return;

    if (routeVideoId) {
      if (publicPlaybackId === undefined) return;
      if (publicPlaybackId) {
        window.location.replace(`/watch/${publicPlaybackId}`);
        return;
      }
    }

    const redirectUrl = `${pathname}${searchStr}`;
    window.location.replace(
      `/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`,
    );
  }, [isLoaded, userId, pathname, searchStr, routeVideoId, publicPlaybackId]);

  if (!isLoaded) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-[#888]">Loading...</div>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-[#888]">
          {isResolvingPublicPlaybackExemption
            ? "Checking public playback access..."
            : "Redirecting to sign in..."}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative h-full flex flex-col bg-background")}>
      {/* Main content */}
      <main className="flex-1 overflow-auto flex flex-col">
        <DashboardUploadProvider value={uploadContext}>
          <Outlet />
        </DashboardUploadProvider>
      </main>

      {isGlobalDragActive && (
        <div className="pointer-events-none fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/30" />
          <div className="absolute inset-4 rounded-2xl border-2 border-dashed border-[var(--accent)] bg-[var(--accent)]/10 flex items-center justify-center">
            <p className="rounded-xl border border-line bg-surface px-4 py-2 text-sm font-medium text-foreground">
              Drop onto an assignment or the raw library
            </p>
          </div>
        </div>
      )}

      {uploads.length > 0 && (
        <div className="fixed left-4 right-4 top-16 z-50 space-y-2 sm:bottom-4 sm:top-auto sm:right-auto sm:w-full sm:max-w-sm">
          {uploads.map((upload) => (
            <UploadProgress
              key={upload.id}
              fileName={upload.file.name}
              fileSize={upload.file.size}
              progress={upload.progress}
              status={upload.status}
              error={upload.error}
              bytesPerSecond={upload.bytesPerSecond}
              estimatedSecondsRemaining={upload.estimatedSecondsRemaining}
              onCancel={() => cancelUpload(upload.id)}
              onRetryConfirmation={() => retryUploadConfirmation(upload.id)}
            />
          ))}
        </div>
      )}

      <Dialog
        open={projectPickerOpen}
        onOpenChange={handleProjectPickerOpenChange}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choose a client</DialogTitle>
            <DialogDescription>
              {pendingFiles?.length
                ? `Upload ${pendingFiles.length} video${pendingFiles.length > 1 ? "s" : ""} to:`
                : "Pick a client to start uploading."}
            </DialogDescription>
          </DialogHeader>
          {uploadTargets === undefined ? (
            <p className="text-sm text-muted">Loading clients…</p>
          ) : uploadTargets.length === 0 ? (
            <p className="text-sm text-muted">
              No uploadable clients found for your account.
            </p>
          ) : (
            <div className="max-h-80 overflow-y-auto rounded-xl border border-line divide-y divide-line">
              {uploadTargets.map((target) => (
                <button
                  key={target.projectId}
                  type="button"
                  className="w-full px-4 py-3 text-left hover:bg-[var(--surface-alt)] transition-colors"
                  onClick={() => handleProjectSelected(target.projectId)}
                >
                  <p className="font-medium text-foreground">
                    {target.projectName}
                  </p>
                  <p className="text-xs text-muted">{target.teamName}</p>
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
