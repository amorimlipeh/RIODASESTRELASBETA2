const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const XLSX = require("xlsx");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

const DATA_DIR = path.join(__dirname, "data");
const UPLOADS_DIR = path.join(__dirname, "uploads");
const PRODUTOS_IMG_DIR = path.join(UPLOADS_DIR, "produtos");
const TMP_DIR = path.join(UPLOADS_DIR, "tmp");
const PUBLIC_DIR = path.join(__dirname, "public");

garantirPasta(DATA_DIR);
garantirPasta(UPLOADS_DIR);
garantirPasta(PRODUTOS_IMG_DIR);
garantirPasta(TMP_DIR);

app.use(express.static(PUBLIC_DIR));
app.use("/uploads", express.static(UPLOADS_DIR));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 30 * 1024 * 1024
  }
});

function garantirPasta(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function lerJsonSeguro(caminho, fallback = []) {
  try {
    if (!fs.existsSync(caminho)) return fallback;
    const bruto = fs.readFileSync(caminho, "utf8");
    if (!bruto.trim()) return fallback;
    return JSON.parse(bruto);
  } catch (erro) {
    console.error("Erro ao ler JSON:", caminho, erro.message);
    return fallback;
  }
}

function salvarJsonSeguro(caminho, dados) {
  garantirPasta(path.dirname(caminho));
  fs.writeFileSync(caminho, JSON.stringify(dados, null, 2), "utf8");
}

function numeroSeguro(valor, padrao = 0) {
  if (valor === null || valor === undefined || valor === "") return padrao;
  const texto = String(valor).trim();

  // tenta respeitar vírgula decimal sem destruir inteiros
  const normalizado = texto.includes(",") && !texto.includes(".")
    ? texto.replace(",", ".")
    : texto.replace(/,/g, "");

  const n = Number(normalizado);
  return Number.isFinite(n) ? n : padrao;
}

function textoSeguro(valor) {
  return String(valor ?? "").trim();
}

function normalizarCabecalho(valor) {
  return textoSeguro(valor)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function detectarCampos(headers = []) {
  const lista = headers.map((h) => ({
    original: h,
    normalizado: normalizarCabecalho(h)
  }));

  function buscar(possibles = []) {
    const exato = lista.find((item) => possibles.includes(item.normalizado));
    if (exato) return exato.original;

    const parcial = lista.find((item) =>
      possibles.some((p) => item.normalizado.includes(p))
    );

    return parcial ? parcial.original : "";
  }

  return {
    codigo: buscar(["codigo", "codigo do produto", "código", "item no", "sku", "ref", "id", "cod", "客人货号", "货号"]),
    produto: buscar(["produto", "descricao", "descrição", "description", "nome", "item", "produto descricao", "品名"]),
    endereco: buscar(["endereco", "endereço", "local", "location", "rua", "posicao", "posição"]),
    quantidade: buscar(["quantidade", "qty", "qtd", "quantity", "estoque (un)", "estoque", "t.qty", "总数"]),
    caixas: buscar(["caixas", "ctns", "cartons", "box", "件数"]),
    fator: buscar(["q/c", "fator", "qc", "factor", "装箱"]),
    lote: buscar(["lote", "lot", "batch"]),
    nf: buscar(["nf", "nota", "invoice"]),
    fornecedor: buscar(["fornecedor", "supplier", "vendor"]),
    imagem: buscar(["imagem", "picture", "image", "foto", "产品图片"]),
    container: buscar(["container", "contêiner", "conteiner"])
  };
}

function parseCsvBuffer(buffer) {
  const texto = buffer.toString("utf8");
  const wb = XLSX.read(texto, { type: "string" });
  return wb;
}

function lerWorkbookDeArquivo(file) {
  const nome = (file.originalname || "").toLowerCase();

  if (nome.endsWith(".csv")) {
    return parseCsvBuffer(file.buffer);
  }

  return XLSX.read(file.buffer, {
    type: "buffer",
    cellDates: true,
    raw: false
  });
}

function workbookParaPayload(fileBuffer, originalname = "") {
  const fakeFile = { buffer: fileBuffer, originalname };
  const workbook = lerWorkbookDeArquivo(fakeFile);

  const abas = workbook.SheetNames || [];
  if (!abas.length) {
    throw new Error("Nenhuma aba encontrada no arquivo.");
  }

  const planilhas = {};
  const metadados = {};

  for (const nomeAba of abas) {
    const worksheet = workbook.Sheets[nomeAba];
    const linhas = XLSX.utils.sheet_to_json(worksheet, {
      defval: "",
      raw: false
    });

    const cabecalhos = linhas.length
      ? Object.keys(linhas[0]).filter((h) => h !== "__excelRow")
      : [];

    planilhas[nomeAba] = linhas;
    metadados[nomeAba] = {
      cabecalhos,
      total: linhas.length,
      camposDetectados: detectarCampos(cabecalhos)
    };
  }

  const primeiraAba = abas[0];
  const dados = planilhas[primeiraAba] || [];
  const colunas = (metadados[primeiraAba] && metadados[primeiraAba].cabecalhos) || [];

  return {
    ok: true,
    abas,
    planilhas,
    metadados,
    dados,
    colunas
  };
}

function montarRegistroImportacao(origem, item, campos = {}, index = 0, extras = {}) {
  const pegar = (campo) => {
    const coluna = campos[campo];
    return coluna ? item[coluna] ?? "" : "";
  };

  return {
    id: `${origem.toLowerCase()}_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 8)}`,
    origem,
    codigo: textoSeguro(pegar("codigo")),
    produto: textoSeguro(pegar("produto")),
    endereco: textoSeguro(pegar("endereco")),
    quantidade: numeroSeguro(pegar("quantidade")),
    caixas: numeroSeguro(pegar("caixas")),
    fator: numeroSeguro(pegar("fator")),
    lote: textoSeguro(pegar("lote")),
    nf: textoSeguro(pegar("nf")),
    fornecedor: textoSeguro(pegar("fornecedor")),
    imagem: textoSeguro(pegar("imagem")),
    container: textoSeguro(pegar("container")),
    bruto: item,
    criadoEm: new Date().toISOString(),
    ...extras
  };
}

function importarParaEstoque(origem, itens, campos = {}, extras = {}) {
  const caminhoEstoque = path.join(DATA_DIR, "estoque.json");
  const estoque = lerJsonSeguro(caminhoEstoque, []);

  const novos = itens.map((item, index) =>
    montarRegistroImportacao(origem, item, campos, index, extras)
  );

  estoque.unshift(...novos);
  salvarJsonSeguro(caminhoEstoque, estoque);

  return novos;
}

function responderErro(res, contexto, error) {
  console.error(contexto, error);
  return res.status(500).json({
    ok: false,
    erro: contexto,
    detalhe: error.message
  });
}

/* =========================
   ROTAS DE PÁGINAS
========================= */

app.get("/", (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.get("/importar", (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "importar.html"));
});

app.get("/importar_erp", (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "importar_erp.html"));
});

