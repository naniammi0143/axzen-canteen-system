# Axzen Dine In — implementation and test build

Base repository: naniammi0143/axzen-canteen-system, main commit d3920fd7dff254886675b8cbc0b0cdf7bd1d5700.
Updated 20 September 2026. Source updates do not deploy the running backend.

## Back, restaurant units and initial approval fixes

- Android Back closes popups, returns from a Dine In table with confirmation for unsent items, then returns to billing/categories. At the root it backgrounds the app without clearing the cart. Employee Back closes sheets and follows its navigation stack.
- Cooked restaurant dishes no longer become weight items just because their names contain Chicken/Mutton/Fish. Explicit kg units and meat-shop billing remain supported. Legacy restaurant weight flags with plate/missing units are normalized when menus are read.
- Registration includes Request Dine In. Approval review includes Approve Dine In, applied through the existing audited entitlement service. Existing access is loaded before reviewing an activated customer. Disabling with open tables is rejected.
- SWAD KITCHEN was inspected through authenticated live APIs: its settings were Canteen/canteen and cooked chicken dishes had missing unit/billing fields. No live menu edits or test orders were submitted.
- Eleven isolated backend/UI/regression tests pass. Restaurant Chicken Fried Rice categories keep the restaurant layout; cooked egg dishes do not use raw-egg piece billing. Physical-device navigation and printing still require device validation.

## Important before installation

These are newly built, debug-signed APKs, NOT production-signed updates:

- POS 3.66 / 366 — com.axzenhospitality.canteenclean
- Employee 1.15 / 115 — com.axenhospitality.employee

Their signing certificate differs from the repository's POS 3.53 release and Employee 1.13 debug APKs. Android will not install these over those existing apps. Test on a spare device/profile, or rebuild with the original authorized signing key for an in-place update. Do not uninstall a working app before syncing/backing up offline data. Original signing keys are not included or recovered.

Both apps retain the existing API host https://canteen.axzen.in. APK installation alone does NOT deploy the new backend. Old servers will return errors for the new endpoints until the server files below are deployed.

## Server update

Back up the running deployment and database first. Compare against your current source before replacing files if the server has newer edits.

Required changed/new runtime files:

1. backend/server.js
2. backend/dine-in.js
3. sa/index.html
4. sa/dine-in.js
5. sa/dine-in.css
6. admin-web/index.html
7. employee-web/index.html
8. marketing-web/index.html

Copy these paths into the existing project, preserving the directory structure. Restart the Node service using your existing service manager. Preserve the existing environment/database configuration; use a configured JWT_SECRET in production. No new backend npm dependency is required. Do not replace your .env or database.

Admin uses /mobile/dine-in.js and /mobile/dine-in.css from the same backend. Ensure these routes are served. Update employee-web/index.html wherever the employee web interface is hosted as well.

## Enable and use

1. Employee app: log in as Manager or Super Admin, open an activated customer's Details, choose Approve Dine In. Ordinary marketing employees cannot grant this paid entitlement.
2. POS without approval shows Upgrade Plan and a request button. A request is not automatic payment or activation; the manager reviews it in that customer's Details.
3. Restaurant admin: open Dine In in POS, or Dine In / Tables / Kitchen in the web admin. Add table name/number, area/floor and seats. Free tables can be renamed, disabled or re-enabled; occupied tables cannot be edited.
4. Select a table, choose dishes/portions, quantity, guest count and kitchen notes. Send order to kitchen. Additional rounds produce separate KOTs on the same table.
5. Kitchen tab shows saved tickets and table numbers. It refreshes every five seconds while the kitchen list is open. Mark New → Preparing → Ready → Served. Admin/manager ticket cancellation requires a reason.
6. For paper KOTs, pair and enable the Kitchen Printer in POS Settings. If printing fails, the ticket remains saved; use Reprint KOT. This uses the POS device's paired Bluetooth printer, not a remote network-print service.
7. After all tickets are served/cancelled, collect Cash/Online/Card/Split payment and confirm the bill. Online/Card records the selected payment mode; this feature does not itself charge a card or verify a bank payment. Admin discounts are validated on the server.
8. The table becomes Cleaning; mark it available after cleaning. Fully cancelled sessions can be closed by the admin and remain archived.
9. Dine In → Table reports shows saved bills grouped by table, with bill rows and reprints. POS Reports includes a link to Dine In. Settled bills also enter the existing orders/sales reporting data.

## Storage and safeguards

- MongoDB DineConfig: per-restaurant entitlement/request state. DineApprovalAudit: approval decisions.
- DineTable: floor layout, reservation, active session, kitchen tickets and revision counter.
- DineVoidSession: archived fully cancelled sessions.
- orders + sales: final bill, table ID/name, session ID, kitchen ticket snapshot and payment breakdown.
- All table queries are tenant-scoped. Prices are loaded from the server menu, not trusted from the device.
- Revision checks reject concurrent stale edits. KOT request IDs deduplicate retries. Final settlement uses a persisted closing state and stable bill ID so a failed save can be retried.
- Dine In intentionally requires connectivity and MongoDB. It does not queue table orders offline, to avoid conflicting tables across counters. Unsent draft items are held in the current screen, not guaranteed across app restart.
- Ordinary quantity products and configured portions are supported. Weight-based counter products remain in the existing billing workflow.

## Verification performed

- Backend syntax and inline JS syntax checked; git diff whitespace check passed.
- Four dependency-isolated backend test cases cover server pricing, quantities, cancelled totals, role checks, tenant isolation, duplicate KOTs, kitchen states, concurrent order conflicts and failed-payment recovery.
- Two jsdom DOM interaction tests cover Upgrade Plan gating and table → portion → kitchen → served → settlement → report → cleaning.
- Both Android debug variants compiled successfully with JDK 21, Gradle 8.14.3 and Android SDK 36.
- APK package/version metadata, packaged source hashes and APK signatures checked.

Limitations: no live MongoDB/end-to-end server test, physical Android installation, actual payment collection or Bluetooth printer test was performed. Browser screenshot testing could not run because the browser download was unavailable. These are test builds, not a certification that the entire pre-existing application has no bugs.

Before rollout, test with two counters, a kitchen device and your actual printers on a staging restaurant. Verify approval/revocation, multiple rounds, simultaneous edits, lost network responses, cancellation, settlement retries and reports. Keep the production app until all data has been synced and the original-key release build is ready.

## Rebuild / tests

From project root:

```sh
npm ci
npx cap sync android
node --test backend/dine-in.test.js
# Install jsdom in a test environment, then:
node --test scripts/dine-in-ui.test.cjs
cd android
bash gradlew assemblePosDebug assembleEmployeeDebug
```

Set JAVA_HOME to JDK 21 and ANDROID_HOME to your Android SDK. Android build files now define distinct pos/employee flavors and package each web directory separately. Existing release-signing support is retained; use only your authorized original keystore for production updates. Generated debug keys are not suitable for distributing a production update.
