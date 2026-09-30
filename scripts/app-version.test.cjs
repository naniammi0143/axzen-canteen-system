const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
test('version follows the active native bundle, including updates and rollback, with a bundled/web fallback',()=>{
 const window={};vm.runInNewContext(fs.readFileSync(path.join(root,'sa/app-version.js'),'utf8'),{window});
 assert.equal(window.AxzenVersion.current(),'3.82.0');assert.equal(window.AxzenVersion.client(),'web');
 let version='3.81.0';window.AxzenUpdater={current:()=>JSON.stringify({version})};
 assert.equal(window.AxzenVersion.current(),'3.81.0');assert.equal(window.AxzenVersion.client(),'android');
 version='4.2.0';assert.equal(window.AxzenVersion.current(),'4.2.0');version='3.81.0';assert.equal(window.AxzenVersion.current(),'3.81.0');
 version='bundled';assert.equal(window.AxzenVersion.current(),'3.82.0');
});
test('web and Android version reporting remain separate and tenant-scoped',async()=>{
 const source=fs.readFileSync(path.join(root,'backend/server.js'),'utf8'),start=source.indexOf('async function markCanteenSeen('),end=source.indexOf('\nfunction ',start);
 const memory={marketingCanteens:[{activatedCanteenId:'A'},{activatedCanteenId:'B'}]};const ctx=vm.createContext({memory,mongoReady:false,normalizeCanteenId:x=>x,DEFAULT_CANTEEN_ID:'A'});
 vm.runInContext(source.slice(start,end),ctx);
 await ctx.markCanteenSeen('A','3.82.0','android');await ctx.markCanteenSeen('A','4.0.0','web');await ctx.markCanteenSeen('A','bundled','android');
 assert.equal(memory.marketingCanteens[0].appInstalledVersion,'3.82.0');assert.equal(memory.marketingCanteens[0].webInstalledVersion,'4.0.0');
 assert.ok(memory.marketingCanteens[0].appVersionReportedAt);assert.equal(memory.marketingCanteens[1].appInstalledVersion,undefined);
 await ctx.markCanteenSeen('A','3.81.0');assert.equal(memory.marketingCanteens[0].appInstalledVersion,'3.81.0');
});
test('console release targets distinguish the installed version from the assigned version',()=>{
 const window={};vm.runInNewContext(fs.readFileSync(path.join(root,'marketing-web/app-releases.js'),'utf8'),{window});
 const html=window.AppReleases.render({canteens:[{id:1,activatedCanteenId:'A',canteenName:'Test',appInstalledVersion:'3.81.0',appReleaseVersion:'3.82.0'}]});
 assert.match(html,/Installed: 3.81.0/);assert.match(html,/Assigned: 3.82.0/);
});
test('release ZIP stamps its own version instead of reusing a previous source version',()=>{
 const version='test-'+process.pid,file=path.join(root,'release-files','Axzen-POS-Web-'+version+'.zip');
 try{
  require('node:child_process').execFileSync(process.execPath,[path.join(root,'scripts/build-pos-release.cjs'),'--version',version],{stdio:'pipe'});
  const zip=fs.readFileSync(file);let offset=0,versionSource='';
  while(zip.readUInt32LE(offset)===0x04034b50){const size=zip.readUInt32LE(offset+18),length=zip.readUInt16LE(offset+26),extra=zip.readUInt16LE(offset+28),name=zip.subarray(offset+30,offset+30+length).toString();const dataStart=offset+30+length+extra;if(name==='app-version.js')versionSource=zip.subarray(dataStart,dataStart+size).toString();offset=dataStart+size;}
  assert.ok(versionSource.includes(`const bundledVersion = '${version}';`));
 }finally{if(fs.existsSync(file))fs.unlinkSync(file);}
});
