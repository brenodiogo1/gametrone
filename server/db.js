// Chronicles of Aetheria - Camada de Banco de Dados (SQLite)
// Implementa esquema completo de tabelas, relacionamentos, constraints, índices e transações atômicas seguras.

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('path');

const dbPath = path.join(__dirname, 'aetheria.db');
const db = new sqlite3.Database(dbPath);

// Wrapper para Promises
const query = {
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  },
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },
  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
};

// Executa comandos em transação atômica
async function transaction(queriesCallback) {
  await query.run('BEGIN TRANSACTION');
  try {
    const result = await queriesCallback(query);
    await query.run('COMMIT');
    return result;
  } catch (err) {
    await query.run('ROLLBACK');
    throw err;
  }
}

// Inicializa Tabelas
async function initDatabase() {
  // Ativa Foreign Keys
  await query.run('PRAGMA foreign_keys = ON');

  // 1. users
  await query.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at INTEGER NOT NULL
    )
  `);

  // 2. characters
  await query.run(`
    CREATE TABLE IF NOT EXISTS characters (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT UNIQUE NOT NULL,
      level INTEGER NOT NULL DEFAULT 1,
      xp INTEGER NOT NULL DEFAULT 0,
      class TEXT NOT NULL DEFAULT 'Adventurer',
      gold INTEGER NOT NULL DEFAULT 100 CHECK (gold >= 0),
      map TEXT NOT NULL DEFAULT 'Town',
      x REAL NOT NULL DEFAULT 0,
      y REAL NOT NULL DEFAULT 0.5,
      z REAL NOT NULL DEFAULT 0,
      r REAL NOT NULL DEFAULT 0,
      skin_color TEXT NOT NULL DEFAULT '#ffd1a9',
      hair_style TEXT NOT NULL DEFAULT 'hair_spiky',
      hair_color TEXT NOT NULL DEFAULT '#7e57c2',
      face_style TEXT NOT NULL DEFAULT 'face_cheerful',
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 3. character_stats
  await query.run(`
    CREATE TABLE IF NOT EXISTS character_stats (
      character_id TEXT PRIMARY KEY,
      str INTEGER NOT NULL DEFAULT 5 CHECK (str >= 1),
      vit INTEGER NOT NULL DEFAULT 5 CHECK (vit >= 1),
      agi INTEGER NOT NULL DEFAULT 5 CHECK (agi >= 1),
      dex INTEGER NOT NULL DEFAULT 5 CHECK (dex >= 1),
      int INTEGER NOT NULL DEFAULT 5 CHECK (int >= 1),
      spr INTEGER NOT NULL DEFAULT 5 CHECK (spr >= 1),
      luk INTEGER NOT NULL DEFAULT 5 CHECK (luk >= 1),
      stat_points INTEGER NOT NULL DEFAULT 0 CHECK (stat_points >= 0),
      skill_points INTEGER NOT NULL DEFAULT 0 CHECK (skill_points >= 0),
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
    )
  `);

  // 4. character_equipment
  await query.run(`
    CREATE TABLE IF NOT EXISTS character_equipment (
      character_id TEXT PRIMARY KEY,
      head TEXT,
      body TEXT,
      hands TEXT,
      feet TEXT,
      main_hand TEXT,
      off_hand TEXT,
      accessory1 TEXT,
      accessory2 TEXT,
      cape TEXT,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
    )
  `);

  // 5. inventories (Slots e Equipamentos no inventário)
  await query.run(`
    CREATE TABLE IF NOT EXISTS inventories (
      id TEXT PRIMARY KEY,
      character_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      slot INTEGER NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity >= 1),
      rarity TEXT NOT NULL DEFAULT 'Common',
      refinement INTEGER NOT NULL DEFAULT 0 CHECK (refinement >= 0),
      is_equipped INTEGER NOT NULL DEFAULT 0 CHECK (is_equipped IN (0,1)),
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
      UNIQUE (character_id, slot)
    )
  `);

  // 6. quests progress
  await query.run(`
    CREATE TABLE IF NOT EXISTS character_quests (
      character_id TEXT NOT NULL,
      quest_id TEXT NOT NULL,
      status TEXT NOT NULL, -- 'accepted', 'completed'
      progress INTEGER NOT NULL DEFAULT 0,
      completed_at INTEGER,
      PRIMARY KEY (character_id, quest_id),
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
    )
  `);

  // 7. guilds
  await query.run(`
    CREATE TABLE IF NOT EXISTS guilds (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      leader_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (leader_id) REFERENCES characters(id) ON DELETE RESTRICT
    )
  `);

  // 8. guild_members
  await query.run(`
    CREATE TABLE IF NOT EXISTS guild_members (
      guild_id TEXT NOT NULL,
      character_id TEXT PRIMARY KEY,
      role TEXT NOT NULL DEFAULT 'member', -- 'leader', 'officer', 'member'
      joined_at INTEGER NOT NULL,
      FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
    )
  `);

  // 9. friendships
  await query.run(`
    CREATE TABLE IF NOT EXISTS friendships (
      character_id TEXT NOT NULL,
      friend_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'blocked'
      PRIMARY KEY (character_id, friend_id),
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
      FOREIGN KEY (friend_id) REFERENCES characters(id) ON DELETE CASCADE
    )
  `);

  // 10. audit_logs (Monitoramento de economia, admin e atividades suspeitas)
  await query.run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor TEXT NOT NULL, -- ID do usuário ou personagem ou 'SYSTEM'
      action TEXT NOT NULL, -- ex: 'ADMIN_GIVE_ITEM', 'TRADE_SUCCESS', 'CHEAT_SUSPECT'
      details TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    )
  `);

  // Criar índices para otimização de consultas frequentes
  await query.run(`CREATE INDEX IF NOT EXISTS idx_characters_user ON characters(user_id)`);
  await query.run(`CREATE INDEX IF NOT EXISTS idx_inventories_char ON inventories(character_id)`);
  await query.run(`CREATE INDEX IF NOT EXISTS idx_quests_char ON character_quests(character_id)`);
  await query.run(`CREATE INDEX IF NOT EXISTS idx_guild_members_guild ON guild_members(guild_id)`);
  await query.run(`CREATE INDEX IF NOT EXISTS idx_friendships_char ON friendships(character_id)`);
  await query.run(`CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)`);

  console.log('Banco de Dados do Chronicles of Aetheria inicializado com sucesso.');
}

module.exports = {
  db,
  query,
  transaction,
  initDatabase
};
