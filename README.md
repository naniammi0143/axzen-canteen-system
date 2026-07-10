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
