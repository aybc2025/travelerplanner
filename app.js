/* ===========================================================
   SkyTrain MVP (Expo, Millennium, Canada) — גרסה מתוקנת
   תיקונים עיקריים:
   - ניתוח SVG משופר לחילוץ מיקומי תחנות
   - תיקון באגים בחישוב מסלולים
   - מיפוי קואורדינטות מדויק יותר
=========================================================== */

/* ===== קווים וזמני שירות ===== */
const LINE_META = {
  EXPO: { id:"EXPO", name:"Expo Line", color:"#0060A9",
    headways:[{start:"05:00",end:"06:59",mins:8},{start:"07:00",end:"09:59",mins:4},{start:"10:00",end:"15:59",mins:6},{start:"16:00",end:"18:59",mins:4},{start:"19:00",end:"25:15",mins:8}],
    firstTrain:"05:00", lastTrain:"25:15"
  },
  MILL: { id:"MILL", name:"Millennium Line", color:"#FDB515",
    headways:[{start:"05:00",end:"06:59",mins:8},{start:"07:00",end:"09:59",mins:5},{start:"10:00",end:"15:59",mins:6},{start:"16:00",end:"18:59",mins:5},{start:"19:00",end:"25:15",mins:8}],
    firstTrain:"05:00", lastTrain:"25:15"
  },
  CAN:  { id:"CAN",  name:"Canada Line", color:"#00B7C3",
    headways:[{start:"05:00",end:"06:59",mins:6},{start:"07:00",end:"09:59",mins:4},{start:"10:00",end:"15:59",mins:5},{start:"16:00",end:"18:59",mins:4},{start:"19:00",end:"25:15",mins:6}],
    firstTrain:"05:00", lastTrain:"25:15"
  }
};

/* ===== עזרי זמן ===== */
const pad2 = n => String(n).padStart(2,"0");
function toMinutesWrap(hhmm){ const [h,m]=hhmm.split(":").map(Number); return ((h%24)*60+m)+(h>=24?1440:0); }
const toHHMM = mins => `${pad2(Math.floor((mins%1440)/60))}:${pad2(mins%60)}`;
function headwayFor(lineId, depMins){
  const meta = LINE_META[lineId]; const t = depMins % 1440; const t2 = (depMins<1440)? t : t+1440;
  for (const w of meta.headways){
    const s = toMinutesWrap(w.start), e = toMinutesWrap(w.end);
    if (s<=t2 && t2<=e) return w.mins;
  }
  return meta.headways.at(-1).mins;
}
function scheduleDeparture(lineId, earliest){
  const meta = LINE_META[lineId];
  const first = toMinutesWrap(meta.firstTrain), last = toMinutesWrap(meta.lastTrain);
  let depart = Math.max(earliest, first);
  if (depart > last) return null;
  const hw = headwayFor(lineId, depart);
  const offset = (depart - first) % hw;
  if (offset !== 0) depart += (hw - offset);
  return depart <= last ? depart : null;
}

/* ===== גרף תחנות (קשתות) ===== */
function E(a,b,mins,line){ return {a,b,mins,line}; }
const EDGES = [
  // EXPO: Waterfront -> Columbia
  E("Waterfront","Burrard",2,"EXPO"), E("Burrard","Granville",2,"EXPO"),
  E("Granville","Stadium–Chinatown",3,"EXPO"), E("Stadium–Chinatown","Main Street–Science World",3,"EXPO"),
  E("Main Street–Science World","Commercial–Broadway",4,"EXPO"),
  E("Commercial–Broadway","Nanaimo",3,"EXPO"), E("Nanaimo","29th Avenue",2,"EXPO"),
  E("29th Avenue","Joyce–Collingwood",3,"EXPO"), E("Joyce–Collingwood","Patterson",3,"EXPO"),
  E("Patterson","Metrotown",3,"EXPO"), E("Metrotown","Royal Oak",3,"EXPO"),
  E("Royal Oak","Edmonds",3,"EXPO"), E("Edmonds","22nd Street",3,"EXPO"),
  E("22nd Street","New Westminster",2,"EXPO"), E("New Westminster","Columbia",2,"EXPO"),
  // EXPO לענף King George
  E("Columbia","Scott Road",2,"EXPO"), E("Scott Road","Gateway",3,"EXPO"),
  E("Gateway","Surrey Central",3,"EXPO"), E("Surrey Central","King George",2,"EXPO"),
  // EXPO לענף Production Way
  E("Columbia","Sapperton",3,"EXPO"), E("Sapperton","Braid",3,"EXPO"),
  E("Braid","Lougheed Town Centre",4,"EXPO"), E("Lougheed Town Centre","Production Way–University",2,"EXPO"),
  // MILLENNIUM
  E("VCC–Clark","Commercial–Broadway",3,"MILL"), E("Commercial–Broadway","Renfrew",2,"MILL"),
  E("Renfrew","Rupert",2,"MILL"), E("Rupert","Gilmore",3,"MILL"),
  E("Gilmore","Brentwood Town Centre",3,"MILL"), E("Brentwood Town Centre","Holdom",2,"MILL"),
  E("Holdom","Sperling–Burnaby Lake",3,"MILL"), E("Sperling–Burnaby Lake","Lake City Way",2,"MILL"),
  E("Lake City Way","Production Way–University",2,"MILL"), E("Production Way–University","Lougheed Town Centre",3,"MILL"),
  E("Lougheed Town Centre","Burquitlam",3,"MILL"), E("Burquitlam","Moody Centre",4,"MILL"),
  E("Moody Centre","Inlet Centre",2,"MILL"), E("Inlet Centre","Coquitlam Central",2,"MILL"),
  E("Coquitlam Central","Lincoln",2,"MILL"), E("Lincoln","Lafarge Lake–Douglas",2,"MILL"),
  // CANADA
  E("Waterfront","Vancouver City Centre",2,"CAN"), E("Vancouver City Centre","Yaletown–Roundhouse",2,"CAN"),
  E("Yaletown–Roundhouse","Olympic Village",3,"CAN"), E("Olympic Village","Broadway–City Hall",3,"CAN"),
  E("Broadway–City Hall","King Edward",3,"CAN"), E("King Edward","Oakridge–41st Avenue",3,"CAN"),
  E("Oakridge–41st Avenue","Langara–49th Avenue",3,"CAN"), E("Langara–49th Avenue","Marine Drive",3,"CAN"),
  E("Marine Drive","Bridgeport",4,"CAN"),
  E("Bridgeport","Templeton",3,"CAN"), E("Templeton","Sea Island Centre",2,"CAN"), E("Sea Island Centre","YVR–Airport",2,"CAN"),
  E("Bridgeport","Aberdeen",3,"CAN"), E("Aberdeen","Lansdowne",2,"CAN"), E("Lansdowne","Richmond–Brighouse",2,"CAN"),
];

