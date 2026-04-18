const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

router.get('/', authMiddleware, (req, res) => {
  const db = getDB(req.usuario.empresa_id);
  const enderecos = db.prepare('SELECT * FROM enderecos WHERE empresa_id=?').all(req.usuario.empresa_id);
  res.json(enderecos);
});

router.post('/seed', authMiddleware, (req, res) => {
  const db = getDB(req.usuario.empresa_id);
  const empresa_id = req.usuario.empresa_id;
  const batch = db.prepare('INSERT OR IGNORE INTO enderecos (id,codigo,rua,posicao,andar,empresa_id) VALUES (?,?,?,?,?,?)');
  const insertMany = db.transaction(() => {
    for (let r = 1; r <= 7; r++) {
      for (let p = 1; p <= 140; p++) {
        for (let a = 1; a <= 7; a++) {
          const rua = String(r).padStart(2,'0');
          const pos = String(p).padStart(3,'0');
          const codigo = `${rua}-${pos}-${a}-1`;
          batch.run(uuidv4(), codigo, `R${rua}`, p, a, empresa_id);
        }
      }
    }
  });
  insertMany();
  res.json({ ok: true, mensagem: 'Endereços gerados: 7 ruas × 140 posições × 7 andares' });
});

router.put('/:id', authMiddleware, (req, res) => {
  const db = getDB(req.usuario.empresa_id);
  const { status, produto_fixo, bloqueado } = req.body;
  db.prepare('UPDATE enderecos SET status=?,produto_fixo=?,bloqueado=? WHERE id=?')
    .run(status, produto_fixo, bloqueado, req.params.id);
  res.json({ ok: true });
});

router.get('/mapa', authMiddleware, (req, res) => {
  const db = getDB(req.usuario.empresa_id);
  const { rua } = req.query;
  let enderecos;
  if (rua) {
    enderecos = db.prepare('SELECT * FROM enderecos WHERE empresa_id=? AND rua=?').all(req.usuario.empresa_id, rua);
  } else {
    enderecos = db.prepare('SELECT * FROM enderecos WHERE empresa_id=?').all(req.usuario.empresa_id);
  }
  res.json(enderecos);
});

module.exports = router;