app.get("/importar_container", (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "importar_container.html"));
});

/* =========================
   ANÁLISE WMS
========================= */

app.post("/api/importar-wms", upload.any(), (req, res) => {
  try {
    const file = (req.files && req.files[0]) || req.file;

    if (!file) {
      return res.status(400).json({
        ok: false,
        erro: "Arquivo não enviado."
      });
    }

    const payload = workbookParaPayload(file.buffer, file.originalname || "");
    return res.json(payload);
  } catch (error) {
    return responderErro(res, "Erro ao analisar WMS.", error);
  }
});

/* =========================
   ANÁLISE ERP
========================= */

app.post("/api/importar-erp", upload.any(), (req, res) => {
  try {
    const file = (req.files && req.files[0]) || req.file;

    if (!file) {
      return res.status(400).json({
        ok: false,
        erro: "Arquivo não enviado."
      });
    }

    const payload = workbookParaPayload(file.buffer, file.originalname || "");
    return res.json(payload);
  } catch (error) {
    return responderErro(res, "Erro ao analisar ERP.", error);
  }
});

/* =========================
   ANÁLISE CONTÊINER
========================= */

app.post("/api/importar-container", upload.any(), (req, res) => {
  try {
    const file = (req.files && req.files[0]) || req.file;

    if (!file) {
      return res.status(400).json({
        ok: false,
        erro: "Arquivo não enviado."
      });
    }

    const payload = workbookParaPayload(file.buffer, file.originalname || "");
    return res.json(payload);
  } catch (error) {
    return responderErro(res, "Erro ao analisar contêiner.", error);
  }
});

/* =========================
   IMPORTAÇÃO FINAL WMS
========================= */

app.post("/api/estoque/wms", (req, res) => {
  try {
    const body = req.body || {};
    const itens = Array.isArray(body.itens) ? body.itens : [];
    const campos = body.campos || {};

    if (!itens.length) {
      return res.status(400).json({
        ok: false,
        erro: "Nenhum item recebido para importar WMS."
      });
    }

    const novos = importarParaEstoque("WMS", itens, campos);
    return res.json({
      ok: true,
      inseridos: novos.length,
      itens: novos
    });
  } catch (error) {
    return responderErro(res, "Erro ao importar WMS.", error);
  }
});

/* =========================
   IMPORTAÇÃO FINAL ERP
========================= */

app.post("/api/estoque/erp", (req, res) => {
  try {
    const body = req.body || {};
    const itens = Array.isArray(body.itens) ? body.itens : [];
    const campos = body.campos || {};

    if (!itens.length) {
      return res.status(400).json({
        ok: false,
        erro: "Nenhum item recebido para importar ERP."
      });
    }

    const novos = importarParaEstoque("ERP", itens, campos);
    return res.json({
      ok: true,
      inseridos: novos.length,
      itens: novos
    });
  } catch (error) {
    return responderErro(res, "Erro ao importar ERP.", error);
  }
});

/* =========================
   IMPORTAÇÃO FINAL CONTÊINER
========================= */

app.post("/api/estoque/container", (req, res) => {
  try {
    const body = req.body || {};
    const itens = Array.isArray(body.itens) ? body.itens : [];
    const campos = body.campos || {};
    const aba = body.aba || "";
    const arquivo = body.arquivo || "";

    if (!itens.length) {
      return res.status(400).json({
        ok: false,
        erro: "Nenhum item recebido para importar contêiner."
      });
    }

    const novos = importarParaEstoque("CONTAINER", itens, campos, {
      abaOrigem: aba,
      arquivoOrigem: arquivo
    });

    return res.json({
      ok: true,
      inseridos: novos.length,
      itens: novos
    });
  } catch (error) {
    return responderErro(res, "Erro ao importar contêiner.", error);
  }
});

/* =========================
   CONSULTA ESTOQUE
========================= */

app.get("/api/estoque", (_req, res) => {
  try {
    const caminhoEstoque = path.join(DATA_DIR, "estoque.json");
    const estoque = lerJsonSeguro(caminhoEstoque, []);
    return res.json({
      ok: true,
      total: estoque.length,
      itens: estoque
    });
  } catch (error) {
    return responderErro(res, "Erro ao consultar estoque.", error);
  }
});

/* =========================
   HEALTHCHECK
========================= */

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    status: "online",
    time: new Date().toISOString()
  });
});

/* =========================
   FALLBACK
========================= */

app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({
      ok: false,
      erro: "Rota não encontrada."
    });
  }

  return res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
