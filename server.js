const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const XLSX = require("xlsx");

const app = express();
const PORT = process.env.PORT || 3000;

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const UPLOADS_DIR = path.join(ROOT, "uploads");

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

ensureDir(PUBLIC_DIR);
ensureDir(DATA_DIR);
ensureDir(UPLOADS_DIR);
ensureDir(path.join(UPLOADS_DIR, "produtos"));

app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));
app.use("/uploads", express.static(UPLOADS_DIR));
app.use(express.static(PUBLIC_DIR));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 30 * 1024 * 1024,
    files: 10,
  },
});

const ESTOQUE_FILE = path.join(DATA_DIR, "estoque.json");

function readJson(filePath, fallback = []) {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2), "utf8");
      return fallback;
    }
    const raw = fs.readFileSync(filePath, "utf8").trim();
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (error) {
    console.error("Erro ao ler JSON:", filePath, error.message);
    return fallback;
  }
}

function writeJson(filePath, data) {
  try {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
    return true;
  } catch (error) {
    console.error("Erro ao salvar JSON:", filePath, error.message);
    return false;
  }
}

function normalizar(valor = "") {
  return String(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function isEmptyCell(value) {
  return value === null || value === undefined || String(value).trim() === "";
}

function isMeaningfulRow(row) {
  return Array.isArray(row) && row.some((cell) => !isEmptyCell(cell));
}

function uniqueHeaders(row = []) {
  const usados = new Set();
  return row.map((cell, idx) => {
    let nome = String(cell ?? "").trim();
    if (!nome) nome = `Coluna ${idx + 1}`;

    let finalName = nome;
    let seq = 2;
    while (usados.has(finalName)) {
      finalName = `${nome} (${seq})`;
      seq += 1;
    }
    usados.add(finalName);
    return finalName;
  });
}

function detectarCampos(headers, aliasMap) {
  const detectados = {};
  const normHeaders = headers.map((h) => normalizar(h));

  for (const [campo, aliases] of Object.entries(aliasMap)) {
    let encontrado = "";

    for (let i = 0; i < normHeaders.length; i += 1) {
      const h = normHeaders[i];
      const ok = aliases.some((alias) => {
        const a = normalizar(alias);
        return h === a || h.includes(a) || a.includes(h);
      });
      if (ok) {
        encontrado = headers[i];
        break;
      }
    }

    detectados[campo] = encontrado;
  }

  return detectados;
}

function scoreHeaderRow(row, aliasMap) {
  const headers = uniqueHeaders(row);
  const campos = detectarCampos(headers, aliasMap);
  return Object.values(campos).filter(Boolean).length;
}

function findHeaderRow(rows, aliasMap) {
  let bestIndex = -1;
  let bestScore = -1;
  const limite = Math.min(rows.length, 25);

  for (let i = 0; i < limite; i += 1) {
    const row = rows[i];
    if (!isMeaningfulRow(row)) continue;

    const filled = row.filter((cell) => !isEmptyCell(cell)).length;
    if (filled < 2) continue;

    const score = scoreHeaderRow(row, aliasMap);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  if (bestIndex >= 0 && bestScore > 0) return bestIndex;

  for (let i = 0; i < limite; i += 1) {
    const row = rows[i];
    if (!isMeaningfulRow(row)) continue;
    const filled = row.filter((cell) => !isEmptyCell(cell)).length;
    if (filled >= 2) return i;
  }

  return -1;
}

function rowsToObjects(rows, aliasMap) {
  const validRows = rows.filter(isMeaningfulRow);
  if (!validRows.length) {
    return {
      dados: [],
      cabecalhos: [],
      camposDetectados: {},
    };
  }

  const headerIndex = findHeaderRow(validRows, aliasMap);
  if (headerIndex < 0) {
    return {
      dados: [],
      cabecalhos: [],
      camposDetectados: {},
    };
  }

  const cabecalhos = uniqueHeaders(validRows[headerIndex]);
  const dadosRows = validRows.slice(headerIndex + 1);

  const dados = dadosRows
    .map((row) => {
      const obj = {};
      cabecalhos.forEach((header, idx) => {
        obj[header] = row[idx] ?? "";
      });
      return obj;
    })
    .filter((obj) => Object.values(obj).some((v) => !isEmptyCell(v)));

  return {
    dados,
    cabecalhos,
    camposDetectados: detectarCampos(cabecalhos, aliasMap),
  };
}

function parseWorkbook(buffer, aliasMap) {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: true,
    raw: false,
  });

  const planilhas = {};
  const metadados = {};
  const abas = [];

  for (const aba of workbook.SheetNames) {
    const ws = workbook.Sheets[aba];
    if (!ws) continue;

    const rows = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: "",
      blankrows: false,
      raw: false,
    });

    const { dados, cabecalhos, camposDetectados } = rowsToObjects(rows, aliasMap);
    if (!dados.length) continue;

    planilhas[aba] = dados; // IMPORTANTE: linhas originais para a prévia
    metadados[aba] = {
      cabecalhos,
      camposDetectados,
      total: dados.length,
    };
    abas.push(aba);
  }

  return { abas, planilhas, metadados };
}

