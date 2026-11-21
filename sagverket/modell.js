// Sågverket v3 · modell.js
// Hela spelet utan grafik: data (ekonomi, epoker, orter, yrken, stegen) och spelmodellen.
// Spelet (index.html) och simuleringen (sim.js) kör samma kod. Vanligt skript: allt hamnar globalt.
// Allt som ska kunna växa ligger som data: EPOKER, ORTER (plus generatorn ortDef), YRKEN, STEGE, ECON.pads.
/*ECON-START*/
/* ================= EKONOMI: all balans som data. Justera här. ================= */
const ECON = {
  start: 0,
  v1BonusMax: 300,
  walk: 6.2,                       // gubbens fart, meter per sekund
  carry: [5, 8, 12, 16, 22],       // hur mycket gubben bär, per ryggsäcksnivå
  chopHit: [0.3, 0.2, 0.13],       // sekunder per yxhugg, per yxnivå
  treeHits: 3, regrow: 18,
  pickGap: 0.07, dropGap: 0.05, padDelay: 0.45,
  pay: { minRate: 16, frac: 0.6 }, // swisch: kr per sekund = max(minRate, pris * frac)
  value: { log: 2, barked: 5, board: 12, planed: 25, sack: 14, furn: 180, torr: 70, limtra: 520, fonster: 320 },
  mach: {                          // takt i saker per sekund, per = hur många in per sak ut
    bark: { rate: 1.0 }, sag: { rate: 0.9 }, hyvel: { rate: 0.9 }, press: { rate: 0.5, per: 2 }, snick: { rate: 0.3, per: 3 },
    ugn: { rate: 0.5 }, lim: { rate: 0.2, per: 3 }, list: { rate: 0.3, per: 2 },
  },
  upMult: 1.6,
  qcap: { intake: 60, sag: 12, hyvel: 12, press: 20, snick: 9, ugn: 12, lim: 12, list: 10 },
  pcap: { main: 80, sack: 60, furn: 40, torr: 40, lim: 30, list: 30 },
  worker: { walk: 3.8, chop: 1.6, huggCarry: 6, barCarry: 6, gap: 0.12, truckCarry: 18, truckWalk: 5.4, skordCarry: 12, skordChop: 0.45 },
  kassa: { min: 300, secs: 150 },
  groundLife: 75,
  orders: { first: 40, gap: [80, 140], T: 90, trips: 3.5, factor: 0.9, min: 5, max: 400, bonus: 2,
            base: { barked: .3, board: .3, planed: .3, sack: .15, furn: .05, torr: .1, limtra: .03, fonster: .04 } },
  events: { first: 150, gap: [180, 300],
            storm: { T: 35, every: 2 }, rush: { T: 60, mult: 2 },
            gold: { T: 60, hits: 8, secs: 90, min: 150 }, jam: { T: 45, fix: 1.5, secs: 25, min: 30 },
            panna: { T: 40, fix: 1.2, secs: 40, min: 400 }, tappat: { T: 50, n: 12 }, borre: { T: 70, n: 3, secs: 25, min: 500 } },
  fro: 0.10,                       // varje frö ger +10 % pris, för alltid
  v2fro: 2.5,                      // ett frö från v2 (+25 %) blir 2,5 frön i v3, så att bonusen är densamma
  konc: { tau: 240 },              // koncernintäkt: ortens takt utan spelare, utjämnad över ungefär 4 minuter
  staff: { base: 6, bod: 6, kontor: 8, hk: 12 },
  train: { base: 1500, grow: 2.3, max: 4 },   // utbildning: nivå 1 till 5
  vissla: { T: 20, cd: 75, mult: 2 },
  veh: { truck: { walk: 1.35, carry: 3 }, skord: { walk: 1.15, carry: 3 } },
  snoskoter: 1.3,
  kontrakt: { first: 4, gap: 12, T: [150, 240, 360], mult: [1.3, 1.7, 2.2] },
  offlineCapH: 8,
  // Betalrutor. req = det som måste vara klart innan rutan syns ("id" eller "id:nivå"). lvReq = extra krav per nivå.
  // ep = lägsta epok. tw = bara i orter med den vändningen. Priserna gånger ortens kostnadsfaktor (cm). why = varför man vill dit.
  pads: [
    { id: 'bark',     kind: 'machine', m: 'bark',  name: 'Barkmaskin',          at: [3.4, -12],  cost: [20], why: 'barkade stockar är värda mer än råa' },
    { id: 'pack',     kind: 'pack',                name: 'Större ryggsäck',     at: [7.5, -17.5], cost: [60, 1200, 7000, 20000], req: ['bark'], lvReq: { 2: ['snick'], 3: ['chauffor'] }, why: 'du bär fler saker per vända' },
    { id: 'sag',      kind: 'machine', m: 'sag',   name: 'Såg',                 at: [3.4, -5],   cost: [120], req: ['bark'], why: 'brädor är värda dubbelt så mycket' },
    { id: 'yxa',      kind: 'axe',                 name: 'Vassare yxa',         at: [10.8, -17.5], cost: [200, 5000], req: ['sag'], lvReq: { 1: ['press'] }, why: 'träden faller fortare' },
    { id: 'hugg',     kind: 'hire',    role: 'hugg', name: 'Huggare',           at: [-5, -17.5], cost: [300, 1600, 5000], req: ['sag'], why: 'en huggare fäller träd åt dig' },
    { id: 'hyvel',    kind: 'machine', m: 'hyvel', name: 'Hyvel',               at: [3.4, 2],    cost: [600], req: ['hugg'], why: 'hyvlade brädor är värda dubbelt mot sågade' },
    { id: 'barare',   kind: 'hire',    role: 'bar', name: 'Bärare',             at: [4.6, 6.4],  cost: [1000, 3000, 9000], req: ['hyvel'], why: 'bärarna säljer virket åt dig' },
    { id: 'up_bark',  kind: 'up',      m: 'bark',  name: 'Snabbare barkmaskin', at: [3.4, -12],  cost: [800, 6000, 15000], req: ['hyvel'], lvReq: { 1: ['press'], 2: ['chauffor'] }, why: 'maskinen hinner mer' },
    { id: 'up_sag',   kind: 'up',      m: 'sag',   name: 'Snabbare såg',        at: [3.4, -5],   cost: [1300, 7000, 16000], req: ['hyvel'], lvReq: { 1: ['press'], 2: ['chauffor'] }, why: 'maskinen hinner mer' },
    { id: 'up_hyvel', kind: 'up',      m: 'hyvel', name: 'Snabbare hyvel',      at: [3.4, 2],    cost: [2000, 8000, 18000], req: ['barare'], lvReq: { 1: ['snick'], 2: ['chauffor'] }, why: 'maskinen hinner mer' },
    { id: 'press',    kind: 'machine', m: 'press', name: 'Pelletspress',        at: [-8.8, -5],  cost: [2500], req: ['barare'], why: 'spånet från sågen blir pelletssäckar' },
    { id: 'up_press', kind: 'up',      m: 'press', name: 'Snabbare press',      at: [-8.8, -5],  cost: [5000, 15000], req: ['press'], lvReq: { 1: ['chauffor'] }, why: 'maskinen hinner mer' },
    { id: 'snick',    kind: 'machine', m: 'snick', name: 'Snickeri',            at: [-8.8, 3],   cost: [6000], req: ['press'], why: 'möbler är värda mest i början' },
    { id: 'up_snick', kind: 'up',      m: 'snick', name: 'Snabbare snickeri',   at: [-8.8, 3],   cost: [10000, 30000], req: ['snick'], lvReq: { 1: ['chauffor'] }, why: 'maskinen hinner mer' },
    { id: 'chauffor', kind: 'hire',    role: 'chauf', name: 'Chaufför',         at: [11.8, 7],   cost: [18000], req: ['barare:3', 'hugg:3', 'snick'], why: 'pengarna går in av sig själva: verket blir helt automatiserat' },
    { id: 'bod',      kind: 'build',   b: 'bod',   name: 'Personalbod',         at: [-11.2, -19.8], cost: [2500], req: ['barare'], why: 'plats för fler anställda' },
    { id: 'utb',      kind: 'train',               name: 'Utbildning',          at: [-7.6, -20.6], dyn: true, req: ['bod', 'chauffor'], why: 'utbildad personal jobbar fortare' },
    { id: 'epok',     kind: 'epoch',               name: 'Modernisera',         at: [-7.6, 11.6], dyn: true, why: 'hela bolaget blir modernare: nya maskiner, yrken och mer betalt' },
    // Epok 2: Ångan
    { id: 'ugn',      kind: 'machine', m: 'ugn',   name: 'Torkugn',             at: [17.5, -4.6], cost: [20000], ep: 2, req: ['hyvel'], why: 'torkat virke är värt nästan tre gånger mer' },
    { id: 'up_ugn',   kind: 'up',      m: 'ugn',   name: 'Snabbare torkugn',    at: [17.5, -4.6], cost: [25000, 70000, 160000], ep: 2, req: ['ugn'], lvReq: { 1: ['eldare'], 2: ['lim'] }, why: 'maskinen hinner mer' },
    { id: 'mask',     kind: 'hire',    role: 'mask', name: 'Maskinist',         at: [7.2, -7.4], cost: [5000, 16000], ep: 2, req: ['hyvel'], why: 'maskinisten smörjer maskinerna så att de går fortare' },
    { id: 'eldare',   kind: 'hire',    role: 'eld', name: 'Eldare',             at: [12.2, -7.4], cost: [8000], ep: 2, req: ['press'], why: 'eldaren håller ångmaskinen varm: alla maskiner går fortare' },
    { id: 'kontor',   kind: 'build',   b: 'kontor', name: 'Kontorshus',         at: [-11, 7.2], cost: [20000], ep: 2, req: ['bod'], why: 'plats för fler anställda' },
    // Epok 3: Motorn
    { id: 'lim',      kind: 'machine', m: 'lim',   name: 'Limträpress',         at: [14.6, 6.2], cost: [90000], ep: 3, req: ['ugn'], why: 'limträbalkar är värda mest av allt' },
    { id: 'up_lim',   kind: 'up',      m: 'lim',   name: 'Snabbare limträpress', at: [14.6, 6.2], cost: [180000, 450000], ep: 3, req: ['lim'], why: 'maskinen hinner mer' },
    { id: 'truckf',   kind: 'hire',    role: 'truck', name: 'Truckförare',      at: [11.8, 2.8], cost: [40000, 110000], ep: 3, req: ['barare'], why: 'truckföraren kör en hel pall åt gången' },
    { id: 'mek',      kind: 'hire',    role: 'mek', name: 'Mekaniker',          at: [7.2, -3.4], cost: [30000], ep: 3, req: ['hyvel'], why: 'mekanikern lagar maskinstopp av sig själv' },
    { id: 'gtruck',   kind: 'veh',     v: 'truck', name: 'Gaffeltruck',         at: [8.4, 2.8], cost: [25000], ep: 3, req: ['hyvel'], why: 'du kör själv och bär tre gånger så mycket' },
    // Epok 4: Skördaren
    { id: 'list',     kind: 'machine', m: 'list',  name: 'Hyvleri för fönster', at: [23, 2.9], cost: [600000], ep: 4, req: ['ugn'], why: 'fönster och listverk säljer dyrt' },
    { id: 'up_list',  kind: 'up',      m: 'list',  name: 'Snabbare hyvleri',    at: [23, 2.9], cost: [1.2e6, 3.5e6], ep: 4, req: ['list'], why: 'maskinen hinner mer' },
    { id: 'skord',    kind: 'hire',    role: 'skord', name: 'Skördarförare',    at: [21.2, 10.6], cost: [400000, 1e6], ep: 4, req: ['hugg'], why: 'skördaren fäller ett träd i ett grepp' },
    { id: 'plant',    kind: 'hire',    role: 'plant', name: 'Plantör',          at: [18.2, 10.6], cost: [250000, 700000], ep: 4, req: ['hugg'], why: 'plantören sätter nya träd: skogen växer fortare' },
    { id: 'salj',     kind: 'hire',    role: 'salj', name: 'Säljare',           at: [15.2, 10.6], cost: [300000], ep: 4, req: ['hyvel'], why: 'fler och större beställningar' },
    { id: 'gskord',   kind: 'veh',     v: 'skord', name: 'Skördare',            at: [24.2, 10.6], cost: [500000], ep: 4, req: ['hugg'], why: 'du fäller träd i ett grepp och bär tre gånger så mycket' },
    { id: 'hk',       kind: 'build',   b: 'hk',    name: 'Huvudkontor',         at: [-11, 7.2], cost: [400000], ep: 4, req: ['kontor'], why: 'plats för många fler anställda' },
    // Orter med älv
    { id: 'flott',    kind: 'hire',    role: 'flott', name: 'Flottare',         at: [6.2, -28.9], cost: [900, 3500, 10000], tw: 'alv', req: ['bark', 'alv'], why: 'flottarna för timret längs älven till verket' },
  ],
};

