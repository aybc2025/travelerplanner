/* ===========================================================
   SkyTrain MVP (Expo, Millennium, Canada) — גרסה מלאה
   - מסלולים: גרף, עד 2 החלפות, headway+שעות שירות
   - מפה סכמטית: טעינת SVG מוויקיפדיה, חילוץ x,y לכל תחנה, הדגשת מסלול
   - Fallback: <img> תמידית אם ה-SVG לא מוצג
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

/* ===== תכנון מסלולים ===== */
const LINES_ORDER = ["EXPO","MILL","CAN"];
const TRANSFER_MIN = 3;

function shortestOnLine(lineId, from, to){
  if (!LINE_STOPS[lineId].has(from) || !LINE_STOPS[lineId].has(to)) return null;
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
  const cands = [];
  for (const L of LINES_ORDER){
    const seg = shortestOnLine(L, from, to);
    if (seg){
      const d1=scheduleDeparture(L,depMins); if (d1==null) continue;
      const a1=d1+seg.mins;
      cands.push({ type:"DIRECT", transfers:0, depart:d1, arrive:a1,
        legs:[{ line:LINE_META[L].name, lineId:L, color:LINE_META[L].color, from, to, depart:d1, arrive:a1, path:seg.path }]});
    }
  }
  for (const L1 of LINES_ORDER){
    for (const L2 of LINES_ORDER){
      if (L1===L2) continue;
      for (const hub of intersection(LINE_STOPS[L1], LINE_STOPS[L2])){
        if (!TRANSFER_HUBS.has(hub)) continue;
        const seg1=shortestOnLine(L1,from,hub), seg2=shortestOnLine(L2,hub,to);
        if (!seg1||!seg2) continue;
        const d1=scheduleDeparture(L1,depMins); if (d1==null) continue;
        const a1=d1+seg1.mins;
        const d2=scheduleDeparture(L2,a1+TRANSFER_MIN); if (d2==null) continue;
        const a2=d2+seg2.mins;
        cands.push({ type:"TRANSFER1", transfers:1, depart:d1, arrive:a2,
          legs:[
            { line:LINE_META[L1].name, lineId:L1, color:LINE_META[L1].color, from, to:hub, depart:d1, arrive:a1, path:seg1.path },
            { line:LINE_META[L2].name, lineId:L2, color:LINE_META[L2].color, from:hub, to, depart:d2, arrive:a2, path:seg2.path }
          ]});
      }
    }
  }
  for (const L1 of LINES_ORDER){
    for (const L2 of LINES_ORDER){
      if (L1===L2) continue;
      for (const L3 of LINES_ORDER){
        if (L3===L1||L3===L2) continue;
        const inter12=intersection(LINE_STOPS[L1],LINE_STOPS[L2]);
        const inter23=intersection(LINE_STOPS[L2],LINE_STOPS[L3]);
        for (const h1 of inter12){
          if (!TRANSFER_HUBS.has(h1)) continue;
          const seg1=shortestOnLine(L1,from,h1); if (!seg1) continue;
          for (const h2 of inter23){
            if (!TRANSFER_HUBS.has(h2)) continue;
            const seg2=shortestOnLine(L2,h1,h2), seg3=shortestOnLine(L3,h2,to);
            if (!seg2||!seg3) continue;
            const d1=scheduleDeparture(L1,depMins); if (d1==null) continue;
            const a1=d1+seg1.mins;
            const d2=scheduleDeparture(L2,a1+TRANSFER_MIN); if (d2==null) continue;
            const a2=d2+seg2.mins;
            const d3=scheduleDeparture(L3,a2+TRANSFER_MIN); if (d3==null) continue;
            const a3=d3+seg3.mins;
            cands.push({ type:"TRANSFER2", transfers:2, depart:d1, arrive:a3,
              legs:[
                { line:LINE_META[L1].name, lineId:L1, color:LINE_META[L1].color, from, to:h1, depart:d1, arrive:a1, path:seg1.path },
                { line:LINE_META[L2].name, lineId:L2, color:LINE_META[L2].color, from:h1, to:h2, depart:d2, arrive:a2, path:seg2.path },
                { line:LINE_META[L3].name, lineId:L3, color:LINE_META[L3].color, from:h2, to, depart:d3, arrive:a3, path:seg3.path }
              ]});
          }
        }
      }
    }
  }
  const uniq=new Map();
  for (const r of cands){
    const key = `${r.legs.map(l=>l.lineId+':'+l.from+'>'+l.to).join('|')}-${r.depart}`;
    if (!uniq.has(key)) uniq.set(key,r);
  }
  return [...uniq.values()].sort((a,b)=>(a.arrive-b.arrive)||(a.transfers-b.transfers)).slice(0,3);
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
      await loadWikiMapOnce(); clearOverlay(); drawHighlightedTrip(lastTrips[idx]);
    });
    resultsEl.appendChild(el);
  });
}

