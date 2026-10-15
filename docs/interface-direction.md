# Atrium interface direction (Lawn foundation)

Jacob requested Atrium’s name and style with fewer steps, using Lawn as a standalone foundation.
Use Atrium’s checked web design tokens and the generated concept at
`outputs/lawn-style-concept-v1.png` in the parent workspace as visual references.
The image is a concept, not application evidence.

## Implementation inventory

- Deep navy page, slightly lighter panels, thin muted borders, amber primary action.
  Geist sans-serif, locally served with its OFL license. No remote font wait on the
  working tracker. Preserve the explicit light-theme preference and theme toggle.
- Desktop navigation rail: Assignments and Ready to use. On narrow screens these
  become horizontal navigation. Content teams is secondary setup beside workload
  intake, rather than a third destination that would duplicate its dialog.
- Content tracker title and one-line workflow description. No time greeting,
  synthetic user footer, analytics, invented totals or decorative badges.
- One search/client/status/My work toolbar. Client workload scope appears when
  useful. Workload overview uses rows, then a deliverable list with owner, stage
  and due date. Rows open existing details; no new approval authority.
- Rounded 12px controls and 20px panels, no offset shadows or moving buttons.
  Lucide outline icons at 16–20px. Visible keyboard focus, disabled/pending states,
  wrapped long names and responsive stacking. Video content remains unmodified.
- Existing dialogs, upload progress, comments and review controls inherit the
  palette. Forms keep actual labels, errors and confirmation/draft guards.

## Fidelity and intentional deviations

The generated concept incorrectly included a time greeting and synthetic identity;
neither belongs in the product. Real saved rows and counts replace illustrative
concept data. Setup stays a secondary action, not an inert navigation destination.
The live preview’s role chooser remains explicitly labeled local synthetic data;
it is test scaffolding, not real sign-in or product chrome.

Before handoff compare actual desktop and 390px renders against the concept for
palette, typography, navigation, row layout, control spacing, copy and dialogs.
Record any remaining differences and the actual workflow evidence here.

## Verified fidelity ledger — October 15

Fresh built tracker components were inspected at the concept dimensions
(1505×1045), at 390×844 and in explicit light mode. An isolated headless browser
preserved Jacob’s active preview. Both the concept and current renders were opened
as images, rather than accepting DOM assertions alone.

| Comparison       | Result and intentional differences                                                                                                                                                                                           |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Palette          | Atrium navy page/panels and amber action; green reserved for approval. Light mode retains readable surfaces and controls.                                                                                                    |
| Typography       | Locally loaded Geist; measured primary action 14px/500, 12px radius. Monospace is limited to existing technical/time displays.                                                                                               |
| Navigation       | Desktop rail becomes horizontal on phones. Two live destinations; Content teams remains secondary dialog setup.                                                                                                              |
| Workload layout  | Compact rows replace cards, with real client/count/team/due/approved values. Selecting a row scopes the delivery slots.                                                                                                      |
| Deliverables     | Rows keep owner/stage/due and existing details/actions. Phone layout stacks without sideways scrolling.                                                                                                                      |
| Controls/dialogs | Thin borders, rounded controls, visible focus, no offset shadows or moving input fields. Intake fits 390px.                                                                                                                  |
| Copy             | Content tracker, Assign client workload, Assignments, Ready to use, Workload overview and Deliverables match the inventory. No generated greeting or fake user footer. Actual client/owner labels replace illustration data. |

The initial extra All client workloads selector duplicated the overview; it now
appears only inside an active workload scope. Dates remain exact stored calendar
strings rather than the concept’s illustrative dates. The working preview retains
its conspicuous synthetic-data header. No material unrecorded fidelity mismatch
remains on the inspected tracker/intake/library states. This is not a claim that
every upstream marketing/settings/review screen has been redesigned.

Actual built component acceptance completes two pairs/two clients/five generated
slots, lost confirmation plus refresh/exact replay, director planning, denied
foreign/producer planning, browser upload, decoded playback, saved comment,
director approval and exact-byte CMO original download. Real local records and
loopback media remain distinct from Clerk/live S3/Mux. A separate built UI check
verifies filters, genuine scoped empty, local font loading, dialogs, light mode and
zero page errors. Early private alternate-origin test adapters failed local CORS
or Chromium local-network checks; final acceptance serves compiled files from the
existing allowed local origin without changing product gates or provider policy.

## Raw-library extension

The new member-only Raw assets destination uses the same navy/amber controls and
compact source rows. Mobile navigation wraps instead of clipping the third tab.
Filename/client/type filters lead directly to original preview/download and
optional source attachment; no nested management dashboard, decorative counts or
second approval state. Photo/video/audio previews use real originals in one dialog.
CMOs start in Ready to use. Raw list, decoded photo, missing-source recovery and
approved-download recovery were inspected at1440/390 alongside the existing style.
The original two-destination concept predates the user’s explicit raw-library scope;
this third live destination is an intentional functional extension.

## Atrium identity and second design pass

The earlier fidelity ledger describes an initial implementation, not Jacob's
acceptance. On October15 he requested the Atrium name and a closer match to the
actual interface, plus expected file-drop behavior. The current concept is the
parent outputs/atrium-content-shell-concept-v2.png, generated with the built-in
image tool using the actual Atrium Work screenshot and the current library as
references. Its prompt is preserved in the chat's image-generation call.

Inventory: actual existing teal Atrium logo, Geist, navy/amber tokens, inset rounded
sidebar and main workspace, compact headers, one responsive filter group, client
workload rows and deliverable rows. Only Assignments, Ready to use and Raw assets
belong in navigation. Reuse identity assets only; no old Atrium services were copied.
Real saved clients/owners/dates replace the concept's invented people-as-clients
and 2025 dates. No inert View all action or decorative client avatars were added.
The existing workspace breadcrumb/auth utility header remains; the local preview
has an extra conspicuous synthetic-role strip, which is not production chrome.

The legacy public sales pages are superseded by entry into the authenticated
workspace. Their old URLs remain resolvable; they no longer advertise subscriptions,
trials or Frame.io comparisons as the agency's product. Server billing contracts,
MIT attribution and OFL are unchanged. Theme and pending-request storage keys retain
their original names to preserve existing choices and confirmation recovery.

File drop is functional: one edit on an assignment row or open detail routes to
that slot and automatically enters production/review. A source drop in Raw assets
uses its selected client. Invalid/unauthorized drops create no videos; local targets
cannot also dispatch the global uploader. Source preview offers Back to assignment
and restores the same selection/filter. Check the actual built workflow and desktop,
phone and light theme before treating this pass as accepted. Real Clerk rendering
and native OS drag/drop remain separate from synthetic browser acceptance.
