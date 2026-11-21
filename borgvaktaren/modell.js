// Borgväktaren – modell.js
// Ren spellogik utan Three.js: vägar, byggplatser, vågor, fiender, torn, riddare, projektiler, sparning.
// Samma kod körs i webbläsaren (index.html) och i Node (sim.mjs). Effekter går via FX, som index.html fyller i.
import { STEP, CASTLE_Z, SELL_BACK, TT, TYPES, ET, LEVELS, NL, REALMS, UPG, UPG_KEYS, waveAt, makeWaves, startGold, HERO, SAVE_KEY, OLD_KEY } from './data.js';
export * from './data.js';

export const TAU = Math.PI*2;
export const clamp = (v,a,b) => v<a?a:v>b?b:v;
export function rng(seed){ let s = seed>>>0; return () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s>>>15, 1|s); t = t + Math.imul(t ^ t>>>7, 61|t) ^ t; return ((t ^ t>>>14)>>>0)/4294967296; }; }

/* ================= Effekter (fylls i av index.html) ================= */
const noop = () => {};
export const FX = { burst:noop, snd:noop, float:noop, coin:noop, shake:noop, tower:noop, towerGone:noop, castleHit:noop, hud:noop,
  banner:noop, cards:noop, win:noop, lose:noop, persist:noop, heal:noop, sapBoom:noop, waveStart:noop };

/* ================= Sparning ================= */
export const S = { save:null };
export function freshSave(){
  return {v:2, unlocked:1, stars:Array(NL).fill(0), starsH:Array(NL).fill(0), best:Array(NL).fill(0),
    upg:Object.fromEntries(UPG_KEYS.map(k=>[k,0])), mute:false, music:true, tut:0, seen:[]};
}
const pad = (a, n) => (Array.isArray(a) ? a.map(v=>+v||0) : []).concat(Array(n).fill(0)).slice(0, n);
export function normalizeSave(s){
  const d = freshSave();
  const o = {...d, ...s, v:2};
  o.stars = pad(s.stars, NL).map(v=>clamp(v,0,3)); o.starsH = pad(s.starsH, NL).map(v=>clamp(v,0,3)); o.best = pad(s.best, NL);
  o.upg = {...d.upg}; for(const k of UPG_KEYS) o.upg[k] = clamp((s.upg && +s.upg[k])||0, 0, UPG[k].max);
  o.unlocked = clamp(+s.unlocked||1, 1, NL);
  o.seen = Array.isArray(s.seen) ? s.seen.filter(t=>ET[t]) : [];
  return o;
}
// v1 hade 8 banor, 5 förbättringar och nyckeln borgvaktaren.v1. Allt flyttas över, v1-nyckeln lämnas orörd.
export function migrateV1(v1){
  const s = freshSave();
  const st = pad(v1.stars, 8);
  for(let i=0;i<8;i++) s.stars[i] = clamp(st[i],0,3);
  s.unlocked = clamp(+v1.unlocked||1, 1, 8);
  if(s.stars[7] > 0) s.unlocked = 9;
  for(const k of ['gold','disc','wall','rain','train']) s.upg[k] = clamp((v1.upg && +v1.upg[k])||0, 0, UPG[k].max);
  s.mute = !!v1.mute; s.tut = +v1.tut||0;
  const seen = new Set();
  for(let L=0; L<8; L++) if(s.stars[L]>0) for(const w of makeWaves(L)) for(const g of w.g) seen.add(g.t);
  s.seen = [...seen]; s.migrated = 'v1';
  return s;
}
export function loadSaveFrom(get){
  try{ const raw = get(SAVE_KEY); if(raw){ const s = JSON.parse(raw); if(s && s.upg) return normalizeSave(s); } }catch(e){}
  try{ const raw = get(OLD_KEY); if(raw){ const s = JSON.parse(raw); if(s && s.upg) return normalizeSave(migrateV1(s)); } }catch(e){}
  return freshSave();
}
S.save = freshSave();

export const upgVal = k => UPG[k].val(S.save.upg[k]);
export const starsTotal = () => S.save.stars.reduce((a,b)=>a+b,0) + S.save.starsH.reduce((a,b)=>a+b,0);
export const starsSpent = () => UPG_KEYS.reduce((s,k)=>s + UPG[k].cost.slice(0,S.save.upg[k]).reduce((a,b)=>a+b,0), 0);
export const starsFree = () => starsTotal() - starsSpent();
export function price(type, l, br){
  const base = l<3 ? TT[type].cost[l] : TT[type].br[br].cost;
  return Math.round(base * (1 - upgVal('disc')/100));
}
export function towerUnlocked(type){ const n = TT[type].need; return n===undefined || S.save.stars[n] > 0; }
export const rainStats = () => { const l = S.save.upg.rain; return {dmg:70+l*35, r:2.2+l*.3, cd:32-l*5}; };

