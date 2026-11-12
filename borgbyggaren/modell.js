// Borgbyggaren – modell.js
// All spellogik. Ren JavaScript: ingen DOM, inget Three.js. Deterministisk med frö. Går att köra i Node.
//
// ───────────────────────────── KONTRAKT ─────────────────────────────
// Exporter:
//   nyttSpel(opts)            opts = {fro: heltal, guide: true|false}. Ger ett spel.
//   steg(spel, dt, input)     Flyttar fram spelet dt sekunder. input = {dx, dz, horn, gorOm}.
//                             dx/dz = styrspak −1..1 (x höger, z mot kameran/söder). horn = true startar natten.
//                             gorOm = true efter förlust laddar senaste gryningen (samma som gorOm(spel)).
//                             Stort dt delas upp internt (TUNE.stegMax), tak TUNE.maxDt per anrop.
//   gorOm(spel)               Efter förlust: gör om natten från gryningsbilden (ändrar spel på plats).
//   tillSparning(spel)        Ger ett JSON-bart objekt (inkl. gryningsbild). Spara med JSON.stringify.
//                             Vid förlust sparas omförsöket (samma som gorOm), så att det överlever en omladdning.
//   franSparning(data)        Tar objekt eller JSON-sträng. Ger ALLTID ett giltigt spel.
//                             spel.aterstalld = '' (exakt), 'gryning' (trasig, backade till gryningsbild),
//                             'mjuk' (gammal/trasig, bara framsteg behölls) eller 'ny' (oanvändbar data).
//   TUNE, KARTA               Balans och karta (data).
//   allaEnheter(spel)         Hjälp: en platt lista med alla enheter (riddare, vänner, fiender, byggen, natur …).
//
// Koordinater: x och z är markplanet, 1 enhet = 1 meter, origo i tronsalen. Norr = −z, söder = +z,
// öster = +x, väster = −x. rot är radianer runt y: riktningen är (sin rot, cos rot), dvs rot = atan2(dx, dz).
// För murar och portar pekar rot utåt från borgen.
//
// spel:
//   lage        'spel' | 'forlust'
//   tid         {fas: 'dag'|'skymning'|'natt'|'gryning', andel: 0–1, natt: nummer, kvar: s, langd: s, t: s}
//   lager       {tra, sten, guld}            det som ligger i förrådet (HUD-siffrorna)
//   riddare     en enhet (se nedan)
//   vanner      [soldat, arbetare]
//   fiender     [skelettkrigare, skelettskurk, skelettmagiker, jatte, boss]
//   byggen      [tronsal, palissad/stenmur, port, torn, kasern, vedkoja, stenkoja, smedja, fyrfat]
//               Alla byggplatser finns från start. niva 0 = inte byggt (rita inget eller en grund).
//   natur       [trad, sten]
//   rutor       [betalruta]
//   projektiler [projektil]
//   drop        [resurs]                     guld som ligger på marken
//   mal         {text, x, z, slag, id}       målraden: nästa steg och var det är. slag: 'trad','sten','ruta','forrad','laga','hem',
//                                            'fiende','riktning','forlust','ingen'
//   guide       {steg, text}                 steg '' när guiden är klar ('ga','hugg','bygg','forrad','horn')
//   vag         {natt, riktningar: ['N','O','S','V'], lista, nasta, boss, totalt, …}   nattens våg (sätts i skymningen, tom på dagen)
//   seger       true när natt 20 är klarad (sedan ändlöst läge), basta = bästa klarade natt
//   forsok      antal omförsök på den här natten
//   stat        {speltid, dodade, forluster, byggda, forstaMur, hornGuld}
//   handelser   kö med händelser. steg lägger bara till. Anroparen läser och tömmer (spel.handelser.length = 0).
//
// Alla enheter har: id, typ, x, z, rot, hp, maxHp, anim ('idle','ga','spring','hugg','bar','do').
// Fält per typ utöver de gemensamma:
//   riddare         bar {tra, sten}, last (antal burna), barMax, svard, rustning, barNiva (uppgraderingsnivåer 0–8),
//                   dod (s kvar till han reser sig vid tronsalen, 0 = lever), kyl, strid. Han kan inte dö på riktigt.
//   soldat          niva, postX, postZ, dod (s kvar av dödsanimation, 0 = lever)
//   arbetare        slag ('tra'|'sten'), bar (antal), inne (true = i kojan på natten, rita inte), hem (bygge-id)
//   skelettkrigare, skelettskurk, skelettmagiker, jatte
//                   fart, ljus (true = står i fyrfatsljus och tar mer skada), dod (s kvar av dödsanimation),
//                   riktning ('N','O','S','V'), malSlag, malId
//   boss            som fiender + namn, bossNr (1–4 …), special ('stot','akalla','eldregn','alla'),
//                   varnar (s kvar av varningen, 0 = ingen), vSlag, vx, vz, vRadie (var specialattacken slår ner)
//   tronsal         niva (1–3), betalt (0–1 mot nästa nivå), plats, radie, raserad
//   palissad        mur nivå 0–1: niva, betalt, plats, ring ('inre'|'yttre'), k, ax, az, bx, bz (ändpunkter), raserad
//   stenmur         samma mur på nivå 2–3 (typ byts när den uppgraderas)
//   port            som mur (egna går igenom, fienden måste slå in den)
//   torn            niva (0–3), betalt, plats, radie, raserad, kyl
//   kasern, vedkoja, stenkoja, smedja, fyrfat
//                   niva, betalt, plats, radie (fyrfat lyser på natten när niva > 0, ljusradie i TUNE.byggen.fyrfat)
//   trad, sten      hp = antal resurser kvar, ater (s tills det växer tillbaka, 0 = finns), anim 'do' när det är slut
//   betalruta       slag ('bygge'|'uppgradering'), plats, byggTyp, niva (nivån man köper), vad ('svard','rustning','bar' eller ''),
//                   pris {tra, sten, guld}, betalt {tra, sten, guld}, kvar (totalt kvar), andel (0–1), sparr (true = kliv av först),
//                   radie, ordning
//   projektil       slag ('pil' från torn | 'magi' från magiker/boss), malSlag, malId, skada, fart
//   resurs          slag ('guld'), antal
//
// Händelsetyper (spel.handelser):
//   {typ:'fas', fas, natt}                         fasbyte
//   {typ:'varning', riktningar, platser, natt, boss}   skymning: varifrån de kommer (platser = [{x, z}])
//   {typ:'horn', guld}                             hornet blåstes, bonusguld
//   {typ:'hugg', id, slag, antal, x, z}            riddaren eller en arbetare högg/bröt (slag 'tra'|'sten')
//   {typ:'natur_slut', id, slag, x, z}             trädet föll / stenen tog slut
//   {typ:'natur_ater', id, slag, x, z}             det växte tillbaka
//   {typ:'lamna', tra, sten, x, z}                 riddaren lämnade i förrådet
//   {typ:'leverans', slag, antal, x, z}            en arbetare lämnade vid kojan
//   {typ:'ruta_ny', id, plats, x, z}               en ny betalruta dök upp
//   {typ:'betalning', id, slag, antal, fran, x, z} swisch-ström (fran 'riddare'|'forrad')
//   {typ:'bygge_klart', id, plats, byggTyp, niva, x, z}   SPARA här
//   {typ:'uppgradering', vad, niva}                smedjan: svard|rustning|bar. SPARA här
//   {typ:'laga', id, slag, x, z}                   reparation pågår (en resurs gick åt). Allt skadat inom TUNE.laga.avstand lagas samtidigt
//   {typ:'bygge_lagat', id, x, z}                  en raserad mur står igen
//   {typ:'bygge_traff', id, x, z, skada}
//   {typ:'bygge_raserat', id, plats, byggTyp, x, z}
//   {typ:'slag', vem, id, x, z}                    någon svingar (vem 'riddare'|'soldat'|'fiende')
//   {typ:'traff', mal, id, x, z, skada}            någon träffas (mal 'fiende'|'riddare'|'soldat')
//   {typ:'skott', id, fran, x, z}                  projektil avfyrad (fran 'torn'|'magiker'|'boss')
//   {typ:'fiende_ny', id, fiendeTyp, riktning, x, z}
//   {typ:'fiende_dod', id, fiendeTyp, x, z}
//   {typ:'fiende_brinner', id, x, z}               gryningen bränner den
//   {typ:'plock', slag, antal, x, z}               guld plockat
//   {typ:'riddare_fall', x, z} / {typ:'riddare_ater', x, z}
//   {typ:'soldat_dod', id, x, z}
//   {typ:'boss_ny', id, namn, bossNr}
//   {typ:'boss_varning', id, slag, x, z, radie, tid}   specialattack om tid sekunder på (x, z)
//   {typ:'boss_special', id, slag, x, z, radie}        nu slår den ner
//   {typ:'boss_dod', id, namn, x, z}
//   {typ:'gryning', natt, guld, brann}             natten klarad, belöning
//   {typ:'seger', natt}                            natt 20 klarad
//   {typ:'forlust', natt}                          tronsalen föll
//   {typ:'gor_om', natt, forsok}                   natten görs om från gryningsbilden
//   {typ:'guide', steg}                            guiden bytte steg
//   {typ:'spara', orsak}                           bra läge att spara ('gryning')
// ─────────────────────────────────────────────────────────────────────

const VERSION = 1;
const TAU = Math.PI * 2;

