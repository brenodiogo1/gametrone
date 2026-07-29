# CHANGELOG (REGISTRO DE MUDANÇAS)
### Chronicles of Aetheria — Marcos de Desenvolvimento e Liberações

Todas as mudanças notáveis deste projeto são registradas neste arquivo sob a numeração de versão semântica (`vMajor.Minor.Patch`).

---

## [v0.1.0-alpha] — 2026-07-29 (Entrega Atual)
### Adicionado (Added)
* **Estrutura Básica Modular:** Divisão limpa de rotas Express, autenticação criptografada, barramento Websocket Socket.io e tabelas SQLite.
* **Sistema de Autenticação Segura:** Endpoints `/register` (com hashes Bcrypt), `/login` e `/verify` utilizando autenticação de tokens **JWT**.
* **Banco de Dados SQLite Completo:** Criação e persistência automática de 10 entidades relacionais chave indexadas e com regras transacionais atômicas contra exploits de duplicação.
* **Motor Autoritativo Multijogador:** Ciclo central de processamento a 10 Ticks por segundo no servidor. Controla movimentação, velocidades (Anti-speedhack) e IAs.
* **20+ Monstros Procedurais Originais:** De slimes a chefões complexos como o lendário *Grande Lorde do Éter*, com tamanhos e cores gerados de forma original.
* **15 Quests Sequenciais de Campanha:** Fluxo estruturado de missões funcionais que guiam o herói por caçadas, coletas de drops e escolhas de vocação avançada.
* **Cena 3D WebGL (Three.js):** Renderização de terrenos e decorações dependentes do bioma de 7 mapas, com interpolação linear suave (LERP) de jogadores e monstros a 60 FPS.
* **Efeitos de Som Sintetizados (Web Audio API):** Som procedural de golpes, magias, loots, level-ups e mortes ativo de forma 100% autônoma no navegador.
* **Painel Administrativo Real integrado:** Consulta de logs de auditoria do SQLite e botões de teleporte rápido, concessão de ouro e spawning controlado de bosses.
* **Suíte de Testes Automatizados Completa:** Execução via `npm run test` cobrindo fórmulas de dano físico/mágico, curvas de experiência de nível e rollback de transação.
