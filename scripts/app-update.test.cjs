const test=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');const path=require('path');

const {JSDOM}=require('jsdom');
const tick=()=>new Promise(resolve=>setTimeout(resolve,10));
function updaterFixture() {
  const dom=new JSDOM('<button data-app-notifications aria-label="Notifications">Bell</button>',{url:'https://localhost',runScripts:'outside-only'}),w=dom.window;
  const installed=[],requests=[];
  let assigned={version:'4.0.1',sha256:'abc',signature:'signed',size:4,notes:'Faster billing <script>unsafe</script>',downloadUrl:'/app-update/bundles/1'}, fail=false;
  w.AxzenUpdater={current:()=>JSON.stringify({version:'bundled',sha256:''}),installBundle:(base64,version,sha,signature)=>{installed.push({base64,version,sha,signature});return JSON.stringify({success:true});},markHealthy:()=>{}};
  w.fetch=async (url,opts)=>{requests.push({url,opts});return url.endsWith('/app-update/manifest') ? assigned ? {status:200,ok:true,json:async()=>({release:assigned})} : {status:204} : {ok:!fail,arrayBuffer:async()=>Uint8Array.from([80,75,3,4]).buffer};};
  w.eval(fs.readFileSync(path.join(__dirname,'../sa/app-updater.js'),'utf8'));
  return {w,installed,requests,setRelease:value=>assigned=value,setFail:value=>fail=value,close:()=>{w.AxzenAppUpdater.stop();dom.window.close();}};
}
test('assigned update appears in bell and installs only after user clicks Update now',async()=>{
  const f=updaterFixture(),w=f.w;
  try {
    w.AxzenAppUpdater.start({apiBase:'https://api.test',token:'token'});await tick();
    assert.equal(f.installed.length,0);assert.equal(f.requests.length,1);
    assert.ok(w.document.querySelector('.app-update-badge'));
    w.document.querySelector('[data-app-notifications]').click();await tick();
    assert.match(w.document.querySelector('dialog').textContent,/4.0.1/);
    assert.equal(w.document.querySelector('dialog script'),null);
    w.document.querySelector('[data-update-install]').click();await tick();
    assert.equal(f.installed.length,1);assert.equal(f.installed[0].sha,'abc');assert.equal(f.installed[0].signature,'signed');assert.ok(f.installed[0].base64);
    assert.equal(w.document.querySelector('.app-update-badge'),null);
    assert.equal(f.requests.at(-1).opts.headers.Authorization,'Bearer token');
  } finally {f.close();}
});
test('unassigned and already installed releases do not show a notification',async()=>{
  const f=updaterFixture();
  try {
    f.setRelease(null);f.w.AxzenAppUpdater.start({apiBase:'',token:'token'});await tick();
    assert.equal(f.w.document.querySelector('.app-update-badge'),null);
    f.setRelease({sha256:'abc'});f.w.AxzenUpdater.current=()=>({sha256:'abc'});await f.w.AxzenAppUpdater.check();
    assert.equal(f.w.document.querySelector('.app-update-badge'),null);assert.equal(f.installed.length,0);
  } finally {f.close();}
});
test('failed download can retry and a withdrawn assignment cannot install',async()=>{
  const f=updaterFixture();
  try {
    f.w.AxzenAppUpdater.start({apiBase:'',token:'token'});await tick();f.setFail(true);
    await f.w.AxzenAppUpdater.install();assert.equal(f.installed.length,0);assert.ok(f.w.document.querySelector('.app-update-badge'));
    f.setFail(false);await f.w.AxzenAppUpdater.install();assert.equal(f.installed.length,1);
    await f.w.AxzenAppUpdater.check();f.setRelease(null);await f.w.AxzenAppUpdater.install();assert.equal(f.installed.length,1);
    assert.equal(f.w.document.querySelector('.app-update-badge'),null);
  } finally {f.close();}
});
test('logout discards an in-flight notification response',async()=>{
  const f=updaterFixture();
  try {
    let resolve;f.w.fetch=()=>new Promise(r=>resolve=r);
    f.w.AxzenAppUpdater.start({apiBase:'',token:'old-tenant'});f.w.AxzenAppUpdater.stop();
    resolve({status:200,ok:true,json:async()=>({release:{sha256:'old',version:'old'}})});await tick();
    assert.equal(f.w.document.querySelector('.app-update-badge'),null);assert.equal(f.installed.length,0);
  } finally {f.close();}
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
