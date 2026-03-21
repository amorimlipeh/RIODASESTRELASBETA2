const express = require("express");
const multer = require("multer");
const xlsx = require("xlsx");
const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const unzipper = require("unzipper");

const app = express();

app.use(express.json({ limit: "30mb" }));
app.use(express.urlencoded({ extended: true, limit: "30mb" }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const dataDir = path.join(__dirname, "data");
const uploadsDir = path.join(__dirname, "uploads");
const uploadsProdutosDir = path.join(uploadsDir, "produtos");
const estoqueFile = path.join(dataDir, "estoque.json");
const historicoFile = path.join(dataDir, "historico_importacoes.json");
const traducoesFile = path.join(dataDir, "traducoes.json");

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(uploadsProdutosDir)) fs.mkdirSync(uploadsProdutosDir, { recursive: true });
if (!fs.existsSync(estoqueFile)) fs.writeFileSync(estoqueFile, "[]", "utf-8");
if (!fs.existsSync(historicoFile)) fs.writeFileSync(historicoFile, "[]", "utf-8");
if (!fs.existsSync(traducoesFile)) fs.writeFileSync(traducoesFile, "{}", "utf-8");

const upload = multer({
  dest: uploadsDir,
  limits: { fileSize: 50 * 1024 * 1024 }
});

function lerJson(caminho, fallback = []) {
  try {
    if (!fs.existsSync(caminho)) return fallback;
    const raw = fs.readFileSync(caminho, "utf-8");
    if (!raw.trim()) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function salvarJson(caminho, dados) {
  fs.writeFileSync(caminho, JSON.stringify(dados, null, 2), "utf-8");
}

function registrarHistorico(modulo, arquivo, aba, quantidade) {
  const hist = lerJson(historicoFile, []);
  hist.unshift({
    modulo,
    arquivo,
    aba,
    quantidade,
    data: new Date().toISOString()
  });
  salvarJson(historicoFile, hist);
}

function parseNumber(v) {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;

  const s = String(v)
    .trim()
    .replace(/\s+/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");

  const m = s.match(/-?\d+(?:\.\d+)?/);
  if (!m) return 0;

  const n = Number(m[0]);
  return Number.isFinite(n) ? n : 0;
}

function normalizarTexto(v) {
  return String(v || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function contemCJK(texto) {
  return /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/.test(String(texto || ""));
}

function detectarCamposGenericos(cabecalhos) {
  const campos = {
    codigo: "",
    produto: "",
    endereco: "",
    quantidade: "",
    container: "",
    lote: "",
    caixas: "",
    unidades: "",
    fator: "",
    nf: "",
    fornecedor: "",
    imagem: ""
  };

  cabecalhos.forEach((h) => {
    const n = normalizarTexto(h);

    if (!campos.codigo && (
      n === "item no" ||
      n.includes("item no") ||
      n.includes("codigo do produto") ||
      n.includes("codigo") ||
      n === "sku" ||
      n.includes("material")
    )) campos.codigo = h;

    if (!campos.produto && (
      n.includes("description") ||
      n.includes("descricao") ||
      n === "produto" ||
      n.includes("desc")
    )) campos.produto = h;

    if (!campos.endereco && (
      n === "local" ||
      n.includes("endereco") ||
      n.includes("address")
    )) campos.endereco = h;

    if (!campos.quantidade && (
      n.includes("estoque (un)") ||
      n.includes("qtde") ||
      n.includes("quantidade") ||
      n.includes("estoque atual") ||
      n.includes("disponivel (un)")
    )) campos.quantidade = h;

    if (!campos.container && n.includes("container")) campos.container = h;
    if (!campos.lote && n.includes("lote")) campos.lote = h;

    if (!campos.caixas && (
      n === "ctns" ||
      n.includes("caixas") ||
      n.includes("carton")
    )) campos.caixas = h;

    if (!campos.unidades && (
      n === "t.qty" ||
      n.includes("t.qty") ||
      n === "qty" ||
      n.includes("qty") ||
      n.includes("unidades") ||
      n.includes("qtde") ||
      n.includes("estoque (un)")
    )) campos.unidades = h;

    if (!campos.fator && (
      n === "q/c" ||
      n.includes("q/c") ||
      n.includes("factor") ||
      n.includes("fator")
    )) campos.fator = h;

    if (!campos.nf && (
      n === "nf" ||
      n.includes("nota fiscal") ||
      n.includes("numero nf")
    )) campos.nf = h;

    if (!campos.fornecedor && (
      n.includes("fornecedor") ||
      n.includes("supplier")
    )) campos.fornecedor = h;

    if (!campos.imagem && (
      n === "picture" ||
      n.includes("picture") ||
      n.includes("imagem") ||
      n.includes("image") ||
      n.includes("photo")
    )) campos.imagem = h;
  });

  return campos;
}

function extnameLower(filename) {
  return path.extname(filename || "").toLowerCase();
}

async function extractPdfText(filePath) {
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);
  return data.text || "";
}

function limparTexto(txt = "") {
  return String(txt)
    .replace(/\s+/g, " ")
    .replace(/[^\w\u00C0-\u024F\u4e00-\u9fff\s\-./x]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const dictTraducao = {
  "钥匙扣": "Chaveiro",
  "挂件": "Pingente",
  "饰品": "Acessório",
  "纪念品": "Lembrança",
  "礼物": "Presente",
  "冰箱贴": "Imã de Geladeira",
  "地图": "Mapa",
  "巴西": "Brasil",
  "耶稣": "Jesus",
  "十字架": "Cruz",
  "车牌": "Placa",
  "铝片": "Alumínio",
  "纸卡": "Cartela",
  "白色": "Branco",
  "黑色": "Preto",
  "蓝色": "Azul",
  "红色": "Vermelho",
  "大红": "Vermelho",
  "粉色": "Rosa",
  "绿色": "Verde",
  "黄色": "Amarelo",
  "紫色": "Roxo",
  "棕色": "Marrom",
  "银箔": "Prata",
  "镜子": "Espelho",
  "袋": "Saco",
  "opp袋": "Saco OPP",
  "加opp袋": "Com Saco OPP",
  "箱贴": "Adesivo de Caixa",
  "冰箱贴": "Imã de Geladeira",
  "顶针": "Dedal",
  "1件": "1 un",
  "2件": "2 un",
  "57镜子银箔纸2件": "Espelho 5.7 prata papel 2 un",
  "7.5x7.5银箔冰箱贴": "Imã de Geladeira 7.5x7.5 prata",
  "白色纸卡加OPP袋1件": "Cartela Branca com Saco OPP 1 un"
};

function traduzirLocal(texto) {
  let result = String(texto || "");
  const entradas = Object.entries(dictTraducao).sort((a, b) => b[0].length - a[0].length);

  for (const [orig, dest] of entradas) {
    result = result.split(orig).join(dest);
  }
  return result;
}

function inserirEspacosCorretos(txt = "") {
  let out = String(txt || "");

  const tipos = [
    "Chaveiro",
    "Pingente",
    "Dedal",
    "Imã De Geladeira",
    "Imã de Geladeira",
    "Mapa",
    "Cartela",
    "Espelho",
    "Placa",
    "Acessório"
  ];

  const cores = [
    "Azul",
    "Vermelho",
    "Rosa",
    "Preto",
    "Branco",
    "Verde",
    "Amarelo",
    "Roxo",
    "Marrom"
  ];

  for (const tipo of tipos) {
    for (const cor of cores) {
      out = out.replaceAll(`${tipo}${cor}`, `${tipo} ${cor}`);
    }
  }

  out = out.replaceAll("Imã De Geladeira", "Imã de Geladeira");
  out = out.replaceAll("Mapa Brasil", "Mapa do Brasil");
  out = out.replaceAll("Chaveiro Mapa Brasil", "Chaveiro Mapa do Brasil");
  out = out.replaceAll("Pingente Brasil", "Pingente do Brasil");
  out = out.replaceAll("Cartela Branca Com Saco Opp", "Cartela Branca com Saco OPP");

  return out;
}

function padronizarNome(txt = "") {
  let out = limparTexto(txt);

  out = out
    .toLowerCase()
    .replace(/\b\w/g, (l) => l.toUpperCase());

  out = inserirEspacosCorretos(out);

  out = out.replace(/\bChaveiro Chaveiro\b/g, "Chaveiro");
  out = out.replace(/\bPingente Pingente\b/g, "Pingente");
  out = out.replace(/\bDedal Dedal\b/g, "Dedal");
  out = out.replace(/\bImã De Geladeira Imã De Geladeira\b/g, "Imã de Geladeira");

  out = out.replace(/\bOpp\b/g, "OPP");
  out = out.replace(/\bRio De Janeiro\b/g, "Rio de Janeiro");
  out = out.replace(/\bImã De Geladeira\b/g, "Imã de Geladeira");
  out = out.replace(/\bPlaca Imã De Geladeira\b/g, "Placa Imã de Geladeira");
  out = out.replace(/\bAlumínio Placa Imã De Geladeira\b/g, "Placa de Alumínio Imã de Geladeira");
  out = out.replace(/\bEspelho 57 Prata Papel 2 Un\b/g, "Espelho 5.7 Prata Papel 2 un");
  out = out.replace(/\b1 Un\b/g, "1 un");
  out = out.replace(/\b2 Un\b/g, "2 un");

  return out.trim();
}

function traduzirTexto(texto) {
  const valor = String(texto || "").trim();
  if (!valor) return "";

  const cache = lerJson(traducoesFile, {});
  if (cache[valor]) return cache[valor];

  let traduzido = valor;

  if (contemCJK(valor)) {
    traduzido = traduzirLocal(valor);
  }

  traduzido = padronizarNome(traduzido);

  cache[valor] = traduzido || valor;
  salvarJson(traducoesFile, cache);

  return cache[valor];
}

function traduzirItensContainer(itens, camposDetectados) {
  const campoProduto = camposDetectados?.produto || "DESCRIPTION";

  for (const item of itens) {
    const original =
      item.produto ||
      item[campoProduto] ||
      item.DESCRIPTION ||
      "";

    const traduzido = traduzirTexto(original);

    item.produto_original = original;
    item.produto = traduzido || original;

    if (campoProduto) {
      item[campoProduto] = traduzido || original;
      item[`${campoProduto}_ORIGINAL`] = original;
    }

    if (item.DESCRIPTION !== undefined) {
      item.DESCRIPTION_ORIGINAL = original;
      item.DESCRIPTION = traduzido || original;
    }
  }

  return itens;
}

function parseCatalogPdfText(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  const itens = [];
  for (const line of lines) {
    if (/cat[aá]logo/i.test(line)) continue;
    if (/^[A-Z]{2,}\d+[A-Z0-9]*$/i.test(line)) {
      itens.push({
        codigo: line,
        produto: "",
        origem_pdf: "catalogo",
        imagem: `/uploads/produtos/${line}.jpg`
      });
    }
  }

  return {
    abas: ["PDF"],
    planilhas: { PDF: itens },
    metadados: {
      PDF: {
        cabecalhos: itens.length ? Object.keys(itens[0]) : ["codigo", "produto", "origem_pdf", "imagem"],
        totalLinhas: itens.length,
        camposDetectados: {
          codigo: "codigo",
          produto: "produto",
          imagem: "imagem"
        }
      }
    }
  };
}

function parseSimpleStockPdfText(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const itens = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const codeMatch = line.match(/^\(([^)]+)\)$/);

    if (codeMatch) {
      const codigo = codeMatch[1].trim();
      const produto = (lines[i + 1] || "").trim();
      const qtd = parseNumber(lines[i + 2] || "0");

      if (produto) {
        itens.push({
          codigo,
          produto,
          quantidade: qtd
        });
      }

      i += 3;
      continue;
    }

    i++;
  }

  return {
    abas: ["PDF"],
    planilhas: { PDF: itens },
    metadados: {
      PDF: {
        cabecalhos: itens.length ? Object.keys(itens[0]) : ["codigo", "produto", "quantidade"],
        totalLinhas: itens.length,
        camposDetectados: {
          codigo: "codigo",
          produto: "produto",
          quantidade: "quantidade"
        }
      }
    }
  };
}

function parseErpPdfText(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  let localAtual = "";
  let grupoAtual = "";
  const itens = [];

  for (const line of lines) {
    if (/^Local:/i.test(line)) {
      localAtual = line.replace(/^Local:\s*/i, "").trim();
      continue;
    }

    if (/^Grupo:/i.test(line)) {
      grupoAtual = line.replace(/^Grupo:\s*/i, "").trim();
      continue;
    }

    const match = line.match(/([0-9A-Z]+)\s*-\s*(.+?)\s+([0-9.,-]+)\s*$/);
    if (match) {
      const codigo = match[1].trim();
      const produto = match[2].trim();
      const empresa = match[3].trim();

      itens.push({
        codigo,
        produto,
        local: localAtual,
        grupo: grupoAtual,
        empresa,
        estoque_atual: 0,
        custo: 0,
        total_custo_estoque: 0,
        unidade: "UN"
      });
    }
  }

  return {
    abas: ["PDF"],
    planilhas: { PDF: itens },
    metadados: {
      PDF: {
        cabecalhos: itens.length ? Object.keys(itens[0]) : ["codigo", "produto", "local", "grupo", "empresa"],
        totalLinhas: itens.length,
        camposDetectados: {
          codigo: "codigo",
          produto: "produto",
          quantidade: "estoque_atual"
        }
      }
    }
  };
}

function detectarLinhaCabecalhoContainer(matriz) {
  for (let i = 0; i < Math.min(matriz.length, 30); i++) {
    const row = matriz[i] || [];
    const textos = row.map((c) => normalizarTexto(c)).filter(Boolean);

    const temItem = textos.some((t) => t.includes("item no") || t === "item");
    const temDesc = textos.some((t) => t.includes("description") || t.includes("desc"));
    const temCtns = textos.some((t) => t === "ctns" || t.includes("carton"));

    if (temItem && temDesc && temCtns) return i;
  }
  return -1;
}

function limparCabecalhos(cabecalhos) {
  const usados = new Set();

  return cabecalhos.map((h) => {
    let nome = String(h || "").trim();

    if (!nome || nome.startsWith("__EMPTY")) return null;

    nome = nome.replace(/\s+/g, " ").trim();

    if (usados.has(nome)) {
      let i = 2;
      while (usados.has(`${nome}_${i}`)) i++;
      nome = `${nome}_${i}`;
    }

    usados.add(nome);
    return nome;
  });
}

function adicionarFallbackImagem(item, camposDetectados) {
  const codigo = String(
    item.codigo ||
    item["ITEM NO"] ||
    item[camposDetectados?.codigo] ||
    ""
  ).trim();

  if (!codigo) return item;

  const imagemTexto = String(
    item.imagem ||
    item[camposDetectados?.imagem] ||
    ""
  ).trim();

  return {
    ...item,
    imagem: imagemTexto || `/uploads/produtos/${codigo}.jpg`
  };
}

async function extrairImagensComPosicao(filePath) {
  try {
    const directory = await unzipper.Open.file(filePath);

    const drawingFiles = directory.files.filter((f) =>
      /^xl\/drawings\/drawing\d+\.xml$/i.test(f.path)
    );

    const relFiles = directory.files.filter((f) =>
      /^xl\/drawings\/_rels\/drawing\d+\.xml\.rels$/i.test(f.path)
    );

    const mediaFiles = directory.files.filter((f) =>
      f.path.startsWith("xl/media/")
    );

    const resultado = [];

    for (const drawingFile of drawingFiles) {
      const drawingName = path.basename(drawingFile.path);
      const relName = `${drawingName}.rels`;
      const relFile = relFiles.find((r) => r.path.endsWith(relName));

      if (!relFile) continue;

      const drawingXml = (await drawingFile.buffer()).toString("utf8");
      const relXml = (await relFile.buffer()).toString("utf8");

      const relMap = {};
      const relRegex = /Id="(rId\d+)"[^>]*Target="([^"]+)"/g;
      let relMatch;

      while ((relMatch = relRegex.exec(relXml)) !== null) {
        relMap[relMatch[1]] = relMatch[2];
      }

      const anchorRegex = /<xdr:twoCellAnchor[\s\S]*?<\/xdr:twoCellAnchor>/g;
      const anchors = drawingXml.match(anchorRegex) || [];

      for (const anchor of anchors) {
        const rowMatch = anchor.match(/<xdr:from>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/);
        const embedMatch = anchor.match(/r:embed="(rId\d+)"/);

        if (!rowMatch || !embedMatch) continue;

        const row = Number(rowMatch[1]);
        const rid = embedMatch[1];
        const target = relMap[rid];

        if (!target) continue;

        const targetFileName = path.basename(target);
        const mediaFile = mediaFiles.find((m) => m.path.endsWith(targetFileName));

        if (!mediaFile) continue;

        const ext = path.extname(mediaFile.path) || ".png";
        const nomeArquivo = `img_${Date.now()}_${row}_${Math.random().toString(36).slice(2, 8)}${ext}`;
        const caminhoFinal = path.join(uploadsProdutosDir, nomeArquivo);

        fs.writeFileSync(caminhoFinal, await mediaFile.buffer());

        resultado.push({
          row,
          path: `/uploads/produtos/${nomeArquivo}`
        });
      }
    }

    return resultado.sort((a, b) => a.row - b.row);
  } catch (err) {
    console.log("ERRO EXTRAÇÃO AVANÇADA:", err);
    return [];
  }
}

async function processarAbaContainer(sheet, filePath, extArquivo) {
  const matriz = xlsx.utils.sheet_to_json(sheet, {
    header: 1,
    defval: ""
  });

  const imagensExtraidas = extArquivo === ".xlsx"
    ? await extrairImagensComPosicao(filePath)
    : [];

  const headerIndex = detectarLinhaCabecalhoContainer(matriz);

  if (headerIndex === -1) {
    const fallback = xlsx.utils.sheet_to_json(sheet, { defval: "" });
    const cabecalhos = fallback.length
      ? Object.keys(fallback[0]).filter((c) => !String(c).startsWith("__EMPTY"))
      : [];

    const camposDetectados = detectarCamposGenericos(cabecalhos);
    let itens = fallback.map((row) => adicionarFallbackImagem(row, camposDetectados));
    itens = traduzirItensContainer(itens, camposDetectados);

    return {
      itens,
      cabecalhos,
      camposDetectados
    };
  }

  const rawHeaders = matriz[headerIndex] || [];
  const cleanHeaders = limparCabecalhos(rawHeaders);

  const validIndexes = [];
  const cabecalhos = [];

  cleanHeaders.forEach((h, idx) => {
    if (h) {
      validIndexes.push(idx);
      cabecalhos.push(h);
    }
  });

  const camposDetectados = detectarCamposGenericos(cabecalhos);
  const itens = [];

  for (let i = headerIndex + 1; i < matriz.length; i++) {
    const row = matriz[i] || [];

    const vazio = validIndexes.every((idx) => String(row[idx] || "").trim() === "");
    if (vazio) continue;

    const primeira = String(row[validIndexes[0]] || "").trim();
    const segunda = String(row[validIndexes[1]] || "").trim();

    const linhaSecundaria =
      /[\u4e00-\u9fff]/.test(primeira) ||
      /[\u4e00-\u9fff]/.test(segunda);

    if (linhaSecundaria) continue;

    const item = {};
    validIndexes.forEach((idx, pos) => {
      item[cabecalhos[pos]] = row[idx];
    });

    const base = adicionarFallbackImagem(item, camposDetectados);
    const img = imagensExtraidas.find((imagem) => imagem.row === i);
    if (img) base.imagem = img.path;

    itens.push(base);
  }

  const itensTraduzidos = traduzirItensContainer(itens, camposDetectados);

  return {
    itens: itensTraduzidos,
    cabecalhos,
    camposDetectados
  };
}

function processarAbaERP(sheet) {
  const itens = xlsx.utils.sheet_to_json(sheet, { defval: "" });
  const cabecalhos = itens.length ? Object.keys(itens[0]) : [];
  return {
    itens,
    cabecalhos,
    camposDetectados: detectarCamposGenericos(cabecalhos)
  };
}

function processarAbaWMS(sheet) {
  const itens = xlsx.utils.sheet_to_json(sheet, { defval: "" });
  const cabecalhos = itens.length ? Object.keys(itens[0]) : [];
  return {
    itens,
    cabecalhos,
    camposDetectados: detectarCamposGenericos(cabecalhos)
  };
}

function abrirWorkbook(filePath) {
  return xlsx.readFile(filePath, { cellDates: true });
}

app.get("/", (req, res) => res.redirect("/index.html"));
app.get("/importar_wms.html", (req, res) => res.redirect("/importar.html"));
app.get("/importar_container", (req, res) => res.redirect("/importar_container.html"));
app.get("/importar_erp", (req, res) => res.redirect("/importar_erp.html"));

app.get("/api/historico-importacoes", (req, res) => {
  res.json({ ok: true, itens: lerJson(historicoFile, []) });
});

app.get("/api/estoque", (req, res) => {
  res.json({ ok: true, itens: lerJson(estoqueFile, []) });
});

app.post("/api/importar-wms", upload.array("arquivo"), async (req, res) => {
  try {
    if (!req.files || !req.files.length) {
      return res.status(400).json({ ok: false, erro: "Nenhum arquivo enviado" });
    }

    const planilhas = {};
    const abas = [];
    const metadados = {};

    for (const file of req.files) {
      const ext = extnameLower(file.originalname || file.filename);

      if (ext === ".xls" || ext === ".xlsx" || ext === ".csv") {
        const wb = abrirWorkbook(file.path);

        for (const nomeAba of wb.SheetNames) {
          const resultado = processarAbaWMS(wb.Sheets[nomeAba]);

          let nomeFinal = nomeAba;
          if (planilhas[nomeFinal]) {
            let i = 2;
            while (planilhas[`${nomeAba} (${i})`]) i++;
            nomeFinal = `${nomeAba} (${i})`;
          }

          planilhas[nomeFinal] = resultado.itens;
          abas.push(nomeFinal);
          metadados[nomeFinal] = {
            cabecalhos: resultado.cabecalhos,
            totalLinhas: resultado.itens.length,
            camposDetectados: resultado.camposDetectados
          };
        }
      } else if (ext === ".pdf") {
        const text = await extractPdfText(file.path);
        const parsed = parseSimpleStockPdfText(text);

        for (const nomeAba of parsed.abas) {
          const nomeFinal = `PDF - ${path.basename(file.originalname, ".pdf")}`;
          planilhas[nomeFinal] = parsed.planilhas[nomeAba];
          abas.push(nomeFinal);
          metadados[nomeFinal] = parsed.metadados[nomeAba];
        }
      } else {
        return res.status(400).json({
          ok: false,
          erro: `Formato ainda não suportado para WMS: ${ext || "desconhecido"}`
        });
      }

      try { fs.unlinkSync(file.path); } catch {}
    }

    res.json({ ok: true, abas, planilhas, metadados });
  } catch (err) {
    console.log("ERRO /api/importar-wms:", err);
    res.status(500).json({ ok: false, erro: "Erro ao importar WMS" });
  }
});

app.post("/api/importar-erp", upload.array("arquivo"), async (req, res) => {
  try {
    if (!req.files || !req.files.length) {
      return res.status(400).json({ ok: false, erro: "Nenhum arquivo enviado" });
    }

    const planilhas = {};
    const abas = [];
    const metadados = {};

    for (const file of req.files) {
      const ext = extnameLower(file.originalname || file.filename);

      if (ext === ".xls" || ext === ".xlsx" || ext === ".csv") {
        const wb = abrirWorkbook(file.path);

        for (const nomeAba of wb.SheetNames) {
          const resultado = processarAbaERP(wb.Sheets[nomeAba]);

          let nomeFinal = nomeAba;
          if (planilhas[nomeFinal]) {
            let i = 2;
            while (planilhas[`${nomeAba} (${i})`]) i++;
            nomeFinal = `${nomeAba} (${i})`;
          }

          planilhas[nomeFinal] = resultado.itens;
          abas.push(nomeFinal);
          metadados[nomeFinal] = {
            cabecalhos: resultado.cabecalhos,
            totalLinhas: resultado.itens.length,
            camposDetectados: resultado.camposDetectados
          };
        }
      } else if (ext === ".pdf") {
        const text = await extractPdfText(file.path);
        const parsed = parseErpPdfText(text);

        for (const nomeAba of parsed.abas) {
          const nomeFinal = `PDF - ${path.basename(file.originalname, ".pdf")}`;
          planilhas[nomeFinal] = parsed.planilhas[nomeAba];
          abas.push(nomeFinal);
          metadados[nomeFinal] = parsed.metadados[nomeAba];
        }
      } else {
        return res.status(400).json({
          ok: false,
          erro: `Formato ainda não suportado para ERP: ${ext || "desconhecido"}`
        });
      }

      try { fs.unlinkSync(file.path); } catch {}
    }

    res.json({ ok: true, abas, planilhas, metadados });
  } catch (err) {
    console.log("ERRO /api/importar-erp:", err);
    res.status(500).json({ ok: false, erro: "Erro ao importar ERP" });
  }
});

app.post("/api/importar-container", upload.array("arquivo"), async (req, res) => {
  try {
    if (!req.files || !req.files.length) {
      return res.status(400).json({ ok: false, erro: "Nenhum arquivo enviado" });
    }

    const planilhas = {};
    const abas = [];
    const metadados = {};

    for (const file of req.files) {
      const ext = extnameLower(file.originalname || file.filename);

      if (ext === ".xls" || ext === ".xlsx" || ext === ".csv") {
        const wb = abrirWorkbook(file.path);

        for (const nomeAba of wb.SheetNames) {
          const resultado = await processarAbaContainer(wb.Sheets[nomeAba], file.path, ext);

          let nomeFinal = nomeAba;
          if (planilhas[nomeFinal]) {
            let i = 2;
            while (planilhas[`${nomeAba} (${i})`]) i++;
            nomeFinal = `${nomeAba} (${i})`;
          }

          planilhas[nomeFinal] = resultado.itens;
          abas.push(nomeFinal);
          metadados[nomeFinal] = {
            cabecalhos: resultado.cabecalhos,
            totalLinhas: resultado.itens.length,
            camposDetectados: resultado.camposDetectados
          };
        }
      } else if (ext === ".pdf") {
        const text = await extractPdfText(file.path);
        const parsed = parseCatalogPdfText(text);

        for (const nomeAba of parsed.abas) {
          const nomeFinal = `PDF - ${path.basename(file.originalname, ".pdf")}`;
          planilhas[nomeFinal] = parsed.planilhas[nomeAba];
          abas.push(nomeFinal);
          metadados[nomeFinal] = parsed.metadados[nomeAba];
        }
      } else {
        return res.status(400).json({
          ok: false,
          erro: `Formato ainda não suportado para Contêiner: ${ext || "desconhecido"}`
        });
      }

      try { fs.unlinkSync(file.path); } catch {}
    }

    res.json({ ok: true, abas, planilhas, metadados });
  } catch (err) {
    console.log("ERRO /api/importar-container:", err);
    res.status(500).json({ ok: false, erro: "Erro ao importar contêiner" });
  }
});

app.post("/api/estoque", (req, res) => {
  try {
    const itens = Array.isArray(req.body.itens) ? req.body.itens : [];
    if (!itens.length) {
      return res.status(400).json({ ok: false, erro: "Nenhum item recebido" });
    }

    const estoque = lerJson(estoqueFile, []);
    const novos = itens.map((item) => ({
      ...item,
      origem: item.origem || "WMS",
      data_importacao: new Date().toISOString()
    }));

    salvarJson(estoqueFile, [...estoque, ...novos]);
    registrarHistorico("WMS", "arquivo WMS", "aba", novos.length);

    res.json({ ok: true, inseridos: novos.length });
  } catch (err) {
    console.log("ERRO /api/estoque:", err);
    res.status(500).json({ ok: false, erro: "Erro ao salvar estoque" });
  }
});

app.post("/api/estoque/erp", (req, res) => {
  try {
    const itens = Array.isArray(req.body.itens) ? req.body.itens : [];
    const arquivo = String(req.body.arquivo || "").trim();
    const aba = String(req.body.aba || "").trim();

    if (!itens.length) {
      return res.status(400).json({ ok: false, erro: "Nenhum item recebido" });
    }

    const estoque = lerJson(estoqueFile, []);
    const novos = itens.map((item) => ({
      origem: "ERP",
      ...item,
      data_importacao: new Date().toISOString()
    }));

    salvarJson(estoqueFile, [...estoque, ...novos]);
    registrarHistorico("ERP", arquivo || "arquivo ERP", aba || "aba", novos.length);

    res.json({ ok: true, inseridos: novos.length });
  } catch (err) {
    console.log("ERRO /api/estoque/erp:", err);
    res.status(500).json({ ok: false, erro: "Erro ao salvar ERP" });
  }
});

app.post("/api/estoque/container", (req, res) => {
  try {
    const itens = Array.isArray(req.body.itens) ? req.body.itens : [];
    const arquivo = String(req.body.arquivo || "").trim();
    const aba = String(req.body.aba || "").trim();

    if (!itens.length) {
      return res.status(400).json({ ok: false, erro: "Nenhum item recebido" });
    }

    const estoque = lerJson(estoqueFile, []);
    const novos = itens.map((item) => {
      const codigo = String(item.codigo || item["ITEM NO"] || "").trim();
      const imagemInformada = String(item.imagem || "").trim();
      const imagemFinal = imagemInformada || (codigo ? `/uploads/produtos/${codigo}.jpg` : "");

      return {
        origem: "CONTAINER",
        codigo,
        produto: item.produto || item.DESCRIPTION || "",
        produto_original: item.produto_original || item.DESCRIPTION_ORIGINAL || "",
        container: item.container || "",
        lote: item.lote || "",
        caixas: parseNumber(item.caixas || item.CTNS),
        unidades: parseNumber(item.unidades || item["T.QTY"]),
        fator: parseNumber(item.fator || item["Q/C"]),
        nf: item.nf || "",
        fornecedor: item.fornecedor || "",
        imagem: imagemFinal,
        bruto: item.bruto || {},
        data_importacao: new Date().toISOString()
      };
    });

    salvarJson(estoqueFile, [...estoque, ...novos]);
    registrarHistorico("CONTAINER", arquivo || "arquivo contêiner", aba || "aba", novos.length);

    res.json({ ok: true, inseridos: novos.length });
  } catch (err) {
    console.log("ERRO /api/estoque/container:", err);
    res.status(500).json({ ok: false, erro: "Erro ao salvar contêiner" });
  }
});

app.use((req, res) => {
  res.status(404).send(`Cannot ${req.method} ${req.path}`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
