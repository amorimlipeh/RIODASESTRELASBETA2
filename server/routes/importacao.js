const express = require("express");
const multer = require("multer");
const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");

const { ensureDir } = require("../utils/fileDB");
const {
  normalizarEmpresa,
  loadEmpresaJson,
  saveEmpresaJson,
  caminhoArquivoEmpresa
} = require("../empresa_data");

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, "../../uploads/importacao");
ensureDir(UPLOAD_DIR);

const upload = multer({
  dest: UPLOAD_DIR
});

function empresaAtual(req) {
  return normalizarEmpresa(
    req.headers["x-empresa"] ||
    req.query.empresa ||
    req.body?.empresa ||
    "rio_das_estrelas"
  );
}

function lerWorkbook(filePath) {
  return XLSX.readFile(filePath, { cellDates: false });
}

function sheetToJson(workbook, sheetName) {
  const nome = sheetName && workbook.SheetNames.includes(sheetName)
    ? sheetName
    : workbook.SheetNames[0];

  const sheet = workbook.Sheets[nome];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  return {
    activeSheetName: nome,
    rows
  };
}

function texto(v) {
  return String(v ?? "").trim();
}

function numero(v) {
  if (v === null || v === undefined || v === "") return 0;
  const normalizado = String(v).trim().replace(/\./g, "").replace(",", ".");
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : 0;
}

function normalizarLinha(row) {
  const out = {};
  for (const [key, value] of Object.entries(row || {})) {
    out[String(key || "").trim()] = value;
  }
  return out;
}

function detectarCampo(row, candidatos = []) {
  for (const nome of candidatos) {
    if (row[nome] !== undefined && row[nome] !== null && String(row[nome]).trim() !== "") {
      return row[nome];
    }
  }
  return "";
}

function guessMapping(columns = []) {
  const lowerMap = {};
  columns.forEach((col) => {
    lowerMap[String(col).trim().toLowerCase()] = col;
  });

  function pick(...candidatos) {
    for (const nome of candidatos) {
      if (lowerMap[nome]) return lowerMap[nome];
    }
    return "";
  }

  return {
    codigo: pick("codigo", "código", "sku", "item", "item no", "item no."),
    produto: pick("produto", "descrição", "descricao", "description", "item name", "nome"),
    caixas: pick("caixas", "cx"),
    quantidade: pick("quantidade", "qtde", "unidades", "un", "saldo", "estoque"),
    fator: pick("fator", "q/c", "un/caixa", "unidades por caixa"),
    imagem: pick("imagem", "pictures", "picture", "foto", "url imagem"),
    endereco: pick("endereco", "endereço", "local")
  };
}

function converterPreview(items = [], mapping = {}, factorPolicy = "use_import_if_missing") {
  return items.map((raw, index) => {
    const row = normalizarLinha(raw);

    const codigo = texto(row[mapping.codigo] ?? detectarCampo(row, ["codigo", "Código", "CODIGO", "SKU", "ITEM", "ITEM NO", "ITEM NO."]));
    const produto = texto(row[mapping.produto] ?? detectarCampo(row, ["produto", "Produto", "DESCRIÇÃO", "DESCRICAO", "ITEM NAME", "NOME"])) || codigo;
    const caixas = numero(row[mapping.caixas] ?? detectarCampo(row, ["CAIXAS", "Cx", "cx"]));
    const quantidade = numero(row[mapping.quantidade] ?? detectarCampo(row, ["QUANTIDADE", "QTDE", "UNIDADES", "UN", "SALDO", "ESTOQUE"]));
    const fatorImportado = numero(row[mapping.fator] ?? detectarCampo(row, ["FATOR", "Q/C", "UN/CAIXA", "UNIDADES POR CAIXA"]));
    const imagem = texto(row[mapping.imagem] ?? detectarCampo(row, ["IMAGEM", "PICTURES", "PICTURE", "FOTO", "URL IMAGEM"]));
    const endereco = texto(row[mapping.endereco] ?? detectarCampo(row, ["ENDERECO", "ENDEREÇO", "LOCAL"]));

    let fator = fatorImportado || 0;

    if (!fator && factorPolicy === "use_default_1") {
      fator = 1;
    }

    return {
      id: `prev_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 7)}`,
      codigo,
      produto,
      caixas,
      quantidade,
      fator,
      fatorImportado,
      imagem,
      endereco,
      _ok: !!(codigo || produto)
    };
  });
}