function getUploadedFiles(req) {
  const files = [];

  if (Array.isArray(req.files)) {
    files.push(...req.files);
  } else if (req.files && typeof req.files === "object") {
    Object.values(req.files).forEach((value) => {
      if (Array.isArray(value)) files.push(...value);
    });
  }

  if (req.file) files.push(req.file);

  return files.filter(Boolean);
}

function getFirstSpreadsheet(req) {
  const files = getUploadedFiles(req);
  if (!files.length) return null;
  return files[0];
}

const ALIASES_WMS = {
  codigo: ["codigo", "código", "item no", "item", "sku", "ref", "referencia", "cod", "codigo do produto", "id"],
  produto: ["produto", "description", "descrição", "item name", "descricao", "nome", "desc"],
  endereco: ["endereco", "endereço", "location", "address", "locacao", "local", "rua", "posicao"],
  quantidade: ["quantidade", "qty", "qtd", "estoque (un)", "estoque", "unidades", "t.qty", "quantity"],
};

const ALIASES_CONTAINER = {
  codigo: ["codigo", "código", "item no", "sku", "ref", "referencia", "cod"],
  produto: ["produto", "description", "descrição", "item name", "descricao", "nome", "desc", "traducao", "tradução"],
  caixas: ["caixas", "cartons", "ctns", "ctn", "boxes", "box", "volume"],
  unidades: ["unidades", "quantidade", "qty", "qtd", "pcs", "pieces", "estoque (un)", "quantity", "t.qty"],
  imagem: ["imagem", "image", "images", "picture", "pictures", "foto", "fotos"],
  container: ["container", "contêiner", "conteiner"],
  lote: ["lote", "lot", "batch"],
  nf: ["nf", "nota", "nota fiscal", "invoice"],
  fornecedor: ["fornecedor", "supplier", "vendor", "fabricante", "marca"],
  fator: ["fator", "q/c", "qc", "factor", "packing", "pack"],
};

function pickBySelectedOrDetected(item, selectedMap = {}, detectedMap = {}, aliases = []) {
  const candidates = [];

  if (Array.isArray(aliases)) {
    aliases.forEach((a) => {
      if (selectedMap[a]) candidates.push(selectedMap[a]);
      if (detectedMap[a]) candidates.push(detectedMap[a]);
    });
  }

  for (const key of candidates) {
    if (key && Object.prototype.hasOwnProperty.call(item, key)) {
      return item[key];
    }
  }

  return "";
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return 0;
  const texto = String(value).replace(/\./g, "").replace(",", ".").trim();
  const num = Number(texto);
  return Number.isFinite(num) ? num : 0;
}

function mapearLinhaContainer(item, selectedMap = {}, detectedMap = {}) {
  return {
    codigo: String(pickBySelectedOrDetected(item, selectedMap, detectedMap, ["codigo"]) || "").trim(),
    produto: String(pickBySelectedOrDetected(item, selectedMap, detectedMap, ["produto"]) || "").trim(),
    container: String(pickBySelectedOrDetected(item, selectedMap, detectedMap, ["container"]) || "").trim(),
    lote: String(pickBySelectedOrDetected(item, selectedMap, detectedMap, ["lote"]) || "").trim(),
    caixas: toNumber(pickBySelectedOrDetected(item, selectedMap, detectedMap, ["caixas"])),
    unidades: toNumber(pickBySelectedOrDetected(item, selectedMap, detectedMap, ["unidades"])),
    fator: toNumber(pickBySelectedOrDetected(item, selectedMap, detectedMap, ["fator"])),
    nf: String(pickBySelectedOrDetected(item, selectedMap, detectedMap, ["nf"]) || "").trim(),
    fornecedor: String(pickBySelectedOrDetected(item, selectedMap, detectedMap, ["fornecedor"]) || "").trim(),
    imagem: String(pickBySelectedOrDetected(item, selectedMap, detectedMap, ["imagem"]) || "").trim(),
    bruto: item,
  };
}

