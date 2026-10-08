const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'employee-web/index.html'),'utf8');
const script=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].at(-1)[1];
function fixture(url){
  const dom=new JSDOM(html,{url,runScripts:'outside-only'}),w=dom.window;
  w.scrollTo=()=>{};w.fetch=async()=>({ok:true,json:async()=>({})});
  w.eval(script+'\nwindow.testEmployee={API,api};');
  return {w,dom};
}
test('employee app uses the live API when hosted away from the backend',()=>{
  for(const url of ['https://pos.axzen.in/employee/','https://employee.axzen.in/']){
    const f=fixture(url);try{assert.equal(f.w.testEmployee.API,'https://axzen-canteen-system.vercel.app');}finally{f.dom.window.close();}
  }
  const backend=fixture('https://axzen-canteen-system.vercel.app/employee/');
  try{assert.equal(backend.w.testEmployee.API,'');}finally{backend.dom.window.close();}
});
test('employee login shows a useful network error instead of Failed to fetch',async()=>{
  const f=fixture('https://pos.axzen.in/employee/');
  try{f.w.fetch=async()=>{throw new TypeError('Failed to fetch')};await assert.rejects(f.w.testEmployee.api('/marketing-api/login'),/Server not reachable/);}
  finally{f.dom.window.close();}
});