/* ================= Vägar ================= */
// Centripetal Catmull-Rom (samma kurva som Three.js CatmullRomCurve3), omsamplad med jämnt avstånd STEP.
export function buildPath(pts){
  const n = pts.length;
  const P = i => i<0 ? [2*pts[0][0]-pts[1][0], 2*pts[0][1]-pts[1][1]] : i>n-1 ? [2*pts[n-1][0]-pts[n-2][0], 2*pts[n-1][1]-pts[n-2][1]] : pts[i];
  const SUB = 160, rx = [], rz = [];
  for(let s=0; s<n-1; s++){
    const p0=P(s-1), p1=P(s), p2=P(s+1), p3=P(s+2);
    const d = (a,b) => Math.pow((a[0]-b[0])**2 + (a[1]-b[1])**2, .25);
    let dt0 = d(p0,p1), dt1 = d(p1,p2), dt2 = d(p2,p3);
    if(dt1 < 1e-4) dt1 = 1; if(dt0 < 1e-4) dt0 = dt1; if(dt2 < 1e-4) dt2 = dt1;
    const cf = (x0,x1,x2,x3) => {
      let t1 = (x1-x0)/dt0 - (x2-x0)/(dt0+dt1) + (x2-x1)/dt1, t2 = (x2-x1)/dt1 - (x3-x1)/(dt1+dt2) + (x3-x2)/dt2;
      t1 *= dt1; t2 *= dt1;
      return [x1, t1, -3*x1 + 3*x2 - 2*t1 - t2, 2*x1 - 2*x2 + t1 + t2];
    };
    const cx = cf(p0[0],p1[0],p2[0],p3[0]), cz = cf(p0[1],p1[1],p2[1],p3[1]);
    for(let k=0; k<SUB; k++){ const u = k/SUB, u2 = u*u, u3 = u2*u; rx.push(cx[0]+cx[1]*u+cx[2]*u2+cx[3]*u3); rz.push(cz[0]+cz[1]*u+cz[2]*u2+cz[3]*u3); }
  }
  rx.push(pts[n-1][0]); rz.push(pts[n-1][1]);
  const m = rx.length, cum = new Float64Array(m);
  for(let i=1;i<m;i++) cum[i] = cum[i-1] + Math.hypot(rx[i]-rx[i-1], rz[i]-rz[i-1]);
  const len = cum[m-1], N = Math.ceil(len/STEP)+1;
  const x = new Float32Array(N), z = new Float32Array(N), tx = new Float32Array(N), tz = new Float32Array(N);
  let j = 0;
  for(let i=0;i<N;i++){
    const dd = Math.min(len, i*STEP*len/((N-1)*STEP));
    while(j < m-2 && cum[j+1] < dd) j++;
    const seg = cum[j+1]-cum[j] || 1, k = (dd-cum[j])/seg;
    x[i] = rx[j] + (rx[j+1]-rx[j])*k; z[i] = rz[j] + (rz[j+1]-rz[j])*k;
  }
  for(let i=0;i<N;i++){
    const a = Math.max(0,i-1), b = Math.min(N-1,i+1), dx = x[b]-x[a], dz = z[b]-z[a], l = Math.hypot(dx,dz)||1;
    tx[i] = dx/l; tz[i] = dz/l;
  }
  return {x,z,tx,tz,n:N,len:(N-1)*STEP};
}
export const _pa = {x:0,z:0,tx:0,tz:1};
export function pathAt(p, d, off, out=_pa){
  let f = d/STEP; if(f<0) f=0; if(f>p.n-1.001) f=p.n-1.001;
  const i = f|0, k = f-i;
  const x = p.x[i]+(p.x[i+1]-p.x[i])*k, z = p.z[i]+(p.z[i+1]-p.z[i])*k, tx = p.tx[i], tz = p.tz[i];
  out.x = x - tz*off; out.z = z + tx*off; out.tx = tx; out.tz = tz;
  return out;
}
export function minPathDist(paths, x, z, stepI=3){
  let m = 1e9;
  for(const p of paths) for(let i=0;i<p.n;i+=stepI){ const dx=p.x[i]-x, dz=p.z[i]-z, d=dx*dx+dz*dz; if(d<m) m=d; }
  return Math.sqrt(m);
}
export function segDist(px,pz, ax,az, bx,bz){
  const dx=bx-ax, dz=bz-az, l2=dx*dx+dz*dz||1; let t=((px-ax)*dx+(pz-az)*dz)/l2; t=clamp(t,0,1);
  return Math.hypot(px-(ax+dx*t), pz-(az+dz*t));
}
export function polyDist(poly, x, z){ let m = 1e9; for(let i=0;i<poly.length-1;i++) m = Math.min(m, segDist(x,z, poly[i][0],poly[i][1], poly[i+1][0],poly[i+1][1])); return m; }
export const RIVER_W = 1.9;

/* ================= Banbygge (data) ================= */
export const LV = {paths:[], spots:[], entries:[], lakes:[], rivers:[], passPts:[], bridges:[], L:0};
export function buildLevelData(L){
  const lv = LEVELS[L], R = rng(lv.seed);
  const paths = lv.paths.map(buildPath);
  const rivers = (lv.rivers||[]);
  // smala pass: punkter längs vägen där klippor står tätt
  const passPts = [];
  for(const [pi,a,b] of (lv.passes||[])){ const p = paths[pi]; for(let d=a*p.len; d<=b*p.len; d+=.5){ pathAt(p,d,0); passPts.push([_pa.x,_pa.z,_pa.tx,_pa.tz]); } }
  const riverD = (x,z) => rivers.length ? Math.min(...rivers.map(r=>polyDist(r,x,z))) : 1e9;
  const passD = (x,z) => { let m = 1e9; for(const q of passPts){ const d = (q[0]-x)**2+(q[1]-z)**2; if(d<m) m=d; } return Math.sqrt(m); };
  const spots = [];
  const okSpot = (x,z) => Math.abs(x)<=7.2 && z>=-12.4 && z<=10.4 && !(z>8.8 && Math.abs(x)<5.2) && minPathDist(paths,x,z,2)>=1.95
    && spots.every(s=>(s.x-x)**2+(s.z-z)**2>=2.3*2.3) && riverD(x,z) > RIVER_W/2+1.0 && passD(x,z) > 2.7;
  let side = 1;
  for(const p of paths){
    for(let d=2.2; d<p.len-2.5; d+=1.5){
      pathAt(p,d,0); const px=_pa.x, pz=_pa.z, nx=-_pa.tz, nz=_pa.tx;
      let placed = false;
      for(const s of [side,-side]){ for(const off of [2.2,2.6,3.0]){ const x=px+nx*off*s, z=pz+nz*off*s; if(okSpot(x,z)){ spots.push({x,z,d}); side=-s; placed=true; break; } } if(placed) break; }
    }
  }
  const cap = paths.length>1 ? 14 : 12;
  const chosen = spots.length<=cap ? spots : Array.from({length:cap},(_,i)=>spots[Math.round(i*(spots.length-1)/(cap-1))]);
  const outSpots = chosen.map((s,i)=>({x:s.x, z:s.z, d:s.d, i, tower:null}));
  // sjöar (i Bergspasset: isade tjärnar)
  const lakes = [];
  for(let k=0, tries=0; k<(lv.lakes||0) && tries<300; tries++){
    const r = .9+R()*1.2, x = (R()*2-1)*7.5, z = -12+R()*21;
    if(minPathDist(paths,x,z,3) < r+1.6) continue;
    if(outSpots.some(s=>Math.hypot(s.x-x,s.z-z) < r+1.2)) continue;
    if(lakes.some(l=>Math.hypot(l.x-x,l.z-z) < r+l.r+1)) continue;
    if(riverD(x,z) < r+RIVER_W) continue;
    if(z>9 && Math.abs(x)<6) continue;
    lakes.push({x,z,r,lily:[R(),R(),R(),R(),R(),R()]}); k++;
  }
  // broar: där vägen korsar en älv
  const bridges = [];
  paths.forEach((p,pi)=>{
    let inR = false, a = 0;
    for(let i=0;i<p.n;i+=2){
      const w = riverD(p.x[i], p.z[i]) < RIVER_W/2 + .9;
      if(w && !inR){ inR = true; a = i*STEP; } else if(!w && inR){ inR = false; bridges.push({path:pi, a:Math.max(0,a-.3), b:Math.min(p.len, i*STEP+.3)}); }
    }
  });
  const entries = paths.map(p=>{ let d = 0; while(d<p.len && pathAt(p,d,0).z < -12.6) d += .2; pathAt(p,d,0); return [_pa.x, _pa.z]; });
  return {L, paths, spots:outSpots, lakes, rivers, passPts, bridges, entries, rng:R};
}

