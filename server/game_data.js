// Chronicles of Aetheria - Definindo os Dados do Jogo (Configurações Estáticas)
// Contém as definições de classes, habilidades, itens, monstros, mapas e quests.

const GAME_NAME = "CHRONICLES OF AETHERIA";

const CLASSES = {
  Adventurer: {
    name: "Adventurer",
    description: "Um jovem aventureiro em busca de destino.",
    allowedWeapons: ["Sword", "Dagger", "Staff", "Bow"],
    allowedArmors: ["Cloth", "Leather", "Plate"],
    baseStats: { str: 5, vit: 5, agi: 5, dex: 5, int: 5, spr: 5, luk: 5 },
    skills: ["BasicStrike", "DoubleAttack"]
  },
  Vanguard: {
    name: "Vanguard",
    description: "Mestre do combate corpo a corpo e alta defesa física.",
    allowedWeapons: ["Sword", "Shield"],
    allowedArmors: ["Plate", "Leather"],
    baseStats: { str: 10, vit: 12, agi: 6, dex: 8, int: 4, spr: 5, luk: 5 },
    skills: ["ShieldBash", "IronWill", "Provoke", "GroundSlam"]
  },
  Ranger: {
    name: "Ranger",
    description: "Atirador de elite com arco, excelente mobilidade.",
    allowedWeapons: ["Bow"],
    allowedArmors: ["Leather", "Cloth"],
    baseStats: { str: 6, vit: 7, agi: 12, dex: 12, int: 4, spr: 4, luk: 5 },
    skills: ["ArrowShot", "DoubleStrafe", "FalconEye", "AnkleSnare"]
  },
  Arcanist: {
    name: "Arcanist",
    description: "Manipulador de energias elementais e magias destrutivas.",
    allowedWeapons: ["Staff"],
    allowedArmors: ["Cloth"],
    baseStats: { str: 4, vit: 5, agi: 5, dex: 8, int: 14, spr: 10, luk: 4 },
    skills: ["Firebolt", "IceSpike", "Thunderbolt", "ManaShield"]
  },
  Acolyte: {
    name: "Acolyte",
    description: "Servo das forças sagradas, com foco em cura e bênçãos.",
    allowedWeapons: ["Staff", "Shield"],
    allowedArmors: ["Cloth", "Leather"],
    baseStats: { str: 5, vit: 8, agi: 6, dex: 7, int: 8, spr: 12, luk: 6 },
    skills: ["Heal", "Blessing", "HolyLight", "Sanctuary"]
  },
  Shadowblade: {
    name: "Shadowblade",
    description: "Assassino veloz que ataca pelas sombras com alto crítico.",
    allowedWeapons: ["Dagger"],
    allowedArmors: ["Leather"],
    baseStats: { str: 8, vit: 6, agi: 14, dex: 10, int: 4, spr: 4, luk: 10 },
    skills: ["PoisonStab", "ShadowStep", "CriticalFocus", "VenomCoat"]
  }
};