/* ================= EPOKER: modernitet. Nya epoker läggs till här. ================= */
const EPOKER = [
  { n: 1, namn: 'Handkraft', ar: 1900, fart: 1, pris: 1, arb: 1, yrken: ['hugg', 'bar', 'chauf'],
    nytt: 'Yxor, handkraft och lastbil', gubbe: 'Hugga, bära och betala' },
  { n: 2, namn: 'Ångan', ar: 1930, fart: 1.3, pris: 1.25, arb: 1.15, kost: 40000, krav: [{ k: 'auto' }, { k: 'earnedAll', n: 200000 }],
    maskin: 'ugn', produkt: 'torr', yrken: ['mask', 'eld'], nytt: 'Ångmaskin med remmar, band mellan maskinerna och lampor',
    gubbe: 'Dra i ångvisslan: alla maskiner går dubbelt så fort en stund' },
  { n: 3, namn: 'Motorn', ar: 1960, fart: 1.7, pris: 1.6, arb: 1.35, kost: 250000, krav: [{ k: 'master', n: 1 }, { k: 'autoOrter', n: 2 }, { k: 'earnedAll', n: 1.3e6 }],
    maskin: 'lim', produkt: 'limtra', yrken: ['truck', 'mek'], nytt: 'Motorsågar och en timmerbil som hämtar timmer själv',
    gubbe: 'Kör gaffeltruck: snabbare och bär en hel pall' },
  { n: 4, namn: 'Skördaren', ar: 1990, fart: 2.2, pris: 2, arb: 1.6, kost: 2.5e6, krav: [{ k: 'master', n: 2 }, { k: 'mach', id: 'lim' }, { k: 'earnedAll', n: 1.2e7 }],
    maskin: 'list', produkt: 'fonster', yrken: ['skord', 'plant', 'salj'], nytt: 'Sorteringsverk och plantering',
    gubbe: 'Kör skördare i skogen' },
  { n: 5, namn: 'Det smarta verket', ar: 2020, kommer: true, nytt: 'Robotarm, kontrollrum, solceller, ellastbil och drönare', maskin: 'kl', produkt: 'KL-trä', yrken: ['tekniker', 'analytiker'], gubbe: 'Styra drönaren över skogen' },
  { n: 6, namn: 'Framtiden', ar: 2040, kommer: true, nytt: 'Självkörande fordon', maskin: 'hus', produkt: 'trähusmoduler', yrken: ['robotskötare', 'arkitekt'], gubbe: 'Leverera ett helt hus' },
];

/* ================= YRKEN ================= */
const YRKEN = {
  hugg:  { namn: 'Huggare',       pad: 'hugg',     gor: 'fäller träd och bär stockar till inlastningen' },
  bar:   { namn: 'Bärare',        pad: 'barare',   gor: 'bär virket från högarna till lastkajen' },
  chauf: { namn: 'Chaufför',      pad: 'chauffor', gor: 'kör pengarna direkt till kassan. Utbildning ger bättre pris' },
  flott: { namn: 'Flottare',      pad: 'flott',    gor: 'för timret längs älven till verket' },
  mask:  { namn: 'Maskinist',     pad: 'mask',     gor: 'smörjer maskinerna: de går fortare' },
  eld:   { namn: 'Eldare',        pad: 'eldare',   gor: 'eldar i ångmaskinen: alla maskiner går fortare' },
  truck: { namn: 'Truckförare',   pad: 'truckf',   gor: 'kör hela pallar till lastkajen' },
  mek:   { namn: 'Mekaniker',     pad: 'mek',      gor: 'lagar maskinstopp av sig själv' },
  skord: { namn: 'Skördarförare', pad: 'skord',    gor: 'fäller träd med skördaren' },
  plant: { namn: 'Plantör',       pad: 'plant',    gor: 'planterar: skogen växer upp fortare' },
  salj:  { namn: 'Säljare',       pad: 'salj',     gor: 'ger fler och större beställningar och bättre kontrakt' },
};
const FORNAMN = ['Anna', 'Erik', 'Karin', 'Lars', 'Maja', 'Nils', 'Greta', 'Olof', 'Ingrid', 'Sven', 'Elsa', 'Gustav', 'Britt', 'Per', 'Sigrid', 'Johan', 'Astrid', 'Karl', 'Ebba', 'Axel', 'Hilda', 'Oskar', 'Märta', 'Arvid', 'Selma', 'Ture', 'Dagny', 'Bertil', 'Signe', 'Ragnar', 'Elin', 'Hugo', 'Saga', 'Viktor', 'Tove', 'Emil'];
const EFTERNAMN = ['Andersson', 'Johansson', 'Karlsson', 'Nilsson', 'Eriksson', 'Larsson', 'Olsson', 'Persson', 'Svensson', 'Gustafsson', 'Lindqvist', 'Berg', 'Holm', 'Lund', 'Ek', 'Sjöberg', 'Forsberg', 'Åberg', 'Öhman', 'Strand', 'Björk', 'Dahl', 'Falk', 'Hedlund', 'Viklund'];

/* ================= BOLAGSSTEGEN ================= */
const STEGE = [
  { t: 'Torpare' },
  { t: 'Sågare',        k: { k: 'mach', id: 'sag' }, fro: 1 },
  { t: 'Sågverksägare', k: { k: 'auto' }, fro: 2 },
  { t: 'Disponent',     k: { k: 'epoch', n: 2 }, fro: 2 },
  { t: 'Brukspatron',   k: { k: 'master', n: 1 }, fro: 3 },
  { t: 'Koncernchef',   k: { k: 'orter', n: 3 }, fro: 3 },
];
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];
function stegDef(i) {   // efter Koncernchef skapas nya steg automatiskt
  if (i < STEGE.length) return STEGE[i];
  const n = i - STEGE.length + 2;
  return { t: 'Koncernchef ' + (ROMAN[n] || n), k: n % 2 ? { k: 'orter', n: 3 + Math.floor(n / 2) } : { k: 'earnedAll', n: 2e7 * Math.pow(4, n / 2) }, fro: 3 };
}

/* ================= GÅRDSFORMER: varje ort har en egen gård (meter, z växer mot vägen) ================= */
// En form beskriver huvudlinjen (O = inlastningen, d = flödesriktning, n = sidan där betalrutorna ligger, g = extra lucka efter barkmaskinen),
// östgruppen för epok 2–4 (U = torkugnen, a och b = dess axlar), gårdens rektanglar (ep = öppnas med epoken, bro = bro över vatten),
// vatten, träden i gården och resten av platserna. Rektanglar får bara mötas kant mot kant. slots = platser för områden i genererade orter.
// Maskinerna sparas per id, inte per plats, så en ort behåller allt när formen ändras.
const FORMS = {
  rak: { namn: 'Rak linje', O: [0, -17], d: [0, 1], n: [1, 0], g: 0, U: [17.5, -0.8], a: [1, 0], b: [0, 1],
    yard: [{ id: 'main', r: [-13.5, 13.5, -30.5, 14.2] }, { id: 'ost', r: [13.5, 26, -8.5, 14.2], ep: 2 }],
    ugnVia: [[2, -0.8]], chute: [[-19, -15.2], [-1.6, -15.2]],
    start: [3.5, -19.5], dock: [5, 12], kassa: [9.6, 10.6], kontor: [-11, 11.4], bod: [-11.2, -19.8], anga: [10, -11], vissla: [10, -14.4], sort: [4.4, -15.6],
    pads: { pack: [7.5, -17.5], yxa: [10.8, -17.5], hugg: [-5, -17.5], barare: [4.6, 6.4], chauffor: [11.8, 7], utb: [-7.6, -20.6], epok: [-7.6, 11.6], kontor: [-11, 7.2], hk: [-11, 7.2],
            mask: [7.2, -7.4], eldare: [12.2, -7.4], truckf: [11.8, 2.8], mek: [7.2, -3.4], gtruck: [8.4, 2.8], flott: [6.2, -28.9] },
    trees: { p: [-12.2, -24.2], u: [2.7, 0], v: [1.2, -2.6], n: 10, rows: 2 },
    slots: { ne: { r: [13.5, 37.5, -30.5, -8.5], pad: [12.2, -22] }, nord: { r: [-13.5, 13.5, -52, -30.5], pad: [0, -29] }, vast: { r: [-37.5, -13.5, -27.5, 1.5], pad: [-12.2, -12] } } },
  // Älven rinner rakt genom gården. Barkmaskinen står på norra stranden och bandet går över bron till sågen på södra.
  bro: { namn: 'Två stränder med bro', O: [0, -30], d: [0, 1], n: [-1, 0], g: 6, U: [-19, -6], a: [-1, 0], b: [0, 1],
    yard: [{ id: 'main', r: [-14, 14, -40, -21] }, { id: 'bron', r: [-3, 3, -21, -16], bro: true }, { id: 'syd', r: [-14, 14, -16, 14.2] }, { id: 'ost', r: [-30, -14, -16, 8], ep: 2 }],
    water: [{ kind: 'river', r: [-90, 90, -21, -16] }],
    ugnVia: [[-2, -7.6], [-17, -7.6]], chute: [[-34, -18.5], [-7.5, -18.5], [-7.5, -27.5], [-1.4, -30]],
    start: [3, -34], dock: [4, 12], kassa: [9, 10.5], kontor: [-10.5, 11.4], bod: [-10.5, -26.5], anga: [9.5, -24.5], vissla: [6, -24.5], sort: [-4, -33.5],
    pads: { pack: [4.5, -30.2], yxa: [-6, -36], hugg: [-5.5, -30], barare: [-4.6, 4], chauffor: [11.5, 7], utb: [-10.5, -31], epok: [-6.8, 11.8], kontor: [-10.5, 7.2], hk: [-10.5, 7.2],
            mask: [6, -35], eldare: [10.5, -35], truckf: [11.5, 2.8], mek: [8.8, 3.2], gtruck: [11.5, -1.2], flott: [-11.5, -22.6] },
    trees: { p: [-12.2, -38.2], u: [2.7, 0], v: [1.2, 2.4], n: 10, rows: 2 },
    slots: { ne: { r: [14, 38, -40, -16], pad: [12.8, -30] }, nord: { r: [-26, 26, -64, -40], pad: [0, -38.8] }, vast: { r: [-38, -14, -40, -21], pad: [-12.8, -35] } } },
  // U runt en sjö: produktionen i västra armen, kajen i botten, maskinhallarna i östra. Isen är genvägen mellan armarna.
  U: { namn: 'U runt sjön', O: [-20, -31], d: [0, 1], n: [-1, 0], g: 0, U: [18, -14], a: [1, 0], b: [0, 1], terrace: true,
    yard: [{ id: 'main', r: [-26, -10, -40, 14.2] }, { id: 'botten', r: [-10, 10, -2, 14.2] }, { id: 'osterarm', r: [10, 26, -2, 14.2] }, { id: 'ost', r: [10, 26, -34, -2], ep: 2 }],
    ugnVia: [[-17, -10], [-17, -3.5], [13, -3.5], [13, -14]], chute: null,
    start: [-17, -34], dock: [3, 12], kassa: [8, 10.5], kontor: [-21, 10.6], bod: [-14.5, 3], anga: [18, 6], vissla: [14, 10], sort: [-16.5, -35],
    pads: { pack: [-14.5, -30], yxa: [-14.5, -26.5], hugg: [-24, -31.5], barare: [-23.5, -2], chauffor: [6, 5.5], utb: [-11.4, 7], epok: [-16, 11.5], kontor: [-21, 6.2], hk: [-21, 6.2],
            mask: [14, 2.5], eldare: [22.5, 1.8], truckf: [-6, 5.5], mek: [-2, 1.2], gtruck: [-6, 1.2], flott: [-13, -37] },
    trees: { p: [-25, -38.4], u: [2.7, 0], v: [1.2, 1.9], n: 6, rows: 2 },
    slots: { ne: { r: [26, 50, -34, 14.2], pad: [24.8, 9] }, nord: { r: [-26, 26, -64, -40], pad: [-18, -38.8] }, vast: { r: [-10, 10, -34, -2], pad: [-11.2, -14], mitt: true } } },
  // Lång gård längs vägen: linjen går mot kajen och havet syns från gården.
  lang: { namn: 'Lång gård längs vägen', O: [-34, -2], d: [1, 0], n: [0, -1], g: 0, U: [16, -2], a: [1, 0], b: [0, 1],
    yard: [{ id: 'main', r: [-40, 10, -14, 14.2] }, { id: 'ost', r: [10, 40, -14, 14.2], ep: 2 }],
    ugnVia: [[-12.3, -2], [-12.3, -8], [12, -8], [12, -2]], chute: null,
    start: [-30, -9], dock: [3, 12], kassa: [7.8, 10.6], kontor: [-30, 10.8], bod: [-37, 6], anga: [4, -5.5], vissla: [4, -1.6], sort: [-30.5, 1.6],
    pads: { pack: [-33.6, -7], yxa: [-29.6, -9.6], hugg: [-37.6, -5.8], barare: [-4.5, 6.2], chauffor: [6.5, 6.2], utb: [-37.6, 10.5], epok: [-25.5, 11.3], kontor: [-30, 6.5], hk: [-30, 6.5],
            mask: [0, -5.4], eldare: [8, -5.4], truckf: [0, 6.2], mek: [-4.5, 2], gtruck: [0, 2.2], flott: [-6, -11] },
    trees: { p: [-38, -12.6], u: [2.7, 0], v: [1.2, 2.4], n: 8, rows: 2 },
    slots: { nord: { r: [-40, 10, -38, -14], pad: [0, -12.8] }, vast: { r: [-64, -40, -34, 14.2], pad: [-38.8, 2] }, ne: { r: [-40, 10, -62, -38], pad: [0, -36.8], req: ['nord'] } } },
};
// Spegling: x byter tecken i alla punkter, vektorer och rektanglar (min och max byter plats). Inget speglas i grafiken.
function mirrorX(o) {
  if (Array.isArray(o)) {
    if (o.length === 2 && typeof o[0] === 'number') return [-o[0], o[1]];
    if (o.length === 4 && typeof o[0] === 'number') return [-o[1], -o[0], o[2], o[3]];
    return o.map(mirrorX);
  }
  if (o && typeof o === 'object') { const r = {}; for (const k in o) r[k] = mirrorX(o[k]); return r; }
  return o;
}
const MACH_R = { bark: 1.9, sag: 1.9, hyvel: 1.9, press: 1.7, snick: 2.0, ugn: 1.9, lim: 1.9, list: 1.8 };
function mkLayout(f) {
  const P = (p, ...t) => { let x = p[0], z = p[1]; for (let i = 0; i < t.length; i += 2) { x += t[i][0] * t[i + 1]; z += t[i][1] * t[i + 1]; } return [Math.round(x * 100) / 100, Math.round(z * 100) / 100]; };
  const { O, d, n, U, a, b } = f, g = f.g || 0;
  const L = { form: f.namn, start: f.start, intake: O, dock: f.dock, kassa: f.kassa, kontor: f.kontor, bod: f.bod, anga: f.anga, vissla: f.vissla, sort: f.sort,
    yard: f.yard, water: f.water || [], trees: f.trees, terrace: !!f.terrace, chute: f.chute || null, road: 17.6, machR: MACH_R };
  L.mach = { bark: P(O, d, 5), sag: P(O, d, 12 + g), hyvel: P(O, d, 19 + g), press: P(O, d, 12 + g, n, -5.5), snick: P(O, d, 20 + g, n, -5.5), ugn: U, lim: P(U, b, 7), list: P(U, a, 5.5) };
  L.pile = { main: P(O, d, 24.8 + g), sack: P(O, d, 15.8 + g, n, -5.5), furn: P(O, d, 24.2 + g, n, -5.5), torr: P(U, a, 3.1, b, -4.5), lim: P(U, a, 4.2, b, 7), list: P(U, a, 6.7, b, -4.5) };
  const mp = { bark: P(O, d, 5, n, 3.4), sag: P(O, d, 12 + g, n, 3.4), hyvel: P(O, d, 19 + g, n, 3.4), press: P(O, d, 12 + g, n, -8.8), snick: P(O, d, 20 + g, n, -8.8), ugn: P(U, b, -3.8), lim: P(U, a, -2.9, b, 7), list: P(U, a, 5.5, b, 3.7) };
  L.pads = { ...f.pads, bod: f.bod, salj: P(U, a, -2.3, b, 11.4), plant: P(U, a, .7, b, 11.4), skord: P(U, a, 3.7, b, 11.4), gskord: P(U, a, 6.7, b, 11.4) };
  for (const m in mp) { L.pads[m] = mp[m]; L.pads['up_' + m] = mp[m]; }
  const M = L.mach, Pl = L.pile;
  L.routes = { in: [O, M.bark], 'bark>sag': [M.bark, M.sag], 'bark>main': [M.bark, Pl.main], 'sag>hyvel': [M.sag, M.hyvel], 'sag>main': [M.sag, Pl.main], 'hyvel>main': [M.hyvel, Pl.main],
    'spill>press': [M.sag, M.press], 'press>sack': [M.press, Pl.sack], 'hyvel>snick': [M.hyvel, M.snick], 'snick>furn': [M.snick, Pl.furn],
    'hyvel>ugn': [M.hyvel, ...(f.ugnVia || []), U], 'ugn>torr': [U, Pl.torr], 'ugn>lim': [U, M.lim], 'ugn>list': [U, M.list], 'lim>lim': [M.lim, Pl.lim], 'list>list': [M.list, Pl.list] };
  // band ritas från kant till kant längs varornas vägar: [väg, kräver, radie i början, radie i slutet]
  L.belts = [['in', 'bark', 1.1, MACH_R.bark], ['bark>sag', 'bark', MACH_R.bark, MACH_R.sag], ['sag>hyvel', 'bark', MACH_R.sag, MACH_R.hyvel], ['hyvel>main', 'bark', MACH_R.hyvel, 1.1],
    ['spill>press', 'press', MACH_R.sag, MACH_R.press], ['press>sack', 'press', MACH_R.press, 1.1], ['hyvel>snick', 'snick', MACH_R.hyvel, MACH_R.snick], ['snick>furn', 'snick', MACH_R.snick, 1.1],
    ['hyvel>ugn', 'ugn', MACH_R.hyvel, MACH_R.ugn], ['ugn>torr', 'ugn', MACH_R.ugn, 1.1], ['ugn>lim', 'lim', MACH_R.ugn, MACH_R.lim], ['lim>lim', 'lim', MACH_R.lim, 1.1], ['ugn>list', 'list', MACH_R.ugn, MACH_R.list], ['list>list', 'list', MACH_R.list, 1.1]];
  return L;
}
function layoutFor(def) { const f = FORMS[def.form || 'rak']; return mkLayout(def.mirror ? mirrorX(f) : f); }
// LAY är alltid gården i orten man står i. Den byts ut vid resa.
const LAY = {};
function setLayout(L) { for (const k in LAY) delete LAY[k]; Object.assign(LAY, L); return LAY; }
setLayout(layoutFor({ form: 'rak' }));
// Maskinkedjan som data: next = allt går dit när den finns, branch = delas lika mellan högen och grenarna, spill = biprodukt.
const CHAIN = {
  bark:  { out: 'barked', pile: 'main', next: 'sag' },
  sag:   { out: 'board', pile: 'main', next: 'hyvel', spill: 'press' },
  hyvel: { out: 'planed', pile: 'main', branch: ['snick', 'ugn'] },
  press: { out: 'sack', pile: 'sack' },
  snick: { out: 'furn', pile: 'furn' },
  ugn:   { out: 'torr', pile: 'torr', branch: ['lim', 'list'] },
  lim:   { out: 'limtra', pile: 'lim' },
  list:  { out: 'fonster', pile: 'list' },
};
const MACHS = Object.keys(CHAIN);
const PILES = ['main', 'sack', 'furn', 'torr', 'lim', 'list'];
const PRODUCTS = ['barked', 'board', 'planed', 'sack', 'furn', 'torr', 'limtra', 'fonster', 'log'];
const TYPE_PILE = { barked: 'main', board: 'main', planed: 'main', sack: 'sack', furn: 'furn', torr: 'torr', limtra: 'lim', fonster: 'list' };

