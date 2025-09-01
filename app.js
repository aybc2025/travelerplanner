/* MVP סטטי — SkyTrain בלבד (Expo, Millennium, Canada) עם כל התחנות וכל ההסתעפויות.
   נתיבי מסלול מחושבים על גרף, דו-כיווני, עד 2 החלפות, וזמן המתנה לפי headway.
   תיקון: יישור תדירות ביחס ל-firstTrain והרחבת חלון שירות עד 01:15.
*/

/* ===== הגדרות קווים (headways/שעות שירות) ===== */
const LINE_META = {
  EXPO: {
    id: "EXPO", name: "Expo Line", color: "#0060A9",
    headways: [
      { start: "05:00", end: "06:59", mins: 8 },
      { start: "07:00", end: "09:59", mins: 4 },
      { start: "10:00", end: "15:59", mins: 6 },
      { start: "16:00", end: "18:59", mins: 4 },
      { start: "19:00", end: "25:15", mins: 8 } // עד 01:15 (25:15) בלילה
    ],
    firstTrain: "05:00", lastTrain: "25:15" // 01:15
  },
  MILL: {
    id: "MILL", name: "Millennium Line", color: "#FDB515",
    headways: [
      { start: "05:00", end: "06:59", mins: 8 },
      { start: "07:00", end: "09:59", mins: 5 },
      { start: "10:00", end: "15:59", mins: 6 },
      { start: "16:00", end: "18:59", mins: 5 },
      { start: "19:00", end: "25:15", mins: 8 }
    ],
    firstTrain: "05:00", lastTrain: "25:15"
  },
  CAN: {
    id: "CAN", name: "Canada Line", color: "#00B7C3",
    headways: [
      { start: "05:00", end: "06:59", mins: 6 },
      { start: "07:00", end: "09:59", mins: 4 },
      { start: "10:00", end: "15:59", mins: 5 },
      { start: "16:00", end: "18:59", mins: 4 },
      { start: "19:00", end: "25:15", mins: 6 }
    ],
    firstTrain: "05:00", lastTrain: "25:15"
  }
};

/* עזר זמן: תומך גם ב"זמנים אחרי חצות" (24:xx → 00:xx+יום) */
const pad2 = n => String(n).padStart(2,"0");
function toMinutes(hhmm){
  const [h,m] = hhmm.split(":").map(Number);
  return h*60 + m;
}
function toMinutesWrap(hhmm){
  // מאפשר ערכים כמו "25:15" (= 01:15 למחרת)
  const [h,m] = hhmm.split(":").map(Number);
  return ((h%24)*60 + m) + (h>=24 ? 24*60 : 0);
}
const toHHMM = mins => `${pad2(Math.floor((mins%1440)/60))}:${pad2(mins%60)}`;

/* ===== גרף תחנות (כמו קודם) ===== */
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
  // Canada ל-YVR
  E("Bridgeport","Templeton",3,"CAN"), E("Templeton","Sea Island Centre",2,"CAN"),
  E("Sea Island Centre","YVR–Airport",2,"CAN"),
  // Canada ל-Richmond
  E("Bridgeport","Aberdeen",3,"CAN"), E("Aberdeen","Lansdowne",2,"CAN"),
  E("Lansdowne","Richmond–Brighouse",2,"CAN"),
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

const ALL_STOPS = [...new Set(
  Object.values(LINE_STOPS).flatMap(s => [...s])
)].sort((a,b)=>a.localeCompare(b,'he'));

const TRANSFER_HUBS = new Set(
  ["Waterfront","Commercial–Broadway","Production Way–University","Lougheed Town Centre","Columbia"]
);

/* ===== ראשי תדירות/שירות ===== */
function headwayFor(lineId, depMins){
  const meta = LINE_META[lineId];
  const t = depMins % (24*60);          // דקה בתוך היום
  const t2 = (depMins < 24*60) ? t : t + 24*60; // מאפשר טווח עד 01:15
  for (const w of meta.headways){
    const s = toMinutesWrap(w.start), e = toMinutesWrap(w.end);
    if (s <= t2 && t2 <= e) return w.mins;
  }
  return meta.headways[meta.headways.length-1].mins;
}

function scheduleDeparture(lineId, earliest){
  const meta = LINE_META[lineId];
  const first = toMinutesWrap(meta.firstTrain);
  const last  = toMinutesWrap(meta.lastTrain);
  let depart  = Math.max(earliest, first);
  if (depart > last) return null;

  const hw = headwayFor(lineId, depart);
  // *** יישור ביחס ל-firstTrain ***
  const offset = (depart - first) % hw;
  if (offset !== 0) depart += (hw - offset);
  return depart <= last ? depart : null;
}