const SKILLS = {
  BasicStrike: {
    id: "BasicStrike",
    name: "Golpe Básico",
    class: "Adventurer",
    levelRequired: 1,
    mpCost: 0,
    cooldown: 0,
    range: 2.5,
    type: "target",
    formula: (attacker, defender) => {
      const atk = attacker.derived.physicalAttack;
      const def = defender.derived ? defender.derived.physicalDefense : 0;
      return Math.max(1, Math.round(atk * 1.0 - def * 0.5));
    },
    description: "Um ataque corporal básico que causa dano físico padrão."
  },
  DoubleAttack: {
    id: "DoubleAttack",
    name: "Ataque Duplo",
    class: "Adventurer",
    levelRequired: 3,
    mpCost: 10,
    cooldown: 4,
    range: 2.5,
    type: "target",
    formula: (attacker, defender) => {
      const atk = attacker.derived.physicalAttack;
      const def = defender.derived ? defender.derived.physicalDefense : 0;
      return Math.max(1, Math.round(atk * 1.8 - def * 0.7));
    },
    description: "Desfere dois golpes rápidos, causando 180% de dano físico."
  },
  ShieldBash: {
    id: "ShieldBash",
    name: "Escudada",
    class: "Vanguard",
    levelRequired: 10,
    mpCost: 12,
    cooldown: 6,
    range: 2.5,
    type: "target",
    statusEffect: { effect: "stun", duration: 2.5 },
    formula: (attacker, defender) => {
      const atk = attacker.derived.physicalAttack + attacker.derived.physicalDefense * 0.5;
      const def = defender.derived ? defender.derived.physicalDefense : 0;
      return Math.max(1, Math.round(atk * 1.2 - def * 0.5));
    },
    description: "Atordoa o alvo por 2.5 segundos e causa dano baseado em ataque e defesa física."
  },
  IronWill: {
    id: "IronWill",
    name: "Vontade de Ferro",
    class: "Vanguard",
    levelRequired: 12,
    mpCost: 20,
    cooldown: 20,
    range: 0,
    type: "buff",
    statusEffect: { effect: "iron_will", duration: 15, stats: { physicalDefense: 20, magicDefense: 20 } },
    description: "Aumenta a defesa física e mágica em 20 por 15 segundos."
  },
  Provoke: {
    id: "Provoke",
    name: "Provocar",
    class: "Vanguard",
    levelRequired: 10,
    mpCost: 8,
    cooldown: 8,
    range: 8,
    type: "target",
    aggroMultiplier: 3,
    description: "Força o alvo a atacar o Vanguard, aumentando massivamente a ameaça."
  },
  GroundSlam: {
    id: "GroundSlam",
    name: "Impacto no Solo",
    class: "Vanguard",
    levelRequired: 15,
    mpCost: 25,
    cooldown: 12,
    range: 5,
    type: "aoe",
    formula: (attacker, defender) => {
      const atk = attacker.derived.physicalAttack;
      const def = defender.derived ? defender.derived.physicalDefense : 0;
      return Math.max(1, Math.round((atk * 1.3 - def * 0.5)));
    },
    description: "Golpeia o solo causando dano a todos os inimigos ao redor."
  },
  ArrowShot: {
    id: "ArrowShot",
    name: "Disparo Preciso",
    class: "Ranger",
    levelRequired: 10,
    mpCost: 8,
    cooldown: 1.5,
    range: 15,
    type: "target",
    formula: (attacker, defender) => {
      const atk = attacker.derived.physicalAttack;
      const def = defender.derived ? defender.derived.physicalDefense : 0;
      return Math.max(1, Math.round(atk * 1.2 - def * 0.4));
    },
    description: "Dispara uma flecha precisa causando 120% de dano físico à distância."
  },
  DoubleStrafe: {
    id: "DoubleStrafe",
    name: "Rajada de Flechas",
    class: "Ranger",
    levelRequired: 12,
    mpCost: 18,
    cooldown: 4,
    range: 15,
    type: "target",
    formula: (attacker, defender) => {
      const atk = attacker.derived.physicalAttack;
      const def = defender.derived ? defender.derived.physicalDefense : 0;
      return Math.max(1, Math.round(atk * 2.2 - def * 0.8));
    },
    description: "Dispara uma saraivada de duas flechas rápidas de alto dano."
  },
  FalconEye: {
    id: "FalconEye",
    name: "Olho de Falcão",
    class: "Ranger",
    levelRequired: 15,
    mpCost: 15,
    cooldown: 30,
    range: 0,
    type: "buff",
    statusEffect: { effect: "falcon_eye", duration: 20, stats: { dexterity: 15, criticalChance: 10 } },
    description: "Aumenta a Destreza em 15 e a Chance Crítica em 10% por 20 segundos."
  },
  AnkleSnare: {
    id: "AnkleSnare",
    name: "Armadilha de Tornozelo",
    class: "Ranger",
    levelRequired: 10,
    mpCost: 15,
    cooldown: 10,
    range: 8,
    type: "target",
    statusEffect: { effect: "root", duration: 5 },
    description: "Prende as pernas do inimigo, impedindo a movimentação por 5 segundos."
  },
  Firebolt: {
    id: "Firebolt",
    name: "Lança de Fogo",
    class: "Arcanist",
    levelRequired: 10,
    mpCost: 15,
    cooldown: 2,
    range: 12,
    type: "target",
    element: "Fire",
    formula: (attacker, defender) => {
      const matk = attacker.derived.magicAttack;
      const mdef = defender.derived ? defender.derived.magicDefense : 0;
      return Math.max(1, Math.round(matk * 1.5 - mdef * 0.5));
    },
    description: "Conjura um dardo flamejante de alto dano mágico elemental de Fogo."
  },
  IceSpike: {
    id: "IceSpike",
    name: "Espinho de Gelo",
    class: "Arcanist",
    levelRequired: 12,
    mpCost: 14,
    cooldown: 3,
    range: 12,
    type: "target",
    element: "Water",
    statusEffect: { effect: "slow", duration: 4 },
    formula: (attacker, defender) => {
      const matk = attacker.derived.magicAttack;
      const mdef = defender.derived ? defender.derived.magicDefense : 0;
      return Math.max(1, Math.round(matk * 1.2 - mdef * 0.4));
    },
    description: "Arremessa um espinho congelante que causa dano de Água e reduz a velocidade em 40%."
  },
  Thunderbolt: {
    id: "Thunderbolt",
    name: "Relâmpago",
    class: "Arcanist",
    levelRequired: 15,
    mpCost: 20,
    cooldown: 5,
    range: 10,
    type: "aoe",
    element: "Wind",
    formula: (attacker, defender) => {
      const matk = attacker.derived.magicAttack;
      const mdef = defender.derived ? defender.derived.magicDefense : 0;
      return Math.max(1, Math.round(matk * 1.4 - mdef * 0.3));
    },
    description: "Chama um raio devastador que atinge todos os alvos em uma pequena área."
  },
  ManaShield: {
    id: "ManaShield",
    name: "Escudo de Mana",
    class: "Arcanist",
    levelRequired: 10,
    mpCost: 25,
    cooldown: 20,
    range: 0,
    type: "buff",
    statusEffect: { effect: "mana_shield", duration: 15 },
    description: "Cria uma barreira mágica que absorve dano consumindo Mana em vez de Vida."
  },
  Heal: {
    id: "Heal",
    name: "Cura Sagrada",
    class: "Acolyte",
    levelRequired: 10,
    mpCost: 15,
    cooldown: 2,
    range: 10,
    type: "heal",
    formula: (attacker) => {
      const spr = attacker.stats.spr || 5;
      const int = attacker.stats.int || 5;
      return Math.round(spr * 5.0 + int * 2.0);
    },
    description: "Restaura os pontos de Vida (HP) do aliado ou de si mesmo usando o poder do Espírito."
  },
  Blessing: {
    id: "Blessing",
    name: "Bênção Divina",
    class: "Acolyte",
    levelRequired: 12,
    mpCost: 20,
    cooldown: 15,
    range: 10,
    type: "buff",
    statusEffect: { effect: "blessing", duration: 30, stats: { strength: 10, intelligence: 10, dexterity: 10 } },
    description: "Aumenta a Força, Inteligência e Destreza do alvo em 10 por 30 segundos."
  },
  HolyLight: {
    id: "HolyLight",
    name: "Luz Sagrada",
    class: "Acolyte",
    levelRequired: 10,
    mpCost: 10,
    cooldown: 1.5,
    range: 10,
    type: "target",
    element: "Light",
    formula: (attacker, defender) => {
      const matk = attacker.derived.magicAttack;
      const mdef = defender.derived ? defender.derived.magicDefense : 0;
      // Dano extra contra monstros do elemento Shadow/Sombrio!
      const shadowBonus = (defender.element === "Shadow") ? 1.5 : 1.0;
      return Math.max(1, Math.round((matk * 1.1 - mdef * 0.4) * shadowBonus));
    },
    description: "Ataca o oponente com um feixe de luz benta. Causa 50% de dano extra a demônios/sombras."
  },
  Sanctuary: {
    id: "Sanctuary",
    name: "Santuário",
    class: "Acolyte",
    levelRequired: 15,
    mpCost: 30,
    cooldown: 20,
    range: 8,
    type: "aoe_heal",
    description: "Cria uma área no solo que cura periodicamente todos os aliados dentro dela por 10 segundos."
  },
  PoisonStab: {
    id: "PoisonStab",
    name: "Punhalada Venenosa",
    class: "Shadowblade",
    levelRequired: 10,
    mpCost: 10,
    cooldown: 3,
    range: 2.5,
    type: "target",
    element: "Poison",
    statusEffect: { effect: "poison", duration: 8, tickDamage: 5 },
    formula: (attacker, defender) => {
      const atk = attacker.derived.physicalAttack;
      const def = defender.derived ? defender.derived.physicalDefense : 0;
      return Math.max(1, Math.round(atk * 1.3 - def * 0.5));
    },
    description: "Afaquia o alvo, aplicando um veneno que causa dano periódico por 8 segundos."
  },
  ShadowStep: {
    id: "ShadowStep",
    name: "Passo Sombrio",
    class: "Shadowblade",
    levelRequired: 12,
    mpCost: 15,
    cooldown: 8,
    range: 10,
    type: "target",
    description: "Teleporta-se instantaneamente para trás do alvo e causa dano físico ampliado."
  },
  CriticalFocus: {
    id: "CriticalFocus",
    name: "Foco Letal",
    class: "Shadowblade",
    levelRequired: 15,
    mpCost: 20,
    cooldown: 25,
    range: 0,
    type: "buff",
    statusEffect: { effect: "lethality", duration: 15, stats: { criticalChance: 25, agility: 8 } },
    description: "Aumenta a velocidade e agilidade, e garante +25% de Chance de Crítico por 15 segundos."
  }
};

