// Borgväktaren – data.js
// Allt innehåll som ska kunna växa: torn, grenar, fiender, riken, banor, förbättringar och vågrecept.
// Motorn (modell.js) läser bara härifrån. Nästa version lägger till banor och fiender här utan att röra motorn.

export const STEP = .1, ROAD_W = 2.3, CASTLE_Z = 13.7;
export const SELL_BACK = .7;

/* ---------- torn ----------
   Nivå 1–3 ligger i listorna (index 0–2). På nivå 3 väljer spelaren gren A eller B (nivå 4).
   air: når flygande fiender. need: banan som måste vara klarad (index) innan tornet går att bygga. */
export const TT = {
  archer:  {name:'Bågskyttetorn', short:'Bågskytt', desc:'Snabba pilar, lång räckvidd. Sköldar tar halv skada.', up:'Snabbare och fler pilar', air:true,
    cost:[70,80,130], range:[3.9,4.2,4.6], rate:[.85,.62,.46], dmg:[7,9,12], shots:[1,2,3],
    icon:'<path d="M5 3c9 1 15 7 16 16l-2 .2C18 11.7 12.3 6 4.8 5z"/><path d="M3.2 19.4 15.6 7l-2.3-.6 1-1 4.3 1.1 1.1 4.3-1 1-.6-2.3L5.6 21.8z"/>',
    br:{
      A:{name:'Långbåge', desc:'Mycket lång räckvidd och tunga pilar. Var fjärde pil blir en kritisk träff med trefaldig skada.', cost:230, range:6.4, rate:.62, dmg:30, shots:1, crit:.25, critX:3,
         icon:'<path d="M4 2c11 2 17 8 18 18h-2.4C18.6 11.6 13 6 4 4.6z"/><path d="M2 22 16 8l-3-1 1.3-1.3 4.9 1.1 1.1 4.9L19 13l-1-3L4 24z"/>'},
      B:{name:'Eldpilar', desc:'Tre brinnande pilar per salva. Elden bränner vidare och biter även på sköldar.', cost:230, range:4.6, rate:.46, dmg:10, shots:3, fire:9, fireDur:3,
         icon:'<path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-7 0 2 1 3 2 3 0-3 0-5 1-8z"/>'},
    }},
  catapult:{name:'Kastapult', short:'Katapult', desc:'Tunga stenar som träffar en hel grupp.', up:'Större explosion', air:false,
    cost:[110,130,190], range:[4.4,4.7,5.1], rate:[2.7,2.5,2.3], dmg:[22,36,55], splash:[1.15,1.6,2.1],
    icon:'<circle cx="16.5" cy="6.5" r="4"/><path d="M2 19h20v3H2zM4 18.5 13.8 9l1.9 1.9-9.6 9.5z"/>',
    br:{
      A:{name:'Storsten', desc:'Ett jätteblock som krossar ett enda mål. Bäst mot bossar och murbräckor.', cost:260, range:5.4, rate:2.5, dmg:210, splash:.85,
         icon:'<circle cx="12" cy="10" r="8"/><path d="M2 20h20v3H2z"/>'},
      B:{name:'Klusterbomb', desc:'Stenen spricker i sex mindre bomber som sprids över vägen.', cost:260, range:5.1, rate:2.3, dmg:40, splash:1.4, bombs:6, bombDmg:26, bombSplash:.95,
         icon:'<circle cx="7" cy="8" r="4"/><circle cx="17" cy="8" r="4"/><circle cx="12" cy="16" r="4"/>'},
    }},
  barracks:{name:'Riddarkasern', short:'Kasern', desc:'Riddare stoppar fienden på vägen och slåss. Flytta flaggan för att välja var de står.', up:'Fler och starkare riddare', air:false,
    cost:[90,100,150], range:[2.6,2.8,3.0], n:[3,4,5], hp:[42,62,92], dmg:[4,6,9], respawn:[8,7,6], move:2.8, armor:1,
    icon:'<path d="M12 2C7 2 4 6 4 11v6l3 3h3v-7h4v7h3l3-3v-6c0-5-3-9-8-9zm-1 3h2v6h-2z"/>',
    br:{
      A:{name:'Ryttare', desc:'Tre snabba ryttare som jagar fiender långt från flaggan och slår hårt.', cost:240, range:4.4, n:3, hp:150, dmg:20, respawn:6, move:6, armor:1, kind:'rider',
         icon:'<path d="M4 20l2-7 3-1 2-5 3-2 1 3 4 2-1 2-3-1-2 3 3 6h-2l-3-5-3 2-2 3z"/>'},
      B:{name:'Sköldvakter', desc:'Fem tunga vakter med tornsköldar. De tål dubbelt så mycket och håller linjen.', cost:240, range:3.0, n:5, hp:250, dmg:9, respawn:7, move:2.6, armor:.5, kind:'guard',
         icon:'<path d="M12 1 3 4.5v6.2C3 16.4 6.8 21.6 12 23c5.2-1.4 9-6.6 9-12.3V4.5z"/>'},
    }},
  mage:    {name:'Magitorn', short:'Magi', desc:'Saktar ner fienden och bränner den.', up:'Längre effekt och mer skada', air:true,
    cost:[100,110,170], range:[3.6,3.9,4.3], rate:[1.3,1.2,1.05], dmg:[5,8,12], slow:[.45,.5,.55], dur:[1.6,2.6,3.8], burn:[5,8,12],
    icon:'<path d="M12 1.5l2.6 6 6.4.9-4.9 4.3 1.4 6.3L12 15.8 6.5 19l1.4-6.3L3 8.4l6.4-.9z"/>',
    br:{
      A:{name:'Frost', desc:'Iskulor saktar ner kraftigt. Var tredje träff fryser fienden helt en stund.', cost:250, range:4.6, rate:.9, dmg:30, slow:.7, dur:3, freezeEvery:3, freeze:1.6, chill:1.3,
         icon:'<path d="M11 1h2v22h-2zM1 11h22v2H1zM4.2 5.6l1.4-1.4 14.2 14.2-1.4 1.4zM18.4 4.2l1.4 1.4L5.6 19.8l-1.4-1.4z"/>'},
      B:{name:'Blixt', desc:'En blixt som hoppar mellan upp till fem fiender.', cost:250, range:4.6, rate:1.15, dmg:36, chain:5, jump:2.4, fall:.8,
         icon:'<path d="M13 1 4 14h6l-2 9 10-13h-6z"/>'},
    }},
  cannon:  {name:'Kanontorn', short:'Kanon', desc:'Långsamt och tungt. Dubbel skada mot sköldbärare, murbräckor och bossar.', up:'Grövre kulor', air:false, need:7,
    cost:[150,150,220], range:[3.8,4.0,4.3], rate:[2.0,1.8,1.6], dmg:[42,66,100], splash:[.7,.8,.95], heavy:2,
    icon:'<path d="M3 15h4l11-7 3 4-11 7H6z"/><circle cx="7" cy="19" r="3"/>'},
  clock:   {name:'Klocktorn', short:'Klocka', desc:'Skjuter inte själv. Torn i närheten skjuter snabbare.', up:'Starkare klockslag', air:false, need:7, support:true,
    cost:[120,120,180], range:[2.9,3.2,3.5], haste:[.18,.26,.34],
    icon:'<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M11 6h2v6.6l4 2.4-1 1.7-5-3z"/>'},
};
export const TYPES = ['archer','catapult','barracks','mage','cannon','clock'];

