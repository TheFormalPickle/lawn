// The storage key identifies one original-file attempt, including retries on the
// same video. Keep legacy Mux passthrough IDs readable, but never use that ID
// alone as proof that an event belongs to today's original file.
export function muxUploadIdentity(videoId: string, uploadId: string) {
  return JSON.stringify({ version: 1, videoId, uploadId });
}

export function parseMuxUploadIdentity(value: string | undefined) {
  if (!value) return null;
  if (!value.startsWith("{")) return { videoId: value, uploadId: undefined };
  try {
    const parsed = JSON.parse(value);
    if (
      parsed.version !== 1 ||
      typeof parsed.videoId !== "string" ||
      typeof parsed.uploadId !== "string" ||
      !parsed.videoId ||
      !parsed.uploadId
    )
      return null;
    return {
      videoId: parsed.videoId as string,
      uploadId: parsed.uploadId as string,
    };
  } catch {
    return null;
  }
}

export function matchesMuxUpload(
  video: { s3Key?: string; muxAssetId?: string; muxUploadId?: string },
  event: { uploadId?: string; muxAssetId?: string; muxUploadId?: string },
) {
  if (event.uploadId) {
    return (
      video.s3Key === event.uploadId &&
      (!event.muxAssetId ||
        !video.muxAssetId ||
        video.muxAssetId === event.muxAssetId)
    );
  }
  return Boolean(
    (event.muxAssetId && video.muxAssetId === event.muxAssetId) ||
    (event.muxUploadId && video.muxUploadId === event.muxUploadId),
  );
}
