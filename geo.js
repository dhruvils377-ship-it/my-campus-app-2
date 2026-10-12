// Pure routing/geometry logic — no React, no DOM, no hooks.
// Extracted from the original monolithic App.jsx so it can be unit-tested
// in isolation (see src/utils/geo.test.js) and reused without pulling in
// the whole component tree.

function escapeHtml(str){
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function haversineRaw(a,b){
  const R=6371e3,r=Math.PI/180;
  const x=Math.sin(((b.lat-a.lat)*r)/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(((b.lng-a.lng)*r)/2)**2;
  return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}
// Builds routing over the REAL road network (ROAD_NODES/ROAD_EDGES, from a
// user-supplied Overpass GeoJSON export) instead of straight lines between
// buildings. Each building snaps to its nearest road point; the route then
// walks the actual road/footpath polyline, so paths follow real roads instead
// of cutting through fields, courtyards, or buildings.
function buildRoadSnappedGraph(buildings, roadNodes, roadEdges, { snapMax = 140 } = {}){
  const graph = {};
  const allCoords = { ...roadNodes };
  for (const rid in roadEdges) graph[rid] = new Set(roadEdges[rid]);

  const buildingKeys = Object.keys(buildings);
  const roadIds = Object.keys(roadNodes);
  const orphans = [];

  for (const bKey of buildingKeys) {
    graph[bKey] = graph[bKey] || new Set();
    allCoords[bKey] = buildings[bKey];
    let best = null;
    for (const rid of roadIds) {
      const d = haversineRaw(buildings[bKey], roadNodes[rid]);
      if (!best || d < best.d) best = { rid, d };
    }
    if (best && best.d <= snapMax) {
      graph[bKey].add(best.rid);
      graph[best.rid] = graph[best.rid] || new Set();
      graph[best.rid].add(bKey);
    } else {
      orphans.push(bKey); // too far from any mapped road — bridge below
    }
  }

  // Orphan buildings (no nearby road, e.g. new/unmapped structures): connect
  // straight to nearest reachable node so they're still routable.
  for (const o of orphans) {
    const others = [...buildingKeys.filter(k => k !== o && !orphans.includes(k)), ...roadIds];
    let best = null;
    for (const cand of others) {
      const d = haversineRaw(buildings[o], allCoords[cand]);
      if (!best || d < best.d) best = { cand, d };
    }
    if (best) {
      graph[o].add(best.cand);
      graph[best.cand] = graph[best.cand] || new Set();
      graph[best.cand].add(o);
    }
  }

  // Guarantee full connectivity: bridge any remaining disconnected components.
  function components(){
    const seen=new Set(),comps=[];
    for(const start of Object.keys(graph)){
      if(seen.has(start))continue;
      const comp=[start];seen.add(start);
      const q=[start];
      while(q.length){
        const cur=q.shift();
        for(const nb of graph[cur]||[]){if(!seen.has(nb)){seen.add(nb);comp.push(nb);q.push(nb);}}
      }
      comps.push(comp);
    }
    return comps;
  }
  let comps=components();
  let guard=0;
  while(comps.length>1 && guard++<50){
    let best=null;
    const a0=comps[0].filter(k=>allCoords[k]);
    for(let i=1;i<comps.length;i++){
      const bi=comps[i].filter(k=>allCoords[k]);
      for(const a of a0)for(const b of bi){
        const d=haversineRaw(allCoords[a],allCoords[b]);
        if(!best||d<best.d)best={a,b,d};
      }
    }
    if(!best)break;
    graph[best.a].add(best.b);graph[best.b].add(best.a);
    comps=components();
  }

  const out={};
  for(const k in graph) out[k]=Array.from(graph[k]);
  return { graph: out, allCoords };
}

const ALIASES = {
  "main gate":"pu gate-1","gate 1":"pu gate-1","gate1":"pu gate-1","gate-1":"pu gate-1",
  "gate 3":"pu gate-3","gate3":"pu gate-3","gate-3":"pu gate-3",
  "canteen":"central canteen","food court":"central canteen","food":"central canteen","eat":"central canteen",
  "cafe":"pu cafeterias","cafeteria":"pu cafeterias",
  "pharmacy":"parul institute of pharmacy","med auditorium":"medical auditorium",
  "medical college":"parul institute paramedical","paramedical":"parul institute paramedical",
  "homoeopathic":"faculty of homoeopathic","homeopathic":"faculty of homoeopathic",
  "ayurved":"parul institute of ayurved","ayurveda":"parul institute of ayurved",
  "hospital":"pu ayurved hospital","architecture":"parul institute of architecture",
  "management":"parul institute of management","mba":"parul institute of management",
  "sai temple":"shree sai temple","temple":"shree sai temple",
  "kabaddi":"parul kabaddi ground","champions":"the champions cove",
  "indian salt":"the indian salt","atm":"central bank atm",
  "admin":"parul admin cell","admin office":"parul admin cell",
  "bose":"subhash chandra bose bhavan","bhagat":"bhagat singh bhawan",
  "cv raman":"c-v raman","raman":"c-v raman","tunnel":"pu tunnel",
  "bba":"bba building","football":"football ground","volleyball":"volleyball court",
  "tennis":"tennis court","kathi":"kathi junction","capitol":"capitol crust",
  "pizza":"dominos","a block":"a-block","d-block":"d block",
  "bus stand":"bus parking","greenery":"greenzy","workout":"gym","study":"library","pray":"shree sai temple",
  // ── new aliases for the verified OSM dataset ──
  "sevashram hospital":"parul sevashram hospital","cricket":"cricket ground",
  "basketball":"basketball court","kabbadi":"kabbadi ground",
  "gym2":"parul gym","design":"parul institute of design","nursing":"parul institute of nursing",
  "physiotherapy":"parul institute of physiotherapy","polytechnic":"parul polytechnic institute",
  "medical library":"medical central library","fountain":"fountain park","3rd gate":"3rd gate",
  "gate 2":"bba gate","gate2":"bba gate","greenzee":"greenzee foodcourt","utopia":"utopia foodcourt",
  "capitol foodcourt":"capitol foodcourt","new foodcourt":"new foodcourt","cv raman block":"cv raman",
  "bhagat singh":"bhagat singh bhawan","tagore a":"tagore bhawan a","tagore b":"tagore bhawan b",
  "azad":"azad bhavan","shastri":"shastri bhavan a","kalam":"kalam bhavan a","kalpana":"kalpana bhavan",
  "atal a":"atal bhawan a","atal b":"atal bhawan b",
};

function haversine(a,b){
  const R=6371e3,r=Math.PI/180;
  const x=Math.sin(((b.lat-a.lat)*r)/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(((b.lng-a.lng)*r)/2)**2;
  return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}
function calcBearing(a,b){
  const r=Math.PI/180;
  const y=Math.sin((b.lng-a.lng)*r)*Math.cos(b.lat*r);
  const x=Math.cos(a.lat*r)*Math.sin(b.lat*r)-Math.sin(a.lat*r)*Math.cos(b.lat*r)*Math.cos((b.lng-a.lng)*r);
  return(Math.atan2(y,x)*180/Math.PI+360)%360;
}
// Minimal binary min-heap keyed by [dist, nodeId], used by dijkstra() below.
// Swapping this in for the old linear scan over `unvisited` turns node
// selection from O(V) into O(log V) per pop — matters once the road graph
// grows well beyond one campus.
function MinHeap(){
  this.items=[];
}
MinHeap.prototype.push=function(dist,node){
  this.items.push([dist,node]);
  let i=this.items.length-1;
  while(i>0){
    const parent=(i-1)>>1;
    if(this.items[parent][0]<=this.items[i][0])break;
    [this.items[parent],this.items[i]]=[this.items[i],this.items[parent]];
    i=parent;
  }
};
MinHeap.prototype.pop=function(){
  if(this.items.length===0)return null;
  const top=this.items[0];
  const last=this.items.pop();
  if(this.items.length>0){
    this.items[0]=last;
    let i=0;
    while(true){
      const l=2*i+1,r=2*i+2;
      let smallest=i;
      if(l<this.items.length&&this.items[l][0]<this.items[smallest][0])smallest=l;
      if(r<this.items.length&&this.items[r][0]<this.items[smallest][0])smallest=r;
      if(smallest===i)break;
      [this.items[smallest],this.items[i]]=[this.items[i],this.items[smallest]];
      i=smallest;
    }
  }
  return top;
};

// `edgeWeightFn(fromId, toId, straightLineDistance)` lets callers change what
// "shortest path" means without touching the search algorithm itself:
//   - omitted → plain distance (the original behavior, used by every
//     existing call site and covered by the pre-existing dijkstra tests)
//   - can return Infinity to hard-exclude an edge (e.g. accessible mode
//     refusing to route across a stairs edge at all)
//   - can return MORE than the raw distance to discourage-but-not-forbid an
//     edge (e.g. fastest mode adding a time-penalty for stairs, since
//     they're slower to cross than flat ground, without banning them
//     outright the way accessible mode does)
function dijkstra(graph,allNodes,buildings,start,end,edgeWeightFn){
  if(!buildings[start]||!buildings[end])return null;
  const weightOf=edgeWeightFn||((from,to,d)=>d);
  const dist={},prev={},visited=new Set();
  for(const k in graph){dist[k]=Infinity;prev[k]=null;}
  dist[start]=0;
  const heap=new MinHeap();
  heap.push(0,start);
  while(heap.items.length){
    const popped=heap.pop();
    if(!popped)break;
    const[d,cur]=popped;
    if(visited.has(cur))continue; // stale heap entry from an earlier, longer path
    visited.add(cur);
    if(cur===end)break;
    if(d>dist[cur])continue;
    const neighbors=graph[cur]||[];
    for(const nb of neighbors){
      if(visited.has(nb))continue;
      const rawDist=haversine(allNodes[cur],allNodes[nb]);
      const w=weightOf(cur,nb,rawDist);
      if(!Number.isFinite(w))continue; // hard-excluded edge (e.g. accessible mode + stairs)
      const alt=dist[cur]+w;
      if(alt<dist[nb]){dist[nb]=alt;prev[nb]=cur;heap.push(alt,nb);}
    }
  }
  const path=[];let c=end;
  while(c){path.unshift(c);c=prev[c];}
  return path[0]===start?path:null;
}

// ── K-shortest-paths support (Yen's algorithm) ──────────────────────────────
// Everything below is new, added to support showing real alternate routes
// (not just re-weightings of the same path) alongside the default shortest
// route. dijkstra() above is untouched and still used everywhere it always
// was; kShortestPaths() is purely additive.

function edgeKey(a,b){return[a,b].sort().join('|');}

// Same search as dijkstra() but without the "start/end must be a named
// building" restriction — k-shortest-paths (below) has to restart search
// from arbitrary spur nodes partway along a road, not just from buildings.
function dijkstraRaw(graph,allNodes,start,end,edgeWeightFn){
  const weightOf=edgeWeightFn||((from,to,d)=>d);
  const dist={},prev={},visited=new Set();
  for(const k in graph){dist[k]=Infinity;prev[k]=null;}
  if(!(start in dist))return null; // spur node isn't in this (possibly filtered) graph
  dist[start]=0;
  const heap=new MinHeap();
  heap.push(0,start);
  while(heap.items.length){
    const popped=heap.pop();
    if(!popped)break;
    const[d,cur]=popped;
    if(visited.has(cur))continue;
    visited.add(cur);
    if(cur===end)break;
    if(d>dist[cur])continue;
    const neighbors=graph[cur]||[];
    for(const nb of neighbors){
      if(visited.has(nb))continue;
      const rawDist=haversine(allNodes[cur],allNodes[nb]);
      const w=weightOf(cur,nb,rawDist);
      if(!Number.isFinite(w))continue;
      const alt=dist[cur]+w;
      if(alt<dist[nb]){dist[nb]=alt;prev[nb]=cur;heap.push(alt,nb);}
    }
  }
  const path=[];let c=end;
  while(c){path.unshift(c);c=prev[c];}
  return path[0]===start?path:null;
}

function pathCost(allNodes,path,edgeWeightFn){
  const weightOf=edgeWeightFn||((from,to,d)=>d);
  let total=0;
  for(let i=0;i<path.length-1;i++){
    const a=allNodes[path[i]],b=allNodes[path[i+1]];
    if(!a||!b)return Infinity;
    const w=weightOf(path[i],path[i+1],haversine(a,b));
    if(!Number.isFinite(w))return Infinity;
    total+=w;
  }
  return total;
}

function pathsEqual(a,b){return a.length===b.length&&a.every((v,i)=>v===b[i]);}

// Yen's algorithm for K loopless shortest paths, built on dijkstraRaw()
// above. A[0] is always identical to plain dijkstra()'s result — later
// entries are genuine alternate roads, not re-weightings of the same path.
// K is kept small (3 by default): each extra alternate costs roughly one
// more search per node along the previous path, and these are for a human
// to glance at and pick from, not exhaustive route enumeration.
function kShortestPaths(graph,allNodes,buildings,start,end,edgeWeightFn,K=3){
  if(!buildings[start]||!buildings[end])return[];
  const first=dijkstraRaw(graph,allNodes,start,end,edgeWeightFn);
  if(!first)return[];
  const A=[first];
  const B=[]; // candidate pool: {path,cost}

  for(let k=1;k<K;k++){
    const prevPath=A[k-1];
    for(let i=0;i<prevPath.length-1;i++){
      const spurNode=prevPath[i];
      const rootPath=prevPath.slice(0,i+1);

      // Ban the next-hop edge of every already-found path sharing this
      // same root prefix, so the spur search can't just rediscover it.
      const bannedEdges=new Set();
      for(const p of A){
        if(p.length>i&&pathsEqual(p.slice(0,i+1),rootPath)){
          bannedEdges.add(edgeKey(p[i],p[i+1]));
        }
      }
      // Ban root-path nodes (except the spur node itself) so the spur
      // search can't loop back through the branch point.
      const bannedNodes=new Set(rootPath.slice(0,i));

      const filteredGraph={};
      for(const node in graph){
        if(bannedNodes.has(node))continue;
        filteredGraph[node]=graph[node].filter(
          nb=>!bannedNodes.has(nb)&&!bannedEdges.has(edgeKey(node,nb))
        );
      }

      const spurPath=dijkstraRaw(filteredGraph,allNodes,spurNode,end,edgeWeightFn);
      if(spurPath){
        const totalPath=rootPath.slice(0,-1).concat(spurPath);
        const dup=A.some(p=>pathsEqual(p,totalPath))||B.some(c=>pathsEqual(c.path,totalPath));
        if(!dup)B.push({path:totalPath,cost:pathCost(allNodes,totalPath,edgeWeightFn)});
      }
    }
    if(B.length===0)break;
    B.sort((a,b)=>a.cost-b.cost);
    A.push(B.shift().path);
  }
  return A;
}

function getTurnInfo(prev,cur){
  let a=cur-prev;
  while(a>180)a-=360;
  while(a<-180)a+=360;
  if(Math.abs(a)<22)return{text:"Continue straight",deg:0};
  if(a>22&&a<=70)return{text:"Turn slight right",deg:45};
  if(a>70&&a<140)return{text:"Turn right",deg:90};
  if(a>=140)return{text:"Make a U-turn",deg:180};
  if(a<-22&&a>=-70)return{text:"Turn slight left",deg:-45};
  if(a<-70&&a>-140)return{text:"Turn left",deg:-90};
  return{text:"Make a U-turn",deg:180};
}
function buildSteps(buildings,allNodes,path){
  if(!path||path.length<2)return{steps:[],total:0,time:0};
  const destName=buildings[path[path.length-1]]?.name || allNodes[path[path.length-1]]?.name || "destination";
  const steps=[];let total=0,prevB=null,segDist=0,segStartIdx=0;
  const flush=(endIdx,label,deg,isArrival)=>{
    if(segDist<1)return;
    const towardsNode=buildings[path[endIdx]];
    steps.push({key:path[segStartIdx],nextKey:path[endIdx],instruction:label,towards:towardsNode?towardsNode.name:destName,dist:Math.round(segDist),deg,isArrival:!!isArrival});
    segDist=0;segStartIdx=endIdx;
  };
  for(let i=0;i<path.length-1;i++){
    const a=allNodes[path[i]],b=allNodes[path[i+1]];
    if(!a||!b)continue;
    const d=haversine(a,b);
    const br=Math.round(calcBearing(a,b));
    total+=d;segDist+=d;
    if(i===0){
      prevB=br;continue;
    }
    const turn=getTurnInfo(prevB,br);
    const isNamedWaypoint=!!buildings[path[i]];
    // only break into a new step on a real turn (not straight-road noise), or at a named building
    if(turn.text!=="Continue straight"||isNamedWaypoint&&i<path.length-1){
      flush(i,i===1?`Head towards ${buildings[path[1]]?.name||allNodes[path[1]]?.name||"start"}`:turn.text,i===1?0:turn.deg);
    }
    prevB=br;
  }
  flush(path.length-1,`Arrive at ${destName}`,0,true);
  if(steps.length===0){
    steps.push({key:path[0],nextKey:path[path.length-1],instruction:`Head towards ${destName}`,towards:destName,dist:Math.round(total),deg:0,isArrival:false});
  }
  return{steps,total:Math.round(total),time:Math.ceil(total/80)};
}
function extractLocations(buildings,query){
  const lq=query.toLowerCase().trim();
  function isWB(s,i,e){return(i===0||/[\s,.\-!?()]/.test(s[i-1]))&&(e>=s.length||/[\s,.\-!?()]/.test(s[e]));}
  const aliasE=Object.entries(ALIASES).sort((a,b)=>b[0].length-a[0].length);
  const bKeys=Object.keys(buildings).sort((a,b)=>b.length-a.length);
  const used=[],matches=[];
  function tryAdd(key,idx,len){if(used.some(([s,e])=>idx<e&&idx+len>s))return;matches.push({key,index:idx});used.push([idx,idx+len]);}
  for(const[alias,key]of aliasE){let p=0;while(true){const i=lq.indexOf(alias,p);if(i===-1)break;if(isWB(lq,i,i+alias.length))tryAdd(key,i,alias.length);p=i+1;}}
  for(const key of bKeys){let p=0;while(true){const i=lq.indexOf(key,p);if(i===-1)break;if(isWB(lq,i,i+key.length))tryAdd(key,i,key.length);p=i+1;}}
  matches.sort((a,b)=>a.index-b.index);
  const dv=["navigate to","go to","take me to","directions to","guide me to","reach","find","to","where is","show me"];
  const fv=["currently at","standing at","i am at","i'm at","starting from","from","at"];
  function lastVB(verbs,ci){let best=-1;for(const v of verbs){let p=0;while(true){const i=lq.indexOf(v,p);if(i===-1||i>=ci)break;if(isWB(lq,i,i+v.length)&&i>best)best=i;p=i+1;}}return best;}
  let source=null,destination=null;
  for(const m of matches){
    const dp=lastVB(dv,m.index),fp=lastVB(fv,m.index);
    if(dp>fp&&dp!==-1){if(!destination)destination=m.key;}
    else if(fp>dp&&fp!==-1){if(!source)source=m.key;}
    else if(matches.length===1){destination=m.key;}
    else if(!source)source=m.key;
    else if(!destination)destination=m.key;
  }
  if(source&&!destination){destination=source;source=null;}
  return{source,destination};
}


export {
  escapeHtml,
  haversineRaw,
  buildRoadSnappedGraph,
  ALIASES,
  haversine,
  calcBearing,
  MinHeap,
  dijkstra,
  kShortestPaths,
  getTurnInfo,
  buildSteps,
  extractLocations,
};