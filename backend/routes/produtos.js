const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');
const { log } = require('../middleware/logger');

router.get('/', authMiddleware, (req, res) => {
  const db = getDB(req.usuario.empresa_id);
  const { q } = req.query;
  let produtos;
  if (q) {
    produtos = db.prepare(`SELECT * FROM produtos WHERE ativo=1 AND (codigo LIKE ? OR descricao LIKE ?)`).all(`%${q}%`, `%${q}%`);
  } else {
    produtos = db.prepare('SELECT * FROM produtos WHERE ativo=1').all();
  }
  res.json(produtos);
});

router.get('/:id', authMiddleware, (req, res) => {
  const db = getDB(req.usuario.empresa_id);
  const produto = db.prepare('SELECT * FROM produtos WHERE id=?').get(req.params.id);
  if (!produto) return res.status(404).json({ erro: 'Não encontrado' });
  res.json(produto);
});

router.post('/', authMiddleware, (req, res) => {
  const db = getDB(req.usuario.empresa_id);
  const { codigo, descricao, imagem, fator, caixas, lastro, camada, pallets } = req.body;
  const id = uuidv4();
  db.prepare(`INSERT INTO produtos (id,codigo,descricao,imagem,fator,caixas,lastro,camada,pallets,empresa_id) VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(id, codigo, descricao, imagem, fator||1, caixas||0, lastro||0, camada||0, pallets||0, req.usuario.empresa_id);
  log(req.usuario.id, 'criar_produto', 'produtos', { codigo }, req.usuario.empresa_id);
  res.json({ id, codigo, descricao });
});

router.put('/:id', authMiddleware, (req, res) => {
  const db = getDB(req.usuario.empresa_id);
  const { descricao, imagem, fator, caixas, lastro, camada, pallets } = req.body;
  db.prepare(`UPDATE produtos SET descricao=?,imagem=?,fator=?,caixas=?,lastro=?,camada=?,pallets=?,ativo=1 WHERE id=?`)
    .run(descricao, imagem, fator, caixas, lastro, camada, pallets, req.params.id);
  log(req.usuario.id, 'editar_produto', 'produtos', { id: req.params.id }, req.usuario.empresa_id);
  res.json({ ok: true });
});

router.delete('/:id', authMiddleware, (req, res) => {
  const db = getDB(req.usuario.empresa_id);
  db.prepare('UPDATE produtos SET ativo=0 WHERE id=?').run(req.params.id);
  log(req.usuario.id, 'excluir_produto', 'produtos', { id: req.params.id }, req.usuario.empresa_id);
  res.json({ ok: true });
});

module.exports = router;
