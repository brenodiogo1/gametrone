// Chronicles of Aetheria - Motor de Jogo do Servidor (Multiplayer Autoritativo)
// Gerencia conexões, sincronização de movimentação com anticheat, combate em tempo real,
// IA de monstros, tabelas de loot, quests, comércio atômico, grupos, chat seguro e logs.

const { query, transaction } = require('./db');
const { GAME_NAME, CLASSES, SKILLS, ITEMS, MONSTERS, MAPS, QUESTS, XP_LEVELS, calculateDerivedStats } = require('./game_data');

class GameEngine {
  constructor(io) {
    this.io = io;
    this.players = {}; // socketId -> PlayerInstance
    this.monsters = {}; // mapId -> Array of Monsters
    this.loot = {}; // mapId -> Array of Loot drops
    this.parties = {}; // partyId -> { id, leader, members: [charId], name }
    this.guilds = {}; // guildId -> Cache de guildas

    this.tickRate = 10; // 10 ticks por segundo para IA e Física
    this.saveInterval = 30000; // Salvar persistência a cada 30 segundos
    this.regenInterval = 3000; // Regeneração a cada 3 segundos

    this.initWorld();
    this.startLoops();
  }

  // Inicializa mapas, popula monstros e tabelas
  initWorld() {
    console.log("Inicializando monstros e spawns no mundo...");
    for (let mapId in MAPS) {
      this.monsters[mapId] = [];
      this.loot[mapId] = [];
      
      const mapDef = MAPS[mapId];
      if (mapDef.spawns) {
        for (let spawnDef of mapDef.spawns) {
          const mDef = MONSTERS[spawnDef.id];
          if (!mDef) continue;

          for (let i = 0; i < spawnDef.count; i++) {
            this.spawnMonster(mapId, spawnDef.id);
          }
        }
      }
    }
  }

  // Gera uma criatura
  spawnMonster(mapId, monsterId, customX = null, customZ = null) {
    const mDef = MONSTERS[monsterId];
    if (!mDef) return null;

    const mapDef = MAPS[mapId];
    // Posição de nascimento aleatória no plano do mapa
    const halfW = (mapDef.dimensions.width / 2) - 10;
    const halfL = (mapDef.dimensions.length / 2) - 10;
    const x = customX !== null ? customX : (Math.random() * halfW * 2 - halfW);
    const z = customZ !== null ? customZ : (Math.random() * halfL * 2 - halfL);
    const y = 0.5;

    const instanceId = 'mob_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);

    const newMob = {
      id: instanceId,
      definitionId: monsterId,
      name: mDef.name,
      level: mDef.level,
      hp: mDef.hp,
      maxHp: mDef.maxHp,
      element: mDef.element,
      behavior: mDef.behavior,
      xp: mDef.xp,
      gold: mDef.gold,
      size: mDef.size,
      color: mDef.color,
      drops: mDef.drops,

      // Posição e IA
      spawnX: x,
      spawnZ: z,
      x: x,
      y: y,
      z: z,
      r: Math.random() * Math.PI * 2,
      targetId: null, // Alvo de combate
      state: 'idle', // idle, patrol, chase, attack, return, dead
      lastActionTime: 0,
      aggroTable: {}, // charId -> total damage
      speed: 4, // velocidade de perseguição
      respawnTime: Date.now() + 10000 // Usado se morto
    };

    this.monsters[mapId].push(newMob);
    return newMob;
  }

  // Loops principais do Servidor
  startLoops() {
    // Tick de IA e sincronização (100ms)
    setInterval(() => {
      this.updateAI();
      this.broadcastWorldState();
    }, 1000 / this.tickRate);

    // Loop de Regeneração (3s)
    setInterval(() => {
      this.processRegeneration();
    }, this.regenInterval);

    // Loop de Persistência em Massa (30s)
    setInterval(() => {
      this.saveAllPlayers();
    }, this.saveInterval);
  }

  // IA dos Monstros
  updateAI() {
    const now = Date.now();
    for (let mapId in MAPS) {
      const activePlayers = Object.values(this.players).filter(p => p.map === mapId);
      const mobs = this.monsters[mapId];

      for (let mob of mobs) {
        if (mob.state === 'dead') {
          // Processa respawn
          if (now >= mob.respawnTime) {
            mob.hp = mob.maxHp;
            mob.state = 'idle';
            mob.targetId = null;
            mob.aggroTable = {};
            // Reposiciona próximo ao ponto inicial de spawn
            mob.x = mob.spawnX;
            mob.z = mob.spawnZ;
            // Notifica
            this.broadcastToMap(mapId, 'mob_respawn', { mobId: mob.id, x: mob.x, z: mob.z, hp: mob.hp });
          }
          continue;
        }

        // Se não houver jogadores no mapa, economiza recursos pulando IA complexa
        if (activePlayers.length === 0) {
          mob.state = 'idle';
          mob.targetId = null;
          continue;
        }

        // Comportamento agressivo: detecta jogadores próximos caso esteja livre
        if (mob.behavior === 'aggressive' && mob.state === 'idle' && !mob.targetId) {
          let closestPlayer = null;
          let minDist = 15; // Distância de detecção (Aggro Range)

          for (let p of activePlayers) {
            const dx = p.x - mob.x;
            const dz = p.z - mob.z;
            const dist = Math.sqrt(dx*dx + dz*dz);
            if (dist < minDist && p.hp > 0) {
              minDist = dist;
              closestPlayer = p;
            }
          }

          if (closestPlayer) {
            mob.targetId = closestPlayer.characterId;
            mob.state = 'chase';
          }
        }

        // Se tem um alvo ativo
        if (mob.targetId) {
          const targetPlayer = Object.values(this.players).find(p => p.characterId === mob.targetId && p.map === mapId);
          if (!targetPlayer || targetPlayer.hp <= 0) {
            // Perdeu o alvo ou ele morreu. Retorna para o local de spawn.
            mob.targetId = null;
            mob.state = 'return';
            continue;
          }

          // Distância até o alvo
          const dx = targetPlayer.x - mob.x;
          const dz = targetPlayer.z - mob.z;
          const dist = Math.sqrt(dx*dx + dz*dz);

          // Proteção anti-kiting excessivo: Se o monstro afastar-se mais de 45m do spawn, ele reseta!
          const dsx = mob.x - mob.spawnX;
          const dsz = mob.z - mob.spawnZ;
          const distFromSpawn = Math.sqrt(dsx*dsx + dsz*dsz);
          if (distFromSpawn > 45) {
            mob.targetId = null;
            mob.state = 'return';
            continue;
          }

          if (dist <= 3.0) {
            // Alcance de ataque atingido -> Ataca!
            mob.state = 'attack';
            if (now - mob.lastActionTime >= 1500) { // Ataque a cada 1.5s
              this.monsterAttackPlayer(mob, targetPlayer);
              mob.lastActionTime = now;
            }
          } else {
            // Fora de alcance -> Persegue!
            mob.state = 'chase';
            const angle = Math.atan2(dx, dz);
            mob.r = angle;
            // Movimentação em direção ao jogador
            const speedFact = mob.speed / this.tickRate;
            mob.x += Math.sin(angle) * speedFact;
            mob.z += Math.cos(angle) * speedFact;
          }
        } else if (mob.state === 'return') {
          // Retornando ao ponto inicial
          const dx = mob.spawnX - mob.x;
          const dz = mob.spawnZ - mob.z;
          const dist = Math.sqrt(dx*dx + dz*dz);

          if (dist < 1.0) {
            mob.x = mob.spawnX;
            mob.z = mob.spawnZ;
            mob.state = 'idle';
          } else {
            const angle = Math.atan2(dx, dz);
            mob.r = angle;
            const speedFact = mob.speed / this.tickRate;
            mob.x += Math.sin(angle) * speedFact;
            mob.z += Math.cos(angle) * speedFact;
          }
        } else if (mob.state === 'idle') {
          // Patrulha leve aleatória
          if (Math.random() < 0.05 && now - mob.lastActionTime >= 5000) {
            mob.state = 'patrol';
            const pAngle = Math.random() * Math.PI * 2;
            mob.patrolDestX = mob.spawnX + Math.sin(pAngle) * (Math.random() * 8);
            mob.patrolDestZ = mob.spawnZ + Math.cos(pAngle) * (Math.random() * 8);
            mob.lastActionTime = now;
          }
        } else if (mob.state === 'patrol') {
          const dx = mob.patrolDestX - mob.x;
          const dz = mob.patrolDestZ - mob.z;
          const dist = Math.sqrt(dx*dx + dz*dz);

          if (dist < 0.5) {
            mob.state = 'idle';
          } else {
            const angle = Math.atan2(dx, dz);
            mob.r = angle;
            const speedFact = (mob.speed * 0.5) / this.tickRate; // caminha na patrulha
            mob.x += Math.sin(angle) * speedFact;
            mob.z += Math.cos(angle) * speedFact;
          }
        }
      }
    }
  }