/* ===== מפה: טעינת SVG מוויקיפדיה + חילוץ קואורדינטות ===== */
const WIKI_SVG_URLS = [
  "https://upload.wikimedia.org/wikipedia/commons/e/ec/Vancouver_Skytrain_and_Seabus_Map.svg",
  "https://upload.wikimedia.org/wikipedia/commons/3/34/Vancouver_SkyTrain_Map.svg"
];

let __WIKI_READY__ = false;
let __WIKI_VIEWBOX__ = "0 0 512 295";
let __POS__ = {}; // name -> {x,y}
let __RETRY_COUNT__ = 0;
const MAX_RETRIES = 2;

const NORM = s => s.normalize('NFKC').replace(/[–—]/g,"-").replace(/\s+/g," ").trim().toLowerCase();

// Enhanced station name mapping with more variations
const STATION_ALIASES = new Map([
  // Common variations
  ["production way–university", "Production Way–University"],
  ["production way/university",  "Production Way–University"],
  ["production way university",  "Production Way–University"],
  ["commercial–broadway", "Commercial–Broadway"],
  ["commercial broadway", "Commercial–Broadway"],
  ["vancouver city centre", "Vancouver City Centre"],
  ["vancouver city center", "Vancouver City Centre"],
  ["city centre", "Vancouver City Centre"],
  ["oakridge–41st avenue", "Oakridge–41st Avenue"],
  ["oakridge 41st avenue", "Oakridge–41st Avenue"],
  ["langara–49th avenue", "Langara–49th Avenue"],
  ["langara 49th avenue", "Langara–49th Avenue"],
  ["main street–science world", "Main Street–Science World"],
  ["main street science world", "Main Street–Science World"],
  ["yaletown–roundhouse", "Yaletown–Roundhouse"],
  ["yaletown roundhouse", "Yaletown–Roundhouse"],
  ["stadium–chinatown", "Stadium–Chinatown"],
  ["stadium chinatown", "Stadium–Chinatown"],
  ["joyce–collingwood", "Joyce–Collingwood"],
  ["joyce collingwood", "Joyce–Collingwood"],
  ["22nd street", "22nd Street"],
  ["29th avenue", "29th Avenue"],
  ["new westminster", "New Westminster"],
  ["king george", "King George"],
  ["surrey central", "Surrey Central"],
  ["scott road", "Scott Road"],
  ["royal oak", "Royal Oak"],
  ["lougheed town centre", "Lougheed Town Centre"],
  ["brentwood town centre", "Brentwood Town Centre"],
  ["sperling–burnaby lake", "Sperling–Burnaby Lake"],
  ["lake city way", "Lake City Way"],
  ["moody centre", "Moody Centre"],
  ["inlet centre", "Inlet Centre"],
  ["coquitlam central", "Coquitlam Central"],
  ["lafarge lake–douglas", "Lafarge Lake–Douglas"],
  ["broadway–city hall", "Broadway–City Hall"],
  ["king edward", "King Edward"],
  ["marine drive", "Marine Drive"],
  ["sea island centre", "Sea Island Centre"],
  ["yvr–airport", "YVR–Airport"],
  ["richmond–brighouse", "Richmond–Brighouse"],
  ["olympic village", "Olympic Village"],
  ["vcc–clark", "VCC–Clark"]
]);

