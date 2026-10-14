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
/* THE BAR'S CELLS, as the app cuts them (16 Sep 2026, app.html cellsOf): a section
   with a grouping — 7/8 as [3,2,2], counts per group — has a cell per group; without
   one, a cell per count. A "beat" here is a cell, so a grouped bar is tapped once per
   group and labelled by group. The offsets are pulses into the bar. */
SyncMap.cellStarts=function(m){
  const g=m.groups, ok=Array.isArray(g)&&g.length>1&&g.every(n=>Number.isInteger(n)&&n>0)&&g.reduce((a,b)=>a+b,0)===m.beats;
  const out=[]; let q=0;
  if(ok){ for(const n of g){ out.push(q); q+=n*m.sub; } }
  else for(let k=0;k<m.beats;k++) out.push(k*m.sub);
  return out;
};
SyncMap.beatStarts=function(piece,compile,SM){
  const out=[], c=compile(piece);
  for(const sec of c.secStarts){
    const s=piece.sections[sec.name]; if(!s) continue;
    const m=SM(piece,sec.name), starts=SyncMap.cellStarts(m);
    for(let b=0;b<s.bars.length;b++)
      for(const o of starts) out.push(sec.pulse+b*m.bp+o);
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
  const bar=Math.floor(rel/m.bp)+1, inBar=rel%m.bp, starts=SyncMap.cellStarts(m);
  let beat=1; for(let i=0;i<starts.length;i++) if(starts[i]<=inBar) beat=i+1;   // the cell (a group, in a grouped bar)
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
/* THE BEAT CLOCK (9 Oct 2026; patches/automap-beats.py). A pulse is not a fixed length: a table stored in sixteenths
   has twice the pulses a bar of one in eighths, at the same tempo. The walkers learnt a speed in seconds per PULSE
   from the markers before and carried it into a table on another grid - Feeling Good's A2 (12 a bar after A1's 6)
   came out ~1.5 bars a bar. They measure in BEATS: a pulse is 1/sub of its own section's beat, so U(p) is the beats
   from the start. Without a piece the clock is the pulses themselves, and on one grid it is the pulses over a
   constant - every walk on one grid is the walk it was. */
SyncMap.beatClock=function(piece,SM){
  if(!piece||!SM||!Array.isArray(piece.arrangement)){ const I=p=>p; I.sub=()=>1; return I; }
  const segs=[]; let p0=0,u0=0;
  for(const nm of piece.arrangement){ const s=piece.sections&&piece.sections[nm]; if(!s) continue;
    const m=SM(piece,nm), n=(s.bars||[]).length*m.bp; segs.push({p0,u0,sub:m.sub}); p0+=n; u0+=n/m.sub; }
  const seg=p=>{ let g=segs[0]; for(const x of segs){ if(x.p0<=p) g=x; else break; } return g; };
  const U=p=>{ const g=seg(p); return g?g.u0+(p-g.p0)/g.sub:p; };   // past the end: the last table's grid, continued
  U.sub=p=>{ const g=seg(p); return g?g.sub:1; };
  U.start=p=>{ const g=seg(p); return g?g.p0:0; };          // the table a pulse stands in, by its first pulse (placeLoose: which side of a break a marker belongs to)
  return U; };
SyncMap.walkGap=function(L,R,targets,onsets,stats,piece,SM){ // fill targets strictly between two anchors; piece+SM: measure in beats (beatClock)
  const between=targets.filter(p=>p>L.p&&p<R.p);
  const out=[];
  if(!between.length) return out;
  const U=SyncMap.beatClock(piece,SM);
  let sppE=(R.t-L.t)/(U(R.p)-U(L.p));      // seed: the span's own average tempo (seconds a beat; a pulse without a piece)
  if(!(sppE>0)) return out;                // a backwards span maps nothing
  let curT=L.t, curP=U(L.p);
  for(const p0 of between){ const p=U(p0);
    const sppRem=(R.t-curT)/(U(R.p)-curP);    // the pull that guarantees landing on R
    const spp=0.45*sppE+0.55*sppRem;
    const pred=curT+(p-curP)*spp;
    const win=Math.max(0.08,spp*(p-curP)*0.25);
    const o=SyncMap.nearestOnset(onsets,pred,win);
    const an={p:p0};
    if(o!=null){ an.t=+o.toFixed(3);
      sppE+=0.4*((an.t-curT)/(p-curP)-sppE); stats.hit++; }
    else { an.t=+pred.toFixed(3); an.g=1; stats.miss++; }
    out.push(an); curT=an.t; curP=p;
  }
  return out;
};
SyncMap.walkOn=function(a,targets,onsets,stats,piece,SM,dur){ // continue forward from the last anchor; dur = the recording's length, or null
  const last=a[a.length-1], U=SyncMap.beatClock(piece,SM);   // in beats, so a table on another grid keeps the tempo
  let num=0,den=0;                         // local tempo from the last few taps
  for(let i=Math.max(1,a.length-3);i<a.length;i++){
    num+=a[i].t-a[i-1].t; den+=U(a[i].p)-U(a[i-1].p); }
  let spp=den>0?num/den:0;
  // sanity rail: a seed wildly off the notated tempo means the taps don't
  // mean what they look like (e.g. bar taps made in beats mode) — fall back
  const sppN=60/(piece.tempo||72);   // a beat at the notated tempo (it was a pulse of the first table: the same rail on one grid)
  if(!(spp>0)||spp>sppN*3||spp<sppN/3) spp=sppN;
  const out=[];
  let curT=last.t, curP=U(last.p);
  for(const p0 of targets.filter(x=>x>last.p)){ const p=U(p0);
    const pred=curT+(p-curP)*spp;
    if(dur!=null&&pred>dur+0.5) break;     // ran off the end of the recording
    const win=Math.max(0.08,spp*(p-curP)*0.25);
    const o=SyncMap.nearestOnset(onsets,pred,win);
    const an={p:p0};
    if(o!=null){ an.t=+o.toFixed(3);
      spp+=0.4*((an.t-curT)/(p-curP)-spp); stats.hit++; }
    else { an.t=+pred.toFixed(3); an.g=1; stats.miss++; }
    out.push(an); curT=an.t; curP=p;
  }
  return out;
};

/* WALKING BACK (9 Oct 2026; patches/automap-walkback.py - David: start tapping on the first table's downbeat and
   let Auto-map place the pickup). From the first marker toward the start at the tempo of the first bars, each step
   landed on the stroke there; the first place without a stroke ends the walk (nothing is invented before the music),
   and so does the take's start. The targets are the bars' first written notes (firstNotes), oldest first. */
SyncMap.firstNotes=function(starts,before,has){ // each bar (or beat) start before `before`: its first pulse with a written note
  const S=starts.filter(x=>x<before).sort((x,y)=>x-y), out=[];
  for(let i=0;i<S.length;i++){ const end=Math.min(i+1<S.length?S[i+1]:before,before);
    for(let q=S[i];q<end;q++) if(has(q)){ out.push(q); break; } }
  return out;
};
SyncMap.walkBack=function(a,targets,onsets,stats,piece,SM){ // continue backward from the first anchor
  if(!a||!a.length) return [];
  const first=a[0], U=SyncMap.beatClock(piece,SM);
  let num=0,den=0; for(let i=1;i<Math.min(a.length,4);i++){ num+=a[i].t-a[i-1].t; den+=U(a[i].p)-U(a[i-1].p); }
  let spp=den>0?num/den:0; const sppN=60/((piece&&piece.tempo)||72);
  if(!(spp>0)||spp>sppN*3||spp<sppN/3) spp=sppN;
  const out=[]; let curT=first.t, curP=U(first.p);
  for(const p0 of targets.filter(x=>x<first.p).sort((x,y)=>y-x)){ const p=U(p0);
    const pred=curT-(curP-p)*spp; if(pred<0) break;
    const o=SyncMap.nearestOnset(onsets,pred,Math.max(0.08,spp*(curP-p)*0.25));
    if(o==null||o>=curT) break;                     // no stroke there: the music has not begun
    out.push({t:+o.toFixed(3),p:p0}); stats.hit++; curT=o; curP=p; }
  return out.reverse();
};
/* ALIGN THE NOTATION TO THE STROKES (9 Oct 2026; patches/lab-align.py - David: "set it in relation to what you know
   about the music from the notation"). d = {notes:[{p,n}] (the pulses that strike, n = how many at once), onsets:[t]
   (sorted), w:[0..1] (each stroke's strength, strokeStrengths), U (the beat clock)}. ONE path through the notes, each
   matched to a stroke or skipped, carrying its own seconds-a-beat: from a state the next note (up to BACK skipped) is
   predicted at t + spb*(beats between); a stroke near it costs 0.5*(miss/sigma)^2 (sigma = JIT + REL*interval), and
   SKIP a note skipped, EXTRA x the strength of the strokes passed over, a little for a weak stroke; the tempo moves GAIN
   of the way to the step's own. A beam search keeps the BEAM cheapest states a note. Pins are notes at fixed times: the
   path starts at the first (tempo spb0, or the line to the second) and ends at the last - or, freeEnd, wherever it is
   cheapest once the notes never reached are charged as skipped. Returns [{p,t,pin,dz}] (dz: the miss in sigmas). */
SyncMap.strokeStrengths=function(onsets,ch,sr){ // the level of the 40 ms after each stroke, against the take's 90th percentile
  const pk=(s0,s1)=>{ let m=0; for(let s=Math.max(0,s0);s<Math.min(ch.length,s1);s++){ const v=ch[s]<0?-ch[s]:ch[s]; if(v>m) m=v; } return m; };
  const lv=onsets.map(t=>pk(Math.round(t*sr),Math.round((t+0.04)*sr))), srt=lv.slice().sort((a,b)=>a-b), ref=srt[Math.floor(srt.length*0.9)]||1;
  return lv.map(v=>Math.min(1,v/ref)); };
SyncMap.alignNotes=function(d,opt){
  const o=Object.assign({JIT:0.015,REL:0.08,SKIP:3,EXTRA:2.5,BACK:4,GAIN:0.25,BEAM:60,WIN:0.35,PAUSE:6,MAXGAP:8},opt||{});   // PAUSE, MAXGAP: a note held longer (patches/lab-align-fermata.py)
  const on=d.onsets, w=d.w, cw=[0]; for(let j=0;j<on.length;j++) cw.push(cw[j]+w[j]);
  const lo=t=>{ let a=0,b=on.length; while(a<b){ const m=(a+b)>>1; if(on[m]<t) a=m+1; else b=m; } return a; };
  const pins=(o.pins||[]).slice().sort((a,b)=>a.p-b.p), pinAt=new Map(pins.map(x=>[x.p,x.t]));
  if(!pins.length) return null;
  const p0=pins[0].p, pEnd=o.freeEnd?Infinity:pins[pins.length-1].p;
  const have=new Set(d.notes.map(n=>n.p)), virt=pins.filter(x=>!have.has(x.p)).map(x=>({p:x.p,n:0}));   // a pin on a pulse with no note (an End, a rest) is a fixed point too (patches/lab-align-start.py)
  const N=d.notes.concat(virt).filter(n=>n.p>=p0&&n.p<=pEnd).sort((a,b)=>a.p-b.p), u=N.map(n=>d.U(n.p));
  if(!N.length||N[0].p!==p0) return null;   // the first pin is a note
  let spb0=o.spb0; if(!spb0&&pins.length>1) spb0=(pins[1].t-pins[0].t)/(d.U(pins[1].p)-d.U(pins[0].p));
  if(!(spb0>0)) return null;
  const L=N.map(()=>new Map());
  L[0].set(-1,{c:0,spb:spb0,t:pins[0].t,j:lo(pins[0].t)-0.5,prev:null,i:0,key:-1,dz:0});
  for(let i=0;i<N.length;i++){
    let S=[...L[i].values()]; if(S.length>o.BEAM){ S.sort((a,b)=>a.c-b.c); S=S.slice(0,o.BEAM); L[i]=new Map(S.map(s=>[s.key,s])); }
    for(const s of S){
      for(let k=i+1;k<=Math.min(N.length-1,i+o.BACK+1);k++){
        const du=u[k]-u[i], exp=s.spb*du, pred=s.t+exp, sig=o.JIT+o.REL*exp, skipped=k-i-1, jb=Math.floor(s.j);
        const step=(t,j,isPin,pause)=>{ const dt=(t-pred)/sig; if(Math.abs(dt)>6&&!isPin&&!pause) return;
          const ja=isPin?lo(t):j, extra=Math.max(0,cw[ja]-cw[jb+1]);
          const c=s.c+(pause?o.PAUSE:0.5*Math.min(dt*dt,36))+o.SKIP*skipped+o.EXTRA*extra+(isPin?0:0.5*(1-w[j])*(N[k].n>1?2:1));
          const kk=isPin?-1:j, old=L[k].get(kk); if(old&&old.c<=c) return;
          const spb=pause?s.spb:Math.max(s.spb*0.6,Math.min(s.spb*1.6,s.spb+o.GAIN*((t-s.t)/du-s.spb)));
          L[k].set(kk,{c,spb,t,j:isPin?lo(t)-0.5:j,prev:s,i:k,key:kk,dz:isPin?0:Math.abs(dt)}); };
        if(pinAt.has(N[k].p)) step(pinAt.get(N[k].p),-1,true);
        else { const r=Math.max(o.WIN*exp,0.06); for(let j=lo(pred-r);j<on.length&&on[j]<=pred+r;j++) if(on[j]>s.t+0.02) step(on[j],j,false);
          if(k===i+1){ let c=0; for(let j=lo(pred+r);j<on.length&&c<2&&on[j]<=pred+o.MAXGAP;j++) if(on[j]>s.t+0.02){ step(on[j],j,false,true); c++; } } }   // held longer than written: the first strokes after the window
        if(pinAt.has(N[k].p)) break; } } }   // never skip over a pin
  let best=null, bc=Infinity;
  if(o.freeEnd){ for(let i=0;i<N.length;i++) for(const s of L[i].values()){ const c=s.c+o.SKIP*(N.length-1-i); if(c<bc){ bc=c; best=s; } } }
  else for(const s of L[N.length-1].values()) if(s.c<bc){ bc=s.c; best=s; }
  if(!best) return null;
  const path=[]; for(let s=best;s;s=s.prev) path.push({p:N[s.i].p,t:s.t,pin:s.key===-1,dz:s.dz});
  path.reverse(); path.cost=bc; return path; };
/* WHERE THE PLAYTHROUGH IS (David: "the tempo map should start where that part of the waveform starts that correlates
   to the playthrough"). The opening (its first BEATS beats) slid along the strokes at any tempo 40-260 - the
   composition's tempo is often far from the take's - gives the tempo its best fits agree on (their median), and its
   half and double; then EVERY stroke where the piece still fits before the take ends is judged by the WHOLE piece
   (alignNotes, freeEnd, a narrow beam) and the best few by the full search: the cheapest is the playthrough. Talk
   before it fits nothing; a start at a repeat leaves the ending unplayed. */
SyncMap.findPlaythrough=function(d,dur,opt){
  const o=Object.assign({BEATS:16,TOP:12,BPM:[40,260],FULL:5},opt||{}), N=d.notes, on=d.onsets, w=d.w;
  if(!N.length||on.length<2) return null;
  const lo=t=>{ let a=0,b=on.length; while(a<b){ const m=(a+b)>>1; if(on[m]<t) a=m+1; else b=m; } return a; };
  const u0=d.U(N[0].p), notes=N.map(n=>({du:d.U(n.p)-u0})).filter(n=>n.du<=o.BEATS);
  const fit=(t0,spb)=>{ let hit=0; const used=new Set();
    for(const n of notes){ const t=t0+n.du*spb; let best=-1, bd=1; for(let j=lo(t-0.04);j<on.length&&on[j]<=t+0.04;j++){ const e=Math.abs(on[j]-t); if(e<bd){ bd=e; best=j; } } if(best>=0){ hit+=1-0.5*bd/0.04; used.add(best); } }
    const end=t0+notes[notes.length-1].du*spb; let extra=0; for(let j=lo(t0-0.02);j<on.length&&on[j]<=end+0.02;j++) if(!used.has(j)) extra+=w[j];
    return (hit-0.5*extra)/notes.length; };
  const C=[]; for(const t0 of on){ let best=-9,bs=0; for(let bpm=o.BPM[0];bpm<=o.BPM[1];bpm*=1.01){ const s=fit(t0,60/bpm); if(s>best){ best=s; bs=60/bpm; } } C.push({t:t0,s:best,spb:bs}); }
  C.sort((a,b)=>b.s-a.s); const pick=[]; for(const c of C){ if(pick.length>=o.TOP) break; if(pick.every(p=>Math.abs(p.t-c.t)>0.25)) pick.push(c); }
  const spbs=pick.map(c=>c.spb).sort((a,b)=>a-b), spbM=spbs[spbs.length>>1], uLen=d.U(N[N.length-1].p)-u0;
  const quick=[];
  /* each start at the agreed tempo, its half and double, AND at the tempo its own opening fits best (David, 9 Oct 2026,
     8.6 Someone Like You: the agreed 89 bpm hid the true start at ~62 - patches/lab-align-start.py) */
  const own=new Map(C.map(c=>[c.t,c.spb])), LAD=[]; for(let b=o.BPM[0];b<=o.BPM[1];b*=1.22) LAD.push(60/b);   // a ladder of tempos ~20% apart: the walk adapts within ~15%
  /* and where the piece ENDS, estimated from the waveform (David, 9 Oct 2026: "take into account when the piece finishes"):
     the last clear stroke - from a start, the beats to the last note over the time to it is that start's tempo, tried
     first; only clear strokes are starts */
  const clear=on.filter((t,i)=>w[i]>=0.15), tEnd=clear.length?clear[clear.length-1]:null;
  for(const t0 of on){ if(w[on.indexOf(t0)]<0.15) continue; const tried=[];
    for(const spb of [tEnd&&tEnd>t0?(tEnd-t0)/uLen:null,spbM,own.get(t0)].concat(LAD)){ if(!(spb>0)||60/spb<o.BPM[0]||60/spb>o.BPM[1]) continue;
      if(tried.some(x=>Math.abs(x/spb-1)<0.08)) continue; tried.push(spb); if(dur&&t0+0.8*uLen*spb>dur) continue;
      const path=SyncMap.alignNotes(d,{pins:[{p:N[0].p,t:t0}],spb0:spb,freeEnd:true,BEAM:12,BACK:3}); if(path) quick.push({t:t0,spb,cost:path.cost}); } }
  quick.sort((a,b)=>a.cost-b.cost);
  let best=null;
  const short=[]; for(const c of quick){ if(short.length>=o.FULL) break; if(!short.some(x=>Math.abs(x.t-c.t)<0.02)) short.push(c); }   // the best few different starts, each at its best tempo (patches/lab-align-start.py)
  const done=[]; for(const c of short){ const path=SyncMap.alignNotes(d,{pins:[{p:N[0].p,t:c.t}],spb0:c.spb,freeEnd:true}); if(path) done.push(path); }
  /* two starts the whole piece cannot tell apart (within 3): the one on the more clearly struck first stroke - a
     playthrough begins with a stroke, not a murmur (2.6.2: 2.22 s 0.32 over 2.40 s 0.19; 3.6: 3.01 s 1.00 over 2.70 s 0.26) */
  if(done.length){ const m=Math.min(...done.map(x=>x.cost)), str=x=>{ const j=on.indexOf(x[0].t); return j>=0?w[j]:0; };
    /* THE OPENING PHRASE DECIDES (David, 9 Oct 2026: "take into account context and the phrase that is being played in
       relation to what is notated"): over the first two bars from its first note, every note should find its stroke and
       the accents (acc: notes struck together, a doum) land on strong strokes (patches/lab-align-phrase.py) */
    const phrase=x=>{ const u0=d.U(x[0].p), hit=new Map(x.map(s=>[s.p,s])); let se=0,sm=0,sw=0;
      for(const n of N){ const du=d.U(n.p)-u0; if(du<0) continue; if(du>8) break; const e=n.acc||n.n||1; se+=e; const s=hit.get(n.p);
        if(s){ sm+=e; const j=on.indexOf(s.t); sw+=e*(j>=0?w[j]:0); } }
      return se?(sm+sw)/se:0; };
    best=done.filter(x=>x.cost<=m+3).sort((a,b)=>phrase(b)-phrase(a)||a[0].t-b[0].t)[0]; }
  for(const c of []){ const path=SyncMap.alignNotes(d,{pins:[{p:N[0].p,t:c.t}],spb0:c.spb,freeEnd:true}); if(path&&(!best||path.cost<best.cost)) best=path; }
  return best; };
/* THE TEMPO FROM ONE MARKER IS THE WHOLE PIECE'S (David, 9 Oct 2026, 8.6 Someone Like You: from his first beat the
   opening's own fit gave 150-166 bpm for ~62): the walk from the marker is tried at a ladder of tempos ~20% apart and
   at the opening's, and the one from which the whole piece fits best is the tempo (patches/lab-align-start.py) */
SyncMap.tempoAt=function(d,p,t,opt){
  const o=Object.assign({BPM:[40,260]},opt||{}), cand=[]; for(let b=o.BPM[0];b<=o.BPM[1];b*=1.22) cand.push(60/b);
  const op=SyncMap.openingTempo(d,p,t,opt); if(op) cand.push(op);
  let best=null; for(const spb of cand){ const r=SyncMap.alignNotes(d,{pins:[{p,t}],spb0:spb,freeEnd:true,BEAM:12,BACK:3}); if(r&&(!best||r.cost<best.cost)) best={cost:r.cost,spb}; }
  return best?best.spb:op; };
SyncMap.openingTempo=function(d,p,t,opt){ // seconds a beat that best fits the notes from pulse p played from time t (any tempo 40-260)
  const o=Object.assign({BEATS:16,BPM:[40,260]},opt||{}), on=d.onsets, w=d.w;
  const lo=x=>{ let a=0,b=on.length; while(a<b){ const m=(a+b)>>1; if(on[m]<x) a=m+1; else b=m; } return a; };
  const u0=d.U(p), notes=d.notes.filter(n=>n.p>=p).map(n=>({du:d.U(n.p)-u0})).filter(n=>n.du<=o.BEATS); if(notes.length<3) return null;
  let best=-9, bs=null;
  for(let bpm=o.BPM[0];bpm<=o.BPM[1];bpm*=1.01){ const spb=60/bpm; let hit=0; const used=new Set();
    for(const n of notes){ const x=t+n.du*spb; let bj=-1, bd=1; for(let j=lo(x-0.04);j<on.length&&on[j]<=x+0.04;j++){ const e=Math.abs(on[j]-x); if(e<bd){ bd=e; bj=j; } } if(bj>=0){ hit+=1-0.5*bd/0.04; used.add(bj); } }
    const end=t+notes[notes.length-1].du*spb; let extra=0; for(let j=lo(t-0.02);j<on.length&&on[j]<=end+0.02;j++) if(!used.has(j)) extra+=w[j];
    const s=(hit-0.5*extra)/notes.length; if(s>best){ best=s; bs=spb; } }
  return bs; };
/* THE CHECK (9 Oct 2026; patches/lab-align-check.py - David: "a step where the app checks for accuracy and then makes
   corrections"). Each marker in `only` (the new ones on notes) must sit where the waveform jumps: the 10 ms after at least
   RISE x the 10 ms before. One that does not looks within WIN - never past half the way to its neighbours - for the place
   it jumps most (at least FOUND x, at least half the loudest there) and moves onto that place's first 2 ms block that
   passes the level before; none such - g (purple, to review). Returns {moved, flagged}. */
SyncMap.checkMarks=function(ch,sr,marks,only,opt){   // opt.U: the beat clock; opt.silent: markers with no note; opt.notes: the pulses that strike (patches/lab-snap-rule.py)
  const o=Object.assign({RISE:1.3,FOUND:1.5,WIN:0.06},opt||{}), K=Math.round(0.01*sr), B=Math.max(1,Math.round(0.002*sr));
  const pk=(a,b)=>{ let m=0; for(let i=Math.max(0,a);i<Math.min(ch.length,b);i++){ const v=ch[i]<0?-ch[i]:ch[i]; if(v>m) m=v; } return m; };
  const J=t=>{ const s=Math.round(t*sr), f=pk(s,s+K), b=pk(s-K,s); return {r:f/(b+1e-9),f,b}; };
  const S=marks.slice().sort((a,b)=>a.p-b.p), U=o.U, silent=new Set(o.silent||[]), N=(o.notes||[]).slice().sort((a,b)=>a-b);
  const loose=m=>!!(m.g||m.s);
  const nb=(i,ok)=>{ let a=i-1; while(a>=0&&!ok(S[a])) a--; let z=i+1; while(z<S.length&&!ok(S[z])) z++; return [a>=0?S[a]:null,z<S.length?S[z]:null]; };
  const t0=new Map(S.map(m=>[m,m.t]));
  /* ITS ACCENT, WHERE ITS BEAT BELONGS (David, 9 Oct 2026): around the calculated place between the nearest neighbours
     that have their own, and only as far as halfway to the notation's next note either side - an accent nearer that
     note's expected time is that note's. Twice: the second time from the neighbours the first settled. */
  /* the stroke the notation gives it (David, 9 Oct 2026: "compare it to the strokes in the notation, which one lands on
     the beat"): with opt.d, every note between its two neighbours that have their own accent is lined up with the
     strokes (alignNotes, the neighbours pinned) - the one its note gets is its, refined to that stroke's first strong
     attack; a note the line skips, or a stroke with no jump in the waveform (a phantom), leaves it without */
  const noteSet=o.d?new Set(o.d.notes.map(n=>n.p)):null;
  const refine=(t)=>{ if(J(t).r>=o.RISE) return t;   // the onset finder's own stroke, on a real jump: as it placed it
    const lo=t-0.01, hi=t+0.08; let mx=0;   // a phantom (the finder's early fallback): the real attack is later for(let x=lo;x<=hi;x+=0.002) mx=Math.max(mx,J(x).f);
    const runs=[]; let cur=null; for(let x=lo;x<=hi;x+=0.002){ const q=J(x); if(q.r>=o.FOUND&&q.f>=0.5*mx){ if(!cur||x-cur.last>0.01){ cur={t:x,g:q.f-q.b,b:q.b,last:x}; runs.push(cur); } else { cur.last=x; if(q.f-q.b>cur.g){ cur.t=x; cur.g=q.f-q.b; cur.b=q.b; } } } }
    if(!runs.length) return J(t).r>=o.RISE?t:null;
    const g=[]; for(const r of runs){ if(!g.length||r.t-g[g.length-1].t<0.06) g.push(r); else break; }
    const gm=Math.max(...g.map(r=>r.g)), f=g.find(r=>r.g>=0.5*gm); let tt=f.t;
    for(let k=0;k<5;k++){ const s=Math.round((f.t+k*0.002)*sr); if(pk(s,s+B)>f.b){ tt=f.t+k*0.002; break; } } return +tt.toFixed(3); };
  for(let pass=0;pass<2;pass++) for(let i=0;i<S.length;i++){ const m=S[i]; if(!only.has(m)||m.s||silent.has(m)) continue;
    if(o.d){ const [PA,PZ]=nb(i,x=>x!==m&&!loose(x)&&!silent.has(x)&&noteSet.has(x.p));
      if(PA&&PZ){ const path=SyncMap.alignNotes(o.d,{pins:[{p:PA.p,t:PA.t},{p:PZ.p,t:PZ.t}]}), hit=path&&path.find(x=>x.p===m.p&&!x.pin);
        const r=hit?refine(hit.t):null; if(r!=null){ if(Math.abs(r-m.t)>0.006) m.t=r; delete m.g; } else m.g=1; continue; } }   // within 6 ms of its stroke: it stays
    const [A,Z]=nb(i,x=>x!==m&&!loose(x)&&!silent.has(x));
    let ctr=t0.get(m), spb=null;
    if(U&&A&&Z){ const ua=U(A.p), uz=U(Z.p); if(uz>ua&&Z.t>A.t){ spb=(Z.t-A.t)/(uz-ua); ctr=A.t+(U(m.p)-ua)*spb; } }
    /* the reach: halfway to the notation's neighbouring notes (their expected times) - tight where the notes are
       dense, wide where nothing competes; a fixed WIN only where the notation gives nothing */
    let lo=ctr-o.WIN, hi=ctr+o.WIN;
    if(spb&&N.length){ let k=0; while(k<N.length&&N[k]<m.p) k++; const pv=k>0?N[k-1]:null, nx=N[k]===m.p?N[k+1]:N[k];
      if(pv!=null) lo=ctr-(U(m.p)-U(pv))*spb/2; if(nx!=null) hi=ctr+(U(nx)-U(m.p))*spb/2; }
    if(A) lo=Math.max(lo,(A.t+ctr)/2); if(Z) hi=Math.min(hi,(ctr+Z.t)/2);
    if(m.t>=lo&&m.t<=hi&&J(m.t).r>=o.RISE){ delete m.g; continue; }      // on an accent where its beat belongs: it stays
    let mx=0; for(let t=lo;t<=hi;t+=0.002) mx=Math.max(mx,J(t).f);
    /* the accents in reach (each a run of qualifying spots, its biggest jump standing for it): the one nearest the
       calculated place is this note's - the notation bounds the reach, the place chooses within it */
    const runs=[]; let cur=null;
    for(let t=lo;t<=hi;t+=0.002){ const q=J(t); if(q.r>=o.FOUND&&q.f>=0.5*mx){ if(!cur||t-cur.last>0.01){ cur={t,g:q.f-q.b,b:q.b,last:t}; runs.push(cur); } else { cur.last=t; if(q.f-q.b>cur.g){ cur.t=t; cur.g=q.f-q.b; cur.b=q.b; } } } }
    /* a stack is ONE accent: runs under 60 ms apart are one stroke, which starts at its first strong attack (at least
       half its biggest) - the second hand of a stack is not another candidate */
    const groups=[]; for(const r of runs){ const g=groups[groups.length-1]; if(g&&r.t-g[g.length-1].t<0.06) g.push(r); else groups.push([r]); }
    let best=null, bd=Infinity;
    for(const g of groups){ const gm=Math.max(...g.map(r=>r.g)), first=g.find(r=>r.g>=0.5*gm); const d=Math.min(...g.map(r=>Math.abs(r.t-ctr))); if(d<bd){ bd=d; best=first; } }
    if(best){ let t=best.t; for(let k=0;k<5;k++){ const s=Math.round((best.t+k*0.002)*sr); if(pk(s,s+B)>best.b){ t=best.t+k*0.002; break; } }
      m.t=+t.toFixed(3); delete m.g; }
    else m.g=1; }
  let moved=0, flagged=0;
  for(const m of S) if(only.has(m)&&!m.s&&!silent.has(m)){ if(m.g) flagged++; else if(Math.abs(m.t-t0.get(m))>0.0005) moved++; }
  const placed=U?SyncMap.placeLoose(marks,U,m=>silent.has(m)||(only.has(m)&&loose(m))):0;
  return {moved,flagged,placed}; };
/* A MARKER WITHOUT AN ACCENT OF ITS OWN SITS AT ITS CALCULATED PLACE (David, 9 Oct 2026): purple (g) or silent (s), it
   goes between the nearest neighbours that are neither, in beats - halfway in the music, halfway between them. `which`
   narrows the markers it may move; commitMap runs it on every change, so moving an accented marker carries them.
   IN A BREAK A CALCULATED MARKER KEEPS THE TEMPO OF ITS OWN TABLE (David, 12 Oct 2026: "The marker currently stays on the
   screen after the end of a table"). Halfway between its neighbours is right inside the music and wrong across a pause:
   a table's last count with no accent of its own stood halfway to the NEXT table's first beat, in the middle of the
   pause, and the marker lit up there. Where the stretch between the two firm neighbours is a break - more than twice as
   slow as the stretch before it, the export's own rule (fcpSpans) - the marker is counted on from the firm marker before
   it at the tempo that led up to that one; or, when it stands in the table of the firm marker after the break (U.start),
   counted back from that one at the tempo that follows it. patches/sync-loose-in-a-break.py */
SyncMap.placeLoose=function(marks,U,which){
  const S=marks.slice().sort((a,b)=>a.p-b.p), loose=m=>!!(m.g||m.s); let n=0;
  for(let i=0;i<S.length;i++){ const m=S[i]; if(!loose(m)||(which&&!which(m))) continue;
    let a=i-1; while(a>=0&&loose(S[a])) a--; let z=i+1; while(z<S.length&&loose(S[z])) z++;
    if(a<0||z>=S.length) continue; const A=S[a], Z=S[z], ua=U(A.p), uz=U(Z.p); if(!(uz>ua)||!(Z.t>A.t)) continue;
    let tt=A.t+(Z.t-A.t)*(U(m.p)-ua)/(uz-ua);              // halfway in the music, halfway between them
    { let pa=a-1; while(pa>=0&&loose(S[pa])) pa--; let nz=z+1; while(nz<S.length&&loose(S[nz])) nz++;
      const um=U(m.p), tab=U.start||null;
      const r0=pa>=0&&ua>U(S[pa].p)&&A.t>S[pa].t?(A.t-S[pa].t)/(ua-U(S[pa].p)):0;                 // seconds a beat, up to A
      const r1=nz<S.length&&U(S[nz].p)>uz&&S[nz].t>Z.t?(S[nz].t-Z.t)/(U(S[nz].p)-uz):0;            // and on from Z
      if(r0>0&&(Z.t-A.t)/(uz-ua)>2*r0){                    // a break between A and Z
        if(tab&&tab(m.p)===tab(Z.p)&&tab(Z.p)!==tab(A.p)){ if(r1>0) tt=Math.max(A.t,Z.t-(uz-um)*r1); }   // in the table that follows the break
        else tt=Math.min(Z.t,A.t+(um-ua)*r0); } }           // in the table before it, or inside one table
    const t=+tt.toFixed(3); if(Math.abs(t-m.t)>0.0005){ m.t=t; n++; } }
  return n; };
root.SyncMap=SyncMap;
})(typeof window!=="undefined"?window:globalThis);
