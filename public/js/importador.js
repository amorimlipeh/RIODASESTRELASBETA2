let dados = [];
let paginaAtual = 1;
let itensPorPagina = 20;

function setProgress(percent, text) {
  document.getElementById("progressFill").style.width = percent + "%";
  document.getElementById("progressText").textContent = text;
}

function setStatus(texto, ok = false) {
  const el = document.getElementById("status");
  el.textContent = texto;
  el.style.color = ok ? "#7CFC98" : "#ffb0b0";
}

function abrirModal(id) {
  document.getElementById(id).classList.remove("hidden");
}

function fecharModal(id) {
  document.getElementById(id).classList.add("hidden");
}

function habilitarBotoes() {
  const pronto = dados.length > 0;
  document.getElementById("btnRevisar").disabled = !pronto;
  document.getElementById("btnSalvar").disabled = !pronto;
}

function getPagina() {
  const inicio = (paginaAtual - 1) * itensPorPagina;
  return dados.slice(inicio, inicio + itensPorPagina);
}

function renderTabela() {
  const tbody = document.getElementById("tabela");
  tbody.innerHTML = "";

  const pagina = getPagina();

  if (!pagina.length) {
    tbody.innerHTML = '<tr><td colspan="6">Nenhum item encontrado.</td></tr>';
  } else {
    pagina.forEach((item, idx) => {
      const realIndex = (paginaAtual - 1) * itensPorPagina + idx;

      tbody.innerHTML += `
        <tr>
          <td><input value="${item.codigo || ""}" onchange="editarCampo(${realIndex}, 'codigo', this.value)"></td>
          <td><input value="${item.produto || ""}" onchange="editarCampo(${realIndex}, 'produto', this.value)"></td>
          <td><input value="${item.endereco || ""}" onchange="editarCampo(${realIndex}, 'endereco', this.value)"></td>
          <td><input type="number" value="${item.quantidade || 0}" onchange="editarCampo(${realIndex}, 'quantidade', this.value)"></td>
          <td><input type="number" value="${item.caixas || 0}" onchange="editarCampo(${realIndex}, 'caixas', this.value)"></td>
          <td><input type="number" value="${item.fator || 0}" onchange="editarCampo(${realIndex}, 'fator', this.value)"></td>
        </tr>
      `;
    });
  }

  const totalPaginas = Math.max(1, Math.ceil(dados.length / itensPorPagina));
  document.getElementById("pagerInfo").textContent = `${paginaAtual} de ${totalPaginas}`;
}

function editarCampo(index, campo, valor) {
  if (!dados[index]) return;

  dados[index][campo] = ["quantidade", "caixas", "fator"].includes(campo)
    ? Number(valor || 0)
    : valor;
}

function mudarItensPorPagina() {
  itensPorPagina = Number(document.getElementById("itensPorPagina").value || 20);
  paginaAtual = 1;
  renderTabela();
}

function paginaAnterior() {
  if (paginaAtual > 1) {
    paginaAtual--;
    renderTabela();
  }
}

function proximaPagina() {
  const totalPaginas = Math.max(1, Math.ceil(dados.length / itensPorPagina));
  if (paginaAtual < totalPaginas) {
    paginaAtual++;
    renderTabela();
  }
}

async function analisar() {
  const file = document.getElementById("file").files[0];

  if (!file) {
    setStatus("Selecione um arquivo.");
    return;
  }

  try {
    setStatus("");
    setProgress(10, "Enviando planilha WMS...");

    const form = new FormData();
    form.append("arquivo", file);

    const res = await fetch("/api/importar-wms", {
      method: "POST",
      body: form
    });

    setProgress(70, "Lendo planilha...");
    const data = await res.json();

    if (!res.ok || !data.ok) {
      setProgress(0, "Falha na leitura.");
      setStatus(data.erro || "Erro ao analisar arquivo WMS.");
      return;
    }

    dados = data.produtos || [];
    paginaAtual = 1;

    document.getElementById("totalItens").textContent = String(dados.length);
    habilitarBotoes();
    renderTabela();

    setProgress(100, "Planilha WMS analisada com sucesso.");
    setStatus(`Itens WMS encontrados: ${dados.length}`, true);
  } catch (err) {
    console.error(err);
    setProgress(0, "Erro no upload.");
    setStatus("Erro ao enviar arquivo WMS.");
  }
}

async function salvar() {
  if (!dados.length) {
    setStatus("Nenhum item WMS para salvar.");
    return;
  }

  try {
    setProgress(35, "Salvando estoque WMS...");

    const res = await fetch("/api/estoque", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itens: dados })
    });

    const data = await res.json();

    if (!res.ok || !data.ok) {
      setProgress(0, "Falha ao salvar.");
      setStatus(data.erro || "Erro ao salvar estoque WMS.");
      return;
    }

    setProgress(100, "Importação WMS concluída.");
    setStatus(`Importação WMS concluída. Inseridos: ${data.inseridos}. Atualizados: ${data.atualizados}.`, true);

    document.getElementById("resultadoFinal").innerHTML = `
      <div><strong>Inseridos:</strong> ${data.inseridos}</div>
      <div><strong>Atualizados:</strong> ${data.atualizados}</div>
      <div><strong>Total no estoque:</strong> ${data.total}</div>
    `;

    abrirModal("modalResultado");
  } catch (err) {
    console.error(err);
    setProgress(0, "Falha ao salvar.");
    setStatus("Erro ao salvar importação WMS.");
  }
}
