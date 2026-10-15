#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
async function main() {
  if (
    process.versions.bun ||
    Number(process.versions.node.split(".")[0]) !== 22
  )
    throw new Error(
      "Run this administrative CLI with Node22, not Bun or an unverified runtime.",
    );
  if (typeof process.getuid !== "function")
    throw new Error(
      "This administrative CLI requires POSIX ownership and private-file permissions.",
    );
  const argv = process.argv.slice(2);
  const flags = {};
  const allowed = new Set([
    "email",
    "name",
    "output",
    "secrets",
    "base-url",
    "admin-user",
    "recover-subject",
  ]);
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i]?.startsWith("--") || !argv[i + 1])
      throw new Error(
        "Usage: --email EXACT_EMAIL --name DISPLAY_NAME --output ABSOLUTE_PRIVATE_JSON --secrets ABSOLUTE_ENV [--base-url URL]",
      );
    const key = argv[i].slice(2);
    if (!allowed.has(key) || flags[key])
      throw new Error("Unknown or repeated argument.");
    flags[key] = argv[i + 1];
  }
  const email = (flags.email || "").trim().toLowerCase();
  const name = (flags.name || "").trim();
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !name ||
    !path.isAbsolute(flags.output || "") ||
    !path.isAbsolute(flags.secrets || "")
  )
    throw new Error(
      "Exact email, display name and absolute private file paths are required.",
    );
  const base = new URL(flags["base-url"] || "http://127.0.0.1:5280/auth");
  if (
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    (base.protocol !== "https:" &&
      !(
        base.protocol === "http:" &&
        ["127.0.0.1", "localhost", "[::1]"].includes(base.hostname)
      ))
  )
    throw new Error("Admin endpoint must use TLS or exact loopback.");
  const baseURL = base.toString().replace(/\/$/, "");
  const realm = "atrium";
  function privateFile(file) {
    const st = fs.lstatSync(file);
    if (
      !st.isFile() ||
      st.isSymbolicLink() ||
      (st.mode & 0o077) !== 0 ||
      st.uid !== process.getuid()
    )
      throw new Error(
        "Secret/receipt file must be an owner-only regular file owned by this user.",
      );
  }
  const directory = fs.lstatSync(path.dirname(flags.output));
  if (
    !directory.isDirectory() ||
    directory.isSymbolicLink() ||
    (directory.mode & 0o077) !== 0 ||
    directory.uid !== process.getuid()
  )
    throw new Error(
      "Receipt directory must be owner-only and owned by this user.",
    );
  function saveReceipt(value, create = false) {
    const temporary = flags.output + "." + crypto.randomUUID() + ".tmp";
    const fd = fs.openSync(temporary, "wx", 0o600);
    try {
      fs.writeFileSync(fd, JSON.stringify(value, null, 2) + "\n");
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    try {
      if (create)
        fs.linkSync(temporary, flags.output); // Atomic create; never overwrite another request.
      else {
        privateFile(flags.output);
        fs.renameSync(temporary, flags.output);
      }
    } finally {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
    const parent = fs.openSync(path.dirname(flags.output), "r");
    try {
      fs.fsyncSync(parent);
    } finally {
      fs.closeSync(parent);
    }
  }
  privateFile(flags.secrets);
  const env = {};
  for (const line of fs.readFileSync(flags.secrets, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  if (!env.KEYCLOAK_ADMIN_PASSWORD)
    throw new Error("Local admin secret is unavailable.");
  let receipt;
  if (fs.existsSync(flags.output)) {
    privateFile(flags.output);
    try {
      receipt = JSON.parse(fs.readFileSync(flags.output, "utf8"));
    } catch {
      throw new Error(
        "Existing receipt cannot be parsed. Preserve it for supervised recovery.",
      );
    }
    if (
      receipt.email !== email ||
      receipt.realm !== realm ||
      receipt.displayName !== name ||
      !receipt.requestId ||
      !receipt.temporaryPassword ||
      receipt.version !== 1 ||
      ![
        "prepared",
        "creation-pending",
        "confirmation-pending",
        "created",
      ].includes(receipt.status) ||
      !Number.isFinite(Date.parse(receipt.createdAt))
    )
      throw new Error(
        "Existing receipt belongs to a different or unrecognized request.",
      );
  } else {
    receipt = {
      version: 1,
      status: "prepared",
      realm,
      email,
      username: email,
      displayName: name,
      requestId: crypto.randomUUID(),
      temporaryPassword: crypto.randomBytes(24).toString("base64url"),
      mustChangePassword: true,
      createdAt: new Date().toISOString(),
    };
    saveReceipt(receipt, true);
  }
  async function request(url, options = {}) {
    return await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(20000),
      redirect: "error",
    });
  }
  const login = await request(
    baseURL + "/realms/master/protocol/openid-connect/token",
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "password",
        client_id: "admin-cli",
        username: flags["admin-user"] || "atrium-beta-admin",
        password: env.KEYCLOAK_ADMIN_PASSWORD,
      }),
    },
  );
  if (!login.ok)
    throw new Error("Local Keycloak administration authentication failed.");
  const token = (await login.json()).access_token;
  if (!token) throw new Error("No administration token received.");
  async function admin(url, options = {}) {
    return await request(baseURL + "/admin/realms/" + realm + url, {
      ...options,
      headers: { authorization: "Bearer " + token, ...options.headers },
    });
  }
  const configResponse = await admin("");
  if (!configResponse.ok)
    throw new Error("Cannot verify the exact beta realm.");
  const config = await configResponse.json();
  if (
    config.realm !== realm ||
    config.registrationAllowed !== false ||
    config.duplicateEmailsAllowed !== false ||
    config.editUsernameAllowed !== false
  )
    throw new Error(
      "Realm is not in the required closed-user mode. No user created.",
    );
  const profileResponse = await admin("/users/profile");
  if (!profileResponse.ok)
    throw new Error("Cannot verify email-edit restrictions.");
  const profile = await profileResponse.json();
  const emailAttribute = profile.attributes?.find((x) => x.name === "email");
  if (
    !emailAttribute?.permissions?.edit?.includes("admin") ||
    emailAttribute.permissions.edit.includes("user")
  )
    throw new Error(
      "User email must be editable only by administrators. No user created.",
    );
  const clientsResponse = await admin("/clients?clientId=atrium-web");
  if (!clientsResponse.ok)
    throw new Error("Cannot verify the exact browser client.");
  const clients = (await clientsResponse.json()).filter(
    (c) => c.clientId === "atrium-web",
  );
  if (clients.length !== 1)
    throw new Error("Expected one exact browser client. No user created.");
  const client = clients[0];
  if (
    client.publicClient !== true ||
    client.standardFlowEnabled !== true ||
    client.directAccessGrantsEnabled !== false ||
    client.implicitFlowEnabled !== false ||
    client.attributes?.["pkce.code.challenge.method"] !== "S256"
  )
    throw new Error(
      "Browser client must remain public authorization-code plus S256 without direct or implicit grants. No user created.",
    );
  const scopesResponse = await admin(
    "/clients/" + encodeURIComponent(client.id) + "/default-client-scopes",
  );
  if (!scopesResponse.ok)
    throw new Error("Cannot verify default browser token scopes.");
  const scopes = await scopesResponse.json();
  const basic = scopes.find((s) => s.name === "basic");
  if (!basic)
    throw new Error(
      "Official basic scope is required so signed tokens retain stable subjects. No user created.",
    );
  const mappersResponse = await admin(
    "/client-scopes/" +
      encodeURIComponent(basic.id) +
      "/protocol-mappers/models",
  );
  if (
    !mappersResponse.ok ||
    !(await mappersResponse.json()).some(
      (m) => m.protocolMapper === "oidc-sub-mapper",
    )
  )
    throw new Error(
      "Official basic subject mapper must be configured. No user created.",
    );
  async function lookup() {
    const response = await admin(
      "/users?email=" + encodeURIComponent(email) + "&exact=true",
    );
    if (!response.ok)
      throw new Error("Cannot check for an existing exact account.");
    const users = (await response.json()).filter(
      (u) => (u.email || "").trim().toLowerCase() === email,
    );
    if (users.length > 1)
      throw new Error(
        "Multiple exact accounts found. No modification performed.",
      );
    return users[0];
  }
  let user = await lookup();
  if (user && receipt.subject !== user.id) {
    if (
      flags["recover-subject"] === user.id &&
      user.createdTimestamp >= Date.parse(receipt.createdAt) &&
      (user.requiredActions || []).includes("UPDATE_PASSWORD")
    ) {
      receipt.subject = user.id;
      receipt.status = "confirmation-pending";
      saveReceipt(receipt);
    } else
      throw new Error(
        "An account already exists. Existing credentials were not changed. For a known lost creation confirmation, review its exact ID and retain this original private receipt before explicit recovery.",
      );
  }
  if (!user && (receipt.subject || receipt.status !== "prepared"))
    throw new Error(
      "Previously attempted identity is unavailable. No account recreated. Preserve the original receipt for supervised review.",
    );
  if (!user) {
    const parts = name.split(/\s+/);
    const body = {
      username: email,
      email,
      enabled: true,
      emailVerified: false,
      firstName: parts.shift(),
      lastName: parts.join(" "),
      requiredActions: ["UPDATE_PASSWORD"],
      attributes: { atriumProvisionRequest: [receipt.requestId] },
      credentials: [
        { type: "password", value: receipt.temporaryPassword, temporary: true },
      ],
    };
    receipt.status = "creation-pending";
    saveReceipt(receipt); // Durable before the first potentially committing request.
    let response;
    try {
      response = await admin("/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      user = await lookup();
      throw new Error(
        "Creation confirmation unavailable. Retain this original private receipt and review the exact saved account ID before explicit recovery; do not generate a new request.",
      );
    }
    if (response && !response.ok)
      throw new Error(
        "Account creation failed. No existing credentials changed.",
      );
    if (response?.status === 201) {
      const location = response.headers.get("location");
      const id = location?.split("/").pop();
      if (id) {
        receipt.subject = id;
        receipt.status = "confirmation-pending";
        saveReceipt(receipt);
      }
    }
    if (!user) user = await lookup();
  }
  if (!user || user.id !== receipt.subject)
    throw new Error(
      "Cannot confirm the exact saved account ID. Retain the original private receipt for explicit recovery.",
    );
  const detailsResponse = await admin("/users/" + encodeURIComponent(user.id));
  if (!detailsResponse.ok)
    throw new Error("Cannot confirm the saved exact account.");
  const details = await detailsResponse.json();
  if (details.id !== user.id || (details.email || "").toLowerCase() !== email)
    throw new Error("Saved identity does not match the exact request.");
  receipt = {
    ...receipt,
    status: "created",
    subject: user.id,
    confirmedAt: new Date().toISOString(),
    signInURL: "https://beta.atriumsuite.com/sign-in",
    credentialNotice:
      "Initial credential is temporary. The user must replace it during their first normal Keycloak sign-in. Do not share this file publicly.",
  };
  saveReceipt(receipt);
  console.log(
    "Confirmed the exact closed-beta account. Existing unrelated users and credentials were not changed.",
  );
  console.log(
    "Temporary first-login credential is in the specified owner-only output file; it was not printed or emailed.",
  );
}
main().catch((error) => {
  console.error("Provisioning failed: " + error.message);
  process.exitCode = 1;
});