// Fallback coordinates for major stations if SVG parsing fails
const FALLBACK_POSITIONS = {
  "Waterfront": { x: 150, y: 120 },
  "Burrard": { x: 180, y: 130 },
  "Granville": { x: 190, y: 140 },
  "Stadium–Chinatown": { x: 210, y: 150 },
  "Main Street–Science World": { x: 230, y: 160 },
  "Commercial–Broadway": { x: 280, y: 170 },
  "Nanaimo": { x: 320, y: 180 },
  "29th Avenue": { x: 340, y: 190 },
  "Joyce–Collingwood": { x: 370, y: 200 },
  "Patterson": { x: 390, y: 210 },
  "Metrotown": { x: 410, y: 220 },
  "Royal Oak": { x: 430, y: 230 },
  "Edmonds": { x: 450, y: 240 },
  "22nd Street": { x: 470, y: 250 },
  "New Westminster": { x: 490, y: 260 },
  "Columbia": { x: 510, y: 270 },
  "Vancouver City Centre": { x: 160, y: 140 },
  "Yaletown–Roundhouse": { x: 170, y: 155 },
  "Olympic Village": { x: 185, y: 170 },
  "Broadway–City Hall": { x: 200, y: 185 },
  "King Edward": { x: 215, y: 200 },
  "Oakridge–41st Avenue": { x: 230, y: 215 },
  "Langara–49th Avenue": { x: 245, y: 230 },
  "Marine Drive": { x: 260, y: 245 },
  "Bridgeport": { x: 275, y: 260 },
  "VCC–Clark": { x: 260, y: 150 },
  "Renfrew": { x: 300, y: 160 },
  "Rupert": { x: 320, y: 150 },
  "Production Way–University": { x: 400, y: 180 }
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
  
  // Strategy 1: Look for <text> elements that match station names
  const textElements = svgElement.querySelectorAll('text, tspan');
  console.log(`Found ${textElements.length} text elements`);
  
  for (const textEl of textElements) {
    const textContent = (textEl.textContent || '').trim();
    if (!textContent || textContent.length > 60) continue;
    
    // Try to match station names
    const normalizedText = NORM(textContent);
    let stationName = null;
    
    // Direct match
    for (const station of wantedStations) {
      if (NORM(station) === normalizedText) {
        stationName = station;
        break;
      }
    }
    
    // Alias match
    if (!stationName) {
      stationName = STATION_ALIASES.get(normalizedText);
    }
    
    // Partial match for complex names
    if (!stationName) {
      for (const station of wantedStations) {
        const stationNorm = NORM(station);
        if (stationNorm.includes(normalizedText) || normalizedText.includes(stationNorm)) {
          // Check if it's a reasonable partial match (not too generic)
          if (normalizedText.length > 4 && Math.abs(stationNorm.length - normalizedText.length) < 10) {
            stationName = station;
            break;
          }
        }
      }
    }
    
    if (stationName && !positions[stationName]) {
      // Get position from text element
      let x = parseFloat(textEl.getAttribute('x') || '0');
      let y = parseFloat(textEl.getAttribute('y') || '0');
      
      // If coordinates are 0, try to get from parent or use bounding box
      if ((x === 0 && y === 0) || isNaN(x) || isNaN(y)) {
        try {
          const bbox = textEl.getBBox();
          x = bbox.x + bbox.width / 2;
          y = bbox.y + bbox.height / 2;
        } catch (e) {
          // getBBox might fail, skip this element
          continue;
        }
      }
      
      if (x > 0 && y > 0) {
        positions[stationName] = { x, y };
        console.log(`Found station "${stationName}" at (${x.toFixed(1)}, ${y.toFixed(1)}) via text`);
      }
    }
  }
  
  // Strategy 2: Look for <circle> elements and associate with nearby text
  const circles = svgElement.querySelectorAll('circle');
  console.log(`Found ${circles.length} circle elements`);
  
  for (const circle of circles) {
    const cx = parseFloat(circle.getAttribute('cx') || '0');
    const cy = parseFloat(circle.getAttribute('cy') || '0');
    const r = parseFloat(circle.getAttribute('r') || '0');
    
    if (isNaN(cx) || isNaN(cy) || cx === 0 || cy === 0 || r < 2 || r > 15) continue;
    
    // Check if circle is inside an <a> element with title
    let linkParent = circle.closest('a');
    if (linkParent) {
      const title = linkParent.getAttribute('title') || linkParent.getAttribute('xlink:title') || '';
      if (title) {
        let cleanTitle = title.replace(/\s+station\b/i, '').replace(/\s+stn\b/i, '').trim();
        const stationName = STATION_ALIASES.get(NORM(cleanTitle)) || 
                          [...wantedStations].find(s => NORM(s) === NORM(cleanTitle));
        
        if (stationName && !positions[stationName]) {
          positions[stationName] = { x: cx, y: cy };
          console.log(`Found station "${stationName}" at (${cx.toFixed(1)}, ${cy.toFixed(1)}) via circle+link`);
        }
      }
    }
    
    // Find nearest text element to this circle
    let nearestText = null;
    let nearestDistance = Infinity;
    
    for (const textEl of textElements) {
      let tx = parseFloat(textEl.getAttribute('x') || '0');
      let ty = parseFloat(textEl.getAttribute('y') || '0');
      
      if (tx === 0 && ty === 0) {
        try {
          const bbox = textEl.getBBox();
          tx = bbox.x + bbox.width / 2;
          ty = bbox.y + bbox.height / 2;
        } catch (e) {
          continue;
        }
      }
      
      const distance = Math.sqrt((tx - cx) ** 2 + (ty - cy) ** 2);
      if (distance < 50 && distance < nearestDistance) { // Within 50 units
        nearestDistance = distance;
        nearestText = textEl;
      }
    }
    
    if (nearestText) {
      const textContent = (nearestText.textContent || '').trim();
      const normalizedText = NORM(textContent);
      const stationName = STATION_ALIASES.get(normalizedText) || 
                         [...wantedStations].find(s => NORM(s) === normalizedText);
      
      if (stationName && !positions[stationName]) {
        positions[stationName] = { x: cx, y: cy };
        console.log(`Found station "${stationName}" at (${cx.toFixed(1)}, ${cy.toFixed(1)}) via circle+neartext`);
      }
    }
  }
  
  return positions;
}

