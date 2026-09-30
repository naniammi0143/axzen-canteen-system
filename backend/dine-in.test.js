const test = require("node:test");
const assert = require("node:assert/strict");
const { registerDineIn, priceItems, totals } = require("./dine-in");
const clone = value => value == null ? value : structuredClone(value);
const menu = [{ id: 1, name: "Meals", price: 100 }, { id: 2, name: "Tea", price: 12.5 }];

// Dependency-isolated route tests. No production database, credentials or orders.
function fixture() {
  const routes = {}, models = {}, ledger = new Map();
  let sequence = 0, failSave = false, taxSettings = {}, businessCategory = "Restaurant";
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
    allMenuItems: async () => menu, getSettings: async () => ({ canteenName: "Test Restaurant", businessCategory, taxSettings }), saveOrder: async bill => { if (failSave) throw new Error("Simulated database outage"); if (!ledger.has(bill.clientOrderId)) ledger.set(bill.clientOrderId, clone(bill)); return clone(ledger.get(bill.clientOrderId)); }
  });
  async function call(method, path, body = {}, { tenant = "A", role = "admin", params = {} } = {}) {
    const req = { body, params, authUser: { canteenId: tenant, name: "Test", role }, marketingUser: { role, employeeId: "TEST" } };
    let status = 200, data;
    const res = { status(n) { status = n; return this; }, json(v) { data = clone(v); return this; } };
    const fns = routes[`${method} ${path}`]; assert.ok(fns, path);
    let index = 0; const run = () => fns[index++]?.(req, res, run); await run();
    return { status, data };
  }
  return { call, models, ledger, service, outage: v => failSave = v, taxes:v=>taxSettings=v, category:v=>businessCategory=v };
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

test('only restaurant and canteen business categories may request or use Dine In',async()=>{
 const f=fixture();await f.service.setApproval('A',true,'MANAGER');
 for(const category of ['Chicken Center','Meat Shop','Fish Shop','Retail','Grocery','Cool Drinks','Bakery']){
  f.category(category);
  assert.equal((await f.call('GET','/dine-in')).data.enabled,false,category);
  assert.equal((await f.call('POST','/dine-in/request')).status,403,category);
  assert.equal((await f.call('POST','/dine-in/tables',{name:'1',seats:4})).status,403,category);
  await assert.rejects(f.service.setApproval('A',true,'MANAGER'),/only for restaurants/);
 }
 f.category('Canteen');assert.equal((await f.call('GET','/dine-in')).data.enabled,true);
});
test("server menu price wins; hidden, invalid, fractional and weight items rejected", () => {
  assert.equal(priceItems([{ id: 1, qty: 2, price: 1 }], menu)[0].price, 100);
  for (const qty of [0, -1, 1.5, Infinity, "no"]) assert.throws(() => priceItems([{ id: 1, qty }], menu));
  assert.throws(() => priceItems([{ id: 3, qty: 1 }], menu));
  assert.throws(() => priceItems([{ id: 1, qty: 1 }], [{ ...menu[0], hidden: true }]));
  assert.throws(() => priceItems([{ id: 1, qty: 1 }], [{ ...menu[0], billingType: "weight" }]));
});

async function offlineFixture() {
  const f=fixture();await f.service.setApproval('A',true,'ADMIN');
  f.taxes({rows:[{id:'cgst',enabled:true,rate:2.5},{id:'sgst',enabled:true,rate:2.5}]});
  const row=(await f.call('POST','/dine-in/tables',{name:'1',zone:'Hall',seats:4})).data.table;
  const {JSDOM}=require('jsdom'),fs=require('node:fs'),path=require('node:path');
  const dom=new JSDOM('',{url:'https://offline.test',runScripts:'outside-only'}),w=dom.window;
  w.eval(fs.readFileSync(path.join(__dirname,'../sa/bill-taxes.js'),'utf8'));
  w.eval(fs.readFileSync(path.join(__dirname,'../sa/dine-in-offline.js'),'utf8'));
  let network=true,loseAck=false;
  const remote=async(url,opts={})=>{
    if(!network)throw Error('Network unavailable');
    const parts=url.split('/'),params={tableId:parts[3],ticketId:parts[5]};
    let route=url;if(parts[2]==='tables'){route='/dine-in/tables/:tableId/'+parts[4];if(parts[5])route+='/:ticketId';}
    const result=await f.call(opts.method||'GET',route,opts.body?JSON.parse(opts.body):{}, {params});
    if(result.status>=400)throw Object.assign(Error(result.data.message),{status:result.status});
    if(loseAck&&opts.method==='POST'){loseAck=false;throw Error('Connection dropped after save');}
    return result.data;
  };
  const create=(scope='A:admin')=>w.DineOffline.create({scope,api:remote,getMenu:async()=>menu,getSettings:()=>({canteenName:'Test'}),user:{name:'Admin',role:'admin',mobile:'admin'},online:()=>network});
  const store=create();await store.api('/dine-in');await store.menu();
  const post=(store,suffix,body)=>store.api(`/dine-in/tables/${row.tableId}/${suffix}`,{method:'POST',body:JSON.stringify(body)});
  return {f,w,dom,row,store,create,post,network:v=>network=v,loseAck:()=>loseAck=true};
}