  // Ataque de Monstro contra Jogador
  monsterAttackPlayer(mob, player) {
    if (player.hp <= 0) return;

    // Cálculo de Dano do Monstro
    const mobAtk = mob.level * 6 + 8;
    const playerDef = player.derived.physicalDefense;
    const damage = Math.max(1, Math.round(mobAtk - playerDef * 0.5));

    player.hp = Math.max(0, player.hp - damage);

    this.io.to(player.socketId).emit('player_update', { hp: player.hp });
    this.broadcastToMap(player.map, 'combat_event', {
      type: 'monster_attack',
      attackerId: mob.id,
      defenderId: player.characterId,
      damage,
      isCrit: false,
      newHp: player.hp
    });

    if (player.hp <= 0) {
      this.handlePlayerDeath(player);
    }
  }

  // Morte de Jogador
  handlePlayerDeath(player) {
    player.hp = 0;
    this.broadcastToMap(player.map, 'player_death', { charId: player.characterId, name: player.name });
    
    // Perda leve de XP como penalidade clássica de MMORPG (ex: 2% do nível atual)
    const currentLvlXp = XP_LEVELS[player.level - 1] || 100;
    const xpLoss = Math.round(currentLvlXp * 0.02);
    player.xp = Math.max(0, player.xp - xpLoss);

    this.io.to(player.socketId).emit('sys_msg', {
      type: 'error',
      text: `Você foi derrotado! Perdeu ${xpLoss} de Experiência. Use o botão de Retorno para renascer na Aldeia.`
    });
    this.io.to(player.socketId).emit('player_update', { xp: player.xp });
  }

  // Ressuscitar / Renascer jogador
  resurrectPlayer(player) {
    player.hp = Math.round(player.derived.maxHp * 0.5); // renasce com 50% vida
    player.mp = Math.round(player.derived.maxMp * 0.2); // renasce com 20% mana
    player.map = 'Town';
    player.x = 0;
    player.y = 0.5;
    player.z = 0;
    player.r = 0;

    // Sincroniza
    this.io.to(player.socketId).emit('player_resurrected', {
      map: player.map,
      x: player.x,
      y: player.y,
      z: player.z,
      hp: player.hp,
      mp: player.mp,
      xp: player.xp
    });

    this.broadcastToMap('Town', 'player_spawn', this.getClientPlayerData(player));
  }

  // Jogador Conjura Skill contra Monstro ou Aliado
  playerCastSkill(player, skillId, targetId) {
    const skillDef = SKILLS[skillId];
    if (!skillDef) return;

    if (player.hp <= 0) {
      return this.sendError(player, "Você está morto e não pode agir.");
    }

    // Cooldown check local
    const now = Date.now();
    player.cooldowns = player.cooldowns || {};
    if (player.cooldowns[skillId] && now < player.cooldowns[skillId]) {
      return this.sendError(player, `A habilidade ${skillDef.name} ainda está em cooldown.`);
    }

    // MP Cost Check
    if (player.mp < skillDef.mpCost) {
      return this.sendError(player, "Pontos de Mana (MP) insuficientes.");
    }

    // Executa comportamento dependendo do tipo da skill
    if (skillDef.type === 'buff') {
      player.mp -= skillDef.mpCost;
      player.cooldowns[skillId] = now + (skillDef.cooldown * 1000);
      
      // Aplica efeito temporário
      this.applyStatusEffect(player, skillDef.statusEffect);

      this.io.to(player.socketId).emit('player_update', { mp: player.mp });
      this.broadcastToMap(player.map, 'cast_skill_effect', {
        skillId,
        casterId: player.characterId,
        targetId: player.characterId,
        type: 'buff'
      });
      return;
    }

    if (skillDef.type === 'heal') {
      player.mp -= skillDef.mpCost;
      player.cooldowns[skillId] = now + (skillDef.cooldown * 1000);

      // Cura o próprio jogador ( vertical slice inicial ) ou aliado
      const healAmt = skillDef.formula(player);
      player.hp = Math.min(player.derived.maxHp, player.hp + healAmt);

      this.io.to(player.socketId).emit('player_update', { hp: player.hp, mp: player.mp });
      this.broadcastToMap(player.map, 'combat_event', {
        type: 'heal',
        attackerId: player.characterId,
        defenderId: player.characterId,
        damage: -healAmt, // números verdes
        newHp: player.hp
      });
      return;
    }

    // Ataque contra Monstro (target / aoe)
    const mob = this.monsters[player.map].find(m => m.id === targetId);
    if (!mob || mob.state === 'dead') {
      return this.sendError(player, "Alvo inválido.");
    }

    // Alcance Check
    const dx = mob.x - player.x;
    const dz = mob.z - player.z;
    const dist = Math.sqrt(dx*dx + dz*dz);
    if (dist > skillDef.range) {
      return this.sendError(player, "Fora de alcance de conjuração.");
    }

    // Tudo OK! Consome recursos e ativa cooldown
    player.mp -= skillDef.mpCost;
    player.cooldowns[skillId] = now + (skillDef.cooldown * 1000);

    // Cálculos de combate autoritativos no Servidor
    // Hit chance (Precisão vs Esquiva)
    const precision = player.derived.precision;
    const dodge = mob.level * 4; // esquiva aproximada do mob
    const hitRoll = Math.random() * 100;
    const hitChance = Math.max(50, Math.min(99, precision - dodge));

    if (hitRoll > hitChance) {
      // ERROU! (Miss)
      this.io.to(player.socketId).emit('player_update', { mp: player.mp });
      this.broadcastToMap(player.map, 'combat_event', {
        type: 'miss',
        attackerId: player.characterId,
        defenderId: mob.id,
        damage: 0
      });
      return;
    }

    // Crit roll
    const critRoll = Math.random() * 100;
    const isCrit = critRoll <= player.derived.criticalChance;

    let damage = skillDef.formula ? skillDef.formula(player, mob) : 10;
    if (isCrit) damage = Math.round(damage * 1.5);

    mob.hp = Math.max(0, mob.hp - damage);

    // Registra aggro
    mob.targetId = player.characterId;
    mob.state = 'chase';
    mob.aggroTable[player.characterId] = (mob.aggroTable[player.characterId] || 0) + damage;

    this.io.to(player.socketId).emit('player_update', { mp: player.mp });
    
    // Broadcast de Dano
    this.broadcastToMap(player.map, 'combat_event', {
      type: 'player_attack',
      attackerId: player.characterId,
      defenderId: mob.id,
      damage,
      isCrit,
      newHp: mob.hp
    });

    if (mob.hp <= 0) {
      this.handleMonsterDeath(mob, player.map);
    }
  }

