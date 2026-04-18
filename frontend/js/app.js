// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  if (API.restoreSession()) {
    showApp();
    loadPage('dashboard');
  }
});

function showApp() {
  $('#tela-inicial').style.display = 'none';
  $('#app').style.display = 'flex';
  $('#app').style.flexDirection = 'row';
  updateUserUI();
}

function showLanding() {
  $('#tela-inicial').style.display = 'flex';
  $('#app').style.display = 'none';
}

function updateUserUI() {
  if (!API.usuario) return;
  $('#user-name').textContent = API.usuario.nome;
  $('#user-role').textContent = API.usuario.cargo;
  $('#user-avatar').textContent = API.usuario.nome.charAt(0).toUpperCase();
}

// ===== LOGIN =====
$('#btn-acessar').onclick = () => openModal('modal-login');
$('#btn-login').onclick = async () => {
  const email = $('#login-email').value;
  const senha = $('#login-senha').value;
  const btn = $('#btn-login');
  if (!email || !senha) return toast('Preencha email e senha', 'error');
  loading(btn, true);
  try {
    await API.login(email, senha);
    closeModal('modal-login');
    showApp();
    loadPage('dashboard');
    toast('Bem-vindo, ' + API.usuario.nome + '! 🚀');
  } catch(e) {
    toast(e.message, 'error');
  } finally {
    loading(btn, false);
  }
};

$('#btn-logout').onclick = async () => {
  const ok = await confirm_dialog('Deseja sair do sistema?');
  if (!ok) return;
  API.logout();
  showLanding();
  toast('Até logo!');
};

// ===== NAVEGAÇÃO =====
function loadPage(nome) {
  $$('.page').forEach(p => p.classList.remove('active'));
  $$('.nav-item').forEach(n => n.classList.remove('active'));

  const page = $('#page-' + nome);
  if (page) page.classList.add('active');

  const nav = $(`[data-page="${nome}"]`);
  if (nav) nav.classList.add('active');

  const titles = {
    dashboard: '📊 Dashboard',
    produtos: '📦 Produtos',
    estoque: '🏭 Estoque',
    buscar: '🔍 Buscar Estoque',
    enderecos: '📍 Endereços',
    mapa: '🗺️ Mapa WMS',
    movimentacoes: '↕️ Movimentações',
    pedidos: '📋 Pedidos',
    separacao: '⚡ Separação',
    conferencia: '✅ Conferência',
    conteineres: '🚢 Contêineres',
    importacao: '📥 Importação',
    notificacoes: '🔔 Notificações',
    usuarios: '👥 Usuários',
    logs: '📜 Logs',
    admin: '⚙️ Painel Admin',
    dev: '🛠️ Painel Dev',
    cliente: '🏪 Área do Cliente',
    ia: '🤖 IA Assistente',
    config: '⚙️ Configurações',
  };

  $('#topbar-title').textContent = titles[nome] || nome;

  const loaders = {
    dashboard: loadDashboard,
    produtos: loadProdutos,
    estoque: loadEstoque,
    buscar: loadBuscar,
    enderecos: loadEnderecos,
    mapa: loadMapa,
    movimentacoes: loadMovimentacoes,
    pedidos: loadPedidos,
    separacao: loadSeparacao,
    notificacoes: loadNotificacoes,
    usuarios: loadUsuarios,
    logs: loadLogs,
    ia: initIA,
    admin: loadAdmin,
    dev: loadDev,
    conteineres: loadConteineres,
  };

  if (loaders[nome]) loaders[nome]();
}

$$('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    const page = item.dataset.page;
    if (page) loadPage(page);
  });
});

// ===== DASHBOARD =====
async function loadDashboard() {
  try {
    const d = await API.get('/dashboard');
    $('#dash-produtos').textContent = d.totalProdutos;
    $('#dash-enderecos').textContent = d.totalEnderecos;
    $('#dash-ocupados').textContent = d.enderecosOcupados;
    $('#dash-movs').textContent = d.totalMovimentacoes;
    $('#dash-pedidos').textContent = d.totalPedidos;
    $('#dash-pendentes').textContent = d.pedidosPendentes;
    $('#dash-hora').textContent = new Date().toLocaleString('pt-BR');

    const tbody = $('#dash-movs-table');
    if (tbody) {
      tbody.innerHTML = d.ultimasMovimentacoes.map(m => `
        <tr>
          <td>${m.codigo || '-'}</td>
          <td>${m.descricao || '-'}</td>
          <td>${getStatusBadge(m.tipo)}</td>
          <td>${formatQtd(m.quantidade)}</td>
          <td>${formatDate(m.criado_em)}</td>
        </tr>
      `).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--text3)">Sem movimentações</td></tr>';
    }
  } catch(e) { toast('Erro ao carregar dashboard', 'error'); }
}

