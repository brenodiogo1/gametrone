// Chronicles of Aetheria - Motor do Cliente (Sockets, Loop Principal, Input, Interpolação)
// Sincroniza estado de rede, inputs WASD + Mouse, interpola players/mobs, coordena combate e HUD.

class GameClient {
  constructor() {
    this.socket = null;
    this.token = localStorage.getItem('aetheria_token');
    
    // Sub-Sistemas do Cliente
    this.renderer = new GameRenderer('game-canvas-container');
    this.ui = new GameUI();

    // Estado Local de Jogo
    this.player = null; // dados do personagem ativo
    this.otherPlayers = {}; // charId -> PlayerData
    this.mobs = {}; // mobId -> MobData
    this.loot = {}; // lootId -> LootData

    // Alvo de combate ativo
    this.targetId = null;

    // Definições Estáticas carregadas do servidor (via arquivos ou emulados em sinc)
    this.gameData = null; // Configurações gerais

    // Controles de Input
    this.keys = { w: false, a: false, s: false, d: false, Shift: false };
    this.mouse = { x: 0, y: 0, isRightDown: false };
    
    // Interpolação de Posições (Suavidade)
    this.targetPositions = {}; // id -> { x, y, z, r }

    this.init();
  }

  // Inicializa o Jogo, Carrega Dados Estáticos e Registra Sockets
  async init() {
    // 1. Emula carregamento progressivo real com status para o jogador
    const loadingProg = document.getElementById('loading-progress');
    const loadingText = document.querySelector('.loading-status');

    const steps = [
      { text: "Conectando ao Veio de Éter...", p: 20 },
      { text: "Carregando geometrias low-poly...", p: 50 },
      { text: "Compilando texturas e peles...", p: 80 },
      { text: "Reino de Aetheria pronto!", p: 100 }
    ];

    for (let step of steps) {
      await new Promise(r => setTimeout(r, 400));
      loadingText.innerText = step.text;
      loadingProg.style.width = `${step.p}%`;
    }

    // Oculta tela de loading inicial
    document.getElementById('loading-screen').classList.add('hide');

    // Carrega definições do jogo localizadas (copia fiel do game_data.js)
    this.itemsDef = window.ITEMS_DEFINITION_FALLBACK; // Definido logo abaixo para garantir 100% offline-ready
    this.skillsDef = window.SKILLS_DEFINITION_FALLBACK;
    this.monstersDef = window.MONSTERS_DEFINITION_FALLBACK;
    this.classesDef = window.CLASSES_DEFINITION_FALLBACK;
    this.questsDef = window.QUESTS_DEFINITION_FALLBACK;

    // Registra Sockets e Configura Telas Iniciais
    this.connectSockets();
    this.setupAuthUI();
    this.setupCharacterUI();
    this.setupHUDControls();
    this.setupInputs();

    // Bypass de credenciais e login: entra direto e imediatamente como o personagem Admin_Aetheria!
    setTimeout(() => {
      this.socket.emit('join_world', { charId: 'char_admin' });
    }, 200);
  }

