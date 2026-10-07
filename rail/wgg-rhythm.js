/* wgg-rhythm.js — the jam's RHYTHM TRACK, played by World Groove Grid's own
   core (11 Sep 2026).

   ONE CORE, NOT A PORT (HANDPAN-CORE-HANDOVER.md, in the WGG repo: "every
   playback rule lives in one function, WGGCore(env), in engine.js … the app
   and all website players now use exactly this"). Until today this file was a
   hand-port of WGG's lesson player as it stood at c531347, and every rule WGG
   added afterwards — the instrument EQ, the ghost fill, the frame drum's rings,
   one-shot mode, loudness evening — stopped at the door. Now wgg/engine.js is
   WGG's engine.js verbatim (sync_wgg.py copies it) and this file only does what
   is Handpan Studio's own:

   1. THE CLOCK IS THE APP'S. sched() in app.html owns time and asks
      fireStep(step, at, stepLength) what sounds; the core's playPulse answers.
      There is only one beat one, so drums and pan never disagree about it.
   2. THE GRAPH IS THE APP'S. A row's chain is gain -> the instrument's EQ
      (engine.js eqChain) -> pan -> the rhythm bus (its volume) -> the app's dry
      and send, so the drums sit in the pan's room and under its limiter.
   3. EVERY VOICE ENDS IN A PLAIN GAIN THE APP MAY SILENCE. The core puts each
      stroke's fades on its own automated gain; that feeds a fresh unautomated
      one which joins the app's `live` list, because the app's silencers (stop,
      jumpTo, followHush, jamFadeLiveTo) ramp a live gain to zero WITHOUT
      cancelling what is scheduled on it — an automated node would raise itself
      back up at its next event. The bass found that on its first evening.
   4. THE APP'S THIRTEEN CALLS STAY AS THEY WERE (David, 11 Sep: "keep the app's
      calls"), so the scheduler, the bass's duck (hitsAt), the break mute and
      the popups did not have to change.
   5. THE FEEL IS THE WEBSITE PLAYER'S (David, 11 Sep): a small random nudge,
      ±10 ms, three uniforms averaged — make_mini.py's rndOff for its practice
      player — added on top of whatever swing the app has already put in `at`.

   Reads the app's globals: ctx, dry, send, live. */