const ITEMS = {
  // --- CONSUMÍVEIS ---
  RedPotion: { id: "RedPotion", name: "Poção Vermelha", category: "Consumable", rarity: "Common", weight: 1, stackable: true, price: 15, sellPrice: 5, description: "Recupera 100 pontos de Vida instantaneamente.", effect: { hp: 100 } },
  OrangePotion: { id: "OrangePotion", name: "Poção Laranja", category: "Consumable", rarity: "Uncommon", weight: 2, stackable: true, price: 40, sellPrice: 12, description: "Recupera 250 pontos de Vida instantaneamente.", effect: { hp: 250 } },
  BluePotion: { id: "BluePotion", name: "Poção Azul", category: "Consumable", rarity: "Uncommon", weight: 1.5, stackable: true, price: 60, sellPrice: 20, description: "Recupera 80 pontos de Mana instantaneamente.", effect: { mp: 80 } },
  ElixirOfEter: { id: "ElixirOfEter", name: "Elixir de Éter", category: "Consumable", rarity: "Rare", weight: 2, stackable: true, price: 200, sellPrice: 50, description: "Restaura completamente o HP e MP do jogador.", effect: { hpPercent: 100, mpPercent: 100 } },

  // --- ARMAS INICIAIS ---
  NoviceSword: { id: "NoviceSword", name: "Espada do Noviço", category: "Main Hand", rarity: "Common", weight: 5, stackable: false, price: 100, sellPrice: 20, minLevel: 1, allowedClasses: ["Adventurer", "Vanguard", "Shadowblade"], modifiers: { physicalAttack: 12 }, description: "Uma espada curta leve distribuída para novos aventureiros." },
  NoviceDagger: { id: "NoviceDagger", name: "Adaga do Noviço", category: "Main Hand", rarity: "Common", weight: 3, stackable: false, price: 80, sellPrice: 15, minLevel: 1, allowedClasses: ["Adventurer", "Shadowblade"], modifiers: { physicalAttack: 9, criticalChance: 3 }, description: "Uma lâmina afiada perfeita para golpes rápidos." },
  NoviceStaff: { id: "NoviceStaff", name: "Cajado do Noviço", category: "Main Hand", rarity: "Common", weight: 4, stackable: false, price: 120, sellPrice: 25, minLevel: 1, allowedClasses: ["Adventurer", "Arcanist", "Acolyte"], modifiers: { magicAttack: 15 }, description: "Um bastão de madeira polida que canaliza leves correntes de éter." },
  NoviceBow: { id: "NoviceBow", name: "Arco do Noviço", category: "Main Hand", rarity: "Common", weight: 4, stackable: false, price: 110, sellPrice: 22, minLevel: 1, allowedClasses: ["Adventurer", "Ranger"], modifiers: { physicalAttack: 11, criticalChance: 2 }, description: "Um arco flexível talhado de salgueiro robusto." },

  // --- ARMAS RARAS / AVANÇADAS ---
  AetherSlasher: { id: "AetherSlasher", name: "Retalhadora de Éter", category: "Main Hand", rarity: "Rare", weight: 10, stackable: false, price: 1500, sellPrice: 400, minLevel: 10, allowedClasses: ["Vanguard"], modifiers: { physicalAttack: 45, strength: 6, criticalChance: 5 }, description: "Uma espada imbuída de éter puro que ressoa em batalha." },
  WindrunnerBow: { id: "WindrunnerBow", name: "Arco Corta-Vento", category: "Main Hand", rarity: "Rare", weight: 7, stackable: false, price: 1600, sellPrice: 420, minLevel: 10, allowedClasses: ["Ranger"], modifiers: { physicalAttack: 38, agility: 8, criticalChance: 8 }, description: "Diz-se que as flechas disparadas por este arco viajam montadas no vento." },
  SageSpireStaff: { id: "SageSpireStaff", name: "Cajado do Pináculo Sábio", category: "Main Hand", rarity: "Rare", weight: 8, stackable: false, price: 1800, sellPrice: 450, minLevel: 10, allowedClasses: ["Arcanist", "Acolyte"], modifiers: { magicAttack: 52, intelligence: 7, spirit: 5 }, description: "Extraído das árvores anciãs que bebem do veio principal de éter." },
  DarkVenomDagger: { id: "DarkVenomDagger", name: "Adaga do Veneno Negro", category: "Main Hand", rarity: "Rare", weight: 4, stackable: false, price: 1400, sellPrice: 380, minLevel: 10, allowedClasses: ["Shadowblade"], modifiers: { physicalAttack: 32, agility: 6, criticalChance: 12 }, description: "A ponta desta adaga escurecida foi banhada em secreções de aranha do éter." },

  // --- ESCUDOS e OFF-HAND ---
  WoodenShield: { id: "WoodenShield", name: "Escudo de Madeira", category: "Off Hand", rarity: "Common", weight: 6, stackable: false, price: 80, sellPrice: 15, minLevel: 1, allowedClasses: ["Adventurer", "Vanguard", "Acolyte"], modifiers: { physicalDefense: 8, vit: 2 }, description: "Um escudo circular de carvalho reforçado com tiras de ferro." },
  GuardianAegis: { id: "GuardianAegis", name: "Égide do Guardião", category: "Off Hand", rarity: "Rare", weight: 15, stackable: false, price: 1200, sellPrice: 300, minLevel: 10, allowedClasses: ["Vanguard"], modifiers: { physicalDefense: 28, magicDefense: 15, vit: 8 }, description: "Um enorme escudo de aço cintilante capaz de conter hordas inteiras." },

  // --- ARMADURAS ---
  NoviceRobe: { id: "NoviceRobe", name: "Túnica do Noviço", category: "Body", rarity: "Common", weight: 3, stackable: false, price: 70, sellPrice: 15, modifiers: { physicalDefense: 4, magicDefense: 8, maxMp: 20 }, description: "Roupas leves de algodão dadas aos novos iniciantes." },
  LeatherTunic: { id: "LeatherTunic", name: "Túnica de Couro", category: "Body", rarity: "Common", weight: 5, stackable: false, price: 90, sellPrice: 20, modifiers: { physicalDefense: 8, magicDefense: 4, maxHp: 30 }, description: "Proteção leve e flexível feita de couro curtido." },
  SteelChainmail: { id: "SteelChainmail", name: "Cota de Malha de Aço", category: "Body", rarity: "Uncommon", weight: 12, stackable: false, price: 250, sellPrice: 60, modifiers: { physicalDefense: 18, magicDefense: 2, maxHp: 80 }, description: "Cota de malha pesada que oferece excelente blindagem contra cortes." },
  AetherGlowGarb: { id: "AetherGlowGarb", name: "Veste do Brilho de Éter", category: "Body", rarity: "Rare", weight: 4, stackable: false, price: 1100, sellPrice: 280, minLevel: 10, allowedClasses: ["Arcanist", "Acolyte"], modifiers: { physicalDefense: 15, magicDefense: 35, intelligence: 6, maxMp: 100 }, description: "Uma vestimenta lindamente tecida com fios impregnados de luz elemental." },
  ShadowAssassinGarb: { id: "ShadowAssassinGarb", name: "Traje do Assassino das Sombras", category: "Body", rarity: "Rare", weight: 6, stackable: false, price: 1200, sellPrice: 300, minLevel: 10, allowedClasses: ["Shadowblade", "Ranger"], modifiers: { physicalDefense: 22, magicDefense: 12, agility: 7, dodge: 10 }, description: "Silencioso e escuro como a noite, ideal para camuflagem e agilidade." },
  IronFortressPlate: { id: "IronFortressPlate", name: "Placa da Fortaleza de Ferro", category: "Body", rarity: "Rare", weight: 20, stackable: false, price: 1400, sellPrice: 350, minLevel: 10, allowedClasses: ["Vanguard"], modifiers: { physicalDefense: 45, magicDefense: 10, vit: 12, maxHp: 180 }, description: "Uma armadura maciça de placas de ferro que envolve o corpo como um forte móvel." },

  // --- ACESSÓRIOS ---
  IronRing: { id: "IronRing", name: "Anel de Ferro", category: "Accessory 1", rarity: "Common", weight: 0.1, stackable: false, price: 50, sellPrice: 10, modifiers: { physicalAttack: 2, maxHp: 10 }, description: "Um anel de metal simples que dá um pequeno reforço físico." },
  AetherShardRing: { id: "AetherShardRing", name: "Anel de Fragmento de Éter", category: "Accessory 1", rarity: "Rare", weight: 0.2, stackable: false, price: 800, sellPrice: 200, modifiers: { magicAttack: 8, physicalAttack: 4, maxMp: 30, criticalChance: 3 }, description: "Um lindo anel dourado cravado com um fragmento brilhante de éter cristalizado." },
  SwiftFeetBoots: { id: "SwiftFeetBoots", name: "Botas de Pés Velozes", category: "Boots", rarity: "Uncommon", weight: 2, stackable: false, price: 180, sellPrice: 40, modifiers: { physicalDefense: 5, movementSpeed: 20 }, description: "Botas mágicas que dão uma leve sensação de leveza e velocidade ao andar." },
  NoviceHat: { id: "NoviceHat", name: "Chapéu de Aventureiro", category: "Head", rarity: "Common", weight: 1, stackable: false, price: 40, sellPrice: 10, modifiers: { physicalDefense: 2, maxHp: 15 }, description: "Um chapéu de abas largas que protege do sol e de pequenos golpes." },
  AetherCrown: { id: "AetherCrown", name: "Coroa de Éter", category: "Head", rarity: "Rare", weight: 1.5, stackable: false, price: 1000, sellPrice: 250, modifiers: { magicDefense: 15, intelligence: 5, spirit: 5, maxMp: 50 }, description: "Uma tiara elegante que pulsa suavemente de poder mágico." },
  TravelersCape: { id: "TravelersCape", name: "Capa do Viajante", category: "Cape", rarity: "Common", weight: 1.5, stackable: false, price: 60, sellPrice: 12, modifiers: { physicalDefense: 2, magicDefense: 4, dodge: 3 }, description: "Uma capa áspera de lã que protege o usuário do vento gelado." },

  // --- MATERIAIS DE MONSTROS ---
  SpiderWeb: { id: "SpiderWeb", name: "Teia de Aranha", category: "Material", rarity: "Common", weight: 0.1, stackable: true, price: 10, sellPrice: 3, description: "Uma meada pegajosa de teia, útil para artesanato e fiação." },
  SlimeCore: { id: "SlimeCore", name: "Núcleo de Geleia", category: "Material", rarity: "Common", weight: 0.2, stackable: true, price: 8, sellPrice: 2, description: "O núcleo gelatinoso e brilhante de um slime." },
  WolfPelt: { id: "WolfPelt", name: "Pele de Lobo", category: "Material", rarity: "Common", weight: 1, stackable: true, price: 20, sellPrice: 6, description: "Uma pele de lobo espessa e quente, ideal para costurar agasalhos." },
  AetherCrystalShard: { id: "AetherCrystalShard", name: "Caco de Cristal de Éter", category: "Material", rarity: "Uncommon", weight: 0.5, stackable: true, price: 50, sellPrice: 15, description: "Um cristal azul brilhante altamente valorizado por ferreiros." },
  TreantBark: { id: "TreantBark", name: "Casca de Treant", category: "Material", rarity: "Uncommon", weight: 1.5, stackable: true, price: 40, sellPrice: 12, description: "Pedaço de madeira petrificada que pulsa com energia vital." },
  AncientIronOre: { id: "AncientIronOre", name: "Minério de Ferro Antigo", category: "Material", rarity: "Common", weight: 2, stackable: true, price: 30, sellPrice: 8, description: "Minério bruto recolhido das profundezas das cavernas de Aetheria." },
  BossToken: { id: "BossToken", name: "Selo do Lorde de Éter", category: "Material", rarity: "Epic", weight: 0.5, stackable: true, price: 1000, sellPrice: 250, description: "Um medalhão imbuído com a alma do Grande Lorde Éter. Usado para criar armas lendárias." },

  // --- ITENS DE QUEST ---
  MentorsLetter: { id: "MentorsLetter", name: "Carta do Mentor", category: "Quest Item", rarity: "Common", weight: 0.1, stackable: false, price: 0, sellPrice: 0, description: "Uma carta lacrada escrita pelo Mentor Eldrin para o Guarda Real da capital." },
  RuptureDust: { id: "RuptureDust", name: "Poeira da Fenda", category: "Quest Item", rarity: "Uncommon", weight: 0.1, stackable: true, price: 0, sellPrice: 0, description: "Pó instável coletado das rupturas de éter. Brilha no escuro." },
  StolenHeirloom: { id: "StolenHeirloom", name: "Relíquia Roubada", category: "Quest Item", rarity: "Rare", weight: 0.5, stackable: false, price: 0, sellPrice: 0, description: "Um pingente antigo com o brasão da família do Prefeito da Aldeia." }
};