/* ================= Speltillstånd ================= */
export const G = {mode:'menu', variant:'normal', L:0, waves:[], W:0, wave:0, hp:20, hpMax:20, gold:0, spawners:[], waveReady:false, countdown:Infinity,
  enemies:[], towers:[], knights:[], projs:[], rains:[], zaps:[], T:0, over:false, won:false, rainCd:0, kills:0, leaked:0, stat:null, rng:Math.random, attractT:0, seed:0};

export function getWave(i){
  if(G.variant==='endless'){ while(G.waves.length<=i) G.waves.push(waveAt(G.L, G.waves.length, {endless:true})); }
  return G.waves[i];
}
export function loadLevel(L, mode, variant='normal', seed=0){
  G.L = L; G.mode = mode; G.variant = variant; G.over = false; G.won = false; G.seed = seed;
  Object.assign(LV, buildLevelData(L));
  G.towers = []; G.knights = []; G.enemies = []; G.projs = []; G.rains = []; G.spawners = []; G.zaps = [];
  G.rng = rng(LEVELS[L].seed*7919 + seed*104729 + 17);
  if(variant==='endless'){ G.waves = []; G.W = Infinity; }
  else { G.waves = makeWaves(L, {hero:variant==='hero'}); G.W = G.waves.length; }
  G.wave = 0; G.waveReady = true; G.countdown = Infinity;
  G.hpMax = G.hp = variant==='hero' ? Math.round(upgVal('wall')*HERO.life) : upgVal('wall');
  G.gold = startGold(L, variant) + upgVal('gold');
  G.rainCd = 0; G.kills = 0; G.leaked = 0; G.T = 0; G.attractT = 0;
  G.stat = {dmg:{}, earned:0, spent:0, leakedN:0, kills:0, start:G.gold};
}
export function waveTypes(w){ const m = new Map(); for(const g of w.g){ m.set(g.t, (m.get(g.t)||0) + g.n); } return [...m].map(([t,n])=>({t,n})); }
export function nextWaveInfo(){
  if(G.over || G.wave >= G.W) return null;
  const w = getWave(G.wave);
  return {types:waveTypes(w), paths:[...new Set(w.g.map(g=>Math.min(g.path, LV.paths.length-1)))], boss:w.g.some(g=>ET[g.t].boss), hm:w.hm};
}
export function startWave(){
  if(!G.waveReady || G.over || G.wave >= G.W) return null;
  let bonus = 0, tax = 0;
  const play = G.mode==='play';
  if(G.wave>0 && isFinite(G.countdown) && play){ bonus = Math.round(G.countdown*1.5); if(bonus>0){ G.gold += bonus; G.stat.earned += bonus; } }
  if(play){ tax = upgVal('tax'); G.gold += tax; G.stat.earned += tax; }
  const w = getWave(G.wave); G.wave++;
  for(const g of w.g) G.spawners.push({t:g.t, left:g.n, gap:g.gap, path:Math.min(g.path, LV.paths.length-1), timer:g.at, hm:w.hm});
  G.waveReady = false; G.countdown = Infinity;
  let fresh = [];
  if(play){
    const seen = new Set(S.save.seen);
    fresh = waveTypes(w).map(o=>o.t).filter(t=>!seen.has(t));
    if(fresh.length){ S.save.seen.push(...fresh); FX.persist(); }
  }
  FX.waveStart(bonus, tax, fresh);
  return {bonus, tax, fresh};
}

