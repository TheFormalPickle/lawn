/** Server-only deployment policy. Never accept this mode from a browser request. */
export function deploymentBillingPolicy(
  env: Record<string, string | undefined> = process.env,
) {
  const mode = env.LAWN_BILLING_MODE || "subscription";
  if (mode === "subscription")
    return { mode, storageLimitBytes: undefined } as const;
  if (mode !== "internal")
    throw new Error("LAWN_BILLING_MODE must be internal or subscription.");
  const gigabytes = Number(env.LAWN_INTERNAL_STORAGE_GB || "100");
  const storageLimitBytes = gigabytes * 1024 ** 3;
  if (
    !Number.isInteger(gigabytes) ||
    gigabytes < 1 ||
    !Number.isSafeInteger(storageLimitBytes)
  )
    throw new Error(
      "LAWN_INTERNAL_STORAGE_GB must be a positive whole number of GiB.",
    );
  return { mode, storageLimitBytes } as const;
}