async function loadWikiMapOnce(){
  if (__WIKI_READY__) return;

  const holder = document.getElementById("wikiSvgHolder");
  holder.innerHTML = '<div class="w-full h-full grid place-items-center text-sm text-slate-600">טוען מפה…</div>';

  let txt, baseSvg;
  let usedUrl = null;

  // Prevent infinite retries
  if (__RETRY_COUNT__ >= MAX_RETRIES) {
    console.warn("Max retries reached, using fallback image");
    holder.innerHTML = `<img src="${WIKI_SVG_URLS[0]}" alt="SkyTrain Map" style="width:100%;height:100%;object-fit:contain;" crossorigin="anonymous">`;
    __POS__ = { ...FALLBACK_POSITIONS };
    __WIKI_READY__ = true;
    return;
  }

  try {
    const r = await fetchTextWithFallback(WIKI_SVG_URLS);
    txt = r.txt;
    usedUrl = r.url;
  } catch(e) {
    console.error("Error fetching SVG:", e);
    __RETRY_COUNT__++;
    holder.innerHTML = `<img src="${WIKI_SVG_URLS[0]}" alt="SkyTrain Map" style="width:100%;height:100%;object-fit:contain;" crossorigin="anonymous">`;
    __POS__ = { ...FALLBACK_POSITIONS };
    __WIKI_READY__ = true;
    return;
  }

  // Parse SVG using DOMParser
  try{
    const doc = new DOMParser().parseFromString(txt, "image/svg+xml");
    baseSvg = doc.documentElement;
    
    // Check for parsing errors
    const parseError = doc.querySelector('parsererror');
    if (parseError || !baseSvg || baseSvg.nodeName.toLowerCase() !== "svg") {
      throw new Error("SVG parsing failed or invalid SVG structure");
    }
    
    // Clear and insert the SVG
    holder.innerHTML = "";
    baseSvg.removeAttribute("width");
    baseSvg.removeAttribute("height");
    baseSvg.style.width = "100%";
    baseSvg.style.height = "100%";
    baseSvg.style.display = "block";
    holder.appendChild(baseSvg);
    
    console.log("Successfully inserted SVG into DOM");
    
  }catch(parseErr){
    console.error("SVG parsing failed:", parseErr);
    __RETRY_COUNT__++;
    holder.innerHTML = `<img src="${usedUrl || WIKI_SVG_URLS[0]}" alt="SkyTrain Map" style="width:100%;height:100%;object-fit:contain;" crossorigin="anonymous">`;
    __POS__ = { ...FALLBACK_POSITIONS };
    __WIKI_READY__ = true;
    return;
  }

  // Set up overlay viewBox
  const vb = baseSvg.getAttribute("viewBox") || __WIKI_VIEWBOX__;
  __WIKI_VIEWBOX__ = vb;
  overlay.setAttribute("viewBox", vb);
  overlay.innerHTML = "";

  // Extract station positions
  const positions = findStationPositions(baseSvg);
  
  // Add fallback positions for missing stations
  const missingStations = ALL_STOPS.filter(station => !positions[station]);
  if (missingStations.length > 0) {
    console.log("Missing stations, adding fallbacks:", missingStations);
    for (const station of missingStations) {
      if (FALLBACK_POSITIONS[station]) {
        positions[station] = FALLBACK_POSITIONS[station];
      }
    }
  }

  __POS__ = positions;
  __WIKI_READY__ = true;

  const foundCount = Object.keys(positions).length;
  console.log(`Map loading complete: ${foundCount}/${ALL_STOPS.length} stations positioned from ${usedUrl}`);
  
  // If we still don't have enough positions, log a warning but continue
  if (foundCount < ALL_STOPS.length * 0.5) {
    console.warn(`Only found ${foundCount} out of ${ALL_STOPS.length} stations. Route highlighting may be limited.`);
  }
}