// ───────────────────────────── BALANS ─────────────────────────────
export const TUNE = {
  stegMax: 0.05,            // längsta interna delsteg (s)
  maxDt: 30,                // mer än så här per anrop kastas bort
  segerNatt: 20,
  oppnaRutor: 3,            // så många byggrutor syns samtidigt
  tid: { dag: 75, forstaDag: 85, skymning: 7, nattBas: 45, nattPerNatt: 1.5, nattMax: 75, gryning: 5, nattSlutVanta: 2 },
  horn: { guldPerSek: 0.12, perNatt: 0.05 },
  gryning: { guld: 4, guldPerNatt: 2, bossGuld: 25 },
  omforsok: { lattnad: 0.15, lattnadMax: 0.6, gava: 10, gavaPerNatt: 4 },   // varje omförsök: färre fiender och lite gåvoresurser
  riddare: {
    fart: 6, radie: 0.5, hp: 100, hpPerRustning: 30, skydd: 0.06,
    skada: 10, skadaPerSvard: 5, slagTid: 0.5, rackvidd: 2.6, klyv: 2,
    bar: 12, barPerNiva: 6, huggTid: 0.48, brytTid: 0.6, samlaAvstand: 2.1,
    regen: 3, regenDag: 25, regenVanta: 3, regenHemma: 12, hemmaRadie: 7, aterTid: 8, magnet: 4,
    uppgraderingMax: 8,
    pris: { svard: [20, 40, 70, 110, 160, 220, 300, 400], rustning: [20, 40, 70, 110, 160, 220, 300, 400], bar: [15, 30, 50, 80, 120, 170, 230, 300] },
  },
  swisch: { takt: 14, snabbTid: 2.5, radie: 1.6 },   // halva sidan på den ritade rutan (3,2 m bred); mäts som fyrkant, se rutAvst
  laga: { avstand: 6.5, tid: 2, hpPerResurs: 60, fiendeAvstand: 6, starIgen: 0.35 },
  natur: { tradHp: 6, stenHp: 8, tradAter: 35, stenAter: 45 },
  arbetare: { fart: 3.5, bar: 5, huggTid: 1.2 },
  soldat: { fart: 3.6, rackvidd: 2.7, slagTid: 0.9, vaktRadie: 8 },
  projektil: { pilFart: 28, magiFart: 14 },
  byggen: {
    tronsal: { radie: 3, nivaer: [
      { hp: 300, pris: {} },
      { hp: 650, pris: { tra: 140, sten: 80 } },
      { hp: 1100, pris: { tra: 260, sten: 180 } } ] },
    mur: { nivaer: [
      { typ: 'palissad', hp: 140, pris: { tra: 10 } },
      { typ: 'stenmur', hp: 450, pris: { sten: 20 } },
      { typ: 'stenmur', hp: 800, pris: { tra: 15, sten: 45 } } ] },
    port: { nivaer: [
      { hp: 180, pris: { tra: 14 } },
      { hp: 520, pris: { tra: 25, sten: 16 } },
      { hp: 900, pris: { tra: 45, sten: 40 } } ] },
    torn: { radie: 1.1, nivaer: [
      { hp: 160, pris: { tra: 18, sten: 8 }, skada: 9, rackvidd: 12, takt: 1.0 },
      { hp: 280, pris: { tra: 35, sten: 35 }, skada: 14, rackvidd: 13.5, takt: 0.85 },
      { hp: 450, pris: { tra: 70, sten: 80 }, skada: 22, rackvidd: 15, takt: 0.7 } ] },
    kasern: { radie: 1.4, nivaer: [
      { pris: { tra: 35, sten: 20 }, soldater: 2, soldatHp: 70, soldatSkada: 9 },
      { pris: { tra: 80, sten: 40 }, soldater: 4, soldatHp: 100, soldatSkada: 13 },
      { pris: { tra: 150, sten: 90 }, soldater: 6, soldatHp: 140, soldatSkada: 18 } ] },
    vedkoja: { radie: 1.6, nivaer: [
      { pris: { tra: 25 }, arbetare: 1 }, { pris: { tra: 50, sten: 25 }, arbetare: 2 }, { pris: { tra: 70, sten: 40 }, arbetare: 3 } ] },
    stenkoja: { radie: 1.6, nivaer: [
      { pris: { tra: 25, sten: 10 }, arbetare: 1 }, { pris: { tra: 55, sten: 30 }, arbetare: 2 }, { pris: { tra: 70, sten: 50 }, arbetare: 3 } ] },
    smedja: { radie: 1.4, nivaer: [{ pris: { tra: 35, sten: 35 } }] },
    fyrfat: { radie: 0.6, nivaer: [{ pris: { tra: 12, sten: 8 }, ljus: 9, bonus: 0.3 }] },
  },
  // Upplåsningsordning: 'plats:nivå' eller 'plats:nivå:prisfaktor'. De första oppnaRutor som inte är byggda syns.
  ordning: [
    'i2:1:0.8', 'i6:1', 'i4:1', 'i0:1', 'torn_i1:1', 'i1:1', 'i3:1', 'vedkoja:1', 'i5:1', 'i7:1',
    'torn_i3:1', 'stenkoja:1', 'kasern:1', 'torn_i0:1', 'torn_i2:1', 'smedja:1', 'fyrfat_O:1',
    'i2:2', 'i6:2', 'i4:2', 'i0:2', 'vedkoja:2', 'fyrfat_V:1', 'i1:2', 'i3:2', 'stenkoja:2', 'fyrfat_N:1',
    'i5:2', 'i7:2', 'torn_i1:2', 'torn_i3:2', 'fyrfat_S:1', 'kasern:2', 'torn_i0:2', 'torn_i2:2',
    'tronsal:2',
    'y3:1:1.5', 'y9:1:1.5', 'y6:1:1.5', 'y0:1:1.5', 'torn_y0:1', 'y2:1:1.5', 'y4:1:1.5', 'y8:1:1.5', 'y10:1:1.5',
    'torn_y2:1', 'y1:1:1.5', 'y5:1:1.5', 'y7:1:1.5', 'y11:1:1.5', 'torn_y1:1', 'torn_y3:1',
    'vedkoja:3', 'stenkoja:3', 'torn_i1:3', 'torn_i3:3', 'y3:2:1.4', 'y9:2:1.4', 'y6:2:1.4', 'y0:2:1.4',
    'kasern:3', 'torn_y0:2', 'torn_y2:2', 'y2:2:1.4', 'y4:2:1.4', 'y8:2:1.4', 'y10:2:1.4', 'torn_i0:3', 'torn_i2:3',
    'tronsal:3', 'y1:2:1.4', 'y5:2:1.4', 'y7:2:1.4', 'y11:2:1.4', 'torn_y1:2', 'torn_y3:2',
    'i2:3', 'i6:3', 'i4:3', 'i0:3', 'torn_y0:3', 'torn_y2:3', 'i1:3', 'i3:3', 'i5:3', 'i7:3', 'torn_y1:3', 'torn_y3:3',
    'y3:3', 'y9:3', 'y6:3', 'y0:3', 'y2:3', 'y4:3', 'y8:3', 'y10:3', 'y1:3', 'y5:3', 'y7:3', 'y11:3',
  ],
  fiender: {
    // skada = mot riddare och soldater, byggSkada = mot byggen, poang = kostnad i vågens budget
    skelettkrigare: { hp: 28, fart: 2.3, skada: 6, byggSkada: 3, takt: 1.1, rackvidd: 1.8, aggro: 4.5, guld: 1, poang: 1, franNatt: 1, vikt: 1 },
    skelettskurk: { hp: 16, fart: 4.4, skada: 4, byggSkada: 2.5, takt: 0.8, rackvidd: 1.8, aggro: 0, guld: 1, poang: 1.2, franNatt: 3, vikt: 0.35 },
    skelettmagiker: { hp: 22, fart: 1.9, skada: 9, byggSkada: 10, takt: 2.2, rackvidd: 10, aggro: 9, sok: 16, guld: 2, poang: 2.2, franNatt: 6, vikt: 0.25 },
    jatte: { hp: 240, fart: 1.3, skada: 22, byggSkada: 30, takt: 1.8, rackvidd: 2.2, aggro: 0, guld: 6, poang: 6, franNatt: 8, vikt: 0.12 },
    boss: { hp: 480, hpNr: [1, 2.0, 3.4, 5.2], fart: 1.5, skada: 28, byggSkada: 35, takt: 1.5, rackvidd: 2.6, aggro: 5, guld: 25,
      specTid: 9, varnTid: 1.8, stotRadie: 6, stotSkada: 35, stotByggSkada: 60, eldRadie: 5, eldSkada: 45, eldByggSkada: 70, akalla: 3,
      namn: ['Benkungen', 'Gravhäxan', 'Järnjätten', 'Dödsfursten'], special: ['stot', 'akalla', 'eldregn', 'alla'] },
  },
  vag: {
    bas: 2, perNatt: 1.0, kvadrat: 0.46,        // budget = bas + perNatt·n + kvadrat·n²
    hpPerNatt: 0.04, skadaPerNatt: 0.02,
    spawnAndel: 0.45, bossTid: 3, bossBudget: 0.75, maxAntal: 110, spridning: 8,
    riktningar: [[1, 1], [5, 2], [11, 3], [16, 4]],   // [från natt, antal riktningar]
    fastaRiktningar: ['O', 'V', 'N', 'S'],            // natt 1–4, samma ordning som de första murarna
    guldChans: 0.7,
  },
};

// ───────────────────────────── KARTA ─────────────────────────────
function pol(grader, r) {
  const a = grader * Math.PI / 180;
  return { x: Math.round(r * Math.sin(a) * 1000) / 1000, z: Math.round(r * Math.cos(a) * 1000) / 1000 };
}

function byggKarta() {
  const K = {
    o: { radie: 55, strand: 52 },
    tronsal: { x: 0, z: 0, radie: 3 },
    forrad: Object.assign(pol(67.5, 5.8), { radie: 1.3, lamna: 3.1 }),
    start: pol(0, 6),
    ringar: {
      inre: { namn: 'inre', prefix: 'i', radie: 10, n: 8, portar: [0, 4] },
      yttre: { namn: 'yttre', prefix: 'y', radie: 19, n: 12, portar: [0, 6] },
    },
    riktningar: { S: 0, O: 90, N: 180, V: 270 },
    riktningNamn: { N: 'norr', O: 'öster', S: 'söder', V: 'väster' },
    gravfalt: {},
    platser: {}, platsLista: [],
    skog: [], stenbrott: [],
  };
  for (const n in K.riktningar) K.gravfalt[n] = Object.assign(pol(K.riktningar[n], 42), { vinkel: K.riktningar[n] });
  const lagg = (p) => { K.platser[p.id] = p; K.platsLista.push(p); };
  lagg({ id: 'tronsal', typ: 'tronsal', x: 0, z: 0, rot: 0, radie: 3, ruta: pol(337.5, 5.6) });
  for (const rn of ['inre', 'yttre']) {
    const R = K.ringar[rn];
    R.halv = R.radie * Math.tan(Math.PI / R.n);
    R.horn = R.radie / Math.cos(Math.PI / R.n);
    for (let k = 0; k < R.n; k++) {
      const g = k * 360 / R.n, a = g * Math.PI / 180, c = pol(g, R.radie);
      const tx = Math.cos(a), tz = -Math.sin(a);
      lagg({ id: R.prefix + k, typ: R.portar.includes(k) ? 'port' : 'mur', x: c.x, z: c.z, rot: a, ring: rn, k,
        ax: c.x - tx * R.halv, az: c.z - tz * R.halv, bx: c.x + tx * R.halv, bz: c.z + tz * R.halv, ruta: pol(g, R.radie - 2.2) });
    }
  }
  const rund = (id, typ, g, r, rutaG, rutaR) => {
    const p = pol(g, r);
    lagg({ id, typ, x: p.x, z: p.z, rot: (g + 180) * Math.PI / 180, radie: TUNE.byggen[typ].radie, ruta: pol(rutaG, rutaR) });
  };
  for (let i = 0; i < 4; i++) rund('torn_i' + i, 'torn', 22.5 + 90 * i, 8.9, 22.5 + 90 * i, 7.0);
  for (let i = 0; i < 4; i++) rund('torn_y' + i, 'torn', 45 + 90 * i, 17.8, 45 + 90 * i, 15.6);
  rund('kasern', 'kasern', 157.5, 5.8, 157.5, 8.2);
  rund('smedja', 'smedja', 247.5, 5.8, 247.5, 8.2);
  rund('vedkoja', 'vedkoja', 67.5, 15, 79.5, 15);
  rund('stenkoja', 'stenkoja', 292.5, 15, 280.5, 15);
  rund('fyrfat_S', 'fyrfat', 10, 13.2, 358, 13.2);
  rund('fyrfat_O', 'fyrfat', 100, 13.2, 88, 13.2);
  rund('fyrfat_N', 'fyrfat', 190, 13.2, 178, 13.2);
  rund('fyrfat_V', 'fyrfat', 280, 13.2, 268, 13.2);
  K.smedjeRutor = { svard: pol(247.5, 8.2), rustning: pol(220.5, 4.6), bar: pol(274.5, 4.6) };
  // Skog och stenbrott: fasta platser (samma i alla spel), utslumpade med ett låst frö.
  let s = 20261112;
  const r01 = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), s | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const alla = [];
  const stro = (lista, antal, g0, g1, r0, r1, minAvst) => {
    let kvar = antal, forsok = 0;
    while (kvar > 0 && forsok++ < 4000) {
      const p = pol(g0 + r01() * (g1 - g0), r0 + r01() * (r1 - r0));
      let ok = true;
      for (const q of alla) if (Math.hypot(q.x - p.x, q.z - p.z) < minAvst) { ok = false; break; }
      if (!ok) continue;
      alla.push(p); lista.push(p); kvar--;
    }
  };
  stro(K.skog, 6, 79, 98, 15.2, 17.7, 1.8);          // startdunge i öster
  stro(K.stenbrott, 5, 260, 278, 15.2, 17.7, 1.8);   // startstenar i väster
  stro(K.skog, 26, 20, 70, 21.5, 37, 2.5);           // sydost
  stro(K.skog, 26, 200, 250, 21.5, 37, 2.5);         // nordväst
  stro(K.stenbrott, 12, 112, 158, 21.5, 27, 2.3);    // nordost: stenbrott närmast, skog bakom
  stro(K.skog, 14, 110, 160, 29, 38, 2.5);
  stro(K.stenbrott, 12, 292, 338, 21.5, 27, 2.3);    // sydväst
  stro(K.skog, 14, 290, 340, 29, 38, 2.5);
  return K;
}
export const KARTA = byggKarta();

const PLATS_IDX = {};
KARTA.platsLista.forEach((p, i) => { PLATS_IDX[p.id] = i; });
const BYGGE_ID0 = 500, RIDDARE_ID = 900, DYN_ID0 = 1000;
const ORDNING = TUNE.ordning.map((s, i) => {
  const d = s.split(':');
  return { i, plats: d[0], niva: +d[1], faktor: d[2] ? +d[2] : 1, idx: PLATS_IDX[d[0]] };
}).filter((o) => o.idx !== undefined);
const RINGAR = [KARTA.ringar.yttre, KARTA.ringar.inre];
const SLAG = ['tra', 'sten', 'guld'];
const NAMN = { palissad: 'palissad', stenmur: 'stenmur', mur: 'mur', port: 'port', torn: 'bågskyttetorn', kasern: 'kasern', vedkoja: 'vedhuggarkoja',
  stenkoja: 'stenhuggarkoja', smedja: 'smedja', fyrfat: 'fyrfat', tronsal: 'tronsal', svard: 'svärdet', rustning: 'rustningen', bar: 'bärförmågan' };