/* ================= ORTER: handgjorda banor. Efter dem skapar ortDef() nya ur ett frö. ================= */
// rect = [x0, x1, z0, z1]. Ett område öppnas med en betalruta vid gården (pad). lake = sjö som för in stockar (flow per sekund).
// river = älv med bro (bro = rektangel). ice = is som bara bär på vintern, island = ö i isen. logs = stockar per träd. form = gårdsformen (FORMS).
const ORTER = [
  { id: 'glantan', namn: 'Gläntan', terr: 'grass', form: 'rak', cm: 1, seed: 1703, kart: [44, 74], vandning: 'Sjön för in stockar av sig själv',
    areas: [
      { id: 'skog', namn: 'Storskogen', rect: [13.5, 37.5, -35.5, -8.5], logs: 3, big: true, pad: [12.2, -22], cost: 4000, req: ['hugg:2'], why: 'stora träd som ger tre stockar var', icon: '🌲' },
      { id: 'sjo', namn: 'Sjön och flottning', rect: [-37.5, -13.5, -27.5, 1.5], logs: 2, lake: [-33, -19, -23, -5], flow: 0.5, pad: [-12.2, -12], cost: 11000, req: ['snick'], why: 'stockar flyter in av sig själva', icon: '🛶' },
    ],
    mal: [{ k: 'auto' }, { k: 'orders', n: 3 }, { k: 'epoch', n: 2 }, { k: 'machHere', id: 'ugn' }, { k: 'earned', n: 1.3e6 }] },
  { id: 'alvdalen', namn: 'Älvdalen', terr: 'valley', form: 'bro', cm: 2, seed: 2207, kart: [30, 52], vandning: 'Älven rinner genom gården och bandet går över bron. Anställ flottare',
    areas: [
      { id: 'alv', namn: 'Norrskogen och flottningen', rect: [-26, 26, -64, -40], logs: 2, pad: [0, -38.8], cost: 2500, req: ['hugg'], why: 'skogen norr om gården och flottning på älven', icon: '🛶' },
      { id: 'skog', namn: 'Lövskogen', rect: [14, 38, -40, -16], logs: 3, big: true, pad: [12.8, -30], cost: 9000, req: ['hugg:2'], why: 'stora träd som ger tre stockar var', icon: '🌳' },
    ],
    mal: [{ k: 'auto' }, { k: 'areas' }, { k: 'staffRole', r: 'flott', n: 3 }, { k: 'contracts', n: 2 }, { k: 'earned', n: 4e5 }] },
  { id: 'fjall', namn: 'Fjällskogen', terr: 'snow', form: 'U', cm: 4, seed: 3301, kart: [36, 24], vinter: true, vmul: 1.6, regrow: 2.5,
    vandning: 'Terrasser runt en frusen sjö. Isvägen är en genväg som bara bär när det är kallt. Träden växer sakta men är värda mer',
    areas: [
      { id: 'nord', namn: 'Fjällbjörkarna', rect: [-26, 26, -64, -40], logs: 2, pad: [-18, -38.8], cost: 15000, req: ['hugg'], why: 'mer skog att hugga', icon: '🌲' },
      { id: 'is', namn: 'Isvägen', rect: [-10, 10, -34, -2], ice: [-10, 10, -34, -2], island: [-4, 4, -22, -14], logs: 3, big: true, pad: [-11.2, -14], cost: 60000, req: ['snick'], why: 'genväg över isen och stora träd på ön', icon: '🛷' },
    ],
    mal: [{ k: 'auto' }, { k: 'areas' }, { k: 'orders', n: 4 }, { k: 'train', n: 6 }, { k: 'earned', n: 4e6 }] },
  { id: 'kust', namn: 'Kusthamnen', terr: 'coast', form: 'lang', cm: 8, seed: 4409, kart: [62, 40], hamn: true,
    vandning: 'Fartyg lägger till med jättebeställningar',
    areas: [
      { id: 'udde', namn: 'Udden', rect: [-64, -40, -34, 14.2], logs: 3, big: true, pad: [-38.8, 2], cost: 2e5, req: ['hugg:2'], why: 'stora tallar ute på udden', icon: '🌲' },
      { id: 'skog', namn: 'Strandskogen', rect: [-40, 10, -38, -14], logs: 2, pad: [0, -12.8], cost: 8e4, req: ['hugg'], why: 'mer skog att hugga', icon: '🌳' },
    ],
    mal: [{ k: 'auto' }, { k: 'orders', n: 3 }, { k: 'areas' }, { k: 'staff', n: 16 }, { k: 'earned', n: 4e7 }] },
];
// Nya marker: orter som skapas ur ett frö, med blandade vändningar, annan terräng och stigande krav. Tar aldrig slut.
const NAMN_A = ['Björk', 'Gran', 'Tall', 'Asp', 'Rönn', 'Myr', 'Älg', 'Ulv', 'Hägg', 'Lind', 'Bränn', 'Kvarn', 'Ren', 'Lo', 'Örn', 'Kråk', 'Stor', 'Lill', 'Norr', 'Sör'];
const NAMN_B = ['liden', 'berget', 'dalen', 'viken', 'tjärn', 'torp', 'hyttan', 'skogen', 'ån', 'näset', 'forsen', 'mon', 'backen', 'myren', 'åsen'];
const TERR_GEN = ['grass', 'heath', 'snow', 'birch', 'autumn'];
function rng32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const ORT_CACHE = {};
function ortDef(i) {
  if (i < ORTER.length) return ORTER[i];
  if (ORT_CACHE[i]) return ORT_CACHE[i];
  const k = i - ORTER.length + 1, seed = (Math.imul(i + 1, 2654435761) ^ 0x5bd1e995) >>> 0, r = rng32(seed), pick = a => a[r() * a.length | 0];
  for (let w = 0; w < 4; w++) r();
  const terr = TERR_GEN[(i * 3 + (seed & 1)) % TERR_GEN.length], tint = r(), cm = ORTER[ORTER.length - 1].cm * Math.pow(2, k);
  const tw = pick(['sjo', 'alv', 'is', 'storm', 'guld']);
  // Formen: två orter i rad får aldrig samma form (steget 3 av 4 går runt alla fyra)
  const form = ['rak', 'lang', 'U', 'bro'][(i * 3 + 1) % 4], mirror = rng32(seed ^ 0x2545f491)() < .5, F = mirror ? mirrorX(FORMS[form]) : FORMS[form], sl = F.slots;
  const areas = [];
  const big = r() < .5;
  const cost = c => Math.round(c * cm / 50) * 50;
  const inset = R => [R[0] + 4.5, R[1] - 5.5, R[2] + 4.5, R[3] - 6.5];
  const mid = R => [(R[0] + R[1]) / 2 - 4, (R[0] + R[1]) / 2 + 4, (R[2] + R[3]) / 2 - 4, (R[2] + R[3]) / 2 + 4];
  areas.push({ id: 'ne', namn: pick(['Granskogen', 'Tallmon', 'Björkhagen', 'Urskogen']), rect: sl.ne.r, logs: big ? 3 : 2, big, pad: sl.ne.pad, cost: cost(6000), req: ['hugg', ...(sl.ne.req || []).map(q => q === 'nord' && tw === 'alv' ? 'alv' : q)], why: 'mer skog att hugga', icon: '🌲' }); r();
  if (tw === 'alv') {
    const R = sl.nord.r, rz = form === 'bro' ? null : [R[3] - 8.5, R[3] - 4];   // älven nära gården, bron mitt för rutan
    areas.push({ id: 'alv', namn: form === 'bro' ? 'Norrskogen och flottningen' : 'Bron över älven', rect: R, ...(rz ? { river: [-90, 90, rz[0], rz[1]], bro: [sl.nord.pad[0] - 1.8, sl.nord.pad[0] + 1.8, rz[0], rz[1]] } : {}), logs: 2, pad: sl.nord.pad, cost: cost(2500), req: ['hugg'], why: 'skogen på andra sidan älven och flottning', icon: '🌉' });
  } else { areas.push({ id: 'nord', namn: pick(['Norrskogen', 'Höjden', 'Myrskogen']), rect: sl.nord.r, logs: 2, pad: sl.nord.pad, cost: cost(9000), req: ['hugg:2'], why: 'mer skog att hugga', icon: '🌳' }); r(); r(); }
  const V = sl.vast;
  if (tw === 'sjo') areas.push({ id: 'sjo', namn: 'Sjön', rect: V.r, lake: V.mitt ? [V.r[0] + 3, V.r[1] - 3, V.r[2] + 3, V.r[3] - 3] : inset(V.r), ...(V.mitt ? { island: mid(V.r) } : {}), flow: .5, logs: 2, pad: V.pad, cost: cost(11000), req: ['snick'], why: 'stockar flyter in av sig själva', icon: '🛶' });
  else if (tw === 'is') areas.push({ id: 'is', namn: 'Isvägen', rect: V.r, ice: V.mitt ? V.r : inset(V.r), island: mid(V.r), logs: 3, big: true, pad: V.pad, cost: cost(20000), req: ['snick'], why: 'stora träd på ön mitt i isen', icon: '🛷' });
  else { areas.push({ id: 'vast', namn: pick(['Västerskogen', 'Hagen', 'Lunden']), rect: V.r, logs: r() < .4 ? 3 : 2, pad: V.pad, cost: cost(11000), req: ['snick'], why: 'mer skog att hugga', icon: '🌲' }); r(); }
  const extra = [{ k: 'orders', n: 3 + k }, { k: 'contracts', n: 2 + k }, { k: 'train', n: 4 + 2 * k }, { k: 'staff', n: 12 + 2 * k }];
  const ex = extra.sort(() => r() - .5).slice(0, 2);
  const def = { id: 'gen' + i, namn: pick(NAMN_A) + pick(NAMN_B), terr, tint, form, cm, seed, gen: true, kart: [20 + r() * 60 | 0, 10 + r() * 80 | 0],
    vinter: terr === 'snow' || tw === 'is', vmul: terr === 'snow' ? 1.5 : 1 + k * .05, regrow: terr === 'snow' ? 2 : 1, hamn: r() < .25, mirror,
    storm: tw === 'storm', guld: tw === 'guld',
    vandning: { sjo: 'En sjö för in stockar', alv: 'Timret flottas på älven', is: 'Isvägen bär bara när det är kallt', storm: 'Stormigt: oftare storm och fler fallna träd', guld: 'Guldträden kommer oftare' }[tw] + (terr === 'snow' ? '. Vinter: träden växer sakta men är värda mer' : ''),
    areas, mal: [{ k: 'auto' }, { k: 'areas' }, ...ex, { k: 'earned', n: Math.round(1.5e6 * cm / 1000) * 1000 }] };
  ORT_CACHE[i] = def;
  return def;
}
const TERR_NAMN = { grass: 'Gräs och gran', valley: 'Älvdal', snow: 'Snö och fjäll', coast: 'Kust och sand', heath: 'Ljunghed', birch: 'Björkskog', autumn: 'Höstskog' };

