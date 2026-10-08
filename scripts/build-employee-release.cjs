const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../employee-web');
const version = (process.argv.find((value, index, args) => args[index - 1] === '--version') || '').trim();
if (!/^employee-[A-Za-z0-9][A-Za-z0-9._-]{0,30}$/.test(version)) throw Error('Run: npm run release:employee -- --version employee-1.32.0');
const output = path.resolve(__dirname, `../release-files/Axzen-Employee-Web-${version.replace(/^employee-/, '')}.zip`);
const table = Array.from({ length: 256 }, (_, number) => { let value = number; for (let bit = 0; bit < 8; bit++) value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1; return value >>> 0; });
const crc32 = buffer => { let crc = 0xffffffff; for (const byte of buffer) crc = table[(crc ^ byte) & 255] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; };
const files = [];
function walk(directory, prefix = '') {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const relative = (prefix ? `${prefix}/` : '') + entry.name;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full, relative);
    else files.push({ name: relative.replace(/\\/g, '/'), data: fs.readFileSync(full) });
  }
}
walk(root);
const versionFile = files.find(file => file.name === 'app-version.js');
if (!versionFile) throw Error('Missing app-version.js');
versionFile.data = Buffer.from(versionFile.data.toString('utf8').replace(/const bundledVersion = '[^']*';/, `const bundledVersion = '${version}';`));
files.push({ name: 'axzen-release.json', data: Buffer.from(JSON.stringify({ version, appType: 'employee', builtAt: new Date().toISOString() })) });
const local = [], central = []; let offset = 0;
for (const file of files) {
  const name = Buffer.from(file.name), crc = crc32(file.data), header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4); header.writeUInt32LE(crc, 14); header.writeUInt32LE(file.data.length, 18); header.writeUInt32LE(file.data.length, 22); header.writeUInt16LE(name.length, 26);
  local.push(header, name, file.data);
  const directory = Buffer.alloc(46); directory.writeUInt32LE(0x02014b50); directory.writeUInt16LE(20, 4); directory.writeUInt16LE(20, 6); directory.writeUInt32LE(crc, 16); directory.writeUInt32LE(file.data.length, 20); directory.writeUInt32LE(file.data.length, 24); directory.writeUInt16LE(name.length, 28); directory.writeUInt32LE(offset, 42);
  central.push(directory, name); offset += header.length + name.length + file.data.length;
}
const centralBuffer = Buffer.concat(central), end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(centralBuffer.length, 12); end.writeUInt32LE(offset, 16);
fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, Buffer.concat([...local, centralBuffer, end]));
console.log(output); console.log(`${files.length} files, ${fs.statSync(output).size} bytes`);
