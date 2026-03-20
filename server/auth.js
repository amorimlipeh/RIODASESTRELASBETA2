module.exports = function verificarLogin(req, res, next) {
  const path = String(req.path || "");
  const metodo = String(req.method || "GET").toUpperCase();

  const rotasPublicas = [
    "/api/login",
    "/health"
  ];

  if (rotasPublicas.includes(path)) {
    return next();
  }

  if (
    path.startsWith("/uploads/") ||
    path.startsWith("/css/") ||
    path.startsWith("/js/") ||
    path.startsWith("/assets/") ||
    path.startsWith("/images/") ||
    path.startsWith("/icons/")
  ) {
    return next();
  }

  const usuario = String(req.headers["x-usuario"] || "").trim();
  const cargo = String(req.headers["x-cargo"] || "").trim();

  if (!usuario) {
    return res.status(401).json({
      ok: false,
      erro: "Usuário não autenticado. Envie o header x-usuario."
    });
  }

  req.usuario = usuario;
  req.cargo = cargo || "admin";
  next();
};