/* ================= Modell: hela spelet utan grafik ================= */
// B = bolaget (gemensamt: pengar, epok, frön, stege, kontrakt, alla orters läge). S = orten man står i (en del av B.orter).
// S får B som osynlig egenskap, så att S.money och S.seeds pekar på bolaget och inte sparas två gånger.
function newOrt(i) {
  return { i, v: 3, lv: {}, paid: {}, stack: [], px: LAY.start[0], pz: LAY.start[1],
    q: Object.fromEntries(['intake', ...MACHS].map(k => [k, 0])), pile: Object.fromEntries(PILES.map(k => [k, {}])),
    kassa: 0, sold: 0, autoRate: 0, konc: 0, kEp: 1, earnedRun: 0, playT: 0, divert: {}, orders: 0, contracts: 0, firstBuy: 0, mal: [], master: false, staff: [], vehicle: 'fot' };
}
function newBolag(fro = 0) {
  return { v: 3, money: ECON.start, seeds: fro, ep: 1, steg: 0, earnedAll: 0, ort: 0, orter: [newOrt(0)], namnN: 0, kontrakt: { offers: [], active: null, wait: ECON.kontrakt.first, n: 0 }, mastered: 0 };
}
function bindOrt(B, S) {
  Object.defineProperty(S, 'B', { value: B, enumerable: false, writable: true, configurable: true });
  Object.defineProperty(S, 'money', { get() { return this.B.money; }, set(v) { this.B.money = v; }, enumerable: false, configurable: true });
  Object.defineProperty(S, 'seeds', { get() { return this.B.seeds; }, set(v) { this.B.seeds = v; }, enumerable: false, configurable: true });
  return S;
}
function fixOrt(S, i) {   // fyll i fält som saknas (äldre sparningar)
  const d = newOrt(i);
  for (const k in d) if (S[k] === undefined) S[k] = d[k];
  for (const k in d.q) if (!(S.q[k] >= 0)) S.q[k] = 0;
  for (const k in d.pile) if (!S.pile[k] || typeof S.pile[k] !== 'object') S.pile[k] = {};
  S.i = i;
  return S;
}
const lv = (S, id) => S.lv[id] || 0;
const EP = B => EPOKER[Math.min(EPOKER.length, Math.max(1, B.ep)) - 1];
function staffCap(S) { const C = ECON.staff; return C.base + (lv(S, 'bod') ? C.bod : 0) + (lv(S, 'kontor') ? C.kontor : 0) + (lv(S, 'hk') ? C.hk : 0); }
function staffN(S) { let n = 0; for (const r in YRKEN) n += lv(S, YRKEN[r].pad); return n; }
function roleN(S, r) { return lv(S, YRKEN[r].pad); }
function tm(S, r) { return 1 + .3 * lv(S, 'utb_' + r); }   // utbildningens effekt: +30 % per nivå
function trainTarget(S) {   // utbildningsrutan tränar alltid det anställda yrke som har lägst nivå
  let best = null;
  for (const r in YRKEN) { if (!roleN(S, r)) continue; const l = lv(S, 'utb_' + r); if (l >= ECON.train.max) continue; if (!best || l < lv(S, 'utb_' + best)) best = r; }
  return best;
}
const ROLE_EP = { hugg: 1, bar: 1, chauf: 1, flott: 1, mask: 2, eld: 2, truck: 3, mek: 3, skord: 4, plant: 4, salj: 4 };
function trainCost(S, r) { const T = ECON.train, ec = [1, 1, 5, 25, 120][ROLE_EP[r] || 1]; return Math.round(T.base * ec * Math.pow(T.grow, lv(S, 'utb_' + r)) / 10) * 10; }

function buildPads(def) {   // betalrutornas platser kommer från ortens gårdsform
  const list = [];
  for (const p of ECON.pads) { if (p.tw && !(def.areas.some(a => a.id === p.tw) || def[p.tw])) continue; list.push(LAY.pads[p.id] ? { ...p, at: LAY.pads[p.id] } : p); }
  for (const a of def.areas) list.push({ id: a.id, kind: 'area', area: a.id, name: a.namn, at: a.pad, cost: [a.cost / def.cm], req: a.req, why: a.why, icon: a.icon });
  return list;
}
function ortCm(G) { return G.def.cm; }
function padReqOk(G, p) {
  const S = G.S;
  if (p.ep && G.B.ep < p.ep) return false;
  if (p.kind === 'hire' && staffN(S) >= staffCap(S)) return false;
  const r = (p.req || []).concat((p.lvReq && p.lvReq[lv(S, p.id)]) || []);
  return r.every(x => { const [id, n] = x.split(':'); return lv(S, id) >= (+n || 1); });
}
function padVisible(G, p) {
  const S = G.S;
  if (p.kind === 'epoch') { const nx = EPOKER[G.B.ep]; return !!nx && !nx.kommer && nx.krav.every(k => kravOk(G, k)); }
  if (p.kind === 'train') return padReqOk(G, p) && !!trainTarget(S);
  return lv(S, p.id) < p.cost.length && padReqOk(G, p);
}
function padCost(G, p) {
  const S = G.S;
  if (p.kind === 'epoch') { const nx = EPOKER[G.B.ep]; return nx ? nx.kost : 1e18; }
  if (p.kind === 'train') { const r = trainTarget(S); return r ? trainCost(S, r) * ortCm(G) : 1e18; }
  return Math.round(p.cost[Math.min(lv(S, p.id), p.cost.length - 1)] * ortCm(G));
}
function padLeft(G, p) { return padCost(G, p) - (G.S.paid[p.id] || 0); }
function padMax(p) { return p.dyn ? 0 : p.cost.length; }
function padName(G, p) {
  if (p.kind === 'train') { const r = trainTarget(G.S); return r ? `Utbilda ${YRKEN[r].namn.toLowerCase()} till nivå ${lv(G.S, 'utb_' + r) + 2}` : p.name; }
  if (p.kind === 'epoch') { const nx = EPOKER[G.B.ep]; return nx ? `Modernisera: ${nx.namn}` : p.name; }
  return p.name;
}
function padWhy(G, p) {
  if (p.kind === 'train') { const r = trainTarget(G.S); return r ? `${YRKEN[r].namn.toLowerCase()} jobbar 30 % bättre` : p.why; }
  if (p.kind === 'epoch') { const nx = EPOKER[G.B.ep]; return nx ? `${nx.namn} (${nx.ar}): ${nx.nytt.toLowerCase()}, ny produkt och nya yrken` : ''; }
  return p.why || '';
}
function visiblePads(G) { return G.pads.filter(p => padVisible(G, p)); }
function nextGoal(G) { let b = null; for (const p of visiblePads(G)) if (!b || padLeft(G, p) < padLeft(G, b)) b = p; return b; }
function carryCap(S) { const v = S.vehicle && ECON.veh[S.vehicle]; return ECON.carry[Math.min(ECON.carry.length - 1, lv(S, 'pack'))] * (v ? v.carry : 1); }
function walkSpeed(G) { const S = G.S, v = S.vehicle && ECON.veh[S.vehicle]; return ECON.walk * (v ? v.walk : 1) * (G.def.vinter ? ECON.snoskoter : 1); }
function machRate(G, m) {
  const S = G.S, B = G.B;
  let r = ECON.mach[m].rate * Math.pow(ECON.upMult, lv(S, 'up_' + m)) * EP(B).fart;
  r *= 1 + .12 * roleN(S, 'mask') * tm(S, 'mask') + (roleN(S, 'eld') ? .2 * tm(S, 'eld') : 0);
  if (G.vissla > 0) r *= ECON.vissla.mult;
  return r;
}
function valueMult(G) { return (1 + G.B.seeds * ECON.fro) * EP(G.B).pris * (G.def.vmul || 1) * (1 + .04 * lv(G.S, 'utb_chauf')); }
function finalType(S) { return lv(S, 'hyvel') ? 'planed' : lv(S, 'sag') ? 'board' : 'barked'; }
function pileN(S, k, skip) { let n = 0; for (const t in S.pile[k]) if (t !== skip) n += S.pile[k][t]; return n; }
const reserved = G => G.order && G.order.st === 'open' ? G.order.type : null;
function pileTake(S, k, skip) { let best = null; for (const t in S.pile[k]) if (t !== skip && S.pile[k][t] > 0 && (!best || ECON.value[t] > ECON.value[best])) best = t; if (best) S.pile[k][best]--; return best; }
function automated(S) { return ['bark', 'sag', 'hyvel', 'press', 'snick'].every(m => lv(S, m)) && lv(S, 'hugg') >= 3 && lv(S, 'barare') >= 3 && lv(S, 'chauffor') >= 1; }
function kassaCap(G) { return Math.max(ECON.kassa.min, G.autoEMA * ECON.kassa.secs); }
function kassaFull(G) { return !lv(G.S, 'chauffor') && G.S.kassa >= kassaCap(G); }
function areaDef(G, a) { return G.def.areas.find(x => x.id === a); }
function yardOpen(G, y) { return !y.ep || G.B.ep >= y.ep; }
function areaOpen(G, a) { if (a === 'main') return true; const y = LAY.yard.find(q => q.id === a); return y ? yardOpen(G, y) : lv(G.S, a) > 0; }
function areaRect(G, a) { const y = LAY.yard.find(q => q.id === a); return y ? y.r : areaDef(G, a).rect; }
const inR = (x, z, r) => x >= r[0] && x <= r[1] && z >= r[2] && z <= r[3];
function iceOpen(G) { return !G.thaw; }
function walkable(G, x, z) {
  for (const y of LAY.yard) if (y.bro && yardOpen(G, y) && inR(x, z, y.r)) return true;            // broar över vatten
  for (const a of G.def.areas) if (a.bro && areaOpen(G, a.id) && inR(x, z, a.bro)) return true;
  for (const w of LAY.water) if (inR(x, z, w.r)) return false;                                       // älv genom gården
  for (const a of G.def.areas) {
    if (a.lake && inR(x, z, a.lake)) return false;
    if (a.river && inR(x, z, a.river)) return false;
    if (a.ice && inR(x, z, a.ice) && !(a.island && inR(x, z, a.island) && areaOpen(G, a.id)) && (!iceOpen(G) || !areaOpen(G, a.id))) return false;
  }
  for (const y of LAY.yard) if (yardOpen(G, y) && inR(x, z, y.r)) return true;
  for (const a of G.def.areas) if (areaOpen(G, a.id) && inR(x, z, a.rect)) return true;
  return false;
}
const sellable = (S, t) => t !== 'log' || !lv(S, 'bark');
const dist = (x, z, a) => Math.hypot(x - a[0], z - a[1]);
function treeOk(G, t) { if (!areaOpen(G, t.area)) return false; if (t.ice && G.thaw) return false; return true; }