/* ================= Torn ================= */
export function tstat(t){
  const T = TT[t.type];
  if(t.lvl>=3) return T.br[t.br];
  const o = {}; for(const k in T) if(Array.isArray(T[k])) o[k] = T[k][t.lvl];
  return o;
}
function dmgMul(type){
  if(type==='archer') return 1 + upgVal('arch')/100;
  if(type==='catapult' || type==='cannon') return 1 + upgVal('siege')/100;
  if(type==='mage') return 1 + upgVal('magic')/100;
  return 1;
}
export function nearestPathPoint(x,z){
  let best = 1e9, bx = x, bz = z;
  for(const p of LV.paths) for(let i=0;i<p.n;i+=2){ const dx=p.x[i]-x, dz=p.z[i]-z, d=dx*dx+dz*dz; if(d<best){ best=d; bx=p.x[i]; bz=p.z[i]; } }
  return [bx,bz];
}
export const RALLY_MAX = 3.9;
export function canRally(t, x, z){
  let best = null, bd = 1e9;
  for(const p of LV.paths) for(let i=0;i<p.n;i+=2){
    const px = p.x[i], pz = p.z[i];
    if((px-t.x)**2 + (pz-t.z)**2 > RALLY_MAX*RALLY_MAX) continue;
    const d = (px-x)**2 + (pz-z)**2; if(d<bd){ bd = d; best = [px,pz]; }
  }
  return best;
}
export function setRally(t, x, z){
  const r = canRally(t, x, z); if(!r) return false;
  t.rally = r; layoutKnights(t);
  for(const k of t.knights) release(k);
  return true;
}
export function placeTower(spot, type){
  const cost = price(type,0);
  if(spot.tower || G.gold < cost || !towerUnlocked(type)) return false;
  G.gold -= cost; G.stat.spent += cost;
  const t = {type, lvl:0, br:null, x:spot.x, z:spot.z, spot, spent:cost, cd:.3, knights:[], aimYaw:0, fire:0, haste:1, stun:0, sapBy:null, shotN:0, lastRate:1};
  t.st = tstat(t);
  if(type==='barracks'){ t.rally = nearestPathPoint(spot.x, spot.z); }
  spot.tower = t;
  G.towers.push(t);
  if(type==='barracks') syncKnights(t);
  FX.tower(t, 'build');
  return true;
}
export function upgradeTower(t, br){
  if(t.lvl>=3) return false;
  if(t.lvl===2 && !TT[t.type].br) return false;
  if(t.lvl===2 && br!=='A' && br!=='B') return false;
  const cost = price(t.type, t.lvl+1, br); if(G.gold < cost) return false;
  G.gold -= cost; G.stat.spent += cost; t.spent += cost; t.lvl++;
  if(t.lvl===3) t.br = br;
  t.st = tstat(t);
  if(t.type==='barracks') syncKnights(t, true);
  FX.tower(t, 'up');
  return true;
}
export const maxLevel = t => TT[t.type].br ? 3 : 2;
export function sellTower(t){
  const back = Math.round(t.spent*SELL_BACK);
  G.gold += back; G.stat.spent -= back;
  for(const k of t.knights){ release(k); k.gone = true; }
  G.knights = G.knights.filter(k=>!k.gone);
  if(t.sapBy){ t.sapBy.sapT = null; t.sapBy = null; }
  t.spot.tower = null;
  G.towers = G.towers.filter(o=>o!==t);
  FX.towerGone(t, back);
  return back;
}
export function knightStats(t){
  const s = t.st, m = 1 + upgVal('train')/100;
  return {hp:s.hp*m, dmg:s.dmg*m, n:s.n, respawn:s.respawn, move:s.move||2.8, armor:s.armor||1, range:s.range, kind:s.kind||'knight'};
}
function layoutKnights(t){
  const [rx,rz] = t.rally, n = t.knights.length;
  t.knights.forEach((k,i)=>{ const a = i/n*TAU + .4, r = n>4 ? .7 : .55; k.hx = rx + Math.cos(a)*r; k.hz = rz + Math.sin(a)*r; });
}
export function syncKnights(t, reset){
  const ks = knightStats(t);
  if(reset && ks.kind !== (t.knights[0] && t.knights[0].kind)){ for(const k of t.knights){ release(k); k.gone = true; } G.knights = G.knights.filter(k=>!k.gone); t.knights = []; }
  while(t.knights.length > ks.n){ const k = t.knights.pop(); release(k); k.gone = true; G.knights = G.knights.filter(o=>o!==k); }
  while(t.knights.length < ks.n){ const k = {t, x:t.x, z:t.z, hp:ks.hp, max:ks.hp, target:null, cd:0, dead:false, respawn:0, ph:G.rng()*6, yaw:0, gone:false, kind:ks.kind}; t.knights.push(k); G.knights.push(k); }
  for(const k of t.knights){ k.max = ks.hp; k.hp = ks.hp; k.dmg = ks.dmg; k.kind = ks.kind; }
  layoutKnights(t);
}
function release(k){ if(k.target){ k.target.holders = Math.max(0, k.target.holders-1); k.target = null; } }