// ===== PRODUTOS =====
let produtos_cache = [];

async function loadProdutos(q = '') {
  const tbody = $('#produtos-table');
  tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text3);padding:20px">Carregando...</td></tr>';
  try {
    const path = q ? `/produtos?q=${encodeURIComponent(q)}` : '/produtos';
    produtos_cache = await API.get(path);
    renderProdutos(produtos_cache);
  } catch(e) { toast('Erro ao carregar produtos', 'error'); }
}

function renderProdutos(list) {
  const tbody = $('#produtos-table');
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text3);padding:32px">Nenhum produto encontrado</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(p => `
    <tr>
      <td><span class="tag">${p.codigo}</span></td>
      <td>${p.descricao}</td>
      <td>${p.fator || 1}</td>
      <td>${p.caixas || 0}</td>
      <td>${p.lastro || 0}</td>
      <td>${p.camada || 0}</td>
      <td>${p.pallets || 0}</td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="editProduto('${p.id}')">✏️</button>
        <button class="btn btn-danger btn-sm" onclick="deleteProduto('${p.id}')">🗑️</button>
      </td>
    </tr>
  `).join('');
}

$('#search-produto').oninput = function() { loadProdutos(this.value); };

$('#btn-novo-produto').onclick = () => {
  $('#form-produto').reset();
  $('#produto-id').value = '';
  $('#modal-produto-title').textContent = 'Novo Produto';
  openModal('modal-produto');
};

$('#form-produto').onsubmit = async (e) => {
  e.preventDefault();
  const id = $('#produto-id').value;
  const data = {
    codigo: $('#p-codigo').value,
    descricao: $('#p-descricao').value,
    fator: parseFloat($('#p-fator').value) || 1,
    caixas: parseInt($('#p-caixas').value) || 0,
    lastro: parseInt($('#p-lastro').value) || 0,
    camada: parseInt($('#p-camada').value) || 0,
    pallets: parseInt($('#p-pallets').value) || 0,
  };
  try {
    if (id) {
      await API.put('/produtos/' + id, data);
      toast('Produto atualizado!');
    } else {
      await API.post('/produtos', data);
      toast('Produto criado!');
    }
    closeModal('modal-produto');
    loadProdutos();
  } catch(e) { toast(e.message, 'error'); }
};

async function editProduto(id) {
  const p = produtos_cache.find(x => x.id === id);
  if (!p) return;
  $('#produto-id').value = p.id;
  $('#p-codigo').value = p.codigo;
  $('#p-descricao').value = p.descricao;
  $('#p-fator').value = p.fator;
  $('#p-caixas').value = p.caixas;
  $('#p-lastro').value = p.lastro;
  $('#p-camada').value = p.camada;
  $('#p-pallets').value = p.pallets;
  $('#modal-produto-title').textContent = 'Editar Produto';
  openModal('modal-produto');
}

async function deleteProduto(id) {
  const ok = await confirm_dialog('Excluir este produto?');
  if (!ok) return;
  await API.delete('/produtos/' + id);
  toast('Produto excluído');
  loadProdutos();
}

// ===== ESTOQUE =====
async function loadEstoque() {
  const tbody = $('#estoque-table');
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--text3)">Carregando...</td></tr>';
  try {
    const items = await API.get('/estoque');
    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text3)">Sem itens em estoque</td></tr>';
      return;
    }
    tbody.innerHTML = items.map(i => `
      <tr>
        <td><span class="tag">${i.codigo}</span></td>
        <td>${i.descricao}</td>
        <td>${i.endereco_codigo || '-'}</td>
        <td><strong>${formatQtd(i.quantidade)}</strong></td>
        <td>${i.fator ? Math.floor(i.quantidade / i.fator) : '-'}</td>
        <td>${formatDate(i.atualizado_em)}</td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="abrirMovimentacao('${i.produto_id}','${i.endereco_id||''}')">↕️</button>
        </td>
      </tr>
    `).join('');
  } catch(e) { toast('Erro ao carregar estoque', 'error'); }
}

function abrirMovimentacao(produto_id, endereco_id) {
  $('#mov-produto-id').value = produto_id;
  $('#mov-endereco-id').value = endereco_id;
  openModal('modal-movimentacao');
}

$('#btn-movimentar').onclick = () => {
  $('#mov-produto-id').value = '';
  $('#mov-endereco-id').value = '';
  openModal('modal-movimentacao');
};

$('#form-movimentacao').onsubmit = async (e) => {
  e.preventDefault();
  const data = {
    tipo: $('#mov-tipo').value,
    produto_id: $('#mov-produto-id').value,
    endereco_id: $('#mov-endereco-id').value || null,
    quantidade: parseFloat($('#mov-qtd').value),
    observacao: $('#mov-obs').value,
  };
  try {
    await API.post('/estoque/movimentar', data);
    toast('Movimentação realizada!');
    closeModal('modal-movimentacao');
    loadEstoque();
  } catch(e) { toast(e.message, 'error'); }
};

// ===== BUSCAR ESTOQUE =====
async function loadBuscar() {}

$('#search-estoque-btn').onclick = async () => {
  const q = $('#search-estoque-input').value;
  if (!q) return toast('Digite algo para buscar', 'error');
  const tbody = $('#buscar-table');
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text3)">Buscando...</td></tr>';
  try {
    const items = await API.get(`/estoque?q=${encodeURIComponent(q)}`);
    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text3)">Nenhum resultado</td></tr>';
      return;
    }
    tbody.innerHTML = items.map(i => {
      const caixas = i.fator ? Math.floor(i.quantidade / i.fator) : 0;
      const pallets = i.camada && i.lastro ? Math.floor(caixas / (i.camada * i.lastro)) : 0;
      return `
        <tr>
          <td><span class="tag">${i.codigo}</span></td>
          <td>${i.descricao}</td>
          <td>${i.endereco_codigo || '-'}</td>
          <td>${formatQtd(i.quantidade)} un</td>
          <td>${formatQtd(caixas)} cx</td>
          <td>${formatQtd(pallets)} plt</td>
        </tr>
      `;
    }).join('');
  } catch(e) { toast('Erro na busca', 'error'); }
};

$('#search-estoque-input').onkeydown = (e) => { if (e.key === 'Enter') $('#search-estoque-btn').click(); };

// ===== ENDEREÇOS =====
async function loadEnderecos() {
  const tbody = $('#enderecos-table');
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text3)">Carregando...</td></tr>';
  try {
    const items = await API.get('/enderecos');
    if (!items.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text3)">
        Nenhum endereço.<br><br>
        <button class="btn btn-primary" onclick="gerarEnderecos()">🔨 Gerar Endereços WMS</button>
      </td></tr>`;
      return;
    }
    const page = items.slice(0, 200);
    tbody.innerHTML = page.map(e => `
      <tr>
        <td><span class="tag">${e.codigo}</span></td>
        <td>${e.rua}</td>
        <td>${e.posicao}</td>
        <td>${e.andar}</td>
        <td>${getStatusBadge(e.bloqueado ? 'bloqueado' : e.status)}</td>
        <td>${e.produto_fixo || '-'}</td>
      </tr>
    `).join('');
    if (items.length > 200) {
      tbody.innerHTML += `<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:12px">... e mais ${items.length - 200} endereços</td></tr>`;
    }
  } catch(e) { toast('Erro ao carregar endereços', 'error'); }
}

