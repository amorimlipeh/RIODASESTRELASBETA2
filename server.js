const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const XLSX = require("xlsx");
const unzipper = require("unzipper");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

const DATA_DIR = path.join(__dirname, "data");
const UPLOADS_DIR = path.join(__dirname, "uploads");
const PRODUTOS_DIR = path.join(UPLOADS_DIR, "produtos");
const PRODUTOS_CONTAINER_DIR = path.join(PRODUTOS_DIR, "container");
const PUBLIC_DIR = path.join(__dirname, "public");
const ESTOQUE_PATH = path.join(DATA_DIR, "estoque.json");
const TRADUCOES_PATH = path.join(DATA_DIR, "traducoes.json");

garantirPasta(DATA_DIR);
garantirPasta(UPLOADS_DIR);
garantirPasta(PRODUTOS_DIR);
garantirPasta(PRODUTOS_CONTAINER_DIR);

app.use(express.static(PUBLIC_DIR));
app.use("/uploads", express.static(UPLOADS_DIR));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

function garantirPasta(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function lerJsonSeguro(caminho, fallback) {
  try {
    if (!fs.existsSync(caminho)) return fallback;
    const bruto = fs.readFileSync(caminho, "utf8");
    if (!bruto.trim()) return fallback;
    return JSON.parse(bruto);
  } catch (e) {
    console.error("Erro ao ler JSON:", caminho, e.message);
    return fallback;
  }
}

function salvarJsonSeguro(caminho, valor) {
  garantirPasta(path.dirname(caminho));
  fs.writeFileSync(caminho, JSON.stringify(valor, null, 2), "utf8");
}

function textoSeguro(v) {
  return String(v ?? "").trim();
}

function numeroSeguro(v, padrao = 0) {
  if (v === null || v === undefined || v === "") return padrao;
  const txt = String(v).trim();
  const norm =
    txt.includes(",") && !txt.includes(".")
      ? txt.replace(",", ".")
      : txt.replace(/,/g, "");
  const n = Number(norm);
  return Number.isFinite(n) ? n : padrao;
}

function normalizarCabecalho(valor) {
  return textoSeguro(valor)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function slugArquivo(nome = "") {
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
    detalhe: error?.message || String(error)
  });
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
    produto: buscar(["produto", "descricao", "descrição", "description", "nome", "item", "品名"]),
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

function traduzirCabecalhoBruto(valor) {
  const v = textoSeguro(valor);
  if (!v) return "";

  const mapa = {
    "产品图片": "Imagem",
    "客人货号": "Código",
    "品名": "Original",
    "件数": "Caixas",
    "装箱": "Q/C",
    "总数": "Total",
    "毛重": "Peso Bruto",
    "总毛重": "Peso Bruto Total",
    "长": "Comprimento",
    "宽": "Largura",
    "高": "Altura",
    "体积": "CBM",
    "箱号": "Caixa",
    "批号": "Lote",
    "柜号": "Container"
  };

  return mapa[v] || v;
}

function montarCabecalhosMultinivel(sheet) {
  const matriz = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: ""
  });

  const row0 = matriz[0] || [];
  const row1 = matriz[1] || [];
  const row2 = matriz[2] || [];

  const maxCols = Math.max(row0.length, row1.length, row2.length);
  const headers = [];

  for (let c = 0; c < maxCols; c++) {
    const titulo = textoSeguro(row0[c]);
    const principal = textoSeguro(row1[c]);
    const complemento = textoSeguro(row2[c]);

    let finalHeader = "";

    if (principal) {
      finalHeader = principal;
    } else if (complemento) {
      finalHeader = traduzirCabecalhoBruto(complemento);
    } else if (titulo && c === 0) {
      finalHeader = "Container";
    } else {
      finalHeader = `COLUNA_${c + 1}`;
    }

    if (!principal && complemento && finalHeader !== traduzirCabecalhoBruto(complemento)) {
      finalHeader = traduzirCabecalhoBruto(complemento);
    }

    if (principal && complemento) {
      const nPrincipal = normalizarCabecalho(principal);
      const nComplemento = normalizarCabecalho(complemento);

      if (nPrincipal === "meas." && nComplemento === "长") finalHeader = "Comprimento";
      else if (nComplemento === "宽") finalHeader = "Largura";
      else if (nComplemento === "高") finalHeader = "Altura";
      else if (nComplemento === "体积") finalHeader = "CBM";
      else if (nPrincipal === "item no") finalHeader = "ITEM NO";
      else if (nPrincipal === "description") finalHeader = "DESCRIPTION";
      else if (nPrincipal === "ctns") finalHeader = "CTNS";
      else if (nPrincipal === "q/c") finalHeader = "Q/C";
      else if (nPrincipal === "t.qty") finalHeader = "T.QTY";
      else if (nPrincipal === "g.w") finalHeader = "G.W";
      else if (nPrincipal === "t.g.w") finalHeader = "T.G.W";
      else if (nPrincipal === "cbm") finalHeader = "CBM";
      else if (nPrincipal === "picture") finalHeader = "PICTURE";
    }

    headers.push(finalHeader || `COLUNA_${c + 1}`);
  }

  const usados = {};
  return headers.map((h) => {
    const base = textoSeguro(h) || "COLUNA";
    usados[base] = (usados[base] || 0) + 1;
    return usados[base] === 1 ? base : `${base}_${usados[base]}`;
  });
}