/* ================= Fiender ================= */
export function spawnEnemy(type, path, hm){
  const et = ET[type], p = LV.paths[path], R = G.rng;
  const big = !!et.boss || type==='ram';
  const hpm = et.boss ? hm*(1+G.L*.15) : hm;
  const e = {type, et, p, d:0, off:big ? 0 : (R()-.5), hp:et.hp*hpm, max:et.hp*hpm, spd:et.spd*(.95+R()*.1)*(big ? Math.max(1, p.len/48) : 1),
    slowT:0, slowF:0, burnT:0, burnD:0, fireT:0, fireD:0, freezeT:0, held:false, holders:0, x:0, z:0, tx:0, tz:1, ph:R()*6, alive:true, flash:0,
    gold:Math.round(et.gold*(1+G.L*.08)), healT:R()*1.5, sapS:0, sapT:null, sapCd:0, plantT:0, fly:!!et.fly};
  pathAt(p, 0, e.off); e.x=_pa.x; e.z=_pa.z;
  G.enemies.push(e);
  if(et.boss && G.mode==='play'){ FX.shake(.4); FX.snd('horn'); }
  return e;
}
export function hurt(e, dmg, kind, src){
  if(!e.alive) return;
  if(kind==='pierce' && e.et.pierce) dmg *= e.et.pierce;
  if(kind==='heavy' && e.et.heavy) dmg *= TT.cannon.heavy;
  const real = Math.min(dmg, e.hp);
  e.hp -= dmg; e.flash = .1;
  if(src && G.stat) G.stat.dmg[src] = (G.stat.dmg[src]||0) + real;
  if(e.hp <= 0) kill(e);
}
function kill(e){
  e.alive = false; G.kills++; G.stat.kills++;
  if(e.sapT){ if(e.sapT.sapBy===e) e.sapT.sapBy = null; e.sapT = null; }
  if(G.mode==='play'){ G.gold += e.gold; G.stat.earned += e.gold; FX.coin(e.x, .8, e.z); }
  const big = e.et.boss ? 40 : e.type==='ram' ? 20 : 9;
  FX.burst(e.x, e.fly?2:.7, e.z, e.et.col, big, e.et.boss?6:3.4, e.et.boss?.3:.15, .6);
  FX.burst(e.x, .5, e.z, 0xffffff, 3, 2, .1, .3);
  if(e.et.boss){ FX.shake(.6); FX.snd('boom'); } else FX.snd('die');
}
function hurtCastle(e){
  e.alive = false; G.leaked += e.et.gate; G.stat.leakedN++;
  if(e.sapT){ if(e.sapT.sapBy===e) e.sapT.sapBy = null; e.sapT = null; }
  if(G.mode!=='play'){ FX.burst(e.x,1,e.z,0xffffff,4,3,.12,.4); return; }
  G.hp = Math.max(0, G.hp - e.et.gate);
  FX.castleHit(e);
  if(G.hp <= 0) lose();
}
function fireProj(kind, x0,y0,z0, target, tx,tz, dur, h, dmg, extra, src){
  G.projs.push({kind, x0,y0,z0, target, tx, ty:target ? (target.fly ? 2.1 : .6) : 0, tz, t:0, dur, h, dmg, extra, src, px:x0, py:y0, pz:z0, dx:0, dy:0, dz:1});
}
function predict(e, dt){ const o = {}; const sp = (e.held||e.freezeT>0||e.sapS>0) ? 0 : e.spd*(e.slowT>0?1-e.slowF:1); pathAt(e.p, e.d + sp*dt, e.off, o); if(e.sapS>0){ o.x = e.x; o.z = e.z; } return o; }

