const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../config/database');
const { gerarToken } = require('../middleware/auth');
const { log } = require('../middleware/logger');

// Seed admin padrão
function seedAdmin(db, empresa_id) {
  const existe = db.prepare('SELECT id FROM usuarios WHERE cargo = ?').get('Desenvolvedor');
  if (!existe) {
    const senha = bcrypt.hashSync('admin123', 10);
    db.prepare(`INSERT OR IGNORE INTO usuarios (id, nome, email, senha, cargo, empresa_id) VALUES (?,?,?,?,?,?)`)
      .run(uuidv4(), 'Administrador', 'admin@sistema.com', senha, 'Desenvolvedor', empresa_id);
  }
}

router.post('/login', (req, res) => {
  const { email, senha, empresa_id = 'global' } = req.body;
  const db = getDB(empresa_id);
  seedAdmin(db, empresa_id);

  const usuario = db.prepare('SELECT * FROM usuarios WHERE email = ? AND ativo = 1').get(email);
  if (!usuario) return res.status(401).json({ erro: 'Usuário não encontrado' });

  const senhaOk = bcrypt.compareSync(senha, usuario.senha);
  if (!senhaOk) return res.status(401).json({ erro: 'Senha incorreta' });

  const token = gerarToken({ ...usuario, empresa_id });
  log(usuario.id, 'login', 'auth', 'Login realizado', empresa_id);

  res.json({
    token,
    usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, cargo: usuario.cargo }
  });
});

router.post('/logout', (req, res) => {
  res.json({ ok: true });
});

module.exports = router;
