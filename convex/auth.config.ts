const mode = process.env.AUTH_PROVIDER || "clerk";
if (mode !== "clerk" && mode !== "oidc") {
  throw new Error("Unknown AUTH_PROVIDER");
}
const domain =
  mode === "oidc"
    ? process.env.OIDC_ISSUER_DOMAIN
    : process.env.CLERK_JWT_ISSUER_DOMAIN;
const audience = mode === "oidc" ? process.env.OIDC_AUDIENCE : "convex";
if (mode === "oidc") {
  if (!domain || !audience)
    throw new Error("OIDC issuer and audience are required");
  const issuer = new URL(domain);
  if (
    issuer.protocol !== "https:" ||
    issuer.username ||
    issuer.password ||
    issuer.search ||
    issuer.hash
  ) {
    throw new Error("OIDC issuer must be a secure URL");
  }
}
export default { providers: [{ domain, applicationID: audience }] };
