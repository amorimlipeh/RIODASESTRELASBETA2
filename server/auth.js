module.exports = function verificarLogin(req, res, next) {
  const usuario = String(req.headers["x-usuario"] || "").trim();
  const cargo = String(req.headers["x-cargo"] || "").trim();

  if (req.path === "/login") return next();

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
