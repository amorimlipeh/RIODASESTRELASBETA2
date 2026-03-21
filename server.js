const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const XLSX = require("xlsx");
const unzipper = require("unzipper");

const app = express();
const PORT = process.env.PORT || 3000;

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const UPLOADS_DIR = path.join(ROOT, "uploads");
const IMG_DIR = path.join(UPLOADS_DIR, "produtos");

if (!fs.existsSync(IMG_DIR)) fs.mkdirSync(IMG_DIR, { recursive: true });

app.use(express.json({ limit: "25mb" }));
app.use(express.static(PUBLIC_DIR));
app.use("/uploads", express.static(UPLOADS_DIR));

const upload = multer({ storage: multer.memoryStorage() });

/* =========================
   EXTRAIR IMAGENS DO XLSX
========================= */
async function extrairImagensXLSX(buffer) {
  const imagens = [];

  const zip = await unzipper.Open.buffer(buffer);

  for (const file of zip.files) {
    if (file.path.startsWith("xl/media/")) {
      const content = await file.buffer();
      const nome = `img_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2)}.png`;

      const caminho = path.join(IMG_DIR, nome);
      fs.writeFileSync(caminho, content);

      imagens.push(`/uploads/produtos/${nome}`);
    }
  }

  return imagens;
}

/* =========================
   LER PLANILHA
========================= */
function parsePlanilha(buffer) {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const aba = wb.SheetNames[0];
  const ws = wb.Sheets[aba];

  const json = XLSX.utils.sheet_to_json(ws, { defval: "" });

  return {
    aba,
    dados: json,
    cabecalhos: Object.keys(json[0] || {}),
  };
}

/* =========================
   IMPORTAR CONTÊINER
========================= */
app.post("/api/importar-container", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.json({ ok: false, erro: "Arquivo não enviado" });
    }

    const { dados, cabecalhos, aba } = parsePlanilha(req.file.buffer);

    let imagens = [];
    try {
      imagens = await extrairImagensXLSX(req.file.buffer);
    } catch (e) {
      console.log("Erro ao extrair imagens:", e.message);
    }

    // Injetar imagens nas linhas
    const dadosComImagem = dados.map((row, i) => {
      return {
        ...row,
        __imagem: imagens[i] || row.PICTURE || row.image || "",
      };
    });

    res.json({
      ok: true,
      abas: [aba],
      planilhas: { [aba]: dadosComImagem },
      metadados: {
        [aba]: {
          cabecalhos: [...cabecalhos, "__imagem"],
          total: dados.length,
        },
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, erro: "Erro ao importar contêiner" });
  }
});

/* =========================
   IMPORTAR WMS
========================= */
app.post("/api/importar-wms", upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.json({ ok: false, erro: "Arquivo não enviado" });
    }

    const { dados, cabecalhos, aba } = parsePlanilha(req.file.buffer);

    res.json({
      ok: true,
      abas: [aba],
      planilhas: { [aba]: dados },
      metadados: {
        [aba]: {
          cabecalhos,
          total: dados.length,
        },
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, erro: "Erro ao importar WMS" });
  }
});

/* =========================
   START
========================= */
app.listen(PORT, () => {
  console.log("🚀 Servidor rodando na porta", PORT);
});
