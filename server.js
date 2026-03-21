const express = require("express");
const path = require("path");
const multer = require("multer");
const XLSX = require("xlsx");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const upload = multer({ storage: multer.memoryStorage() });

/* ===============================
   NORMALIZA TEXTO
================================ */
function normalizar(str = "") {
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/* ===============================
   MAPA INTELIGENTE DE COLUNAS
================================ */
const MAPA = {
  codigo: ["codigo", "código", "item no", "sku", "ref"],
  produto: ["produto", "description", "descrição", "item name"],
  quantidade: ["quantidade", "qty", "qtd", "estoque (un)", "t.qty"],
  fator: ["fator", "q/c", "qc", "factor"],
  imagem: ["imagem", "picture", "pictures", "image"],
  endereco: ["endereco", "endereço", "location", "address"]
};

function detectarColunas(headers) {
  const resultado = {};

  headers.forEach((h, index) => {
    const hNorm = normalizar(h);

    Object.keys(MAPA).forEach((campo) => {
      if (resultado[campo] !== undefined) return;

      const encontrou = MAPA[campo].some(alias =>
        hNorm.includes(normalizar(alias))
      );

      if (encontrou) {
        resultado[campo] = index;
      }
    });
  });

  return resultado;
}

/* ===============================
   EXTRAI PLANILHA
================================ */
function lerPlanilha(buffer) {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const nomeAba = wb.SheetNames[0];
  const ws = wb.Sheets[nomeAba];

  const json = XLSX.utils.sheet_to_json(ws, { header: 1 });

  return json;
}

/* ===============================
   IMPORTADOR WMS
================================ */
app.post("/api/importar-wms", upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.json({ ok: false, erro: "Arquivo não enviado" });
    }

    const linhas = lerPlanilha(req.file.buffer);

    if (!linhas.length) {
      return res.json({ ok: false, erro: "Planilha vazia" });
    }

    const headers = linhas[0];
    const mapa = detectarColunas(headers);

    const resultado = [];

    for (let i = 1; i < linhas.length; i++) {
      const row = linhas[i];

      if (!row || row.length === 0) continue;

      resultado.push({
        codigo: row[mapa.codigo] || "",
        produto: row[mapa.produto] || "",
        quantidade: Number(row[mapa.quantidade]) || 0,
        fator: Number(row[mapa.fator]) || 1,
        imagem: row[mapa.imagem] || "",
        endereco: row[mapa.endereco] || ""
      });
    }

    res.json({
      ok: true,
      headers,
      mapa,
      linhas: resultado.slice(0, 200) // preview
    });

  } catch (err) {
    res.json({ ok: false, erro: err.message });
  }
});

/* ===============================
   IMPORTADOR CONTAINER
================================ */
app.post("/api/importar-container", upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.json({ ok: false, erro: "Arquivo não enviado" });
    }

    const linhas = lerPlanilha(req.file.buffer);

    res.json({
      ok: true,
      linhas: linhas.slice(0, 200)
    });

  } catch (err) {
    res.json({ ok: false, erro: err.message });
  }
});

/* ===============================
   START
================================ */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 SISTEMA LOGÍSTICO online na porta ${PORT}`);
});
