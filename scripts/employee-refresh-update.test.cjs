const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

test('employee app refreshes after data changes, on resume, by polling and pull gesture', () => {
  const source = fs.readFileSync(path.join(root, 'employee-web/index.html'), 'utf8');
  assert.match(source, /setInterval\(automaticRefresh, 15000\)/);
  assert.match(source, /document\.addEventListener\("visibilitychange"/);
  assert.match(source, /surface\.addEventListener\("touchmove"/);
  assert.match(source, /await refreshData\(\{ silent: true \}\)/);
  assert.match(source, /if \(repaint .* render\(\);/);
});

test('employee updates use a separate manifest, targets and release ZIP', () => {
  const server = fs.readFileSync(path.join(root, 'backend/server.js'), 'utf8');
  const consoleSource = fs.readFileSync(path.join(root, 'marketing-web/app-releases.js'), 'utf8');
  const zip = fs.readFileSync(path.join(root, 'release-files/Axzen-Employee-Web-1.32.0.zip'));
  assert.match(server, /"\/employee-app-update\/manifest"/);
  assert.match(server, /employeeReleaseId/);
  assert.match(consoleSource, /Target Employee/);
  assert.match(consoleSource, /employeeIds/);
  assert.equal(zip.readUInt32LE(0), 0x04034b50);
  assert.ok(zip.includes(Buffer.from('axzen-release.json')));
  assert.ok(zip.includes(Buffer.from('employee-1.32.0')));
});