async function gerarEnderecos() {
  const ok = await confirm_dialog('Gerar 6.860 endereços WMS? (7 ruas × 140 posições × 7 andares)');
  if (!ok) return;
  try {
    await API.post('/enderecos/seed', {});
    toast('Endereços gerados com sucesso!');
    loadEnderecos();
  } catch(e) { toast(e.message, 'error'); }
}

// ===== MAPA WMS =====
async function loadMapa() {
  const container = $('#mapa-container');
  container.innerHTML = '<p style="color:var(--text3);text-align:center;padding:40px">Carregando mapa...</p>';
  try {
    const rua = $('#mapa-rua-filter').value || 'R01';
    const all = await API.get('/enderecos/mapa?rua=' + rua);
    if (!all.length) {
      container.innerHTML = `<div class="empty-state"><div class="icon">🗺️</div><p>Sem endereços. <button class="btn btn-primary btn-sm" onclick="gerarEnderecos()">Gerar</button></p></div>`;
      return;
    }

    const byAndar = {};
    all.forEach(e => {
      if (!byAndar[e.andar]) byAndar[e.andar] = [];
      byAndar[e.andar].push(e);
    });

    container.innerHTML = Object.entries(byAndar).sort((a,b)=>b[0]-a[0]).map(([andar, cells]) => `
      <div style="margin-bottom:20px">
        <div style="font-size:0.8rem;color:var(--text3);margin-bottom:8px;font-weight:600">Andar ${andar}</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px">
          ${cells.sort((a,b)=>a.posicao-b.posicao).map(e => `
            <div class="wms-cell ${e.bloqueado?'bloqueado':e.status}"
              title="${e.codigo} - ${e.status}${e.produto_fixo?' - Fixo: '+e.produto_fixo:''}"
              onclick="detalheEndereco('${e.id}','${e.codigo}','${e.status}')">
              ${e.posicao}
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');
  } catch(e) { toast('Erro ao carregar mapa', 'error'); }
}

function detalheEndereco(id, codigo, status) {
  toast(`📍 ${codigo} — ${status}`, 'info');
}

$$('#mapa-rua-filter, #page-mapa select').forEach(el => {
  if (el) el.onchange = loadMapa;
});

document.addEventListener('change', e => {
  if (e.target.id === 'mapa-rua-filter') loadMapa();
});

// ===== MOVIMENTAÇÕES =====
async function loadMovimentacoes() {
  const tbody = $('#movs-table');
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text3)">Carregando...</td></tr>';
  try {
    const items = await API.get('/estoque/movimentacoes');
    tbody.innerHTML = items.map(m => `
      <tr>
        <td>${getStatusBadge(m.tipo)}</td>
        <td><span class="tag">${m.codigo||'-'}</span></td>
        <td>${m.descricao||'-'}</td>
        <td>${formatQtd(m.quantidade)}</td>
        <td>${m.operador||'-'}</td>
        <td>${formatDate(m.criado_em)}</td>
      </tr>
    `).join('') || '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text3)">Sem movimentações</td></tr>';
  } catch(e) { toast('Erro ao carregar movimentações', 'error'); }
}

