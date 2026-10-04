const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');
test('POS and admin inline scripts parse and required offline assets are packaged',()=>{
 for(const file of ['sa/index.html','admin-web/index.html']){
  const doc=new JSDOM(fs.readFileSync(path.join(root,file),'utf8')).window.document;let count=0;
  for(const script of doc.scripts)if(!script.src&&script.textContent.trim()){new vm.Script(script.textContent,{filename:file});count++;}
  assert.ok(count>0);
 }
 for(const file of ['bill-taxes.js','dine-in-offline.js','restaurant-settings.js','offline-shell.js','offline-worker.js'])new vm.Script(fs.readFileSync(path.join(root,'sa',file),'utf8'),{filename:file});
});
test('tax checkboxes save exactly one GST system and automatically pair CGST with SGST',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://test.invalid',runScripts:'outside-only'}),w=dom.window;
 w.eval(fs.readFileSync(path.join(root,'sa/bill-taxes.js'),'utf8'));w.eval(fs.readFileSync(path.join(root,'sa/restaurant-settings.js'),'utf8'));
 const calls=[];let saved;
 w.RestaurantSettings.mount(w.document.getElementById('root'),{settings:{},api:async(p,o)=>{if(p==='/dine-in')return {tables:[]};const body=JSON.parse(o.body);calls.push(body);return {settings:body};},onSaved:v=>saved=v});
 await new Promise(r=>setTimeout(r,10));
 w.document.querySelector('[data-rate="cgst"]').value=2.5;w.document.querySelector('[data-rate="sgst"]').value=2.5;
 const cgst=w.document.querySelector('[data-tax="cgst"]');cgst.checked=true;cgst.dispatchEvent(new w.Event('change',{bubbles:true}));
 assert.equal(w.document.querySelector('[data-tax="sgst"]').checked,true);
 w.document.querySelector('[data-print="cashier"]').checked=false;
 w.document.querySelector('#rs-tax-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,10));
 assert.equal(saved.taxSettings.rows.filter(r=>r.enabled).map(r=>r.name).join(','),'CGST,SGST');assert.equal(saved.taxSettings.print.cashier,false);
 assert.equal(w.BillTaxes.calculate(200,0,saved.taxSettings).taxes.map(r=>r.name).join(','),'CGST,SGST');
 const gst=w.document.querySelector('[data-tax="gst"]');w.document.querySelector('[data-rate="gst"]').value=5;gst.checked=true;gst.dispatchEvent(new w.Event('change',{bubbles:true}));
 assert.equal(w.document.querySelector('[data-tax="cgst"]').checked,false);assert.equal(w.document.querySelector('[data-tax="sgst"]').checked,false);
 w.document.querySelector('#rs-tax-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,10));
 assert.equal(calls.length,2);assert.equal(saved.taxSettings.rows.filter(r=>r.enabled).map(r=>r.name).join(','),'GST');assert.match(w.document.querySelector('.rs-message').textContent,/Checked taxes/);w.close();
});

test('slow table loading preserves GST edits and the entered rate saves and calculates',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://test.invalid',runScripts:'outside-only'}),w=dom.window;
 w.eval(fs.readFileSync(path.join(root,'sa/bill-taxes.js'),'utf8'));w.eval(fs.readFileSync(path.join(root,'sa/restaurant-settings.js'),'utf8'));
 let release,saved;
 w.RestaurantSettings.mount(w.document.getElementById('root'),{settings:{},api:async(p,o)=>p==='/dine-in'?await new Promise(r=>release=r):{settings:JSON.parse(o.body)},onSaved:v=>saved=v});
 const rate=w.document.querySelector('[data-rate="gst"]');rate.value='5';w.document.querySelector('[data-tax="gst"]').checked=true;
 release({tables:[]});await new Promise(r=>setTimeout(r,10));
 assert.equal(w.document.querySelector('[data-rate="gst"]'),rate,'table refresh must not replace tax inputs');
 assert.equal(rate.value,'5');assert.equal(w.document.querySelector('[data-tax="gst"]').checked,true);
 w.document.querySelector('#rs-tax-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,10));
 assert.equal(w.BillTaxes.calculate(200,0,saved.taxSettings).total,210);
 assert.equal(w.document.querySelector('[data-rate="gst"]').value,'5');w.close();
});
