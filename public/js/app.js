async function atualizarDashboard() {
  const res = await fetch('/api/estoque');
  const data = await res.json();

  const total = data.reduce((soma, p) => soma + Number(p.quantidade), 0);

  document.querySelector('.content').innerHTML = `
    <h1>Painel Operacional</h1>
    <div class="cards">
      <div class="card">Estoque: ${total}</div>
      <div class="card">Pedidos: 0</div>
      <div class="card">Separação: 0</div>
    </div>
  `;
}

function carregarTela(tela) {
  const content = document.querySelector('.content');

  if (tela === 'dashboard') {
    atualizarDashboard();
  }

  if (tela === 'estoque') {
    content.innerHTML = `
      <h1>Estoque</h1>

      <div class="form">
        <input id="nome" placeholder="Produto">
        <input id="qtd" type="number" placeholder="Quantidade">
        <button onclick="salvar()">Salvar</button>
      </div>

      <div id="lista" class="lista"></div>
    `;

    carregar();
  }
}

async function carregar() {
  const res = await fetch('/api/estoque');
  const data = await res.json();

  const lista = document.getElementById('lista');
  lista.innerHTML = '';

  if (data.length === 0) {
    lista.innerHTML = "<p style='color:#888'>Nenhum produto cadastrado</p>";
    return;
  }

  data.forEach(p => {
    lista.innerHTML += `
      <div class="card">
        <strong>${p.nome}</strong><br>
        Quantidade: ${p.quantidade}
      </div>
    `;
  });
}

async function salvar() {
  const nomeInput = document.getElementById('nome');
  const qtdInput = document.getElementById('qtd');

  const nome = nomeInput.value;
  const qtd = qtdInput.value;

  if (!nome || !qtd) {
    alert('Preencha todos os campos');
    return;
  }

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

  nomeInput.value = '';
  qtdInput.value = '';

  carregar();
}

// iniciar corretamente
window.onload = () => {
  atualizarDashboard();
};
