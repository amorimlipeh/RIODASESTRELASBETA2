const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

router.get('/', authMiddleware, (req, res) => {
  const db = getDB('global');
  const empresas = db.prepare('SELECT * FROM empresas WHERE ativo = 1').all();
  res.json(empresas);
});

router.post('/', authMiddleware, (req, res) => {
  const { nome, cnpj } = req.body;
  const db = getDB('global');
  const id = uuidv4();
  db.prepare('INSERT INTO empresas (id, nome, cnpj) VALUES (?,?,?)').run(id, nome, cnpj);
  // Inicializa banco da empresa
  getDB(id);
  res.json({ id, nome, cnpj });
});

module.exports = router;
