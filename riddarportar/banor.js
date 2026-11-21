// Riddarportarna – banor.js
// Allt innehåll som ska kunna växa: riken, banor, stjärnmål, tornets byggstenar och välsignelser.
// Ren data utan Three.js, så att sim.mjs kan läsa och testa den i Node. Nytt rike = ny post i RIKEN och tio poster i BANOR.

/* ================= Balans (satt med simuleringen, se SPEC) ================= */
export const TUNE = {size:1.2, ramp:.05, every:.9, hp:1.3, hpRamp:.15, bossHp:2.0, giantHp:4.5, grow:12, react:.08, reactRamp:.012, reactMax:12, cannonDmg:2,
  mobilDrake:.7,   // drakbanan (bana 5) är kortare på mobil
};

/* ================= Byggstenar för portar ================= */
export function G(z,x,w,t,v,amp=0,spd=0,ph=0){ return {z,x,w,t,v,amp,spd,ph,pair:0}; }
export const L = -2.5, R = 2.5, HW = 4.6;
export const PAIR = (z,t1,v1,t2,v2) => [{...G(z,L,HW,t1,v1),pair:1},{...G(z,R,HW,t2,v2),pair:2}];
const brinn = (g, n) => ({...g, brinn:n});
// Porttyper: mul, add, sub, div, mys (?), gold (×5), skold (riddarna tål en extra träff), hast (ryttare), bage (bågskyttar).
// En port med brinn:N brinner: N riddare går åt till att släcka den, sedan fungerar den som vanligt.

/* ================= Riken ================= */
// tema: färger för himmel, ljus, mark och dekor. musik: grundtoner per takt, tempo och melodiljud.
export const RIKEN = [
  {id:'gron', namn:'Gröndalen', fran:0, till:9, text:'Gröna kullar och den första röda borgen.',
    tema:{fog:0xbfe2ec, himmel:[0xe4f3ff,0x5d7d3a,1.25], sol:[0xfff0d2,2.4], mark:'gras', vag:0xffffff, dekor:'gron', kant:0xa79d8e},
    musik:{rot:[146.83,116.54,130.81,110], bossRot:[110,103.83,98,92.5], bpm:100, melodi:null}, kort:['#5fbf5a','#2f7d33']},
  {id:'frost', namn:'Frostmarken', fran:10, till:19, glid:1.55, text:'Snö och is. Portarna glider fortare och snöstormar skymmer banan.',
    tema:{fog:0xd9e9f5, himmel:[0xf0f7ff,0x8ea4bc,1.35], sol:[0xf2f7ff,2.2], mark:'sno', vag:0xdbe8f5, dekor:'frost', kant:0xb9c8d8},
    musik:{rot:[164.81,130.81,146.83,123.47], bossRot:[123.47,116.54,110,103.83], bpm:106, melodi:'klocka'}, kort:['#5fa8e0','#2a4f8e']},
  {id:'eld', namn:'Eldbergen', fran:20, till:29, text:'Lavafloder delar banan och portar står i brand.',
    tema:{fog:0x7a4f45, himmel:[0xffd2b0,0x3a2420,1.15], sol:[0xffb47a,2.6], mark:'aska', vag:0xa8968a, dekor:'eld', kant:0x5a4a44},
    musik:{rot:[98,92.5,87.31,82.41], bossRot:[82.41,77.78,73.42,69.3], bpm:116, melodi:'gnistra'}, kort:['#ff9a4a','#9b2a14']},
];
export const rikeFor = idx => RIKEN.find(r => idx>=r.fran && idx<=r.till) || RIKEN[RIKEN.length-1];