/* ===== דייקסטרה בתוך קו אחד ===== */
function shortestOnLine(lineId, from, to){
  if (!LINE_STOPS[lineId].has(from) || !LINE_STOPS[lineId].has(to)) return null;
  const adj = GRAPH_BY_LINE[lineId];
  const dist = new Map(), prev = new Map(), pq = [];
  for (const s of Object.keys(adj)) dist.set(s, Infinity);
  dist.set(from,0); pq.push([0,from]);
  while(pq.length){
    pq.sort((a,b)=>a[0]-b[0]);
    const [d,u] = pq.shift();
    if (d>dist.get(u)) continue;
    if (u===to) break;
    for (const {to:v,mins} of adj[u]){
      const nd = d+mins;
      if (nd < dist.get(v)){
        dist.set(v,nd); prev.set(v,u); pq.push([nd,v]);
      }
    }
  }
  if (dist.get(to)===Infinity) return null;
  const path = []; let cur = to;
  while (cur && cur!==from){ path.push(cur); cur = prev.get(cur); }
  path.push(from); path.reverse();
  return { mins: dist.get(to), path };
}

/* ===== יצירת מסלולים ===== */
const LINES_ORDER = ["EXPO","MILL","CAN"];
const TRANSFER_MIN = 3;

function intersection(aSet, bSet){
  const out = [];
  for (const x of aSet) if (bSet.has(x)) out.push(x);
  return out;
}

function planCandidates(from, to, depMins){
  const cands = [];

  // קו יחיד
  for (const L of LINES_ORDER){
    const seg = shortestOnLine(L, from, to);
    if (seg){
      const d1 = scheduleDeparture(L, depMins); if (d1==null) continue;
      const a1 = d1 + seg.mins;
      cands.push({
        type:"DIRECT", transfers:0, depart:d1, arrive:a1,
        legs:[{ line: LINE_META[L].name, lineId:L, color: LINE_META[L].color, from, to, depart:d1, arrive:a1, path:seg.path }]
      });
    }
  }

  // החלפה אחת
  for (const L1 of LINES_ORDER){
    for (const L2 of LINES_ORDER){
      if (L1===L2) continue;
      for (const hub of intersection(LINE_STOPS[L1], LINE_STOPS[L2])){
        if (!TRANSFER_HUBS.has(hub)) continue;
        const seg1 = shortestOnLine(L1, from, hub);
        const seg2 = shortestOnLine(L2, hub, to);
        if (!seg1 || !seg2) continue;

        const d1 = scheduleDeparture(L1, depMins); if (d1==null) continue;
        const a1 = d1 + seg1.mins;
        const d2 = scheduleDeparture(L2, a1 + TRANSFER_MIN); if (d2==null) continue;
        const a2 = d2 + seg2.mins;

        cands.push({
          type:"TRANSFER1", transfers:1, depart:d1, arrive:a2,
          legs:[
            { line: LINE_META[L1].name, lineId:L1, color: LINE_META[L1].color, from, to:hub, depart:d1, arrive:a1, path:seg1.path },
            { line: LINE_META[L2].name, lineId:L2, color: LINE_META[L2].color, from:hub, to, depart:d2, arrive:a2, path:seg2.path }
          ]
        });
      }
    }
  }

  // שתי החלפות
  for (const L1 of LINES_ORDER){
    for (const L2 of LINES_ORDER){
      if (L1===L2) continue;
      for (const L3 of LINES_ORDER){
        if (L3===L1 || L3===L2) continue;

        const inter12 = intersection(LINE_STOPS[L1], LINE_STOPS[L2]);
        const inter23 = intersection(LINE_STOPS[L2], LINE_STOPS[L3]);

        for (const h1 of inter12){
          if (!TRANSFER_HUBS.has(h1)) continue;
          const seg1 = shortestOnLine(L1, from, h1);
          if (!seg1) continue;
          for (const h2 of inter23){
            if (!TRANSFER_HUBS.has(h2)) continue;
            const seg2 = shortestOnLine(L2, h1, h2);
            const seg3 = shortestOnLine(L3, h2, to);
            if (!seg2 || !seg3) continue;

            const d1 = scheduleDeparture(L1, depMins); if (d1==null) continue;
            const a1 = d1 + seg1.mins;
            const d2 = scheduleDeparture(L2, a1 + TRANSFER_MIN); if (d2==null) continue;
            const a2 = d2 + seg2.mins;
            const d3 = scheduleDeparture(L3, a2 + TRANSFER_MIN); if (d3==null) continue;
            const a3 = d3 + seg3.mins;

            cands.push({
              type:"TRANSFER2", transfers:2, depart:d1, arrive:a3,
              legs:[
                { line: LINE_META[L1].name, lineId:L1, color: LINE_META[L1].color, from, to:h1, depart:d1, arrive:a1, path:seg1.path },
                { line: LINE_META[L2].name, lineId:L2, color: LINE_META[L2].color, from:h1, to:h2, depart:d2, arrive:a2, path:seg2.path },
                { line: LINE_META[L3].name, lineId:L3, color: LINE_META[L3].color, from:h2, to, depart:d3, arrive:a3, path:seg3.path }
              ]
            });
          }
        }
      }
    }
  }

  // סינון ומיון
  const uniq = new Map();
  for (const r of cands){
    const key = `${r.legs.map(l=>l.lineId+':'+l.from+'>'+l.to).join('|')}-${r.depart}`;
    if (!uniq.has(key)) uniq.set(key,r);
  }
  return [...uniq.values()].sort((a,b)=> (a.arrive-b.arrive) || (a.transfers-b.transfers)).slice(0,3);
}

