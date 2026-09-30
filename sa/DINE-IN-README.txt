AXZEN POS 3.79 - OFFLINE DINE IN AND TAX SETTINGS

Open dine-in-preview.html to try the interactive sample on a PC, tablet or phone.
The preview uses sample data only. Reloading resets orders and payments.
Open index.html for the actual POS with your existing backend and login.

Desktop: tables, food catalog and bill alongside each other.
Tablet landscape: compact table strip, food catalog and bill.
Phone: table grid, then Add food / Current bill / Kitchen tickets tabs.

Includes dish search, category filters, add and quantity controls, kitchen notes,
ticket progress, payments and existing printer integration in the real POS.
Existing backend permissions, server prices and order recovery remain in place.
Transfer / merge tables are not supported by the current backend.

Deploy the matching backend/server.js, backend/dine-in.js and sa/bill-taxes.js
before installing this release. The API must report offlineVersion: 1 on GET
/dine-in. Deploy the updated admin-web and sa assets together.

Connect and log in once to download restaurant tables, menu and tax settings.
Then orders, per-table drafts, kitchen status changes and payments are saved on
the same device without internet. Sync runs automatically after reconnecting.
Keep app storage intact until all changes are synced; uninstalling or clearing
browser/app data erases unsynced work. Other devices receive changes after sync.
Conflicting table edits or changed prices/taxes are retained for manager review,
never silently overwritten or repriced. Kitchen printers still need local
Bluetooth/printer connectivity even while internet is disconnected.

Current Order stays at the bottom on phones; tap its heading to expand items and
kitchen notes. Search and categories stay fixed while dishes scroll. Use the X
on a selected food card or order line to remove it. Each table retains its draft.

Admin Settings now contains Table settings and Tax settings. Enable only the
applicable tax system, then set percentages. GST OR CGST+SGST OR IGST OR VAT;
these alternatives cannot be combined. Cess and optional service charge have
separate controls. All default OFF. This is bill-level exclusive-tax pricing;
mixed GST/VAT item tax groups and inclusive-price extraction are not supported.
Configure rates appropriate to the restaurant, not every option simultaneously.

Enabled taxes and their percentages print below Discount and are included in the
final total. GSTIN, address, cashier, payment, token, table and thank-you text have
print checkboxes. Historical bills retain the tax/print snapshot used at sale.
Native Android alerts use a light theme with dark readable text.

Browser offline reload needs HTTPS (or localhost) and one successful service
worker installation. The Android APK already bundles the app shell.

The sample photographs are illustrative Unsplash images, not exact photographs
from the supplied mockups. Real POS food cards use your existing catalog images.
Missing catalog images show a neutral dish placeholder.
Photo sources: images.unsplash.com
photo-1512621776951-a57141f2eefd
photo-1565557623262-b51c2513a641
photo-1512058564366-18510be2db19
photo-1563379091339-03b21ab4a4f8
photo-1601050690597-df0568f70950
photo-1544145945-f90425340c7e
