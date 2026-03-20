const { loadEmpresaJson, saveEmpresaJson } = require("./empresa_data");

module.exports = function registrarLog(empresa, usuario, acao, detalhes = {}) {
  const logs = loadEmpresaJson(empresa, "logs.json", []);

  logs.unshift({
    id: Date.now() + Math.floor(Math.random() * 1000),
    data: new Date().toISOString(),
    usuario: String(usuario || "sistema"),
    acao: String(acao || "evento"),
    detalhes
  });

  saveEmpresaJson(empresa, "logs.json", logs.slice(0, 2000));
  return true;
};