/* ---------- fiender ----------
   fly: flyger (bara torn med air och pilregn når). heal: läker andra. sap: går på tornen. heavy: kanonen gör extra skada.
   hold: hur många riddare som behövs för att stoppa den. */
export const ET = {
  foot:    {name:'Fotsoldat',   hp:34,  spd:1.15, gold:6,   gate:1,  atk:5,  h:1.2, col:0xe0473c, css:'#e0473c',
            desc:'Vanlig soldat. Går mot porten och tar ett liv om han kommer fram.'},
  runner:  {name:'Löpare',      hp:18,  spd:2.1,  gold:5,   gate:1,  atk:3,  h:1.05,col:0xf08a2c, css:'#f08a2c',
            desc:'Snabb men svag. Bågskyttar hinner ifatt honom.'},
  shield:  {name:'Sköldbärare', hp:72,  spd:.9,   gold:10,  gate:1,  atk:6,  h:1.3, col:0x9aa3b2, css:'#9aa3b2', pierce:.5, heavy:true,
            desc:'Tålig. Pilar gör bara halv skada, men magi, stenar och kanoner biter.'},
  ram:     {name:'Murbräcka',   hp:150, spd:.62,  gold:18,  gate:4,  atk:8,  h:1.5, col:0x8a5a32, css:'#8a5a32', heavy:true,
            desc:'Långsam och seg. Tar fyra liv om den når porten.'},
  boss:    {name:'Krigsherren', hp:520, spd:.5,   gold:150, gate:10, atk:28, h:3.0, col:0x9e2620, css:'#9e2620', hold:3, boss:true, heavy:true,
            desc:'Bossen. Tar tio liv vid porten och kräver tre riddare för att stoppas.'},
  gargoyle:{name:'Gargoyl',     hp:40,  spd:1.55, gold:9,   gate:1,  atk:0,  h:2.6, col:0x6f6a86, css:'#7d78a0', fly:true,
            desc:'Flyger över vägen. Bara bågskyttar, magitorn och pilregn når den. Riddare och stenar missar.'},
  shaman:  {name:'Schaman',     hp:62,  spd:1.0,  gold:13,  gate:1,  atk:4,  h:1.35,col:0x3f9c5a, css:'#3f9c5a', heal:{r:2.3, pct:.07, every:2},
            desc:'Läker fiender omkring sig. Ta honom först.'},
  sapper:  {name:'Sappör',      hp:56,  spd:1.3,  gold:12,  gate:1,  atk:4,  h:1.15,col:0x6b4a2a, css:'#a0703c', sap:{seek:2.5, plant:1.6, stun:8},
            desc:'Springer fram till ett torn och spränger det ur spel en stund. Stoppa honom innan han når fram.'},
  troll:   {name:'Bergstrollet',hp:860, spd:.42, gold:220, gate:10, atk:34, h:3.3, col:0x7c8c6a, css:'#7c8c6a', hold:3, boss:true, heavy:true,
            desc:'Bergspassets boss. Mycket tålig och tar tio liv vid porten.'},
};

