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

const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");
const UPLOADS_DIR = path.join(__dirname, "uploads");
const CONTAINER_IMG_DIR = path.join(UPLOADS_DIR, "produtos", "container");

for (const dir of [PUBLIC_DIR, DATA_DIR, UPLOADS_DIR, CONTAINER_IMG_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

app.use(express.static(PUBLIC_DIR));
app.use("/uploads", express.static(UPLOADS_DIR));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 60 * 1024 * 1024 }
});

function texto(v) {
  return String(v ?? "").trim();
}

function normalizarCabecalho(v) {
  return texto(v)
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
    codigo: buscar(["item no", "codigo", "código", "sku", "ref", "货号", "客人货号"]),
    produto: buscar(["description", "descricao", "descrição", "produto", "nome", "品名"]),
    caixas: buscar(["ctns", "caixas", "件数"]),
    quantidade: buscar(["t.qty", "quantidade", "qtd", "total", "总数"]),
    fator: buscar(["q/c", "fator", "装箱"]),
    imagem: "__imagem",
    original: "__produto_original"
  };
}

function traduzirCabecalho(valor) {
  const v = texto(valor);
  const mapa = {
    "产品图片": "PICTURE",
    "客人货号": "ITEM NO",
    "品名": "DESCRIPTION",
    "件数": "CTNS",
    "装箱": "Q/C",
    "总数": "T.QTY",
    "毛重": "G.W",
    "总毛重": "T.G.W",
    "长": "Comprimento",
    "宽": "Largura",
    "高": "Altura",
    "体积": "CBM",
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
    const titulo = texto(row0[c]);
    const principal = texto(row1[c]);
    const complemento = texto(row2[c]);

    let finalHeader = "";

    if (principal) {
      finalHeader = principal;
    } else if (complemento) {
      finalHeader = traduzirCabecalho(complemento);
    } else if (titulo && c === 0) {
      finalHeader = "Container";
    } else {
      finalHeader = `COLUNA_${c + 1}`;
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
      else if (nPrincipal === "picture") finalHeader = "PICTURE";
    }

    headers.push(finalHeader || `COLUNA_${c + 1}`);
  }

  const usados = {};
  return headers.map((h) => {
    const base = texto(h) || "COLUNA";
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
      if (texto(valor)) preenchidos++;
    });

    obj.__excelRow = r + 1;

    if (preenchidos > 0) linhas.push(obj);
  }

  return { headers, linhas };
}

const DICIONARIO_FIXO = {
  "顶针": "dedal",
  "钥匙扣": "chaveiro",
  "匙扣": "chaveiro",
  "挂件": "chaveiro",
  "银匙扣": "chaveiro",
  "蓝色": "azul",
  "大红": "vermelho escuro",
  "红色": "vermelho",
  "粉色": "rosa",
  "黑色": "preto",
  "白色": "branco",
  "地图": "mapa",
  "冰箱贴": "ímã de geladeira",
  "7.5塑料双面镜": "espelho duplo plástico 7.5",
  "塑料双面镜": "espelho duplo plástico",
  "双面镜": "espelho duplo",
  "帆布袋": "saco de pano",
  "桃心镜子": "espelho coração",
  "镜子": "espelho",
  "爱心": "coração"
};

function traduzirTextoContainer(txt) {
  const original = texto(txt);
  if (!original) return { traduzido: "", original: "" };

  let traduzido = original;
  if (DICIONARIO_FIXO[original]) {
    traduzido = DICIONARIO_FIXO[original];
  } else {
    for (const [chave, valor] of Object.entries(DICIONARIO_FIXO)) {
      if (traduzido.includes(chave)) {
        traduzido = traduzido.split(chave).join(valor);
      }
    }
  }

  traduzido = traduzido.replace(/\s+/g, " ").trim();
  return { traduzido, original };
}

function enriquecerLinhasContainer(linhas, camposDetectados = {}) {
  const campoProduto =
    camposDetectados.produto ||
    Object.keys(linhas[0] || {}).find((k) => {
      const n = normalizarCabecalho(k);
      return ["description", "descricao", "descrição", "品名", "produto", "nome"].includes(n);
    }) ||
    "";

  return linhas.map((linha) => {
    const clone = { ...linha };
    if (campoProduto && clone[campoProduto] !== undefined) {
      const t = traduzirTextoContainer(clone[campoProduto]);
      clone.__produto_original = t.original;
      clone[campoProduto] = t.traduzido || t.original;
    }
    return clone;
  });
}