const LINE_STOPS = { EXPO:new Set(), MILL:new Set(), CAN:new Set() };
const GRAPH_BY_LINE = { EXPO:{}, MILL:{}, CAN:{} };
for (const {a,b,mins,line} of EDGES) {
  LINE_STOPS[line].add(a); LINE_STOPS[line].add(b);
  if (!GRAPH_BY_LINE[line][a]) GRAPH_BY_LINE[line][a] = [];
  if (!GRAPH_BY_LINE[line][b]) GRAPH_BY_LINE[line][b] = [];
  GRAPH_BY_LINE[line][a].push({to:b,mins});
  GRAPH_BY_LINE[line][b].push({to:a,mins});
}
const ALL_STOPS = [...new Set(Object.values(LINE_STOPS).flatMap(s => [...s]))].sort((a,b)=>a.localeCompare(b,'he'));
const TRANSFER_HUBS = new Set(["Waterfront","Commercial–Broadway","Production Way–University","Lougheed Town Centre","Columbia"]);

/* ===== תכנון מסלולים - עם תיקון באגים ===== */
const LINES_ORDER = ["EXPO","MILL","CAN"];
const TRANSFER_MIN = 3;

function shortestOnLine(lineId, from, to){
  if (!LINE_STOPS[lineId].has(from) || !LINE_STOPS[lineId].has(to) || from === to) return null;
  const adj = GRAPH_BY_LINE[lineId];
  const dist = new Map(), prev = new Map(), pq = [];
  Object.keys(adj).forEach(s => dist.set(s, Infinity));
  dist.set(from,0); pq.push([0,from]);
  while(pq.length){
    pq.sort((a,b)=>a[0]-b[0]);
    const [d,u] = pq.shift();
    if (d>dist.get(u)) continue;
    if (u===to) break;
    for (const {to:v,mins} of adj[u]){
      const nd = d+mins;
      if (nd<dist.get(v)){ dist.set(v,nd); prev.set(v,u); pq.push([nd,v]); }
    }
  }
  if (dist.get(to)===Infinity) return null;
  const path = []; let cur=to;
  while(cur && cur!==from){ path.push(cur); cur=prev.get(cur); }
  path.push(from); path.reverse();
  return { mins: dist.get(to), path };
}

function intersection(aSet,bSet){ const out=[]; for (const x of aSet) if (bSet.has(x)) out.push(x); return out; }