  // Morte de Monstro, distribuição de XP e Drop de Loot
  async handleMonsterDeath(mob, mapId) {
    mob.state = 'dead';
    mob.respawnTime = Date.now() + 12000; // Renasce em 12 segundos

    this.broadcastToMap(mapId, 'mob_death', { mobId: mob.id });

    // Encontra jogadores que causaram dano para distribuir XP (repartido proporcionalmente ou ao grupo)
    // Para simplificar, o jogador que desferiu o golpe final recebe a XP principal
    const killers = Object.keys(mob.aggroTable);
    if (killers.length === 0) return;

    // Vamos recompensar o jogador principal
    const primaryCharId = killers[0];
    const player = Object.values(this.players).find(p => p.characterId === primaryCharId);
    
    if (player) {
      // Distribui XP
      await this.awardXp(player, mob.xp);
      // Distribui Ouro
      player.gold += mob.gold;
      this.io.to(player.socketId).emit('player_update', { gold: player.gold });
      this.io.to(player.socketId).emit('sys_msg', {
        type: 'loot',
        text: `Ganhou +${mob.xp} XP e recolheu +${mob.gold} Moedas de Ouro do corpo de ${mob.name}.`
      });

      // Atualiza progresso de Quests Ativas do jogador
      await this.updateQuestKillProgress(player, mob.definitionId);

      // Rolagem de Loot no Servidor
      this.generateLootDrops(mob, mapId, player.characterId);
    }
  }

  // Atualiza progresso de abate de monstros nas Quests do jogador
  async updateQuestKillProgress(player, monsterDefId) {
    try {
      const activeQuests = await query.all(
        "SELECT * FROM character_quests WHERE character_id = ? AND status = 'accepted'",
        [player.characterId]
      );

      for (let activeQ of activeQuests) {
        const qDef = QUESTS[activeQ.quest_id];
        if (!qDef) continue;

        // Verifica se algum passo pede esse abate
        for (let i = 0; i < qDef.steps.length; i++) {
          const step = qDef.steps[i];
          if (step.type === 'kill' && step.target === monsterDefId) {
            const currentProgress = activeQ.progress + 1;
            
            if (currentProgress <= step.count) {
              await query.run(
                "UPDATE character_quests SET progress = ? WHERE character_id = ? AND quest_id = ?",
                [currentProgress, player.characterId, activeQ.quest_id]
              );

              this.io.to(player.socketId).emit('quest_updated', {
                questId: activeQ.quest_id,
                progress: currentProgress,
                targetCount: step.count,
                text: `${qDef.name}: Abateu ${currentProgress}/${step.count} ${MONSTERS[monsterDefId].name}`
              });

              // Se concluiu a contagem
              if (currentProgress === step.count) {
                this.io.to(player.socketId).emit('sys_msg', {
                  type: 'quest',
                  text: `Você completou o objetivo de caça de "${qDef.name}"! Fale com o emissor para receber sua recompensa.`
                });
              }
            }
          }
        }
      }
    } catch (err) {
      console.error("Erro ao atualizar progresso de quest:", err);
    }
  }

  // Gera Drop de Loot no Chão
  generateLootDrops(mob, mapId, ownerCharId) {
    if (!mob.drops) return;

    for (let dropRow of mob.drops) {
      const roll = Math.random();
      if (roll <= dropRow.chance) {
        // Drop bem sucedido!
        const itemDef = ITEMS[dropRow.item];
        if (!itemDef) continue;

        const lootId = 'loot_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
        const dropX = mob.x + (Math.random() * 2 - 1);
        const dropZ = mob.z + (Math.random() * 2 - 1);

        const lootInstance = {
          id: lootId,
          itemId: dropRow.item,
          name: itemDef.name,
          rarity: itemDef.rarity,
          quantity: 1,
          x: dropX,
          z: dropZ,
          ownerId: ownerCharId,
          expireTime: Date.now() + 60000 // Expira em 1 minuto
        };

        this.loot[mapId].push(lootInstance);
        this.broadcastToMap(mapId, 'loot_spawn', lootInstance);
      }
    }
  }

  // Jogador recolhe loot do chão
  async playerPickupLoot(player, lootId) {
    const mapLoot = this.loot[player.map];
    const lootIdx = mapLoot.findIndex(l => l.id === lootId);
    if (lootIdx === -1) {
      return this.sendError(player, "Este item não está mais no chão.");
    }

    const loot = mapLoot[lootIdx];

    // Verifica distância (máximo 4m de distância do item)
    const dx = loot.x - player.x;
    const dz = loot.z - player.z;
    const dist = Math.sqrt(dx*dx + dz*dz);
    if (dist > 4.5) {
      return this.sendError(player, "Muito distante do item.");
    }

    // Proteção de dono temporária: se não for o dono e tiver menos de 15 segundos no chão, impede coleta!
    if (loot.ownerId !== player.characterId && (loot.expireTime - Date.now() > 45000)) {
      return this.sendError(player, "Este item pertence temporariamente a outro jogador.");
    }

    // Tenta adicionar no inventário do jogador (transacional atômico)
    try {
      const itemDef = ITEMS[loot.itemId];
      if (!itemDef) return;

      const success = await transaction(async (tx) => {
        // Verifica slot disponível. Vamos buscar slots ocupados para achar o menor livre (de 0 a 29, total 30 slots)
        const userInv = await tx.all('SELECT * FROM inventories WHERE character_id = ?', [player.characterId]);
        
        let targetSlot = -1;

        if (itemDef.stackable) {
          // Se for empilhável, tenta achar um slot que já tenha o mesmo item
          const match = userInv.find(slot => slot.item_id === loot.itemId && slot.quantity < 99);
          if (match) {
            await tx.run('UPDATE inventories SET quantity = quantity + 1 WHERE id = ?', [match.id]);
            return true;
          }
        }

        // Caso contrário, procura primeiro slot vazio entre 0 e 29
        const occupiedSlots = userInv.map(s => s.slot);
        for (let i = 0; i < 30; i++) {
          if (!occupiedSlots.includes(i)) {
            targetSlot = i;
            break;
          }
        }

        if (targetSlot === -1) {
          throw new Error("Inventário completamente cheio.");
        }

        const newId = 'inv_' + Math.random().toString(36).substr(2, 9);
        await tx.run(`
          INSERT INTO inventories (id, character_id, item_id, slot, quantity, rarity, refinement, is_equipped)
          VALUES (?, ?, ?, ?, ?, ?, ?, 0)
        `, [newId, player.characterId, loot.itemId, targetSlot, 1, itemDef.rarity, 0]);

        return true;
      });

      if (success) {
        // Remove do chão
        mapLoot.splice(lootIdx, 1);
        this.broadcastToMap(player.map, 'loot_pickup', { lootId, charId: player.characterId });
        
        // Atualiza inventário local
        await this.syncPlayerInventory(player);
        this.io.to(player.socketId).emit('sys_msg', {
          type: 'loot',
          text: `Recolheu [${loot.name}]!`
        });

        // Atualiza progresso de Quests de Coleta!
        await this.updateQuestCollectProgress(player, loot.itemId);
      }
    } catch (err) {
      this.sendError(player, err.message || "Erro ao coletar item.");
    }
  }

