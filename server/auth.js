module.exports = function (req, res, next) {
  // AUTO LOGIN TEMPORÁRIO
  req.usuario = {
    nome: "admin",
    cargo: "admin",
    empresa: "rio"
  };

  next();
};
