const test = require('node:test');
const assert = require('node:assert/strict');
const {csvRows, normalizeItems, extract, images} = require('../backend/catalog-import');
test('Grok uploads PDF, extracts review items, and deletes temporary file', async () => {
  const old = {provider:process.env.CATALOG_AI_PROVIDER,key:process.env.XAI_API_KEY};
  process.env.CATALOG_AI_PROVIDER='grok'; process.env.XAI_API_KEY='test-only';
  const calls=[];
  try {
    const result=await extract({filename:'menu.pdf',data:'data:application/pdf;base64,'+Buffer.from('%PDF-test').toString('base64')},async(url,options)=>{
      calls.push({url,options});
      if(url.endsWith('/files'))return {ok:true,json:async()=>({id:'file-test'})};
      if(options.method==='DELETE')return {ok:true};
      const body=JSON.parse(options.body);
      assert.equal(body.input[0].content[1].file_id,'file-test');assert.equal(body.store,false);
      return {ok:true,json:async()=>({output:[{content:[{type:'output_text',text:JSON.stringify({items:[{name:'Tea',price:10,category:'Drinks',unit:'Cup'}]})}]}]})};
    });
    assert.equal(result.method,'Grok AI');assert.equal(calls.at(-1).options.method,'DELETE');
  } finally {
    for(const [key,value] of [['CATALOG_AI_PROVIDER',old.provider],['XAI_API_KEY',old.key]]) { if(value===undefined)delete process.env[key];else process.env[key]=value; }
  }
});
test('matching reuses catalog image and marks existing menu items without fuzzy substitutions', () => {
  const {JSDOM}=require('jsdom');const fs=require('fs');
  const dom=new JSDOM('',{runScripts:'outside-only'});
  dom.window.eval(fs.readFileSync(require('path').join(__dirname,'../sa/catalog-import.js'),'utf8'));
  const rows=dom.window.CatalogImport.matchCatalog([{name:'MASALA   DOSA',price:65},{name:'Tea',price:12},{name:'Egg Dosa',price:80}], [{name:'Masala Dosa',image:'https://example.com/dosa.jpg',active:false},{name:'Tea',active:true}]);
  assert.equal(rows[0].image,'https://example.com/dosa.jpg');assert.equal(rows[0].price,65);assert.equal(rows[0].selected,true);
  assert.equal(rows[1].selected,false);assert.equal(rows[2].matchStatus,'New item');dom.window.close();
});
test('matching flags repeated catalog names for human review', () => {
  const {JSDOM}=require('jsdom');const fs=require('fs');
  const dom=new JSDOM('',{runScripts:'outside-only'});
  dom.window.eval(fs.readFileSync(require('path').join(__dirname,'../sa/catalog-import.js'),'utf8'));
  const rows=dom.window.CatalogImport.matchCatalog([
    {name:'Sweet Appetizer 1',price:25,category:'Appetizer'},
    {name:'Sweet Appetizer 1',price:25,category:'Desserts'},
    {name:'Fresh Drink 1',price:15,category:'Drinks'}
  ], []);
  assert.match(rows[0].duplicateIssue,/more than once/);
  assert.match(rows[1].duplicateIssue,/more than once/);
  assert.equal(rows[2].duplicateIssue,'');dom.window.close();
});
test('CSV supports quoted names, commas, missing prices and row limits', () => {
  const items = normalizeItems(csvRows('name,price,category\n"Rice, special",120,Meals\nTea,,Drinks'));
  assert.equal(items[0].name, 'Rice, special'); assert.equal(items[0].price, 120); assert.equal(items[1].price, null);
  assert.throws(() => csvRows('item,cost\nTea,10'), /name and price/);
  assert.throws(() => normalizeItems(Array.from({length:101},()=>({name:'Tea',price:10}))), /1–100/);
});
test('CSV extraction only returns a review draft and does not invoke AI', async () => {
  const data = 'data:text/csv;base64,'+Buffer.from('name,price\nTea,10').toString('base64');
  const result = await extract({filename:'menu.csv',data},()=>{throw Error('No network expected');});
  assert.equal(result.items[0].name,'Tea'); assert.equal(result.method,'CSV');
  await assert.rejects(extract({filename:'x.exe',data:'data:application/octet-stream;base64,AAAA'}), /Use PDF/);
});
test('image results use reusable licensed images and preserve source', async () => {
  const result = await images('Tea',async()=>({ok:true,json:async()=>({query:{pages:{1:{imageinfo:[{url:'https://example.com/tea.jpg',descriptionurl:'https://example.com/source',extmetadata:{LicenseShortName:{value:'CC0'}}}]},2:{imageinfo:[{url:'https://example.com/other.jpg',extmetadata:{LicenseShortName:{value:'CC BY-SA'}}}]}}}})}));
  assert.equal(result.length,2); assert.equal(result[0].source,'https://example.com/source');
});
test('catalog review never saves until reviewed and Proceed is clicked', async () => {
  const {JSDOM} = require('jsdom');
  const fs = require('fs');
  const dom = new JSDOM('<body></body>', {url:'https://preview.invalid',runScripts:'outside-only'});
  const w = dom.window; w.HTMLDialogElement.prototype.showModal = function(){this.open=true;};
  w.eval(fs.readFileSync(require('path').join(__dirname,'../sa/catalog-import.js'),'utf8'));
  const writes=[];
  w.CatalogImport.open({api:async(path,opts)=>{
    if(path==='/catalog/import/preview')return {method:'CSV',items:[{name:'Tea',price:10,category:'Drinks',unit:'Cup',image:'',selected:true}]};
    if(path.startsWith('/catalog/import/images'))return {images:[]};
    if(path==='/catalog/all-items')return [];
    if(path==='/products'){writes.push(JSON.parse(opts.body));return {};}
    throw Error(path);
  },onSaved:async()=>{}});
  const input=w.document.querySelector('#catalogFile');
  Object.defineProperty(input,'files',{value:[new w.File(['name,price\nTea,10'],'menu.csv',{type:'text/csv'})]});
  input.dispatchEvent(new w.Event('input',{bubbles:true}));
  w.document.querySelector('[data-action="extract"]').click();
  for(let i=0;i<30 && !w.document.querySelector('#catalogReviewed');i++)await new Promise(r=>setTimeout(r,10));
  assert.equal(writes.length,0);
  assert.equal(w.document.querySelector('[data-action="proceed"]').disabled,true);
  const name=w.document.querySelector('[data-field="name"]');name.value='Masala Tea';name.dispatchEvent(new w.Event('input',{bubbles:true}));
  const checked=w.document.querySelector('#catalogReviewed');checked.checked=true;checked.dispatchEvent(new w.Event('input',{bubbles:true}));
  w.document.querySelector('[data-action="proceed"]').click();
  await new Promise(r=>setTimeout(r,20));
  assert.equal(writes.length,1);assert.equal(writes[0].name,'Masala Tea');
  dom.window.close();
});