/* ================= Uppdatering ================= */
export function update(dt){
  G.T += dt;
  const play = G.mode==='play' || G.mode==='attract';
  if(!play) return;
  const R = G.rng;
  // vågor
  for(const s of G.spawners){
    s.timer -= dt;
    while(s.left>0 && s.timer<=0){ spawnEnemy(s.t, s.path, s.hm); s.left--; s.timer += s.gap; }
  }
  G.spawners = G.spawners.filter(s=>s.left>0);
  if(!G.over && !G.waveReady && G.spawners.length===0 && G.wave < G.W){
    G.waveReady = true; G.countdown = G.mode==='attract' ? 2 : 20; FX.hud();
  }
  if(G.waveReady && isFinite(G.countdown)){
    G.countdown -= dt;
    if(G.countdown <= 0){ G.countdown = Infinity; startWave(); }
  }
  if(G.mode==='attract' && G.wave===0 && G.waveReady){ G.attractT += dt; if(G.attractT>1.5){ G.attractT = 0; startWave(); } }
  if(G.rainCd>0) G.rainCd = Math.max(0, G.rainCd - dt);

  // klocktorn: torn i närheten skjuter snabbare
  for(const t of G.towers) t.haste = 1;
  for(const c of G.towers){
    if(c.type!=='clock' || c.stun>0) continue;
    const r2 = c.st.range**2, h = 1 + c.st.haste;
    for(const t of G.towers) if(t!==c && t.type!=='clock' && (t.x-c.x)**2+(t.z-c.z)**2 <= r2) t.haste = Math.max(t.haste, h);
  }

  // riddare
  for(const e of G.enemies) e.held = false;
  for(const k of G.knights){
    const t = k.t, ks = t.st;
    if(k.dead){ if(!(t.stun>0)) k.respawn -= dt; if(k.respawn<=0){ k.dead=false; k.hp=k.max; k.x=t.x; k.z=t.z; } continue; }
    const RG = ks.range, [rx,rz] = t.rally, move = ks.move||2.8, armor = ks.armor||1;
    let e = k.target;
    if(e && (!e.alive || (e.x-rx)**2+(e.z-rz)**2 > (RG+1.2)**2)){ release(k); e = null; }
    if(!e){
      let best = null, bd = 1e9;
      for(const o of G.enemies){
        if(!o.alive || o.fly || o.holders >= (o.et.hold||1)) continue;
        const dr = (o.x-rx)**2 + (o.z-rz)**2; if(dr > RG*RG) continue;
        const dk = (o.x-k.x)**2 + (o.z-k.z)**2; if(dk < bd){ bd = dk; best = o; }
      }
      if(best){ k.target = best; best.holders++; e = best; }
    }
    let tx = k.hx, tz = k.hz, close = false;
    if(e){
      const dx = e.x-k.x, dz = e.z-k.z, d = Math.hypot(dx,dz), reach = e.et.boss ? 1.1 : e.type==='ram' ? .9 : .6;
      if(d <= reach+.05){ close = true; tx = k.x; tz = k.z; e.held = true; } else { tx = e.x - dx/d*reach; tz = e.z - dz/d*reach; }
      k.yaw = Math.atan2(-dx,-dz);
      if(close){
        k.cd -= dt;
        if(k.cd <= 0){ k.cd = k.kind==='rider' ? .6 : .75; hurt(e, k.dmg, 'melee', 'barracks'); FX.burst((e.x+k.x)/2,.7,(e.z+k.z)/2, R()<.5?0xffe08a:0xffffff, 4, 2.6, .1, .3); FX.snd('clash'); }
        k.hp -= e.et.atk*dt*armor / Math.max(1, e.holders);
        if(k.hp <= 0){ k.dead = true; k.respawn = ks.respawn; release(k); FX.burst(k.x,.6,k.z,0x2f6be0,12,3,.15,.6); }
      }
    } else if(k.hp < k.max) k.hp = Math.min(k.max, k.hp + 6*dt);
    if(!close){
      const dx = tx-k.x, dz = tz-k.z, d = Math.hypot(dx,dz);
      if(d > .05){ const s = Math.min(d, move*dt); k.x += dx/d*s; k.z += dz/d*s; if(!e) k.yaw = Math.atan2(-dx,-dz); k.ph += dt*12; }
    }
  }

  // fiender
  for(const e of G.enemies){
    if(!e.alive) continue;
    if(e.burnT>0){ e.burnT -= dt; hurt(e, e.burnD*dt, 'magic', 'mage'); if(!e.alive) continue; if(R()<dt*6) FX.burst(e.x,e.fly?2.2:.9,e.z,0xb07bff,1,1,.1,.5,2,-2); }
    if(e.fireT>0){ e.fireT -= dt; hurt(e, e.fireD*dt, 'fire', 'archer'); if(!e.alive) continue; if(R()<dt*8) FX.burst(e.x,e.fly?2.2:.9,e.z,0xff8a2c,1,1,.12,.45,2.5,-2); }
    let sp = e.spd;
    if(e.slowT>0){ e.slowT -= dt; sp *= 1 - e.slowF*(e.et.boss?.5:1); }
    let frozen = false;
    if(e.freezeT>0){ e.freezeT -= dt; frozen = true; }
    if(e.flash>0) e.flash -= dt;
    // schaman läker
    const hl = e.et.heal;
    if(hl){
      e.healT += dt;
      if(e.healT >= hl.every){
        e.healT = 0; let any = false;
        for(const o of G.enemies){ if(!o.alive || o.hp>=o.max) continue; if((o.x-e.x)**2+(o.z-e.z)**2 > hl.r*hl.r) continue; o.hp = Math.min(o.max, o.hp + o.max*hl.pct); any = true; }
        FX.heal(e, any);
      }
    }
    // sappör: lämnar vägen och går mot ett torn
    const sp2 = e.et.sap;
    if(sp2){
      if(e.sapS===0){
        e.sapCd -= dt;
        if(e.sapCd<=0){
          e.sapCd = .25; let best = null, bd = sp2.seek*sp2.seek;
          for(const t of G.towers){ if(t.stun>0 || t.sapBy) continue; const d = (t.x-e.x)**2+(t.z-e.z)**2; if(d<bd){ bd = d; best = t; } }
          if(best){ e.sapS = 1; e.sapT = best; best.sapBy = e; }
        }
      }
      if(e.sapS===1 || e.sapS===3){
        let gx, gz;
        if(e.sapS===1){ if(!e.sapT || !G.towers.includes(e.sapT)){ e.sapS = 3; e.sapT = null; } else { gx = e.sapT.x; gz = e.sapT.z; } }
        if(e.sapS===3){ pathAt(e.p, e.d, e.off); gx = _pa.x; gz = _pa.z; }
        const dx = gx-e.x, dz = gz-e.z, d = Math.hypot(dx,dz);
        const stopAt = e.sapS===1 ? .8 : .05;
        if(d <= stopAt){ if(e.sapS===1){ e.sapS = 2; e.plantT = sp2.plant; } else e.sapS = 0; }
        else if(!e.held && !frozen){ const s = Math.min(d-stopAt+.001, sp*dt); e.x += dx/d*s; e.z += dz/d*s; e.tx = dx/d; e.tz = dz/d; e.ph += sp*dt*7; }
        continue;
      }
      if(e.sapS===2){
        e.plantT -= dt;
        if(R()<dt*10) FX.burst(e.x,.9,e.z,0xffd24a,1,1.4,.08,.3,2);
        if(!e.sapT || !G.towers.includes(e.sapT)){ e.sapS = 3; e.sapT = null; continue; }
        if(e.plantT<=0){
          const t = e.sapT; t.stun = upgVal('eng'); t.sapBy = null; e.sapT = null; e.alive = false;
          for(const k of t.knights) if(!k.dead){ k.hp -= k.max*.5; if(k.hp<=0){ k.dead = true; k.respawn = t.st.respawn; release(k); } }
          FX.sapBoom(t, e);
        }
        continue;
      }
    }
    if(!e.held && !frozen){ e.d += sp*dt; e.ph += sp*dt*7; }
    pathAt(e.p, e.d, e.off); e.x = _pa.x; e.z = _pa.z; e.tx = _pa.tx; e.tz = _pa.tz;
    if(e.d >= e.p.len) hurtCastle(e);
  }

  // torn
  for(const t of G.towers){
    if(t.stun>0){ t.stun = Math.max(0, t.stun - dt); if(R()<dt*5) FX.burst(t.x+(R()-.5)*.6, 2, t.z+(R()-.5)*.6, 0x55555f, 1, .6, .25, 1.2, 1.5, -1); continue; }
    if(t.type==='barracks' || t.type==='clock') continue;
    t.fire = Math.max(0, t.fire - dt*2.2);
    t.cd -= dt*t.haste;
    if(t.cd > 0) continue;
    const st = t.st, RR = st.range, R2 = RR*RR, air = TT[t.type].air, mul = dmgMul(t.type);
    let best = null, bv = -1;
    const cand = t.type==='archer' ? [] : null;
    for(const e of G.enemies){
      if(!e.alive || (e.fly && !air)) continue;
      const dx = e.x-t.x, dz = e.z-t.z; if(dx*dx+dz*dz > R2) continue;
      const v = e.d/e.p.len;
      if(cand) cand.push(e);
      if(v > bv){ bv = v; best = e; }
    }
    if(!best){ t.cd = .1; continue; }
    t.aimYaw = Math.atan2(-(best.x-t.x), -(best.z-t.z));
    const top = t.top || 2;
    if(t.type==='archer'){
      cand.sort((a,b)=>b.d/b.p.len - a.d/a.p.len);
      const n = st.shots;
      for(let k=0;k<n;k++){
        const e = cand[k % cand.length], ox = t.x, oy = top+.75, oz = t.z;
        const dist = Math.hypot(e.x-ox, e.z-oz);
        const crit = st.crit ? R() < st.crit : false;
        fireProj(st.fire ? 'fire' : st.crit ? 'long' : 'arrow', ox+(R()-.5)*.3, oy, oz+(R()-.5)*.3, e, e.x, e.z, Math.max(.22, dist/(st.crit?17:13)), .5+dist*.1,
          st.dmg*mul*(crit ? st.critX : 1), {fire:st.fire, fireDur:st.fireDur, crit}, 'archer');
      }
      t.cd = st.rate; FX.snd('arrow');
    } else if(t.type==='catapult'){
      const dur = 1.05, pr = predict(best, dur);
      if(st.bombs) fireProj('rock', t.x, 1.7, t.z, null, pr.x, pr.z, dur, 3.4, st.dmg*mul, {splash:st.splash, bombs:st.bombs, bombDmg:st.bombDmg*mul, bombSplash:st.bombSplash}, 'catapult');
      else if(t.lvl===3) fireProj('boulder', t.x, 1.9, t.z, best, best.x, best.z, 1.15, 3.8, st.dmg*mul, {splash:st.splash, direct:true}, 'catapult');
      else fireProj('rock', t.x, 1.7, t.z, null, pr.x, pr.z, dur, 3.4, st.dmg*mul, {splash:st.splash}, 'catapult');
      t.fire = 1; t.cd = t.lastRate = st.rate; FX.snd('thud');
    } else if(t.type==='cannon'){
      const dist = Math.hypot(best.x-t.x, best.z-t.z), dur = Math.max(.25, dist/12), pr = predict(best, dur);
      fireProj('ball', t.x, 1.9, t.z, null, pr.x, pr.z, dur, .6, st.dmg*mul, {splash:st.splash}, 'cannon');
      t.fire = 1; t.cd = t.lastRate = st.rate; FX.snd('cannon');
      FX.burst(t.x - Math.sin(t.aimYaw)*.9, 1.9, t.z - Math.cos(t.aimYaw)*.9, 0xd8d0c0, 6, 1.5, .22, .5, 1, -1);
    } else if(t.type==='mage'){
      if(st.chain){
        // blixt: hoppar mellan fiender
        const hit = [best], pts = [[best.x, best.z, best.fly]];
        let cur = best;
        while(hit.length < st.chain){
          let nb = null, nd = st.jump*st.jump;
          for(const o of G.enemies){ if(!o.alive || hit.includes(o)) continue; const d = (o.x-cur.x)**2+(o.z-cur.z)**2; if(d<nd){ nd = d; nb = o; } }
          if(!nb) break; hit.push(nb); pts.push([nb.x, nb.z, nb.fly]); cur = nb;
        }
        let dm = st.dmg*mul;
        for(const o of hit){ hurt(o, dm, 'magic', 'mage'); dm *= st.fall; }
        G.zaps.push({x0:t.x, z0:t.z, top:top+.62, pts, t:0});
        t.cd = st.rate; FX.snd('bolt');
      } else {
        fireProj(st.freezeEvery ? 'frost' : 'bolt', t.x, top+.62, t.z, best, best.x, best.z, .35, .3, st.dmg*mul,
          {slow:st.slow, dur:st.dur*(1+upgVal('magic')/100), burn:st.burn ? st.burn*mul : 0, freeze: st.freezeEvery && (++t.shotN % st.freezeEvery===0) ? st.freeze : 0, chill:st.chill||0}, 'mage');
        t.cd = st.rate; FX.snd(st.freezeEvery ? 'frost' : 'zap');
      }
    }
  }

  // projektiler
  for(const p of G.projs){
    p.t += dt/p.dur;
    if(p.target && p.target.alive){ p.tx = p.target.x; p.tz = p.target.z; }
    const k = Math.min(1,p.t);
    const nx = p.x0+(p.tx-p.x0)*k, nz = p.z0+(p.tz-p.z0)*k, ny = p.y0+(p.ty-p.y0)*k + p.h*4*k*(1-k);
    p.dx = nx-p.px; p.dy = ny-p.py; p.dz = nz-p.pz; p.px = nx; p.py = ny; p.pz = nz;
    if(p.t < 1) continue;
    p.done = true;
    const kind = p.kind;
    if(kind==='arrow' || kind==='fire' || kind==='long'){
      const e = p.target;
      if(e && e.alive){
        hurt(e, p.dmg, 'pierce', p.src);
        if(p.extra && p.extra.fire && e.alive){ e.fireT = Math.max(e.fireT, p.extra.fireDur); e.fireD = Math.max(e.fireD, p.extra.fire); }
        if(p.extra && p.extra.crit){ FX.float('Kritisk!', nx, 1.8, nz, 'crit'); FX.burst(nx,.9,nz,0xfff2a6,6,2.5,.1,.3); }
        else FX.burst(nx,.8,nz, kind==='fire'?0xff8a2c:0xffffff,2,1.5,.07,.2);
      }
    } else if(kind==='bolt' || kind==='frost'){
      const e = p.target, x = p.extra;
      if(e && e.alive){
        hurt(e, p.dmg, 'magic', p.src);
        if(e.alive){
          const was = e.slowT>0; e.slowT = Math.max(e.slowT, x.dur); e.slowF = was ? Math.max(e.slowF, x.slow) : x.slow;
          if(x.burn){ e.burnT = Math.max(e.burnT, x.dur); e.burnD = x.burn; }
          if(x.freeze){ e.freezeT = Math.max(e.freezeT, e.et.boss ? x.freeze*.4 : x.freeze); FX.burst(e.x,1,e.z,0xbfefff,12,2.5,.14,.6,3); }
        }
      }
      if(x.chill){ for(const o of G.enemies){ if(!o.alive || o===e) continue; if((o.x-nx)**2+(o.z-nz)**2 <= x.chill*x.chill){ o.slowT = Math.max(o.slowT, x.dur*.6); o.slowF = Math.max(o.slowF, x.slow*.7); } } }
      FX.burst(nx,.8,nz, kind==='frost'?0x9fe6ff:0xb07bff,8,2.5,.12,.4,2);
    } else if(kind==='rock' || kind==='boulder' || kind==='bomb' || kind==='ball'){
      const x = p.extra, r2 = x.splash*x.splash;
      const dmgKind = kind==='ball' ? 'heavy' : 'blast';
      if(x.direct && p.target && p.target.alive) hurt(p.target, p.dmg*.6, 'blast', p.src);
      for(const e of G.enemies){ if(!e.alive || e.fly) continue; const dx=e.x-nx, dz=e.z-nz, d2=dx*dx+dz*dz; if(d2<=r2) hurt(e, (x.direct ? p.dmg*.4 : p.dmg*(1-.4*Math.sqrt(d2)/x.splash)), dmgKind, p.src); }
      if(x.bombs){
        for(let b=0;b<x.bombs;b++){ const a = b/x.bombs*TAU + R(), rr = .8 + R()*1.2; fireProj('bomb', nx, .4, nz, null, nx+Math.cos(a)*rr, nz+Math.sin(a)*rr, .35+R()*.15, 1.1, x.bombDmg, {splash:x.bombSplash}, p.src); }
      }
      const s = kind==='bomb' ? .6 : kind==='ball' ? .8 : kind==='boulder' ? 1.8 : 1;
      FX.burst(nx,.3,nz,0x9c8a5a,(18+x.splash*8)*s,3+x.splash*2,.2,.6,5);
      FX.burst(nx,.5,nz,0xffa040,(8+x.splash*4)*s,2+x.splash*1.5,.18,.35,3);
      FX.shake(kind==='boulder' ? .3 : kind==='bomb' ? .05 : .15); FX.snd(kind==='bomb' ? 'pop' : 'boom');
    } else if(kind==='rain'){ FX.burst(nx,.1,nz,0xc9b48a,2,1.2,.08,.25,1.5); }
  }
  G.projs = G.projs.filter(p=>!p.done);

  // blixtar tonar bort
  for(const z of G.zaps) z.t += dt;
  G.zaps = G.zaps.filter(z=>z.t < .22);

  // pilregn
  for(const r of G.rains){
    r.t += dt;
    while(r.spawned < 46 && r.t > r.spawned*.018){
      r.spawned++;
      const a = Math.random()*TAU, rr = Math.sqrt(Math.random())*r.r, x = r.x+Math.cos(a)*rr, z = r.z+Math.sin(a)*rr;
      fireProj('rain', x-1.2, 9, z-3.5, null, x, z, .42, 0, 0, null);
    }
    while(r.ticks < 3 && r.t > .45 + r.ticks*.28){
      r.ticks++;
      for(const e of G.enemies){ if(e.alive && (e.x-r.x)**2+(e.z-r.z)**2 <= r.r*r.r) hurt(e, r.dmg/3, 'rain', 'rain'); }
    }
    if(r.ticks>=3 && r.spawned>=46) r.done = true;
  }
  G.rains = G.rains.filter(r=>!r.done);

  G.enemies = G.enemies.filter(e=>e.alive);

  if(!G.over && G.mode==='play' && G.wave>=G.W && G.spawners.length===0 && G.enemies.length===0) win();
  if(G.mode==='attract' && G.wave>=G.W && G.spawners.length===0 && G.enemies.length===0){ G.wave = 0; G.waveReady = true; }
}

