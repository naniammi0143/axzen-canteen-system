(function () {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const money = value => `Rs ${Number(value || 0).toLocaleString('en-IN')}`;
  const date = value => new Date(value || Date.now()).toLocaleString('en-IN', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
  const statuses = ['Placed','Confirmed','Packed','Shipped','Delivered','Cancelled'];
  function render({orders=[]}={}) {
    const open = orders.filter(order => !['Delivered','Cancelled'].includes(order.status)).length;
    const cod = orders.filter(order => order.paymentMethod === 'Cash on Delivery').length;
    const revenue = orders.filter(order => order.paymentStatus === 'Paid').reduce((sum,order)=>sum+Number(order.amount||0),0);
    const rows = orders.map((order,index)=>`<tr data-paper-row="${esc(`${order.orderId} ${order.canteenName} ${order.phone} ${order.status}`.toLowerCase())}">
      <td>${index+1}</td><td><strong>${esc(order.orderId)}</strong><br><span class="muted">${date(order.createdAt)}</span></td>
      <td><strong>${esc(order.canteenName||order.canteenId)}</strong><br><span class="muted">${esc(order.canteenId||'')}</span></td>
      <td>${esc(order.customerName||'-')}<br><span class="muted">${esc(order.phone||'-')}<br>${esc(order.deliveryAddress||'-')}</span></td>
      <td><strong>${Number(order.quantity||0)} pcs</strong><br><span class="muted">${money(order.unitPrice)} each</span></td>
      <td><strong>${money(order.amount)}</strong><br><span class="pill ${order.paymentStatus==='Paid'?'green':order.paymentStatus==='COD'?'orange':'gray'}">${esc(order.paymentMethod||'-')} · ${esc(order.paymentStatus||'-')}</span></td>
      <td><span class="paper-admin-status ${esc(order.status||'Placed')}">${esc(order.status||'Placed')}</span></td>
      <td><div class="paper-admin-action"><select data-paper-status="${esc(order.orderId)}">${statuses.map(status=>`<option ${status===order.status?'selected':''}>${status}</option>`).join('')}</select><input data-paper-note="${esc(order.orderId)}" placeholder="Courier / note"><button class="primary" data-paper-update="${esc(order.orderId)}" type="button">Update</button></div></td>
    </tr>`).join('');
    return `<section class="paper-admin-hero"><div><span>SUPPLY ORDERS</span><h2>Paper Rolls</h2><p>Track thermal roll purchases, payments and delivery status.</p></div><div class="paper-admin-roll" aria-hidden="true"><i></i><i></i><i></i></div></section>
      <section class="paper-admin-kpis"><article><span>Total Orders</span><strong>${orders.length}</strong></article><article><span>Open Orders</span><strong>${open}</strong></article><article><span>COD Orders</span><strong>${cod}</strong></article><article><span>Online Collected</span><strong>${money(revenue)}</strong></article></section>
      <section class="panel"><div class="toolbar"><div><h2>Paper Roll Orders</h2><p class="muted">Minimum order: 100 pcs</p></div><input id="paperOrderSearch" placeholder="Search order, canteen, phone or status"></div><div class="table-wrap"><table><thead><tr><th>#</th><th>Order</th><th>Organization</th><th>Delivery</th><th>Quantity</th><th>Payment</th><th>Status</th><th>Update</th></tr></thead><tbody>${rows||'<tr><td colspan="8">No paper roll orders yet.</td></tr>'}</tbody></table></div></section>`;
  }
  function bind({api,refresh,notify=()=>{}}={}) {
    document.querySelectorAll('[data-paper-update]').forEach(button=>button.addEventListener('click',async()=>{
      const id=button.dataset.paperUpdate,status=document.querySelector(`[data-paper-status="${CSS.escape(id)}"]`)?.value,note=document.querySelector(`[data-paper-note="${CSS.escape(id)}"]`)?.value||'';
      button.disabled=true;
      try{await api(`/marketing-api/paper-roll-orders/${encodeURIComponent(id)}/status`,{method:'POST',body:JSON.stringify({status,note})});notify('Paper roll order status updated.');await refresh();}
      catch(error){notify(error.message||'Status update failed','error');button.disabled=false;}
    }));
    document.getElementById('paperOrderSearch')?.addEventListener('input',event=>{const q=event.target.value.toLowerCase();document.querySelectorAll('[data-paper-row]').forEach(row=>row.classList.toggle('hidden',q&&!row.dataset.paperRow.includes(q)));});
  }
  window.PaperRollOrders={render,bind};
})();