/* ---------- riken ---------- */
export const REALMS = [
  {name:'Ängslandet', theme:'meadow', first:0, last:7, end:'Riket är räddat!'},
  {name:'Bergspasset', theme:'snow', first:8, last:15, end:'Bergspasset är ditt!'},
];

/* ---------- banor ----------
   paths: vägar från skogsbrynet till porten. rivers: älvar som vägen går över på broar. passes: smala pass [väg, från, till] som andel av vägens längd. */
export const LEVELS = [
  {name:'Ängsvägen',     realm:0, W:8,  seed:11, lakes:2, paths:[[[-3,-18],[-3,-9],[4,-5],[4,0],[-3,3.5],[-3,8],[0,10.5],[0,12.6]]]},
  {name:'Bäckravinen',   realm:0, W:9,  seed:23, lakes:3, paths:[[[5,-18],[5,-10],[-4.5,-7],[-4.5,-2],[4.5,1],[4.5,5.5],[0,8],[0,12.6]]]},
  {name:'Klippkröken',   realm:0, W:9,  seed:37, lakes:1, paths:[[[0,-18],[0,-11.5],[-5.5,-9],[-5.5,-1],[0,1.5],[5.5,-1],[5.5,6],[0,8.5],[0,12.6]]]},
  {name:'Tvillingpasset',realm:0, W:10, seed:41, lakes:2, paths:[[[-5,-18],[-5,-8],[-1.5,-3],[0,3],[0,12.6]], [[5,-18],[5,-11],[2,-6],[1.5,-2],[0,3],[0,12.6]]]},
  {name:'Snäckan',       realm:0, W:10, seed:53, lakes:1, paths:[[[6.5,-18],[6.5,-11],[-5.5,-11],[-5.5,-4],[4.5,-4],[4.5,2.5],[-4.5,2.5],[-4.5,7.5],[0,9],[0,12.6]]]},
  {name:'Vadstället',    realm:0, W:11, seed:67, lakes:3, paths:[[[-2,-18],[-2,-12],[-6.5,-9],[-6.5,-3],[-1,0],[0,5],[0,12.6]], [[6.5,-18],[6.5,-6],[2,-4],[2,1],[0,5],[0,12.6]]]},
  {name:'Ormen',         realm:0, W:11, seed:71, lakes:0, paths:[[[-6,-18],[-6,-12],[6,-12],[6,-7.5],[-6,-7.5],[-6,-3],[6,-3],[6,1.5],[-5.5,1.5],[-5.5,6],[0,7.5],[0,12.6]]]},
  {name:'Kungens fall',  realm:0, W:12, seed:89, lakes:2, paths:[[[-6,-18],[-6,-9],[4.5,-4.5],[4.5,1],[0,5],[0,12.6]], [[6,-18],[6,-9],[-4.5,-4.5],[-4.5,1],[0,5],[0,12.6]]]},
  // Bergspasset
  {name:'Snöporten',     realm:1, W:10, seed:101, lakes:1, paths:[[[1,-18],[1,-12],[-5,-9.5],[-5,-3.5],[4.5,-1],[4.5,4.5],[0,7.5],[0,12.6]]],
    rivers:[[[-10,-6.6],[-3,-6.1],[3,-6.9],[10,-6.3]]]},
  {name:'Isbron',        realm:1, W:10, seed:113, diff:.88, lakes:1, paths:[[[-5.5,-18],[-5.5,-10],[5,-7.5],[5,-1.5],[-5,1.5],[-5,6],[0,8.5],[0,12.6]]],
    rivers:[[[-10,0],[0,-3.6],[10,-5]]], passes:[[0,.06,.2]]},
  {name:'Gruvgången',    realm:1, W:11, seed:127, lakes:0, paths:[[[5.5,-18],[5.5,-11],[-5.5,-10],[-5.5,-5],[2,-4],[5.5,-1],[5.5,3],[-4,4.5],[-4,8.5],[0,9.5],[0,12.6]]],
    passes:[[0,.2,.3],[0,.56,.63]]},
  {name:'Tvillingtopparna',realm:1, W:11, seed:131, lakes:1, paths:[[[-6,-18],[-6,-8],[-2,-4],[-2,2],[0,5],[0,12.6]], [[6,-18],[6,-11],[2.5,-7],[2.5,-1],[0,5],[0,12.6]]],
    rivers:[[[-10,-2.4],[10,-1.2]]]},
  {name:'Stupet',        realm:1, W:11, seed:149, diff:.82, lakes:0, paths:[[[-6,-18],[-6,-12.5],[5.5,-12],[5.5,-7.5],[-5.5,-6.5],[-5.5,-2],[5.5,-1],[5.5,3.5],[-3,4.5],[-3,8.5],[0,9.5],[0,12.6]]],
    rivers:[[[-10,1.4],[10,1.9]]], passes:[[0,.3,.4]]},
  {name:'Lavinbranten',  realm:1, W:12, seed:157, lakes:1, paths:[[[-2,-18],[-2,-11],[-6.5,-8],[-6.5,0],[-2,3],[0,6],[0,12.6]], [[6,-18],[6,-9],[1.5,-6],[1.5,-1],[5,2],[0,6],[0,12.6]]],
    passes:[[0,.25,.42]]},
  {name:'Drakskåran',    realm:1, W:12, seed:163, diff:.92, lakes:0, paths:[[[0,-18],[0,-12.5],[-6,-11],[-6,-6],[6,-4],[6,0],[-6,2],[-5,7],[0,8.5],[0,12.6]]],
    rivers:[[[-10,-8.5],[10,-8.4]],[[-10,4.6],[10,4.4]]]},
  {name:'Bergskungens borg',realm:1, W:12, seed:173, lakes:0, paths:[[[-6.5,-18],[-6.5,-10],[-2,-6.5],[-6,-2],[-4,4],[0,6.5],[0,12.6]], [[6.5,-18],[6.5,-10],[2,-6.5],[6,-2],[4,4],[0,6.5],[0,12.6]]],
    rivers:[[[-10,-4.1],[10,-4]]]},
];
export const NL = LEVELS.length;

