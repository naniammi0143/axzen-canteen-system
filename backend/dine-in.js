"use strict";
const crypto = require("node:crypto");
const fail = (message, status = 400) => { const error = new Error(message); error.status = status; throw error; };
const round = n => Math.round(n * 100) / 100;
function number(value, min, max, label) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) fail(`Invalid ${label}`);
  return n;
}
function text(value, max = 100) { return String(value || "").trim().slice(0, max); }
function priceItems(lines, menu) {
  if (!Array.isArray(lines) || !lines.length || lines.length > 100) fail("Choose 1–100 items");
  return lines.map(line => {
    const product = menu.find(p => String(p.id) === String(line.id) && p.hidden !== true);
    if (!product) fail("Item is no longer available. Refresh the menu.");
    if (product.billingType === "weight" || product.weightUnit) fail("Weight items must use counter billing");
    const qty = number(line.qty, 1, 999, "quantity");
    if (!Number.isInteger(qty)) fail("Quantity must be a whole number");
    const option = line.optionName ? (product.subItems || []).find(o => o.name === line.optionName) : null;
    if (line.optionName && !option) fail("Selected portion is no longer available");
    const price = number(option ? option.price : product.price, 0, 1000000, "menu price");
    return { id: product.id, name: product.name + (option ? ` (${option.name})` : ""), optionName: option?.name || "", nameTe: product.nameTe || "", price: round(price), qty, note: text(line.note, 200) };
  });
}
function totals(tickets, discount = 0) {
  const items = tickets.filter(t => t.status !== "cancelled").flatMap(t => t.items);
  const subtotal = round(items.reduce((sum, i) => sum + i.qty * i.price, 0));
  return { items, subtotal, discount: number(discount, 0, subtotal, "discount"), total: round(subtotal - Number(discount)) };
}
function registerDineIn({ app, mongoose, requireDatabase, requireCanteenAuth, requireAdmin, requireSuperAdmin, MarketingCanteen, allMenuItems, getSettings, saveOrder }) {
  const mixed = mongoose.Schema.Types.Mixed;
  const configSchema = new mongoose.Schema({ _id: String, enabled: { type: Boolean, default: false }, requested: Boolean, actor: String }, { timestamps: true });
  const tableSchema = new mongoose.Schema({
    canteenId: { type: String, required: true }, tableId: String, name: String, zone: String, seats: Number,
    active: { type: Boolean, default: true }, status: { type: String, default: "available" },
    revision: { type: Number, default: 0 }, session: mixed, lastBill: mixed, reservation: String
  }, { timestamps: true });
  tableSchema.index({ canteenId: 1, tableId: 1 }, { unique: true });
  tableSchema.index({ canteenId: 1, name: 1 }, { unique: true });
  const Config = mongoose.models.DineConfig || mongoose.model("DineConfig", configSchema);
  const Table = mongoose.models.DineTable || mongoose.model("DineTable", tableSchema);
  const auditSchema = new mongoose.Schema({ canteenId: String, actor: String, enabled: Boolean }, { timestamps: true });
  const Audit = mongoose.models.DineApprovalAudit || mongoose.model("DineApprovalAudit", auditSchema);
  const VoidSession = mongoose.models.DineVoidSession || mongoose.model("DineVoidSession", new mongoose.Schema({ _id: String, canteenId: String, tableName: String, session: mixed, actor: String }, { timestamps: true }));
  const wrap = fn => async (req, res) => { try { await fn(req, res); } catch (e) { res.status(e.code === 11000 ? 409 : e.status || 500).json({ message: e.code === 11000 ? "Table name already exists" : e.message }); } };
  const cid = req => req.authUser.canteenId;
  const role = (req, roles) => { if (!roles.includes(req.authUser.role)) fail("Your role cannot perform this action", 403); };
  const cashRoles = ["admin", "manager", "cashier", "billing", "user"];
  async function config(id) { return await Config.findById(id).lean() || { enabled: false, requested: false }; }
  async function gated(req) { if (!(await config(cid(req))).enabled) fail("Dine In approval required. Upgrade Plan.", 403); }
  async function table(req) {
    const row = await Table.findOne({ canteenId: cid(req), tableId: req.params.tableId }).lean();
    if (!row) fail("Table not found", 404);
    return row;
  }
  async function update(row, values) {
    const saved = await Table.findOneAndUpdate({ _id: row._id, revision: row.revision }, { $set: values, $inc: { revision: 1 } }, { new: true }).lean();
    if (!saved) fail("Table changed on another device. Refresh and retry.", 409);
    return saved;
  }
  const auth = [requireDatabase, requireCanteenAuth];
  app.get("/dine-in", ...auth, wrap(async (req, res) => {
    const access = await config(cid(req));
    res.json({ enabled: access.enabled, requested: access.requested, tables: access.enabled ? await Table.find({ canteenId: cid(req) }).sort({ zone: 1, name: 1 }).lean() : [] });
  }));
  app.post("/dine-in/request", ...auth, wrap(async (req, res) => {
    await Config.updateOne({ _id: cid(req) }, { $set: { requested: true }, $setOnInsert: { enabled: false } }, { upsert: true });
    res.json({ success: true });
  }));
  app.get("/marketing-api/canteens/:id/dine-in", requireDatabase, requireSuperAdmin, wrap(async (req, res) => {
    const customer = await MarketingCanteen.findOne({ id: Number(req.params.id) }).lean();
    if (!customer?.activatedCanteenId) fail("Approve and activate this customer first");
    res.json(await config(customer.activatedCanteenId));
  }));
  app.post("/marketing-api/canteens/:id/dine-in", requireDatabase, requireSuperAdmin, wrap(async (req, res) => {
    const customer = await MarketingCanteen.findOne({ id: Number(req.params.id) }).lean();
    if (!customer?.activatedCanteenId) fail("Approve and activate this customer first");
    if (typeof req.body.enabled !== "boolean") fail("Enabled must be true or false");
    const canteenId = customer.activatedCanteenId;
    if (!req.body.enabled && await Table.exists({ canteenId, status: { $in: ["occupied", "closing"] } })) fail("Settle all open tables before disabling Dine In", 409);
    // Record the decision before applying it; failure never silently grants access.
    await Audit.create({ canteenId, actor: req.marketingUser.employeeId, enabled: req.body.enabled });
    await Config.updateOne({ _id: canteenId }, { $set: { enabled: req.body.enabled, requested: false, actor: req.marketingUser.employeeId } }, { upsert: true });
    res.json({ success: true, enabled: req.body.enabled });
  }));
  app.post("/dine-in/tables", requireDatabase, requireAdmin, wrap(async (req, res) => {
    await gated(req);
    const name = text(req.body.name, 40);
    if (!name) fail("Table number/name required");
    const seats = number(req.body.seats, 1, 100, "seats");
    if (!Number.isInteger(seats)) fail("Seats must be a whole number");
    const values = { name, zone: text(req.body.zone, 40) || "Main Hall", seats };
    let saved;
    if (req.body.tableId) {
      req.params.tableId = req.body.tableId;
      const row = await table(req);
      if (!["available", "disabled"].includes(row.status)) fail("Only free tables can be edited", 409);
      saved = await update(row, { ...values, active: req.body.active !== false, status: req.body.active === false ? "disabled" : "available" });
    } else {
      if (await Table.countDocuments({ canteenId: cid(req) }) >= 300) fail("Maximum 300 tables");
      saved = await Table.create({ ...values, canteenId: cid(req), tableId: crypto.randomUUID() });
    }
    res.json({ table: saved });
  }));
  app.post("/dine-in/tables/:tableId/state", ...auth, wrap(async (req, res) => {
    await gated(req); role(req, [...cashRoles, "waiter"]);
    const row = await table(req);
    const state = req.body.status;
    const allowed = { available: ["reserved"], reserved: ["available"], cleaning: ["available"] };
    if (!allowed[row.status]?.includes(state)) fail("Invalid table state transition", 409);
    res.json({ table: await update(row, { status: state, reservation: state === "reserved" ? text(req.body.reservation, 100) : "" }) });
  }));
  app.post("/dine-in/tables/:tableId/tickets", ...auth, wrap(async (req, res) => {
    await gated(req); role(req, [...cashRoles, "waiter"]);
    const row = await table(req);
    const key = text(req.body.requestId, 80);
    if (!/^[a-zA-Z0-9-]{16,80}$/.test(key)) fail("Valid request ID required");
    const prior = row.session?.tickets.find(t => t.id === key);
    if (prior) return res.json({ table: row, ticket: prior, duplicate: true });
    if (!row.active || !["available", "reserved", "occupied"].includes(row.status)) fail("Table is unavailable", 409);
    if (row.revision !== req.body.revision) fail("Table changed. Refresh before sending this order.", 409);
    if (row.session?.tickets.length >= 100) fail("Settle this bill before adding more tickets");
    const items = priceItems(req.body.items, await allMenuItems(cid(req)));
    const guests = number(req.body.guests || 1, 1, row.seats, "guests");
    if (!Number.isInteger(guests)) fail("Guests must be a whole number");
    const session = row.session || { id: crypto.randomUUID(), openedAt: new Date().toISOString(), guests, tickets: [] };
    const ticket = { id: key, number: session.tickets.length + 1, tableName: row.name, items, status: "new", createdAt: new Date().toISOString(), waiter: req.authUser.name };
    session.tickets.push(ticket);
    res.json({ table: await update(row, { status: "occupied", session, reservation: "" }), ticket });
  }));
  app.post("/dine-in/tables/:tableId/tickets/:ticketId", ...auth, wrap(async (req, res) => {
    await gated(req); role(req, [...cashRoles, "chef", "waiter"]);
    const row = await table(req);
    if (row.status !== "occupied") fail("Table is not open", 409);
    const ticket = row.session.tickets.find(t => t.id === req.params.ticketId);
    if (!ticket) fail("Ticket not found", 404);
    const next = req.body.status;
    if (next === "cancelled") {
      role(req, ["admin", "manager"]);
      if (ticket.status === "served" || ticket.status === "cancelled") fail("Cannot cancel this ticket");
      if (!text(req.body.reason)) fail("Cancellation reason required");
      ticket.reason = text(req.body.reason, 200);
    } else if ({ new: "preparing", preparing: "ready", ready: "served" }[ticket.status] !== next) fail("Invalid kitchen status transition", 409);
    ticket.status = next; ticket.updatedBy = req.authUser.name; ticket.updatedAt = new Date().toISOString();
    res.json({ table: await update(row, { session: row.session }) });
  }));
  app.post("/dine-in/tables/:tableId/settle", ...auth, wrap(async (req, res) => {
    await gated(req); role(req, cashRoles);
    let row = await table(req);
    if (req.body.sessionId && row.lastBill?.dineSessionId === req.body.sessionId) return res.json({ order: row.lastBill, duplicate: true });
    if (!row.session || row.session.id !== req.body.sessionId) fail("Session changed; refresh the table", 409);
    if (row.status === "occupied") {
      if (row.revision !== req.body.revision) fail("Order changed. Review the latest bill before paying.", 409);
      if (row.session.tickets.some(t => !["served", "cancelled"].includes(t.status))) fail("Serve or cancel all kitchen tickets before closing the table", 409);
      const summary = totals(row.session.tickets, req.body.discount || 0);
      if (!summary.items.length) fail("No billable items. Admin can close the cancelled table.");
      if (summary.discount) role(req, ["admin", "manager"]);
      if (!["Cash", "Online", "Card", "Split"].includes(req.body.payment)) fail("Select a valid payment method");
      let cash = req.body.payment === "Cash" ? summary.total : 0;
      if (req.body.payment === "Split") cash = number(req.body.cash, 0, summary.total, "split cash");
      if (round(cash) !== cash || round(summary.discount) !== summary.discount) fail("Payment and discount must use at most 2 decimal places");
      const restaurant = await getSettings(cid(req));
      const bill = { ...summary, canteenId: cid(req), id: Date.now() * 1000 + crypto.randomInt(1000), createdAt: new Date().toISOString(), clientOrderId: `dine-${row.session.id}`, dineSessionId: row.session.id, orderType: "Dine In", tableId: row.tableId, tableName: row.name, canteen: req.authUser.canteenName, cashier: req.authUser.name, cashierMobile: req.authUser.mobile, payment: req.body.payment, paymentBreakup: { cash, online: round(summary.total - cash), credit: 0 }, kitchenTickets: row.session.tickets };
      bill.canteen = restaurant.canteenName || cid(req);
      row = await update(row, { status: "closing", session: { ...row.session, bill } });
    }
    if (row.status !== "closing") fail("Table cannot be settled", 409);
    // Stable bill ID and persisted closing state allow recovery after network/process failure.
    const saved = await saveOrder(row.session.bill);
    await update(row, { status: "cleaning", lastBill: saved, session: null });
    res.json({ order: saved });
  }));
  app.post("/dine-in/tables/:tableId/close-empty", requireDatabase, requireAdmin, wrap(async (req, res) => {
    await gated(req); const row = await table(req);
    if (row.status !== "occupied" || row.session.tickets.some(t => t.status !== "cancelled")) fail("Cancel all tickets before closing");
    await VoidSession.updateOne({ _id: row.session.id }, { $setOnInsert: { canteenId: cid(req), tableName: row.name, session: row.session, actor: req.authUser.name } }, { upsert: true });
    res.json({ table: await update(row, { status: "cleaning", lastBill: { cancelledSession: row.session }, session: null }) });
  }));
  return { Config, Table };
}
module.exports = { registerDineIn, priceItems, totals, number };
