
let estoque = [];

function carregarTela(tela) {
  const content = document.querySelector('.content');

  if (tela === 'dashboard') {
    atualizarDashboard();
  }

  if (tela === 'estoque') {
    renderEstoque();
  }

  if (tela === 'wms') {
    content.innerHTML = "<h1>WMS (em breve)</h1>";
  }
}

function atualizarDashboard() {
  const total = estoque.reduce((acc, item) => acc + item.quantidade, 0);

  document.querySelector('.content').innerHTML = `
    <h1>Painel Operacional</h1>
    <div class="cards">
      <div class="card">Estoque: ${total}</div>
      <div class="card">Pedidos: 0</div>
      <div class="card">Separação: 0</div>
    </div>
  `;
}

function renderEstoque() {
  const content = document.querySelector('.content');

  content.innerHTML = `
    <h1>Estoque</h1>

    <div class="form">
      <input id="produto" placeholder="Produto">
      <input id="quantidade" type="number" placeholder="Quantidade">
      <button onclick="salvarProduto()">Salvar</button>
    </div>

    <div id="lista"></div>
  `;

  atualizarLista();
}

function salvarProduto() {
  const nome = document.getElementById('produto').value;
  const qtd = parseInt(document.getElementById('quantidade').value);

  if (!nome || !qtd) return;

  estoque.push({ nome, quantidade: qtd });

  atualizarLista();
  atualizarDashboard();

  document.getElementById('produto').value = "";
  document.getElementById('quantidade').value = "";
}

function atualizarLista() {
  const lista = document.getElementById('lista');

  if (!lista) return;

  lista.innerHTML = estoque.map(p => `
    <div class="item">
      <strong>${p.nome}</strong><br>
      Quantidade: ${p.quantidade}
    </div>
  `).join('');
}

// inicia dashboard ao carregar
window.onload = () => {
  carregarTela('dashboard');
};

