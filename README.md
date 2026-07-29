# CHRONICLES OF AETHERIA (CÔNICAS DE AETHERIA)
### MMORPG 3D Multiplayer Online Autoritativo - Vertical Slice Completo

**Chronicles of Aetheria** é um jogo online persistente completo inspirado na era de ouro dos MMORPGs clássicos (como Ragnarok Online). O jogo traz uma fusão elegante de gráficos 3D Low-Poly estilizados e processamento de estado de rede autoritativo e robusto no servidor.

O núcleo do projeto foi construído do zero sem dados fictícios (mockups). Todo movimento, combate, ganho de experiência, drops de itens, conclusões de missões (quests) e comércio é validado e processado no servidor por meio de uma arquitetura modular moderna e segura baseada em Node.js, Socket.io e SQLite.

---

## 🚀 Como Iniciar o Servidor do Jogo Localmente

Siga o guia passo a passo para colocar os servidores online em menos de 1 minuto:

### Pré-requisitos
Certifique-se de ter instalado:
* **Node.js** (v18 ou superior)
* **npm** (v9 ou superior)

### 1. Clonar ou Acessar a Raiz do Repositório
Acesse a pasta principal do projeto no seu terminal:
```bash
cd /home/user
```

### 2. Instalar Dependências do Jogo
Instale as dependências nativas e de rede (Express, Socket.io, SQLite3, Bcrypt, JWT) executando:
```bash
npm install
```

### 3. Rodar a Suíte de Testes Automatizados
Antes de iniciar os servidores, execute a suíte de validação de integridade matemática e transacional:
```bash
npm run test
```
*Tudo deve retornar verde (OK)!*

### 4. Iniciar o Servidor do Jogo
Execute o comando de inicialização padrão:
```bash
npm start
```
Você verá um banner confirmando a ativação:
```
=============================================================
  SERVIDORES DO CHRONICLES OF AETHERIA ONLINE JOGÁVEIS       
  Porta: 3000 | IP: http://localhost:3000                    
=============================================================
```

O cliente do jogo é servido de forma estática pelo Express e pode ser acessado em qualquer navegador moderno com suporte a WebGL no endereço: **`http://localhost:3000`**

---

## 🎮 Controles do Reino de Aetheria (Desktop & Mobile)

* **Andar/Movimentação:** Teclas **W, A, S, D** (ou setas direcionais).
* **Correr:** Segure **Shift** enquanto anda.
* **Câmera Rotação:** Segure o **Botão Direito do Mouse** e arraste para mudar a órbita horizontal (Yaw) ou inclinação vertical (Pitch).
* **Câmera Zoom:** Use a **Roda do Mouse (Scroll)** para aproximar ou afastar a câmera.
* **Selecionar Alvo:** Clique com o **Botão Esquerdo do Mouse** em qualquer criatura do mapa para trancar o alvo.
* **Utilizar Habilidades:** Teclas **1** a **5** disparam magias ou golpes físicos no alvo trancado.
* **Consumir Poções:** Tecla **6** consome uma Poção Vermelha rapidamente do inventário.
* **Pegar Loot do Chão:** Clique esquerdo sobre os saquinhos de drops brilhantes gerados pelo servidor ao derrotar monstros.
* **Portais:** Caminhe em direção aos anéis azuis brilhantes nas bordas dos mapas para viajar para a próxima região do mundo.
* **Atalhos Rápidos de Janelas:**
  * **C** - Atributos de Personagem (Estatísticas e pontos adicionais).
  * **I** - Inventário (Mochila de itens e visual de equipamentos equipados).
  * **K** - Árvore de Habilidades da Classe ativa.
  * **Enter** - Ativa a caixa de texto de Chat.
  * **Esc** - Fecha qualquer janela aberta ou abre painel de Ajuda.

---

## 🛡️ Conta e Personagem Administrador Padrão (Semente)
Para fins de testes, demonstração e inspeção de todas as funcionalidades de forma facilitada, o banco de dados é automaticamente semeado com uma conta administrativa:

* **E-mail:** `admin@aetheria.com`
* **Senha:** `admin123456`
* **Personagem:** `Admin_Aetheria` (Nível 99, Vanguard, 999.999 Moedas de Ouro)

### Como Usar Comandos Administrador
Logado com este personagem, você pode clicar no botão **`⚙️ Admin`** (canto superior direito) para abrir o Painel Administrativo em tempo real e consultar os logs de auditoria do SQLite, ou digitar comandos de chat com barra (`/`) direto no console:
* `/gold 10000` - Adiciona 10.000 moedas de ouro ao personagem.
* `/tp Capital` - Teleporta instantaneamente para a Cidade Imperial.
* `/tp Town` - Teleporta de volta para o vilarejo inicial.
* `/tp Dungeon` - Teleporta para a Dungeon Sagrada de nível avançado.
* `/spawn AetherLorde` - Spawna o chefe mundial (Grande Lorde do Éter) no mapa ativo.
* `/spawn TreantKing` - Spawna o mini-boss Rei Treant.

---

## 🛠️ Estrutura do Repositório do Jogo

O projeto é dividido em uma estrutura modular limpa separando cliente, servidor e banco de dados:

```
/home/user/
├── package.json               # Gerenciador de scripts e dependências npm
├── README.md                  # Documento principal explicativo de uso
├── ARCHITECTURE.md            # Arquitetura do sistema do jogo
├── GAME_DESIGN.md             # Visão conceitual, lore, classes e quests
├── DATABASE.md                # Esquema de tabelas, índices e constraints do SQLite
├── NETWORK_PROTOCOL.md        # Documentação dos pacotes de dados Socket.io
├── SECURITY.md                # Medidas de segurança contra speedhacks e exploits
├── DEPLOYMENT.md              # Diretrizes para ambientes cloud e monitoramento
├── CONTENT_PIPELINE.md        # Guia para modelagem 3D, ícones e trilhas sonoras
├── TESTING.md                 # Descrição e execução da suíte de testes
├── CHANGELOG.md               # Histórico de versões e marcos
├── ROADMAP.md                 # Passos futuros de expansão
├── server/
│   ├── server.js              # Inicializador principal (HTTP, Sockets e Rotas API)
│   ├── db.js                  # Conector e gerenciador do banco SQLite
│   ├── auth.js                # Servidor de Autenticação, Cadastro e Login
│   ├── game_data.js           # Arquivo estático com definições do jogo
│   ├── game.js                # Motor de jogo autoritativo principal (Ticks, Combate, IA)
│   └── test.js                # Arquivo executável de suíte de testes
└── public/
    ├── index.html             # Estrutura HTML de HUD e interfaces
    ├── css/
    │   └── style.css          # Estilo visual completo com estética RPG
    └── js/
        ├── renderer.js        # Renderizador 3D (Three.js Low-Poly, Partículas e LERP)
        ├── ui.js              # Gerenciador de janelas HUD e Sfx Procedurais
        └── game.js            # Loop de input local, Raycast 3D e sockets cliente
```