// 20+ Monstros Originais Detalhados
const MONSTERS = {
  // Comuns (8 Criaturas)
  AetherSlime: { id: "AetherSlime", name: "Aether Slime", level: 1, hp: 45, maxHp: 45, element: "Water", behavior: "passive", xp: 12, gold: 5, size: 0.8, color: 0x42a5f5, drops: [{ item: "SlimeCore", chance: 0.6 }, { item: "RedPotion", chance: 0.15 }] },
  MossyPup: { id: "MossyPup", name: "Mossy Pup", level: 2, hp: 60, maxHp: 60, element: "Earth", behavior: "passive", xp: 18, gold: 8, size: 0.9, color: 0x8d6e63, drops: [{ item: "WolfPelt", chance: 0.4 }, { item: "RedPotion", chance: 0.1 }] },
  AetherSpider: { id: "AetherSpider", name: "Aranha do Éter", level: 3, hp: 80, maxHp: 80, element: "Poison", behavior: "passive", xp: 25, gold: 10, size: 1.0, color: 0x7e57c2, drops: [{ item: "SpiderWeb", chance: 0.5 }, { item: "NoviceDagger", chance: 0.02 }] },
  AetherFly: { id: "AetherFly", name: "Mosca de Éter", level: 4, hp: 70, maxHp: 70, element: "Wind", behavior: "passive", xp: 22, gold: 9, size: 0.6, color: 0x26a69a, drops: [{ item: "SpiderWeb", chance: 0.2 }, { item: "OrangePotion", chance: 0.08 }] },
  RootBiter: { id: "RootBiter", name: "Roedor de Raízes", level: 5, hp: 110, maxHp: 110, element: "Earth", behavior: "passive", xp: 35, gold: 14, size: 0.8, color: 0xa1887f, drops: [{ item: "WolfPelt", chance: 0.3 }, { item: "IronRing", chance: 0.04 }] },
  CrystalScarab: { id: "CrystalScarab", name: "Escaravelho de Cristal", level: 6, hp: 150, maxHp: 150, element: "Earth", behavior: "defensive", xp: 48, gold: 20, size: 1.1, color: 0x00bcd4, drops: [{ item: "AetherCrystalShard", chance: 0.4 }, { item: "WoodenShield", chance: 0.05 }] },
  AetherWisp: { id: "AetherWisp", name: "Fogo Fátuo de Éter", level: 7, hp: 100, maxHp: 100, element: "Light", behavior: "defensive", xp: 55, gold: 22, size: 0.7, color: 0xffeb3b, drops: [{ item: "AetherCrystalShard", chance: 0.3 }, { item: "BluePotion", chance: 0.2 }] },
  ForestSprout: { id: "ForestSprout", name: "Broto da Floresta", level: 8, hp: 140, maxHp: 140, element: "Earth", behavior: "passive", xp: 62, gold: 25, size: 0.9, color: 0x66bb6a, drops: [{ item: "TreantBark", chance: 0.3 }, { item: "TravelersCape", chance: 0.03 }] },

  // Agressivos (4 Criaturas)
  AetherSpiderAgressive: { id: "AetherSpiderAgressive", name: "Aranha Sombria", level: 9, hp: 180, maxHp: 180, element: "Shadow", behavior: "aggressive", xp: 90, gold: 35, size: 1.2, color: 0x4a148c, drops: [{ item: "SpiderWeb", chance: 0.6 }, { item: "NoviceDagger", chance: 0.08 }] },
  EterGnasher: { id: "EterGnasher", name: "Lobo do Caos", level: 10, hp: 220, maxHp: 220, element: "Fire", behavior: "aggressive", xp: 120, gold: 45, size: 1.3, color: 0xd84315, drops: [{ item: "WolfPelt", chance: 0.6 }, { item: "RedPotion", chance: 0.3 }] },
  CorruptedVanguard: { id: "CorruptedVanguard", name: "Guarda Corrompido", level: 12, hp: 320, maxHp: 320, element: "Shadow", behavior: "aggressive", xp: 180, gold: 60, size: 1.4, color: 0x37474f, drops: [{ item: "SteelChainmail", chance: 0.05 }, { item: "NoviceSword", chance: 0.1 }] },
  RuptureHornet: { id: "RuptureHornet", name: "Vespa da Ruptura", level: 11, hp: 190, maxHp: 190, element: "Wind", behavior: "aggressive", xp: 140, gold: 50, size: 1.0, color: 0xffb300, drops: [{ item: "SpiderWeb", chance: 0.3 }, { item: "NoviceBow", chance: 0.05 }] },

  // Mágicos (3 Criaturas)
  EtherSorcerer: { id: "EtherSorcerer", name: "Feiticeiro do Éter", level: 13, hp: 250, maxHp: 250, element: "Wind", behavior: "aggressive", xp: 220, gold: 75, size: 1.3, color: 0x0288d1, drops: [{ item: "NoviceStaff", chance: 0.12 }, { item: "BluePotion", chance: 0.4 }] },
  ShadowCultist: { id: "ShadowCultist", name: "Cultista das Sombras", level: 14, hp: 280, maxHp: 280, element: "Shadow", behavior: "aggressive", xp: 250, gold: 85, size: 1.3, color: 0x212121, drops: [{ item: "NoviceRobe", chance: 0.15 }, { item: "ElixirOfEter", chance: 0.02 }] },
  FireRemnant: { id: "FireRemnant", name: "Resquício de Chamas", level: 15, hp: 300, maxHp: 300, element: "Fire", behavior: "aggressive", xp: 300, gold: 95, size: 1.1, color: 0xf44336, drops: [{ item: "AetherCrystalShard", chance: 0.5 }, { item: "OrangePotion", chance: 0.3 }] },

  // Elites (2 Criaturas)
  AncientStoneGolem: { id: "AncientStoneGolem", name: "Golem de Pedra Anciã", level: 15, hp: 750, maxHp: 750, element: "Earth", behavior: "defensive", xp: 600, gold: 180, size: 2.2, color: 0x5d4037, drops: [{ item: "AncientIronOre", chance: 0.8 }, { item: "IronFortressPlate", chance: 0.04 }] },
  AetherViper: { id: "AetherViper", name: "Víbora de Éter", level: 16, hp: 600, maxHp: 600, element: "Poison", behavior: "aggressive", xp: 550, gold: 160, size: 1.8, color: 0x00796b, drops: [{ item: "SpiderWeb", chance: 0.7 }, { item: "DarkVenomDagger", chance: 0.05 }] },

  // Mini-Bosses (2 Criaturas)
  TreantKing: { id: "TreantKing", name: "Rei Treant Corrompido", level: 18, hp: 2200, maxHp: 2200, element: "Earth", behavior: "aggressive", xp: 2000, gold: 500, size: 3.5, color: 0x1b5e20, drops: [{ item: "TreantBark", chance: 1.0 }, { item: "AetherGlowGarb", chance: 0.1 }, { item: "AetherCrown", chance: 0.08 }] },
  RuptureHuntsman: { id: "RuptureHuntsman", name: "Caçador da Ruptura", level: 19, hp: 1800, maxHp: 1800, element: "Wind", behavior: "aggressive", xp: 1800, gold: 450, size: 2.8, color: 0x2e7d32, drops: [{ item: "WindrunnerBow", chance: 0.1 }, { item: "ShadowAssassinGarb", chance: 0.1 }] },

  // Boss de Região (1 Criatura)
  AetherLorde: { id: "AetherLorde", name: "Grande Lorde do Éter", level: 25, hp: 12000, maxHp: 12000, element: "Light", behavior: "aggressive", xp: 10000, gold: 2000, size: 5.0, color: 0x00e5ff, drops: [{ item: "BossToken", chance: 1.0 }, { item: "AetherSlasher", chance: 0.15 }, { item: "AetherShardRing", chance: 0.15 }, { item: "GuardianAegis", chance: 0.15 }] }
};