// Träden: två rader i gården och skog i varje område. Samma frö ger samma skog.
// Träden: några rader i gården nära inlastningen och skog i varje område. Samma frö ger samma skog.
function makeTrees(def, pads) {
  const r = rng32(def.seed), T = [], tr = LAY.trees, keep = [...pads.map(p => p.at), ...Object.values(LAY.mach), ...Object.values(LAY.pile), LAY.intake, LAY.kontor, LAY.bod, LAY.anga, LAY.vissla, LAY.dock, LAY.kassa, LAY.start, LAY.sort];
  const free = (x, z, m) => keep.every(k => Math.abs(k[0] - x) > m || Math.abs(k[1] - z) > m);
  for (let row = 0; row < tr.rows; row++) for (let i = 0; i < tr.n; i++) {
    const x = tr.p[0] + tr.u[0] * i + (r() - .5) * .8 + (row % 2) * tr.v[0], z = tr.p[1] + tr.u[1] * i + row * tr.v[1] + (r() - .5) * .6;
    if (free(x, z, 1.8)) T.push({ x, z, area: 'main' });
  }
  for (const a of def.areas) {
    const R = a.rect, step = a.big ? 2.8 : 2.5, skip = a.big ? .3 : .38;
    for (let x = R[0] + 2.2; x < R[1] - 1; x += step) for (let z = R[2] + 2; z < R[3] - 1.2; z += step) {
      if (r() < skip) continue;
      const tx = x + (r() - .5) * 1.1, tz = z + (r() - .5) * 1.1;
      if (a.lake && inR(tx, tz, [a.lake[0] - 1.5, a.lake[1] + 1.5, a.lake[2] - 1.5, a.lake[3] + 1.5])) continue;
      if (a.river && inR(tx, tz, [a.river[0], a.river[1], a.river[2] - 1.6, a.river[3] + 2.2])) continue;
      if (a.bro && inR(tx, tz, [a.bro[0] - 2, a.bro[1] + 2, a.bro[2] - 3, a.bro[3] + 3])) continue;
      const onIsland = a.island && inR(tx, tz, [a.island[0] + .8, a.island[1] - .8, a.island[2] + .8, a.island[3] - .8]);
      if (a.ice && !onIsland && inR(tx, tz, [a.ice[0] - 1.2, a.ice[1] + 1.2, a.ice[2] - 1, a.ice[3] + 1])) continue;
      if (LAY.water.some(w => inR(tx, tz, [w.r[0], w.r[1], w.r[2] - 1.6, w.r[3] + 1.6]))) continue;
      if (LAY.yard.some(y => inR(tx, tz, [y.r[0] - .6, y.r[1] + .6, y.r[2] - .6, y.r[3] + .6]))) continue;
      if (!free(tx, tz, 1.6)) continue;
      T.push({ x: tx, z: tz, area: a.id, ice: !!a.ice, big: !!a.big });
      if (T.length > 170) break;
    }
  }
  return T;
}
function makeGame(B, seed = Date.now() % 1e9) {
  const def = ortDef(B.ort); setLayout(layoutFor(def));
  const S = bindOrt(B, fixOrt(B.orter[B.ort], B.ort)), pads = buildPads(def);
  const G = { B, S, def, pads, PAD: {}, t: 0, rng: rng32(seed), fx: [], noFx: false,
    trees: makeTrees(def, pads).map(t => ({ ...t, st: 'grown', t: 0, hits: 0, claim: null, gold: false, borre: false })),
    workers: [], ground: [], ev: null, order: null, lakeAcc: 0, timmerAcc: 0, vissla: 0, visslaCd: 0, season: 0, thaw: false,
    nextEv: Math.max(5, ECON.events.first - S.playT), nextOrder: ECON.orders.first,
    p: { x: S.px, z: S.pz, yaw: Math.PI, moving: false, pad: null, padT: 0, coinT: 0, chopT: 0, chop: null, pickT: 0, dropT: 0, fixT: 0, sellT: 0 },
    mach: {}, incEMA: 0, autoEMA: S.autoRate || 0, incAcc: 0, autoAcc: 0, emaT: 0, prodAcc: {}, prodEMA: {}, kAcc: 0, kEMA: 0, evalT: 0 };
  pads.forEach(p => G.PAD[p.id] = p);
  MACHS.forEach(m => G.mach[m] = { prog: 0, busy: 0, jam: false });
  PRODUCTS.forEach(t => { G.prodAcc[t] = 0; G.prodEMA[t] = 0; });
  if (!walkable(G, G.p.x, G.p.z)) { G.p.x = LAY.start[0]; G.p.z = LAY.start[1]; }
  syncStaff(G); syncWorkers(G);
  return G;
}
const fx = (G, o) => { if (!G.noFx) G.fx.push(o); };
const rr = (G, a, b) => a + G.rng() * (b - a);

// Personalliggaren: en anställd med namn per anställning
function syncStaff(G) {
  const S = G.S, B = G.B;
  for (const r in YRKEN) {
    const want = roleN(S, r); let have = S.staff.filter(s => s.r === r).length;
    while (have < want) { const k = B.namnN++; S.staff.push({ n: FORNAMN[(k * 7 + 3) % FORNAMN.length] + ' ' + EFTERNAMN[(k * 11 + 5) % EFTERNAMN.length], r }); have++; }
  }
}
const ROLE_HOME = r => r === 'eld' ? LAY.anga : r === 'salj' ? LAY.kontor : LAY.start;
function syncWorkers(G) {
  const S = G.S;
  for (const r in YRKEN) {
    const want = roleN(S, r);
    let have = G.workers.filter(w => w.role === r).length;
    while (have < want) { const pd = G.PAD[YRKEN[r].pad], at = pd ? pd.at : ROLE_HOME(r); G.workers.push({ role: r, i: have, x: at[0], z: at[1], yaw: 0, st: 'seek', t: 0, stack: [], tree: null, pile: null, moving: false, ph: 0, k: 0 }); have++; }
  }
}
function obstacles(G) {
  const S = G.S, o = [];
  for (const m of MACHS) if (lv(S, m)) o.push([LAY.mach[m][0], LAY.mach[m][1], LAY.machR[m]]);
  if (lv(S, 'bark')) o.push([LAY.intake[0], LAY.intake[1], 1.0]);
  o.push([LAY.kontor[0] - .3, LAY.kontor[1], 1.9]);
  if (lv(S, 'bod')) o.push([LAY.bod[0], LAY.bod[1], 1.4]);
  if (G.B.ep >= 2) o.push([LAY.anga[0], LAY.anga[1], 1.6]);
  for (const t of G.trees) if (t.st === 'grown' && areaOpen(G, t.area)) o.push([t.x, t.z, .45]);
  return o;
}
function movePlayer(G, nx, nz) {
  const p = G.p, obs = obstacles(G);
  for (let it = 0; it < 2; it++) for (const o of obs) {
    const dx = nx - o[0], dz = nz - o[1], d = Math.hypot(dx, dz), r = o[2] + .35;
    if (d < r && d > 1e-6) { nx = o[0] + dx / d * r; nz = o[1] + dz / d * r; }
  }
  const here = walkable(G, p.x, p.z);   // står han redan på något som inte bär (isen tinade) får han gå därifrån
  if (walkable(G, nx, nz) || !here) { p.x = nx; p.z = nz; }
  else if (walkable(G, nx, p.z)) p.x = nx;
  else if (walkable(G, p.x, nz)) p.z = nz;
}
function nearestTree(G, x, z, maxD, ok) {
  let b = null, bd = maxD;
  for (const t of G.trees) { if (!treeOk(G, t) || !ok(t)) continue; const d = Math.hypot(t.x - x, t.z - z); if (d < bd) { bd = d; b = t; } }
  return b;
}
function padAt(G, x, z) {
  for (const p of G.pads) if (Math.abs(x - p.at[0]) < 1.15 && Math.abs(z - p.at[1]) < 1.15 && padVisible(G, p)) return p;
  for (const p of G.pads) if (p.kind === 'machine' && padVisible(G, p) && Math.hypot(x - LAY.mach[p.m][0], z - LAY.mach[p.m][1]) < 1.7) return p;
  return null;
}
function incomeRate(G) { return Math.max(G.incEMA, 0.5); }

