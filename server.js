const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================================================
   AJUSTES DE PASTAS
========================================================= */
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const UPLOADS_DIR = path.join(ROOT, "uploads");

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

ensureDir(DATA_DIR);
ensureDir(UPLOADS_DIR);
ensureDir(path.join(UPLOADS_DIR, "importacao"));
ensureDir(path.join(UPLOADS_DIR, "container"));
ensureDir(path.join(UPLOADS_DIR, "produtos"));
ensureDir(path.join(UPLOADS_DIR, "imagens"));

/* =========================================================
   HELPERS
========================================================= */
function safeRequire(modulePath, fallback = null) {
  try {
    return require(modulePath);
  } catch (error) {
    console.error(`[safeRequire] Falha ao carregar ${modulePath}: ${error.message}`);
    return fallback;
  }
}

function readJson(filePath, fallback = []) {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2), "utf8");
      return fallback;
    }

    const raw = fs.readFileSync(filePath, "utf8").trim();
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (error) {
    console.error("Erro ao ler JSON:", filePath, error.message);
    return fallback;
  }
}

function writeJson(filePath, data) {
  try {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
    return true;
  } catch (error) {
    console.error("Erro ao salvar JSON:", filePath, error.message);
    return false;
  }
}

function empresaHeader(req) {
  return String(req.headers["x-empresa"] || req.query.empresa || "rio_das_estrelas")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "rio_das_estrelas";
}

function responderModuloAusente(res, modulo) {
  return res.status(501).json({
    ok: false,
    erro: `Módulo não disponível: ${modulo}`
  });
}

/* =========================================================
   MIDDLEWARES
========================================================= */
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

app.use((req, _res, next) => {
  req.empresa = empresaHeader(req);
  next();
});

app.use("/uploads", express.static(UPLOADS_DIR));
app.use(express.static(PUBLIC_DIR));

/* =========================================================
   CARREGAMENTO DOS MÓDULOS DO PROJETO
========================================================= */
const empresaData = safeRequire("./server/empresa_data", null);
const authMiddleware = safeRequire("./server/auth", null);
const verificarPermissao = safeRequire("./server/permissoes", null);
const registrarLog = safeRequire("./server/auditoria", null);
const gerarInventario = safeRequire("./server/inventario", null);
const gerarMapa = safeRequire("./server/mapa", null);
const gerarTarefasPicking = safeRequire("./server/picking", null);
const reconhecerProduto = safeRequire("./server/reconhecimento", null);
const importador = safeRequire("./server/importador", null);
const rotaImportacao = safeRequire("./server/routes/importacao", null);

/* =========================================================
   BASE DE DADOS POR EMPRESA
========================================================= */
function getEmpresaJsonPath(req, nomeArquivo) {
  if (empresaData && typeof empresaData.caminhoArquivoEmpresa === "function") {
    return empresaData.caminhoArquivoEmpresa(req.empresa, nomeArquivo);
  }

  const fallbackDir = path.join(DATA_DIR, "empresas", req.empresa);
  ensureDir(fallbackDir);
  return path.join(fallbackDir, nomeArquivo);
}

function loadEmpresaJson(req, nomeArquivo, fallback = []) {
  if (empresaData && typeof empresaData.loadEmpresaJson === "function") {
    return empresaData.loadEmpresaJson(req.empresa, nomeArquivo, fallback);
  }

  return readJson(getEmpresaJsonPath(req, nomeArquivo), fallback);
}

function saveEmpresaJson(req, nomeArquivo, data) {
  if (empresaData && typeof empresaData.saveEmpresaJson === "function") {
    return empresaData.saveEmpresaJson(req.empresa, nomeArquivo, data);
  }

  return writeJson(getEmpresaJsonPath(req, nomeArquivo), data);
}

if (empresaData && typeof empresaData.garantirPastaEmpresa === "function") {
  try {
    empresaData.garantirPastaEmpresa("rio_das_estrelas");
  } catch (error) {
    console.error("Erro ao garantir pasta da empresa padrão:", error.message);
  }
}

/* =========================================================
   AUTH
========================================================= */
if (typeof authMiddleware === "function") {
  app.use(authMiddleware);
}

/* =========================================================
   HEALTHCHECK
========================================================= */
app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "rio-das-estrelas",
    status: "online",
    time: new Date().toISOString()
  });
});

