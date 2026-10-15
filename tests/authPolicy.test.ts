import test from "node:test";
import assert from "node:assert/strict";
import {
  authProviderMode,
  oidcBrowserConfig,
  oidcUser,
  safeAuthReturnPath,
} from "../src/lib/authPolicy";

test("unknown providers fail closed while Clerk remains the default", () => {
  assert.equal(authProviderMode(undefined), "clerk");
  assert.equal(authProviderMode("keycloak"), "keycloak");
  assert.throws(() => authProviderMode("preview"));
});
test("return paths cannot send an authenticated browser to another origin", () => {
  assert.equal(
    safeAuthReturnPath("/invite/exact-token?from=team"),
    "/invite/exact-token?from=team",
  );
  for (const value of [
    "//evil.invalid",
    "https://evil.invalid",
    "/\\evil.invalid",
    "javascript:alert(1)",
  ])
    assert.equal(safeAuthReturnPath(value), "/dashboard");
});
test("OIDC requires complete secure configuration without embedded credentials", () => {
  const valid = {
    VITE_OIDC_URL: "https://auth.example.invalid",
    VITE_OIDC_REALM: "atrium",
    VITE_OIDC_CLIENT_ID: "atrium-web",
  };
  assert.equal(oidcBrowserConfig(valid).realm, "atrium");
  assert.throws(() =>
    oidcBrowserConfig({ ...valid, VITE_OIDC_URL: "http://192.168.0.104:5280" }),
  );
  assert.throws(() =>
    oidcBrowserConfig({
      ...valid,
      VITE_OIDC_URL: "https://admin:secret@auth.example.invalid",
    }),
  );
  assert.throws(() => oidcBrowserConfig({ ...valid, VITE_OIDC_REALM: "" }));
  assert.equal(
    oidcBrowserConfig(
      { ...valid, VITE_OIDC_URL: "http://127.0.0.1:5280" },
      true,
    ).url,
    "http://127.0.0.1:5280",
  );
});
test("the stable signed subject survives session changes; email is normalized", () => {
  const a = oidcUser({
    sub: "stable-user-uuid",
    sid: "session-one",
    email: "Member@Example.invalid",
    name: "Content Producer",
  });
  const b = oidcUser({
    sub: "stable-user-uuid",
    sid: "session-two",
    email: "member@example.invalid",
  });
  assert.equal(a?.id, b?.id);
  assert.equal(a?.primaryEmailAddress?.emailAddress, "member@example.invalid");
  assert.equal(oidcUser({ email: "not-an-identity@example.invalid" }), null);
});