const MAPS = {
  Town: {
    id: "Town",
    name: "Aetheria Town (Aldeia Inicial)",
    dimensions: { width: 100, length: 100 },
    biome: "Meadows",
    pvp: false,
    music: "aetheria_town.mp3",
    spawnPoints: { player: { x: 0, y: 0.5, z: 0 } },
    npcs: [
      { id: "MentorEldrin", name: "Mentor Eldrin", type: "quest", model: "elder", x: -5, y: 0.5, z: 5 },
      { id: "HealerLuna", name: "Sacerdotisa Luna", type: "healer", model: "priestess", x: 8, y: 0.5, z: 3 },
      { id: "FerreiroGrom", name: "Ferreiro Grom", type: "merchant", model: "blacksmith", x: -8, y: 0.5, z: -8 },
      { id: "AlquimistaRaza", name: "Alquimista Raza", type: "merchant", model: "alchemist", x: 5, y: 0.5, z: -6 },
      { id: "StorageNPC", name: "Guardador de Baú", type: "storage", model: "merchant", x: 0, y: 0.5, z: 10 }
    ],
    portals: [
      { id: "Town_to_Fields", name: "Campos de Treinamento", targetMap: "Fields", x: 45, y: 0.5, z: 0, targetX: -40, targetY: 0.5, targetZ: 0 }
    ]
  },
  Fields: {
    id: "Fields",
    name: "Campos de Treinamento",
    dimensions: { width: 150, length: 150 },
    biome: "Plains",
    pvp: false,
    music: "fields_of_adventure.mp3",
    spawns: [
      { id: "AetherSlime", count: 8, rate: 3 },
      { id: "MossyPup", count: 5, rate: 5 },
      { id: "AetherFly", count: 4, rate: 4 }
    ],
    portals: [
      { id: "Fields_to_Town", name: "Retornar para Cidade", targetMap: "Town", x: -45, y: 0.5, z: 0, targetX: 40, targetY: 0.5, targetZ: 0 },
      { id: "Fields_to_Forest", name: "Floresta de Éter", targetMap: "Forest", x: 0, y: 0.5, z: 45, targetX: 0, targetY: 0.5, targetZ: -40 }
    ]
  },
  Forest: {
    id: "Forest",
    name: "Floresta de Éter",
    dimensions: { width: 200, length: 200 },
    biome: "Forest",
    pvp: false,
    music: "whispering_woods.mp3",
    spawns: [
      { id: "AetherSpider", count: 8, rate: 5 },
      { id: "RootBiter", count: 6, rate: 6 },
      { id: "ForestSprout", count: 5, rate: 8 },
      { id: "EterGnasher", count: 3, rate: 10 },
      { id: "TreantKing", count: 1, rate: 30 } // Mini-Boss!
    ],
    portals: [
      { id: "Forest_to_Fields", name: "Campos de Treinamento", targetMap: "Fields", x: 0, y: 0.5, z: -45, targetX: 0, targetY: 0.5, targetZ: 40 },
      { id: "Forest_to_Cave", name: "Cavernas de Cristal", targetMap: "Cave", x: 45, y: 0.5, z: 45, targetX: -40, targetY: 0.5, targetZ: -40 },
      { id: "Forest_to_Capital", name: "Cidade Capital Aetheris", targetMap: "Capital", x: -45, y: 0.5, z: 0, targetX: 40, targetY: 0.5, targetZ: 0 }
    ]
  },
  Cave: {
    id: "Cave",
    name: "Cavernas de Cristal",
    dimensions: { width: 120, length: 120 },
    biome: "Cave",
    pvp: false,
    music: "echoing_cave.mp3",
    spawns: [
      { id: "CrystalScarab", count: 6, rate: 5 },
      { id: "AetherSpiderAgressive", count: 5, rate: 6 },
      { id: "AncientStoneGolem", count: 2, rate: 15 }, // Elite
      { id: "AetherViper", count: 2, rate: 15 } // Elite
    ],
    portals: [
      { id: "Cave_to_Forest", name: "Retornar à Floresta", targetMap: "Forest", x: -45, y: 0.5, z: -45, targetX: 40, targetY: 0.5, targetZ: 40 }
    ]
  },
  Capital: {
    id: "Capital",
    name: "Aetheris Capital",
    dimensions: { width: 200, length: 200 },
    biome: "City",
    pvp: false,
    music: "royal_march.mp3",
    npcs: [
      { id: "KingAurelius", name: "Rei Aurelius II", type: "quest", model: "king", x: 0, y: 1.5, z: 40 },
      { id: "GrandMageKael", name: "Arcanista Kael", type: "class_master", model: "elder", x: -25, y: 0.5, z: 15 },
      { id: "CommanderVane", name: "Comandante Vane", type: "class_master", model: "vanguard", x: 25, y: 0.5, z: 15 },
      { id: "CapitalStorage", name: "Storage Central", type: "storage", model: "merchant", x: -10, y: 0.5, z: -15 },
      { id: "CapitalMerchant", name: "Comerciante Imperial", type: "merchant", model: "merchant", x: 10, y: 0.5, z: -15 }
    ],
    portals: [
      { id: "Capital_to_Forest", name: "Sair para Floresta", targetMap: "Forest", x: 45, y: 0.5, z: 0, targetX: -40, targetY: 0.5, targetZ: 0 },
      { id: "Capital_to_Arena", name: "Arena PvP de Duelos", targetMap: "Arena", x: -45, y: 0.5, z: -45, targetX: 0, targetY: 0.5, targetZ: -40 },
      { id: "Capital_to_Dungeon", name: "Dungeon Ruínas Sagradas", targetMap: "Dungeon", x: 0, y: 0.5, z: -45, targetX: 0, targetY: 0.5, targetZ: -40 }
    ]
  },
  Dungeon: {
    id: "Dungeon",
    name: "Ruínas Sagradas de Éter",
    dimensions: { width: 150, length: 150 },
    biome: "Ruins",
    pvp: false,
    music: "ruined_temple.mp3",
    spawns: [
      { id: "CorruptedVanguard", count: 6, rate: 8 },
      { id: "ShadowCultist", count: 5, rate: 8 },
      { id: "FireRemnant", count: 4, rate: 10 },
      { id: "RuptureHuntsman", count: 1, rate: 45 }, // Mini-Boss
      { id: "AetherLorde", count: 1, rate: 120 } // Boss Mundial / Chefe de Instância!
    ],
    portals: [
      { id: "Dungeon_to_Capital", name: "Fugir para Capital", targetMap: "Capital", x: 0, y: 0.5, z: -45, targetX: 0, targetY: 0.5, targetZ: 40 }
    ]
  },
  Arena: {
    id: "Arena",
    name: "Grande Arena PvP",
    dimensions: { width: 80, length: 80 },
    biome: "Arena",
    pvp: true, // Permitir Combate PvP!
    music: "combat_arena.mp3",
    portals: [
      { id: "Arena_to_Capital", name: "Sair para Capital", targetMap: "Capital", x: 0, y: 0.5, z: -35, targetX: -40, targetY: 0.5, targetZ: -40 }
    ]
  }
};