function mapearLinhaWms(item, selectedMap = {}, detectedMap = {}) {
  return {
    codigo: String(pickBySelectedOrDetected(item, selectedMap, detectedMap, ["codigo"]) || "").trim(),
    produto: String(pickBySelectedOrDetected(item, selectedMap, detectedMap, ["produto"]) || "").trim(),
    endereco: String(pickBySelectedOrDetected(item, selectedMap, detectedMap, ["endereco"]) || "").trim(),
    quantidade: toNumber(pickBySelectedOrDetected(item, selectedMap, detectedMap, ["quantidade"])),
    bruto: item,
  };
}

function criarRegistroBase(item, origemPadrao) {
  return {
    id: `est_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    origem: String(item.origem || origemPadrao || "").trim(),
    codigo: String(item.codigo || "").trim(),
    produto: String(item.produto || "").trim(),
    endereco: String(item.endereco || "").trim(),
    quantidade: Number(item.quantidade || item.unidades || 0),
    caixas: Number(item.caixas || 0),
    fator: Number(item.fator || 0),
    imagem: String(item.imagem || "").trim(),
    container: String(item.container || "").trim(),
    lote: String(item.lote || "").trim(),
    nf: String(item.nf || "").trim(),
    fornecedor: String(item.fornecedor || "").trim(),
    bruto: item.bruto && typeof item.bruto === "object" ? item.bruto : {},
    criadoEm: new Date().toISOString(),
  };
}

function normalizarMapaCampos(mapa) {
  if (!mapa || typeof mapa !== "object" || Array.isArray(mapa)) return {};
  const out = {};
  for (const [k, v] of Object.entries(mapa)) {
    out[k] = typeof v === "string" ? v : "";
  }
  return out;
}

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "rio-das-estrelas",
    status: "online",
    time: new Date().toISOString(),
  });
});

app.post("/api/importar-wms", upload.any(), (req, res) => {
  try {
    const file = getFirstSpreadsheet(req);

    if (!file || !file.buffer) {
      return res.json({ ok: false, erro: "Arquivo não enviado" });
    }

    const { abas, planilhas, metadados } = parseWorkbook(file.buffer, ALIASES_WMS);

    if (!abas.length) {
      return res.json({ ok: false, erro: "Planilha vazia ou sem dados válidos." });
    }

    return res.json({
      ok: true,
      abas,
      planilhas, // IMPORTANTE: prévia usa linhas originais
      metadados,
      arquivo: file.originalname || "arquivo",
    });
  } catch (error) {
    console.error("Erro em /api/importar-wms:", error);
    return res.status(500).json({
      ok: false,
      erro: "Erro ao enviar/analisar WMS. Se for PDF, imagem ou outro formato não-planilha, a leitura automática ainda não está pronta.",
    });
  }
});

app.post("/api/importar-container", upload.any(), (req, res) => {
  try {
    const file = getFirstSpreadsheet(req);

    if (!file || !file.buffer) {
      return res.json({ ok: false, erro: "Arquivo não enviado" });
    }

    const { abas, planilhas, metadados } = parseWorkbook(file.buffer, ALIASES_CONTAINER);

    if (!abas.length) {
      return res.json({ ok: false, erro: "Planilha vazia ou sem dados válidos." });
    }

    return res.json({
      ok: true,
      abas,
      planilhas, // IMPORTANTE: prévia usa linhas originais
      metadados,
      arquivo: file.originalname || "arquivo",
    });
  } catch (error) {
    console.error("Erro em /api/importar-container:", error);
    return res.status(500).json({
      ok: false,
      erro: "Erro ao enviar/analisar contêiner.",
    });
  }
});

app.get("/api/estoque", (_req, res) => {
  try {
    const estoque = readJson(ESTOQUE_FILE, []);
    return res.json({
      ok: true,
      total: estoque.length,
      itens: estoque,
    });
  } catch (error) {
    console.error("Erro em GET /api/estoque:", error);
    return res.status(500).json({
      ok: false,
      erro: "Erro ao carregar estoque.",
    });
  }
});

app.post("/api/estoque", (req, res) => {
  try {
    const estoque = readJson(ESTOQUE_FILE, []);
    const body = req.body || {};
    const itensEntrada = Array.isArray(body.itens) ? body.itens : [];

    if (itensEntrada.length) {
      const novos = itensEntrada.map((item) => criarRegistroBase(item, "WMS"));
      estoque.unshift(...novos);
      writeJson(ESTOQUE_FILE, estoque);
      return res.json({
        ok: true,
        inseridos: novos.length,
        itens: novos,
      });
    }

    const itemUnico = criarRegistroBase(body, "MANUAL");
    estoque.unshift(itemUnico);
    writeJson(ESTOQUE_FILE, estoque);
    return res.json({
      ok: true,
      inseridos: 1,
      item: itemUnico,
    });
  } catch (error) {
    console.error("Erro em POST /api/estoque:", error);
    return res.status(500).json({
      ok: false,
      erro: "Erro ao salvar item no estoque.",
    });
  }
});

app.post("/api/estoque/wms", (req, res) => {
  try {
    const estoque = readJson(ESTOQUE_FILE, []);
    const body = req.body || {};
    const itensEntrada = Array.isArray(body.itens) ? body.itens : [];
    const selectedMap = normalizarMapaCampos(body.campos || body.mapeamento || {});
    const detectedMap = normalizarMapaCampos(body.camposDetectados || {});

    if (!itensEntrada.length) {
      return res.status(400).json({
        ok: false,
        erro: "Nenhum item recebido para importar WMS.",
      });
    }

    const novos = itensEntrada.map((item) =>
      criarRegistroBase(mapearLinhaWms(item, selectedMap, detectedMap), "WMS")
    );

    estoque.unshift(...novos);
    writeJson(ESTOQUE_FILE, estoque);

    return res.json({
      ok: true,
      inseridos: novos.length,
      itens: novos,
      arquivo: body.arquivo || "",
      aba: body.aba || "",
    });
  } catch (error) {
    console.error("Erro em POST /api/estoque/wms:", error);
    return res.status(500).json({
      ok: false,
      erro: "Erro ao importar WMS.",
    });
  }
});

app.post("/api/estoque/container", (req, res) => {
  try {
    const estoque = readJson(ESTOQUE_FILE, []);
    const body = req.body || {};
    const itensEntrada = Array.isArray(body.itens) ? body.itens : [];
    const selectedMap = normalizarMapaCampos(body.campos || body.mapeamento || {});
    const detectedMap = normalizarMapaCampos(body.camposDetectados || {});

    if (!itensEntrada.length) {
      return res.status(400).json({
        ok: false,
        erro: "Nenhum item recebido para importar.",
      });
    }

    const novos = itensEntrada.map((item) =>
      criarRegistroBase(mapearLinhaContainer(item, selectedMap, detectedMap), "CONTAINER")
    );

    estoque.unshift(...novos);
    writeJson(ESTOQUE_FILE, estoque);

    return res.json({
      ok: true,
      inseridos: novos.length,
      itens: novos,
      arquivo: body.arquivo || "",
      aba: body.aba || "",
    });
  } catch (error) {
    console.error("Erro em POST /api/estoque/container:", error);
    return res.status(500).json({
      ok: false,
      erro: "Erro ao importar contêiner.",
    });
  }
});

app.get("/", (_req, res) => {
  const indexFile = path.join(PUBLIC_DIR, "index.html");
  if (fs.existsSync(indexFile)) {
    return res.sendFile(indexFile);
  }
  return res.status(200).send("SISTEMA LOGÍSTICO RIO DAS ESTRELAS ONLINE");
});

app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) return next();

  const fallbackFile = path.join(PUBLIC_DIR, req.path);
  if (fs.existsSync(fallbackFile) && fs.statSync(fallbackFile).isFile()) {
    return res.sendFile(fallbackFile);
  }

  const indexFile = path.join(PUBLIC_DIR, "index.html");
  if (fs.existsSync(indexFile)) {
    return res.sendFile(indexFile);
  }

  return res.status(404).send("Página não encontrada.");
});

app.use((err, _req, res, _next) => {
  console.error("Erro não tratado:", err);
  return res.status(500).json({
    ok: false,
    erro: "Erro interno do servidor.",
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 SISTEMA LOGÍSTICO RIO DAS ESTRELAS online na porta ${PORT}`);
});
