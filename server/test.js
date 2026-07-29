// Chronicles of Aetheria - Suíte de Testes Automatizados (Fórmulas, Persistência e Regras)
// Valida fórmulas de combate, ganho de XP, distribuição de atributos, regras de inventário e banco de dados.

const { calculateDerivedStats, XP_LEVELS, SKILLS } = require('./game_data');
const { initDatabase, query, transaction } = require('./db');
const assert = require('assert');

async function runTests() {
  console.log("=========================================================");
  console.log("  INICIANDO SUÍTE DE TESTES UNITÁRIOS E INTEGRAÇÃO DE MMORPG");
  console.log("=========================================================");

  let errors = 0;

  // 1. TESTE UNITÁRIO: Fórmulas de Atributos Derivados
  try {
    const mockStats = { str: 10, vit: 10, agi: 10, dex: 10, int: 10, spr: 10, luk: 10 };
    const derived = calculateDerivedStats(mockStats, 1, 'Adventurer');

    assert.strictEqual(derived.maxHp, 100 + 10 * 15 + 1 * 20); // 270
    assert.strictEqual(derived.maxMp, 50 + 10 * 8 + 10 * 12 + 1 * 5); // 255
    console.log("✔️ [Unitário] Fórmulas de Atributos Derivados: OK");
  } catch (err) {
    console.error("❌ [Unitário] Erro em Atributos Derivados:", err.message);
    errors++;
  }

  // 2. TESTE UNITÁRIO: Curva de Experiência e Nível
  try {
    assert.strictEqual(XP_LEVELS[0], 100); // Level 1 -> 100 XP
    assert.ok(XP_LEVELS[9] > 500); // Level 10 deve exigir quantidade significativa
    console.log("✔️ [Unitário] Curva de Experiência e Nível: OK");
  } catch (err) {
    console.error("❌ [Unitário] Erro na Curva de XP:", err.message);
    errors++;
  }

  // 3. TESTE UNITÁRIO: Fórmulas de Dano de Combate
  try {
    const attacker = {
      derived: { physicalAttack: 30, magicAttack: 25 }
    };
    const defender = {
      derived: { physicalDefense: 10, magicDefense: 8 }
    };

    // Teste Golpe Básico (BasicStrike)
    const physicalDamage = SKILLS.BasicStrike.formula(attacker, defender);
    // formula: Math.max(1, Math.round(atk * 1.0 - def * 0.5)) -> 30 - 5 = 25
    assert.strictEqual(physicalDamage, 25);

    // Teste Lança de Fogo (Firebolt)
    const magicDamage = SKILLS.Firebolt.formula(attacker, defender);
    // formula: Math.max(1, Math.round(matk * 1.5 - mdef * 0.5)) -> 37.5 - 4 = 34
    assert.strictEqual(magicDamage, 34);

    console.log("✔️ [Unitário] Fórmulas de Dano de Combate: OK");
  } catch (err) {
    console.error("❌ [Unitário] Erro nas Fórmulas de Dano:", err.message);
    errors++;
  }

  // 4. TESTE DE INTEGRAÇÃO: Banco de dados, Conexão e Schemas
  try {
    await initDatabase();
    
    // Testa gravação simples e recuperação de usuário teste
    const testId = 'test_usr_99';
    await query.run('DELETE FROM users WHERE id = ?', [testId]);
    await query.run(
      'INSERT INTO users (id, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)',
      [testId, 'test@aetheria.com', 'hashed_pass', 'user', Date.now()]
    );

    const retrieved = await query.get('SELECT * FROM users WHERE id = ?', [testId]);
    assert.strictEqual(retrieved.email, 'test@aetheria.com');

    await query.run('DELETE FROM users WHERE id = ?', [testId]);
    console.log("✔️ [Integração] Conexão, Schemas e Escrita no SQLite: OK");
  } catch (err) {
    console.error("❌ [Integração] Erro no Banco de dados:", err.message);
    errors++;
  }

  // 5. TESTE DE INTEGRAÇÃO: Transações Atômicas de Inventário (Antiduplicação)
  try {
    const seedUserId = 'usr_seed';
    const charId = 'test_char_99';
    
    // Limpa registros velhos de forma segura
    await query.run('DELETE FROM inventories WHERE character_id = ?', [charId]);
    await query.run('DELETE FROM characters WHERE id = ?', [charId]);
    await query.run('DELETE FROM users WHERE id = ?', [seedUserId]);

    // Insere Usuário Pai Semente (Foreign Key Requirement)
    await query.run(`
      INSERT INTO users (id, email, password_hash, role, created_at)
      VALUES (?, 'seed@aetheria.com', 'hash', 'user', ?)
    `, [seedUserId, Date.now()]);

    // Insere personagem semente
    await query.run(`
      INSERT INTO characters (id, user_id, name, created_at)
      VALUES (?, ?, 'Test_Hero', ?)
    `, [charId, seedUserId, Date.now()]);

    // Executa transação simulando inserção bem sucedida de item
    const txResult = await transaction(async (tx) => {
      await tx.run(`
        INSERT INTO inventories (id, character_id, item_id, slot, quantity, rarity)
        VALUES (?, ?, 'RedPotion', 0, 5, 'Common')
      `, ['inv_test_1', charId]);
      return true;
    });

    assert.strictEqual(txResult, true);

    const inv = await query.get('SELECT * FROM inventories WHERE character_id = ?', [charId]);
    assert.strictEqual(inv.item_id, 'RedPotion');
    assert.strictEqual(inv.quantity, 5);

    // Tenta violar constraint de slot duplicado (unique key) e valida reversão (ROLLBACK) automática
    let didFail = false;
    try {
      await transaction(async (tx) => {
        // Tenta gravar item no mesmo slot 0 (Constraint Violation!)
        await tx.run(`
          INSERT INTO inventories (id, character_id, item_id, slot, quantity, rarity)
          VALUES (?, ?, 'BluePotion', 0, 1, 'Common')
        `, ['inv_test_2', charId]);
      });
    } catch (e) {
      didFail = true; // Falhou corretamente!
    }

    assert.strictEqual(didFail, true);

    // Confirma que a tabela de inventários mantém apenas o primeiro item e não duplicou nada
    const finalInv = await query.all('SELECT * FROM inventories WHERE character_id = ?', [charId]);
    assert.strictEqual(finalInv.length, 1);
    assert.strictEqual(finalInv[0].item_id, 'RedPotion');

    // Limpa sementes ao fim do teste
    await query.run('DELETE FROM inventories WHERE character_id = ?', [charId]);
    await query.run('DELETE FROM characters WHERE id = ?', [charId]);
    await query.run('DELETE FROM users WHERE id = ?', [seedUserId]);

    console.log("✔️ [Integração] Operações Transacionais Antiduplicação e Constraints: OK");
  } catch (err) {
    console.error("❌ [Integração] Erro no Teste Transacional:", err.message);
    errors++;
  }

  console.log("=========================================================");
  if (errors === 0) {
    console.log("  TODOS OS TESTES UNITÁRIOS E INTEGRAÇÃO PASSARAM COM SUCESSO!");
    console.log("=========================================================");
    process.exit(0);
  } else {
    console.log(`  SUÍTE CONCLUÍDA COM ${errors} FALHA(S). CORRIJA ANTES DE PUBLICAR.`);
    console.log("=========================================================");
    process.exit(1);
  }
}

runTests();
