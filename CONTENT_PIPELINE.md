# CONTENT PIPELINE E SUBSTITUIÇÃO DE ASSETS
### Chronicles of Aetheria — Guia de Substituição de Assets e Extensão

Para garantir 100% de estabilidade, velocidade de carregamento e portabilidade sem a necessidade de baixar gigabytes de modelos e texturas, o Chronicles of Aetheria utiliza **geração e sintetização procedural no cliente** ( Three.js + Web Audio API ).

Este documento descreve as estruturas técnicas para substituir estas rotinas procedurais por arquivos estáticos tradicionais de arte (3D, áudio e ícones) conforme o projeto for escalado.

---

## 1. Pipeline de Arte 3D (Substituir Modelos de Jogadores e Monstros)

Atualmente, o renderizador instancia blocos 3D de forma procedural (`js/renderer.js`):
```js
const bodyGeo = new THREE.CylinderGeometry(0.5, 0.3, 1.8, 8);
```

### Como importar Modelos GLTF/GLB estáticos:
Para usar modelos complexos modelados no Blender ou Maya:

1. Adicione o **`GLTFLoader`** de Three.js no cabeçalho do arquivo `index.html`:
   ```html
   <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js"></script>
   ```
2. Modifique o método `createPlayerMesh` ou `createMonsterMesh` em `js/renderer.js` para carregar o arquivo `.glb` estático localizado na pasta de assets:
   ```js
   const loader = new THREE.GLTFLoader();
   loader.load('assets/models/vanguard_character.glb', (gltf) => {
     const model = gltf.scene;
     model.scale.set(1, 1, 1);
     model.castShadow = true;
     
     // Adiciona mesh carregado no grupo da entidade
     group.add(model);
   });
   ```

---

## 2. Pipeline de Som (Substituir Sintetizadores por Trilhas Sonoras MP3/WAV)

Atualmente, o gerenciador de áudio (`js/ui.js`) utiliza o oscilador eletrônico do Web Audio para criar ondas sonoras simples.

### Como carregar Arquivos de Áudio Estáticos:
Substitua as funções de disparo sintético por instâncias de áudio nativas do HTML5 carregando canais independentes de música e efeitos sonoros:

1. Salve suas trilhas estáticas de som na pasta `public/assets/audio/`:
   * `public/assets/audio/hit.wav`
   * `public/assets/audio/level_up.mp3`
   * `public/assets/audio/town_bgm.mp3`
2. No gerenciador de áudio (`js/ui.js`), substitua o método `playSfx` para disparar os buffers estáticos:
   ```js
   playSfx(type) {
     const soundPath = `assets/audio/${type}.wav`; // hit.wav, level_up.wav, etc.
     const audio = new Audio(soundPath);
     audio.volume = 0.5; // Controle deslizável de volume no HUD
     audio.play().catch(err => console.log("Interação do usuário necessária."));
   }
   ```
3. Para tocar músicas de mapa contínuas com looping suave nas mudanças de portal:
   ```js
   playBGM(mapName) {
     if (this.currentBgm) this.currentBgm.pause();
     this.currentBgm = new Audio(`assets/audio/${mapName}_bgm.mp3`);
     this.currentBgm.loop = true;
     this.currentBgm.volume = 0.3;
     this.currentBgm.play();
   }
   ```

---

## 3. Pipeline de Ícones e Interface Gráfica

A interface do jogo usa emoticons e texturas de cores sólidas para os itens da mochila. 

### Substituição por Texturas e Imagens Reais:
Para trocar os emojis por arquivos PNG estilizados de alta definição:
1. Adicione imagens de ícones na pasta `public/assets/icons/` com dimensões fixas de `64x64px`.
2. Altere o preenchimento de slots no arquivo `js/ui.js` para usar tags de imagens apontando para as raridades correspondentes:
   ```js
   // Substitua a linha: slotElement.querySelector('.icon').innerText = icon;
   // Por:
   slotElement.querySelector('.icon').innerHTML = `<img src="assets/icons/${itemRow.item_id}.png" width="40" height="40">`;
   ```
This maps perfectly onto standard high-performance production pipelines!
