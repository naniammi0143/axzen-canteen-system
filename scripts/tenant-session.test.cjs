const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..'),BusinessRules=require('../sa/business-rules');
function fixture(){
 const html=fs.readFileSync(path.join(root,'sa/index.html'),'utf8');
 const dom=new JSDOM(html,{url:'https://pos.test/partner/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 w.scrollTo=()=>{};w.matchMedia=()=>({matches:false,addEventListener(){}});w.setInterval=()=>0;w.HTMLCanvasElement.prototype.getContext=()=>null;
 w.fetch=async()=>({ok:true,json:async()=>({})});w.DineIn={close(){},back(){return false}};w.BusinessRules=BusinessRules;
 w.eval(fs.readFileSync(path.join(root,'sa/bill-taxes.js'),'utf8'));
 w.eval(fs.readFileSync(path.join(root,'sa/app-version.js'),'utf8'));
 const script=[...w.document.scripts].find(s=>s.textContent.includes('const urlParams =')).textContent;
 w.eval(script+`\nwindow.testPOS={setSession,applySettings,useBootstrapProducts,loadProducts,loadSettings,loadAdminData,api,addToCart,logout,ensureUserNavKeys,shopBillingProducts,chickenProductsForMenu,refreshLiveData,
 state:()=>({user,products,settings,cart,orders}),setProducts:rows=>{products=rows;renderProducts();},selectOption:(id,option)=>selectedSubItems[id]=option};`);
 return {w,dom,pos:w.testPOS,login:(id,category)=>w.testPOS.setSession({canteenId:id,mobile:'test',name:id,role:'admin',canteen:{businessCategory:category}},'token-'+id),close:()=>w.close()};
}
test('chicken popup survives menu refresh, supports kg and money, and ignores old portion selection',async()=>{
 const f=fixture();try{
  f.login('CHICKEN','Chicken Center');
  const item={id:1,canteenId:'CHICKEN',name:'Chicken',category:'Chicken',unit:'Plate',billingType:'quantity',price:200};
  f.pos.setProducts([item]);f.pos.addToCart(1);assert.ok(f.w.document.getElementById('chickenKgInput'));
  const kg=f.w.document.getElementById('chickenKgInput');kg.value='0.5';kg.dispatchEvent(new f.w.Event('input'));assert.equal(f.w.document.getElementById('chickenAmountInput').value,'100');
  const amount=f.w.document.getElementById('chickenAmountInput');amount.value='150';amount.dispatchEvent(new f.w.Event('input'));assert.equal(kg.value,'0.75');
  f.w.document.getElementById('closeChickenSale').click();
  f.w.fetch=async()=>({ok:true,json:async()=>[item]});await f.pos.loadProducts();
  f.pos.addToCart(1,{name:'Old portion',price:40});assert.ok(f.w.document.getElementById('chickenKgInput'));assert.equal(f.pos.state().cart.length,0);
  assert.equal(f.w.document.querySelector('[data-nav="dinein"]').hidden,true);
 }finally{f.close();}
});
test('fresh login renders and caches bootstrap products without another request',()=>{
 const f=fixture();try{
  f.login('FRESH','Restaurant');
  const used=f.pos.useBootstrapProducts([
   {id:1,canteenId:'FRESH',name:'Ready Meal',category:'Meals',price:120},
   {id:2,canteenId:'OTHER',name:'Foreign Meal',category:'Meals',price:90}
  ]);
  assert.equal(used,true);
  assert.deepEqual(Array.from(f.pos.state().products,p=>p.name),['Ready Meal']);
  assert.match(f.w.localStorage.getItem('AXEN_PRODUCTS::FRESH'),/Ready Meal/);
  assert.match(f.w.document.getElementById('menuGrid').textContent,/Ready Meal/);
 }finally{f.close();}
});
test('login switch clears products and rejects late menu/settings responses from the previous tenant',async()=>{
 const f=fixture();try{
  f.login('A','Restaurant');f.pos.setProducts([{id:1,canteenId:'A',name:'Meals A',category:'Meals',price:100}]);
  const pending=[];f.w.fetch=()=>new Promise(resolve=>pending.push(resolve));
  const oldProducts=f.pos.loadProducts(),oldSettings=f.pos.loadSettings();
  f.login('B','Chicken Center');assert.equal(f.pos.state().products.length,0);assert.equal(f.pos.state().cart.length,0);
  pending[0]({ok:true,json:async()=>[{id:1,canteenId:'A',name:'Meals A'}]});pending[1]({ok:true,json:async()=>({canteenId:'A',businessCategory:'Restaurant'})});
  await Promise.all([oldProducts,oldSettings]);
  assert.equal(f.pos.state().settings.businessCategory,'Chicken Center');assert.equal(f.pos.state().products.length,0);
  assert.equal(f.w.localStorage.getItem('AXEN_PRODUCTS::B'),null);
  f.w.fetch=async()=>({ok:true,json:async()=>[{id:1,canteenId:'B',name:'Chicken B',price:220},{id:2,canteenId:'A',name:'Wrong tenant'}]});
  await f.pos.loadProducts();assert.deepEqual(Array.from(f.pos.state().products,p=>p.name),['Chicken B']);
  assert.ok(f.w.localStorage.getItem('AXEN_PRODUCTS::B').includes('Chicken B'));
 }finally{f.close();}
});
test('only active menu items appear, cached prices cannot resurrect removed dishes, and Dine In is category-specific',()=>{
 const f=fixture();try{
  for(const category of ['Chicken Center','Meat Shop','Fish Shop','Retail','Grocery','Cool Drinks','Bakery','Restaurant','Canteen']){
   f.login(category,category);
   assert.equal(f.w.document.querySelector('[data-nav="dinein"]').hidden,!['Restaurant','Canteen'].includes(category),category);
  }
  f.login('C','Chicken Center');f.pos.setProducts([{id:1,canteenId:'C',name:'Chicken',price:200},{id:2,canteenId:'C',name:'Chicken Liver',price:100,hidden:true}]);
  f.w.localStorage.setItem('AXEN_CHICKEN_TODAY_PRICES::C',JSON.stringify([{id:99,name:'Deleted Chicken',price:20}]));
  assert.deepEqual(Array.from(f.pos.chickenProductsForMenu(),p=>p.name),['Chicken']);
  f.login('R','Restaurant');f.pos.setProducts([{id:1,canteenId:'R',name:'Chicken Curry',category:'Chicken',price:100,unit:'Plate'}]);f.pos.addToCart(1);
  assert.equal(f.pos.state().cart[0].qty,1);assert.equal(f.w.document.getElementById('chickenKgInput'),null);
 }finally{f.close();}
});

test('offline login keeps its own business settings and ignores foreign cached menu rows',async()=>{
 const f=fixture();try{
  f.login('CHICKEN','Chicken Center');f.pos.applySettings({canteenId:'CHICKEN',businessCategory:'Chicken Center',posMode:'chicken_shop'});
  f.w.localStorage.setItem('AXEN_PRODUCTS::CHICKEN',JSON.stringify([{id:1,canteenId:'CHICKEN',name:'Chicken',price:200},{id:2,canteenId:'OTHER',name:'Foreign meal'}]));
  f.login('OTHER','Canteen');f.pos.applySettings({canteenId:'OTHER',businessCategory:'Canteen'});f.pos.logout();
  f.pos.setSession({canteenId:'CHICKEN',mobile:'test',name:'Chicken',role:'admin'},'token-CHICKEN');
  f.w.fetch=async()=>{throw Error('offline');};await f.pos.loadSettings();await f.pos.loadProducts();
  assert.equal(f.pos.state().settings.businessCategory,'Chicken Center');assert.deepEqual(Array.from(f.pos.state().products,p=>p.name),['Chicken']);
  f.pos.addToCart(1);assert.ok(f.w.document.getElementById('chickenKgInput'));
 }finally{f.close();}
});

test('background dashboard refresh cannot change a chicken login into another tenant or quantity billing',async()=>{
 const f=fixture();try{
  f.login('CHICKEN','Chicken Center');f.pos.setProducts([{id:1,canteenId:'CHICKEN',name:'Chicken',price:200}]);
  f.w.fetch=async url=>({ok:true,json:async()=>url.endsWith('/users')?[]:{users:[{mobile:'test',canteenId:'OTHER',canteen:{businessCategory:'Canteen'}}],orders:[]}});
  await f.pos.loadAdminData();assert.equal(f.pos.state().user.canteenId,'CHICKEN');f.pos.addToCart(1);assert.ok(f.w.document.getElementById('chickenKgInput'));
 }finally{f.close();}
});
