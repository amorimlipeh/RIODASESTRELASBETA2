
const express = require("express");
const multer = require("multer");
const XLSX = require("xlsx");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static("public"));

const upload = multer({ storage: multer.memoryStorage() });

function anexarImagensInteligente(linhas, anchors = []) {
  if (!Array.isArray(linhas)) return linhas;

  const mapa = new Map();
  anchors.forEach(a => {
    if (!mapa.has(a.rowExcel)) mapa.set(a.rowExcel, a.url);
  });

  return linhas.map(l => {
    const r = Number(l.__excelRow || 0);
    let img = "";

    if (mapa.has(r)) img = mapa.get(r);
    if (!img && mapa.has(r-1)) img = mapa.get(r-1);
    if (!img && mapa.has(r-2)) img = mapa.get(r-2);
    if (!img && mapa.has(r+1)) img = mapa.get(r+1);
    if (!img && mapa.has(r+2)) img = mapa.get(r+2);

    return {...l, __imagem: img};
  });
}

app.post("/upload", upload.single("file"), (req, res) => {
  const wb = XLSX.read(req.file.buffer, {type:"buffer"});
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws, {defval:""});

  const linhas = data.map((l,i)=>({...l, __excelRow:i+1}));

  const resultado = anexarImagensInteligente(linhas, []);

  res.json(resultado);
});

app.listen(PORT, ()=>console.log("Rodando", PORT));