function completePad(G, pad) {
  const S = G.S, B = G.B;
  if (pad.kind === 'train') { const r = trainTarget(S); if (r) S.lv['utb_' + r] = lv(S, 'utb_' + r) + 1; S.paid[pad.id] = 0; fx(G, { k: 'built', id: pad.id, role: r }); return; }
  if (pad.kind === 'epoch') { B.ep++; S.paid[pad.id] = 0; if (!B.kontrakt.active) { B.kontrakt.offers = []; B.kontrakt.wait = 3; } fx(G, { k: 'epoch', ep: B.ep }); evalGoals(G); return; }
  S.lv[pad.id] = lv(S, pad.id) + 1; S.paid[pad.id] = 0;
  if (!S.firstBuy) S.firstBuy = S.playT;
  if (pad.kind === 'hire') { syncStaff(G); syncWorkers(G); }
  if (pad.kind === 'veh') setVehicle(G, pad.v);   // byter bara om lasten får plats
  fx(G, { k: 'built', id: pad.id });
  evalGoals(G);
}
function fell(G, t, by) {
  const S = G.S;
  t.st = 'falling'; t.t = 0; t.hits = 0;
  if (t.claim && t.claim !== by) { t.claim.tree = null; t.claim.st = 'seek'; }
  t.claim = null;
  if (t.gold) {
    t.gold = false;
    const amt = Math.round(Math.max(ECON.events.gold.min, incomeRate(G) * ECON.events.gold.secs) * valueMult(G));
    S.money += amt; addEarned(G, amt); fx(G, { k: 'gold', amt, x: t.x, z: t.z });
  }
  if (t.borre) {
    t.borre = false;
    const E = ECON.events.borre, amt = Math.round(Math.max(E.min, incomeRate(G) * E.secs) * valueMult(G));
    S.money += amt; addEarned(G, amt); fx(G, { k: 'borre', amt, x: t.x, z: t.z });
  }
  if (by === 'player' || by === 'storm') {
    const n = (areaDef(G, t.area) || {}).logs || 2;
    for (let k = 0; k < n; k++) {
      if (G.ground.length >= 140) G.ground.shift();
      const a = rr(G, 0, 6.28), r = rr(G, .6, 1.3);
      G.ground.push({ x: t.x + Math.cos(a) * r, z: t.z + Math.abs(Math.sin(a)) * r + .3, type: 'log', t: 0 });
    }
  }
  fx(G, { k: 'fall', x: t.x, z: t.z, by: by === 'player' ? 'p' : by === 'storm' ? 's' : 'w' });
}
function addEarned(G, v) { G.S.earnedRun += v; G.B.earnedAll += v; }
function priceOf(G, type) { return ECON.value[type] * valueMult(G) * (G.ev && G.ev.kind === 'rush' ? ECON.events.rush.mult : 1); }
function sell(G, type, who, w) {
  const S = G.S, v = priceOf(G, type);
  addEarned(G, v); S.sold++; G.incAcc += v;
  if (who === 'p') S.money += v;
  else { G.autoAcc += v; if (lv(S, 'chauffor')) S.money += v; else S.kassa += v; }
  fx(G, { k: 'sell', type, who, v, w });
  const o = G.order;
  if (who === 'p' && o && o.st === 'open' && o.type === type) { o.got++; if (o.got >= o.need) finishOrder(G, true); }
  const c = G.B.kontrakt.active;
  if (who === 'p' && c && c.ort === S.i) { const it = c.items.find(x => x.type === type && x.got < x.need); if (it) { it.got++; if (c.items.every(x => x.got >= x.need)) finishContract(G, true); } }
}
function orderBonusMult(G) { return 1 + .3 * roleN(G.S, 'salj') * tm(G.S, 'salj'); }
function finishOrder(G, ok) {
  const S = G.S, o = G.order; o.st = 'leave'; o.a = 0; o.ok = ok;
  if (ok) { const b = Math.round(o.need * ECON.value[o.type] * valueMult(G) * ECON.orders.bonus * (o.ship ? 1.5 : 1) * orderBonusMult(G)); o.bonus = b; S.money += b; addEarned(G, b); S.orders++; }
  fx(G, { k: 'order', st: ok ? 'ok' : 'miss', bonus: o.bonus || 0 });
  evalGoals(G);
}
function pileAdd(G, k, type) { const S = G.S; if (pileN(S, k) >= ECON.pcap[k]) return false; S.pile[k][type] = (S.pile[k][type] || 0) + 1; G.prodAcc[type]++; return true; }
function output(G, m) {
  const S = G.S, q = S.q, C = ECON.qcap, D = CHAIN[m];
  let sent = false;
  if (D.next && lv(S, D.next)) { if (q[D.next] >= C[D.next]) return false; q[D.next]++; fx(G, { k: 'proc', m, to: D.next }); sent = true; }
  else if (D.branch) {
    const opts = ['pile', ...D.branch.filter(b => lv(S, b))];
    const k = (S.divert[m] = (S.divert[m] || 0) + 1);
    for (let j = 0; j < opts.length && !sent; j++) {
      const o = opts[(k + j) % opts.length];
      if (o === 'pile') { if (pileAdd(G, D.pile, D.out)) { fx(G, { k: 'proc', m, to: D.pile }); sent = true; } }
      else if (q[o] < C[o]) { q[o]++; fx(G, { k: 'proc', m, to: o }); sent = true; }
    }
    if (!sent) return false;
  }
  else { if (!pileAdd(G, D.pile, D.out)) return false; fx(G, { k: 'proc', m, to: D.pile }); sent = true; }
  if (D.spill && lv(S, D.spill) && q[D.spill] < C[D.spill]) { q[D.spill]++; fx(G, { k: 'proc', m: 'spill', to: D.spill }); }
  return true;
}
function stepMachines(G, dt) {
  const S = G.S, q = S.q;
  for (const m of MACHS) {
    if (!lv(S, m)) continue;
    const M = G.mach[m]; M.busy = Math.max(0, M.busy - dt);
    if (M.jam) continue;
    const per = ECON.mach[m].per || 1, inQ = m === 'bark' ? 'intake' : m;
    M.prog = Math.min(M.prog + machRate(G, m) * dt, q[inQ] >= per ? 50 : 1);
    while (M.prog >= 1 && q[inQ] >= per) {
      if (!output(G, m)) { M.prog = 1; break; }
      q[inQ] -= per; M.prog -= 1; M.busy = .7;
    }
  }
}
function regrowTime(G) { return ECON.regrow * (G.def.regrow || 1) / (1 + .35 * roleN(G.S, 'plant') * tm(G.S, 'plant')); }
function stepTrees(G, dt) {
  const rg = regrowTime(G);
  for (const t of G.trees) {
    if (t.st === 'grown') continue;
    t.t += dt;
    if (t.st === 'falling' && t.t > .8) { t.st = 'gone'; t.t = 0; }
    else if (t.st === 'gone' && t.t > 1.5) { t.st = 'regrow'; t.t = 0; }
    else if (t.st === 'regrow' && t.t > rg) { t.st = 'grown'; t.t = 0; t.hits = 0; }
  }
  for (const g of G.ground) g.t += dt;
  if (G.ground.length && G.ground[0].t > ECON.groundLife) G.ground = G.ground.filter(g => g.t <= ECON.groundLife);
}
function hitTime(G) { const S = G.S; return S.vehicle === 'skord' ? .1 : ECON.chopHit[Math.min(ECON.chopHit.length - 1, lv(S, 'yxa'))]; }
function interact(G, dt) {
  const S = G.S, p = G.p, cap = carryCap(S);
  // 1. Betalruta: swischa
  let pad = padAt(G, p.x, p.z);
  const spot = pad && pad.at.join(',');
  if (p.padLock && spot !== p.padLock) { p.padLock = null; p.lockT = 0; }
  if (pad && spot === p.padLock) { p.lockT = (p.lockT || 0) + dt; if (p.lockT > 1.6) { p.padLock = null; p.lockT = 0; } else pad = null; }
  if (pad !== p.pad) { p.pad = pad; p.padT = 0; }
  if (pad) {
    p.padT += dt;
    if (p.padT > ECON.padDelay && S.money > 1e-6) {
      const cost = padCost(G, pad), rem = cost - (S.paid[pad.id] || 0);
      let a = Math.min(Math.max(ECON.pay.minRate, cost * ECON.pay.frac) * dt, S.money, rem);
      if (rem - a < .01 && S.money >= rem) a = rem;
      S.money -= a; S.paid[pad.id] = (S.paid[pad.id] || 0) + a;
      p.coinT -= dt; if (p.coinT <= 0) { p.coinT = .045; fx(G, { k: 'pay', id: pad.id }); }
      if (S.paid[pad.id] >= cost - 1e-6) { completePad(G, pad); p.padLock = pad.at.join(','); p.pad = null; }
      return;
    }
  }
  // 2. Maskinstopp: knacka loss. Tryck i pannan: släpp ångan.
  if (G.ev && G.ev.kind === 'jam' && G.mach[G.ev.m].jam && dist(p.x, p.z, LAY.mach[G.ev.m]) < LAY.machR[G.ev.m] + 1.6) {
    p.fixT += dt; if (Math.floor(p.fixT / .25) !== Math.floor((p.fixT - dt) / .25)) fx(G, { k: 'knock', m: G.ev.m });
    if (p.fixT >= ECON.events.jam.fix) { fixJam(G, 'p'); p.fixT = 0; }
  } else if (G.ev && G.ev.kind === 'panna' && dist(p.x, p.z, LAY.vissla) < 1.8) {
    p.fixT += dt; if (Math.floor(p.fixT / .3) !== Math.floor((p.fixT - dt) / .3)) fx(G, { k: 'steam' });
    if (p.fixT >= ECON.events.panna.fix) {
      p.fixT = 0; const E = ECON.events.panna, amt = Math.round(Math.max(E.min, incomeRate(G) * E.secs) * valueMult(G));
      S.money += amt; addEarned(G, amt); fx(G, { k: 'fixed', m: 'anga', amt }); endEvent(G, 'done');
    }
  } else p.fixT = 0;
  // Ångvisslan: alla maskiner går dubbelt så fort en stund
  if (G.B.ep >= 2 && !(G.ev && G.ev.kind === 'panna') && G.visslaCd <= 0 && dist(p.x, p.z, LAY.vissla) < 1.5) { G.vissla = ECON.vissla.T; G.visslaCd = ECON.vissla.cd; fx(G, { k: 'vissla' }); }
  // 3. Hugga (inte med truck)
  const room = cap - S.stack.length;
  const tr = S.vehicle === 'truck' ? null : nearestTree(G, p.x, p.z, S.vehicle === 'skord' ? 2.8 : 2.1, t => t.st === 'grown');
  if (tr && (room > 0 || tr.gold || tr.borre)) {
    if (p.chop !== tr) p.chopT = 0;
    p.chop = tr; p.chopT += dt * (p.moving ? .6 : 1);
    const hit = hitTime(G);
    if (p.chopT >= hit) {
      p.chopT -= hit; tr.hits++; fx(G, { k: 'hit', x: tr.x, z: tr.z, gold: tr.gold });
      const need = tr.gold ? ECON.events.gold.hits : S.vehicle === 'skord' ? 1 : ECON.treeHits;
      if (tr.hits >= need) { fell(G, tr, 'player'); p.chop = null; p.chopT = 0; }
    }
  } else { p.chop = null; p.chopT = 0; }
  // 4. Plocka upp: stockar på marken och högar (skördaren tar bara stockar)
  p.pickT = Math.max(0, p.pickT - dt);
  while (p.pickT <= 0 && S.stack.length < cap) {
    let got = null;
    for (let i = 0; i < G.ground.length; i++) { const g = G.ground[i]; if (g.t > .25 && Math.hypot(g.x - p.x, g.z - p.z) < 2.0) { got = g.type; fx(G, { k: 'pick', type: g.type, x: g.x, z: g.z }); G.ground.splice(i, 1); break; } }
    if (!got && S.vehicle !== 'skord') for (const k of PILES) {
      if (pileN(S, k) > 0 && dist(p.x, p.z, LAY.pile[k]) < 2.1) { got = pileTake(S, k); fx(G, { k: 'pick', type: got, pile: k }); break; }
    }
    if (!got) break;
    S.stack.push(got); p.pickT += ECON.pickGap;
  }
  // 5. Lämna: stockar vid inlastningen, varor vid lastkajen, pengar i kassan
  p.dropT = Math.max(0, p.dropT - dt);
  while (p.dropT <= 0 && S.stack.length) {
    let i = -1, where = null;
    if (lv(S, 'bark') && dist(p.x, p.z, LAY.intake) < 2.6 && S.q.intake < ECON.qcap.intake) { i = S.stack.lastIndexOf('log'); where = 'intake'; }
    if (i < 0 && dist(p.x, p.z, LAY.dock) < 2.8) { for (let j = S.stack.length - 1; j >= 0; j--) if (sellable(S, S.stack[j])) { i = j; break; } where = 'dock'; }
    if (i < 0) break;
    const t = S.stack.splice(i, 1)[0];
    if (where === 'intake') { S.q.intake++; fx(G, { k: 'feed', who: 'p' }); } else sell(G, t, 'p');
    p.dropT += ECON.dropGap;
  }
  if (S.kassa >= 1 && dist(p.x, p.z, LAY.kassa) < 2.2) { const a = S.kassa; S.money += a; S.kassa = 0; fx(G, { k: 'kassa', amt: a }); }
}
function fixJam(G, who) {
  const S = G.S, m = G.ev.m;
  G.mach[m].jam = false;
  const amt = who === 'p' ? Math.round(Math.max(ECON.events.jam.min, incomeRate(G) * ECON.events.jam.secs) * valueMult(G)) : 0;
  if (amt) { S.money += amt; addEarned(G, amt); }
  fx(G, { k: 'fixed', m, amt, who });
}
// Byt fordon: gratis och direkt. Går bara om lasten får plats.
function vehicles(S) { const v = ['fot']; if (lv(S, 'gtruck')) v.push('truck'); if (lv(S, 'gskord')) v.push('skord'); return v; }
function setVehicle(G, v) {
  const S = G.S; if (!vehicles(S).includes(v)) return false;
  const old = S.vehicle; S.vehicle = v === 'fot' ? 'fot' : v;
  if (S.stack.length > carryCap(S) || (v === 'skord' && S.stack.some(t => t !== 'log'))) { S.vehicle = old; return false; }
  fx(G, { k: 'veh', v }); return true;
}
function moveTo(w, tx, tz, sp, dt) {
  const dx = tx - w.x, dz = tz - w.z, d = Math.hypot(dx, dz), s = sp * dt;
  if (d <= s) { w.x = tx; w.z = tz; w.moving = false; return true; }
  w.x += dx / d * s; w.z += dz / d * s; w.yaw = Math.atan2(dx, dz); w.moving = true; return false;
}
function bestPile(G, w, carry) {
  const S = G.S; let best = null, bn = 0;
  for (const k of PILES) { const n = pileN(S, k, reserved(G)) - G.workers.filter(o => o !== w && (o.role === 'bar' || o.role === 'truck') && o.st === 'walk' && o.pile === k).length * carry; if (n > bn) { bn = n; best = k; } }
  return best;
}
function stepWorker(G, w, dt) {
  const S = G.S, W = ECON.worker, arb = EP(G.B).arb;
  if (w.role === 'hugg' || w.role === 'skord') {
    const sk = w.role === 'skord', f = arb * tm(S, w.role) * (sk ? 1.3 : 1), cap = sk ? W.skordCarry : W.huggCarry;
    if (w.st === 'seek') {
      if (w.stack.length >= cap) { w.st = 'deliver'; return; }
      let gl = null, gd = 14;
      if (!sk) for (const g of G.ground) { const d = Math.hypot(g.x - w.x, g.z - w.z); if (d < gd && !g.claim) { gd = d; gl = g; } }
      if (gl) { gl.claim = w; w.gl = gl; w.st = 'pickup'; return; }
      const tr = nearestTree(G, w.x, w.z, 999, t => t.st === 'grown' && !t.claim && !t.gold && !t.borre);
      if (!tr) { w.moving = false; if (w.stack.length) w.st = 'deliver'; return; }
      tr.claim = w; w.tree = tr; w.st = 'walk';
    } else if (w.st === 'pickup') {
      const i = G.ground.indexOf(w.gl);
      if (i < 0) { w.gl = null; w.st = 'seek'; return; }
      if (moveTo(w, w.gl.x, w.gl.z + .4, W.walk * f, dt)) { G.ground.splice(i, 1); w.stack.push('log'); w.gl = null; w.st = 'seek'; }
    } else if (w.st === 'walk') {
      if (!w.tree || w.tree.st !== 'grown' || !treeOk(G, w.tree)) { if (w.tree) w.tree.claim = null; w.tree = null; w.st = 'seek'; return; }
      if (moveTo(w, w.tree.x + .2, w.tree.z + (sk ? 1.6 : .9), W.walk * f, dt)) { w.st = 'chop'; w.t = sk ? W.skordChop : W.chop / (arb * tm(S, w.role)); w.yaw = Math.PI; }
    } else if (w.st === 'chop') {
      w.moving = false;
      if (!w.tree || w.tree.st !== 'grown') { w.tree = null; w.st = 'seek'; return; }
      w.t -= dt; w.ph += dt;
      if (w.t <= 0) { const n = (areaDef(G, w.tree.area) || {}).logs || 2; fell(G, w.tree, w); for (let k = 0; k < n; k++) w.stack.push('log'); w.tree = null; w.st = 'seek'; }
    } else if (w.st === 'deliver') {
      if (moveTo(w, LAY.intake[0] - 1.6 + w.i * .25 + (sk ? -1 : 0), LAY.intake[1] - 1.2 - w.i * .3, W.walk * f, dt)) {
        w.t -= dt;
        if (w.t <= 0 && w.stack.length && S.q.intake < ECON.qcap.intake) { w.stack.pop(); S.q.intake++; w.t = W.gap / f; fx(G, { k: 'feed', who: 'w' }); }
        if (!w.stack.length) w.st = 'seek';
      }
    }
  } else if (w.role === 'bar' || w.role === 'truck') {
    const tk = w.role === 'truck', f = arb * tm(S, w.role), cap = tk ? W.truckCarry : W.barCarry, sp = (tk ? W.truckWalk : W.walk) * f;
    if (w.st === 'seek') {
      if (w.stack.length) { w.st = 'deliver'; return; }
      const best = bestPile(G, w, cap);
      if (!best) { const h = G.PAD[tk ? 'truckf' : 'barare'].at; moveTo(w, h[0] + 1.5 + w.i, h[1] + 1.5, sp, dt); return; }
      w.pile = best; w.st = 'walk';
    } else if (w.st === 'walk') {
      const at = LAY.pile[w.pile];
      if (moveTo(w, at[0] + 1.3 - w.i * .4, at[1] + 1.2, sp, dt)) { w.st = 'load'; w.t = 0; }
    } else if (w.st === 'load') {
      w.t -= dt;
      if (w.t <= 0) { if (w.stack.length < cap && pileN(S, w.pile, reserved(G)) > 0) { w.stack.push(pileTake(S, w.pile, reserved(G))); w.t = W.gap / (tk ? 3 : 1); } else w.st = w.stack.length ? 'deliver' : 'seek'; }
    } else if (w.st === 'deliver') {
      if (moveTo(w, LAY.dock[0] - 1.2 + w.i * .9 + (tk ? 1.8 : 0), LAY.dock[1] - .2, sp, dt)) {
        w.t -= dt;
        if (w.t <= 0) { if (!w.stack.length) w.st = 'seek'; else if (!kassaFull(G)) { sell(G, w.stack.pop(), 'w', w); w.t = W.gap / (tk ? 3 : 1); } }
      }
    }
  } else if (w.role === 'chauf') { moveTo(w, LAY.dock[0] + 2.6, LAY.dock[1] + 1.6, W.walk, dt); }
  else if (w.role === 'mask') {   // går mellan maskinerna och smörjer
    const owned = MACHS.filter(m => lv(S, m)); if (!owned.length) return;
    const m = owned[(w.k + w.i * 2) % owned.length], at = LAY.mach[m];
    if (w.st === 'seek') { if (moveTo(w, at[0] + LAY.machR[m] + .5, at[1] + .8, W.walk * arb, dt)) { w.st = 'oil'; w.t = 3; w.yaw = -Math.PI / 2; } }
    else { w.moving = false; w.t -= dt; w.ph += dt; if (w.t <= 0) { w.k++; w.st = 'seek'; } }
  } else if (w.role === 'eld') {  // bär spån från pressen till ångmaskinen
    if (w.st === 'seek') { if (moveTo(w, LAY.pile.sack[0] + 1.6, LAY.pile.sack[1] - 1.2, W.walk * arb, dt)) { w.stack = ['chip', 'chip', 'chip']; w.st = 'deliver'; } }
    else if (w.st === 'deliver') { if (moveTo(w, LAY.anga[0] - 1.9, LAY.anga[1] + .6, W.walk * arb, dt)) { w.st = 'fire'; w.t = 2; w.yaw = Math.PI / 2; } }
    else { w.moving = false; w.t -= dt; w.ph += dt; if (w.t < 1.2) w.stack = []; if (w.t <= 0) { w.st = 'seek'; fx(G, { k: 'fire' }); } }
  } else if (w.role === 'mek') {  // springer till maskinstopp och lagar
    if (G.ev && G.ev.kind === 'jam' && G.mach[G.ev.m].jam) {
      const at = LAY.mach[G.ev.m];
      if (moveTo(w, at[0] - LAY.machR[G.ev.m] - .6, at[1] + .4, W.walk * 1.3 * arb, dt)) { w.t += dt; w.ph += dt; if (w.t > 3 / tm(S, 'mek')) { w.t = 0; fixJam(G, 'w'); endEvent(G, 'mek'); } }
    } else { w.t = 0; const h = G.PAD.mek.at; moveTo(w, h[0] + 1.4, h[1] + 1.4, W.walk, dt); }
  } else if (w.role === 'plant') { // går till fällda träd och planterar
    if (w.st === 'seek') { const c = G.trees.filter(t => t.st === 'regrow' && treeOk(G, t) && !t.pl); const t = c[(w.k * 7 + w.i * 3) % Math.max(1, c.length)]; if (t) { t.pl = 1; w.tree = t; w.st = 'walk'; } else moveTo(w, LAY.intake[0] + 2 + w.i, LAY.intake[1] - 1.5, W.walk, dt); }
    else if (w.st === 'walk') { if (!w.tree) { w.st = 'seek'; return; } if (moveTo(w, w.tree.x + .3, w.tree.z + .9, W.walk * arb, dt)) { w.st = 'plant'; w.t = 1.2; } }
    else { w.moving = false; w.t -= dt; w.ph += dt; if (w.t <= 0) { if (w.tree) { w.tree.pl = 0; w.tree.t += 4; } w.tree = null; w.k++; w.st = 'seek'; } }
  } else if (w.role === 'salj') { // pendlar mellan kontoret och lastkajen
    const tgt = w.k % 2 ? [LAY.dock[0] - 2.6, LAY.dock[1] - 2] : [LAY.kontor[0] + 2.6, LAY.kontor[1] - .4];
    if (w.st === 'seek') { if (moveTo(w, tgt[0] + w.i * .6, tgt[1], W.walk * .8, dt)) { w.st = 'talk'; w.t = 4; } }
    else { w.moving = false; w.t -= dt; w.ph += dt; if (w.t <= 0) { w.k++; w.st = 'seek'; } }
  } else if (w.role === 'flott') { // står vid älven och stakar timret
    const a = (LAY.water.find(x => x.kind === 'river') || {}).r || (G.def.areas.find(x => x.river) || {}).river; if (!a) return;
    const side = a[3] < LAY.intake[1] + 40 && a[3] > LAY.intake[1] ? a[2] - .6 : a[3] + .6;   // stranden närmast inlastningen
    moveTo(w, LAY.intake[0] - 9 + w.i * 6, side, W.walk, dt); if (!w.moving) w.ph += dt;
  }
}
function flowRate(G) {   // stockar per sekund som flyter in av sig själva
  const S = G.S; let f = 0;
  for (const a of G.def.areas) { if (!areaOpen(G, a.id)) continue; if (a.flow) f += a.flow; if (a.river || (a.id === 'alv' && LAY.water.some(w => w.kind === 'river'))) f += .35 * roleN(S, 'flott') * tm(S, 'flott'); }
  if (G.B.ep >= 3 && lv(S, 'chauffor')) f += .4;   // timmerbilen hämtar själv
  return f;
}
function eventKinds(G) {
  const S = G.S, kinds = ['storm', 'gold'];
  if (lv(S, 'sag')) kinds.push('rush');
  if (MACHS.some(m => lv(S, m))) kinds.push('jam');
  if (G.B.ep >= 2) kinds.push('panna');
  if (G.B.ep >= 3) kinds.push('tappat');
  if (G.B.ep >= 4) kinds.push('borre');
  if (G.def.storm) kinds.push('storm');
  if (G.def.guld) kinds.push('gold');
  return kinds;
}
function startEvent(G) {
  const S = G.S, E = ECON.events, kinds = eventKinds(G);
  if (!G.evBag || !G.evBag.some(k => kinds.includes(k))) G.evBag = kinds.slice();
  const pick = G.evBag.filter(k => kinds.includes(k) && k !== G.lastEv);
  const kind = pick.length ? pick[G.rng() * pick.length | 0] : kinds[G.rng() * kinds.length | 0];
  G.evBag.splice(G.evBag.indexOf(kind), 1);
  const ev = { kind, T: E[kind].T, t: E[kind].T, acc: 0 };
  if (kind === 'gold' || kind === 'borre') {
    const c = G.trees.filter(t => t.st === 'grown' && !t.claim && treeOk(G, t));
    if (c.length < (kind === 'borre' ? E.borre.n : 1)) { G.nextEv = 20; return; }
    if (kind === 'gold') { ev.tree = c[G.rng() * c.length | 0]; ev.tree.gold = true; }
    else { ev.trees = []; for (let k = 0; k < E.borre.n; k++) { const t = c.splice(G.rng() * c.length | 0, 1)[0]; t.borre = true; ev.trees.push(t); } }
  }
  if (kind === 'jam') { const owned = MACHS.filter(m => lv(S, m)); ev.m = owned[G.rng() * owned.length | 0]; G.mach[ev.m].jam = true; }
  if (kind === 'tappat') { for (let k = 0; k < E.tappat.n; k++) G.ground.push({ x: LAY.dock[0] + rr(G, -7, 3), z: LAY.dock[1] + rr(G, .6, 2), type: 'log', t: 0 }); }
  G.ev = ev; G.lastEv = kind; fx(G, { k: 'ev', kind, on: true });
}
function endEvent(G, why) {
  const ev = G.ev; if (!ev) return;
  if (ev.kind === 'gold' && ev.tree) ev.tree.gold = false;
  if (ev.kind === 'borre') ev.trees.forEach(t => t.borre = false);
  if (ev.kind === 'jam') G.mach[ev.m].jam = false;
  G.ev = null; G.nextEv = rr(G, ECON.events.gap[0], ECON.events.gap[1]) * (G.def.storm ? .7 : 1);
  fx(G, { k: 'ev', kind: ev.kind, on: false, why });
}
function stepEvents(G, dt) {
  const S = G.S, E = ECON.events;
  if (!G.ev) { G.nextEv -= dt; if (G.nextEv <= 0) startEvent(G); return; }
  const ev = G.ev; ev.t -= dt;
  if (ev.kind === 'storm') {
    ev.acc += dt;
    while (ev.acc >= E.storm.every) {
      ev.acc -= E.storm.every;
      const c = G.trees.filter(t => t.st === 'grown' && !t.gold && !t.borre && treeOk(G, t));
      if (c.length) fell(G, c[G.rng() * c.length | 0], 'storm');
    }
  }
  if (ev.kind === 'gold' && !ev.tree.gold) { G.ev.tree = null; endEvent(G, 'done'); return; }
  if (ev.kind === 'borre' && ev.trees.every(t => !t.borre)) { endEvent(G, 'done'); return; }
  if (ev.kind === 'jam' && !G.mach[ev.m].jam) { endEvent(G, 'done'); return; }
  if (ev.t <= 0) endEvent(G, 'time');
}
function orderTypes(S) {
  const types = [finalType(S)];
  if (lv(S, 'press')) types.push('sack');
  if (lv(S, 'snick')) types.push('furn');
  if (lv(S, 'ugn')) types.push('torr');
  if (lv(S, 'lim')) types.push('limtra');
  if (lv(S, 'list')) types.push('fonster');
  return types;
}
function startOrder(G) {
  const S = G.S, O = ECON.orders, types = orderTypes(S);
  const type = types[G.rng() * types.length | 0], ship = !!G.def.hamn && G.rng() < .5;
  const pk = TYPE_PILE[type], T = O.T * (ship ? 1.6 : 1);
  const avail = (S.pile[pk][type] || 0) + Math.max(G.prodEMA[type] || 0, O.base[type]) * T * O.factor;
  const need = Math.max(O.min, Math.min(O.max, Math.round(Math.min(carryCap(S) * O.trips * (ship ? 2.2 : 1), avail))));
  G.order = { type, need, got: 0, T, t: T, st: 'arrive', a: 0, ship };
  fx(G, { k: 'order', st: 'new' });
}
function stepOrder(G, dt) {
  const S = G.S, O = ECON.orders, o = G.order;
  if (!o) { if (lv(S, 'sag')) { G.nextOrder -= dt * (1 + .25 * roleN(S, 'salj')); if (G.nextOrder <= 0) startOrder(G); } return; }
  o.a += dt;
  if (o.st === 'arrive' && o.a >= 2.5) { o.st = 'open'; o.a = 0; }
  else if (o.st === 'open') { o.t -= dt; if (o.t <= 0) finishOrder(G, false); }
  else if (o.st === 'leave' && o.a >= 3) { G.order = null; G.nextOrder = rr(G, O.gap[0], O.gap[1]); }
}