// ───────────────────────────── HJÄLP ─────────────────────────────
function slump(spel) {
  let t = (spel.rng = (spel.rng + 0x6D2B79F5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const tal = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
const kl = (v, a, b) => (v < a ? a : v > b ? b : v);
const klona = (o) => JSON.parse(JSON.stringify(o));
function hand(spel, h) { spel.handelser.push(h); }

let _cx = 0, _cz = 0;
function avstSeg(px, pz, b) {      // avstånd från punkt till murens mittlinje, närmaste punkt i _cx/_cz
  const vx = b.bx - b.ax, vz = b.bz - b.az, l2 = vx * vx + vz * vz;
  let t = l2 > 0 ? ((px - b.ax) * vx + (pz - b.az) * vz) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  _cx = b.ax + vx * t; _cz = b.az + vz * t;
  return Math.hypot(px - _cx, pz - _cz);
}
function korsar(ax, az, bx, bz, m) {   // skär sträckan a–b muren m?
  const d1x = bx - ax, d1z = bz - az, d2x = m.bx - m.ax, d2z = m.bz - m.az;
  const n = d1x * d2z - d1z * d2x;
  if (Math.abs(n) < 1e-9) return false;
  const t = ((m.ax - ax) * d2z - (m.az - az) * d2x) / n, u = ((m.ax - ax) * d1z - (m.az - az) * d1x) / n;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}
let STAR = [];      // stående murar och portar (räknas om varje delsteg)
let LJUS = [];      // tända fyrfat
function friVag(ax, az, bx, bz) { for (const m of STAR) if (korsar(ax, az, bx, bz, m)) return false; return true; }
function star(b) { return b.niva > 0 && !b.raserad; }
function sektor(R, x, z) { const st = TAU / R.n; let k = Math.round(Math.atan2(x, z) / st) % R.n; if (k < 0) k += R.n; return k; }
function utanfor(R, x, z, k) { const a = k * TAU / R.n; return x * Math.sin(a) + z * Math.cos(a) > R.radie; }
function nivaData(b) { const p = KARTA.platsLista[b.id - BYGGE_ID0]; return TUNE.byggen[p.typ].nivaer[b.niva - 1]; }
function platsTyp(b) { return KARTA.platsLista[b.id - BYGGE_ID0].typ; }
function barMax(r) { return TUNE.riddare.bar + TUNE.riddare.barPerNiva * r.barNiva; }
function riddareMaxHp(r) { return TUNE.riddare.hp + TUNE.riddare.hpPerRustning * r.rustning; }

// ───────────────────────────── NYTT SPEL ─────────────────────────────
export function nyttSpel(opts) {
  opts = opts || {};
  const fro = (tal(opts.fro, 1) | 0) || 1;
  const spel = {
    v: VERSION, fro, rng: Math.imul(fro, 2654435761) | 0, nastaId: DYN_ID0,
    lage: 'spel', aterstalld: '',
    tid: { fas: 'dag', andel: 0, natt: 1, kvar: TUNE.tid.forstaDag, langd: TUNE.tid.forstaDag, t: 0 },
    lager: { tra: 0, sten: 0, guld: 0 },
    riddare: { id: RIDDARE_ID, typ: 'riddare', x: KARTA.start.x, z: KARTA.start.z, rot: Math.PI, hp: TUNE.riddare.hp, maxHp: TUNE.riddare.hp, anim: 'idle',
      bar: { tra: 0, sten: 0 }, last: 0, barMax: TUNE.riddare.bar, svard: 0, rustning: 0, barNiva: 0,
      dod: 0, kyl: 0, strid: 0, rors: 0, sedanSkada: 99, swisch: 0, lagAck: 0, gatt: 0 },
    vanner: [], fiender: [], byggen: [], natur: [], rutor: [], projektiler: [], drop: [],
    mal: { text: '', x: 0, z: 0, slag: 'ingen', id: 0 }, malKyl: 0,
    guide: { steg: opts.guide === false ? '' : 'ga', text: '' },
    vag: { natt: 0, riktningar: [], lista: [], nasta: 0, boss: false, totalt: 0, sistaDod: 0, lattnad: 0, hpFaktor: 1, skadaFaktor: 1 },
    seger: false, basta: 0, forsok: 0,
    stat: { speltid: 0, dodade: 0, forluster: 0, byggda: 0, forstaMur: 0, hornGuld: 0 },
    handelser: [],
  };
  KARTA.platsLista.forEach((p, i) => {
    const b = { id: BYGGE_ID0 + i, typ: p.typ === 'mur' ? 'palissad' : p.typ, x: p.x, z: p.z, rot: p.rot, hp: 0, maxHp: 0, anim: 'idle',
      niva: 0, betalt: 0, plats: p.id, raserad: false, kyl: 0 };
    if (p.ring) { b.ring = p.ring; b.k = p.k; b.ax = p.ax; b.az = p.az; b.bx = p.bx; b.bz = p.bz; } else b.radie = p.radie;
    if (p.typ === 'tronsal') { b.niva = 1; b.hp = b.maxHp = TUNE.byggen.tronsal.nivaer[0].hp; }
    spel.byggen.push(b);
  });
  spel.natur = nyNatur();
  oppnaRutor(spel);
  uppdateraMal(spel);
  spel.gryningsbild = packa(spel);
  return spel;
}
function nyNatur() {
  const ut = [];
  KARTA.skog.forEach((p) => ut.push({ id: ut.length + 1, typ: 'trad', x: p.x, z: p.z, rot: (ut.length * 2.399) % TAU, hp: TUNE.natur.tradHp, maxHp: TUNE.natur.tradHp, anim: 'idle', ater: 0 }));
  KARTA.stenbrott.forEach((p) => ut.push({ id: ut.length + 1, typ: 'sten', x: p.x, z: p.z, rot: (ut.length * 2.399) % TAU, hp: TUNE.natur.stenHp, maxHp: TUNE.natur.stenHp, anim: 'idle', ater: 0 }));
  return ut;
}
export function allaEnheter(spel) {
  return [spel.riddare].concat(spel.vanner, spel.fiender, spel.byggen, spel.natur, spel.rutor, spel.projektiler, spel.drop);
}

// ───────────────────────────── RUTOR OCH BYGGEN ─────────────────────────────
function prisFor(plats, niva, faktor) {
  const p = KARTA.platser[plats], d = TUNE.byggen[p.typ].nivaer[niva - 1].pris, ut = { tra: 0, sten: 0, guld: 0 };
  for (const s of SLAG) ut[s] = Math.ceil((d[s] || 0) * faktor);
  return ut;
}
// Rutan är en ritad fyrkant (3,2 m bred, rak mot väderstrecken): hela fyrkanten räknas, även hörnen.
const rutAvst = (k, r) => Math.max(Math.abs(k.x - r.x), Math.abs(k.z - r.z));
function nyRuta(spel, falt) {
  const r = Object.assign({ id: spel.nastaId++, typ: 'betalruta', x: 0, z: 0, rot: 0, hp: 0, maxHp: 0, anim: 'idle',
    slag: 'bygge', plats: '', byggTyp: '', niva: 1, vad: '', pris: { tra: 0, sten: 0, guld: 0 }, betalt: { tra: 0, sten: 0, guld: 0 },
    kvar: 0, andel: 0, sparr: false, radie: TUNE.swisch.radie, ordning: 0 }, falt);
  r.kvar = r.pris.tra + r.pris.sten + r.pris.guld;
  const k = spel.riddare;
  r.sparr = rutAvst(k, r) < TUNE.swisch.radie + 0.3;
  spel.rutor.push(r);
  hand(spel, { typ: 'ruta_ny', id: r.id, plats: r.plats, x: r.x, z: r.z });
  return r;
}
function oppnaRutor(spel) {
  let oppna = 0;
  for (const r of spel.rutor) if (r.slag === 'bygge') oppna++;
  for (let i = 0; i < ORDNING.length && oppna < TUNE.oppnaRutor; i++) {
    const o = ORDNING[i], b = spel.byggen[o.idx];
    if (b.niva !== o.niva - 1) continue;
    if (spel.rutor.some((r) => r.plats === o.plats && r.slag === 'bygge')) continue;
    const p = KARTA.platser[o.plats];
    let typ = p.typ;
    if (typ === 'mur') typ = TUNE.byggen.mur.nivaer[o.niva - 1].typ;
    nyRuta(spel, { x: p.ruta.x, z: p.ruta.z, plats: o.plats, byggTyp: typ, niva: o.niva, pris: prisFor(o.plats, o.niva, o.faktor), ordning: o.i });
    oppna++;
  }
  const sm = spel.byggen[PLATS_IDX.smedja];
  if (sm.niva > 0) {
    for (const vad of ['svard', 'rustning', 'bar']) {
      const niv = vad === 'bar' ? spel.riddare.barNiva : spel.riddare[vad];
      if (niv >= TUNE.riddare.uppgraderingMax) continue;
      if (spel.rutor.some((r) => r.vad === vad)) continue;
      const pos = KARTA.smedjeRutor[vad];
      nyRuta(spel, { x: pos.x, z: pos.z, slag: 'uppgradering', plats: 'smedja', byggTyp: 'smedja', vad, niva: niv + 1,
        pris: { tra: 0, sten: 0, guld: TUNE.riddare.pris[vad][niv] }, ordning: 1000 });
    }
  }
}
function satNiva(b, niva) {
  const p = KARTA.platsLista[b.id - BYGGE_ID0], d = TUNE.byggen[p.typ].nivaer[niva - 1];
  b.niva = niva; b.raserad = false; b.betalt = 0;
  if (p.typ === 'mur') b.typ = d.typ;
  b.maxHp = d.hp || 100; b.hp = b.maxHp;
}
function ruteKlar(spel, r) {
  spel.rutor.splice(spel.rutor.indexOf(r), 1);
  if (r.slag === 'uppgradering') {
    const k = spel.riddare;
    if (r.vad === 'bar') { k.barNiva = r.niva; k.barMax = barMax(k); } else k[r.vad] = r.niva;
    if (r.vad === 'rustning') { const m = riddareMaxHp(k); k.hp += m - k.maxHp; k.maxHp = m; }
    hand(spel, { typ: 'uppgradering', vad: r.vad, niva: r.niva });
  } else {
    const b = spel.byggen[PLATS_IDX[r.plats]];
    satNiva(b, r.niva);
    spel.stat.byggda++;
    if (b.ring && !spel.stat.forstaMur) spel.stat.forstaMur = spel.stat.speltid || 0.01;
    synkaFolk(spel, false);
    hand(spel, { typ: 'bygge_klart', id: b.id, plats: b.plats, byggTyp: b.typ, niva: b.niva, x: b.x, z: b.z });
  }
  oppnaRutor(spel);
}
function taResurs(spel, slag, fran) {     // 1 enhet: först det riddaren bär, sedan förrådet
  const k = spel.riddare;
  if (slag !== 'guld' && k.bar[slag] > 0) { k.bar[slag]--; k.last--; fran.v = 'riddare'; return true; }
  if (spel.lager[slag] > 0) { spel.lager[slag]--; fran.v = 'forrad'; return true; }
  return false;
}
const _fran = { v: '' };
function uppdateraRutor(spel, dt) {
  const k = spel.riddare;
  let pa = null, pd = 1e9;
  for (const r of spel.rutor) {
    const d = rutAvst(k, r);
    if (r.sparr) { if (d > TUNE.swisch.radie + 0.3) r.sparr = false; continue; }
    if (d <= TUNE.swisch.radie && k.dod <= 0 && d < pd) { pa = r; pd = d; }   // närmaste rutan vinner om två ligger tätt
  }
  if (!pa) { k.swisch = 0; return; }
  const tot = pa.pris.tra + pa.pris.sten + pa.pris.guld;
  k.swisch += Math.max(TUNE.swisch.takt, tot / TUNE.swisch.snabbTid) * dt;
  let n = Math.floor(k.swisch);
  if (n <= 0) return;
  k.swisch -= n;
  for (const s of SLAG) {
    let antal = 0, fr = '';
    while (n > 0 && pa.betalt[s] < pa.pris[s] && taResurs(spel, s, _fran)) { pa.betalt[s]++; pa.kvar--; n--; antal++; fr = _fran.v; }
    if (antal) hand(spel, { typ: 'betalning', id: pa.id, slag: s, antal, fran: fr, x: pa.x, z: pa.z });
  }
  pa.andel = tot > 0 ? 1 - pa.kvar / tot : 1;
  if (pa.slag === 'bygge') spel.byggen[PLATS_IDX[pa.plats]].betalt = pa.andel;
  if (pa.kvar <= 0) ruteKlar(spel, pa);
}

// Arbetare och soldater följer kojornas och kasernens nivå.
function synkaFolk(spel, nyaSoldater) {
  for (const [plats, slag] of [['vedkoja', 'tra'], ['stenkoja', 'sten']]) {
    const b = spel.byggen[PLATS_IDX[plats]];
    const vill = b.niva > 0 ? nivaData(b).arbetare : 0;
    let har = 0;
    for (const v of spel.vanner) if (v.typ === 'arbetare' && v.slag === slag) har++;
    for (; har < vill; har++) {
      spel.vanner.push({ id: spel.nastaId++, typ: 'arbetare', x: b.x, z: b.z + 0.1, rot: 0, hp: 20, maxHp: 20, anim: 'idle',
        slag, bar: 0, inne: spel.tid.fas !== 'dag', hem: b.id, lage: 'vila', malId: 0, kyl: 0 });
    }
  }
  const ka = spel.byggen[PLATS_IDX.kasern];
  if (ka.niva > 0) {
    const d = nivaData(ka);
    if (nyaSoldater) spel.vanner = spel.vanner.filter((v) => v.typ !== 'soldat');
    let har = 0;
    for (const v of spel.vanner) if (v.typ === 'soldat') { har++; if (v.niva !== ka.niva) { v.niva = ka.niva; v.maxHp = d.soldatHp; v.hp = Math.max(v.hp, 1); } }
    for (; har < d.soldater; har++) {
      spel.vanner.push({ id: spel.nastaId++, typ: 'soldat', x: ka.x, z: ka.z, rot: 0, hp: d.soldatHp, maxHp: d.soldatHp, anim: 'idle',
        niva: ka.niva, postX: ka.x, postZ: ka.z, dod: 0, kyl: 0 });
    }
    satPoster(spel);
  }
}
function satPoster(spel) {
  const sol = spel.vanner.filter((v) => v.typ === 'soldat');
  if (!sol.length) return;
  const natt = spel.tid.fas !== 'dag' && spel.vag.riktningar.length > 0;
  const ka = spel.byggen[PLATS_IDX.kasern];
  sol.forEach((s, j) => {
    if (natt) {
      const rk = spel.vag.riktningar[j % spel.vag.riktningar.length];
      const a = KARTA.riktningar[rk] * Math.PI / 180, plats = Math.floor(j / spel.vag.riktningar.length);
      const sida = (plats % 2 ? 1 : -1) * Math.ceil(plats / 2) * 1.7 + (plats === 0 ? 0 : 0);
      s.postX = Math.sin(a) * 8.8 + Math.cos(a) * sida; s.postZ = Math.cos(a) * 8.8 - Math.sin(a) * sida;
    } else {
      const a = (157.5 + (j - (sol.length - 1) / 2) * 9) * Math.PI / 180;
      s.postX = Math.sin(a) * 3.9; s.postZ = Math.cos(a) * 3.9;
      if (ka.niva === 0) { s.postX = 0; s.postZ = 4; }
    }
  });
}

// ───────────────────────────── SKADA ─────────────────────────────
function iLjus(x, z) {
  for (const f of LJUS) { const dx = x - f.x, dz = z - f.z; if (dx * dx + dz * dz < f.r2) return f.bonus; }
  return 0;
}
function skadaFiende(spel, e, skada) {
  if (e.hp <= 0) return;
  const bonus = iLjus(e.x, e.z);
  skada *= 1 + bonus;
  e.hp -= skada;
  hand(spel, { typ: 'traff', mal: 'fiende', id: e.id, x: e.x, z: e.z, skada });
  if (e.hp <= 0) {
    e.hp = 0; e.anim = 'do'; e.dod = 0.9; e.varnar = 0;
    spel.stat.dodade++;
    hand(spel, { typ: 'fiende_dod', id: e.id, fiendeTyp: e.typ, x: e.x, z: e.z });
    if (e.typ === 'boss') hand(spel, { typ: 'boss_dod', id: e.id, namn: e.namn, x: e.x, z: e.z });
    let guld = e.guld;
    if (guld === 1 && slump(spel) > TUNE.vag.guldChans) guld = 0;
    if (guld > 0) spel.drop.push({ id: spel.nastaId++, typ: 'resurs', x: e.x, z: e.z, rot: 0, hp: 1, maxHp: 1, anim: 'idle', slag: 'guld', antal: guld });
  }
}
function skadaBygge(spel, b, skada) {
  if (!star(b) || spel.lage !== 'spel') return;
  b.hp -= skada;
  hand(spel, { typ: 'bygge_traff', id: b.id, x: b.x, z: b.z, skada });
  if (b.hp <= 0) {
    b.hp = 0;
    if (b.plats === 'tronsal') {
      spel.lage = 'forlust'; spel.stat.forluster++;
      hand(spel, { typ: 'forlust', natt: spel.tid.natt });
    } else {
      b.raserad = true;
      hand(spel, { typ: 'bygge_raserat', id: b.id, plats: b.plats, byggTyp: b.typ, x: b.x, z: b.z });
    }
  }
}
function skadaRiddare(spel, skada) {
  const k = spel.riddare;
  if (k.dod > 0) return;
  skada *= Math.max(0.3, 1 - TUNE.riddare.skydd * k.rustning);
  k.hp -= skada; k.sedanSkada = 0;
  hand(spel, { typ: 'traff', mal: 'riddare', id: k.id, x: k.x, z: k.z, skada });
  if (k.hp <= 0) { k.hp = 0; k.dod = TUNE.riddare.aterTid; k.anim = 'do'; hand(spel, { typ: 'riddare_fall', x: k.x, z: k.z }); }
}
function skadaSoldat(spel, s, skada) {
  if (s.dod > 0) return;
  s.hp -= skada;
  hand(spel, { typ: 'traff', mal: 'soldat', id: s.id, x: s.x, z: s.z, skada });
  if (s.hp <= 0) { s.hp = 0; s.dod = 1; s.anim = 'do'; hand(spel, { typ: 'soldat_dod', id: s.id, x: s.x, z: s.z }); }
}

// ───────────────────────────── RIDDAREN ─────────────────────────────
function kollideraRiddare(spel, k) {
  const rad = TUNE.riddare.radie;
  for (let varv = 0; varv < 2; varv++) {
    for (const m of STAR) {
      if (platsTyp(m) === 'port') continue;
      const d = avstSeg(k.x, k.z, m), min = rad + 0.6;
      if (d < min) {
        if (d > 1e-6) { k.x = _cx + (k.x - _cx) / d * min; k.z = _cz + (k.z - _cz) / d * min; }
        else { k.x -= Math.sin(m.rot) * min; k.z -= Math.cos(m.rot) * min; }
      }
    }
    for (const b of spel.byggen) {
      if (b.niva <= 0 || b.radie === undefined) continue;
      rundKoll(k, b.x, b.z, b.radie + rad);
    }
    rundKoll(k, KARTA.forrad.x, KARTA.forrad.z, KARTA.forrad.radie + rad);
  }
  const r = Math.hypot(k.x, k.z);
  if (r > KARTA.o.strand) { k.x *= KARTA.o.strand / r; k.z *= KARTA.o.strand / r; }
}
function rundKoll(e, x, z, min) {
  const dx = e.x - x, dz = e.z - z, d = Math.hypot(dx, dz);
  if (d >= min) return;
  if (d > 1e-6) { e.x = x + dx / d * min; e.z = z + dz / d * min; } else { e.z = z + min; }
}
function uppdateraRiddare(spel, dt, inp) {
  const k = spel.riddare, T = TUNE.riddare;
  k.barMax = barMax(k);
  if (k.dod > 0) {
    k.dod -= dt; k.anim = 'do';
    if (k.dod <= 0) { k.dod = 0; k.x = KARTA.start.x; k.z = KARTA.start.z; k.hp = k.maxHp; k.anim = 'idle'; hand(spel, { typ: 'riddare_ater', x: k.x, z: k.z }); }
    return;
  }
  let dx = inp.dx, dz = inp.dz;
  const l = Math.hypot(dx, dz);
  if (l > 1) { dx /= l; dz /= l; }
  k.rors = 0;
  if (l > 0.05) {
    const x0 = k.x, z0 = k.z;
    k.x += dx * T.fart * dt; k.z += dz * T.fart * dt; k.rot = Math.atan2(dx, dz);
    kollideraRiddare(spel, k);
    k.gatt += Math.hypot(k.x - x0, k.z - z0); k.rors = 1;
  } else kollideraRiddare(spel, k);
  k.sedanSkada += dt;
  if (k.hp < k.maxHp) {
    if (spel.tid.fas === 'dag' || spel.tid.fas === 'gryning') k.hp = Math.min(k.maxHp, k.hp + T.regenDag * dt);
    else if (k.sedanSkada > 1.5 && Math.hypot(k.x, k.z) < T.hemmaRadie) k.hp = Math.min(k.maxHp, k.hp + T.regenHemma * dt);   // vilar vid tronsalen
    else if (k.sedanSkada > T.regenVanta) k.hp = Math.min(k.maxHp, k.hp + T.regen * dt);
  }
  k.kyl -= dt; k.strid -= dt;
  // strid: närmaste fiende inom räckvidd, klyver upp till T.klyv
  let narm = null, nd = T.rackvidd;
  for (const e of spel.fiender) { if (e.hp <= 0) continue; const d = Math.hypot(e.x - k.x, e.z - k.z); if (d < nd) { nd = d; narm = e; } }
  if (narm) {
    if (k.kyl <= 0) {
      k.kyl = T.slagTid; k.strid = 0.35;
      k.rot = Math.atan2(narm.x - k.x, narm.z - k.z);
      const skada = T.skada + T.skadaPerSvard * k.svard;
      hand(spel, { typ: 'slag', vem: 'riddare', id: k.id, x: k.x, z: k.z });
      skadaFiende(spel, narm, skada);
      let fler = T.klyv - 1;
      for (const e of spel.fiender) {
        if (fler <= 0) break;
        if (e === narm || e.hp <= 0) continue;
        if (Math.hypot(e.x - k.x, e.z - k.z) < T.rackvidd) { skadaFiende(spel, e, skada); fler--; }
      }
    }
  } else if (k.last < k.barMax) {
    let n = null, d0 = T.samlaAvstand;
    for (const t of spel.natur) { if (t.hp <= 0) continue; const d = Math.hypot(t.x - k.x, t.z - k.z); if (d < d0) { d0 = d; n = t; } }
    if (n) {
      k.strid = Math.max(k.strid, 0.15);
      if (!k.rors) k.rot = Math.atan2(n.x - k.x, n.z - k.z);
      if (k.kyl <= 0) {
        const slag = n.typ === 'trad' ? 'tra' : 'sten';
        k.kyl = slag === 'tra' ? T.huggTid : T.brytTid; k.strid = 0.35;
        k.bar[slag]++; k.last++;
        huggNatur(spel, n, slag);
      }
    }
  }
  // lämna i förrådet
  if (k.last > 0 && Math.hypot(k.x - KARTA.forrad.x, k.z - KARTA.forrad.z) < KARTA.forrad.lamna) {
    hand(spel, { typ: 'lamna', tra: k.bar.tra, sten: k.bar.sten, x: KARTA.forrad.x, z: KARTA.forrad.z });
    spel.lager.tra += k.bar.tra; spel.lager.sten += k.bar.sten; k.bar.tra = 0; k.bar.sten = 0; k.last = 0;
  }
  uppdateraLagning(spel, dt);
  k.anim = k.strid > 0 ? 'hugg' : k.rors ? (k.last > 0 ? 'bar' : 'spring') : 'idle';
}
function huggNatur(spel, n, slag) {
  n.hp--;
  hand(spel, { typ: 'hugg', id: n.id, slag, antal: 1, x: n.x, z: n.z });
  if (n.hp <= 0) { n.hp = 0; n.anim = 'do'; n.ater = slag === 'tra' ? TUNE.natur.tradAter : TUNE.natur.stenAter; hand(spel, { typ: 'natur_slut', id: n.id, slag, x: n.x, z: n.z }); }
}
function lagSlag(b) { const t = platsTyp(b); return (t === 'mur' || t === 'port') && b.niva === 1 ? 'tra' : 'sten'; }
function uppdateraLagning(spel, dt) {      // allt skadat inom räckhåll lagas samtidigt: spring ett varv längs murarna
  const k = spel.riddare, T = TUNE.laga;
  let nagot = false;
  for (const b of spel.byggen) {
    if (b.niva <= 0 || b.hp >= b.maxHp || b.plats === 'tronsal') continue;
    const d = b.ring ? avstSeg(k.x, k.z, b) : Math.hypot(b.x - k.x, b.z - k.z) - b.radie;
    if (d > T.avstand) continue;
    if (!nagot) {
      for (const e of spel.fiender) if (e.hp > 0 && Math.hypot(e.x - k.x, e.z - k.z) < T.fiendeAvstand) return;
      nagot = true;
    }
    if (k.lagAck <= 0) {
      let slag = lagSlag(b);
      if (!taResurs(spel, slag, _fran)) { slag = slag === 'tra' ? 'sten' : 'tra'; if (!taResurs(spel, slag, _fran)) return; }
      k.lagAck += T.hpPerResurs;
      hand(spel, { typ: 'laga', id: b.id, slag, x: b.x, z: b.z });
    }
    const h = Math.min(b.maxHp / T.tid * dt, k.lagAck, b.maxHp - b.hp);
    b.hp += h; k.lagAck -= h;
    if (b.raserad && b.hp >= b.maxHp * T.starIgen) { b.raserad = false; hand(spel, { typ: 'bygge_lagat', id: b.id, x: b.x, z: b.z }); }
  }
}

// ───────────────────────────── VÄNNER ─────────────────────────────
function gaTill(e, x, z, fart, dt) {    // ger true när framme
  const dx = x - e.x, dz = z - e.z, d = Math.hypot(dx, dz), s = fart * dt;
  if (d <= s || d < 1e-6) { e.x = x; e.z = z; return true; }
  e.x += dx / d * s; e.z += dz / d * s; e.rot = Math.atan2(dx, dz);
  return false;
}
function uppdateraArbetare(spel, a, dt) {
  const T = TUNE.arbetare, hem = spel.byggen[a.hem - BYGGE_ID0];
  const dag = spel.tid.fas === 'dag';
  if (!dag) {
    if (a.inne) { a.anim = 'idle'; return; }
    if (gaTill(a, hem.x, hem.z, T.fart * 1.3, dt)) { lamnaArbetare(spel, a, hem); a.inne = true; a.lage = 'vila'; a.anim = 'idle'; } else a.anim = 'spring';
    return;
  }
  a.inne = false;
  if (a.lage === 'vila') {
    const typ = a.slag === 'tra' ? 'trad' : 'sten';
    let b1 = null, b2 = null, b3 = null, d1 = 1e9, d2 = 1e9, d3 = 1e9;
    for (const n of spel.natur) {
      if (n.typ !== typ || n.hp <= 0) continue;
      const d = Math.hypot(n.x - hem.x, n.z - hem.z);
      if (d < d1) { b3 = b2; d3 = d2; b2 = b1; d2 = d1; b1 = n; d1 = d; } else if (d < d2) { b3 = b2; d3 = d2; b2 = n; d2 = d; } else if (d < d3) { b3 = n; d3 = d; }
    }
    const val = [b1, b2, b3].filter(Boolean);
    if (!val.length) { a.anim = 'idle'; return; }
    a.malId = val[Math.floor(slump(spel) * val.length)].id; a.lage = 'till';
  }
  if (a.lage === 'till' || a.lage === 'hugger') {
    const n = spel.natur[a.malId - 1];
    if (!n || n.hp <= 0) { a.lage = a.bar > 0 ? 'hem' : 'vila'; return; }
    if (a.lage === 'till') {
      const dx = n.x - a.x, dz = n.z - a.z, d = Math.hypot(dx, dz);
      if (d <= 1.3) { a.lage = 'hugger'; a.kyl = T.huggTid; } else { gaTill(a, n.x, n.z, T.fart, dt); a.anim = 'ga'; }
    } else {
      a.anim = 'hugg'; a.rot = Math.atan2(n.x - a.x, n.z - a.z); a.kyl -= dt;
      if (a.kyl <= 0) { a.kyl = T.huggTid; a.bar++; huggNatur(spel, n, a.slag); if (a.bar >= T.bar) a.lage = 'hem'; }
    }
    return;
  }
  if (a.lage === 'hem') {
    a.anim = 'bar';
    const d = Math.hypot(hem.x - a.x, hem.z - a.z);
    if (d <= hem.radie + 0.8) { lamnaArbetare(spel, a, hem); a.lage = 'vila'; } else gaTill(a, hem.x, hem.z, T.fart, dt);
  }
}
function lamnaArbetare(spel, a, hem) {
  if (a.bar <= 0) return;
  spel.lager[a.slag] += a.bar;
  hand(spel, { typ: 'leverans', slag: a.slag, antal: a.bar, x: hem.x, z: hem.z });
  a.bar = 0;
}
function uppdateraSoldat(spel, s, dt) {
  const T = TUNE.soldat;
  if (s.dod > 0) { s.dod -= dt; s.anim = 'do'; if (s.dod <= 0) s.dod = -1; return; }
  s.kyl -= dt;
  let mal = null, md = 1e9;
  for (const e of spel.fiender) {
    if (e.hp <= 0) continue;
    const ds = Math.hypot(e.x - s.x, e.z - s.z);
    if (ds > T.rackvidd) {
      if (Math.hypot(e.x - s.postX, e.z - s.postZ) > T.vaktRadie) continue;
      if (!friVag(s.x, s.z, e.x, e.z)) continue;
    }
    if (ds < md) { md = ds; mal = e; }
  }
  if (mal) {
    if (md > T.rackvidd * 0.8) { gaTill(s, mal.x, mal.z, T.fart, dt); s.anim = 'spring'; } else s.anim = 'idle';
    if (md <= T.rackvidd) {
      s.rot = Math.atan2(mal.x - s.x, mal.z - s.z);
      if (s.kyl <= 0) {
        s.kyl = T.slagTid;
        hand(spel, { typ: 'slag', vem: 'soldat', id: s.id, x: s.x, z: s.z });
        skadaFiende(spel, mal, TUNE.byggen.kasern.nivaer[kl(s.niva, 1, 3) - 1].soldatSkada);
      }
      if (s.kyl > T.slagTid - 0.35) s.anim = 'hugg';
    }
  } else if (Math.hypot(s.postX - s.x, s.postZ - s.z) > 0.15) { gaTill(s, s.postX, s.postZ, T.fart, dt); s.anim = 'ga'; }
  else { s.anim = 'idle'; if (spel.tid.fas !== 'dag') s.rot = Math.atan2(s.x, s.z); }
}
function uppdateraTorn(spel, dt) {
  if (!spel.fiender.length) return;
  for (const b of spel.byggen) {
    if (b.typ !== 'torn' || !star(b)) continue;
    b.kyl -= dt;
    if (b.kyl > 0) continue;
    const d = nivaData(b);
    let mal = null, md = d.rackvidd;
    for (const e of spel.fiender) { if (e.hp <= 0) continue; const ds = Math.hypot(e.x - b.x, e.z - b.z); if (ds < md) { md = ds; mal = e; } }
    if (!mal) { b.kyl = 0.15; continue; }
    b.kyl = d.takt;
    const p = { id: spel.nastaId++, typ: 'projektil', x: b.x, z: b.z, rot: Math.atan2(mal.x - b.x, mal.z - b.z), hp: 1, maxHp: 1, anim: 'idle',
      slag: 'pil', malSlag: 'fiende', malId: mal.id, skada: d.skada, fart: TUNE.projektil.pilFart };
    spel.projektiler.push(p);
    hand(spel, { typ: 'skott', id: p.id, fran: 'torn', x: b.x, z: b.z });
  }
}
function uppdateraProjektiler(spel, dt) {
  const L = spel.projektiler;
  let w = 0;
  for (let i = 0; i < L.length; i++) {
    const p = L[i];
    let m = null;
    if (p.malSlag === 'fiende') { for (const e of spel.fiender) if (e.id === p.malId) { m = e; break; } if (m && m.hp <= 0) m = null; }
    else if (p.malSlag === 'riddare') m = spel.riddare.dod > 0 ? null : spel.riddare;
    else if (p.malSlag === 'soldat') { for (const v of spel.vanner) if (v.id === p.malId) { m = v; break; } if (m && m.dod !== 0) m = null; }
    else if (p.malSlag === 'bygge') { m = spel.byggen[p.malId - BYGGE_ID0]; if (m && !star(m)) m = null; }
    if (!m) continue;
    if (gaTill(p, m.x, m.z, p.fart, dt) || Math.hypot(m.x - p.x, m.z - p.z) < 0.5) {
      if (p.malSlag === 'fiende') skadaFiende(spel, m, p.skada);
      else if (p.malSlag === 'riddare') skadaRiddare(spel, p.skada);
      else if (p.malSlag === 'soldat') skadaSoldat(spel, m, p.skada);
      else skadaBygge(spel, m, p.skada);
      continue;
    }
    L[w++] = p;
  }
  L.length = w;
}

// ───────────────────────────── FIENDER ─────────────────────────────
function skapaVag(spel) {
  const n = spel.tid.natt, T = TUNE.vag, langd = nattLangd(n);
  const lattnad = Math.min(TUNE.omforsok.lattnadMax, TUNE.omforsok.lattnad * spel.forsok);
  let budget = (T.bas + T.perNatt * n + T.kvadrat * n * n) * (1 - lattnad) * (n % 5 === 0 ? T.bossBudget : 1);
  let antalR = 1;
  for (const [fran, a] of T.riktningar) if (n >= fran) antalR = a;
  const namn = ['N', 'O', 'S', 'V'];
  let rikt = [];
  if (n <= T.fastaRiktningar.length) rikt = [T.fastaRiktningar[n - 1]];
  else { const pool = namn.slice(); while (rikt.length < antalR && pool.length) rikt.push(pool.splice(Math.floor(slump(spel) * pool.length), 1)[0]); }
  const lista = [];
  const typer = ['skelettkrigare', 'skelettskurk', 'skelettmagiker', 'jatte'];
  let anvant = 0;
  const start = budget;
  while (budget >= 1 && lista.length < T.maxAntal) {
    let sum = 0;
    for (const t of typer) { const F = TUNE.fiender[t]; if (n >= F.franNatt && F.poang <= budget) sum += F.vikt; }
    let v = slump(spel) * sum, typ = 'skelettkrigare';
    for (const t of typer) { const F = TUNE.fiender[t]; if (n >= F.franNatt && F.poang <= budget) { v -= F.vikt; if (v <= 0) { typ = t; break; } } }
    budget -= TUNE.fiender[typ].poang; anvant += TUNE.fiender[typ].poang;
    lista.push({ typ, rikt: rikt[Math.floor(slump(spel) * rikt.length)], t: slump(spel) * T.spawnAndel * langd });
  }
  const boss = n % 5 === 0;
  if (boss) lista.push({ typ: 'boss', rikt: rikt[0], t: T.bossTid });
  lista.sort((a, b) => a.t - b.t);
  spel.vag = { natt: n, riktningar: rikt, lista, nasta: 0, boss, totalt: lista.length, sistaDod: 0, lattnad,
    hpFaktor: (1 + T.hpPerNatt * (n - 1)) * (anvant > 0 && budget >= 1 ? start / anvant : 1), skadaFaktor: 1 + T.skadaPerNatt * (n - 1) };
  hand(spel, { typ: 'varning', riktningar: rikt.slice(), platser: rikt.map((r) => ({ x: KARTA.gravfalt[r].x, z: KARTA.gravfalt[r].z })), natt: n, boss });
}
function nattLangd(n) { return Math.min(TUNE.tid.nattMax, TUNE.tid.nattBas + TUNE.tid.nattPerNatt * n); }
function nyFiende(spel, typ, x, z, rikt) {
  const F = TUNE.fiender[typ], V = spel.vag;
  let hp = F.hp * (V.hpFaktor || 1);
  const e = { id: spel.nastaId++, typ, x, z, rot: Math.atan2(-x, -z), hp, maxHp: hp, anim: 'ga',
    fart: F.fart * (0.92 + slump(spel) * 0.16), skadaF: V.skadaFaktor || 1, guld: F.guld, ljus: false, dod: 0, riktning: rikt,
    kyl: slump(spel) * F.takt, tank: 0, animT: 0, malSlag: 'bygge', malId: BYGGE_ID0, mx: 0, mz: 0, malRing: '' };
  if (typ === 'boss') {
    const nr = Math.max(1, Math.round(spel.tid.natt / 5));
    e.bossNr = nr; e.namn = F.namn[(nr - 1) % F.namn.length]; e.special = F.special[(nr - 1) % F.special.length];
    e.maxHp = e.hp = F.hp * F.hpNr[Math.min(nr, F.hpNr.length) - 1] * (nr > F.hpNr.length ? 1 + 0.5 * (nr - F.hpNr.length) : 1);
    e.maxHp = e.hp = e.hp * (1 - (V.lattnad || 0));
    e.guld = F.guld * nr; e.specKyl = F.specTid * 0.6; e.varnar = 0; e.vSlag = ''; e.vx = 0; e.vz = 0; e.vRadie = 0; e.specNr = 0;
    hand(spel, { typ: 'boss_ny', id: e.id, namn: e.namn, bossNr: nr });
  }
  spel.fiender.push(e);
  hand(spel, { typ: 'fiende_ny', id: e.id, fiendeTyp: typ, riktning: rikt, x, z });
  return e;
}
function spawna(spel) {
  const V = spel.vag, t = spel.tid.t;
  while (V.nasta < V.lista.length && V.lista[V.nasta].t <= t) {
    const s = V.lista[V.nasta++], g = KARTA.gravfalt[s.rikt], a = g.vinkel * Math.PI / 180;
    const sida = (slump(spel) * 2 - 1) * TUNE.vag.spridning, djup = slump(spel) * 3;
    nyFiende(spel, s.typ, g.x + Math.cos(a) * sida + Math.sin(a) * djup, g.z - Math.sin(a) * sida + Math.cos(a) * djup, s.rikt);
  }
}
function narmasteVan(spel, e, radie, kravFri) {     // ger 'riddare'/'soldat' i _vanSlag och enheten
  let b = null, bd = radie;
  const k = spel.riddare;
  if (k.dod <= 0) { const d = Math.hypot(k.x - e.x, k.z - e.z); if (d < bd && (!kravFri || friVag(e.x, e.z, k.x, k.z))) { bd = d; b = k; } }
  for (const v of spel.vanner) {
    if (v.typ !== 'soldat' || v.dod !== 0) continue;
    const d = Math.hypot(v.x - e.x, v.z - e.z);
    if (d < bd && (!kravFri || friVag(e.x, e.z, v.x, v.z))) { bd = d; b = v; }
  }
  return b;
}
function standardMal(spel, e) {
  for (const R of RINGAR) {
    const k = sektor(R, e.x, e.z);
    if (!utanfor(R, e.x, e.z, k)) continue;
    const b = spel.byggen[PLATS_IDX[R.prefix + k]];
    if (!star(b)) continue;
    if (e.typ === 'skelettskurk') {
      let bast = -1, bd = 99;
      const max = Math.ceil(R.n / 4);
      for (let j = 1; j <= max; j++) for (const s of [1, -1]) {
        const kk = ((k + s * j) % R.n + R.n) % R.n;
        if (j < bd && !star(spel.byggen[PLATS_IDX[R.prefix + kk]])) { bd = j; bast = kk; }
      }
      if (bast >= 0) { e.malSlag = 'punkt'; e.malId = bast; e.malRing = R.namn; return; }
    }
    e.malSlag = 'bygge'; e.malId = b.id; return;
  }
  e.malSlag = 'bygge'; e.malId = BYGGE_ID0;
}
function valjMal(spel, e) {
  const F = TUNE.fiender[e.typ];
  if (F.rackvidd > 3) {
    let t = null, td = F.sok;
    for (const b of spel.byggen) { if (b.typ !== 'torn' || !star(b)) continue; const d = Math.hypot(b.x - e.x, b.z - e.z); if (d < td) { td = d; t = b; } }
    if (t) { e.malSlag = 'bygge'; e.malId = t.id; return; }
    const v = narmasteVan(spel, e, F.aggro, false);
    if (v) { e.malSlag = v.typ; e.malId = v.id; return; }
  } else if (F.aggro > 0) {
    const v = narmasteVan(spel, e, F.aggro, true);
    if (v) { e.malSlag = v.typ; e.malId = v.id; return; }
  }
  standardMal(spel, e);
}
function flyttaFiende(spel, e, tx, tz, dt, undantag) {
  const dx = tx - e.x, dz = tz - e.z, d = Math.hypot(dx, dz);
  if (d < 1e-6) return;
  const x0 = e.x, z0 = e.z, s = Math.min(d, e.fart * dt);
  e.x += dx / d * s; e.z += dz / d * s; e.rot = Math.atan2(dx, dz);
  for (const b of spel.byggen) {
    if (b.niva <= 0 || b.radie === undefined || b === undantag) continue;
    rundKoll(e, b.x, b.z, b.radie + 0.5);
  }
  for (const m of STAR) {
    if (avstSeg(e.x, e.z, m) < 0.95 && avstSeg(x0, z0, m) >= avstSeg(e.x, e.z, m)) {
      e.x = x0; e.z = z0; e.malSlag = 'bygge'; e.malId = m.id; e.tank = 0.6; return;
    }
  }
}
function fiendeAttack(spel, e, F, malSlag, m) {
  e.kyl = F.takt; e.animT = 0.4;
  e.rot = Math.atan2(m.x - e.x, m.z - e.z);
  if (F.rackvidd > 3) {
    const p = { id: spel.nastaId++, typ: 'projektil', x: e.x, z: e.z, rot: e.rot, hp: 1, maxHp: 1, anim: 'idle',
      slag: 'magi', malSlag, malId: m.id, skada: (malSlag === 'bygge' ? F.byggSkada : F.skada) * e.skadaF, fart: TUNE.projektil.magiFart };
    spel.projektiler.push(p);
    hand(spel, { typ: 'skott', id: p.id, fran: 'magiker', x: e.x, z: e.z });
    return;
  }
  hand(spel, { typ: 'slag', vem: 'fiende', id: e.id, x: e.x, z: e.z });
  if (malSlag === 'bygge') skadaBygge(spel, m, F.byggSkada * e.skadaF);
  else if (malSlag === 'riddare') skadaRiddare(spel, F.skada * e.skadaF);
  else skadaSoldat(spel, m, F.skada * e.skadaF);
}
function bossSpecial(spel, e, dt) {       // ger true om bossen står still och laddar
  const F = TUNE.fiender.boss;
  if (e.varnar > 0) {
    e.varnar -= dt; e.anim = 'hugg';
    if (e.varnar <= 0) {
      e.varnar = 0;
      hand(spel, { typ: 'boss_special', id: e.id, slag: e.vSlag, x: e.vx, z: e.vz, radie: e.vRadie });
      if (e.vSlag === 'akalla') {
        const antal = F.akalla + e.bossNr;
        for (let i = 0; i < antal; i++) { const a = i / antal * TAU; nyFiende(spel, 'skelettkrigare', e.x + Math.sin(a) * 2.5, e.z + Math.cos(a) * 2.5, e.riktning); }
      } else {
        const eld = e.vSlag === 'eldregn', sk = (eld ? F.eldSkada : F.stotSkada) * e.skadaF, bs = (eld ? F.eldByggSkada : F.stotByggSkada) * e.skadaF;
        const k = spel.riddare;
        if (Math.hypot(k.x - e.vx, k.z - e.vz) < e.vRadie) skadaRiddare(spel, sk);
        for (const v of spel.vanner) if (v.typ === 'soldat' && v.dod === 0 && Math.hypot(v.x - e.vx, v.z - e.vz) < e.vRadie) skadaSoldat(spel, v, sk);
        for (const b of spel.byggen) {
          if (!star(b)) continue;
          const d = b.ring ? avstSeg(e.vx, e.vz, b) : Math.hypot(b.x - e.vx, b.z - e.vz) - b.radie;
          if (d < e.vRadie) skadaBygge(spel, b, bs);
        }
      }
    }
    return true;
  }
  e.specKyl -= dt;
  if (e.specKyl <= 0 && Math.hypot(e.x, e.z) < 30) {
    e.specKyl = F.specTid;
    let slag = e.special;
    if (slag === 'alla') slag = ['stot', 'eldregn', 'akalla'][e.specNr % 3];
    e.specNr++;
    e.vSlag = slag; e.vx = e.x; e.vz = e.z; e.vRadie = F.stotRadie;
    if (slag === 'eldregn') {
      const k = spel.riddare;
      e.vRadie = F.eldRadie;
      if (k.dod <= 0 && Math.hypot(k.x - e.x, k.z - e.z) < 25) { e.vx = k.x; e.vz = k.z; }
      else { let t = null, td = 25; for (const b of spel.byggen) { if (b.typ !== 'torn' || !star(b)) continue; const d = Math.hypot(b.x - e.x, b.z - e.z); if (d < td) { td = d; t = b; } } if (t) { e.vx = t.x; e.vz = t.z; } }
    }
    e.varnar = F.varnTid;
    hand(spel, { typ: 'boss_varning', id: e.id, slag, x: e.vx, z: e.vz, radie: e.vRadie, tid: F.varnTid });
    return true;
  }
  return false;
}
function uppdateraFiende(spel, e, dt) {
  if (e.hp <= 0) { e.dod -= dt; e.anim = 'do'; return; }
  const F = TUNE.fiender[e.typ];
  e.kyl -= dt; e.animT -= dt; e.tank -= dt;
  if (e.typ === 'boss' && bossSpecial(spel, e, dt)) return;
  if (e.tank <= 0) { valjMal(spel, e); e.tank = 0.3 + slump(spel) * 0.2; }
  let rors = false;
  if (e.malSlag === 'punkt') {
    const R = KARTA.ringar[e.malRing] || KARTA.ringar.inre, ro = R.horn + 1.4;
    const ga = e.malId * TAU / R.n, a = Math.atan2(e.x, e.z), r = Math.hypot(e.x, e.z);
    let diff = ga - a; while (diff > Math.PI) diff -= TAU; while (diff < -Math.PI) diff += TAU;
    if (Math.abs(diff) < 0.12 || r < R.radie - 0.5) { flyttaFiende(spel, e, 0, 0, dt, null); if (r < R.radie - 0.5) e.tank = 0; }
    else { const na = a + kl(diff, -0.35, 0.35); flyttaFiende(spel, e, Math.sin(na) * ro, Math.cos(na) * ro, dt, null); }
    rors = true;
  } else {
    let m = null, tx = 0, tz = 0, rack = F.rackvidd;
    if (e.malSlag === 'bygge') {
      m = spel.byggen[e.malId - BYGGE_ID0];
      if (!m || !star(m)) { e.tank = 0; m = null; }
      else if (m.ring) { avstSeg(e.x, e.z, m); tx = _cx; tz = _cz; rack = F.rackvidd > 3 ? F.rackvidd : 1.4; }
      else { tx = m.x; tz = m.z; rack = F.rackvidd > 3 ? F.rackvidd + m.radie : m.radie + 1.1; }
    } else if (e.malSlag === 'riddare') {
      m = spel.riddare; if (m.dod > 0) { m = null; e.tank = 0; } else { tx = m.x; tz = m.z; }
    } else {
      for (const v of spel.vanner) if (v.id === e.malId) { m = v; break; }
      if (!m || m.dod !== 0) { m = null; e.tank = 0; } else { tx = m.x; tz = m.z; }
    }
    if (m) {
      const d = Math.hypot(tx - e.x, tz - e.z);
      if (d > rack) { flyttaFiende(spel, e, tx, tz, dt, m); rors = true; }
      else if (e.kyl <= 0) fiendeAttack(spel, e, F, e.malSlag, m);
    }
  }
  e.ljus = LJUS.length > 0 && iLjus(e.x, e.z) > 0;
  e.anim = e.animT > 0 ? 'hugg' : rors ? (e.typ === 'skelettskurk' ? 'spring' : 'ga') : 'idle';
}

// ───────────────────────────── TID OCH FASER ─────────────────────────────
function bytFas(spel, fas, langd) {
  const t = spel.tid;
  t.fas = fas; t.t = 0; t.langd = langd; t.kvar = langd; t.andel = 0;
  hand(spel, { typ: 'fas', fas, natt: t.natt });
}
function uppdateraTid(spel, dt, inp, forsta) {
  const t = spel.tid, T = TUNE.tid;
  t.t += dt;
  if (t.fas === 'dag') {
    if (inp.horn && forsta && t.t < t.langd) {
      const guld = Math.round((t.langd - t.t) * TUNE.horn.guldPerSek * (1 + TUNE.horn.perNatt * t.natt));
      spel.lager.guld += guld; spel.stat.hornGuld += guld;
      hand(spel, { typ: 'horn', guld });
      t.t = t.langd;
    }
    if (t.t >= t.langd) { bytFas(spel, 'skymning', T.skymning); skapaVag(spel); satPoster(spel); if (spel.guide.steg) { spel.guide.steg = ''; spel.guide.text = ''; hand(spel, { typ: 'guide', steg: '' }); } }
  } else if (t.fas === 'skymning') {
    if (t.t >= t.langd) bytFas(spel, 'natt', nattLangd(t.natt));
  } else if (t.fas === 'natt') {
    spawna(spel);
    const V = spel.vag;
    let lever = 0;
    for (const e of spel.fiender) if (e.hp > 0) lever++;
    if (V.nasta >= V.lista.length && lever === 0) V.sistaDod += dt; else V.sistaDod = 0;
    if (t.t >= t.langd || V.sistaDod >= T.nattSlutVanta) gryning(spel);
  } else if (t.fas === 'gryning') {
    if (t.t >= t.langd) nyDag(spel);
  }
  t.kvar = Math.max(0, t.langd - t.t);
  t.andel = t.langd > 0 ? kl(t.t / t.langd, 0, 1) : 1;
}
function gryning(spel) {
  const n = spel.tid.natt;
  let brann = 0;
  for (const e of spel.fiender) if (e.hp > 0) { e.hp = 0; e.anim = 'do'; e.dod = 1.2; e.varnar = 0; brann++; hand(spel, { typ: 'fiende_brinner', id: e.id, x: e.x, z: e.z }); }
  spel.projektiler.length = 0;
  let guld = TUNE.gryning.guld + TUNE.gryning.guldPerNatt * n + (spel.vag.boss ? TUNE.gryning.bossGuld : 0);
  for (const d of spel.drop) guld += d.antal;
  spel.drop.length = 0;
  spel.lager.guld += guld;
  spel.basta = Math.max(spel.basta, n);
  spel.forsok = 0;
  bytFas(spel, 'gryning', TUNE.tid.gryning);
  hand(spel, { typ: 'gryning', natt: n, guld, brann });
  if (n >= TUNE.segerNatt && !spel.seger) { spel.seger = true; hand(spel, { typ: 'seger', natt: n }); }
}
function nyDag(spel) {
  spel.tid.natt++;
  spel.fiender.length = 0;
  spel.vag = { natt: 0, riktningar: [], lista: [], nasta: 0, boss: false, totalt: 0, sistaDod: 0, lattnad: 0, hpFaktor: 1, skadaFaktor: 1 };
  const tr = spel.byggen[0]; tr.hp = tr.maxHp;
  const k = spel.riddare;
  if (k.dod > 0) { k.dod = 0; k.x = KARTA.start.x; k.z = KARTA.start.z; }
  k.hp = k.maxHp;
  synkaFolk(spel, true);
  bytFas(spel, 'dag', TUNE.tid.dag);
  satPoster(spel);
  uppdateraMal(spel);
  spel.handelser.push({ typ: 'spara', orsak: 'gryning' });
  spel.gryningsbild = packa(spel);
}
export function gorOm(spel) {
  if (!spel || spel.lage !== 'forlust') return spel;
  const bild = spel.gryningsbild, forsok = (spel.forsok | 0) + 1, stat = spel.stat, hand0 = spel.handelser, basta = spel.basta, seger = spel.seger;
  let ny = null;
  try { ny = packaUpp(bild); } catch (e) { ny = null; }
  if (!ny || !giltigt(ny)) ny = nyttSpel({ fro: spel.fro, guide: false });
  for (const key of Object.keys(spel)) delete spel[key];
  Object.assign(spel, ny);
  spel.gryningsbild = bild && typeof bild === 'object' ? bild : packa(spel);
  spel.handelser = hand0;
  spel.forsok = forsok; spel.basta = Math.max(basta | 0, spel.basta); spel.seger = seger || spel.seger;
  spel.stat.speltid = stat.speltid; spel.stat.forluster = stat.forluster; spel.stat.dodade = stat.dodade;
  spel.rng = (spel.rng + Math.imul(forsok, 40503)) | 0;
  const g = Math.round((TUNE.omforsok.gava + TUNE.omforsok.gavaPerNatt * spel.tid.natt) * forsok);
  spel.lager.tra += g; spel.lager.sten += g;
  uppdateraMal(spel);
  hand(spel, { typ: 'gor_om', natt: spel.tid.natt, forsok });
  return spel;
}

// ───────────────────────────── MÅLRAD OCH GUIDE ─────────────────────────────
function narmasteNatur(spel, typ, x, z) {
  let b = null, bd = 1e9;
  for (const n of spel.natur) { if (n.typ !== typ || n.hp <= 0) continue; const d = Math.hypot(n.x - x, n.z - z); if (d < bd) { bd = d; b = n; } }
  return b;
}
function satMal(spel, text, x, z, slag, id) { const m = spel.mal; m.text = text; m.x = x; m.z = z; m.slag = slag; m.id = id || 0; }
function uppdateraMal(spel) {
  const k = spel.riddare, t = spel.tid, g = spel.guide;
  if (spel.lage === 'forlust') { satMal(spel, 'Tronsalen föll. Försök natten igen.', 0, 0, 'forlust', 0); return; }
  if (t.fas === 'natt') {
    let b = null, bd = 1e9, boss = null;
    for (const e of spel.fiender) { if (e.hp <= 0) continue; if (e.typ === 'boss') boss = e; const d = Math.hypot(e.x, e.z); if (d < bd) { bd = d; b = e; } }
    if (boss) satMal(spel, 'Besegra ' + boss.namn + '!', boss.x, boss.z, 'fiende', boss.id);
    else if (b) satMal(spel, 'Försvara tronsalen!', b.x, b.z, 'fiende', b.id);
    else { const r = spel.vag.riktningar[0] || 'N', a = KARTA.riktningar[r] * Math.PI / 180; satMal(spel, 'Håll ut till gryningen.', Math.sin(a) * 12, Math.cos(a) * 12, 'riktning', 0); }
    return;
  }
  if (t.fas === 'skymning') {
    const rk = spel.vag.riktningar, namn = rk.map((r) => KARTA.riktningNamn[r]);
    const text = 'De odöda kommer från ' + (namn.length > 1 ? namn.slice(0, -1).join(', ') + ' och ' + namn[namn.length - 1] : namn[0] || 'mörkret') + '!';
    const a = KARTA.riktningar[rk[0] || 'N'] * Math.PI / 180;
    satMal(spel, text, Math.sin(a) * 12, Math.cos(a) * 12, 'riktning', 0); return;
  }
  if (t.fas === 'gryning') { satMal(spel, spel.seger && t.natt === TUNE.segerNatt ? 'Seger! Borgen står efter 20 nätter.' : 'Gryning! Natten är över.', 0, 0, 'ingen', 0); return; }
  // dag
  let ruta = null;
  for (const r of spel.rutor) if (r.slag === 'bygge' && (!ruta || r.ordning < ruta.ordning)) ruta = r;
  if (g.steg) {
    let steg = g.steg;
    const forsta = spel.byggen[PLATS_IDX.i2];
    if (steg === 'ga' && k.gatt > 2) steg = 'hugg';
    if (steg === 'hugg' && ruta && k.bar.tra + spel.lager.tra >= ruta.pris.tra - ruta.betalt.tra) steg = 'bygg';
    if ((steg === 'hugg' || steg === 'bygg') && forsta.niva > 0) steg = 'forrad';
    if (steg === 'forrad' && (spel.lager.tra + spel.lager.sten > 0 || spel.stat.byggda > 1)) steg = 'horn';
    if (steg !== g.steg) { g.steg = steg; hand(spel, { typ: 'guide', steg }); }
    if (steg === 'ga') { g.text = 'Dra med fingret för att gå.'; const n = narmasteNatur(spel, 'trad', k.x, k.z); satMal(spel, g.text, n ? n.x : 0, n ? n.z : 0, 'trad', n ? n.id : 0); return; }
    if (steg === 'hugg') { g.text = 'Ställ dig vid ett träd. Riddaren hugger själv.'; const n = narmasteNatur(spel, 'trad', k.x, k.z); satMal(spel, g.text, n ? n.x : 0, n ? n.z : 0, 'trad', n ? n.id : 0); return; }
    if (steg === 'bygg' && ruta) { g.text = 'Ställ dig på rutan och bygg din första palissad.'; satMal(spel, g.text, ruta.x, ruta.z, 'ruta', ruta.id); return; }
    if (steg === 'forrad') { g.text = 'Hugg mer trä och lämna det i förrådet.'; if (k.last >= Math.min(k.barMax, 5)) satMal(spel, g.text, KARTA.forrad.x, KARTA.forrad.z, 'forrad', 0); else { const n = narmasteNatur(spel, 'trad', k.x, k.z); satMal(spel, g.text, n ? n.x : 0, n ? n.z : 0, 'trad', n ? n.id : 0); } return; }
    g.text = 'Bygg vidare. Blås i hornet när du är redo för natten.';
  }
  let skadat = null, sv = 0.6;
  for (const b of spel.byggen) { if (b.niva <= 0 || b.plats === 'tronsal' || b.maxHp <= 0) continue; const a = b.hp / b.maxHp; if (a < sv) { sv = a; skadat = b; } }
  if (skadat && (spel.lager.tra + spel.lager.sten + k.last) > 0) {
    const p = KARTA.platser[skadat.plats];
    satMal(spel, 'Laga ' + (NAMN[skadat.typ] || 'bygget') + ': spring förbi.', p.ruta.x, p.ruta.z, 'laga', skadat.id); return;
  }
  if (ruta) {
    const namn = NAMN[ruta.byggTyp] || ruta.byggTyp, verb = ruta.niva > 1 ? 'Uppgradera ' : 'Bygg ';
    const behT = ruta.pris.tra - ruta.betalt.tra, behS = ruta.pris.sten - ruta.betalt.sten;
    const harT = spel.lager.tra + k.bar.tra, harS = spel.lager.sten + k.bar.sten;
    if (harT >= behT && harS >= behS) { satMal(spel, verb + namn + '.', ruta.x, ruta.z, 'ruta', ruta.id); return; }
    const brist = harT < behT ? 'tra' : 'sten';
    // Det är en bit kvar till nästa bygge. Ge spelaren något vettigt att göra under tiden (ändrar bara målraden, inte balansen):
    // gå hem i tid före natten, lägg guldet i smedjan, laga det som är lätt skadat. Annars: samla.
    if (!g.steg && t.kvar < 10 && Math.hypot(k.x, k.z) > 24) { satMal(spel, 'Natten kommer snart. Spring hem till borgen.', 0, 0, 'hem', 0); return; }
    for (const r of spel.rutor) if (r.slag === 'uppgradering' && spel.lager.guld >= r.kvar) { satMal(spel, 'Du har guld: uppgradera ' + NAMN[r.vad] + ' i smedjan.', r.x, r.z, 'ruta', r.id); return; }
    if (!g.steg) {
      let latt = null, lv = 0.95;
      for (const b of spel.byggen) { if (b.niva <= 0 || b.plats === 'tronsal' || b.maxHp <= 0) continue; const a = b.hp / b.maxHp; if (a < lv) { lv = a; latt = b; } }
      if (latt && (lagSlag(latt) === 'tra' ? harT : harS) > 0) { const p = KARTA.platser[latt.plats]; satMal(spel, 'Laga ' + (NAMN[latt.typ] || 'bygget') + ' före natten: spring förbi.', p.ruta.x, p.ruta.z, 'laga', latt.id); return; }
    }
    if (k.last >= k.barMax) {
      if ((k.bar.tra > 0 && behT > 0) || (k.bar.sten > 0 && behS > 0)) satMal(spel, 'Betala på rutan: ' + namn + '.', ruta.x, ruta.z, 'ruta', ruta.id);
      else satMal(spel, 'Fullt i famnen. Lämna i förrådet.', KARTA.forrad.x, KARTA.forrad.z, 'forrad', 0);
      return;
    }
    const n = narmasteNatur(spel, brist === 'tra' ? 'trad' : 'sten', k.x, k.z);
    const antal = brist === 'tra' ? behT - harT : behS - harS;
    satMal(spel, (brist === 'tra' ? 'Hugg trä' : 'Bryt sten') + ' till ' + namn + ' (' + antal + ' kvar).', n ? n.x : 0, n ? n.z : 0, brist === 'tra' ? 'trad' : 'sten', n ? n.id : 0);
    return;
  }
  for (const r of spel.rutor) if (r.slag === 'uppgradering' && spel.lager.guld >= r.kvar) { satMal(spel, 'Uppgradera ' + NAMN[r.vad] + ' i smedjan.', r.x, r.z, 'ruta', r.id); return; }
  satMal(spel, 'Borgen är fullt utbyggd. Blås i hornet när du vill.', 0, 0, 'ingen', 0);
}

// ───────────────────────────── STEG ─────────────────────────────
function delsteg(spel, dt, inp, forsta) {
  if (spel.lage !== 'spel') return;
  spel.stat.speltid += dt;
  STAR = []; LJUS = [];
  const natt = spel.tid.fas === 'natt' || spel.tid.fas === 'skymning';
  for (const b of spel.byggen) {
    if (b.niva <= 0) continue;
    if (b.ring) { if (!b.raserad) STAR.push(b); }
    else if (natt && b.typ === 'fyrfat') { const d = nivaData(b); LJUS.push({ x: b.x, z: b.z, r2: d.ljus * d.ljus, bonus: d.bonus }); }
  }
  uppdateraTid(spel, dt, inp, forsta);
  uppdateraRiddare(spel, dt, inp);
  uppdateraRutor(spel, dt);
  let rensa = false;
  for (const v of spel.vanner) { if (v.typ === 'arbetare') uppdateraArbetare(spel, v, dt); else { uppdateraSoldat(spel, v, dt); if (v.dod < 0) rensa = true; } }
  if (rensa) spel.vanner = spel.vanner.filter((v) => !(v.typ === 'soldat' && v.dod < 0));
  uppdateraTorn(spel, dt);
  const F = spel.fiender;
  for (let i = 0; i < F.length; i++) { uppdateraFiende(spel, F[i], dt); if (spel.lage !== 'spel') break; }
  let w = 0;
  for (let i = 0; i < F.length; i++) if (F[i].hp > 0 || F[i].dod > 0) F[w++] = F[i];
  F.length = w;
  uppdateraProjektiler(spel, dt);
  // guld på marken dras till riddaren
  const k = spel.riddare, D = spel.drop;
  if (D.length && k.dod <= 0) {
    w = 0;
    for (let i = 0; i < D.length; i++) {
      const d = D[i], a = Math.hypot(k.x - d.x, k.z - d.z);
      if (a < TUNE.riddare.magnet) {
        if (a < 0.7 || gaTill(d, k.x, k.z, 14, dt)) { spel.lager.guld += d.antal; hand(spel, { typ: 'plock', slag: 'guld', antal: d.antal, x: k.x, z: k.z }); continue; }
      }
      D[w++] = d;
    }
    D.length = w;
  }
  for (const n of spel.natur) {
    if (n.ater > 0) { n.ater -= dt; if (n.ater <= 0) { n.ater = 0; n.hp = n.maxHp; n.anim = 'idle'; hand(spel, { typ: 'natur_ater', id: n.id, slag: n.typ === 'trad' ? 'tra' : 'sten', x: n.x, z: n.z }); } }
  }
  spel.malKyl -= dt;
  if (spel.malKyl <= 0 || spel.lage !== 'spel') { spel.malKyl = 0.2; uppdateraMal(spel); }
}
export function steg(spel, dt, input) {
  if (!spel || typeof spel !== 'object') return spel;
  const inp = { dx: kl(tal(input && input.dx, 0), -1, 1), dz: kl(tal(input && input.dz, 0), -1, 1), horn: !!(input && input.horn) };
  if (input && input.gorOm && spel.lage === 'forlust') gorOm(spel);
  if (!(dt > 0) || !isFinite(dt)) return spel;
  let kvar = Math.min(dt, TUNE.maxDt), forsta = true;
  while (kvar > 1e-9) {
    const d = Math.min(kvar, TUNE.stegMax);
    delsteg(spel, d, inp, forsta);
    forsta = false; kvar -= d;
  }
  if (spel.handelser.length > 3000) spel.handelser.splice(0, spel.handelser.length - 3000);
  return spel;
}

// ───────────────────────────── SPARNING ─────────────────────────────
function packa(spel) {       // JSON-bar kopia utan händelser och gryningsbild, naturen kompakt
  const ut = {};
  for (const key of Object.keys(spel)) {
    if (key === 'handelser' || key === 'gryningsbild' || key === 'natur') continue;
    ut[key] = spel[key];
  }
  const kopia = klona(ut);
  kopia.natur = spel.natur.map((n) => [n.hp, n.ater]);
  return kopia;
}
function packaUpp(data) {
  const s = klona(data);
  delete s.gryningsbild;
  const natur = nyNatur();
  if (Array.isArray(data.natur)) {
    natur.forEach((n, i) => {
      const d = data.natur[i];
      if (!Array.isArray(d)) return;
      n.hp = kl(tal(d[0], n.maxHp), 0, n.maxHp); n.ater = Math.max(0, tal(d[1], 0));
      if (n.hp <= 0 && n.ater <= 0) n.hp = n.maxHp;
      n.anim = n.hp > 0 ? 'idle' : 'do';
    });
  }
  s.natur = natur;
  s.handelser = [];
  return s;
}
export function tillSparning(spel) {
  if (spel.lage === 'forlust') {
    // Förlust: spara natten så som den ser ut efter "Försök natten igen" (gryningsbilden med försöksräknare, gåva och lättnad).
    // Då överlever omförsöket att appen stängs på förlustskärmen, och franSparning godtar sparningen som vanligt.
    const kopia = packaUpp(packa(spel));
    kopia.gryningsbild = spel.gryningsbild;
    gorOm(kopia);
    if (kopia.lage !== 'forlust') return tillSparning(kopia);
  }
  const ut = packa(spel);
  ut.gryningsbild = spel.gryningsbild ? klona(spel.gryningsbild) : packa(spel);
  return ut;
}
function harNull(o, djup) {
  if (o === null || o === undefined) return true;
  if (typeof o === 'number') return !isFinite(o);
  if (typeof o !== 'object' || djup > 8) return false;
  if (Array.isArray(o)) { for (const v of o) if (harNull(v, djup + 1)) return true; return false; }
  for (const k in o) if (harNull(o[k], djup + 1)) return true;
  return false;
}
let _mall = null;
function giltigt(s) {
  if (!s || typeof s !== 'object' || s.v !== VERSION) return false;
  if (!_mall) _mall = nyttSpel({ fro: 1 });
  for (const k of Object.keys(_mall)) {
    if (k === 'gryningsbild' || k === 'handelser') continue;
    if (typeof s[k] !== typeof _mall[k] || Array.isArray(s[k]) !== Array.isArray(_mall[k])) return false;
  }
  for (const k of ['tid', 'lager', 'riddare', 'mal', 'guide', 'vag', 'stat']) for (const f of Object.keys(_mall[k])) if (typeof s[k][f] !== typeof _mall[k][f]) return false;
  if (typeof s.riddare.bar !== 'object' || !s.riddare.bar) return false;
  if (s.byggen.length !== _mall.byggen.length) return false;
  for (let i = 0; i < s.byggen.length; i++) {
    const b = s.byggen[i], m = _mall.byggen[i];
    if (!b || b.plats !== m.plats || b.id !== m.id) return false;
    const max = TUNE.byggen[KARTA.platsLista[i].typ].nivaer.length;
    if (!(b.niva >= 0 && b.niva <= max) || b.niva !== Math.floor(b.niva)) return false;
  }
  if (!(s.byggen[0].niva >= 1) || !(s.byggen[0].hp > 0)) return false;
  if (!['dag', 'skymning', 'natt', 'gryning'].includes(s.tid.fas) || !(s.tid.natt >= 1)) return false;
  if (!(s.tid.langd > 0)) return false;
  if (s.lage !== 'spel' && s.lage !== 'forlust') return false;
  const typer = { vanner: ['soldat', 'arbetare'], fiender: Object.keys(TUNE.fiender), rutor: ['betalruta'], projektiler: ['projektil'], drop: ['resurs'] };
  for (const lista in typer) for (const e of s[lista]) if (!e || typeof e !== 'object' || !typer[lista].includes(e.typ) || typeof e.id !== 'number') return false;
  for (const r of s.rutor) if (!r.pris || !r.betalt || (r.slag === 'bygge' && PLATS_IDX[r.plats] === undefined)) return false;
  for (const v of s.vanner) if (v.typ === 'arbetare' && !s.byggen[v.hem - BYGGE_ID0]) return false;
  if (!(s.nastaId >= DYN_ID0)) return false;
  if (harNull(s, 0)) return false;
  return true;
}
function mjukLaddning(data) {      // gammal eller trasig sparning: behåll bara framstegen
  const s = nyttSpel({ fro: tal(data.fro, 1), guide: false });
  const natt = kl(Math.floor(tal(data.tid && data.tid.natt, 1)), 1, 9999);
  s.tid.natt = natt; s.tid.langd = s.tid.kvar = natt > 1 ? TUNE.tid.dag : TUNE.tid.forstaDag;
  if (natt === 1 && !(data.guide && data.guide.steg === '')) s.guide.steg = 'ga';
  for (const k of SLAG) s.lager[k] = kl(Math.floor(tal(data.lager && data.lager[k], 0)), 0, 999999);
  if (Array.isArray(data.byggen)) {
    for (const d of data.byggen) {
      if (!d || typeof d !== 'object' || PLATS_IDX[d.plats] === undefined) continue;
      const b = s.byggen[PLATS_IDX[d.plats]], max = TUNE.byggen[KARTA.platser[d.plats].typ].nivaer.length;
      const niva = kl(Math.floor(tal(d.niva, 0)), d.plats === 'tronsal' ? 1 : 0, max);
      if (niva > 0) satNiva(b, niva);
    }
  }
  const r = data.riddare || {};
  s.riddare.svard = kl(Math.floor(tal(r.svard, 0)), 0, TUNE.riddare.uppgraderingMax);
  s.riddare.rustning = kl(Math.floor(tal(r.rustning, 0)), 0, TUNE.riddare.uppgraderingMax);
  s.riddare.barNiva = kl(Math.floor(tal(r.barNiva, 0)), 0, TUNE.riddare.uppgraderingMax);
  s.riddare.barMax = barMax(s.riddare); s.riddare.maxHp = s.riddare.hp = riddareMaxHp(s.riddare);
  s.basta = kl(Math.floor(tal(data.basta, natt - 1)), 0, 9999);
  s.seger = !!data.seger || s.basta >= TUNE.segerNatt;
  s.rutor.length = 0;
  oppnaRutor(s);
  synkaFolk(s, true);
  s.handelser.length = 0;
  uppdateraMal(s);
  s.aterstalld = 'mjuk';
  s.gryningsbild = packa(s);
  return s;
}
export function franSparning(data) {
  try {
    if (typeof data === 'string') data = JSON.parse(data);
    if (!data || typeof data !== 'object' || Array.isArray(data)) { const s = nyttSpel(); s.aterstalld = 'ny'; return s; }
    if (data.v === VERSION) {
      let s = null;
      try { s = packaUpp(data); } catch (e) { s = null; }
      if (s && giltigt(s)) {
        let bild = null;
        try { const b = packaUpp(data.gryningsbild); if (giltigt(b)) bild = klona(data.gryningsbild); } catch (e) { bild = null; }
        s.aterstalld = '';
        s.gryningsbild = bild || packa(s);
        return s;
      }
      try {
        const b = packaUpp(data.gryningsbild);
        if (giltigt(b)) {
          b.gryningsbild = klona(data.gryningsbild);
          if (data.lage === 'forlust') {   // sparad mitt på förlustskärmen (äldre format): ge omförsöket med räknare och gåva
            b.lage = 'forlust'; b.forsok = kl(Math.floor(tal(data.forsok, 0)), 0, 99);
            if (data.stat && typeof data.stat === 'object') for (const f of ['speltid', 'forluster', 'dodade']) b.stat[f] = Math.max(b.stat[f], tal(data.stat[f], 0));
            gorOm(b); b.handelser.length = 0;
          }
          b.aterstalld = 'gryning'; return b;
        }
      } catch (e) { /* faller vidare */ }
    }
    return mjukLaddning(data);
  } catch (e) {
    const s = nyttSpel(); s.aterstalld = 'ny'; return s;
  }
}
