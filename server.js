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
   NORMALIZA
================================ */
function normalizar(str = "") {
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/* ===============================
   MAPA INTELIGENTE
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

      if (encontrou) resultado[campo] = index;
    });
  });

  return resultado;
}

/* ===============================
   LER PLANILHA
================================ */
function ler(buffer) {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const nomeAba = wb.SheetNames[0];
  const ws = wb.Sheets[nomeAba];

  const json = XLSX.utils.sheet_to_json(ws, { header: 1 });

  // 🔥 REMOVE LINHAS VAZIAS
  const linhasValidas = json.filter(row =>
    row && row.some(cell => cell !== null && cell !== "")
  );

  if (!linhasValidas.length) {
    return { json: [], nomeAba, abas: wb.SheetNames };
  }

  // 🔥 ENCONTRA CABEÇALHO AUTOMÁTICO
  let indexHeader = 0;

  for (let i = 0; i < linhasValidas.length; i++) {
    const row = linhasValidas[i].map(c => normalizar(c));

    const encontrou =
      row.some(c => c.includes("cod")) ||
      row.some(c => c.includes("prod")) ||
      row.some(c => c.includes("qty")) ||
      row.some(c => c.includes("descr"));

    if (encontrou) {
      indexHeader = i;
      break;
    }
  }

  const headers = linhasValidas[indexHeader];
  const dados = linhasValidas.slice(indexHeader + 1);

  return {
    json: [headers, ...dados],
    nomeAba,
    abas: wb.SheetNames
  };
}

/* ===============================
   WMS (COMPATÍVEL COM FRONT)
================================ */
app.post("/api/importar-wms", upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.json({ ok: false, erro: "Arquivo não enviado" });
    }

    const { json, nomeAba, abas } = ler(req.file.buffer);

    if (!json.length) {
      return res.json({ ok: false, erro: "Planilha vazia" });
    }

    const headers = json[0];
    const mapa = detectarColunas(headers);

    const planilhas = json.slice(1).map(row => ({
      codigo: row[mapa.codigo] || "",
      produto: row[mapa.produto] || "",
      quantidade: Number(row[mapa.quantidade]) || 0,
      fator: Number(row[mapa.fator]) || 1,
      imagem: row[mapa.imagem] || "",
      endereco: row[mapa.endereco] || ""
    }));

    res.json({
      ok: true,
      abas,
      planilhas,
      metadados: {
        headers,
        mapa,
        total: planilhas.length,
        abaSelecionada: nomeAba
      }
    });

  } catch (err) {
    res.json({ ok: false, erro: err.message });
  }
});

/* ===============================
   CONTAINER (COMPATÍVEL)
================================ */
app.post("/api/importar-container", upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.json({ ok: false, erro: "Arquivo não enviado" });
    }

    const { json, nomeAba, abas } = ler(req.file.buffer);

    res.json({
      ok: true,
      abas,
      planilhas: json.slice(1),
      metadados: {
        total: json.length,
        abaSelecionada: nomeAba
      }
    });

  } catch (err) {
    res.json({ ok: false, erro: err.message });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 SISTEMA online na porta ${PORT}`);
});