function detectarConflitos(preview = [], estoqueAtual = []) {
  const conflitos = [];

  preview.forEach((item) => {
    const existente = estoqueAtual.find((e) => {
      return String(e.codigo || "").trim() && String(e.codigo || "").trim() === String(item.codigo || "").trim();
    });

    if (!existente) return;

    const fatorExistente = numero(existente.fator || 0);
    const fatorImportado = numero(item.fatorImportado || item.fator || 0);

    if (fatorExistente && fatorImportado && fatorExistente !== fatorImportado) {
      conflitos.push({
        codigo: item.codigo || "",
        produto: item.produto || "",
        fatorExistente,
        fatorImportado
      });
    }
  });

  return conflitos;
}

function tipoImportacao(mapping = {}) {
  if (mapping.endereco) return "estoque";
  return "container";
}

function previewPath(empresa) {
  return caminhoArquivoEmpresa(empresa, "importacao_preview.json");
}

function loadPreviewState(empresa) {
  return loadEmpresaJson(empresa, "importacao_preview.json", {
    empresa,
    arquivo: "",
    filePath: "",
    abas: [],
    activeSheetName: "",
    columns: [],
    visibleColumns: [],
    mapping: {},
    previewOriginal: { columns: [], items: [] },
    preview: [],
    conflitosFator: [],
    tipo: "container",
    total: 0,
    factorPolicy: "use_import_if_missing",
    quantityMode: "prefer_total",
    saveLayout: false
  });
}

function savePreviewState(empresa, state) {
  saveEmpresaJson(empresa, "importacao_preview.json", state);
}

function buildResponseFromWorkbook({
  empresa,
  filePath,
  originalName,
  workbook,
  activeSheetName,
  mapping,
  factorPolicy,
  quantityMode,
  visibleColumns,
  saveLayout
}) {
  const extraido = sheetToJson(workbook, activeSheetName);
  const rows = Array.isArray(extraido.rows) ? extraido.rows : [];
  const columns = rows.length ? Object.keys(normalizarLinha(rows[0])) : [];
  const mappingFinal = { ...guessMapping(columns), ...(mapping || {}) };
  const previewItems = rows.slice(0, 50).map((r) => normalizarLinha(r));
  const previewConvertido = converterPreview(previewItems, mappingFinal, factorPolicy);
  const estoqueAtual = loadEmpresaJson(empresa, "estoque.json", []);
  const conflitosFator = detectarConflitos(previewConvertido, estoqueAtual);
  const visible = Array.isArray(visibleColumns) && visibleColumns.length ? visibleColumns : columns;

  const payload = {
    ok: true,
    mensagem: "Arquivo analisado com sucesso",
    empresa,
    arquivo: originalName || "",
    filePath,
    abas: workbook.SheetNames || [],
    activeSheetName: extraido.activeSheetName || activeSheetName || workbook.SheetNames[0] || "",
    columns,
    visibleColumns: visible,
    mapping: mappingFinal,
    previewOriginal: {
      columns,
      items: previewItems
    },
    preview: previewConvertido,
    conflitosFator,
    tipo: tipoImportacao(mappingFinal),
    total: rows.length,
    factorPolicy: factorPolicy || "use_import_if_missing",
    quantityMode: quantityMode || "prefer_total",
    saveLayout: !!saveLayout,
    layoutSaved: false
  };

  return payload;
}

