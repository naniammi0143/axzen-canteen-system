const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');

test('POS paper roll shop enforces the 100-piece server rule and exposes payment/status flow',()=>{
  const server=fs.readFileSync(path.join(root,'backend/server.js'),'utf8');
  const pos=fs.readFileSync(path.join(root,'sa/index.html'),'utf8');
  assert.match(server,/minimumQuantity:\s*100/);
  assert.match(server,/app\.post\("\/paper-rolls\/orders"/);
  assert.match(server,/\['Online', 'Cash on Delivery'\]/);
  assert.match(server,/quantity < product\.minimumQuantity/);
  assert.match(server,/app\.post\("\/paper-rolls\/orders\/:orderId\/verify"/);
  assert.match(pos,/Paper Roll Order/);
  assert.match(pos,/id="paperRollQty"[^>]+min="\$\{min\}"/);
  assert.match(pos,/Online payment/);
  assert.match(pos,/Cash on Delivery/);
  assert.match(pos,/My Paper Roll Orders/);
});

test('Super Admin Paper Rolls page renders order details and sends status updates',async()=>{
  const dom=new JSDOM('<main id="page"></main>',{runScripts:'outside-only'}),w=dom.window;
  w.CSS ||= {}; w.CSS.escape ||= value=>String(value).replace(/[^a-zA-Z0-9_-]/g,'\\$&');
  w.eval(fs.readFileSync(path.join(root,'marketing-web/paper-roll-orders.js'),'utf8'));
  const order={orderId:'AXZEN_ROLL_AXC1_1',canteenId:'AXC1',canteenName:'Test Canteen',customerName:'Ravi',phone:'9876543210',deliveryAddress:'Hyderabad 500019',quantity:100,unitPrice:15,amount:1500,paymentMethod:'Cash on Delivery',paymentStatus:'COD',status:'Placed',createdAt:new Date().toISOString()};
  w.document.getElementById('page').innerHTML=w.PaperRollOrders.render({orders:[order]});
  assert.match(w.document.body.textContent,/Test Canteen/);
  assert.match(w.document.body.textContent,/100 pcs/);
  assert.match(w.document.body.textContent,/Cash on Delivery/);
  const calls=[];
  w.PaperRollOrders.bind({api:async(path,options)=>calls.push({path,body:JSON.parse(options.body)}),refresh:async()=>{},notify:()=>{}});
  const select=w.document.querySelector('[data-paper-status]'); select.value='Packed';
  w.document.querySelector('[data-paper-update]').click();
  await new Promise(resolve=>w.setTimeout(resolve,0));
  assert.equal(calls[0].path,'/marketing-api/paper-roll-orders/AXZEN_ROLL_AXC1_1/status');
  assert.equal(calls[0].body.status,'Packed');
  dom.window.close();
});
