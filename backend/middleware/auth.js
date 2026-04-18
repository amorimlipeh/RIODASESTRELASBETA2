const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'rio_das_estrelas_secret_2025';

function authMiddleware(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ erro: 'Token não fornecido' });

  try {
    const decoded = jwt.verify(token, SECRET);
    req.usuario = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ erro: 'Token inválido' });
  }
}

function gerarToken(usuario) {
  return jwt.sign(
    { id: usuario.id, nome: usuario.nome, email: usuario.email, cargo: usuario.cargo, empresa_id: usuario.empresa_id },
    SECRET,
    { expiresIn: '24h' }
  );
}

module.exports = { authMiddleware, gerarToken };