function normalizeZipPath(p) {
  return String(p || "").replace(/\\/g, "/").replace(/^\//, "");
}

function dirnameZip(p) {
  const norm = normalizeZipPath(p);
  const idx = norm.lastIndexOf("/");
  return idx >= 0 ? norm.slice(0, idx) : "";
}

function resolveZipTarget(baseFile, target) {
  const baseDir = dirnameZip(baseFile);
  const stack = baseDir ? baseDir.split("/") : [];
  const parts = normalizeZipPath(target).split("/");

  if (normalizeZipPath(target).startsWith("xl/")) {
    return normalizeZipPath(target);
  }

  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") stack.pop();
    else stack.push(part);
  }

  return stack.join("/");
}

function parseRelationships(xmlText, relFilePath) {
  const rels = {};
  const relRegex = /<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"[^>]*\/?>/g;
  let match;

  while ((match = relRegex.exec(xmlText))) {
    const [, id, target] = match;
    rels[id] = resolveZipTarget(relFilePath, target);
  }

  return rels;
}

async function abrirZipMap(buffer) {
  const directory = await unzipper.Open.buffer(buffer);
  const map = {};
  for (const file of directory.files || []) {
    map[normalizeZipPath(file.path)] = file;
  }
  return map;
}

async function lerArquivoZip(zipMap, filePath, asText = true) {
  const entry = zipMap[normalizeZipPath(filePath)];
  if (!entry) return asText ? "" : null;
  const buf = await entry.buffer();
  return asText ? buf.toString("utf8") : buf;
}

function parseWorkbookSheets(workbookXml, workbookRelsXml) {
  const rels = parseRelationships(workbookRelsXml, "xl/_rels/workbook.xml.rels");
  const result = [];
  const sheetRegex = /<sheet\b[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"[^>]*\/?>/g;
  let match;

  while ((match = sheetRegex.exec(workbookXml))) {
    const [, name, rid] = match;
    const sheetPath = rels[rid];
    if (sheetPath) result.push({ name, path: sheetPath });
  }

  return result;
}

function parseWorksheetDrawingRids(sheetXml) {
  const result = [];
  const regex = /<drawing\b[^>]*r:id="([^"]+)"[^>]*\/?>/g;
  let match;
  while ((match = regex.exec(sheetXml))) result.push(match[1]);
  return result;
}

function parseDrawingAnchors(drawingXml) {
  const anchors = [];
  const anchorRegex = /<xdr:(?:twoCellAnchor|oneCellAnchor)\b[\s\S]*?<\/xdr:(?:twoCellAnchor|oneCellAnchor)>/g;
  let anchorMatch;

  while ((anchorMatch = anchorRegex.exec(drawingXml))) {
    const block = anchorMatch[0];
    const rowMatch = block.match(/<xdr:from>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/);
    const colMatch = block.match(/<xdr:from>[\s\S]*?<xdr:col>(\d+)<\/xdr:col>/);
    const embedMatch = block.match(/<a:blip\b[^>]*r:embed="([^"]+)"/);

    if (rowMatch && embedMatch) {
      anchors.push({
        rowExcel: Number(rowMatch[1]) + 1,
        colExcel: colMatch ? Number(colMatch[1]) + 1 : 1,
        relId: embedMatch[1]
      });
    }
  }

  return anchors;
}

