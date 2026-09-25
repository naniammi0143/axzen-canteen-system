window.MarketingHelpCenter = (() => {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const date = value => value ? new Date(value).toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '-';
  const ticketId = row => row._id || row.id;
  function cards(rows) {
    return rows.map(row => {
      const solved = row.status === 'Solved'; const canteen=row.canteen || {};
      return `<article class="support-card" data-help-card data-search="${esc(`${row.canteenName} ${row.canteenId} ${row.customerName} ${row.phone} ${row.problemType} ${row.message}`.toLowerCase())}" data-status="${esc(row.status||'Pending')}"><div class="support-card-head"><div><h3>${esc(row.problemType||row.title)}</h3><span class="muted">Ticket #${esc(row.id||String(row._id||'').slice(-6))} · ${date(row.createdAt)}</span></div><span class="pill ${solved?'green':'orange'}">${esc(row.status||'Pending')}</span></div><div class="support-meta"><div><span>Canteen</span><strong>${esc(row.canteenName||'-')}</strong></div><div><span>Canteen ID</span><strong>${esc(row.canteenId||canteen.activatedCanteenId||'-')}</strong></div><div><span>Customer</span><strong>${esc(row.customerName||'-')}</strong></div><div><span>Phone</span><strong>${esc(row.phone||'-')}</strong></div><div><span>Business</span><strong>${esc(canteen.businessCategory||'-')}</strong></div><div><span>Owner</span><strong>${esc(canteen.ownerName||'-')}</strong></div><div><span>Owner phone</span><strong>${esc(canteen.ownerMobile||'-')}</strong></div><div><span>Location</span><strong>${esc([canteen.city,canteen.address].filter(Boolean).join(', ')||'-')}</strong></div></div><p class="support-message">${esc(row.message||'No details')}</p><div class="support-actions"><button class="secondary" data-help-status="${esc(ticketId(row))}" data-next="Pending" type="button" ${!solved?'disabled':''}>Mark Pending</button><button class="primary" data-help-status="${esc(ticketId(row))}" data-next="Solved" type="button" ${solved?'disabled':''}>Mark Solved</button>${solved?`<span class="muted">Solved by ${esc(row.resolvedBy||'-')} · ${date(row.resolvedAt)}</span>`:''}</div></article>`;
    }).join('') || '<div class="muted">No help requests found.</div>';
  }
  function render(rows) {
    return `<section class="panel"><div class="support-toolbar"><div><h2>Help Center</h2><div class="muted">POS customer requests with canteen details and live status.</div></div><div><select id="helpStatusFilter"><option value="">All statuses</option><option value="Pending">Pending</option><option value="Solved">Solved</option></select> <input id="helpSearch" placeholder="Search canteen, customer or problem"></div></div><div class="support-grid" id="helpAdminList">${cards(rows)}</div></section>`;
  }
  function bind({api,refresh,notify}) {
    const filter=()=>{const q=String(document.getElementById('helpSearch')?.value||'').toLowerCase();const status=document.getElementById('helpStatusFilter')?.value||'';document.querySelectorAll('[data-help-card]').forEach(card=>card.classList.toggle('hidden',Boolean((q&&!card.dataset.search.includes(q))||(status&&card.dataset.status!==status))));};
    document.getElementById('helpSearch')?.addEventListener('input',filter);document.getElementById('helpStatusFilter')?.addEventListener('change',filter);
    document.querySelectorAll('[data-help-status]').forEach(button=>button.addEventListener('click',async()=>{button.disabled=true;try{await api(`/marketing-api/help-tickets/${encodeURIComponent(button.dataset.helpStatus)}/status`,{method:'POST',body:JSON.stringify({status:button.dataset.next})});notify(`Ticket marked ${button.dataset.next}.`);await refresh();}catch(error){notify(error.message,'error');button.disabled=false;}}));
  }
  return {render,bind};
})();
