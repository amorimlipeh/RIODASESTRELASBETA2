function gerarEndereco(rua, pos, andar) {
  return \`\${String(rua).padStart(2,'0')}-\${String(pos).padStart(3,'0')}-\${andar}-1\`;
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

  if (tela === 'wms') {
    let grid = '';

    for (let rua = 1; rua <= 3; rua++) {
      for (let pos = 1; pos <= 5; pos++) {
        const endereco = gerarEndereco(rua, pos, 1);

        grid += `
          <div class="endereco" onclick="selecionar('${endereco}')">
            ${endereco}
          </div>
        `;
      }
    }

    content.innerHTML = `
      <h1>Mapa WMS</h1>
      <div class="grid">${grid}</div>

      <div id="formWMS"></div>
    `;
  }
}

function selecionar(endereco) {
  document.getElementById('formWMS').innerHTML = `
    <h3>Endereço: ${endereco}</h3>
    <input id="produtoWMS" placeholder="Produto">
    <input id="qtdWMS" type="number" placeholder="Quantidade">
    <button onclick="salvarWMS('${endereco}')">Salvar</button>
  `;
}

async function salvarWMS(endereco) {
  const produto = document.getElementById('produtoWMS').value;
  const qtd = document.getElementById('qtdWMS').value;

  await fetch('/api/wms', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      endereco,
      produto,
      quantidade: qtd
    })
  });

  alert('Salvo no endereço!');
}

async function atualizarDashboard() {
  const res = await fetch('/api/estoque?ts=' + Date.now());
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

async function carregar() {
  const res = await fetch('/api/estoque?ts=' + Date.now());
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
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      nome,
      quantidade: qtd
    })
  });

  carregar();
}

window.onload = () => atualizarDashboard();
