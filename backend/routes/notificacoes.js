const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

router.get('/', authMiddleware, (req, res) => {
  const db = getDB(req.usuario.empresa_id);
  const notifs = db.prepare('SELECT * FROM notificacoes WHERE empresa_id=? ORDER BY criado_em DESC').all(req.usuario.empresa_id);
  res.json(notifs);
});

router.put('/:id/ler', authMiddleware, (req, res) => {
  const db = getDB(req.usuario.empresa_id);
  db.prepare('UPDATE notificacoes SET lida=1 WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

router.post('/', authMiddleware, (req, res) => {
  const db = getDB(req.usuario.empresa_id);
  const { titulo, mensagem, tipo } = req.body;
  const id = uuidv4();
  db.prepare('INSERT INTO notificacoes (id,titulo,mensagem,tipo,empresa_id) VALUES (?,?,?,?,?)')
    .run(id, titulo, mensagem, tipo||'info', req.usuario.empresa_id);
  res.json({ id });
});

module.exports = router;
