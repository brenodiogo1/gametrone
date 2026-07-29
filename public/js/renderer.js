// Chronicles of Aetheria - Renderizador 3D (Three.js Low-Poly Engine)
// Desenha cenários, terrenos, personagens procedurais (cabelos, peles, roupas),
// armas, escudos e 20+ monstros originais com animações, partículas e efeitos de combate.

class GameRenderer {
  constructor(canvasContainerId) {
    this.container = document.getElementById(canvasContainerId);
    this.scene = null;
    this.camera = null;
    this.renderer = null;

    // Entidades Ativas
    this.meshes = {}; // id -> Group (players, mobs, portal, loot)
    this.particles = []; // array de partículas ativas

    // Configurações da Câmera
    this.cameraDistance = 18;
    this.cameraHeight = 11;
    this.cameraYaw = 0; // rotação horizontal
    this.cameraPitch = -0.6; // inclinação vertical

    this.initThree();
    this.animate();
  }

  // Inicializa Cena, Câmera, Luzes e Renderizador
  initThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0e1117);
    this.scene.fog = new THREE.FogExp2(0x0e1117, 0.015);

    // Câmera
    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);

    // Renderizador
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // Luzes
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(20, 40, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 150;
    const d = 50;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    this.scene.add(dirLight);

    // Luz Pontual para fendas/portais
    const pointLight = new THREE.PointLight(0x8a30d6, 1.5, 30);
    pointLight.position.set(0, 5, 0);
    this.scene.add(pointLight);

    // Redimensionamento
    window.addEventListener('resize', () => this.onWindowResize());
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // Limpa e Gera Cenário Baseado no Bioma do Mapa
  generateTerrain(mapId, biome) {
    // Remove terreno antigo
    if (this.terrainMesh) this.scene.remove(this.terrainMesh);
    if (this.decorationsGroup) this.scene.remove(this.decorationsGroup);

    // Deleta meshes antigos do mapa anterior
    for (let key in this.meshes) {
      this.scene.remove(this.meshes[key]);
    }
    this.meshes = {};

    let groundColor = 0x4caf50; // Meadows padrão
    let mapSizeWidth = 150;
    let mapSizeLength = 150;

    if (biome === 'Cave') groundColor = 0x2e2724;
    else if (biome === 'Ruins') groundColor = 0x424242;
    else if (biome === 'Arena') groundColor = 0xa08a70;
    else if (biome === 'City') groundColor = 0x757575;

    // Cria plano do chão
    const geometry = new THREE.PlaneGeometry(mapSizeWidth, mapSizeLength, 32, 32);
    
    // Adiciona leve ondulação no relevo (Low-Poly clássico)
    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      // ondulação baseada em bioma
      let zVal = 0;
      if (biome === 'Forest') {
        zVal = Math.sin(vx * 0.1) * Math.cos(vy * 0.1) * 1.5;
      } else if (biome === 'Cave') {
        zVal = Math.sin(vx * 0.15) * Math.sin(vy * 0.15) * 1.0 - (Math.random() * 0.2);
      }
      pos.setZ(i, zVal);
    }
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      color: groundColor,
      roughness: 0.8,
      flatShading: true
    });

    this.terrainMesh = new THREE.Mesh(geometry, material);
    this.terrainMesh.rotation.x = -Math.PI / 2;
    this.terrainMesh.receiveShadow = true;
    this.scene.add(this.terrainMesh);

    // Adiciona decorações espalhadas (Árvores, Pedras, Cogumelos)
    this.decorationsGroup = new THREE.Group();
    this.scene.add(this.decorationsGroup);

    const decorCount = biome === 'Forest' ? 250 : biome === 'Cave' ? 80 : 60;
    for (let i = 0; i < decorCount; i++) {
      const x = Math.random() * mapSizeWidth - (mapSizeWidth / 2);
      const z = Math.random() * mapSizeLength - (mapSizeLength / 2);
      
      // Evita colocar decorações muito próximas ao spawn inicial (0,0)
      if (Math.abs(x) < 12 && Math.abs(z) < 12) continue;

      if (biome === 'Plains' || biome === 'Meadows' || biome === 'Forest') {
        if (Math.random() < 0.7) {
          // Árvore procedural
          const trunkGeo = new THREE.CylinderGeometry(0.3, 0.5, 4, 5);
          const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, flatShading: true });
          const trunk = new THREE.Mesh(trunkGeo, trunkMat);
          trunk.position.set(x, 2, z);
          trunk.castShadow = true;

          const leavesGeo = new THREE.SphereGeometry(1.8, 5, 5);
          const leavesMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32, flatShading: true });
          const leaves = new THREE.Mesh(leavesGeo, leavesMat);
          leaves.position.set(0, 2.2, 0);
          leaves.castShadow = true;
          trunk.add(leaves);

          this.decorationsGroup.add(trunk);
        } else {
          // Rocha procedural
          const rockGeo = new THREE.DodecahedronGeometry(Math.random() * 1.2 + 0.3, 1);
          const rockMat = new THREE.MeshStandardMaterial({ color: 0x78909c, flatShading: true });
          const rock = new THREE.Mesh(rockGeo, rockMat);
          rock.position.set(x, 0.4, z);
          rock.castShadow = true;
          this.decorationsGroup.add(rock);
        }
      } else if (biome === 'Cave' || biome === 'Ruins') {
        // Pedras estalactites / cristais azuis brilhantes
        const isCrystal = Math.random() < 0.3;
        const crystalGeo = new THREE.OctahedronGeometry(Math.random() * 0.8 + 0.3, 0);
        const crystalMat = new THREE.MeshStandardMaterial({
          color: isCrystal ? 0x00e5ff : 0x424242,
          emissive: isCrystal ? 0x00e5ff : 0x000000,
          emissiveIntensity: 0.5,
          flatShading: true
        });
        const crystal = new THREE.Mesh(crystalGeo, crystalMat);
        crystal.position.set(x, 0.5, z);
        this.decorationsGroup.add(crystal);
      }
    }
  }

  // Gera ou Atualiza Malha do Jogador (Com Roupas, Armas e Cabelos)
  createPlayerMesh(playerData, id) {
    if (this.meshes[id]) {
      this.scene.remove(this.meshes[id]);
    }

    const group = new THREE.Group();
    group.position.set(playerData.x, playerData.y, playerData.z);
    group.rotation.y = playerData.r;

    // Define cor das roupas baseado na classe
    let clothColor = 0xb0bec5; // Adventurer cinza
    if (playerData.class === 'Vanguard') clothColor = 0xb71c1c; // Vermelho
    else if (playerData.class === 'Ranger') clothColor = 0x1b5e20; // Verde
    else if (playerData.class === 'Arcanist') clothColor = 0x4a148c; // Roxo
    else if (playerData.class === 'Acolyte') clothColor = 0xe0f7fa; // Branco/Azul claro
    else if (playerData.class === 'Shadowblade') clothColor = 0x212121; // Preto/Escuro

    // 1. Corpo/Capa (Cilindro)
    const bodyGeo = new THREE.CylinderGeometry(0.5, 0.3, 1.8, 8);
    const bodyMat = new THREE.MeshStandardMaterial({ color: clothColor, flatShading: true });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.9;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // 2. Cabeça (Esfera)
    const headGeo = new THREE.SphereGeometry(0.42, 8, 8);
    const headMat = new THREE.MeshStandardMaterial({ color: playerData.appearance.skinColor || 0xffd1a9, flatShading: true });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 2.0;
    head.castShadow = true;
    group.add(head);

    // Face drawn on canvas loaded as texture to make customizable expressions!
    const faceCanvas = document.createElement('canvas');
    faceCanvas.width = 64;
    faceCanvas.height = 64;
    const ctx = faceCanvas.getContext('2d');
    ctx.fillStyle = playerData.appearance.skinColor || "#ffd1a9";
    ctx.fillRect(0,0,64,64);
    // Desenha olhos
    ctx.fillStyle = '#000';
    if (playerData.appearance.faceStyle === 'face_cheerful') {
      // Olhos sorrindo
      ctx.beginPath(); ctx.arc(20, 24, 3, 0, Math.PI, true); ctx.stroke();
      ctx.beginPath(); ctx.arc(44, 24, 3, 0, Math.PI, true); ctx.stroke();
      // Sorriso alegre
      ctx.beginPath(); ctx.arc(32, 38, 8, 0, Math.PI); ctx.fill();
    } else {
      // Olhos normais e boca séria
      ctx.fillRect(18, 22, 5, 5);
      ctx.fillRect(41, 22, 5, 5);
      ctx.fillRect(24, 40, 16, 3);
    }
    const faceTex = new THREE.CanvasTexture(faceCanvas);
    const faceMat = new THREE.MeshBasicMaterial({ map: faceTex });
    const faceGeo = new THREE.BoxGeometry(0.44, 0.3, 0.1);
    const faceMesh = new THREE.Mesh(faceGeo, faceMat);
    faceMesh.position.set(0, 2.0, 0.38);
    group.add(faceMesh);

    // 3. Cabelo (Malha procedural estilizada)
    const hairGeo = playerData.appearance.hairStyle === 'hair_long' 
      ? new THREE.BoxGeometry(0.9, 0.4, 0.9) 
      : new THREE.BoxGeometry(0.85, 0.3, 0.85);
    const hairMat = new THREE.MeshStandardMaterial({ color: playerData.appearance.hairColor || 0x7e57c2, flatShading: true });
    const hair = new THREE.Mesh(hairGeo, hairMat);
    hair.position.y = 2.3;
    group.add(hair);

    if (playerData.appearance.hairStyle === 'hair_spiky') {
      // Adiciona pequenos espinhos extras no cabelo
      for (let i = 0; i < 3; i++) {
        const spikeGeo = new THREE.ConeGeometry(0.12, 0.4, 4);
        const spike = new THREE.Mesh(spikeGeo, hairMat);
        spike.position.set((i - 1) * 0.22, 0.2, 0.2);
        spike.rotation.x = 0.5;
        hair.add(spike);
      }
    }

    // 4. Armas Visuais Equipadas baseados no equipamento recebido do servidor
    if (playerData.equipment) {
      if (playerData.equipment.main_hand) {
        const weaponId = playerData.equipment.main_hand;
        const weaponGroup = new THREE.Group();
        weaponGroup.position.set(0.7, 0.8, 0.4);

        if (weaponId.includes('Sword') || weaponId.includes('Slasher')) {
          // Lâmina de espada
          const bladeGeo = new THREE.BoxGeometry(0.1, 1.4, 0.04);
          const bladeMat = new THREE.MeshStandardMaterial({ color: 0xdcf8ff, metalness: 0.8, roughness: 0.2 });
          const blade = new THREE.Mesh(bladeGeo, bladeMat);
          blade.position.y = 0.7;
          weaponGroup.add(blade);
          // Hilt
          const hiltGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.4, 5);
          const hiltMat = new THREE.MeshStandardMaterial({ color: 0x795548 });
          const hilt = new THREE.Mesh(hiltGeo, hiltMat);
          hilt.rotation.z = Math.PI / 2;
          weaponGroup.add(hilt);
        } else if (weaponId.includes('Staff') || weaponId.includes('Spire')) {
          // Cajado de mago
          const staffGeo = new THREE.CylinderGeometry(0.06, 0.06, 2.0, 5);
          const staffMat = new THREE.MeshStandardMaterial({ color: 0x5d4037 });
          const staff = new THREE.Mesh(staffGeo, staffMat);
          staff.position.y = 0.5;
          weaponGroup.add(staff);
          // Orbe de Éter no topo
          const orbGeo = new THREE.SphereGeometry(0.18, 5, 5);
          const orbMat = new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x00e5ff, emissiveIntensity: 1.0 });
          const orb = new THREE.Mesh(orbGeo, orbMat);
          orb.position.y = 1.6;
          weaponGroup.add(orb);
        } else if (weaponId.includes('Bow') || weaponId.includes('runner')) {
          // Arco
          const arcGeo = new THREE.TorusGeometry(0.6, 0.04, 5, 12, Math.PI);
          const arcMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63 });
          const arc = new THREE.Mesh(arcGeo, arcMat);
          arc.rotation.z = -Math.PI / 2;
          weaponGroup.add(arc);
        } else if (weaponId.includes('Dagger')) {
          // Adaga curta
          const dBladeGeo = new THREE.BoxGeometry(0.06, 0.7, 0.02);
          const dBladeMat = new THREE.MeshStandardMaterial({ color: 0xb0bec5 });
          const dBlade = new THREE.Mesh(dBladeGeo, dBladeMat);
          dBlade.position.y = 0.35;
          weaponGroup.add(dBlade);
        }

        group.add(weaponGroup);
      }

      // Escudo ou Off-Hand
      if (playerData.equipment.off_hand) {
        const shieldId = playerData.equipment.off_hand;
        const shieldGroup = new THREE.Group();
        shieldGroup.position.set(-0.7, 0.8, 0.2);

        if (shieldId.includes('Shield') || shieldId.includes('Aegis')) {
          const shGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 8);
          const shMat = new THREE.MeshStandardMaterial({ color: 0x78909c, metalness: 0.6 });
          const shield = new THREE.Mesh(shGeo, shMat);
          shield.rotation.x = Math.PI / 2;
          shield.rotation.y = Math.PI / 2;
          shieldGroup.add(shield);
        }
        group.add(shieldGroup);
      }

      // Coroa/Acessório na cabeça se equipado
      if (playerData.equipment.head === 'AetherCrown') {
        const crownGeo = new THREE.TorusGeometry(0.35, 0.05, 5, 8);
        const crownMat = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xffd700, emissiveIntensity: 0.5 });
        const crown = new THREE.Mesh(crownGeo, crownMat);
        crown.position.set(0, 2.5, 0);
        crown.rotation.x = Math.PI / 2;
        group.add(crown);
      }
    }

    // Adiciona o grupo na cena
    this.scene.add(group);
    this.meshes[id] = group;
    return group;
  }

  // Cria e Renderiza Malhas dos 20+ Monstros Procedurais Originais
  createMonsterMesh(mobData, id) {
    if (this.meshes[id]) {
      this.scene.remove(this.meshes[id]);
    }

    const group = new THREE.Group();
    group.position.set(mobData.x, mobData.y, mobData.z);
    group.rotation.y = mobData.r;

    const scale = mobData.size || 1.0;
    const color = mobData.color || 0x42a5f5;

    // Customizações estilizadas baseadas no tipo do monstro
    if (mobData.definitionId.includes('Slime')) {
      // 1. SLIMES: Esferas bouncers fofas
      const bodyGeo = new THREE.SphereGeometry(0.5 * scale, 8, 8);
      const bodyMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.2, transparent: true, opacity: 0.85, flatShading: true });
      const slimeBody = new THREE.Mesh(bodyGeo, bodyMat);
      slimeBody.position.y = 0.3 * scale;
      slimeBody.castShadow = true;
      group.add(slimeBody);

      // Pequenos olhos brancos
      const eyeGeo = new THREE.SphereGeometry(0.08 * scale, 4, 4);
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const le = new THREE.Mesh(eyeGeo, eyeMat); le.position.set(0.18 * scale, 0.45 * scale, 0.4 * scale);
      const re = new THREE.Mesh(eyeGeo, eyeMat); re.position.set(-0.18 * scale, 0.45 * scale, 0.4 * scale);
      group.add(le); group.add(re);
    } 
    else if (mobData.definitionId.includes('Spider')) {
      // 2. ARANHAS DO ÉTER: Segmentadas com 8 patas
      const bodyGeo = new THREE.BoxGeometry(0.6 * scale, 0.4 * scale, 0.8 * scale);
      const bodyMat = new THREE.MeshStandardMaterial({ color: color, flatShading: true });
      const spiderBody = new THREE.Mesh(bodyGeo, bodyMat);
      spiderBody.position.y = 0.4 * scale;
      spiderBody.castShadow = true;
      group.add(spiderBody);

      // Adiciona pernas
      for (let i = 0; i < 4; i++) {
        const legGeo = new THREE.BoxGeometry(0.1 * scale, 0.6 * scale, 0.1 * scale);
        const legL = new THREE.Mesh(legGeo, bodyMat);
        legL.position.set(0.45 * scale, 0.2 * scale, (i - 1.5) * 0.22 * scale);
        legL.rotation.z = -0.5;
        const legR = new THREE.Mesh(legGeo, bodyMat);
        legR.position.set(-0.45 * scale, 0.2 * scale, (i - 1.5) * 0.22 * scale);
        legR.rotation.z = 0.5;
        group.add(legL); group.add(legR);
      }
    } 
    else if (mobData.definitionId.includes('Pup') || mobData.definitionId.includes('Gnasher')) {
      // 3. CANINOS SELVAGENS: Lobos retangulares
      const bodyGeo = new THREE.BoxGeometry(0.5 * scale, 0.5 * scale, 1.1 * scale);
      const bodyMat = new THREE.MeshStandardMaterial({ color: color, flatShading: true });
      const wolfBody = new THREE.Mesh(bodyGeo, bodyMat);
      wolfBody.position.y = 0.5 * scale;
      wolfBody.castShadow = true;
      group.add(wolfBody);

      // Cabeça
      const hGeo = new THREE.BoxGeometry(0.4 * scale, 0.4 * scale, 0.4 * scale);
      const wolfHead = new THREE.Mesh(hGeo, bodyMat);
      wolfHead.position.set(0, 0.7 * scale, 0.6 * scale);
      group.add(wolfHead);
    } 
    else if (mobData.definitionId.includes('Treant') || mobData.definitionId.includes('Sprout')) {
      // 4. TREANTS / BROTOS: Árvores vivas
      const trunkGeo = new THREE.CylinderGeometry(0.2 * scale, 0.4 * scale, 1.8 * scale, 6);
      const trunkMat = new THREE.MeshStandardMaterial({ color: color, flatShading: true });
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 0.9 * scale;
      trunk.castShadow = true;
      group.add(trunk);

      const leafGeo = new THREE.SphereGeometry(0.8 * scale, 5, 5);
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x33691e, flatShading: true });
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.y = 1.0 * scale;
      trunk.add(leaf);
    } 
    else if (mobData.definitionId.includes('Golem') || mobData.definitionId.includes('Scarab')) {
      // 5. GOLEMS / ESCARAVELHOS: Pilhas de pedras flutuantes
      const baseGeo = new THREE.BoxGeometry(0.8 * scale, 0.8 * scale, 0.8 * scale);
      const mat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.9, flatShading: true });
      const base = new THREE.Mesh(baseGeo, mat);
      base.position.y = 0.4 * scale;
      base.castShadow = true;
      group.add(base);

      const topGeo = new THREE.BoxGeometry(0.5 * scale, 0.5 * scale, 0.5 * scale);
      const top = new THREE.Mesh(topGeo, mat);
      top.position.y = 1.0 * scale;
      top.rotation.y = 0.5;
      base.add(top);
    } 
    else if (mobData.definitionId.includes('Lorde')) {
      // 6. CHEFE REGIONAL (GRANDE LORDE DO ÉTER): Cristal octaedro giratório gigante
      const crystalGeo = new THREE.OctahedronGeometry(1.2 * scale, 0);
      const crystalMat = new THREE.MeshStandardMaterial({
        color: 0x00e5ff,
        emissive: 0x00b0ff,
        emissiveIntensity: 1.0,
        metalness: 0.8,
        roughness: 0.1,
        transparent: true,
        opacity: 0.9,
        flatShading: true
      });
      const bossCrystal = new THREE.Mesh(crystalGeo, crystalMat);
      bossCrystal.position.y = 2.5 * scale;
      bossCrystal.name = "spinning_core";
      bossCrystal.castShadow = true;
      group.add(bossCrystal);

      // Pequenos cristais de órbita ao redor!
      for (let i = 0; i < 4; i++) {
        const orbitGeo = new THREE.DodecahedronGeometry(0.25 * scale, 0);
        const orb = new THREE.Mesh(orbitGeo, crystalMat);
        // Distribui ao redor
        const ang = (i / 4) * Math.PI * 2;
        orb.position.set(Math.sin(ang) * 2.8, 1.5, Math.cos(ang) * 2.8);
        orb.name = `orbit_${i}`;
        group.add(orb);
      }
    } 
    else {
      // Genérico: Cubo de cor do mob
      const boxGeo = new THREE.BoxGeometry(0.8 * scale, 0.8 * scale, 0.8 * scale);
      const boxMat = new THREE.MeshStandardMaterial({ color: color, flatShading: true });
      const mesh = new THREE.Mesh(boxGeo, boxMat);
      mesh.position.y = 0.4 * scale;
      group.add(mesh);
    }

    this.scene.add(group);
    this.meshes[id] = group;
    return group;
  }

  // Portais e Pontos de Viagem (Círculos azuis pulsantes com raios)
  createPortalMesh(portalData, id) {
    if (this.meshes[id]) return;

    const group = new THREE.Group();
    group.position.set(portalData.x, portalData.y, portalData.z);

    // Círculo inferior brilhante
    const ringGeo = new THREE.RingGeometry(1.5, 1.8, 8);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    group.add(ring);

    // Cilindro de luz translúcido
    const cylGeo = new THREE.CylinderGeometry(1.5, 1.5, 4.0, 8, 1, true);
    const cylMat = new THREE.MeshBasicMaterial({ color: 0x00bcd4, transparent: true, opacity: 0.15, side: THREE.DoubleSide });
    const beam = new THREE.Mesh(cylGeo, cylMat);
    beam.position.y = 2.0;
    group.add(beam);

    this.scene.add(group);
    this.meshes[id] = group;
  }

  // Gera Saquinho de Loot caído no chão
  createLootMesh(lootData, id) {
    if (this.meshes[id]) return;

    const group = new THREE.Group();
    group.position.set(lootData.x, 0.2, lootData.z);

    // Saquinho marrom ou caixa brilhante dourada dependendo da raridade
    let color = 0x8d6e63; // Common marrom
    if (lootData.rarity === 'Uncommon') color = 0x43a047;
    else if (lootData.rarity === 'Rare') color = 0x1e88e5;
    else if (lootData.rarity === 'Epic') color = 0x8a30d6;
    else if (lootData.rarity === 'Legendary') color = 0xffb300;

    const geo = new THREE.DodecahedronGeometry(0.28, 0);
    const mat = new THREE.MeshStandardMaterial({ color: color, flatShading: true, roughness: 0.4 });
    const sack = new THREE.Mesh(geo, mat);
    sack.castShadow = true;
    group.add(sack);

    // Luz brilhante em cima do loot importante
    if (lootData.rarity !== 'Common') {
      const lootLight = new THREE.PointLight(color, 1.0, 3);
      lootLight.position.y = 0.5;
      group.add(lootLight);
    }

    this.scene.add(group);
    this.meshes[id] = group;
  }

  // Cria Partículas de Impacto / Cast / Level Up
  spawnParticleEffect(type, x, y, z, color = 0xffffff) {
    const pGroup = new THREE.Group();
    pGroup.position.set(x, y, z);
    this.scene.add(pGroup);

    if (type === 'hit') {
      // Partículas explosivas que dissipam rápido
      for (let i = 0; i < 8; i++) {
        const geo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
        const mat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 1 });
        const p = new THREE.Mesh(geo, mat);
        
        const speed = Math.random() * 4 + 2;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);
        
        p.velocity = new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta) * speed,
          Math.sin(phi) * Math.sin(theta) * speed,
          Math.cos(phi) * speed
        );

        p.life = 0.4; // 0.4 segundos de duração
        pGroup.add(p);
        this.particles.push({ mesh: p, group: pGroup, decay: 1 / 0.4 });
      }
    } 
    else if (type === 'level_up') {
      // Feixe de luz ascendente dourado
      const ringGeo = new THREE.CylinderGeometry(1.2, 1.2, 6, 8, 1, true);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
      const beam = new THREE.Mesh(ringGeo, ringMat);
      beam.position.y = 3;
      pGroup.add(beam);

      this.particles.push({
        mesh: beam,
        group: pGroup,
        type: 'level_up',
        life: 1.5,
        decay: 1 / 1.5
      });
    }
  }

  // Atualiza Animações de Partículas e Deleta Expiradas
  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;

      if (p.life <= 0) {
        p.group.remove(p.mesh);
        if (p.group.children.length === 0) {
          this.scene.remove(p.group);
        }
        this.particles.splice(i, 1);
      } else {
        if (p.type === 'level_up') {
          p.mesh.scale.x += dt * 0.2;
          p.mesh.scale.z += dt * 0.2;
          p.mesh.material.opacity -= dt * 0.4;
        } else {
          // Partícula explosiva normal
          p.mesh.position.addScaledVector(p.mesh.velocity, dt);
          p.mesh.material.opacity = Math.max(0, p.life * p.decay);
        }
      }
    }
  }

  // Loop de Renderização e Atualização do Frame
  animate() {
    const clock = new THREE.Clock();

    const renderLoop = () => {
      requestAnimationFrame(renderLoop);

      const dt = clock.getDelta();
      const time = clock.getElapsedTime();

      // 1. Atualiza Animações Procedurais dos Monstros Activos (Squash e Bounces!)
      for (let id in this.meshes) {
        const mesh = this.meshes[id];
        
        if (id.startsWith('mob_')) {
          // Bounce/Squash nos slimes
          if (mesh.children[0]) {
            const body = mesh.children[0];
            // Animação de pulo baseado em ciclo seno!
            const bounce = Math.sin(time * 8) * 0.1;
            body.scale.set(1 + bounce, 1 - bounce, 1 + bounce);
          }

          // Se for o Lorde do Éter, gira o cristal gigante e move órbitas
          const core = mesh.getObjectByName("spinning_core");
          if (core) {
            core.rotation.y += dt * 1.5;
            core.rotation.x += dt * 0.5;

            // Move órbitas ao redor
            for (let i = 0; i < 4; i++) {
              const orb = mesh.getObjectByName(`orbit_${i}`);
              if (orb) {
                const ang = (i / 4) * Math.PI * 2 + (time * 1.2);
                orb.position.set(Math.sin(ang) * 2.8, 1.5 + Math.sin(time*2 + i)*0.3, Math.cos(ang) * 2.8);
                orb.rotation.y += dt * 2.0;
              }
            }
          }
        }

        // Loot flutuando de leve no chão
        if (id.startsWith('loot_')) {
          mesh.position.y = 0.2 + Math.sin(time * 4) * 0.05;
          mesh.rotation.y += dt * 0.8;
        }
      }

      // 2. Atualiza Partículas
      this.updateParticles(dt);

      // 3. Renderiza Cena
      if (this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
      }
    };

    renderLoop();
  }

  // Reposiciona Câmera Suavemente Atrás do Jogador Ativo (Com Colisão do Chão/Paredes)
  updateCamera(playerPos, isMobile = false) {
    if (!playerPos) return;

    // Distância e altura ajustáveis
    const distance = isMobile ? this.cameraDistance * 0.8 : this.cameraDistance;
    const height = isMobile ? this.cameraHeight * 0.8 : this.cameraHeight;

    // Calcula posição alvo da câmera baseado no ângulo horizontal (Yaw)
    const targetX = playerPos.x - Math.sin(this.cameraYaw) * distance;
    const targetZ = playerPos.z - Math.cos(this.cameraYaw) * distance;
    const targetY = playerPos.y + height;

    // Interpolação suave de posição da câmera
    this.camera.position.x += (targetX - this.camera.position.x) * 0.12;
    this.camera.position.y += (targetY - this.camera.position.y) * 0.12;
    this.camera.position.z += (targetZ - this.camera.position.z) * 0.12;

    // Câmera olha para o jogador (com leve compensação para cima para visualização elevada)
    const lookAtPos = new THREE.Vector3(playerPos.x, playerPos.y + 1.2, playerPos.z);
    this.camera.lookAt(lookAtPos);
  }

  // Remove uma entidade removida (player desconectou, mob morreu, loot pego)
  removeEntity(id) {
    if (this.meshes[id]) {
      this.scene.remove(this.meshes[id]);
      delete this.meshes[id];
    }
  }

  // Converte Coordenadas 3D em 2D para colocar Textos e Barras flutuantes no HUD HTML
  project3DTo2D(position3D) {
    const vec = new THREE.Vector3(position3D.x, position3D.y, position3D.z);
    vec.project(this.camera);

    const x = (vec.x * .5 + .5) * window.innerWidth;
    const y = (-(vec.y * .5) + .5) * window.innerHeight;

    return { x, y, visible: vec.z <= 1 };
  }
}