/* ================= Banor ================= */
// Bana 1–10 är oförändrade från v2. Fält: hp (borgens bas-HP), every (sekunder mellan vågor), size (vågstorlek), rs (fiendefart),
// brute (andel tunga), cannon (sekunder mellan kanonskott), archers (skyttar på muren), gold (sekunder mellan guldportar),
// cav {every,n}, shield {every}, wolves {every,n} isvargar, mages (frostmagiker på muren), storm {every,dur} snöstorm,
// lava [{z, bro:[x...]}] lavaflod med broar, troll {every,n} lavatroll, andar {every,n} eldandar, boss.
export const BANOR = [
  // ---- Gröndalen ----
  {hp:90, every:4.6, size:7, rs:3.0, gates:[G(8,L,HW,'mul',2),G(8,R,HW,'add',10),G(-8,0,5,'mul',2)]},
  {hp:150, every:4.8, size:7, rs:3.1, gates:[...PAIR(9,'mul',2,'add',20),G(-1,-2.7,4,'add',10),G(-1,2.7,4,'div',2),G(-13,0,3.4,'mul',3)]},
  {hp:200, every:4.7, size:8, rs:3.2, cannon:9, gates:[G(9,0,4,'mul',2,2.6,0.9),...PAIR(-2,'mul',3,'add',20),G(-14,0,3.6,'mys',0)]},
  {hp:300, every:4.5, size:9, rs:3.3, cannon:8.5, archers:2, gold:13, gates:[G(10,L,HW,'div',2),G(10,R,HW,'mul',2),G(1,0,3.4,'add',10,3,1.1),...PAIR(-8,'mul',2,'add',20),G(-17,0,3,'mys',0,2.6,1.2)]},
  {boss:'dragon', hp:420, every:5.4, size:8, rs:3.3, gold:15, gates:[...PAIR(10,'mul',3,'add',20),G(1,0,3.6,'mys',0),G(-8,L,HW,'mul',2),G(-8,R,HW,'sub',5),G(-17,0,4,'add',10,2.8,1.0)]},
  {hp:470, every:4.3, size:11, rs:3.5, cannon:8, archers:3, gold:14, cav:{every:15,n:5}, gates:[G(10,0,3,'mul',2,3.2,1.4),G(2,L,HW,'sub',5),G(2,R,HW,'mul',2),G(-6,0,3,'mul',3,3,1.0,1.5),...PAIR(-15,'add',20,'mys',0)]},
  {hp:570, every:4.1, size:12, brute:0.15, rs:3.6, cannon:7.5, archers:3, gold:13, cav:{every:16,n:5}, shield:{every:22}, gates:[G(10,L,HW,'div',2),G(10,R,HW,'mul',2),G(3,0,2.8,'mul',3,3.3,1.5),...PAIR(-5,'mul',2,'add',20),G(-14,0,3,'mys',0,3,1.7,0.8)]},
  {hp:690, every:3.9, size:14, brute:0.2, rs:3.7, cannon:7, archers:4, gold:12, cav:{every:14,n:6}, shield:{every:20}, gates:[G(11,0,2.8,'mul',2,3.3,1.6),G(4,L,HW,'sub',5),G(4,R,HW,'div',2),G(-3,0,2.6,'mul',3,3.4,1.8,1),...PAIR(-12,'add',20,'mys',0),G(-19,0,3,'mul',2,3,1.2)]},
  {hp:830, every:3.7, size:16, brute:0.24, rs:3.8, cannon:6.5, archers:4, gold:12, cav:{every:13,n:7}, shield:{every:18}, gates:[G(11,L,HW,'sub',5),G(11,R,HW,'mul',2),G(4,0,2.6,'mul',2,3.4,2.0),...PAIR(-4,'mul',3,'add',20),G(-12,0,3,'add',10,3.2,1.6,2),G(-19,L,HW,'mul',2),G(-19,R,HW,'div',2)]},
  {boss:'giant', hp:600, bossHp:520, every:4.4, size:12, brute:0.2, rs:3.6, cannon:9, archers:3, gold:13, cav:{every:18,n:6}, gates:[G(11,0,2.6,'mul',2,3.4,2.1),...PAIR(4,'mul',3,'add',20),G(-3,0,2.6,'mys',0,3.4,1.6,1.2),G(-11,L,HW,'sub',5),G(-11,R,HW,'add',10),G(-18,0,2.6,'mul',2,3.4,1.9,0.4)]},

  // ---- Frostmarken ----
  {hp:900, every:4.3, size:12, rs:3.6, cannon:8, archers:2, gold:13, wolves:{every:13,n:7},
    gates:[G(10,L,HW,'skold',0),G(10,R,HW,'mul',2),G(3,0,3.2,'add',10,2.8,1.0),...PAIR(-5,'mul',3,'add',20),G(-13,0,3.2,'mul',2,3,1.1)]},
  {hp:960, every:4.2, size:12, rs:3.6, cannon:7.5, archers:3, gold:13, wolves:{every:14,n:7}, storm:{every:20,dur:7},
    gates:[G(11,0,3,'mul',2,3,1.2),G(4,L,HW,'skold',0),G(4,R,HW,'div',2),G(-3,0,3,'mul',3,3,1.0,1.2),...PAIR(-11,'add',20,'mys',0),G(-18,0,3,'mul',2,3,1.3)]},
  {hp:1020, every:4.1, size:13, brute:.12, rs:3.7, cannon:7.5, archers:2, mages:1, gold:13, wolves:{every:15,n:8}, storm:{every:22,dur:7},
    gates:[...PAIR(10,'mul',2,'skold',0),G(2,0,2.8,'mul',3,3.2,1.3),G(-6,L,HW,'sub',5),G(-6,R,HW,'mul',2),G(-14,0,3,'mys',0,3,1.4)]},
  {hp:1080, every:4.0, size:13, brute:.15, rs:3.7, cannon:7, archers:3, mages:1, gold:12, cav:{every:15,n:6}, wolves:{every:16,n:8},
    gates:[G(11,L,HW,'hast',0),G(11,R,HW,'mul',2),G(4,0,2.8,'mul',2,3.3,1.5),...PAIR(-4,'mul',3,'skold',0),G(-12,0,3,'add',10,3.2,1.5),G(-19,0,3,'mul',2,3,1.2)]},
  {boss:'queen', hp:820, every:5.0, size:10, rs:3.6, gold:14, wolves:{every:18,n:7},
    gates:[...PAIR(10,'mul',3,'skold',0),G(2,0,3.4,'mys',0,2.6,1.1),G(-6,L,HW,'mul',2),G(-6,R,HW,'hast',0),G(-15,0,3.6,'add',10,2.8,1.1)]},
  {hp:1150, every:3.9, size:14, brute:.18, rs:3.8, cannon:7, archers:3, mages:1, gold:12, shield:{every:21}, wolves:{every:13,n:8}, storm:{every:20,dur:8},
    gates:[G(11,0,2.8,'mul',2,3.3,1.6),G(4,L,HW,'div',2),G(4,R,HW,'skold',0),G(-3,0,2.6,'mul',3,3.4,1.7,1),...PAIR(-11,'hast',0,'mys',0),G(-18,0,3,'mul',2,3,1.3)]},
  {hp:1220, every:3.8, size:15, brute:.2, rs:3.8, cannon:6.5, archers:4, mages:2, gold:12, cav:{every:14,n:6}, wolves:{every:14,n:9},
    gates:[G(11,L,HW,'sub',5),G(11,R,HW,'mul',2),G(4,0,2.6,'skold',0,3.4,1.8),...PAIR(-4,'mul',3,'add',20),G(-12,0,3,'mys',0,3.2,1.6,2),G(-19,L,HW,'mul',2),G(-19,R,HW,'hast',0)]},
  {hp:1290, every:3.7, size:16, brute:.22, rs:3.9, cannon:6.5, archers:3, mages:2, gold:12, shield:{every:19}, wolves:{every:12,n:9}, storm:{every:18,dur:8},
    gates:[...PAIR(11,'skold',0,'hast',0),G(4,0,2.6,'mul',2,3.4,2.0),G(-3,L,HW,'div',2),G(-3,R,HW,'mul',3),G(-11,0,2.8,'add',10,3.4,1.8),G(-18,0,3,'mul',2,3,1.5)]},
  {hp:1220, every:3.7, size:16, brute:.22, rs:4.0, cannon:6, archers:4, mages:2, gold:11, cav:{every:13,n:7}, shield:{every:18}, wolves:{every:12,n:10}, storm:{every:18,dur:9},
    gates:[G(11,0,2.6,'mul',2,3.4,2.1),G(4,L,HW,'sub',5),G(4,R,HW,'skold',0),...PAIR(-4,'mul',3,'mys',0),G(-11,0,2.6,'hast',0,3.4,1.9,1),G(-18,L,HW,'mul',2),G(-18,R,HW,'div',2)]},
  {boss:'icedragon', hp:900, every:4.8, size:11, rs:3.8, archers:2, gold:14, wolves:{every:16,n:8}, storm:{every:24,dur:7},
    gates:[...PAIR(10,'mul',3,'skold',0),G(1,0,3.4,'mys',0,2.8,1.2),G(-7,L,HW,'mul',2),G(-7,R,HW,'hast',0),G(-16,0,3.6,'add',20,2.8,1.1)]},

  // ---- Eldbergen ----
  {hp:880, every:4.0, size:13, rs:3.8, cannon:7, archers:3, gold:13, lava:[{z:-8, bro:[-3.1,0,3.1]}],
    gates:[G(10,L,HW,'bage',0),G(10,R,HW,'mul',2),G(3,0,3,'mul',2,3,1.1),...PAIR(-2,'mul',3,'add',20),G(-15,0,3.2,'mys',0,2.8,1.2)]},
  {hp:930, every:3.9, size:14, brute:.15, rs:3.8, cannon:7, archers:3, gold:13, lava:[{z:-10, bro:[-3.1,0,3.1]}],
    gates:[brinn(G(10,0,3.6,'mul',3),22),G(3,L,HW,'bage',0),G(3,R,HW,'div',2),G(-4,0,3,'mul',2,3,1.3),G(-16,L,HW,'mul',2),G(-16,R,HW,'add',10)]},
  {hp:900, every:3.8, size:14, brute:.18, rs:3.9, cannon:6.5, archers:3, gold:12, troll:{every:16,n:1}, lava:[{z:-6, bro:[-3.1,0,3.1]}],
    gates:[G(11,L,HW,'bage',0),G(11,R,HW,'mul',2),G(3,0,2.8,'mul',2,3.3,1.5),brinn(G(-12,0,3.4,'mul',3),22),G(-18,0,3,'mys',0,3,1.3)]},
  {hp:1030, every:3.7, size:15, brute:.2, rs:3.9, cannon:6.5, archers:4, gold:12, andar:{every:13,n:6}, troll:{every:18,n:1}, lava:[{z:-9, bro:[-3.2,0,3.2]}],
    gates:[...PAIR(11,'mul',2,'bage',0),G(4,0,2.8,'hast',0,3.3,1.6),G(-3,L,HW,'sub',5),G(-3,R,HW,'mul',3),brinn(G(-15,0,3.4,'mul',3),24)]},
  {boss:'firegiant', hp:640, bossHp:600, every:4.4, size:12, brute:.2, rs:3.8, cannon:8.5, archers:3, gold:13, andar:{every:16,n:5},
    gates:[G(11,0,2.6,'mul',2,3.4,2.1),...PAIR(4,'mul',3,'bage',0),G(-3,0,2.6,'mys',0,3.4,1.6,1.2),G(-11,L,HW,'sub',5),G(-11,R,HW,'skold',0),G(-18,0,2.6,'mul',2,3.4,1.9,.4)]},
  {hp:1080, every:3.6, size:16, brute:.22, rs:4.0, cannon:6, archers:4, gold:12, cav:{every:14,n:7}, troll:{every:15,n:1}, lava:[{z:-3, bro:[-3.2,0,3.2]},{z:-15, bro:[-2.2,2.2]}],
    gates:[G(11,L,HW,'bage',0),G(11,R,HW,'mul',2),G(5,0,2.8,'mul',3,3.3,1.7),brinn(G(-9,0,3.6,'mul',3),26),G(-19,L,HW,'mul',2),G(-19,R,HW,'hast',0)]},
  {hp:1120, every:3.5, size:16, brute:.24, rs:4.0, cannon:6, archers:4, gold:11, shield:{every:19}, andar:{every:12,n:7}, troll:{every:16,n:1}, lava:[{z:-7, bro:[-3.2,0,3.2]}],
    gates:[...PAIR(11,'mul',3,'bage',0),G(3,0,2.6,'mul',2,3.4,2.0),G(-12,L,HW,'div',2),brinn(G(-12,R,HW,'mul',3),22),G(-18,0,2.8,'hast',0,3.2,1.8)]},
  {hp:1080, every:3.4, size:17, brute:.25, rs:4.1, cannon:5.5, archers:4, gold:11, cav:{every:13,n:7}, troll:{every:14,n:2}, andar:{every:13,n:7}, lava:[{z:-2, bro:[-3.2,0,3.2]},{z:-14, bro:[-3.2,0,3.2]}],
    gates:[G(11,0,2.6,'mul',2,3.4,2.1),G(5,L,HW,'bage',0),G(5,R,HW,'sub',5),brinn(G(-8,0,3.4,'mul',3),28),G(-19,L,HW,'mul',2),G(-19,R,HW,'skold',0)]},
  {hp:1000, every:3.5, size:17, brute:.24, rs:4.1, cannon:6, archers:4, gold:11, shield:{every:19}, troll:{every:16,n:1}, andar:{every:12,n:8}, lava:[{z:-5, bro:[-3.2,0,3.2]},{z:-15, bro:[-2.2,2.2]}],
    gates:[...PAIR(11,'mul',3,'bage',0),G(1,0,2.6,'mys',0,3.4,2.0),brinn(G(-10,L,HW,'mul',2),18),G(-10,R,HW,'div',2),G(-19,0,2.8,'hast',0,3.2,2.0)]},
  {boss:'ashdragon', hp:900, every:4.6, size:12, rs:3.9, archers:2, gold:13, andar:{every:15,n:6}, lava:[{z:-12, bro:[-3.2,0,3.2]}],
    gates:[...PAIR(10,'mul',3,'bage',0),G(2,0,3.4,'mys',0,2.8,1.2),G(-5,L,HW,'mul',2),G(-5,R,HW,'skold',0),G(-18,0,3.6,'add',20,2.8,1.1)]},
];

