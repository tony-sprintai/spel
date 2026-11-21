// Borgbyggaren – grafik.js
// Allt som ritas. Läser spelets tillstånd (modell.js) och ritar det med Three.js 0.160.0.
// Kontrakt: skapaGrafik(canvas, opts) → {ladda, synka, rendera, storlek, skarmTillMark, matning}
// Kräver importmap i sidan:  "three" och "three/addons/"  (jsdelivr, three@0.160.0).
//
// ─────────────────────────────────────────────────────────────────────────────
//  JUSTERA HÄR VID SAMMANFOGNINGEN
//  1. MODELLER  nyckel → fil under assets/
//  2. KLIPP     anim-läge i modellen → animationsklipp i riggen [namn, tempo, enGång]
//  3. TYPER     enhetens `typ` → hur den ritas (slag, modell, skala, klipp)
//  4. HANDELSER händelsens `typ` → effekt
//  Okänd typ ritas som en orange låda med frågetecken och loggas en gång.
//
//  SÅ LÄSER GRAFIKEN SPELET
//  • Alla listor direkt under `spel` gås igenom (namnen spelar ingen roll, `handelser` hoppas över).
//    Varje element med id, typ, x och z ritas. Objekt skapas, flyttas och tas bort utifrån listnamn + id.
//  • rot = vridning runt y i radianer. En figur med rot 0 tittar mot +z, alltså (sin rot, cos rot).
//    Murar och portar ligger längs sin lokala x-axel vid rot 0. Kameran står i söder (+z) och tittar mot norr.
//  • anim: idle, ga, spring, hugg, bar, do (plus hugg2, traff, block, bygg, plocka, jubel, arbeta, kasta, han, snurr).
//  • Byggen: niva 0 eller byggd === false ritas inte. När niva ökar reser sig bygget. Torn byter modell per nivå.
//    raserad === true ritas som en låg ruin. Murar och portar läser ändpunkterna ax, az, bx, bz; rot pekar utåt.
//  • Enheter med dod > 0 spelar dödsanimationen. arbetare.inne === true ritas inte. Boss med varnar > 0 får en röd ring på (vx, vz).
//  • Betalruta: pris och betalt (tal, eller objekt per resurs som {tra: 10, sten: 5}), resurs ('tra'|'sten'|'guld'),
//    bygge eller ikon (väljer symbol), dold/aktiv. Rutan visar det som återstår.
//  • Projektil: slag ('pil'|'magi'|'eld', äldre namn: sort) och malId. Pilar går i en båge från torntoppen mot målet.
//    Resurs: slag ('tra'|'sten'|'guld', äldre namn: sort), y om den flyger.
//  • Riddarens last: bar eller last (tal, eller {tra, sten, guld}) ritas som en hög på ryggen.
//  • Träd och stenar: anim 'do' (eller ater > 0, hp <= 0) ritas som stubbe respektive liten stenrest.
//  • Där två murar eller portar möts (samma ändpunkt) ställs en hörnstolpe som fyller kilen.
//  • Gravfälten (gravstenar, döda träd, krypta) läggs ut som dekor i de fyra väderstrecken, 42 m från tronsalen.
//  • Händelsen 'slag' ger en svepande båge framför den som slår, 'skott' en liten blixt där skottet går av.
//  • Riddaren (TYPER.riddare.siluett) syns som blå silhuett när något skymmer honom, och hamnar O.spelarAndel (0,575) ner på skärmen.
//  • Kameran följer spel.spelare om den finns, annars första enheten med typ 'riddare'.
//  • Skymningens gröna sken ritas vid gravfälten i spel.vag.riktningar (eller platserna i händelsen 'varning').
//  • spel.handelser läses men töms inte här. Samma händelseobjekt ritas bara en gång.
//  Utöver kontraktet finns: sattKvalitet(n), skaka(styrka), snapp() (kameran hoppar direkt till spelaren vid nästa synka), effekt(namn, x, z), markHojd(x, z), kamera, scen, renderer, opts.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const MODELLER = {
  // Figurer (KayKit Adventurers + Skeletons, samma rigg). Klippen ligger i knight och skeleton_minion.
  knight: 'figurer/knight.glb',
  barbarian: 'figurer/barbarian.glb',
  rogue: 'figurer/rogue.glb',
  sk_minion: 'figurer/skeleton_minion.glb',
  sk_warrior: 'figurer/skeleton_warrior.glb',
  sk_rogue: 'figurer/skeleton_rogue.glb',
  sk_mage: 'figurer/skeleton_mage.glb',
  // Lösa vapen till skeletten (bakas in i figuren vid laddning)
  sk_svard: 'vapen/Skeleton_Blade.gltf',
  sk_yxa: 'vapen/Skeleton_Axe.gltf',
  sk_stav: 'vapen/Skeleton_Staff.gltf',
  sk_skold_stor: 'vapen/Skeleton_Shield_Large_A.gltf',
  sk_skold_liten: 'vapen/Skeleton_Shield_Small_A.gltf',
  pil: 'vapen/arrow.gltf',
  // Byggnader (KayKit Medieval Hexagon Pack, miniatyrskala: skalas upp cirka 3 gånger)
  slott: 'hex/building_castle_blue.gltf',
  kasern: 'hex/building_barracks_blue.gltf',
  smedja: 'hex/building_blacksmith_blue.gltf',
  sagverk: 'hex/building_lumbermill_blue.gltf',
  gruva: 'hex/building_mine_blue.gltf',
  torn_bas: 'hex/building_tower_base_blue.gltf',
  torn_a: 'hex/building_tower_A_blue.gltf',
  torn_b: 'hex/building_tower_B_blue.gltf',
  hus: 'hex/building_home_A_blue.gltf',
  mur: 'hex/wall_straight.gltf',
  murport: 'hex/wall_straight_gate.gltf',
  // Natur och rekvisita
  trad_a: 'hex/tree_single_A.gltf',
  trad_b: 'hex/tree_single_B.gltf',
  stubbe: 'hex/tree_single_A_cut.gltf',
  sten_c: 'hex/rock_single_C.gltf',
  sten_e: 'hex/rock_single_E.gltf',
  sten_b: 'hex/rock_single_B.gltf',
  virke: 'hex/resource_lumber.gltf',
  stenhog: 'hex/resource_stone.gltf',
  tunna: 'hex/barrel.gltf',
  lada: 'hex/crate_A_big.gltf',
  talt: 'hex/tent.gltf',
  mynt: 'dungeon/coin.glb',
  fackla: 'dungeon/torch_lit.glb',
  pelare: 'dungeon/pillar.glb',
  ruinmur: 'dungeon/wall_broken.glb',
  // Gravfält (KayKit Halloween Bits)
  gravsten: 'gravplats/gravestone.gltf',
  grav_a: 'gravplats/grave_A.gltf',
  grav_b: 'gravplats/grave_B.gltf',
  gravkors: 'gravplats/gravemarker_A.gltf',
  krypta: 'gravplats/crypt.gltf',
  dodtrad: 'gravplats/tree_dead_large.gltf',
  dodtrad2: 'gravplats/tree_dead_medium.gltf',
  // v2
  skalle: 'gravplats/skull.gltf',            // eldanden
  grus: 'dungeon/rubble_large.glb',          // ruiner
  ruinhus: 'hex/building_destroyed.gltf',
  stenA: 'hex/rock_single_A.gltf',
  stenD: 'hex/rock_single_D.gltf',
};

// Vilken modellfil som bär animationsklippen för varje rigg.
export const KLIPPKALLA = { aventyrare: 'knight', skelett: 'sk_minion' };

// anim-läge → [klippnamn, tempo, spelas en gång]. Okänt läge faller tillbaka på idle.
export const KLIPP = {
  aventyrare: {
    idle: ['Idle', 1], ga: ['Walking_A', 1.25], spring: ['Running_A', 1.15], hugg: ['1H_Melee_Attack_Chop', 1.35],
    hugg2: ['1H_Melee_Attack_Slice_Diagonal', 1.3], bar: ['Walking_B', 1.2], do: ['Death_A', 1, true], traff: ['Hit_A', 1.2, true],
    block: ['Block', 1], bygg: ['Interact', 1.2], plocka: ['PickUp', 1.2], jubel: ['Cheer', 1], arbeta: ['2H_Melee_Attack_Chop', 1.1],
  },
  skelett: {
    idle: ['Idle_Combat', 1], ga: ['Walking_D_Skeletons', 1.3], spring: ['Running_C', 1.1], hugg: ['1H_Melee_Attack_Chop', 1.2],
    hugg2: ['2H_Melee_Attack_Chop', 1.1], bar: ['Walking_A', 1.2], do: ['Death_C_Skeletons', 1.25, true], traff: ['Hit_A', 1.2, true],
    kasta: ['Spellcast_Shoot', 1.1], ladda: ['Spellcast_Raise', 1], han: ['Taunt', 1], snurr: ['2H_Melee_Attack_Spin', 1], vakna: ['Spawn_Ground_Skeletons', 1.4, true],
  },
};

// typ → ritning.
//  slag 'figur':   modell, rigg, skala, delar (lösa delar i glb som ska med), vapen ([{modell, ben, pos, rot, skala}]),
//                  dolj (skinnade delar som tas bort), farg (ton), klipp (egna avvikelser från KLIPP[rigg]), lag ('van'|'fiende'), hpHojd
//  slag 'bygge':   modell eller nivaer [modell per nivå], skala, eldar [[x,y,z] i meter], hpHojd, rotJust
//  slag 'instans': varianter [modell], skala [min,max] (InstancedMesh, ett ritanrop per variant)
//  slag 'mur':     palissad (byggs i kod) eller stenmur (modell), langd = segmentets längd i meter längs lokal x
//  slag 'eld', 'ruta', 'projektil', 'resurs': se respektive avsnitt.
export const TYPER = {
  riddare: { slag: 'figur', modell: 'knight', rigg: 'aventyrare', skala: 0.8, siluett: 0x4fa0ff, delar: ['1H_Sword', 'Badge_Shield', 'Knight_Helmet', 'Knight_Cape'], lag: 'van', hpHojd: 2.0 },
  soldat: { slag: 'figur', modell: 'knight', rigg: 'aventyrare', skala: 0.63, delar: ['1H_Sword', 'Rectangle_Shield', 'Knight_Helmet'], farg: 0xffd9c2, lag: 'van', hpHojd: 1.75 },
  arbetare: { slag: 'figur', modell: 'barbarian', rigg: 'aventyrare', skala: 0.58, delar: ['1H_Axe'], lag: 'van', hpHojd: 1.6, klipp: { hugg: ['2H_Melee_Attack_Chop', 1.1] } },
  bagskytt: { slag: 'figur', modell: 'rogue', rigg: 'aventyrare', skala: 0.62, delar: ['2H_Crossbow', 'Rogue_Cape'], lag: 'van', hpHojd: 1.7 },
  skelettkrigare: { slag: 'figur', modell: 'sk_minion', rigg: 'skelett', skala: 0.64, vapen: [{ modell: 'sk_svard', ben: 'handslot.r' }, { modell: 'sk_skold_liten', ben: 'handslot.l' }], lag: 'fiende', hpHojd: 1.7 },
  skelettskurk: { slag: 'figur', modell: 'sk_rogue', rigg: 'skelett', skala: 0.59, vapen: [{ modell: 'sk_yxa', ben: 'handslot.r' }], lag: 'fiende', hpHojd: 1.6, klipp: { ga: ['Running_C', 1.0] } },
  skelettmagiker: { slag: 'figur', modell: 'sk_mage', rigg: 'skelett', skala: 0.66, vapen: [{ modell: 'sk_stav', ben: 'handslot.r' }], lag: 'fiende', hpHojd: 1.9, glod: 0x66ff88, klipp: { hugg: ['Spellcast_Shoot', 1.1] } },
  jatte: { slag: 'figur', modell: 'sk_warrior', rigg: 'skelett', skala: 1.2, vapen: [{ modell: 'sk_yxa', ben: 'handslot.r', skala: 1.25 }, { modell: 'sk_skold_stor', ben: 'handslot.l' }], lag: 'fiende', hpHojd: 3.1, klipp: { ga: ['Walking_D_Skeletons', 0.9], hugg: ['2H_Melee_Attack_Chop', 0.9] }, tung: true },
  boss: { slag: 'figur', modell: 'sk_warrior', rigg: 'skelett', skala: 1.8, vapen: [{ modell: 'sk_svard', ben: 'handslot.r', skala: 1.4 }, { modell: 'sk_skold_stor', ben: 'handslot.l' }], farg: 0xc9b4ff, glod: 0xff3355, krona: true, lag: 'fiende', boss: true, hpHojd: 4.6, klipp: { ga: ['Walking_D_Skeletons', 0.75], hugg: ['2H_Melee_Attack_Chop', 0.8] }, tung: true },
  // v2: hjältar, handelsman och nya fiender. kod = figuren byggs i kod (egen enkel rigg, se KODFIGURER).
  helare: { slag: 'figur', modell: 'rogue', rigg: 'aventyrare', skala: 0.62, delar: ['Knife', 'Rogue_Cape'], farg: 0xdcf6dc, lag: 'van', hpHojd: 1.7, lakljus: true },
  kampe: { slag: 'figur', modell: 'barbarian', rigg: 'aventyrare', skala: 0.75, delar: ['2H_Axe', 'Barbarian_Hat'], farg: 0xffe8d8, lag: 'van', hpHojd: 2.05, klipp: { hugg: ['2H_Melee_Attack_Chop', 1.1] } },
  handlare: { slag: 'figur', modell: 'barbarian', rigg: 'aventyrare', skala: 0.6, delar: ['Barbarian_Hat', 'Mug'], farg: 0xf0cc90, lag: 'van', hpHojd: 1.7, tillbehor: [{ modell: 'lada', pos: [1.05, 0, 0.15], skala: 4.2, rot: 0.4 }, { modell: 'tunna', pos: [-0.95, 0, -0.25], skala: 3.6 }] },
  isvarg: { slag: 'figur', kod: 'varg', skala: 1.0, glod: 0xa8ecff, lag: 'fiende', hpHojd: 1.4 },
  frostmagiker: { slag: 'figur', modell: 'sk_mage', rigg: 'skelett', skala: 0.66, vapen: [{ modell: 'sk_stav', ben: 'handslot.r' }], farg: 0xbfe2ff, lag: 'fiende', hpHojd: 1.9, glod: 0x58c8ff, klipp: { hugg: ['Spellcast_Shoot', 1.1] } },
  eldande: { slag: 'svav', modell: 'skalle', skala: 1.25, hojd: 1.25, lag: 'fiende', hpHojd: 2.4 },
  belagringsbest: { slag: 'figur', modell: 'sk_warrior', rigg: 'skelett', skala: 1.6, vapen: [{ modell: 'sk_yxa', ben: 'handslot.r', skala: 1.9 }], farg: 0x8a4c44, glod: 0xff5a1a, sprickor: 0xff5a14, lag: 'fiende', hpHojd: 4.1, klipp: { ga: ['Walking_D_Skeletons', 0.75], hugg: ['2H_Melee_Attack_Chop', 0.8] }, tung: true },
  frostboss: { slag: 'figur', modell: 'sk_warrior', rigg: 'skelett', skala: 1.8, vapen: [{ modell: 'sk_svard', ben: 'handslot.r', skala: 1.4 }, { modell: 'sk_skold_stor', ben: 'handslot.l' }], farg: 0xb4d8ff, glod: 0x48c8ff, krona: 0xcff2ff, lag: 'fiende', boss: true, hpHojd: 4.6, klipp: { ga: ['Walking_D_Skeletons', 0.75], hugg: ['2H_Melee_Attack_Chop', 0.8] }, tung: true },
  eldboss: { slag: 'figur', modell: 'sk_warrior', rigg: 'skelett', skala: 1.8, vapen: [{ modell: 'sk_yxa', ben: 'handslot.r', skala: 1.7 }, { modell: 'sk_skold_stor', ben: 'handslot.l' }], farg: 0xffa08a, glod: 0xff4a10, sprickor: 0xff6a1a, krona: 0xff9a2a, lag: 'fiende', boss: true, hpHojd: 4.6, klipp: { ga: ['Walking_D_Skeletons', 0.75], hugg: ['2H_Melee_Attack_Chop', 0.8] }, tung: true },
  drake: { slag: 'figur', kod: 'drake', skala: 1.0, glod: 0xff7a24, lag: 'fiende', boss: true, hpHojd: 6.3, svav: 2.5, tung: true },

  // Byggnadernas skala är vald efter radierna i modell.js (TUNE.byggen): tronsal 3, torn 1,1, kasern/smedja 1,4, kojor 1,6.
  tronsal: { slag: 'bygge', modell: 'slott', skala: 2.8, hpHojd: 11.8, eldar: [[-1.65, 1.4, 3.6], [1.65, 1.4, 3.6]], radie: 3 },
  torn: { slag: 'bygge', nivaer: ['torn_bas', 'torn_a', 'torn_b'], skala: 2.3, hpHojd: 6.2, radie: 1.3 },
  kasern: { slag: 'bygge', modell: 'kasern', skala: 2.3, hpHojd: 4.4, radie: 1.8 },
  smedja: { slag: 'bygge', modell: 'smedja', skala: 2.5, hpHojd: 3.2, radie: 1.7 },
  vedkoja: { slag: 'bygge', modell: 'sagverk', skala: 2.4, hpHojd: 3.2, radie: 1.8 },
  stenkoja: { slag: 'bygge', modell: 'gruva', skala: 2.1, hpHojd: 3.0, radie: 1.8 },
  hus: { slag: 'bygge', modell: 'hus', skala: 2.6, hpHojd: 3.0, radie: 1.4 },
  // Murar och portar ligger mellan ändpunkterna (ax, az)–(bx, bz) och delas upp i bitar om cirka `langd` meter.
  port: { slag: 'bygge', modell: 'murport', skala: [2.3, 2.5, 1.5], portBredd: 4.6, hpHojd: 4.0, radie: 2.4, port: true },
  palissad: { slag: 'mur', sort: 'palissad', langd: 4, hojd: 0.86, hpHojd: 3.0 },
  stenmur: { slag: 'mur', sort: 'sten', modell: 'mur', langd: 4, hojd: 2.4, tjocklek: 1.45, hpHojd: 3.1 },

  fyrfat: { slag: 'eld', sort: 'fyrfat', skala: 0.9, eldHojd: 1.12, styrka: 1 },
  fackla: { slag: 'eld', sort: 'fackla', modell: 'fackla', skala: 1.3, eldHojd: 1.4, styrka: 0.6 },
  varmeeld: { slag: 'eld', sort: 'varmeeld', skala: 1.0, eldHojd: 0.32, styrka: 1.45, flammor: [[0, 0, 0, 1], [0.42, 0, 0.18, 0.35], [-0.36, 0, -0.26, 0.35]] },
  // v2: belägringsmaskiner och vallgrav byggs i kod (se byggMaskin, byggGrav)
  katapult: { slag: 'maskin', sort: 'katapult', skala: 1.0, hpHojd: 3.6, radie: 1.3 },
  ballista: { slag: 'maskin', sort: 'ballista', skala: 1.25, hpHojd: 3.2, radie: 1.1 },
  vallgrav: { slag: 'grav', radie: 3.2 },
  bat: { slag: 'bat' },

  trad: { slag: 'instans', varianter: ['trad_b', 'trad_a', 'trad_b'], skala: [3.2, 4.4], vaj: 1, stubbe: 'stubbe', farger: [0xffffff, 0xe6f2c8, 0xcfe8b0, 0xf4e9b8] },
  sten: { slag: 'instans', varianter: ['sten_c', 'sten_e', 'sten_b'], skala: [5.5, 8], slutSkala: 0.3, farger: [0xffffff, 0xe4e4ea, 0xd8d2c8], dov: true },
  gravsten: { slag: 'instans', varianter: ['gravsten', 'grav_a', 'grav_b', 'gravkors'], skala: [0.52, 0.66], farger: [0xffffff, 0xd8dde0] },
  dodtrad: { slag: 'instans', varianter: ['dodtrad', 'dodtrad2'], skala: [1.5, 2.0] },
  krypta: { slag: 'bygge', modell: 'krypta', skala: 0.75, hpHojd: 7, radie: 3 },
  tunna: { slag: 'instans', varianter: ['tunna'], skala: [4, 4] },
  lada: { slag: 'instans', varianter: ['lada'], skala: [4, 4] },
  talt: { slag: 'instans', varianter: ['talt'], skala: [4.5, 4.5] },

  betalruta: { slag: 'ruta', storlek: 3.2 },
  projektil: { slag: 'projektil', modell: 'pil', skala: 2.3, hojd: 1.5 },
  resurs: { slag: 'resurs', sorter: { tra: ['virke', 1.5], sten: ['stenhog', 1.5], guld: ['mynt', 1.0] }, hojd: 0.0 },
};

// Ikoner på betalrutor och i HUD:en: ritas med canvas så att de ser likadana ut överallt (inga emoji).
// ritaIkon(c, namn, x, y, s): c = 2D-kontext, (x, y) = mitten, s = sidans längd i bildpunkter.
export const IKONER = ['tra', 'sten', 'guld', 'palissad', 'stenmur', 'mur', 'port', 'torn', 'kasern', 'vedkoja', 'stenkoja', 'smedja',
  'fyrfat', 'fackla', 'tronsal', 'soldat', 'svard', 'rustning', 'bar', 'horn', 'hjarta', 'dodskalle', 'okand',
  'varmeeld', 'katapult', 'ballista', 'vallgrav', 'bagskytt', 'helare', 'kampe', 'karta', 'lada', 'eldpilar', 'dryck', 'murbruk',
  'o_glantan', 'o_frost', 'o_vulkan'];
export function ritaIkon(c, namn, x, y, s) {
  c.save(); c.translate(x, y); c.scale(s / 100, s / 100); c.lineJoin = 'round'; c.lineCap = 'round';
  const K = '#2a1a0c';
  const fyll = (farg, lw = 5) => { c.fillStyle = farg; c.fill(); if (lw) { c.lineWidth = lw; c.strokeStyle = K; c.stroke(); } };
  const rr = (px, py, w, h, r) => { c.beginPath(); c.moveTo(px + r, py); c.arcTo(px + w, py, px + w, py + h, r); c.arcTo(px + w, py + h, px, py + h, r); c.arcTo(px, py + h, px, py, r); c.arcTo(px, py, px + w, py, r); c.closePath(); };
  const poly = (p) => { c.beginPath(); c.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]); c.closePath(); };
  const linje = (p, farg, lw) => { c.beginPath(); c.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]); c.lineWidth = lw; c.strokeStyle = farg; c.stroke(); };
  const cirkel = (px, py, r) => { c.beginPath(); c.arc(px, py, r, 0, Math.PI * 2); };
  const svard = (v) => { c.save(); c.rotate(v); poly([-6, -40, 0, -50, 6, -40, 6, 14, -6, 14]); fyll('#e4eaf2'); linje([0, -40, 0, 10], '#9aa6b4', 2.5); rr(-17, 13, 34, 9, 4); fyll('#e0a820'); rr(-4.5, 22, 9, 18, 3); fyll('#7a4e26'); cirkel(0, 43, 5.5); fyll('#e0a820', 4); c.restore(); };
  const skold = (farg) => { c.beginPath(); c.moveTo(-34, -38); c.lineTo(34, -38); c.lineTo(34, -2); c.quadraticCurveTo(32, 30, 0, 46); c.quadraticCurveTo(-32, 30, -34, -2); c.closePath(); fyll(farg); linje([0, -34, 0, 38], '#ffe9a8', 7); linje([-30, -8, 30, -8], '#ffe9a8', 7); };
  const laga = (sk) => { c.beginPath(); c.moveTo(0, -46 * sk); c.bezierCurveTo(8 * sk, -26 * sk, 34 * sk, -8 * sk, 28 * sk, 20 * sk); c.bezierCurveTo(24 * sk, 40 * sk, 8 * sk, 44 * sk, 0, 44 * sk); c.bezierCurveTo(-8 * sk, 44 * sk, -24 * sk, 40 * sk, -28 * sk, 20 * sk); c.bezierCurveTo(-34 * sk, -4 * sk, -10 * sk, -14 * sk, 0, -46 * sk); c.closePath(); };
  const mur = () => { poly([-44, 40, -44, -30, -24, -30, -24, -12, -10, -12, -10, -30, 10, -30, 10, -12, 24, -12, 24, -30, 44, -30, 44, 40]); fyll('#b4bcc8'); };
  switch (namn) {
    case 'tra': rr(-44, -4, 86, 30, 15); fyll('#a8703c'); cirkel(28, 11, 14); fyll('#e6bd82', 4); cirkel(28, 11, 6); c.lineWidth = 3; c.strokeStyle = '#a8703c'; c.stroke();
      rr(-32, -34, 72, 27, 13); fyll('#c98a4b'); cirkel(27, -20.5, 12.5); fyll('#f0cd96', 4); cirkel(27, -20.5, 5); c.lineWidth = 3; c.strokeStyle = '#c98a4b'; c.stroke(); break;
    case 'sten': poly([-42, 22, -32, -14, -6, -36, 26, -26, 44, 6, 30, 32, -20, 36]); fyll('#aeb6c2'); linje([-6, -36, 2, -2, 44, 6], '#7d8694', 4); linje([2, -2, -20, 36], '#7d8694', 4); linje([-32, -14, 2, -2], '#d4dae2', 4); break;
    case 'guld': cirkel(0, 0, 38); fyll('#ffd24a'); cirkel(0, 0, 25); c.lineWidth = 5; c.strokeStyle = '#c98f10'; c.stroke(); linje([-8, -10, 4, -14], '#fff4c0', 6); break;
    case 'palissad': for (let i = -1; i <= 1; i++) { poly([i * 29 - 13, 40, i * 29 - 13, -24, i * 29, -46, i * 29 + 13, -24, i * 29 + 13, 40]); fyll(i === 0 ? '#c08a4e' : '#a8703c'); } rr(-46, 4, 92, 13, 4); fyll('#7a4e26'); break;
    case 'stenmur': case 'mur': mur(); linje([-44, 8, 44, 8], '#7d8694', 4); linje([-14, 8, -14, 40], '#7d8694', 4); linje([16, 8, 16, 40], '#7d8694', 4); linje([0, -12, 0, 8], '#7d8694', 4); break;
    case 'port': mur(); c.beginPath(); c.moveTo(-21, 40); c.lineTo(-21, 12); c.arc(0, 12, 21, Math.PI, 0); c.lineTo(21, 40); c.closePath(); fyll('#8a5a30'); linje([0, -8, 0, 40], K, 4); cirkel(-7, 20, 3); fyll('#e0a820', 0); cirkel(7, 20, 3); fyll('#e0a820', 0); break;
    case 'torn': rr(-21, -14, 42, 56, 3); fyll('#aeb6c2'); poly([-32, -12, -32, -42, -17, -42, -17, -29, -7, -29, -7, -42, 7, -42, 7, -29, 17, -29, 17, -42, 32, -42, 32, -12]); fyll('#c6ccd6'); rr(-5, 2, 10, 20, 5); fyll('#3a3f4a', 0); linje([-21, 30, 21, 30], '#7d8694', 4); break;
    case 'kasern': svard(-0.62); svard(0.62); break;
    case 'svard': svard(0.6); break;
    case 'rustning': skold('#3f7fd0'); break;
    case 'soldat': skold('#d04a3f'); break;
    case 'vedkoja': linje([-24, 42, 12, -34], K, 15); linje([-24, 42, 12, -34], '#a8703c', 8); poly([2, -46, 36, -50, 46, -20, 22, -12, 8, -26]); fyll('#d2dae4'); linje([36, -50, 46, -20], '#f4f8ff', 4); break;
    case 'stenkoja': linje([-26, 42, 8, -22], K, 15); linje([-26, 42, 8, -22], '#a8703c', 8); c.beginPath(); c.moveTo(-36, -14); c.quadraticCurveTo(8, -58, 44, -4); c.lineWidth = 18; c.strokeStyle = K; c.stroke(); c.lineWidth = 10; c.strokeStyle = '#c6ccd6'; c.stroke(); break;
    case 'smedja': poly([-40, -22, 30, -22, 48, -12, 30, -4, 12, -4, 18, 22, -18, 22, -12, -4, -40, -4]); fyll('#6a717c'); rr(-30, 22, 60, 15, 4); fyll('#4a505a'); linje([-34, -15, 24, -15], '#aeb6c2', 4); break;
    case 'fyrfat': case 'fackla': laga(1); fyll('#ff7a1e'); c.translate(0, 12); laga(0.55); fyll('#ffd24a', 0); break;
    case 'tronsal': poly([-40, 26, -45, -22, -22, 0, 0, -36, 22, 0, 45, -22, 40, 26]); fyll('#ffd24a'); rr(-41, 22, 82, 15, 4); fyll('#e0a820'); cirkel(0, 4, 6); fyll('#e0483f', 3); cirkel(-24, 12, 4.5); fyll('#4aa0e0', 3); cirkel(24, 12, 4.5); fyll('#4aa0e0', 3); break;
    case 'bar': c.beginPath(); c.moveTo(-12, -30); c.bezierCurveTo(-46, -8, -44, 42, 0, 42); c.bezierCurveTo(44, 42, 46, -8, 12, -30); c.closePath(); fyll('#c9a36a'); poly([-16, -30, -22, -46, 0, -40, 22, -46, 16, -30]); fyll('#b08a52'); linje([-15, -29, 15, -29], '#7a4e26', 6); break;
    case 'horn': c.beginPath(); c.moveTo(-44, -10); c.quadraticCurveTo(-30, 44, 30, 30); c.lineTo(40, -20); c.quadraticCurveTo(-4, 10, -36, -16); c.closePath(); fyll('#f0e2b4'); linje([8, 4, 14, 30], '#b08a52', 6); linje([-18, 0, -14, 22], '#b08a52', 6); c.save(); c.translate(36, 5); c.rotate(0.2); c.beginPath(); c.ellipse(0, 0, 9, 26, 0, 0, Math.PI * 2); fyll('#7a4e26'); c.restore(); cirkel(-42, -12, 5); fyll('#e0a820', 4); break;
    case 'hjarta': c.beginPath(); c.moveTo(0, 40); c.bezierCurveTo(-56, 4, -40, -44, 0, -18); c.bezierCurveTo(40, -44, 56, 4, 0, 40); c.closePath(); fyll('#e0483f'); break;
    case 'dodskalle': c.beginPath(); c.arc(0, -8, 34, Math.PI * 0.82, Math.PI * 0.18); c.lineTo(20, 36); c.lineTo(-20, 36); c.closePath(); fyll('#eef0e6'); cirkel(-13, -8, 9); fyll('#2a1a0c', 0); cirkel(13, -8, 9); fyll('#2a1a0c', 0); poly([0, 6, -5, 16, 5, 16]); fyll('#2a1a0c', 0); linje([-8, 24, -8, 36], K, 4); linje([0, 24, 0, 36], K, 4); linje([8, 24, 8, 36], K, 4); break;
    // v2
    case 'varmeeld': c.save(); c.translate(0, -8); laga(0.78); fyll('#ff7a1e'); c.translate(0, 10); laga(0.42); fyll('#ffd24a', 0); c.restore();
      for (const [px, py, rx] of [[-34, 32, 13], [-12, 37, 14], [12, 37, 14], [34, 32, 13]]) { c.beginPath(); c.ellipse(px, py, rx, 9, 0, 0, TAU); fyll(Math.abs(px) > 20 ? '#9aa2ae' : '#b4bcc8', 4); } break;
    case 'katapult': linje([-40, 28, 36, 28], K, 13); linje([-40, 28, 36, 28], '#a8703c', 7); linje([-20, 28, 0, -2, 20, 28], K, 11); linje([-20, 28, 0, -2, 20, 28], '#8a5a30', 5);
      linje([0, -2, -34, -32], K, 12); linje([0, -2, -34, -32], '#c98a4b', 6); cirkel(-36, -36, 11); fyll('#aeb6c2', 4);
      for (const px of [-30, 26]) { cirkel(px, 34, 10); fyll('#7a4e26', 4); cirkel(px, 34, 3); fyll('#e0a820', 0); } break;
    case 'ballista': linje([0, 10, -22, 44], K, 11); linje([0, 10, 22, 44], K, 11); linje([0, 10, -22, 44], '#7a4e26', 5); linje([0, 10, 22, 44], '#7a4e26', 5);
      c.beginPath(); c.moveTo(-44, -6); c.quadraticCurveTo(0, -40, 44, -6); c.lineWidth = 12; c.strokeStyle = K; c.stroke(); c.lineWidth = 6; c.strokeStyle = '#c98a4b'; c.stroke();
      linje([-44, -6, 0, 6, 44, -6], '#f0e2b4', 2.5); linje([0, 18, 0, -46], K, 10); linje([0, 18, 0, -40], '#a8703c', 5); poly([-7, -38, 0, -50, 7, -38]); fyll('#c6ccd6', 3); break;
    case 'vallgrav': c.beginPath(); c.ellipse(0, 6, 46, 30, 0, 0, TAU); fyll('#8a6a44'); c.beginPath(); c.ellipse(0, 6, 32, 19, 0, 0, TAU); fyll('#3f8fd0', 4);
      linje([-16, 2, -4, 2], '#bfe6ff', 4); linje([6, 12, 18, 12], '#bfe6ff', 4); break;
    case 'bagskytt': c.beginPath(); c.arc(-10, 0, 40, -1.15, 1.15); c.lineWidth = 13; c.strokeStyle = K; c.stroke(); c.lineWidth = 7; c.strokeStyle = '#a8703c'; c.stroke();
      linje([7, -37, 7, 37], '#f0e2b4', 3); linje([-38, 0, 40, 0], K, 9); linje([-38, 0, 36, 0], '#e6d0a0', 4); poly([30, -9, 46, 0, 30, 9]); fyll('#c6ccd6', 3); poly([-40, -8, -28, 0, -40, 8, -34, 0]); fyll('#e0483f', 3); break;
    case 'helare': cirkel(0, 0, 40); fyll('#f4fbf2'); poly([-11, -30, 11, -30, 11, -11, 30, -11, 30, 11, 11, 11, 11, 30, -11, 30, -11, 11, -30, 11, -30, -11, -11, -11]); fyll('#3fc05a', 4); break;
    case 'kampe': linje([-34, 42, 26, -38], K, 15); linje([-34, 42, 26, -38], '#8a5a30', 8);
      c.save(); c.translate(14, -22); c.rotate(-0.92); for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(-10, sd * 6); c.lineTo(-17, sd * 30); c.quadraticCurveTo(0, sd * 44, 17, sd * 30); c.lineTo(10, sd * 6); c.closePath(); fyll('#d4dae2'); linje([-13, sd * 27, 13, sd * 27], '#f4f8ff', 3); } rr(-11, -7, 22, 14, 4); fyll('#6a717c'); c.restore(); break;
    case 'karta': poly([-42, -30, -14, -38, 14, -30, 42, -38, 42, 32, 14, 40, -14, 32, -42, 40]); fyll('#f0dcaa'); linje([-14, -38, -14, 32], '#c9a36a', 3); linje([14, -30, 14, 40], '#c9a36a', 3);
      c.setLineDash([6, 7]); linje([-30, 22, -12, 4, 6, 12, 22, -10], '#a8703c', 4); c.setLineDash([]); linje([16, -22, 30, -8], '#e0483f', 6); linje([30, -22, 16, -8], '#e0483f', 6); break;
    case 'lada': rr(-38, -34, 76, 72, 6); fyll('#c98a4b'); linje([-38, -34, 38, 38], '#7a4e26', 6); linje([-38, 2, 38, 2], '#7a4e26', 5); rr(-38, -34, 76, 72, 6); c.lineWidth = 5; c.strokeStyle = K; c.stroke(); break;
    case 'eldpilar': linje([-40, 40, 26, -26], K, 9); linje([-40, 40, 24, -24], '#e6d0a0', 4); poly([-44, 30, -32, 36, -38, 46]); fyll('#e0483f', 3);
      c.save(); c.translate(28, -28); c.rotate(0.78); laga(0.5); fyll('#ff7a1e'); c.translate(0, 6); laga(0.26); fyll('#ffd24a', 0); c.restore(); break;
    case 'dryck': c.beginPath(); c.moveTo(-9, -36); c.lineTo(-9, -16); c.quadraticCurveTo(-36, -6, -34, 16); c.quadraticCurveTo(-30, 42, 0, 42); c.quadraticCurveTo(30, 42, 34, 16); c.quadraticCurveTo(36, -6, 9, -16); c.lineTo(9, -36); c.closePath(); fyll('#d8eef4');
      c.beginPath(); c.moveTo(-31, 12); c.quadraticCurveTo(-28, 38, 0, 38); c.quadraticCurveTo(28, 38, 31, 12); c.closePath(); fyll('#e0483f', 0); rr(-12, -46, 24, 12, 4); fyll('#8a5a30'); linje([-18, 14, -12, 4], '#ffd0d0', 4); break;
    case 'murbruk': c.beginPath(); c.moveTo(-38, -6); c.lineTo(38, -6); c.lineTo(30, 40); c.lineTo(-30, 40); c.closePath(); fyll('#8a8f98'); c.beginPath(); c.ellipse(0, -6, 38, 10, 0, 0, TAU); fyll('#d8d2c4', 4);
      linje([10, -12, 34, -44], K, 9); linje([10, -12, 34, -44], '#8a5a30', 4); poly([-8, -20, 14, -36, 22, -14, 6, -4]); fyll('#c6ccd6', 4); break;
    case 'o_glantan': case 'o_frost': case 'o_vulkan': {
      const fr = { o_glantan: ['#3f9fd8', '#e9d7a2', '#6ab548', '#3f7d2c'], o_frost: ['#9cc8e6', '#dfe8f0', '#f4f8fc', '#a8bccf'], o_vulkan: ['#5a6a78', '#3a3432', '#4a4240', '#2a2422'] }[namn];
      cirkel(0, 0, 46); fyll(fr[0], 4); c.beginPath(); c.ellipse(0, 6, 38, 26, 0, 0, TAU); fyll(fr[1], 4); c.beginPath(); c.ellipse(0, 4, 30, 19, 0, 0, TAU); fyll(fr[2], 0);
      if (namn === 'o_glantan') { for (const [px, py] of [[-12, 2], [8, -4], [16, 8]]) { poly([px - 9, py + 6, px, py - 16, px + 9, py + 6]); fyll(fr[3], 3); } }
      else if (namn === 'o_frost') { linje([-10, -12, 10, 16], '#7aaed6', 4); linje([10, -12, -10, 16], '#7aaed6', 4); linje([-14, 2, 14, 2], '#7aaed6', 4); poly([16, 10, 26, -6, 34, 10]); fyll('#ffffff', 3); }
      else { poly([-22, 16, -2, -24, 8, -24, 26, 16]); fyll('#5a4a44'); poly([-4, -24, 3, -14, 8, -24]); fyll('#ff7a1e', 0); linje([3, -14, -6, 2, 2, 14], '#ff7a1e', 4); cirkel(0, -32, 6); fyll('#8a8480', 0); cirkel(8, -40, 5); fyll('#a8a29e', 0); }
      break;
    }
    default: cirkel(0, 0, 36); fyll('#c9a36a'); c.fillStyle = K; c.font = '800 54px system-ui,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('?', 0, 4);
  }
  c.restore();
}
export const RESURSFARG = { tra: '#c98a4b', sten: '#aeb6c2', guld: '#ffd24a' };