/* ---------- vågrecept ----------
   waveAt(L, i, opt) bygger våg i (0-baserad) för bana L. opt.last: sista vågen (boss). opt.hero: hjältemod. opt.endless: ändlöst.
   Ängslandet följer exakt v1:s recept så att den balansen står kvar. */
// Hjältemod: tåligare och fler fiender, mindre guld och borgen har halva livet.
export const HERO = {hp:[1.6,1.18], n:1.25, gold:.85, life:.5};
export const ENDLESS = {grow:1.045, bossEvery:10, maxN:42};
function realm1(L, i, last, np, P){
  const g = [];
  g.push({t:'foot', n:Math.round(4 + i*1.2 + L*.9), gap:1.05, path:P(), at:0});
  if(i>=2 && (i%3!==0 || L>=2)) g.push({t:'runner', n:Math.round(3 + i*.7 + L*.6), gap:.5, path:P(), at:3.5});
  if(L>=1 && i>=(L===1?3:2)) g.push({t:'shield', n:Math.round(1 + i*.45 + L*.5), gap:1.5, path:P(), at:6});
  if(L>=2 && i>=(L===2?4:3)) g.push({t:'ram', n:Math.max(1, Math.round(i*.22 + L*.3)), gap:3.2, path:P(), at:9});
  if(last){ g.push({t:'boss', n:1, gap:1, path:0, at:12}); if(np>1 && L>=5) g.push({t:'boss', n:1, gap:1, path:1, at:22}); }
  return {g, hm:(1 + L*.28) * (1 + i*.12) * (np>1 ? .82 : 1)};
}
function realm2(L, i, last, np, P){
  const k = L-8, g = [];
  g.push({t:'foot', n:Math.round(4 + i*1.0 + k*.5), gap:1.0, path:P(), at:0});
  if(i>=1 && (L===8 ? true : (i%2===1 || i>=5))) g.push({t:'gargoyle', n:Math.round((L===8?4:2) + i*(L===8?.9:.55) + k*.3), gap:.85, path:P(), at:2});
  if(i>=2 && i%3!==1) g.push({t:'runner', n:Math.round(3 + i*.6 + k*.4), gap:.5, path:P(), at:4});
  if(i>=2) g.push({t:'shield', n:Math.round(1 + i*.4 + k*.35), gap:1.5, path:P(), at:6});
  if(L>=9 && i>=(L===9?2:3)) g.push({t:'shaman', n:Math.round(1 + i*.18 + k*.12), gap:2.4, path:P(), at:7});
  if(L>=10 && i>=2 && (L===10 || i%2===0)) g.push({t:'sapper', n:Math.round(1 + i*.28 + k*.18), gap:1.6, path:P(), at:5});
  if(i>=4) g.push({t:'ram', n:Math.max(1, Math.round(i*.18 + k*.2)), gap:3.2, path:P(), at:10});
  if(last){ g.push({t:'troll', n:1, gap:1, path:0, at:13}); if(np>1) g.push({t:'troll', n:1, gap:1, path:1, at:24}); }
  return {g, hm:(2.7 + k*.24) * (1 + i*.11) * (np>1 ? .85 : 1)};
}
export function waveAt(L, i, opt={}){
  const lv = LEVELS[L], np = lv.paths.length;
  let pi = i % np; const P = () => { const r = pi; pi = (pi+1)%np; return r; };
  const endless = !!opt.endless;
  const last = endless ? false : !!opt.last;
  const w = lv.realm===0 ? realm1(L, i, last, np, P) : realm2(L, i, last, np, P);
  if(endless){
    // Efter banans egna vågor växer tyngden för varje våg. Var tionde våg kommer bossen.
    const over = Math.max(0, i - lv.W + 1);
    w.hm *= Math.pow(ENDLESS.grow, over);
    if((i+1) % ENDLESS.bossEvery === 0){ const b = lv.realm===0 ? 'boss' : 'troll', nb = Math.ceil((i+1)/ENDLESS.bossEvery/2); w.g.push({t:b, n:nb, gap:6, path:0, at:12}); }
    for(const g of w.g) if(g.n > ENDLESS.maxN){ w.hm *= Math.sqrt(g.n/ENDLESS.maxN); g.n = ENDLESS.maxN; }
  }
  if(lv.diff) w.hm *= lv.diff;
  if(opt.hero){ w.hm *= HERO.hp[lv.realm] || HERO.hp[0]; for(const g of w.g) if(!ET[g.t].boss) g.n = Math.round(g.n*HERO.n); }
  return w;
}
export function makeWaves(L, opt={}){
  const W = LEVELS[L].W, out = [];
  for(let i=0;i<W;i++) out.push(waveAt(L, i, {...opt, last:i===W-1}));
  return out;
}
export function startGold(L, mode){
  const lv = LEVELS[L];
  let g = 210 + L*50 + (lv.paths.length>1 ? 80 : 0);
  if(lv.realm===1) g = 560 + (L-8)*45 + (lv.paths.length>1 ? 90 : 0);
  if(mode==='hero') g = Math.round(g*HERO.gold);
  return g;
}

