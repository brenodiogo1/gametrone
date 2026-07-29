# ARQUITETURA DO SISTEMA
### Chronicles of Aetheria — Engenharia de Software e Fluxo de Dados

A arquitetura do Chronicles of Aetheria é estruturada de forma modular, aderindo à filosofia **Cliente-Servidor Autoritativo**. O cliente funciona estritamente como um terminal de renderização visual de 3D, coleta de inputs do usuário e envio de intenções de ação, enquanto o servidor determina e valida todo o estado do universo virtual.

```
       [ CLIENTE WEB ] (WebGL / Three.js)
              |
              | Sockets (Socket.io) / HTTPS JSON APIs
              v
     [ SERVIDOR EXPRESS ] <---> [ CONTROLADOR AUTORITATIVO (game.js) ]
              |                                 |
              | Escritas/Leituras               | Transações Seguras
              v                                 v
     [ SERVIÇO PERSISTENTE ] <-------------> [ BANCO SQLITE (aetheria.db) ]
```

---

## 1. Cliente do Jogo (public/)

O frontend do jogo é projetado para máxima performance em navegadores desktop e móveis, utilizando um loop de renderização reativo que não consome recursos desnecessários.

* **Camada de Renderização 3D (`js/renderer.js`):**
  * Desenvolvida em **Three.js (WebGL)** sem dependências externas de assets.
  * **Terreno Procedural:** Gera malhas low-poly de terreno sob demanda com base nas dimensões e biomas (Meadows, Forest, Cave, ruins) informados pelo mapa ativo.
  * **Modelagem e Equipamentos Procedurais:** Os personagens e monstros são construídos por composições geométricas básicas (cilindros, caixas, cones e esferas). Equipamentos são injetados dinamicamente nos pontos de ancoragem (sockets de junção) do grupo do jogador quando atualizados.
  * **Interpolação de Entidades (LERP):** Para suavizar a taxa de rede do servidor (10 Hz), o cliente executa uma interpolação linear suave em cada frame (60 Hz) entre a posição visual atual e a coordenada final fornecida pelo soquete.
  * **Partículas:** Gerencia pequenas explosões de partículas físicas para impactos e feixes luminosos para level-ups diretamente no espaço 3D.

* **Camada de Gerenciamento HUD (`js/ui.js`):**
  * Controla o fluxo de telas através de chamadas do DOM.
  * **Efeitos de Áudio Procedurais (Web Audio API):** Gera efeitos de áudio em tempo real sintetizando frequências de ondas (Seno, Dente de Serra e Triângulo) sem consumir banda baixando arquivos pesados de som.
  * **Mochila e Equipamentos Drag/Click:** Controla os slots do inventário, aplicando classes visuais com base nas raridades dos itens.

* **Camada do Cliente de Sockets (`js/game.js`):**
  * Centraliza os manipuladores de eventos do Socket.io.
  * Captura os comandos de teclado WASD + Shift e cliques de mira 3D (Raycasting) e os transmite de maneira compacta para o servidor.

---

## 2. Servidor do Jogo (server/)

O backend é projetado em Node.js com foco em escalabilidade de canais de soquete em tempo real, segurança de payload e atomicidade de banco.

* **Servidor HTTP Express (`server.js`):**
  * Hospeda APIs REST para cadastros, logins e recuperação de dados de personagens de forma assíncrona.
  * Serve os arquivos estáticos compilados para o navegador.

* **Servidor de Autenticação (`auth.js`):**
  * Criptografa senhas de usuários com o algoritmo robusto de hashes `bcryptjs` antes de persistir no banco.
  * Controla acessos à rede através de tokens assinados **JWT (JSON Web Tokens)** válidos por 24 horas.
  * Implementa filtragem contra nomes ofensivos e caracteres de injeção em personagens novos.

* **Motor Multiplayer Autoritativo (`game.js`):**
  * **Loop de Simulação Física e IA (10 Ticks por segundo):** Atualiza posições de monstros no mapa, decide reações de combate com base em raios de detecção de aggro e persegue ou ataca jogadores.
  * **Validação de Movimentação (Speedhack Check):** Compara a distância percorrida pelo jogador em relação ao tempo (`dt`) de sua última mensagem contra o seu atributo de velocidade calculado. Se houver teleporte impossível ou velocidade de hack, o servidor força a correção do jogador para a sua última coordenada legítima.
  * **Validação de Combates e Habilidades:** Quando uma requisição de ataque básico ou skill (`use_skill`) chega, o servidor valida se o jogador está vivo, possui pontos de MP suficientes, se a skill já saiu de seu cooldown individual e se o monstro está no alcance geométrico da magia.

* **Persistência de Dados (`db.js`):**
  * Executa em um banco relacional SQLite local rápido e resiliente.
  * Implementa **Transações Atômicas** (`BEGIN/COMMIT/ROLLBACK`). Operações econômicas sensíveis (como comprar itens, vender itens do inventário ou receber recompensas de quests) são envelopadas em escopos transacionais de Rollback. Se uma etapa falhar ou houver desconexão abrupta, a transação reverte para o estado anterior íntegro, eliminando riscos de duplicação de itens.
