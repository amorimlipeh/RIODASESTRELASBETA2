const express = require('express');
const router = express.Router();
const { getDB } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

router.get('/', authMiddleware, (req, res) => {
  const db = getDB(req.usuario.empresa_id);
  const logs = db.prepare(`
    SELECT l.*, u.nome as usuario_nome FROM logs l
    LEFT JOIN usuarios u ON u.id = l.usuario_id
    WHERE l.empresa_id=? ORDER BY l.criado_em DESC LIMIT 200
  `).all(req.usuario.empresa_id);
  res.json(logs);
});

module.exports = router;
