const fs = require('node:fs');
const path = require('node:path');
const files = ['index.html', 'business-rules.js', 'dine-in.js', 'dine-in.css', 'bill-taxes.js', 'dine-in-offline.js', 'restaurant-settings.js', 'restaurant-settings.css', 'offline-worker.js', 'app-updater.css'];
const normalize = text => text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
Promise.allSettled(files.map(async file => {
 const response = await fetch('https://pos.axzen.in/partner/' + (file === 'index.html' ? '' : file), { signal: AbortSignal.timeout(20000) });
 const matches = response.ok && normalize(await response.text()) === normalize(fs.readFileSync(path.join(__dirname, '../sa', file), 'utf8'));
 console.log(JSON.stringify({ file, status: response.status, matches }));
 if (!matches) process.exitCode = 1;
})).then(results => results.forEach(result => { if (result.status === 'rejected') { console.error(result.reason.message); process.exitCode = 1; } }));