// händelse.typ → effekt. Fält som läses: x, z, id, styrka.
export const HANDELSER = {
  bygge_klart: 'bygge', bygge_lagat: 'bygge', bygge_traff: 'murtraff', bygge_raserat: 'ras', laga: 'damm',
  traff: 'traff', hugg: 'flis', natur_slut: 'tradfall', natur_ater: 'jordpuff',
  fiende_ny: 'jordpuff', fiende_dod: 'benpuff', fiende_brinner: 'brinn', soldat_dod: 'damm', riddare_fall: 'skak', riddare_ater: 'magi',
  plock: 'guld', betalning: 'betala', lamna: 'damm', leverans: 'damm',
  boss_ny: 'skak', boss_special: 'small', boss_dod: 'small', slag: 'svep', skott: 'skott',
  // äldre och allmänna namn
  dod: 'benpuff', guld: 'guld', betala: 'betala', magi: 'magi', mur_traff: 'murtraff', skak: 'skak', brinner: 'brinn', sten: 'stenflis',
  // v2
  explosion: 'explosion', nedslag: 'nedslag', is_traff: 'frost', lava: 'lavabrand', hjalte_ny: 'glitter', ritning: 'glitter', dryck: 'dryck', bat: 'plask',
};

// Dygnets nyckellägen. t: 0–1 dag, 1–2 skymning, 2–3 natt, 3–4 gryning (fasens andel läggs på).
// solH/solAz i grader (ljusets höjd och väderstreck), styrka = riktat ljus, man = ljuset är månen.
const DYGN = [
  { t: 0.00, topp: 0x3f8fe0, hor: 0xbfe2f5, sol: 0xfff0d6, styrka: 3.0, solH: 40, solAz: 135, hemiH: 0xcfe6ff, hemiM: 0x8a9a6a, hemi: 1.25, dimma: 0xc4e0f0, dimT: 0.0042, stj: 0, exp: 1.0, ton: 0xffffff, bloom: 0.55, man: 0 },
  { t: 0.50, topp: 0x2f7fe0, hor: 0xb6dcf5, sol: 0xfff6e6, styrka: 3.3, solH: 58, solAz: 200, hemiH: 0xd4e8ff, hemiM: 0x8a9a6a, hemi: 1.3, dimma: 0xc2def2, dimT: 0.0038, stj: 0, exp: 1.0, ton: 0xffffff, bloom: 0.5, man: 0 },
  { t: 1.00, topp: 0x3a78c8, hor: 0xf2d6a8, sol: 0xffdca8, styrka: 3.3, solH: 40, solAz: 228, hemiH: 0xdcdcee, hemiM: 0x94885e, hemi: 1.25, dimma: 0xe6d2b0, dimT: 0.0046, stj: 0, exp: 1.05, ton: 0xfff4e4, bloom: 0.6, man: 0 },
  { t: 1.50, topp: 0x4a5aa8, hor: 0xffa860, sol: 0xffb46a, styrka: 3.7, solH: 28, solAz: 242, hemiH: 0xe8ccd0, hemiM: 0x8a7254, hemi: 1.4, dimma: 0xe09a68, dimT: 0.0054, stj: 0.05, exp: 1.22, ton: 0xffeeda, bloom: 0.8, man: 0 },
  { t: 1.72, topp: 0x34408a, hor: 0xf07848, sol: 0xff8448, styrka: 2.6, solH: 18, solAz: 249, hemiH: 0xb89cc0, hemiM: 0x5a4a48, hemi: 1.2, dimma: 0xa8685c, dimT: 0.0064, stj: 0.3, exp: 1.2, ton: 0xf6e2e0, bloom: 0.9, man: 0 },
  { t: 1.90, topp: 0x1c2452, hor: 0x8a4a5e, sol: 0xff6a3a, styrka: 0.0, solH: 9, solAz: 254, hemiH: 0x6468a4, hemiM: 0x2e2c3e, hemi: 1.0, dimma: 0x54405c, dimT: 0.0072, stj: 0.6, exp: 1.12, ton: 0xe8dcf4, bloom: 0.95, man: 0 },
  { t: 2.00, topp: 0x0a1230, hor: 0x263058, sol: 0x9db8ff, styrka: 0.0, solH: 42, solAz: 150, hemiH: 0x5468ac, hemiM: 0x222838, hemi: 1.3, dimma: 0x1c2648, dimT: 0.0076, stj: 0.9, exp: 1.15, ton: 0xdfe6ff, bloom: 0.9, man: 1 },
  { t: 2.12, topp: 0x070d26, hor: 0x1c2a50, sol: 0x9db8ff, styrka: 1.6, solH: 46, solAz: 156, hemiH: 0x506ab4, hemiM: 0x202636, hemi: 1.3, dimma: 0x17203e, dimT: 0.0078, stj: 1, exp: 1.18, ton: 0xdde6ff, bloom: 0.9, man: 1 },
  { t: 2.50, topp: 0x060b22, hor: 0x1a264a, sol: 0xa6beff, styrka: 1.7, solH: 54, solAz: 180, hemiH: 0x506ab4, hemiM: 0x202636, hemi: 1.3, dimma: 0x151d3a, dimT: 0.0078, stj: 1, exp: 1.18, ton: 0xdde6ff, bloom: 0.9, man: 1 },
  { t: 2.88, topp: 0x0a1230, hor: 0x2a3460, sol: 0x9db8ff, styrka: 1.6, solH: 46, solAz: 204, hemiH: 0x546cb0, hemiM: 0x222838, hemi: 1.3, dimma: 0x1c2648, dimT: 0.0076, stj: 0.9, exp: 1.16, ton: 0xdfe6ff, bloom: 0.9, man: 1 },
  { t: 3.00, topp: 0x1a2a5c, hor: 0x6a5a7c, sol: 0xff8a5a, styrka: 0.0, solH: 8, solAz: 104, hemiH: 0x6c74aa, hemiM: 0x2e2e3e, hemi: 1.0, dimma: 0x4c4a6a, dimT: 0.0072, stj: 0.5, exp: 1.12, ton: 0xeee2f2, bloom: 0.95, man: 0 },
  { t: 3.30, topp: 0x4a70c0, hor: 0xffb080, sol: 0xffac74, styrka: 3.2, solH: 22, solAz: 112, hemiH: 0xdcc0d0, hemiM: 0x7a6452, hemi: 1.3, dimma: 0xe6a888, dimT: 0.0056, stj: 0.06, exp: 1.18, ton: 0xffeada, bloom: 0.8, man: 0 },
  { t: 3.75, topp: 0x4488dc, hor: 0xe2dcc8, sol: 0xffdcb0, styrka: 3.0, solH: 30, solAz: 124, hemiH: 0xd0e0f8, hemiM: 0x8a966a, hemi: 1.2, dimma: 0xd6dcd8, dimT: 0.0046, stj: 0, exp: 1.0, ton: 0xfff6ea, bloom: 0.6, man: 0 },
  { t: 4.00, topp: 0x3f8fe0, hor: 0xbfe2f5, sol: 0xfff0d6, styrka: 3.0, solH: 40, solAz: 135, hemiH: 0xcfe6ff, hemiM: 0x8a9a6a, hemi: 1.25, dimma: 0xc4e0f0, dimT: 0.0042, stj: 0, exp: 1.0, ton: 0xffffff, bloom: 0.55, man: 0 },
];
const FASBAS = { dag: 0, skymning: 1, natt: 2, gryning: 3 };

// Kvalitetstrappa. Sänks ett steg i taget om fps ligger under 45 (upplösning, efterbehandling, skuggor).
const KVALITET = [
  { namn: 'hög', skala: 1.0, post: true, skuggor: true, figurskuggor: true },
  { namn: 'upplösning 85 %', skala: 0.85, post: true, skuggor: true, figurskuggor: true },
  { namn: 'upplösning 70 %', skala: 0.7, post: true, skuggor: true, figurskuggor: true },
  { namn: 'utan efterbehandling', skala: 0.7, post: false, skuggor: true, figurskuggor: true },
  { namn: 'utan figurskuggor', skala: 0.7, post: false, skuggor: true, figurskuggor: false },
  { namn: 'utan skuggor', skala: 0.6, post: false, skuggor: false, figurskuggor: false },
];

// v2: tema per ö (spel.miljo.tema). mark = markens färger, vatten = sjöns färger, kust = kustlinjens faser (öns form),
// sno = hur mycket ovansidor (normalens y) blandas mot snoFarg (snö på Frostön, aska på Vulkanön), dygn = hur dis, horisont,
// sol och markljus dras mot temats färger (dag → natt), typer = hur typerna ritas om (läggs över TYPER), dekor = skogsbryn och sjöstenar.
const TEMAN = {
  sommar: {
    mark: { gras: 0x5c9e3c, gras2: 0x7ab548, gras3: 0x468438, jord: 0xa8895c, jord2: 0x8f7650, berg: 0x7d8088, sand: 0xe9d7a2, vat: 0xb89e6e, botten: 0xcfc08e },
    vatten: { djup: 0x0e5a8c, grund: 0x45cfc0, skum: 0xffffff },
    kust: [1.1, 2.3, 0.4], sno: 0, snoFarg: 0xf2f6ff, glitter: 0, gras: 1, grasToner: [0xffffff, 0xe8f0c0, 0xd0e8b0, 0xfff2b0, 0xc0dca0], grasFarg: [0x4c8c34, 0x90c456], flugor: 1, nederbord: null, grav: 1,
    dekor: { trad: 1, sten: 1, stenLand: 0xe2e0d8, stenVat: 0xb8b4aa }, typer: {}, dygn: null, fyll: 0x5866a8, punkt: 1,
  },
  vinter: {
    mark: { gras: 0xd4dce6, gras2: 0xe2e8f0, gras3: 0xc0ccda, jord: 0x9c9894, jord2: 0x8a8480, berg: 0x8a96a8, sand: 0xbcc6d2, vat: 0x8696a4, botten: 0x7d94a2 },
    vatten: { djup: 0x123c5e, grund: 0x4f9cb2, skum: 0xeaf4ff },
    kust: [2.0, 0.7, 1.9], sno: 1, snoFarg: 0xe4ecf6, glitter: 1, gras: 0.12, grasToner: [0xffffff, 0xe8e0d0, 0xd8d0c0], grasFarg: [0x7a7656, 0xcfc49a], flugor: 0, nederbord: 'sno', grav: 0.8,
    dekor: { trad: 0.9, sten: 1, stenLand: 0xe8eef6, stenVat: 0xc4d0dc },
    typer: { trad: { farger: [0xc4d8d0, 0xb4ccc4, 0xd0e0d8, 0xbcd4dc] }, sten: { farger: [0xeef2f8, 0xdde4ee, 0xf4f6fa] }, gravsten: { farger: [0xe0e6ee, 0xccd4de] } },
    dygn: { dimma: 0xd6e2ee, dimmaN: 0x2a3a62, dimmaK: 0.6, dimT: 0.92, hor: 0xe6eef6, horN: 0x2c3e6c, horK: 0.45, topp: 0x6a9ad0, toppK: 0.25,
      sol: 0xf2f6ff, solK: 0.4, hemiH: 0xdce8ff, hemiHK: 0.3, hemiM: 0xc4d2e4, hemiMN: 0x46527a, hemiMK: 0.75, ton: 0xf2f6ff, tonK: 0.6, exp: 0.94 },
    fyll: 0x6a7ec0, punkt: 0.4,
  },
  vulkan: {
    mark: { gras: 0x4a4440, gras2: 0x5a514a, gras3: 0x3a3532, jord: 0x5e4e42, jord2: 0x4e4036, berg: 0x3e3634, sand: 0x2e2a28, vat: 0x2a2624, botten: 0x3a3430 },
    vatten: { djup: 0x16262c, grund: 0x3a5654, skum: 0xb0a8a0 },
    kust: [0.3, 3.4, 2.8], sno: 0.42, snoFarg: 0x3a3634, glitter: 0, gras: 0.3, grasToner: [0xffffff, 0xe0d0c0, 0xc8b8a8, 0xf0e0d0], grasFarg: [0x2e2620, 0x7a6248], flugor: 0, nederbord: 'aska', grav: 1.2,
    dekor: { trad: 0.45, sten: 1.7, stenLand: 0x5a5250, stenVat: 0x4a4442 },
    typer: { trad: { varianter: ['dodtrad', 'dodtrad2', 'dodtrad2'], skala: [0.78, 1.02], farger: [0x6a5a50, 0x5a4c44, 0x7a6658], vaj: 0.35 }, sten: { farger: [0x5e5654, 0x4c4442, 0x6e625c] },
      gravsten: { farger: [0x8a8280, 0x6a6260] }, dodtrad: { farger: [0x5a4a42] } },
    dygn: { dimma: 0xb08a78, dimmaN: 0x3a1c18, dimmaK: 0.55, dimT: 1.25, hor: 0xd07a50, horN: 0x6a2216, horK: 0.55, topp: 0x6a7a9a, toppK: 0.35,
      sol: 0xffc8a0, solK: 0.35, hemiH: 0xe0c8c0, hemiHK: 0.3, hemiM: 0x4a3a34, hemiMN: 0x3a2420, hemiMK: 0.6, ton: 0xffe8dc, tonK: 0.6, exp: 1.0 },
    fyll: 0x8a5a58, punkt: 1,
  },
};