async function extrairImagensAncoradasPrimeiraAba(buffer, fileBaseName = "container") {
  const zipMap = await abrirZipMap(buffer);

  const workbookXml = await lerArquivoZip(zipMap, "xl/workbook.xml", true);
  const workbookRelsXml = await lerArquivoZip(zipMap, "xl/_rels/workbook.xml.rels", true);
  const sheets = parseWorkbookSheets(workbookXml, workbookRelsXml);

  if (!sheets.length) return [];

  const primeira = sheets[0];
  const sheetXml = await lerArquivoZip(zipMap, primeira.path, true);
  const sheetRelsPath = `${dirnameZip(primeira.path)}/_rels/${path.posix.basename(primeira.path)}.rels`;
  const sheetRelsXml = await lerArquivoZip(zipMap, sheetRelsPath, true);

  if (!sheetXml || !sheetRelsXml) return [];

  const sheetRels = parseRelationships(sheetRelsXml, sheetRelsPath);
  const drawingRids = parseWorksheetDrawingRids(sheetXml);
  const mediaUrlByPath = {};
  const anchorsForSheet = [];

  for (const drawingRid of drawingRids) {
    const drawingPath = sheetRels[drawingRid];
    if (!drawingPath) continue;

    const drawingXml = await lerArquivoZip(zipMap, drawingPath, true);
    const drawingRelsPath = `${dirnameZip(drawingPath)}/_rels/${path.posix.basename(drawingPath)}.rels`;
    const drawingRelsXml = await lerArquivoZip(zipMap, drawingRelsPath, true);

    if (!drawingXml || !drawingRelsXml) continue;

    const drawingRels = parseRelationships(drawingRelsXml, drawingRelsPath);
    const anchors = parseDrawingAnchors(drawingXml);

    for (const anchor of anchors) {
      const mediaPath = drawingRels[anchor.relId];
      if (!mediaPath) continue;

      let mediaUrl = mediaUrlByPath[mediaPath];
      if (!mediaUrl) {
        const mediaBuffer = await lerArquivoZip(zipMap, mediaPath, false);
        if (!mediaBuffer) continue;

        const nomeOriginal = path.posix.basename(mediaPath);
        const nomeFinal = `${Date.now()}_${slugArquivo(fileBaseName)}_${Object.keys(mediaUrlByPath).length}_${nomeOriginal}`;
        const caminhoFinal = path.join(CONTAINER_IMG_DIR, nomeFinal);

        fs.writeFileSync(caminhoFinal, mediaBuffer);
        mediaUrl = `/uploads/produtos/container/${nomeFinal}`;
        mediaUrlByPath[mediaPath] = mediaUrl;
      }

      anchorsForSheet.push({
        rowExcel: anchor.rowExcel,
        colExcel: anchor.colExcel,
        url: mediaUrl
      });
    }
  }

  anchorsForSheet.sort((a, b) => {
    if (a.rowExcel !== b.rowExcel) return a.rowExcel - b.rowExcel;
    return a.colExcel - b.colExcel;
  });

  return anchorsForSheet;
}

function anexarImagensPorAnchorExato(linhas, anchors = []) {
  const imageByRow = new Map();
  for (const anchor of anchors) {
    if (!imageByRow.has(anchor.rowExcel)) {
      imageByRow.set(anchor.rowExcel, anchor.url);
    }
  }

  return linhas.map((linha) => ({
    ...linha,
    __imagem: imageByRow.get(Number(linha.__excelRow || 0)) || "",
    __checked: true
  }));
}

app.get("/", (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.get("/importar_container", (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "importar_container.html"));
});

app.get("/importar_container.html", (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "importar_container.html"));
});

app.get("/api/status", (_req, res) => {
  res.json({ ok: true, status: "online" });
});

app.post("/api/importar-container", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ ok: false, erro: "Arquivo não enviado." });
    }

    const workbook = XLSX.read(file.buffer, {
      type: "buffer",
      cellDates: true,
      raw: false
    });

    const primeiraAba = workbook.SheetNames[0];
    if (!primeiraAba) {
      return res.status(400).json({ ok: false, erro: "Nenhuma aba encontrada." });
    }

    const sheet = workbook.Sheets[primeiraAba];
    const parsed = sheetToJsonContainer(sheet);

    let dados = parsed.linhas;
    const campos = detectarCampos(parsed.headers);

    dados = enriquecerLinhasContainer(dados, campos);

    const anchors = await extrairImagensAncoradasPrimeiraAba(
      file.buffer,
      file.originalname || "container"
    );

    dados = anexarImagensPorAnchorExato(dados, anchors);

    const colunas = parsed.headers.filter(Boolean);

    return res.json({
      ok: true,
      aba: primeiraAba,
      totalLinhas: dados.length,
      totalImagens: anchors.length,
      colunas,
      camposDetectados: detectarCampos(colunas),
      dados
    });
  } catch (error) {
    return responderErro(res, "Erro ao analisar contêiner.", error);
  }
});

app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ ok: false, erro: "Rota não encontrada." });
  }
  return res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