/* ---------- Kontraktstavlan: välj ett av tre ---------- */
const KUNDER = ['Byggfirman Ek & Son', 'Möbelhuset i stan', 'Järnvägsbolaget', 'Snickarlaget', 'Bruket vid ån', 'Villabygget', 'Skolbygget', 'Kyrkorådet', 'Brädgården', 'Båtvarvet', 'Hembygdsföreningen', 'Stugbyn'];
function contractsOpen(G) { return lv(G.S, 'barare') > 0; }
function makeOffers(G) {
  const S = G.S, B = G.B, K = ECON.kontrakt, types = orderTypes(S), offers = [];
  for (let s = 0; s < 3; s++) {
    const nT = Math.min(types.length, s + 1), pool = types.slice(), items = [];
    for (let j = 0; j < nT; j++) {
      const type = j === 0 && s === 0 ? pool.splice(G.rng() * pool.length | 0, 1)[0] : pool.splice((pool.length - 1 - (G.rng() * Math.min(pool.length, 3) | 0)), 1)[0];
      const prod = Math.max(G.prodEMA[type] || 0, ECON.orders.base[type] || .05);
      const fromCarry = carryCap(S) * (1 + s) / nT;
      const need = Math.max(3, Math.round(Math.min(fromCarry, prod * K.T[s] * .3 + (S.pile[TYPE_PILE[type]][type] || 0) * .5)));
      items.push({ type, need, got: 0 });
    }
    const val = items.reduce((a, it) => a + it.need * ECON.value[it.type], 0);
    const reward = Math.round(val * valueMult(G) * K.mult[s] * (1 + .15 * roleN(S, 'salj') * tm(S, 'salj')) / 10) * 10 + Math.round(30 * ortCm(G) * (s + 1));
    offers.push({ kund: KUNDER[(B.kontrakt.n * 3 + s * 5 + (G.rng() * 4 | 0)) % KUNDER.length], items, T: K.T[s], reward, fro: s === 2 && B.kontrakt.n % 3 === 2 ? 1 : 0, size: s });
  }
  B.kontrakt.offers = offers;
}
function takeContract(G, i) {
  const B = G.B, c = B.kontrakt.offers[i]; if (!c || B.kontrakt.active) return false;
  B.kontrakt.active = { ...c, items: c.items.map(x => ({ ...x })), t: c.T, ort: G.S.i };
  B.kontrakt.offers = []; fx(G, { k: 'kontrakt', st: 'tagen' }); return true;
}
function finishContract(G, ok) {
  const B = G.B, c = B.kontrakt.active; if (!c) return;
  B.kontrakt.active = null; B.kontrakt.wait = ECON.kontrakt.gap; B.kontrakt.n++;
  if (ok) { B.money += c.reward; addEarned(G, c.reward); if (c.fro) B.seeds += c.fro; if (B.orter[c.ort]) B.orter[c.ort].contracts = (B.orter[c.ort].contracts || 0) + 1; }
  fx(G, { k: 'kontrakt', st: ok ? 'ok' : 'miss', reward: ok ? c.reward : 0, fro: ok ? c.fro : 0 });
  evalGoals(G);
}
function stepContracts(G, dt) {
  const K = G.B.kontrakt;
  if (K.active) { K.active.t -= dt; if (K.active.t <= 0) finishContract(G, false); return; }
  if (!contractsOpen(G)) return;
  if (!K.offers.length) { K.wait -= dt; if (K.wait <= 0) makeOffers(G); }
}

