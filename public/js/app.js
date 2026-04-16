console.log("JS CARREGOU 🚀");

function carregarTela(tela) {
  alert("Clique funcionando: " + tela);

  const content = document.querySelector('.content');

  if (tela === 'dashboard') {
    content.innerHTML = "<h1>Dashboard OK</h1>";
  }

  if (tela === 'estoque') {
    content.innerHTML = "<h1>Estoque OK</h1>";
  }

  if (tela === 'wms') {
    content.innerHTML = "<h1>WMS OK</h1>";
  }
}
