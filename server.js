const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const XLSX = require("xlsx");
const unzipper = require("unzipper");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "35mb" }));
app.use(express.urlencoded({ extended: true, limit: "35mb" }));

const DATA_DIR = path.join(__dirname, "data");
const UPLOADS_DIR = path.join(__dirname, "uploads");
const PRODUTOS_IMG_DIR = path.join(UPLOADS_DIR, "produtos");
const TMP_DIR = path.join(UPLOADS_DIR, "tmp");
const PUBLIC_DIR = path.join(__dirname, "public");
const ESTOQUE_PATH = path.join(DATA_DIR, "estoque.json");
const TRADUCOES_PATH = path.join(DATA_DIR, "traducoes.json");

garantirPasta(DATA_DIR);
garantirPasta(UPLOADS_DIR);
garantirPasta(PRODUTOS_IMG_DIR);
garantirPasta(TMP_DIR);

app.use(express.static(PUBLIC_DIR));
app.use("/uploads", express.static(UPLOADS_DIR));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 35 * 1024 * 1024 }
});

/* =========================
   HELPERS BÁSICOS
========================= */

function garantirPasta(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
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
  const normalizado =
    texto.includes(",") && !texto.includes(".")
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

function slugNomeArquivo(nome = "") {
  return String(nome)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function responderErro(res, contexto, error) {
  console.error(contexto, error);
  return res.status(500).json({
    ok: false,
    erro: contexto,
    detalhe: error && error.message ? error.message : String(error)
  });
}

/* =========================
   DETECÇÃO DE CAMPOS
========================= */

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
    codigo: buscar([
      "codigo",
      "codigo do produto",
      "código",
      "item no",
      "sku",
      "ref",
      "id",
      "cod",
      "客人货号",
      "货号"
    ]),
    produto: buscar([
      "produto",
      "descricao",
      "descrição",
      "description",
      "nome",
      "item",
      "produto descricao",
      "品名"
    ]),
    endereco: buscar([
      "endereco",
      "endereço",
      "local",
      "location",
      "rua",
      "posicao",
      "posição"
    ]),
    quantidade: buscar([
      "quantidade",
      "qty",
      "qtd",
      "quantity",
      "estoque (un)",
      "estoque",
      "t.qty",
      "总数"
    ]),
    caixas: buscar([
      "caixas",
      "ctns",
      "cartons",
      "box",
      "件数"
    ]),
    fator: buscar([
      "q/c",
      "fator",
      "qc",
      "factor",
      "装箱"
    ]),
    lote: buscar([
      "lote",
      "lot",
      "batch"
    ]),
    nf: buscar([
      "nf",
      "nota",
      "invoice"
    ]),
    fornecedor: buscar([
      "fornecedor",
      "supplier",
      "vendor"
    ]),
    imagem: buscar([
      "imagem",
      "picture",
      "image",
      "foto",
      "产品图片"
    ]),
    container: buscar([
      "container",
      "contêiner",
      "conteiner"
    ])
  };
}

/* =========================
   LEITURA DE ARQUIVOS
========================= */

