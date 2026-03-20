const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const EMPRESAS_DIR = path.join(DATA_DIR, "empresas");

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function normalizarEmpresa(valor) {
  return String(valor || "rio_das_estrelas")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "rio_das_estrelas";
}

function pastaEmpresa(slug) {
  return path.join(EMPRESAS_DIR, normalizarEmpresa(slug));
}

function garantirPastaEmpresa(slug) {
  ensureDir(DATA_DIR);
  ensureDir(EMPRESAS_DIR);

  const dir = pastaEmpresa(slug);
  ensureDir(dir);

  const defaults = {
    "usuarios.json": [
      { "usuario": "admin", "senha": "123", "cargo": "admin" }
    ],
    "estoque.json": [],
    "pedidos.json": [],
    "reservas.json": [],
    "separacoes.json": [],
    "conteineres.json": [],
    "logs.json": [],
    "config_wms.json": {
      "armazem": { "ruas": 7, "posicoes": 140, "andares": 7 },
      "pallet": { "valor_fixo": 1 },
      "estrutura_endereco": { "rua": true, "posicao": true, "andar": true, "pallet": true },
      "regras": { "gerar_endereco_automatico": true }
    }
  };

  for (const [name, content] of Object.entries(defaults)) {
    const file = path.join(dir, name);
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, JSON.stringify(content, null, 2), "utf8");
    }
  }

  return dir;
}

function caminhoArquivoEmpresa(slug, arquivo) {
  const dir = garantirPastaEmpresa(slug);
  return path.join(dir, String(arquivo || "").replace(/^[/\\]+/, ""));
}

function loadEmpresaJson(slug, arquivo, fallback = []) {
  const file = caminhoArquivoEmpresa(slug, arquivo);

  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(fallback, null, 2), "utf8");
    return fallback;
  }

  try {
    const raw = fs.readFileSync(file, "utf8").trim();
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (error) {
    console.error("Erro ao ler JSON da empresa:", file, error.message);
    return fallback;
  }
}

function saveEmpresaJson(slug, arquivo, data) {
  const file = caminhoArquivoEmpresa(slug, arquivo);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
  return true;
}

module.exports = {
  normalizarEmpresa,
  garantirPastaEmpresa,
  loadEmpresaJson,
  saveEmpresaJson,
  caminhoArquivoEmpresa
};
