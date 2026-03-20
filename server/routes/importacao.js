const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const XLSX = require("xlsx");

const { garantirPastaEmpresa, loadEmpresaJson, saveEmpresaJson, normalizarEmpresa, caminhoArquivoEmpresa } = require("../empresa_data");
const { ensureDir } = require("../utils/fileDB");

const router = express.Router();

const ROOT = path.join(__dirname, "..", "..");
const UPLOAD_DIR = path.join(ROOT, "uploads", "importacao");
ensureDir(UPLOAD_DIR);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const seguro = String(file.originalname || "arquivo.xlsx").replace(/[^\w.\-]+/g, "_");
    cb(null, `${Date.now()}-${seguro}`);
  }
});

const upload = multer({ storage });

function empresaAtual(req) {
  return normalizarEmpresa(req.headers["x-empresa"] || req.query.empresa || "rio_das_estrelas");
}

function lerXlsx(caminhoArquivo) {
  const wb = XLSX.readFile(caminhoArquivo, { cellDates: false });
  const aba = wb.SheetNames[0];
  return XLSX.utils.sheet_to_json(wb.Sheets[aba], { defval: "" });
}

function normalizarLinha(row) {
  const out = {};
  for (const [k, v] of Object.entries(row || {})) {
    out[String(k || "").trim().toUpperCase()] = v;
  }
  return out;
}

function detectarTipo(rows) {
  const first = normalizarLinha(rows[0] || {});
  if (first["ENDERECO"] || first["ENDEREÇO"] || first["LOCAL"]) return "ESTOQUE";
  return "PRODUTOS";
}

function previewRows(rows) {
  return rows.slice(0, 300).map((r) => normalizarLinha(r));
}

function previewFile(empresa) {
  garantirPastaEmpresa(empresa);
  return caminhoArquivoEmpresa(empresa, "import_preview.json");
}

function salvarPreview(empresa, payload) {
  saveEmpresaJson(empresa, "import_preview.json", payload);
}

function lerPreview(empresa) {
  return loadEmpresaJson(empresa, "import_preview.json", {
    status: "VAZIO",
    preview: [],
    colunas: []
  });
}

router.post("/analisar", upload.single("arquivo"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, erro: "Arquivo não enviado." });
    }

    const empresa = empresaAtual(req);
    const rows = lerXlsx(req.file.path);
    const preview = previewRows(rows);
    const tipo = detectarTipo(rows);

    const payload = {
      id: `imp_${Date.now()}`,
      status: "ANALISADO",
      tipo,
      arquivo: req.file.originalname,
      arquivoSalvo: req.file.filename,
      caminho: req.file.path,
      totalLinhas: rows.length,
      colunas: Object.keys(preview[0] || {}),
      preview,
      configuracao: {},
      criadoEm: new Date().toISOString()
    };

    salvarPreview(empresa, payload);

    return res.json({
      ok: true,
      ...payload,
      rows: payload.preview,
      columns: payload.colunas
    });
  } catch (error) {
    console.error("Erro em /api/importacao/analisar:", error);
    return res.status(500).json({ ok: false, erro: "Erro ao analisar arquivo." });
  }
});

router.get("/preview", (req, res) => {
  const empresa = empresaAtual(req);
  const payload = lerPreview(empresa);

  return res.json({
    ok: true,
    ...payload,
    rows: Array.isArray(payload.preview) ? payload.preview : [],
    columns: Array.isArray(payload.colunas) ? payload.colunas : []
  });
});

router.post("/configurar", (req, res) => {
  const empresa = empresaAtual(req);
  const atual = lerPreview(empresa);

  const atualizado = {
    ...atual,
    status: "CONFIGURADO",
    configuracao: req.body || {},
    configuradoEm: new Date().toISOString()
  };

  salvarPreview(empresa, atualizado);

  return res.json({
    ok: true,
    mensagem: "Configuração salva.",
    configuracao: atualizado.configuracao
  });
});