router.post("/analisar", upload.single("arquivo"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        ok: false,
        erro: "Arquivo não enviado."
      });
    }

    const empresa = empresaAtual(req);
    const filePath = req.file.path;
    const workbook = lerWorkbook(filePath);

    const payload = buildResponseFromWorkbook({
      empresa,
      filePath,
      originalName: req.file.originalname,
      workbook,
      activeSheetName: workbook.SheetNames[0],
      mapping: {},
      factorPolicy: "use_import_if_missing",
      quantityMode: "prefer_total",
      visibleColumns: [],
      saveLayout: false
    });

    savePreviewState(empresa, payload);

    return res.json(payload);
  } catch (err) {
    console.error("Erro em /api/importacao/analisar:", err);
    return res.status(500).json({
      ok: false,
      erro: "Erro ao analisar arquivo."
    });
  }
});

router.get("/preview", async (req, res) => {
  try {
    const empresa = empresaAtual(req);
    const state = loadPreviewState(empresa);

    if (!state.filePath || !fs.existsSync(state.filePath)) {
      return res.status(400).json({
        ok: false,
        erro: "Nenhum arquivo analisado foi encontrado."
      });
    }

    const workbook = lerWorkbook(state.filePath);
    const requestedSheet = texto(req.query.sheetName) || state.activeSheetName || workbook.SheetNames[0];

    const payload = buildResponseFromWorkbook({
      empresa,
      filePath: state.filePath,
      originalName: state.arquivo,
      workbook,
      activeSheetName: requestedSheet,
      mapping: state.mapping || {},
      factorPolicy: state.factorPolicy || "use_import_if_missing",
      quantityMode: state.quantityMode || "prefer_total",
      visibleColumns: state.visibleColumns || [],
      saveLayout: !!state.saveLayout
    });

    savePreviewState(empresa, payload);

    return res.json(payload);
  } catch (err) {
    console.error("Erro em /api/importacao/preview:", err);
    return res.status(500).json({
      ok: false,
      erro: "Erro ao gerar pré-visualização."
    });
  }
});

router.post("/configurar", async (req, res) => {
  try {
    const empresa = empresaAtual(req);
    const state = loadPreviewState(empresa);

    if (!state.filePath || !fs.existsSync(state.filePath)) {
      return res.status(400).json({
        ok: false,
        erro: "Nenhum arquivo analisado foi encontrado."
      });
    }

    const workbook = lerWorkbook(state.filePath);

    const mapping = {
      codigo: texto(req.body.codigo),
      produto: texto(req.body.produto),
      caixas: texto(req.body.caixas),
      quantidade: texto(req.body.quantidade),
      fator: texto(req.body.fator),
      imagem: texto(req.body.imagem),
      endereco: texto(req.body.endereco)
    };

    const visibleColumns = Array.isArray(req.body.visibleColumns) ? req.body.visibleColumns : [];
    const factorPolicy = texto(req.body.factorPolicy) || "use_import_if_missing";
    const quantityMode = texto(req.body.quantityMode) || "prefer_total";
    const saveLayout = !!req.body.saveLayout;
    const activeSheetName = texto(req.body.activeSheetName) || state.activeSheetName || workbook.SheetNames[0];

    const payload = buildResponseFromWorkbook({
      empresa,
      filePath: state.filePath,
      originalName: state.arquivo,
      workbook,
      activeSheetName,
      mapping,
      factorPolicy,
      quantityMode,
      visibleColumns,
      saveLayout
    });

    if (saveLayout) {
      const layout = {
        mapping,
        visibleColumns,
        factorPolicy,
        quantityMode,
        salvoEm: new Date().toISOString()
      };
      saveEmpresaJson(empresa, "importacao_layout.json", layout);
      payload.layoutSaved = true;
      payload.mensagem = "Configuração aplicada e layout salvo.";
    } else {
      payload.layoutSaved = false;
      payload.mensagem = "Configuração aplicada com sucesso.";
    }

    savePreviewState(empresa, payload);

    return res.json(payload);
  } catch (err) {
    console.error("Erro em /api/importacao/configurar:", err);
    return res.status(500).json({
      ok: false,
      erro: "Erro ao aplicar configuração."
    });
  }
});