/* ---------- Kungens råd: tio förbättringar ---------- */
export const UPG = {
  gold: {name:'Krigskassa',    desc:'Mer guld i början av varje bana', max:3, cost:[1,2,3], val:l=>l*50, fmt:v=>'+'+v+' guld',
         icon:'<circle cx="9" cy="9" r="6"/><circle cx="15" cy="15" r="6" opacity=".75"/>'},
  disc: {name:'Byggmästare',   desc:'Billigare torn och uppgraderingar', max:3, cost:[1,2,3], val:l=>l*6, fmt:v=>'−'+v+' %',
         icon:'<path d="M3 20 13.5 9.5l1 1L4 21zM12 4l8 8-3 3-8-8z"/>'},
  wall: {name:'Tjocka murar',  desc:'Borgen tål fler fiender', max:3, cost:[1,2,2], val:l=>20+l*4, fmt:v=>v+' liv',
         icon:'<path d="M3 21V9l3 2V6l3 2V3h6v5l3-2v5l3-2v12z"/>'},
  rain: {name:'Regn av pilar', desc:'Mer skada, större yta, kortare väntan', max:3, cost:[1,2,3], val:l=>l, fmt:v=>`${70+v*35} skada · ${32-v*5} s`,
         icon:'<path d="M5 2h2v10l2-2v3l-3 3-3-3v-3l2 2zM11 5h2v10l2-2v3l-3 3-3-3v-3l2 2zM17 2h2v10l2-2v3l-3 3-3-3v-3l2 2z"/>'},
  train:{name:'Riddarskolan',  desc:'Riddarna tål mer och slår hårdare', max:3, cost:[1,2,3], val:l=>l*20, fmt:v=>'+'+v+' %',
         icon:'<path d="M12 1 3 4.5v6.2C3 16.4 6.8 21.6 12 23c5.2-1.4 9-6.6 9-12.3V4.5z"/>'},
  arch: {name:'Skarpa pilar',  desc:'Bågskyttetornen gör mer skada', max:3, cost:[1,2,3], val:l=>l*12, fmt:v=>'+'+v+' %',
         icon:'<path d="M3.2 19.4 15.6 7l-2.3-.6 1-1 4.3 1.1 1.1 4.3-1 1-.6-2.3L5.6 21.8z"/>'},
  siege:{name:'Tunga stenar',  desc:'Kastapulter och kanoner gör mer skada', max:3, cost:[1,2,3], val:l=>l*12, fmt:v=>'+'+v+' %',
         icon:'<circle cx="12" cy="12" r="8"/>'},
  magic:{name:'Trollformler',  desc:'Magitornen gör mer skada och saktar ner längre', max:3, cost:[1,2,3], val:l=>l*12, fmt:v=>'+'+v+' %',
         icon:'<path d="M12 1.5l2.6 6 6.4.9-4.9 4.3 1.4 6.3L12 15.8 6.5 19l1.4-6.3L3 8.4l6.4-.9z"/>'},
  tax:  {name:'Skattkammaren', desc:'Guld varje gång du startar en våg', max:3, cost:[1,2,3], val:l=>l*10, fmt:v=>'+'+v+' guld per våg',
         icon:'<path d="M3 10h18v11H3zM2 6l10-4 10 4v3H2z"/>'},
  eng:  {name:'Ingenjörer',    desc:'Torn som sappörer spränger kommer tillbaka snabbare', max:3, cost:[1,2,2], val:l=>8-l*2, fmt:v=>v+' s ur spel',
         icon:'<path d="M14 3a5 5 0 0 0-4.6 6.9L3 16.3 7.7 21l6.4-6.4A5 5 0 0 0 21 10l-3 3-3-1-1-3 3-3a5 5 0 0 0-3-3z"/>'},
};
export const UPG_KEYS = Object.keys(UPG);

/* ---------- sparning ---------- */
export const SAVE_KEY = 'borgvaktaren.v2', OLD_KEY = 'borgvaktaren.v1';