function parseCsvBuffer(buffer) {
  const texto = buffer.toString("utf8");
  return XLSX.read(texto, { type: "string" });
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

/* =========================
   TRADUÇÃO CONTÊINER
========================= */

const DICIONARIO_FIXO = {
  "顶针": "dedal",
  "银匙扣蓝色": "chaveiro azul",
  "银匙扣大红": "chaveiro vermelho escuro",
  "银匙扣粉色": "chaveiro rosa",
  "银匙扣黑色": "chaveiro preto",
  "银匙扣": "chaveiro",
  "地图磁浴冰箱贴": "ímã de geladeira mapa prata",
  "地图银浴冰箱贴": "ímã de geladeira mapa prata",
  "7.5塑料双面镜": "espelho duplo plástico 7.5",
  "帆布袋": "saco de pano",
  "桃心镜子": "espelho coração",
  "产品图片": "imagem do produto",
  "客人货号": "código do cliente",
  "品名": "nome do produto",
  "件数": "caixas",
  "装箱": "q/c",
  "总数": "total",
  "毛重": "peso bruto",
  "总毛重": "peso bruto total",
  "长": "comprimento",
  "宽": "largura",
  "高": "altura",
  "体积": "cbm"
};

function carregarCacheTraducoes() {
  return lerJsonSeguro(TRADUCOES_PATH, {});
}

function salvarCacheTraducoes(cache) {
  salvarJsonSeguro(TRADUCOES_PATH, cache || {});
}

function traduzirTextoContainer(texto, cache) {
  const original = textoSeguro(texto);
  if (!original) {
    return { traduzido: "", original: "" };
  }

  if (cache[original]) {
    return {
      traduzido: cache[original],
      original
    };
  }

  if (DICIONARIO_FIXO[original]) {
    cache[original] = DICIONARIO_FIXO[original];
    return {
      traduzido: cache[original],
      original
    };
  }

  let traduzido = original;

  Object.entries(DICIONARIO_FIXO).forEach(([chave, valor]) => {
    if (traduzido.includes(chave)) {
      traduzido = traduzido.split(chave).join(valor);
    }
  });

  traduzido = traduzido
    .replace(/\s+/g, " ")
    .replace(/\s+\./g, ".")
    .trim();

  cache[original] = traduzido;
  return { traduzido, original };
}

function enriquecerLinhasContainer(linhas, camposDetectados = {}) {
  const cache = carregarCacheTraducoes();

  const campoProduto =
    camposDetectados.produto ||
    Object.keys(linhas[0] || {}).find((k) => {
      const n = normalizarCabecalho(k);
      return ["description", "descricao", "descrição", "品名", "produto", "nome"].includes(n);
    }) ||
    "";

  const resultado = linhas.map((linha) => {
    const clone = { ...linha };

    if (campoProduto && clone[campoProduto] !== undefined) {
      const t = traduzirTextoContainer(clone[campoProduto], cache);
      clone.__produto_original = t.original;
      clone.__produto_traduzido = t.traduzido;
      clone[campoProduto] = t.traduzido || t.original;
    }

    return clone;
  });

  salvarCacheTraducoes(cache);
  return resultado;
}

/* =========================
   EXTRAÇÃO DE IMAGENS XLSX
========================= */

async function listarArquivosZip(buffer) {
  const directory = await unzipper.Open.buffer(buffer);
  return directory.files || [];
}

async function extrairMidiasXlsx(buffer, fileBaseName = "container") {
  const files = await listarArquivosZip(buffer);
  const medias = files.filter((f) => /^xl\/media\//i.test(f.path));

  if (!medias.length) return [];

  const pastaDestino = path.join(PRODUTOS_IMG_DIR, "container");
  garantirPasta(pastaDestino);

  const resultado = [];
  let ordem = 0;

  for (const media of medias) {
    const content = await media.buffer();
    const nomeOriginal = path.basename(media.path);
    const nomeFinal = `${Date.now()}_${ordem}_${slugNomeArquivo(fileBaseName)}_${nomeOriginal}`;
    const caminhoFinal = path.join(pastaDestino, nomeFinal);
    fs.writeFileSync(caminhoFinal, content);
    resultado.push(`/uploads/produtos/container/${nomeFinal}`);
    ordem += 1;
  }

  return resultado;
}

function anexarImagensPorOrdem(linhas, imagens, camposDetectados = {}) {
  if (!Array.isArray(linhas) || !linhas.length) return linhas;

  const campoImagem = camposDetectados.imagem || "__imagem";
  return linhas.map((linha, idx) => {
    const clone = { ...linha };
    clone[campoImagem] = imagens[idx] || "";
    clone.__imagem = imagens[idx] || "";
    return clone;
  });
}

/* =========================
   IMPORTAÇÃO FINAL
========================= */

function montarRegistroImportacao(origem, item, campos = {}, index = 0, extras = {}) {
  const pegar = (campo) => {
    const coluna = campos[campo];
    return coluna ? item[coluna] ?? "" : "";
  };

  return {
    id: `${origem.toLowerCase()}_${Date.now()}_${index}_${Math.random()
      .toString(36)
      .slice(2, 8)}`,
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
  const estoque = lerJsonSeguro(ESTOQUE_PATH, []);
  const novos = itens.map((item, index) =>
    montarRegistroImportacao(origem, item, campos, index, extras)
  );
  estoque.unshift(...novos);
  salvarJsonSeguro(ESTOQUE_PATH, estoque);
  return novos;
}

/* =========================
   ROTAS DE PÁGINA
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
      return res.status(400).json({ ok: false, erro: "Arquivo não enviado." });
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
      return res.status(400).json({ ok: false, erro: "Arquivo não enviado." });
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

app.post("/api/importar-container", upload.any(), async (req, res) => {
  try {
    const file = (req.files && req.files[0]) || req.file;
    if (!file) {
      return res.status(400).json({ ok: false, erro: "Arquivo não enviado." });
    }

    const payload = workbookParaPayload(file.buffer, file.originalname || "");
    const primeiraAba = payload.abas[0];
    const metaPrimeiraAba = payload.metadados[primeiraAba] || {};
    const camposDetectados = metaPrimeiraAba.camposDetectados || {};

    const imagens = await extrairMidiasXlsx(file.buffer, file.originalname || "container");
    let dados = Array.isArray(payload.dados) ? payload.dados : [];

    dados = enriquecerLinhasContainer(dados, camposDetectados);
    dados = anexarImagensPorOrdem(dados, imagens, camposDetectados);

    payload.dados = dados;
    payload.planilhas[primeiraAba] = dados;

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
    return res.json({ ok: true, inseridos: novos.length, itens: novos });
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
    return res.json({ ok: true, inseridos: novos.length, itens: novos });
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

    return res.json({ ok: true, inseridos: novos.length, itens: novos });
  } catch (error) {
    return responderErro(res, "Erro ao importar contêiner.", error);
  }
});

/* =========================
   CONSULTA ESTOQUE
========================= */

app.get("/api/estoque", (_req, res) => {
  try {
    const estoque = lerJsonSeguro(ESTOQUE_PATH, []);
    return res.json({ ok: true, total: estoque.length, itens: estoque });
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
