/* sync-map.js — THE TEMPO-MAP ENGINE of Handpan Studio and the HPD Notation Lab.

   Moved out of app.html at commit 7b69901 (14 Sep 2026, SUITE.md phase 1),
   function for function, character for character where the arithmetic is
   concerned: bench/syncmap/expected.json is the recording taken from app.html
   before the move, and bench/syncmap/check.js must say "same" after every
   change to this file. Both app.html (its Video sync room and the player's
   Follow) and lab.html load this file; neither keeps a copy of the maths.

   THE MAP. A piece's `syncMap` is a list of anchors {t, p, g?}: t the video's
   seconds, p the pulse in the piece (compile(piece).total is the End), g set
   where the anchor sits on the grid because no stroke was found there (drawn
   amber in the Lab, clay in the app). The player reads the map by straight
   lines between anchors (mapPulse); the editors add, move and snap anchors.

   Everything here is pure: no DOM, no toast, no globals of either host. The
   piece's own maths — compile(piece) and SM(piece, sectionName) — are passed
   in by the caller, so the engine never needs to know where the piece lives.
   Strokes are passed in as a sorted list of onset times (seconds).           */
(function(root){
"use strict";
const SyncMap={};

/* ---------------- reading the map ---------------- */
SyncMap.segRate=function(a,t){ // pulses per second on the map's segment around t
  if(!a||a.length<2) return 0;
  for(let i=0;i<a.length-1;i++)
    if(t<=a[i+1].t||i===a.length-2){
      if(t<a[i].t&&i===0) return 0;
      return (a[i+1].p-a[i].p)/Math.max(1e-6,a[i+1].t-a[i].t);
    }
  return 0;
};
SyncMap.invMap=function(a,p){ // the video time of a pulse
  if(!a||a.length<2) return null;
  if(p<=a[0].p) return a[0].t;
  for(let i=0;i<a.length-1;i++)
    if(p<=a[i+1].p){
      const f=(p-a[i].p)/Math.max(1e-6,a[i+1].p-a[i].p);
      return a[i].t+f*(a[i+1].t-a[i].t);
    }
  return a[a.length-1].t;
};
SyncMap.mapBegun=function(a,t){ return !!(a&&a.length>=2&&t>=a[0].t); };   // the music has started: the map's first anchor is behind the video
SyncMap.mapPulse=function(a,t){ // the pulse at a video time
  if(!a||a.length<2) return null;
  if(t<=a[0].t) return a[0].p;
  for(let i=0;i<a.length-1;i++)
    if(t<=a[i+1].t){
      const f=(t-a[i].t)/Math.max(1e-6,a[i+1].t-a[i].t);
      return a[i].p+f*(a[i+1].p-a[i].p);
    }
  return a[a.length-1].p;
};

/* ---------------- the piece's grid ---------------- */
SyncMap.barStarts=function(piece,compile){
  const out=[], c=compile(piece);   // never a cached compile: it may belong to the previous piece
  for(const sec of c.secStarts){
    const s=piece.sections[sec.name]; if(!s) continue;
    for(let b=0;b<s.bars.length;b++) out.push(sec.pulse+b*sec.bp);
  }
  return out;
};
SyncMap.beatStarts=function(piece,compile,SM){
  const out=[], c=compile(piece);
  for(const sec of c.secStarts){
    const s=piece.sections[sec.name]; if(!s) continue;
    const m=SM(piece,sec.name);
    for(let b=0;b<s.bars.length;b++)
      for(let k=0;k<m.beats;k++) out.push(sec.pulse+b*m.bp+k*m.sub);
  }
  return out;
};
SyncMap.tapTargets=function(piece,compile,SM,beats){ // + the very last hit, played after the final table (timing only, not notation)
  return [...(beats?SyncMap.beatStarts(piece,compile,SM):SyncMap.barStarts(piece,compile)), compile(piece).total];
};
SyncMap.nextTap=function(a,ts){ // first untapped target after the highest anchored pulse
  const last=(a&&a.length)?Math.max(...a.map(x=>x.p)):-1;
  const i=ts.findIndex(p=>p>last);
  return {ts,i};
};
SyncMap.pulseLabel=function(piece,compile,SM,p){ // "A1·2" = section table, bar within it (beat suffix if off the bar)
  const c=compile(piece);
  if(p>=c.total) return "End";
  let sec=c.secStarts[0]; for(const x of c.secStarts) if(x.pulse<=p) sec=x;
  const m=SM(piece,sec.name), rel=p-sec.pulse;
  const bar=Math.floor(rel/m.bp)+1, beat=Math.floor((rel%m.bp)/m.sub)+1;
  return sec.name+"·"+bar+(beat>1?"·b"+beat:"");
};

/* ---------------- strokes ---------------- */
SyncMap.onsets=function(wavePk){ // stroke starts = sharp rises of the peak envelope {dur, pk[]}
  if(!wavePk) return [];
  const pk=wavePk.pk, n=pk.length, bd=wavePk.dur/n, on=[];
  for(let i=2;i<n;i++){
    const base=Math.max(pk[i-1],pk[i-2]);
    if(pk[i]>0.05&&pk[i]>base*1.6&&pk[i]-base>0.03){
      const t=i*bd;
      if(!on.length||t-on[on.length-1]>0.06) on.push(t);
    }
  }
  return on;
};
SyncMap.nearestOnset=function(onsets,t,win){
  let best=null;
  for(const o of onsets){
    const d=Math.abs(o-t);
    if(d<=win&&(best==null||d<Math.abs(best-t))) best=o;
  }
  return best;
};
SyncMap.snapWin=function(a,piece,compile,SM,an){ // a 64th note at this spot's local tempo
  const r=SyncMap.segRate(a,an.t), spPulse=r>0?1/r:0.2;
  const c=compile(piece);
  let sec=c.secStarts[0]; for(const x of c.secStarts) if(x.pulse<=an.p) sec=x;
  return spPulse*SM(piece,sec.name).sub/16;    // the beat is sub pulses; a 64th is a 16th of it
};

/* ---------------- the one door ----------------
   A MARKER'S ROLE IS WHERE IT STANDS (David, 14 Sep 2026: "the order of
   markers is deduced from where they are in the timeline … these two markers
   will change roles because I don't want to worry about which marker is
   labeled what"). A map is two sorted lists — the times he placed and the
   pulses that have markers — paired by rank. Every change to a map ends here,
   so a marker dragged past its neighbour swaps roles with it and no map can
   run backwards. In place: the anchor objects keep their identity (an editor
   holds the one it is dragging), their t and their g — g says whether THAT
   MOMENT sits on a stroke, so it travels with the time — and only p is dealt
   out again by rank. The table marks of the Lab already work this way. */
SyncMap.normalise=function(a){
  if(!a) return a;
  const ps=a.map(x=>x.p).sort((x,y)=>x-y);
  a.sort((x,y)=>x.t-y.t);
  for(let i=0;i<a.length;i++) a[i].p=ps[i];
  return a;
};

/* ---------------- Snap to hits ---------------- */
SyncMap.quantise=function(a,onsets,piece,compile,SM){ // every anchor onto its stroke; strokeless downbeats between their neighbours. Mutates and sorts `a`.
  let hit=0;
  for(const an of a){
    const o=SyncMap.nearestOnset(onsets,an.t,SyncMap.snapWin(a,piece,compile,SM,an));
    if(o!=null){ an.t=+o.toFixed(3); delete an.g; hit++; }
    else an.g=1;
  }
  let placed=0, kept=0;
  for(let i=0;i<a.length;i++){
    if(!a[i].g) continue;
    let L=i-1; while(L>=0&&a[L].g) L--;
    let R=i+1; while(R<a.length&&a[R].g) R++;
    if(L>=0&&R<a.length&&a[R].p!==a[L].p){ // spread runs evenly between the sure neighbours
      a[i].t=+(a[L].t+(a[i].p-a[L].p)/(a[R].p-a[L].p)*(a[R].t-a[L].t)).toFixed(3);
      placed++;
    } else kept++;
  }
  SyncMap.normalise(a);
  return {hit,placed,kept};
};

/* ---- Auto-map: a walker that does what a human tapping along does ----
   Predict the next downbeat from the local tempo, snap to a real stroke
   near the prediction, and let what it found correct the tempo estimate
   before the next bar — so speeding up (David's own tendency) is followed,
   not fought. Hand-placed anchors are law: the walker only ADDS anchors
   in the gaps/after them. Downbeats with no stroke are placed at the
   prediction and flagged for review (g). */
SyncMap.walkGap=function(L,R,targets,onsets,stats){ // fill targets strictly between two anchors
  const between=targets.filter(p=>p>L.p&&p<R.p);
  const out=[];
  if(!between.length) return out;
  let sppE=(R.t-L.t)/(R.p-L.p);            // seed: the span's own average tempo
  if(!(sppE>0)) return out;                // a backwards span maps nothing
  let curT=L.t, curP=L.p;
  for(const p of between){
    const sppRem=(R.t-curT)/(R.p-curP);    // the pull that guarantees landing on R
    const spp=0.45*sppE+0.55*sppRem;
    const pred=curT+(p-curP)*spp;
    const win=Math.max(0.08,spp*(p-curP)*0.25);
    const o=SyncMap.nearestOnset(onsets,pred,win);
    const an={p};
    if(o!=null){ an.t=+o.toFixed(3);
      sppE+=0.4*((an.t-curT)/(p-curP)-sppE); stats.hit++; }
    else { an.t=+pred.toFixed(3); an.g=1; stats.miss++; }
    out.push(an); curT=an.t; curP=p;
  }
  return out;
};
SyncMap.walkOn=function(a,targets,onsets,stats,piece,SM,dur){ // continue forward from the last anchor; dur = the recording's length, or null
  const last=a[a.length-1];
  let num=0,den=0;                         // local tempo from the last few taps
  for(let i=Math.max(1,a.length-3);i<a.length;i++){
    num+=a[i].t-a[i-1].t; den+=a[i].p-a[i-1].p; }
  let spp=den>0?num/den:0;
  // sanity rail: a seed wildly off the notated tempo means the taps don't
  // mean what they look like (e.g. bar taps made in beats mode) — fall back
  const sppN=60/(piece.tempo||72)/SM(piece,piece.arrangement[0]).sub;
  if(!(spp>0)||spp>sppN*3||spp<sppN/3) spp=sppN;
  const out=[];
  let curT=last.t, curP=last.p;
  for(const p of targets.filter(x=>x>last.p)){
    const pred=curT+(p-curP)*spp;
    if(dur!=null&&pred>dur+0.5) break;     // ran off the end of the recording
    const win=Math.max(0.08,spp*(p-curP)*0.25);
    const o=SyncMap.nearestOnset(onsets,pred,win);
    const an={p};
    if(o!=null){ an.t=+o.toFixed(3);
      spp+=0.4*((an.t-curT)/(p-curP)-spp); stats.hit++; }
    else { an.t=+pred.toFixed(3); an.g=1; stats.miss++; }
    out.push(an); curT=an.t; curP=p;
  }
  return out;
};

root.SyncMap=SyncMap;
})(typeof window!=="undefined"?window:globalThis);
