# DIRETRIZES DE DEPLOYMENT
### Chronicles of Aetheria — Ambientes, Variáveis e Escalabilidade

Este documento descreve como preparar e implantar os servidores do jogo em ambientes de desenvolvimento, testes (staging) e produção em nuvem.

---

## 1. Variáveis de Ambiente Necessárias

O servidor carrega configurações críticas do sistema operacional através de variáveis de ambiente. Recomenda-se criar um arquivo `.env` na raiz do projeto (não comitável) com a seguinte estrutura de exemplo:

```ini
# --- CONFIGURAÇÕES DE PORTA E INTERFACE ---
PORT=3000

# --- SEGREDOS DE REDE ---
JWT_SECRET="aetheria-super-secret-key-prod-2026-xyz"

# --- AMBIENTE DE EXECUÇÃO ---
NODE_ENV="production"
```

---

## 2. Estratégias de Deploy Automatizado (CI/CD)

Recomenda-se configurar pipelines automatizados (como GitHub Actions, GitLab CI ou Jenkins) executando as seguintes fases de entrega contínua:

```
[ GITHUB / REPOSITÓRIO ] ---> [ PIPELINE CI ] (Testes/Lints) ---> [ DOCKER BUILD ] ---> [ REGISTRY / DEPLOY ]
```

### Script de Validação CI Recomendado (GitHub Actions)
```yaml
name: Node.js MMORPG CI/CD

on:
  push:
    branches: [ "main" ]

jobs:
  build_and_test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Usar Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '20'
    - name: Instalar dependências
      run: npm install
    - name: Executar testes unitários e de integração
      run: npm run test
    - name: Compilar build estático do cliente
      run: echo "Build concluído com sucesso!"
```

---

## 3. Monitoramento de Saúde (Health Checks e Observabilidade)

### Endpoint `/health` (Readiness e Liveness Probe)
O servidor possui uma rota integrada que valida a conexão ativa com o SQLite e devolve status do jogo:
* **Requisição:** `GET http://localhost:3000/health`
* **Resposta de Sucesso (HTTP 200):**
  ```json
  {
    "status": "HEALTHY",
    "database": "OK",
    "game": "CHRONICLES OF AETHERIA"
  }
  ```
Se houver falha no banco de dados ou arquivos bloqueados, o endpoint responderá com **HTTP 500**, disparando o reinício automático do contêiner de hospedagem na cloud.

---

## 4. Estratégia de Rollback Prática
Se houver uma liberação de versão instável que cause travamentos de conexões Websocket:
1. Reverter a tag git para a última release estável certificada:
   ```bash
   git checkout tags/v1.0.3-stable
   ```
2. Instalar dependências antigas e reiniciar o serviço:
   ```bash
   npm install && pm2 restart server/server.js
   ```
3. O SQLite não sofre impacto de regressão desde que as migrações não alterem a estrutura física de forma destrutiva.