function planCandidates(from, to, depMins){
  if (from === to) return [];
  
  console.log(`🚇 Planning routes from "${from}" to "${to}"`);
  
  // בדיקה איזה קווים משרתים כל תחנה
  const fromLines = [];
  const toLines = [];
  for (const [lineId, stops] of Object.entries(LINE_STOPS)) {
    if (stops.has(from)) fromLines.push(lineId);
    if (stops.has(to)) toLines.push(lineId);
  }
  
  console.log(`  ${from} served by: [${fromLines.join(', ')}]`);
  console.log(`  ${to} served by: [${toLines.join(', ')}]`);
  
  const cands = [];
  
  // 1. נתיבים ישירים - עדיפות עליונה
  const directLines = fromLines.filter(line => toLines.includes(line));
  for (const lineId of directLines) {
    const seg = shortestOnLine(lineId, from, to);
    if (seg && seg.path.length >= 2) {
      const d1 = scheduleDeparture(lineId, depMins); 
      if (d1 != null) {
        const a1 = d1 + seg.mins;
        cands.push({ 
          type: "DIRECT", 
          transfers: 0, 
          depart: d1, 
          arrive: a1,
          totalTime: a1 - d1,
          legs: [{ 
            line: LINE_META[lineId].name, 
            lineId, 
            color: LINE_META[lineId].color, 
            from, 
            to, 
            depart: d1, 
            arrive: a1, 
            path: seg.path 
          }]
        });
        console.log(`  ✅ Direct on ${lineId}: ${seg.mins} min, ${seg.path.length} stops`);
      }
    }
  }
  
  // אם יש מסלול ישיר קצר (פחות מ-25 דקות), העדף אותו
  if (cands.some(c => c.totalTime <= 25)) {
    console.log(`  🎯 Found efficient direct route(s), skipping transfers`);
    return cands
      .filter(c => c.transfers === 0)
      .sort((a, b) => a.totalTime - b.totalTime)
      .slice(0, 2);
  }
  
  // 2. נתיבים עם החלפה אחת - רק דרך תחנות החלפה מרכזיות
  console.log(`  🔄 Looking for 1-transfer routes...`);
  
  for (const hub of TRANSFER_HUBS) {
    if (hub === from || hub === to) continue;
    
    // מצא קווים שמחברים מוצא לרכזת
    const hubFromLines = fromLines.filter(line => LINE_STOPS[line].has(hub));
    const hubToLines = toLines.filter(line => LINE_STOPS[line].has(hub));
    
    for (const L1 of hubFromLines) {
      for (const L2 of hubToLines) {
        if (L1 === L2) continue; // לא החלפה אמיתית
        
        const seg1 = shortestOnLine(L1, from, hub);
        const seg2 = shortestOnLine(L2, hub, to);
        
        if (!seg1 || !seg2 || seg1.path.length < 2 || seg2.path.length < 2) continue;
        
        const d1 = scheduleDeparture(L1, depMins); 
        if (d1 == null) continue;
        
        const a1 = d1 + seg1.mins;
        const d2 = scheduleDeparture(L2, a1 + TRANSFER_MIN); 
        if (d2 == null) continue;
        
        const a2 = d2 + seg2.mins;
        const totalTime = a2 - d1;
        
        // רק אם החלפה מהירה יותר או דומה למסלול הישיר
        const directTime = cands.length > 0 ? Math.min(...cands.map(c => c.totalTime)) : Infinity;
        if (totalTime > directTime + 15) continue; // לא יותר מ-15 דקות נוספות
        
        cands.push({ 
          type: "TRANSFER1", 
          transfers: 1, 
          depart: d1, 
          arrive: a2,
          totalTime,
          legs: [
            { line: LINE_META[L1].name, lineId: L1, color: LINE_META[L1].color, from, to: hub, depart: d1, arrive: a1, path: seg1.path },
            { line: LINE_META[L2].name, lineId: L2, color: LINE_META[L2].color, from: hub, to, depart: d2, arrive: a2, path: seg2.path }
          ]
        });
        console.log(`  ✅ 1-transfer via ${hub}: ${L1}→${L2}, ${totalTime} min total`);
      }
    }
  }
  
  // 3. נתיבים עם 2 החלפות - רק במקרים חריגים
  if (cands.length === 0) {
    console.log(`  🔄🔄 No direct/1-transfer found, looking for 2-transfers...`);
    
    // לא ליישם כרגע - מסובך מדי למטרת ה-MVP
  }
  
  // סינון וסידור תוצאות
  const uniqueCands = [];
  const seen = new Set();
  
  for (const cand of cands) {
    const key = cand.legs.map(l => `${l.lineId}:${l.from}→${l.to}`).join('|');
    if (!seen.has(key)) {
      seen.add(key);
      uniqueCands.push(cand);
    }
  }
  
  const result = uniqueCands
    .sort((a, b) => {
      // עדיפות: פחות החלפות, אחר כך זמן מהיר יותר
      if (a.transfers !== b.transfers) return a.transfers - b.transfers;
      return a.totalTime - b.totalTime;
    })
    .slice(0, 3);
  
  console.log(`  📊 Returning ${result.length} best routes:`);
  result.forEach((r, i) => {
    const transferText = r.transfers === 0 ? 'Direct' : `${r.transfers} transfer${r.transfers > 1 ? 's' : ''}`;
    console.log(`    ${i + 1}. ${transferText}: ${r.totalTime} min (${r.legs.map(l => l.lineId).join('→')})`);
  });
  
  return result;
}

/* ===== DOM ===== */
const fromSel = document.getElementById('fromStop');
const toSel   = document.getElementById('toStop');
const depTime = document.getElementById('depTime');
const depDate = document.getElementById('depDate');
const resultsEl = document.getElementById('results');
const favBtn = document.getElementById('favBtn');
const favsEl = document.getElementById('favs');
const btnShowOnMap = document.getElementById('btnShowOnMap');
const btnResetMap  = document.getElementById('btnResetMap');
const overlay = document.getElementById("overlay");

/* ===== טפסים/ברירת מחדל ===== */
function populateStops(){
  for (const s of ALL_STOPS){
    const o1=document.createElement('option'); o1.value=s; o1.textContent=s;
    const o2=document.createElement('option'); o2.value=s; o2.textContent=s;
    fromSel.appendChild(o1); toSel.appendChild(o2);
  }
  fromSel.value="Waterfront"; toSel.value="Commercial–Broadway";
  const now = new Date(); depDate.valueAsDate=now;
  depTime.value = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
}
function minutesFromDateTimeInputs(){
  const d = depDate.value? new Date(depDate.value) : new Date();
  const [hh,mm] = (depTime.value || "00:00").split(':').map(Number);
  d.setHours(hh??0, mm??0, 0, 0);
  const mins = d.getHours()*60 + d.getMinutes();
  return mins < 180 ? mins+1440 : mins; // תמיכה עד 01:15
}

/* ===== מועדפים ===== */
function loadFavs(){
  favsEl.innerHTML = '';
  const favs = JSON.parse(localStorage.getItem('mvpfavs') || '[]');
  if (!Array.isArray(favs) || favs.length === 0){
    favsEl.innerHTML = `<span class="text-slate-500 text-sm">אין מועדפים עדיין.</span>`;
    return;
  }
  for (const f of favs){
    const b = document.createElement('button');
    b.className = 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-900 hover:bg-amber-200';
    b.textContent = `⭐ ${f.from} → ${f.to}`;
    b.addEventListener('click', ()=>{
      fromSel.value = f.from; toSel.value = f.to;
      document.getElementById('tripForm').dispatchEvent(new Event('submit'));
    });
    favsEl.appendChild(b);
  }
}
function saveFav(from, to){
  const favs = JSON.parse(localStorage.getItem('mvpfavs') || '[]');
  if (!favs.find(x => x.from === from && x.to === to)){
    favs.push({ from, to });
    localStorage.setItem('mvpfavs', JSON.stringify(favs));
    loadFavs();
  }
}