export function castRain(x,z){
  if(G.rainCd>0 || G.over) return false;
  const rs = rainStats();
  G.rains.push({x, z, r:rs.r, dmg:rs.dmg, t:0, spawned:0, ticks:0});
  G.rainCd = rs.cd;
  return true;
}
export function starsFor(){ const r = G.hp/G.hpMax; return r>=.95?3:r>=.6?2:1; }
export function win(){
  if(G.over) return; G.over = true; G.won = true;
  const s = S.save, L = G.L, stars = starsFor();
  const arr = G.variant==='hero' ? s.starsH : s.stars;
  const prev = arr[L]; arr[L] = Math.max(prev, stars);
  if(G.variant==='normal' && L+2 > s.unlocked) s.unlocked = Math.min(NL, L+2);
  FX.persist();
  FX.win(stars, Math.max(0, arr[L]-prev));
}
export function lose(){
  if(G.over) return; G.over = true; G.won = false;
  if(G.variant==='endless'){ const s = S.save; s.best[G.L] = Math.max(s.best[G.L]||0, G.wave); FX.persist(); }
  FX.lose();
}
export function realmOf(L){ return REALMS[LEVELS[L].realm]; }
export function levelTypes(L){ const s = new Set(); makeWaves(L).forEach(w=>w.g.forEach(g=>s.add(g.t))); return s; }
export function newTypes(L){
  const seen = new Set(); for(let i=0;i<L;i++) for(const t of levelTypes(i)) seen.add(t);
  const out = []; for(const t of levelTypes(L)) if(!seen.has(t) && t!=='foot') out.push(t); return out;
}
