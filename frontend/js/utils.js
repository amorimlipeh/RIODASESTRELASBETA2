function $(sel, ctx = document) { return ctx.querySelector(sel); }
function $$(sel, ctx = document) { return [...ctx.querySelectorAll(sel)]; }

function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.style.cssText = `
    position:fixed;bottom:24px;right:24px;z-index:9999;
    background:${type==='success'?'#10b981':type==='error'?'#ef4444':'#3b82f6'};
    color:#fff;padding:12px 20px;border-radius:10px;
    font-size:0.9rem;font-weight:600;
    box-shadow:0 4px 20px rgba(0,0,0,0.3);
    animation:fadeIn 0.2s ease;
    max-width:320px;
  `;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function confirm_dialog(msg) {
  return new Promise(resolve => {
    const el = document.createElement('div');
    el.innerHTML = `
      <div class="modal-overlay" style="z-index:2000">
        <div class="modal" style="max-width:380px">
          <div class="modal-body" style="text-align:center;padding:32px 24px">
            <div style="font-size:2rem;margin-bottom:12px">⚠️</div>
            <p style="margin-bottom:24px;color:#e2e8f0">${msg}</p>
            <div style="display:flex;gap:10px;justify-content:center">
              <button class="btn btn-secondary" id="cancel-btn">Cancelar</button>
              <button class="btn btn-danger" id="confirm-btn">Confirmar</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(el);
    el.querySelector('#confirm-btn').onclick = () => { el.remove(); resolve(true); };
    el.querySelector('#cancel-btn').onclick = () => { el.remove(); resolve(false); };
  });
}

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleString('pt-BR');
}

function formatQtd(n) {
  return Number(n || 0).toLocaleString('pt-BR');
}

function getStatusBadge(status) {
  const map = {
    pendente: 'badge-warning',
    em_separacao: 'badge-info',
    separado: 'badge-purple',
    conferido: 'badge-success',
    concluido: 'badge-success',
    cancelado: 'badge-danger',
    livre: 'badge-success',
    ocupado: 'badge-info',
    bloqueado: 'badge-danger',
    entrada: 'badge-success',
    saida: 'badge-danger',
    ajuste: 'badge-warning',
    em_andamento: 'badge-info',
    aguardando: 'badge-warning',
  };
  return `<span class="badge ${map[status]||'badge-info'}">${status?.replace('_',' ')}</span>`;
}

function openModal(id) { $('#'+id).style.display = 'flex'; }
function closeModal(id) { $('#'+id).style.display = 'none'; }

function loading(btn, state) {
  if (state) {
    btn._txt = btn.textContent;
    btn.textContent = 'Aguarde...';
    btn.disabled = true;
  } else {
    btn.textContent = btn._txt || btn.textContent;
    btn.disabled = false;
  }
}