/* =========================================================
   LOGIN SIMPLES
========================================================= */
app.post("/api/login", (req, res) => {
  try {
    const { usuario, senha } = req.body || {};
    const usuarios = loadEmpresaJson(req, "usuarios.json", [
      { usuario: "admin", senha: "123", cargo: "admin" }
    ]);

    const encontrado = usuarios.find(
      (u) =>
        String(u.usuario || "").trim() === String(usuario || "").trim() &&
        String(u.senha || "").trim() === String(senha || "").trim()
    );

    if (!encontrado) {
      return res.status(401).json({
        ok: false,
        erro: "Usuário ou senha inválidos."
      });
    }

    return res.json({
      ok: true,
      usuario: encontrado.usuario,
      cargo: encontrado.cargo || "admin",
      empresa: req.empresa
    });
  } catch (error) {
    console.error("Erro em /api/login:", error);
    return res.status(500).json({
      ok: false,
      erro: "Erro interno no login."
    });
  }
});

/* =========================================================
   IMPORTAÇÃO
========================================================= */
if (rotaImportacao) {
  app.use("/api/importacao", rotaImportacao);
} else {
  app.all("/api/importacao/*", (_req, res) => responderModuloAusente(res, "server/routes/importacao"));
  app.all("/api/importacao", (_req, res) => responderModuloAusente(res, "server/routes/importacao"));
}

/* =========================================================
   ESTOQUE
========================================================= */
app.get("/api/estoque", (req, res) => {
  try {
    const estoque = loadEmpresaJson(req, "estoque.json", []);
    return res.json({
      ok: true,
      total: estoque.length,
      itens: estoque
    });
  } catch (error) {
    console.error("Erro em /api/estoque:", error);
    return res.status(500).json({ ok: false, erro: "Erro ao carregar estoque." });
  }
});

app.post("/api/estoque", (req, res) => {
  try {
    const estoque = loadEmpresaJson(req, "estoque.json", []);
    const body = req.body || {};

    const item = {
      id: body.id || `est_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      codigo: String(body.codigo || "").trim(),
      produto: String(body.produto || body.nome || "").trim(),
      endereco: String(body.endereco || "").trim(),
      quantidade: Number(body.quantidade || body.unidades || 0),
      caixas: Number(body.caixas || 0),
      fator: Number(body.fator || 0),
      imagem: String(body.imagem || "").trim(),
      atualizadoEm: new Date().toISOString()
    };

    estoque.unshift(item);
    saveEmpresaJson(req, "estoque.json", estoque);

    if (typeof registrarLog === "function") {
      registrarLog(req.empresa, req.usuario || "sistema", "novo_item_estoque", item);
    }

    return res.json({
      ok: true,
      item
    });
  } catch (error) {
    console.error("Erro em POST /api/estoque:", error);
    return res.status(500).json({ ok: false, erro: "Erro ao salvar item no estoque." });
  }
});

/* =========================================================
   PEDIDOS
========================================================= */
app.get("/api/pedidos", (req, res) => {
  try {
    const pedidos = loadEmpresaJson(req, "pedidos.json", []);
    return res.json({
      ok: true,
      total: pedidos.length,
      pedidos
    });
  } catch (error) {
    console.error("Erro em /api/pedidos:", error);
    return res.status(500).json({ ok: false, erro: "Erro ao carregar pedidos." });
  }
});

app.post("/api/pedidos", (req, res) => {
  try {
    const pedidos = loadEmpresaJson(req, "pedidos.json", []);
    const body = req.body || {};

    const pedido = {
      id: body.id || `ped_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      cliente: String(body.cliente || "").trim(),
      status: String(body.status || "aberto").trim(),
      produtos: Array.isArray(body.produtos) ? body.produtos : [],
      criadoEm: new Date().toISOString()
    };

    pedidos.unshift(pedido);
    saveEmpresaJson(req, "pedidos.json", pedidos);

    if (typeof registrarLog === "function") {
      registrarLog(req.empresa, req.usuario || "sistema", "novo_pedido", pedido);
    }

    return res.json({
      ok: true,
      pedido
    });
  } catch (error) {
    console.error("Erro em POST /api/pedidos:", error);
    return res.status(500).json({ ok: false, erro: "Erro ao salvar pedido." });
  }
});

/* =========================================================
   INVENTÁRIO
========================================================= */
app.get("/api/inventario", (req, res) => {
  try {
    const estoque = loadEmpresaJson(req, "estoque.json", []);

    if (typeof gerarInventario !== "function") {
      return responderModuloAusente(res, "server/inventario");
    }

    return res.json(gerarInventario(estoque));
  } catch (error) {
    console.error("Erro em /api/inventario:", error);
    return res.status(500).json({ ok: false, erro: "Erro ao gerar inventário." });
  }
});

