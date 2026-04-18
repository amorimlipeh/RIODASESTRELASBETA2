const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../config/database');

function log(usuario_id, acao, modulo, detalhes = '', empresa_id = 'global') {
  try {
    const db = getDB(empresa_id);
    db.prepare(`INSERT INTO logs (id, usuario_id, acao, modulo, detalhes, empresa_id) VALUES (?,?,?,?,?,?)`)
      .run(uuidv4(), usuario_id, acao, modulo, JSON.stringify(detalhes), empresa_id);
  } catch (e) {}
}

module.exports = { log };
