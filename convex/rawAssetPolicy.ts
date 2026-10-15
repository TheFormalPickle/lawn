// Shared validation only: never imports credentials or provider clients.
const formats: Record<
  string,
  { kind: "video" | "photo" | "audio"; types: string[] }
> = {
  mp4: { kind: "video", types: ["video/mp4"] },
  mov: { kind: "video", types: ["video/quicktime"] },
  webm: { kind: "video", types: ["video/webm"] },
  jpg: { kind: "photo", types: ["image/jpeg"] },
  jpeg: { kind: "photo", types: ["image/jpeg"] },
  png: { kind: "photo", types: ["image/png"] },
  webp: { kind: "photo", types: ["image/webp"] },
  avif: { kind: "photo", types: ["image/avif"] },
  heic: { kind: "photo", types: ["image/heic", "image/heif"] },
  mp3: { kind: "audio", types: ["audio/mpeg", "audio/mp3"] },
  wav: { kind: "audio", types: ["audio/wav", "audio/x-wav", "audio/wave"] },
  m4a: { kind: "audio", types: ["audio/mp4", "audio/x-m4a"] },
  aac: { kind: "audio", types: ["audio/aac"] },
  ogg: { kind: "audio", types: ["audio/ogg", "application/ogg"] },
  flac: { kind: "audio", types: ["audio/flac", "audio/x-flac"] },
};
export const RAW_ASSET_ACCEPT = Object.keys(formats)
  .map((ext) => `.${ext}`)
  .join(",");
export function rawAssetFile(
  filename: string,
  fileSize: number,
  contentType: string,
) {
  if (
    !filename.trim() ||
    filename.length > 240 ||
    filename.includes("/") ||
    filename.includes("\\") ||
    [...filename].some((char) => char.charCodeAt(0) < 32)
  )
    throw new Error("Choose a file with a valid name of up to 240 characters.");
  if (
    !Number.isSafeInteger(fileSize) ||
    fileSize <= 0 ||
    fileSize > 5 * 1024 ** 3
  )
    throw new Error("Choose a nonempty file up to 5 GiB.");
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const format = Object.prototype.hasOwnProperty.call(formats, ext)
    ? formats[ext]
    : undefined;
  if (!format)
    throw new Error("Choose a supported video, photo or audio file.");
  const type = contentType.split(";")[0].trim().toLowerCase();
  if (
    type &&
    type !== "application/octet-stream" &&
    !format.types.includes(type)
  )
    throw new Error("The file extension and media type do not match.");
  return { kind: format.kind, contentType: format.types[0], extension: ext };
}
export function rawAssetFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 240) || "asset";
}
