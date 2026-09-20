const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const source = fs.readFileSync(require('node:path').join(__dirname, '../sa/dine-in.js'), 'utf8');
const tick = () => new Promise(resolve => setTimeout(resolve, 10));
function setup(enabled = true) {
  const dom = new JSDOM('<main id="root"></main>', { url: 'https://test.invalid', runScripts: 'outside-only' });
  const { window } = dom; window.confirm = () => true; window.prompt = () => 'Test'; window.eval(source);
  const state = { enabled, tables: [{ tableId: 't1', name: '1', zone: 'Main Hall', seats: 4, status: 'available', active: true, revision: 0 }] };
  const menu = [{ id: 1, name: 'Meals', price: 100, subItems: [{ name: 'Half', price: 60 }] }];
  const calls = [], bills = [];
  const api = async (path, opts = {}) => {
    const body = opts.body ? JSON.parse(opts.body) : null;
    if (body) calls.push({ path, body });
    if (path === '/dine-in') return structuredClone(state);
    if (path === '/orders') return bills;
    if (path === '/dine-in/request') { state.requested = true; return { success: true }; }
    if (path.endsWith('/tickets')) {
      const row = state.tables[0];
      const ticket = { id: body.requestId, number: 1, status: 'new', createdAt: new Date().toISOString(), items: body.items, waiter: 'Tester' };
      row.status = 'occupied'; row.revision++;
      row.session = { id: 'session1', guests: body.guests, tickets: [ticket] };
      return { table: structuredClone(row), ticket };
    }
    if (path.includes('/tickets/')) { state.tables[0].session.tickets[0].status = body.status; return {}; }
    if (path.endsWith('/settle')) {
      const row = state.tables[0]; const order = { clientOrderId: 'dine-session1', id: 1, orderType: 'Dine In', tableId: 't1', tableName: '1', total: 120, items: row.session.tickets[0].items };
      bills.push(order); row.session = null; row.status = 'cleaning'; row.lastBill = order; return { order };
    }
    if (path.endsWith('/state')) { state.tables[0].status = body.status; return {}; }
    throw new Error('Unexpected API path: ' + path);
  };
  const root = window.document.getElementById('root');
  window.DineIn.mount(root, { api, admin: true, getMenu: async () => menu });
  const click = async action => { const button = root.querySelector(`[data-di="${action}"]`); assert.ok(button, action); button.click(); await tick(); };
  return { window, root, calls, state, click, close: () => { window.DineIn.close(); window.close(); } };
}
test('unapproved restaurant gets Upgrade Plan and cannot see tables', async () => {
  const f = setup(false);
  try { await tick(); assert.match(f.root.textContent, /Upgrade Plan/); assert.equal(f.root.querySelector('[data-di="select"]'), null); await f.click('request'); assert.equal(f.state.requested, true); }
  finally { f.close(); }
});
test('table → portion → kitchen → served → payment → report → cleaning', async () => {
  const f = setup();
  try {
    await tick(); await f.click('select');
    f.root.querySelector('#di-product').value = '1';
    f.root.querySelector('#di-qty').value = '2';
    f.root.querySelector('#di-note').value = 'Less spicy';
    await f.click('add'); await f.click('send');
    const request = f.calls.find(c => c.path.endsWith('/tickets'));
    assert.equal(request.body.items[0].optionName, 'Half');
    assert.equal(request.body.items[0].qty, 2);
    assert.equal(request.body.items[0].note, 'Less spicy');
    assert.match(f.root.textContent, /KOT 1/);
    await f.click('kitchen');
    for (let i = 0; i < 3; i++) await f.click('ticket');
    assert.match(f.root.textContent, /No pending kitchen tickets/);
    await f.click('tables'); await f.click('select'); await f.click('settle');
    assert.match(f.root.textContent, /awaiting cleaning/);
    await f.click('available'); assert.equal(f.state.tables[0].status, 'available');
    await f.click('reports'); assert.match(f.root.textContent, /1 bills/); assert.match(f.root.textContent, /₹120.00/);
  } finally { f.close(); }
});