// ===== PEDIDOS =====
async function loadPedidos() {
  const tbody = $('#pedidos-table');
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text3)">Carregando...</td></tr>';
  try {
    const items = await API.get('/pedidos');
    tbody.innerHTML = items.map(p => `
      <tr>
        <td><span class="tag">${p.numero}</span></td>
        <td>${p.cliente||'-'}</td>
        <td>${getStatusBadge(p.status)}</td>
        <td>${getStatusBadge(p.prioridade||'normal')}</td>
        <td>${formatDate(p.criado_em)}</td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="verPedido('${p.id}')">👁️</button>
          ${p.status==='pendente'?`<button class="btn btn-primary btn-sm" onclick="iniciarSeparacao('${p.id}')">⚡</button>`:''}
        </td>
      </tr>
    `).join('') || '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text3)">Nenhum pedido</td></tr>';
  } catch(e) { toast('Erro ao carregar pedidos', 'error'); }
}

$('#btn-novo-pedido').onclick = () => {
  $('#form-pedido').reset();
  openModal('modal-pedido');
};

$('#form-pedido').onsubmit = async (e) => {
  e.preventDefault();
  const data = {
    cliente: $('#ped-cliente').value,
    prioridade: $('#ped-prioridade').value,
    itens: [],
  };
  try {
    await API.post('/pedidos', data);
    toast('Pedido criado!');
    closeModal('modal-pedido');
    loadPedidos();
  } catch(e) { toast(e.message, 'error'); }
};

async function iniciarSeparacao(id) {
  const ok = await confirm_dialog('Iniciar separação deste pedido?');
  if (!ok) return;
  await API.post(`/pedidos/${id}/separacao`, {});
  toast('Separação iniciada!');
  loadPedidos();
}

