# Lawn interface direction

Jacob requested Atrium’s style with fewer steps, while keeping Lawn standalone.
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

| Comparison | Result and intentional differences |
| --- | --- |
| Palette | Atrium navy page/panels and amber action; green reserved for approval. Light mode retains readable surfaces and controls. |
| Typography | Locally loaded Geist; measured primary action 14px/500, 12px radius. Monospace is limited to existing technical/time displays. |
| Navigation | Desktop rail becomes horizontal on phones. Two live destinations; Content teams remains secondary dialog setup. |
| Workload layout | Compact rows replace cards, with real client/count/team/due/approved values. Selecting a row scopes the delivery slots. |
| Deliverables | Rows keep owner/stage/due and existing details/actions. Phone layout stacks without sideways scrolling. |
| Controls/dialogs | Thin borders, rounded controls, visible focus, no offset shadows or moving input fields. Intake fits 390px. |
| Copy | Content tracker, Assign client workload, Assignments, Ready to use, Workload overview and Deliverables match the inventory. No generated greeting or fake user footer. Actual client/owner labels replace illustration data. |

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
