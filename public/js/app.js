function carregarTela(tela) {
  const content = document.querySelector('.content');

  if (tela === 'dashboard') {
    content.innerHTML = `
      <h1>Painel Operacional</h1>
      <div class="cards">
        <div class="card">Estoque: 0</div>
        <div class="card">Pedidos: 0</div>
        <div class="card">Separação: 0</div>
      </div>
    `;
  }

  if (tela === 'estoque') {
    content.innerHTML = `
      <h1>Estoque</h1>

      <div class="form">
        <input id="nome" placeholder="Produto">
        <input id="qtd" type="number" placeholder="Quantidade">
        <button onclick="salvar()">Salvar</button>
      </div>

      <div id="lista"></div>
    `;

    carregar();
  }
}

async function carregar() {
  const res = await fetch('/api/estoque');
  const data = await res.json();

  const lista = document.getElementById('lista');
  lista.innerHTML = '';

  data.forEach(p => {
    lista.innerHTML += `
      <div class="card">
        ${p.nome} - ${p.quantidade}
      </div>
    `;
  });
}

async function salvar() {
  const nome = document.getElementById('nome').value;
  const qtd = document.getElementById('qtd').value;

  await fetch('/api/estoque', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome, quantidade: qtd })
  });

  carregar();
}