  // Conecta Canal Sockets do Servidor em Tempo Real
  connectSockets() {
    this.socket = io({
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1500
    });

    // Sincronização geral de entidades no mapa ativo (Interest Management)
    this.socket.on('world_sync', ({ mobs }) => {
      for (let mob of mobs) {
        if (this.mobs[mob.id]) {
          // Guarda posições alvo para interpolação linear suave!
          this.targetPositions[mob.id] = { x: mob.x, y: 0.5, z: mob.z, r: mob.r };
          this.mobs[mob.id].hp = mob.hp;
          this.mobs[mob.id].state = mob.state;

          // Atualiza barra de vida do alvo selecionado em tempo real
          if (this.targetId === mob.id) {
            this.updateTargetUI(this.mobs[mob.id]);
          }
        }
      }
    });

    // Sincronização de Outros Jogadores se Movendo
    this.socket.on('player_moved', ({ charId, x, y, z, r }) => {
      if (this.otherPlayers[charId]) {
        this.targetPositions[charId] = { x, y, z, r };
      }
    });

    // Spawn e Despawn de Entidades
    this.socket.on('player_spawn', (pData) => {
      if (pData.charId === this.player?.charId) return; // ignora eu mesmo
      this.otherPlayers[pData.charId] = pData;
      this.renderer.createPlayerMesh(pData, pData.charId);
    });

    this.socket.on('player_despawn', ({ charId }) => {
      this.renderer.removeEntity(charId);
      delete this.otherPlayers[charId];
      if (this.targetId === charId) {
        this.targetId = null;
        document.getElementById('hud-target-panel').classList.add('hide');
      }
    });

    this.socket.on('mob_respawn', ({ mobId, x, z, hp }) => {
      if (this.mobs[mobId]) {
        this.mobs[mobId].hp = hp;
        this.mobs[mobId].x = x;
        this.mobs[mobId].z = z;
        this.mobs[mobId].state = 'idle';
        
        // Recria ou atualiza mesh
        const mesh = this.renderer.createMonsterMesh(this.mobs[mobId], mobId);
        mesh.position.set(x, 0.5, z);
      }
    });

    this.socket.on('mob_death', ({ mobId }) => {
      this.ui.playSfx('death');
      if (this.mobs[mobId]) {
        this.mobs[mobId].hp = 0;
        this.mobs[mobId].state = 'dead';
        this.renderer.removeEntity(mobId);
        
        if (this.targetId === mobId) {
          this.targetId = null;
          document.getElementById('hud-target-panel').classList.add('hide');
        }
      }
    });

    this.socket.on('player_death', ({ charId, name }) => {
      this.ui.playSfx('death');
      this.renderer.removeEntity(charId);
      if (charId === this.player?.charId) {
        // EU MORRI! Mostra tela de reviver
        document.getElementById('death-overlay').classList.remove('hide');
        this.player.hp = 0;
        this.updateHUDProfile();
      }
    });

    this.socket.on('player_resurrected', ({ map, x, y, z, hp, mp, xp }) => {
      document.getElementById('death-overlay').classList.add('hide');
      
      this.player.map = map;
      this.player.x = x;
      this.player.y = y;
      this.player.z = z;
      this.player.hp = hp;
      this.player.mp = mp;
      this.player.xp = xp;

      // Limpa entidades e reconstrói terreno se mudou de mapa
      this.loadMapState(map);
      this.updateHUDProfile();
    });

    // Novo loot jogado no chão
    this.socket.on('loot_spawn', (lootData) => {
      this.loot[lootData.id] = lootData;
      this.renderer.createLootMesh(lootData, lootData.id);
    });

    // Loot recolhido
    this.socket.on('loot_pickup', ({ lootId, charId }) => {
      this.ui.playSfx('loot');
      this.renderer.removeEntity(lootId);
      delete this.loot[lootId];
    });

    // Inicialização do estado de entidades ao entrar em um mapa
    this.socket.on('map_init_state', ({ players, mobs, loot }) => {
      // Limpa meshes antigas
      for (let key in this.otherPlayers) this.renderer.removeEntity(key);
      for (let key in this.mobs) this.renderer.removeEntity(key);
      for (let key in this.loot) this.renderer.removeEntity(key);

      this.otherPlayers = {};
      this.mobs = {};
      this.loot = {};
      this.targetPositions = {};

      // Spawna players do novo mapa
      for (let p of players) {
        this.otherPlayers[p.charId] = p;
        this.renderer.createPlayerMesh(p, p.charId);
      }

      // Spawna mobs do novo mapa
      for (let m of mobs) {
        this.mobs[m.id] = m;
        if (m.state !== 'dead') {
          this.renderer.createMonsterMesh(m, m.id);
        }
      }

      // Spawna loot existente
      for (let l of loot) {
        this.loot[l.id] = l;
        this.renderer.createLootMesh(l, l.id);
      }
    });

    // Mensagens de chat recebidas
    this.socket.on('chat_msg', ({ sender, text, channel, timestamp }) => {
      this.ui.appendChatLine(sender, text, channel, timestamp);
    });

    // Mensagens diretas do sistema na tela
    this.socket.on('sys_msg', ({ type, text }) => {
      this.ui.appendChatLine(null, text, type, Date.now());
    });

    // Sincronização do Inventário
    this.socket.on('inventory_sync', (invItems) => {
      this.player.inventory = invItems;
      this.ui.updateInventoryUI(invItems, this.itemsDef);
    });

    // Sincronização das Quests
    this.socket.on('quests_sync', (quests) => {
      this.player.quests = quests;
      this.ui.updateQuestTracker(quests, this.questsDef);
    });

    this.socket.on('quest_updated', ({ questId, progress, targetCount, text }) => {
      this.ui.playSfx('cast');
      this.ui.appendChatLine(null, text, 'quest', Date.now());
      // atualiza dados locais
      const q = this.player.quests.find(q => q.quest_id === questId);
      if (q) q.progress = progress;
      this.ui.updateQuestTracker(this.player.quests, this.questsDef);
    });

    // Mudança de mapa do próprio jogador (portal)
    this.socket.on('player_map_change', ({ map, x, y, z }) => {
      this.player.map = map;
      this.player.x = x;
      this.player.y = y;
      this.player.z = z;
      this.loadMapState(map);
    });

    // Eventos de combate com partículas flutuantes!!
    this.socket.on('combat_event', ({ type, attackerId, defenderId, damage, isCrit, newHp }) => {
      // Toca som baseado no tipo
      if (type === 'heal') this.ui.playSfx('loot');
      else this.ui.playSfx('hit');

      // Acha coordenadas 3D do defensor para instanciar dano flutuante projetado em 2D!
      let defPos = null;
      if (defenderId === this.player?.charId) {
        defPos = { x: this.player.x, y: this.player.y + 1.2, z: this.player.z };
        this.player.hp = newHp;
        this.updateHUDProfile();
      } else if (this.otherPlayers[defenderId]) {
        const p = this.otherPlayers[defenderId];
        defPos = { x: p.x, y: p.y + 1.2, z: p.z };
      } else if (this.mobs[defenderId]) {
        const m = this.mobs[defenderId];
        defPos = { x: m.x, y: m.y + 1.2, z: m.z };
        m.hp = newHp;
      }

      if (defPos) {
        // Dispara efeito de partículas low-poly de impacto no renderizador!
        this.renderer.spawnParticleEffect('hit', defPos.x, defPos.y, defPos.z, type === 'heal' ? 0x4caf50 : 0xff5252);
        
        // Cria elemento de texto flutuante projetado
        this.createFloatingText(defPos, damage, isCrit, type === 'heal');
      }
    });

    // Efeito visual de Level Up glorioso
    this.socket.on('level_up_effect', ({ charId }) => {
      this.ui.playSfx('level_up');
      let pos = null;
      if (charId === this.player?.charId) {
        pos = { x: this.player.x, y: this.player.y, z: this.player.z };
      } else if (this.otherPlayers[charId]) {
        const p = this.otherPlayers[charId];
        pos = { x: p.x, y: p.y, z: p.z };
      }
      if (pos) {
        this.renderer.spawnParticleEffect('level_up', pos.x, pos.y, pos.z);
      }
    });

    this.socket.on('player_level_up', (data) => {
      this.ui.playSfx('level_up');
      
      this.player.level = data.level;
      this.player.xp = data.xp;
      this.player.hp = data.hp;
      this.player.mp = data.mp;
      this.player.stats = data.stats;
      this.player.derived = data.derived;

      this.updateHUDProfile();
      this.ui.updateSkillsTreeUI(this.player.class, this.player.stats.skill_points, this.skillsDef, this.classesDef);
      
      // Abre janela de stats para distribuir pontos recebidos!
      this.ui.toggleWindow('win-stats');
      this.updateStatsWindow();
    });

    // Confirmação de entrada bem sucedida no mundo!
    this.socket.on('world_enter_success', ({ player, derived, stats, equipment }) => {
      this.player = player;
      this.player.derived = derived;
      this.player.stats = stats;
      this.player.equipment = equipment;

      // Oculta seletor de personagens e inicia cena 3D do jogo!
      document.getElementById('char-screen').classList.add('hide');
      document.getElementById('game-hud').classList.remove('hide');

      this.loadMapState(player.map);
      this.updateHUDProfile();

      // Libera admin button se for administrador real
      if (player.user_id === 'usr_admin') {
        document.getElementById('btn-open-admin-hud').classList.remove('hide');
      }

      // Loop de atualização de inputs de teclado/movimentação local (20 vezes por segundo)
      setInterval(() => {
        this.sendLocalMovement();
      }, 50);

      // Inicia loop de renderização da câmera
      this.runCameraTracking();
    });

    this.socket.on('player_update_combat_data', ({ stats, derived, equipment }) => {
      if (stats) this.player.stats = stats;
      if (derived) this.player.derived = derived;
      if (equipment) this.player.equipment = equipment;

      this.updateHUDProfile();
      this.updateStatsWindow();
      this.ui.updateEquipmentUI(this.player.equipment, this.itemsDef);
    });

    this.socket.on('player_update', (data) => {
      if (!this.player) return;
      for (let k in data) {
        this.player[k] = data[k];
      }
      this.updateHUDProfile();
    });

    // Teleporte de anticheat do servidor
    this.socket.on('player_correct_position', ({ x, y, z, r }) => {
      if (this.player) {
        this.player.x = x;
        this.player.y = y;
        this.player.z = z;
        this.player.r = r;
      }
    });

    // Diálogos de Quests dos NPCs
    this.socket.on('npc_dialog_quests', ({ npcId, available, active }) => {
      this.ui.updateNPCQuestsList(available, active);
    });

    // Janelas de Quests e Classes
    this.socket.on('quest_completed_ui', (qId) => {
      this.ui.playSfx('level_up');
      this.ui.closeWindow('win-npc-dialog');
    });

    this.socket.on('class_change_ui', ({ npcId }) => {
      // Abre janela de escolha de classe
      const classArea = document.getElementById('npc-class-area');
      classArea.classList.remove('hide');
    });
  }