router.post("/confirmar", (req, res) => {
  try {
    const empresa = empresaAtual(req);
    const atual = lerPreview(empresa);

    if (!atual.caminho || !fs.existsSync(atual.caminho)) {
      return res.status(400).json({
        ok: false,
        erro: "Nenhum arquivo analisado encontrado para confirmar."
      });
    }

    const rows = lerXlsx(atual.caminho);
    const tipo = String(req.body.tipo || atual.tipo || "PRODUTOS").toUpperCase();

    if (tipo === "ESTOQUE") {
      const estoque = loadEmpresaJson(empresa, "estoque.json", []);
      const novos = previewRows(rows).map((r) => ({
        id: `est_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        codigo: String(r["CODIGO"] || r["CÓDIGO"] || r["SKU"] || r["ITEM"] || "").trim(),
        produto: String(r["PRODUTO"] || r["DESCRICAO"] || r["DESCRIÇÃO"] || r["NOME"] || "").trim(),
        quantidade: Number(r["QUANTIDADE"] || r["QTDE"] || r["UNIDADES"] || r["UN"] || r["SALDO"] || 0),
        caixas: Number(r["CAIXAS"] || r["CX"] || 0),
        fator: Number(r["FATOR"] || r["Q/C"] || r["UN/CAIXA"] || 0),
        endereco: String(r["ENDERECO"] || r["ENDEREÇO"] || r["LOCAL"] || "").trim(),
        criadoEm: new Date().toISOString()
      })).filter((i) => i.codigo || i.produto);

      saveEmpresaJson(empresa, "estoque.json", [...estoque, ...novos]);

      const final = {
        ...atual,
        status: "CONFIRMADO",
        confirmadoEm: new Date().toISOString(),
        resultado: { inseridos: novos.length, atualizados: 0, ignorados: 0, tipo: "ESTOQUE" }
      };
      salvarPreview(empresa, final);

      return res.json({ ok: true, ...final.resultado });
    }

    const produtos = loadEmpresaJson(empresa, "estoque.json", []);
    const novos = previewRows(rows).map((r) => ({
      id: `prod_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      codigo: String(r["CODIGO"] || r["CÓDIGO"] || r["SKU"] || r["ITEM"] || "").trim(),
      produto: String(r["PRODUTO"] || r["DESCRICAO"] || r["DESCRIÇÃO"] || r["NOME"] || "").trim(),
      quantidade: Number(r["QUANTIDADE"] || r["QTDE"] || r["UNIDADES"] || r["UN"] || r["SALDO"] || 0),
      caixas: Number(r["CAIXAS"] || r["CX"] || 0),
      fator: Number(r["FATOR"] || r["Q/C"] || r["UN/CAIXA"] || 0),
      endereco: String(r["ENDERECO"] || r["ENDEREÇO"] || r["LOCAL"] || "").trim(),
      imagem: String(r["IMAGEM"] || r["PICTURES"] || r["PICTURE"] || "").trim(),
      criadoEm: new Date().toISOString()
    })).filter((i) => i.codigo || i.produto);

    saveEmpresaJson(empresa, "estoque.json", [...produtos, ...novos]);

    const final = {
      ...atual,
      status: "CONFIRMADO",
      confirmadoEm: new Date().toISOString(),
      resultado: { inseridos: novos.length, atualizados: 0, ignorados: 0, tipo: "PRODUTOS" }
    };
    salvarPreview(empresa, final);

    return res.json({ ok: true, ...final.resultado });
  } catch (error) {
    console.error("Erro em /api/importacao/confirmar:", error);
    return res.status(500).json({ ok: false, erro: "Erro ao confirmar importação." });
  }
});

router.post("/cancelar", (req, res) => {
  const empresa = empresaAtual(req);
  const atual = lerPreview(empresa);

  if (atual.caminho && fs.existsSync(atual.caminho)) {
    try { fs.unlinkSync(atual.caminho); } catch (_e) {}
  }

  salvarPreview(empresa, {
    status: "CANCELADO",
    canceladoEm: new Date().toISOString(),
    preview: [],
    colunas: []
  });

  return res.json({ ok: true, mensagem: "Importação cancelada." });
});

router.get("/logs", (req, res) => {
  const empresa = empresaAtual(req);
  const logs = loadEmpresaJson(empresa, "logs.json", []);
  return res.json({ ok: true, logs });
});

module.exports = router;
