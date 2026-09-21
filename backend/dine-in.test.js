const test = require("node:test");
const assert = require("node:assert/strict");
const { registerDineIn, priceItems, totals } = require("./dine-in");
const clone = value => value == null ? value : structuredClone(value);
const menu = [{ id: 1, name: "Meals", price: 100 }, { id: 2, name: "Tea", price: 12.5 }];

// Dependency-isolated route tests. No production database, credentials or orders.
function fixture() {
  const routes = {}, models = {}, ledger = new Map();
  let sequence = 0, failSave = false;
  class Schema { index() {} }
  Schema.Types = { Mixed: Object };
  const matches = (r, q) => Object.entries(q).every(([k, v]) => v?.$in ? v.$in.includes(r[k]) : r[k] === v);
  function query(value) { return { lean: async () => clone(value), sort() { return this; }, then(fn, reject) { return Promise.resolve(clone(value)).then(fn, reject); } }; }
  function model(name) {
    const rows = [];
    return models[name] = {
      rows,
      findById: key => query(rows.find(r => r._id === key)),
      findOne: q => query(rows.find(r => matches(r, q))),
      find: q => query(rows.filter(r => matches(r, q))),
      exists: async q => !!rows.find(r => matches(r, q)),
      countDocuments: async q => rows.filter(r => matches(r, q)).length,
      create: async value => {
        if (name === "DineTable" && rows.some(r => r.canteenId === value.canteenId && r.name === value.name)) throw Object.assign(new Error(), { code: 11000 });
        const row = { _id: String(++sequence), revision: 0, status: "available", active: true, ...clone(value) }; rows.push(row); return clone(row);
      },
      updateOne: async (q, ops, options = {}) => {
        let row = rows.find(r => matches(r, q));
        if (!row && options.upsert) { row = { ...clone(q), ...clone(ops.$setOnInsert) }; rows.push(row); }
        if (row) Object.assign(row, clone(ops.$set));
      },
      findOneAndUpdate: (q, ops) => {
        const row = rows.find(r => matches(r, q));
        if (row) { Object.assign(row, clone(ops.$set)); row.revision += ops.$inc?.revision || 0; }
        return query(row || null);
      }
    };
  }
  const next = (req, res, done) => done();
  const admin = (req, res, done) => req.authUser.role === "admin" ? done() : res.status(403).json({ message: "Admin only" });
  const manager = (req, res, done) => ["manager", "super_admin"].includes(req.marketingUser.role) ? done() : res.status(403).json({ message: "Manager only" });
  const mongoose = { Schema, models, model };
  const MarketingCanteen = model("MarketingCanteen");
  MarketingCanteen.rows.push({ id: 1, activatedCanteenId: "A" });
  const service = registerDineIn({ app: { get: (p, ...f) => routes[`GET ${p}`] = f, post: (p, ...f) => routes[`POST ${p}`] = f }, mongoose,
    requireDatabase: next, requireCanteenAuth: next, requireAdmin: admin, requireSuperAdmin: manager, MarketingCanteen,
    allMenuItems: async () => menu, getSettings: async () => ({ canteenName: "Test Restaurant" }), saveOrder: async bill => { if (failSave) throw new Error("Simulated database outage"); if (!ledger.has(bill.clientOrderId)) ledger.set(bill.clientOrderId, clone(bill)); return clone(ledger.get(bill.clientOrderId)); }
  });
  async function call(method, path, body = {}, { tenant = "A", role = "admin", params = {} } = {}) {
    const req = { body, params, authUser: { canteenId: tenant, name: "Test", role }, marketingUser: { role, employeeId: "TEST" } };
    let status = 200, data;
    const res = { status(n) { status = n; return this; }, json(v) { data = clone(v); return this; } };
    const fns = routes[`${method} ${path}`]; assert.ok(fns, path);
    let index = 0; const run = () => fns[index++]?.(req, res, run); await run();
    return { status, data };
  }
  return { call, models, ledger, service, outage: v => failSave = v };
}
test("onboarding approval uses the same audited entitlement and open-table protection", async () => {
  const f = fixture();
  await f.service.setApproval('A', true, 'MANAGER');
  assert.equal((await f.call('GET', '/dine-in')).data.enabled, true);
  assert.equal(f.models.DineApprovalAudit.rows[0].actor, 'MANAGER');
  await assert.rejects(f.service.setApproval('A', 'true', 'MANAGER'));
  f.models.DineTable.rows.push({ canteenId: 'A', status: 'occupied' });
  await assert.rejects(f.service.setApproval('A', false, 'MANAGER'));
  assert.equal((await f.call('GET', '/dine-in')).data.enabled, true);
  f.models.DineTable.rows[0].status = 'available';
  await f.service.setApproval('A', false, 'MANAGER');
  assert.equal((await f.call('GET', '/dine-in')).data.enabled, false);
});
test("server menu price wins; hidden, invalid, fractional and weight items rejected", () => {
  assert.equal(priceItems([{ id: 1, qty: 2, price: 1 }], menu)[0].price, 100);
  for (const qty of [0, -1, 1.5, Infinity, "no"]) assert.throws(() => priceItems([{ id: 1, qty }], menu));
  assert.throws(() => priceItems([{ id: 3, qty: 1 }], menu));
  assert.throws(() => priceItems([{ id: 1, qty: 1 }], [{ ...menu[0], hidden: true }]));
  assert.throws(() => priceItems([{ id: 1, qty: 1 }], [{ ...menu[0], billingType: "weight" }]));
});
test("cancelled tickets excluded and discount bounded", () => {
  const tickets = [{ status: "served", items: [{ qty: 2, price: 12.5 }] }, { status: "cancelled", items: [{ qty: 9, price: 100 }] }];
  assert.equal(totals(tickets, 5).total, 20);
  assert.throws(() => totals(tickets, 26));
  assert.throws(() => totals(tickets, -1));
});
test("approval, table lifecycle, additional KOT, concurrency, tenant isolation and recoverable payment", async () => {
  const f = fixture(), call = f.call;
  assert.equal((await call("GET", "/dine-in")).data.enabled, false);
  assert.equal((await call("POST", "/dine-in/tables", { name: "1", seats: 4 })).status, 403);
  assert.equal((await call("POST", "/marketing-api/canteens/:id/dine-in", { enabled: true }, { role: "employee", params: { id: 1 } })).status, 403);
  assert.equal((await call("POST", "/marketing-api/canteens/:id/dine-in", { enabled: true }, { role: "manager", params: { id: 1 } })).status, 200);
  const created = await call("POST", "/dine-in/tables", { name: "1", seats: 4 });
  assert.equal(created.status, 200);
  const tableId = created.data.table.tableId, params = { tableId };
  assert.equal((await call("POST", "/dine-in/tables", { name: "1", seats: 4 })).status, 409);
  assert.equal((await call("POST", "/dine-in/tables", { name: "2", seats: 4 }, { role: "waiter" })).status, 403);
  const req = { requestId: "test-request-000001", revision: 0, items: [{ id: 1, qty: 2, price: 0 }] };
  const sent = await call("POST", "/dine-in/tables/:tableId/tickets", req, { params, role: "waiter" });
  assert.equal(sent.status, 200); assert.equal(sent.data.table.status, "occupied");
  assert.equal(sent.data.ticket.items[0].price, 100);
  const retry = await call("POST", "/dine-in/tables/:tableId/tickets", req, { params });
  assert.equal(retry.data.duplicate, true); assert.equal(retry.data.table.session.tickets.length, 1);
  assert.equal((await call("POST", "/dine-in/tables/:tableId/tickets", { ...req, requestId: "test-request-000002" }, { params })).status, 409);
  assert.equal((await call("GET", "/dine-in", {}, { tenant: "B" })).data.tables.length, 0);
  assert.equal((await call("POST", "/marketing-api/canteens/:id/dine-in", { enabled: false }, { role: "manager", params: { id: 1 } })).status, 409);
  const second = await call("POST", "/dine-in/tables/:tableId/tickets", { ...req, revision: 1, requestId: "test-request-000002", items: [{ id: 2, qty: 1 }] }, { params });
  assert.equal(second.data.table.session.tickets.length, 2);
  const kp = { ...params, ticketId: req.requestId };
  assert.equal((await call("POST", "/dine-in/tables/:tableId/tickets/:ticketId", { status: "served" }, { params: kp, role: "chef" })).status, 409);
  for (const status of ["preparing", "ready", "served"]) assert.equal((await call("POST", "/dine-in/tables/:tableId/tickets/:ticketId", { status }, { params: kp, role: "chef" })).status, 200);
  for (const status of ["preparing", "ready", "served"]) assert.equal((await call("POST", "/dine-in/tables/:tableId/tickets/:ticketId", { status }, { params: { ...params, ticketId: "test-request-000002" }, role: "chef" })).status, 200);
  let row = (await call("GET", "/dine-in")).data.tables[0];
  const payment = { revision: row.revision, sessionId: row.session.id, payment: "Split", cash: 100, discount: 0 };
  assert.equal((await call("POST", "/dine-in/tables/:tableId/settle", payment, { params, role: "waiter" })).status, 403);
  f.outage(true);
  assert.equal((await call("POST", "/dine-in/tables/:tableId/settle", payment, { params })).status, 500);
  row = (await call("GET", "/dine-in")).data.tables[0]; assert.equal(row.status, "closing");
  f.outage(false);
  const settled = await call("POST", "/dine-in/tables/:tableId/settle", payment, { params });
  assert.equal(settled.data.order.total, 212.5); assert.equal(settled.data.order.paymentBreakup.online, 112.5);
  assert.equal(settled.data.order.tableName, "1");
  assert.equal((await call("POST", "/dine-in/tables/:tableId/settle", payment, { params })).data.duplicate, true);
  assert.equal(f.ledger.size, 1);
  assert.equal((await call("POST", "/dine-in/tables/:tableId/state", { status: "available" }, { params })).status, 200);
});

test("simultaneous waiters cannot overwrite a ticket", async () => {
  const f = fixture();
  f.models.DineConfig.rows.push({ _id: "A", enabled: true });
  const t = (await f.call("POST", "/dine-in/tables", { name: "T1", seats: 4 })).data.table;
  const args = { params: { tableId: t.tableId }, role: "waiter" };
  const results = await Promise.all([1, 2].map(i => f.call("POST", "/dine-in/tables/:tableId/tickets", { revision: 0, requestId: `concurrent-req-0000${i}`, items: [{ id: 1, qty: 1 }] }, args)));
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
  assert.equal(f.models.DineTable.rows[0].session.tickets.length, 1);
});
