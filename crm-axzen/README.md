# Axzen CRM

Multi-tenant CRM prototype for Axzen customers.

## Open

Run `npm start` and open `http://localhost:5174`. The server connects to MongoDB and stores tenants, users, leads, contacts, deals, and tasks in CRM collections.

## Login Model

- Each customer/company is a tenant/workspace.
- A user signs in with username and phone number.
- Data is isolated by `tenantId`.
- Passwords are hashed with a per-user salt before storing.

## Backend-ready Data Shape

- `tenants`
- `users`
- `leads`
- `contacts`
- `deals`
- `tasks`
- `notes`

## Environment

The CRM server reads `MONGODB_URI` from `crm-axzen/.env` first, or from `../backend/.env` as a local convenience.

Optional:

```text
CRM_MONGODB_DB_NAME=axzen_crm
JWT_SECRET=change-this-secret
```
