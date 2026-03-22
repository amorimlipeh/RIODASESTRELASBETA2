// ============================
// SERVER FINAL CORRIGIDO 🔥
// ============================

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
const IMG_DIR = path.join(UPLOADS_DIR, "produtos/container");

[DATA_DIR, UPLOADS_DIR, IMG_DIR].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(UPLOADS_DIR));

const upload = multer({ storage: multer.memoryStorage() });

// ============================
// EXTRAIR IMAGENS XLSX 🔥
// ============================

async function extrairImagens(buffer, nomeArquivo) {
  const zip = await unzipper.Open.buffer(buffer);

  const imagens = [];
  let count = 0;

  for (const file of zip.files) {
    if (file.path.includes("xl/media")) {
      const buf = await file.buffer();
      const nome = `${Date.now()}_${count++}_${file.path.split("/").pop()}`;
      const caminho = path.join(IMG_DIR, nome);

      fs.writeFileSync(caminho, buf);

      imagens.push({
        index: count - 1,
        url: `/uploads/produtos/container/${nome}`
      });
    }
  }

  return imagens;
}

// ============================
// PROCESSAR XLSX 🔥
// ============================

function processarLinhas(sheet) {
  const rows = XLSX.utils.sheet_to_json(sheet, {
    defval: "",
    raw: false
  });

  return rows.map((row, i) => ({
    ...row,
    __rowIndex: i
  }));
}

// ============================
// VINCULAR IMAGEM CORRETAMENTE 🔥
// ============================

function vincularImagens(linhas, imagens) {
  return linhas.map((linha, i) => {
    let img = imagens[i];

    // fallback inteligente
    if (!img) img = imagens[i - 1] || imagens[i + 1];

    return {
      ...linha,
      __imagem: img ? img.url : ""
    };
  });
}

// ============================
// ROTA CONTAINER 🔥
// ============================

app.post("/api/importar-container", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ erro: "Arquivo não enviado" });

    const workbook = XLSX.read(file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    let linhas = processarLinhas(sheet);

    const imagens = await extrairImagens(file.buffer, file.originalname);

    linhas = vincularImagens(linhas, imagens);

    res.json({
      ok: true,
      dados: linhas
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: err.message });
  }
});

// ============================
// ROTAS PÁGINA
// ============================

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

app.get("/importar_container", (req, res) => {
  res.sendFile(path.join(__dirname, "public/importar_container.html"));
});

app.listen(PORT, () => {
  console.log("Servidor rodando na porta " + PORT);
});