/* ---------- Krav och mål: epoker, mästarbrev, stegen ---------- */
function ortMax(B) { let n = 1; for (let i = 0; i < B.orter.length; i++) if (B.orter[i].master) n = i + 2; return n; }
function kravVal(G, k) {   // [har, behöver]
  const S = G.S, B = G.B;
  switch (k.k) {
    case 'auto': return [B.orter.some(o => automatedO(o)) ? 1 : 0, 1];
    case 'autoHere': return [automated(S) ? 1 : 0, 1];
    case 'autoOrter': return [B.orter.filter(o => automatedO(o)).length, k.n];
    case 'earnedAll': return [B.earnedAll, k.n];
    case 'earned': return [S.earnedRun, k.n];
    case 'epoch': return [B.ep, k.n];
    case 'master': return [B.orter.filter(o => o.master).length, k.n];
    case 'orter': return [B.orter.length, k.n];
    case 'mach': return [B.orter.some(o => (o.lv[k.id] || 0) > 0) ? 1 : 0, 1];
    case 'machHere': return [lv(S, k.id) ? 1 : 0, 1];
    case 'orders': return [S.orders, k.n];
    case 'contracts': return [S.contracts || 0, k.n];
    case 'areas': return [G.def.areas.filter(a => lv(S, a.id)).length, G.def.areas.length];
    case 'staff': return [staffN(S), k.n];
    case 'staffRole': return [roleN(S, k.r), k.n];
    case 'train': { let n = 0; for (const r in YRKEN) n += lv(S, 'utb_' + r); return [n, k.n]; }
  }
  return [0, 1];
}
function kravOk(G, k) { const [h, n] = kravVal(G, k); return h >= n; }
function kravTxt(G, k) {
  const f = typeof fmt === 'function' ? fmt : String;
  switch (k.k) {
    case 'auto': return 'Automatisera ett verk (anställ chaufför)';
    case 'autoHere': return 'Gör verket helt automatiserat';
    case 'autoOrter': return `Helt automatiserat i ${k.n} orter`;
    case 'earnedAll': return `Bolaget har tjänat ${f(k.n)} kr`;
    case 'earned': return `Tjäna ${f(k.n)} kr i orten`;
    case 'epoch': return `Modernisera till ${EPOKER[k.n - 1].namn}`;
    case 'master': return k.n === 1 ? 'Få ett mästarbrev' : `Få ${k.n} mästarbrev`;
    case 'orter': return `Driv ${k.n} orter`;
    case 'mach': case 'machHere': { const p = ECON.pads.find(x => x.id === k.id); return `Bygg ${p ? p.name.toLowerCase() : k.id}`; }
    case 'orders': return `Klara ${k.n} beställningar`;
    case 'contracts': return `Klara ${k.n} kontrakt`;
    case 'areas': return 'Öppna alla områden';
    case 'staff': return `Ha ${k.n} anställda`;
    case 'staffRole': return `Anställ ${k.n} ${YRKEN[k.r].namn.toLowerCase()}`;
    case 'train': return `Utbilda personalen ${k.n} nivåer`;
  }
  return '';
}
function automatedO(o) { return ['bark', 'sag', 'hyvel', 'press', 'snick'].every(m => (o.lv[m] || 0) > 0) && (o.lv.hugg || 0) >= 3 && (o.lv.barare || 0) >= 3 && (o.lv.chauffor || 0) >= 1; }
function nextEpoch(B) { return EPOKER[B.ep] || null; }
function evalGoals(G) {
  const S = G.S, B = G.B, def = G.def;
  // ortens mästarbrev: fem mål som stannar klara
  if (!S.master) {
    def.mal.forEach((k, i) => { if (!S.mal[i] && kravOk(G, k)) { S.mal[i] = true; fx(G, { k: 'mal', i, txt: kravTxt(G, k) }); } });
    if (def.mal.every((k, i) => S.mal[i])) { S.master = true; B.mastered++; fx(G, { k: 'master', ort: S.i, next: ortDef(S.i + 1).namn }); }
  }
  // bolagsstegen
  for (let guard = 0; guard < 5; guard++) {
    const nx = stegDef(B.steg + 1);
    if (!kravOk(G, nx.k)) break;
    B.steg++; B.seeds += nx.fro || 0; fx(G, { k: 'steg', t: nx.t, fro: nx.fro || 0 });
  }
}
// Resa till en annan ort. Orten man lämnar fortsätter av sig själv och betalar koncernintäkt.
function canTravel(B, i) { return i >= 0 && i < ortMax(B) && i !== B.ort; }
function travel(B, i) {
  if (!canTravel(B, i)) return false;
  while (B.orter.length <= i) B.orter.push(newOrt(B.orter.length));
  B.ort = i; if (!B.kontrakt.active) { B.kontrakt.offers = []; B.kontrakt.wait = 3; } return true;
}
// Koncernintäkt: orter man inte står i ger sin utjämnade takt (bara om de har chaufför), uppräknad med epokens pris.
function koncRate(B) {
  let r = 0;
  B.orter.forEach((o, i) => { if (i === B.ort || !(o.lv.chauffor > 0)) return; r += (o.konc || 0) * EP(B).pris / ((EPOKER[(o.kEp || 1) - 1] || EPOKER[0]).pris); });
  return r;
}
function stepKonc(G, dt) {
  const B = G.B, S = G.S, r = koncRate(B);
  if (r > 0) { const a = r * dt; B.money += a; B.earnedAll += a; G.kAcc += a; }
  // ortens egen utjämnade takt, som den tar med sig när man reser
  const a = 1 - Math.exp(-dt / ECON.konc.tau); S.konc += (G.autoEMA - S.konc) * a; S.kEp = B.ep;
}
function step(G, dt, ix = 0, iz = 0) {
  const S = G.S, p = G.p;
  G.t += dt; S.playT += dt;
  let m = Math.hypot(ix, iz); if (m > 1) { ix /= m; iz /= m; m = 1; }
  p.moving = m > .08;
  if (p.moving) { const sp = walkSpeed(G); movePlayer(G, p.x + ix * sp * dt, p.z + iz * sp * dt); p.yaw = Math.atan2(ix, iz); }
  if (G.def.areas.some(a => a.ice)) { G.season += dt; const T = 240, th = 50; const was = G.thaw; G.thaw = (G.season % T) > T - th; if (was !== G.thaw) fx(G, { k: 'thaw', on: G.thaw }); }
  G.vissla = Math.max(0, G.vissla - dt); G.visslaCd = Math.max(0, G.visslaCd - dt);
  interact(G, dt);
  stepTrees(G, dt); stepMachines(G, dt);
  for (const w of G.workers) stepWorker(G, w, dt);
  const fr = flowRate(G);
  if (fr > 0) { G.lakeAcc += fr * dt; while (G.lakeAcc >= 1) { G.lakeAcc -= 1; if (S.q.intake < ECON.qcap.intake && lv(S, 'bark')) { S.q.intake++; fx(G, { k: 'feed', who: 'lake' }); } } }
  stepEvents(G, dt); stepOrder(G, dt); stepContracts(G, dt); stepKonc(G, dt);
  G.emaT += dt;
  if (G.emaT >= 1) {
    const a = 1 - Math.exp(-G.emaT / 30);
    G.incEMA += (G.incAcc / G.emaT - G.incEMA) * a; G.autoEMA += (G.autoAcc / G.emaT - G.autoEMA) * a; G.kEMA += (G.kAcc / G.emaT - G.kEMA) * a;
    for (const k of PRODUCTS) { G.prodEMA[k] += (G.prodAcc[k] / G.emaT - G.prodEMA[k]) * a; G.prodAcc[k] = 0; }
    G.incAcc = 0; G.autoAcc = 0; G.kAcc = 0; G.emaT = 0; S.autoRate = G.autoEMA;
  }
  G.evalT -= dt; if (G.evalT <= 0) { G.evalT = 1; evalGoals(G); }
  S.px = p.x; S.pz = p.z;
}
// Intäkt medan spelet var stängt: orten man står i (medhjälparna) och koncernen, max 8 timmar.
function applyAway(B, sec) {
  const s = Math.min(sec, ECON.offlineCapH * 3600), S = B.orter[B.ort];
  if (sec < 30) return 0;
  const here = (S.autoRate || 0) * s, konc = koncRate(B) * s;
  if (!(here + konc >= 1)) return 0;
  if (S.lv.chauffor) B.money += here; else S.kassa += here;
  B.money += konc; B.earnedAll += here + konc; S.earnedRun += here;
  return here + konc;
}
// Flytta över en sparning från v2 till orten Gläntan. v2-nyckeln lämnas orörd.
function migrateV2(raw) {
  const B = newBolag(0), r = raw.S, O = B.orter[0], pl = r.pile || {};
  B.money = +r.money || 0; B.seeds = Math.round((+r.seeds || 0) * ECON.v2fro);
  B.earnedAll = (+(raw.meta && raw.meta.earnedAll) || 0) + (+r.earnedRun || 0);
  const known = new Set(ECON.pads.map(p => p.id).concat(['skog', 'sjo']));
  for (const k in r.lv || {}) if (known.has(k)) O.lv[k] = +r.lv[k] || 0;
  for (const k in r.paid || {}) if (known.has(k)) O.paid[k] = +r.paid[k] || 0;
  for (const k in O.q) O.q[k] = +((r.q || {})[k]) || 0;
  for (const k of ['main', 'sack', 'furn']) O.pile[k] = { ...(pl[k] || {}) };
  O.stack = Array.isArray(r.stack) ? r.stack.filter(t => PRODUCTS.includes(t)).slice(0, 30) : [];
  O.kassa = +r.kassa || 0; O.sold = +r.sold || 0; O.autoRate = +r.autoRate || 0; O.konc = O.autoRate; O.playT = +r.playT || 0;
  O.orders = +r.orders || 0; O.firstBuy = +r.firstBuy || 0; O.px = +r.px || LAY.start[0]; O.pz = +r.pz || LAY.start[1]; O.earnedRun = +r.earnedRun || 0;
  const n = (O.lv.hugg || 0) + (O.lv.barare || 0) + (O.lv.chauffor || 0);
  if (n > ECON.staff.base) O.lv.bod = 1;   // personalboden finns redan för den som har fler anställda än grundtaket
  return B;
}
const UNITS = ['', 'k', 'M', 'B', 'T', 'Q'];
function fmt(n) {
  if (!isFinite(n)) return '∞';
  if (n < 0) return '−' + fmt(-n);
  if (n < 1e6) return Math.floor(n).toLocaleString('sv-SE');
  let i = 0; while (n >= 1000 && i < UNITS.length - 1) { n /= 1000; i++; }
  return (n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2)).replace('.', ',') + ' ' + UNITS[i];
}
/*ECON-END*/
