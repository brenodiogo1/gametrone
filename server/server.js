// Chronicles of Aetheria - Arquivo de Inicialização Principal (Servidor)
// Consolida rotas Express, autenticação, arquivos estáticos do cliente, soquetes multiplayer e banco de dados.

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { initDatabase, query } = require('./db');
const { authRouter, JWT_SECRET } = require('./auth');
const GameEngine = require('./game');
const { GAME_NAME, MAPS } = require('./game_data');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Configuração de Parser JSON e arquivos estáticos do cliente
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Integrar rotas de autenticação
app.use('/api/auth', authRouter);

// Health Check API obrigatório
app.get('/health', async (req, res) => {
  try {
    // Testa consulta rápida no SQLite para validar saúde
    const result = await query.get('SELECT 1 + 1 as val');
    if (result && result.val === 2) {
      res.json({ status: 'HEALTHY', database: 'OK', game: GAME_NAME });
    } else {
      res.status(500).json({ status: 'UNHEALTHY', database: 'ERROR' });
    }
  } catch (err) {
    res.status(500).json({ status: 'UNHEALTHY', error: err.message });
  }
});

// Admin API para informações administrativas e dashboard
app.get('/api/admin/dashboard', async (req, res) => {
  // Retorna estatísticas reais do banco e do jogo online
  try {
    const totalUsers = await query.get('SELECT COUNT(*) as count FROM users');
    const totalChars = await query.get('SELECT COUNT(*) as count FROM characters');
    const recentLogs = await query.all('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 20');
    
    res.json({
      totalUsers: totalUsers.count,
      totalCharacters: totalChars.count,
      activeMaps: Object.keys(MAPS),
      logs: recentLogs
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Servir index.html para qualquer rota não mapeada (suporte a single page)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Inicialização de Banco e Instanciação do Motor de Jogo
async function startServer() {
  try {
    await initDatabase();
    
    // Cria administrador padrão semente (Seed) se não existir
    const adminExists = await query.get("SELECT id FROM users WHERE email = 'admin@aetheria.com'");
    if (!adminExists) {
      const bcrypt = require('bcryptjs');
      const hash = await bcrypt.hash('admin123456', 10);
      await query.run(
        "INSERT INTO users (id, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)",
        ['usr_admin', 'admin@aetheria.com', hash, 'admin', Date.now()]
      );
      // Cria personagem admin padrão
      await query.run(`
        INSERT INTO characters (
          id, user_id, name, level, xp, class, gold, map, x, y, z, r, skin_color, hair_style, hair_color, face_style, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        'char_admin', 'usr_admin', 'Admin_Aetheria', 99, 0, 'Vanguard', 999999, 'Town',
        0, 0.5, 0, 0, '#e0e0e0', 'hair_spiky', '#ffffff', 'face_cheerful', Date.now()
      ]);
      await query.run(`
        INSERT INTO character_stats (character_id, str, vit, agi, dex, int, spr, luk, stat_points, skill_points)
        VALUES (?, 99, 99, 99, 99, 99, 99, 99, 0, 0)
      `, ['char_admin']);
      await query.run(`
        INSERT INTO character_equipment (character_id, head, body, hands, feet, main_hand, off_hand, accessory1, accessory2, cape)
        VALUES (?, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
      `, ['char_admin']);

      console.log('Seed: Administrador padrão e personagem admin criados com sucesso.');
    }

    // Inicializa o Motor Multiplayer do MMORPG
    const game = new GameEngine(io);

    // Canal de Soquetes
    io.on('connection', (socket) => {
      let currentCaster = null;

      // Evento: Jogador solicita entrar no mundo com o personagem selecionado
      socket.on('join_world', async ({ charId }) => {
        await game.playerJoinWorld(socket, charId);
        currentCaster = game.players[socket.id];
      });

      // Evento: Recebe movimento do cliente
      socket.on('player_move', (data) => {
        const player = game.players[socket.id];
        if (player) {
          game.playerMove(player, data);
        }
      });

      // Evento: Uso de portal para carregar outro mapa
      socket.on('player_use_portal', ({ portalId }) => {
        const player = game.players[socket.id];
        if (player) {
          game.playerUsePortal(player, portalId);
        }
      });

      // Evento: Mensagem de Chat enviada
      socket.on('chat_msg', (data) => {
        const player = game.players[socket.id];
        if (player) {
          game.handleChatMessage(player, data);
        }
      });

      // Evento: Uso de Skill de Combate
      socket.on('use_skill', ({ skillId, targetId }) => {
        const player = game.players[socket.id];
        if (player) {
          game.playerCastSkill(player, skillId, targetId);
        }
      });

      // Evento: Coleta de Item do Chão (Loot)
      socket.on('pickup_loot', ({ lootId }) => {
        const player = game.players[socket.id];
        if (player) {
          game.playerPickupLoot(player, lootId);
        }
      });

      // Evento: Interação com NPC (Dialog, Compra, Venda, Quest)
      socket.on('npc_interact', async (data) => {
        const player = game.players[socket.id];
        if (player) {
          await game.playerInteractNPC(player, data);
        }
      });

      // Evento: Equipar Item
      socket.on('equip_item', async (data) => {
        const player = game.players[socket.id];
        if (player) {
          await game.playerEquipItem(player, data);
        }
      });

      // Evento: Desequipar Item
      socket.on('unequip_item', async (data) => {
        const player = game.players[socket.id];
        if (player) {
          await game.playerUnequipItem(player, data);
        }
      });

      // Evento: Distribuir Atributo
      socket.on('distribute_stat', async (data) => {
        const player = game.players[socket.id];
        if (player) {
          await game.playerDistributeStat(player, data);
        }
      });

      // Evento: Ressuscitar
      socket.on('request_resurrect', () => {
        const player = game.players[socket.id];
        if (player && player.hp <= 0) {
          game.resurrectPlayer(player);
        }
      });

      // Evento: Execução de comando administrador
      socket.on('admin_cmd', ({ command }) => {
        const player = game.players[socket.id];
        if (player) {
          game.executeAdminCommand(player, command);
        }
      });

      // Desconexão
      socket.on('disconnect', async () => {
        await game.playerDisconnect(socket.id);
      });
    });

    // Inicializa Ouvvinte HTTP
    server.listen(PORT, () => {
      console.log(`=============================================================`);
      console.log(`  SERVIDORES DO CHRONICLES OF AETHERIA ONLINE JOGÁVEIS       `);
      console.log(`  Porta: ${PORT} | IP: http://localhost:${PORT}              `);
      console.log(`=============================================================`);
    });

  } catch (err) {
    console.error("Erro fatal ao iniciar servidores do jogo:", err);
  }
}

startServer();
