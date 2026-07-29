# POLÍTICAS DE SEGURANÇA E ANTI-CHEAT
### Chronicles of Aetheria — Diretrizes de Proteção e Confiabilidade

O Chronicles of Aetheria foi desenvolvido sob a premissa de que **o cliente do jogo é potencialmente hostil e pode ser modificado ou clonado**. Nenhum dado enviado diretamente do cliente relativo a ouro, quantidade de itens, experiência, dano infligido ou cooldowns de magias é considerado verdade. O servidor calcula e dita todas as regras fundamentais.

---

## 1. Servidor Autoritativo e Heurísticas de Anti-Cheat

### Proteção Contra Speed Hacks e Teleporte
O servidor grava o timestamp da última movimentação do jogador e compara as posições. 
```js
distancia_percorrida = Sqrt( (x2 - x1)^2 + (z2 - z1)^2 )
tempo_decorrido = (agora - ultimo_movimento) em segundos
velocidade_maxima = (derived.movementSpeed / 10) * tempo_decorrido * buffer_de_latência (2.2)
```
Se a `distancia_percorrida` for maior que a `velocidade_maxima`, o servidor rejeita a posição, loga como atividade suspeita menor e força o cliente a retornar à sua coordenada legítima anterior emitindo o evento `player_correct_position`.

### Validação de Cooldowns de Habilidades
Ao tentar usar uma habilidade, o servidor armazena um mapa de tempos de cooldown para o personagem:
```js
se (agora < cooldowns[skillId]) {
  rejeita_acao("Habilidade em Cooldown");
}
```
Isso impede que modificadores de memória locais no cliente removam os tempos de espera para disparar ataques infinitos.

### Validação de Recursos de Custos (MP)
Toda conjuração consome pontos de Mana (`mp`) direto do cálculo interno do servidor. Se o saldo for inferior ao custo real, a habilidade é cancelada e um pacote de sincronização de status é devolvido para redefinir a barra visual do hacker.

---

## 2. Segurança no Armazenamento de Dados e APIs

### Criptografia de Senhas (Bcrypt)
As senhas de acesso à conta nunca são expostas ou salvas em texto puro. O cadastro utiliza **BcryptJS** com um fator de complexidade de salt de `10`. Isso mitiga riscos de vazamentos e ataques de tabelas arco-íris (*rainbow tables*).

### Autenticação via JSON Web Tokens (JWT)
O estado das conexões de API é mantido de forma segura e stateless utilizando **JWT**. O token é assinado no servidor com um segredo privado forte:
* O token carrega apenas informações de identificação não sensíveis (ID do usuário, email e role).
* O tempo de expiração é fixado em 24 horas para obrigar novas autenticações regulares.

### Sanitização de Mensagens (XSS e Injeções HTML)
A caixa de chat aceita mensagens livres, mas limpa strings e filtra comandos. O servidor substitui tags perigosas como `<` e `>` por entidades amigáveis, bloqueando a injeção de scripts arbitrários (`<script>`) ou componentes HTML invasivos nas telas de outros jogadores que visualizam o log de chat.

### Tratamento e Prevenção de Spam
O servidor mantém um controle de data para o chat de cada personagem. Se a diferença de tempo entre duas mensagens consecutivas for inferior a **1.0 segundo**, a mensagem é bloqueada como spam e o remetente recebe um aviso sonoro e visual temporário de bloqueio.
```js
if (agora - player.lastChatTime < 1000) {
  rejeita_mensagem("Anti-Spam ativo");
}
```