function sheetToJsonContainer(sheet) {
  const matriz = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: ""
  });

  const headers = montarCabecalhosMultinivel(sheet);
  const inicioDados = 3;
  const linhas = [];

  for (let r = inicioDados; r < matriz.length; r++) {
    const row = matriz[r] || [];
    const obj = {};
    let preenchidos = 0;

    headers.forEach((header, idx) => {
      const valor = row[idx] ?? "";
      obj[header] = valor;
      if (textoSeguro(valor)) preenchidos++;
    });

    obj.__excelRow = r + 1;
    if (preenchidos > 0) linhas.push(obj);
  }

  return { headers, linhas };
}

function workbookParaPayload(fileBuffer, originalname = "", isContainer = false) {
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
    let linhas = [];
    let cabecalhos = [];

    if (isContainer) {
      const parsed = sheetToJsonContainer(worksheet);
      linhas = parsed.linhas;
      cabecalhos = parsed.headers;
    } else {
      linhas = XLSX.utils.sheet_to_json(worksheet, {
        defval: "",
        raw: false
      });
      cabecalhos = linhas.length ? Object.keys(linhas[0]).filter((h) => h !== "__excelRow") : [];
    }

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

const DICIONARIO_FIXO = {
  "顶针": "dedal",
  "钥匙扣": "chaveiro",
  "银匙扣": "chaveiro",
  "蓝色": "azul",
  "大红": "vermelho escuro",
  "红色": "vermelho",
  "粉色": "rosa",
  "黑色": "preto",
  "地图": "mapa",
  "冰箱贴": "ímã de geladeira",
  "磁浴": "",
  "银浴": "",
  "7.5塑料双面镜": "espelho duplo plástico 7.5",
  "塑料双面镜": "espelho duplo plástico",
  "双面镜": "espelho duplo",
  "帆布袋": "saco de pano",
  "桃心镜子": "espelho coração",
  "产品图片": "imagem",
  "客人货号": "codigo",
  "品名": "descricao original",
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
  if (!original) return { traduzido: "", original: "" };

  if (cache[original]) {
    return { traduzido: cache[original], original };
  }

  let traduzido = original;

  if (DICIONARIO_FIXO[original]) {
    traduzido = DICIONARIO_FIXO[original];
  } else {
    Object.entries(DICIONARIO_FIXO).forEach(([chave, valor]) => {
      if (traduzido.includes(chave)) {
        traduzido = traduzido.split(chave).join(valor);
      }
    });
  }

  traduzido = traduzido
    .replace(/\s+/g, " ")
    .replace(/\s+\./g, ".")
    .replace(/\s{2,}/g, " ")
    .trim();

  cache[original] = traduzido;
  return { traduzido, original };
}

function enriquecerLinhasContainer(linhas, camposDetectados = {}) {
  const cache = carregarCacheTraducoes();

  let campoProduto =
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

async function listarArquivosZip(buffer) {
  const directory = await unzipper.Open.buffer(buffer);
  return directory.files || [];
}

async function extrairMidiasXlsx(buffer, fileBaseName = "container") {
  const files = await listarArquivosZip(buffer);
  const medias = files.filter((f) => /^xl\/media\//i.test(f.path));

  if (!medias.length) return [];

  const resultado = [];

  for (let i = 0; i < medias.length; i++) {
    const media = medias[i];
    const content = await media.buffer();
    const nomeOriginal = path.basename(media.path);
    const nomeFinal = `${Date.now()}_${i}_${slugArquivo(fileBaseName)}_${nomeOriginal}`;
    const caminhoFinal = path.join(PRODUTOS_CONTAINER_DIR, nomeFinal);

    fs.writeFileSync(caminhoFinal, content);
    resultado.push(`/uploads/produtos/container/${nomeFinal}`);
  }

  return resultado;
}

function anexarImagensPorOrdem(linhas, imagens) {
  if (!Array.isArray(linhas) || !linhas.length) return linhas;

  return linhas.map((linha, i) => ({
    ...linha,
    __imagem: imagens[i] || "",
    __checked: true
  }));
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
    produtoOriginal: textoSeguro(pegar("original") || item.__produto_original || ""),
    endereco: textoSeguro(pegar("endereco")),
    quantidade: numeroSeguro(pegar("quantidade")),
    caixas: numeroSeguro(pegar("caixas")),
    fator: numeroSeguro(pegar("fator")),
    lote: textoSeguro(pegar("lote")),
    nf: textoSeguro(pegar("nf")),
    fornecedor: textoSeguro(pegar("fornecedor")),
    imagem: textoSeguro(pegar("imagem") || item.__imagem || ""),
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

app.post("/api/importar-wms", upload.any(), (req, res) => {
  try {
    const file = (req.files && req.files[0]) || req.file;
    if (!file) {
      return res.status(400).json({ ok: false, erro: "Arquivo não enviado." });
    }

    const payload = workbookParaPayload(file.buffer, file.originalname || "", false);
    return res.json(payload);
  } catch (error) {
    return responderErro(res, "Erro ao analisar WMS.", error);
  }
});

app.post("/api/importar-erp", upload.any(), (req, res) => {
  try {
    const file = (req.files && req.files[0]) || req.file;
    if (!file) {
      return res.status(400).json({ ok: false, erro: "Arquivo não enviado." });
    }

    const payload = workbookParaPayload(file.buffer, file.originalname || "", false);
    return res.json(payload);
  } catch (error) {
    return responderErro(res, "Erro ao analisar ERP.", error);
  }
});

app.post("/api/importar-container", upload.any(), async (req, res) => {
  try {
    const file = (req.files && req.files[0]) || req.file;
    if (!file) {
      return res.status(400).json({ ok: false, erro: "Arquivo não enviado." });
    }

    const payload = workbookParaPayload(file.buffer, file.originalname || "", true);
    const primeiraAba = payload.abas[0];
    const metaPrimeiraAba = payload.metadados[primeiraAba] || {};
    const camposDetectados = metaPrimeiraAba.camposDetectados || {};

    const imagens = await extrairMidiasXlsx(file.buffer, file.originalname || "container");
    let dados = Array.isArray(payload.dados) ? payload.dados : [];

    dados = enriquecerLinhasContainer(dados, camposDetectados);
    dados = anexarImagensPorOrdem(dados, imagens);

    const colunas = Object.keys(dados[0] || {}).filter(
      (k) => k !== "__checked" && k !== "__produto_traduzido"
    );

    payload.dados = dados;
    payload.colunas = colunas;
    payload.planilhas[primeiraAba] = dados;
    payload.metadados[primeiraAba].cabecalhos = colunas;
    payload.metadados[primeiraAba].camposDetectados = detectarCampos(colunas);

    return res.json(payload);
  } catch (error) {
    return responderErro(res, "Erro ao analisar contêiner.", error);
  }
});

app.post("/api/estoque/wms", (req, res) => {
  try {
    const body = req.body || {};
    const itens = Array.isArray(body.itens) ? body.itens : [];
    const campos = body.campos || {};

    if (!itens.length) {
      return res.status(400).json({ ok: false, erro: "Nenhum item recebido para importar WMS." });
    }

    const novos = importarParaEstoque("WMS", itens, campos);
    return res.json({ ok: true, inseridos: novos.length, itens: novos });
  } catch (error) {
    return responderErro(res, "Erro ao importar WMS.", error);
  }
});

app.post("/api/estoque/erp", (req, res) => {
  try {
    const body = req.body || {};
    const itens = Array.isArray(body.itens) ? body.itens : [];
    const campos = body.campos || {};

    if (!itens.length) {
      return res.status(400).json({ ok: false, erro: "Nenhum item recebido para importar ERP." });
    }

    const novos = importarParaEstoque("ERP", itens, campos);
    return res.json({ ok: true, inseridos: novos.length, itens: novos });
  } catch (error) {
    return responderErro(res, "Erro ao importar ERP.", error);
  }
});

app.post("/api/estoque/container", (req, res) => {
  try {
    const body = req.body || {};
    const itens = Array.isArray(body.itens) ? body.itens : [];
    const campos = body.campos || {};
    const aba = body.aba || "";
    const arquivo = body.arquivo || "";

    if (!itens.length) {
      return res.status(400).json({ ok: false, erro: "Nenhum item recebido para importar contêiner." });
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

app.get("/api/estoque", (_req, res) => {
  try {
    const estoque = lerJsonSeguro(ESTOQUE_PATH, []);
    return res.json({ ok: true, total: estoque.length, itens: estoque });
  } catch (error) {
    return responderErro(res, "Erro ao consultar estoque.", error);
  }
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    status: "online",
    time: new Date().toISOString()
  });
});

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