/* ====== UI (כמו קודם) ====== */
const fromSel = document.getElementById('fromStop');
const toSel   = document.getElementById('toStop');
const depTime = document.getElementById('depTime');
const depDate = document.getElementById('depDate');
const resultsEl = document.getElementById('results');
const favBtn = document.getElementById('favBtn');
const favsEl = document.getElementById('favs');

function populateStops(){
  for (const s of ALL_STOPS){
    const o1 = document.createElement('option'); o1.value=s; o1.textContent=s;
    const o2 = document.createElement('option'); o2.value=s; o2.textContent=s;
    fromSel.appendChild(o1); toSel.appendChild(o2);
  }
  fromSel.value = "Waterfront";
  toSel.value = "Commercial–Broadway";
  const now = new Date();
  depDate.valueAsDate = now;
  depTime.value = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
}

function minutesFromDateTimeInputs(){
  const d = depDate.value ? new Date(depDate.value) : new Date();
  const [hh,mm] = (depTime.value || "00:00").split(':').map(Number);
  d.setHours(hh??0, mm??0, 0, 0);
  // אם השעה קטנה מ-03:00, נתייחס אליה כלילה מאוחרת (מעל 24:00) כדי לאפשר 01:15
  const mins = d.getHours()*60 + d.getMinutes();
  return mins < 180 ? mins + 24*60 : mins;
}

function renderResults(list){
  resultsEl.innerHTML = '';
  if (!list.length){
    resultsEl.innerHTML = `<p class="text-sm text-slate-600">לא נמצאו חלופות מתאימות בטווח השעות שנבחר.</p>`;
    return;
  }
  for (const r of list){
    const dur = r.arrive - r.depart;
    const el = document.createElement('div');
    el.className = 'border rounded-xl p-3 bg-white';
    el.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
              style="background:#eef; color:#223;">${r.transfers? (r.transfers===1?'החלפה אחת':'2 החלפות') : 'ישיר'}</span>
        <span class="text-sm text-slate-600">יציאה ${toHHMM(r.depart)} • הגעה ${toHHMM(r.arrive)} • ${dur} דק׳</span>
      </div>
      <ol class="mt-2 space-y-2">
        ${r.legs.map(l => `
          <li class="flex items-center gap-2">
            <span class="w-3 h-3 rounded-full" style="background:${l.color}"></span>
            <span class="font-medium">${l.line}</span>
            <span class="text-slate-700">— ${l.from} → ${l.to}</span>
            <span class="ml-auto text-xs text-slate-600">${toHHMM(l.depart)} → ${toHHMM(l.arrive)}</span>
          </li>
        `).join('')}
      </ol>
    `;
    resultsEl.appendChild(el);
  }
}

/* מועדפים */
function loadFavs(){
  favsEl.innerHTML = '';
  const favs = JSON.parse(localStorage.getItem('mvpfavs')||'[]');
  if (!favs.length){
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
function saveFav(from,to){
  const favs = JSON.parse(localStorage.getItem('mvpfavs')||'[]');
  if (!favs.find(x=>x.from===from && x.to===to)){
    favs.push({from,to});
    localStorage.setItem('mvpfavs', JSON.stringify(favs));
    loadFavs();
  }
}

/* אירועים */
document.getElementById('tripForm').addEventListener('submit', (e)=>{
  e.preventDefault();
  const from = fromSel.value, to = toSel.value;
  if (from === to){
    resultsEl.innerHTML = `<p class="text-sm text-red-600">בחר/י מוצא ויעד שונים.</p>`;
    return;
  }
  const dep = minutesFromDateTimeInputs();
  const list = planCandidates(from, to, dep);
  renderResults(list);
});
document.getElementById('swapBtn').addEventListener('click', ()=>{
  const a = fromSel.value, b = toSel.value; fromSel.value=b; toSel.value=a;
});
document.getElementById('favBtn').addEventListener('click', ()=>{
  saveFav(fromSel.value, toSel.value);
});

/* אתחול */
populateStops(); loadFavs();
