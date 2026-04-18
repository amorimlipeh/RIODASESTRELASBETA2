const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '../../data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function getDB(empresaId = 'global') {
  const dbPath = path.join(DATA_DIR, `empresa_${empresaId}.db`);
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  initSchema(db);
  return db;
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      senha TEXT NOT NULL,
      cargo TEXT DEFAULT 'Operador',
      permissoes TEXT DEFAULT '{}',
      ativo INTEGER DEFAULT 1,
      criado_em TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS empresas (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      cnpj TEXT,
      ativo INTEGER DEFAULT 1,
      criado_em TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS produtos (
      id TEXT PRIMARY KEY,
      codigo TEXT UNIQUE NOT NULL,
      descricao TEXT NOT NULL,
      imagem TEXT,
      fator REAL DEFAULT 1,
      caixas INTEGER DEFAULT 0,
      lastro INTEGER DEFAULT 0,
      camada INTEGER DEFAULT 0,
      pallets INTEGER DEFAULT 0,
      empresa_id TEXT,
      ativo INTEGER DEFAULT 1,
      criado_em TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS enderecos (
      id TEXT PRIMARY KEY,
      codigo TEXT UNIQUE NOT NULL,
      rua TEXT NOT NULL,
      posicao INTEGER NOT NULL,
      andar INTEGER NOT NULL,
      status TEXT DEFAULT 'livre',
      produto_fixo TEXT,
      bloqueado INTEGER DEFAULT 0,
      empresa_id TEXT,
      criado_em TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS estoque (
      id TEXT PRIMARY KEY,
      produto_id TEXT NOT NULL,
      endereco_id TEXT,
      quantidade REAL DEFAULT 0,
      unidades REAL DEFAULT 0,
      empresa_id TEXT,
      atualizado_em TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(produto_id) REFERENCES produtos(id)
    );

    CREATE TABLE IF NOT EXISTS movimentacoes (
      id TEXT PRIMARY KEY,
      tipo TEXT NOT NULL,
      produto_id TEXT,
      endereco_origem TEXT,
      endereco_destino TEXT,
      quantidade REAL,
      usuario_id TEXT,
      empresa_id TEXT,
      observacao TEXT,
      status TEXT DEFAULT 'concluido',
      criado_em TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pedidos (
      id TEXT PRIMARY KEY,
      numero TEXT UNIQUE NOT NULL,
      cliente TEXT,
      status TEXT DEFAULT 'pendente',
      prioridade TEXT DEFAULT 'normal',
      empresa_id TEXT,
      usuario_id TEXT,
      criado_em TEXT DEFAULT (datetime('now')),
      atualizado_em TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pedido_itens (
      id TEXT PRIMARY KEY,
      pedido_id TEXT NOT NULL,
      produto_id TEXT NOT NULL,
      quantidade REAL NOT NULL,
      separado REAL DEFAULT 0,
      status TEXT DEFAULT 'pendente',
      FOREIGN KEY(pedido_id) REFERENCES pedidos(id)
    );

    CREATE TABLE IF NOT EXISTS separacoes (
      id TEXT PRIMARY KEY,
      pedido_id TEXT NOT NULL,
      operador_id TEXT,
      status TEXT DEFAULT 'em_andamento',
      empresa_id TEXT,
      iniciado_em TEXT DEFAULT (datetime('now')),
      finalizado_em TEXT
    );

    CREATE TABLE IF NOT EXISTS logs (
      id TEXT PRIMARY KEY,
      usuario_id TEXT,
      acao TEXT NOT NULL,
      modulo TEXT,
      detalhes TEXT,
      ip TEXT,
      empresa_id TEXT,
      criado_em TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notificacoes (
      id TEXT PRIMARY KEY,
      titulo TEXT NOT NULL,
      mensagem TEXT,
      tipo TEXT DEFAULT 'info',
      lida INTEGER DEFAULT 0,
      usuario_id TEXT,
      empresa_id TEXT,
      criado_em TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS conteineres (
      id TEXT PRIMARY KEY,
      numero TEXT UNIQUE NOT NULL,
      status TEXT DEFAULT 'aguardando',
      fornecedor TEXT,
      empresa_id TEXT,
      criado_em TEXT DEFAULT (datetime('now'))
    );
  `);
}

module.exports = { getDB };
