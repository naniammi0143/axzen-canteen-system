window.AppReleases = (() => {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const typeOf = release => release.appType === 'employee' ? 'employee' : 'pos';
  let selectedType = 'pos';

  function targetRows(type, canteens, users) {
    if (type === 'employee') {
      const rows = users.filter(user => user.active !== false);
      return rows.map(user => `<label class="release-target"><input type="checkbox" data-release-target value="${esc(user.employeeId)}"><span><strong>${esc(user.name)}</strong><small>${esc(user.employeeId)} · ${esc(user.department || 'Employee')}</small><small>Installed: ${esc(user.employeeInstalledVersion || 'Not reported')} · Assigned: ${esc(user.employeeReleaseVersion || 'None')}</small></span></label>`).join('') || '<span class="muted">No active employees.</span>';
    }
    const rows = canteens.filter(canteen => canteen.activatedCanteenId);
    return rows.map(canteen => `<label class="release-target"><input type="checkbox" data-release-target value="${canteen.id}"><span><strong>${esc(canteen.canteenName)}</strong><small>${esc(canteen.activatedCanteenId)} · Installed: ${esc(canteen.appInstalledVersion || 'Not reported')}</small><small>Assigned: ${esc(canteen.appReleaseVersion || 'None')}</small></span></label>`).join('') || '<span class="muted">No approved canteens.</span>';
  }

  function releaseCards(releases) {
    return releases.map(release => {
      const type = typeOf(release);
      const label = type === 'employee' ? 'Employee App' : 'Canteen POS';
      return `<article class="release-card"><div class="release-card-head"><div><h3>${esc(release.version)}</h3><span class="muted">${esc(release.status)} · ${(Number(release.size || 0) / 1048576).toFixed(2)} MB</span></div><span class="pill ${type === 'employee' ? 'blue' : 'green'}">${label}</span></div><p>${esc(release.notes || 'No release notes')}</p><div class="release-hash">SHA-256 ${esc(release.sha256)}</div><button class="primary" data-publish-release="${esc(release._id || release.id)}" data-release-type="${type}" type="button">Publish to selected ${type === 'employee' ? 'employees' : 'canteens'}</button></article>`;
    }).join('') || '<span class="muted">No releases uploaded.</span>';
  }

  function render({ releases = [], canteens = [], users = [] }) {
    const type = selectedType;
    const targetCount = type === 'employee' ? users.filter(user => user.active !== false).length : canteens.filter(canteen => canteen.activatedCanteenId).length;
    return `<div class="release-layout"><section class="panel"><h2>Create App Release</h2><p class="muted">POS and Employee ZIP files are separate. Select the correct target before upload.</p><div class="release-type-tabs"><button class="${type === 'pos' ? 'active' : ''}" data-release-type-tab="pos" type="button">Target Canteen</button><button class="${type === 'employee' ? 'active' : ''}" data-release-type-tab="employee" type="button">Target Employee</button></div><form class="form-grid" id="releaseUploadForm"><input id="releaseAppType" type="hidden" value="${type}"><label>Version<input id="releaseVersion" placeholder="${type === 'employee' ? 'employee-1.32.0' : '4.0.1'}" required></label><label>${type === 'employee' ? 'Employee' : 'POS'} Release ZIP<input id="releaseFile" type="file" accept=".zip,application/zip,application/x-zip-compressed" required></label><label class="wide">Release notes<textarea id="releaseNotes" maxlength="500"></textarea></label><button class="primary" id="releaseUploadButton" type="submit">Upload ${type === 'employee' ? 'Employee' : 'POS'} Draft</button></form><div class="status" id="releaseStatus"></div><h3>Target ${type === 'employee' ? 'employees' : 'canteens'}</h3>${targetCount ? `<div class="release-target-tools"><span class="muted" id="releaseTargetCount">0 of ${targetCount} selected</span><div><button class="secondary" id="releaseSelectAll" type="button">Select all</button><button class="secondary" id="releaseClearAll" type="button">Clear all</button></div></div>` : ''}<div class="release-targets">${targetRows(type, canteens, users)}</div></section><section class="panel"><h2>Release History</h2><div class="release-list">${releaseCards(releases)}</div></section></div>`;
  }

  function bind({ api, refresh, notify }) {
    const status = document.getElementById('releaseStatus');
    const currentType = document.getElementById('releaseAppType')?.value || 'pos';
    const targetInputs = () => [...document.querySelectorAll('[data-release-target]')];
    const updateTargetCount = () => { const count = document.getElementById('releaseTargetCount'); if (count) { const all = targetInputs(); count.textContent = `${all.filter(input => input.checked).length} of ${all.length} selected`; } };
    const setAllTargets = checked => { targetInputs().forEach(input => { input.checked = checked; }); updateTargetCount(); };
    document.querySelectorAll('[data-release-type-tab]').forEach(button => button.addEventListener('click', () => { selectedType = button.dataset.releaseTypeTab === 'employee' ? 'employee' : 'pos'; refresh(); }));
    document.getElementById('releaseSelectAll')?.addEventListener('click', () => setAllTargets(true));
    document.getElementById('releaseClearAll')?.addEventListener('click', () => setAllTargets(false));
    targetInputs().forEach(input => input.addEventListener('change', updateTargetCount));
    document.getElementById('releaseUploadForm')?.addEventListener('submit', async event => {
      event.preventDefault(); const file = document.getElementById('releaseFile').files[0]; const button = document.getElementById('releaseUploadButton'); if (!file) return;
      if (file.size > 3.3 * 1024 * 1024) { status.textContent = `ZIP is ${(file.size / 1048576).toFixed(2)} MB. Keep it under 3.3 MB.`; status.className = 'status error'; return; }
      button.disabled = true; status.textContent = 'Uploading release…'; status.className = 'status';
      try {
        const dataUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || '')); reader.onerror = () => reject(Error('Could not read ZIP')); reader.readAsDataURL(file); });
        await api('/marketing-api/app-releases', { method: 'POST', body: JSON.stringify({ appType: currentType, version: document.getElementById('releaseVersion').value, notes: document.getElementById('releaseNotes').value, bundleBase64: dataUrl.slice(dataUrl.indexOf(',') + 1) }) });
        notify(`${currentType === 'employee' ? 'Employee' : 'POS'} release draft uploaded.`); await refresh();
      } catch (error) { status.textContent = error.message; status.className = 'status error'; button.disabled = false; }
    });
    document.querySelectorAll('[data-publish-release]').forEach(button => button.addEventListener('click', async () => {
      const type = button.dataset.releaseType;
      if (type !== currentType) { notify(`Switch to Target ${type === 'employee' ? 'Employee' : 'Canteen'} before publishing this release.`, 'error'); return; }
      const selected = targetInputs().filter(input => input.checked).map(input => input.value);
      if (!selected.length) { notify(`Select at least one ${type === 'employee' ? 'employee' : 'canteen'}.`, 'error'); return; }
      button.disabled = true;
      try { const payload = type === 'employee' ? { employeeIds: selected } : { canteenIds: selected.map(Number) }; await api(`/marketing-api/app-releases/${encodeURIComponent(button.dataset.publishRelease)}/publish`, { method: 'POST', body: JSON.stringify(payload) }); notify(`Release published to selected ${type === 'employee' ? 'employees' : 'canteens'}.`); await refresh(); }
      catch (error) { notify(error.message, 'error'); button.disabled = false; }
    }));
  }
  return { render, bind };
})();
