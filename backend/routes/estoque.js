const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');
const { log } = require('../middleware/logger');

router.get('/', authMiddleware, (req, res) => {
  const db = getDB(req.usuario.empresa_id);
  const { q } = req.query;
  let rows;
  if (q) {
    rows = db.prepare(`
      SELECT e.*, p.codigo, p.descricao, p.imagem, p.fator, en.codigo as endereco_codigo
      FROM estoque e
      JOIN produtos p ON p.id = e.produto_id
      LEFT JOIN enderecos en ON en.id = e.endereco_id
      WHERE e.empresa_id=? AND (p.codigo LIKE ? OR p.descricao LIKE ?)
    `).all(req.usuario.empresa_id, `%${q}%`, `%${q}%`);
  } else {
    rows = db.prepare(`
      SELECT e.*, p.codigo, p.descricao, p.imagem, p.fator, en.codigo as endereco_codigo
      FROM estoque e
      JOIN produtos p ON p.id = e.produto_id
      LEFT JOIN enderecos en ON en.id = e.endereco_id
      WHERE e.empresa_id=?
    `).all(req.usuario.empresa_id);
  }
  res.json(rows);
});

router.post('/movimentar', authMiddleware, (req, res) => {
  const db = getDB(req.usuario.empresa_id);
  const { tipo, produto_id, endereco_id, quantidade, observacao } = req.body;
  const empresa_id = req.usuario.empresa_id;

  let estoque = db.prepare('SELECT * FROM estoque WHERE produto_id=? AND endereco_id=?').get(produto_id, endereco_id);
  
  if (!estoque) {
    const id = uuidv4();
    db.prepare('INSERT INTO estoque (id,produto_id,endereco_id,quantidade,empresa_id) VALUES (?,?,?,?,?)')
      .run(id, produto_id, endereco_id, 0, empresa_id);
    estoque = db.prepare('SELECT * FROM estoque WHERE id=?').get(id);
  }

  let novaQtd = estoque.quantidade;
  if (tipo === 'entrada') novaQtd += Number(quantidade);
  else if (tipo === 'saida') {
    if (novaQtd < quantidade) return res.status(400).json({ erro: 'Saldo insuficiente' });
    novaQtd -= Number(quantidade);
  } else if (tipo === 'ajuste') {
    novaQtd = Number(quantidade);
  }

  db.prepare('UPDATE estoque SET quantidade=?, atualizado_em=datetime("now") WHERE id=?').run(novaQtd, estoque.id);

  const movId = uuidv4();
  db.prepare(`INSERT INTO movimentacoes (id,tipo,produto_id,endereco_destino,quantidade,usuario_id,empresa_id,observacao) VALUES (?,?,?,?,?,?,?,?)`)
    .run(movId, tipo, produto_id, endereco_id, quantidade, req.usuario.id, empresa_id, observacao);

  log(req.usuario.id, `movimentacao_${tipo}`, 'estoque', { produto_id, quantidade }, empresa_id);
  res.json({ ok: true, saldo: novaQtd });
});

router.get('/movimentacoes', authMiddleware, (req, res) => {
  const db = getDB(req.usuario.empresa_id);
  const rows = db.prepare(`
    SELECT m.*, p.codigo, p.descricao, u.nome as operador
    FROM movimentacoes m
    LEFT JOIN produtos p ON p.id = m.produto_id
    LEFT JOIN usuarios u ON u.id = m.usuario_id
    WHERE m.empresa_id=?
    ORDER BY m.criado_em DESC LIMIT 100
  `).all(req.usuario.empresa_id);
  res.json(rows);
});

module.exports = router;
