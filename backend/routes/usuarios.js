const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

const CARGOS = ['Desenvolvedor','Administrador','Supervisor','Operador','Cliente','Conferente'];

router.get('/', authMiddleware, (req, res) => {
  const db = getDB(req.usuario.empresa_id);
  const usuarios = db.prepare('SELECT id,nome,email,cargo,ativo,criado_em FROM usuarios WHERE ativo=1').all();
  res.json(usuarios);
});

router.post('/', authMiddleware, (req, res) => {
  const db = getDB(req.usuario.empresa_id);
  const { nome, email, senha, cargo } = req.body;
  const id = uuidv4();
  const hash = bcrypt.hashSync(senha, 10);
  db.prepare('INSERT INTO usuarios (id,nome,email,senha,cargo,empresa_id) VALUES (?,?,?,?,?,?)')
    .run(id, nome, email, hash, cargo||'Operador', req.usuario.empresa_id);
  res.json({ id, nome, email, cargo });
});

router.put('/:id', authMiddleware, (req, res) => {
  const db = getDB(req.usuario.empresa_id);
  const { nome, cargo, ativo } = req.body;
  db.prepare('UPDATE usuarios SET nome=?,cargo=?,ativo=? WHERE id=?').run(nome, cargo, ativo, req.params.id);
  res.json({ ok: true });
});

router.get('/cargos', (req, res) => res.json(CARGOS));

module.exports = router;
