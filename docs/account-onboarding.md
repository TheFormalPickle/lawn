# Closed-beta account onboarding

The current beta has separate sign-in identities and Atrium workspace memberships.
An app invitation alone cannot create a Keycloak account. The six teammates chosen
by Jacob have already been provisioned; do not create replacement identities or
reset their passwords to resend an app invitation. Their first sign-in requires a
password change by the person. Existing membership roles remain authoritative.

## Current administrator-assisted process

1. For a new person only, confirm their exact email and intended workspace role.
2. Use the restricted administrative CLI below on the trusted host. It creates a
   temporary credential in an owner-only file, not an application response.
3. Deliver that person's initial details privately. They sign in normally and
   choose their own password. Never automate their password change.
4. Share the app's exact-email invitation link. Accepting it grants the recorded
   workspace role; creating the identity alone grants no workspace membership.

This is a manual beta limitation. There is no SMTP delivery or self-service reset
mail configured, and the app does not yet perform automatic identity provisioning.
No email is sent by the CLI. Do not promise that copying only the app link completes
first-time onboarding.

## Restricted administrative CLI

Use Node22 on the trusted Linux office host or another POSIX administrative machine.
The CLI deliberately refuses Bun and Windows, where these POSIX ownership/mode
checks cannot establish the required private-file boundary. This is not a web endpoint, a
Convex action or a browser script. Supply the existing local administrative secret
file; never put a password in a command argument, Git, an app result or an app log.

```sh
install -d -m 700 /private/path/new-person
node deploy/provision-user.mjs \
  --email chosen-person@example.invalid \
  --name 'Chosen Person' \
  --output /private/path/new-person/initial.json \
  --secrets /private/path/keycloak-admin.env \
  --base-url http://127.0.0.1:5280/auth \
  --admin-user atrium-beta-admin
```

Replace the example identity and private paths deliberately. The secret file needs
`KEYCLOAK_ADMIN_PASSWORD` and mode0600. Its owning user must also own the receipt
file and its mode0700 directory. The default admin endpoint is exact loopback5280;
non-loopback endpoints require HTTPS without embedded credentials. All token and
admin HTTP requests reject redirects, including307 responses, so neither an admin
password nor bearer token is forwarded to another endpoint. The realm is
fixed to `atrium`, and no public administrative route is needed.

Before provisioning, the CLI verifies closed registration, unique email addresses,
immutable usernames, administrator-only email editing, public authorization-code
flow with S256, disabled direct/implicit grants, and the official `basic` scope's
stable subject mapper. The prepared receipt and initial credential remain local
mode0600. Only the normal Keycloak credential store receives the temporary password;
no Convex mutation, action result or database carries it.

Receipt creation and updates use same-directory atomic operations and file/directory
fsync. A durable creation-pending state is written before the first potentially
committing request. This is not a power-loss rehearsal. Keep the same receipt for retries. Confirmed replay rechecks the exact saved user
and never resets their password or re-adds a completed required action. An unrelated
existing account is rejected. If creation committed but its reply was lost, preserve
the original receipt and inspect the exact saved identity before using
`--recover-subject EXACT_SAVED_UUID`. Recovery requires the matching email, a creation
time after that original receipt and an outstanding first-password action. It does
not create another account or set another password. If a confirmed identity was
deleted, or an attempted creation is unavailable, replay fails closed and cannot
resurrect it. A genuinely failed precommit attempt in creation-pending also needs
supervised review; it is not silently retried with new credentials. Never delete a pending receipt
just to retry with a new credential. Remove privately handed-off initial details
when the person has completed onboarding and the credential is no longer needed.

## Recommended next step: standard emailed setup actions

The standard Keycloak mechanism is an administrator-triggered required-actions
email for the exact existing user, with `UPDATE_PASSWORD`, a short lifespan, the
`atrium-web` client and an allowlisted return URI. It needs a working SMTP sender.
The [official REST API](https://www.keycloak.org/docs-api/latest/rest-api/index.html#_users)
returns204; it does not return a setup link to the caller. The
[deployed26.8.0 implementation](https://github.com/keycloak/keycloak/blob/26.8.0/services/src/main/java/org/keycloak/services/resources/admin/UserResource.java)
builds a signed action token, passes its link to the email provider, and returns no
content. Configuring a trusted sender and exercising delivery, expiry and replay
would remove manual password transfer without changing the user's password in Atrium.
This document neither configures SMTP nor claims delivery, and no email was sent by
this work. Leave existing accounts and passwords unchanged while preparing it.

The setup link is a bearer credential. Deliver it only to the intended person;
use short expiry, preserve exact user/email/client/redirect binding, suppress it
from analytics and logs, and test consumption/replay against the deployed version.
The existing app invitation still decides workspace membership. An action token
must not be treated as an API access token or as permission to bypass that check.
Do not add `VERIFY_EMAIL` to a privately copied link and claim inbox ownership was
proved: Keycloak's handler treats completion of that action as email verification.

## No standard copied-link shortcut without SMTP

The deployed Keycloak26.8.0 admin REST does not expose a standalone action-token
link generator. Application-initiated required actions happen after authentication;
they cannot bootstrap a person who has no credential. Organizations invitations
also send email. Although the generated invitation representation lists an
`inviteLink` field, the deployed version's GET projection does not populate it;
it is not a supported copied-link workaround.

A no-SMTP setup link would require a maintained Keycloak extension or private
email-delivery adapter. That adds a security boundary and must be reviewed and
verified as such, including invitation revocation, single use, exact identity,
expiry, duplicate/lost confirmation, log suppression and owner authorization.
Do not export realm signing keys, enable public registration, expose administration,
or return temporary passwords through Convex to simulate this feature. No such
extension or adapter is implemented here.

## Verification scope

The CLI regression tests run an owned loopback administration fixture under Node22.
They cover exact creation, private receipts, replay after a completed first action,
refusal of unrelated existing accounts, profile/PKCE/basic-scope guards and explicit
recovery after a committed creation loses its response, refusal of307 redirects to
a second owned listener, and deletion/no-resurrection. Windows verification checks
the explicit unsupported-platform boundary rather than pretending to exercise the
POSIX administration path; no Windows administrator deployment is claimed. They prove administrative
request and recovery behavior, not real SMTP delivery or a new Keycloak login flow.

The candidate also passed actual Keycloak26.8.0 create/replay/delete/replay checks
under Node22.23.3. Its exact subject and credential metadata stayed stable; replay
did not recreate the deleted identity. The one disposable identity and private
credential receipt were removed. No human password change, workspace membership
or email delivery was exercised by that administrative check.
