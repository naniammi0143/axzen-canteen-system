# Axzen Infotech Canteen

Admin panel, mobile POS, MongoDB Atlas storage, offline mobile order sync, and Meta WhatsApp Cloud API reports.

## Environment

Create `backend/.env` locally. In Vercel, add the same keys under Project Settings -> Environment Variables.

```env
MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@CLUSTER.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB_NAME=axzen_canteen
JWT_SECRET=change_this_to_a_long_random_secret
WHATSAPP_TOKEN=your_meta_whatsapp_cloud_api_token
WHATSAPP_PHONE_NUMBER_ID=your_meta_phone_number_id
WHATSAPP_API_VERSION=v25.0
```

The backend uses `MONGODB_DB_NAME`; keep it as `axzen_canteen` for new deployments, or set the exact existing Atlas database name if it already exists with different casing. Do not commit `.env`.

## MongoDB Collections

The app uses these Atlas collections:

- `users`
- `menu_items`
- `orders`
- `sales`
- `stock_items`
- `expenses`
- `report_settings`
- `whatsapp_logs`

Default admin login is seeded only when `users` is empty:

```text
mobile: admin
password: 1234
```

## Local Run

### Catalog import and Dine In preview

In POS: Add Item → Upload catalog. CSV columns: `name,price,category,unit` (up to 100 items / 5 MB). For Grok PDF/JPG/PNG extraction, set `CATALOG_AI_PROVIDER=grok` and `XAI_API_KEY` in `backend/.env` (default model `grok-4.7`). Alternatively use `CATALOG_AI_PROVIDER=openai` and `OPENAI_API_KEY` (default `gpt-4.1-mini`, also supports WebP). `CATALOG_AI_MODEL` overrides the selected provider model. No AI key is included. Grok PDF uploads are deleted after extraction, with a one-hour expiration as fallback. Keys remain on the backend. Files are sent for extraction with `store: false`. AI extraction needs human review, especially unclear prices. Image suggestions use Wikimedia Commons with license/source credits; choose another suggestion, paste an image URL, or leave the image empty.

Uploaded names are normalized and matched against the existing catalog before image lookup. Matching catalog images are reused. Already-added menu items start unchecked; unmatched names are marked New item. Nothing is added during extraction. Edit/remove items, check the review box, then Proceed. Existing active names are skipped. On a partial failure, added rows remain marked and can be excluded from a retry. Imported items can also be edited in the usual Add/Edit Item screen.

The local preview server exposes `/__workflow-preview`: an isolated sample restaurant with table/order/bill/settings dialogs and CSV import. It does not create live bills or payments; image search and AI extraction are available through the real POS backend. A sample CSV is at `scripts/sample-catalog.csv`.

For a backend preview without scheduled WhatsApp reports, set `DISABLE_REPORT_SCHEDULER=1` before starting the backend. This does not disable manually requested reports.

### APK-free mobile and tablet preview

From the project root, run `npm.cmd run preview:all` on Windows (or `npm run preview:all` elsewhere).

- App with live reload: `http://localhost:4173/`
- Phone/tablet screen selector and rotation: `http://localhost:4173/__devices`
- Phone or tablet on the same Wi-Fi: use the local-network URL printed by the preview server.

The preview serves the same `sa/` source used by the Android app. Tablets use the compact mobile layout in portrait and show Current Order beside the menu only in landscape; phones use the compact layout. The screen selector changes the app viewport without rebuilding an APK. Native Bluetooth printing and Android permissions still need device testing. The backend uses the database configured in `backend/.env`, so preview data changes affect that database.

Run existing regression tests with `npm.cmd test`. No APK build, Android sync, or Git push is needed for preview.

```bash
cd backend
npm install
npm start
```

Open:

- Admin: `http://localhost:5000/admin/`
- Mobile POS: `http://localhost:5000/mobile/`
- Marketing / Super Admin: `http://localhost:5000/marketing/`
- Health check: `http://localhost:5000/health`

Marketing console demo logins:

```text
Super Admin: SUPER / admin123
Marketing Employee: MKT001 / 1234
```

For phone testing on the same Wi-Fi, open `http://192.168.29.115:5000/mobile/` or build the Android app after `npm run android:sync`.

## WhatsApp Reports

Open Admin -> WhatsApp Reports.

The admin can set:

- report time in India time, for example `22:00`
- admin WhatsApp number with country code, for example `919999999999`
- auto report ON/OFF
- report type: daily, weekly, or monthly

The local backend scheduler checks every minute using `Asia/Kolkata`. Vercel uses the cron route `/api/cron/whatsapp`, also checked every minute by `vercel.json`. If auto report is OFF, no scheduled report is sent. If the report time changes, the next scheduler check reads the updated `report_settings` document.

Manual test:

```text
POST /whatsapp/send-test-report
GET /whatsapp/logs
```

## Vercel Deployment

1. Push this project to GitHub.
2. Import the GitHub repo into Vercel.
3. Add the environment variables listed above.
4. Deploy.
5. Open the deployed URL. `/admin/`, `/mobile/`, and API routes are served by `api/index.js`.
6. Confirm the Vercel cron path `/api/cron/whatsapp` is enabled in the Vercel dashboard.

## Test Checklist

1. Admin login: login with `admin / 1234`, then create a cashier user.
2. Menu: add a menu item in Admin -> Menu Management and confirm it appears in Mobile POS.
3. POS sale: login as cashier, select items, choose Cash or Online, and place order.
4. MongoDB save: check Atlas collections `orders` and `sales`; the sale should appear in admin dashboard.
5. Stock/finance: add stock and expenses in admin, then check dashboard totals and low stock.
6. Offline mobile: login once online, disconnect internet, login again with cached credentials, place order, reconnect, and wait for sync.
7. WhatsApp: set admin WhatsApp number, keep Meta env vars valid, click `Send Test WhatsApp Report`, then check `whatsapp_logs`.

Receipt settings: Admin Settings or Printer Settings ? Receipt second line / Area. The preview and bill use this line below the restaurant name. The footer is Powered by / Axzen POS System. Android tear-off feed was reduced from six lines to two; this native change requires a future APK build and physical printer verification.

Grok API references: https://docs.x.ai/developers/model-capabilities/files/chat-with-files and https://docs.x.ai/developers/model-capabilities/text/structured-outputs .
