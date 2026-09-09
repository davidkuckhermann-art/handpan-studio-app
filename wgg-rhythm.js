/* wgg-rhythm.js — the jam's RHYTHM TRACK: World Groove Grid's player, ported
   onto Handpan Studio's own clock and graph (8 Sep 2026).

   PORTED, NOT SHARED (CLAUDE.md). The shape of this file is the lesson-embed
   mini's runtime — make_mini.py's page() at WGG commit c531347: ensureReady,
   pickSession, pickType, fire, fireRing, fireOS, fireShortOS, muteRings and
   the scheduler's fire branch — with three deliberate differences:

   1. THERE IS NO CLOCK HERE. The app's scheduler (sched() in app.html) owns
      time; it asks this file "what sounds on step i, at time t, with steps
      this long?" and that is fireStep(). The two players never disagree about
      where beat one is because there is only one beat one.
   2. THE GRAPH IS THE APP'S. Row → pan → the rhythm bus (its volume) → the
      app's dry and send, so the drums sit in the same room as the pan and
      under the same soft-clip limiter. No second context, no second reverb.
   3. EVERY VOICE HANDS THE APP A GAIN IT MAY SILENCE. The mini's fire() puts
      its fades on the voice's own gain; here that automated gain feeds a
      second, plain one which joins the app's `live` list — because the app's
      silencers (stop, jumpTo, followHush, jamFadeLiveTo) ramp a live gain to
      zero WITHOUT cancelling what is scheduled on it, and an automated node
      would raise itself back up at its next event. The bass found this on
      its first evening; the drums are built with it from the start.

   The engine functions (warpCell, strokesFromList, analyzeCell, the RING
   settings and helpers) come from wgg-engine.js, WGG's engine.js verbatim.
   Reads the app's globals: ctx, dry, send, live. */
