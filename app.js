/* =========================
   MVP סטטי — SkyTrain בלבד
   =========================
   - מסלולים: גרף, עד 2 החלפות, headway+שעות
   - מפה סכמטית משופרת: Canada אנכי, Millennium צפונית ל-Expo, Expo מערב→מזרח,
     + מניעת חפיפת תוויות.
*/

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

/* עזרי זמן */
const pad2 = n => String(n).padStart(2,"0");
function toMinutes(hhmm){ const [h,m]=hhmm.split(":").map(Number); return h*60+m; }
function toMinutesWrap(hhmm){ const [h,m]=hhmm.split(":").map(Number); return ((h%24)*60+m)+(h>=24?1440:0); }
const toHHMM = mins => `${pad2(Math.floor((mins%1440)/60))}:${pad2(mins%60)}`;

/* ===== גרף תחנות (קשתות) ===== */
function E(a,b,mins,line){ return {a,b,mins,line}; }
const EDGES = [
  // EXPO: Waterfront -> Columbia (גזע מערב→מזרח)
  E("Waterfront","Burrard",2,"EXPO"), E("Burrard","Granville",2,"EXPO"),
  E("Granville","Stadium–Chinatown",3,"EXPO"), E("Stadium–Chinatown","Main Street–Science World",3,"EXPO"),
  E("Main Street–Science World","Commercial–Broadway",4,"EXPO"),
  E("Commercial–Broadway","Nanaimo",3,"EXPO"), E("Nanaimo","29th Avenue",2,"EXPO"),
  E("29th Avenue","Joyce–Collingwood",3,"EXPO"), E("Joyce–Collingwood","Patterson",3,"EXPO"),
  E("Patterson","Metrotown",3,"EXPO"), E("Metrotown","Royal Oak",3,"EXPO"),
  E("Royal Oak","Edmonds",3,"EXPO"), E("Edmonds","22nd Street",3,"EXPO"),
  E("22nd Street","New Westminster",2,"EXPO"), E("New Westminster","Columbia",2,"EXPO"),
  // EXPO לענף King George (דרום-מזרח)
  E("Columbia","Scott Road",2,"EXPO"), E("Scott Road","Gateway",3,"EXPO"),
  E("Gateway","Surrey Central",3,"EXPO"), E("Surrey Central","King George",2,"EXPO"),
  // EXPO לענף Production Way (צפון-מזרח)
  E("Columbia","Sapperton",3,"EXPO"), E("Sapperton","Braid",3,"EXPO"),
  E("Braid","Lougheed Town Centre",4,"EXPO"), E("Lougheed Town Centre","Production Way–University",2,"EXPO"),

  // MILLENNIUM (כולו צפונית ל-Expo)
  E("VCC–Clark","Commercial–Broadway",3,"MILL"), E("Commercial–Broadway","Renfrew",2,"MILL"),
  E("Renfrew","Rupert",2,"MILL"), E("Rupert","Gilmore",3,"MILL"),
  E("Gilmore","Brentwood Town Centre",3,"MILL"), E("Brentwood Town Centre","Holdom",2,"MILL"),
  E("Holdom","Sperling–Burnaby Lake",3,"MILL"), E("Sperling–Burnaby Lake","Lake City Way",2,"MILL"),
  E("Lake City Way","Production Way–University",2,"MILL"), E("Production Way–University","Lougheed Town Centre",3,"MILL"),
  E("Lougheed Town Centre","Burquitlam",3,"MILL"), E("Burquitlam","Moody Centre",4,"MILL"),
  E("Moody Centre","Inlet Centre",2,"MILL"), E("Inlet Centre","Coquitlam Central",2,"MILL"),
  E("Coquitlam Central","Lincoln",2,"MILL"), E("Lincoln","Lafarge Lake–Douglas",2,"MILL"),

  // CANADA (אנכי צפון↕דרום)
  E("Waterfront","Vancouver City Centre",2,"CAN"), E("Vancouver City Centre","Yaletown–Roundhouse",2,"CAN"),
  E("Yaletown–Roundhouse","Olympic Village",3,"CAN"), E("Olympic Village","Broadway–City Hall",3,"CAN"),
  E("Broadway–City Hall","King Edward",3,"CAN"), E("King Edward","Oakridge–41st Avenue",3,"CAN"),
  E("Oakridge–41st Avenue","Langara–49th Avenue",3,"CAN"), E("Langara–49th Avenue","Marine Drive",3,"CAN"),
  E("Marine Drive","Bridgeport",4,"CAN"),
  // Canada הסתעפויות מ-Bridgeport
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

/* ===== שעות/תדירויות ===== */
function headwayFor(lineId, depMins){
  const meta = LINE_META[lineId];
  const t = depMins % 1440;
  const t2 = (depMins<1440)? t : t+1440;
  for (const w of meta.headways){
    const s = toMinutesWrap(w.start), e = toMinutesWrap(w.end);
    if (s<=t2 && t2<=e) return w.mins;
  }
  return meta.headways.at(-1).mins;
}
function scheduleDeparture(lineId, earliest){
  const meta = LINE_META[lineId];
  const first = toMinutesWrap(meta.firstTrain);
  const last  = toMinutesWrap(meta.lastTrain);
  let depart = Math.max(earliest, first);
  if (depart>last) return null;
  const hw = headwayFor(lineId, depart);
  const offset = (depart - first) % hw;
  if (offset !== 0) depart += (hw - offset);
  return depart<=last ? depart : null;
}

/* ===== קיצור דרך: דייקסטרה לקו יחיד ===== */
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

/* ===== בניית חלופות ===== */
const LINES_ORDER = ["EXPO","MILL","CAN"];
const TRANSFER_MIN = 3;
function intersection(aSet,bSet){ const out=[]; for (const x of aSet) if (bSet.has(x)) out.push(x); return out; }

function planCandidates(from, to, depMins){
  const cands = [];

  // קו יחיד
  for (const L of LINES_ORDER){
    const seg = shortestOnLine(L, from, to);
    if (seg){
      const d1=scheduleDeparture(L,depMins); if (d1==null) continue;
      const a1=d1+seg.mins;
      cands.push({ type:"DIRECT", transfers:0, depart:d1, arrive:a1,
        legs:[{ line:LINE_META[L].name, lineId:L, color:LINE_META[L].color, from, to, depart:d1, arrive:a1, path:seg.path }]});
    }
  }

  // החלפה אחת
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

  // שתי החלפות
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

  // ייחודיות ומיון
  const uniq=new Map();
  for (const r of cands){
    const key = `${r.legs.map(l=>l.lineId+':'+l.from+'>'+l.to).join('|')}-${r.depart}`;
    if (!uniq.has(key)) uniq.set(key,r);
  }
  return [...uniq.values()].sort((a,b)=>(a.arrive-b.arrive)||(a.transfers-b.transfers)).slice(0,3);
}

/* ====== UI ====== */
const fromSel = document.getElementById('fromStop');
const toSel   = document.getElementById('toStop');
const depTime = document.getElementById('depTime');
const depDate = document.getElementById('depDate');
const resultsEl = document.getElementById('results');
const favBtn = document.getElementById('favBtn');
const favsEl = document.getElementById('favs');
const btnShowOnMap = document.getElementById('btnShowOnMap');
const btnResetMap  = document.getElementById('btnResetMap');

function populateStops(){
  for (const s of ALL_STOPS){
    const o1=document.createElement('option'); o1.value=s; o1.textContent=s;
    const o2=document.createElement('option'); o2.value=s; o2.textContent=s;
    fromSel.appendChild(o1); toSel.appendChild(o2);
  }
  fromSel.value="Waterfront"; toSel.value="Commercial–Broadway";
  const now = new Date();
  depDate.valueAsDate=now;
  depTime.value = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
}

function minutesFromDateTimeInputs(){
  const d = depDate.value? new Date(depDate.value) : new Date();
  const [hh,mm] = (depTime.value || "00:00").split(':').map(Number);
  d.setHours(hh??0, mm??0, 0, 0);
  const mins = d.getHours()*60 + d.getMinutes();
  return mins < 180 ? mins+1440 : mins; // תמיכה עד 01:15
}

let lastTrips = [];

/* ====== מפה סכמטית: מיקומים ידניים ====== */
const svg = document.getElementById('svgRoot');
// viewBox: 0 0 1200 520
// Waterfront מרכז משותף. Canada אנכי ב-x ≈ 280. Expo אופקי סביב y≈200. Millennium צפונית סביב y≈130.
const STATION_POS = {
  // Waterfront + Canada (אנכי)
  "Waterfront": {x:280, y:100},
  "Vancouver City Centre": {x:280, y:140},
  "Yaletown–Roundhouse":   {x:280, y:180},
  "Olympic Village":       {x:280, y:220},
  "Broadway–City Hall":    {x:280, y:260},
  "King Edward":           {x:280, y:300},
  "Oakridge–41st Avenue":  {x:280, y:340},
  "Langara–49th Avenue":   {x:280, y:380},
  "Marine Drive":          {x:280, y:420},
  "Bridgeport":            {x:280, y:460},
  // הסתעפויות Canada
  "Templeton":             {x:240, y:490},
  "Sea Island Centre":     {x:210, y:515},
  "YVR–Airport":           {x:180, y:540},
  "Aberdeen":              {x:320, y:440},
  "Lansdowne":             {x:360, y:420},
  "Richmond–Brighouse":    {x:400, y:400},

  // Expo (מערב→מזרח) סביב y≈200
  "Burrard":{x:220,y:170}, "Granville":{x:260,y:170},
  "Stadium–Chinatown":{x:320,y:185}, "Main Street–Science World":{x:380,y:200},
  "Commercial–Broadway":{x:460,y:210}, "Nanaimo":{x:520,y:210}, "29th Avenue":{x:580,y:210},
  "Joyce–Collingwood":{x:640,y:210}, "Patterson":{x:700,y:210}, "Metrotown":{x:760,y:210},
  "Royal Oak":{x:820,y:210}, "Edmonds":{x:880,y:210}, "22nd Street":{x:940,y:210},
  "New Westminster":{x:1000,y:210}, "Columbia":{x:1060,y:210},
  // ענף King George (יורד דרום-מזרח)
  "Scott Road":{x:1120,y:235}, "Gateway":{x:1180,y:260}, "Surrey Central":{x:1240,y:285}, "King George":{x:1300,y:310},
  // ענף Production Way (עולה צפון-מזרח)
  "Sapperton":{x:1060,y:180}, "Braid":{x:1120,y:165}, "Lougheed Town Centre":{x:1180,y:155}, "Production Way–University":{x:1240,y:145},

  // Millennium (צפונית ל-Expo) סביב y≈130
  "VCC–Clark":{x:420,y:140}, "Renfrew":{x:520,y:140}, "Rupert":{x:560,y:140}, "Gilmore":{x:600,y:140},
  "Brentwood Town Centre":{x:660,y:140}, "Holdom":{x:720,y:140}, "Sperling–Burnaby Lake":{x:780,y:140},
  "Lake City Way":{x:840,y:140}, /* כבר מוגדר PWU */ "Burquitlam":{x:1240,y:125}, "Moody Centre":{x:1300,y:120},
  "Inlet Centre":{x:1360,y:118}, "Coquitlam Central":{x:1420,y:120}, "Lincoln":{x:1480,y:125}, "Lafarge Lake–Douglas":{x:1540,y:135}
};

// נרמול עדין אם יש חריגות מחוץ ל-viewBox
(function normalizePositions(){
  let xmin=Infinity,xmax=-Infinity,ymin=Infinity,ymax=-Infinity;
  for (const p of Object.values(STATION_POS)){ xmin=Math.min(xmin,p.x); xmax=Math.max(xmax,p.x); ymin=Math.min(ymin,p.y); ymax=Math.max(ymax,p.y); }
  const margin = 40;
  const sx = (1200-2*margin)/(xmax-xmin);
  const sy = (520-2*margin)/(ymax-ymin);
  const k = Math.min(sx,sy);
  const ox = margin - xmin*k; const oy = margin - ymin*k;
  for (const p of Object.values(STATION_POS)){ p.x = p.x*k+ox; p.y = p.y*k+oy; }
})();

/* ציור הרשת */
function drawNetwork(){
  svg.innerHTML='';
  const trunk = {
    EXPO: ["Waterfront","Burrard","Granville","Stadium–Chinatown","Main Street–Science World","Commercial–Broadway","Nanaimo","29th Avenue","Joyce–Collingwood","Patterson","Metrotown","Royal Oak","Edmonds","22nd Street","New Westminster","Columbia"],
    MILL: ["VCC–Clark","Commercial–Broadway","Renfrew","Rupert","Gilmore","Brentwood Town Centre","Holdom","Sperling–Burnaby Lake","Lake City Way","Production Way–University","Lougheed Town Centre"],
    CAN:  ["Waterfront","Vancouver City Centre","Yaletown–Roundhouse","Olympic Village","Broadway–City Hall","King Edward","Oakridge–41st Avenue","Langara–49th Avenue","Marine Drive","Bridgeport"]
  };
  const branches = {
    EXPO: [
      ["Columbia","Scott Road","Gateway","Surrey Central","King George"],
      ["Columbia","Sapperton","Braid","Lougheed Town Centre","Production Way–University"]
    ],
    MILL: [
      ["Lougheed Town Centre","Burquitlam","Moody Centre","Inlet Centre","Coquitlam Central","Lincoln","Lafarge Lake–Douglas"]
    ],
  CAN: [
      ["Bridgeport","Templeton","Sea Island Centre","YVR–Airport"],
      ["Bridgeport","Aberdeen","Lansdowne","Richmond–Brighouse"]
    ]
  };

  function drawPolyline(names, color, cls){
    const pts = names.map(n=>STATION_POS[n]).filter(Boolean);
    if (pts.length<2) return;
    const d = pts.map((p,i)=> (i?`L${p.x},${p.y}`:`M${p.x},${p.y}`)).join('');
    const path = document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('d', d);
    path.setAttribute('fill','none');
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width','6');
    path.setAttribute('stroke-linecap','round');
    path.setAttribute('stroke-linejoin','round');
    if (cls) path.setAttribute('class', cls);
    svg.appendChild(path);
  }

  // ציור קווים
  drawPolyline(trunk.EXPO, LINE_META.EXPO.color, 'line-expo');
  drawPolyline(trunk.MILL, LINE_META.MILL.color, 'line-mill');
  drawPolyline(trunk.CAN,  LINE_META.CAN.color,  'line-can');
  branches.EXPO.forEach(seq=>drawPolyline(seq,LINE_META.EXPO.color,'line-expo'));
  branches.MILL.forEach(seq=>drawPolyline(seq,LINE_META.MILL.color,'line-mill'));
  branches.CAN.forEach(seq=>drawPolyline(seq,LINE_META.CAN.color,'line-can'));

  // תחנות + תוויות בלי חפיפות
  const placed = [];
  for (const [name,pt] of Object.entries(STATION_POS)){
    const c = document.createElementNS('http://www.w3.org/2000/svg','circle');
    c.setAttribute('cx', pt.x); c.setAttribute('cy', pt.y); c.setAttribute('r', 4.5);
    c.setAttribute('fill','#fff'); c.setAttribute('stroke','#0f172a'); c.setAttribute('stroke-width','1.5');
    svg.appendChild(c);
    placeLabelNoOverlap(name, pt, placed);
  }
  window.__SCHEMA_POINTS__ = STATION_POS;
}

/* מניעת חפיפת תוויות */
function placeLabelNoOverlap(name, pt, placed){
  const positions = [
    {dx: 8,  dy:-8}, {dx: 8,  dy: 14},
    {dx:-8,  dy:-8, anchor:'end'}, {dx:-8,  dy: 14, anchor:'end'},
    {dx: 0,  dy:-14, anchor:'middle'}, {dx: 0,  dy: 22, anchor:'middle'}
  ];
  const g = document.createElementNS('http://www.w3.org/2000/svg','g');
  svg.appendChild(g);
  for (const pos of positions){
    g.innerHTML = '';
    const halo = document.createElementNS('http://www.w3.org/2000/svg','text');
    halo.setAttribute('x', pt.x + pos.dx); halo.setAttribute('y', pt.y + pos.dy);
    halo.setAttribute('font-size','11'); halo.setAttribute('stroke','#fff'); halo.setAttribute('stroke-width','3');
    halo.setAttribute('paint-order','stroke'); if (pos.anchor) halo.setAttribute('text-anchor', pos.anchor); halo.textContent = name; g.appendChild(halo);
    const t = document.createElementNS('http://www.w3.org/2000/svg','text');
    t.setAttribute('x', pt.x + pos.dx); t.setAttribute('y', pt.y + pos.dy);
    t.setAttribute('font-size','11'); t.setAttribute('fill','#0f172a');
    if (pos.anchor) t.setAttribute('text-anchor', pos.anchor);
    t.textContent = name; g.appendChild(t);
    const bb = g.getBBox(); const box = {x:bb.x, y:bb.y, w:bb.width, h:bb.height};
    if (!intersectsAny(box, placed)){ placed.push(box); return; }
  }
}
function intersectsAny(box, arr){ for (const b of arr){ if (rectsIntersect(box,b)) return true; } return false; }
function rectsIntersect(a,b){ return !(a.x+a.w < b.x || b.x+b.w < a.x || a.y+a.h < b.y || b.y+b.h < a.y); }

/* הדגשת מסלול על המפה */
function highlightTripOnMap(trip){
  if (!trip){ return; }
  [...svg.querySelectorAll('.route-highlight')].forEach(el=>el.remove());
  const P = window.__SCHEMA_POINTS__;
  for (const leg of trip.legs){
    const pts = leg.path.map(n => P[n]).filter(Boolean);
    if (pts.length<2) continue;
    const d = pts.map((p,i)=> (i?`L${p.x},${p.y}`:`M${p.x},${p.y}`)).join('');
    const path = document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('d', d);
    path.setAttribute('fill','none');
    path.setAttribute('stroke', leg.color);
    path.setAttribute('stroke-width','9');
    path.setAttribute('stroke-linecap','round');
    path.setAttribute('stroke-linejoin','round');
    path.setAttribute('opacity','0.9');
    path.setAttribute('class','route-highlight');
    svg.appendChild(path);
  }
}

/* אירועים */
document.getElementById('tripForm').addEventListener('submit', (e)=>{
  e.preventDefault();
  const from=fromSel.value, to=toSel.value;
  if (from===to){ resultsEl.innerHTML=`<p class="text-sm text-red-600">בחר/י מוצא ויעד שונים.</p>`; return; }
  const dep = minutesFromDateTimeInputs();
  const list = planCandidates(from,to,dep);
  lastTrips = list;
  renderResults(list);
  drawNetwork();
});
document.getElementById('swapBtn').addEventListener('click', ()=>{
  const a=fromSel.value, b=toSel.value; fromSel.value=b; toSel.value=a;
});
document.getElementById('favBtn').addEventListener('click', ()=>{ saveFav(fromSel.value, toSel.value); });
document.getElementById('btnShowOnMap')?.addEventListener('click', ()=>{ if (lastTrips.length) highlightTripOnMap(lastTrips[0]); });
document.getElementById('btnResetMap')?.addEventListener('click', ()=>{ [...svg.querySelectorAll('.route-highlight')].forEach(el=>el.remove()); });

/* תוצאות */
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
    el.querySelector('button').addEventListener('click', ()=>{ highlightTripOnMap(lastTrips[idx]); });
    resultsEl.appendChild(el);
  });
}

/* מועדפים */
function loadFavs(){
  favsEl.innerHTML='';
  const favs=JSON.parse(localStorage.getItem('mvpfavs')||'[]');
  if (!favs?.length){ favsEl.innerHTML=`<span class="text-slate-500 text-sm">אין מועדפים עדיין.</span>`; return; }
  for (const f of favs){
    const b=document.createElement('button');
    b.className='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-900 hover:bg-amber-200';
    b.textContent=`⭐ ${f.from} → ${f.to}`;
    b.addEventListener('click', ()=>{ fromSel.value=f.from; toSel.value=f.to; document.getElementById('tripForm').dispatchEvent(new Event('submit')); });
    favsEl.appendChild(b);
  }
}
function saveFav(from,to){
  const favs=JSON.parse(localStorage.getItem('mvpfavs')||'[]');
  if (!favs.find(x=>x.from===from&&x.to===to)){ favs.push({from,to}); localStorage.setItem('mvpfavs',JSON.stringify(favs)); loadFavs(); }
}

/* אתחול */
populateStops(); loadFavs(); drawNetwork();
