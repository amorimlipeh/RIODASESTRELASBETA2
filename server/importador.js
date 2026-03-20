const XLSX = require("xlsx");

function valorTexto(v) {
  return String(v ?? "").trim();
}

function valorNumero(v) {
  if (v === null || v === undefined || v === "") return 0;
  const raw = String(v).trim().replace(/\./g, "").replace(",", ".");
  const num = Number(raw);
  return Number.isFinite(num) ? num : 0;
}

async function lerPlanilha(caminhoArquivo) {
  const workbook = XLSX.readFile(caminhoArquivo, { cellDates: false });
  const primeiraAba = workbook.SheetNames[0];
  const sheet = workbook.Sheets[primeiraAba];
  return XLSX.utils.sheet_to_json(sheet, { defval: "" });
}

function normalizarLinha(row) {
  const obj = {};
  for (const [key, value] of Object.entries(row || {})) {
    obj[String(key || "").trim().toUpperCase()] = value;
  }
  return obj;
}

function detectarCampo(row, nomes) {
  for (const nome of nomes) {
    const value = row[nome];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return "";
}

function importarProdutos(linhas = []) {
  return linhas.map((linha) => {
    const row = normalizarLinha(linha);

    const codigo = valorTexto(detectarCampo(row, ["CODIGO", "CÓDIGO", "SKU", "ITEM", "ITEM NO", "ITEM NO."]));
    const produto = valorTexto(detectarCampo(row, ["PRODUTO", "DESCRICAO", "DESCRIÇÃO", "NOME", "ITEM NAME"])) || codigo;
    const quantidade = valorNumero(detectarCampo(row, ["QUANTIDADE", "QTDE", "UNIDADES", "UN", "SALDO", "ESTOQUE"]));
    const caixas = valorNumero(detectarCampo(row, ["CAIXAS", "CX"]));
    const fator = valorNumero(detectarCampo(row, ["FATOR", "Q/C", "UN/CAIXA", "UNIDADES POR CAIXA"]));
    const imagem = valorTexto(detectarCampo(row, ["IMAGEM", "PICTURES", "PICTURE", "FOTO", "URL IMAGEM"]));
    const endereco = valorTexto(detectarCampo(row, ["ENDERECO", "ENDEREÇO", "LOCAL"]));

    return {
      id: `imp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      codigo,
      produto,
      quantidade,
      caixas,
      fator,
      imagem,
      endereco
    };
  }).filter((item) => item.codigo || item.produto);
}

module.exports = {
  lerPlanilha,
  importarProdutos
};
