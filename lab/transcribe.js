/* transcribe.js — the ear that turns a recording of the pan into notation.
   Shared by the Notation Lab (lab.html) and the listening bench
   (bench-listen.html); one copy, so a threshold tuned in one is the other's.

   The method is the listening detector's, run offline in one pass over the
   decoded take (own FFT, no library): log-spectral flux over 100–3000 Hz on
   2048-point frames finds the strikes; 8192-point frames 130 ms after each
   strike say which of the pan's notes rose against the peak of the 150 ms
   before it. Thresholds are the ROOM's (rise 3 dB, chord margin 16), fitted
   on David's first take of 5 Sep 2026 — the lab's 11 dB was tuned on dry
   samples and heard 72% there; these hear 80%. The repeat prior offers the
   chord struck within the last second again at a whisker of rise, because a
   re-struck note changes level by 0–1 dB and no general rule can see it.

   Everything is in seconds of the take and indices into `notes`, the table
   built by HPT.notesOf(pan). Nothing here touches a document.              */
"use strict";
const HPT=(()=>{
  const DEF={fluxK:3, floorDb:-65, delayMs:115, tune:0, holdK:0.8, holdTau:0.1,
             rise:3, chord:13, rel:12, prior:true, priorWin:1.0, priorDepth:1, priorRise:1, priorMax:2, repDrop:3, repWin:0.5, repDepth:1, repMargin:6, neighbourDb:8, softDb:14, fallbackRise:null, fallbackMargin:0};
  /* THE DEFAULTS ARE THE BENCH'S (bench/ear, 5 Sep 2026): four of David's takes
     with his own notation as the answer, 1852 notes. Against the afternoon's
     settings (chord 16, rel 16, no soft rule, the prior at 1 dB up to four
     notes, the measure 130 ms after the attack) they keep 98.8% of the notes
     found and invent 47% fewer: right 1428 vs 1445, invented 185 vs 347, no
     piece worse on right minus invented. The fitted step (fitStep) is what
     carried Composition 2 from 75% to 96%; the measure at 115 ms after the
     attack was the analysis sweep's one finding (100 gains notes but invents,
     90 breaks).
     FIVE TAKES, LATER THE SAME NIGHT (Composition 3 joined, 2,324 notes): the
     re-struck rule (repDrop 3 dB back to the level at its last strike, within
     repMargin 6 dB of the loudest, one named strike back) took the set from
     1,741 right / 237 invented to 1,850 / 265 — net +81, no piece worse;
     looking two strikes back, a wider margin, or a bigger drop all bought
     one piece with another. Every other knob (the prior's rise and depth,
     the neighbour and soft thresholds, the chord margin) sat at its best. */
  function midiOf(s){ const m=String(s).trim().match(/^([A-Ga-g])([#♯b♭]?)(-?\d)$/); if(!m) return null;
    const base={c:0,d:2,e:4,f:5,g:7,a:9,b:11}[m[1].toLowerCase()];
    const acc=m[2]==="#"||m[2]==="♯"?1:(m[2]==="b"||m[2]==="♭"?-1:0);
    return 12*(+m[3]+1)+base+acc; }
  const hz=m=>440*Math.pow(2,(m-69)/12);
  /* the pan as the ear knows it: one entry per distinct pitch, `f` the app's
     field index (0 the ding, 1..n the top shell, then the underside) */
  function notesOf(pan){
    const nf=(pan.fields||[]).length, labels=[pan.ding].concat(pan.fields||[],pan.bottom||[]);
    const seen=new Set(), out=[];
    labels.forEach((n,f)=>{ const midi=midiOf(n); if(midi==null||seen.has(midi)) return; seen.add(midi);
      out.push({f, label:f===0?"D":(f<=nf?String(f):"b"+(f-nf)), name:n, midi, freq:hz(midi)}); });
    /* the ring: the top fields zigzag around the shell by pitch (odd numbers
       up one side, even numbers down the other — the app's zigzag), so each
       note knows its two neighbours on the instrument */
    const odds=[],evens=[]; for(let i=1;i<=nf;i++)(i%2?odds:evens).push(i); const ring=odds.concat(evens.reverse());
    out.forEach(n=>{ const i=ring.indexOf(n.f); n.next=i<0?[]:[ring[(i+1)%ring.length],ring[(i+ring.length-1)%ring.length]]; });
    return out;
  }
  function makeFFT(n){
    const lv=Math.round(Math.log2(n)), rev=new Uint32Array(n);
    for(let i=0;i<n;i++){ let r=0,x=i; for(let b=0;b<lv;b++){ r=(r<<1)|(x&1); x>>=1; } rev[i]=r; }
    const cs=new Float64Array(n/2), sn=new Float64Array(n/2);
    for(let i=0;i<n/2;i++){ cs[i]=Math.cos(2*Math.PI*i/n); sn[i]=-Math.sin(2*Math.PI*i/n); }
    const win=new Float64Array(n);                       // Blackman, as the AnalyserNode's (and numpy's)
    for(let i=0;i<n;i++) win[i]=0.42-0.5*Math.cos(2*Math.PI*i/(n-1))+0.08*Math.cos(4*Math.PI*i/(n-1));
    const re=new Float64Array(n), im=new Float64Array(n), out=new Float32Array(n/2+1);
    return function(x,off){
      for(let i=0;i<n;i++){ const j=rev[i]; re[j]=(x[off+i]||0)*win[i]; im[j]=0; }
      for(let size=2;size<=n;size<<=1){ const half=size>>1, step=n/size;
        for(let i=0;i<n;i+=size) for(let j=0;j<half;j++){ const k=j*step, a=i+j, b=a+half;
          const tr=re[b]*cs[k]-im[b]*sn[k], ti=re[b]*sn[k]+im[b]*cs[k];
          re[b]=re[a]-tr; im[b]=im[a]-ti; re[a]+=tr; im[a]+=ti; } }
      for(let i=0;i<=n/2;i++){ const m=Math.hypot(re[i],im[i])/n; out[i]=20*Math.log10(Math.max(m,1e-12)); }
      return out; };
  }
  /* one channel, normalised: a microphone's level is arbitrary */
  function mono(chans){
    const n=chans[0].length, x=new Float64Array(n);
    for(const d of chans) for(let i=0;i<n;i++) x[i]+=d[i]/chans.length;
    let pk=0; for(let i=0;i<n;i++) pk=Math.max(pk,Math.abs(x[i]));
    if(pk>0) for(let i=0;i<n;i++) x[i]*=0.9/pk;
    return x;
  }
  /* every strike the flux picks, with its baseline and its measurement — the
     naming can then be redone with other thresholds without another pass.
     `progress(frac)` may return a promise to let the page breathe.          */
  async function analyse(x,sr,notes,opt,progress){
    const o=Object.assign({},DEF,opt||{});
    const HOP=512, NS=2048, NL=8192, fS=makeFFT(NS), fL=makeFFT(NL);
    const binS=sr/NS, binL=sr/NL, lo=Math.floor(100/binS), hi=Math.ceil(3000/binS);
    const nS=1+Math.max(0,Math.floor((x.length-NS)/HOP)), nL=1+Math.max(0,Math.floor((x.length-NL)/HOP));
    const tune=Math.pow(2,o.tune/1200), W=[1,.6,.35];
    /* the long frames: per note, the fundamental's dB and a composite of three partials */
    const MF=new Array(nL), MC=new Array(nL);
    for(let f=0;f<nL;f++){
      const db=fL(x,f*HOP); const fund=new Float32Array(notes.length), comp=new Float32Array(notes.length);
      notes.forEach((n,i)=>{ const f0=n.freq*tune; let acc=0, fu=-200;
        [1,2,3].forEach((p,pi)=>{ const fc=f0*p, a=Math.max(1,Math.floor(fc*Math.pow(2,-30/1200)/binL)), b=Math.min(db.length-2,Math.ceil(fc*Math.pow(2,30/1200)/binL));
          let best=-200; for(let k=a;k<=b;k++) if(db[k]>best) best=db[k];
          acc+=W[pi]*Math.pow(10,best/20); if(p===1) fu=best; });
        fund[i]=fu; comp[i]=20*Math.log10(acc+1e-12); });
      MF[f]=fund; MC[f]=comp;
      if(progress&&f%200===0) await progress(f/(nS+nL));
    }
    const kOf=t=>Math.max(0,Math.min(nL-1,Math.round((t*sr-NL)/HOP)));
    /* the short frames: the attack measure, the lab's own rule */
    let prev=null, f1=0, f2=0, last=-1e9, holdFlux=0; const hist=[], strikes=[], pending=[];
    const floor=o.floorDb, fluxK=o.fluxK, delay=o.delayMs/1000;
    /* THE FIRST SECOND IS NOT A WARM-UP HERE. The live detector's threshold is a
       multiple of the median attack measure over its last hundred ticks, so it
       is blind until it has heard a second of the room; a recording's first
       stroke fell inside that second and was lost. Seed the history with the
       first hundred ticks, then listen from the start. */
    { let pv=null; for(let f=0;f<Math.min(100,nS);f++){ const db=fS(x,f*HOP); let flux=0;
        if(pv){ for(let i=lo;i<=hi;i++){ const v=Math.max(-90,db[i]); const d=v-pv[i]-2; if(d>0&&v>-80) flux+=d; pv[i]=v; } hist.push(flux); }
        else { pv=new Float32Array(db.length); for(let i=lo;i<=hi;i++) pv[i]=Math.max(-90,db[i]); } } }
    for(let f=0;f<nS;f++){
      const db=fS(x,f*HOP), now=(f*HOP+NS)/sr;
      let flux=0, lvl=-200;
      if(prev){ for(let i=lo;i<=hi;i++){ const v=Math.max(-90,db[i]); const d=v-prev[i]-2; if(d>0&&v>-80) flux+=d; prev[i]=v; if(db[i]>lvl) lvl=db[i]; } }
      else { prev=new Float32Array(db.length); for(let i=lo;i<=hi;i++){ prev[i]=Math.max(-90,db[i]); if(db[i]>lvl) lvl=db[i]; } f1=f2=0; continue; }
      hist.push(flux); if(hist.length>100) hist.shift();
      const sorted=hist.slice().sort((a,b)=>a-b), med=sorted[sorted.length>>1]||0, thr=fluxK*med+3;
      /* the hold after a strike (holdK of its flux, decaying over holdTau): a shorter
         one (0.3) found 47 more notes on nine takes and invented 22, the Building
         Bridges takes paying — so it stays (6 Sep) */
      const hold=holdFlux*Math.exp(-(now-last)/o.holdTau);
      if(f1>Math.max(thr,hold)&&f1>=flux&&f1>=f2&&now-last>0.12&&lvl>=floor){
        last=now; holdFlux=f1*o.holdK;
        const a=kOf(now-0.22), b=kOf(now-0.06);                 // the baseline: the PEAK of the 150 ms before
        const bf=new Float32Array(notes.length).fill(-200), bc=new Float32Array(notes.length).fill(-200);
        for(let k=a;k<=b;k++) for(let i=0;i<notes.length;i++){ if(MF[k][i]>bf[i]) bf[i]=MF[k][i]; if(MC[k][i]>bc[i]) bc[i]=MC[k][i]; }
        pending.push({due:now+delay,at:now,bf,bc});
      }
      f2=f1; f1=flux;
      while(pending.length&&pending[0].due<=now){ const p=pending.shift(); const k=kOf(p.due); strikes.push({t:p.at,bf:p.bf,bc:p.bc,cf:MF[k],cc:MC[k]}); }
      if(progress&&f%300===0) await progress((nL+f)/(nS+nL));
    }
    return strikes;
  }
  const harm=(fc,fm)=>[2,3].some(k=>Math.abs(1200*Math.log2(fc/fm/k))<60);
  /* the strict tier, with the room's thresholds; then the repeat prior */
  function name(strikes,notes,opt){
    const o=Object.assign({},DEF,opt||{});
    const out=[]; const recent=[], louds=[];
    for(const s of strikes){
      const loudest=Math.max(...s.cf), lvlFloor=Math.max(o.floorDb,loudest-o.rel);
      /* A SOFT STRIKE IS A GHOST OR A SLAP (the bench, 5 Sep, Composition 1
         advanced: after a note the loudest field sits near −32 dB, after a slap
         −44, after a ghost −41). A strike whose loudest note is `softDb` under
         the median of the last named strikes is unpitched: nothing is named,
         and it is written as a ghost so the rhythm survives. */
      if(o.softDb!=null&&louds.length>=4){ const srt=louds.slice().sort((a,b)=>a-b), med=srt[srt.length>>1]; if(loudest<med-o.softDb){ out.push({t:s.t,notes:new Set()}); continue; } }
      /* TRIED AND OUT (6 Sep): a slap rule — the band's energy rising more than
         the loudest note's, or most of the band's bins rising at the attack.
         Neither told a slap from a note: a handpan attack is broadband too, and
         at any threshold real notes went first. The 140 inventions standing on
         slaps and ghosts need a measure this frame does not hold. */
      let c=[];
      notes.forEach((n,i)=>{ const r=s.cf[i]-Math.max(-100,s.bf[i]), rc=s.cc[i]-Math.max(-100,s.bc[i]);
        if((r>=o.rise||(rc>=o.rise&&r>=3))&&s.cf[i]>=lvlFloor) c.push({i,fund:s.cf[i],comp:s.cc[i]}); });
      c=c.filter(x=>!c.some(m=>m!==x&&harm(notes[x.i].freq,notes[m.i].freq)&&m.fund>=x.fund-10));
      c=c.filter(x=>!c.some(m=>m!==x&&Math.abs(notes[x.i].midi-notes[m.i].midi)<=1&&m.comp>x.comp));
      c.sort((a,b)=>b.fund-a.fund);
      if(c.length) c=c.filter(x=>x.fund>=c[0].fund-o.chord).slice(0,4);
      /* THE SHELL RINGS WITH ITS NEIGHBOURS (David's second take, 5 Sep: an
         F4 stroke raised A4 by 19 dB and D4 by 14 — the fields either side of
         it on the ring, 7–12 dB under). A note that is a ring neighbour of the
         strike's loudest note and sits `neighbourDb` under it is the shell,
         not a hand. Measured on both takes: no right note lost, invented
         notes 24→22 and 6→3. A real double-stop on neighbouring fields is
         struck within 8 dB of each other and survives. */
      if(c.length>1&&o.neighbourDb!=null){ const loud=c[0]; c=c.filter(x=>x===loud||!(notes[loud.i].next.includes(notes[x.i].f)&&x.fund<=loud.fund-o.neighbourDb)); }
      const set=new Set(c.map(x=>x.i));
      /* A STRIKE THAT WAS HEARD STRUCK SOMETHING (the bench, 5 Sep: on the triplet
         arpeggio 1 3 6 1 3 6 a note returns every beat and rises only ~3 dB, and
         101 heard strikes went unnamed). When nothing reached `rise` and the
         strike is not soft, the note that rose most is taken if it rose at least
         `fallbackRise` — one note, the likeliest, rather than a ghost. */
      if(!set.size&&o.fallbackRise!=null){ const rs=notes.map((n,i)=>({i,r:s.cf[i]-Math.max(-100,s.bf[i]),ok:s.cf[i]>=lvlFloor})).filter(x=>x.ok).sort((a,b)=>b.r-a.r);
        if(rs.length&&rs[0].r>=o.fallbackRise&&(rs.length<2||rs[0].r-rs[1].r>=o.fallbackMargin)) set.add(rs[0].i); }   // one note rising clearly alone
      /* THE REPEAT PRIOR, WIDENED (the bench, 5 Sep: on Composition 1 simple 101
         strikes were heard and not named, on the advanced version 94 chord notes
         went missing on a repeated chord). A note struck within the last
         `priorWin` seconds — from the last `priorDepth` named strikes, not only
         the previous one — is offered again at a rise of `priorRise` dB. */
      if(o.prior&&set.size<4){ const win=o.priorWin, depth=o.priorDepth, cand=new Map();
        for(let j=recent.length-1;j>=0&&j>=recent.length-depth;j--){ const r=recent[j]; if(s.t-r.t>win) break; for(const i of r.notes) if(!cand.has(i)) cand.set(i,r.t); }
        /* A RE-STRUCK NOTE COMES BACK TO THE LEVEL IT HAD WHEN IT WAS LAST STRUCK
           (the bench, 5 Sep): at sixteenth and triplet speed every frame before
           a strike still holds the previous strike's attack, so the baseline IS
           that attack and a note struck again as loud as before shows no rise
           at all — three quarters of the misses on the five takes were repeats.
           After its attack a note falls 3–7 dB by the next strike and goes on
           falling; struck again, it stands where it stood at its last strike.
           So a note named within the last `repDepth` named strikes and
           `repWin` seconds, now within `repDrop` of the level it had at that
           strike and within the chord margin of the loudest, is offered as
           re-struck. The comparison is with the strike where it was NAMED, not
           the previous strike: a slap between leaves every note at its sustain
           level, which "held" against the slap's frame would re-offer it. */
        const ref=new Map();   // note -> the last named strike it was in, within repDepth
        for(let j=recent.length-1;j>=0&&j>=recent.length-(o.repDepth||1);j--){ const r=recent[j]; for(const i of r.notes) if(!ref.has(i)) ref.set(i,r); }
        const held=i=>{ const r=ref.get(i); return !!(o.repDrop!=null&&r&&s.t-r.t<=o.repWin&&s.cf[i]>=r.cf[i]-o.repDrop&&s.cf[i]>=loudest-(o.repMargin!=null?o.repMargin:o.chord)); };
        const pool=new Set([...cand.keys(),...ref.keys()]);
        const offer=[...pool].filter(i=>!set.has(i)).map(i=>({i,rise:s.cf[i]-Math.max(-100,s.bf[i]),held:held(i)})).filter(x=>(cand.has(x.i)&&x.rise>=o.priorRise)||x.held).sort((a,b)=>b.rise-a.rise);
        let added=0; for(const x of offer){ if(set.size>=4||added>=o.priorMax) break; set.add(x.i); added++; } }
      out.push({t:s.t,notes:set});
      if(set.size){ recent.push({t:s.t,notes:new Set(set),cf:s.cf}); if(recent.length>16) recent.shift(); louds.push(loudest); if(louds.length>12) louds.shift(); }
    }
    return out;
  }
  /* how well the strikes between two marks sit on the grid the marks imply
     (P positions between them): the RMS distance to the nearest step */
  function gridFit(attacks,ta,tb,P){
    const step=(tb-ta)/P; let n=0, e=0;
    for(const t of attacks){ if(t<ta-step/2||t>=tb-step/2) continue; const q=(t-ta)/step, d=(q-Math.round(q))*step; e+=d*d; n++; }
    return n?Math.sqrt(e/n):1;
  }
  /* THE MARKS BETWEEN, PLACED (David, 5 Sep: "if it can automatically set the
     markers in between if I tell it how many there are"). Even division would
     be wrong — the tempo moved 94 → 104 bpm across his first take — so each
     inner mark is searched among the strikes near its even position for the
     one that makes BOTH tables beside it sit best on their grids. Two passes,
     since each boundary changes its neighbours' fit. */
  function autoMarks(attacks,a,b,N,P){
    N=Math.max(2,N|0); const span=(b-a)/N;
    const m=[a]; for(let k=1;k<N;k++) m.push(a+k*span); m.push(b);
    for(let pass=0;pass<2;pass++) for(let k=1;k<N;k++){
      const lo=m[k]-span*0.3, hi=m[k]+span*0.3;
      const cands=attacks.filter(t=>t>lo&&t<hi&&t>m[k-1]+span*0.4&&t<m[k+1]-span*0.4);
      if(!cands.length) continue;
      let best=null;
      for(const t of cands){ const f=gridFit(attacks,m[k-1],t,P)+gridFit(attacks,t,m[k+1],P); if(best===null||f<best.f) best={t,f}; }
      m[k]=best.t;
    }
    return m;
  }
  /* the notation between the marks: each stretch is `bars` bars on a grid
     pinned by its two marks; a strike lands on its nearest step; a strike
     nothing was named for is written as a ghost so the rhythm survives     */
  const gcd=(a,b)=>b?gcd(b,a%b):a, lcm=(a,b)=>a*b/gcd(a,b);
  /* THE GRID IS A DECISION PER BEAT, not per table (David, 5 Sep: the engine
     will store subdivision per segment, "and this should already potentially
     be taken into account here"). With `perBeat` on, every beat is offered
     each grid in `grids` and takes the one its strikes sit on best — the
     RMS distance to the nearest step, a beat with no strikes keeping the
     table's own — and the table is stored on the common grid (lcm) with the
     table's grid as `base`, which is how the app already stores a fine grid
     drawn coarse. Off by default until the engine draws a beat's own grid. */
  function beatGrid(strikes,t0,beatLen,grids,fallback,fineGain){   // fineGain: 0.4 by the bench (6 Sep)
    if(!strikes.length) return fallback;
    /* THE COARSEST GRID THE STRIKES ALLOW (6 Sep, Flavourful Freestyle 2's D1:
       a table stored on 32nds for one run put every ordinary sixteenth a slot
       late, because strokes land ~25 ms after the beat and a 32nd slot is 69
       ms). Grids are tried coarse to fine; a finer grid is taken only when it
       sits clearly better — its RMS under `fineGain` of the coarser one's. */
    const gs=grids.slice().sort((a,b)=>a-b); let best=null;
    for(const g of gs){ const st=beatLen/g; let e=0;
      for(const t of strikes){ const q=(t-t0)/st, d=(q-Math.round(q))*st; e+=d*d; }
      const rms=Math.sqrt(e/strikes.length)/beatLen;
      if(best===null||rms<best.rms*(fineGain==null?0.4:fineGain)) best={g,rms}; }
    return best.g;
  }
  /* THE LETTER IS THE HAND (5 Sep 2026): "R" the right hand, black; "L" the
     left hand, green. Every note the ear writes is the right hand's until the
     hand-pattern rules exist. */
  const HAND_RIGHT="R", HAND_LEFT="L";
  /* THE GRID IS THE PLAYHEAD MAP WHEN THERE IS ONE (David's Composition 2,
     5 Sep: the strikes drift a full eighth early inside a table and the slack
     sits before the next one — a straight line between two marks put bars 3
     and 4 a step off). `anchors` [{t,p}] with `pulse0` (the table's first
     pulse in that map) place each strike by the map's own beats, as the
     player follows it; without anchors the line between the marks stands. */
  function mapPulse(anchors,t){
    const a=anchors; if(t<=a[0].t) return a[0].p;
    for(let i=0;i<a.length-1;i++) if(t<=a[i+1].t){ const f=(t-a[i].t)/Math.max(1e-6,a[i+1].t-a[i].t); return a[i].p+f*(a[i+1].p-a[i].p); }
    const n=a.length-1, r=(a[n].p-a[n-1].p)/Math.max(1e-6,a[n].t-a[n-1].t); return a[n].p+(t-a[n].t)*r;
  }
  /* THE GRID OF A TABLE: THE PHASE IS THE MARK, THE TEMPO IS THE STRIKES
     (David's Composition 2, 5 Sep: the strikes ran at 0.95 of the step the
     two marks implied — he plays a table faster than its span and the slack
     sits before the next one — and a straight line between the marks put
     bars 3 and 4 a step off). The step is searched around the marks' step for
     the one the strikes sit on best, the start still pinned to the mark; the
     fitted step replaces the marks' only when the strikes sit on it (fitMin
     of them within a fifth of a step) and, with fitGate, better than on the
     marks'. When the strikes sit badly on the marks' step (under half of
     them near a step — Composition 3's last mark 3.5 s into the ring-out)
     the search goes wide, down to half the step, still gated.
     ONE GRID FOR THE NOTATION AND THE PLAYHEAD MARKERS: the notation
     (transcribe) and the Lab's beat anchors (beatAnchors) both take it from
     here — anchors laid on the marks' straight grid drifted a whole step
     inside Composition 2's B tables and pulled onto the wrong strikes.   */
  function fitGrid(named,ta,tb,P,opt){
    const o=Object.assign({fitStep:true,fitRange:0.15,fitGate:null,fitMin:0.7,fineGain:0.15},opt||{});
    let step=(tb-ta)/P; const step0=step; const out={ta,step,tb,fitted:null,hitsMarks:null,hitsFit:null};
    if(!o.fitStep) return out;
    const cand=named.filter(x=>x.t>=ta-step/2&&x.t<tb-step/2).map(x=>x.t);
    const hits=st=>{ let h=0,n=0; for(const t of cand){ const q=(t-ta)/st; if(q>=P-0.5) continue; n++; if(Math.abs(q-Math.round(q))<=0.2) h++; } return n?h/n:0; };
    out.hitsMarks=hits(step);
    /* the wide search stops short of the half step (0.6 of the marks' step): a
       stretch marked at its own start and end cannot be twice as fast as its
       marks say — a rubato intro (4.1, 6 Sep) fitted the half step by hits */
    let range=o.fitRange; if(out.hitsMarks<0.5) range=0.4;
    let fitted=null;
    if(o.fitStep==="ioi"){   // the step from the strikes' own spacing: each gap is a whole number of steps
      const r=[]; for(let i=1;i<cand.length;i++){ const d=cand[i]-cand[i-1], k=Math.round(d/step); if(k>=1&&k<=4) r.push(d/k); }
      if(r.length>=4){ r.sort((a,b)=>a-b); const m=r[r.length>>1]; fitted=Math.max(1-range,Math.min(1+o.fitRange,m/step)); } }
    else { let best=null; for(let f=1-range;f<=1+Math.min(range,o.fitRange)+1e-9;f+=0.005){ const st=step*f;
        /* A GRID TWICE AS FINE MUST EARN IT (Flavourful Freestyle, 6 Sep: the
           markers of one table "detected twice as fast"): every strike sits
           nearer a step on a grid twice as fine, so by distance alone the half
           step always wins the wide search. It is taken only when it catches
           clearly more strikes than the grid twice as coarse. */
        if(2*f<=1+o.fitRange+1e-9&&hits(st)<hits(2*st)+o.fineGain) continue;
        let e=0,n=0; for(const t of cand){ const q=(t-ta)/st; if(q>=P-0.5) continue; const d=(q-Math.round(q))*st; e+=d*d; n++; } const rms=n?Math.sqrt(e/n):1; if(best===null||rms<best.rms-1e-9) best={f,rms}; } if(best) fitted=best.f; }
    out.fitted=fitted; if(fitted!=null) out.hitsFit=hits(step0*fitted);
    if(fitted!=null&&out.hitsFit>=o.fitMin&&(o.fitGate==null||out.hitsFit>=out.hitsMarks+o.fitGate)){ out.step=step0*fitted; out.tb=ta+out.step*P; }
    return out;
  }
  /* THE PLAYHEAD MARKERS OF A TABLE (the Lab, 5 Sep: "the same functionality
     as in the tempo editor, so that it approximates the distance of the
     markers and then adjusts it according to the waveform"): one anchor per
     beat on the table's grid (fitGrid), pulled onto the ear's strike within
     `pull` of a step where there is one and left on the grid — a guess, `g`
     — where there is not; then the table's end. Pulses count from `pulse0`
     in the piece's own grid (`sub` per beat). Not on the frame grid: the
     player syncs on these, and flooring would jitter the beats.          */
  function beatAnchors(named,ta,tb,dims,pulse0,opt){
    const o=Object.assign({pull:0.35},opt||{}), P=dims.bars*dims.beats*dims.sub, g=fitGrid(named,ta,tb,P,o), att=named.map(s=>s.t), map=[];
    for(let b=0;b<dims.bars;b++) for(let k=0;k<dims.beats;k++){
      const rel=b*dims.beats*dims.sub+k*dims.sub, t=g.ta+rel*g.step;
      const s=att.filter(a=>Math.abs(a-t)<=g.step*o.pull).sort((x,y)=>Math.abs(x-t)-Math.abs(y-t))[0];
      const an={t:+(s!==undefined?s:t).toFixed(3),p:pulse0+rel}; if(s===undefined) an.g=1; map.push(an); }
    map.push({t:+tb.toFixed(3),p:pulse0+P});   // the table's end: the next one's start, or the End
    return map;
  }
  function transcribe(named,marks,notes,opt){
    const o=Object.assign({bars:4,beats:4,sub:4,ghosts:true,panId:"d-kurd-9",title:null,hand:HAND_RIGHT,perBeat:false,grids:[4,3],anchors:null,pulse0:0,fitStep:true,fitRange:0.15,fitGate:null,fitMin:0.7},opt||{});
    const store=o.perBeat?o.grids.reduce((a,g)=>lcm(a,g),o.sub):o.sub;   // the stored grid: the common one, or the table's
    const PPB=o.beats*store, sections={}, arrangement=[], sums=[];
    const useMap=o.anchors&&o.anchors.length>=2;
    for(let k=0;k<marks.length-1;k++){
      let ta=marks[k], tb=marks[k+1]; const P=o.bars*PPB; let step=(tb-ta)/P;
      if(!useMap){ const g=fitGrid(named,ta,tb,P,o); step=g.step; tb=g.tb; ta=g.ta;
        if(o.fitLog) o.fitLog.push({k,fitted:g.fitted,taken:step/((marks[k+1]-marks[k])/P),hitsMarks:g.hitsMarks,hitsFit:g.hitsFit}); }
      const beatLen=step*store;
      const byPos=new Map(); let nn=0, unnamed=0; const gridsUsed={};
      const beatOf=t=>Math.max(0,Math.min(o.bars*o.beats-1,Math.floor((t-ta)/beatLen)));
      /* with a map, a strike belongs to this table when the map puts it inside the
         table's pulses; its position is the map's, rounded to the stored grid */
      const pulseOf=t=>(mapPulse(o.anchors,t)-o.pulse0)*store/o.sub;
      const inTable=useMap?named.filter(s=>{ const q=pulseOf(s.t); return q>=-0.5&&q<P-0.5; }):named.filter(s=>s.t>=ta-step/2&&s.t<tb-step/2);
      const grid=new Array(o.bars*o.beats).fill(o.sub);
      if(o.perBeat) for(let b=0;b<grid.length;b++){ const t0=ta+b*beatLen;
        grid[b]=beatGrid(inTable.filter(s=>s.t>=t0-step/2&&s.t<t0+beatLen-step/2).map(s=>s.t),t0,beatLen,o.grids,o.sub,o.beatGain); gridsUsed[grid[b]]=(gridsUsed[grid[b]]||0)+1; }
      for(const s of inTable){
        /* the strike lands on the nearest step of ITS beat's grid, written in the stored grid */
        let pos;
        if(useMap) pos=Math.max(0,Math.min(P-1,Math.round(pulseOf(s.t))));
        else { const b=beatOf(s.t), g=grid[b], t0=ta+b*beatLen, q=Math.round((s.t-t0)/(beatLen/g));
          pos=Math.max(0,Math.min(P-1,b*store+Math.round(q*store/g))); }
        if(!byPos.has(pos)) byPos.set(pos,new Set());
        if(s.notes.size){ s.notes.forEach(i=>byPos.get(pos).add(i)); nn+=s.notes.size; }
        else { unnamed++; if(o.ghosts&&!byPos.get(pos).size) byPos.get(pos).add("ghost"); } }
      const list=[];
      for(let b=0;b<o.bars;b++){ const bar=[];
        for(let t=0;t<PPB;t++){ const set=byPos.get(b*PPB+t); if(!set) continue;
          const idx=[...set].filter(i=>i!=="ghost").sort((a,b)=>notes[a].midi-notes[b].midi);
          if(idx.length) idx.forEach(i=>bar.push({t,v:"field",f:notes[i].f,hand:o.hand}));
          else if(set.has("ghost")) bar.push({t,v:"ghost",hand:o.hand}); }
        list.push(bar); }
      /* the grid travels WITH the table: the app reads a section's own sub and
         meter (SM) over the piece's, so tables added to a piece that already
         has one keep their triplets (David, 5 Sep: "the table did not change
         to triplets, so all the rhythm was messed up") */
      const nm="T"+(k+1); sections[nm]={bars:list,sub:store,meter:[o.beats,4]}; if(store!==o.sub) sections[nm].base=o.sub; arrangement.push(nm);
      sums.push({name:nm,bpm:60/beatLen,notes:nn,unnamed,grids:o.perBeat?gridsUsed:undefined});
    }
    const t0=marks[0], tN=marks[marks.length-1];
    const tempo=Math.round(60*o.bars*o.beats*(marks.length-1)/(tN-t0));
    const piece={format:"hpd-2",id:"transcribed",title:o.title||("Transcribed · "+new Date().toLocaleTimeString()),author:"",
      writtenFor:o.panId,tempo,meter:[o.beats,4],sub:store,barsPerRow:1,sections,arrangement};
    if(store!==o.sub) piece.base=o.sub;
    return {piece,sums};
  }
  return {DEF,HAND_RIGHT,HAND_LEFT,midiOf,notesOf,makeFFT,mono,analyse,name,gridFit,autoMarks,fitGrid,beatAnchors,transcribe,mapPulse};
})();