// 15 Quests Sequenciais Funcionais Completas
const QUESTS = {
  Q1: {
    id: "Q1",
    name: "Primeiros Passos em Aetheria",
    giver: "Mentor Eldrin",
    description: "Converse com o Mentor Eldrin na Aldeia Inicial para aprender os conceitos básicos de movimentação.",
    requirements: { level: 1 },
    steps: [
      { type: "talk", target: "MentorEldrin", text: "Bem-vindo a Aetheria! As correntes de éter estão instáveis hoje. Use as teclas W, A, S, D para se movimentar pelo vilarejo e fale comigo novamente." }
    ],
    rewards: { xp: 50, gold: 50, items: [{ item: "RedPotion", qty: 5 }] }
  },
  Q2: {
    id: "Q2",
    name: "Armando o Aventureiro",
    giver: "Mentor Eldrin",
    description: "Eldrin quer que você receba seu equipamento inicial das mãos do Ferreiro Grom.",
    requirements: { quest: "Q1" },
    steps: [
      { type: "talk", target: "FerreiroGrom", text: "E aí, jovem! O Eldrin me avisou que você viria. Aqui está uma espada inicial para você começar. Não vá se cortar por aí!" }
    ],
    rewards: { xp: 80, gold: 30, items: [{ item: "NoviceSword", qty: 1 }] }
  },
  Q3: {
    id: "Q3",
    name: "Seu Primeiro Combate",
    giver: "Mentor Eldrin",
    description: "Atravesse o portal Leste para o Campo de Treinamento e derrote 3 Aether Slimes para testar sua espada.",
    requirements: { quest: "Q2" },
    steps: [
      { type: "kill", target: "AetherSlime", count: 3 }
    ],
    rewards: { xp: 150, gold: 80, items: [{ item: "RedPotion", qty: 5 }, { item: "BluePotion", qty: 2 }] }
  },
  Q4: {
    id: "Q4",
    name: "Coletando Suprimentos Básicos",
    giver: "FerreiroGrom",
    description: "O Ferreiro Grom precisa de 2 Núcleos de Slime para forjar novos experimentos.",
    requirements: { quest: "Q3" },
    steps: [
      { type: "collect", target: "SlimeCore", count: 2 }
    ],
    rewards: { xp: 200, gold: 100, items: [{ item: "IronRing", qty: 1 }] }
  },
  Q5: {
    id: "Q5",
    name: "A Sacerdotisa Luna",
    giver: "Mentor Eldrin",
    description: "Visite a Sacerdotisa Luna para aprender como se curar e usar poções.",
    requirements: { quest: "Q4" },
    steps: [
      { type: "talk", target: "HealerLuna", text: "Que a luz purificadora do éter guie seus passos! Use poções em momentos de apuro, ou se aproxime de mim quando estiver ferido." }
    ],
    rewards: { xp: 100, gold: 50, items: [{ item: "OrangePotion", qty: 3 }] }
  },
  Q6: {
    id: "Q6",
    name: "Ameaça dos Mossy Pups",
    giver: "Mentor Eldrin",
    description: "Os caninos selvagens 'Mossy Pups' estão atacando as ovelhas do vilarejo. Elimine 3 deles.",
    requirements: { quest: "Q5" },
    steps: [
      { type: "kill", target: "MossyPup", count: 3 }
    ],
    rewards: { xp: 250, gold: 120, items: [{ item: "WolfPelt", qty: 2 }] }
  },
  Q7: {
    id: "Q7",
    name: "As Teias Pegajosas",
    giver: "AlquimistaRaza",
    description: "O Alquimista Raza precisa de 2 Teias de Aranha para produzir novos elixires estabilizadores.",
    requirements: { quest: "Q6" },
    steps: [
      { type: "collect", target: "SpiderWeb", count: 2 }
    ],
    rewards: { xp: 300, gold: 150, items: [{ item: "BluePotion", qty: 5 }] }
  },
  Q8: {
    id: "Q8",
    name: "O Mistério das Rupturas",
    giver: "Mentor Eldrin",
    description: "Elimine 3 Aranhas do Éter e recolha uma amostra de poeira de fenda.",
    requirements: { quest: "Q7" },
    steps: [
      { type: "kill", target: "AetherSpider", count: 3 }
    ],
    rewards: { xp: 400, gold: 200, items: [{ item: "AetherCrystalShard", qty: 1 }] }
  },
  Q9: {
    id: "Q9",
    name: "Ascendendo sua Vocação (Escolha de Classe)",
    giver: "Mentor Eldrin",
    description: "Eldrin acredita que você está pronto. Alcance o nível 10 para escolher uma classe na Cidade Capital Aetheris.",
    requirements: { quest: "Q8", level: 10 },
    steps: [
      { type: "talk", target: "MentorEldrin", text: "Extraordinário! Pegue esta Carta do Mentor e viaje até a Cidade Capital cruzando o portal Norte da Floresta. Fale com os instrutores!" }
    ],
    rewards: { xp: 600, gold: 300, items: [{ item: "MentorsLetter", qty: 1 }] }
  },
  Q10: {
    id: "Q10",
    name: "Entregando a Carta",
    giver: "Mentor Eldrin",
    description: "Entregue a Carta de Eldrin para o Comandante Vane na Capital para iniciar o treinamento formal.",
    requirements: { quest: "Q9" },
    steps: [
      { type: "talk", target: "CommanderVane", text: "Ah! Uma carta do Eldrin? Ele sempre envia ótimos prodígios. Bem-vindo à guarda oficial, jovem recruta!" }
    ],
    rewards: { xp: 500, gold: 200, items: [{ item: "SwiftFeetBoots", qty: 1 }] }
  },
  Q11: {
    id: "Q11",
    name: "Purificando as Cavernas",
    giver: "CommanderVane",
    description: "Entre nas Cavernas de Cristal e destrua 5 Escaravelhos de Cristal agressivos.",
    requirements: { quest: "Q10" },
    steps: [
      { type: "kill", target: "CrystalScarab", count: 5 }
    ],
    rewards: { xp: 800, gold: 400, items: [{ item: "OrangePotion", qty: 10 }] }
  },
  Q12: {
    id: "Q12",
    name: "O Desafio dos Golems de Pedra",
    giver: "GrandMageKael",
    description: "O Arcanista Kael precisa de 1 Minério de Ferro Antigo extraído dos Golems das Cavernas de Cristal.",
    requirements: { quest: "Q11" },
    steps: [
      { type: "collect", target: "AncientIronOre", count: 1 }
    ],
    rewards: { xp: 1000, gold: 500, items: [{ item: "ElixirOfEter", qty: 2 }] }
  },
  Q13: {
    id: "Q13",
    name: "O Rei da Floresta",
    giver: "CommanderVane",
    description: "Derrote o lendário Rei Treant Corrompido que assombra o coração da Floresta.",
    requirements: { quest: "Q12" },
    steps: [
      { type: "kill", target: "TreantKing", count: 1 }
    ],
    rewards: { xp: 2500, gold: 1000, items: [{ item: "AetherCrown", qty: 1 }] }
  },
  Q14: {
    id: "Q14",
    name: "A Invasão das Ruínas Sagradas",
    giver: "KingAurelius",
    description: "O Rei Aurelius solicita que você enfrente os Cultistas das Sombras nas Ruínas Sagradas.",
    requirements: { quest: "Q13" },
    steps: [
      { type: "kill", target: "ShadowCultist", count: 5 }
    ],
    rewards: { xp: 3000, gold: 1500, items: [{ item: "AetherCrystalShard", qty: 5 }] }
  },
  Q15: {
    id: "Q15",
    name: "Destruindo o Grande Lorde do Éter",
    giver: "KingAurelius",
    description: "Vá ao centro da Dungeon Ruínas Sagradas com seu grupo e elimine o Grande Lorde do Éter para salvar o reino.",
    requirements: { quest: "Q14" },
    steps: [
      { type: "kill", target: "AetherLorde", count: 1 }
    ],
    rewards: { xp: 10000, gold: 5000, items: [{ item: "AetherShardRing", qty: 1 }] }
  }
};