(function(){
"use strict";
const W=window.HPSWGG={};
let LIB=null, GROOVES=null, groove=null, ROWS=[], rr={}, RINGS={};
let bus=null, pans={}, graphCtx=null, vol=1;
let prepared=null;          // {gid, sd} the last groove+step length made ready
let pending=null;           // the promise of a preparation in flight

// ---------------- the grooves (David's, read from WGG's store by make_wgg_bank.py)
W.grooves=()=>GROOVES||[];
W.loaded=()=>!!LIB;
W.attach=function(bank){ LIB=bank.lib; GROOVES=bank.grooves; W.source=bank.source; };

function toks(pat){
  const out=[], re=/([DTPKJ])(_?)|./g; let m;
  while((m=re.exec(String(pat||"")))) out.push(m[1]?{a:m[1],art:m[2]?"stop":null}:null);
  return out;
}
function deriveCells(pat){
  const hits=[]; for(let i=0;i<pat.length;i++) if(pat[i]) hits.push([i,pat[i]]);
  const cells=[];
  for(let n=0;n<hits.length;n++){
    const nxt=n+1<hits.length?hits[n+1][0]:hits[0][0]+pat.length;
    cells.push({s:hits[n][0],a:hits[n][1].a,art:hits[n][1].art,l:nxt-hits[n][0]});
  }
  return cells;
}
/* choose a groove: its rows become cells; nothing is decoded yet */
W.use=function(gid){
  const g=(GROOVES||[]).find(x=>x.id===gid)||(GROOVES||[])[0];
  if(!g) return null;
  if(groove&&groove.id===g.id) return groove;
  groove=g;
  ROWS=g.rows.filter(r=>LIB&&LIB[r.set]&&!r.mute).map(r=>({
    id:r.set, gain:+r.gain||0, pan:+r.pan||0, eng:r.eng==="drum"?"drum":"natural",
    cells:deriveCells(toks(r.p))}));
  rr={}; RINGS={}; pans={}; prepared=null;
  return groove;
};
W.groove=()=>groove;
W.steps=()=>groove?groove.steps:16;

// ---------------- which recorded cell voices each step (the mini's pickType/pickSession)
function pickType(banks,accent,len){
  const acc=accent==="K"?"T":accent;
  let best=null,bd=1e9;
  for(const t of Object.keys(banks)){
    const m=/^([A-Z])(\d+)$/.exec(t); if(!m) continue;
    const a=m[1]==="K"?"T":m[1];
    if(a!==acc) continue;
    const d=Math.abs(+m[2]-len);
    if(d<bd){bd=d;best=t;}
  }
  return best;
}
function pickSession(L,bpm){
  const ss=L.sessions;
  if(ss.length<2) return ss[0];
  for(let i=0;i<ss.length-1;i++){
    const a=ss[i].bpm,b=ss[i+1].bpm;
    const cut=L.handoffs[a+"|"+b] ?? Math.exp((0.03*Math.log(a)+0.10*Math.log(b))/0.13);
    if(bpm<cut) return ss[i];
  }
  return ss[ss.length-1];
}
function scrub(buf){for(let c=0;c<buf.numberOfChannels;c++){const d=buf.getChannelData(c);
  for(let i=0;i<d.length;i++)if(!Number.isFinite(d[i]))d[i]=0;}return buf;}
function peakOf(b){let p=0;for(let c=0;c<b.numberOfChannels;c++){const d=b.getChannelData(c);
  for(let i=0;i<d.length;i+=7){const v=Math.abs(d[i]);if(v>p)p=v;}}return p||1;}
async function decodeURI64(d){const b64=atob(d.split(",")[1]);const a=new Uint8Array(b64.length);
  for(let i=0;i<b64.length;i++)a[i]=b64.charCodeAt(i);return ctx.decodeAudioData(a.buffer);}

/* DECODE AND WARP what the chosen groove needs, for ONE step length. The takes
   are AAC in an .m4a container, so the decoded buffer starts exactly where the
   WAV did and the manifest's stroke positions need no correction (the mini's
   note, 21 Aug 2026). Accent-only anchors at quantise 0, as both WGG players. */
async function ensureRow(row,sd){
  const L=LIB[row.id], bpm=15/sd, S=pickSession(L,bpm);
  S.map=S.map||{};
  const need=new Set();
  for(const c of row.cells){
    const k=c.a+c.l;
    if(S.map[k]===undefined) S.map[k]=pickType(S.banks,c.a,c.l);
    if(S.map[k]) need.add(S.map[k]);
    if(c.art==="stop"){
      const ks="short:"+c.a;
      if(S.map[ks]===undefined) S.map[ks]=pickType(S.banks,c.a,0);
      if(S.map[ks]) need.add(S.map[ks]);
    }
  }
  S.buffers=S.buffers||{};
  for(const ty of need){
    if(S.buffers[ty]) continue;
    const bufs=[];
    for(const t of S.banks[ty]){
      const buf=await decodeURI64(t.d);
      const ps=60/S.bpm/L.div;
      t.strokes=(t.st&&t.st.length)?strokesFromList(t.st,ps,t.pre,t.sm,buf.duration):analyzeCell(buf,ps,t.pre);
      bufs.push(buf);
    }
    S.buffers[ty]=bufs;
    (S.peaks=S.peaks||{})[ty]=bufs.map(peakOf);
  }
  if(L.os&&!L.osb){
    const osb={pre:L.os.pre, g:L.os.g||0, tails:[], shots:{}};
    for(const t of L.os.tails){const buf=await decodeURI64(t.d); osb.tails.push({buf,peak:peakOf(buf)});}
    for(const k of Object.keys(L.os.shots)){
      osb.shots[k]=[];
      for(const sh of L.os.shots[k]){const buf=await decodeURI64(sh.d); osb.shots[k].push({buf,peak:peakOf(buf)});}
    }
    osb.short=!!L.os.short;
    L.osb=osb;
  }
  L.cur=S;
  const ratio=sd/(60/S.bpm/L.div);
  L.ratio=ratio;
  S.warped=S.warped||{};
  if(Math.abs(ratio-1)<1e-4){S.wratio=1;return;}
  if(S.wratio!==ratio){S.warped={};S.wratio=ratio;}
  for(const ty of need)
    if(!S.warped[ty])
      S.warped[ty]=S.buffers[ty].map((b,i)=>scrub(warpCell(b,S.banks[ty][i].strokes.slice(0,1),0,ratio,null)));
}
/* Make the chosen groove ready at this step length. Safe to call every
   scheduler pass: it returns at once when nothing changed, and while a
   preparation is in flight it hands back that same promise. */
W.prepare=function(sd){
  if(!LIB||!groove||!ctx||!(sd>0)) return Promise.resolve(false);
  if(prepared&&prepared.gid===groove.id&&Math.abs(prepared.sd-sd)<1e-6) return Promise.resolve(true);
  if(pending&&pending.sd===sd&&pending.gid===groove.id) return pending.p;
  const gid=groove.id;
  const p=(async()=>{
    for(const row of ROWS) await ensureRow(row,sd);
    if(groove&&groove.id===gid){ prepared={gid,sd}; }
    return true;
  })().finally(()=>{ if(pending&&pending.p===p) pending=null; });
  pending={gid,sd,p};
  return p;
};
W.ready=function(sd){ return !!(prepared&&groove&&prepared.gid===groove.id&&(sd==null||Math.abs(prepared.sd-sd)<1e-6)); };

// ---------------- the graph: row → pan → bus → the app's dry + send
function ensureGraph(){
  if(graphCtx===ctx&&bus) return;
  graphCtx=ctx; pans={};
  bus=ctx.createGain(); bus.gain.value=vol;
  bus.connect(dry); bus.connect(send);
}
function nodeFor(ri){
  ensureGraph();
  if(!pans[ri]){
    const row=ROWS[ri];
    const g=ctx.createGain(); g.gain.value=Math.pow(10,(row.gain||0)/20);
    let out=g;
    /* the grid's pan is a FRACTION, -1..1, handed straight to the panner —
       build_grid.py's row.panNode.pan.value=row.pan (the mini's percent table
       is for URL-carried pans, not saved grids); /100 here had flattened
       every pan David set to a whisper (found 9 Sep on the reimport) */
    if(ctx.createStereoPanner){ const p=ctx.createStereoPanner(); p.pan.value=Math.max(-1,Math.min(1,+row.pan||0)); g.connect(p); out=p; }
    out.connect(bus); pans[ri]=g;
  }
  return pans[ri];
}
W.setVolume=function(pct){ vol=Math.max(0,Math.min(1.5,(+pct||0)/100)); if(bus) bus.gain.value=vol; };
/* the plain gain the app may silence — every voice ends in one of these */
function liveOut(ri,at){
  const g=ctx.createGain(); g.gain.value=1; g.__at=at;
  g.connect(nodeFor(ri));
  live.push(g); if(live.length>120) live.splice(0,40);
  return g;
}
function endVoice(s,g,stopAt){
  s.stop(stopAt);
  s.onended=()=>{ const i=live.indexOf(g); if(i>=0) live.splice(i,1); try{g.disconnect();}catch(e){} };
}

// ---------------- playback (the mini's fire, with the env/live split)
function fire(ri,ty,when,opts){
  const row=ROWS[ri], L=LIB[row.id], S=L.cur; if(!S||!ty) return null;
  const bank=(S.wratio&&S.wratio!==1?S.warped:S.buffers)[ty];
  if(!bank||!bank.length) return null;
  rr[ri]=rr[ri]||{};
  const i=(rr[ri][ty]=(rr[ri][ty]||0)+1)%bank.length;
  const t=S.banks[ty][i], buf=bank[i], pre=t.pre*(S.wratio&&S.wratio!==1?L.ratio:1);
  const lin=Math.pow(10,(t.g||0)/20);
  const at=Math.max(ctx.currentTime,when-pre);
  let len=buf.duration;
  let cutAt=(opts&&opts.cutAt!=null)?opts.cutAt-0.005:null;
  if(opts&&opts.stop){
    const wr=(S.wratio&&S.wratio!==1)?L.ratio:1, st=t.strokes||[];
    const atk=at+(st.length?st[0].t*wr:pre);
    const ghost=st.length>1?at+st[1].t*wr:atk+opts.stop;
    if(cutAt==null||ghost-0.005<cutAt) cutAt=ghost-0.005;
  }
  const cut=cutAt!=null&&cutAt<at+len;
  if(cut) len=Math.max(0.0015,cutAt-at);
  const s=ctx.createBufferSource(); s.buffer=buf;
  const env=ctx.createGain();
  env.gain.setValueAtTime(0,at);
  env.gain.linearRampToValueAtTime(lin,at+0.0015);
  if(cut){
    env.gain.setValueAtTime(lin,Math.max(at+0.0015,at+len-0.015));
    env.gain.linearRampToValueAtTime(0,at+len);
  }else if(opts&&opts.fadeFrom!=null){
    const f0=at+opts.fadeFrom, d=Math.max(0.001,len-opts.fadeFrom);
    if(RING.curve==="eq") env.gain.setValueCurveAtTime(ringCurveDown(lin),f0,d);
    else { env.gain.setValueAtTime(lin,f0); env.gain.linearRampToValueAtTime(0,at+len); }
  }else{
    env.gain.setValueAtTime(lin,at+len-0.008);
    env.gain.linearRampToValueAtTime(0,at+len);
  }
  const g=liveOut(ri,at);
  s.connect(env); env.connect(g);
  s.start(at); endVoice(s,g,at+len+0.02);
  return {i,buf,lin,at,len,pre};
}
function muteRings(ri,when){
  if(!RING.stop||!RINGS[ri]) return;
  for(const v of RINGS[ri]){ if(v.end<=when) continue; try{
    v.g.gain.cancelScheduledValues(when); v.g.gain.setValueAtTime(v.g.gain.value,when);
    v.g.gain.linearRampToValueAtTime(0,when+RING.stopMs); v.s.stop(when+RING.stopMs+0.02);
    v.end=when+RING.stopMs+0.02; }catch(e){} }
  RINGS[ri]=RINGS[ri].filter(v=>v.end>ctx.currentTime-0.1);
}
function fireRing(ri,ty,when,cutAt){
  const row=ROWS[ri], L=LIB[row.id], S=L.cur, osb=L.osb;
  if(!S||!ty||!osb||!osb.tails.length) return fire(ri,ty,when,{cutAt});
  const bank=(S.wratio&&S.wratio!==1?S.warped:S.buffers)[ty]; if(!bank||!bank.length) return null;
  rr[ri]=rr[ri]||{};
  const ti=((rr[ri][ty]||0)+1)%bank.length;
  const cellBuf=bank[ti], ratio=(S.wratio&&S.wratio!==1?L.ratio:1);
  const st=S.banks[ty][ti].strokes||[], last=st.length?st[st.length-1].t*ratio:0;
  const fadeFrom=ringFadeFrom(cellBuf.duration,last);
  const cell=fire(ri,ty,when,{fadeFrom,cutAt}); if(!cell) return null;
  const preC=cell.pre, cPeak=((S.peaks||{})[ty]||[])[ti]||1;
  const cands=osb.tails.map((t,j)=>({key:"tail",j,buf:t.buf,peak:t.peak}));
  const pick=ringChoose(cellBuf,cPeak,fadeFrom,preC,cands,osb.pre,RING.pick);
  let c=pick&&pick.best;
  if(!c){ c=cands[(rr[ri].tail=(rr[ri].tail||0)+1)%cands.length]; }
  const lin=cell.lin*(cPeak/(c.peak||1))*Math.pow(10,RING.db/20);
  const at=cell.at+preC-osb.pre;
  const f0=cell.at+fadeFrom, f1=cell.at+cell.len, d=Math.max(0.001,f1-f0);
  const s=ctx.createBufferSource(); s.buffer=c.buf; const g=ctx.createGain();
  g.gain.setValueAtTime(0,at);
  if(RING.curve==="eq") g.gain.setValueCurveAtTime(ringCurveUp(lin),f0,d);
  else { g.gain.setValueAtTime(0,f0); g.gain.linearRampToValueAtTime(lin,f1); }
  const end=at+c.buf.duration;
  g.gain.setValueAtTime(lin,end-0.02); g.gain.linearRampToValueAtTime(0,end);
  const out=liveOut(ri,at);
  s.connect(g); g.connect(out); s.start(at); endVoice(s,out,end+0.02);
  (RINGS[ri]=RINGS[ri]||[]).push({s,g,end});
  return cell;
}
function fireOS(ri,accent,when){
  const row=ROWS[ri], L=LIB[row.id], osb=L.osb; if(!osb) return;
  const key=accent==="K"?"T":accent, bank=osb.shots[key];
  if(!bank||!bank.length) return;
  rr[ri]=rr[ri]||{};
  const sh=bank[(rr[ri]["os"+key]=(rr[ri]["os"+key]||0)+1)%bank.length];
  const lin=Math.pow(10,(osb.g||0)/20);
  const at=Math.max(ctx.currentTime,when-osb.pre), len=sh.buf.duration;
  const s=ctx.createBufferSource(); s.buffer=sh.buf; const g=ctx.createGain();
  g.gain.setValueAtTime(0,at); g.gain.linearRampToValueAtTime(lin,at+0.0015);
  g.gain.setValueAtTime(lin,at+len-0.02); g.gain.linearRampToValueAtTime(0,at+len);
  const out=liveOut(ri,at);
  s.connect(g); g.connect(out); s.start(at); endVoice(s,out,at+len+0.02);
  if(accent==="D") (RINGS[ri]=RINGS[ri]||[]).push({s,g,end:at+len});
}
function fireShortOS(ri,accent,when){
  const row=ROWS[ri], L=LIB[row.id], S=L.cur, osb=L.osb;
  if(!osb||!osb.short) return false;
  const key=accent==="K"?"T":accent, bank=osb.shots[key];
  if(!bank||!bank.length) return false;
  rr[ri]=rr[ri]||{};
  const i=(rr[ri]["os"+key]=(rr[ri]["os"+key]||0)+1)%bank.length, sh=bank[i];
  let lin=Math.pow(10,(osb.g||0)/20);
  const ty=key+"1", bk=S&&S.banks&&S.banks[ty];
  if(bk&&bk.length&&S.peaks&&S.peaks[ty]&&S.peaks[ty].length){
    const ci=((rr[ri][ty]||0)+1)%bk.length;
    const cellLin=Math.pow(10,(bk[ci].g||0)/20);
    lin=cellLin*(S.peaks[ty][ci]/(sh.peak||1));
  }
  const at=Math.max(ctx.currentTime,when-osb.pre), len=sh.buf.duration;
  const s=ctx.createBufferSource(); s.buffer=sh.buf; const g=ctx.createGain();
  g.gain.setValueAtTime(0,at); g.gain.linearRampToValueAtTime(lin,at+0.0015);
  g.gain.setValueAtTime(lin,at+len-0.02); g.gain.linearRampToValueAtTime(0,at+len);
  const out=liveOut(ri,at);
  s.connect(g); g.connect(out); s.start(at); endVoice(s,out,at+len+0.02);
  return true;
}

/* WHAT SOUNDS ON ONE STEP — the mini scheduler's inner loop, with the clock
   taken out: `pi` is the step within the groove's cycle, `at` the time the
   app has already decided for it (feel and all), `sd` the length of a step. */
W.fireStep=function(pi,at,sd){
  if(!W.ready(sd)) return;
  const STEPS=groove.steps;
  for(let ri=0;ri<ROWS.length;ri++){
    const row=ROWS[ri], L=LIB[row.id], S=L.cur; if(!S) continue;
    for(const c of row.cells){
      const ty=S.map[c.a+c.l], acc=c.a==="K"?"T":c.a;
      let rep=-1;
      if(c.s===pi) rep=0;
      else if(c.a==="J"&&ty&&c.art!=="stop"){ const n=+ty.slice(1), off=(pi-c.s+STEPS)%STEPS; if(n>0&&off<c.l&&off%n===0) rep=off/n; }
      if(rep<0) continue;
      const cutAt=at+(c.l-((pi-c.s+STEPS)%STEPS))*sd;
      if(L.osb&&(c.a==="D"||c.a==="P")) muteRings(ri,at);
      if(c.art==="stop"){
        if(L.osb&&L.osb.shots[acc]) fireOS(ri,acc,at);
        else { const st=S.map["short:"+c.a]; if(st) fire(ri,st,at,{cutAt,stop:sd}); }
      }
      else if(row.eng!=="drum"&&L.osb&&L.osb.short&&c.l===1&&(acc==="T"||acc==="P")
         &&fireShortOS(ri,acc,at)) ;
      else if(row.eng==="drum"&&L.osb&&L.osb.shots[acc]) fireOS(ri,acc,at);
      else if(ty&&ty[0]==="D"&&L.osb&&row.eng!=="drum") fireRing(ri,ty,at,cutAt);
      else fire(ri,ty,at,{cutAt});
    }
  }
};
/* HOW MANY ROWS STRIKE ON THIS STEP — what the bass asks before it hits, so
   its attack can give way to a crowded instant (9 Sep). Counts the cells that
   BEGIN here; a jingle's repeats and a ringing tail are not new strikes. */
W.hitsAt=function(pi){
  if(!groove||!W.ready()) return 0;
  let n=0;
  for(const row of ROWS) for(const c of row.cells) if(c.s===pi) n++;
  return n;
};
/* the transport started again: round-robins restart, as WGG's start() does */
W.restart=function(){ rr={}; RINGS={}; };
})();