/* ================= Bossar ================= */
// typ: wall = står på muren och HP är borgens, walk = går mot porten och har egen HP. hpMul gäller borgens HP på bossbanan.
export const BOSSAR = {
  dragon:   {namn:'Draken på muren', kort:'DRAKEN', typ:'wall', hpMul:2.0, rike:'gron'},
  giant:    {namn:'Jätten', kort:'JÄTTEN', typ:'walk', rike:'gron'},
  queen:    {namn:'Frostdrottningen', kort:'DROTTNINGEN', typ:'wall', hpMul:2.0, rike:'frost'},
  icedragon:{namn:'Isdraken', kort:'ISDRAKEN', typ:'wall', hpMul:1.8, rike:'frost'},
  firegiant:{namn:'Eldjätten', kort:'ELDJÄTTEN', typ:'walk', rike:'eld'},
  ashdragon:{namn:'Askdraken', kort:'ASKDRAKEN', typ:'wall', hpMul:2.0, rike:'eld', faser:3},
};

/* ================= Stjärnmål ================= */
// Tre mål per bana. Vinst ger alltid minst en stjärna, varje uppfyllt mål ger en, högst tre.
// Typer: skada (porten tar högst v skada), tid (vinn under v s), kombo (nå kombo ×v), kampe (vinn utan Kämpe), arme (ha v riddare samtidigt).
const TID = [30,30,35,35,80, 40,45,60,65,95, 60,65,70,75,135, 80,85,90,95,135, 75,80,95,90,135, 100,115,135,140,195];
export function stjarnmal(idx){
  const lv = BANOR[idx]; if(lv && lv.mal) return lv.mal;
  const skada = idx<2 ? 0 : idx<10 ? 2 : idx<20 ? 3 : 4;
  const tredje = lv && lv.boss ? {t:'kampe'} : [{t:'kombo',v:idx<10?3:4}, {t:'arme',v:idx<10?60+idx*12:idx<20?160+(idx-10)*8:220+(idx-20)*8}, {t:'kombo',v:idx<10?3:idx<20?4:5}][idx%3];
  return [{t:'skada',v:skada}, {t:'tid',v:TID[idx]||120}, tredje];
}
export function malText(m){
  return m.t==='skada' ? (m.v===0 ? 'Ingen skada på porten' : `Högst ${m.v} skada på porten`)
    : m.t==='tid' ? `Vinn på under ${m.v} sekunder`
    : m.t==='kombo' ? `Nå kombo ×${m.v}`
    : m.t==='kampe' ? 'Vinn utan att skicka Kämpe'
    : m.t==='arme' ? `Ha ${m.v} riddare samtidigt` : '?';
}
// s: {won, skada, tid, kombo, kampar, topp}
export function malKlart(m, s){
  if(!s.won) return false;
  return m.t==='skada' ? s.skada<=m.v : m.t==='tid' ? s.tid<m.v : m.t==='kombo' ? s.kombo>=m.v : m.t==='kampe' ? s.kampar===0 : m.t==='arme' ? s.topp>=m.v : false;
}

