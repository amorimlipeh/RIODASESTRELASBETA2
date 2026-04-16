
async function carregarTela(tela) {
  const content = document.querySelector('.content');

  if (tela === 'dashboard') {
    const res = await fetch('/api/estoque');
    const data = await res.json();

    const total = data.reduce((acc, item) => acc + item.quantidade, 0);

    content.innerHTML = `
      <h1>Painel Operacional</h1>
      <div class="cards">
        <div class="card">Estoque: ${total}</div>
        <div class="card">Pedidos: 0</div>
        <div class="card">Separação: 0</div>
      </div>
    `;
  }

  if (tela === 'estoque') {
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
}

async function salvarProduto() {
  const nome = document.getElementById('produto').value;
  const qtd = parseInt(document.getElementById('quantidade').value);

  if (!nome || !qtd) return;

  await fetch('/api/estoque', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      nome,
      quantidade: qtd
    })
  });

  atualizarLista();

  document.getElementById('produto').value = "";
  document.getElementById('quantidade').value = "";
}

async function atualizarLista() {
  const res = await fetch('/api/estoque');
  const data = await res.json();

  const lista = document.getElementById('lista');

  if (!lista) return;

  lista.innerHTML = data.map(p => `
    <div class="item">
      <strong>${p.nome}</strong><br>
      Quantidade: ${p.quantidade}
    </div>
  `).join('');
}

window.onload = () => {
  carregarTela('dashboard');
};