/* =========================================================
   MAPA WMS
========================================================= */
app.get("/api/mapa", (req, res) => {
  try {
    const estoque = loadEmpresaJson(req, "estoque.json", []);
    const config = loadEmpresaJson(req, "config_wms.json", {
      armazem: { ruas: 7, posicoes: 140, andares: 7 }
    });

    if (typeof gerarMapa !== "function") {
      return responderModuloAusente(res, "server/mapa");
    }

    return res.json(gerarMapa(estoque, config));
  } catch (error) {
    console.error("Erro em /api/mapa:", error);
    return res.status(500).json({ ok: false, erro: "Erro ao gerar mapa WMS." });
  }
});

/* =========================================================
   PICKING
========================================================= */
app.get("/api/picking/:pedidoId", (req, res) => {
  try {
    const pedidos = loadEmpresaJson(req, "pedidos.json", []);
    const estoque = loadEmpresaJson(req, "estoque.json", []);

    const pedido = pedidos.find((p) => String(p.id) === String(req.params.pedidoId));

    if (!pedido) {
      return res.status(404).json({
        ok: false,
        erro: "Pedido não encontrado."
      });
    }

    if (typeof gerarTarefasPicking !== "function") {
      return responderModuloAusente(res, "server/picking");
    }

    const tarefas = gerarTarefasPicking(pedido, estoque);

    return res.json({
      ok: true,
      pedidoId: pedido.id,
      tarefas
    });
  } catch (error) {
    console.error("Erro em /api/picking/:pedidoId:", error);
    return res.status(500).json({ ok: false, erro: "Erro ao gerar picking." });
  }
});

/* =========================================================
   RECONHECIMENTO
========================================================= */
app.post("/api/reconhecimento", (req, res) => {
  try {
    const estoque = loadEmpresaJson(req, "estoque.json", []);
    const imagemBase64 = req.body?.imagem || req.body?.base64 || "";

    if (typeof reconhecerProduto !== "function") {
      return responderModuloAusente(res, "server/reconhecimento");
    }

    const encontrado = reconhecerProduto(imagemBase64, estoque);

    return res.json({
      ok: true,
      encontrado: !!encontrado,
      item: encontrado || null
    });
  } catch (error) {
    console.error("Erro em /api/reconhecimento:", error);
    return res.status(500).json({ ok: false, erro: "Erro no reconhecimento." });
  }
});

/* =========================================================
   IMPORTADOR AUXILIAR
========================================================= */
app.post("/api/importador/teste", async (req, res) => {
  try {
    if (!importador || typeof importador.importarProdutos !== "function") {
      return responderModuloAusente(res, "server/importador");
    }

    const linhas = Array.isArray(req.body?.linhas) ? req.body.linhas : [];
    const resultado = importador.importarProdutos(linhas);

    return res.json({
      ok: true,
      total: resultado.length,
      itens: resultado
    });
  } catch (error) {
    console.error("Erro em /api/importador/teste:", error);
    return res.status(500).json({ ok: false, erro: "Erro no importador auxiliar." });
  }
});

/* =========================================================
   DASHBOARD
========================================================= */
app.get("/api/dashboard", (req, res) => {
  try {
    const estoque = loadEmpresaJson(req, "estoque.json", []);
    const pedidos = loadEmpresaJson(req, "pedidos.json", []);
    const logs = loadEmpresaJson(req, "logs.json", []);

    return res.json({
      ok: true,
      empresa: req.empresa,
      resumo: {
        estoque: estoque.length,
        pedidos: pedidos.length,
        logs: logs.length
      }
    });
  } catch (error) {
    console.error("Erro em /api/dashboard:", error);
    return res.status(500).json({ ok: false, erro: "Erro ao carregar dashboard." });
  }
});

/* =========================================================
   FALLBACK HTML
========================================================= */
app.get("/", (_req, res) => {
  const indexFile = path.join(PUBLIC_DIR, "index.html");

  if (fs.existsSync(indexFile)) {
    return res.sendFile(indexFile);
  }

  return res.status(200).send("SISTEMA LOGÍSTICO RIO DAS ESTRELAS ONLINE");
});

app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) return next();

  const fallbackFile = path.join(PUBLIC_DIR, req.path);
  if (fs.existsSync(fallbackFile) && fs.statSync(fallbackFile).isFile()) {
    return res.sendFile(fallbackFile);
  }

  const indexFile = path.join(PUBLIC_DIR, "index.html");
  if (fs.existsSync(indexFile)) {
    return res.sendFile(indexFile);
  }

  return res.status(404).send("Página não encontrada.");
});

/* =========================================================
   TRATAMENTO DE ERRO
========================================================= */
app.use((err, _req, res, _next) => {
  console.error("Erro não tratado:", err);
  return res.status(500).json({
    ok: false,
    erro: "Erro interno do servidor."
  });
});

/* =========================================================
   START
========================================================= */
app.listen(PORT, () => {
  console.log(`🚀 SISTEMA LOGÍSTICO RIO DAS ESTRELAS online na porta ${PORT}`);
});