// Fórmulas Centrais de Combate, Atributos e Progressão
const XP_LEVELS = Array.from({ length: 100 }, (_, i) => {
  const lvl = i + 1;
  // Curva de XP: Progressão suave clássica
  if (lvl === 1) return 100;
  return Math.round(100 * Math.pow(lvl, 1.8));
});

const calculateDerivedStats = (stats, level, classType) => {
  const { str, vit, agi, dex, int, spr, luk } = stats;

  const maxHp = 100 + vit * 15 + level * 20;
  const maxMp = 50 + int * 8 + spr * 12 + level * 5;
  const physicalAttack = 10 + str * 2 + dex * 0.5 + level * 1.5;
  const magicAttack = 10 + int * 2.5 + level * 1.2;
  const physicalDefense = 5 + vit * 1.5 + level * 1.0;
  const magicDefense = 5 + spr * 1.5 + level * 1.0;
  
  const precision = 80 + dex * 1.5 + luk * 0.5;
  const dodge = 5 + agi * 1.2 + luk * 0.4;
  const criticalChance = 5 + luk * 0.5 + agi * 0.2;
  const attackSpeed = 1.0 + (agi * 0.015); // Aumenta a velocidade de animação / taxa de batida
  const movementSpeed = 100 + (agi * 0.3); // Velocidade base do jogador
  const castSpeed = 100 + (dex * 0.5 + int * 0.2); // Reduz tempo de conjuração

  return {
    maxHp,
    maxMp,
    physicalAttack,
    magicAttack,
    physicalDefense,
    magicDefense,
    precision,
    dodge,
    criticalChance,
    attackSpeed,
    movementSpeed,
    castSpeed
  };
};

module.exports = {
  GAME_NAME,
  CLASSES,
  SKILLS,
  ITEMS,
  MONSTERS,
  MAPS,
  QUESTS,
  XP_LEVELS,
  calculateDerivedStats
};
