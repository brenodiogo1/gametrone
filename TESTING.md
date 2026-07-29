# DOCUMENTAÇÃO DE TESTES DO JOGO
### Chronicles of Aetheria — Garantia de Qualidade e Integração

O Chronicles of Aetheria possui uma suíte de testes automatizados integrada na pasta `server/test.js`. O objetivo de qualidade é assegurar que todas as regras de negócios econômicas, cálculos matemáticos de combates, progressão de experiência e transações de banco funcionem sob estrita conformidade, bloqueando falhas críticas de race conditions ou duplicações de inventário antes de subir qualquer alteração.

---

## 1. Escopo das Coberturas de Testes

A suíte cobre dois grandes segmentos técnicos recomendados:

### A. Testes Unitários de Fórmulas Matemáticas (Unidade)
* **Atributos Derivados:** Testa a precisão do cálculo de atributos secundários (como HP Máximo, MP Máximo, Pontos de Ataque e Defesa) com base nos atributos customizados e nível do jogador.
* **Curva de Experiência (XP):** Valida a progressão exponencial de XP necessária para cada nível do jogo, garantindo que não haja níveis impossíveis ou que nivelem o herói rápido demais.
* **Fórmula de Dano de Combate:** Testa as equações físicas e mágicas das habilidades contra defesas inimigas, prevendo arredondamentos corretos de floats e impedindo danos negativos.

### B. Testes de Integração com Banco de Dados e Transações
* **Conexão SQLite e Escrita:** Valida se as migrações automáticas de tabelas funcionam na inicialização e testa leituras/gravações simples de contas no SQLite.
* **Transação Atômica de Inventários:** Cria um personagem de semente temporário, inicia uma transação assíncrona real e simula a inserção de itens.
* **Controle de Rollback de Constraints (Antiduplicação):** Tenta violar a constraint composta de slot (`UNIQUE (character_id, slot)`) inserindo dois itens diferentes no mesmo espaço físico do inventário ao mesmo tempo. Valida se o banco reverte e cancela (ROLLBACK) toda a operação automaticamente sem perder integridade dos dados e sem duplicar ouro ou consumíveis.

---

## 2. Como Rodar a Suíte de Testes

Os testes são totalmente independentes e rodam em isolamento em menos de 1 segundo.

Para rodar todos os testes automatizados, execute o script gerenciador a partir da raiz do repositório:
```bash
npm run test
```

### Exemplo de Retorno de Sucesso:
```
> node server/test.js

=========================================================
  INICIANDO SUÍTE DE TESTES UNITÁRIOS E INTEGRAÇÃO DE MMORPG
=========================================================
✔️ [Unitário] Fórmulas de Atributos Derivados: OK
✔️ [Unitário] Curva de Experiência e Nível: OK
✔️ [Unitário] Fórmulas de Dano de Combate: OK
Banco de Dados do Chronicles of Aetheria inicializado com sucesso.
✔️ [Integração] Conexão, Schemas e Escrita no SQLite: OK
✔️ [Integração] Operações Transacionais Antiduplicação e Constraints: OK
=========================================================
  TODOS OS TESTES UNITÁRIOS E INTEGRAÇÃO PASSARAM COM SUCESSO!
=========================================================
```

*Se houver qualquer quebra nos cálculos matemáticos ou nas permissões das tabelas do banco de dados, o script test retornará um código de erro de terminal (`exit code 1`), impedindo builds com bugs de avançarem no pipeline.*