router.post("/confirmar", async (req, res) => {
  try {
    const empresa = empresaAtual(req);
    const state = loadPreviewState(empresa);

    if (!state.filePath || !fs.existsSync(state.filePath)) {
      return res.status(400).json({
        ok: false,
        erro: "Nenhum arquivo pronto para importação."
      });
    }

    const estoque = loadEmpresaJson(empresa, "estoque.json", []);
    const updateRegisteredFactor = !!req.body.updateRegisteredFactor;
    let importados = 0;

    state.preview.forEach((item) => {
      if (!item || (!item.codigo && !item.produto)) return;

      const existente = estoque.find((e) => String(e.codigo || "").trim() === String(item.codigo || "").trim());

      if (existente) {
        existente.produto = item.produto || existente.produto || "";
        existente.imagem = item.imagem || existente.imagem || "";
        existente.endereco = item.endereco || existente.endereco || "";
        existente.quantidade = numero(item.quantidade || existente.quantidade || 0);
        existente.caixas = numero(item.caixas || existente.caixas || 0);

        if (updateRegisteredFactor) {
          existente.fator = numero(item.fator || existente.fator || 0);
        } else if (!numero(existente.fator || 0)) {
          existente.fator = numero(item.fator || 0);
        }

        existente.atualizadoEm = new Date().toISOString();
      } else {
        estoque.push({
          id: item.id || `imp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          codigo: item.codigo || "",
          produto: item.produto || "",
          quantidade: numero(item.quantidade || 0),
          caixas: numero(item.caixas || 0),
          fator: numero(item.fator || 0),
          imagem: item.imagem || "",
          endereco: item.endereco || "",
          criadoEm: new Date().toISOString()
        });
      }

      importados += 1;
    });

    saveEmpresaJson(empresa, "estoque.json", estoque);

    const historico = loadEmpresaJson(empresa, "historico-importacoes.json", []);
    historico.unshift({
      id: `hist_${Date.now()}`,
      data: new Date().toISOString(),
      arquivo: state.arquivo || "",
      aba: state.activeSheetName || "",
      importados,
      tipo: state.tipo || "container"
    });
    saveEmpresaJson(empresa, "historico-importacoes.json", historico);

    return res.json({
      ok: true,
      mensagem: "Importação confirmada com sucesso",
      importados
    });
  } catch (err) {
    console.error("Erro em /api/importacao/confirmar:", err);
    return res.status(500).json({
      ok: false,
      erro: "Erro ao confirmar importação."
    });
  }
});

router.post("/cancelar", async (req, res) => {
  try {
    const empresa = empresaAtual(req);
    const state = loadPreviewState(empresa);

    if (state.filePath && fs.existsSync(state.filePath)) {
      try {
        fs.unlinkSync(state.filePath);
      } catch (e) {
        console.error("Não foi possível apagar arquivo temporário:", e.message);
      }
    }

    savePreviewState(empresa, {
      empresa,
      arquivo: "",
      filePath: "",
      abas: [],
      activeSheetName: "",
      columns: [],
      visibleColumns: [],
      mapping: {},
      previewOriginal: { columns: [], items: [] },
      preview: [],
      conflitosFator: [],
      tipo: "container",
      total: 0,
      factorPolicy: "use_import_if_missing",
      quantityMode: "prefer_total",
      saveLayout: false
    });

    return res.json({
      ok: true,
      mensagem: "Prévia cancelada com sucesso."
    });
  } catch (err) {
    console.error("Erro em /api/importacao/cancelar:", err);
    return res.status(500).json({
      ok: false,
      erro: "Erro ao cancelar importação."
    });
  }
});

module.exports = router;
