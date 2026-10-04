const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../sa/index.html'), 'utf8');
const BusinessRules = require('../sa/business-rules');
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
test('tablet menu cards keep their normal width when a category has only one item', () => {
  assert.match(source, /html\.pos-layout-tablet #posView \.menu-grid\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fill, 168px\) !important;[^}]*justify-content:\s*start !important;/);
  assert.doesNotMatch(source, /html\.pos-layout-tablet #posView \.menu-grid\s*\{[^}]*minmax\(168px, 1fr\)/);
});
test('report presets highlight the selected range and clear for custom dates', () => {
  const saved = {};
  const ctx = vm.createContext({
    scopedLocalGet: key => saved[key], scopedLocalSet: (key, value) => { saved[key] = value; },
    dateInputValue: date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
    renderOptionPage() {}
  });
  vm.runInContext(['reportRange', 'reportQuickButtons', 'setReportQuickRange', 'resetReportRangeToToday'].map(declaration).join('\n'), ctx);
  for (const range of ['today', 'week', 'month', 'year']) {
    ctx.setReportQuickRange(range);
    const html = ctx.reportQuickButtons();
    assert.equal((html.match(/aria-pressed="true"/g) || []).length, 1);
    assert.ok(html.includes(`data-report-range="${range}" aria-pressed="true"`));
  }
  saved.AXEN_REPORT_FROM = '2020-01-01';
  assert.equal(ctx.reportQuickButtons().includes('aria-pressed="true"'), false);
  ctx.resetReportRangeToToday();
  assert.ok(ctx.reportQuickButtons().includes('data-report-range="today" aria-pressed="true"'));
});
test('restaurant cooked meat dishes use quantity; explicit weights and meat shops remain supported', () => {
  const ctx = vm.createContext({ BusinessRules, settings: { businessCategory: 'Restaurant' }, user: {} });
  vm.runInContext(['isChickenCategory', 'isChickenProduct', 'isChickenShopCanteen', 'shopKind'].map(declaration).join('\n'), ctx);
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
  const nodes = { itemSearchBar: { classList: { contains: () => true } }, paymentModalMount: { children: [1] }, optionsModalMount: { children: [] }, adminView: { classList: { contains: () => true } } };
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
  const ctx = vm.createContext({ BusinessRules, settings: { businessCategory: 'Canteen', posMode: 'canteen' }, user: {} });
  vm.runInContext(['isChickenCategory', 'isEggProduct', 'isChickenShopCanteen', 'shopKind', 'itemSaleUnit'].map(declaration).join('\n'), ctx);
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
  const ctx = vm.createContext({ BusinessRules, DEFAULT_CANTEEN_ID: 'A', normalizeCanteenId: x => x,
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

test('server returns only tenant menu items and normalizes legacy raw chicken as weight',async()=>{
 const ctx=vm.createContext({BusinessRules,DEFAULT_CANTEEN_ID:'DEFAULT',normalizeCanteenId:x=>x,shopKindFromCategory:BusinessRules.kind,
  getSettings:async id=>({businessCategory:id==='CHICKEN'?'Chicken Center':'Restaurant'}),mongoReady:false,
  memory:{menuItems:[{id:1,canteenId:'CHICKEN',name:'Chicken',unit:'Plate',billingType:'quantity'},
   {id:2,canteenId:'CHICKEN',name:'Chicken Wings',unit:'Pieces',billingType:'quantity'},
   {id:1,canteenId:'RESTAURANT',name:'Chicken Curry',unit:'Plate',billingType:'weight'}]}});
 const start=server.indexOf('async function allMenuItems(');vm.runInContext(server.slice(start,server.indexOf('\nasync function ',start+1)),ctx);
 const chicken=await ctx.allMenuItems('CHICKEN');assert.equal(chicken.length,2);assert.equal(chicken[0].billingType,'weight');assert.equal(chicken[0].unit,'Kgs');assert.equal(chicken[1].billingType,'quantity');
 const restaurant=await ctx.allMenuItems('RESTAURANT');assert.equal(restaurant.length,1);assert.equal(restaurant[0].name,'Chicken Curry');assert.equal(restaurant[0].billingType,'quantity');
 assert.equal((await ctx.allMenuItems('EMPTY')).length,0);
});

test('server fallback settings remain tenant-scoped and core business category wins',async()=>{
 const ctx=vm.createContext({DEFAULT_CANTEEN_ID:'DEFAULT',normalizeCanteenId:x=>x,defaultSettings:{businessCategory:'Canteen',posMode:'canteen'},
  getCoreCanteen:async id=>({businessCategory:id==='CHICKEN'?'Chicken Center':'Canteen'}),mongoReady:false,shopKindFromCategory:BusinessRules.kind,
  memory:{settings:{businessCategory:'Canteen',canteenName:'Default Restaurant'},settingsByCanteen:{CHICKEN:{businessCategory:'Canteen',canteenName:'Meat Counter'}}}});
 const start=server.indexOf('async function getSettings(');vm.runInContext(server.slice(start,server.indexOf('\nfunction ',start+1)),ctx);
 const chicken=await ctx.getSettings('CHICKEN');assert.equal(chicken.businessCategory,'Chicken Center');assert.equal(chicken.canteenName,'Meat Counter');
 const other=await ctx.getSettings('OTHER');assert.equal(other.canteenName,undefined);assert.equal(other.businessCategory,'Canteen');
});