test('saved tax settings update the offline table cache and survive restarting',async()=>{
 const x=await offlineFixture();try{
  x.network(false);
  await x.store.updateTaxSettings({rows:[{id:'gst',enabled:true,rate:12}]});
  const restarted=x.create();const access=await restarted.api('/dine-in');
  assert.equal(x.w.BillTaxes.calculate(100,0,access.taxSettings).total,112);
  restarted.stop();
 }finally{x.store.stop();x.dom.window.close();}
});

test('offline orders, kitchen progress and tax-inclusive payment survive restart and lost acknowledgements without duplicate bills',async()=>{
 const x=await offlineFixture();try{
  x.network(false);
  const sent=await x.post(x.store,'tickets',{requestId:'offline-ticket-000001',items:[{id:1,name:'Meals',price:100,qty:2}],guests:2});
  for(const status of ['preparing','ready','served'])await x.post(x.store,'tickets/offline-ticket-000001',{status});
  const paid=await x.post(x.store,'settle',{sessionId:sent.table.session.id,payment:'Cash',discount:20});
  assert.equal(paid.order.total,189);assert.equal(x.store.status().pending,5);
  x.store.saveDraft(x.row.tableId,{draft:[{id:2,qty:3}]});x.store.stop();
  const restored=x.create();assert.equal(restored.draft(x.row.tableId).draft[0].qty,3);
  assert.equal((await restored.api('/dine-in')).tables[0].status,'cleaning');
  x.network(true);x.loseAck();await restored.sync();assert.equal(restored.status().pending,5);
  await restored.sync();assert.equal(restored.status().pending,0);
  assert.equal(x.f.ledger.size,1);assert.equal([...x.f.ledger.values()][0].total,189);
  await restored.sync();assert.equal(x.f.ledger.size,1);
  assert.equal((await restored.api('/dine-in')).tables[0].status,'cleaning');restored.stop();
 }finally{x.dom.window.close();}
});

test('offline conflicts retain pending data and never overwrite another device or another tenant',async()=>{
 const x=await offlineFixture();try{
  x.network(false);await x.post(x.store,'tickets',{requestId:'offline-ticket-000002',items:[{id:1,name:'Meals',price:100,qty:1}],guests:1});
  const other=await x.f.call('POST','/dine-in/tables/:tableId/tickets',{requestId:'another-device-0001',revision:0,items:[{id:2,qty:1}]},{params:{tableId:x.row.tableId}});assert.equal(other.status,200);
  x.network(true);await x.store.sync();assert.equal(x.store.status().pending,1);assert.match(x.store.status().error,/review/);
  assert.equal(x.f.models.DineTable.rows[0].session.tickets.length,1);
  const tenant=x.create('B:admin');x.network(false);await assert.rejects(tenant.api('/dine-in'),/Connect once/);assert.equal(tenant.status().pending,0);tenant.stop();x.store.stop();
 }finally{x.dom.window.close();}
});

test('storage failures prevent offline order acknowledgement and queue mutation',async()=>{
 const x=await offlineFixture();try{
  x.network(false);const original=x.w.Storage.prototype.setItem;
  x.w.Storage.prototype.setItem=function(){throw Error('QuotaExceeded');};
  await assert.rejects(x.post(x.store,'tickets',{requestId:'offline-ticket-000003',items:[{id:1,name:'Meals',qty:1}],guests:1}),/storage is full/);
  x.w.Storage.prototype.setItem=original;assert.equal(x.store.status().pending,0);assert.equal((await x.store.api('/dine-in')).tables[0].status,'available');x.store.stop();
 }finally{x.dom.window.close();}
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
