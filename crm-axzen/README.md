# Axzen CRM

Two workspaces, one product:

- **Axzen Infotech** (main company): sell POS to many shops, manage company leads, run ads, and reply to customer messages from the same inbox.
- **POS client** (`pos.axzen.in` shop): that shop’s own customers, leads, follow-ups, tickets, and message replies.

## Open

```bash
npm start
```

Open `http://localhost:5174`.

## Logins

Infotech (platform):

- Company: `Axzen Infotech`
- Username: `axzenadmin`
- Phone: `8790568446`
- Password: `Axzen@123`

A POS client account is created from Infotech → Companies. That shop then logs in as **POS client**.

## Real workflow

### Infotech

1. Add a company lead (hotel / canteen / chicken shop).
2. Move it through New → Demo → Proposal → Won.
3. Create a POS client workspace (login for that shop).
4. Run Meta / WhatsApp campaigns.
5. Inbox shows messages from Infotech leads **and** client-shop customers; reply in the same thread (WhatsApp send if connected).

### POS client

1. Capture walk-in / WhatsApp / ad leads.
2. Convert lead → customer.
3. Follow-up tasks.
4. Raise / close support tickets.
5. Reply to that shop’s customer messages in Inbox.

Data stays isolated by `tenantId`. Infotech inbox can see client conversations so Axzen can support shops’ customers.
