const express = require('express');
const router = express.Router();
const { getDB } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

router.get('/', authMiddleware, (req, res) => {
  const db = getDB(req.usuario.empresa_id);
  const empresa_id = req.usuario.empresa_id;

  const totalProdutos = db.prepare('SELECT COUNT(*) as c FROM produtos WHERE ativo=1 AND empresa_id=?').get(empresa_id)?.c || 0;
  const totalEnderecos = db.prepare('SELECT COUNT(*) as c FROM enderecos WHERE empresa_id=?').get(empresa_id)?.c || 0;
  const enderecosOcupados = db.prepare('SELECT COUNT(*) as c FROM enderecos WHERE empresa_id=? AND status="ocupado"').get(empresa_id)?.c || 0;
  const totalMovimentacoes = db.prepare('SELECT COUNT(*) as c FROM movimentacoes WHERE empresa_id=?').get(empresa_id)?.c || 0;
  const totalPedidos = db.prepare('SELECT COUNT(*) as c FROM pedidos WHERE empresa_id=?').get(empresa_id)?.c || 0;
  const pedidosPendentes = db.prepare('SELECT COUNT(*) as c FROM pedidos WHERE empresa_id=? AND status="pendente"').get(empresa_id)?.c || 0;
  const ultimasMovimentacoes = db.prepare(`
    SELECT m.*, p.codigo, p.descricao FROM movimentacoes m
    LEFT JOIN produtos p ON p.id = m.produto_id
    WHERE m.empresa_id=? ORDER BY m.criado_em DESC LIMIT 10
  `).all(empresa_id);
  const notificacoes = db.prepare('SELECT * FROM notificacoes WHERE empresa_id=? AND lida=0 ORDER BY criado_em DESC LIMIT 5').all(empresa_id);

  res.json({
    totalProdutos,
    totalEnderecos,
    enderecosOcupados,
    totalMovimentacoes,
    totalPedidos,
    pedidosPendentes,
    ultimasMovimentacoes,
    notificacoes,
    dataHora: new Date().toISOString()
  });
});

module.exports = router;