  // Configurações de Telas e Submissão de Formulários de Login/Cadastro
  setupAuthUI() {
    const emailInput = document.getElementById('auth-email');
    const passInput = document.getElementById('auth-password');
    const authForm = document.getElementById('auth-form');
    const authError = document.getElementById('auth-error');

    let mode = 'login'; // login ou register

    document.getElementById('tab-login').onclick = () => {
      mode = 'login';
      document.getElementById('tab-login').classList.add('active');
      document.getElementById('tab-register').classList.remove('active');
      document.getElementById('btn-auth-submit').innerText = 'Acessar Reino';
    };

    document.getElementById('tab-register').onclick = () => {
      mode = 'register';
      document.getElementById('tab-register').classList.add('active');
      document.getElementById('tab-login').classList.remove('active');
      document.getElementById('btn-auth-submit').innerText = 'Criar Conta';
    };

    authForm.onsubmit = async (e) => {
      e.preventDefault();
      authError.innerText = '';
      
      const email = emailInput.value.trim();
      const password = passInput.value;

      try {
        const url = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });

        const data = await res.json();
        if (!res.ok) {
          authError.innerText = data.error || 'Erro desconhecido.';
          return;
        }

        if (mode === 'login') {
          localStorage.setItem('aetheria_token', data.token);
          this.token = data.token;
          
          // Oculta tela e busca lista de personagens
          document.getElementById('auth-screen').classList.add('hide');
          this.fetchCharacters();
        } else {
          // Após registrar, faz login automático ou instrui o usuário
          authError.style.color = '#4caf50';
          authError.innerText = 'Conta criada com sucesso! Faça login.';
          setTimeout(() => {
            document.getElementById('tab-login').click();
          }, 1000);
        }
      } catch (err) {
        authError.innerText = 'Erro ao conectar com os Veios de Éter.';
      }
    };
  }

  // Busca e exibe lista de Personagens da Conta
  async fetchCharacters() {
    try {
      const res = await fetch('/api/auth/characters', {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      const data = await res.json();

      if (!res.ok) {
        // Token expirado, volta para tela de login
        localStorage.removeItem('aetheria_token');
        document.getElementById('auth-screen').classList.remove('hide');
        return;
      }

      document.getElementById('char-screen').classList.remove('hide');
      this.renderCharactersList(data);
    } catch (err) {
      document.getElementById('auth-screen').classList.remove('hide');
    }
  }

  renderCharactersList(chars) {
    const list = document.getElementById('characters-list-container');
    list.innerHTML = '';

    if (chars.length === 0) {
      list.innerHTML = '<p class="empty-quests" style="margin-bottom: 15px;">Nenhum personagem cadastrado. Crie um abaixo!</p>';
    }

    for (let char of chars) {
      const card = document.createElement('div');
      card.className = 'char-card';
      card.dataset.id = char.id;
      card.innerHTML = `
        <div class="char-info">
          <h4>${char.name}</h4>
          <p>${char.class} - Nível ${char.level}</p>
        </div>
        <button class="btn-delete-char" data-id="${char.id}" data-name="${char.name}" title="Excluir Personagem">&times;</button>
      `;
      
      // Clique no card entra no mundo
      card.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-delete-char')) return;
        this.socket.emit('join_world', { charId: char.id });
      });

      list.appendChild(card);
    }

    // Configura botões de exclusão protegida
    document.querySelectorAll('.btn-delete-char').forEach(btn => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        const charId = e.target.dataset.id;
        const name = e.target.dataset.name;
        
        const confirmName = prompt(`Digite o nome do personagem "${name}" para confirmar a exclusão permanente:`);
        if (confirmName === name) {
        const res = await fetch('/api/auth/characters/delete', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.token}`
          },
          body: JSON.stringify({ charId, confirmName })
        });
          if (res.ok) {
            alert('Personagem excluído com sucesso!');
            this.fetchCharacters();
          } else {
            const data = await res.json();
            alert(data.error || 'Erro ao excluir.');
          }
        } else if (confirmName !== null) {
          alert('Nome incorreto. Exclusão cancelada.');
        }
      };
    });
  }

  // Configuração da Criação de Personagem com Ajustes Cosméticos
  setupCharacterUI() {
    const charCreatePanel = document.getElementById('char-create-panel');
    const errBox = document.getElementById('char-create-error');
    
    // Mostra/Oculta painel de criação
    document.getElementById('btn-show-create-char').onclick = () => {
      charCreatePanel.classList.remove('hide');
    };
    document.getElementById('btn-char-create-cancel').onclick = () => {
      charCreatePanel.classList.add('hide');
      errBox.innerText = '';
    };

    // Objeto temporário para guardar customização escolhida
    const cosmetic = {
      hairStyle: 'hair_spiky',
      hairColor: '#7e57c2',
      skinColor: '#ffd1a9',
      faceStyle: 'face_cheerful'
    };

    // Seletores de estilo cosméticos
    document.querySelectorAll('.style-selector, .color-dot').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const type = e.target.dataset.type;
        const val = e.target.dataset.value;

        // Limpa ativos da linha
        const parent = e.target.parentElement;
        parent.querySelectorAll('.style-selector, .color-dot').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');

        cosmetic[type] = val;
      });
    });

    // Enviar criação para o servidor
    document.getElementById('btn-char-create-submit').onclick = async () => {
      errBox.innerText = '';
      const name = document.getElementById('char-new-name').value.trim();

      if (!name) {
        errBox.innerText = 'Por favor, insira o nome de seu herói.';
        return;
      }

      try {
        const res = await fetch('/api/auth/characters/create', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.token}`
          },
          body: JSON.stringify({
            name,
            skinColor: cosmetic.skinColor,
            hairStyle: cosmetic.hairStyle,
            hairColor: cosmetic.hairColor,
            faceStyle: cosmetic.faceStyle
          })
        });

        const data = await res.json();
        if (!res.ok) {
          errBox.innerText = data.error || 'Erro ao criar.';
          return;
        }

        // Sucesso! Recarrega lista e fecha criador
        charCreatePanel.classList.add('hide');
        document.getElementById('char-new-name').value = '';
        this.fetchCharacters();
      } catch (err) {
        errBox.innerText = 'Erro ao processar criação de personagem.';
      }
    };
  }

  // Configura Cliques no HUD, Inventário, Atributos e Quests
  setupHUDControls() {
    // 1. Distribuição de Stats
    document.querySelectorAll('.btn-add-stat').forEach(btn => {
      btn.onclick = (e) => {
        const stat = e.target.dataset.stat;
        this.socket.emit('distribute_stat', { stat });
      };
    });

    // 2. Chat Form Submit
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    chatForm.onsubmit = (e) => {
      e.preventDefault();
      const text = chatInput.value;
      if (text.startsWith('/')) {
        // Comando administrativo se aplicável
        this.socket.emit('admin_cmd', { command: text });
      } else {
        // Mensagem de chat normal
        this.socket.emit('chat_msg', {
          channel: this.ui.currentChannel,
          text
        });
      }
      chatInput.value = '';
    };

    // 3. Clique em Slots de Equipamentos para desequipar
    document.querySelectorAll('.eq-slot').forEach(slot => {
      slot.onclick = (e) => {
        const col = e.target.dataset.col;
        this.socket.emit('unequip_item', { col });
      };
    });

    // 4. Fechar jogo / Logout
    document.getElementById('btn-logout').onclick = () => {
      localStorage.removeItem('aetheria_token');
      location.reload();
    };

    // 5. Reviver / Respawn
    document.getElementById('btn-request-resurrect').onclick = () => {
      this.socket.emit('request_resurrect');
    };

    // 6. Botões Rápidos Admin Command
    document.querySelectorAll('.btn-admin-cmd').forEach(btn => {
      btn.onclick = (e) => {
        const cmd = e.target.dataset.cmd;
        this.socket.emit('admin_cmd', { command: cmd });
      };
    });

    // Abre Painel Admin Dashboard do Servidor Real
    document.getElementById('btn-open-admin-hud').onclick = async () => {
      this.ui.toggleWindow('win-admin');
      try {
        const res = await fetch('/api/admin/dashboard');
        const data = await res.json();
        
        // Renderiza logs de auditoria reais recebidos do SQLite
        const box = document.getElementById('admin-logs-box');
        box.innerHTML = '';
        if (data.logs.length === 0) {
          box.innerHTML = '<p>Nenhum log registrado ainda.</p>';
        } else {
          for (let log of data.logs) {
            box.innerHTML += `
              <div class="admin-log-line">
                <span class="act">[${log.action}]</span> ${log.details}<br>
                <small>${new Date(log.timestamp).toLocaleString()}</small>
              </div>
            `;
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
  }

  // Gerencia Inputs de Teclado, Câmera e Cliques em Alvos 3D
  setupInputs() {
    // Teclado WASD para movimentação local do player
    document.addEventListener('keydown', (e) => {
      if (document.activeElement.id === 'chat-input') return;
      if (!e.key) return;

      const key = e.key.toLowerCase();
      if (key === 'w' || key === 'arrowup') this.keys.w = true;
      if (key === 'a' || key === 'arrowleft') this.keys.a = true;
      if (key === 's' || key === 'arrowdown') this.keys.s = true;
      if (key === 'd' || key === 'arrowright') this.keys.d = true;
      if (e.key === 'Shift') this.keys.Shift = true;

      // Atalhos de Habilidades 1 a 6 mapeados na Hotbar
      if (['1', '2', '3', '4', '5'].includes(e.key)) {
        const idx = parseInt(e.key) - 1;
        const skillsMapped = ['BasicStrike', 'DoubleAttack']; // default inicial
        if (this.player && this.player.class !== 'Adventurer') {
          // Concede skills avançadas da classe
          const clsDef = this.classesDef[this.player.class];
          if (clsDef && clsDef.skills) {
            skillsMapped[0] = clsDef.skills[0] || 'BasicStrike';
            skillsMapped[1] = clsDef.skills[1] || 'DoubleAttack';
            skillsMapped[2] = clsDef.skills[2];
            skillsMapped[3] = clsDef.skills[3];
          }
        }

        const skillId = skillsMapped[idx];
        if (skillId) {
          if (!this.targetId) {
            this.ui.appendChatLine(null, "Por favor, clique com o mouse em um monstro para selecioná-lo antes de atacar.", 'system', Date.now());
          } else {
            this.socket.emit('use_skill', { skillId, targetId: this.targetId });
          }
        }
      }

      // Tecla 6 rápida usa poção
      if (e.key === '6') {
        // Encontra poção vermelha no inventário e clica para usar
        const potIdx = this.player.inventory.findIndex(slot => slot.item_id === 'RedPotion');
        if (potIdx !== -1) {
          // No vertical slice, interage com o curandeiro ou consome via NPC comprar/vender
          // Para ser completo, vamos simular o NPC healer consumindo, ou o próprio player emite
          this.socket.emit('npc_interact', { npcId: 'HealerLuna', action: 'use_potion' });
        } else {
          this.ui.appendChatLine(null, "Você não possui Poções Vermelhas em sua mochila mochila.", 'error', Date.now());
        }
      }
    });

    document.addEventListener('keyup', (e) => {
      if (!e.key) return;
      const key = e.key.toLowerCase();
      if (key === 'w' || key === 'arrowup') this.keys.w = false;
      if (key === 'a' || key === 'arrowleft') this.keys.a = false;
      if (key === 's' || key === 'arrowdown') this.keys.s = false;
      if (key === 'd' || key === 'arrowright') this.keys.d = false;
      if (e.key === 'Shift') this.keys.Shift = false;
    });

    // Mouse rotaciona Câmera do Jogo e Seleciona Alvos clicando na cena 3D
    const container = document.getElementById('game-canvas-container');

    container.addEventListener('mousedown', (e) => {
      if (e.button === 2) {
        // Botão direito rotaciona câmera
        this.mouse.isRightDown = true;
      } else if (e.button === 0) {
        // Botão esquerdo seleciona alvos do mundo 3D (Raycasting!)
        this.raycastWorldTarget(e);
      }
    });

    document.addEventListener('mouseup', (e) => {
      if (e.button === 2) this.mouse.isRightDown = false;
    });

    document.addEventListener('mousemove', (e) => {
      if (this.mouse.isRightDown) {
        // Rotação horizontal e vertical da câmera baseado no arrasto
        this.renderer.cameraYaw -= e.movementX * 0.007;
        this.renderer.cameraPitch = Math.max(-1.2, Math.min(-0.1, this.renderer.cameraPitch - e.movementY * 0.007));
      }
    });

    // Zoom da câmera
    container.addEventListener('wheel', (e) => {
      this.renderer.cameraDistance = Math.max(8, Math.min(35, this.renderer.cameraDistance + e.deltaY * 0.015));
    });

    // Impede abrir menu padrão de clique direito na janela de jogo
    container.addEventListener('contextmenu', e => e.preventDefault());
  }

  // Faz Raycast 3D para achar monstros, NPCs, portais ou itens sob o clique do mouse
  raycastWorldTarget(e) {
    const raycaster = new THREE.Raycaster();
    const mouse2D = new THREE.Vector2(
      (e.clientX / window.innerWidth) * 2 - 1,
      -(e.clientY / window.innerHeight) * 2 + 1
    );

    raycaster.setFromCamera(mouse2D, this.renderer.camera);

    // Mapeia todas as meshes de entidades ativas na cena para testar intersecção
    const targets = [];
    const meshIdMap = new Map();

    for (let id in this.renderer.meshes) {
      const mesh = this.renderer.meshes[id];
      targets.push(mesh);
      meshIdMap.set(mesh, id);
    }

    const intersects = raycaster.intersectObjects(targets, true);

    if (intersects.length > 0) {
      // Pega o objeto mais próximo do clique
      let hitMesh = intersects[0].object;
      while (hitMesh.parent && !meshIdMap.has(hitMesh)) {
        hitMesh = hitMesh.parent;
      }

      const entityId = meshIdMap.get(hitMesh);
      if (entityId) {
        this.handleEntityClicked(entityId);
      }
    }
  }

  // Trata clique do mouse em uma entidade
  async handleEntityClicked(id) {
    if (id.startsWith('mob_')) {
      const mob = this.mobs[id];
      if (mob && mob.hp > 0) {
        this.targetId = id;
        this.updateTargetUI(mob);
      }
    } 
    else if (id.startsWith('loot_')) {
      // Recolhe Loot do chão direto ao clicar
      this.socket.emit('pickup_loot', { lootId: id });
    }
    else if (id.startsWith('portal_')) {
      // Usa portal
      this.socket.emit('player_use_portal', { portalId: id });
    }
    else {
      // Pode ser NPC de conversação
      const mapDef = this.questsDef.Q1 ? { npcs: [
        { id: "MentorEldrin", name: "Mentor Eldrin" },
        { id: "HealerLuna", name: "Sacerdotisa Luna" },
        { id: "FerreiroGrom", name: "Ferreiro Grom" },
        { id: "AlquimistaRaza", name: "Alquimista Raza" },
        { id: "StorageNPC", name: "Guardador de Baú" },
        { id: "KingAurelius", name: "Rei Aurelius II" },
        { id: "GrandMageKael", name: "Arcanista Kael" },
        { id: "CommanderVane", name: "Comandante Vane" },
        { id: "CapitalStorage", name: "Storage Central" },
        { id: "CapitalMerchant", name: "Comerciante Imperial" }
      ] } : {};
      
      const npc = mapDef.npcs ? mapDef.npcs.find(n => n.id === id) : null;
      if (npc) {
        // Solicita ao servidor as quests disponíveis e abre diálogo
        this.socket.emit('npc_interact', { npcId: id, action: 'quest_list' });
        this.ui.showNPCDialog(id, npc, this.player.quests, this.itemsDef);
      }
    }
  }

  // --- LOOP LOCAL DE ENVIAR MOVIMENTO DO CLIENTE (WASD CONTROLLER) ---
  sendLocalMovement() {
    if (!this.player || this.player.hp <= 0) return;

    let moveX = 0;
    let moveZ = 0;

    if (this.keys.w) { moveX += Math.sin(this.renderer.cameraYaw); moveZ += Math.cos(this.renderer.cameraYaw); }
    if (this.keys.s) { moveX -= Math.sin(this.renderer.cameraYaw); moveZ -= Math.cos(this.renderer.cameraYaw); }
    if (this.keys.a) { moveX += Math.sin(this.renderer.cameraYaw + Math.PI/2); moveZ += Math.cos(this.renderer.cameraYaw + Math.PI/2); }
    if (this.keys.d) { moveX -= Math.sin(this.renderer.cameraYaw + Math.PI/2); moveZ -= Math.cos(this.renderer.cameraYaw + Math.PI/2); }

    const speedBuffer = this.keys.Shift ? 1.6 : 1.0;
    const baseSpeed = (this.player.derived.movementSpeed / 10) * 0.05 * speedBuffer; // 50ms tick rate

    if (moveX !== 0 || moveZ !== 0) {
      // Normaliza
      const len = Math.sqrt(moveX*moveX + moveZ*moveZ);
      const angle = Math.atan2(moveX, moveZ);

      this.player.x += (moveX / len) * baseSpeed;
      this.player.z += (moveZ / len) * baseSpeed;
      this.player.r = angle;

      // Movimenta o próprio mesh localmente para feedback sem latência
      const localMesh = this.renderer.meshes[this.player.charId];
      if (localMesh) {
        localMesh.position.set(this.player.x, this.player.y, this.player.z);
        localMesh.rotation.y = angle;
      }

      // Envia ao servidor
      this.socket.emit('player_move', {
        x: this.player.x,
        y: this.player.y,
        z: this.player.z,
        r: angle
      });

      // Atualiza coordenadas no HUD
      document.getElementById('hud-coord-x').innerText = Math.round(this.player.x);
      document.getElementById('hud-coord-z').innerText = Math.round(this.player.z);
    }
  }

  // Interpolação linear suave (LERP) de Entidades para evitar trepidações a 60 FPS
  runCameraTracking() {
    const trackingLoop = () => {
      requestAnimationFrame(trackingLoop);

      // 1. Interpola monstros e outros players ativos no mapa
      const lerpFactor = 0.2; // taxa de suavidade
      
      for (let id in this.targetPositions) {
        const target = this.targetPositions[id];
        const mesh = this.renderer.meshes[id];

        if (mesh) {
          // LERP de posição
          mesh.position.x += (target.x - mesh.position.x) * lerpFactor;
          mesh.position.z += (target.z - mesh.position.z) * lerpFactor;
          
          // Suaviza ângulo de rotação em radianos
          let diff = target.r - mesh.rotation.y;
          // Normaliza diferença em [-PI, PI]
          diff = Math.atan2(Math.sin(diff), Math.cos(diff));
          mesh.rotation.y += diff * lerpFactor;

          // Salva posições locais estimadas para outros cálculos
          if (this.mobs[id]) {
            this.mobs[id].x = mesh.position.x;
            this.mobs[id].z = mesh.position.z;
          } else if (this.otherPlayers[id]) {
            this.otherPlayers[id].x = mesh.position.x;
            this.otherPlayers[id].z = mesh.position.z;
          }
        }
      }

      // 2. Câmera segue o jogador local de forma suave
      if (this.player && this.renderer.meshes[this.player.charId]) {
        const pMesh = this.renderer.meshes[this.player.charId];
        this.renderer.updateCamera(pMesh.position);
      }
    };

    trackingLoop();
  }

  // --- CONTROLES DE HUD ATUALIZAÇÕES ---

  updateHUDProfile() {
    if (!this.player) return;

    document.getElementById('hud-char-name').innerText = this.player.name;
    document.getElementById('hud-char-class').innerText = this.player.class;
    document.getElementById('hud-char-level').innerText = this.player.level;
    document.getElementById('hud-gold').innerText = this.player.gold;

    // HP Bar
    const hpPct = Math.max(0, Math.min(100, (this.player.hp / this.player.derived.maxHp) * 100));
    document.getElementById('hud-hp-fill').style.width = `${hpPct}%`;
    document.getElementById('hud-hp-current').innerText = Math.round(this.player.hp);
    document.getElementById('hud-hp-max').innerText = Math.round(this.player.derived.maxHp);

    // MP Bar
    const mpPct = Math.max(0, Math.min(100, (this.player.mp / this.player.derived.maxMp) * 100));
    document.getElementById('hud-mp-fill').style.width = `${mpPct}%`;
    document.getElementById('hud-mp-current').innerText = Math.round(this.player.mp);
    document.getElementById('hud-mp-max').innerText = Math.round(this.player.derived.maxMp);

    // XP Bar (Curva progressiva)
    const nextLvlXp = window.XP_LEVELS_FALLBACK[this.player.level - 1] || 1000000;
    const xpPct = Math.max(0, Math.min(100, (this.player.xp / nextLvlXp) * 100));
    document.getElementById('hud-xp-fill').style.width = `${xpPct}%`;
    document.getElementById('hud-xp-percent').innerText = Math.round(xpPct);
  }

  updateTargetUI(mob) {
    const panel = document.getElementById('hud-target-panel');
    if (mob.hp <= 0) {
      panel.classList.add('hide');
      return;
    }

    panel.classList.remove('hide');
    document.getElementById('hud-target-name').innerText = mob.name;
    document.getElementById('hud-target-level').innerText = `Nv ${mob.level}`;
    document.getElementById('hud-target-element').innerText = mob.element;

    const hpPct = Math.max(0, Math.min(100, (mob.hp / mob.maxHp) * 100));
    document.getElementById('hud-target-hp-fill').style.width = `${hpPct}%`;
    document.getElementById('hud-target-hp-percent').innerText = Math.round(hpPct);
  }

  // Preenche dados na janela de atributos do jogador
  updateStatsWindow() {
    const s = this.player.stats;
    const d = this.player.derived;

    document.getElementById('stat-avail-points').innerText = s.stat_points;
    document.getElementById('stat-val-str').innerText = s.str;
    document.getElementById('stat-val-vit').innerText = s.vit;
    document.getElementById('stat-val-agi').innerText = s.agi;
    document.getElementById('stat-val-dex').innerText = s.dex;
    document.getElementById('stat-val-int').innerText = s.int;
    document.getElementById('stat-val-spr').innerText = s.spr;
    document.getElementById('stat-val-luk').innerText = s.luk;

    document.getElementById('stat-der-patk').innerText = Math.round(d.physicalAttack);
    document.getElementById('stat-der-matk').innerText = Math.round(d.magicAttack);
    document.getElementById('stat-der-pdef').innerText = Math.round(d.physicalDefense);
    document.getElementById('stat-der-mdef').innerText = Math.round(d.magicDefense);
    document.getElementById('stat-der-crit').innerText = `${Math.round(d.criticalChance)}%`;
    document.getElementById('stat-der-dodge').innerText = `${Math.round(d.dodge)}%`;
  }

  // Carrega e desenha estado visual do novo mapa
  loadMapState(mapId) {
    const mapDef = window.MAPS_DEFINITION_FALLBACK[mapId];
    if (!mapDef) return;

    // Atualiza nome do mapa no HUD
    document.getElementById('hud-map-name').innerText = mapDef.name;

    // Gera o terreno procedural low-poly do renderizador
    this.renderer.generateTerrain(mapId, mapDef.biome);

    // Spawna meu próprio herói local na cena 3D
    const myMesh = this.renderer.createPlayerMesh(this.player, this.player.charId);
    myMesh.position.set(this.player.x, this.player.y, this.player.z);

    // Spawna os portais existentes do mapa
    if (mapDef.portals) {
      for (let portal of mapDef.portals) {
        this.renderer.createPortalMesh(portal, 'portal_' + portal.id);
      }
    }

    // Spawna os NPCs estáticos do mapa
    if (mapDef.npcs) {
      for (let npc of mapDef.npcs) {
        // Usa shapes procedurais para os npcs
        const group = new THREE.Group();
        group.position.set(npc.x, npc.y, npc.z);
        
        let clothColor = 0xb0bec5;
        if (npc.id === 'HealerLuna') clothColor = 0xffffff; // branca
        else if (npc.id === 'FerreiroGrom') clothColor = 0x4e342e; // cinza escuro ferro
        else if (npc.id === 'MentorEldrin') clothColor = 0xbf360c; // marrom sábio

        const bodyGeo = new THREE.CylinderGeometry(0.4, 0.2, 1.8, 8);
        const bodyMat = new THREE.MeshStandardMaterial({ color: clothColor, flatShading: true });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.9;
        group.add(body);

        const headGeo = new THREE.SphereGeometry(0.4, 8, 8);
        const headMat = new THREE.MeshStandardMaterial({ color: 0xffd1a9, flatShading: true });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 1.9;
        group.add(head);

        // Se for o blacksmith Grom, adiciona um martelo na mão!
        if (npc.id === 'FerreiroGrom') {
          const hammer = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.6), new THREE.MeshStandardMaterial({ color: 0x212121 }));
          hammer.position.set(0.6, 1.0, 0.2);
          group.add(hammer);
        }

        this.renderer.scene.add(group);
        this.renderer.meshes[npc.id] = group;
      }
    }
  }

  // Helper para Texto de Combate Flutuante (Dano / Cura)
  createFloatingText(pos3D, value, isCrit, isHeal) {
    const coords2D = this.renderer.project3DTo2D(pos3D);
    if (!coords2D.visible) return;

    const el = document.createElement('div');
    el.className = isHeal ? 'floating-heal' : `floating-damage ${isCrit ? 'crit' : ''}`;
    el.style.left = `${coords2D.x}px`;
    el.style.top = `${coords2D.y}px`;
    el.innerText = isHeal ? `+${value}` : (value === 0 ? "Miss" : value);
    
    document.body.appendChild(el);

    // Fade out e remove do DOM
    setTimeout(() => el.remove(), 1200);
  }
}

// ====================================================================================================
// --- CONFIGURAÇÃO DE DEFINIÇÕES DE BACKUP NO FRONTEND (CRITÉRIO OFFLINE-READY PARA CLIENTE ESTÁVEL) ---
// Evita dependência direta de endpoints lentos durante renderizações iniciais das janelas.
// ====================================================================================================

window.ITEMS_DEFINITION_FALLBACK = {
  RedPotion: { name: "Poção Vermelha", rarity: "Common", price: 15 },
  OrangePotion: { name: "Poção Laranja", rarity: "Uncommon", price: 40 },
  BluePotion: { name: "Poção Azul", rarity: "Uncommon", price: 60 },
  ElixirOfEter: { name: "Elixir de Éter", rarity: "Rare", price: 200 },
  NoviceSword: { name: "Espada do Noviço", rarity: "Common", price: 100 },
  NoviceDagger: { name: "Adaga do Noviço", rarity: "Common", price: 80 },
  NoviceStaff: { name: "Cajado do Noviço", rarity: "Common", price: 120 },
  NoviceBow: { name: "Arco do Noviço", rarity: "Common", price: 110 },
  WoodenShield: { name: "Escudo de Madeira", rarity: "Common", price: 80 },
  GuardianAegis: { name: "Égide do Guardião", rarity: "Rare", price: 1200 },
  AetherSlasher: { name: "Retalhadora de Éter", rarity: "Rare", price: 1500 },
  WindrunnerBow: { name: "Arco Corta-Vento", rarity: "Rare", price: 1600 },
  SageSpireStaff: { name: "Cajado do Pináculo Sábio", rarity: "Rare", price: 1800 },
  DarkVenomDagger: { name: "Adaga do Veneno Negro", rarity: "Rare", price: 1400 },
  AetherCrown: { name: "Coroa de Éter", rarity: "Rare", price: 1000 },
  TravelersCape: { name: "Capa do Viajante", rarity: "Common", price: 60 },
  SwiftFeetBoots: { name: "Botas de Pés Velozes", rarity: "Uncommon", price: 180 }
};

window.SKILLS_DEFINITION_FALLBACK = {
  BasicStrike: { name: "Golpe Básico", description: "Ataque corporal básico físico", mpCost: 0, range: 2.5 },
  DoubleAttack: { name: "Ataque Duplo", description: "Desfere dois golpes rápidos (180% dano)", mpCost: 10, range: 2.5 },
  ShieldBash: { name: "Escudada", description: "Atordoa o alvo e causa dano físico", mpCost: 12, range: 2.5 },
  IronWill: { name: "Vontade de Ferro", description: "Aumenta defesas por 15 segundos", mpCost: 20, range: 0 },
  ArrowShot: { name: "Disparo Preciso", description: "Disparo de flecha preciso à distância", mpCost: 8, range: 15 },
  DoubleStrafe: { name: "Rajada de Flechas", description: "Saraivada rápida de duas flechas", mpCost: 18, range: 15 },
  Firebolt: { name: "Lança de Fogo", description: "Conjura um dardo flamejante mágico", mpCost: 15, range: 12 },
  IceSpike: { name: "Espinho de Gelo", description: "Dano de água e lentidão no alvo", mpCost: 14, range: 12 },
  Heal: { name: "Cura Sagrada", description: "Restaura pontos de vida (HP)", mpCost: 15, range: 10 },
  Blessing: { name: "Bênção Divina", description: "Aumenta atributos do alvo", mpCost: 20, range: 10 },
  PoisonStab: { name: "Punhalada Venenosa", description: "Afaquia o alvo aplicando veneno", mpCost: 10, range: 2.5 }
};

window.CLASSES_DEFINITION_FALLBACK = {
  Adventurer: { name: "Adventurer", skills: ["BasicStrike", "DoubleAttack"] },
  Vanguard: { name: "Vanguard", skills: ["ShieldBash", "IronWill"] },
  Ranger: { name: "Ranger", skills: ["ArrowShot", "DoubleStrafe"] },
  Arcanist: { name: "Arcanist", skills: ["Firebolt", "IceSpike"] },
  Acolyte: { name: "Acolyte", skills: ["Heal", "Blessing"] },
  Shadowblade: { name: "Shadowblade", skills: ["PoisonStab"] }
};

window.QUESTS_DEFINITION_FALLBACK = {
  Q1: { name: "Primeiros Passos em Aetheria", steps: [{ type: "talk", target: "Mentor Eldrin" }] },
  Q2: { name: "Armando o Aventureiro", steps: [{ type: "talk", target: "Ferreiro Grom" }] },
  Q3: { name: "Seu Primeiro Combate", steps: [{ type: "kill", count: 3 }] },
  Q4: { name: "Coletando Suprimentos", steps: [{ type: "collect", count: 2 }] },
  Q5: { name: "A Sacerdotisa Luna", steps: [{ type: "talk", target: "Sacerdotisa Luna" }] },
  Q9: { name: "Ascendendo sua Vocação", steps: [{ type: "talk", target: "Mentor Eldrin" }] }
};

window.MAPS_DEFINITION_FALLBACK = {
  Town: { name: "Aetheria Town", biome: "Meadows", portals: [{ id: "Town_to_Fields", x: 45, y: 0.5, z: 0, targetMap: "Fields", targetX: -40, targetY: 0.5, targetZ: 0 }], npcs: [{ id: "MentorEldrin", name: "Mentor Eldrin", x: -5, y: 0.5, z: 5 }, { id: "HealerLuna", name: "Sacerdotisa Luna", x: 8, y: 0.5, z: 3 }, { id: "FerreiroGrom", name: "Ferreiro Grom", x: -8, y: 0.5, z: -8 }, { id: "AlquimistaRaza", name: "Alquimista Raza", x: 5, y: 0.5, z: -6 }] },
  Fields: { name: "Campos de Treinamento", biome: "Plains", portals: [{ id: "Fields_to_Town", x: -45, y: 0.5, z: 0, targetMap: "Town", targetX: 40, targetY: 0.5, targetZ: 0 }, { id: "Fields_to_Forest", x: 0, y: 0.5, z: 45, targetMap: "Forest", targetX: 0, targetY: 0.5, targetZ: -40 }] },
  Forest: { name: "Floresta de Éter", biome: "Forest", portals: [{ id: "Forest_to_Fields", x: 0, y: 0.5, z: -45, targetMap: "Fields", targetX: 0, targetY: 0.5, targetZ: 40 }, { id: "Forest_to_Cave", x: 45, y: 0.5, z: 45, targetMap: "Cave", targetX: -40, targetY: 0.5, targetZ: -40 }, { id: "Forest_to_Capital", x: -45, y: 0.5, z: 0, targetMap: "Capital", targetX: 40, targetY: 0.5, targetZ: 0 }] },
  Cave: { name: "Cavernas de Cristal", biome: "Cave", portals: [{ id: "Cave_to_Forest", x: -45, y: 0.5, z: -45, targetMap: "Forest", targetX: 40, targetY: 0.5, targetZ: 40 }] },
  Capital: { name: "Cidade Capital Aetheris", biome: "City", portals: [{ id: "Capital_to_Forest", x: 45, y: 0.5, z: 0, targetMap: "Forest", targetX: -40, targetY: 0.5, targetZ: 0 }, { id: "Capital_to_Arena", x: -45, y: 0.5, z: -45, targetMap: "Arena", targetX: 0, targetY: 0.5, targetZ: -40 }, { id: "Capital_to_Dungeon", x: 0, y: 0.5, z: -45, targetMap: "Dungeon", targetX: 0, targetY: 0.5, targetZ: -40 }], npcs: [{ id: "KingAurelius", name: "Rei Aurelius II", x: 0, y: 1.5, z: 40 }, { id: "GrandMageKael", name: "Arcanista Kael", x: -25, y: 0.5, z: 15 }, { id: "CommanderVane", name: "Comandante Vane", x: 25, y: 0.5, z: 15 }] },
  Dungeon: { name: "Dungeon Ruínas Sagradas", biome: "Ruins", portals: [{ id: "Dungeon_to_Capital", x: 0, y: 0.5, z: -45, targetMap: "Capital", targetX: 0, targetY: 0.5, targetZ: 40 }] },
  Arena: { name: "Arena PvP", biome: "Arena", portals: [{ id: "Arena_to_Capital", x: 0, y: 0.5, z: -35, targetMap: "Capital", targetX: -40, targetY: 0.5, targetZ: -40 }] }
};

window.XP_LEVELS_FALLBACK = Array.from({ length: 100 }, (_, i) => {
  const lvl = i + 1;
  if (lvl === 1) return 100;
  return Math.round(100 * Math.pow(lvl, 1.8));
});

// Instancia Cliente ao terminar de carregar o script
window.addEventListener('load', () => {
  window.gameClient = new GameClient();
});
