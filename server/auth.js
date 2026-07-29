// Chronicles of Aetheria - Servidor de Autenticação e Personagens (Express Router)
// Fornece cadastro, login, gerenciamento de múltiplos personagens seguros e proteção contra nomes inadequados.

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query, transaction } = require('./db');
const { calculateDerivedStats, CLASSES, ITEMS } = require('./game_data');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'aetheria-super-secret-key-2026';

// Termos ofensivos e protegidos filtrados
const BANNED_NAMES = [
  'admin', 'administrator', 'moderator', 'moderador', 'gm', 'gamemaster', 'game_master',
  'ragnarok', 'poring', 'prontera', 'kafra', 'cheat', 'hack', 'dupe', 'exploit', 'suporte',
  'foda', 'merda', 'puta', 'caralho', 'cu', 'bosta', 'pinto', 'pica', 'viado', 'asshole', 'bitch'
];

// Middleware para verificar JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Token não fornecido' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token inválido ou expirado' });
    req.user = user;
    next();
  });
}

// Helper para gerar IDs (UUIDv4 simples baseados em criptografia ou math)
function generateUUID() {
  return 'char_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

// 1. Cadastro
router.post('/register', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'E-mail inválido.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });
  }

  try {
    const existing = await query.get('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    if (existing) {
      return res.status(400).json({ error: 'Este e-mail já está cadastrado.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    const userId = 'usr_' + generateUUID();

    await query.run(
      'INSERT INTO users (id, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)',
      [userId, email.toLowerCase(), hash, 'user', Date.now()]
    );

    // Grava no Audit Log
    await query.run(
      'INSERT INTO audit_logs (actor, action, details, timestamp) VALUES (?, ?, ?, ?)',
      [userId, 'USER_REGISTER', `Usuário cadastrado com o e-mail: ${email}`, Date.now()]
    );

    res.status(201).json({ message: 'Conta criada com sucesso!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno do servidor ao criar conta.' });
  }
});

// 2. Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
  }

  try {
    const user = await query.get('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
    if (!user) {
      return res.status(400).json({ error: 'E-mail ou senha incorretos.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(400).json({ error: 'E-mail ou senha incorretos.' });
    }

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });

    // Registra auditoria
    await query.run(
      'INSERT INTO audit_logs (actor, action, details, timestamp) VALUES (?, ?, ?, ?)',
      [user.id, 'USER_LOGIN', `Usuário realizou login com sucesso. IP registrado.`, Date.now()]
    );

    res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno no servidor ao autenticar.' });
  }
});

// 3. Obter Personagens da Conta
router.get('/characters', async (req, res) => {
  // Extrai token manualmente para suportar middleware amigável
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Não autorizado.' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const chars = await query.all('SELECT * FROM characters WHERE user_id = ?', [decoded.id]);
    
    // Anexa estatísticas e equipamentos dos personagens
    for (let char of chars) {
      char.stats = await query.get('SELECT * FROM character_stats WHERE character_id = ?', [char.id]);
      char.equipment = await query.get('SELECT * FROM character_equipment WHERE character_id = ?', [char.id]);
      
      // Calcula atributos derivados
      char.derived = calculateDerivedStats(char.stats, char.level, char.class);
    }

    res.json(chars);
  } catch (err) {
    res.status(403).json({ error: 'Sessão inválida.' });
  }
});