/* ===== תוצאות ===== */
let lastTrips = [];
function renderResults(list){
  resultsEl.innerHTML='';
  if (!list.length){
    resultsEl.innerHTML = `<p class="text-sm text-slate-600">לא נמצאו חלופות מתאימות בטווח השעות שנבחר.</p>`;
    return;
  }
  list.forEach((r,idx)=>{
    const dur = r.arrive - r.depart;
    const el = document.createElement('div');
    el.className='border rounded-xl p-3 bg-white';
    el.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold" style="background:#eef">${r.transfers? (r.transfers===1?'החלפה אחת':'2 החלפות') : 'ישיר'}</span>
        <span class="text-sm text-slate-600">יציאה ${toHHMM(r.depart)} • הגעה ${toHHMM(r.arrive)} • ${dur} דק׳</span>
        <button class="ml-auto px-2 py-1.5 text-xs rounded bg-slate-100 hover:bg-slate-200" data-idx="${idx}">הצג מסלול על המפה</button>
      </div>
      <ol class="mt-2 space-y-2">
        ${r.legs.map(l=>`
          <li class="flex items-center gap-2">
            <span class="w-3 h-3 rounded-full" style="background:${l.color}"></span>
            <span class="font-medium">${l.line}</span>
            <span class="text-slate-700">— ${l.from} → ${l.to}</span>
            <span class="ml-auto text-xs text-slate-600">${toHHMM(l.depart)} → ${toHHMM(l.arrive)}</span>
          </li>
        `).join('')}
      </ol>
    `;
    el.querySelector('button').addEventListener('click', async ()=>{
      await loadWikiMapOnce(); 
      clearOverlay(); 
      drawHighlightedTrip(lastTrips[idx]);
      console.log('Drawing route for trip:', idx, lastTrips[idx]);
    });
    resultsEl.appendChild(el);
  });
}

/* ===== מפה: טעינת SVG מוויקיפדיה + חילוץ קואורדינטות משופר ===== */
const WIKI_SVG_URLS = [
  "https://upload.wikimedia.org/wikipedia/commons/e/ec/Vancouver_Skytrain_and_Seabus_Map.svg",
  "https://upload.wikimedia.org/wikipedia/commons/3/34/Vancouver_SkyTrain_Map.svg"
];

let __WIKI_READY__ = false;
let __WIKI_VIEWBOX__ = "0 0 1150 555";
let __POS__ = {}; // name -> {x,y}
let __RETRY_COUNT__ = 0;
const MAX_RETRIES = 2;

const NORM = s => s.normalize('NFKC').replace(/[–—]/g,"-").replace(/\s+/g," ").trim().toLowerCase();

// מיפוי מורחב של שמות תחנות עם וריאציות נוספות
const STATION_ALIASES = new Map([
  // מיקוד על שמות קצרים יותר
  ["waterfront", "Waterfront"],
  ["burrard", "Burrard"],
  ["granville", "Granville"],
  ["stadium", "Stadium–Chinatown"],
  ["chinatown", "Stadium–Chinatown"],
  ["main street", "Main Street–Science World"],
  ["science world", "Main Street–Science World"],
  ["commercial", "Commercial–Broadway"],
  ["broadway", "Commercial–Broadway"],
  ["nanaimo", "Nanaimo"],
  ["29th", "29th Avenue"],
  ["joyce", "Joyce–Collingwood"],
  ["collingwood", "Joyce–Collingwood"],
  ["patterson", "Patterson"],
  ["metrotown", "Metrotown"],
  ["royal oak", "Royal Oak"],
  ["edmonds", "Edmonds"],
  ["22nd", "22nd Street"],
  ["new west", "New Westminster"],
  ["new westminster", "New Westminster"],
  ["columbia", "Columbia"],
  ["scott road", "Scott Road"],
  ["gateway", "Gateway"],
  ["surrey central", "Surrey Central"],
  ["king george", "King George"],
  ["sapperton", "Sapperton"],
  ["braid", "Braid"],
  ["lougheed", "Lougheed Town Centre"],
  ["production way", "Production Way–University"],
  ["university", "Production Way–University"],
  ["vcc", "VCC–Clark"],
  ["clark", "VCC–Clark"],
  ["renfrew", "Renfrew"],
  ["rupert", "Rupert"],
  ["gilmore", "Gilmore"],
  ["brentwood", "Brentwood Town Centre"],
  ["holdom", "Holdom"],
  ["sperling", "Sperling–Burnaby Lake"],
  ["burnaby lake", "Sperling–Burnaby Lake"],
  ["lake city", "Lake City Way"],
  ["burquitlam", "Burquitlam"],
  ["moody", "Moody Centre"],
  ["inlet", "Inlet Centre"],
  ["coquitlam", "Coquitlam Central"],
  ["lincoln", "Lincoln"],
  ["lafarge", "Lafarge Lake–Douglas"],
  ["douglas", "Lafarge Lake–Douglas"],
  ["city centre", "Vancouver City Centre"],
  ["vancouver", "Vancouver City Centre"],
  ["yaletown", "Yaletown–Roundhouse"],
  ["roundhouse", "Yaletown–Roundhouse"],
  ["olympic", "Olympic Village"],
  ["village", "Olympic Village"],
  ["city hall", "Broadway–City Hall"],
  ["king edward", "King Edward"],
  ["oakridge", "Oakridge–41st Avenue"],
  ["41st", "Oakridge–41st Avenue"],
  ["langara", "Langara–49th Avenue"],
  ["49th", "Langara–49th Avenue"],
  ["marine", "Marine Drive"],
  ["bridgeport", "Bridgeport"],
  ["templeton", "Templeton"],
  ["sea island", "Sea Island Centre"],
  ["airport", "YVR–Airport"],
  ["yvr", "YVR–Airport"],
  ["aberdeen", "Aberdeen"],
  ["lansdowne", "Lansdowne"],
  ["richmond", "Richmond–Brighouse"],
  ["brighouse", "Richmond–Brighouse"]
]);

// קואורדינטות מתוקנות על בסיס ניתוח חזותי של המפה הנראית בתמונה
const ACCURATE_POSITIONS = {
  // ====== EXPO LINE ====== (קו כחול כהה)
  // מסלול מרכזי: Waterfront -> Columbia  
  "Waterfront": { x: 350, y: 200 },
  "Burrard": { x: 320, y: 220 },  
  "Granville": { x: 290, y: 240 },
  "Stadium–Chinatown": { x: 380, y: 260 },
  "Main Street–Science World": { x: 420, y: 280 },
  "Commercial–Broadway": { x: 500, y: 310 }, // תחנת החלפה מרכזית
  "Nanaimo": { x: 560, y: 340 },
  "29th Avenue": { x: 600, y: 360 },
  "Joyce–Collingwood": { x: 650, y: 380 },
  "Patterson": { x: 700, y: 400 },
  "Metrotown": { x: 750, y: 420 },
  "Royal Oak": { x: 800, y: 440 },
  "Edmonds": { x: 850, y: 460 },
  "22nd Street": { x: 900, y: 480 },
  "New Westminster": { x: 950, y: 500 },
  "Columbia": { x: 1000, y: 520 },

  // ענף דרומי: Columbia -> King George (בצד הימני התחתון)
  "Scott Road": { x: 1050, y: 480 },
  "Gateway": { x: 1100, y: 440 },
  "Surrey Central": { x: 1150, y: 400 },
  "King George": { x: 1200, y: 360 },

  // ענף צפון-מזרחי: Columbia -> Production Way (בצד הימני העליון)
  "Sapperton": { x: 1020, y: 500 },
  "Braid": { x: 1040, y: 480 },
  "Lougheed Town Centre": { x: 1080, y: 460 },
  "Production Way–University": { x: 1120, y: 440 },

  // ====== CANADA LINE ====== (קו כחול בהיר - בצד שמאל)
  "Vancouver City Centre": { x: 320, y: 180 },
  "Yaletown–Roundhouse": { x: 300, y: 210 },
  "Olympic Village": { x: 280, y: 250 },
  "Broadway–City Hall": { x: 260, y: 290 },
  "King Edward": { x: 240, y: 330 },
  "Oakridge–41st Avenue": { x: 220, y: 370 },
  "Langara–49th Avenue": { x: 200, y: 410 },
  "Marine Drive": { x: 180, y: 450 },
  "Bridgeport": { x: 160, y: 490 },

  // ענף מערבי: לנמל התעופה (שמאל למטה)
  "Templeton": { x: 140, y: 510 },
  "Sea Island Centre": { x: 120, y: 530 },
  "YVR–Airport": { x: 100, y: 550 },

  // ענף דרומי: לריצ'מונד (מרכז למטה)  
  "Aberdeen": { x: 180, y: 510 },
  "Lansdowne": { x: 200, y: 530 },
  "Richmond–Brighouse": { x: 220, y: 550 },

  // ====== MILLENNIUM LINE ====== (קו צהוב - חלק עליון)
  "VCC–Clark": { x: 450, y: 250 },
  // Commercial–Broadway משותף - כבר מוגדר למעלה

  // מסלול מזרחי: Commercial-Broadway -> Production Way (חלק עליון)
  "Renfrew": { x: 540, y: 290 },
  "Rupert": { x: 580, y: 270 },
  "Gilmore": { x: 620, y: 250 },
  "Brentwood Town Centre": { x: 660, y: 230 },
  "Holdom": { x: 700, y: 210 },
  "Sperling–Burnaby Lake": { x: 740, y: 190 },
  "Lake City Way": { x: 780, y: 170 },
  // Production Way–University משותף - כבר מוגדר
  
  // המשך מזרחה: Lougheed -> Lafarge Lake (קו צהוב מזרחי עליון)
  "Burquitlam": { x: 1160, y: 420 },
  "Moody Centre": { x: 1200, y: 400 },
  "Inlet Centre": { x: 1240, y: 380 },
  "Coquitlam Central": { x: 1280, y: 360 },
  "Lincoln": { x: 1320, y: 340 },
  "Lafarge Lake–Douglas": { x: 1360, y: 320 }
};

async function fetchTextWithFallback(urls){
  let lastErr;
  for (const url of urls){
    try{
      console.log(`Trying to fetch SVG from: ${url}`);
      const res = await fetch(url, { 
        mode: "cors", 
        cache: "force-cache",
        headers: {
          'Accept': 'image/svg+xml, text/xml, application/xml, text/plain, */*'
        }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const txt = await res.text();
      console.log(`Successfully fetched SVG (${txt.length} chars)`);
      return { txt, url };
    }catch(e){ 
      lastErr = e; 
      console.warn(`SVG fetch failed for ${url}:`, e.message); 
    }
  }
  throw lastErr || new Error("Failed to fetch any SVG");
}

function findStationPositions(svgElement) {
  const positions = {};
  const wantedStations = new Set(ALL_STOPS);
  
  console.log('Starting enhanced station position extraction...');
  
  // אסטרטגיה 1: חיפוש כל טקסטים וכותרות
  const allTextElements = svgElement.querySelectorAll('text, tspan, title, desc, #text');
  console.log(`Found ${allTextElements.length} text-like elements`);
  
  // רשימה מורחבת של מילות מפתח לשמות תחנות
  const STATION_KEYWORDS = new Set([
    'waterfront', 'burrard', 'granville', 'stadium', 'chinatown', 'main', 'science', 'world',
    'commercial', 'broadway', 'nanaimo', '29th', 'avenue', 'joyce', 'collingwood', 'patterson',
    'metrotown', 'royal', 'oak', 'edmonds', '22nd', 'street', 'new', 'westminster', 'columbia',
    'scott', 'road', 'gateway', 'surrey', 'central', 'king', 'george', 'sapperton', 'braid',
    'lougheed', 'town', 'centre', 'production', 'way', 'university', 'vcc', 'clark', 'renfrew',
    'rupert', 'gilmore', 'brentwood', 'holdom', 'sperling', 'burnaby', 'lake', 'city',
    'burquitlam', 'moody', 'inlet', 'coquitlam', 'lincoln', 'lafarge', 'douglas', 'vancouver',
    'yaletown', 'roundhouse', 'olympic', 'village', 'hall', 'edward', 'oakridge', '41st',
    'langara', '49th', 'marine', 'drive', 'bridgeport', 'templeton', 'sea', 'island', 'yvr',
    'airport', 'aberdeen', 'lansdowne', 'richmond', 'brighouse'
  ]);
  
  for (const textEl of allTextElements) {
    const textContent = (textEl.textContent || '').trim();
    if (!textContent || textContent.length > 100) continue;
    
    // בדיקה אם הטקסט מכיל מילות מפתח של תחנות
    const normalizedText = NORM(textContent);
    const hasStationKeyword = normalizedText.split(/\s+/).some(word => STATION_KEYWORDS.has(word));
    
    if (!hasStationKeyword) continue;
    
    // ניסוי התאמה ישירה
    let stationName = STATION_ALIASES.get(normalizedText);
    
    // חיפוש חלקי משופר
    if (!stationName) {
      for (const [alias, fullName] of STATION_ALIASES.entries()) {
        if (normalizedText.includes(alias) && Math.abs(alias.length - normalizedText.length) <= 8) {
          stationName = fullName;
          break;
        }
      }
    }
    
    // חיפוש במילים נפרדות
    if (!stationName) {
      const words = normalizedText.split(/\s+/);
      for (const station of wantedStations) {
        const stationWords = NORM(station).split(/\s+/);
        const commonWords = words.filter(w => stationWords.some(sw => sw.includes(w) || w.includes(sw)));
        if (commonWords.length >= Math.min(2, stationWords.length)) {
          stationName = station;
          break;
        }
      }
    }
    
    if (stationName && wantedStations.has(stationName) && !positions[stationName]) {
      let x = parseFloat(textEl.getAttribute('x') || '0');
      let y = parseFloat(textEl.getAttribute('y') || '0');
      
      // חיפוש בהורים
      if (x === 0 && y === 0) {
        let parent = textEl.parentElement;
        let depth = 0;
        while (parent && (x === 0 || y === 0) && depth < 5) {
          x = parseFloat(parent.getAttribute('x') || x);
          y = parseFloat(parent.getAttribute('y') || y);
          
          // ניתוח transform
          const transform = parent.getAttribute('transform');
          if (transform) {
            const translateMatch = transform.match(/translate\s*\(\s*([^,\s)]+)[\s,]+([^)]+)\s*\)/);
            if (translateMatch) {
              x += parseFloat(translateMatch[1]) || 0;
              y += parseFloat(translateMatch[2]) || 0;
            }
            const matrixMatch = transform.match(/matrix\s*\(\s*[^,\s)]+[\s,]+[^,\s)]+[\s,]+[^,\s)]+[\s,]+[^,\s)]+[\s,]+([^,\s)]+)[\s,]+([^)]+)\s*\)/);
            if (matrixMatch) {
              x += parseFloat(matrixMatch[1]) || 0;
              y += parseFloat(matrixMatch[2]) || 0;
            }
          }
          
          parent = parent.parentElement;
          depth++;
          if (parent === svgElement) break;
        }
      }
      
      // גיבוי: getBBox
      if ((x === 0 && y === 0) || isNaN(x) || isNaN(y)) {
        try {
          const bbox = textEl.getBBox();
          if (bbox.width > 0 && bbox.height > 0) {
            x = bbox.x + bbox.width / 2;
            y = bbox.y + bbox.height / 2;
          }
        } catch (e) {
          continue;
        }
      }
      
      if (x > 0 && y > 0 && isFinite(x) && isFinite(y)) {
        positions[stationName] = { x, y };
        console.log(`✓ Found "${stationName}" at (${x.toFixed(1)}, ${y.toFixed(1)}) via enhanced text analysis`);
      }
    }
  }
  
  // אסטרטגיה 2: חיפוש נתונים גאומטריים (עיגולים, נקודות)
  const geometricElements = svgElement.querySelectorAll('circle, ellipse, rect[width="8"], rect[height="8"], use, symbol');
  console.log(`Found ${geometricElements.length} geometric elements for station markers`);
  
  for (const element of geometricElements) {
    let cx = parseFloat(element.getAttribute('cx') || element.getAttribute('x') || '0');
    let cy = parseFloat(element.getAttribute('cy') || element.getAttribute('y') || '0');
    
    // בדיקת תקינות הקואורדינטות
    if (isNaN(cx) || isNaN(cy) || cx <= 5 || cy <= 5 || cx > 1200 || cy > 600) continue;
    
    // חיפוש טקסט קרוב או כותרות
    let associatedText = '';
    
    // בדיקה בהורה הישיר
    const parent = element.closest('g, a, svg');
    if (parent) {
      const nearbyText = parent.querySelector('text, title, desc');
      if (nearbyText) associatedText = nearbyText.textContent || '';
      
      // בדיקה בתגובות id או class
      const id = parent.id || element.id || '';
      const className = parent.className?.baseVal || element.className?.baseVal || '';
      if (id || className) associatedText = `${associatedText} ${id} ${className}`.trim();
    }
    
    // חיפוש טקסט בקרבה גאומטרית
    if (!associatedText) {
      const nearbyTexts = svgElement.querySelectorAll('text, tspan');
      for (const textEl of nearbyTexts) {
        const tx = parseFloat(textEl.getAttribute('x') || '0');
        const ty = parseFloat(textEl.getAttribute('y') || '0');
        const distance = Math.sqrt((tx - cx) ** 2 + (ty - cy) ** 2);
        if (distance < 40) { // רדיוס חיפוש של 40 יחידות
          associatedText = textEl.textContent || '';
          break;
        }
      }
    }
    
    if (associatedText) {
      const normalized = NORM(associatedText);
      const stationName = STATION_ALIASES.get(normalized) || 
                         [...wantedStations].find(s => NORM(s).includes(normalized) || normalized.includes(NORM(s)));
      
      if (stationName && wantedStations.has(stationName) && !positions[stationName]) {
        positions[stationName] = { x: cx, y: cy };
        console.log(`✓ Found "${stationName}" at (${cx.toFixed(1)}, ${cy.toFixed(1)}) via geometric analysis`);
      }
    }
  }
  
  return positions;
}

async function loadWikiMapOnce(){
  if (__WIKI_READY__) return;

  const holder = document.getElementById("wikiSvgHolder");
  holder.innerHTML = '<div class="w-full h-full grid place-items-center text-sm text-slate-600">טוען מפה…</div>';

  // מניעת נסיונות אין-סופיים
  if (__RETRY_COUNT__ >= MAX_RETRIES) {
    console.warn("Max retries reached, using accurate fallback positions");
    holder.innerHTML = `<img src="${WIKI_SVG_URLS[0]}" alt="SkyTrain Map" style="width:100%;height:100%;object-fit:contain;" crossorigin="anonymous" onerror="this.style.display='none'">`;
    __POS__ = { ...ACCURATE_POSITIONS };
    __WIKI_READY__ = true;
    return;
  }

  let txt, baseSvg, usedUrl;

  try {
    const r = await fetchTextWithFallback(WIKI_SVG_URLS);
    txt = r.txt;
    usedUrl = r.url;
  } catch(e) {
    console.error("Error fetching SVG:", e);
    __RETRY_COUNT__++;
    holder.innerHTML = `<img src="${WIKI_SVG_URLS[0]}" alt="SkyTrain Map" style="width:100%;height:100%;object-fit:contain;" crossorigin="anonymous" onerror="this.style.display='none'">`;
    __POS__ = { ...ACCURATE_POSITIONS };
    __WIKI_READY__ = true;
    return;
  }

  // ניתוח SVG
  try{
    const doc = new DOMParser().parseFromString(txt, "image/svg+xml");
    baseSvg = doc.documentElement;
    
    const parseError = doc.querySelector('parsererror');
    if (parseError || !baseSvg || baseSvg.nodeName.toLowerCase() !== "svg") {
      throw new Error("SVG parsing failed or invalid SVG structure");
    }
    
    // הכנסת SVG לעמוד
    holder.innerHTML = "";
    baseSvg.removeAttribute("width");
    baseSvg.removeAttribute("height");
    baseSvg.style.width = "100%";
    baseSvg.style.height = "100%";
    baseSvg.style.display = "block";
    holder.appendChild(baseSvg);
    
    console.log("✓ Successfully inserted SVG into DOM");
    
  }catch(parseErr){
    console.error("SVG parsing failed:", parseErr);
    __RETRY_COUNT__++;
    holder.innerHTML = `<img src="${usedUrl || WIKI_SVG_URLS[0]}" alt="SkyTrain Map" style="width:100%;height:100%;object-fit:contain;" crossorigin="anonymous" onerror="this.style.display='none'">`;
    __POS__ = { ...ACCURATE_POSITIONS };
    __WIKI_READY__ = true;
    return;
  }

  // הגדרת viewBox לשכבת ההדגשה
  const vb = baseSvg.getAttribute("viewBox") || "0 0 1150 555";
  __WIKI_VIEWBOX__ = vb;
  overlay.setAttribute("viewBox", vb);
  overlay.innerHTML = "";

  // חילוץ מיקומי תחנות
  const positions = findStationPositions(baseSvg);
  
  // הוספת מיקומים מדויקים למפה למקרה שלא נמצאו
  const missingStations = ALL_STOPS.filter(station => !positions[station]);
  console.log(`Found ${Object.keys(positions).length} stations from SVG, ${missingStations.length} missing`);
  
  for (const station of missingStations) {
    if (ACCURATE_POSITIONS[station]) {
      positions[station] = ACCURATE_POSITIONS[station];
      console.log(`⚠ Using accurate fallback for "${station}"`);
    }
  }

  __POS__ = positions;
  __WIKI_READY__ = true;

  const foundCount = Object.keys(positions).length;
  console.log(`🎉 Map loading complete: ${foundCount}/${ALL_STOPS.length} stations positioned from ${usedUrl}`);
}

/* ===== ציור/ניקוי הדגשה מתוקן ===== */
function clearOverlay(){ 
  overlay.innerHTML = ""; 
}

function drawHighlightedTrip(trip){
  if (!trip || !__WIKI_READY__) {
    console.warn('❌ Cannot draw trip: missing trip data or map not ready');
    return;
  }
  
  console.log(`🎨 Drawing route: ${trip.type} with ${trip.legs.length} legs, total time: ${trip.totalTime} min`);
  clearOverlay(); 
  
  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  g.setAttribute("class", "route-highlight");
  overlay.appendChild(g);

  // הוספת רקע לבדיקה (יוסר אחרי הבדיקה)
  const debugRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  debugRect.setAttribute("x", "0");
  debugRect.setAttribute("y", "0");
  debugRect.setAttribute("width", "100");
  debugRect.setAttribute("height", "50");
  debugRect.setAttribute("fill", "rgba(255, 0, 0, 0.3)");
  debugRect.setAttribute("stroke", "red");
  debugRect.setAttribute("stroke-width", "2");
  g.appendChild(debugRect);
  
  const debugText = document.createElementNS("http://www.w3.org/2000/svg", "text");
  debugText.setAttribute("x", "10");
  debugText.setAttribute("y", "30");
  debugText.setAttribute("fill", "red");
  debugText.setAttribute("font-size", "14");
  debugText.setAttribute("font-weight", "bold");
  debugText.textContent = "TEST OVERLAY";
  g.appendChild(debugText);

  let drawnSegments = 0;
  let totalStations = 0;
  
  for (const [legIndex, leg] of trip.legs.entries()) {
    console.log(`🔄 Processing leg ${legIndex + 1}/${trip.legs.length}: ${leg.from} → ${leg.to} on ${leg.line}`);
    console.log(`   Path: [${leg.path.join(' → ')}]`);
    
    if (!leg.path || leg.path.length < 2) {
      console.warn(`   ❌ Invalid path length: ${leg.path?.length || 0}`);
      continue;
    }
    
    const validPoints = [];
    const missingStations = [];
    
    for (const [stopIndex, stop] of leg.path.entries()) {
      const pos = __POS__[stop];
      if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y) && pos.x > 0 && pos.y > 0) {
        validPoints.push({...pos, station: stop, index: stopIndex});
        console.log(`     ${stopIndex + 1}. ${stop}: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}) ✅`);
      } else {
        missingStations.push(stop);
        console.warn(`     ${stopIndex + 1}. ${stop}: MISSING/INVALID POSITION ❌`, pos);
      }
    }
    
    if (missingStations.length > 0) {
      console.warn(`   ⚠ Missing ${missingStations.length} stations: [${missingStations.join(', ')}]`);
    }
    
    if (validPoints.length < 2) {
      console.warn(`   ❌ Insufficient valid points: ${validPoints.length}/2 minimum required`);
      continue;
    }

    // יצירת נתיב SVG עם נקודות בדיקה
    for (const [i, point] of validPoints.entries()) {
      // נקודה לבדיקת מיקום
      const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      dot.setAttribute("cx", point.x);
      dot.setAttribute("cy", point.y);
      dot.setAttribute("r", "3");
      dot.setAttribute("fill", i === 0 ? "lime" : i === validPoints.length - 1 ? "red" : "orange");
      dot.setAttribute("stroke", "white");
      dot.setAttribute("stroke-width", "1");
      g.appendChild(dot);
      
      // תווית תחנה
      const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
      label.setAttribute("x", point.x + 5);
      label.setAttribute("y", point.y - 5);
      label.setAttribute("fill", "black");
      label.setAttribute("font-size", "8");
      label.setAttribute("font-weight", "bold");
      label.textContent = point.station.split('–')[0];
      g.appendChild(label);
    }

    const pathCommands = validPoints.map((p, i) => 
      i === 0 ? `M${p.x.toFixed(1)},${p.y.toFixed(1)}` : `L${p.x.toFixed(1)},${p.y.toFixed(1)}`
    );
    const d = pathCommands.join(' ');
    
    console.log(`   📝 SVG path: ${d.substring(0, 150)}${d.length > 150 ? '...' : ''}`);
    
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", leg.color);
    path.setAttribute("stroke-width", "4");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    path.setAttribute("opacity", "0.8");
    
    if (legIndex > 0) {
      path.setAttribute("stroke-dasharray", "8,4");
      path.setAttribute("stroke-width", "3");
    }
    
    g.appendChild(path);
    
    drawnSegments++;
    totalStations += validPoints.length;
    console.log(`   ✅ Successfully drew leg ${legIndex + 1}: ${validPoints.length} stations connected`);
  }
  
  if (drawnSegments === 0) {
    console.error('❌ Failed to draw any route segments');
    const errorMsg = document.createElementNS("http://www.w3.org/2000/svg", "text");
    errorMsg.setAttribute("x", "200");
    errorMsg.setAttribute("y", "100");
    errorMsg.setAttribute("fill", "red");
    errorMsg.setAttribute("font-size", "16");
    errorMsg.setAttribute("font-weight", "bold");
    errorMsg.textContent = "ERROR: No valid route segments";
    g.appendChild(errorMsg);
  } else {
    console.log(`🎉 Route highlighting complete: ${drawnSegments}/${trip.legs.length} segments drawn, ${totalStations} total stations`);
  }
  
  // הדפסת מידע על המפה ו-overlay
  console.log(`🗺 Map info:`);
  console.log(`   SVG viewBox: ${__WIKI_VIEWBOX__}`);
  console.log(`   Overlay viewBox: ${overlay.getAttribute('viewBox')}`);
  console.log(`   Map container size: ${document.getElementById('wikiSvgHolder').offsetWidth}x${document.getElementById('wikiSvgHolder').offsetHeight}`);
}

/* ===== אירועים ===== */
document.getElementById('tripForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const from=fromSel.value, to=toSel.value;
  if (from===to){ 
    resultsEl.innerHTML=`<p class="text-sm text-red-600">בחר/י מוצא ויעד שונים.</p>`; 
    return; 
  }
  console.log(`Planning route from "${from}" to "${to}"`);
  const dep = minutesFromDateTimeInputs();
  const list = planCandidates(from,to,dep);
  lastTrips = list;
  console.log('Found route candidates:', list.length);
  renderResults(list);
  await loadWikiMapOnce();
  clearOverlay();
});

document.getElementById('swapBtn').addEventListener('click', ()=>{
  const a=fromSel.value, b=toSel.value; 
  fromSel.value=b; toSel.value=a;
  console.log(`Swapped: ${a} ↔ ${b}`);
});

favBtn.addEventListener('click', ()=>{ 
  saveFav(fromSel.value, toSel.value); 
  console.log(`Saved favorite: ${fromSel.value} → ${toSel.value}`);
});

btnShowOnMap?.addEventListener('click', async ()=>{
  if (!lastTrips.length) {
    console.warn('No trips to show on map');
    return;
  }
  console.log('Showing first trip on map');
  await loadWikiMapOnce(); 
  clearOverlay(); 
  drawHighlightedTrip(lastTrips[0]);
});

btnResetMap?.addEventListener('click', ()=>{ 
  console.log('Resetting map display');
  clearOverlay(); 
});

/* ===== אתחול ===== */
populateStops(); 
loadFavs();
console.log('🚇 SkyTrain MVP initialized with enhanced route planning and map display');
