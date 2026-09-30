const fs=require('fs');const path=require('path');
const root=path.resolve(__dirname,'../sa');
const version=(process.argv.find((x,i,a)=>a[i-1]==='--version')||'').trim();
if(!/^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/.test(version))throw Error('Run: npm run release:pos -- --version 4.0.1');
const output=path.resolve(__dirname,`../release-files/Axzen-POS-Web-${version}.zip`);
const table=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
const crc32=buffer=>{let crc=0xffffffff;for(const byte of buffer)crc=table[(crc^byte)&255]^(crc>>>8);return(crc^0xffffffff)>>>0;};
const files=[];function walk(dir,prefix=''){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const rel=(prefix?prefix+'/':'')+entry.name;const full=path.join(dir,entry.name);if(entry.isDirectory())walk(full,rel);else files.push({name:rel.replace(/\\/g,'/'),data:fs.readFileSync(full)});}}walk(root);
const versionFile=files.find(file=>file.name==='app-version.js');
if(!versionFile)throw Error('Missing app-version.js');
versionFile.data=Buffer.from(versionFile.data.toString('utf8').replace(/const bundledVersion = '[^']*';/,`const bundledVersion = '${version}';`));
files.push({name:'axzen-release.json',data:Buffer.from(JSON.stringify({version,builtAt:new Date().toISOString()}))});
const local=[],central=[];let offset=0;for(const file of files){const name=Buffer.from(file.name),crc=crc32(file.data);const h=Buffer.alloc(30);h.writeUInt32LE(0x04034b50);h.writeUInt16LE(20,4);h.writeUInt16LE(0,6);h.writeUInt16LE(0,8);h.writeUInt32LE(crc,14);h.writeUInt32LE(file.data.length,18);h.writeUInt32LE(file.data.length,22);h.writeUInt16LE(name.length,26);local.push(h,name,file.data);const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt32LE(crc,16);c.writeUInt32LE(file.data.length,20);c.writeUInt32LE(file.data.length,24);c.writeUInt16LE(name.length,28);c.writeUInt32LE(offset,42);central.push(c,name);offset+=h.length+name.length+file.data.length;}
const centralBuffer=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(centralBuffer.length,12);end.writeUInt32LE(offset,16);fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,Buffer.concat([...local,centralBuffer,end]));console.log(output);console.log(`${files.length} files, ${fs.statSync(output).size} bytes`);
