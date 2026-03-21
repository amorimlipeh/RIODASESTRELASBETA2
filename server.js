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

const DATA = path.join(__dirname, "data");
const UPLOADS = path.join(__dirname, "uploads");
const IMG_DIR = path.join(UPLOADS, "produtos/container");

if (!fs.existsSync(DATA)) fs.mkdirSync(DATA, { recursive: true });
if (!fs.existsSync(IMG_DIR)) fs.mkdirSync(IMG_DIR, { recursive: true });

app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(UPLOADS));

const upload = multer({ storage: multer.memoryStorage() });

/* =========================
   TRADUÇÃO
========================= */

const DICIONARIO = {
  "顶针": "dedal",
  "银匙扣蓝色": "chaveiro azul",
  "银匙扣大红": "chaveiro vermelho",
  "银匙扣粉色": "chaveiro rosa",
  "银匙扣黑色": "chaveiro preto",
  "银匙扣": "chaveiro",
  "地图磁浴冰箱贴": "ímã de geladeira",
  "地图银浴冰箱贴": "ímã de geladeira",
  "7.5塑料双面镜": "espelho duplo 7.5",
  "帆布袋": "sacola de pano",
  "桃心镜子": "espelho coração",
  "产品图片": "imagem",
  "客人货号": "codigo",
  "品名": "descricao",
  "件数": "caixas"
};

function traduzir(txt) {
  if (!txt) return "";
  let r = txt;
  Object.keys(DICIONARIO).forEach(k => {
    if (r.includes(k)) r = r.replaceAll(k, DICIONARIO[k]);
  });
  return r;
}

/* =========================
   EXTRAIR IMAGENS XLSX
========================= */

async function extrairImagens(buffer) {
  const zip = await unzipper.Open.buffer(buffer);
  const files = zip.files.filter(f => f.path.startsWith("xl/media/"));

  const imgs = [];

  for (let i = 0; i < files.length; i++) {
    const content = await files[i].buffer();
    const nome = Date.now() + "_" + i + ".png";
    const caminho = path.join(IMG_DIR, nome);

    fs.writeFileSync(caminho, content);
    imgs.push("/uploads/produtos/container/" + nome);
  }

  return imgs;
}

/* =========================
   ANALISAR CONTAINER
========================= */

app.post("/api/importar-container", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.json({ ok: false });

    const wb = XLSX.read(file.buffer, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    let data = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    const imagens = await extrairImagens(file.buffer);

    data = data.map((row, i) => {
      const novo = {};

      Object.keys(row).forEach(k => {
        if (!k.startsWith("_EMPTY")) {
          let v = row[k];

          if (typeof v === "string") {
            v = traduzir(v);
          }

          novo[k] = v;
        }
      });

      novo.__imagem = imagens[i] || "";
      novo.__checked = true;

      return novo;
    });

    return res.json({
      ok: true,
      dados: data,
      colunas: Object.keys(data[0] || {})
    });

  } catch (e) {
    console.log(e);
    res.json({ ok: false });
  }
});

/* =========================
   ANALISAR ERP
========================= */

app.post("/api/importar-erp", upload.single("file"), (req, res) => {
  try {
    const wb = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    res.json({
      ok: true,
      dados: data,
      colunas: Object.keys(data[0] || {})
    });

  } catch {
    res.json({ ok: false });
  }
});

/* =========================
   ANALISAR WMS
========================= */

app.post("/api/importar-wms", upload.single("file"), (req, res) => {
  try {
    const wb = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    res.json({
      ok: true,
      dados: data,
      colunas: Object.keys(data[0] || {})
    });

  } catch {
    res.json({ ok: false });
  }
});

/* =========================
   START
========================= */

app.listen(PORT, () => {
  console.log("Rodando na porta " + PORT);
});