async function verPedido(id) {
  try {
    const p = await API.get('/pedidos/' + id);
    const html = `
      <strong>${p.numero}</strong> — ${p.cliente||'sem cliente'}<br>
      Status: ${p.status} | Prioridade: ${p.prioridade||'normal'}<br>
      Criado em: ${formatDate(p.criado_em)}<br>
      Itens: ${p.itens?.length || 0}
    `;
    toast(html.replace(/<[^>]*>/g,'').substring(0, 80), 'info');
  } catch(e) {}
}

// ===== SEPARAÇÃO =====
async function loadSeparacao() {
  const tbody = $('#sep-table');
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text3)">Carregando...</td></tr>';
  try {
    const pedidos = await API.get('/pedidos');
    const em_sep = pedidos.filter(p => p.status === 'em_separacao' || p.status === 'pendente');
    tbody.innerHTML = em_sep.map(p => `
      <tr>
        <td><span class="tag">${p.numero}</span></td>
        <td>${p.cliente||'-'}</td>
        <td>${getStatusBadge(p.status)}</td>
        <td>${getStatusBadge(p.prioridade||'normal')}</td>
        <td>
          <button class="btn btn-success btn-sm" onclick="confirmarSeparacao('${p.id}')">✅ Concluir</button>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text3)">Nenhum pedido em separação</td></tr>';
  } catch(e) { toast('Erro ao carregar separação', 'error'); }
}

async function confirmarSeparacao(id) {
  const ok = await confirm_dialog('Marcar separação como concluída?');
  if (!ok) return;
  await API.put(`/pedidos/${id}/status`, { status: 'separado' });
  toast('Separação concluída!');
  loadSeparacao();
}

// ===== NOTIFICAÇÕES =====
async function loadNotificacoes() {
  const container = $('#notif-list');
  container.innerHTML = '<p style="color:var(--text3);text-align:center;padding:32px">Carregando...</p>';
  try {
    const items = await API.get('/notificacoes');
    if (!items.length) {
      container.innerHTML = '<div class="empty-state"><div class="icon">🔔</div><p>Sem notificações</p></div>';
      return;
    }
    container.innerHTML = items.map(n => `
      <div class="card" style="margin-bottom:10px;display:flex;align-items:center;gap:16px;${n.lida?'opacity:0.5':''}">
        <div style="font-size:1.5rem">${n.tipo==='alerta'?'⚠️':n.tipo==='erro'?'❌':'ℹ️'}</div>
        <div style="flex:1">
          <div style="font-weight:600">${n.titulo}</div>
          <div style="font-size:0.8rem;color:var(--text2)">${n.mensagem||''}</div>
          <div style="font-size:0.75rem;color:var(--text3)">${formatDate(n.criado_em)}</div>
        </div>
        ${!n.lida?`<button class="btn btn-secondary btn-sm" onclick="lerNotif('${n.id}')">Marcar lida</button>`:'<span class="badge badge-success">Lida</span>'}
      </div>
    `).join('');
  } catch(e) { toast('Erro ao carregar notificações', 'error'); }
}

async function lerNotif(id) {
  await API.put(`/notificacoes/${id}/ler`, {});
  loadNotificacoes();
}

// ===== USUÁRIOS =====
async function loadUsuarios() {
  const tbody = $('#usuarios-table');
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text3)">Carregando...</td></tr>';
  try {
    const items = await API.get('/usuarios');
    tbody.innerHTML = items.map(u => `
      <tr>
        <td>${u.nome}</td>
        <td>${u.email}</td>
        <td><span class="badge badge-info">${u.cargo}</span></td>
        <td>${getStatusBadge(u.ativo?'concluido':'cancelado')}</td>
        <td>${formatDate(u.criado_em)}</td>
      </tr>
    `).join('') || '<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text3)">Sem usuários</td></tr>';
  } catch(e) { toast('Erro ao carregar usuários', 'error'); }
}

$('#btn-novo-usuario').onclick = () => { $('#form-usuario').reset(); openModal('modal-usuario'); };

$('#form-usuario').onsubmit = async (e) => {
  e.preventDefault();
  const data = {
    nome: $('#u-nome').value,
    email: $('#u-email').value,
    senha: $('#u-senha').value,
    cargo: $('#u-cargo').value,
  };
  try {
    await API.post('/usuarios', data);
    toast('Usuário criado!');
    closeModal('modal-usuario');
    loadUsuarios();
  } catch(e) { toast(e.message, 'error'); }
};

// ===== LOGS =====
async function loadLogs() {
  const tbody = $('#logs-table');
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text3)">Carregando...</td></tr>';
  try {
    const items = await API.get('/logs');
    tbody.innerHTML = items.map(l => `
      <tr>
        <td>${formatDate(l.criado_em)}</td>
        <td>${l.usuario_nome||'-'}</td>
        <td><span class="tag">${l.modulo||'-'}</span></td>
        <td>${l.acao}</td>
        <td style="color:var(--text3);font-size:0.8rem">${l.detalhes||'-'}</td>
      </tr>
    `).join('') || '<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text3)">Sem logs</td></tr>';
  } catch(e) { toast('Erro ao carregar logs', 'error'); }
}

// ===== CONTÊINERES =====
async function loadConteineres() {
  const tbody = $('#conteineres-table');
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text3)">Carregando...</td></tr>';
  try {
    const items = await API.get('/conteineres').catch(() => []);
    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text3)">Sem contêineres registrados</td></tr>';
      return;
    }
    tbody.innerHTML = items.map(c => `
      <tr>
        <td><span class="tag">${c.numero}</span></td>
        <td>${c.fornecedor||'-'}</td>
        <td>${getStatusBadge(c.status)}</td>
        <td>${formatDate(c.criado_em)}</td>
        <td><button class="btn btn-secondary btn-sm">📋 Detalhes</button></td>
      </tr>
    `).join('');
  } catch(e) {}
}

// ===== IA ASSISTENTE =====
const ia_msgs = [
  { role: 'bot', text: 'Olá! Sou a IA do Sistema Logístico. Posso analisar seu estoque, sugerir otimizações e responder perguntas sobre operações. Como posso ajudar?' }
];

function initIA() {
  renderIAChat();
}

function renderIAChat() {
  const chat = $('#ia-chat');
  chat.innerHTML = ia_msgs.map(m => `
    <div class="ia-msg ${m.role}">
      <div class="bubble">${m.text}</div>
    </div>
  `).join('');
  chat.scrollTop = chat.scrollHeight;
}

$('#ia-send').onclick = async () => {
  const input = $('#ia-input');
  const txt = input.value.trim();
  if (!txt) return;
  input.value = '';
  ia_msgs.push({ role: 'user', text: txt });
  renderIAChat();

  // Respostas inteligentes simuladas
  const respostas = [
    'Analisando os dados do estoque... Com base nos padrões de movimentação, recomendo revisar os produtos com baixo giro.',
    'Para otimizar a separação, sugiro organizar as rotas por rua do WMS, começando pela R01 até R07.',
    'Detectei que o módulo de pedidos tem itens pendentes há mais de 48h. Recomendo priorizar esses pedidos.',
    'A taxa de ocupação atual dos endereços está abaixo de 60%. Há espaço para receber novos contêineres.',
    'Sugiro revisar o fator de conversão dos produtos com alta rotatividade para otimizar o controle de caixas e pallets.',
  ];
  const resp = respostas[Math.floor(Math.random() * respostas.length)];
  setTimeout(() => {
    ia_msgs.push({ role: 'bot', text: '🤖 ' + resp });
    renderIAChat();
  }, 800);
};

$('#ia-input').onkeydown = (e) => { if (e.key === 'Enter') $('#ia-send').click(); };

// ===== ADMIN =====
function loadAdmin() {
  if (!API.usuario) return;
  const cargo = API.usuario.cargo;
  const allowed = ['Administrador', 'Desenvolvedor'];
  if (!allowed.includes(cargo)) {
    $('#admin-content').innerHTML = '<div class="empty-state"><div class="icon">🔒</div><p>Acesso restrito a administradores</p></div>';
  }
}

// ===== DEV PANEL =====
function loadDev() {
  if (!API.usuario || API.usuario.cargo !== 'Desenvolvedor') {
    $('#dev-content').innerHTML = '<div class="empty-state"><div class="icon">🔒</div><p>Acesso exclusivo para Desenvolvedor</p></div>';
    return;
  }
  loadUsuarios();
}

// ===== MODAL CLOSE =====
$$('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay && overlay.id !== 'modal-login') {
      overlay.style.display = 'none';
    }
  });
});

$$('.modal-close').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.closest('.modal-overlay').style.display = 'none';
  });
});
