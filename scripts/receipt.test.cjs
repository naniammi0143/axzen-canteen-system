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

test('tax percentages print below discount and optional receipt details obey the saved bill flags',()=>{
 const ctx=vm.createContext({settings:{canteenName:'Test Restaurant',receiptArea:'Hidden Area'},user:{name:'Cashier'},receiptTextColumns:()=>32,formatQtyUnit:(q,u)=>q+' '+u,printItemName:i=>i.name,itemSaleUnit:()=> 'Plate',cartLineTotal:i=>i.qty*i.price});
 vm.runInContext(['receiptText','orderTokenNumber'].map(declaration).join('\n'),ctx);
 const bill={id:101,canteen:'Test Restaurant',items:[{name:'Meals',qty:1,price:100}],subtotal:100,discount:10,total:94.5,taxes:[{name:'CGST',rate:2.5,amount:2.25},{name:'SGST',rate:2.5,amount:2.25}],gstin:'36ABCDE1234F1Z5',receiptFields:{area:false,cashier:false,payment:false,token:false,gstin:true,footer:false}};
 const text=ctx.receiptText(bill);
 assert.ok(text.indexOf('DISCOUNT')<text.indexOf('CGST (2.5%)'));assert.ok(text.indexOf('SGST (2.5%)')<text.lastIndexOf('TOTAL'));
 assert.ok(text.includes('Rs 94.50'));assert.ok(text.includes(bill.gstin));
 for(const hidden of ['Hidden Area','Cashier:','Payment:','Token:','THANK YOU'])assert.ok(!text.includes(hidden));
});

test('selected menu language is used unchanged on screen, receipt text and Android bitmap print',()=>{
 const settings={menuLanguage:'telugu',receiptLanguage:'english'};
 const ctx=vm.createContext({settings,window:{AxenPrinter:{printReceiptBitmapToPrinterAsync(){}}},languageMode:value=>['english','telugu','both'].includes(value)?value:'english',suggestTeluguName:value=>value});
 vm.runInContext(['localizedName','printItemName','canPrintReceiptBitmap'].map(declaration).join('\n'),ctx);
 const item={name:'Chicken Curry',nameTe:'చికెన్ కర్రీ'};
 assert.equal(ctx.localizedName(item),'చికెన్ కర్రీ');
 assert.equal(ctx.printItemName(item),'చికెన్ కర్రీ');
 assert.equal(ctx.canPrintReceiptBitmap({receiptLanguage:'telugu'}),true);
 assert.equal(ctx.canPrintReceiptBitmap({receiptLanguage:'english'}),false);
 settings.menuLanguage='both';
 assert.equal(ctx.localizedName(item),'Chicken Curry / చికెన్ కర్రీ');
 assert.equal(ctx.printItemName(item),'Chicken Curry / చికెన్ కర్రీ');
});
