# PROTOCOLO DE REDE MULTIPLAYER
### Chronicles of Aetheria — Sockets e Estrutura de Pacotes

A comunicação em tempo real de Chronicles of Aetheria é suportada pelo **Socket.io** rodando sobre WebSockets. O protocolo de rede transmite dados empacotados em JSON com estruturas de dados otimizadas para reduzir latência e overhead de transporte de frames.

---

## 1. Fluxo de Vida de Conexão

```
   CLIENTE                                            SERVIDOR
      |                                                  |
      | ------ join_world (charId) -------------------> |
      | <----- world_enter_success (player data) ------ |
      | <----- map_init_state (mobs, players) --------- |
      |                                                  |
      | ====== LOOP DE GAMEPLAY EM TEMPO REAL ========== |
      |                                                  |
      | ------ player_move (x,y,z,r) -----------------> |
      | <----- world_sync (compact positions) --------- |  (10 Ticks/sec)
      |                                                  |
      | ------ use_skill (skillId, targetId) ----------> |
      | <----- combat_event (attacker, dmg, hp) -------- |  (Ao atingir)
      |                                                  |
      | ------ disconnect -----------------------------> |
      | <----- player_despawn (charId) ---------------- |
```

---

## 2. Dicionário de Eventos: Enviados pelo Cliente (Client-to-Server)

### `join_world`
Sinaliza que o jogador passou pela autenticação e escolheu o personagem que vai entrar na simulação física 3D do mundo.
* **Payload:**
  ```json
  { "charId": "char_92m4k3js1" }
  ```

### `player_move`
Envia coordenadas locais validadas pelas colisões do cliente de forma veloz para propagação.
* **Payload:**
  ```json
  { "x": 12.35, "y": 0.5, "z": -45.12, "r": 3.14 }
  ```

### `use_skill`
Intenção de ataque básico ou conjuração de magia de combate contra um alvo trancado.
* **Payload:**
  ```json
  { "skillId": "Firebolt", "targetId": "mob_7k2js8x4" }
  ```

### `pickup_loot`
Solicita a coleta de um item de drop presente no solo do mapa.
* **Payload:**
  ```json
  { "lootId": "loot_x89js3k1b" }
  ```

### `npc_interact`
Ações genéricas de cliques em NPCs para receber missões, comprar elixires ou evoluir caminhos de classe.
* **Payload:**
  ```json
  {
    "npcId": "FerreiroGrom",
    "action": "shop_buy", // shop_buy, shop_sell, quest_accept, quest_complete, class_change_execute
    "target": "NoviceSword"
  }
  ```

---

## 3. Dicionário de Eventos: Enviados pelo Servidor (Server-to-Client)

### `world_sync` (Compactado)
Enviado 10 vezes por segundo a todos os jogadores de um mapa. Contém posições e estados condensados de monstros para reduzir uso de banda.
* **Payload:**
  ```json
  {
    "mobs": [
      { "id": "mob_s7x2", "x": 14.5, "z": -3.2, "r": 1.2, "hp": 45, "state": "chase" }
    ]
  }
  ```

### `combat_event`
Sincroniza danos sofridos ou curas de forma instantânea para renderizar números flutuantes e animações.
* **Payload:**
  ```json
  {
    "type": "player_attack", // player_attack, monster_attack, heal, miss
    "attackerId": "char_92m4k3",
    "defenderId": "mob_s7x2",
    "damage": 34,
    "isCrit": true,
    "newHp": 11
  }
  ```

### `player_spawn` / `player_despawn`
Adiciona ou remove visuais de outros jogadores que entraram ou saíram do mapa ao seu redor.
* **Payload (`player_spawn`):**
  ```json
  {
    "charId": "char_82n4ks",
    "name": "ArqueiroVento",
    "level": 12,
    "class": "Ranger",
    "x": 0.5, "y": 0.5, "z": 1.2, "r": 0.0,
    "appearance": { "skinColor": "#ffd1a9", "hairStyle": "hair_spiky", "hairColor": "#e53935" }
  }
  ```
