# MODELO DE DADOS (DATABASE DESIGN)
### Chronicles of Aetheria — Esquema, Integridade e Consultas

O Chronicles of Aetheria armazena todos os seus dados dinâmicos e de progressão no banco relacional **SQLite** localizado em `server/aetheria.db`. A estrutura de tabelas foi desenhada utilizando chaves estrangeiras (`FOREIGN KEY`), constraints de integridade contra valores negativos e índices para otimização de consultas frequentes.

---

## 1. Esquema de Tabelas (DDL)

```
        +------------------+
        |      users       |
        +------------------+
        | id (PK)          |<-------+
        | email            |        |
        | password_hash    |        |
        | role             |        |
        +------------------+        |
                 |                  |
                 | 1:N              |
                 v                  |
        +------------------+        |
        |    characters    |        |
        +------------------+        |
        | id (PK)          |<---+   |
        | user_id (FK)     |----+---+
        | name             |    |
        | level            |    |
        | gold             |    |
        | map, x, y, z     |    |
        +------------------+    |
         |        |             |
         | 1:1    | 1:N         |
         v        v             |
  +------------+ +------------+ |
  | char_stats | |inventories | |
  +------------+ +------------+ |
  | str, vit   | | item_id    | |
  | agi, dex   | | slot       | |
  | int, spr   | | quantity   | |
  +------------+ +------------+ |
                        |       |
                        +-------+
```

---

## 2. Dicionário de Entidades Principais

### Tabela `users`
Guarda as credenciais básicas das contas dos jogadores.
* `id` (TEXT, PK): Identificador UUID (`usr_...`).
* `email` (TEXT, UNIQUE): E-mail de cadastro, sanitizado e indexado.
* `password_hash` (TEXT): Hash seguro de senha gerado com `bcryptjs`.
* `role` (TEXT): Níveis de privilégios (`user`, `admin`).
* `created_at` (INTEGER): Timestamp de registro.

### Tabela `characters`
Guarda os dados geográficos e cosméticos do personagem.
* `id` (TEXT, PK): Identificador UUID (`char_...`).
* `user_id` (TEXT, FK): Vinculado ao dono da conta. Se o usuário for deletado, os personagens somem em cascata (`ON DELETE CASCADE`).
* `name` (TEXT, UNIQUE): Nome único trancado por índice alfabético único.
* `level` (INTEGER): Nível atual (default 1).
* `xp` (INTEGER): Quantidade de experiência atual acumulada.
* `class` (TEXT): Classe do personagem (ex: `Adventurer`, `Vanguard`).
* `gold` (INTEGER): Saldo financeiro, trancado contra saldos negativos (`CHECK (gold >= 0)`).
* `map` (TEXT): Mapa ativo onde o jogador está localizado (ex: `Town`, `Fields`).
* `x, y, z, r` (REAL): Coordenadas espaciais e rotação tridimensional do herói.

### Tabela `character_stats`
Atributos numéricos de customização de força do jogador. Relacionamento 1:1 com `characters`.
* `character_id` (TEXT, PK, FK): Chave estrangeira que aponta para `characters(id) ON DELETE CASCADE`.
* `str, vit, agi, dex, int, spr, luk` (INTEGER): Atributos básicos. Protegidos por constraint contra valores nulos ou inferiores a 1 (`CHECK (str >= 1)`).
* `stat_points` (INTEGER): Pontos de atributo sobrando para gastar.
* `skill_points` (INTEGER): Pontos de habilidade sobrando para distribuir.

### Tabela `inventories`
Controle dinâmico da mochila dos heróis. Cada item inserido ocupa um slot específico.
* `id` (TEXT, PK): Identificador único da linha (`inv_...`).
* `character_id` (TEXT, FK): Chave que aponta para o dono do inventário.
* `item_id` (TEXT): Nome identificador do item da lista estática (ex: `RedPotion`).
* `slot` (INTEGER): Número do slot na grade visual (0 a 29).
* `quantity` (INTEGER): Quantidade do item empilhado no slot (`CHECK (quantity >= 1)`).
* `rarity` (TEXT): Raridade gravada (`Common`, `Rare`, `Legendary`).
* `is_equipped` (INTEGER): Booleano rápido (0 ou 1) que sinaliza se o item está preso ao corpo.
* **Integridade:** Possui uma restrição de unicidade composta `UNIQUE (character_id, slot)`. Isso impede fisicamente que duas queries gravem dados no mesmo slot ao mesmo tempo, eliminando colisões de rede.

---

## 3. Índices de Desempenho
O SQLite indexa automaticamente as chaves primárias. Adicionalmente, criamos índices explícitos nas tabelas para buscas por mapa, usuário e filtros de inventários:
```sql
CREATE INDEX IF NOT EXISTS idx_characters_user ON characters(user_id);
CREATE INDEX IF NOT EXISTS idx_inventories_char ON inventories(character_id);
CREATE INDEX IF NOT EXISTS idx_quests_char ON character_quests(character_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
```

---

## 4. Estratégia de Backup e Restauração
Por ser um banco de arquivo único SQLite, o procedimento de backup consiste em uma cópia direta a frio do arquivo, ou por uma chamada segura `VACUUM INTO` a quente:

### Backup Online Seguro (Sem parar o jogo):
```bash
sqlite3 server/aetheria.db "VACUUM INTO 'server/aetheria_backup_$(date +%F).db';"
```

### Restauração Completa:
```bash
cp server/aetheria_backup_2026-07-29.db server/aetheria.db
```
*(Nota: Certifique-se de derrubar os servidores do Node antes de substituir o arquivo do banco em produção).*
