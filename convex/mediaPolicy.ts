/** Server-only choice. Original mode never invents transcoding/provider receipts. */
export function mediaMode(
  env: Record<string, string | undefined> = process.env,
) {
  const mode = env.LAWN_MEDIA_MODE || "mux";
  if (mode !== "mux" && mode !== "original") {
    throw new Error("LAWN_MEDIA_MODE must be mux or original.");
  }
  return mode;
}