(function(){
"use strict";
const W=window.HPSWGG={};
const LIB={}, SETS={}, DIAG={fired:0, scrubbed:0}, EXPECT={push(){}};
let BASE="", DEFS=null, GROOVES=null, groove=null, ROWS=[], STEPS=16;
let CORE=null, coreCtx=null, bus=null, graphCtx=null, vol=1, chains={}, mixes={}, taps={};   // mixes: a row's gain and panner, for remix()
let curSd=0.125, absPulse=0, derived=null;
let prepared=null, pending=null;
/* EVERY PREPARED GROOVE IS KEPT (Handpan Studio step d, 28 Sep 2026: a groove for each table). use() used to throw the
   last groove's rows, cells and chains away, so a piece whose tables change groove lost steps at every table line
   while it prepared again; now each groove keeps its own, and coming back to one is instant. */
const CACHE={};
/* A GROOVE'S OWN REVERB (Handpan Studio, 29 Sep 2026): the bus reaches the dry bus and the room's send through gains of
   its own, set by the handpan's formula relative to the room's 16 - so 16, or a groove that says nothing, is the path
   exactly as it was */
let busD=null, busS=null, wetP=16;
const voices=[];                  // this file's plain gains, for the sweep

const RND_MS=10;
const rndOff=()=>((Math.random()+Math.random()+Math.random())/3*2-1)*RND_MS/1000;

// ---------------- what sync_wgg.py brought across
W.source=null;
W.grooves=()=>GROOVES||[];
W.loaded=()=>!!(GROOVES&&DEFS);
/* d = {base, defs (bank/instruments.json), grooves (grooves.json), source (SOURCE.json)} */
W.attach=function(d){
  BASE=d.base||""; DEFS=d.defs; GROOVES=d.grooves||[];
  W.source=d.source?{commit:d.source.commit, built:d.source.synced}:null;
  for(const i of DEFS.instruments) SETS[i.id]=wggInstView(i, BASE+"bank/");
};

function core(){
  if(CORE&&coreCtx===ctx) return CORE;
  coreCtx=ctx;
  CORE=WGGCore({LIB, SETS, DIAG, EXPECT,
    ctx:()=>ctx, cycle:()=>STEPS, pulseDur:()=>curSd, quant:()=>0,
    cutCorr:()=>false, ghostFill:()=>true,
    out:row=>voiceOut(row), feel:()=>rndOff(), rows:()=>ROWS});
  return CORE;
}

// ---------------- a groove, in the core's row shape
const slotOf=c=>(!c||c==="-"||c===" ")?null:(c==="K"?"T":c);
W.use=function(gid){
  const g=(GROOVES||[]).find(x=>x.id===gid)||(GROOVES||[])[0];
  if(!g) return null;
  if(groove&&groove.id===g.id) return groove;
  if(groove) CACHE[groove.id]={ROWS, chains, derived, prepared, gctx:graphCtx};
  const kept=CACHE[g.id];
  groove=g; STEPS=g.steps||16;
  wetP=(g.verb!=null&&isFinite(+g.verb))?+g.verb:16; applyWet();
  if(kept){ ROWS=kept.ROWS; derived=kept.derived; prepared=kept.prepared; chains=kept.gctx===graphCtx?kept.chains:{}; return groove; }
  ROWS=g.rows.filter(r=>!r.mute&&SETS[r.set]).map((r,ri)=>({
    set:r.set, ri, eng:r.eng==="drum"?"drum":"natural", rings:[],
    gain:+r.gain||0, pan:+r.pan||0,
    slots:Array.from({length:STEPS},(_,i)=>slotOf((r.p||"")[i])),
    fills:Array.from({length:STEPS},(_,i)=>(r.f||"")[i]==="1"),
    art:Array.from({length:STEPS},(_,i)=>(r.a||"")[i]==="_"?"stop":null)}));
  chains={}; derived=null; prepared=null;
  return groove;
};
W.groove=()=>groove;
/* FORGET A GROOVE (Handpan Studio step e, 29 Sep 2026): the drum groove editor replaces a groove under its id when it is
   saved again, and drops its playing drafts; the kept preparation goes, so the next use() builds it afresh */
W.forget=function(id){ delete CACHE[id]; if(groove&&groove.id===id){ groove=null; derived=null; prepared=null; } };
W.steps=()=>groove?(groove.steps||16):16;

/* the cells and ghost runs the core plays — worked out once per groove, after
   its instruments are loaded (the ghost fill reads their takes) */
function derive(){
  const C=core();
  derived=ROWS.filter(r=>LIB[r.set]).map(r=>{
    const cells=wggDerive(r,STEPS);
    return {r, cells, ghosts:C.ghostRuns(r,cells)};
  });
}

/* LOAD WHAT THE GROOVE USES. The core warps each take lazily, the first time
   it plays at a tempo, so a tempo change needs nothing here: only a new
   groove, or a first start, has work to do. Safe to call every scheduler pass —
   it returns at once when ready and hands back the same promise while busy. */
W.prepare=function(sd){
  if(!DEFS||!groove||!ctx) return Promise.resolve(false);
  if(sd>0) curSd=sd;
  if(W.ready()) return Promise.resolve(true);
  if(pending&&pending.gid===groove.id) return pending.p;
  const gid=groove.id, C=core();
  const p=(async()=>{
    for(const r of ROWS){
      if(LIB[r.set]) continue;
      await C.loadSet(r.set, DEFS.instruments.find(i=>i.id===r.set));
    }
    C.rebuildWarp();
    if(groove&&groove.id===gid){ derive(); prepared={gid}; }
    return true;
  })().finally(()=>{ if(pending&&pending.p===p) pending=null; });
  pending={gid,p};
  return p;
};
/* ready means the groove's instruments are in: the step length no longer
   matters, because the core stretches for whatever tempo it is handed */
W.ready=function(){ return !!(prepared&&groove&&prepared.gid===groove.id&&derived); };

// ---------------- the graph: voice -> plain gain -> row chain -> bus -> dry + send
function ensureBus(){
  if(graphCtx===ctx&&bus) return;
  graphCtx=ctx; chains={}; mixes={}; taps={};
  bus=ctx.createGain(); bus.gain.value=vol;
  busD=ctx.createGain(); busS=ctx.createGain();
  /* the drums' pedalboard, when the app has one (Handpan Studio, 2 Oct 2026: "all instruments ... should get the effects
     section"; patches/instrument-fx.py): the groove's mix through the app's effects chain, then dry and the reverb send */
  const fo=(typeof fxRoute==="function")?fxRoute("drm",bus):bus;
  fo.connect(busD); fo.connect(busS); busD.connect(dry); busS.connect(send);
  applyWet();
}
function applyWet(){
  if(!busD||graphCtx!==ctx) return;
  const w=Math.max(0,Math.min(100,wetP))/100, w0=0.16, t=ctx.currentTime;
  busS.gain.setTargetAtTime(w/w0,t,0.02); busD.gain.setTargetAtTime((1-w*0.35)/(1-w0*0.35),t,0.02);
}
function rowChain(row){
  ensureBus();
  if(!chains[row.ri]){
    /* the grid's pan is a FRACTION, -1..1 — build_grid.py hands row.pan to the
       panner as it is (9 Sep: dividing by 100 had flattened every pan) */
    /* THE BAND'S MIX OF THE INSTRUMENTS (Handpan Studio, 7 Oct 2026; patches/perc-presets-mixer.py): the app's percMixOf(set) -
       a level (100 = as the groove has it; 0 when muted) and a pan added to the groove's own */
    const X=(typeof percMixOf==="function")?percMixOf(row.set):null;
    let out=bus, p=null;
    if(ctx.createStereoPanner){
      p=ctx.createStereoPanner(); p.pan.value=Math.max(-1,Math.min(1,row.pan+(X?X.p/100:0)));
      p.connect(bus); out=p;
    }
    const S=SETS[row.set], eq=eqChain(ctx, S&&S.eq);
    const g=ctx.createGain(); g.gain.value=Math.pow(10,(row.gain||0)/20)*(X?(X.m?0:X.v/100):1);
    g.connect(eq.input); eq.output.connect(out);
    chains[row.ri]=g; mixes[row.ri]={g,p,row};
    (p||eq.output).connect(taps[row.set]||(taps[row.set]=ctx.createGain()));   // its level after the mute and the pan, for the app's meter (Handpan Studio, patches/perc-meters.py)
  }
  return chains[row.ri];
}
function voiceOut(row){
  const v=ctx.createGain(); v.gain.value=1;
  v.connect(rowChain(row));
  live.push(v); if(live.length>160) live.splice(0,60);
  voices.push({v, t:ctx.currentTime});
  return v;
}
/* a voice's plain gain outlives it by a wide margin (the longest ring tail is a
   few seconds) and is then let go, so the graph does not grow for ever */
function sweep(){
  const old=ctx.currentTime-15;
  while(voices.length&&voices[0].t<old){
    const {v}=voices.shift();
    try{ v.disconnect(); }catch(e){}
    const i=live.indexOf(v); if(i>=0) live.splice(i,1);
  }
}
W.remix=function(){ if(!ctx||graphCtx!==ctx) return; const t=ctx.currentTime;   // the band's mix moved: the chains already built follow
  for(const ri in mixes){ const M=mixes[ri], X=(typeof percMixOf==="function")?percMixOf(M.row.set):null;
    try{ M.g.gain.setTargetAtTime(Math.pow(10,(M.row.gain||0)/20)*(X?(X.m?0:X.v/100):1),t,0.02);
      if(M.p) M.p.pan.setTargetAtTime(Math.max(-1,Math.min(1,M.row.pan+(X?X.p/100:0))),t,0.02); }catch(e){} } };
/* AN INSTRUMENT'S LEVEL FOR THE APP'S METER (Handpan Studio, 7 Oct 2026; patches/perc-meters.py): every chain of that
   instrument, in any groove, sums here; null until the graph is built */
W.tap=function(set){ if(!ctx||graphCtx!==ctx) return null; return taps[set]||(taps[set]=ctx.createGain()); };
W.setVolume=function(pct){ vol=Math.max(0,Math.min(1.5,(+pct||0)/100)); if(bus) bus.gain.value=vol; };

// ---------------- what sounds on one step
/* `pi` is the step within the groove's cycle, `at` the time the app has already
   decided for it, `sd` a step's length. The core adds the feel and does the rest. */
W.fireStep=function(pi,at,sd){
  if(!W.ready()) return;
  if(sd>0) curSd=sd;
  const C=core();
  for(const d of derived) C.playPulse(d.r, d.cells, d.ghosts, pi, at, curSd, absPulse);
  absPulse++;
  if((absPulse&63)===0) sweep();
};
/* HOW MANY ROWS STRIKE ON THIS STEP — what the bass asks before it hits, so its
   attack can give way to a crowded instant (9 Sep). Cells that BEGIN here;
   a jingle's repeats and a ringing tail are not new strikes. */
W.hitsAt=function(pi){
  if(!W.ready()) return 0;
  let n=0;
  for(const d of derived) for(const c of d.cells) if(c.start===pi) n++;
  return n;
};
/* the transport started again: round-robins, rings and remembered feel start
   afresh, as WGG's own players do on Play */
W.restart=function(){
  for(const id in LIB) LIB[id].rr={};
  for(const r of ROWS) r.rings=[];
  for(const id in CACHE) for(const r of CACHE[id].ROWS) r.rings=[];
  if(CORE) CORE.resetRing();
  absPulse=0;
};
})();
