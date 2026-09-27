window.MarketingHelpCenter = (() => {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const date = value => value ? new Date(value).toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '-';
  const ticketId = row => String(row._id || row.id || '');
  const waiting = status => status !== 'Solved';
  let rows = [];
  let selectedId = '';

  function queueItem(row) {
    const solved = row.status === 'Solved';
    const id = ticketId(row);
    const number = row.id || String(row._id || '').slice(-6);
    return `<button class="ticket-row ${solved ? 'is-solved' : 'is-open'} ${id === selectedId ? 'is-selected' : ''}" type="button" data-help-card data-ticket="${esc(id)}" data-search="${esc(`${row.canteenName} ${row.canteenId} ${row.customerName} ${row.phone} ${row.problemType} ${row.title} ${row.message}`.toLowerCase())}" data-status="${esc(row.status || 'Pending')}" data-type="${esc(row.problemType || row.title || '')}">
      <span class="ticket-row-top"><strong>#${esc(number)}</strong><span class="help-state ${solved ? 'solved' : 'open'}">${esc(row.status || 'Pending')}</span></span>
      <span class="ticket-row-title">${esc(row.problemType || row.title || 'Help request')}</span>
      <span class="ticket-row-meta">${esc(row.canteenName || '-')} · ${esc(row.customerName || '-')}</span>
      <span class="ticket-row-time">${date(row.createdAt)}</span>
    </button>`;
  }

  function detail(row) {
    if (!row) return `<section class="ticket-detail" id="helpTicketDetail"><div class="help-empty">No tickets in this queue.</div></section>`;
    const solved = row.status === 'Solved';
    const canteen = row.canteen || {};
    const status = row.status || 'Pending';
    const number = row.id || String(row._id || '').slice(-6);
    const place = [canteen.city, canteen.address].filter(Boolean).join(', ') || '-';
    const phone = row.phone || canteen.ownerMobile || '';
    return `<section class="ticket-detail" id="helpTicketDetail">
      <header class="ticket-detail-head">
        <div>
          <p class="help-kicker">Ticket #${esc(number)}</p>
          <h2>${esc(row.problemType || row.title || 'Help request')}</h2>
          <p>${date(row.createdAt)}</p>
        </div>
        <span class="help-state ${solved ? 'solved' : 'open'}">${esc(status)}</span>
      </header>
      <div class="help-case-grid">
        <section>
          <h4>Organization</h4>
          <strong>${esc(row.canteenName || '-')}</strong>
          <p>${esc(row.canteenId || canteen.activatedCanteenId || '-')} · ${esc(canteen.businessCategory || 'Organization')}</p>
          <p>${esc(place)}</p>
        </section>
        <section>
          <h4>Requester</h4>
          <strong>${esc(row.customerName || '-')}</strong>
          <p>${phone ? `<a href="tel:${esc(phone)}">${esc(phone)}</a>` : '-'}</p>
          <p>Owner ${esc(canteen.ownerName || '-')} · ${esc(canteen.ownerMobile || '-')}</p>
        </section>
      </div>
      <article class="ticket-thread">
        <h4>Request</h4>
        <p>${esc(row.message || 'No details')}</p>
      </article>
      <footer class="help-case-actions">
        <button class="secondary" data-help-status="${esc(ticketId(row))}" data-next="Pending" type="button" ${waiting(status) ? 'disabled' : ''}>Reopen</button>
        <button class="primary" data-help-status="${esc(ticketId(row))}" data-next="Solved" type="button" ${solved ? 'disabled' : ''}>Mark solved</button>
        ${solved ? `<span>Solved by ${esc(row.resolvedBy || '-')} · ${date(row.resolvedAt)}</span>` : '<span>Waiting in the support queue</span>'}
      </footer>
    </section>`;
  }

  function render(list) {
    rows = Array.isArray(list) ? list : [];
    if (!rows.some(row => ticketId(row) === selectedId)) selectedId = ticketId(rows[0] || {});
    const open = rows.filter(row => waiting(row.status)).length;
    const solved = rows.length - open;
    const types = [...new Set(rows.map(row => row.problemType || row.title).filter(Boolean))];
    const selected = rows.find(row => ticketId(row) === selectedId) || null;
    return `<section class="ticket-app">
      <aside class="ticket-queue">
        <header class="ticket-queue-head">
          <div>
            <p class="help-kicker">Support desk</p>
            <h2>Help Center</h2>
          </div>
          <div class="help-stats">
            <article><span>Open</span><strong>${open}</strong></article>
            <article><span>Solved</span><strong>${solved}</strong></article>
            <article><span>All</span><strong>${rows.length}</strong></article>
          </div>
          <div class="help-desk-tools">
            <input id="helpSearch" placeholder="Search ticket, organization, phone">
            <select id="helpStatusFilter"><option value="">All statuses</option><option value="Pending">Pending</option><option value="Open">Open</option><option value="Solved">Solved</option></select>
            <select id="helpTypeFilter"><option value="">All problem types</option>${types.map(type => `<option value="${esc(type)}">${esc(type)}</option>`).join('')}</select>
          </div>
        </header>
        <div class="ticket-list" id="helpAdminList">${rows.map(queueItem).join('') || '<div class="help-empty">No help requests in this queue.</div>'}</div>
      </aside>
      ${detail(selected)}
    </section>`;
  }

  function showSelected() {
    const selected = rows.find(row => ticketId(row) === selectedId) || null;
    const pane = document.getElementById('helpTicketDetail');
    if (!pane) return;
    pane.outerHTML = detail(selected);
    document.querySelectorAll('[data-help-card]').forEach(card => card.classList.toggle('is-selected', card.dataset.ticket === selectedId));
  }

  function bind({api,refresh,notify}) {
    const root = document.querySelector('.ticket-app');
    const filter = () => {
      const q = String(document.getElementById('helpSearch')?.value || '').toLowerCase();
      const status = document.getElementById('helpStatusFilter')?.value || '';
      const type = document.getElementById('helpTypeFilter')?.value || '';
      document.querySelectorAll('[data-help-card]').forEach(card => card.classList.toggle('hidden', Boolean((q && !card.dataset.search.includes(q)) || (status && card.dataset.status !== status) || (type && card.dataset.type !== type))));
    };
    document.getElementById('helpSearch')?.addEventListener('input', filter);
    document.getElementById('helpStatusFilter')?.addEventListener('change', filter);
    document.getElementById('helpTypeFilter')?.addEventListener('change', filter);
    root?.addEventListener('click', async event => {
      const card = event.target.closest('[data-help-card]');
      if (card && root.contains(card)) {
        selectedId = card.dataset.ticket || '';
        showSelected();
        return;
      }
      const button = event.target.closest('[data-help-status]');
      if (!button || !root.contains(button)) return;
      button.disabled = true;
      try {
        await api(`/marketing-api/help-tickets/${encodeURIComponent(button.dataset.helpStatus)}/status`, { method: 'POST', body: JSON.stringify({ status: button.dataset.next }) });
        notify(`Ticket marked ${button.dataset.next}.`);
        await refresh();
      } catch (error) {
        notify(error.message, 'error');
        button.disabled = false;
      }
    });
  }
  return { render, bind };
})();
