"""Package only deployable source; never include credentials, caches or dependencies."""
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parent.parent
target = root / 'release-files' / 'Axzen-Restaurant-Update-3.80.0.zip'
allowed = {'.js', '.cjs', '.json', '.html', '.css', '.png', '.jpg', '.jpeg', '.svg', '.webp', '.txt', '.md'}
files = []
for name in ('backend', 'sa', 'admin-web', 'marketing-web', 'employee-web', 'api', 'pos-axzen-in/partner', 'pos-axzen-in/api', 'pos-axzen-in/assets', 'pos-axzen-in/sales'):
    directory = root / name
    if not directory.exists():
        continue
    for file in directory.rglob('*'):
        relative = file.relative_to(root)
        if file.is_file() and file.suffix in allowed and not any(part in ('node_modules', '.git', '.codex', '.agents', 'build') for part in relative.parts) and not file.name.startswith('.') and not file.name.endswith('.test.js'):
            files.append(file)
for name in ('package.json', 'package-lock.json', 'vercel.json', 'README.md', 'pos-axzen-in/index.html', 'pos-axzen-in/package.json', 'pos-axzen-in/package-lock.json', 'pos-axzen-in/vercel.json'):
    if (root / name).is_file():
        files.append(root / name)
with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as archive:
    for file in sorted(files):
        archive.write(file, file.relative_to(root).as_posix())
    archive.writestr('RELEASE-3.80.txt', '''Axzen Restaurant 3.80

Home-style Dine In selection and Current Order; fixed single-item category sizes;
GST form edits survive table loading, saved rates refresh totals and offline cache.

There are TWO deployments: root source serves the backend and admin panel;
pos-axzen-in/ is the separate website source for https://pos.axzen.in/partner/.
Deploy the nested website directory to its existing project as well. Deploying
only the root project will NOT update the custom-domain POS frontend.

Deploy this source update to the existing backend and web host before using APK
3.79. Keep the existing environment variables and database; no credentials are
included here. Keep backend/ and sa/ together: the server imports bill-taxes.js.
Do not replace server .env or signing keys. Install existing npm dependencies
using the lockfiles, then use the usual deployment/start process.

GET /dine-in must return offlineVersion: 1. Admin Settings includes Tax settings
and Table settings. First connect each mobile/tablet once to cache the restaurant
and menu. Orders and payments then persist offline on that device and sync when
internet returns. Conflicts remain queued for review instead of being overwritten.

This archive is deployable source, not an automatic deployment. See
sa/DINE-IN-README.txt for configuration and operational details.
''')
with zipfile.ZipFile(target) as archive:
    assert archive.testzip() is None
    assert 'backend/dine-in.js' in archive.namelist()
    assert 'sa/bill-taxes.js' in archive.namelist()
    assert not any('/node_modules/' in n or n.endswith('/.env') for n in archive.namelist())
print(target)
print(f'{len(files)} source files; {target.stat().st_size:,} bytes')
