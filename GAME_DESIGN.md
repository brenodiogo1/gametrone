# DESIGN DO JOGO (GAME DESIGN DOCUMENT)
### Chronicles of Aetheria — Universo, Progressão, Quests e Economia

---

## 1. Lore e História do Mundo

O mundo de **Aetheria** é sustentado por correntes invisíveis de pura magia chamadas **Veios de Éter**. Durante séculos, as grandes cidades aprenderam a prosperar colhendo essa energia para iluminar reinos e alimentar tecnologias mágicas discretas. 

Recentemente, porém, misteriosas rupturas começaram a ocorrer nas bordas dos continentes. Estas falhas alteraram criaturas outrora dóceis (transformando-as em monstros agressivos), despertaram ruínas de antigas civilizações esquecidas e corromperam os corações dos homens mais fracos.

Os jogadores encarnam os novos **Aetherbound** (Vinculados ao Éter): heróis nascidos com a rara habilidade espiritual de enxergar os veios de energia e fechar as rupturas. A missão de sua jornada é progredir, treinar, se aliar a outros aventureiros e erradicar a corrupção de éter que assombra as ruínas sagradas do reino.

---

## 2. Progressão de Personagem e Atributos

A progressão baseia-se em níveis (até o 99) e na distribuição estratégica de pontos para calibrar as estatísticas derivadas do combate:

### Atributos Básicos
* **Strength (FOR):** Aumenta o Ataque Físico.
* **Vitality (VIT):** Aumenta o HP Máximo e a Defesa Física.
* **Agility (AGI):** Aumenta a velocidade de movimento, velocidade de ataque e a Esquiva do personagem.
* **Dexterity (DES):** Aumenta a Precisão de acerto físico e reduz o tempo de conjuração de magias.
* **Intelligence (INT):** Aumenta o Dano Mágico elemental e o MP Máximo.
* **Spirit (ESP):** Aumenta a cura gerada e a Defesa Mágica contra monstros elementais.
* **Luck (SOR):** Aumenta a chance de golpes críticos e dá um leve bônus geral na precisão e esquiva.

### Fórmulas Matemáticas de Combate
```js
HP_MAX = 100 + (VIT * 15) + (LEVEL * 20)
MP_MAX = 50 + (INT * 8) + (SPR * 12) + (LEVEL * 5)
ATAQUE_FISICO = 10 + (STR * 2) + (DEX * 0.5) + (LEVEL * 1.5)
DEFESA_FISICA = 5 + (VIT * 1.5) + (LEVEL * 1.0)
DAN_FISICO_FINAL = Max(1, ATK_FIS_ATACANTE - DEF_FIS_DEFENSOR * 0.5)
```

---

## 3. Árvore de Classes e Evoluções

Todos os jogadores começam sua jornada como a classe básica **Adventurer**. Ao alcançarem o **Nível 10**, eles podem conversar com os Instrutores de Classe na Capital e escolher uma das seguintes vocações primárias:

```
                      [ ADVENTURER ] (Nível 1)
                            |
         +------------------+------------------+
         |                  |                  |
    [ VANGUARD ]       [ RANGER ]        [ ARCANIST ]
    (Corpo a Corpo /    (Atirador /       (Mago Elemental)
     Alta Defesa)        Mobilidade)           |
         |                  |                  |
    [ ACOLYTE ]        [ SHADOWBLADE ]         v
    (Suporte /          (Assassino /     (Segundas Classes -
     Curas / Luz)        Furtivo)         Futura Expansão)
```

---

## 4. O Fluxo de 15 Quests Iniciais do Vertical Slice

O jogo oferece uma esteira narrativa contínua que guia o jogador desde seus primeiros passos até as ruínas de nível avançado:

1. **Primeiros Passos em Aetheria:** Ensina movimentação WASD com o Mentor Eldrin.
2. **Armando o Aventureiro:** Conversar com Grom para ganhar a arma inicial.
3. **Seu Primeiro Combate:** Abater 3 slimes no campo de treinamento.
4. **Coletando Suprimentos:** Trazer 2 núcleos gelatinosos de Slimes para Grom.
5. **A Sacerdotisa Luna:** Falar com Luna para aprender sobre curas e restauração.
6. **Ameaça dos Mossy Pups:** Abater 3 caninos selvagens que ameaçam o vilarejo.
7. **As Teias Pegajosas:** Coletar 2 Teias de Aranha para o Alquimista Raza.
8. **O Mistério das Rupturas:** Abater 3 Aranhas do Éter e coletar fragmentos.
9. **Ascendendo sua Vocação:** Alcançar nível 10 para escolher a classe avançada.
10. **Entregando a Carta:** Levar a carta de Eldrin para o Comandante na Capital.
11. **Purificando as Cavernas:** Destruir 5 Escaravelhos de Cristal na caverna escura.
12. **O Desafio dos Golems:** Entregar 1 Minério de Ferro Antigo coletado de Golems.
13. **O Rei da Floresta:** Eliminar o mini-boss Rei Treant no coração da floresta.
14. **Invasão das Ruínas:** Enfrentar 5 Cultistas de Éter corrompido nas masmorras.
15. **Destruindo o Lorde do Éter:** Unir forças e abater o Chefe de Região (Grande Lorde).

---

## 5. Matriz de Elementos de Combate

Monstros e habilidades possuem tipos elementais. O dano mágico do Arcanist e do Acolyte ressonam com base nas seguintes fraquezas:

| Atacante \ Defensor | Neutral | Fire | Water | Wind | Earth | Light | Shadow | Poison |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Fire (Fogo)** | 1.0x | 0.5x | 0.5x | 1.5x | 2.0x | 1.0x | 1.0x | 1.0x |
| **Water (Água)** | 1.0x | 2.0x | 0.5x | 0.5x | 1.5x | 1.0x | 1.0x | 1.0x |
| **Wind (Vento)** | 1.0x | 0.5x | 2.0x | 0.5x | 0.5x | 1.0x | 1.0x | 1.0x |
| **Earth (Terra)** | 1.0x | 1.5x | 0.5x | 2.0x | 0.5x | 1.0x | 1.0x | 1.0x |
| **Light (Sagrado)** | 1.0x | 1.0x | 1.0x | 1.0x | 1.0x | 0.5x | 2.0x | 1.0x |
| **Shadow (Trevas)**| 1.0x | 1.0x | 1.0x | 1.0x | 1.0x | 2.0x | 0.5x | 0.5x |
