export type AuthProviderMode = "clerk" | "keycloak";

export function authProviderMode(value: string | undefined): AuthProviderMode {
  if (!value || value === "clerk") return "clerk";
  if (value === "keycloak") return "keycloak";
  throw new Error(
    "Unknown authentication provider. Check the server configuration.",
  );
}

export function safeAuthReturnPath(value: string | null | undefined): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return "/dashboard";
  }
  try {
    const target = new URL(value, "https://atrium.invalid");
    return target.origin === "https://atrium.invalid"
      ? `${target.pathname}${target.search}${target.hash}`
      : "/dashboard";
  } catch {
    return "/dashboard";
  }
}

export function oidcBrowserConfig(
  environment: Record<string, string | boolean | undefined>,
  development = false,
) {
  const url = environment.VITE_OIDC_URL;
  const realm = environment.VITE_OIDC_REALM;
  const clientId = environment.VITE_OIDC_CLIENT_ID;
  if (
    typeof url !== "string" ||
    typeof realm !== "string" ||
    typeof clientId !== "string" ||
    !realm ||
    !clientId
  ) {
    throw new Error(
      "Self-hosted sign-in is not configured. Contact the workspace administrator.",
    );
  }
  const parsed = new URL(url);
  const isLoopback = ["localhost", "127.0.0.1", "[::1]"].includes(
    parsed.hostname,
  );
  if (
    (parsed.protocol !== "https:" &&
      !(development && isLoopback && parsed.protocol === "http:")) ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    !/^[\w.-]+$/.test(realm)
  ) {
    throw new Error(
      "Self-hosted sign-in requires a valid secure issuer configuration.",
    );
  }
  return { url: parsed.toString().replace(/\/$/, ""), realm, clientId };
}

export function oidcUser(token: Record<string, unknown> | undefined) {
  if (!token || typeof token.sub !== "string" || !token.sub) return null;
  const email =
    typeof token.email === "string" ? token.email.trim().toLowerCase() : "";
  return {
    id: token.sub,
    fullName:
      typeof token.name === "string" && token.name
        ? token.name
        : email || "Team member",
    primaryEmailAddress: email ? { emailAddress: email } : undefined,
  };
}
