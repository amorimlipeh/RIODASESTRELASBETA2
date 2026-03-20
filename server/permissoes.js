const PERMISSOES = {
  admin: ["*"],
  supervisor: [
    "dashboard", "estoque", "importacao", "pedidos", "separacao",
    "picking", "inventario", "mapa", "scanner"
  ],
  operador: ["estoque", "pedidos", "separacao", "picking", "scanner"],
  conferente: ["estoque", "pedidos", "separacao", "inventario", "scanner"],
  visitante: ["dashboard"]
};

module.exports = function verificarPermissao(cargo, modulo) {
  const perfil = String(cargo || "admin").toLowerCase();
  const regras = PERMISSOES[perfil] || [];
  return regras.includes("*") || regras.includes(String(modulo || "").toLowerCase());
};
