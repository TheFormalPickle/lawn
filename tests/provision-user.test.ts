import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(
  new URL("../deploy/provision-user.mjs", import.meta.url),
);
const email = "chosen@example.invalid";
const adminSecret = "owned-loopback-fixture-only";

type FixtureOptions = {
  editableEmail?: boolean;
  basic?: boolean;
  subjectMapper?: boolean;
  pkce?: string;
  existing?: boolean;
  loseCreationReply?: boolean;
  redirect?: "token" | "admin";
};
async function fixture(options: FixtureOptions = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "atrium-provision-"));
  fs.chmodSync(directory, 0o700);
  const secretFile = path.join(directory, "admin.env");
  const receiptFile = path.join(directory, "initial.json");
  fs.writeFileSync(secretFile, `KEYCLOAK_ADMIN_PASSWORD=${adminSecret}\n`, {
    mode: 0o600,
  });
  let user: Record<string, any> | null = options.existing
    ? { id: "unrelated-existing", email, enabled: true, requiredActions: [] }
    : null;
  let creates = 0;
  let resets = 0;
  let originalPassword: string | null = null;
  let redirectedRequests = 0;
  const redirectServer = createServer((_request, response) => {
    redirectedRequests++;
    response.writeHead(204);
    response.end();
  });
  await new Promise<void>((resolve) =>
    redirectServer.listen(0, "127.0.0.1", resolve),
  );
  const redirectAddress = redirectServer.address();
  assert.ok(redirectAddress && typeof redirectAddress === "object");
  const redirectLocation = `http://127.0.0.1:${redirectAddress.port}/must-not-receive-credentials`;
  const server = createServer(async (request, response) => {
    const url = new URL(request.url!, "http://localhost");
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const body = Buffer.concat(chunks).toString();
    const send = (value: unknown, status = 200) => {
      response.writeHead(status, { "content-type": "application/json" });
      response.end(JSON.stringify(value));
    };
    if (url.pathname.endsWith("/protocol/openid-connect/token")) {
      const form = new URLSearchParams(body);
      assert.equal(form.get("password"), adminSecret);
      if (options.redirect === "token") {
        response.writeHead(307, { location: redirectLocation });
        response.end();
        return;
      }
      send({ access_token: "fixture-admin-token" });
      return;
    }
    assert.equal(request.headers.authorization, "Bearer fixture-admin-token");
    if (options.redirect === "admin") {
      response.writeHead(307, { location: redirectLocation });
      response.end();
      return;
    }
    const route = url.pathname.replace("/auth/admin/realms/atrium", "");
    if (route === "")
      send({
        realm: "atrium",
        registrationAllowed: false,
        duplicateEmailsAllowed: false,
        editUsernameAllowed: false,
      });
    else if (route === "/users/profile")
      send({
        attributes: [
          {
            name: "email",
            permissions: {
              edit: options.editableEmail ? ["admin", "user"] : ["admin"],
            },
          },
        ],
      });
    else if (route === "/clients")
      send([
        {
          id: "browser-client",
          clientId: "atrium-web",
          publicClient: true,
          standardFlowEnabled: true,
          directAccessGrantsEnabled: false,
          implicitFlowEnabled: false,
          attributes: { "pkce.code.challenge.method": options.pkce || "S256" },
        },
      ]);
    else if (route === "/clients/browser-client/default-client-scopes")
      send(
        options.basic === false
          ? []
          : [{ id: "official-basic", name: "basic" }],
      );
    else if (route === "/client-scopes/official-basic/protocol-mappers/models")
      send(
        options.subjectMapper === false
          ? []
          : [{ protocolMapper: "oidc-sub-mapper" }],
      );
    else if (route === "/users" && request.method === "GET")
      send(user ? [user] : []);
    else if (route === "/users" && request.method === "POST") {
      creates++;
      const proposed = JSON.parse(body);
      assert.equal(proposed.email, email);
      assert.deepEqual(proposed.requiredActions, ["UPDATE_PASSWORD"]);
      assert.equal(proposed.emailVerified, false);
      assert.equal(proposed.credentials[0].temporary, true);
      originalPassword = proposed.credentials[0].value;
      user = {
        ...proposed,
        credentials: undefined,
        id: "owned-saved-user",
        createdTimestamp: Date.now(),
      };
      if (options.loseCreationReply) request.socket.destroy();
      else {
        response.writeHead(201, {
          location: "http://localhost/users/owned-saved-user",
        });
        response.end();
      }
    } else if (
      route.startsWith("/users/") &&
      route.endsWith("/reset-password")
    ) {
      resets++;
      send({}, 204);
    } else if (route === "/users/" + user?.id) send(user);
    else send({}, 404);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const baseURL = `http://127.0.0.1:${address.port}/auth`;
  async function run(extra: string[] = []) {
    return await new Promise<{ code: number; output: string }>((resolve) => {
      const child = spawn(process.env.NODE_BINARY || "node", [
        script,
        "--email",
        email,
        "--name",
        "Chosen Person",
        "--output",
        receiptFile,
        "--secrets",
        secretFile,
        "--base-url",
        baseURL,
        ...extra,
      ]);
      let output = "";
      child.stdout.on("data", (chunk) => (output += chunk));
      child.stderr.on("data", (chunk) => (output += chunk));
      child.on("close", (code) => {
        assert.ok(!output.includes(adminSecret));
        if (originalPassword) assert.ok(!output.includes(originalPassword));
        resolve({ code: code ?? -1, output });
      });
    });
  }
  return {
    run,
    receiptFile,
    creates: () => creates,
    resets: () => resets,
    user: () => user,
    removeSavedUser: () => {
      user = null;
    },
    redirectedRequests: () => redirectedRequests,
    async close() {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      await new Promise<void>((resolve, reject) =>
        redirectServer.close((error) => (error ? reject(error) : resolve())),
      );
      fs.rmSync(directory, { recursive: true });
    },
  };
}

test("administration refuses Bun before file or network operations", async () => {
  assert.ok(process.versions.bun, "Project verification uses pinned Bun1.3.6");
  const result = await new Promise<{ code: number; output: string }>(
    (resolve) => {
      const child = spawn(process.execPath, [script]);
      let output = "";
      child.stdout.on("data", (chunk) => (output += chunk));
      child.stderr.on("data", (chunk) => (output += chunk));
      child.on("close", (code) => resolve({ code: code ?? -1, output }));
    },
  );
  assert.equal(result.code, 1);
  assert.match(result.output, /Run this administrative CLI with Node22/);
});

if (process.platform === "win32") {
  test("office administrator CLI explicitly refuses Windows before accessing files or network", async () => {
    const result = await new Promise<{ code: number; output: string }>(
      (resolve) => {
        const child = spawn(process.env.NODE_BINARY || "node", [script]);
        let output = "";
        child.stdout.on("data", (chunk) => (output += chunk));
        child.stderr.on("data", (chunk) => (output += chunk));
        child.on("close", (code) => resolve({ code: code ?? -1, output }));
      },
    );
    assert.equal(result.code, 1);
    assert.match(result.output, /requires POSIX ownership/);
  });
} else {
  test("exact creation and receipt replay preserve credentials and never reset a used account", async () => {
    const f = await fixture();
    try {
      assert.equal((await f.run()).code, 0);
      const original = JSON.parse(fs.readFileSync(f.receiptFile, "utf8"));
      assert.equal(original.subject, "owned-saved-user");
      assert.equal(fs.statSync(f.receiptFile).mode & 0o777, 0o600);
      f.user()!.requiredActions = []; // The person has completed their first sign-in.
      assert.equal((await f.run()).code, 0);
      assert.equal(
        JSON.parse(fs.readFileSync(f.receiptFile, "utf8")).temporaryPassword,
        original.temporaryPassword,
      );
      assert.equal(f.creates(), 1);
      assert.equal(f.resets(), 0);
      assert.deepEqual(f.user()!.requiredActions, []);
    } finally {
      await f.close();
    }
  });

  test("an unrelated exact-email account is refused without password or account writes", async () => {
    const f = await fixture({ existing: true });
    try {
      const result = await f.run();
      assert.equal(result.code, 1);
      assert.match(result.output, /already exists/);
      assert.equal(f.creates(), 0);
      assert.equal(f.resets(), 0);
      assert.equal(f.user()!.id, "unrelated-existing");
    } finally {
      await f.close();
    }
  });

  for (const [label, options] of [
    ["user-editable email", { editableEmail: true }],
    ["missing official basic scope", { basic: false }],
    ["missing stable subject mapper", { subjectMapper: false }],
    ["non-S256 browser client", { pkce: "plain" }],
  ] as const)
    test(`refuses ${label} before provisioning`, async () => {
      const f = await fixture(options);
      try {
        assert.equal((await f.run()).code, 1);
        assert.equal(f.creates(), 0);
        assert.equal(f.resets(), 0);
      } finally {
        await f.close();
      }
    });

  test("lost creation confirmation keeps the original receipt and needs explicit exact-ID recovery", async () => {
    const f = await fixture({ loseCreationReply: true });
    try {
      assert.equal((await f.run()).code, 1);
      const prepared = JSON.parse(fs.readFileSync(f.receiptFile, "utf8"));
      assert.equal(prepared.status, "creation-pending");
      assert.equal((await f.run()).code, 1);
      assert.equal(f.creates(), 1);
      assert.equal((await f.run(["--recover-subject", "unrelated"])).code, 1);
      assert.equal(
        (await f.run(["--recover-subject", "owned-saved-user"])).code,
        0,
      );
      const recovered = JSON.parse(fs.readFileSync(f.receiptFile, "utf8"));
      assert.equal(recovered.temporaryPassword, prepared.temporaryPassword);
      assert.equal(recovered.requestId, prepared.requestId);
      assert.equal(f.creates(), 1);
      assert.equal(f.resets(), 0);
    } finally {
      await f.close();
    }
  });

  for (const destination of ["token", "admin"] as const)
    test(`refuses307 ${destination} redirects without sending credentials to a second listener`, async () => {
      const f = await fixture({ redirect: destination });
      try {
        const result = await f.run();
        assert.equal(result.code, 1);
        assert.equal(f.redirectedRequests(), 0);
        assert.equal(f.creates(), 0);
        assert.equal(f.resets(), 0);
      } finally {
        await f.close();
      }
    });
  test("confirmed identity deletion cannot resurrect an account through receipt replay", async () => {
    const f = await fixture();
    try {
      assert.equal((await f.run()).code, 0);
      f.removeSavedUser();
      const result = await f.run();
      assert.equal(result.code, 1);
      assert.match(result.output, /No account recreated/);
      assert.equal(f.creates(), 1);
      assert.equal(f.resets(), 0);
    } finally {
      await f.close();
    }
  });
  test("an ambiguous attempted creation cannot be silently retried after the saved identity disappears", async () => {
    const f = await fixture({ loseCreationReply: true });
    try {
      assert.equal((await f.run()).code, 1);
      f.removeSavedUser();
      const result = await f.run();
      assert.equal(result.code, 1);
      assert.match(result.output, /No account recreated/);
      assert.equal(f.creates(), 1);
      assert.equal(f.resets(), 0);
    } finally {
      await f.close();
    }
  });
}
