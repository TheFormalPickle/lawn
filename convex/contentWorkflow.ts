import type { Doc } from "./_generated/dataModel";

export const CONTENT_STAGES = [
  "planned",
  "in_progress",
  "review",
  "rework",
  "done",
] as const;
export type ContentStage = (typeof CONTENT_STAGES)[number];
export const CONTENT_STAGE_LABELS: Record<ContentStage, string> = {
  planned: "Assigned",
  in_progress: "In production",
  review: "In review",
  rework: "Changes requested",
  done: "Ready to use",
};

export function canManageContent(role: string) {
  return role === "owner" || role === "admin";
}
export function canProduceContent(
  item: Pick<Doc<"contentItems">, "producerClerkId" | "directorClerkId">,
  subject: string,
  role: string,
) {
  return (
    role !== "viewer" &&
    (canManageContent(role) ||
      item.producerClerkId === subject ||
      item.directorClerkId === subject)
  );
}
export function canReviewContent(
  item: Pick<Doc<"contentItems">, "directorClerkId">,
  subject: string,
  role: string,
) {
  return (
    role !== "viewer" &&
    (canManageContent(role) || item.directorClerkId === subject)
  );
}
// Processing/upload failures are never an approval. The latest linked version's
// existing review status is the single authority after it becomes playable.
export function contentStage(
  item: Pick<Doc<"contentItems">, "productionStatus" | "currentVideoId">,
  video: Pick<Doc<"videos">, "_id" | "status" | "workflowStatus"> | null,
): ContentStage {
  if (!item.currentVideoId) return item.productionStatus;
  if (!video || video._id !== item.currentVideoId || video.status !== "ready")
    return "in_progress";
  return video.workflowStatus ?? "review";
}
