const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const source=fs.readFileSync(require('path').join(__dirname,'../sa/index.html'),'utf8');
function declaration(name){const a=source.indexOf(`    function ${name}(`),b=source.indexOf('\n    function ',a+1);return source.slice(a,b);}
test('receipt second line is area, footer is compact, and preview strips control commands',()=>{
 const ctx=vm.createContext({settings:{canteenName:'Test Restaurant',receiptArea:'Madhapur, Hyderabad'},user:{name:'Cashier'},receiptTextColumns:()=>32,formatQtyUnit:(q,u)=>q+' '+u,printItemName:i=>i.name,itemSaleUnit:()=> 'Plate',cartLineTotal:i=>i.qty*i.price,esc:s=>String(s)});
 vm.runInContext(['receiptText','orderTokenNumber','sampleReceiptOrder','receiptPreviewHtml'].map(declaration).join('\n'),ctx);
 for(const items of [[{name:'Dosa',qty:1,price:60}],[{name:'Chicken',qty:0.5,price:200,weightUnit:'Kg'}]]){
  const raw=ctx.receiptText({id:1,canteen:'Test Restaurant',items,total:60});
  assert.ok(raw.includes('Madhapur, Hyderabad'));assert.ok(!raw.toLowerCase().includes('axzen infotech'));
  assert.ok(raw.includes('Powered by\n'));assert.ok(raw.includes('Axzen POS System'));assert.ok(!raw.endsWith('\n\n'));
 }
 const html=ctx.receiptPreviewHtml('Kukatpally');assert.ok(html.includes('Kukatpally'));assert.ok(!html.includes('\x1b'));assert.ok(!html.includes('\x00'));assert.ok(html.includes('font-size:10px'));
});
