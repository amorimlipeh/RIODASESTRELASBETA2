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
const PRODUTOS_CONTAINER_DIR = path.join(UPLOADS_DIR, "produtos/container");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(PRODUTOS_CONTAINER_DIR)) fs.mkdirSync(PRODUTOS_CONTAINER_DIR, { recursive: true });

app.use("/uploads", express.static(UPLOADS_DIR));

const upload = multer({ storage: multer.memoryStorage() });

/* =========================
   UTIL
========================= */

function normalizar(txt) {
  return String(txt || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/* =========================
   CORRIGIR CABEÇALHO
========================= */

function corrigirCabecalhos(headers) {
  return headers.map(h => {
    const n = normalizar(h)

    if (n.includes("item")) return "ITEM NO"
    if (n.includes("codigo")) return "ITEM NO"
    if (n.includes("description")) return "DESCRIPTION"
    if (n.includes("picture")) return "PICTURE"
    if (n.includes("ctns")) return "CTNS"

    return h
  })
}

/* =========================
   BACKUP AUTOMÁTICO
========================= */

function backupAntesImportar() {
  const estoquePath = path.join(DATA_DIR, "estoque.json")

  if (!fs.existsSync(estoquePath)) return

  const backupDir = path.join(DATA_DIR, "backup")
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir)

  const nome = `backup_${Date.now()}.json`

  fs.copyFileSync(
    estoquePath,
    path.join(backupDir, nome)
  )
}

/* =========================
   EXTRAIR IMAGENS XLSX
========================= */

async function extrairImagens(buffer) {
  const zip = await unzipper.Open.buffer(buffer)
  const imagens = []

  let index = 0

  for (const file of zip.files) {
    if (file.path.includes("xl/media")) {
      const content = await file.buffer()

      const nome = `${Date.now()}_${index}.png`
      const caminho = path.join(PRODUTOS_CONTAINER_DIR, nome)

      fs.writeFileSync(caminho, content)

      imagens.push({
        index,
        url: `/uploads/produtos/container/${nome}`
      })

      index++
    }
  }

  return imagens
}

/* =========================
   VINCULAR IMAGEM (CORREÇÃO REAL)
========================= */

function vincularImagemPorProximidade(linhas, imagens) {
  return linhas.map((linha, i) => {
    let melhor = null
    let menorDistancia = 999

    imagens.forEach((img) => {
      const dist = Math.abs(img.index - i)

      if (dist < menorDistancia) {
        menorDistancia = dist
        melhor = img
      }
    })

    return {
      ...linha,
      __imagem: melhor?.url || ""
    }
  })
}

/* =========================
   IMPORTADOR CONTAINER
========================= */

app.post("/api/importar-container", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.json({ ok: false, erro: "Arquivo não enviado" })
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]

    const json = XLSX.utils.sheet_to_json(sheet, { defval: "" })

    const headers = corrigirCabecalhos(Object.keys(json[0] || {}))

    let linhas = json.map((row) => {
      const novo = {}
      headers.forEach((h, i) => {
        const old = Object.keys(row)[i]
        novo[h] = row[old]
      })
      return novo
    })

    const imagens = await extrairImagens(req.file.buffer)

    linhas = vincularImagemPorProximidade(linhas, imagens)

    return res.json({
      ok: true,
      dados: linhas
    })

  } catch (err) {
    console.error(err)
    return res.json({ ok: false, erro: err.message })
  }
})

/* =========================
   IMPORTAR PARA ESTOQUE
========================= */

app.post("/api/salvar-container", (req, res) => {
  try {
    backupAntesImportar()

    const estoquePath = path.join(DATA_DIR, "estoque.json")

    let estoque = []
    if (fs.existsSync(estoquePath)) {
      estoque = JSON.parse(fs.readFileSync(estoquePath))
    }

    estoque.unshift(...req.body)

    fs.writeFileSync(estoquePath, JSON.stringify(estoque, null, 2))

    res.json({ ok: true })

  } catch (err) {
    res.json({ ok: false, erro: err.message })
  }
})

/* =========================
   START
========================= */

app.listen(PORT, () => {
  console.log("Servidor rodando na porta", PORT)
})
