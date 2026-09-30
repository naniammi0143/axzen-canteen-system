const fs=require('fs'),path=require('path'),{spawn}=require('child_process'),{pathToFileURL}=require('url');
const root=path.resolve(__dirname,'..'),output=path.join(root,'release-files'),port=9335;
const browser=spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',['--headless=new','--disable-gpu','--no-first-run',`--remote-debugging-port=${port}`,`--user-data-dir=${path.join(output,'layout-check-profile')}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 let targets;for(let n=0;n<50;n++){try{targets=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();if(targets.length)break;}catch{}await delay(200);}
 if(!targets?.length)throw Error('Browser did not start');
 const socket=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
 let id=0;const pending=new Map();socket.onmessage=e=>{const msg=JSON.parse(e.data);if(pending.has(msg.id)){const {resolve,reject}=pending.get(msg.id);pending.delete(msg.id);msg.error?reject(Error(msg.error.message)):resolve(msg.result);}};
 const call=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});socket.send(JSON.stringify({id:key,method,params}));});
 const evaluate=expression=>call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true}).then(r=>{if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;});
 await call('Page.enable');
 const results=[];
 for(const [name,width,height] of [['desktop',1680,1050],['tablet',1024,900],['mobile',390,844]]){
  await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
  await call('Page.navigate',{url:pathToFileURL(path.join(root,'sa/dine-in-preview.html')).href});await delay(1200);
  if(name==='mobile'){await evaluate(`document.querySelector('[data-di="select"][data-value="t2"]').click()`);await delay(200);}
  await evaluate(`document.querySelector('[data-di="quick-add"]').click()`);await delay(150);
  if(name==='mobile'){await evaluate(`document.querySelector('[data-di="cart-toggle"]').click()`);await delay(100);}
  const metrics=await evaluate(`(()=>{const g=document.querySelector('.di-food-grid'),c=document.querySelector('.di-categories'),o=document.querySelector('.di-new-order');return {width:innerWidth,pageWidth:document.documentElement.scrollWidth,gridHeight:g.clientHeight,gridScroll:g.scrollHeight,gridBottom:g.getBoundingClientRect().bottom,categoryTop:c.getBoundingClientRect().top,orderBottom:o.getBoundingClientRect().bottom,orderTop:o.getBoundingClientRect().top}})()`);
  await evaluate(`document.querySelector('.di-food-grid').scrollTop=180`);
  metrics.categoryAfter=await evaluate(`document.querySelector('.di-categories').getBoundingClientRect().top`);
  const shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(output,`dine-in-${name}-3.79.png`),Buffer.from(shot.data,'base64'));
  if(metrics.pageWidth>width+1||metrics.gridHeight<50||Math.abs(metrics.categoryAfter-metrics.categoryTop)>1||metrics.orderBottom>height+1||(name==='mobile' && metrics.gridBottom>metrics.orderTop+1))throw Error(`${name}: layout check failed ${JSON.stringify(metrics)}`);
  results.push({name,...metrics});
 }
 console.log(JSON.stringify(results,null,2));await call('Browser.close');socket.close();
})().catch(e=>{console.error(e);browser.kill();process.exitCode=1;});