  // Atualiza progresso de coleta de itens nas Quests do jogador
  async updateQuestCollectProgress(player, itemId) {
    try {
      const activeQuests = await query.all(
        "SELECT * FROM character_quests WHERE character_id = ? AND status = 'accepted'",
        [player.characterId]
      );

      for (let activeQ of activeQuests) {
        const qDef = QUESTS[activeQ.quest_id];
        if (!qDef) continue;

        // Conta quantos itens do tipo o jogador possui atualmente no total
        const invRows = await query.all(
          "SELECT SUM(quantity) as qty FROM inventories WHERE character_id = ? AND item_id = ?",
          [player.characterId, itemId]
        );
        const totalOwned = invRows[0].qty || 0;

        for (let step of qDef.steps) {
          if (step.type === 'collect' && step.target === itemId) {
            await query.run(
              "UPDATE character_quests SET progress = ? WHERE character_id = ? AND quest_id = ?",
              [totalOwned, player.characterId, activeQ.quest_id]
            );

            this.io.to(player.socketId).emit('quest_updated', {
              questId: activeQ.quest_id,
              progress: totalOwned,
              targetCount: step.count,
              text: `${qDef.name}: Coletou ${totalOwned}/${step.count} ${ITEMS[itemId].name}`
            });
          }
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

  // Distribuição de Experiência e Subir de Nível (Level Up)
  async awardXp(player, amount) {
    player.xp += amount;
    let nextLvlXp = XP_LEVELS[player.level - 1];

    let leveledUp = false;
    while (player.xp >= nextLvlXp && player.level < 99) {
      player.xp -= nextLvlXp;
      player.level += 1;
      leveledUp = true;
      nextLvlXp = XP_LEVELS[player.level - 1] || 1000000;
    }

    if (leveledUp) {
      // Atualiza banco e concede pontos
      await transaction(async (tx) => {
        // Adiciona 5 pontos de atributos e 1 de habilidade por nível ganho
        await tx.run(`
          UPDATE characters SET level = ?, xp = ? WHERE id = ?
        `, [player.level, player.xp, player.characterId]);

        await tx.run(`
          UPDATE character_stats
          SET stat_points = stat_points + 5, skill_points = skill_points + 1
          WHERE character_id = ?
        `, [player.characterId]);
      });

      // Recarrega estatísticas do banco
      const stats = await query.get('SELECT * FROM character_stats WHERE character_id = ?', [player.characterId]);
      player.stats = stats;
      player.derived = calculateDerivedStats(stats, player.level, player.class);
      player.hp = player.derived.maxHp;
      player.mp = player.derived.maxMp;

      // Sincroniza e emite efeitos gloriosos de Level Up!
      this.io.to(player.socketId).emit('player_level_up', {
        level: player.level,
        xp: player.xp,
        hp: player.hp,
        mp: player.mp,
        stats: player.stats,
        derived: player.derived
      });

      this.broadcastToMap(player.map, 'level_up_effect', { charId: player.characterId });
    } else {
      // Apenas atualiza XP no cliente
      this.io.to(player.socketId).emit('player_update', { xp: player.xp });
    }
  }

  // Regeneração de HP/MP Passiva
  processRegeneration() {
    for (let sId in this.players) {
      const p = this.players[sId];
      if (p.hp <= 0) continue;

      const hpRegen = Math.round(p.derived.maxHp * 0.02 + 1); // 2% HP base
      const mpRegen = Math.round(p.derived.maxMp * 0.03 + 1); // 3% MP base

      let changed = false;
      if (p.hp < p.derived.maxHp) {
        p.hp = Math.min(p.derived.maxHp, p.hp + hpRegen);
        changed = true;
      }
      if (p.mp < p.derived.maxMp) {
        p.mp = Math.min(p.derived.maxMp, p.mp + mpRegen);
        changed = true;
      }

      if (changed) {
        this.io.to(p.socketId).emit('player_update', { hp: p.hp, mp: p.mp });
      }
    }
  }

  // Sincronizar Inventário para o cliente
  async syncPlayerInventory(player) {
    const inv = await query.all('SELECT * FROM inventories WHERE character_id = ?', [player.characterId]);
    player.inventory = inv;
    this.io.to(player.socketId).emit('inventory_sync', inv);
  }

  // Carregar e Registar Entrada do Jogador no Mundo
  async playerJoinWorld(socket, charId) {
    try {
      const char = await query.get('SELECT * FROM characters WHERE id = ?', [charId]);
      if (!char) {
        socket.emit('sys_msg', { type: 'error', text: 'Personagem não encontrado.' });
        return;
      }

      // Evitar login duplicado / chuta conexão anterior
      const oldPlayerSocket = Object.values(this.players).find(p => p.characterId === charId);
      if (oldPlayerSocket) {
        this.io.to(oldPlayerSocket.socketId).emit('sys_msg', { type: 'error', text: 'Sua conta foi acessada de outro local.' });
        this.io.sockets.sockets.get(oldPlayerSocket.socketId)?.disconnect();
        delete this.players[oldPlayerSocket.socketId];
      }

      const stats = await query.get('SELECT * FROM character_stats WHERE character_id = ?', [charId]);
      const eq = await query.get('SELECT * FROM character_equipment WHERE character_id = ?', [charId]);

      const playerInst = {
        socketId: socket.id,
        characterId: charId,
        user_id: char.user_id,
        name: char.name,
        level: char.level,
        xp: char.xp,
        class: char.class,
        gold: char.gold,
        map: char.map,
        x: char.x,
        y: char.y,
        z: char.z,
        r: char.r,
        appearance: {
          skinColor: char.skin_color,
          hairStyle: char.hair_style,
          hairColor: char.hair_color,
          faceStyle: char.face_style
        },
        stats: stats,
        equipment: eq,
        derived: calculateDerivedStats(stats, char.level, char.class),
        hp: Math.round(calculateDerivedStats(stats, char.level, char.class).maxHp),
        mp: Math.round(calculateDerivedStats(stats, char.level, char.class).maxMp),
        cooldowns: {},
        statusEffects: {},
        lastMoveTime: Date.now()
      };

      this.players[socket.id] = playerInst;

      // Envia confirmação de entrada
      socket.emit('world_enter_success', {
        player: this.getClientPlayerData(playerInst),
        derived: playerInst.derived,
        stats: playerInst.stats,
        equipment: playerInst.equipment
      });

      // Sincroniza Inventário e Quests Ativas do Banco
      await this.syncPlayerInventory(playerInst);
      
      const quests = await query.all('SELECT * FROM character_quests WHERE character_id = ?', [charId]);
      socket.emit('quests_sync', quests);

      // Notifica jogadores do mapa
      this.broadcastToMap(playerInst.map, 'player_spawn', this.getClientPlayerData(playerInst));

      // Sincroniza jogadores e mobs existentes neste mapa para o novo jogador
      const existingPlayers = Object.values(this.players)
        .filter(p => p.map === playerInst.map && p.socketId !== socket.id)
        .map(p => this.getClientPlayerData(p));

      const existingMobs = this.monsters[playerInst.map].map(m => ({
        id: m.id,
        definitionId: m.definitionId,
        name: m.name,
        level: m.level,
        hp: m.hp,
        maxHp: m.maxHp,
        x: m.x,
        y: m.y,
        z: m.z,
        r: m.r,
        state: m.state,
        size: m.size,
        color: m.color
      }));

      const existingLoot = this.loot[playerInst.map].filter(l => l.expireTime > Date.now());

      socket.emit('map_init_state', {
        players: existingPlayers,
        mobs: existingMobs,
        loot: existingLoot
      });

      console.log(`Jogador conectado no mundo: ${playerInst.name} (${charId}) em ${playerInst.map}`);
    } catch (err) {
      console.error(err);
      socket.emit('sys_msg', { type: 'error', text: 'Erro crítico ao entrar no mundo.' });
    }
  }

  // Salva dados de um jogador específico
  async savePlayer(player) {
    if (!player) return;
    try {
      await query.run(`
        UPDATE characters
        SET level = ?, xp = ?, class = ?, gold = ?, map = ?, x = ?, y = ?, z = ?, r = ?
        WHERE id = ?
      `, [
        player.level, player.xp, player.class, player.gold, player.map,
        player.x, player.y, player.z, player.r, player.characterId
      ]);
      // Atributos
      await query.run(`
        UPDATE character_stats
        SET str = ?, vit = ?, agi = ?, dex = ?, int = ?, spr = ?, luk = ?, stat_points = ?, skill_points = ?
        WHERE character_id = ?
      `, [
        player.stats.str, player.stats.vit, player.stats.agi, player.stats.dex,
        player.stats.int, player.stats.spr, player.stats.luk, player.stats.stat_points,
        player.stats.skill_points, player.characterId
      ]);
    } catch (err) {
      console.error(`Erro ao salvar personagem ${player.name}:`, err);
    }
  }

  // Salva todos os jogadores conectados
  saveAllPlayers() {
    console.log("Executando salvamento periódico de todos os jogadores conectados...");
    for (let sId in this.players) {
      this.savePlayer(this.players[sId]);
    }
  }

  // Remoção de jogador ao desconectar
  async playerDisconnect(socketId) {
    const player = this.players[socketId];
    if (player) {
      // Salva progresso final no banco
      await this.savePlayer(player);

      // Notifica outros jogadores do mapa
      this.broadcastToMap(player.map, 'player_despawn', { charId: player.characterId });
      
      console.log(`Jogador desconectou do mundo: ${player.name} (${player.characterId})`);
      delete this.players[socketId];
    }
  }

  // Trata movimentação recebida do cliente com validações básicas de velocidade
  playerMove(player, data) {
    const now = Date.now();
    const dt = (now - player.lastMoveTime) / 1000;
    player.lastMoveTime = now;

    // Cálculo simples de Speedhack Check:
    // Distância percorrida desde a última atualização
    const dx = data.x - player.x;
    const dz = data.z - player.z;
    const dist = Math.sqrt(dx*dx + dz*dz);

    const baseSpeed = player.derived.movementSpeed / 10; // ex: 10m/s
    const maxAllowedDist = baseSpeed * Math.max(0.1, dt) * 2.2; // 2.2 buffer de latência

    if (dist > maxAllowedDist && dt > 0.1 && player.map !== 'Arena') {
      // Bloqueia e corrige posição (Teleport Hack detectado!)
      this.io.to(player.socketId).emit('player_correct_position', {
        x: player.x,
        y: player.y,
        z: player.z,
        r: player.r
      });
      return;
    }

    // Atualiza posições validadas
    player.x = data.x;
    player.y = data.y;
    player.z = data.z;
    player.r = data.r;

    // Sincroniza em tempo real para os outros jogadores do mesmo mapa
    this.broadcastToMap(player.map, 'player_moved', {
      charId: player.characterId,
      x: player.x,
      y: player.y,
      z: player.z,
      r: player.r
    }, player.socketId);
  }

  // Envia atualização de estado completo dos monstros/players do mapa (Interest Management)
  broadcastWorldState() {
    for (let mapId in MAPS) {
      const activePlayers = Object.values(this.players).filter(p => p.map === mapId);
      if (activePlayers.length === 0) continue;

      const mobStates = this.monsters[mapId].map(m => ({
        id: m.id,
        x: m.x,
        z: m.z,
        r: m.r,
        hp: m.hp,
        state: m.state
      }));

      // Broadcast compactado contendo posições dos monstros para todos no mapa
      this.broadcastToMap(mapId, 'world_sync', {
        mobs: mobStates
      });
    }
  }

  // Trata portais e viagens
  playerUsePortal(player, portalId) {
    const mapDef = MAPS[player.map];
    if (!mapDef || !mapDef.portals) return;

    const portal = mapDef.portals.find(p => p.id === portalId);
    if (!portal) return;

    // Distância do portal
    const dx = portal.x - player.x;
    const dz = portal.z - player.z;
    const dist = Math.sqrt(dx*dx + dz*dz);

    if (dist > 5.0) {
      return this.sendError(player, "Muito distante do portal.");
    }

    // Teleporta!
    const oldMap = player.map;
    this.broadcastToMap(oldMap, 'player_despawn', { charId: player.characterId }, player.socketId);

    player.map = portal.targetMap;
    player.x = portal.targetX;
    player.y = portal.targetY;
    player.z = portal.targetZ;
    player.r = 0;

    // Envia novos dados de entrada do mapa
    this.io.to(player.socketId).emit('player_map_change', {
      map: player.map,
      x: player.x,
      y: player.y,
      z: player.z
    });

    // Recarrega estado de jogo do novo mapa
    const existingPlayers = Object.values(this.players)
      .filter(p => p.map === player.map && p.socketId !== player.socketId)
      .map(p => this.getClientPlayerData(p));

    const existingMobs = this.monsters[player.map].map(m => ({
      id: m.id,
      definitionId: m.definitionId,
      name: m.name,
      level: m.level,
      hp: m.hp,
      maxHp: m.maxHp,
      x: m.x,
      y: m.y,
      z: m.z,
      r: m.r,
      state: m.state,
      size: m.size,
      color: m.color
    }));

    const existingLoot = this.loot[player.map].filter(l => l.expireTime > Date.now());

    this.io.to(player.socketId).emit('map_init_state', {
      players: existingPlayers,
      mobs: existingMobs,
      loot: existingLoot
    });

    // Avisa jogadores do novo mapa
    this.broadcastToMap(player.map, 'player_spawn', this.getClientPlayerData(player), player.socketId);
  }

  // Interações com NPCs (Quests, Compras, Vendas)
  async playerInteractNPC(player, data) {
    const { npcId, action, target } = data;
    const mapDef = MAPS[player.map];
    const npcDef = mapDef.npcs ? mapDef.npcs.find(n => n.id === npcId) : null;

    if (!npcDef) return this.sendError(player, "NPC inexistente neste mapa.");

    // Verifica distância
    const dx = npcDef.x - player.x;
    const dz = npcDef.z - player.z;
    const dist = Math.sqrt(dx*dx + dz*dz);
    if (dist > 5.0) return this.sendError(player, "Muito distante do NPC.");

    // 1. Ações de Quests
    if (npcDef.type === 'quest') {
      if (action === 'quest_list') {
        // Envia lista de quests disponíveis neste NPC
        const available = [];
        const active = [];

        // Filtra quests do banco
        const charQuests = await query.all('SELECT * FROM character_quests WHERE character_id = ?', [player.characterId]);

        for (let qId in QUESTS) {
          const qDef = QUESTS[qId];
          if (qDef.giver !== npcDef.name) continue;

          const qDb = charQuests.find(q => q.quest_id === qId);
          if (!qDb) {
            // Verifica pré-requisito de nível e de quest anterior
            if (player.level >= (qDef.requirements.level || 1)) {
              if (!qDef.requirements.quest || charQuests.some(q => q.quest_id === qDef.requirements.quest && q.status === 'completed')) {
                available.push({ id: qId, name: qDef.name, desc: qDef.description });
              }
            }
          } else if (qDb.status === 'accepted') {
            active.push({ id: qId, name: qDef.name, progress: qDb.progress, step: qDef.steps[0] });
          }
        }

        this.io.to(player.socketId).emit('npc_dialog_quests', { npcId, available, active });
      }

      else if (action === 'quest_accept') {
        const qId = target;
        const qDef = QUESTS[qId];
        if (!qDef || qDef.giver !== npcDef.name) return;

        try {
          await query.run(`
            INSERT INTO character_quests (character_id, quest_id, status, progress)
            VALUES (?, ?, 'accepted', 0)
          `, [player.characterId, qId]);

          this.io.to(player.socketId).emit('sys_msg', { type: 'quest', text: `Quest aceita: ${qDef.name}!` });
          
          // Se o primeiro objetivo for de coleta, já inicializa com o que o jogador possui
          if (qDef.steps[0].type === 'collect') {
            await this.updateQuestCollectProgress(player, qDef.steps[0].target);
          } else {
            this.io.to(player.socketId).emit('quest_updated', { questId: qId, progress: 0, targetCount: qDef.steps[0].count || 1, text: qDef.name });
          }

          // Atualiza lista de quests no cliente
          const quests = await query.all('SELECT * FROM character_quests WHERE character_id = ?', [player.characterId]);
          this.io.to(player.socketId).emit('quests_sync', quests);
        } catch (err) {
          console.error(err);
        }
      }

      else if (action === 'quest_complete') {
        const qId = target;
        const qDef = QUESTS[qId];
        if (!qDef || qDef.giver !== npcDef.name) return;

        try {
          const qDb = await query.get('SELECT * FROM character_quests WHERE character_id = ? AND quest_id = ?', [player.characterId, qId]);
          if (!qDb || qDb.status !== 'accepted') return;

          // Valida progresso
          const step = qDef.steps[0];
          let isComplete = false;

          if (step.type === 'talk') isComplete = true;
          else if (step.type === 'kill' && qDb.progress >= step.count) isComplete = true;
          else if (step.type === 'collect') {
            // Verifica itens no inventário real
            const totalOwnedRow = await query.get(
              "SELECT SUM(quantity) as qty FROM inventories WHERE character_id = ? AND item_id = ?",
              [player.characterId, step.target]
            );
            if ((totalOwnedRow.qty || 0) >= step.count) isComplete = true;
          }

          if (!isComplete) {
            return this.sendError(player, "Você ainda não completou os objetivos desta quest.");
          }

          // Completa e entrega recompensas de forma transacional atômica
          const success = await transaction(async (tx) => {
            // Altera status no banco
            await tx.run('UPDATE character_quests SET status = "completed", completed_at = ? WHERE character_id = ? AND quest_id = ?', [Date.now(), player.characterId, qId]);

            // Se for quest de coleta, consome os itens do inventário! (Sink importante)
            if (step.type === 'collect') {
              let toRemove = step.count;
              const charInv = await tx.all('SELECT * FROM inventories WHERE character_id = ? AND item_id = ? ORDER BY slot DESC', [player.characterId, step.target]);
              
              for (let invRow of charInv) {
                if (toRemove <= 0) break;
                if (invRow.quantity <= toRemove) {
                  toRemove -= invRow.quantity;
                  await tx.run('DELETE FROM inventories WHERE id = ?', [invRow.id]);
                } else {
                  await tx.run('UPDATE inventories SET quantity = quantity - ? WHERE id = ?', [toRemove, invRow.id]);
                  toRemove = 0;
                }
              }
            }

            // Entrega Ouro
            await tx.run('UPDATE characters SET gold = gold + ? WHERE id = ?', [qDef.rewards.gold, player.characterId]);

            // Entrega Itens Recompensas
            if (qDef.rewards.items) {
              for (let rItem of qDef.rewards.items) {
                const itemDef = ITEMS[rItem.item];
                // Acha slot livre
                const occupiedRows = await tx.all('SELECT slot FROM inventories WHERE character_id = ?', [player.characterId]);
                const occupied = occupiedRows.map(o => s = o.slot);
                let freeSlot = -1;
                for (let i = 0; i < 30; i++) {
                  if (!occupied.includes(i)) { freeSlot = i; break; }
                }

                if (freeSlot !== -1) {
                  const newId = 'inv_' + Math.random().toString(36).substr(2, 9);
                  await tx.run(`
                    INSERT INTO inventories (id, character_id, item_id, slot, quantity, rarity, refinement, is_equipped)
                    VALUES (?, ?, ?, ?, ?, ?, 0, 0)
                  `, [newId, player.characterId, rItem.item, freeSlot, rItem.qty]);
                }
              }
            }

            return true;
          });

          if (success) {
            player.gold += qDef.rewards.gold;
            this.io.to(player.socketId).emit('player_update', { gold: player.gold });

            // Sincroniza e concede XP
            await this.awardXp(player, qDef.rewards.xp);
            await this.syncPlayerInventory(player);

            const quests = await query.all('SELECT * FROM character_quests WHERE character_id = ?', [player.characterId]);
            this.io.to(player.socketId).emit('quests_sync', quests);

            this.io.to(player.socketId).emit('sys_msg', {
              type: 'quest',
              text: `Quest Concluída: [${qDef.name}]! Recompensas recebidas.`
            });
            this.io.to(player.socketId).emit('quest_completed_ui', qId);
          }
        } catch (err) {
          console.error(err);
          this.sendError(player, "Falha ao completar a quest.");
        }
      }
    }

    // 2. Curador (Luna)
    else if (npcDef.type === 'healer') {
      player.hp = player.derived.maxHp;
      player.mp = player.derived.maxMp;
      this.io.to(player.socketId).emit('player_update', { hp: player.hp, mp: player.mp });
      this.io.to(player.socketId).emit('sys_msg', { type: 'system', text: 'Luna purifica sua mente e corpo. HP/MP completamente restaurados!' });
      this.broadcastToMap(player.map, 'combat_event', { type: 'heal', attackerId: player.characterId, defenderId: player.characterId, damage: -player.derived.maxHp, newHp: player.hp });
    }

    // 3. Instrutores de Classe (Vane, Kael, etc.)
    else if (npcDef.type === 'class_master') {
      if (action === 'class_change_preview') {
        this.io.to(player.socketId).emit('class_change_ui', { npcId });
      } else if (action === 'class_change_execute') {
        const targetClass = target;
        if (!CLASSES[targetClass]) return;

        if (player.level < 10) {
          return this.sendError(player, "Você precisa estar pelo menos no nível 10 para trocar de classe.");
        }

        if (player.class !== 'Adventurer') {
          return this.sendError(player, "Você já evoluiu sua classe e não pode mais trocar.");
        }

        // Verifica se a quest de classe anterior (Q9) foi concluída
        const questQ9 = await query.get('SELECT * FROM character_quests WHERE character_id = ? AND quest_id = "Q9" AND status = "completed"', [player.characterId]);
        if (!questQ9) {
          return this.sendError(player, "Você precisa completar a quest 'Ascendendo sua Vocação' antes de evoluir.");
        }

        try {
          player.class = targetClass;
          await query.run('UPDATE characters SET class = ? WHERE id = ?', [targetClass, player.characterId]);

          // Recalcula derivados
          player.derived = calculateDerivedStats(player.stats, player.level, targetClass);
          player.hp = player.derived.maxHp;
          player.mp = player.derived.maxMp;

          this.io.to(player.socketId).emit('player_level_up', {
            level: player.level,
            xp: player.xp,
            hp: player.hp,
            mp: player.mp,
            stats: player.stats,
            derived: player.derived
          });

          this.io.to(player.socketId).emit('sys_msg', {
            type: 'system',
            text: `Parabéns! Você se tornou um [${targetClass}] glorioso. Novos horizontes se abriram!`
          });

          this.broadcastToMap(player.map, 'level_up_effect', { charId: player.characterId });
        } catch (err) {
          console.error(err);
        }
      }
    }

    // 4. Comerciantes (Grom, Raza, CapitalMerchant)
    else if (npcDef.type === 'merchant') {
      if (action === 'shop_buy') {
        const itemId = target;
        const itemDef = ITEMS[itemId];
        if (!itemDef || itemDef.price === 0) return;

        if (player.gold < itemDef.price) {
          return this.sendError(player, "Você não possui Ouro suficiente.");
        }

        try {
          const success = await transaction(async (tx) => {
            // Desconta Gold
            await tx.run('UPDATE characters SET gold = gold - ? WHERE id = ?', [itemDef.price, player.characterId]);

            // Adiciona Item no Inventário (Acha menor slot livre)
            const userInv = await tx.all('SELECT * FROM inventories WHERE character_id = ?', [player.characterId]);
            let targetSlot = -1;

            if (itemDef.stackable) {
              const match = userInv.find(slot => slot.item_id === itemId && slot.quantity < 99);
              if (match) {
                await tx.run('UPDATE inventories SET quantity = quantity + 1 WHERE id = ?', [match.id]);
                return true;
              }
            }

            const occupiedSlots = userInv.map(s => s.slot);
            for (let i = 0; i < 30; i++) {
              if (!occupiedSlots.includes(i)) { targetSlot = i; break; }
            }

            if (targetSlot === -1) {
              throw new Error("Inventário completamente cheio.");
            }

            const newId = 'inv_' + Math.random().toString(36).substr(2, 9);
            await tx.run(`
              INSERT INTO inventories (id, character_id, item_id, slot, quantity, rarity, refinement, is_equipped)
              VALUES (?, ?, ?, ?, ?, ?, ?, 0)
            `, [newId, player.characterId, itemId, targetSlot, 1, itemDef.rarity, 0]);

            return true;
          });

          if (success) {
            player.gold -= itemDef.price;
            this.io.to(player.socketId).emit('player_update', { gold: player.gold });
            await this.syncPlayerInventory(player);
            this.io.to(player.socketId).emit('sys_msg', { type: 'loot', text: `Comprou [${itemDef.name}] por ${itemDef.price} Moedas.` });
            
            // Atualiza quests de coleta caso tenha comprado item necessário
            await this.updateQuestCollectProgress(player, itemId);
          }
        } catch (err) {
          this.sendError(player, err.message || "Erro na compra.");
        }
      }

      else if (action === 'shop_sell') {
        const slot = parseInt(target);
        if (isNaN(slot)) return;

        try {
          const slotItem = await query.get('SELECT * FROM inventories WHERE character_id = ? AND slot = ?', [player.characterId, slot]);
          if (!slotItem) return this.sendError(player, "Item não encontrado no inventário.");

          if (slotItem.is_equipped) {
            return this.sendError(player, "Desequipe o item antes de vendê-lo.");
          }

          const itemDef = ITEMS[slotItem.item_id];
          if (!itemDef) return;

          const sellValue = itemDef.sellPrice * slotItem.quantity;

          const success = await transaction(async (tx) => {
            // Remove do inventário
            await tx.run('DELETE FROM inventories WHERE id = ?', [slotItem.id]);
            // Adiciona Gold
            await tx.run('UPDATE characters SET gold = gold + ? WHERE id = ?', [sellValue, player.characterId]);
            return true;
          });

          if (success) {
            player.gold += sellValue;
            this.io.to(player.socketId).emit('player_update', { gold: player.gold });
            await this.syncPlayerInventory(player);
            this.io.to(player.socketId).emit('sys_msg', { type: 'loot', text: `Vendeu ${slotItem.quantity}x [${itemDef.name}] por ${sellValue} Moedas de Ouro.` });
          }
        } catch (err) {
          console.error(err);
        }
      }
    }
  }

  // Equipar e Desequipar Itens (Sincronizado e validado no Servidor)
  async playerEquipItem(player, data) {
    const { slot, category } = data; // 'slot' do inventário, 'category' é onde equipa

    try {
      const invRow = await query.get('SELECT * FROM inventories WHERE character_id = ? AND slot = ?', [player.characterId, slot]);
      if (!invRow) return;

      const itemDef = ITEMS[invRow.item_id];
      if (!itemDef) return;

      // Validações de Classe permitida e Nível mínimo
      if (itemDef.minLevel && player.level < itemDef.minLevel) {
        return this.sendError(player, `Nível mínimo para equipar é ${itemDef.minLevel}.`);
      }

      if (itemDef.allowedClasses && !itemDef.allowedClasses.includes(player.class)) {
        return this.sendError(player, `Este item não é utilizável pela sua classe.`);
      }

      // Mapeia categoria de item para coluna de equipamento no banco
      const categoryToCol = {
        'Head': 'head', 'Body': 'body', 'Hands': 'hands', 'Boots': 'feet',
        'Main Hand': 'main_hand', 'Off Hand': 'off_hand', 'Cape': 'cape',
        'Accessory 1': 'accessory1', 'Accessory 2': 'accessory2'
      };

      const eqCol = categoryToCol[itemDef.category];
      if (!eqCol) return this.sendError(player, "Este item não é equipável.");

      await transaction(async (tx) => {
        // 1. Desequipa o que quer que estivesse naquele slot de equipamento
        const currentEq = await tx.get(`SELECT ${eqCol} FROM character_equipment WHERE character_id = ?`, [player.characterId]);
        const equippedItemId = currentEq[eqCol];

        if (equippedItemId) {
          // Marca o item antigo no inventário como NÃO equipado (is_equipped = 0)
          await tx.run(`
            UPDATE inventories SET is_equipped = 0 WHERE character_id = ? AND item_id = ? AND is_equipped = 1
          `, [player.characterId, equippedItemId]);
        }

        // 2. Marca o novo item como equipado no inventário
        await tx.run(`UPDATE inventories SET is_equipped = 1 WHERE id = ?`, [invRow.id]);

        // 3. Atualiza slot na tabela de equipamentos
        await tx.run(`
          UPDATE character_equipment SET ${eqCol} = ? WHERE character_id = ?
        `, [invRow.item_id, player.characterId]);
      });

      // Recarrega do banco e recalcula estatísticas derivadas
      const stats = await query.get('SELECT * FROM character_stats WHERE character_id = ?', [player.characterId]);
      const eq = await query.get('SELECT * FROM character_equipment WHERE character_id = ?', [player.characterId]);
      
      player.stats = stats;
      player.equipment = eq;

      // Modificadores extras dos itens equipados
      const baseStatsCopy = { ...stats };
      let derivedStats = calculateDerivedStats(baseStatsCopy, player.level, player.class);

      // Passa por todos os slots equipados somando os bônus dos itens
      for (let col of ['head', 'body', 'hands', 'feet', 'main_hand', 'off_hand', 'cape', 'accessory1', 'accessory2']) {
        const itemId = eq[col];
        if (itemId) {
          const item = ITEMS[itemId];
          if (item && item.modifiers) {
            for (let mod in item.modifiers) {
              if (derivedStats[mod] !== undefined) {
                derivedStats[mod] += item.modifiers[mod];
              } else if (baseStatsCopy[mod] !== undefined) {
                // bônus nos atributos principais
                baseStatsCopy[mod] += item.modifiers[mod];
              }
            }
          }
        }
      }

      // Recalcula bônus após modificadores de atributos principais
      player.derived = calculateDerivedStats(baseStatsCopy, player.level, player.class);

      // Adiciona bônus nos derivados diretamente acumulados dos itens
      for (let col of ['head', 'body', 'hands', 'feet', 'main_hand', 'off_hand', 'cape', 'accessory1', 'accessory2']) {
        const itemId = eq[col];
        if (itemId) {
          const item = ITEMS[itemId];
          if (item && item.modifiers) {
            for (let mod in item.modifiers) {
              if (player.derived[mod] !== undefined) {
                player.derived[mod] += item.modifiers[mod];
              }
            }
          }
        }
      }

      this.io.to(player.socketId).emit('player_update_combat_data', {
        equipment: player.equipment,
        derived: player.derived
      });

      await this.syncPlayerInventory(player);

      this.io.to(player.socketId).emit('sys_msg', {
        type: 'loot',
        text: `Equipou [${itemDef.name}] com sucesso.`
      });

      // Notifica visual para os outros players (mudar arma, etc.)
      this.broadcastToMap(player.map, 'player_equip_visual', {
        charId: player.characterId,
        col: eqCol,
        itemId: invRow.item_id
      });
    } catch (err) {
      console.error(err);
      this.sendError(player, "Erro ao equipar item.");
    }
  }

  // Desequipa item de uma coluna
  async playerUnequipItem(player, data) {
    const { col } = data; // ex: 'main_hand', 'body', 'head'

    try {
      const eq = await query.get('SELECT * FROM character_equipment WHERE character_id = ?', [player.characterId]);
      const itemId = eq[col];
      if (!itemId) return;

      await transaction(async (tx) => {
        // Remove do slot de equipamento
        await tx.run(`UPDATE character_equipment SET ${col} = NULL WHERE character_id = ?`, [player.characterId]);
        // Remove tag equipped no inventário
        await tx.run(`UPDATE inventories SET is_equipped = 0 WHERE character_id = ? AND item_id = ? AND is_equipped = 1`, [player.characterId, itemId]);
      });

      // Recarrega e recalcula
      const stats = await query.get('SELECT * FROM character_stats WHERE character_id = ?', [player.characterId]);
      const updatedEq = await query.get('SELECT * FROM character_equipment WHERE character_id = ?', [player.characterId]);
      
      player.stats = stats;
      player.equipment = updatedEq;
      player.derived = calculateDerivedStats(stats, player.level, player.class);

      this.io.to(player.socketId).emit('player_update_combat_data', {
        equipment: player.equipment,
        derived: player.derived
      });

      await this.syncPlayerInventory(player);

      this.io.to(player.socketId).emit('sys_msg', {
        type: 'loot',
        text: `Desequipou item com sucesso.`
      });

      this.broadcastToMap(player.map, 'player_equip_visual', {
        charId: player.characterId,
        col: col,
        itemId: null
      });
    } catch (err) {
      console.error(err);
      this.sendError(player, "Erro ao desequipar.");
    }
  }

  // Distribuição Manual de Pontos de Atributo (Autoritativa)
  async playerDistributeStat(player, data) {
    const { stat } = data; // 'str', 'vit', 'agi', 'dex', 'int', 'spr', 'luk'

    if (!['str', 'vit', 'agi', 'dex', 'int', 'spr', 'luk'].includes(stat)) return;

    try {
      const stats = await query.get('SELECT * FROM character_stats WHERE character_id = ?', [player.characterId]);
      if (stats.stat_points <= 0) {
        return this.sendError(player, "Você não possui Pontos de Atributo disponíveis.");
      }

      await query.run(`
        UPDATE character_stats
        SET ${stat} = ${stat} + 1, stat_points = stat_points - 1
        WHERE character_id = ?
      `, [player.characterId]);

      // Atualiza localmente
      const newStats = await query.get('SELECT * FROM character_stats WHERE character_id = ?', [player.characterId]);
      player.stats = newStats;
      player.derived = calculateDerivedStats(newStats, player.level, player.class);

      this.io.to(player.socketId).emit('player_update_combat_data', {
        stats: player.stats,
        derived: player.derived
      });

      this.io.to(player.socketId).emit('sys_msg', {
        type: 'system',
        text: `Adicionou +1 em ${stat.toUpperCase()}!`
      });
    } catch (err) {
      console.error(err);
    }
  }

  // Aplica efeitos temporários (Buffs, etc.)
  applyStatusEffect(player, effectData) {
    if (!effectData) return;
    const { effect, duration, stats } = effectData;
    
    player.statusEffects[effect] = {
      expireTime: Date.now() + (duration * 1000),
      stats
    };

    // Sincroniza bônus locais e derivados
    this.recalculateEffects(player);
  }

  recalculateEffects(player) {
    // vertical slice: buffs leves aumentam os atributos e sincronizam
    // No frame de atualização, podemos expirar efeitos velhos
    const now = Date.now();
    for (let eff in player.statusEffects) {
      if (now >= player.statusEffects[eff].expireTime) {
        delete player.statusEffects[eff];
      }
    }
  }

  // Mensagem segura de Chat com sanitização robusta contra XSS / HTML Injection
  handleChatMessage(player, data) {
    const { channel, text, target } = data;

    if (!text || text.trim().length === 0) return;

    // Sanitiza contra HTML/JS arbitrário
    let cleanText = text.replace(/</g, "&lt;").replace(/>/g, "&gt;").trim();

    // Filtra spam
    const now = Date.now();
    player.lastChatTime = player.lastChatTime || 0;
    if (now - player.lastChatTime < 1000) {
      return this.io.to(player.socketId).emit('sys_msg', { type: 'error', text: 'Anti-Spam ativo: Aguarde antes de falar novamente.' });
    }
    player.lastChatTime = now;

    // Aplica filtro de palavras inadequadas no chat
    const lowerTxt = cleanText.toLowerCase();
    for (let banned of BANNED_NAMES) {
      if (lowerTxt.includes(banned)) {
        cleanText = cleanText.replace(new RegExp(banned, 'gi'), '***');
      }
    }

    const payload = {
      channel,
      sender: player.name,
      senderId: player.characterId,
      text: cleanText,
      timestamp: now
    };

    if (channel === 'local') {
      // Envia a todos os jogadores no mesmo mapa
      this.broadcastToMap(player.map, 'chat_msg', payload);
    } else if (channel === 'global') {
      // Envia para o servidor inteiro
      this.io.emit('chat_msg', payload);
    } else if (channel === 'whisper') {
      // Sussurro direto a um personagem online
      const targetPlayer = Object.values(this.players).find(p => p.name.toLowerCase() === target.trim().toLowerCase());
      if (targetPlayer) {
        this.io.to(targetPlayer.socketId).emit('chat_msg', payload);
        this.io.to(player.socketId).emit('chat_msg', payload); // ecoa para o remetente
      } else {
        this.io.to(player.socketId).emit('sys_msg', { type: 'error', text: `Jogador "${target}" não está online no momento.` });
      }
    }
  }

  // --- COMANDOS ADMINISTRATIVOS DO PAINEL / CHAT ---
  executeAdminCommand(player, cmdText) {
    if (player.user_id !== 'usr_admin' && player.name !== 'Admin_Aetheria') {
      return this.sendError(player, "Acesso Negado.");
    }

    const args = cmdText.split(' ');
    const cmd = args[0].toLowerCase();

    if (cmd === '/spawn') {
      const mobId = args[1];
      if (MONSTERS[mobId]) {
        const spawned = this.spawnMonster(player.map, mobId, player.x + 3, player.z + 3);
        if (spawned) {
          this.broadcastToMap(player.map, 'mob_respawn', { mobId: spawned.id, x: spawned.x, z: spawned.z, hp: spawned.hp });
          this.io.to(player.socketId).emit('sys_msg', { type: 'system', text: `Invocado [${mobId}] sob comando administrativo.` });
        }
      }
    } else if (cmd === '/tp') {
      const mapId = args[1];
      if (MAPS[mapId]) {
        player.map = mapId;
        player.x = 0;
        player.y = 0.5;
        player.z = 0;
        this.io.to(player.socketId).emit('player_map_change', { map: mapId, x: 0, y: 0.5, z: 0 });
      }
    } else if (cmd === '/gold') {
      const amt = parseInt(args[1]) || 1000;
      player.gold += amt;
      this.io.to(player.socketId).emit('player_update', { gold: player.gold });
    }
  }

  // Utilitários de Comunicação
  broadcastToMap(mapId, event, data, excludeSocketId = null) {
    const clients = Object.values(this.players).filter(p => p.map === mapId);
    for (let c of clients) {
      if (c.socketId === excludeSocketId) continue;
      this.io.to(c.socketId).emit(event, data);
    }
  }

  sendError(player, text) {
    this.io.to(player.socketId).emit('sys_msg', {
      type: 'error',
      text
    });
  }

  getClientPlayerData(p) {
    return {
      charId: p.characterId,
      name: p.name,
      level: p.level,
      class: p.class,
      hp: p.hp,
      mp: p.mp,
      maxHp: p.derived.maxHp,
      maxMp: p.derived.maxMp,
      map: p.map,
      x: p.x,
      y: p.y,
      z: p.z,
      r: p.r,
      appearance: p.appearance,
      equipment: p.equipment,
      gold: p.gold
    };
  }
}

module.exports = GameEngine;