/* ================= Tornet ================= */
// Varje våning skapas ur samma byggstenar som banorna. di = svårighetsindex (samma skala som bananummer − 1).
export function mulberry32(a){ return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function hashStr(s){ let h = 2166136261; for(let i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export const dagensFro = datum => hashStr('riddartornet ' + datum);
export const TORNBOSSAR = ['giant','dragon','queen','icedragon','firegiant','ashdragon'];
export const tornDi = n => 1.2 + 0.62*n;           // våning 1 ≈ bana 3, våning 40 ≈ bana 26, sedan fortsätter det uppåt
const ROWZ = [[10,1,-8,-17],[11,3,-5,-13,-19],[11,4,-3,-11,-18],[10,2,-6,-15]];

export function tornVaning(n, fro=1){
  const rnd = mulberry32(hashStr(fro + ':' + n)), pick = a => a[Math.floor(rnd()*a.length)];
  const di = tornDi(n), rike = RIKEN[Math.floor((n-1)/10) % RIKEN.length];
  const boss = n % 10 === 0 ? TORNBOSSAR[(n/10-1) % TORNBOSSAR.length] : null;
  const lv = {torn:n, di, rike:rike.id, boss:boss||undefined};
  // fiendens styrka växer med våningen (alla värden stiger eller står still, inget går ner)
  lv.hp = Math.round((boss ? 1.0 : 1) * (190 + 34*n));
  lv.every = Math.max(2.9, 4.7 - n*.045) * (boss ? 1.12 : 1);
  lv.size = Math.round((boss ? 0.85 : 1) * (7 + n*.32));
  lv.rs = Math.min(4.6, 3.1 + n*.03);
  if(boss==='giant' || boss==='firegiant') lv.bossHp = Math.round(300 + n*9);
  if(n>=6) lv.brute = Math.min(.3, .1 + n*.005);
  if(n>=2 && !boss) lv.cannon = Math.max(5, 9 - n*.1);
  if(n>=3) lv.archers = Math.min(4, 1 + Math.floor(n/8));
  lv.gold = 13;
  if(n>=5) lv.cav = {every:Math.max(11, 17 - n*.15), n:Math.min(9, 4 + Math.floor(n/8))};
  if(n>=7) lv.wolves = {every:Math.max(10, 16 - n*.12), n:Math.min(11, 6 + Math.floor(n/10))};
  if(n>=9 && !boss) lv.shield = {every:Math.max(14, 22 - n*.15)};
  if(n>=12 && !boss) lv.mages = Math.min(2, 1 + Math.floor((n-12)/16));
  if(n>=14) lv.storm = {every:Math.max(15, 24 - n*.15), dur:Math.min(10, 6 + n*.06)};
  if(n>=19) lv.troll = {every:Math.max(11, 18 - n*.12), n:Math.min(3, 1 + Math.floor((n-19)/14))};
  if(n>=22) lv.andar = {every:Math.max(10, 15 - n*.08), n:Math.min(10, 5 + Math.floor((n-22)/8))};
  // portar
  const zs = pick(ROWZ).slice();
  if(n>=16 && !boss){ const lz = zs.length>4 ? -8 : -10.5; lv.lava = [{z:lz, bro: rnd()<.5 ? [-3.2,0,3.2] : [-2.2,2.2]}]; }
  const amp = Math.min(3.4, n*.12), spd = Math.min(2.2, .8 + n*.035);
  const good = [['mul',2],['mul',2],['mul',3],['add',10],['add',20]];
  if(n>=4) good.push(['skold',0]); if(n>=8) good.push(['hast',0]); if(n>=11) good.push(['bage',0]);
  const bad = [['sub',5],['div',2]]; if(n>=15) bad.push(['div',3]);
  const gates = [];
  zs.forEach((z, i) => {
    if(lv.lava && lv.lava.some(l => Math.abs(l.z - z) < 2.6)) return;
    const r = rnd();
    if(r < .3){ const a = pick(good), b = pick(good); gates.push(...PAIR(z, a[0], a[1], b[0], b[1])); }
    else if(r < .55 && i>0){ const a = pick(good), b = pick(bad); const sw = rnd()<.5; gates.push(G(z, sw?L:R, HW, a[0], a[1]), G(z, sw?R:L, HW, b[0], b[1])); }
    else if(r < .7 && n>=3){ gates.push(G(z, 0, 3.2, 'mys', 0, amp*.8, spd, rnd()*6)); }
    else { const a = pick(good); const g = G(z, 0, Math.max(2.6, 3.6 - n*.02), a[0], a[1], amp, spd, rnd()*6); gates.push(n>=17 && a[0]==='mul' && rnd()<.45 ? brinn(g, Math.round(14 + n*.4)) : g); }
  });
  lv.gates = gates;
  return lv;
}

// Svårighetsindex för en bana eller våning: borgens effektiva HP gånger trycket från fienden. Används för att visa att tornet blir svårare.
export function svarighet(lv, mode){
  const di = lv.di ?? 0, B = lv.boss ? BOSSAR[lv.boss] : null;
  let hp = lv.hp * (TUNE.hp + TUNE.hpRamp*di) * (B && B.typ==='wall' ? B.hpMul : 1) + (lv.bossHp ? lv.bossHp*TUNE.giantHp*1.2 : 0);
  const tryck = (lv.size*(TUNE.size + TUNE.ramp*di)) / (lv.every*TUNE.every) * lv.rs/3;
  let extra = 1;
  for(const [k,w] of [['cannon',.05],['archers',.04],['cav',.05],['wolves',.06],['shield',.05],['mages',.07],['storm',.03],['lava',.07],['troll',.06],['andar',.06],['brute',.04]]) if(lv[k]) extra += w;
  if(B) extra += .35;
  return hp/100 * tryck * extra;
}

/* ================= Välsignelser (tornet) ================= */
// Var tredje våning väljer spelaren en av tre. De gäller resten av klättringen och kan staplas.
export const VALSIGNELSER = [
  {id:'pott', namn:'Fler riddare', text:'+1 riddare per skott', ikon:'P'},
  {id:'takt', namn:'Snabb ballista', text:'+20 % skjuttakt', ikon:'T'},
  {id:'kampe', namn:'Stark Kämpe', text:'+1 Kämpe per våning, fäller 15', ikon:'K'},
  {id:'matare', namn:'Snabba krafter', text:'Kraftmätarna fylls 50 % fortare', ikon:'M'},
  {id:'port', namn:'Tjock port', text:'+8 HP på porten', ikon:'H'},
  {id:'skold', namn:'Sköldbärare', text:'Var fjärde riddare har sköld', ikon:'S'},
  {id:'guld', namn:'Guldregn', text:'Guldporten kommer dubbelt så ofta', ikon:'G'},
  {id:'start', namn:'Förtrupp', text:'Börja varje våning med 25 riddare', ikon:'F'},
  {id:'kombo', namn:'Kombomästare', text:'Kombon ger dubbelt så många extra', ikon:'C'},
];
export function valsignelseVal(n, fro, har){
  const rnd = mulberry32(hashStr('välsignelse ' + fro + ':' + n)), pool = VALSIGNELSER.slice(), ut = [];
  while(ut.length < 3 && pool.length){ const i = Math.floor(rnd()*pool.length); ut.push(pool.splice(i,1)[0].id); }
  return ut;
}
