// Chronicles of Aetheria - Gerenciador de Interface UI e Áudio Procedural
// Controla inventários, equipamentos, lojas, quests, chats, distribuição de pontos e efeitos sonoros com Web Audio API.

class GameUI {
  constructor() {
    this.activeWindows = {};
    this.currentNPC = null;
    this.currentChannel = 'local';
    
    // Inicializa sintetizador de Áudio Web
    this.audioCtx = null;

    this.bindEvents();
    this.initInventoryGrid();
  }

  // Ativa Contexto de Áudio de forma segura após interação do usuário
  initAudio() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  // --- EFEITOS SONOROS SINTETIZADOS EM REAL TIME (WEB AUDIO API) ---
  playSfx(type) {
    this.initAudio();
    if (!this.audioCtx || this.audioCtx.state === 'suspended') return;

    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      const now = this.audioCtx.currentTime;

      if (type === 'hit') {
        // Impacto físico curto
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(10, now + 0.15);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
      } 
      else if (type === 'cast') {
        // Sweep de feitiço mágico
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.35);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } 
      else if (type === 'loot') {
        // Brilho de moeda (Chink!)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(987.77, now); // B5 note
        osc.frequency.setValueAtTime(1318.51, now + 0.08); // E6 note
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      } 
      else if (type === 'level_up') {
        // Acorde arpejo alegre triunfante
        const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
        notes.forEach((freq, idx) => {
          const o = this.audioCtx.createOscillator();
          const g = this.audioCtx.createGain();
          o.connect(g);
          g.connect(this.audioCtx.destination);
          o.type = 'triangle';
          o.frequency.setValueAtTime(freq, now + idx * 0.1);
          g.gain.setValueAtTime(0.15, now + idx * 0.1);
          g.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.1 + 0.4);
          o.start(now + idx * 0.1);
          o.stop(now + idx * 0.1 + 0.4);
        });
      } 
      else if (type === 'death') {
        // Queda grave de perda de força
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.5);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
      }
    } catch (e) {
      console.warn("Falha ao tocar som procedural:", e);
    }
  }

  // --- GERENCIAMENTO DE JANELAS HUD ---
  bindEvents() {
    // Teclado Atalhos Globais
    document.addEventListener('keydown', (e) => {
      // Se estiver digitando no chat, não dispara atalhos de janelas
      if (document.activeElement.id === 'chat-input') return;

      const key = e.key.toLowerCase();
      if (key === 'c') this.toggleWindow('win-stats');
      else if (key === 'i') this.toggleWindow('win-inventory');
      else if (key === 'k') this.toggleWindow('win-skills');
      else if (key === 'q') this.toggleWindow('win-quests');
      else if (key === 'escape') {
        // Fecha a janela do topo, ou abre menu de ajuda
        const openWins = Object.keys(this.activeWindows).filter(k => this.activeWindows[key]);
        if (openWins.length > 0) {
          this.closeWindow(openWins[openWins.length - 1]);
        } else {
          this.toggleWindow('win-help');
        }
      }
    });

    // Cliques em fechar janelas (&times;)
    document.querySelectorAll('.close-win').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const win = e.target.closest('.window');
        if (win) this.closeWindow(win.id);
      });
    });

    // Cliques em Botões do Menu Inferior
    document.getElementById('btn-toggle-stats').onclick = () => this.toggleWindow('win-stats');
    document.getElementById('btn-toggle-inv').onclick = () => this.toggleWindow('win-inventory');
    document.getElementById('btn-toggle-skills').onclick = () => this.toggleWindow('win-skills');
    document.getElementById('btn-toggle-help').onclick = () => this.toggleWindow('win-help');
    
    // Tabs do Chat
    document.querySelectorAll('.chat-tab-btn').forEach(btn => {
      btn.onclick = (e) => {
        document.querySelectorAll('.chat-tab-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.currentChannel = e.target.dataset.channel;
      };
    });
  }

  toggleWindow(id) {
    this.initAudio();
    const win = document.getElementById(id);
    if (!win) return;

    if (win.classList.contains('hide')) {
      win.classList.remove('hide');
      this.activeWindows[id] = true;
      // Posiciona de forma encadeada levemente defasada
      const offset = Object.keys(this.activeWindows).filter(k => this.activeWindows[k]).length * 15;
      win.style.left = `${80 + offset}px`;
      win.style.top = `${150 + offset}px`;
    } else {
      this.closeWindow(id);
    }
  }

  closeWindow(id) {
    const win = document.getElementById(id);
    if (win) {
      win.classList.add('hide');
      this.activeWindows[id] = false;
    }
  }

  // Inicializa visual estático dos 30 slots do inventário
  initInventoryGrid() {
    const container = document.getElementById('inventory-grid-slots');
    container.innerHTML = '';
    
    for (let i = 0; i < 30; i++) {
      const slot = document.createElement('div');
      slot.className = 'inv-slot Common';
      slot.dataset.slot = i;
      slot.innerHTML = `<span class="icon"></span>`;
      container.appendChild(slot);
    }
  }

  // --- ATUALIZAÇÕES DA INTERFACE DINÂMICA (DADOS DO SERVIDOR) ---

  // 1. Atualizar Inventário e Equipamentos
  updateInventoryUI(items, itemsDef) {
    // Reseta todos os slots locais primeiro
    const slots = document.querySelectorAll('.inv-slot');
    slots.forEach(slot => {
      slot.className = 'inv-slot Common';
      slot.querySelector('.icon').innerText = '';
      const qty = slot.querySelector('.qty');
      if (qty) qty.remove();
    });

    let potQty = 0;

    // Popula com itens atuais
    for (let itemRow of items) {
      const slotElement = document.querySelector(`.inv-slot[data-slot="${itemRow.slot}"]`);
      if (!slotElement) continue;

      const itemDef = itemsDef[itemRow.item_id];
      if (!itemDef) continue;

      let icon = '📦';
      if (itemRow.item_id.includes('Potion')) icon = '🧪';
      else if (itemRow.item_id.includes('Sword')) icon = '⚔️';
      else if (itemRow.item_id.includes('Dagger')) icon = '🗡️';
      else if (itemRow.item_id.includes('Bow')) icon = '🏹';
      else if (itemRow.item_id.includes('Staff')) icon = '🔮';
      else if (itemRow.item_id.includes('Shield')) icon = '🛡️';
      else if (itemRow.item_id.includes('Robe') || itemRow.item_id.includes('Plate') || itemRow.item_id.includes('Garb') || itemRow.item_id.includes('Tunic')) icon = '👕';
      else if (itemRow.item_id.includes('Boots')) icon = '🥾';
      else if (itemRow.item_id.includes('Ring')) icon = '💍';
      else if (itemRow.item_id.includes('Crown') || itemRow.item_id.includes('Hat')) icon = '👑';
      else if (itemRow.item_id.includes('Cape')) icon = '🧣';
      else if (itemRow.item_id.includes('Web')) icon = '🕸️';
      else if (itemRow.item_id.includes('Core')) icon = '🧿';
      else if (itemRow.item_id.includes('Pelt')) icon = '🐻';
      else if (itemRow.item_id.includes('Shard') || itemRow.item_id.includes('Ore')) icon = '💎';
      else if (itemRow.item_id.includes('Bark')) icon = '🪵';
      else if (itemRow.item_id.includes('Token')) icon = '🏅';
      else if (itemRow.item_id.includes('Letter')) icon = '✉️';

      // Estiliza slot com raridade do item
      slotElement.className = `inv-slot ${itemRow.rarity || 'Common'}`;
      if (itemRow.is_equipped) slotElement.classList.add('equipped');

      slotElement.querySelector('.icon').innerText = icon;

      // Adiciona contagem empilhada
      if (itemRow.quantity > 1) {
        const qtySpan = document.createElement('span');
        qtySpan.className = 'qty';
        qtySpan.innerText = itemRow.quantity;
        slotElement.appendChild(qtySpan);
      }

      // Atalho Hotbar de Poções Vermelhas se houver
      if (itemRow.item_id === 'RedPotion') {
        potQty += itemRow.quantity;
      }
    }

    document.getElementById('hotbar-pot-qty').innerText = potQty;
  }

  // Sincroniza slots de equipamentos equipados na janela de personagem
  updateEquipmentUI(equipment, itemsDef) {
    const cols = ['head', 'body', 'main_hand', 'off_hand', 'feet', 'cape', 'accessory1'];
    
    for (let col of cols) {
      const el = document.getElementById(`eq-${col}`);
      if (!el) continue;

      const itemId = equipment ? equipment[col] : null;
      if (itemId && itemsDef[itemId]) {
        el.innerText = `${el.dataset.col.toUpperCase()}: ${itemsDef[itemId].name}`;
        el.style.color = '#ffd700';
      } else {
        el.innerText = `${col.toUpperCase()}: Nenhum`;
        el.style.color = '#8892b0';
      }
    }
  }

  // 2. Diálogo de NPC e Loja Comerciante
  showNPCDialog(npcId, npcDef, mapQuests, itemsDef) {
    this.currentNPC = npcId;
    
    document.getElementById('npc-dialog-name').innerText = npcDef.name;
    let descText = "Olá, viajante de Éter! Em que posso lhe ajudar hoje?";
    
    if (npcId === 'MentorEldrin') descText = "Olá, herói! Os Veios de Éter estão pulsando e fendas escuras se abrem. Precisamos de sua força para reestabilizar Aetheria. Você está pronto?";
    else if (npcId === 'HealerLuna') descText = "Aproxime-se, alma ferida. Sinta a luz sagrada fluir pelo seu corpo para restaurar suas energias vitais de combate.";
    else if (npcId === 'FerreiroGrom') descText = "Ferro antigo e ligas de éter! Eu forjo as melhores armas deste vilarejo. Dê uma olhada no meu estoque de ponta.";
    else if (npcId === 'AlquimistaRaza') descText = "Cuidado com esses vidros instáveis! Minhas poções de éter podem salvar sua vida nos campos externos. Compre algumas.";

    document.getElementById('npc-dialog-text').innerText = descText;

    // Reseta áreas opcionais
    document.getElementById('npc-quests-area').classList.add('hide');
    document.getElementById('npc-shop-area').classList.add('hide');
    document.getElementById('npc-class-area').classList.add('hide');

    if (npcDef.type === 'quest') {
      document.getElementById('npc-quests-area').classList.remove('hide');
    } 
    else if (npcDef.type === 'merchant') {
      document.getElementById('npc-shop-area').classList.remove('hide');
      this.populateShopItems(npcId, itemsDef);
    }
    else if (npcDef.type === 'class_master') {
      document.getElementById('npc-class-area').classList.remove('hide');
    }

    this.toggleWindow('win-npc-dialog');
  }

  // Popula itens de compra da loja comerciante
  populateShopItems(npcId, itemsDef) {
    const grid = document.getElementById('npc-shop-items-grid');
    grid.innerHTML = '';

    // Itens que cada comerciante vende
    let sellableIds = ['RedPotion', 'BluePotion'];
    if (npcId === 'FerreiroGrom') {
      sellableIds = ['NoviceSword', 'NoviceDagger', 'NoviceBow', 'NoviceStaff', 'WoodenShield'];
    } else if (npcId === 'AlquimistaRaza') {
      sellableIds = ['RedPotion', 'OrangePotion', 'BluePotion', 'ElixirOfEter'];
    }

    for (let itemId of sellableIds) {
      const item = itemsDef[itemId];
      if (!item) continue;

      const btn = document.createElement('button');
      btn.className = 'shop-item-btn';
      btn.dataset.item = itemId;
      btn.innerHTML = `
        <span class="icon">🎁</span>
        <div>
          <span class="name">${item.name}</span>
          <span class="price">💰 ${item.price} G</span>
        </div>
      `;
      grid.appendChild(btn);
    }
  }

  // Renders a list of available quests for the dialogue window
  updateNPCQuestsList(available, active) {
    const availContainer = document.getElementById('npc-quests-avail-list');
    availContainer.innerHTML = '';
    if (available.length === 0) {
      availContainer.innerHTML = '<p class="empty-quests">Nenhuma nova missão aqui.</p>';
    } else {
      for (let q of available) {
        availContainer.innerHTML += `
          <button class="quest-dialog-btn" data-action="quest_accept" data-quest="${q.id}">
            ⭐ Aceitar: <b>${q.name}</b><br><small>${q.desc}</small>
          </button>
        `;
      }
    }

    const activeContainer = document.getElementById('npc-quests-active-list');
    activeContainer.innerHTML = '';
    if (active.length === 0) {
      activeContainer.innerHTML = '<p class="empty-quests">Nenhuma missão ativa em andamento com este NPC.</p>';
    } else {
      for (let q of active) {
        // Verifica se a quest já está pronta para completar (se for do tipo talk ou abate concluído)
        let canComplete = false;
        let progressText = "";

        if (q.step.type === 'talk') {
          canComplete = true;
          progressText = "Pronto para conversar e entregar.";
        } else {
          progressText = `Progresso: ${q.progress}/${q.step.count}`;
          if (q.progress >= q.step.count) {
            canComplete = true;
            progressText = `Concluído! ${progressText}`;
          }
        }

        activeContainer.innerHTML += `
          <button class="quest-dialog-btn ${canComplete ? 'complete' : ''}" data-action="quest_complete" data-quest="${q.id}" ${!canComplete ? 'disabled' : ''}>
            ${canComplete ? '✔️ Concluir:' : '⏳ Pendente:'} <b>${q.name}</b><br>
            <small>${progressText}</small>
          </button>
        `;
      }
    }
  }

  // Renders active quest list directly onto the Right Tracker HUD overlay
  updateQuestTracker(quests, questsDef) {
    const list = document.getElementById('quest-tracker-list');
    list.innerHTML = '';

    const activeQuests = quests.filter(q => q.status === 'accepted');

    if (activeQuests.length === 0) {
      list.innerHTML = '<p class="empty-quests">Nenhuma missão ativa. Fale com o Mentor Eldrin!</p>';
      return;
    }

    for (let activeQ of activeQuests) {
      const qDef = questsDef[activeQ.quest_id];
      if (!qDef) continue;

      const step = qDef.steps[0];
      let pText = "";
      let isComplete = false;

      if (step.type === 'talk') {
        pText = `Fale com ${step.target}`;
        isComplete = true;
      } else if (step.type === 'kill') {
        pText = `Abater ${activeQ.progress}/${step.count} monstros`;
        isComplete = activeQ.progress >= step.count;
      } else if (step.type === 'collect') {
        pText = `Coletar ${activeQ.progress}/${step.count} itens`;
        isComplete = activeQ.progress >= step.count;
      }

      list.innerHTML += `
        <div class="quest-track-item ${isComplete ? 'complete' : ''}">
          <h5>${qDef.name}</h5>
          <p>${pText}</p>
        </div>
      `;
    }
  }

  // 3. Atualizar Janela de Habilidades (Skills Tree)
  updateSkillsTreeUI(classType, skillPoints, skillsDef, classesDef) {
    document.getElementById('skill-avail-points').innerText = skillPoints;
    const container = document.getElementById('skills-tree-list');
    container.innerHTML = '';

    const cls = classesDef[classType];
    if (!cls || !cls.skills) return;

    for (let skillId of cls.skills) {
      const skill = skillsDef[skillId];
      if (!skill) continue;

      const card = document.createElement('div');
      card.className = 'skill-list-item';
      card.innerHTML = `
        <div class="skill-icon">🔮</div>
        <div class="skill-info">
          <h5>${skill.name}</h5>
          <p>${skill.description}</p>
          <p><small>Custo: ${skill.mpCost} MP | Alcance: ${skill.range}m</small></p>
        </div>
        <button class="btn-cast-skill-win" data-skill="${skillId}">Conjurar</button>
      `;
      container.appendChild(card);
    }
  }

  // 4. Adiciona Linha no Chat Log com filtros
  appendChatLine(sender, text, channel, timestamp) {
    const box = document.getElementById('chat-log-box');
    const timeStr = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    let lineClass = 'local';
    if (channel === 'system') lineClass = 'sys';
    else if (channel === 'global') lineClass = 'global';
    
    const line = document.createElement('div');
    line.className = `chat-line ${lineClass}`;
    
    if (sender) {
      line.innerHTML = `<span class="time">[${timeStr}]</span> <span class="sender">${sender}:</span> ${text}`;
    } else {
      line.innerHTML = `<span class="time">[${timeStr}]</span> ${text}`;
    }

    box.appendChild(line);
    // Rola para o fim
    box.scrollTop = box.scrollHeight;
  }
}