/* ===== ציור/ניקוי הדגשה ===== */
function clearOverlay(){ 
  overlay.innerHTML = ""; 
}

function drawHighlightedTrip(trip){
  if (!trip || !__WIKI_READY__) return;
  
  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  g.setAttribute("class", "route-highlight");
  overlay.appendChild(g);

  let drawnSegments = 0;
  
  for (const leg of trip.legs){
    const pts = [];
    for (const stop of leg.path){
      const p = __POS__[stop];
      if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) {
        pts.push(p);
      } else {
        console.warn(`Missing position for station: ${stop}`);
      }
    }
    
    if (pts.length < 2) {
      console.warn(`Insufficient points for leg ${leg.from} → ${leg.to}: ${pts.length} points`);
      continue;
    }

    const d = pts.map((p,i)=> (i ? `L${p.x.toFixed(1)},${p.y.toFixed(1)}` : `M${p.x.toFixed(1)},${p.y.toFixed(1)}`)).join('');
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", leg.color);
    path.setAttribute("stroke-width", "8");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    path.setAttribute("opacity", "0.9");
    g.appendChild(path);
    drawnSegments++;
    
    console.log(`Drew route segment: ${leg.from} → ${leg.to} (${pts.length} points)`);
  }
  
  console.log(`Route highlighting complete: ${drawnSegments} segments drawn`);
}

/* ===== אירועים ===== */
document.getElementById('tripForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const from=fromSel.value, to=toSel.value;
  if (from===to){ resultsEl.innerHTML=`<p class="text-sm text-red-600">בחר/י מוצא ויעד שונים.</p>`; return; }
  const dep = minutesFromDateTimeInputs();
  const list = planCandidates(from,to,dep);
  lastTrips = list;
  renderResults(list);
  await loadWikiMapOnce();
  clearOverlay();
});
document.getElementById('swapBtn').addEventListener('click', ()=>{
  const a=fromSel.value, b=toSel.value; fromSel.value=b; toSel.value=a;
});
favBtn.addEventListener('click', ()=>{ saveFav(fromSel.value, toSel.value); });
btnShowOnMap?.addEventListener('click', async ()=>{
  if (!lastTrips.length) return;
  await loadWikiMapOnce(); clearOverlay(); drawHighlightedTrip(lastTrips[0]);
});
btnResetMap?.addEventListener('click', ()=>{ clearOverlay(); });

/* ===== אתחול ===== */
populateStops(); loadFavs();
