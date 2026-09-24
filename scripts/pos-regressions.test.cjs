const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../sa/index.html'), 'utf8');
const server = fs.readFileSync(require('node:path').join(__dirname, '../backend/server.js'), 'utf8');
function declaration(name) {
  const start = source.indexOf(`    function ${name}(`);
  const end = source.indexOf('\n    function ', start + 1);
  return source.slice(start, end);
}
test('phone and tablet layouts match browser and APK, including portrait and rotation', () => {
  for (const native of [false, true]) {
    const classes = new Set();
    const ctx = vm.createContext({
      window: { innerWidth: 390, innerHeight: 844, Capacitor: native ? {} : undefined },
      document: { documentElement: { classList: { toggle(name, on) { on ? classes.add(name) : classes.delete(name); } } } },
      applyNativeSafeArea() {}
    });
    vm.runInContext(declaration('applyPosLayoutMode').split('    window.addEventListener')[0], ctx);
    for (const [width, height, tablet] of [[390, 844, false], [844, 390, false], [768, 1024, false], [1024, 768, true], [820, 1180, false], [1180, 820, true], [1280, 800, true], [1024, 1366, false], [1366, 1024, true], [768, 1024, false], [360, 800, false]]) {
      ctx.window.innerWidth = width;
      ctx.window.innerHeight = height;
      ctx.applyPosLayoutMode();
      assert.equal(classes.has('pos-layout-tablet'), tablet, `${native ? 'APK' : 'browser'} ${width}x${height}`);
      assert.equal(classes.has('pos-layout-compact'), !tablet);
    }
  }
});
test('restaurant cooked meat dishes use quantity; explicit weights and meat shops remain supported', () => {
  const ctx = vm.createContext({ settings: { businessCategory: 'Restaurant' }, user: {} });
  vm.runInContext(['isChickenCategory', 'isChickenProduct', 'isChickenShopCanteen'].map(declaration).join('\n'), ctx);
  for (const name of ['Chicken Curry', 'Mutton Biryani', 'Fish Fry']) {
    assert.equal(ctx.isChickenProduct({ name, category: 'Chicken', billingType: 'weight' }), false);
  }
  assert.equal(ctx.isChickenProduct({ name: 'Rice', unit: 'Kgs', billingType: 'weight' }), true);
  ctx.settings.businessCategory = 'Chicken Shop';
  assert.equal(ctx.isChickenProduct({ name: 'Chicken', billingType: 'weight' }), true);
  assert.equal(ctx.isChickenProduct({ name: 'Chicken Curry', unit: 'Plate' }), false);
  assert.equal(ctx.isChickenProduct({ name: 'Egg', billingType: 'quantity' }), false);
});
test('Back closes modal before navigation, preserves Dine In interception, and returns to categories', () => {
  const nodes = { paymentModalMount: { children: [1] }, optionsModalMount: { children: [] }, adminView: { classList: { contains: () => true } } };
  const calls = [];
  const ctx = vm.createContext({ window: { DineIn: { back: () => true } }, $: id => nodes[id],
    activePosSection: 'dinein', itemSearch: '', showingCategoryHome: false,
    closePaymentModal: () => { nodes.paymentModalMount.children = []; calls.push('payment'); },
    closeOptionsModal: () => calls.push('options'), setPosSection: s => calls.push(s), renderProducts: () => calls.push('render') });
  const start = source.indexOf('    window.handlePosBack = function');
  vm.runInContext(source.slice(start, source.indexOf('\n    };', start) + 7), ctx);
  assert.equal(ctx.window.handlePosBack(), true);
  assert.deepEqual(calls, ['payment']);
  assert.equal(ctx.window.handlePosBack(), true);
  assert.deepEqual(calls, ['payment']);
  ctx.activePosSection = 'billing';
  assert.equal(ctx.window.handlePosBack(), true);
  assert.equal(ctx.showingCategoryHome, true);
  assert.equal(ctx.window.handlePosBack(), false);
});
test('restaurant chicken categories and egg dishes do not open raw-meat or raw-egg billing', () => {
  const ctx = vm.createContext({ settings: { businessCategory: 'Canteen', posMode: 'canteen' }, user: {} });
  vm.runInContext(['isChickenCategory', 'isEggProduct', 'isChickenShopCanteen', 'itemSaleUnit'].map(declaration).join('\n'), ctx);
  assert.equal(ctx.isChickenCategory('Chicken Fried Rice'), false);
  for (const name of ['Egg Fried Rice', 'Egg Curry', 'Egg Burji']) {
    assert.equal(ctx.isEggProduct({ name }), false);
    assert.notEqual(ctx.itemSaleUnit({ name }), 'Pieces');
  }
  assert.equal(ctx.isEggProduct({ name: 'Eggs' }), true);
  assert.equal(ctx.isEggProduct({ name: 'Country Eggs' }), true);
  ctx.settings = { businessCategory: 'Chicken Shop' };
  assert.equal(ctx.isChickenCategory('Chicken'), true);
});
test('legacy restaurant menu weight flags are repaired for plates without changing genuine kg items or other tenants', async () => {
  const menu = [
    { id: 1, canteenId: 'A', name: 'Chicken Curry', billingType: 'weight', unit: 'Plate' },
    { id: 2, canteenId: 'A', name: 'Mutton Biryani', billingType: 'weight' },
    { id: 3, canteenId: 'A', name: 'Rice', billingType: 'weight', unit: 'Kgs' },
    { id: 4, canteenId: 'B', name: 'Other tenant', billingType: 'weight' }
  ];
  const ctx = vm.createContext({ DEFAULT_CANTEEN_ID: 'A', normalizeCanteenId: x => x,
    getSettings: async () => ({ businessCategory: 'Restaurant' }), shopKindFromCategory: () => 'canteen',
    mongoReady: false, memory: { menuItems: menu } });
  const start = server.indexOf('async function allMenuItems(');
  vm.runInContext(server.slice(start, server.indexOf('\nasync function ', start + 1)), ctx);
  const rows = await ctx.allMenuItems('A');
  assert.equal(rows.length, 3);
  assert.equal(rows[0].billingType, 'quantity');
  assert.equal(rows[1].billingType, 'quantity');
  assert.equal(rows[2].billingType, 'weight');
  assert.equal(menu[0].billingType, 'weight');
  ctx.shopKindFromCategory = () => 'chicken';
  assert.equal((await ctx.allMenuItems('A'))[0].billingType, 'weight');
});