// 4. Criar Personagem
router.post('/characters/create', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Não autorizado.' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const { name, skinColor, hairStyle, hairColor, faceStyle } = req.body;

    if (!name || name.trim().length < 3 || name.trim().length > 15) {
      return res.status(400).json({ error: 'Nome do personagem deve ter entre 3 e 15 caracteres.' });
    }

    const cleanName = name.trim();
    // Validação de termos proibidos (Case Insensitive e substrings)
    const lowerName = cleanName.toLowerCase();
    for (let banned of BANNED_NAMES) {
      if (lowerName.includes(banned)) {
        return res.status(400).json({ error: 'O nome escolhido contém palavras protegidas ou inadequadas.' });
      }
    }

    // Regex de caracteres válidos (apenas letras, números e underline simples)
    if (!/^[a-zA-Z0-9_]+$/.test(cleanName)) {
      return res.status(400).json({ error: 'O nome pode conter apenas letras, números e underlines.' });
    }

    // Verifica limite de personagens (máximo 4 por conta)
    const countRow = await query.get('SELECT COUNT(*) as count FROM characters WHERE user_id = ?', [decoded.id]);
    if (countRow.count >= 4) {
      return res.status(400).json({ error: 'Limite de 4 personagens por conta atingido.' });
    }

    // Verifica se nome já existe
    const exists = await query.get('SELECT id FROM characters WHERE name = ?', [cleanName]);
    if (exists) {
      return res.status(400).json({ error: 'Este nome de personagem já está em uso.' });
    }

    const charId = generateUUID();

    // Salva tudo de forma transacional atômica
    await transaction(async (tx) => {
      // Cria o personagem
      await tx.run(`
        INSERT INTO characters (
          id, user_id, name, level, xp, class, gold, map, x, y, z, r,
          skin_color, hair_style, hair_color, face_style, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        charId, decoded.id, cleanName, 1, 0, 'Adventurer', 100, 'Town',
        0, 0.5, 0, 0, skinColor || '#ffd1a9', hairStyle || 'hair_spiky',
        hairColor || '#7e57c2', faceStyle || 'face_cheerful', Date.now()
      ]);

      // Atributos básicos iniciais
      await tx.run(`
        INSERT INTO character_stats (
          character_id, str, vit, agi, dex, int, spr, luk, stat_points, skill_points
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [charId, 5, 5, 5, 5, 5, 5, 5, 0, 0]);

      // Equipamento vazio
      await tx.run(`
        INSERT INTO character_equipment (
          character_id, head, body, hands, feet, main_hand, off_hand, accessory1, accessory2, cape
        ) VALUES (?, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
      `, [charId]);

      // Adiciona itens iniciais no inventário
      // Poções Vermelhas (5x) no slot 0
      await tx.run(`
        INSERT INTO inventories (id, character_id, item_id, slot, quantity, rarity, refinement, is_equipped)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, ['inv_' + generateUUID(), charId, 'RedPotion', 0, 5, 'Common', 0, 0]);

      // Registrar auditoria da criação
      await tx.run(`
        INSERT INTO audit_logs (actor, action, details, timestamp)
        VALUES (?, ?, ?, ?)
      `, [decoded.id, 'CHAR_CREATE', `Personagem criado: ${cleanName} (${charId})`, Date.now()]);
    });

    res.status(201).json({ message: 'Personagem criado com sucesso!', charId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Erro ao criar personagem.' });
  }
});

// 5. Excluir Personagem (Protegido)
router.post('/characters/delete', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Não autorizado.' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const { charId, confirmName } = req.body;

    if (!charId || !confirmName) {
      return res.status(400).json({ error: 'Confirmação incorreta.' });
    }

    const char = await query.get('SELECT * FROM characters WHERE id = ? AND user_id = ?', [charId, decoded.id]);
    if (!char) {
      return res.status(404).json({ error: 'Personagem não encontrado.' });
    }

    if (char.name !== confirmName.trim()) {
      return res.status(400).json({ error: 'O nome inserido não confere com o personagem a ser deletado.' });
    }

    await transaction(async (tx) => {
      // Exclui do banco de dados (cascade cuida dos stats, inventário e quests)
      await tx.run('DELETE FROM characters WHERE id = ?', [charId]);

      // Registra no Audit Log
      await tx.run(`
        INSERT INTO audit_logs (actor, action, details, timestamp)
        VALUES (?, ?, ?, ?)
      `, [decoded.id, 'CHAR_DELETE', `Personagem deletado permanentemente: ${char.name} (${charId})`, Date.now()]);
    });

    res.json({ message: 'Personagem excluído com sucesso!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao deletar personagem.' });
  }
});

module.exports = {
  authRouter: router,
  authenticateToken,
  JWT_SECRET
};
