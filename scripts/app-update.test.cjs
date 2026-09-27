const test=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');const path=require('path');

test('POS updater downloads assigned bundle and passes integrity data to native',async()=>{
  const {JSDOM}=require('jsdom');const dom=new JSDOM('',{url:'https://localhost',runScripts:'outside-only'}),w=dom.window;
  const installed=[];w.AxzenUpdater={current:()=>JSON.stringify({version:'bundled',sha256:''}),installBundle:(base64,version,sha,signature)=>{installed.push({base64,version,sha,signature});return JSON.stringify({success:true});},markHealthy:()=>{}};
  w.fetch=async url=>url.endsWith('/app-update/manifest')?{status:200,ok:true,json:async()=>({release:{version:'4.0.1',sha256:'abc',signature:'signed',downloadUrl:'/app-update/bundles/1'}})}:{ok:true,arrayBuffer:async()=>Uint8Array.from([80,75,3,4]).buffer};
  w.eval(fs.readFileSync(path.join(__dirname,'../sa/app-updater.js'),'utf8'));await w.AxzenAppUpdater.check({apiBase:'https://api.test',token:'token'});
  assert.equal(installed[0].version,'4.0.1');assert.equal(installed[0].sha,'abc');assert.equal(installed[0].signature,'signed');assert.ok(installed[0].base64);dom.window.close();
});

test('release builder output is a ZIP with root index and updater files',()=>{
  const file=path.join(__dirname,'../release-files/Axzen-POS-Web-3.68.0.zip');const zip=fs.readFileSync(file);
  assert.equal(zip.readUInt32LE(0),0x04034b50);assert.ok(zip.includes(Buffer.from('index.html')));assert.ok(zip.includes(Buffer.from('app-updater.js')));assert.ok(zip.includes(Buffer.from('axzen-release.json')));
});

test('marketing release screen publishes only checked canteens',async()=>{
  const {JSDOM}=require('jsdom');const dom=new JSDOM('<main id="page"></main>',{runScripts:'outside-only'}),w=dom.window;
  w.eval(fs.readFileSync(path.join(__dirname,'../marketing-web/app-releases.js'),'utf8'));w.document.querySelector('#page').innerHTML=w.AppReleases.render({releases:[{_id:'r1',version:'4.0.1',status:'Draft',sha256:'abc',size:100}],canteens:[{id:7,canteenName:'Suguna Chicken Center',activatedCanteenId:'AXC-7'}]});
  const calls=[];w.AppReleases.bind({api:async(route,options)=>calls.push([route,JSON.parse(options.body)]),refresh:async()=>{},notify:()=>{}});w.document.querySelector('[data-release-target]').checked=true;w.document.querySelector('[data-publish-release]').click();await new Promise(r=>setTimeout(r,5));
  assert.deepEqual(calls[0],['/marketing-api/app-releases/r1/publish',{canteenIds:[7]}]);dom.window.close();
});
