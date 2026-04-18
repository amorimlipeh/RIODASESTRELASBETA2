const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');
const { log } = require('../middleware/logger');

router.get('/', authMiddleware, (req, res) => {
  const db = getDB(req.usuario.empresa_id);
  const pedidos = db.prepare('SELECT * FROM pedidos WHERE empresa_id=? ORDER BY criado_em DESC').all(req.usuario.empresa_id);
  res.json(pedidos);
});

router.get('/:id', authMiddleware, (req, res) => {
  const db = getDB(req.usuario.empresa_id);
  const pedido = db.prepare('SELECT * FROM pedidos WHERE id=?').get(req.params.id);
  const itens = db.prepare(`
    SELECT pi.*, p.codigo, p.descricao FROM pedido_itens pi
    JOIN produtos p ON p.id = pi.produto_id
    WHERE pi.pedido_id=?
  `).all(req.params.id);
  res.json({ ...pedido, itens });
});

router.post('/', authMiddleware, (req, res) => {
  const db = getDB(req.usuario.empresa_id);
  const { cliente, prioridade, itens } = req.body;
  const id = uuidv4();
  const numero = `PED-${Date.now()}`;
  db.prepare('INSERT INTO pedidos (id,numero,cliente,prioridade,empresa_id,usuario_id) VALUES (?,?,?,?,?,?)')
    .run(id, numero, cliente, prioridade||'normal', req.usuario.empresa_id, req.usuario.id);
  
  if (itens && itens.length) {
    const stmt = db.prepare('INSERT INTO pedido_itens (id,pedido_id,produto_id,quantidade) VALUES (?,?,?,?)');
    itens.forEach(item => stmt.run(uuidv4(), id, item.produto_id, item.quantidade));
  }
  log(req.usuario.id, 'criar_pedido', 'pedidos', { numero }, req.usuario.empresa_id);
  res.json({ id, numero });
});

router.put('/:id/status', authMiddleware, (req, res) => {
  const db = getDB(req.usuario.empresa_id);
  const { status } = req.body;
  db.prepare('UPDATE pedidos SET status=?, atualizado_em=datetime("now") WHERE id=?').run(status, req.params.id);
  log(req.usuario.id, 'atualizar_pedido', 'pedidos', { id: req.params.id, status }, req.usuario.empresa_id);
  res.json({ ok: true });
});

router.post('/:id/separacao', authMiddleware, (req, res) => {
  const db = getDB(req.usuario.empresa_id);
  const sepId = uuidv4();
  db.prepare('INSERT INTO separacoes (id,pedido_id,operador_id,empresa_id) VALUES (?,?,?,?)')
    .run(sepId, req.params.id, req.usuario.id, req.usuario.empresa_id);
  db.prepare('UPDATE pedidos SET status="em_separacao" WHERE id=?').run(req.params.id);
  res.json({ id: sepId });
});

module.exports = router;