// ───────────────────────────── hjälpfunktioner ─────────────────────────────
const TAU = Math.PI * 2;
const klamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const mjuk = (a, b, v) => { const t = klamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function slump32(fro) { let a = fro >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hash2(x, z) { let h = (Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function brus(x, z) { const xi = Math.floor(x), zi = Math.floor(z), fx = x - xi, fz = z - zi; const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz); return lerp(lerp(hash2(xi, zi), hash2(xi + 1, zi), u), lerp(hash2(xi, zi + 1), hash2(xi + 1, zi + 1), u), v); }
function fbm(x, z) { return brus(x, z) * 0.55 + brus(x * 2.1 + 7.3, z * 2.1 - 3.1) * 0.3 + brus(x * 4.3 - 1.7, z * 4.3 + 9.2) * 0.15; }
function vinkelMot(a, b, t) { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return a + d * t; }
const _m4 = new THREE.Matrix4(), _m4b = new THREE.Matrix4(), _v3 = new THREE.Vector3(), _v3b = new THREE.Vector3(), _q = new THREE.Quaternion(), _s3 = new THREE.Vector3(), _e = new THREE.Euler(), _c = new THREE.Color(), _c2 = new THREE.Color();
const UPP = new THREE.Vector3(0, 1, 0);
const sanera = (n) => THREE.PropertyBinding.sanitizeNodeName(n);

const GLSL_BRUS = /* glsl */`
float hsh(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vbrus(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f); return mix(mix(hsh(i), hsh(i+vec2(1,0)), u.x), mix(hsh(i+vec2(0,1)), hsh(i+vec2(1,1)), u.x), u.y); }
float fbrus(vec2 p){ return vbrus(p)*0.55 + vbrus(p*2.1+7.3)*0.3 + vbrus(p*4.3-1.7)*0.15; }
`;

// ════════════════════════════════════════════════════════════════════════════
export function skapaGrafik(canvas, opts = {}) {
  const O = Object.assign({
    assets: new URL('./assets/', import.meta.url).href,
    oRadie: 64,        // strandlinjens ungefärliga radie i meter (KARTA.o.radie 55 + strand)
    spelRadie: 54,     // innanför detta är marken plan (y = 0) och fri från dekor
    gardRadie: 11,     // grusad borggård runt tronsalen (inre murringen har radie 10)
    dekor: true,       // skogsbryn, stenar och sjöstenar utanför spelRadie
    gras: true,
    autoKvalitet: true,
    kvalitet: 0,
    fro: 7,
  }, opts);
  const mobil = O.mobil ?? ((typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches) || Math.min(innerWidth, innerHeight) < 600);
  const maxAnimerade = O.maxAnimerade ?? (mobil ? 36 : 72);       // fler än så animeras var tredje bildruta
  const maxFigurskuggor = O.maxFigurskuggor ?? (mobil ? 14 : 40); // de närmaste kastar riktig skugga, resten bara klickskugga
  const rnd = slump32(O.fro);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, stencil: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.info.autoReset = false;
  const halvFlyt = renderer.capabilities.isWebGL2 && (renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float'));

  const scen = new THREE.Scene();
  scen.fog = new THREE.FogExp2(0xc4e0f0, 0.004);
  const kamera = new THREE.PerspectiveCamera(36, 1, 0.5, 1600);
  const U = { tid: { value: 0 }, morker: { value: 0 }, vind: { value: 1 }, fokus: { value: new THREE.Vector3() } }; // delade uniforms

  // ─── ljus ───
  const hemi = new THREE.HemisphereLight(0xcfe6ff, 0x8a9a6a, 1.2);
  scen.add(hemi);
  const sol = new THREE.DirectionalLight(0xfff0d6, 3);
  sol.castShadow = true;
  const SKUGGR = mobil ? 30 : 38;
  sol.shadow.mapSize.set(mobil ? 1024 : 2048, mobil ? 1024 : 2048);
  Object.assign(sol.shadow.camera, { left: -SKUGGR, right: SKUGGR, top: SKUGGR, bottom: -SKUGGR, near: 10, far: 220 });
  sol.shadow.bias = -0.0006; sol.shadow.normalBias = 0.06;
  scen.add(sol, sol.target);
  const punktljus = [];
  for (let i = 0; i < 3; i++) { const p = new THREE.PointLight(0xff9a3c, 0, 17, 1.5); p.position.set(0, -50, 0); scen.add(p); punktljus.push(p); }
  // fyllnadsljus på natten: lyfter skärmkanterna långt från elden utan att natten slutar kännas som natt
  const fyllLjus = new THREE.AmbientLight(0x5866a8, 0); scen.add(fyllLjus);

  // ─── tema (ö) ───
  const STD_BRYGGA = { x: 47 * Math.sin(25 * Math.PI / 180), z: 47 * Math.cos(25 * Math.PI / 180), rot: 25 * Math.PI / 180 };
  let tema = 'sommar', TM = TEMAN.sommar, miljo = null, brygga = STD_BRYGGA, lava = [], temaSign = '';
  const temaCache = new Map();
  // typens ritning på den här ön (TEMAN[tema].typer läggs över TYPER)
  function temaDef(typ) {
    const d = TYPER[typ]; if (!d) return d;
    const over = TM.typer[typ]; if (!over) return d;
    let r = temaCache.get(typ); if (!r) { r = Object.assign({}, d, over); temaCache.set(typ, r); }
    return r;
  }
  U.sno = { value: 0 }; U.snoFarg = { value: new THREE.Color(0xf2f6ff) };
  // Snö (eller aska) på ovansidor: blandar mot snoFarg efter normalens y i världen. Läggs in i Lambert-material för byggnader, natur och murar.
  const GLSL_TBRUS = 'float tHsh(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }\nfloat tBrus(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f); return mix(mix(tHsh(i), tHsh(i+vec2(1,0)), u.x), mix(tHsh(i+vec2(0,1)), tHsh(i+vec2(1,1)), u.x), u.y); }\n';
  function temaPatch(sh, dov) {
    sh.uniforms.uSno = U.sno; sh.uniforms.uSnoFarg = U.snoFarg; sh.uniforms.uMorker = U.morker;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vTemaP;').replace('#include <project_vertex>', `#include <project_vertex>
      { vec4 tp = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        tp = instanceMatrix * tp;
      #endif
        vTemaP = (modelMatrix * tp).xyz; }`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vTemaP;\nuniform float uSno, uMorker;\nuniform vec3 uSnoFarg;\n' + GLSL_TBRUS)
      .replace('#include <emissivemap_fragment>', `if (uSno > 0.0) { vec3 nW = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
          float sn = smoothstep(0.3, 0.68, nW.y + (tBrus(vTemaP.xz * 1.6 + vTemaP.y * 0.7) - 0.5) * 0.45) * uSno;
          diffuseColor.rgb = mix(diffuseColor.rgb, uSnoFarg, sn); }
        ${dov ? '{ float l = dot(diffuseColor.rgb, vec3(0.3, 0.5, 0.2)); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(l) * vec3(1.04, 1.0, 0.9), uMorker * 0.7) * mix(1.0, 0.42, uMorker); }' : ''}
        #include <emissivemap_fragment>`);
  }
  // material för geometri byggd i kod (färg per hörn), med snö/aska
  const vfMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  vfMat.onBeforeCompile = (sh) => temaPatch(sh, false); vfMat.customProgramCacheKey = () => 'vf-tema';

  // ─── terräng ───
  const VATTEN_Y = -0.55;
  const kustR = (th) => { const k = TM.kust; return O.oRadie * (1 + 0.07 * Math.sin(3 * th + k[0]) + 0.045 * Math.sin(5 * th + k[1]) + 0.025 * Math.sin(9 * th + k[2])); };
  function markHojd(x, z) {
    const r = Math.hypot(x, z);
    if (r < O.spelRadie) return 0;
    const d = kustR(Math.atan2(z, x)) - r;
    if (d <= 0) return Math.max(-3, VATTEN_Y + d * 0.17);
    let h = VATTEN_Y * (1 - mjuk(0, 7, d));
    const ring = mjuk(O.spelRadie, O.spelRadie + 9, r) * mjuk(5, 13, d);
    if (ring > 0) {
      let k = ring;
      if (brygga) { // kullarna plattas till under bryggan
        const ux = Math.sin(brygga.rot), uz = Math.cos(brygga.rot), dx = x - brygga.x, dz = z - brygga.z, langs = dx * ux + dz * uz, tvars = Math.abs(dx * uz - dz * ux);
        k *= 1 - mjuk(6, 2.6, tvars) * mjuk(-4, 0, langs);
      }
      h += k * (fbm(x * 0.07 + 3, z * 0.07 - 5) * 3.2 + 0.2);
    }
    return h;
  }
  function lavaAvst(x, z) { let b = 1e9; for (const s of lava) { const vx = s.bx - s.ax, vz = s.bz - s.az, l2 = vx * vx + vz * vz; const t = l2 > 0 ? klamp(((x - s.ax) * vx + (z - s.az) * vz) / l2, 0, 1) : 0; b = Math.min(b, Math.hypot(x - s.ax - vx * t, z - s.az - vz * t)); } return b; }
  const MARK = O.oRadie * 2.7;
  function byggMark() {
    const seg = mobil ? 150 : 190;
    const g = new THREE.PlaneGeometry(MARK, MARK, seg, seg); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, farg = new Float32Array(p.count * 3);
    const F = TM.mark, cSand = new THREE.Color(F.sand), cVat = new THREE.Color(F.vat), cGras = new THREE.Color(F.gras), cGras2 = new THREE.Color(F.gras2), cGras3 = new THREE.Color(F.gras3), cJord = new THREE.Color(F.jord), cJord2 = new THREE.Color(F.jord2), cBerg = new THREE.Color(F.berg), cBotten = new THREE.Color(F.botten);
    const cBrand = new THREE.Color(0x1a1412), cGlodK = new THREE.Color(0x4a1c10), cStig = new THREE.Color(tema === 'vinter' ? 0xa09a98 : tema === 'vulkan' ? 0x4a3e36 : 0xc2a878);
    const c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), h = markHojd(x, z);
      p.setY(i, h);
      const r = Math.hypot(x, z), d = kustR(Math.atan2(z, x)) - r;
      const n = fbm(x * 0.045, z * 0.045), n2 = fbm(x * 0.16 + 11, z * 0.16 + 4);
      c.copy(cGras).lerp(cGras2, mjuk(0.35, 0.75, n)).lerp(cGras3, mjuk(0.5, 0.9, n2) * 0.6);
      const gard = mjuk(O.gardRadie + 2.5, O.gardRadie - 2.5, r + (n2 - 0.5) * 7);
      c.lerp(_c.copy(cJord).lerp(cJord2, n2), gard * 0.92);
      const flack = mjuk(0.72, 0.86, fbm(x * 0.09 - 20, z * 0.09 + 31)) * (1 - gard) * 0.55; c.lerp(cJord, flack);
      if (h > 1.6) c.lerp(cBerg, mjuk(1.6, 2.8, h) * 0.7);
      const strand = mjuk(9.5, 5.5, d + (n2 - 0.5) * 3); c.lerp(cSand, strand);
      if (d < 1.6) c.lerp(cVat, mjuk(1.6, 0.2, d) * 0.7);
      if (d < 0) c.lerp(cBotten, 0.6);
      if (lava.length && r < O.spelRadie + 4) { const la = lavaAvst(x, z) - 1.7; if (la < 3) { c.lerp(cBrand, mjuk(3, 0.2, la + (n2 - 0.5) * 1.2) * 0.85); c.lerp(cGlodK, mjuk(0.9, -0.2, la) * 0.6); } }
      if (brygga) { const dx = x - brygga.x, dz = z - brygga.z, ux = Math.sin(brygga.rot), uz = Math.cos(brygga.rot), langs = dx * ux + dz * uz; if (langs > -6 && langs < 1.5 && d > 1) c.lerp(cStig, mjuk(2.2, 1.0, Math.abs(dx * uz - dz * ux) + (n2 - 0.5) * 1.4) * mjuk(-6, -3.5, langs) * 0.7); }
      farg[i * 3] = c.r; farg[i * 3 + 1] = c.g; farg[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(farg, 3));
    g.computeVertexNormals();
    // korntextur som bryter upp de släta färgfälten
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const cx = cv.getContext('2d'); const id = cx.createImageData(128, 128); const r2 = slump32(99);
    for (let i = 0; i < 128 * 128; i++) { const v = 205 + r2() * 50 - (r2() < 0.04 ? 30 : 0); id.data[i * 4] = v; id.data[i * 4 + 1] = v + 2; id.data[i * 4 + 2] = v - 4; id.data[i * 4 + 3] = 255; }
    cx.putImageData(id, 0, 0);
    const korn = new THREE.CanvasTexture(cv); korn.wrapS = korn.wrapT = THREE.RepeatWrapping; korn.repeat.set(70, 70); korn.colorSpace = THREE.SRGBColorSpace; korn.anisotropy = 4;
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, map: korn });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTid = U.tid; sh.uniforms.uMolnSkugga = U.molnSkugga; sh.uniforms.uGlitter = { value: TM.glitter };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vVarld;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvVarld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vVarld;\nuniform float uTid, uMolnSkugga, uGlitter;' + GLSL_BRUS)
        .replace('#include <color_fragment>', '#include <color_fragment>\nfloat moln = smoothstep(0.42, 0.7, fbrus(vVarld.xz * 0.018 + vec2(uTid * 0.012, uTid * 0.007)));\ndiffuseColor.rgb *= (1.0 - moln * uMolnSkugga) * (0.84 + 0.3 * fbrus(vVarld.xz * 0.27)) * (0.93 + 0.14 * vbrus(vVarld.xz * 2.1));\nif (uGlitter > 0.0) diffuseColor.rgb += uGlitter * step(0.995, hsh(floor(vVarld.xz * 18.0))) * 0.6 * (0.6 + 0.4 * sin(uTid * 3.0 + hsh(floor(vVarld.xz * 18.0) + 1.7) * 40.0));');
    };
    mat.customProgramCacheKey = () => 'mark';
    const m = new THREE.Mesh(g, mat); m.receiveShadow = true; m.name = 'mark'; m.userData.egen = true;
    laggVarld(m);
    return m;
  }
  U.molnSkugga = { value: 0.22 };
  U.gravar = { value: Array.from({ length: 8 }, () => new THREE.Vector3(1e4, 1e4, 0)) }; // vallgravar (x, z, radie): gräset trycks undan

  // ─── vatten ───
  let vattenMat;
  function vattenHojd() { // djupkarta för vattnet (ändras med öns form)
    const N = 256, data = new Uint8Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = (i / (N - 1) - 0.5) * MARK, z = (j / (N - 1) - 0.5) * MARK; data[j * N + i] = klamp((markHojd(x, z) + 3) / 4, 0, 1) * 255; }
    const hojdTex = new THREE.DataTexture(data, N, N, THREE.RedFormat); hojdTex.magFilter = hojdTex.minFilter = THREE.LinearFilter; hojdTex.needsUpdate = true;
    if (vattenMat.uniforms.uHojd.value) vattenMat.uniforms.uHojd.value.dispose();
    vattenMat.uniforms.uHojd.value = hojdTex;
  }
  function byggVatten() {
    vattenMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: true,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
        uHojd: { value: null }, uMark: { value: MARK }, uNiva: { value: VATTEN_Y }, uTid: { value: 0 },
        uDjup: { value: new THREE.Color() }, uGrund: { value: new THREE.Color() }, uHimmel: { value: new THREE.Color() }, uSkum: { value: new THREE.Color() },
        uLjusRikt: { value: new THREE.Vector3(0, 1, 0) }, uLjusFarg: { value: new THREE.Color() },
        uIs: { value: 0 }, uIsLjus: { value: new THREE.Color() }, uIsMork: { value: new THREE.Color() },
      }]),
      vertexShader: /* glsl */`
        varying vec3 vVarld;
        #include <fog_pars_vertex>
        void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vVarld = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */`
        uniform sampler2D uHojd; uniform float uMark, uNiva, uTid, uIs; uniform vec3 uDjup, uGrund, uHimmel, uSkum, uLjusRikt, uLjusFarg, uIsLjus, uIsMork;
        varying vec3 vVarld;
        #include <common>
        #include <fog_pars_fragment>
        ${GLSL_BRUS}
        float vag(vec2 p, vec2 d, float k, float w){ return sin(dot(p, d) * k + uTid * w); }
        void main(){
          vec2 p = vVarld.xz;
          vec2 uv = p / uMark + 0.5;
          float h = texture2D(uHojd, clamp(uv, 0.0, 1.0)).r * 4.0 - 3.0;
          float utanfor = step(1.0, max(abs(uv.x - 0.5), abs(uv.y - 0.5)) * 2.0);
          float djup = mix(uNiva - h, 2.45, utanfor);
          // normal ur några sinusvågor plus brus
          vec2 g = vec2(0.0);
          g += vec2(0.8, 0.6) * cos(dot(p, vec2(0.8, 0.6)) * 0.55 + uTid * 0.9) * 0.10;
          g += vec2(-0.5, 0.86) * cos(dot(p, vec2(-0.5, 0.86)) * 1.1 + uTid * 1.3) * 0.08;
          g += vec2(0.3, -0.95) * cos(dot(p, vec2(0.3, -0.95)) * 2.3 + uTid * 1.9) * 0.05;
          float e = 0.35; float b0 = fbrus(p * 0.9 + uTid * 0.25); g += vec2(fbrus(p * 0.9 + vec2(e, 0.0) + uTid * 0.25) - b0, fbrus(p * 0.9 + vec2(0.0, e) + uTid * 0.25) - b0) * 0.9;
          vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
          vec3 v = normalize(cameraPosition - vVarld);
          float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
          vec3 farg = mix(uGrund, uDjup, smoothstep(0.0, 2.2, djup));
          farg = mix(farg, uHimmel, clamp(fres * 0.85 + 0.06, 0.0, 1.0));
          // solblänk och månblänk
          vec3 r = reflect(-uLjusRikt, n);
          float spek = pow(max(dot(r, v), 0.0), 180.0);
          float glitter = pow(max(dot(r, v), 0.0), 24.0) * smoothstep(0.62, 0.9, vbrus(p * 3.0 + uTid * vec2(0.7, -0.5)));
          float gnistr = smoothstep(0.78, 0.96, vbrus(p * 2.6 + uTid * vec2(0.6, -0.45))) * smoothstep(0.55, 0.9, vbrus(p * 0.35 - uTid * 0.05));
          farg += uLjusFarg * (spek * 5.0 + glitter * 0.9 + gnistr * 0.22);
          // skum vid strandkanten: en fast kant och två vågränder som rullar in
          float kant = smoothstep(0.32, 0.03, djup);
          float rand = smoothstep(0.72, 1.0, sin(djup * 5.0 + uTid * 1.4 + b0 * 3.0)) * smoothstep(1.5, 0.15, djup) * smoothstep(0.3, 0.6, vbrus(p * 0.7 + uTid * 0.1));
          float skum = clamp(kant + rand * 0.75, 0.0, 1.0) * (1.0 - utanfor);
          farg = mix(farg, uSkum, skum);
          float alfa = clamp(mix(0.5, 0.97, smoothstep(0.0, 1.3, djup)) + skum + fres * 0.3, 0.0, 1.0);
          // is: sjön fryser (Frostön i skymningen och på natten). Fryser fläckvis utifrån stranden.
          if (uIs > 0.001) {
            float frys = smoothstep(0.0, 0.2, uIs * 1.35 - fbrus(p * 0.035) * 0.35 - smoothstep(1.0, 3.0, djup) * 0.2);
            float spr = 1.0 - smoothstep(0.0, 0.03, abs(fbrus(p * 0.18) - 0.5));
            spr = max(spr, (1.0 - smoothstep(0.0, 0.02, abs(vbrus(p * 0.55 + 3.0) - 0.5))) * 0.55);
            vec3 isF = mix(uIsLjus, uIsMork, clamp(smoothstep(0.3, 0.8, fbrus(p * 0.07)) * 0.55 + spr * 0.6, 0.0, 1.0));
            vec3 rN = reflect(-uLjusRikt, vec3(0.0, 1.0, 0.0));
            isF += uLjusFarg * (pow(max(dot(rN, v), 0.0), 30.0) * 0.35 + gnistr * 0.5 + step(0.994, hsh(floor(p * 16.0))) * 0.35);
            isF = mix(isF, uSkum * 0.95, smoothstep(0.5, 0.05, djup) * (1.0 - utanfor));
            farg = mix(farg, isF, frys); alfa = mix(alfa, 1.0, frys);
          }
          gl_FragColor = vec4(farg, alfa);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
    });
    const g = new THREE.CircleGeometry(1400, 40); g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, vattenMat); m.position.y = VATTEN_Y; m.renderOrder = 1; m.name = 'vatten';
    scen.add(m);
  }

  // ─── himmel ───
  let himmelMat, himmel;
  function byggHimmel() {
    himmelMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
      uniforms: { uTopp: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uSolRikt: { value: new THREE.Vector3(0, 1, 0) }, uSolFarg: { value: new THREE.Color() }, uManRikt: { value: new THREE.Vector3(0, 1, 0) }, uSolSynlig: { value: 1 }, uManSynlig: { value: 0 }, uStj: { value: 0 }, uTid: { value: 0 }, uMolnFarg: { value: new THREE.Color() } },
      vertexShader: /* glsl */`varying vec3 vRikt; void main(){ vRikt = position; vec4 p = projectionMatrix * viewMatrix * vec4(position + cameraPosition, 1.0); gl_Position = p.xyww; }`,
      fragmentShader: /* glsl */`
        uniform vec3 uTopp, uHor, uSolRikt, uSolFarg, uManRikt, uMolnFarg; uniform float uSolSynlig, uManSynlig, uStj, uTid; varying vec3 vRikt;
        #include <common>
        ${GLSL_BRUS}
        void main(){
          vec3 d = normalize(vRikt);
          float h = max(d.y, 0.0);
          vec3 farg = mix(uHor, uTopp, pow(h, 0.55));
          float sd = max(dot(d, uSolRikt), 0.0);
          farg += uSolFarg * (pow(sd, 900.0) * 30.0 + pow(sd, 40.0) * 0.5 + pow(sd, 6.0) * 0.18) * uSolSynlig;
          float md = max(dot(d, uManRikt), 0.0);
          farg += vec3(0.75, 0.85, 1.0) * (smoothstep(0.9993, 0.9996, md) * 6.0 + pow(md, 300.0) * 0.6 + pow(md, 12.0) * 0.12) * uManSynlig;
          // stjärnor
          vec2 sp = d.xz / (abs(d.y) + 0.35) * 42.0; vec2 si = floor(sp); float sh = hsh(si);
          float stj = step(0.93, sh) * smoothstep(0.35, 0.0, length(fract(sp) - 0.5 - (vec2(hsh(si + 3.1), hsh(si + 7.7)) - 0.5) * 0.5));
          farg += vec3(0.9, 0.95, 1.0) * stj * uStj * (0.6 + 0.4 * sin(uTid * 2.0 + sh * 60.0)) * 1.6 * step(0.0, d.y);
          // moln
          vec2 mp = d.xz / (h + 0.12) * 0.55 + vec2(uTid * 0.008, uTid * 0.003);
          float m = smoothstep(0.5, 0.78, fbrus(mp * 1.6) * 0.75 + vbrus(mp * 5.0) * 0.25) * smoothstep(0.02, 0.22, d.y);
          farg = mix(farg, uMolnFarg + uSolFarg * pow(sd, 8.0) * 0.35 * uSolSynlig, m * 0.85);
          farg = mix(farg, uHor, smoothstep(0.0, -0.06, d.y));
          gl_FragColor = vec4(farg, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    himmel = new THREE.Mesh(new THREE.SphereGeometry(10, 24, 14), himmelMat);
    himmel.frustumCulled = false; himmel.renderOrder = -10; himmel.name = 'himmel';
    scen.add(himmel);
  }

  // ─── efterbehandling: egen lätt kedja (ljuspass → 4 nedskalningar → uppskalning → toning, vinjett, ACES) ───
  const post = (() => {
    const kam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const tri = new THREE.BufferGeometry(); tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3)); tri.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    const vs = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
    const bas = { depthTest: false, depthWrite: false, toneMapped: false, vertexShader: vs };
    const matNed = new THREE.ShaderMaterial({ ...bas, uniforms: { t: { value: null }, uTexel: { value: new THREE.Vector2() }, uTroskel: { value: 0 } }, fragmentShader: /* glsl */`
      uniform sampler2D t; uniform vec2 uTexel; uniform float uTroskel; varying vec2 vUv;
      vec3 prov(vec2 o){ vec3 c = min(texture2D(t, vUv + o * uTexel).rgb, vec3(24.0)); if (uTroskel > 0.0) { float b = max(c.r, max(c.g, c.b)); float k = uTroskel * 0.5; float s = clamp(b - uTroskel + k, 0.0, 2.0 * k); s = s * s / (4.0 * k + 1e-4); c *= max(s, b - uTroskel) / max(b, 1e-4); } return c; }
      void main(){ gl_FragColor = vec4((prov(vec2(-1.0, -1.0)) + prov(vec2(1.0, -1.0)) + prov(vec2(-1.0, 1.0)) + prov(vec2(1.0, 1.0))) * 0.25, 1.0); }` });
    const matUpp = new THREE.ShaderMaterial({ ...bas, blending: THREE.AdditiveBlending, transparent: true, uniforms: { t: { value: null }, uTexel: { value: new THREE.Vector2() }, uVikt: { value: 1 } }, fragmentShader: /* glsl */`
      uniform sampler2D t; uniform vec2 uTexel; uniform float uVikt; varying vec2 vUv;
      void main(){ vec3 c = texture2D(t, vUv + vec2(-1.0, -1.0) * uTexel).rgb + texture2D(t, vUv + vec2(1.0, -1.0) * uTexel).rgb + texture2D(t, vUv + vec2(-1.0, 1.0) * uTexel).rgb + texture2D(t, vUv + vec2(1.0, 1.0) * uTexel).rgb; gl_FragColor = vec4(c * 0.25 * uVikt, 1.0); }` });
    const matSlut = new THREE.ShaderMaterial({ ...bas, uniforms: { tScen: { value: null }, tBloom: { value: null }, uBloom: { value: 0.6 }, uExp: { value: 1 }, uVinjett: { value: 0.32 }, uTon: { value: new THREE.Color(1, 1, 1) }, uMattnad: { value: 1.12 } }, fragmentShader: /* glsl */`
      uniform sampler2D tScen, tBloom; uniform float uBloom, uExp, uVinjett, uMattnad; uniform vec3 uTon; varying vec2 vUv;
      vec3 fit(vec3 v){ vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
      vec3 aces(vec3 c){ const mat3 mi = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777)); const mat3 mo = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602)); c *= uExp / 0.6; return clamp(mo * fit(mi * c), 0.0, 1.0); }
      float hsh(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      void main(){
        vec3 c = texture2D(tScen, vUv).rgb + texture2D(tBloom, vUv).rgb * uBloom;
        c *= uTon;
        vec2 q = vUv - 0.5; c *= 1.0 - uVinjett * smoothstep(0.18, 0.75, dot(q, q) * 1.6);
        c = aces(c);
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); c = mix(vec3(l), c, uMattnad);
        c = mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
        c += (hsh(gl_FragCoord.xy) - 0.5) / 255.0;
        gl_FragColor = vec4(c, 1.0);
      }` });
    const kvad = new THREE.Mesh(tri, matNed); kvad.frustumCulled = false;
    const kscen = new THREE.Scene(); kscen.add(kvad);
    let rtScen = null; const mip = []; const NIV = 4;
    const typ = halvFlyt ? THREE.HalfFloatType : THREE.UnsignedByteType;
    function storlek(w, h) {
      if (rtScen) { rtScen.dispose(); mip.forEach((m) => m.dispose()); mip.length = 0; }
      rtScen = new THREE.WebGLRenderTarget(w, h, { type: typ, samples: mobil ? 0 : 4, depthBuffer: true, stencilBuffer: false });
      let mw = w, mh = h;
      for (let i = 0; i < NIV; i++) { mw = Math.max(2, mw >> 1); mh = Math.max(2, mh >> 1); mip.push(new THREE.WebGLRenderTarget(mw, mh, { type: typ, depthBuffer: false, stencilBuffer: false })); }
    }
    function kor(mat, mal) { kvad.material = mat; renderer.setRenderTarget(mal); renderer.render(kscen, kam); }
    function rendera() {
      renderer.setRenderTarget(rtScen); renderer.render(scen, kamera);
      const auto = renderer.autoClear;
      let kalla = rtScen;
      for (let i = 0; i < NIV; i++) { matNed.uniforms.t.value = kalla.texture; matNed.uniforms.uTexel.value.set(0.5 / kalla.width, 0.5 / kalla.height); matNed.uniforms.uTroskel.value = i === 0 ? 1.0 : 0; kor(matNed, mip[i]); kalla = mip[i]; }
      renderer.autoClear = false;
      for (let i = NIV - 2; i >= 0; i--) { matUpp.uniforms.t.value = mip[i + 1].texture; matUpp.uniforms.uTexel.value.set(0.75 / mip[i + 1].width, 0.75 / mip[i + 1].height); matUpp.uniforms.uVikt.value = 0.9; kor(matUpp, mip[i]); }
      renderer.autoClear = auto;
      matSlut.uniforms.tScen.value = rtScen.texture; matSlut.uniforms.tBloom.value = mip[0].texture;
      kor(matSlut, null);
    }
    return { storlek, rendera, U: matSlut.uniforms, fri() { if (rtScen) { rtScen.dispose(); mip.forEach((m) => m.dispose()); mip.length = 0; rtScen = null; } }, har: () => !!rtScen };
  })();

  // ─── modeller, material och geometri ───
  const gltf = {};          // nyckel → inläst gltf
  const matCache = new Map();
  const geoCache = new Map();
  function lambertAv(src, nyckel) {
    const namn = (src.map && src.map.name) || src.name || 'x';
    const key = (MODELLER[nyckel] || nyckel).split('/')[0] + '|' + namn;
    let m = matCache.get(key);
    if (!m) {
      m = new THREE.MeshLambertMaterial({ map: src.map || null, color: src.map ? 0xffffff : src.color }); m.name = key; matCache.set(key, m);
      if (/^(hex|gravplats)\|/.test(key)) { m.onBeforeCompile = (sh) => temaPatch(sh, false); m.customProgramCacheKey = () => 'tema'; } // snö och aska på ovansidor
    }
    return m;
  }
  function rensa(g) { // bara position, normal, uv så att geometrier går att slå ihop
    for (const n of Object.keys(g.attributes)) if (n !== 'position' && n !== 'normal' && n !== 'uv') g.deleteAttribute(n);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    g.morphAttributes = {};
    return g;
  }
  // Hela modellen som en enda geometri (alla noder ihopslagna) + dess material.
  function geoAv(nyckel) {
    let r = geoCache.get(nyckel);
    if (r) return r;
    const g = gltf[nyckel];
    if (!g) return null;
    g.scene.updateMatrixWorld(true);
    const delar = []; let mat = null;
    g.scene.traverse((o) => { if (o.isMesh) { const d = rensa(o.geometry.clone()); d.applyMatrix4(o.matrixWorld); delar.push(d.index ? d : d); if (!mat) mat = lambertAv(o.material, nyckel); } });
    if (!delar.length) return null;
    const alla = delar.every((d) => d.index) ? delar : delar.map((d) => (d.index ? d.toNonIndexed() : d));
    const geo = alla.length === 1 ? alla[0] : mergeGeometries(alla, false);
    geo.computeBoundingBox(); geo.computeBoundingSphere();
    r = { geo, mat };
    geoCache.set(nyckel, r);
    return r;
  }

  // ─── figurer: alla delar bakas till ETT skinnat nät per typ (ett ritanrop per figur) ───
  const figurMall = new Map();   // typ → { mall, klipp, hojd }
  const klippCache = new Map();  // rigg → Map(klippnamn → AnimationClip)
  const klippPerBen = new Map(); // rigg + benuppsättning → Map(klippnamn → AnimationClip)
  function klippFor(rigg) {
    let m = klippCache.get(rigg);
    if (m) return m;
    m = new Map();
    const src = gltf[KLIPPKALLA[rigg]];
    for (const k of (src ? src.animations : [])) {
      const spar = k.tracks.filter((t) => {
        const p = t.name.lastIndexOf('.'), nod = t.name.slice(0, p), eg = t.name.slice(p + 1);
        if (eg === 'scale' || /IK|control/i.test(nod)) return false;
        if (eg === 'position' && nod !== 'root' && nod !== 'hips') { // släng konstanta positionsspår
          const v = t.values; let konst = true;
          for (let i = 3; i < v.length && konst; i += 3) if (Math.abs(v[i] - v[0]) > 1e-4 || Math.abs(v[i + 1] - v[1]) > 1e-4 || Math.abs(v[i + 2] - v[2]) > 1e-4) konst = false;
          if (konst) return false;
        }
        return true;
      });
      m.set(k.name, new THREE.AnimationClip(k.name, k.duration, spar));
    }
    klippCache.set(rigg, m);
    return m;
  }
  function skinnAttr(g, ben) { // stel del → skinnad mot ett enda ben
    const n = g.attributes.position.count, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { si[i * 4] = ben; sw[i * 4] = 1; }
    g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  }
  function glodAttr(g, v) { g.setAttribute('aGlod', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(v), 1)); }
  function bakaFigur(typ, def) {
    const kalla = gltf[def.modell];
    if (!kalla) return null;
    const rig = SkeletonUtils.clone(kalla.scene);
    rig.updateMatrixWorld(true);
    let skel = null; const skinnade = [], stela = [];
    rig.traverse((o) => { if (o.isSkinnedMesh) { skinnade.push(o); skel = skel || o.skeleton; } else if (o.isMesh) stela.push(o); });
    if (!skel) return null;
    const ben = skel.bones, inv = skel.boneInverses, benIdx = (namn) => ben.findIndex((b) => b.name === sanera(namn));
    const delar = []; let tex = null, glodFarg = new THREE.Color(0x66e0ff);
    const dolj = def.dolj || [];
    for (const o of skinnade) {
      if (dolj.some((d) => o.name.includes(d))) continue;
      const g = o.geometry.clone();
      const si = g.attributes.skinIndex, sw = g.attributes.skinWeight, n = si.count, a = new Uint16Array(n * 4), w = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) { a[i * 4] = si.getX(i); a[i * 4 + 1] = si.getY(i); a[i * 4 + 2] = si.getZ(i); a[i * 4 + 3] = si.getW(i); w[i * 4] = sw.getX(i); w[i * 4 + 1] = sw.getY(i); w[i * 4 + 2] = sw.getZ(i); w[i * 4 + 3] = sw.getW(i); }
      rensa(g); g.applyMatrix4(o.bindMatrix);
      g.setAttribute('skinIndex', new THREE.BufferAttribute(a, 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(w, 4));
      const glod = /glow/i.test(o.material.name);
      if (glod) { const e = o.material.emissive; glodFarg = (e && (e.r + e.g + e.b) > 0.01) ? e.clone() : o.material.color.clone(); } else if (!tex && o.material.map) tex = o.material.map;
      glodAttr(g, glod ? 1 : 0);
      delar.push(g);
    }
    for (const o of stela) { // lösa delar som sitter på ett ben (hjälm, svärd, sköld, mantel)
      if (!(def.delar || []).includes(o.name)) continue;
      let b = o.parent; while (b && !b.isBone) b = b.parent;
      const j = b ? ben.indexOf(b) : -1; if (j < 0) continue;
      const g = rensa(o.geometry.clone());
      _m4.copy(b.matrixWorld).invert().multiply(o.matrixWorld); _m4b.copy(inv[j]).invert().multiply(_m4);
      g.applyMatrix4(_m4b); skinnAttr(g, j); glodAttr(g, 0); delar.push(g);
    }
    for (const v of (def.vapen || [])) { // vapen ur egna filer
      const vg = geoAv(v.modell), j = benIdx(v.ben); if (!vg || j < 0) continue;
      const g = vg.geo.clone();
      _e.set(...(v.rot || [0, 0, 0])); _m4.compose(_v3.set(...(v.pos || [0, 0, 0])), _q.setFromEuler(_e), _s3.setScalar(v.skala || 1));
      _m4b.copy(inv[j]).invert().multiply(_m4);
      g.applyMatrix4(_m4b); skinnAttr(g, j); glodAttr(g, 0); delar.push(g);
    }
    const idx = delar.every((d) => d.index) ? delar : delar.map((d) => (d.index ? d.toNonIndexed() : d));
    const geo = mergeGeometries(idx, false);
    // behåll bara ben som används (20 kroppsben + handfästen), resten (IK-ben) tas bort ur trädet
    const si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight, anv = new Set();
    for (let i = 0; i < si.count; i++) for (let k = 0; k < 4; k++) if (sw.getComponent(i, k) > 0) anv.add(si.getComponent(i, k));
    const behall = new Set();
    for (const j of anv) { let b = ben[j]; while (b && b.isBone) { behall.add(b); b = b.parent; } }
    const nyaBen = ben.filter((b) => behall.has(b)), nyInv = nyaBen.map((b) => inv[ben.indexOf(b)].clone()), karta = ben.map((b) => Math.max(0, nyaBen.indexOf(b)));
    for (let i = 0; i < si.count; i++) for (let k = 0; k < 4; k++) si.setComponent(i, k, sw.getComponent(i, k) > 0 ? karta[si.getComponent(i, k)] : 0);
    for (const b of ben) if (!behall.has(b)) b.removeFromParent();
    for (const o of [...skinnade, ...stela]) o.removeFromParent();
    const mat = new THREE.MeshLambertMaterial({ map: tex, color: def.farg ?? 0xffffff });
    const uGlod = { value: new THREE.Color(def.glod ?? glodFarg).multiplyScalar(3.2) }, uSprick = { value: new THREE.Color(def.sprickor ?? 0).multiplyScalar(2.2) };
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uGlod = uGlod; sh.uniforms.uSprick = uSprick; sh.uniforms.uTid = U.tid;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aGlod;\nvarying float vGlod;' + (def.sprickor ? '\nvarying vec3 vSprick;' : '')).replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlod = aGlod;')
        .replace('#include <skinning_vertex>', '#include <skinning_vertex>' + (def.sprickor ? '\nvSprick = transformed;' : ''));
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vGlod;\nuniform vec3 uGlod;' + (def.sprickor ? '\nvarying vec3 vSprick;\nuniform vec3 uSprick;\nuniform float uTid;\n' + GLSL_TBRUS : ''))
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vGlod * uGlod;' + (def.sprickor ? '\n{ float sp = 1.0 - smoothstep(0.0, 0.07, abs(tBrus(vSprick.xy * 4.5 + vSprick.z * 3.1) - 0.5)); totalEmissiveRadiance += uSprick * sp * (0.65 + 0.35 * sin(uTid * 3.0 + vSprick.y * 5.0)); }' : ''));
    };
    mat.customProgramCacheKey = () => 'figur' + (def.sprickor ? 's' : '');
    const nat = new THREE.SkinnedMesh(geo, mat);
    nat.name = 'kropp'; nat.castShadow = true; nat.receiveShadow = false;
    rig.add(nat);
    const skelett = new THREE.Skeleton(nyaBen, nyInv);
    nat.bind(skelett, new THREE.Matrix4());
    if (def.siluett) { // syns bara där något skymmer figuren (djuptest "större än"), rutmönstrad så att muren anas bakom
      const sm = new THREE.MeshBasicMaterial({ color: def.siluett, depthFunc: THREE.GreaterDepth, depthWrite: false, fog: false });
      sm.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (mod(floor(gl_FragCoord.x * 0.5) + floor(gl_FragCoord.y * 0.5), 2.0) < 0.5) discard;'); };
      const sil = new THREE.SkinnedMesh(geo, sm); sil.name = 'siluett'; sil.castShadow = false; sil.receiveShadow = false; sil.renderOrder = 1; nat.renderOrder = 2;
      rig.add(sil); sil.bind(skelett, new THREE.Matrix4());
    }
    geo.computeBoundingBox();
    const hojd = geo.boundingBox.max.y;
    nat.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, hojd * 0.5, 0), hojd * 0.95);
    nat.boundingBox = geo.boundingBox.clone().expandByScalar(0.6);
    if (def.krona) { // bosskrona på huvudbenet
      const hb = nyaBen.find((b) => b.name === 'head');
      if (hb) {
        const kd = [new THREE.CylinderGeometry(0.4, 0.37, 0.16, 10, 1, true)];
        for (let i = 0; i < 5; i++) { const k = new THREE.ConeGeometry(0.1, 0.3, 4); k.translate(Math.cos(i / 5 * TAU) * 0.37, 0.22, Math.sin(i / 5 * TAU) * 0.37); kd.push(k); }
        const kg = mergeGeometries(kd.map((d) => rensa(d).toNonIndexed()), false);
        const kf = typeof def.krona === 'number' ? def.krona : 0xffc83a;
        const km = new THREE.Mesh(kg, new THREE.MeshLambertMaterial({ color: kf, emissive: new THREE.Color(kf).multiplyScalar(0.35), side: THREE.DoubleSide }));
        km.position.set(0, 0.86, 0); km.castShadow = true; hb.add(km);
      }
    }
    // klippen delas mellan alla figurer med samma rigg och samma uppsättning ben
    const benNamn = new Set(nyaBen.map((b) => b.name)), sign = def.rigg + '|' + [...benNamn].sort().join(',');
    let egna = klippPerBen.get(sign);
    if (!egna) { egna = new Map(); for (const [namn, c] of klippFor(def.rigg)) egna.set(namn, new THREE.AnimationClip(namn, c.duration, c.tracks.filter((t) => benNamn.has(t.name.slice(0, t.name.lastIndexOf('.')))))); klippPerBen.set(sign, egna); }
    const alla = egna, tab = Object.assign({}, KLIPP[def.rigg], def.klipp || {}), klipp = {};
    for (const lage of Object.keys(tab)) { const [namn, tempo, enGang] = tab[lage]; const c = alla.get(namn); if (c) klipp[lage] = { clip: c, tempo: tempo || 1, enGang: !!enGang }; else console.warn('[grafik] klipp saknas:', namn, 'för', typ); }
    const r = { mall: rig, klipp, hojd, tri: (geo.index ? geo.index.count : geo.attributes.position.count) / 3 };
    return r;
  }
  const figurLager = new Map(); // typ → lediga instanser att återanvända
  function nyFigur(typ, def) {
    let fm = figurMall.get(typ);
    if (fm === undefined) { fm = def.kod ? bakaKod(typ, def) : bakaFigur(typ, def); figurMall.set(typ, fm); }
    if (!fm) return null;
    const lager = figurLager.get(typ);
    let f = lager && lager.pop();
    if (!f) {
      const inst = SkeletonUtils.clone(fm.mall);
      const hallare = new THREE.Group(); hallare.add(inst);
      let nat = null; inst.traverse((o) => { if (o.isSkinnedMesh) { if (o.name === 'siluett') { o.frustumCulled = false; o.castShadow = false; } else nat = o; } });
      f = { hallare, inst, nat, mixer: new THREE.AnimationMixer(inst), akt: new Map(), fm };
      if (fm.kod) { f.ben = {}; inst.traverse((o) => { if (o.isBone) f.ben[o.name.slice(fm.kod.length + 1)] = o; }); f.T = Math.random() * 10; f.at = 0; }
    }
    f.nu = null; f.lage = ''; f.rest = 0; f.hallare.visible = true;
    return f;
  }
  function slappFigur(typ, f) {
    f.mixer.stopAllAction(); f.nu = null; f.lage = '';
    scen.remove(f.hallare);
    let l = figurLager.get(typ); if (!l) figurLager.set(typ, l = []);
    if (l.length < 60) l.push(f);
  }
  function bytAnim(f, lage, direkt) {
    if (f.fm.kod) { f.at = 0; return; }
    const k = f.fm.klipp[lage] || f.fm.klipp.idle;
    if (!k) return;
    let a = f.akt.get(k.clip.name + k.tempo);
    if (!a) { a = f.mixer.clipAction(k.clip); f.akt.set(k.clip.name + k.tempo, a); }
    if (a === f.nu && !k.enGang) return;
    a.reset(); a.enabled = true; a.setEffectiveTimeScale(k.tempo); a.setEffectiveWeight(1);
    if (k.enGang) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; } else { a.setLoop(THREE.LoopRepeat, Infinity); a.time = Math.random() * k.clip.duration; }
    a.play();
    if (f.nu && f.nu !== a) { if (direkt) f.nu.stop(); else a.crossFadeFrom(f.nu, k.enGang ? 0.1 : 0.2, false); }
    f.nu = a;
  }

  // ─── instanspooler (träd, stenar, murdelar, resurser, pilar): ett ritanrop per variant ───
  const pooler = new Map();
  function vajMaterial(bas, styrka) {
    const m = bas.clone(); m.name = bas.name + '|vaj';
    m.onBeforeCompile = (sh) => {
      if (styrka < 3) temaPatch(sh, false);
      sh.uniforms.uTid = U.tid; sh.uniforms.uVind = U.vind; sh.uniforms.uFokus = U.fokus; sh.uniforms.uGravar = U.gravar;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTid, uVind;\nuniform vec3 uFokus;\nuniform vec3 uGravar[8];\nattribute float aSkak;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          #ifdef USE_INSTANCING
            vec4 ip = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
            float hh = max(position.y, 0.0); float fas = ip.x * 0.31 + ip.z * 0.27;
            float sv = (sin(uTid * 1.3 + fas) * 0.035 + sin(uTid * 2.7 + fas * 1.7) * 0.015) * uVind * ${styrka.toFixed(2)};
            float sk = max(0.0, 1.0 - (uTid - aSkak) * 2.2); sv += sin((uTid - aSkak) * 38.0) * sk * sk * 0.07;
            transformed.x += sv * hh * hh; transformed.z += sv * 0.6 * hh * hh;
            ${styrka < 3 ? `// träd som står mellan kameran och spelaren hukar sig så att riddaren alltid syns
            float fz = ip.z - uFokus.z, fxa = abs(ip.x - uFokus.x);
            float huk = smoothstep(0.8, 2.6, fz) * smoothstep(12.0, 8.0, fz) * smoothstep(1.6 + fz * 0.42, 0.6 + fz * 0.3, fxa);
            transformed.y *= 1.0 - 0.72 * huk; transformed.xz *= 1.0 - 0.25 * huk;` : `// gräset växer inte i vallgravarna
            for (int g = 0; g < 8; g++) { vec3 gv = uGravar[g]; if (length(ip.xz - gv.xy) < gv.z) transformed *= 0.0; }`}
          #endif`);
    };
    m.customProgramCacheKey = () => 'vaj' + styrka;
    return m;
  }
  // Stenarna lyste starkt blå i månskenet så att figurer försvann bland dem: på natten blir de dova och varmgrå.
  function dovMaterial(bas) { const m = bas.clone(); m.name = bas.name + '|dov'; m.onBeforeCompile = (sh) => temaPatch(sh, true); m.customProgramCacheKey = () => 'dov'; return m; }
  function pool(namn, skapa) {
    let p = pooler.get(namn);
    if (p !== undefined) return p;
    const d = skapa();
    if (!d) { pooler.set(namn, null); return null; }
    const max = d.max || 256, geo = d.geo.clone();
    const skak = d.vaj ? new THREE.InstancedBufferAttribute(new Float32Array(max).fill(-100), 1) : null;
    if (skak) { skak.setUsage(THREE.DynamicDrawUsage); geo.setAttribute('aSkak', skak); }
    const mesh = new THREE.InstancedMesh(geo, d.vaj ? vajMaterial(d.mat, d.vaj) : d.dov ? dovMaterial(d.mat) : d.mat, max);
    mesh.count = 0; mesh.frustumCulled = false; mesh.castShadow = d.skugga !== false; mesh.receiveShadow = d.tarSkugga !== false; mesh.name = 'pool:' + namn;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.setColorAt(0, _c.set(0xffffff)); mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    scen.add(mesh);
    p = {
      namn, mesh, agare: [], skak, max, hojd: d.geo.boundingBox ? d.geo.boundingBox.max.y : 1,
      lagg(agare, m, farg) { if (mesh.count >= max) return -1; const i = mesh.count++; this.agare[i] = agare; mesh.setMatrixAt(i, m); mesh.setColorAt(i, farg || _c.set(0xffffff)); if (skak) { skak.array[i] = -100; skak.needsUpdate = true; } mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true; return i; },
      satt(i, m) { mesh.setMatrixAt(i, m); mesh.instanceMatrix.needsUpdate = true; },
      farg(i, c) { mesh.setColorAt(i, c); mesh.instanceColor.needsUpdate = true; },
      skaka(i) { if (skak) { skak.array[i] = U.tid.value; skak.needsUpdate = true; } },
      tabort(i) {
        const sist = --mesh.count;
        if (i !== sist && i >= 0) { mesh.getMatrixAt(sist, _m4); mesh.setMatrixAt(i, _m4); mesh.getColorAt(sist, _c); mesh.setColorAt(i, _c); if (skak) { skak.array[i] = skak.array[sist]; skak.needsUpdate = true; } const a = this.agare[sist]; this.agare[i] = a; if (a) a.idx = i; mesh.instanceColor.needsUpdate = true; }
        this.agare.length = sist; mesh.instanceMatrix.needsUpdate = true;
      },
    };
    pooler.set(namn, p);
    return p;
  }
  const modellPool = (nyckel, extra) => pool('m:' + nyckel + (extra && extra.vaj ? ':v' : '') + (extra && extra.dov ? ':d' : '') + (extra && extra.glodMat ? ':g' : ''), () => {
    const g = geoAv(nyckel); if (!g) return null;
    const mat = extra && extra.glodMat ? new THREE.MeshLambertMaterial({ map: g.mat.map, emissive: 0xff5a10, emissiveMap: g.mat.map, emissiveIntensity: 0.35 }) : g.mat;
    return Object.assign({ geo: g.geo }, extra, { mat });
  });

  // Palissadsegment byggt i kod: spetsade stockar längs lokal x, 1 enhet = 1 meter, längd 4 m.
  function palissadGeo() {
    const delar = [], r = slump32(5), c1 = new THREE.Color(0x8a5a34), c2 = new THREE.Color(0xa87344), cTopp = new THREE.Color(0xd9b98a);
    const n = 8, bredd = 4 / n;
    for (let i = 0; i < n; i++) {
      const h = 2.55 + r() * 0.5, rad = bredd * 0.54, x = -2 + bredd * (i + 0.5), z = (r() - 0.5) * 0.12;
      const st = new THREE.CylinderGeometry(rad * 0.92, rad, h, 6, 1); st.translate(x, h / 2, z);
      const sp = new THREE.ConeGeometry(rad * 0.92, 0.55, 6); sp.translate(x, h + 0.275, z);
      const fc = c1.clone().lerp(c2, r());
      for (const [g, f] of [[st, fc], [sp, fc.clone().lerp(cTopp, 0.55)]]) { const a = new Float32Array(g.attributes.position.count * 3); for (let k = 0; k < a.length; k += 3) { a[k] = f.r; a[k + 1] = f.g; a[k + 2] = f.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); delar.push(g.toNonIndexed()); }
    }
    for (const y of [0.9, 2.0]) { const b = new THREE.BoxGeometry(4.05, 0.2, 0.16); b.translate(0, y, 0.3); const a = new Float32Array(b.attributes.position.count * 3); for (let k = 0; k < a.length; k += 3) { a[k] = 0.36; a[k + 1] = 0.22; a[k + 2] = 0.12; } b.setAttribute('color', new THREE.BufferAttribute(a, 3)); delar.push(b.toNonIndexed()); }
    const g = mergeGeometries(delar, false); g.computeBoundingBox();
    return g;
  }
  // Fyrfat byggt i kod: stenfot, järnskål och glödande kol.
  function fyrfatGeo() {
    const delar = [];
    const lagg = (g, hex) => { const f = new THREE.Color(hex), a = new Float32Array(g.attributes.position.count * 3); for (let k = 0; k < a.length; k += 3) { a[k] = f.r; a[k + 1] = f.g; a[k + 2] = f.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); delar.push(rensaFarg(g)); };
    const rensaFarg = (g) => { g.deleteAttribute('uv'); return g.index ? g.toNonIndexed() : g; };
    const fot = new THREE.CylinderGeometry(0.34, 0.46, 0.3, 8); fot.translate(0, 0.15, 0); lagg(fot, 0x8a8f98);
    const pel = new THREE.CylinderGeometry(0.13, 0.2, 0.62, 6); pel.translate(0, 0.58, 0); lagg(pel, 0x4a4d55);
    const skal = new THREE.CylinderGeometry(0.56, 0.3, 0.3, 10); skal.translate(0, 1.0, 0); lagg(skal, 0x33363d);
    const kol = new THREE.CylinderGeometry(0.47, 0.47, 0.08, 10); kol.translate(0, 1.14, 0); lagg(kol, 0xff7a1a);
    const g = mergeGeometries(delar, false); g.computeBoundingBox();
    // kolen ska glöda: färger över 1 ger HDR som bloom fångar
    const c = g.attributes.color; for (let i = 0; i < c.count; i++) if (g.attributes.position.getY(i) > 1.09 && Math.abs(c.getX(i) - new THREE.Color(0xff7a1a).r) < 0.01) c.setXYZ(i, 1.3, 0.4, 0.08);
    return g;
  }

  // ─── partiklar: en enda Points-mesh, förmultiplicerad alfa (vanliga och additiva i samma ritanrop) ───
  const PMAX = mobil ? 1300 : 2400;
  const part = (() => {
    const pos = new Float32Array(PMAX * 3), farg = new Float32Array(PMAX * 4), stl = new Float32Array(PMAX * 2);
    const vel = new Float32Array(PMAX * 3), liv = new Float32Array(PMAX), maxLiv = new Float32Array(PMAX), grav = new Float32Array(PMAX), drag = new Float32Array(PMAX), bas = new Float32Array(PMAX * 5);
    const g = new THREE.BufferGeometry();
    const aPos = new THREE.BufferAttribute(pos, 3), aFarg = new THREE.BufferAttribute(farg, 4), aStl = new THREE.BufferAttribute(stl, 2);
    for (const a of [aPos, aFarg, aStl]) a.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', aPos); g.setAttribute('aFarg', aFarg); g.setAttribute('aStl', aStl);
    g.setDrawRange(0, 0);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendEquation: THREE.AddEquation,
      uniforms: { uSkala: { value: 600 }, uLjus: { value: new THREE.Color(1, 1, 1) } },
      vertexShader: /* glsl */`attribute vec4 aFarg; attribute vec2 aStl; uniform float uSkala; varying vec4 vFarg; varying float vAdd;
        void main(){ vFarg = aFarg; vAdd = aStl.y; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = aStl.x * uSkala / max(-mv.z, 0.1); }`,
      fragmentShader: /* glsl */`uniform vec3 uLjus; varying vec4 vFarg; varying float vAdd;
        void main(){ vec2 q = gl_PointCoord - 0.5; float d = length(q); float hard = step(1.5, vAdd); float a = mix(smoothstep(0.5, 0.12, d), step(max(abs(q.x), abs(q.y)), 0.36), hard) * vFarg.a;
          float add = step(0.5, vAdd) * (1.0 - hard); vec3 c = vFarg.rgb * mix(uLjus, vec3(1.0), add);
          gl_FragColor = vec4(c * a, a * (1.0 - add));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.renderOrder = 30; pts.name = 'partiklar';
    scen.add(pts);
    let n = 0;
    // slag: 0 mjuk (belyst), 1 additiv glöd, 2 hård flisa (belyst)
    function ny(x, y, z, vx, vy, vz, r, gg, b, a, storlek, tid, slag, tyngd, broms) {
      if (n >= PMAX) return;
      const i = n++;
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz;
      bas[i * 5] = r; bas[i * 5 + 1] = gg; bas[i * 5 + 2] = b; bas[i * 5 + 3] = a; bas[i * 5 + 4] = storlek;
      stl[i * 2 + 1] = slag; liv[i] = maxLiv[i] = tid; grav[i] = tyngd; drag[i] = broms;
    }
    function steg(dt) {
      for (let i = 0; i < n; i++) {
        liv[i] -= dt;
        if (liv[i] <= 0) { // byt plats med sista
          const s = --n;
          if (i !== s) { pos.copyWithin(i * 3, s * 3, s * 3 + 3); vel.copyWithin(i * 3, s * 3, s * 3 + 3); bas.copyWithin(i * 5, s * 5, s * 5 + 5); stl[i * 2 + 1] = stl[s * 2 + 1]; liv[i] = liv[s]; maxLiv[i] = maxLiv[s]; grav[i] = grav[s]; drag[i] = drag[s]; }
          i--; continue;
        }
        const br = Math.max(0, 1 - drag[i] * dt);
        vel[i * 3] *= br; vel[i * 3 + 2] *= br; vel[i * 3 + 1] = vel[i * 3 + 1] * br - grav[i] * dt;
        pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        if (stl[i * 2 + 1] > 1.5 && pos[i * 3 + 1] < 0.05) { pos[i * 3 + 1] = 0.05; vel[i * 3 + 1] *= -0.35; vel[i * 3] *= 0.6; vel[i * 3 + 2] *= 0.6; }
        const t = liv[i] / maxLiv[i], slag = stl[i * 2 + 1];
        const alfa = slag === 0 ? Math.min(1, t * 2.2) * Math.min(1, (1 - t) * 6) : Math.min(1, t * 3);
        farg[i * 4] = bas[i * 5]; farg[i * 4 + 1] = bas[i * 5 + 1]; farg[i * 4 + 2] = bas[i * 5 + 2]; farg[i * 4 + 3] = bas[i * 5 + 3] * alfa;
        stl[i * 2] = bas[i * 5 + 4] * (slag === 0 ? 1.6 - t * 0.6 : slag === 1 ? 0.4 + t * 0.6 : 1);
      }
      aPos.needsUpdate = aFarg.needsUpdate = aStl.needsUpdate = true;
      g.setDrawRange(0, n);
    }
    return { ny, steg, mat, antal: () => n };
  })();
  const R = Math.random;
  const fx = {
    flis(x, z, n = 9, y = 1.2) { for (let i = 0; i < n; i++) { const a = R() * TAU, s = 1.5 + R() * 3; _c.setHex(R() < 0.5 ? 0xb8834a : 0x8a5a30); part.ny(x, y + R() * 0.5, z, Math.cos(a) * s, 2 + R() * 3.5, Math.sin(a) * s, _c.r, _c.g, _c.b, 1, 0.09 + R() * 0.07, 0.7 + R() * 0.5, 2, 13, 0.6); } fx.damm(x, z, 3, 0.5); },
    stenflis(x, z, n = 9, y = 0.8) { for (let i = 0; i < n; i++) { const a = R() * TAU, s = 1.5 + R() * 3; const v = 0.35 + R() * 0.3; part.ny(x, y + R() * 0.4, z, Math.cos(a) * s, 2 + R() * 3, Math.sin(a) * s, v, v, v * 1.08, 1, 0.08 + R() * 0.08, 0.7 + R() * 0.5, 2, 14, 0.6); } fx.damm(x, z, 4, 0.6, 0x9a9aa0); },
    damm(x, z, n = 8, radie = 1, hex = 0xb39b78) { _c.setHex(hex); for (let i = 0; i < n; i++) { const a = R() * TAU, r = radie * (0.5 + R() * 0.6); part.ny(x + Math.cos(a) * r, 0.25 + R() * 0.3, z + Math.sin(a) * r, Math.cos(a) * (0.8 + R() * 1.4), 0.5 + R() * 0.9, Math.sin(a) * (0.8 + R() * 1.4), _c.r, _c.g, _c.b, 0.3, 0.7 + R() * 0.7, 0.9 + R() * 0.7, 0, -0.2, 1.6); } },
    gnistor(x, y, z, n = 10, hex = 0xffb040, fart = 4) { _c.setHex(hex); for (let i = 0; i < n; i++) { const a = R() * TAU, s = fart * (0.3 + R() * 0.8); part.ny(x, y, z, Math.cos(a) * s, 1 + R() * fart, Math.sin(a) * s, _c.r * 4, _c.g * 4, _c.b * 4, 1, 0.07 + R() * 0.06, 0.35 + R() * 0.45, 1, 9, 1.2); } },
    traff(x, z, y = 1.2) { fx.gnistor(x, y, z, 7, 0xffd9a0, 3.5); part.ny(x, y, z, 0, 0, 0, 3, 2.4, 1.6, 0.9, 0.9, 0.12, 1, 0, 0); },
    benpuff(x, z) { for (let i = 0; i < 10; i++) { const a = R() * TAU, s = 1 + R() * 2.5; part.ny(x, 0.8 + R() * 0.8, z, Math.cos(a) * s, 2 + R() * 3, Math.sin(a) * s, 0.85, 0.85, 0.78, 1, 0.08 + R() * 0.06, 0.8 + R() * 0.5, 2, 13, 0.5); } fx.damm(x, z, 6, 0.6, 0xbfc2c8); fx.gnistor(x, 1.2, z, 5, 0x66e0ff, 2); },
    guld(x, z) { fx.gnistor(x, 0.8, z, 8, 0xffd24a, 2.5); },
    magi(x, z, y = 1.3, hex = 0x66ff88) { fx.gnistor(x, y, z, 14, hex, 3.5); part.ny(x, y, z, 0, 0, 0, 0.6, 3, 1.2, 0.8, 1.6, 0.18, 1, 0, 0); },
    small(x, z) { fx.gnistor(x, 1, z, 26, 0xff8030, 7); fx.damm(x, z, 14, 1.4, 0x6a6058); part.ny(x, 1.2, z, 0, 0, 0, 5, 3, 1.2, 1, 3.2, 0.16, 1, 0, 0); },
    byggdamm(x, z, radie) { for (let i = 0; i < 26; i++) { const a = i / 26 * TAU + R() * 0.2, r = radie * (0.8 + R() * 0.3); part.ny(x + Math.cos(a) * r, 0.3 + R() * 0.4, z + Math.sin(a) * r, Math.cos(a) * (1.5 + R() * 2), 0.8 + R() * 1.6, Math.sin(a) * (1.5 + R() * 2), 0.72, 0.64, 0.5, 0.5, 1.0 + R() * 0.9, 1.1 + R() * 0.8, 0, -0.3, 1.5); } fx.flis(x, z, 8, 1.5); fx.gnistor(x, 2.2, z, 12, 0xffe08a, 4); },
    jordpuff(x, z) { fx.damm(x, z, 7, 0.5, 0x5e4a38); for (let i = 0; i < 5; i++) { const a = R() * TAU; part.ny(x, 0.2, z, Math.cos(a) * 1.5, 2 + R() * 2, Math.sin(a) * 1.5, 0.3, 0.22, 0.15, 1, 0.1, 0.7, 2, 12, 0.5); } },
    brinn(x, z) { for (let i = 0; i < 12; i++) part.ny(x + (R() - 0.5) * 0.5, 0.4 + R() * 1.4, z + (R() - 0.5) * 0.5, (R() - 0.5) * 0.6, 1.5 + R() * 2, (R() - 0.5) * 0.6, 5, 2.2 + R(), 0.4, 0.9, 0.35 + R() * 0.3, 0.5 + R() * 0.5, 1, -1.5, 0.8); for (let i = 0; i < 5; i++) part.ny(x, 1.2, z, (R() - 0.5), 1.2 + R(), (R() - 0.5), 0.12, 0.11, 0.1, 0.5, 0.9, 1.4, 0, -0.5, 0.8); },
    // ett svärdshugg: en kort ljus båge framför den som slår
    svep(x, z, rot = 0, hex = 0xffffff, langd = 1.25, y = 1.15) { _c.setHex(hex); const hall = R() < 0.5 ? 1 : -1; for (let i = 0; i < 7; i++) { const a = rot + hall * (-0.95 + i * 0.32), sx = Math.sin(a), cz = Math.cos(a); part.ny(x + sx * langd, y + (i - 3) * 0.05 * hall, z + cz * langd, sx * 1.4 + cz * hall * 2.2, 0.2, cz * 1.4 - sx * hall * 2.2, _c.r * 2.6, _c.g * 2.6, _c.b * 2.6, 0.85, 0.2 + (3 - Math.abs(i - 3)) * 0.035, 0.13 + i * 0.012, 1, 0, 2); } },
    skott(x, z, y = 4.4, hex = 0xfff0c8, n = 4) { fx.gnistor(x, y, z, n, hex, 1.6); part.ny(x, y, z, 0, 0, 0, 2, 1.8, 1.3, 0.7, 0.5, 0.1, 1, 0, 0); },
    betala(x, z) { part.ny(x + (R() - 0.5) * 1.6, 0.3, z + (R() - 0.5) * 1.6, 0, 1.6 + R(), 0, 4, 3, 0.8, 0.9, 0.12, 0.6, 1, -0.5, 0.5); },
    // v2
    explosion(x, z, radie = 3) { // eldanden sprängs: eldboll, lågor, rök och en ljusblixt
      part.ny(x, 1.1, z, 0, 0.5, 0, 6, 3, 0.8, 1, radie * 1.6, 0.28, 1, 0, 0);
      fx.gnistor(x, 1, z, 34, 0xff8a30, 8);
      for (let i = 0; i < 18; i++) { const a = R() * TAU, s = 2.5 + R() * 4; part.ny(x, 0.6 + R(), z, Math.cos(a) * s, 1 + R() * 3, Math.sin(a) * s, 5, 1.8 + R() * 1.2, 0.3, 1, 0.6 + R() * 0.5, 0.35 + R() * 0.3, 1, -1, 2.2); }
      for (let i = 0; i < 14; i++) { const a = R() * TAU, s = 0.6 + R() * 1.6; part.ny(x + Math.cos(a) * 0.6, 0.8 + R(), z + Math.sin(a) * 0.6, Math.cos(a) * s, 1.2 + R() * 1.4, Math.sin(a) * s, 0.12, 0.1, 0.09, 0.75, 1.4 + R() * 1.1, 1.6 + R() * 1.0, 0, -0.6, 1.1); }
      fx.damm(x, z, 10, radie * 0.5, 0x5a504a);
      ljusblixt(x, z, radie * 2.6, 3.2, 1.4, 0.3, 0.55);
    },
    nedslag(x, z, radie = 3.2) { // katapultstenen landar
      for (let i = 0; i < 22; i++) { const a = i / 22 * TAU + R() * 0.3, r = radie * (0.3 + R() * 0.5); part.ny(x + Math.cos(a) * r, 0.3 + R() * 0.4, z + Math.sin(a) * r, Math.cos(a) * (2 + R() * 3), 1 + R() * 2.2, Math.sin(a) * (2 + R() * 3), 0.62, 0.55, 0.44, 0.5, 1.1 + R() * 0.9, 1.0 + R() * 0.8, 0, -0.3, 1.8); }
      fx.stenflis(x, z, 16, 0.6); fx.jordpuff(x, z);
    },
    frost(x, z, y = 1.1) { // isskärvan träffar: frost och iskristaller
      for (let i = 0; i < 16; i++) { const a = R() * TAU, s = 1 + R() * 2.6; part.ny(x, y + R() * 0.5, z, Math.cos(a) * s, 1.5 + R() * 2.5, Math.sin(a) * s, 0.8, 0.92, 1.0, 1, 0.07 + R() * 0.06, 0.6 + R() * 0.5, 2, 9, 0.8); }
      fx.gnistor(x, y, z, 8, 0x8ad8ff, 2.5); part.ny(x, y, z, 0, 0, 0, 0.4, 1.1, 1.7, 0.7, 1.2, 0.2, 1, 0, 0);
      for (let i = 0; i < 6; i++) { const a = R() * TAU; part.ny(x + Math.cos(a) * 0.5, 0.15, z + Math.sin(a) * 0.5, 0, 0.3, 0, 0.85, 0.95, 1.0, 0.5, 0.5 + R() * 0.4, 1.4 + R(), 0, 0, 0.5); }
    },
    lavabrand(x, z) { for (let i = 0; i < 6; i++) part.ny(x + (R() - 0.5) * 0.6, 0.2 + R() * 0.6, z + (R() - 0.5) * 0.6, (R() - 0.5) * 0.5, 1.2 + R() * 1.5, (R() - 0.5) * 0.5, 5, 2 + R(), 0.35, 0.9, 0.25 + R() * 0.2, 0.4 + R() * 0.3, 1, -1.2, 0.8); part.ny(x, 0.9, z, (R() - 0.5) * 0.4, 1, (R() - 0.5) * 0.4, 0.14, 0.12, 0.1, 0.4, 0.7, 1.1, 0, -0.4, 0.8); },
    glitter(x, z, hex = 0xffd24a, n = 28) { _c.setHex(hex); for (let i = 0; i < n; i++) { const a = R() * TAU, r = R() * 1.3; part.ny(x + Math.cos(a) * r, 0.2 + R() * 1.6, z + Math.sin(a) * r, (R() - 0.5) * 0.6, 1.2 + R() * 2, (R() - 0.5) * 0.6, _c.r * 4, _c.g * 4, _c.b * 4, 1, 0.08 + R() * 0.07, 0.8 + R() * 0.7, 1, -0.4, 0.6); } part.ny(x, 1.2, z, 0, 0, 0, 2.5, 2, 0.8, 0.7, 2.2, 0.3, 1, 0, 0); },
    dryck(x, z) { fx.glitter(x, z, 0xff6a7a, 24); fx.glitter(x, z, 0xffffff, 8); ljusblixt(x, z, 4, 0.9, 0.25, 0.3, 0.8); },
    plask(x, z) { for (let i = 0; i < 16; i++) { const a = R() * TAU, s = 0.8 + R() * 1.6; part.ny(x + Math.cos(a) * 1.2, VATTEN_Y + 0.2, z + Math.sin(a) * 1.2, Math.cos(a) * s, 2 + R() * 2.5, Math.sin(a) * s, 0.85, 0.92, 1, 0.7, 0.25 + R() * 0.2, 0.6 + R() * 0.4, 0, 9, 0.4); } },
  };

  // ─── eld och glöd ───
  const EMAX = 128, GMAX = 320;
  const eld = (() => {
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2)); g.setIndex([0, 1, 2, 0, 2, 3]);
    const data = new Float32Array(EMAX * 4), fas = new Float32Array(EMAX);
    const aData = new THREE.InstancedBufferAttribute(data, 4), aFas = new THREE.InstancedBufferAttribute(fas, 1); aData.setUsage(THREE.DynamicDrawUsage); aFas.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aData', aData); g.setAttribute('aFas', aFas); g.instanceCount = 0;
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, uniforms: { uTid: U.tid, uStyrka: { value: 1 } },
      vertexShader: /* glsl */`attribute vec4 aData; attribute float aFas; uniform float uTid; varying vec2 vUv; varying float vFas;
        void main(){ vUv = uv; vFas = aFas; vec4 mv = viewMatrix * vec4(aData.xyz, 1.0); float sv = sin(uTid * 6.0 + aFas * 9.0) * 0.06 * uv.y; mv.xy += vec2(position.x * 0.8 + sv, position.y * 1.35) * aData.w; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: /* glsl */`uniform float uTid, uStyrka; varying vec2 vUv; varying float vFas;
        ${GLSL_BRUS}
        void main(){ vec2 u = vUv; float n = fbrus(vec2(u.x * 3.2 + vFas * 7.0, u.y * 2.6 - uTid * 2.4 + vFas * 3.0));
          float bredd = mix(0.42, 0.06, pow(u.y, 0.8)); float form = smoothstep(bredd, bredd * 0.25, abs(u.x - 0.5 + (n - 0.5) * 0.22 * u.y));
          float f = form * smoothstep(1.0, 0.25, u.y + (n - 0.5) * 0.5) * smoothstep(0.0, 0.08, u.y);
          vec3 c = mix(vec3(2.2, 0.42, 0.04), vec3(3.4, 2.0, 0.55), smoothstep(0.4, 1.0, f * (1.15 - u.y * 0.7)));
          gl_FragColor = vec4(c * f * uStyrka, f * 0.85);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.renderOrder = 20; m.name = 'eld'; scen.add(m);
    return { g, data, fas, aData, aFas, mat };
  })();
  function glodMesh(platt) {
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3)); g.setIndex([0, 1, 2, 0, 2, 3]);
    const data = new Float32Array(GMAX * 4), farg = new Float32Array(GMAX * 3);
    const aData = new THREE.InstancedBufferAttribute(data, 4), aFarg = new THREE.InstancedBufferAttribute(farg, 3); aData.setUsage(THREE.DynamicDrawUsage); aFarg.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aData', aData); g.setAttribute('aFarg', aFarg); g.instanceCount = 0;
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, defines: platt ? { PLATT: 1 } : {},
      vertexShader: /* glsl */`attribute vec4 aData; attribute vec3 aFarg; varying vec2 vP; varying vec3 vFarg;
        void main(){ vP = position.xy; vFarg = aFarg;
          #ifdef PLATT
            vec4 mv = viewMatrix * vec4(aData.xyz + vec3(position.x, 0.0, position.y) * aData.w, 1.0);
          #else
            vec4 mv = viewMatrix * vec4(aData.xyz, 1.0); mv.xy += position.xy * aData.w;
          #endif
          gl_Position = projectionMatrix * mv; }`,
      fragmentShader: /* glsl */`varying vec2 vP; varying vec3 vFarg;
        void main(){ float d = length(vP); float f = max(0.0, 1.0 - d); f = f * f * (3.0 - 2.0 * f);
          #ifdef PLATT
            f *= f;
          #else
            f = f * f * f;
          #endif
          gl_FragColor = vec4(vFarg * f, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.renderOrder = platt ? 2 : 21; m.name = platt ? 'markljus' : 'glod'; scen.add(m);
    let n = 0;
    return { nolla() { n = 0; }, lagg(x, y, z, radie, r, gg, b) { if (n >= GMAX) return; data[n * 4] = x; data[n * 4 + 1] = y; data[n * 4 + 2] = z; data[n * 4 + 3] = radie; farg[n * 3] = r; farg[n * 3 + 1] = gg; farg[n * 3 + 2] = b; n++; }, klar() { g.instanceCount = n; aData.needsUpdate = true; aFarg.needsUpdate = true; } };
  }
  const glod = glodMesh(false), markljus = glodMesh(true);
  const eldar = []; // {x, y, z, styrka, fas, agare}

  // ─── eldflugor (rör sig i skuggaren, ingen CPU-kostnad) ───
  const flugor = (() => {
    const N = mobil ? 50 : 90, p = new Float32Array(N * 3), fs = new Float32Array(N);
    for (let i = 0; i < N; i++) { p[i * 3] = R() * 60; p[i * 3 + 1] = 0.5 + R() * 2.2; p[i * 3 + 2] = R() * 60; fs[i] = R() * 100; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('aFas', new THREE.BufferAttribute(fs, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTid: U.tid, uFokus: { value: new THREE.Vector3() }, uStyrka: { value: 0 }, uSkala: { value: 600 } },
      vertexShader: /* glsl */`attribute float aFas; uniform float uTid, uStyrka, uSkala; uniform vec3 uFokus; varying float vA;
        void main(){ vec3 p = position; p.x += sin(uTid * 0.5 + aFas) * 2.0 + sin(uTid * 0.23 + aFas * 2.0) * 1.5; p.z += cos(uTid * 0.41 + aFas * 1.3) * 2.0; p.y += sin(uTid * 0.9 + aFas * 3.0) * 0.5;
          p.xz = mod(p.xz - uFokus.xz + 30.0, 60.0) - 30.0 + uFokus.xz;
          vA = uStyrka * smoothstep(0.2, 0.9, sin(uTid * 1.7 + aFas * 5.0) * 0.5 + 0.5) * smoothstep(30.0, 22.0, length(p.xz - uFokus.xz));
          vec4 mv = viewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = 0.3 * uSkala / max(-mv.z, 0.1); }`,
      fragmentShader: /* glsl */`varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float f = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(vec3(2.2, 3.4, 0.9) * f * f * vA, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    const m = new THREE.Points(g, mat); m.frustumCulled = false; m.renderOrder = 22; m.name = 'eldflugor'; scen.add(m);
    return { mat, m };
  })();

  // ─── HP-staplar (ett instansierat ritanrop) ───
  const HPMAX = 160;
  const hp = (() => {
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3)); g.setIndex([0, 1, 2, 0, 2, 3]);
    const pos = new Float32Array(HPMAX * 3), data = new Float32Array(HPMAX * 4);
    const aPos = new THREE.InstancedBufferAttribute(pos, 3), aData = new THREE.InstancedBufferAttribute(data, 4); aPos.setUsage(THREE.DynamicDrawUsage); aData.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('aPos', aPos); g.setAttribute('aData', aData); g.instanceCount = 0;
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthTest: false, depthWrite: false,
      vertexShader: /* glsl */`attribute vec3 aPos; attribute vec4 aData; varying vec2 vUv; varying vec4 vData;
        void main(){ vUv = position.xy + 0.5; vData = aData; vec4 mv = viewMatrix * vec4(aPos, 1.0); mv.xy += position.xy * vec2(aData.y, aData.y * 0.17 + 0.07); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: /* glsl */`varying vec2 vUv; varying vec4 vData;
        void main(){ float kx = 0.035 / max(vData.y, 0.3) * 1.2, ky = 0.2; float inne = step(kx, vUv.x) * step(vUv.x, 1.0 - kx) * step(ky, vUv.y) * step(vUv.y, 1.0 - ky);
          vec3 fyll = vData.z < 0.5 ? mix(vec3(0.95, 0.2, 0.12), mix(vec3(1.0, 0.8, 0.15), vec3(0.3, 0.95, 0.3), smoothstep(0.5, 0.9, vData.x)), smoothstep(0.15, 0.5, vData.x)) : (vData.z < 1.5 ? vec3(0.95, 0.22, 0.2) : vec3(0.85, 0.3, 1.0));
          fyll *= 0.75 + 0.25 * smoothstep(0.2, 0.8, vUv.y);
          float t = (vUv.x - kx) / (1.0 - 2.0 * kx);
          vec3 c = mix(vec3(0.03, 0.03, 0.05), mix(vec3(0.16, 0.14, 0.14), fyll, step(t, vData.x)), inne);
          gl_FragColor = vec4(c, 0.92 * vData.w);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.renderOrder = 60; m.name = 'hp'; scen.add(m);
    let n = 0;
    return { nolla() { n = 0; }, lagg(x, y, z, andel, bredd, lag, alfa) { if (n >= HPMAX) return; pos[n * 3] = x; pos[n * 3 + 1] = y; pos[n * 3 + 2] = z; data[n * 4] = andel; data[n * 4 + 1] = bredd; data[n * 4 + 2] = lag; data[n * 4 + 3] = alfa; n++; }, klar() { g.instanceCount = n; aPos.needsUpdate = true; aData.needsUpdate = true; } };
  })();

  // ─── klickskuggor under figurer ───
  const SMAX = 320;
  const klick = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const cx = cv.getContext('2d'); const gr = cx.createRadialGradient(32, 32, 2, 32, 32, 31); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); cx.fillStyle = gr; cx.fillRect(0, 0, 64, 64);
    const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2);
    const m = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, opacity: 0.42, color: 0x000000 }), SMAX);
    m.count = 0; m.frustumCulled = false; m.renderOrder = 3; m.name = 'klickskuggor'; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scen.add(m);
    return m;
  })();

  // ─── betalrutor ───
  let rutTex = null;
  function rutRam() {
    if (rutTex) return rutTex;
    const cv = document.createElement('canvas'); cv.width = cv.height = 256; const c = cv.getContext('2d');
    const rr = (x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
    rr(14, 14, 228, 228, 34); c.fillStyle = 'rgba(255,255,255,0.20)'; c.fill();
    c.lineWidth = 13; c.strokeStyle = 'rgba(255,255,255,1)'; c.setLineDash([34, 22]); c.lineCap = 'round'; rr(14, 14, 228, 228, 34); c.stroke();
    rutTex = new THREE.CanvasTexture(cv); rutTex.colorSpace = THREE.SRGBColorSpace; rutTex.anisotropy = 4;
    return rutTex;
  }
  const rutGeo = new THREE.PlaneGeometry(1, 1); rutGeo.rotateX(-Math.PI / 2);
  function ritaSkylt(o, e) {
    const c = o.ctx, W = 256, H = 176;
    c.clearRect(0, 0, W, H);
    const rr = (x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
    rr(6, 6, W - 12, H - 28, 26); c.fillStyle = 'rgba(24,20,32,0.86)'; c.fill(); c.lineWidth = 5; c.strokeStyle = 'rgba(255,214,120,0.95)'; c.stroke();
    c.beginPath(); c.moveTo(W / 2 - 16, H - 23); c.lineTo(W / 2, H - 4); c.lineTo(W / 2 + 16, H - 23); c.closePath(); c.fillStyle = 'rgba(24,20,32,0.86)'; c.fill();
    const ikon = [e.ikon, e.vad, e.byggTyp, e.bygge].find((n) => n && IKONER.includes(n)) || 'okand';
    ritaIkon(c, ikon, 62, 62, 84);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    const rader = o.rader, n = Math.max(1, rader.length);
    rader.forEach(([res, kvar], i) => {
      const y = n === 1 ? 62 : 38 + i * 50;
      if (IKONER.includes(res)) ritaIkon(c, res, 132, y, n === 1 ? 40 : 36); else { c.beginPath(); c.arc(130, y, 15, 0, TAU); c.fillStyle = RESURSFARG[res] || '#fff'; c.fill(); }
      c.font = `800 ${n === 1 ? 54 : 44}px system-ui,-apple-system,"Segoe UI",sans-serif`; c.textAlign = 'left'; c.fillStyle = '#fff'; c.fillText(String(Math.max(0, Math.ceil(kvar))), 158, y + 3);
    });
    rr(22, H - 56, W - 44, 16, 8); c.fillStyle = 'rgba(255,255,255,0.18)'; c.fill();
    if (o.andel > 0.001) { rr(22, H - 56, Math.max(16, (W - 44) * o.andel), 16, 8); c.fillStyle = '#ffd24a'; c.fill(); }
    o.tex.needsUpdate = true;
  }

  // ─── v2: geometri byggd i kod (färg per hörn; i skinnläge också ben och glöd per del) ───
  const _gm = new THREE.Matrix4(), _gq = new THREE.Quaternion(), _ge = new THREE.Euler(), _gv = new THREE.Vector3(), _gp = new THREE.Vector3(), _gs = new THREE.Vector3(1, 1, 1), _gc = new THREE.Color();
  function geoBygg(skinn) {
    const delar = [];
    const B = {
      lagg(g, farg, ben = 0, glod = 0) {
        const ng = g.index ? g.toNonIndexed() : g;
        for (const n of Object.keys(ng.attributes)) if (n !== 'position') ng.deleteAttribute(n);
        ng.computeVertexNormals();
        if (Array.isArray(farg)) _gc.setRGB(farg[0], farg[1], farg[2]); else _gc.setHex(farg);
        const n = ng.attributes.position.count, col = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { col[i * 3] = _gc.r; col[i * 3 + 1] = _gc.g; col[i * 3 + 2] = _gc.b; }
        ng.setAttribute('color', new THREE.BufferAttribute(col, 3));
        if (skinn) { skinnAttr(ng, ben); glodAttr(ng, glod); }
        delar.push(ng); return B;
      },
      flytta(g, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) { g.applyMatrix4(_gm.compose(_gp.set(x, y, z), _gq.setFromEuler(_ge.set(rx, ry, rz)), _gs.set(sx, sy, sz))); return g; },
      lada(w, h, d, x, y, z, farg, rx, ry, rz, ben, glod) { return B.lagg(B.flytta(new THREE.BoxGeometry(w, h, d), x, y, z, rx, ry, rz), farg, ben, glod); },
      stav(r0, r1, a, b, farg, seg = 6, ben, glod) {
        _gv.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); const l = _gv.length(); const g = new THREE.CylinderGeometry(r1, r0, l, seg, 1);
        _gq.setFromUnitVectors(UPP, _gv.normalize()); g.applyMatrix4(_gm.compose(_gp.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), _gq, _gs.set(1, 1, 1)));
        return B.lagg(g, farg, ben, glod);
      },
      klot(r, x, y, z, farg, sx = 1, sy = 1, sz = 1, ben, glod, det = 0) { return B.lagg(B.flytta(new THREE.IcosahedronGeometry(r, det), x, y, z, 0, 0, 0, sx, sy, sz), farg, ben, glod); },
      kon(r, h, x, y, z, farg, rx, ry, rz, seg = 5, ben, glod) { return B.lagg(B.flytta(new THREE.ConeGeometry(r, h, seg), x, y, z, rx, ry, rz), farg, ben, glod); },
      cyl(r, h, x, y, z, farg, rx, ry, rz, seg = 10, ben, glod) { return B.lagg(B.flytta(new THREE.CylinderGeometry(r, r, h, seg), x, y, z, rx, ry, rz), farg, ben, glod); },
      tri(pkt, farg, ben, glod) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pkt, 3)); return B.lagg(g, farg, ben, glod); },
      klar() { const g = mergeGeometries(delar, false); g.computeBoundingBox(); g.computeBoundingSphere(); return g; },
    };
    return B;
  }

  // ─── v2: figurer byggda i kod (isvarg, drake). Egen enkel rigg: ett skinnat nät, benen vrids i animKod. ───
  const KODFIGURER = {
    varg() {
      const BEN = ['rot', 'kropp', 'huvud', 'svans', 'benFV', 'benFH', 'benBV', 'benBH'];
      const pos = { rot: [0, 0, 0], kropp: [0, 0.62, 0], huvud: [0, 0.8, 0.46], svans: [0, 0.72, -0.44], benFV: [0.15, 0.56, 0.34], benFH: [-0.15, 0.56, 0.34], benBV: [0.14, 0.56, -0.34], benBH: [-0.14, 0.56, -0.34] };
      const far = { kropp: 'rot', huvud: 'kropp', svans: 'kropp', benFV: 'kropp', benFH: 'kropp', benBV: 'kropp', benBH: 'kropp' };
      const B = geoBygg(true), i = (n) => BEN.indexOf(n);
      const PALS = 0xc4d0de, RYGG = 0x8494aa, BUK = 0xe6edf5, MORK = 0x2a2e38;
      B.lada(0.42, 0.42, 0.52, 0, 0.66, 0.16, PALS, 0, 0, 0, i('kropp'));
      B.lada(0.34, 0.34, 0.52, 0, 0.64, -0.22, PALS, 0.06, 0, 0, i('kropp'));
      B.lada(0.24, 0.08, 0.82, 0, 0.86, -0.04, RYGG, 0, 0, 0, i('kropp'));
      B.lada(0.28, 0.1, 0.6, 0, 0.46, 0.0, BUK, 0, 0, 0, i('kropp'));
      B.lada(0.44, 0.4, 0.26, 0, 0.76, 0.42, BUK, -0.35, 0, 0, i('kropp'));
      B.lada(0.28, 0.26, 0.3, 0, 0.88, 0.62, PALS, 0, 0, 0, i('huvud'));
      B.lada(0.17, 0.13, 0.25, 0, 0.82, 0.85, BUK, 0.06, 0, 0, i('huvud'));
      B.lada(0.08, 0.06, 0.05, 0, 0.855, 0.975, MORK, 0, 0, 0, i('huvud'));
      for (const sd of [-1, 1]) {
        B.kon(0.065, 0.18, sd * 0.09, 1.08, 0.58, RYGG, -0.15, 0, sd * -0.18, 4, i('huvud'));
        B.lada(0.06, 0.035, 0.02, sd * 0.085, 0.92, 0.775, 0xd8f6ff, 0, 0, 0, i('huvud'), 1);
      }
      B.stav(0.085, 0.03, [0, 0.72, -0.44], [0, 0.46, -0.92], RYGG, 5, i('svans'));
      for (const [n, x, z] of [['benFV', 0.15, 0.34], ['benFH', -0.15, 0.34], ['benBV', 0.14, -0.34], ['benBH', -0.14, -0.34]]) {
        B.stav(0.08, 0.055, [x, 0.6, z], [x, 0.26, z + 0.02], PALS, 5, i(n));
        B.stav(0.05, 0.04, [x, 0.26, z + 0.02], [x, 0.05, z], PALS, 5, i(n));
        B.lada(0.09, 0.05, 0.14, x, 0.025, z + 0.03, RYGG, 0, 0, 0, i(n));
      }
      return { BEN, pos, far, geo: B.klar(), radie: 1.1 };
    },
    drake() {
      const BEN = ['rot', 'kropp', 'hals1', 'hals2', 'huvud', 'kak', 'vV1', 'vV2', 'vH1', 'vH2', 's1', 's2', 's3'];
      const pos = { rot: [0, 0, 0], kropp: [0, 1.6, 0], hals1: [0, 1.95, 0.85], hals2: [0, 2.5, 1.45], huvud: [0, 2.85, 1.85], kak: [0, 2.78, 2.12],
        vV1: [0.42, 2.0, 0.25], vV2: [2.0, 2.25, 0.05], vH1: [-0.42, 2.0, 0.25], vH2: [-2.0, 2.25, 0.05], s1: [0, 1.55, -0.95], s2: [0, 1.38, -1.95], s3: [0, 1.22, -2.85] };
      const far = { kropp: 'rot', hals1: 'kropp', hals2: 'hals1', huvud: 'hals2', kak: 'huvud', vV1: 'kropp', vV2: 'vV1', vH1: 'kropp', vH2: 'vH1', s1: 'kropp', s2: 's1', s3: 's2' };
      const B = geoBygg(true), i = (n) => BEN.indexOf(n);
      const RD = 0x8a2418, MRK = 0x3e0c08, BUK = 0xff8a30, HORN = 0xeadfc4, VING = 0x5c1610;
      B.klot(1, 0, 1.62, 0.05, RD, 0.78, 0.72, 1.35, i('kropp'), 0, 1);
      B.klot(1, 0, 1.34, 0.12, BUK, 0.56, 0.42, 1.12, i('kropp'), 0.55, 1);
      for (let k = 0; k < 5; k++) B.kon(0.13, 0.4, 0, 2.3 - k * 0.04, 0.72 - k * 0.42, MRK, -0.55, 0, 0, 4, i('kropp'));
      B.stav(0.36, 0.27, [0, 1.85, 0.75], [0, 2.5, 1.45], RD, 7, i('hals1'));
      B.stav(0.2, 0.15, [0, 1.72, 0.92], [0, 2.32, 1.55], BUK, 5, i('hals1'), 0.35);
      B.stav(0.27, 0.22, [0, 2.5, 1.45], [0, 2.86, 1.86], RD, 7, i('hals2'));
      B.lada(0.52, 0.42, 0.7, 0, 2.95, 2.05, RD, 0, 0, 0, i('huvud'));
      B.lada(0.38, 0.26, 0.56, 0, 2.9, 2.56, RD, 0.08, 0, 0, i('huvud'));
      B.lada(0.58, 0.1, 0.26, 0, 3.17, 2.2, MRK, 0, 0, 0, i('huvud'));
      for (const sd of [-1, 1]) {
        B.kon(0.085, 0.62, sd * 0.17, 3.34, 1.84, HORN, -1.05, 0, sd * -0.2, 5, i('huvud'));
        B.kon(0.05, 0.3, sd * 0.28, 3.12, 1.98, HORN, -0.9, 0, sd * -0.6, 4, i('huvud'));
        B.lada(0.09, 0.06, 0.05, sd * 0.22, 3.03, 2.33, 0xffd040, 0, 0, 0, i('huvud'), 1);
        B.lada(0.05, 0.04, 0.04, sd * 0.1, 2.98, 2.85, MRK, 0, 0, 0, i('huvud'));
        B.kon(0.03, 0.1, sd * 0.13, 2.74, 2.72, HORN, Math.PI, 0, 0, 4, i('huvud'));
      }
      B.lada(0.34, 0.1, 0.56, 0, 2.73, 2.42, RD, 0, 0, 0, i('kak'));
      B.lada(0.26, 0.04, 0.42, 0, 2.79, 2.4, 0xff6a20, 0, 0, 0, i('kak'), 1);
      for (const sd of [-1, 1]) { // vingarna (vänster sd = 1 längs +x)
        const v1 = i(sd > 0 ? 'vV1' : 'vH1'), v2 = i(sd > 0 ? 'vV2' : 'vH2'), X = (x) => x * sd;
        B.stav(0.11, 0.08, [X(0.42), 2.0, 0.25], [X(2.0), 2.25, 0.05], MRK, 5, v1);
        B.tri([X(0.42), 2.0, 0.45, X(2.0), 2.25, 0.05, X(2.0), 2.02, -1.05, X(0.42), 2.0, 0.45, X(2.0), 2.02, -1.05, X(0.42), 1.98, -0.8], VING, v1);
        B.stav(0.08, 0.04, [X(2.0), 2.25, 0.05], [X(3.75), 2.05, -0.35], MRK, 5, v2);
        B.stav(0.06, 0.03, [X(2.0), 2.25, 0.05], [X(3.05), 1.98, -1.15], MRK, 4, v2);
        B.tri([X(2.0), 2.25, 0.05, X(3.75), 2.05, -0.35, X(3.05), 1.98, -1.15, X(2.0), 2.25, 0.05, X(3.05), 1.98, -1.15, X(2.0), 2.02, -1.05], VING, v2);
        B.kon(0.06, 0.22, X(2.0), 2.36, 0.1, HORN, 0, 0, 0, 4, v2);
        B.stav(0.14, 0.1, [X(0.38), 1.35, 0.6], [X(0.42), 0.85, 0.8], RD, 5, i('kropp'));
        B.lada(0.16, 0.08, 0.22, X(0.42), 0.82, 0.86, MRK, 0, 0, 0, i('kropp'));
        B.stav(0.22, 0.13, [X(0.45), 1.35, -0.5], [X(0.5), 0.78, -0.35], RD, 5, i('kropp'));
        B.lada(0.2, 0.1, 0.3, X(0.5), 0.74, -0.28, MRK, 0, 0, 0, i('kropp'));
      }
      B.stav(0.4, 0.28, [0, 1.55, -0.85], [0, 1.38, -1.95], RD, 7, i('s1'));
      B.stav(0.28, 0.16, [0, 1.38, -1.95], [0, 1.22, -2.85], RD, 6, i('s2'));
      B.stav(0.16, 0.05, [0, 1.22, -2.85], [0, 1.08, -3.75], RD, 5, i('s3'));
      for (const [z, y, b] of [[-1.4, 1.78, 's1'], [-2.3, 1.55, 's2'], [-3.1, 1.32, 's3']]) B.kon(0.09, 0.28, 0, y, z, MRK, -0.6, 0, 0, 4, i(b));
      B.tri([0, 1.08, -3.55, 0.32, 1.08, -3.85, 0, 1.08, -4.3, 0, 1.08, -3.55, 0, 1.08, -4.3, -0.32, 1.08, -3.85], MRK, i('s3'));
      return { BEN, pos, far, geo: B.klar(), radie: 4.6, dubbel: true };
    },
  };
  function bakaKod(typ, def) {
    const k = KODFIGURER[def.kod](), rig = new THREE.Group();
    const ben = k.BEN.map((n) => { const b = new THREE.Bone(); b.name = def.kod + '_' + n; return b; });
    k.BEN.forEach((n, j) => { const p = k.pos[n], f = k.far[n]; if (f) { const pf = k.pos[f]; ben[j].position.set(p[0] - pf[0], p[1] - pf[1], p[2] - pf[2]); ben[k.BEN.indexOf(f)].add(ben[j]); } else { ben[j].position.set(p[0], p[1], p[2]); rig.add(ben[j]); } });
    rig.updateMatrixWorld(true);
    const skel = new THREE.Skeleton(ben);
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: k.dubbel ? THREE.DoubleSide : THREE.FrontSide });
    const uGlod = { value: new THREE.Color(def.glod ?? 0xffffff).multiplyScalar(3.2) };
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uGlod = uGlod;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aGlod;\nvarying float vGlod;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlod = aGlod;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vGlod;\nuniform vec3 uGlod;').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vGlod * uGlod;');
    };
    mat.customProgramCacheKey = () => 'kodfigur' + (k.dubbel ? 'd' : '');
    const nat = new THREE.SkinnedMesh(k.geo, mat); nat.name = 'kropp'; nat.castShadow = true; nat.receiveShadow = false;
    rig.add(nat); nat.bind(skel, new THREE.Matrix4());
    const hojd = k.geo.boundingBox.max.y;
    nat.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, hojd * 0.5, 0), k.radie);
    return { mall: rig, klipp: {}, hojd, kod: def.kod, tri: k.geo.attributes.position.count / 3 };
  }
  // Animation för kodfigurer. o.lage = anim-läget, f.at = tid sedan läget byttes, f.T = egen klocka.
  function animKod(o, dt) {
    const f = o.f, b = f.ben; f.at += dt; f.T += dt;
    const l = o.lage, T = f.T, at = f.at;
    if (f.fm.kod === 'varg') {
      b.rot.rotation.set(0, 0, 0); b.rot.position.set(0, 0, 0); b.kropp.position.set(0, 0.62, 0); b.kropp.rotation.set(0, 0, 0); b.huvud.rotation.set(0, 0, 0); b.svans.rotation.set(0.3, 0, 0);
      b.benFV.rotation.set(0, 0, 0); b.benFH.rotation.set(0, 0, 0); b.benBV.rotation.set(0, 0, 0); b.benBH.rotation.set(0, 0, 0);
      if (l === 'ga' || l === 'spring' || l === 'bar') {
        const sp = l !== 'ga', ph = T * (sp ? 13 : 8.5), a = sp ? 0.8 : 0.45, s = Math.sin(ph);
        b.benFV.rotation.x = s * a; b.benBH.rotation.x = s * a * 0.9; b.benFH.rotation.x = -s * a; b.benBV.rotation.x = -s * a * 0.9;
        b.kropp.position.y = 0.62 + Math.abs(Math.cos(ph)) * (sp ? 0.07 : 0.03); b.kropp.rotation.x = Math.sin(ph * 2) * (sp ? 0.06 : 0.03);
        b.huvud.rotation.x = -Math.sin(ph * 2) * 0.06 + (sp ? 0.18 : 0); b.svans.rotation.x = (sp ? 0.9 : 0.5) + s * 0.15; b.svans.rotation.y = Math.cos(ph) * 0.2;
      } else if (l === 'hugg' || l === 'hugg2') {
        const k = (at * 2.4) % 1, u = Math.sin(k * Math.PI);
        b.kropp.position.z = u * 0.3; b.kropp.position.y = 0.62 + u * 0.1; b.kropp.rotation.x = -u * 0.2;
        b.benFV.rotation.x = -u * 0.9; b.benFH.rotation.x = -u * 0.75; b.benBV.rotation.x = u * 0.35; b.benBH.rotation.x = u * 0.35;
        b.huvud.rotation.x = 0.25 - u * 0.15; b.svans.rotation.x = 0.7;
      } else if (l === 'do') {
        const k = Math.min(1, at / 0.45), e = k * k * (3 - 2 * k);
        b.rot.rotation.z = e * 1.45; b.rot.position.y = e * 0.2; b.huvud.rotation.x = e * 0.35; b.svans.rotation.x = 0.1;
        b.benFV.rotation.x = -e * 0.3; b.benBV.rotation.x = e * 0.3; b.benFH.rotation.x = -e * 0.15; b.benBH.rotation.x = e * 0.15;
      } else {
        b.kropp.position.y = 0.62 + Math.sin(T * 2.2) * 0.01; b.huvud.rotation.y = Math.sin(T * 0.6) * 0.35; b.huvud.rotation.x = Math.sin(T * 0.9) * 0.08 - 0.05;
        b.svans.rotation.y = Math.sin(T * 4) * 0.35;
      }
    } else if (f.fm.kod === 'drake') {
      const dod = l === 'do';
      f.vph = (f.vph || 0) + dt * (dod ? 0 : (l === 'ga' || l === 'spring') ? 3.8 : 2.8);
      const s = Math.sin(f.vph), s2 = Math.sin(f.vph - 0.75);
      b.rot.rotation.set(0, 0, 0); b.kak.rotation.set(0.05, 0, 0); b.hals2.rotation.set(0, 0, 0);
      if (dod) {
        const k = Math.min(1, at / 1.1), e = k * k * (3 - 2 * k);
        b.vV1.rotation.set(0, 0, -0.2 - e * 0.3); b.vV2.rotation.set(0, 0, -e * 1.1); b.vH1.rotation.set(0, 0, 0.2 + e * 0.3); b.vH2.rotation.set(0, 0, e * 1.1);
        b.rot.rotation.z = e * 0.45; b.hals1.rotation.set(e * 0.7, 0, 0); b.huvud.rotation.set(e * 0.4, 0, 0); b.kropp.position.y = 1.6;
      } else {
        b.vV1.rotation.set(0, Math.cos(f.vph) * 0.16, s * 0.62 + 0.12); b.vV2.rotation.set(0, 0, s2 * 0.5);
        b.vH1.rotation.set(0, -Math.cos(f.vph) * 0.16, -(s * 0.62 + 0.12)); b.vH2.rotation.set(0, 0, -s2 * 0.5);
        b.kropp.position.y = 1.6 - s * 0.13;
        b.hals1.rotation.set(Math.sin(T * 0.9) * 0.06, 0, 0); b.huvud.rotation.set(Math.sin(T * 0.8) * 0.06, Math.sin(T * 0.55) * 0.3, 0);
        b.kak.rotation.x = 0.05 + Math.max(0, Math.sin(T * 0.7)) * 0.1;
        if (l === 'hugg' || l === 'hugg2') {
          const k = (at * 1.25) % 1, u = Math.sin(k * Math.PI);
          b.hals1.rotation.x = u * 0.6; b.hals2.rotation.x = u * 0.25; b.huvud.rotation.x = -u * 0.3; b.kak.rotation.x = 0.05 + u * 0.65;
          if (k > 0.35 && k < 0.85 && o.ibild !== false) { // eldsprut ur gapet
            b.kak.getWorldPosition(_gp); const r = o.rot, dx = Math.sin(r), dz = Math.cos(r);
            for (let n = 0; n < 3; n++) { const sp = 7 + R() * 5; part.ny(_gp.x + dx * 0.5, _gp.y, _gp.z + dz * 0.5, dx * sp + (R() - 0.5) * 2, -2.5 - R() * 2, dz * sp + (R() - 0.5) * 2, 5, 1.6 + R(), 0.3, 1, 0.3 + R() * 0.25, 0.4 + R() * 0.25, 1, -1, 1.6); }
          }
        }
      }
      b.s1.rotation.set(Math.sin(T * 1.1) * 0.05, Math.sin(T * 1.3) * 0.22, 0); b.s2.rotation.set(0, Math.sin(T * 1.3 - 0.8) * 0.3, 0); b.s3.rotation.set(0, Math.sin(T * 1.3 - 1.6) * 0.38, 0);
    }
  }

  // ─── v2: belägringsmaskiner, vallgrav, värmeeld, båtar, brygga och isskärvor ───
  const maskinGeoCache = new Map();
  function maskinGeo(sort, niva) {
    const nyckel = sort + niva; let r = maskinGeoCache.get(nyckel); if (r) return r;
    const TRA = 0x8a5a34, TRA2 = 0x6a4026, TRA3 = 0xa87344, JARN = niva > 1 ? 0x3e4048 : 0x55585f, REP = 0xc9a070;
    r = {};
    if (sort === 'katapult') {
      const B = geoBygg(false);
      for (const sd of [-1, 1]) {
        B.lada(0.22, 0.22, 3.0, sd * 0.7, 0.5, 0, TRA);
        B.stav(0.09, 0.08, [sd * 0.7, 0.58, -0.5], [sd * 0.6, 1.78, 0.08], TRA2, 5); B.stav(0.09, 0.08, [sd * 0.7, 0.58, 0.62], [sd * 0.6, 1.78, 0.08], TRA2, 5);
        for (const z of [-1.05, 1.05]) { B.cyl(0.42, 0.14, sd * 0.86, 0.42, z, TRA2, 0, 0, Math.PI / 2, 10); B.cyl(0.1, 0.18, sd * 0.88, 0.42, z, JARN, 0, 0, Math.PI / 2, 6); }
        if (niva > 1) { B.lada(0.26, 0.06, 3.04, sd * 0.7, 0.62, 0, JARN); B.lada(0.26, 0.26, 0.08, sd * 0.7, 0.5, 0.9, JARN); B.lada(0.26, 0.26, 0.08, sd * 0.7, 0.5, -0.9, JARN); }
      }
      for (const z of [-1.2, 0, 1.2]) B.lada(1.62, 0.18, 0.2, 0, 0.5, z, TRA2);
      B.lada(1.42, 0.2, 0.2, 0, 1.8, 0.1, TRA2);
      B.cyl(0.07, 1.5, 0, 0.95, -0.2, JARN, 0, 0, Math.PI / 2, 6);
      B.cyl(0.2, 0.95, 0, 0.95, -0.2, REP, 0, 0, Math.PI / 2, 8);
      r.bas = B.klar();
      const A = geoBygg(false);
      A.lada(0.17, 0.17, 2.65, 0, 0, -1.1, TRA3); A.cyl(0.3, 0.16, 0, 0.12, -2.35, TRA2, 0, 0, 0, 8);
      if (niva > 1) { A.lada(0.2, 0.2, 0.08, 0, 0, -0.6, JARN); A.lada(0.2, 0.2, 0.08, 0, 0, -1.6, JARN); }
      r.arm = A.klar();
      r.sten = geoBygg(false).klot(0.24, 0, 0.3, -2.35, 0x8a8f98, 1, 0.9, 1).klar();
    } else {
      const B = geoBygg(false);
      B.stav(0.11, 0.09, [0, 0, 0], [0, 1.3, 0], TRA2, 6);
      for (const [x, z] of [[0.78, -0.45], [-0.78, -0.45], [0, 0.85]]) B.stav(0.075, 0.06, [0, 1.1, 0], [x, 0, z], TRA, 5);
      if (niva > 1) B.cyl(0.16, 0.1, 0, 1.25, 0, JARN, 0, 0, 0, 8);
      r.bas = B.klar();
      const H = geoBygg(false);
      H.lada(0.22, 0.16, 2.3, 0, 0.05, 0.2, TRA); H.lada(0.52, 0.42, 0.2, 0, 0.1, 1.1, TRA2); H.lada(0.56, 0.08, 0.24, 0, 0.33, 1.1, JARN);
      for (const sd of [-1, 1]) { H.stav(0.075, 0.05, [sd * 0.2, 0.1, 1.1], [sd * 1.28, 0.12, 0.72], TRA3, 5); H.lada(0.1, 0.1, 0.12, sd * 1.28, 0.12, 0.72, JARN); }
      H.cyl(0.18, 0.08, 0, 0.0, -0.86, TRA2, 0, 0, Math.PI / 2, 8);
      if (niva > 1) { H.lada(0.26, 0.2, 0.08, 0, 0.05, -0.3, JARN); H.lada(0.26, 0.2, 0.08, 0, 0.05, 0.5, JARN); }
      r.huvud = H.klar();
      const S1 = geoBygg(false), S2 = geoBygg(false);
      for (const sd of [-1, 1]) { S1.stav(0.012, 0.012, [sd * 1.28, 0.13, 0.72], [0, 0.14, -0.45], 0xf0e2b4, 3); S2.stav(0.012, 0.012, [sd * 1.28, 0.13, 0.72], [0, 0.14, 0.76], 0xf0e2b4, 3); }
      r.spand = S1.klar(); r.slapp = S2.klar();
      const P = geoBygg(false); P.stav(0.035, 0.035, [0, 0.2, -0.45], [0, 0.2, 1.4], 0x7a4e26, 5); P.kon(0.07, 0.22, 0, 0.2, 1.5, 0xc6ccd6, Math.PI / 2, 0, 0, 4);
      P.tri([0, 0.2, -0.4, 0, 0.36, -0.5, 0, 0.2, -0.15], 0xe0483f); P.tri([0, 0.2, -0.4, 0.16, 0.2, -0.5, 0, 0.2, -0.15], 0xe0483f);
      r.bult = P.klar();
    }
    maskinGeoCache.set(nyckel, r); return r;
  }
  function byggMaskinDelar(o, e, niva) {
    const g = maskinGeo(o.def.sort, Math.min(2, niva)), sk = (o.def.skala || 1) * (niva > 1 ? 1.15 : 1);
    o.grp.clear(); o.inre = new THREE.Group(); o.grp.add(o.inre); o.inre.scale.setScalar(sk);
    const mesh = (geo) => { const m = new THREE.Mesh(geo, vfMat); m.castShadow = true; m.receiveShadow = true; return m; };
    o.inre.add(mesh(g.bas));
    if (o.def.sort === 'katapult') { o.arm = new THREE.Group(); o.arm.position.set(0, 0.95, -0.2); o.arm.add(mesh(g.arm)); o.stenM = mesh(g.sten); o.arm.add(o.stenM); o.inre.add(o.arm); }
    else { o.huvud = new THREE.Group(); o.huvud.position.set(0, 1.32, 0); o.spand = mesh(g.spand); o.slapp = mesh(g.slapp); o.bult = mesh(g.bult); o.huvud.add(mesh(g.huvud), o.spand, o.slapp, o.bult); o.inre.add(o.huvud); }
    if (o.ruin) o.grp.add(o.ruin);
  }
  // Ruin för raserade byggen: porten blir en bruten mur med grushögar, övriga byggen en rasad byggnad.
  function byggRuin(def, e, bredd) {
    const grp = new THREE.Group(), lagg = (nyckel, x, y, z, ry, sx, sy, sz) => { const g = geoAv(nyckel); if (!g) return; const m = new THREE.Mesh(g.geo, g.mat); m.position.set(x, y, z); m.rotation.y = ry; m.scale.set(sx, sy, sz); m.castShadow = true; m.receiveShadow = true; grp.add(m); };
    if (def.port) { lagg('ruinmur', 0, 0, 0, 0, bredd / 4, 0.42, 1.25); lagg('grus', 0.4, 0, 1.0, 0.2, 0.32, 0.38, 0.4); lagg('grus', -0.8, 0, -1.0, 2.9, 0.28, 0.32, 0.36); }
    else { const s = (def.radie || 1.5) * 1.55; lagg('ruinhus', 0, 0, 0, 0.6, s, s * 0.9, s); lagg('grus', (def.radie || 1.5) * 0.7, 0, (def.radie || 1.5) * 0.5, 1.2, 0.22, 0.28, 0.28); }
    return grp;
  }
  // vallgravens yta: vatten (Gläntan), is (Frostön) eller lava (Vulkanön)
  const gravMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTid: { value: 0 }, uSlag: { value: 0 }, uNatt: { value: 0 }, uLjus: { value: new THREE.Color(1, 1, 1) }, uLjusRikt: { value: new THREE.Vector3(0, 1, 0) } }]),
    vertexShader: /* glsl */`varying vec2 vUv; varying vec3 vVarld;
      #include <fog_pars_vertex>
      void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vVarld = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`uniform float uTid, uSlag, uNatt; uniform vec3 uLjus, uLjusRikt; varying vec2 vUv; varying vec3 vVarld;
      #include <common>
      #include <fog_pars_fragment>
      ${GLSL_BRUS}
      void main(){
        float d = length(vUv - 0.5) * 2.0; vec2 p = vVarld.xz; vec3 c; float a = smoothstep(1.0, 0.94, d);
        if (uSlag < 0.5) {
          float v = sin(p.x * 2.1 + uTid * 1.6) * 0.5 + sin(p.y * 1.7 - uTid * 1.3) * 0.5 + fbrus(p * 1.3 + uTid * 0.3);
          c = mix(vec3(0.16, 0.42, 0.46), vec3(0.05, 0.22, 0.34), smoothstep(0.95, 0.4, d)) * uLjus;
          c += uLjus * smoothstep(0.75, 1.0, v * 0.5 + 0.4) * 0.25; c = mix(c, vec3(0.25, 0.2, 0.14) * uLjus, smoothstep(0.82, 0.98, d));
        } else if (uSlag < 1.5) {
          float spr = 1.0 - smoothstep(0.0, 0.04, abs(fbrus(p * 0.9) - 0.5));
          c = mix(vec3(0.78, 0.88, 0.95), vec3(0.52, 0.7, 0.84), smoothstep(0.3, 0.8, fbrus(p * 0.6)) * 0.6 + spr * 0.6) * uLjus * 1.1;
          c += uLjus * step(0.994, hsh(floor(p * 16.0))) * 0.4; c = mix(c, vec3(0.92, 0.95, 1.0) * uLjus, smoothstep(0.78, 0.98, d));
        } else {
          float n = fbrus(p * 0.9 + vec2(uTid * 0.25, -uTid * 0.18)), n2 = vbrus(p * 2.6 - uTid * 0.4);
          c = mix(vec3(0.9, 0.17, 0.02), vec3(1.7, 0.75, 0.15), smoothstep(0.4, 0.8, n)) * (1.0 - uNatt * 0.25);
          c = mix(c, vec3(0.08, 0.05, 0.04) * uLjus, smoothstep(0.62, 0.72, n2) * 0.8);
          c = mix(c, vec3(0.1, 0.07, 0.05) * uLjus + vec3(0.8, 0.2, 0.02) * (1.0 - smoothstep(0.0, 0.05, abs(n - 0.5))), smoothstep(0.7, 0.95, d));
        }
        gl_FragColor = vec4(c, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  let gravGeo = null;
  function byggGravDelar(o, niva) {
    if (!gravGeo) {
      const pk = [[2.78, -0.02], [2.95, 0.16], [3.2, 0.3], [3.5, 0.27], [3.8, 0.1], [3.98, -0.02]].map(([x, y]) => new THREE.Vector2(x, y));
      const vall = new THREE.LatheGeometry(pk, 36); vall.deleteAttribute('uv');
      const ng = vall.toNonIndexed(); ng.computeVertexNormals();
      const col = new Float32Array(ng.attributes.position.count * 3); ng.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const yta = new THREE.CircleGeometry(2.96, 40); yta.rotateX(-Math.PI / 2);
      const P = geoBygg(false); for (let i = 0; i < 16; i++) { const a = i / 16 * TAU, rr = 3.55; P.kon(0.07, 0.75, Math.cos(a) * rr, 0.45, Math.sin(a) * rr, 0x8a5a34, 0, 0, 0, 5); P.stav(0.075, 0.07, [Math.cos(a) * rr, -0.1, Math.sin(a) * rr], [Math.cos(a) * rr, 0.1, Math.sin(a) * rr], 0x6a4026, 5); }
      gravGeo = { vall: ng, yta, palar: P.klar() };
    }
    // vallens färg efter ön
    const f = new THREE.Color(tema === 'vinter' ? 0x9a948f : tema === 'vulkan' ? 0x3e3430 : 0x7a5c3c), c = gravGeo.vall.attributes.color;
    for (let i = 0; i < c.count; i++) c.setXYZ(i, f.r, f.g, f.b); c.needsUpdate = true;
    o.grp.clear();
    const v = new THREE.Mesh(gravGeo.vall, vfMat); v.receiveShadow = true; v.castShadow = true;
    const y = new THREE.Mesh(gravGeo.yta, gravMat); y.position.y = 0.06; y.renderOrder = 2;
    o.grp.add(v, y);
    if (niva > 1) { const p = new THREE.Mesh(gravGeo.palar, vfMat); p.castShadow = true; o.grp.add(p); }
  }
  let varmeeldG = null;
  function varmeeldGeo() {
    if (varmeeldG) return varmeeldG;
    const B = geoBygg(false), r = slump32(31);
    for (let i = 0; i < 11; i++) { const a = i / 11 * TAU + r() * 0.2; B.klot(0.24 + r() * 0.06, Math.cos(a) * 0.95, 0.14, Math.sin(a) * 0.95, r() < 0.5 ? 0x8a8f98 : 0x6e737c, 1.1, 0.75, 1, 0, 0, 0); }
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + 0.3; B.stav(0.09, 0.06, [Math.cos(a) * 0.62, 0.08, Math.sin(a) * 0.62], [Math.cos(a) * 0.1, 0.62, Math.sin(a) * 0.1], i % 2 ? 0x6a4026 : 0x4a2e1a, 5); }
    B.cyl(0.62, 0.08, 0, 0.06, 0, [1.4, 0.42, 0.08], 0, 0, 0, 10);
    varmeeldG = B.klar(); return varmeeldG;
  }
  let isskarvaG = null;
  function isskarvaGeo() { if (!isskarvaG) { isskarvaG = new THREE.OctahedronGeometry(0.17, 0); isskarvaG.scale(0.55, 2.3, 0.55); isskarvaG.computeBoundingBox(); } return isskarvaG; }

  // segelbåt: skrov, mast och råsegel. slag 'handel' (randigt segel) eller 'resa' (större, sköldar längs relingen)
  const batMallar = {};
  function batModell(slag) {
    if (batMallar[slag]) return batMallar[slag];
    const resa = slag === 'resa', L = resa ? 10 : 7, Bb = resa ? 3.1 : 2.4, H = resa ? 1.35 : 1.1;
    const pos = [], col = [], c1 = new THREE.Color(0x8a5a34), c2 = new THREE.Color(0x5e3a22), c3 = new THREE.Color(0xb08050);
    const sek = 14, tvar = [[-1, 1], [-0.93, 0.5], [-0.6, 0.12], [0, 0], [0.6, 0.12], [0.93, 0.5], [1, 1]];
    const punkt = (u, k) => { const w = Bb / 2 * (u < 0.62 ? 0.78 + 0.22 * Math.sin(u / 0.62 * Math.PI / 2) : Math.cos((u - 0.62) / 0.38 * Math.PI / 2)), top = H * (1 + 0.35 * Math.pow(Math.max(0, (u - 0.7) / 0.3), 2) + 0.15 * Math.pow(Math.max(0, (0.15 - u) / 0.15), 2)); return [tvar[k][0] * w, tvar[k][1] * top, -L / 2 + u * L]; };
    const tri = (a, b, c, f) => { pos.push(...a, ...b, ...c); for (let i = 0; i < 3; i++) col.push(f.r, f.g, f.b); };
    for (let i = 0; i < sek; i++) {
      const u0 = i / sek, u1 = (i + 1) / sek;
      for (let k = 0; k < tvar.length - 1; k++) { const a = punkt(u0, k), b = punkt(u0, k + 1), c = punkt(u1, k + 1), d = punkt(u1, k), f = (k === 0 || k === 5) ? c2 : c1; tri(a, b, c, f); tri(a, c, d, f); }
      const dv = (u, sd) => { const q = punkt(u, sd > 0 ? 6 : 0); return [q[0] * 0.96, q[1] - 0.12, q[2]]; };
      tri(dv(u0, -1), dv(u1, 1), dv(u0, 1), c3); tri(dv(u0, -1), dv(u1, -1), dv(u1, 1), c3);
    }
    for (let k = 0; k < tvar.length - 2; k++) tri(punkt(0, 0), punkt(0, k + 2), punkt(0, k + 1), c2); // akterspegel
    const skrov = new THREE.BufferGeometry(); skrov.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); skrov.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); skrov.computeVertexNormals();
    const grp = new THREE.Group(), s = new THREE.Mesh(skrov, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })); s.castShadow = true; grp.add(s);
    const mh = resa ? 8 : 6, M = geoBygg(false);
    M.stav(0.12, 0.08, [0, H - 0.2, L * 0.06], [0, mh, L * 0.06], 0x6a4026, 6); M.stav(0.07, 0.07, [-Bb * 0.85, mh * 0.88, L * 0.06 + 0.15], [Bb * 0.85, mh * 0.88, L * 0.06 + 0.15], 0x6a4026, 5);
    M.stav(0.025, 0.025, [0, mh, L * 0.06], [0, H, L / 2 - 0.2], 0xd8c8a0, 3); M.stav(0.025, 0.025, [0, mh, L * 0.06], [0, H, -L / 2 + 0.3], 0xd8c8a0, 3);
    if (resa) for (let i = 0; i < 5; i++) for (const sd of [-1, 1]) { const u = 0.22 + i * 0.12, q = punkt(u, sd > 0 ? 6 : 0); M.cyl(0.32, 0.06, q[0] * 1.02, q[1] - 0.15, q[2], i % 2 ? 0x3f7fd0 : 0xe0a820, 0, 0, Math.PI / 2, 10); }
    const mm = new THREE.Mesh(M.klar(), vfMat); mm.castShadow = true; grp.add(mm);
    // segel med egen canvastextur
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128; const cx = cv.getContext('2d');
    if (resa) { cx.fillStyle = '#f2e8d2'; cx.fillRect(0, 0, 128, 128); cx.fillStyle = '#2f6fc0'; cx.fillRect(0, 44, 128, 40); cx.fillStyle = '#ffd24a'; cx.beginPath(); cx.moveTo(40, 80); cx.lineTo(44, 52); cx.lineTo(54, 64); cx.lineTo(64, 48); cx.lineTo(74, 64); cx.lineTo(84, 52); cx.lineTo(88, 80); cx.closePath(); cx.fill(); }
    else for (let i = 0; i < 8; i++) { cx.fillStyle = i % 2 ? '#f4ead6' : '#c8402e'; cx.fillRect(i * 16, 0, 16, 128); }
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const sb = Bb * 1.75, sh2 = mh * 0.62, sg = new THREE.PlaneGeometry(sb, sh2, 6, 4), sp = sg.attributes.position;
    for (let i = 0; i < sp.count; i++) { const x = sp.getX(i) / sb + 0.5, y = sp.getY(i) / sh2 + 0.5; sp.setZ(i, Math.sin(x * Math.PI) * Math.sin((y * 0.8 + 0.2) * Math.PI) * 0.55); }
    sg.computeVertexNormals();
    const segel = new THREE.Mesh(sg, new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide })); segel.position.set(0, mh * 0.88 - sh2 / 2 - 0.05, L * 0.06 + 0.22); segel.castShadow = true; grp.add(segel);
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.1, 3), new THREE.MeshLambertMaterial({ color: resa ? 0x2f6fc0 : 0xc8402e })); fl.rotation.z = Math.PI / 2; fl.position.set(-0.55, mh + 0.1, L * 0.06); grp.add(fl);
    grp.userData.L = L;
    batMallar[slag] = grp; return grp;
  }

  // ─── v2: öns värld (rivs och byggs om vid öbyte) ───
  const varldObj = [];
  function laggVarld(m) { scen.add(m); varldObj.push(m); return m; }
  let lavaMat = null;
  function byggLava() {
    lavaMat = null;
    if (!lava.length) return;
    const segs = lava.slice(0, 32), pos = [], ind = [];
    for (const s of segs) {
      const dx = s.bx - s.ax, dz = s.bz - s.az, l = Math.hypot(dx, dz) || 1, ux = dx / l, uz = dz / l, W = (s.bredd || 1.7) * 1.3, nx = -uz * W, nz = ux * W, b = pos.length / 3;
      pos.push(s.ax - ux * W + nx, 0.04, s.az - uz * W + nz, s.ax - ux * W - nx, 0.04, s.az - uz * W - nz, s.bx + ux * W - nx, 0.04, s.bz + uz * W - nz, s.bx + ux * W + nx, 0.04, s.bz + uz * W + nz);
      ind.push(b, b + 2, b + 1, b, b + 3, b + 2);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(ind);
    const seg = []; for (let i = 0; i < 32; i++) { const s = segs[i]; seg.push(s ? new THREE.Vector4(s.ax, s.az, s.bx, s.bz) : new THREE.Vector4(1e4, 1e4, 1e4, 1e4)); }
    lavaMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: true,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTid: { value: 0 }, uN: { value: segs.length }, uBredd: { value: segs[0].bredd || 1.7 }, uLjus: { value: new THREE.Color(1, 1, 1) }, uNatt: { value: 0 } }]),
      vertexShader: /* glsl */`varying vec3 vVarld;
        #include <fog_pars_vertex>
        void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vVarld = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */`uniform float uTid, uN, uBredd, uNatt; uniform vec4 uSeg[32]; uniform vec3 uLjus; varying vec3 vVarld;
        #include <common>
        #include <fog_pars_fragment>
        ${GLSL_BRUS}
        void main(){
          vec2 p = vVarld.xz; float d = 1e3; vec2 dir = vec2(1.0, 0.0); float t0 = 0.0;
          for (int i = 0; i < 32; i++) { if (float(i) >= uN) break; vec4 s = uSeg[i]; vec2 ab = s.zw - s.xy; float t = clamp(dot(p - s.xy, ab) / dot(ab, ab), 0.0, 1.0); float di = length(p - s.xy - ab * t); if (di < d) { d = di; dir = normalize(ab); } }
          float k = d / uBredd;
          if (k > 1.3) discard;
          vec2 fl = normalize(p + vec2(1e-3)) * uTid; // lavan rinner inåt mot borgen; brus i världens koordinater så att bitarna möts utan skarvar
          float n = fbrus(p * 0.6 + fl * 0.45), n2 = vbrus(p * 1.7 + fl * 0.8);
          float karna = smoothstep(1.0, 0.6, k + (n - 0.5) * 0.4);
          vec3 lavaF = mix(vec3(0.95, 0.17, 0.02), vec3(1.9, 0.82, 0.14), smoothstep(0.35, 0.85, n)) * (1.0 - uNatt * 0.25);
          float flak = smoothstep(0.56, 0.66, n2) * smoothstep(0.1, 0.7, k) * 0.9;
          vec3 skorpa = vec3(0.07, 0.05, 0.045) * uLjus;
          vec3 c = mix(skorpa, mix(lavaF, skorpa + vec3(0.35, 0.05, 0.0), flak), karna);
          c += vec3(0.7, 0.13, 0.01) * smoothstep(1.25, 0.95, k) * (1.0 - karna) * (0.5 + 0.5 * sin(uTid * 2.0 + (p.x + p.y) * 0.6));
          gl_FragColor = vec4(c, smoothstep(1.3, 1.08, k));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
    });
    lavaMat.uniforms.uSeg = { value: seg };
    const m = new THREE.Mesh(g, lavaMat); m.renderOrder = 2; m.frustumCulled = false; m.name = 'lava'; m.userData.egen = true;
    laggVarld(m);
    // lavakällor: mörka stenar där fårorna börjar
    const r = slump32(77);
    for (const s of lava) { const ar = Math.hypot(s.ax, s.az); if (ar < 48) continue; const p = modellPool('sten_c', { max: 900, dov: true }); if (!p) break;
      for (let i = 0; i < 4; i++) { const a = r() * TAU, rr = 2 + r() * 1.4, x = s.ax + Math.cos(a) * rr, z = s.az + Math.sin(a) * rr, sk = 4 + r() * 4; _m4.compose(_v3.set(x, markHojd(x, z) - 0.1, z), _q.setFromAxisAngle(UPP, r() * TAU), _s3.set(sk, sk * (0.7 + r() * 0.8), sk)); p.lagg(null, _m4, _c.setHex(0x3a3432)); } }
  }
  let bryggaL = 0;
  function byggBrygga() {
    const b = brygga; if (!b) return;
    const ux = Math.sin(b.rot), uz = Math.cos(b.rot);
    let L = 6; while (L < 40 && markHojd(b.x + ux * L, b.z + uz * L) > VATTEN_Y - 0.75) L += 0.5; L += 3; bryggaL = L;
    const B = geoBygg(false), r = slump32(5), dy = (s) => (s < 1.4 ? 0.06 + 0.3 * s / 1.4 : 0.36);
    for (let s = 0; s < L; s += 0.5) B.lada(2.6 + (r() - 0.5) * 0.12, 0.09, 0.44, (r() - 0.5) * 0.06, dy(s + 0.25), s + 0.25, r() < 0.5 ? 0x9a6a3e : 0x8a5a34, 0, (r() - 0.5) * 0.04, 0);
    for (const sd of [-1, 1]) {
      B.lada(0.16, 0.18, L - 1.2, sd * 0.95, 0.24, 1.2 + (L - 1.2) / 2, 0x5e3a22);
      for (let s = 2.2; s < L; s += 2.4) B.stav(0.13, 0.12, [sd * 1.2, -2.6, s], [sd * 1.2, 0.62, s], 0x6a4026, 6);
    }
    B.stav(0.16, 0.14, [-0.9, 0.3, L - 0.3], [-0.9, 0.95, L - 0.3], 0x4a2e1a, 6); B.stav(0.16, 0.14, [0.9, 0.3, L - 0.3], [0.9, 0.95, L - 0.3], 0x4a2e1a, 6);
    const g = B.klar(); g.applyMatrix4(_m4.compose(_v3.set(b.x, 0, b.z), _q.setFromAxisAngle(UPP, b.rot), _s3.set(1, 1, 1)));
    const m = new THREE.Mesh(g, vfMat); m.castShadow = true; m.receiveShadow = true; m.name = 'brygga'; m.userData.egen = true;
    laggVarld(m);
  }
  // Isvakar på Frostön: där de odöda kliver upp ur isen (NO, SO, SV, NV).
  function byggIsvakar(r) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 256; const c = cv.getContext('2d');
    let gr = c.createRadialGradient(128, 128, 10, 128, 128, 127); gr.addColorStop(0, 'rgba(190,220,240,1)'); gr.addColorStop(0.62, 'rgba(176,206,228,0.95)'); gr.addColorStop(0.8, 'rgba(225,236,246,0.8)'); gr.addColorStop(1, 'rgba(235,242,250,0)');
    c.fillStyle = gr; c.fillRect(0, 0, 256, 256);
    c.strokeStyle = 'rgba(120,160,195,0.8)'; c.lineWidth = 2;
    for (let i = 0; i < 9; i++) { const a = r() * TAU; c.beginPath(); c.moveTo(128 + Math.cos(a) * 30, 128 + Math.sin(a) * 30); let x = 128 + Math.cos(a) * 30, y = 128 + Math.sin(a) * 30; for (let k = 0; k < 4; k++) { x += Math.cos(a + (r() - 0.5)) * 18; y += Math.sin(a + (r() - 0.5)) * 18; c.lineTo(x, y); } c.stroke(); }
    gr = c.createRadialGradient(128, 128, 4, 128, 128, 34); gr.addColorStop(0, 'rgba(6,24,44,1)'); gr.addColorStop(0.75, 'rgba(14,46,74,1)'); gr.addColorStop(1, 'rgba(120,170,205,0.0)');
    c.fillStyle = gr; c.beginPath(); c.arc(128, 128, 34, 0, TAU); c.fill();
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshLambertMaterial({ map: tex, transparent: true, depthWrite: false }), geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2);
    for (const k of ['NO', 'SO', 'SV', 'NV']) {
      const v = RIKTPOS[k], m = new THREE.Mesh(geo, mat); m.position.set(v.x, markHojd(v.x, v.z) + 0.03, v.z); m.scale.set(10, 1, 10); m.rotation.y = r() * TAU; m.renderOrder = 1; m.receiveShadow = true; m.userData.egen = m.userData.egenMat = true; laggVarld(m);
      const p = modellPool('stenA', { max: 120, dov: true }); if (!p) continue;
      for (let i = 0; i < 6; i++) { const a = r() * TAU, rr = 3.4 + r() * 1.6, x = v.x + Math.cos(a) * rr, z = v.z + Math.sin(a) * rr, sk = 2.5 + r() * 3; _m4.compose(_v3.set(x, markHojd(x, z) - 0.05, z), _q.setFromEuler(_e.set((r() - 0.5) * 0.5, r() * TAU, (r() - 0.5) * 0.5)), _s3.set(sk, sk * (1 + r()), sk)); p.lagg(null, _m4, _c.setHex(0xcfe6ff)); }
    }
  }
  const RIKTPOS = { S: { x: 0, z: 42 }, O: { x: 42, z: 0 }, N: { x: 0, z: -42 }, V: { x: -42, z: 0 } };
  for (const [k, g] of [['SO', 45], ['NO', 135], ['NV', 225], ['SV', 315]]) RIKTPOS[k] = { x: 49 * Math.sin(g * Math.PI / 180), z: 49 * Math.cos(g * Math.PI / 180) };

  // snöfall (Frostön), glöd och askregn (Vulkanön): punkter som faller i skuggaren runt fokus, ingen CPU-kostnad
  const nederbord = (() => {
    const N = mobil ? 1000 : 1800, p = new Float32Array(N * 3), fs = new Float32Array(N);
    for (let i = 0; i < N; i++) { p[i * 3] = R() * 56; p[i * 3 + 1] = R() * 18; p[i * 3 + 2] = R() * 56; fs[i] = R(); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('aFas', new THREE.BufferAttribute(fs, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      uniforms: { uTid: U.tid, uFokus: { value: new THREE.Vector3() }, uSkala: { value: 600 }, uStyrka: { value: 0 }, uFall: { value: 1.5 }, uStorlek: { value: 0.09 }, uFarg: { value: new THREE.Color(1, 1, 1) }, uGlod: { value: 0 }, uLjus: { value: new THREE.Color(1, 1, 1) }, uVind: { value: 0.4 } },
      vertexShader: /* glsl */`attribute float aFas; uniform float uTid, uSkala, uStyrka, uFall, uStorlek, uGlod, uVind; uniform vec3 uFokus; varying float vA; varying float vEm;
        void main(){ vec3 q = position; float f = fract(aFas * 13.7);
          vEm = step(1.0 - uGlod, fract(aFas * 5.31));
          float fart = mix(uFall * (0.7 + 0.6 * fract(aFas * 7.1)), -0.9 - f, vEm);
          q.y = mod(q.y - uTid * fart, 18.0);
          q.x += sin(uTid * 0.7 + aFas * 40.0) * 0.8 + uTid * uVind; q.z += cos(uTid * 0.53 + aFas * 31.0) * 0.6 + uTid * uVind * 0.3;
          q.xz = mod(q.xz - uFokus.xz + 28.0, 56.0) - 28.0 + uFokus.xz;
          vA = step(aFas, uStyrka) * smoothstep(0.0, 1.0, q.y) * smoothstep(18.0, 14.0, q.y) * mix(1.0, 0.6 + 0.4 * sin(uTid * 5.0 + aFas * 50.0), vEm);
          vec4 mv = viewMatrix * vec4(q, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = min(36.0, uStorlek * mix(0.6 + 0.8 * f, 0.7, vEm) * uSkala / max(-mv.z, 0.1)); }`,
      fragmentShader: /* glsl */`uniform vec3 uFarg, uLjus; varying float vA; varying float vEm;
        void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.12, d) * vA; if (a < 0.01) discard;
          vec3 c = mix(uFarg * uLjus, vec3(3.2, 1.2, 0.25), vEm);
          gl_FragColor = vec4(c * a, a * (1.0 - vEm));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    const m = new THREE.Points(g, mat); m.frustumCulled = false; m.renderOrder = 23; m.name = 'nederbord'; m.visible = false; scen.add(m);
    const nu = { styrka: 0, glod: 0, fall: 1.5, storlek: 0.09, farg: new THREE.Color(1, 1, 1) };
    function steg(dt, aska) {
      let mal;
      if (TM.nederbord === 'sno') mal = { styrka: 0.32 + 0.2 * dygn.morker, glod: 0, fall: 1.4, storlek: 0.085, farg: 0xf4f8ff, vind: 0.35 };
      else if (TM.nederbord === 'aska') mal = aska ? { styrka: 1, glod: 0.1, fall: 0.9, storlek: 0.1, farg: 0x8a8480, vind: 0.6 } : { styrka: 0.22, glod: 0.6, fall: 0.6, storlek: 0.08, farg: 0x9a948e, vind: 0.25 };
      else mal = { styrka: 0, glod: 0, fall: 1, storlek: 0.08, farg: 0xffffff, vind: 0 };
      const k = 1 - Math.exp(-1.2 * dt), u = mat.uniforms;
      nu.styrka = lerp(nu.styrka, mal.styrka, k); nu.glod = lerp(nu.glod, mal.glod, k); nu.fall = lerp(nu.fall, mal.fall, k); nu.storlek = lerp(nu.storlek, mal.storlek, k); nu.farg.lerp(_c.setHex(mal.farg), k);
      m.visible = nu.styrka > 0.01;
      u.uStyrka.value = nu.styrka; u.uGlod.value = nu.glod; u.uFall.value = nu.fall; u.uStorlek.value = nu.storlek; u.uFarg.value.copy(nu.farg); u.uVind.value = mal.vind; u.uFokus.value.copy(kam.mal);
      u.uLjus.value.copy(dygn.ljus).multiplyScalar(1.1).addScalar(0.08);
    }
    function nolla() { nu.styrka = 0; }
    return { mat, steg, nolla };
  })();
  // korta ljusblixtar på marken (explosioner): ritas med markljus och glöd tills de klingat av
  const blixtar = [];
  function ljusblixt(x, z, radie, r, gg, b, tid) { blixtar.push({ x, z, radie, r, gg, b, tid, max: tid }); }
  // utropstecken över hjältar som väntar på att rekryteras
  let utropTex = null;
  function nyttUtrop() {
    if (!utropTex) {
      const cv = document.createElement('canvas'); cv.width = 64; cv.height = 96; const c = cv.getContext('2d');
      c.beginPath(); c.moveTo(20, 8); c.lineTo(44, 8); c.lineTo(38, 62); c.lineTo(26, 62); c.closePath(); c.fillStyle = '#ffd24a'; c.fill(); c.lineWidth = 5; c.lineJoin = 'round'; c.strokeStyle = 'rgba(40,24,0,0.9)'; c.stroke();
      c.beginPath(); c.arc(32, 80, 9, 0, TAU); c.fill(); c.stroke();
      utropTex = new THREE.CanvasTexture(cv); utropTex.colorSpace = THREE.SRGBColorSpace;
    }
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: utropTex, transparent: true, depthTest: false, depthWrite: false, fog: false })); s.renderOrder = 57; s.center.set(0.5, 0); scen.add(s);
    return s;
  }

  // ─── dekor och gräs ───
  function byggDekor() {
    const r = slump32(O.fro + 11 + (tema === 'sommar' ? 0 : tema.length * 17));
    const tDef = temaDef('trad'), sDef = temaDef('sten'), D = TM.dekor;
    let n = 0;
    for (let i = 0; i < 2600 && n < (mobil ? 220 : 340) * D.trad; i++) {
      const a = r() * TAU, rad = O.spelRadie + 3 + r() * (O.oRadie - O.spelRadie), x = Math.cos(a) * rad, z = Math.sin(a) * rad, d = kustR(a) - rad;
      if (d < 8.5 || fbm(x * 0.05 + 40, z * 0.05) < 0.36) continue;
      if (brygga) { const ux = Math.sin(brygga.rot), uz = Math.cos(brygga.rot), dx = x - brygga.x, dz = z - brygga.z; if (Math.abs(dx * uz - dz * ux) < 5 && dx * ux + dz * uz > -5) continue; }
      const p = modellPool(tDef.varianter[(r() * tDef.varianter.length) | 0], { max: 900, vaj: tDef.vaj || 1 }); if (!p) break;
      const s = lerp(tDef.skala[0], tDef.skala[1], r()) * 1.1;
      _m4.compose(_v3.set(x, markHojd(x, z) - 0.1, z), _q.setFromAxisAngle(UPP, r() * TAU), _s3.set(s, s * (0.9 + r() * 0.3), s));
      p.lagg(null, _m4, _c.setHex(tDef.farger[(r() * tDef.farger.length) | 0])); n++;
    }
    for (let i = 0; i < 90 * D.sten; i++) { // stenar längs stranden och ute i vattnet
      const a = r() * TAU, d = -5 + r() * (tema === 'vulkan' ? 20 : 12), rad = kustR(a) - d, x = Math.cos(a) * rad, z = Math.sin(a) * rad;
      if (rad < O.spelRadie + 2) continue;
      if (brygga) { const ux = Math.sin(brygga.rot), uz = Math.cos(brygga.rot), dx = x - brygga.x, dz = z - brygga.z; if (Math.abs(dx * uz - dz * ux) < 6 && dx * ux + dz * uz > -4) continue; }
      const p = modellPool(sDef.varianter[(r() * sDef.varianter.length) | 0], { max: 900, dov: true }); if (!p) break;
      const s = lerp(4, 12, r() * r());
      _m4.compose(_v3.set(x, markHojd(x, z) - 0.15, z), _q.setFromAxisAngle(UPP, r() * TAU), _s3.set(s, s * (0.8 + r() * 0.8), s));
      p.lagg(null, _m4, _c.setHex(d < 1 ? D.stenVat : D.stenLand));
    }
    byggGravfalt(r);
  }
  // Gravfälten i de fyra väderstrecken: härifrån kommer de odöda. Ren dekor (krockar inte), med en fri gång i mitten.
  function byggGravfalt(r) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const cx = cv.getContext('2d');
    const jf = tema === 'vinter' ? [96, 100, 112] : tema === 'vulkan' ? [30, 24, 22] : [62, 54, 52];
    const gr = cx.createRadialGradient(64, 64, 6, 64, 64, 63); gr.addColorStop(0, `rgba(${jf[0] - 4},${jf[1] - 4},${jf[2]},0.9)`); gr.addColorStop(0.55, `rgba(${jf},0.7)`); gr.addColorStop(1, `rgba(${jf[0] + 8},${jf[1] + 6},${jf[2] + 2},0)`); cx.fillStyle = gr; cx.fillRect(0, 0, 128, 128);
    const jordTex = new THREE.CanvasTexture(cv); jordTex.colorSpace = THREE.SRGBColorSpace;
    const jordMat = new THREE.MeshLambertMaterial({ map: jordTex, transparent: true, depthWrite: false });
    const jordGeo = new THREE.PlaneGeometry(1, 1); jordGeo.rotateX(-Math.PI / 2);
    for (const namn of Object.keys(VADERSTRECK)) {
      const v = VADERSTRECK[namn], l = Math.hypot(v.x, v.z), ux = v.x / l, uz = v.z / l, tx = -uz, tz = ux; // u pekar utåt, t tvärs
      const mot = Math.atan2(-ux, -uz); // vänd mot borgen
      const stall = (typ, ut, tvars, rot, max) => {
        const d = temaDef(typ), x = v.x + ux * ut + tx * tvars, z = v.z + uz * ut + tz * tvars;
        const p = modellPool(d.varianter[(r() * d.varianter.length) | 0], { max }); if (!p) return;
        const sk = lerp(d.skala[0], d.skala[1], r());
        _m4.compose(_v3.set(x, markHojd(x, z) - 0.03, z), _q.setFromAxisAngle(UPP, rot), _s3.set(sk, sk, sk));
        p.lagg(null, _m4, _c.setHex(d.farger ? d.farger[(r() * d.farger.length) | 0] : 0xffffff));
      };
      for (let rad = 0; rad < 4; rad++) for (let i = -3; i <= 3; i++) {
        if (i === 0 || r() < 0.18) continue;
        stall('gravsten', -4.5 + rad * 3.1 + (r() - 0.5) * 0.9, i * 2.4 + (r() - 0.5) * 0.8, mot + (r() - 0.5) * 0.6, 120);
      }
      stall('dodtrad', -1.5, -10, r() * TAU, 32); stall('dodtrad', 4.5, 9.5, r() * TAU, 32); stall('dodtrad', 9.5, -6.5, r() * TAU, 32); stall('dodtrad', 10.5, 5.5, r() * TAU, 32);
      const jord = new THREE.Mesh(jordGeo, jordMat); jord.position.set(v.x + ux * 2.5, 0.035, v.z + uz * 2.5); jord.scale.set(30, 1, 30); jord.renderOrder = 1; jord.receiveShadow = true; jord.userData.egen = jord.userData.egenMat = true; laggVarld(jord);
      const kg = geoAv(TYPER.krypta.modell);
      if (kg) { const m = new THREE.Mesh(kg.geo, kg.mat), kx = v.x + ux * 9.5, kz = v.z + uz * 9.5; m.position.set(kx, markHojd(kx, kz) - 0.03, kz); m.rotation.y = mot; m.scale.setScalar(TYPER.krypta.skala); m.castShadow = true; m.receiveShadow = true; m.name = 'krypta:' + namn; laggVarld(m); }
    }
    if (tema === 'vinter') byggIsvakar(r);
  }
  function byggGras() {
    const N = Math.round((mobil ? 7000 : 12000) * TM.gras), r = slump32(O.fro + 23);
    if (N <= 0) return;
    const pos = [], farg = [], nor = [];
    const cBas = new THREE.Color(0x4c8c34), cTopp = new THREE.Color(0x90c456);
    for (let b = 0; b < 6; b++) { // varje strå ritas med båda lindningarna och normalen uppåt, så att det lyses som marken
      const a = b / 6 * TAU + r(), ut = 0.12 + r() * 0.3, h = 0.3 + r() * 0.4, bx = Math.cos(a), bz = Math.sin(a), w = 0.085, c0 = 0.06 + r() * 0.1;
      const p0 = [bx * c0 - bz * w, 0, bz * c0 + bx * w], p1 = [bx * c0 + bz * w, 0, bz * c0 - bx * w], p2 = [bx * (c0 + ut), h, bz * (c0 + ut)];
      pos.push(...p0, ...p1, ...p2, ...p1, ...p0, ...p2);
      for (let k = 0; k < 2; k++) { farg.push(cBas.r, cBas.g, cBas.b, cBas.r, cBas.g, cBas.b, cTopp.r, cTopp.g, cTopp.b); nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(farg, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.computeBoundingBox();
    const p = pool('gras', () => ({ geo: g, mat: new THREE.MeshLambertMaterial({ vertexColors: true }), max: mobil ? 7000 : 12000, vaj: 9, skugga: false }));
    { // strånas färg efter ön (grönt, frostigt halmgult, förtorkat brunt)
      const ca = p.mesh.geometry.attributes.color, py = p.mesh.geometry.attributes.position, b0 = new THREE.Color(TM.grasFarg[0]), b1 = new THREE.Color(TM.grasFarg[1]);
      for (let i = 0; i < ca.count; i++) { const f = py.getY(i) > 0.01 ? b1 : b0; ca.setXYZ(i, f.r, f.g, f.b); } ca.needsUpdate = true;
    }
    const toner = TM.grasToner.map((h) => new THREE.Color(h));
    let n = 0;
    for (let i = 0; i < N * 4 && n < N; i++) {
      const a = r() * TAU, rad = Math.sqrt(r()) * O.oRadie, x = Math.cos(a) * rad, z = Math.sin(a) * rad;
      if (rad < O.gardRadie + 1.5 || kustR(a) - rad < 9.5) continue;
      if (fbm(x * 0.11 + 70, z * 0.11 - 20) < 0.25 + r() * 0.25) continue;
      if (lava.length && lavaAvst(x, z) < 3) continue;
      const s = 0.5 + r() * 0.45;
      _m4.compose(_v3.set(x, markHojd(x, z) - 0.02, z), _q.setFromAxisAngle(UPP, r() * TAU), _s3.set(s, s * (0.7 + r() * 0.7), s));
      p.lagg(null, _m4, toner[(r() * toner.length) | 0]); n++;
    }
  }

  // ─── dygnet ───
  const dygn = { ljus: new THREE.Color(1, 1, 1), morker: 0, rikt: new THREE.Vector3(0, 1, 0), dagsljus: 1 };
  const _ca = new THREE.Color(), _cb = new THREE.Color();
  const blanda = (a, b, k, ut) => ut.copy(_ca.setHex(a)).lerp(_cb.setHex(b), k);
  const ask = { k: 0 }; // askregnets styrka (Vulkanön), tonas in och ut
  function uppdateraDygn(tid) {
    let t = (FASBAS[tid && tid.fas] ?? 0) + klamp(tid && typeof tid.andel === 'number' ? tid.andel : 0, 0, 1);
    t = ((t % 4) + 4) % 4;
    let i = 0; while (i < DYGN.length - 2 && DYGN[i + 1].t <= t) i++;
    const a = DYGN[i], b = DYGN[i + 1], k = klamp((t - a.t) / (b.t - a.t), 0, 1);
    let styrka = lerp(a.styrka, b.styrka, k), hI = lerp(a.hemi, b.hemi, k);
    const man = a.man && b.man ? 1 : 0;
    const h = lerp(a.solH, b.solH, k) * Math.PI / 180, az = lerp(a.solAz, b.solAz, k) * Math.PI / 180;
    dygn.rikt.set(Math.sin(az) * Math.cos(h), Math.sin(h), -Math.cos(az) * Math.cos(h)).normalize();
    const sollikt = (a.man || b.man) ? 0 : 1;
    dygn.dagsljus = klamp((1 - Math.max(a.man * (1 - k), b.man * k)) * (sollikt ? styrka / 3 : 0), 0, 1);
    dygn.morker = 1 - mjuk(0.08, 0.85, dygn.dagsljus);
    const mk = dygn.morker, ak = ask.k;
    blanda(a.sol, b.sol, k, sol.color);
    blanda(a.hemiH, b.hemiH, k, hemi.color); blanda(a.hemiM, b.hemiM, k, hemi.groundColor);
    blanda(a.dimma, b.dimma, k, scen.fog.color); scen.fog.density = lerp(a.dimT, b.dimT, k);
    const hu = himmelMat.uniforms;
    blanda(a.topp, b.topp, k, hu.uTopp.value); blanda(a.hor, b.hor, k, hu.uHor.value);
    let exp = lerp(a.exp, b.exp, k);
    blanda(a.ton, b.ton, k, post.U.uTon.value);
    const D = TM.dygn;
    if (D) { // öns ton: kall dimma och snöljus på Frostön, rödaktig dis och glöd på Vulkanön
      const tv = (dag, natt) => _c2.setHex(dag).lerp(_ca.setHex(natt), mk);
      scen.fog.color.lerp(tv(D.dimma, D.dimmaN), D.dimmaK); scen.fog.density *= D.dimT;
      hu.uHor.value.lerp(tv(D.hor, D.horN), D.horK); hu.uTopp.value.lerp(_c2.setHex(D.topp), D.toppK * (1 - mk));
      sol.color.lerp(_c2.setHex(D.sol), D.solK); hemi.color.lerp(_c2.setHex(D.hemiH), D.hemiHK);
      hemi.groundColor.lerp(tv(D.hemiM, D.hemiMN), D.hemiMK); post.U.uTon.value.lerp(_c2.setHex(D.ton), D.tonK);
      exp *= D.exp;
    }
    if (ak > 0.001) { // askregn: mörkare, dovare, tätare dis
      scen.fog.color.lerp(_c2.setRGB(0.16, 0.14, 0.13), 0.5 * ak); scen.fog.density *= 1 + 0.7 * ak;
      styrka *= 1 - 0.3 * ak; hI *= 1 - 0.15 * ak; exp *= 1 - 0.08 * ak;
      hu.uHor.value.lerp(_c2.setRGB(0.22, 0.1, 0.07), 0.5 * ak);
    }
    sol.intensity = styrka; hemi.intensity = hI;
    U.morker.value = mk; U.molnSkugga.value = 0.24 * dygn.dagsljus;
    dygn.ljus.copy(hemi.color).multiplyScalar(hI * 0.5).add(_c.copy(sol.color).multiplyScalar(styrka * 0.2));
    dygn.niva = klamp(dygn.ljus.r * 0.3 + dygn.ljus.g * 0.6 + dygn.ljus.b * 0.1, 0.25, 1);
    hu.uSolFarg.value.copy(sol.color); hu.uStj.value = lerp(a.stj, b.stj, k) * (1 - ak);
    hu.uSolSynlig.value = sollikt; hu.uManSynlig.value = man * mjuk(0, 1, styrka) * (1 - ak);
    if (man) hu.uManRikt.value.copy(dygn.rikt); else hu.uSolRikt.value.copy(dygn.rikt);
    hu.uMolnFarg.value.copy(dygn.ljus).multiplyScalar(0.8).lerp(hu.uHor.value, 0.35);
    const vu = vattenMat.uniforms, V = TM.vatten;
    vu.uDjup.value.setHex(V.djup).multiply(dygn.ljus); vu.uGrund.value.setHex(V.grund).multiply(dygn.ljus); vu.uSkum.value.setHex(V.skum).multiply(dygn.ljus).multiplyScalar(1.05);
    vu.uIsLjus.value.setHex(0xd2e6f4).multiply(dygn.ljus).multiplyScalar(1.05); vu.uIsMork.value.setHex(0x86aecb).multiply(dygn.ljus);
    vu.uHimmel.value.copy(hu.uHor.value).lerp(hu.uTopp.value, 0.45);
    vu.uLjusRikt.value.copy(dygn.rikt); vu.uLjusFarg.value.copy(sol.color).multiplyScalar(styrka * (man ? 1.6 : 0.9));
    gravMat.uniforms.uLjus.value.copy(dygn.ljus).multiplyScalar(1.15); gravMat.uniforms.uLjusRikt.value.copy(dygn.rikt); gravMat.uniforms.uNatt.value = mk;
    if (lavaMat) { lavaMat.uniforms.uLjus.value.copy(dygn.ljus); lavaMat.uniforms.uNatt.value = mk; }
    part.mat.uniforms.uLjus.value.copy(dygn.ljus).multiplyScalar(0.72);
    flugor.mat.uniforms.uStyrka.value = mk * TM.flugor;
    eld.mat.uniforms.uStyrka.value = lerp(0.36, 1, mk); // i dagsljus ska lågan vara orange, inte vitglödgad
    // natten var för mörk i skärmkanterna: ett svagt fyllnadsljus och en mildare vinjett när det är mörkt
    fyllLjus.color.setHex(TM.fyll); fyllLjus.intensity = mk * 0.62 * (1 - 0.3 * ak);
    post.U.uVinjett.value = lerp(0.3, 0.1, mk);
    post.U.uMattnad.value = 1.12 - 0.22 * ak;
    renderer.toneMappingExposure = exp; post.U.uExp.value = exp; post.U.uBloom.value = lerp(a.bloom, b.bloom, k);
  }

  // ─── kamera ───
  const kam = { mal: new THREE.Vector3(), skak: 0, staende: true, forsta: true, sx: 0, sz: 0, fram: 2.4 };
  const _stralar = new THREE.Raycaster(), _plan = new THREE.Plane(UPP, 0), _ndc = new THREE.Vector2();
  function foljKamera(dt, sp) {
    if (sp) {
      const vx = (sp.x - kam.sx) / Math.max(dt, 1e-3), vz = (sp.z - kam.sz) / Math.max(dt, 1e-3); kam.sx = sp.x; kam.sz = sp.z;
      _v3.set(sp.x + klamp(vx, -8, 8) * 0.18, 0, sp.z + klamp(vz, -8, 8) * 0.18 - kam.fram);
      if (kam.forsta) { kam.mal.copy(_v3); kam.forsta = false; } else kam.mal.lerp(_v3, 1 - Math.exp(-4.5 * dt));
    }
    const avst = (O.kameraAvstand ?? (kam.staende ? 26 : 25)) * (O.zoom ?? 1), lut = (O.kameraLutning ?? 44) * Math.PI / 180;
    { // så långt norr om riddaren ska kameran sikta för att han ska hamna O.spelarAndel ner på skärmen (0 = överkant, 1 = underkant)
      const andel = O.spelarAndel ?? (kam.staende ? 0.575 : 0.56), h = Math.sin(lut) * avst - 1, d0 = Math.cos(lut) * avst;
      const ner = Math.atan2(h, d0), a = Math.atan((2 * andel - 1) * Math.tan(kamera.fov * Math.PI / 360));
      kam.fram = d0 - h / Math.tan(Math.min(1.5, ner + a));
    }
    kamera.position.set(kam.mal.x, Math.sin(lut) * avst, kam.mal.z + Math.cos(lut) * avst);
    kam.skak = Math.max(0, kam.skak - dt * 1.9);
    kamera.lookAt(kam.mal.x, 1, kam.mal.z);
    if (kam.skak > 0) { const s = kam.skak * kam.skak, t = U.tid.value; kamera.position.x += Math.sin(t * 71) * s * 0.55; kamera.position.y += Math.sin(t * 93 + 1.3) * s * 0.4; kamera.rotation.z += Math.sin(t * 57 + 0.7) * s * 0.012; }
    kamera.updateMatrixWorld();
  }
  const skaka = (s) => { kam.skak = Math.min(1, kam.skak + s); };
  function skarmTillMark(x, y) {
    const b = canvas.clientWidth || canvas.width, h = canvas.clientHeight || canvas.height;
    _ndc.set((x / b) * 2 - 1, -(y / h) * 2 + 1); _stralar.setFromCamera(_ndc, kamera);
    const p = _stralar.ray.intersectPlane(_plan, _v3b);
    return p ? { x: p.x, z: p.z } : null;
  }

  // ─── kvalitet och mätning ───
  let kval = klamp(O.kvalitet | 0, 0, KVALITET.length - 1), bredd = 1, hojd = 1;
  const mat = { fps: 60, bildtid: 16.7, ritanrop: 0, trianglar: 0, figurer: 0, animerade: 0, kvalitet: 0, kvalitetNamn: '', partiklar: 0 };
  const fpsM = { ack: 0, n: 0, laga: 0, vila: 4, ema: 16.7 };
  function tillampaKvalitet() {
    const q = KVALITET[kval];
    const pr = Math.min(window.devicePixelRatio || 1, O.maxPixelkvot ?? 2) * q.skala;
    renderer.setPixelRatio(pr); renderer.setSize(bredd, hojd, false);
    const db = renderer.getDrawingBufferSize(new THREE.Vector2());
    if (q.post) post.storlek(db.x, db.y); else post.fri();
    const ph = db.y; part.mat.uniforms.uSkala.value = ph / (2 * Math.tan(kamera.fov * Math.PI / 360)); flugor.mat.uniforms.uSkala.value = part.mat.uniforms.uSkala.value; nederbord.mat.uniforms.uSkala.value = part.mat.uniforms.uSkala.value;
    if (sol.castShadow !== q.skuggor) { sol.castShadow = q.skuggor; }
    renderer.shadowMap.autoUpdate = q.skuggor;
    if (!q.skuggor) renderer.shadowMap.needsUpdate = true;
    for (const fm of figurMall.values()) if (fm) fm.mall.traverse((o) => { if (o.isSkinnedMesh && o.name !== 'siluett') o.castShadow = q.figurskuggor; });
    for (const o of objekt.values()) if (o.slag === 'figur') o.f.nat.castShadow = q.figurskuggor;
    for (const l of figurLager.values()) for (const f of l) f.nat.castShadow = q.figurskuggor;
    klick.material.opacity = q.figurskuggor ? 0.3 : 0.5;
    mat.kvalitet = kval; mat.kvalitetNamn = q.namn;
  }
  function sattKvalitet(n) { kval = klamp(n | 0, 0, KVALITET.length - 1); tillampaKvalitet(); fpsM.vila = 2; fpsM.laga = 0; }
  function storlek(b, h) {
    bredd = Math.max(1, b | 0); hojd = Math.max(1, h | 0);
    kamera.aspect = bredd / hojd; kam.staende = kamera.aspect < 0.9;
    kamera.fov = O.fov ?? (kam.staende ? 52 : 38); kamera.updateProjectionMatrix();
    tillampaKvalitet();
  }
  function matFps(dt) {
    if (dt <= 0 || dt > 0.25) return; // fliken var dold
    fpsM.ema = lerp(fpsM.ema, dt * 1000, 0.05); mat.bildtid = fpsM.ema; mat.fps = 1000 / fpsM.ema;
    if (fpsM.vila > 0) { fpsM.vila -= dt; fpsM.ack = 0; fpsM.n = 0; return; }
    fpsM.ack += dt; fpsM.n++;
    if (fpsM.ack >= 1.5) {
      const fps = fpsM.n / fpsM.ack; fpsM.ack = 0; fpsM.n = 0;
      if (fps < 45) fpsM.laga++; else fpsM.laga = 0;
      if (O.autoKvalitet && fpsM.laga >= 2 && kval < KVALITET.length - 1) { kval++; tillampaKvalitet(); fpsM.laga = 0; fpsM.vila = 2; console.info('[grafik] fps', fps.toFixed(0), '→ kvalitet:', KVALITET[kval].namn); }
    }
  }

  // ─── spelets enheter → 3D-objekt ───
  const objekt = new Map();   // listnamn#id → post
  const idKarta = new Map();  // id → post (för händelser som bara har id)
  const doende = [];          // figurer som sjunker undan efter borttagning
  const resningar = new Set();// poster med pågående resning
  const varnade = new Set();
  const sedda = new WeakSet();
  let bild = 0, forsta = true, laddad = false, spelarPost = null;
  const h01 = (id, salt) => hash2((typeof id === 'number' ? id : strHash(String(id))) * 7 + salt, salt * 13 + 5);
  function strHash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0; return h; }
  const utBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  const byggd = (e) => !(e.niva === 0 || e.byggd === false);

  let platsGeo = null, platsMat = null;
  function platshallare(e) {
    if (!varnade.has(e.typ)) { varnade.add(e.typ); console.warn('[grafik] okänd typ ritas som platshållare:', e.typ); }
    if (!platsGeo) {
      platsGeo = new THREE.BoxGeometry(0.9, 1.5, 0.9); platsGeo.translate(0, 0.75, 0);
      const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d'); c.fillStyle = '#ff8a1e'; c.fillRect(0, 0, 64, 64); c.fillStyle = '#2a1600'; c.font = '800 50px system-ui,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('?', 32, 35);
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; platsMat = new THREE.MeshLambertMaterial({ map: t });
    }
    const m = new THREE.Mesh(platsGeo, platsMat); m.castShadow = true; scen.add(m);
    return { slag: 'plats', mesh: m };
  }
  function murMatris(o, s) { _m4.compose(_v3.set(o.x, o.y, o.z), _q.setFromAxisAngle(UPP, o.rot), _s3.set(o.sx * (0.75 + 0.25 * s), o.sy * Math.max(0.001, s), o.sz * (0.75 + 0.25 * s))); return _m4; }
  // En mur mellan (ax, az) och (bx, bz) läggs som flera instanser om cirka def.langd meter. fran/till i meter längs muren från mitten.
  function murDelar(o, e, def, p, nyckel, res, fran, till) {
    const langd = typeof e.ax === 'number' ? Math.hypot(e.bx - e.ax, e.bz - e.az) : (e.langd ?? def.langd);
    if (fran === undefined) { fran = -langd / 2; till = langd / 2; }
    const stracka = till - fran, n = Math.max(1, Math.round(stracka / def.langd)), dl = stracka / n, rot = (e.rot || 0) + (def.rotJust || 0), tx = Math.cos(rot), tz = -Math.sin(rot), pal = def.sort === 'palissad';
    for (let i = 0; i < n; i++) {
      const off = fran + (i + 0.5) * dl, x = e.x + tx * off, z = e.z + tz * off;
      const d = { pool: p, nyckel, x, y: markHojd(x, z), z, rot, sx: pal ? dl / 4 : dl / 2, syBas: pal ? def.hojd : def.hojd / 1.1, sz: pal ? 1 : def.tjocklek / 0.8, res, skak: 0 };
      d.sy = d.syBas; d.idx = p.lagg(d, murMatris(d, res));
      if (res < 1) resningar.add(d);
      o.delar.push(d);
    }
  }
  function slappDelar(o) { if (o.delar) { for (const d of o.delar) { resningar.delete(d); if (d.idx >= 0) { d.pool.tabort(d.idx); d.idx = -1; } } o.delar.length = 0; } }
  function laggEld(o, x, y, z, styrka) { const el = { x, y, z, styrka, fas: Math.random() * 10, agare: o, gnista: Math.random() }; eldar.push(el); (o.eldar || (o.eldar = [])).push(el); }

  function skapa(e, nyckel) {
    const def = temaDef(e.typ);
    let o;
    if (!def) o = platshallare(e);
    else if (def.slag === 'figur') {
      const f = nyFigur(e.typ, def);
      if (!f) o = platshallare(e);
      else {
        f.hallare.position.set(e.x, markHojd(e.x, e.z), e.z); f.hallare.rotation.y = e.rot || 0;
        scen.add(f.hallare);
        f.nat.castShadow = KVALITET[kval].figurskuggor;
        o = { slag: 'figur', f, rot: e.rot || 0, in: forsta ? 1 : 0, lage: '', skala: def.skala * (e.skala || 1), fasn: (Math.random() * 3) | 0, ack: 0 };
        if (!forsta && def.lag === 'fiende' && !def.svav) fx.jordpuff(e.x, e.z);
        if (def.tillbehor) { // lådor och tunnor bredvid handelsmannen
          o.tillb = []; const r0 = e.rot || 0, c = Math.cos(r0), sn = Math.sin(r0);
          for (const t of def.tillbehor) { const p = modellPool(t.modell, { max: 64 }); if (!p) continue; const a = { pool: p, idx: -1 }, x = e.x + t.pos[0] * c + t.pos[2] * sn, z = e.z - t.pos[0] * sn + t.pos[2] * c;
            _m4.compose(_v3.set(x, markHojd(x, z), z), _q.setFromAxisAngle(UPP, r0 + (t.rot || 0)), _s3.setScalar(t.skala)); a.idx = p.lagg(a, _m4); o.tillb.push(a); }
        }
      }
    } else if (def.slag === 'bygge') o = { slag: 'bygge', mesh: null, niva: -1, res: 1 };
    else if (def.slag === 'maskin' || def.slag === 'grav') { const grp = new THREE.Group(); scen.add(grp); o = { slag: def.slag, grp, niva: -1, res: 1, ras: false }; }
    else if (def.slag === 'bat') { const grp = batModell(e.slag === 'resa' ? 'resa' : 'handel').clone(); scen.add(grp); o = { slag: 'bat', grp, fas: Math.random() * 6 }; }
    else if (def.slag === 'svav') {
      const p = modellPool(def.modell, { max: 160, glodMat: true, tarSkugga: false });
      o = { slag: 'svav', pool: p, rot: e.rot || 0, fas: Math.random() * 6, in: forsta ? 1 : 0, dodK: 0, skala: def.skala };
      if (p) { _m4.makeScale(0, 0, 0); o.idx = p.lagg(o, _m4); }
      laggEld(o, e.x, def.hojd, e.z, 0.7); o.el = o.eldar[0];
    }
    else if (def.slag === 'mur') {
      const p = def.sort === 'palissad' ? pool('palissad', () => ({ geo: palissadGeo(), mat: vfMat, max: 400 })) : modellPool(def.modell, { max: 400 });
      if (!p) o = platshallare(e);
      else { o = { slag: 'mur', pool: p, delar: [], hpSedd: -1, raserad: false }; murDelar(o, e, def, p, nyckel, forsta ? 1 : 0); }
    } else if (def.slag === 'instans') {
      const slut = naturSlut(e), stubbe = def.stubbe && slut;
      const vn = stubbe ? def.stubbe : def.varianter[(h01(e.id, 1) * def.varianter.length) | 0];
      const p = modellPool(vn, { max: 900, vaj: def.vaj && !stubbe ? def.vaj : 0, dov: !!def.dov });
      if (!p) o = platshallare(e);
      else {
        const s = lerp(def.skala[0], def.skala[1], h01(e.id, 2)) * (e.skala || 1) * (slut && !stubbe && def.slutSkala ? def.slutSkala : 1);
        o = { slag: 'instans', pool: p, x: e.x, y: markHojd(e.x, e.z) - (def.vaj ? 0.1 : 0.05), z: e.z, rot: e.rot ?? h01(e.id, 3) * TAU, sx: s, sy: s * (0.9 + h01(e.id, 4) * 0.25), sz: s, res: forsta || slut ? 1 : 0, slut, hpSedd: e.hp };
        const fl = def.farger; _c.setHex(fl ? fl[(h01(e.id, 5) * fl.length) | 0] : 0xffffff);
        o.idx = p.lagg(o, murMatris(o, o.res), _c);
        if (o.res < 1) resningar.add(o);
      }
    } else if (def.slag === 'eld') {
      const p = def.sort === 'fyrfat' ? pool('fyrfat', () => ({ geo: fyrfatGeo(), mat: new THREE.MeshLambertMaterial({ vertexColors: true }), max: 128 }))
        : def.sort === 'varmeeld' ? pool('varmeeld', () => ({ geo: varmeeldGeo(), mat: new THREE.MeshLambertMaterial({ vertexColors: true }), max: 32 })) : modellPool(def.modell, { max: 128 });
      const s = (def.skala || 1) * (def.sort === 'varmeeld' ? 1 + 0.3 * ((e.niva || 1) - 1) : 1);
      o = { slag: 'eld', pool: p, nyckel, x: e.x, y: markHojd(e.x, e.z) + (def.sort === 'fackla' ? 0.55 : 0), z: e.z, rot: e.rot || 0, sx: s, sy: s, sz: s, res: forsta ? 1 : 0, tand: null, niva: e.niva || 1 };
      if (p) { o.idx = p.lagg(o, murMatris(o, o.res)); if (o.res < 1) resningar.add(o); }
    } else if (def.slag === 'ruta') {
      const grp = new THREE.Group();
      const dekal = new THREE.Mesh(rutGeo, new THREE.MeshBasicMaterial({ map: rutRam(), transparent: true, depthWrite: false, color: 0xffd866 })); dekal.renderOrder = 4; dekal.position.y = 0.06;
      const cv = document.createElement('canvas'); cv.width = 256; cv.height = 176;
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
      const skylt = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, fog: false })); skylt.center.set(0.5, 0); skylt.renderOrder = 55;
      grp.add(dekal, skylt); scen.add(grp);
      o = { slag: 'ruta', grp, dekal, skylt, ctx: cv.getContext('2d'), tex, sign: '', rader: [], andel: 0, fas: Math.random() * 6, storlek: e.storlek || (e.radie ? e.radie * 2 : def.storlek) };
    } else if (def.slag === 'projektil') {
      const sort = e.slag ?? e.sort ?? 'pil';
      const y0 = e.y ?? (sort === 'pil' ? (tornTopp(e.x, e.z) ?? 1.45) : sort === 'spjut' ? 1.75 : sort === 'sten' ? 2.4 : 1.9);
      o = { slag: 'projektil', magi: sort === 'magi' || sort === 'eld' || sort === 'is', sort, fx: e.x, fz: e.z, fy: y0, x0: e.x, z0: e.z, y0, rikt: new THREE.Vector3(0, 0, 1), t: 0, skala: def.skala };
      if (sort === 'pil' || sort === 'spjut') { o.pool = modellPool(def.modell, { max: 200, tarSkugga: false }); if (sort === 'spjut') o.skala = def.skala * 2.1; }
      else if (sort === 'sten') { o.pool = modellPool('sten_e', { max: 900, dov: true }); o.skala = 2.4; }
      else if (sort === 'is') { o.pool = pool('isskarva', () => ({ geo: isskarvaGeo(), mat: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 2.4, 3.2) }), max: 120, skugga: false, tarSkugga: false })); o.skala = 1; }
      if (o.pool) { _m4.makeScale(0, 0, 0); o.idx = o.pool.lagg(o, _m4); }
    } else if (def.slag === 'resurs') {
      const sort = (def.sorter[e.slag] ? e.slag : null) ?? e.sort ?? e.resurs ?? 'tra', sd = def.sorter[sort] || def.sorter.tra;
      o = { slag: 'resurs', sort, pool: modellPool(sd[0], { max: 400 }), s: sd[1], fas: Math.random() * 6, in: forsta ? 1 : 0 };
      if (o.pool) { _m4.makeScale(0, 0, 0); o.idx = o.pool.lagg(o, _m4); }
    } else o = platshallare(e);
    o.typ = e.typ; o.def = def || {}; o.nyckel = nyckel; o.x = e.x; o.z = e.z;
    objekt.set(nyckel, o);
    return o;
  }

  function tabort(o, tyst) {
    objekt.delete(o.nyckel);
    resningar.delete(o);
    if (o.eldar) { for (const el of o.eldar) { const i = eldar.indexOf(el); if (i >= 0) eldar.splice(i, 1); } o.eldar = null; }
    if (o.tillb) { for (const a of o.tillb) if (a.idx >= 0) { a.pool.tabort(a.idx); a.idx = -1; } o.tillb = null; }
    if (o.utrop) { scen.remove(o.utrop); o.utrop.material.dispose(); o.utrop = null; }
    if (o.slag === 'figur') { if (tyst) slappFigur(o.typ, o.f); else doende.push({ o, t: 0, tid: o.dod ? (o.def.svav ? 1.6 : 1.1) : 0.25 }); }
    else if (o.slag === 'bygge') { if (o.mesh) scen.remove(o.mesh); if (o.ruin) scen.remove(o.ruin); slappDelar(o); }
    else if (o.slag === 'maskin' || o.slag === 'grav' || o.slag === 'bat') scen.remove(o.grp);
    else if (o.slag === 'mur') slappDelar(o);
    else if (o.slag === 'ruta') { scen.remove(o.grp); o.tex.dispose(); o.dekal.material.dispose(); o.skylt.material.dispose(); }
    else if (o.slag === 'plats') scen.remove(o.mesh);
    else if (o.pool && o.idx >= 0) { o.pool.tabort(o.idx); o.idx = -1; }
  }

  // Tronsalen är så hög att den skymmer borggården norr om sig (kameran tittar norrut). När riddaren står där bakom
  // tonas den ner till en genomskinlig skugga, så att rutor, soldater och porten syns. Eget material, övriga byggen rörs inte.
  function genomlys(o, e, dt) {
    const m = o.mesh, sp = spelarPost;
    let mal = 1;
    if (sp && !o.ras) {
      const bb = m.geometry.boundingBox, hojd = (bb ? bb.max.y : 4) * m.scale.y, halv = (bb ? Math.max(bb.max.x, -bb.min.x) : 1.2) * m.scale.x;
      const dz = e.z - sp.z, dx = Math.abs(sp.x - e.x), djup = hojd * 0.95;      // så långt norrut skymmer en höjd vid 44° lutning
      if (dz > 0.5 && dz < djup) { const bredd = halv * (1.05 - 0.55 * dz / djup) + 0.9; mal = 0.3 + 0.7 * mjuk(bredd, bredd + 1.2, dx); }
    }
    o.genom = o.genom === undefined ? mal : lerp(o.genom, mal, 1 - Math.exp(-9 * dt));
    if (Math.abs(o.genom - mal) < 0.005) o.genom = mal;
    if (o.genom >= 0.999) { if (o.genomMat && m.material === o.genomMat) m.material = o.helMat; return; }
    if (!o.genomMat) { o.helMat = m.material; o.genomMat = m.material.clone(); o.genomMat.transparent = true; }
    if (m.material !== o.genomMat) m.material = o.genomMat;
    o.genomMat.opacity = o.genom;
  }

  function bytByggmodell(o, e, niva) {
    const def = o.def;
    if (o.mesh) { scen.remove(o.mesh); o.mesh = null; }
    const nyckel = def.nivaer ? def.nivaer[klamp(niva, 1, def.nivaer.length) - 1] : def.modell, g = geoAv(nyckel);
    if (!g) { if (!varnade.has(nyckel)) { varnade.add(nyckel); console.warn('[grafik] modell saknas:', nyckel); } return; }
    const m = new THREE.Mesh(g.geo, g.mat); m.castShadow = true; m.receiveShadow = true;
    const s = def.skala, extra = def.port ? 1 : def.nivaer ? 1 + 0.05 * Math.max(0, niva - def.nivaer.length) : 1 + 0.07 * (niva - 1);
    o.bas = Array.isArray(s) ? [s[0] * extra, s[1] * extra, s[2] * extra] : [s * extra, s * extra, s * extra];
    slappDelar(o);
    if (def.port && typeof e.ax === 'number') { // porten i mitten, stenmur på båda sidor fram till ändpunkterna
      const langd = Math.hypot(e.bx - e.ax, e.bz - e.az), pb = Math.min(langd, def.portBredd || 4.6), flank = (langd - pb) / 2, sp = modellPool(TYPER.stenmur.modell, { max: 400 });
      o.bas[0] = pb / 2; o.delar = o.delar || [];
      if (flank > 0.5 && sp) { const fl = Object.assign({}, TYPER.stenmur, { langd: Math.max(TYPER.stenmur.langd, flank) }); murDelar(o, e, fl, sp, o.nyckel, forsta ? 1 : 0, -langd / 2, -pb / 2); murDelar(o, e, fl, sp, o.nyckel, forsta ? 1 : 0, pb / 2, langd / 2); }
    }
    o.ras = false;
    m.position.set(e.x, markHojd(e.x, e.z), e.z); m.rotation.y = (e.rot || 0) + (def.rotJust || 0); m.scale.set(...o.bas);
    scen.add(m); o.mesh = m;
    if (o.eldar) { for (const el of o.eldar) { const i = eldar.indexOf(el); if (i >= 0) eldar.splice(i, 1); } o.eldar = null; }
    for (const [lx, ly, lz] of (def.eldar || [])) { const c = Math.cos(m.rotation.y), sn = Math.sin(m.rotation.y); laggEld(o, e.x + lx * c + lz * sn, ly, e.z - lx * sn + lz * c, 0.55); }
  }

  function prisrader(e) {
    const rader = []; let tot = 0, bet = 0;
    const pris = e.pris ?? e.kostnad ?? 0, betalt = e.betalt ?? 0;
    if (typeof pris === 'object') { for (const k of Object.keys(pris)) { if (!pris[k]) continue; const b = typeof betalt === 'object' ? (betalt[k] || 0) : 0; rader.push([k, pris[k] - b]); tot += pris[k]; bet += b; } }
    else { rader.push([e.resurs ?? e.valuta ?? 'tra', e.kvar ?? (pris - betalt)]); tot = pris; bet = typeof betalt === 'number' ? betalt : 0; }
    return { rader: rader.slice(0, 2), andel: tot > 0 ? klamp(bet / tot, 0, 1) : 0 };
  }

  const lastPooler = {};
  function ritaLast(e, o) { // synligt buren last bakom ryggen
    let n = 0, sort = (e.slag === 'sten' || e.slag === 'tra') ? e.slag : 'tra'; const b = e.bar ?? e.last;
    if (typeof b === 'number') n = b; else if (b && typeof b === 'object') { let mx = 0; for (const k of Object.keys(b)) { n += b[k] || 0; if ((b[k] || 0) > mx) { mx = b[k]; sort = k; } } } else if (e.anim === 'bar') n = 3;
    if (n <= 0) return;
    sort = e.barSort ?? e.lastSort ?? sort;
    const sd = TYPER.resurs.sorter[sort] || TYPER.resurs.sorter.tra;
    let lp = lastPooler[sort];
    if (lp === undefined) { const g = geoAv(sd[0]); if (g) { lp = new THREE.InstancedMesh(g.geo, g.mat, 96); lp.frustumCulled = false; lp.castShadow = false; lp.renderOrder = 3; /* efter riddarens silhuett, annars ritas silhuetten över lasten på ryggen */ lp.instanceMatrix.setUsage(THREE.DynamicDrawUsage); lp.count = 0; scen.add(lp); } else lp = null; lastPooler[sort] = lp; }
    if (!lp) return;
    const rot = o.rot, sn = Math.sin(rot), cs = Math.cos(rot), sk = o.skala, antal = Math.min(6, Math.ceil(n));
    for (let i = 0; i < antal && lp.count < 96; i++) {
      _m4.compose(_v3.set(e.x - sn * 0.42 * sk, o.f.hallare.position.y + (1.05 + i * 0.2) * sk, e.z - cs * 0.42 * sk), _q.setFromAxisAngle(UPP, rot + Math.PI / 2 + (i % 2) * 0.25), _s3.setScalar(sd[1] * 0.62 * sk));
      lp.setMatrixAt(lp.count++, _m4);
    }
  }

  function uppdatera(o, e, dt) {
    o.x = e.x; o.z = e.z;
    const def = o.def;
    switch (o.slag) {
      case 'figur': {
        const f = o.f, hl = f.hallare, mark = markHojd(e.x, e.z);
        let gy = mark;
        if (def.svav) { // draken svävar 3 till 5 m upp och dalar när den dör
          const dor = e.dod > 0 || e.anim === 'do', mal = dor ? 0 : def.svav + Math.sin(U.tid.value * 1.1 + o.fasn) * 0.35;
          o.svav = o.svav === undefined ? mal : lerp(o.svav, mal, 1 - Math.exp(-(dor ? 2.4 : 3) * dt)); gy += o.svav;
        }
        hl.position.set(e.x, gy, e.z);
        if (typeof e.rot === 'number') { o.rot = vinkelMot(o.rot, e.rot, 1 - Math.exp(-14 * dt)); hl.rotation.y = o.rot; }
        if (o.in < 1) o.in = Math.min(1, o.in + dt * 3.5);
        hl.scale.setScalar(o.skala * (0.3 + 0.7 * utBack(o.in)));
        const lage = e.dod > 0 ? 'do' : (e.anim || 'idle');
        if (lage !== o.lage) { bytAnim(f, lage, o.lage === ''); o.lage = lage; o.dod = lage === 'do'; }
        figurer.push(o);
        if (klickN < SMAX && !o.dod) { const r = def.svav ? 5.5 - (o.svav || 0) * 0.5 : o.skala * (def.tung ? 1.9 : def.kod ? 1.3 : 1.5); _m4.makeScale(r, 1, r); _m4.setPosition(e.x, mark + 0.04, e.z); klick.setMatrixAt(klickN++, _m4); }
        if (def.svav && dygn.morker > 0.1 && !o.dod) { markljus.lagg(e.x, 0.08, e.z, 5, 0.5 * dygn.morker, 0.16 * dygn.morker, 0.03 * dygn.morker); }
        if (e.vantar) { // hjälten väntar på att rekryteras: utropstecken och ett gyllene sken
          if (!o.utrop) o.utrop = nyttUtrop();
          const t = U.tid.value, pu = 0.7 + 0.3 * Math.sin(t * 4);
          o.utrop.visible = true; o.utrop.position.set(e.x, hl.position.y + def.hpHojd + 0.35 + Math.abs(Math.sin(t * 3)) * 0.18, e.z); o.utrop.scale.set(0.5, 0.75, 1);
          markljus.lagg(e.x, 0.07, e.z, 2.4, 0.5 * pu, 0.38 * pu, 0.08 * pu);
          if (Math.random() < dt * 5) part.ny(e.x + (R() - 0.5) * 1.2, 0.2, e.z + (R() - 0.5) * 1.2, 0, 1 + R(), 0, 4, 3, 0.8, 0.9, 0.08, 0.9, 1, -0.3, 0.5);
        } else if (o.utrop) o.utrop.visible = false;
        if (def.lakljus && !e.vantar && !(e.dod > 0)) { // helarens gröna läkeljus
          const pu = 0.75 + 0.25 * Math.sin(U.tid.value * 2.5 + o.fasn), mk = 0.25 + 0.75 * dygn.morker;
          markljus.lagg(e.x, 0.07, e.z, 3.4, 0.05 * pu * mk, 0.4 * pu * mk, 0.14 * pu * mk);
          if (Math.random() < dt * 4) part.ny(e.x + (R() - 0.5) * 1.4, 0.3 + R() * 0.8, e.z + (R() - 0.5) * 1.4, 0, 0.8 + R() * 0.6, 0, 0.8, 4, 1.4, 0.9, 0.09, 1.0, 1, -0.2, 0.6);
        }
        if (e.maxHp > 0 && e.hp > 0 && (e.hp < e.maxHp || def.boss)) hp.lagg(e.x, hl.position.y + def.hpHojd, e.z, e.hp / e.maxHp, def.boss ? 4 : def.tung ? 2 : 1.25, def.boss ? 2 : def.lag === 'fiende' ? 1 : 0, 1);
        if (e.bar !== undefined || e.last !== undefined || lage === 'bar') ritaLast(e, o);
        if (def.boss && dygn.morker > 0.2) { const gf = e.typ === 'frostboss' ? [0.03, 0.1, 0.26] : e.typ === 'eldboss' || e.typ === 'drake' ? [0.55, 0.18, 0.02] : [0.5, 0.05, 0.12]; glod.lagg(e.x, hl.position.y + (def.svav ? 1.6 : 2.6), e.z, 5, gf[0] * dygn.morker, gf[1] * dygn.morker, gf[2] * dygn.morker); }
        if (def.sprickor && dygn.morker > 0.2) markljus.lagg(e.x, 0.07, e.z, 3.2, 0.4 * dygn.morker, 0.1 * dygn.morker, 0.02 * dygn.morker);
        if (!(e.varnar > 0)) o.varnMax = 0;
        if (e.varnar > 0 && typeof e.vx === 'number') { o.varnMax = Math.max(o.varnMax || 0, e.varnar); varnRing.visa(e.vx, e.vz, e.vRadie || 3, 1 - e.varnar / o.varnMax);
          const pu = 0.6 + 0.4 * Math.sin(U.tid.value * 14), vr = (e.vRadie || 3); markljus.lagg(e.vx, 0.09, e.vz, vr * 1.25, 1.5 * pu, 0.12 * pu, 0.08 * pu); markljus.lagg(e.vx, 0.1, e.vz, vr * 0.6, 0.9 * pu, 0.3 * pu, 0.1 * pu); }
        if (e.typ === 'riddare') { spelarMarke.visible = true; spelarMarke.position.set(e.x, hl.position.y + def.hpHojd + 0.75 + Math.sin(U.tid.value * 3) * 0.08, e.z); if (!spelarPost) spelarPost = e; if (dygn.morker > 0.05) markljus.lagg(e.x, 0.07, e.z, 4.5, 0.16 * dygn.morker, 0.22 * dygn.morker, 0.34 * dygn.morker); }
        break;
      }
      case 'bygge': {
        const niva = e.niva ?? 1;
        if (niva !== o.niva) { const fore = o.niva; o.niva = niva; bytByggmodell(o, e, niva); if (!forsta || fore > 0) { o.res = 0; if (fore > 0) fx.byggdamm(e.x, e.z, def.radie || 2); } }
        if (o.mesh) {
          const ras = !!e.raserad;
          if (ras !== o.ras) { // raserat: en riktig ruin i stället för en platt byggnad
            o.ras = ras; o.mesh.visible = !ras;
            if (ras && !o.ruin) { o.ruin = byggRuin(def, e, Math.min(o.bas[0] * 2, def.portBredd || 4.6)); o.ruin.position.copy(o.mesh.position); o.ruin.rotation.y = o.mesh.rotation.y; scen.add(o.ruin); }
            if (o.ruin) o.ruin.visible = ras;
            if (o.delar) for (const d of o.delar) { d.sy = d.syBas * (ras ? 0.35 : 1); d.res = Math.min(d.res, 0.999); resningar.add(d); }
          }
          if (o.res < 1) { o.res = Math.min(1, o.res + dt / 0.85); const s = utBack(o.res); o.mesh.scale.set(o.bas[0] * (0.7 + 0.3 * s), o.bas[1] * Math.max(0.001, s), o.bas[2] * (0.7 + 0.3 * s)); }
          if (e.maxHp > 0 && e.hp > 0 && e.hp < e.maxHp) hp.lagg(e.x, def.hpHojd || 4, e.z, e.hp / e.maxHp, def.radie ? def.radie * 1.1 : 2.4, 0, 1);
          if (def === TYPER.tronsal) genomlys(o, e, dt);
        }
        break;
      }
      case 'mur': {
        const ras = !!e.raserad;
        if (ras !== o.raserad) { o.raserad = ras; o.hpSedd = -1; for (const d of o.delar) { d.sy = d.syBas * (ras ? 0.22 : 1); d.res = Math.min(d.res, 0.999); resningar.add(d); } }
        if (e.hp !== o.hpSedd && e.maxHp > 0) {
          const traff = o.hpSedd >= 0 && e.hp < o.hpSedd; o.hpSedd = e.hp;
          const sk = ras ? 1 : 1 - klamp(e.hp / e.maxHp, 0, 1); _c2.setRGB(1 - sk * 0.5, 1 - sk * 0.58, 1 - sk * 0.6);
          for (const d of o.delar) { if (traff) { d.skak = 0.25; resningar.add(d); } if (d.idx >= 0) d.pool.farg(d.idx, _c2); }
        }
        if (!ras && e.maxHp > 0 && e.hp > 0 && e.hp < e.maxHp) hp.lagg(e.x, def.hpHojd || 3.4, e.z, e.hp / e.maxHp, 1.8, 0, 1);
        break;
      }
      case 'instans': {
        { const st = naturSlut(e); if (st !== o.slut) { const ny = o.nyckel; tabort(o, true); const o2 = skapa(e, ny); o2.sedd = bild; return; } }
        if (typeof e.hp === 'number' && e.hp !== o.hpSedd) { if (e.hp < o.hpSedd) o.pool.skaka(o.idx); o.hpSedd = e.hp; }
        break;
      }
      case 'eld': {
        const tand = e.tand !== false, niva = e.niva || 1;
        if (niva !== o.niva && o.pool && o.idx >= 0) { o.niva = niva; const s = (def.skala || 1) * (1 + 0.3 * (niva - 1)); o.sx = o.sy = o.sz = s; o.res = 0; resningar.add(o); o.tand = null; }
        if (tand !== o.tand) {
          o.tand = tand; if (o.eldar) { for (const el of o.eldar) { const i = eldar.indexOf(el); if (i >= 0) eldar.splice(i, 1); } o.eldar = null; }
          if (tand) { const sk = o.sx / (def.skala || 1), fl = def.flammor || [[0, 0, 0, 1]]; for (const [fx0, fy0, fz0, st] of fl) laggEld(o, e.x + fx0 * sk, o.y + def.eldHojd * sk + fy0 - (def.sort === 'fackla' ? 0.55 : 0), e.z + fz0 * sk, (def.styrka || 1) * st * sk); }
        }
        break;
      }
      case 'svav': { // eldanden: en brinnande dödskalle som guppar fram
        if (o.in < 1) o.in = Math.min(1, o.in + dt * 3);
        const t = U.tid.value, dor = e.dod > 0 || e.anim === 'do';
        if (dor) o.dodK = Math.min(1, o.dodK + dt * 4);
        if (typeof e.rot === 'number') o.rot = vinkelMot(o.rot, e.rot, 1 - Math.exp(-8 * dt));
        const mark = markHojd(e.x, e.z), y = mark + def.hojd + Math.sin(t * 3.2 + o.fas) * 0.18, s = def.skala * utBack(o.in) * (1 - o.dodK);
        if (o.pool && o.idx >= 0) {
          _q.setFromEuler(_e.set(Math.sin(t * 2.1 + o.fas) * 0.18, o.rot + Math.sin(t * 1.3 + o.fas) * 0.25, Math.sin(t * 1.7 + o.fas) * 0.14, 'YXZ'));
          _m4.compose(_v3.set(e.x, y - 0.45 * s, e.z), _q, _s3.setScalar(Math.max(0.001, s))); o.pool.satt(o.idx, _m4);
        }
        if (o.el) { o.el.x = e.x; o.el.y = y + 0.22 * s; o.el.z = e.z; o.el.styrka = 0.42 * Math.max(0.05, 1 - o.dodK); }
        glod.lagg(e.x, y, e.z, 2.0, 0.22 * (1 - o.dodK), 0.07 * (1 - o.dodK), 0.01);
        if (Math.random() < 0.5) part.ny(e.x + (R() - 0.5) * 0.4, y + 0.3, e.z + (R() - 0.5) * 0.4, (R() - 0.5) * 0.5, 0.8 + R(), (R() - 0.5) * 0.5, 5, 2, 0.4, 1, 0.06, 0.5, 1, -0.5, 0.6);
        if (klickN < SMAX && !dor) { _m4.makeScale(1.1, 1, 1.1); _m4.setPosition(e.x, mark + 0.04, e.z); klick.setMatrixAt(klickN++, _m4); }
        if (e.maxHp > 0 && e.hp > 0 && e.hp < e.maxHp) hp.lagg(e.x, mark + def.hpHojd, e.z, e.hp / e.maxHp, 1.25, 1, 1);
        break;
      }
      case 'maskin': { // katapult och ballista
        const niva = e.niva ?? 1;
        if (niva !== o.niva) { const fore = o.niva; o.niva = niva; byggMaskinDelar(o, e, niva); if (!forsta || fore > 0) { o.res = 0; if (fore > 0) fx.byggdamm(e.x, e.z, def.radie || 1.5); } }
        const bas = (e.rot || 0) + Math.PI;
        if (o.yaw === undefined) { o.yaw = bas; o.malYaw = bas; o.skottT = 9; }
        o.grp.position.set(e.x, markHojd(e.x, e.z), e.z);
        const ras = !!e.raserad;
        if (ras !== o.ras) { o.ras = ras; if (ras && !o.ruin) { o.ruin = byggRuin({ radie: (def.radie || 1.2) * 0.8 }, e); o.grp.add(o.ruin); } if (o.ruin) o.ruin.visible = ras; if (o.inre) o.inre.visible = !ras; }
        if (o.res < 1) { o.res = Math.min(1, o.res + dt / 0.85); const s = utBack(o.res); o.grp.scale.set(0.7 + 0.3 * s, Math.max(0.001, s), 0.7 + 0.3 * s); } else o.grp.scale.set(1, 1, 1);
        o.yaw = vinkelMot(o.yaw, o.malYaw, 1 - Math.exp(-4 * dt)); o.skottT += dt;
        if (def.sort === 'katapult') {
          if (o.inre) o.inre.rotation.y = o.yaw;
          const t = o.skottT; let v = -0.32;
          if (t < 0.16) v = lerp(-0.32, 1.6, mjuk(0, 0.16, t)); else if (t < 0.55) v = 1.6; else if (t < 2.3) v = lerp(1.6, -0.32, mjuk(0.55, 2.3, t));
          if (o.arm) o.arm.rotation.x = v; if (o.stenM) o.stenM.visible = t > 2.2 || t < 0.1;
        } else {
          if (o.inre) o.inre.rotation.y = bas; if (o.huvud) { o.huvud.rotation.y = o.yaw - bas; const t = o.skottT, laddad = t > 1.6 || t < 0.02; o.spand.visible = o.bult.visible = laddad; o.slapp.visible = !laddad; o.huvud.position.z = t < 0.25 ? -Math.sin(t / 0.25 * Math.PI) * 0.12 : 0; }
        }
        if (!ras && e.maxHp > 0 && e.hp > 0 && e.hp < e.maxHp) hp.lagg(e.x, def.hpHojd || 3, e.z, e.hp / e.maxHp, 2.2, 0, 1);
        break;
      }
      case 'grav': { // vallgrav: vatten, is eller lava efter ön
        const niva = e.niva ?? 1;
        if (niva !== o.niva) { const fore = o.niva; o.niva = niva; byggGravDelar(o, niva); if (!forsta || fore > 0) o.res = 0; }
        o.grp.position.set(e.x, markHojd(e.x, e.z), e.z);
        if (o.res < 1) { o.res = Math.min(1, o.res + dt / 0.85); const s = utBack(o.res); o.grp.scale.set(0.6 + 0.4 * s, Math.max(0.001, s), 0.6 + 0.4 * s); }
        if (tema === 'vulkan') { const ms = 0.06 + 0.32 * dygn.morker; markljus.lagg(e.x, 0.08, e.z, 6.5, 1.0 * ms, 0.35 * ms, 0.06 * ms); }
        break;
      }
      case 'bat': { // båten guppar i vattnet vid bryggans ände (flyttas ut om kusten ligger längre ut)
        if (o.wx === undefined || o.ex !== e.x || o.ez !== e.z) {
          o.ex = e.x; o.ez = e.z; const r0 = Math.hypot(e.x, e.z) || 1, ux = e.x / r0, uz = e.z / r0; let r = r0;
          while (r < r0 + 30 && markHojd(ux * r, uz * r) > VATTEN_Y - 1.1) r += 0.5;
          o.wx = ux * (r + 1.5); o.wz = uz * (r + 1.5);
        }
        const t = U.tid.value, frusen = isNiva > 0.5;
        o.grp.position.set(o.wx, VATTEN_Y - 0.38 + (frusen ? 0 : Math.sin(t * 1.3 + o.fas) * 0.08), o.wz);
        o.grp.rotation.set(frusen ? 0 : Math.sin(t * 1.1 + o.fas) * 0.03, e.rot || 0, frusen ? 0.02 : Math.sin(t * 0.9 + o.fas + 1) * 0.045, 'YXZ');
        o.x = o.wx; o.z = o.wz;
        break;
      }
      case 'ruta': {
        const pr = prisrader(e), synlig = !(e.dold || e.aktiv === false);
        o.grp.visible = synlig;
        if (!synlig) break;
        const sign = (e.ikon || e.vad || e.byggTyp || e.bygge || '') + '|' + pr.rader.map((r) => r[0] + Math.ceil(r[1])).join(',') + '|' + Math.round(pr.andel * 40);
        if (sign !== o.sign) { o.sign = sign; o.rader = pr.rader; o.andel = pr.andel; ritaSkylt(o, e); }
        const nara = spelarPost ? Math.hypot(spelarPost.x - e.x, spelarPost.z - e.z) < o.storlek * 0.75 : false;
        const t = U.tid.value, puls = 1 + Math.sin(t * (nara ? 9 : 2.6) + o.fas) * (nara ? 0.05 : 0.03);
        o.grp.position.set(e.x, markHojd(e.x, e.z), e.z);
        o.dekal.scale.setScalar(o.storlek * puls); o.dekal.rotation.y = e.rot || 0;
        o.dekal.material.color.setHex(nara ? 0xfff2b0 : 0xffd866).multiplyScalar(0.35 + 0.65 * dygn.niva); o.skylt.material.color.setScalar(0.6 + 0.4 * dygn.niva);
        const ss = (kam.staende ? 2.5 : 2.2) * (nara ? 1.12 : 1);
        o.skylt.scale.set(ss, ss * 176 / 256, 1); o.skylt.position.y = 2.7 + Math.sin(t * 2 + o.fas) * 0.12;
        break;
      }
      case 'projektil': {
        o.t += dt;
        let y = e.y ?? def.hojd;
        if (e.y === undefined) {
          if (o.sort === 'sten' && typeof e.tx === 'number') { // katapultsten: hög båge mot punkten
            const kvar = Math.hypot(e.tx - e.x, e.tz - e.z), gatt = Math.hypot(e.x - o.x0, e.z - o.z0), tot = gatt + kvar, k = gatt / Math.max(0.01, tot);
            y = lerp(o.y0, 0.4, k) + Math.sin(k * Math.PI) * Math.max(2.5, tot * 0.36);
          } else { // båge från avfyrningshöjden mot målets bröst
            const m = e.malId !== undefined ? idKarta.get(e.malId) : null;
            if (m) { const kvar = Math.hypot(m.x - e.x, m.z - e.z), gatt = Math.hypot(e.x - o.x0, e.z - o.z0), k = gatt / Math.max(0.01, gatt + kvar); const my = m.slag === 'figur' ? 1.2 * (m.skala || 0.66) / 0.66 + (m.svav || 0) : m.slag === 'svav' ? 1.2 : 1.6; y = lerp(o.y0, my, k) + Math.sin(k * Math.PI) * Math.min(o.sort === 'spjut' ? 0.5 : 1.2, (gatt + kvar) * (o.sort === 'spjut' ? 0.02 : 0.06)); }
            else y = o.fy;
          }
        }
        const dx = e.x - o.fx, dz = e.z - o.fz, dy = y - o.fy;
        if (typeof e.vx === 'number') o.rikt.set(e.vx, e.vy || 0, e.vz || 0).normalize();
        else if (dx * dx + dz * dz + dy * dy > 1e-6) o.rikt.set(dx, dy, dz).normalize();
        else if (typeof e.rot === 'number') o.rikt.set(Math.sin(e.rot), 0, Math.cos(e.rot));
        o.fx = e.x; o.fz = e.z; o.fy = y;
        if (o.magi) {
          const gf = o.sort === 'eld' ? [3, 1.2, 0.3] : o.sort === 'is' ? [0.2, 0.7, 1.5] : [0.5, 3, 1.0];
          glod.lagg(e.x, y, e.z, 1.5, gf[0], gf[1], gf[2]);
          if (Math.random() < 0.7) part.ny(e.x, y, e.z, (R() - 0.5), (R() - 0.5), (R() - 0.5), o.sort === 'eld' ? 4 : o.sort === 'is' ? 1.2 : 0.8, o.sort === 'eld' ? 1.5 : o.sort === 'is' ? 2.6 : 4, o.sort === 'eld' ? 0.3 : o.sort === 'is' ? 4 : 1.4, 0.9, 0.16, 0.35, 1, 0, 1);
          if (o.pool && o.idx >= 0) { _q.setFromUnitVectors(UPP, o.rikt); _q.multiply(_gq.setFromAxisAngle(UPP, o.t * 9)); _m4.compose(_v3.set(e.x, y, e.z), _q, _s3.setScalar(o.skala)); o.pool.satt(o.idx, _m4); }
        } else if (o.pool && o.idx >= 0) {
          if (o.sort === 'sten') {
            _q.setFromEuler(_e.set(o.t * 6, o.t * 4, 0)); _m4.compose(_v3.set(e.x, y - 0.25, e.z), _q, _s3.setScalar(o.skala)); o.pool.satt(o.idx, _m4);
            if (klickN < SMAX) { const r = 1.3 / (1 + y * 0.15); _m4.makeScale(r, 1, r); _m4.setPosition(e.x, markHojd(e.x, e.z) + 0.04, e.z); klick.setMatrixAt(klickN++, _m4); }
            if (Math.random() < 0.4) part.ny(e.x, y, e.z, 0, 0, 0, 0.6, 0.55, 0.5, 0.4, 0.35, 0.5, 0, 0.2, 0.5);
          } else {
            _m4.compose(_v3.set(e.x, y, e.z), _q.setFromUnitVectors(UPP, o.rikt), _s3.setScalar(o.skala)); o.pool.satt(o.idx, _m4);
            if (e.brinner) { glod.lagg(e.x, y, e.z, 1.1, 1.6, 0.6, 0.1); if (Math.random() < 0.9) part.ny(e.x + o.rikt.x * 0.5, y + o.rikt.y * 0.5, e.z + o.rikt.z * 0.5, (R() - 0.5) * 0.4, 0.6 + R() * 0.6, (R() - 0.5) * 0.4, 5, 2 + R(), 0.4, 1, 0.16, 0.28, 1, -0.6, 1); }
            else { glod.lagg(e.x, y, e.z, o.sort === 'spjut' ? 1.0 : 0.7, 0.5, 0.42, 0.28); if (Math.random() < 0.5) part.ny(e.x, y, e.z, 0, 0, 0, 1.6, 1.5, 1.2, 0.5, 0.09, 0.22, 1, 0, 0); }
          }
        }
        break;
      }
      case 'resurs': {
        if (!o.pool || o.idx < 0) break;
        if (o.in < 1) o.in = Math.min(1, o.in + dt * 5);
        const guld = o.sort === 'guld', t = U.tid.value, s = o.s * (e.skala || 1) * utBack(o.in);
        const y = (e.y ?? markHojd(e.x, e.z)) + (guld ? 0.45 + Math.sin(t * 3 + o.fas) * 0.1 : 0.02);
        if (guld) _q.setFromEuler(_e.set(Math.PI / 2, t * 2.5 + o.fas, 0, 'YXZ')); else _q.setFromAxisAngle(UPP, e.rot ?? o.fas);
        _m4.compose(_v3.set(e.x, y, e.z), _q, _s3.setScalar(s)); o.pool.satt(o.idx, _m4);
        break;
      }
      case 'plats': o.mesh.position.set(e.x, markHojd(e.x, e.z), e.z); o.mesh.rotation.y = e.rot || 0; break;
    }
  }

  function hantera(h) {
    const slag = HANDELSER[h.typ];
    if (h.typ === 'varning' && Array.isArray(h.platser)) { varnPlatser = h.platser; return; }
    if (h.typ === 'skott' && (h.fran === 'katapult' || h.fran === 'ballista')) maskinSkott(h);
    if (!slag) return;
    if (slag === 'plask') { for (const b of objekt.values()) if (b.slag === 'bat' && b.wx !== undefined && (!h.slag || b.typ === 'bat')) fx.plask(b.wx, b.wz); return; }
    let x = h.x, z = h.z; const o = h.id !== undefined ? (((slag === 'bygge' || slag === 'ras' || slag === 'murtraff') && objekt.get('byggen#' + h.id)) || idKarta.get(h.id)) : null;
    if (x === undefined && o) { x = o.x; z = o.z; }
    if (x === undefined && slag === 'glitter' && spelarPost) { x = spelarPost.x; z = spelarPost.z; }
    if (x === undefined) { if (slag === 'skak') skaka(h.styrka ?? 0.4); return; }
    switch (slag) {
      case 'bygge': fx.byggdamm(x, z, (o && o.def.radie) || 2.2); skaka(0.5); if (o && o.slag === 'bygge' && o.res >= 1) o.res = 0; if (o && o.slag === 'eld' && o.res >= 1) { o.res = 0; resningar.add(o); } if (o && o.delar) for (const d of o.delar) if (d.res >= 1) { d.res = 0; resningar.add(d); } break;
      case 'ras': fx.damm(x, z, 16, 1.6, 0x8a8478); fx.stenflis(x, z, 14, 1.2); fx.flis(x, z, 8, 1.4); skaka(0.5); break;
      case 'traff': fx.traff(x, z, h.y ?? 1.2); break;
      case 'flis': if (h.slag === 'sten') fx.stenflis(x, z); else { fx.flis(x, z); skakaNarmaste(x, z); } break;
      case 'tradfall': if (h.slag === 'sten') { fx.stenflis(x, z, 16, 1); fx.damm(x, z, 8, 1, 0x9a9aa0); } else { fx.flis(x, z, 16, 2); fx.damm(x, z, 8, 1.2); } skaka(0.15); break;
      case 'stenflis': fx.stenflis(x, z); break;
      case 'benpuff': {
        const ft = h.fiendeTyp || (o && o.typ);
        if (ft === 'eldande') { if (!h.sprang) fx.explosion(x, z, 1.5); }
        else if (ft === 'isvarg') { fx.damm(x, z, 10, 0.7, 0xdfe8f2); fx.frost(x, z, 0.6); }
        else if (ft === 'drake') { fx.explosion(x, z, 4.5); fx.explosion(x + 1.5, z - 1, 3); skaka(0.9); }
        else if (ft === 'belagringsbest' || ft === 'eldboss') { fx.benpuff(x, z); fx.gnistor(x, 1.5, z, 20, 0xff6a20, 4); }
        else fx.benpuff(x, z);
        break;
      }
      case 'explosion': fx.explosion(x, z, h.radie || 3); skaka(0.55); break;
      case 'nedslag': fx.nedslag(x, z, h.radie || 3.2); skaka(0.32); break;
      case 'frost': fx.frost(x, z); break;
      case 'lavabrand': fx.lavabrand(x, z); break;
      case 'glitter': fx.glitter(x, z); break;
      case 'dryck': fx.dryck(x, z); break;
      case 'guld': fx.guld(x, z); break;
      case 'betala': fx.betala(x, z); break;
      case 'magi': fx.magi(x, z, h.y ?? 1.3); break;
      case 'small': fx.small(x, z); skaka(0.6); break;
      case 'murtraff': fx.flis(x, z, 6, 1.6); skaka(0.08); break;
      case 'skak': skaka(h.styrka ?? 0.4); break;
      case 'brinn': fx.brinn(x, z); break;
      case 'damm': fx.damm(x, z, 8, 1); break;
      case 'jordpuff': fx.jordpuff(x, z); break;
      case 'svep': { const fo = idKarta.get(h.id), sk = fo && fo.skala ? fo.skala / 0.66 : 1; fx.svep(x, z, fo && typeof fo.rot === 'number' ? fo.rot : 0, h.vem === 'fiende' ? 0xb8ffc8 : h.vem === 'soldat' ? 0xfff0d0 : 0xffffff, 1.2 * sk, 1.15 * sk); break; }
      case 'skott':
        if (h.fran === 'torn') fx.skott(x, z, tornTopp(x, z) ?? 4.4, h.slag === 'eld' || (o && o.slag === 'projektil' && o.brinner) ? 0xffa040 : 0xfff0c8);
        else if (h.fran === 'boss') fx.skott(x, z, 3.2, 0xff5070, 10);
        else if (h.fran === 'katapult') fx.damm(x, z, 8, 1.4);
        else if (h.fran === 'ballista') fx.skott(x, z, 1.8, 0xfff0c8, 3);
        else if (h.fran === 'hjalte') fx.skott(x, z, 1.4, 0xfff0c8, 3);
        else if (h.slag === 'is') fx.skott(x, z, 1.9, 0x8ad8ff, 6);
        else fx.skott(x, z, 1.9, 0x7dff9a, 6);
        break;
    }
  }
  // höjden där pilarna lämnar tornet (efter tornets nivå), 4,4 m om inget torn hittas
  function tornTopp(x, z) { for (const o of objekt.values()) if (o.typ === 'torn' && Math.abs(o.x - x) < 0.6 && Math.abs(o.z - z) < 0.6) return 3.6 + 0.9 * Math.min(3, o.niva || 1); return null; }
  // katapulten slår med armen och ballistan vrider sig mot målet när de skjuter
  let senSpel = null;
  function maskinSkott(h) {
    let b = null; for (const o of objekt.values()) if (o.slag === 'maskin' && Math.abs(o.x - h.x) < 0.8 && Math.abs(o.z - h.z) < 0.8) { b = o; break; }
    if (!b) return;
    b.skottT = 0;
    const p = senSpel && Array.isArray(senSpel.projektiler) ? senSpel.projektiler.find((q) => q.id === h.id) : null;
    if (p) b.malYaw = typeof p.tx === 'number' ? Math.atan2(p.tx - b.x, p.tz - b.z) : (p.rot ?? b.malYaw);
  }
  function skakaNarmaste(x, z) { let b = null, bd = 9; for (const o of objekt.values()) if (o.slag === 'instans' && o.pool && o.pool.skak) { const d = (o.x - x) * (o.x - x) + (o.z - z) * (o.z - z); if (d < bd) { bd = d; b = o; } } if (b) b.pool.skaka(b.idx); }

  // ─── hörnstolpar: fyller kilarna där två mursegment möts i vinkel (sten om någon granne är av sten eller en port) ───
  const hornstolpar = new Map(); let hornSign = '';
  function hornGeo(sten) {
    const delar = [];
    const lagg = (g, hex) => { g.deleteAttribute('uv'); const ng = g.index ? g.toNonIndexed() : g, f = new THREE.Color(hex), a = new Float32Array(ng.attributes.position.count * 3); for (let k = 0; k < a.length; k += 3) { a[k] = f.r; a[k + 1] = f.g; a[k + 2] = f.b; } ng.setAttribute('color', new THREE.BufferAttribute(a, 3)); delar.push(ng); };
    if (sten) {
      const fot = new THREE.CylinderGeometry(1.08, 1.16, 0.5, 8); fot.translate(0, 0.25, 0); lagg(fot, 0x7f858f);
      const kropp = new THREE.CylinderGeometry(0.98, 1.04, 2.3, 8); kropp.translate(0, 1.6, 0); lagg(kropp, 0x9da3ad);
      const krans = new THREE.CylinderGeometry(1.16, 1.02, 0.36, 8); krans.translate(0, 2.9, 0); lagg(krans, 0xb9bec8);
      const tak = new THREE.CylinderGeometry(0.2, 1.1, 0.5, 8); tak.translate(0, 3.33, 0); lagg(tak, 0xa5603c);
    } else {
      const stock = new THREE.CylinderGeometry(0.4, 0.47, 3.2, 7); stock.translate(0, 1.6, 0); lagg(stock, 0x80522e);
      const spets = new THREE.ConeGeometry(0.4, 0.62, 7); spets.translate(0, 3.5, 0); lagg(spets, 0xc9a070);
      const band = new THREE.CylinderGeometry(0.5, 0.5, 0.16, 7); band.translate(0, 2.0, 0); lagg(band, 0x5a3a20);
    }
    const g = mergeGeometries(delar, false); g.computeBoundingBox();
    return g;
  }
  function uppdateraHorn(lista, namn) {
    const vill = new Map(); let sign = '';
    for (const e of lista) {
      if (!e || typeof e.ax !== 'number' || !byggd(e)) continue;
      const d = TYPER[e.typ]; if (!d) continue;
      const sten = !(d.slag === 'mur' && d.sort === 'palissad');
      for (const [x, z] of [[e.ax, e.az], [e.bx, e.bz]]) {
        const k = Math.round(x * 4) + ',' + Math.round(z * 4);
        let v = vill.get(k); if (!v) vill.set(k, v = { x, z, sten: false, hel: false, nyckel: namn + '#' + e.id });
        if (sten) v.sten = true;
        if (!e.raserad) v.hel = true;
      }
    }
    for (const [k, v] of vill) sign += k + (v.sten ? 's' : 'p') + (v.hel ? '1' : '0') + ';';
    if (sign === hornSign) return;
    hornSign = sign;
    for (const [k, o] of hornstolpar) { const v = vill.get(k); if (!v || v.sten !== o.sten) { resningar.delete(o); if (o.idx >= 0) o.pool.tabort(o.idx); o.idx = -1; hornstolpar.delete(k); } }
    for (const [k, v] of vill) {
      let o = hornstolpar.get(k);
      if (!o) {
        const p = pool(v.sten ? 'hornsten' : 'hornstock', () => ({ geo: hornGeo(v.sten), mat: vfMat, max: 64 }));
        o = { pool: p, nyckel: v.nyckel, x: v.x, y: markHojd(v.x, v.z), z: v.z, rot: Math.atan2(v.x, v.z), sx: 1, sy: 1, sz: 1, res: forsta ? 1 : 0, skak: 0, sten: v.sten, hel: true };
        o.idx = p.lagg(o, murMatris(o, o.res));
        if (o.idx < 0) continue;
        if (o.res < 1) resningar.add(o);
        hornstolpar.set(k, o);
      }
      o.nyckel = v.nyckel;
      if (o.hel !== v.hel) { o.hel = v.hel; o.sy = v.hel ? 1 : 0.3; o.res = Math.min(o.res, 0.999); resningar.add(o); }
    }
  }

  const figurer = []; let klickN = 0, varnPlatser = null;
  // liten guldpil över riddaren, ritas alltid överst så att han går att hitta bakom murar och träd
  const spelarMarke = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d');
    c.beginPath(); c.moveTo(10, 14); c.lineTo(54, 14); c.lineTo(32, 54); c.closePath(); c.fillStyle = '#ffd24a'; c.fill(); c.lineWidth = 6; c.lineJoin = 'round'; c.strokeStyle = 'rgba(40,24,0,0.9)'; c.stroke();
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false, fog: false })); s.scale.set(0.62, 0.62, 1); s.renderOrder = 58; s.visible = false; scen.add(s);
    return s;
  })();
  // bossens varning: en röd ring där specialattacken slår ner, och en skiva som växer tills det smäller
  const varnRing = (() => {
    const grp = new THREE.Group(); grp.visible = false; grp.name = 'varningsring';
    const mat = (op) => new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: op, depthWrite: false, fog: false, toneMapped: false });
    const rg = new THREE.RingGeometry(0.92, 1, 56); rg.rotateX(-Math.PI / 2);
    const cg = new THREE.CircleGeometry(1, 56); cg.rotateX(-Math.PI / 2);
    const ring = new THREE.Mesh(rg, mat(0.95)), yta = new THREE.Mesh(cg, mat(0.14)), fyll = new THREE.Mesh(cg, mat(0.3));
    ring.renderOrder = 6; yta.renderOrder = 5; fyll.renderOrder = 5; fyll.position.y = 0.01; ring.position.y = 0.02;
    grp.add(yta, fyll, ring); scen.add(grp);
    return { grp, visa(x, z, r, k) { grp.visible = true; grp.position.set(x, markHojd(x, z) + 0.12, z); grp.scale.set(r, 1, r); fyll.scale.setScalar(Math.max(0.02, klamp(k, 0, 1))); ring.material.opacity = 0.7 + 0.3 * Math.sin(U.tid.value * 16); } };
  })();
  const VADERSTRECK = { S: { x: 0, z: 42 }, O: { x: 42, z: 0 }, N: { x: 0, z: -42 }, V: { x: -42, z: 0 } }; // gravfälten i KARTA
  const naturSlut = (e) => e.anim === 'do' || e.ater > 0 || e.hp <= 0 || !!e.fallen;
  const _frustum = new THREE.Frustum(), _sf = new THREE.Sphere();
  // Ön byggs om när spel.oId (tema, brygga, lava) ändras: allt rivs och terräng, natur, dekor och gravfält ritas för det nya temat.
  function temaSignatur(spel) {
    const mj = spel.miljo && typeof spel.miljo === 'object' ? spel.miljo : null, t = (mj && mj.tema) || spel.tema || 'sommar', b = mj && mj.brygga;
    return t + '|' + ((mj && mj.oId) || spel.oId || '') + '|' + (b ? b.x.toFixed(1) + ',' + b.z.toFixed(1) : '') + '|' + (mj && Array.isArray(mj.lava) ? mj.lava.length : 0);
  }
  function rivVarld() {
    for (const o of [...objekt.values()]) tabort(o, true);
    for (const d of doende) slappFigur(d.o.typ, d.o.f); doende.length = 0;
    idKarta.clear(); resningar.clear(); eldar.length = 0; blixtar.length = 0; varnPlatser = null;
    for (const o of hornstolpar.values()) if (o.idx >= 0) o.idx = -1; hornstolpar.clear(); hornSign = '';
    for (const p of pooler.values()) if (p) { p.mesh.count = 0; p.agare.length = 0; p.mesh.instanceMatrix.needsUpdate = true; }
    for (const m of varldObj) { scen.remove(m); if (m.userData.egen && m.geometry) m.geometry.dispose(); if (m.userData.egenMat && m.material) { if (m.material.map) m.material.map.dispose(); m.material.dispose(); } }
    if (lavaMat) { lavaMat.dispose(); lavaMat = null; }
    varldObj.length = 0;
  }
  function byggVarld(temaNamn, mj) {
    rivVarld();
    tema = TEMAN[temaNamn] ? temaNamn : 'sommar'; TM = TEMAN[tema]; temaCache.clear();
    miljo = mj || null; brygga = (mj && mj.brygga && typeof mj.brygga.x === 'number') ? mj.brygga : STD_BRYGGA;
    lava = (mj && Array.isArray(mj.lava)) ? mj.lava.filter((q) => q && typeof q.ax === 'number') : [];
    U.sno.value = TM.sno; U.snoFarg.value.setHex(TM.snoFarg);
    gravMat.uniforms.uSlag.value = tema === 'vinter' ? 1 : tema === 'vulkan' ? 2 : 0;
    byggMark(); vattenHojd();
    if (O.dekor) byggDekor();
    if (O.gras) byggGras();
    byggLava(); byggBrygga();
    nederbord.nolla(); isNiva = 0; ask.k = 0;
    forsta = true; kam.forsta = true;
  }
  let isNiva = 0;
  function synka(spel, dt) {
    if (!laddad || !spel) return;
    dt = klamp(dt || 0, 0, 0.1);
    { const sign = temaSignatur(spel); if (sign !== temaSign) { temaSign = sign; byggVarld(sign.split('|')[0], spel.miljo); } }
    senSpel = spel;
    U.tid.value += dt; bild++;
    { // sjön fryser (Frostön) och askregnet (Vulkanön) tonas in och ut
      const mj = spel.miljo;
      isNiva = lerp(isNiva, mj && mj.isNu ? 1 : 0, 1 - Math.exp(-dt / 2.2)); vattenMat.uniforms.uIs.value = forsta ? (mj && mj.isNu ? 1 : 0) : isNiva;
      if (forsta) isNiva = vattenMat.uniforms.uIs.value;
      ask.k = lerp(ask.k, mj && mj.aska && spel.tid && spel.tid.fas !== 'dag' ? 1 : 0, 1 - Math.exp(-dt / 2.5));
    }
    uppdateraDygn(spel.tid);
    figurer.length = 0; klickN = 0; hp.nolla(); glod.nolla(); markljus.nolla(); spelarPost = null; spelarMarke.visible = false; varnRing.grp.visible = false;
    for (const k of Object.keys(lastPooler)) if (lastPooler[k]) { lastPooler[k].count = 0; lastPooler[k].instanceMatrix.needsUpdate = true; } // utan needsUpdate blev lasten kvar där den först ritades
    const sp = spel.spelare || spel.riddare; if (sp && typeof sp.x === 'number') spelarPost = sp;
    const en = (e, lista) => {
      if (!e || e.typ === undefined || e.id === undefined || typeof e.x !== 'number' || e.inne === true) return;
      const nyckel = lista + '#' + e.id;
      let o = objekt.get(nyckel);
      const def = TYPER[e.typ];
      if (def && (def.slag === 'mur' || def.slag === 'eld' || def.slag === 'maskin' || def.slag === 'grav') && !byggd(e)) { if (o) tabort(o, true); return; }
      if (def && def.slag === 'bygge' && !byggd(e)) { if (o && o.mesh) { tabort(o, true); o = null; } if (!o) return; }
      if (o && o.typ !== e.typ) { tabort(o, true); o = null; }
      if (!o) o = skapa(e, nyckel);
      o.sedd = bild; idKarta.set(e.id, o);
      uppdatera(o, e, dt);
    };
    for (const k in spel) {
      const v = spel[k];
      if (k === 'handelser' || !v || typeof v !== 'object') continue;
      if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) en(v[i], k); } else if (v.typ !== undefined && v.id !== undefined) en(v, k);
    }
    for (const o of objekt.values()) if (o.sedd !== bild) tabort(o, forsta);
    if (Array.isArray(spel.byggen)) uppdateraHorn(spel.byggen, 'byggen');
    { let gi = 0; for (const o of objekt.values()) if (o.slag === 'grav' && gi < 8) U.gravar.value[gi++].set(o.x, o.z, 3.5); for (; gi < 8; gi++) U.gravar.value[gi].set(1e4, 1e4, 0); }
    if (bild % 240 === 0) for (const [id, o] of idKarta) if (!objekt.has(o.nyckel)) idKarta.delete(id);
    if (Array.isArray(spel.handelser)) for (const h of spel.handelser) { if (h && typeof h === 'object' && !sedda.has(h)) { sedda.add(h); hantera(h); } }
    // skymningens varning: grönt sken där de odöda kommer
    let varn = null;
    if (spel.tid && spel.tid.fas === 'skymning') { varn = varnPlatser; if (!varn && spel.vag && Array.isArray(spel.vag.riktningar)) varn = spel.vag.riktningar.map((r) => RIKTPOS[r]).filter(Boolean); } else varnPlatser = null;
    if (Array.isArray(spel.varningar)) varn = (varn || []).concat(spel.varningar);
    if (dygn.morker > 0.3) for (const k in VADERSTRECK) { const v = VADERSTRECK[k], fl = dygn.morker * (0.75 + 0.25 * Math.sin(U.tid.value * 1.7 + v.x)); markljus.lagg(v.x, 0.08, v.z, 8, 0.03 * fl, 0.2 * fl, 0.08 * fl); glod.lagg(v.x - v.x / 42 * -9.5, 2.2, v.z - v.z / 42 * -9.5, 3.2, 0.03 * fl, 0.3 * fl, 0.1 * fl); }
    if (tema === 'vinter' && dygn.morker > 0.3) for (const k of ['NO', 'SO', 'SV', 'NV']) { const v = RIKTPOS[k], fl = dygn.morker * (0.75 + 0.25 * Math.sin(U.tid.value * 1.7 + v.z)); markljus.lagg(v.x, 0.08, v.z, 6, 0.02 * fl, 0.14 * fl, 0.1 * fl); }
    if (varn) for (const v of varn) { const fl = 0.6 + 0.4 * Math.sin(U.tid.value * 9 + v.x) * Math.sin(U.tid.value * 5.3); glod.lagg(v.x, 2.5, v.z, 7, 0.15 * fl, 1.3 * fl, 0.35 * fl); markljus.lagg(v.x, 0.08, v.z, 9, 0.05 * fl, 0.5 * fl, 0.12 * fl); }
    // lavans sken på marken, starkare på natten
    if (lava.length) { const t = U.tid.value, ms = 0.05 + 0.3 * dygn.morker; for (let i = 0; i < lava.length; i++) { const q = lava[i], fl = ms * (0.85 + 0.15 * Math.sin(t * 2 + i)); markljus.lagg((q.ax + q.bx) / 2, 0.08, (q.az + q.bz) / 2, 4.2, 1.0 * fl, 0.32 * fl, 0.05 * fl); if (i % 3 === 0 && dygn.morker > 0.2) glod.lagg(q.ax, 0.6, q.az, 3.2, 0.25 * fl, 0.07 * fl, 0.01); }
      if (Math.random() < dt * 3) { const q = lava[(Math.random() * lava.length) | 0], k = Math.random(), x = lerp(q.ax, q.bx, k), z = lerp(q.az, q.bz, k); part.ny(x, 0.2, z, (R() - 0.5) * 0.3, 0.6 + R() * 0.5, (R() - 0.5) * 0.3, 0.3, 0.27, 0.25, 0.35, 0.9 + R() * 0.8, 2 + R(), 0, -0.25, 0.4); }
      if (Math.random() < dt * 4) { const q = lava[(Math.random() * lava.length) | 0], k = Math.random(); fx.gnistor(lerp(q.ax, q.bx, k), 0.15, lerp(q.az, q.bz, k), 2, 0xff7020, 1.5); } }
    for (let i = blixtar.length - 1; i >= 0; i--) { const b = blixtar[i]; b.tid -= dt; if (b.tid <= 0) { blixtar.splice(i, 1); continue; } const k = b.tid / b.max; markljus.lagg(b.x, 0.09, b.z, b.radie, b.r * k, b.gg * k, b.b * k); glod.lagg(b.x, 1.4, b.z, b.radie * 0.8, b.r * k * 0.4, b.gg * k * 0.4, b.b * k * 0.4); }

    foljKamera(dt, spelarPost);

    // resningar (murar, träd som växer upp, fyrfat)
    for (const o of resningar) {
      if (!objekt.has(o.nyckel) || o.idx < 0) { resningar.delete(o); continue; }
      let s = 1, klar = true;
      if (o.res < 1) { o.res = Math.min(1, o.res + dt / 0.7); s = utBack(o.res); klar = o.res >= 1; }
      if (o.skak > 0) { o.skak -= dt; s *= 1 + Math.sin(o.skak * 60) * 0.04 * (o.skak / 0.25); klar = klar && o.skak <= 0; }
      o.pool.satt(o.idx, murMatris(o, klar ? 1 : s));
      if (klar) resningar.delete(o);
    }
    // döende figurer sjunker undan
    for (let i = doende.length - 1; i >= 0; i--) {
      const d = doende[i]; d.t += dt; const k = d.t / d.tid, hl = d.o.f.hallare;
      if (d.o.dod) { hl.position.y -= dt * (d.o.def.svav ? 0.6 : 1.3); if (d.o.f.fm.kod) animKod(d.o, dt); else d.o.f.mixer.update(dt); } else hl.scale.multiplyScalar(Math.max(0, 1 - dt * 6));
      if (k >= 1) { slappFigur(d.o.typ, d.o.f); doende.splice(i, 1); }
    }
    // animationer: närmaste figurer varje bildruta, resten var tredje, utanför bild inte alls
    _m4.multiplyMatrices(kamera.projectionMatrix, kamera.matrixWorldInverse); _frustum.setFromProjectionMatrix(_m4);
    let anim = 0;
    for (const o of figurer) o.avst = (o.x - kam.mal.x) * (o.x - kam.mal.x) + (o.z - kam.mal.z) * (o.z - kam.mal.z) - (o.def.boss ? 1e4 : 0);
    figurer.sort((a, b) => a.avst - b.avst);
    const fsk = KVALITET[kval].figurskuggor ? maxFigurskuggor : 0;
    for (let i = 0; i < figurer.length; i++) {
      const o = figurer[i], f = o.f;
      f.nat.castShadow = i < fsk;
      _sf.center.set(o.x, 1.2 * o.skala + (o.svav || 0), o.z); _sf.radius = (o.def.svav ? 5 : 2.4) * o.skala;
      const ibild = _frustum.intersectsSphere(_sf); o.ibild = ibild;
      if (!ibild) { o.ack = Math.min(0.5, o.ack + dt); continue; }
      if (i < maxAnimerade || (bild + o.fasn) % 3 === 0) { if (f.fm.kod) animKod(o, dt + o.ack); else f.mixer.update(dt + o.ack); o.ack = 0; anim++; } else o.ack += dt;
    }
    mat.figurer = figurer.length; mat.animerade = anim;
    klick.count = klickN; klick.instanceMatrix.needsUpdate = true;

    // eldar: lågor, glöd, markljus och de tre riktiga ljusen till de närmaste
    const t = U.tid.value, mk = dygn.morker;
    let en2 = 0;
    for (const el of eldar) {
      el.avst = (el.x - kam.mal.x) * (el.x - kam.mal.x) + (el.z - kam.mal.z) * (el.z - kam.mal.z);
      const fl = 0.82 + 0.18 * Math.sin(t * 11 + el.fas * 7) * Math.sin(t * 6.3 + el.fas * 3); el.fl = fl;
      if (en2 < EMAX) { eld.data[en2 * 4] = el.x; eld.data[en2 * 4 + 1] = el.y; eld.data[en2 * 4 + 2] = el.z; eld.data[en2 * 4 + 3] = 0.95 * Math.sqrt(el.styrka) * (0.92 + fl * 0.1); eld.fas[en2] = el.fas; en2++; }
      const gs = (0.012 + 0.24 * mk) * fl * el.styrka;
      glod.lagg(el.x, el.y + 0.35, el.z, 2.6 * Math.sqrt(el.styrka), 1.0 * gs, 0.48 * gs, 0.14 * gs);
      const ms = mk * 0.42 * fl * Math.min(1, 0.6 + 0.4 / el.styrka);
      if (ms > 0.01 && el.styrka > 0.3) markljus.lagg(el.x, 0.07, el.z, 8.5 * Math.sqrt(el.styrka), 1.0 * ms, 0.5 * ms, 0.16 * ms);
      el.gnista -= dt; if (el.gnista <= 0 && el.avst < 1600) { el.gnista = 0.12 + R() * 0.3; part.ny(el.x + (R() - 0.5) * 0.3, el.y + 0.4, el.z + (R() - 0.5) * 0.3, (R() - 0.5) * 0.8, 1.6 + R() * 1.6, (R() - 0.5) * 0.8, 5, 2.2, 0.4, 1, 0.07, 0.7 + R() * 0.6, 1, -0.6, 0.6); }
    }
    eld.g.instanceCount = en2; eld.aData.needsUpdate = true; eld.aFas.needsUpdate = true;
    eldar.sort((a, b) => a.avst - b.avst);
    for (let i = 0; i < punktljus.length; i++) {
      const p = punktljus[i], el = eldar[i];
      if (el && el.avst < 2500) { p.position.set(el.x, el.y + 0.7, el.z); p.intensity = (0.06 + mk * 0.94) * 46 * Math.min(1.1, el.styrka) * el.fl * TM.punkt; /* snön kastar tillbaka mer ljus än gräset */ } else p.intensity = 0;
    }
    glod.klar(); markljus.klar(); hp.klar();
    part.steg(dt);
    mat.partiklar = part.antal();
    flugor.mat.uniforms.uFokus.value.copy(kam.mal);
    if (spelarPost) U.fokus.value.set(lerp(U.fokus.value.x, spelarPost.x, 1 - Math.exp(-6 * dt)), 0, lerp(U.fokus.value.z, spelarPost.z, 1 - Math.exp(-6 * dt)));
    vattenMat.uniforms.uTid.value = t; himmelMat.uniforms.uTid.value = t; gravMat.uniforms.uTid.value = t; if (lavaMat) lavaMat.uniforms.uTid.value = t;
    nederbord.steg(dt, !!(miljo && spel.miljo && spel.miljo.aska && ask.k > 0.3));
    // skuggkameran följer fokus (snäpps till hela meter för att inte flimra)
    const fxm = Math.round(kam.mal.x), fzm = Math.round(kam.mal.z - (kam.staende ? 6 : 3));
    sol.target.position.set(fxm, 0, fzm); sol.position.set(fxm + dygn.rikt.x * 110, dygn.rikt.y * 110, fzm + dygn.rikt.z * 110); sol.target.updateMatrixWorld();
    forsta = false;
    matFps(dt);
  }

  function rendera() {
    if (!laddad) return;
    renderer.info.reset();
    if (KVALITET[kval].post && post.har()) post.rendera(); else { renderer.setRenderTarget(null); renderer.render(scen, kamera); }
    mat.ritanrop = renderer.info.render.calls; mat.trianglar = renderer.info.render.triangles;
  }

  async function ladda(framsteg) {
    const loader = new GLTFLoader(), nycklar = Object.keys(MODELLER);
    let klara = 0;
    // högst sex hämtningar åt gången, och ett nytt försök om en fil fallerar
    const ko = nycklar.slice();
    const hamta = async (k) => { for (let forsok = 0; forsok < 3; forsok++) { try { gltf[k] = await loader.loadAsync(O.assets + MODELLER[k]); return; } catch (fel) { if (forsok === 2) console.warn('[grafik] kunde inte ladda', MODELLER[k], fel && fel.message); else await new Promise((r) => setTimeout(r, 250 * (forsok + 1))); } } };
    const arbetare = async () => { while (ko.length) { const k = ko.shift(); await hamta(k); klara++; if (framsteg) framsteg(klara / nycklar.length * 0.9, MODELLER[k]); } };
    await Promise.all(Array.from({ length: 6 }, arbetare));
    byggVatten(); byggHimmel();
    byggVarld('sommar', null); temaSign = 'sommar|glantan|' + STD_BRYGGA.x.toFixed(1) + ',' + STD_BRYGGA.z.toFixed(1) + '|0';
    for (const typ of Object.keys(TYPER)) { const d = TYPER[typ]; if (d.slag === 'figur' && !figurMall.has(typ)) figurMall.set(typ, d.kod ? bakaKod(typ, d) : bakaFigur(typ, d)); }
    uppdateraDygn({ fas: 'dag', andel: 0.3 });
    laddad = true;
    if (bredd <= 1) storlek(canvas.clientWidth || innerWidth, canvas.clientHeight || innerHeight); else tillampaKvalitet();
    foljKamera(0, null);
    try { renderer.compile(scen, kamera); } catch (fel) { /* inte kritiskt */ }
    fpsM.vila = 4;
    if (framsteg) framsteg(1, 'klar');
  }

  function matning() { return Object.assign({}, mat, { fps: Math.round(mat.fps * 10) / 10, bildtid: Math.round(mat.bildtid * 100) / 100, objekt: objekt.size, geometrier: renderer.info.memory.geometries, texturer: renderer.info.memory.textures }); }

  return {
    ladda, synka, rendera, storlek, skarmTillMark, matning,
    // utöver kontraktet:
    sattKvalitet, skaka, markHojd, snapp: () => { kam.forsta = true; }, effekt: (namn, x, z) => { if (fx[namn]) fx[namn](x, z); },
    kamera, scen, renderer, opts: O, KVALITET,
  };
}
