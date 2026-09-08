/* wgg-engine.js — COPIED VERBATIM from World Groove Grid, engine.js @ commit c531347
   (8 Sep 2026), for the jam's rhythm track. CLAUDE.md: engine parts are copied, not
   shared. Do not edit here — port a fix from WGG deliberately, one at a time, and
   update the commit above. Everything below this line is WGG's. */
function detectOnsets(buf){
  const hop = 64, sr = buf.sampleRate, nch = buf.numberOfChannels, env = [];
  const chans = Array.from({length:nch}, (_,c) => buf.getChannelData(c));
  for(let i=0; i+hop < buf.length; i+=hop){
    let p = 0;
    for(const d of chans) for(let j=i;j<i+hop;j++){ const a = Math.abs(d[j]); if(a>p) p=a; }
    env.push(p);
  }
  const peak = Math.max(...env), floor = peak*0.06;
  const refr = Math.round(0.045*sr/hop);
  const out = []; let last = -1e9;
  for(let i=1;i<env.length;i++){
    let prev = 0;
    for(let k=Math.max(0,i-4);k<i;k++) prev = Math.max(prev, env[k]);
    if(env[i] > floor && env[i] > prev*1.6 && i-last > refr){
      let j = i;                                  // walk back to the foot of the transient
      while(j>0 && env[j-1] < env[j] && env[j-1] > floor*0.25) j--;
      out.push(j*hop/sr); last = i;
    }
  }
  return out;
}

// `manualMs` (28 Aug 2026) — positions David placed or dragged by hand in the
// studio's take editor. The grid filter below exists to reject the SLICER's
// false onsets: a detected transient a long way off the grid is usually noise,
// and anchoring it would splice at a non-event. A marker placed deliberately
// has no noise to reject, so the filter is pure loss — on udu_F8_90_13 three of
// eleven hand-placed markers were being discarded before the warp ever saw
// them (two beyond the quarter-pulse tolerance, one sharing the accent's
// pulse). A manual stroke is therefore always kept; when it does not fit the
// grid it carries dev 0, so it anchors the splice and quantise never pulls it
// anywhere — which is exactly what "I put the marker here" means.
// A splice needs room to hide in. spliceSeg absorbs its leftover in a 6 ms
// crossfade placed 22 ms after the attack, so a segment shorter than 28 ms
// cannot host it and the pass falls back to an end-aligned copy — audible.
// Two markers almost on top of each other are nearly always ONE transient
// detected twice, and a marker sitting on the cut leaves a zero-length tail:
// measured 28 Aug 2026, 16 enabled cells carried a last marker within 25 ms of
// the end (four of them under 3.5 ms) and those were the only takes that gained
// splice fallbacks when their strokes were anchored.
const MIN_SEG = 0.028;
// Drop auto-detected strokes that crowd their predecessor or the end of the
// take. KEEPS THE FIRST of a close pair (David's rule) — it is the attack's
// foot, and the later one is the same transient found again. Markers placed by
// HAND are never thinned: his intent wins here as everywhere else.
function thinStrokes(out, durSec){
  const keep = [];
  for(const s of out){
    const prev = keep[keep.length - 1];
    if(prev && !s.manual && s.t - prev.t < MIN_SEG) continue;
    keep.push(s);
  }
  while(durSec && keep.length > 1){
    const last = keep[keep.length - 1];
    if(last.manual || durSec - last.t >= MIN_SEG) break;
    keep.pop();
  }
  return keep;
}

function strokesFromList(ms, pulse, pre, manualMs, durSec){
  const tol = pulse*0.25, out = [], seen = new Set();
  const man = manualMs || [];
  const isMan = t => man.some(v => Math.abs(v/1000 - t) < 0.0005);
  for(const v of ms){
    const t = v/1000;
    const k = Math.round((t-pre)/pulse), grid = pre + k*pulse;
    const fits = Math.abs(t-grid) <= tol && !seen.has(k);
    if(!fits && !isMan(t)) continue;
    if(fits) seen.add(k);
    out.push(fits ? {t, grid, dev:t-grid, manual:isMan(t)}
                  : {t, grid:t, dev:0, manual:true});
  }
  out.sort((a,b)=>a.t-b.t);
  // Thin BEFORE planting, and plant only if the first surviving stroke is far
  // enough past the pre-roll to leave a usable segment. Planting first and
  // thinning after let the SYNTHETIC anchor at `pre` beat a real attack a few
  // ms later — it cost frameT_D3_75_01 its accent at 53.02 ms and
  // udu_G4_80_03 its one at 36.33 ms. A detected attack outranks a placeholder.
  const kept = thinStrokes(out, durSec);
  if(!kept.length || kept[0].t > pre + MIN_SEG) kept.unshift({t:pre, grid:pre, dev:0});
  return kept;
}

function analyzeCell(buf, pulse, pre){
  pre = pre || 0;
  const tol = pulse*0.25, strokes = [], seen = new Set();
  for(const t of detectOnsets(buf)){
    const k = Math.round((t-pre)/pulse), grid = pre + k*pulse;
    if(Math.abs(t-grid) > tol || seen.has(k)) continue;
    seen.add(k); strokes.push({t, grid, dev:t-grid});
  }
  const kept = thinStrokes(strokes, buf.duration);   // same order as above
  if(!kept.length || kept[0].t > pre + MIN_SEG) kept.unshift({t:pre, grid:pre, dev:0});
  return kept;
}

function copyAlignEnd(chans, a, b, T, out, p0){
  const L = b-a, n = Math.min(L, T);
  for(let c=0;c<chans.length;c++){
    const s = chans[c], o = out[c];
    for(let i=0;i<T-n;i++) o[p0+i] = 0;
    // the segment bound (b) is not the buffer bound: a read past the end of
    // the channel gives undefined, and undefined stored in a Float32Array is
    // NaN. Same rule as copy() below — never write an unguarded sample.
    for(let i=0;i<n;i++)   o[p0+(T-n)+i] = s[b-n+i] || 0;
  }
}

function spliceSeg(chans, a, b, T, out, p0, sr, stat){
  const L = b-a, d = T-L, nch = chans.length;
  const copy = (from, to, at) => {
    // an out-of-range read gives undefined, and writing undefined into a
    // Float32Array stores NaN — which then poisons every downstream node for
    // the life of the audio graph. Never write an unguarded sample.
    for(let c=0;c<nch;c++){ const s = chans[c], o = out[c];
      for(let i=0;i<to-from;i++) o[at+i] = s[from+i] || 0; }
    return to-from;
  };
  if(d === 0){ copy(a, b, p0); return; }
  const s0 = chans[0];

  // Local fundamental of the ring, from autocorrelation over the early decay.
  // Everything below leans on it: period-multiple jumps are transparent in a
  // pitched decay; anything else must be hidden behind a masking transient.
  let per = 0;
  {
    const w0 = a + Math.min(Math.round(0.030*sr), L>>2);
    const wn = Math.min(b, w0 + Math.round(0.100*sr));
    if(wn-w0 >= Math.round(0.050*sr)){
      let bc = 0;
      const lo = Math.round(0.003*sr), hi = Math.min(Math.round(0.018*sr), (wn-w0)>>1);
      for(let lag=lo; lag<hi; lag+=8){
        let sxy=0, e1=0, e2=0;
        for(let i=w0; i<wn-lag; i+=4){ const u=s0[i], v=s0[i+lag]; sxy+=u*v; e1+=u*u; e2+=v*v; }
        const c = sxy/(Math.sqrt(e1*e2)+1e-9);
        if(c>bc){ bc=c; per=lag; }
      }
      if(bc < 0.35) per = 0;
    }
  }

  const spanMax = (i0, i1) => {           // loudest sample a splice would touch
    let m=0;
    for(let i=Math.max(a,i0); i<Math.min(b,i1); i+=16){
      const v=Math.abs(s0[i]||0); if(v>m) m=v;
    }
    return m;
  };

  let src=a, outp=p0, applied=0, done=0, corrSum=0, corr0Sum=0;

  // 1) A drum head's overtones are inharmonic — no time-shift aligns them all,
  //    so splicing the open ring always costs something. Whenever the whole
  //    shift fits under forward masking (~20 ms), it ALL hides in one splice
  //    right after the opening attack and the ring is never touched. Larger
  //    shifts hide their non-periodic residue there and distribute the rest.
  {
    // masked path only where it belongs: periodic (ringing) material. On
      // fast-decay instruments even small shifts splice better in the open
      // decay via the distributed pass (measured: cajon +11%% stretch,
      // double-attacks 64/104 -> ~7/104 strokes).
      // The masked splice absorbs ONLY the sub-period residue. Absorbing the
      // whole small shift here repeated the hot early decay and doubled the
      // thump on steep-decay instruments (cajon 81-83 bpm: 9/104 strokes
      // flagged -> 0/104 with residue-only). Period multiples go to the
      // distributed pass, which splices late in the decay, phase-aligned.
      const small = false;
    const r0 = small ? d : (per ? d - Math.round(d/per)*per : 0);
    const Xm = Math.round(small ? 0.008*sr : 0.006*sr);
    if(r0 !== 0){
      // The borrowed span must start PAST the attack transient. With a fixed
      // insertion point, borrowing qm = pm - r0 reaches into the attack once
      // r0 nears 22 ms — heard as a double hit on sharp-attack instruments
      // (cajon at ~+11% stretch). Shift the insertion point outward instead,
      // so the repeated material always comes from the decay.
      const pm = a + Math.round(0.022*sr) + Math.max(0, r0);
      let qm = pm - r0;
      const qFloor = a + Math.round(0.012*sr);
      if(qm >= qFloor && qm + Xm < b && pm + Xm < b){
        // phase-align the borrow point like the distributed pass does; the
        // leftover (r0 - e) flows into the distributed pass below
        const E2 = Math.round(0.014*sr);
        let e=0, bc=-2;
        const eLo=Math.max(qFloor, qm-E2)-qm, eHi=Math.min(b-Xm-1, qm+E2)-qm;
        for(let t=eLo;t<=eHi;t+=3){
          let dot=0, ei=0, ej=0;
          for(let k=0;k<Xm;k+=4){
            const u=s0[pm+k]||0, v=s0[qm+t+k]||0;
            dot+=u*v; ei+=u*u; ej+=v*v;
          }
          const c2=dot/(Math.sqrt(ei*ej)+1e-9);
          if(c2>bc){ bc=c2; e=t; }
        }
        qm += e;
        outp += copy(src, pm, outp);
        const coh = bc > 0.5;
        for(let c=0;c<nch;c++){ const sc=chans[c], o=out[c];
          for(let k=0;k<Xm;k++){
            const w=k/Xm;
            const g1 = coh ? 1-w : Math.cos(w*Math.PI/2);
            const g2 = coh ? w   : Math.sin(w*Math.PI/2);
            o[outp+k]=(sc[pm+k]||0)*g1+(sc[qm+k]||0)*g2;
          } }
        outp += Xm; src = qm + Xm; applied += r0 - e; done++;
        if(stat) stat.masked = (stat.masked||0)+1;
      }
    }
  }

  // 2) The remaining (period-multiple, or all of it when nothing is periodic)
  //    distributed over phase-aligned splices, placed where they touch the
  //    least energy — an undetected ornament stroke must never be duplicated.
  const dRem = d - applied;
  if(dRem !== 0){
    const maxChunk = Math.round(0.018*sr);
    const n   = Math.min(32, Math.max(1, Math.ceil(Math.abs(dRem)/maxChunk)));
    const Lr  = b - src;
    const adv = (Lr*0.80)/n;
    const X   = Math.round(Math.min(maxChunk, Math.max(0.004*sr, adv - Math.abs(dRem/n) - 0.002*sr)));
    if(X < 0.003*sr || adv - X + dRem/n < 1){
      copyAlignEnd(chans, src, b, p0+T-outp, out, outp);
      if(stat) stat.fallback++;
      return;
    }
    const E = Math.round(0.014*sr);
    const corrAt = (i, k2) => {
      let dot=0, ei=0, ej=0;
      for(let k=0;k<X;k+=4){ const u=s0[i+k]||0, v=s0[k2+k]||0; dot+=u*v; ei+=u*u; ej+=v*v; }
      return dot/(Math.sqrt(ei*ej)+1e-9);
    };
    for(let j=0;j<n;j++){
      const remaining = d - applied;
      const dk = Math.round(remaining/(n-j));
      if(dk===0){ done++; continue; }
      const pNom = src + Math.max(1, Math.round(adv - X + dk));
      const lo = Math.max(src+1, a+Math.max(0,dk));
      const hi = Math.min(b - X - Math.max(0,-dk) - 1, pNom + X);
      if(hi<=lo) break;
      let p=Math.max(lo, pNom-X), bestE=Infinity;
      for(let i=Math.max(lo,pNom-X); i<hi; i+=8){
        const m = spanMax(Math.min(i,i-dk)-E, i+X+E);
        if(m<bestE){ bestE=m; p=i; }
      }
      const q0 = p - dk, lastOne = (j===n-1);
      let e=0, bc=-2;
      const eLo = Math.max(a, q0-E)-q0, eHi = Math.min(b-X-1, q0+E)-q0;
      for(let t=eLo;t<=eHi;t+=3){
        let c = corrAt(p, q0+t);
        if(lastOne) c -= per ? Math.abs(remaining-(dk-t))/per*0.4
                             : Math.abs(t)/(E*4);
        if(c>bc){ bc=c; e=t; }
      }
      corr0Sum += corrAt(p, q0);
      corrSum  += Math.max(-1, Math.min(1, corrAt(p, q0+e)));
      const q = q0 + e;
      outp += copy(src, p, outp);
      const coherent = corrAt(p, q) > 0.5;
      for(let c=0;c<nch;c++){ const sc=chans[c], o=out[c];
        for(let k=0;k<X;k++){
          const w=k/X;
          const g1 = coherent ? 1-w : Math.cos(w*Math.PI/2);
          const g2 = coherent ? w   : Math.sin(w*Math.PI/2);
          o[outp+k] = (sc[p+k]||0)*g1 + (sc[q+k]||0)*g2;
        } }
      outp += X;
      src = q + X;
      applied += dk - e; done++;
    }
  }

  // 3) backstop for any leftover; never let the segment end pad with silence
  const resid = d - applied;
  if(Math.abs(resid) > Math.round(0.0015*sr)){
    const Xr = Math.round(0.008*sr);
    const lo = Math.max(src + Xr, a + Math.max(0,resid) + 1);
    const hi = b - Xr - Math.abs(resid) - 1;
    if(hi > lo){
      let pr=lo, bestE=Infinity;
      for(let i=lo;i<hi;i+=8){
        const m = spanMax(i-Xr, i+2*Xr);
        if(m<bestE){ bestE=m; pr=i; }
      }
      const qr = pr - resid;
      outp += copy(src, pr, outp);
      for(let c=0;c<nch;c++){ const sc=chans[c], o=out[c];
        for(let k=0;k<Xr;k++){ const w=k/Xr*Math.PI/2;
          o[outp+k]=(sc[pr+k]||0)*Math.cos(w)+(sc[qr+k]||0)*Math.sin(w); } }
      outp += Xr;
      src = qr + Xr;
      applied += resid;
    }
  }

  if(stat){
    stat.splices  = Math.max(stat.splices, done);
    stat.chunkMs  = Math.max(stat.chunkMs, Math.abs(d/Math.max(1,done))/sr*1000);
    stat.corrN    = (stat.corrN||0) + done;
    stat.corrSum  = (stat.corrSum||0) + corrSum;
    stat.corr0Sum = (stat.corr0Sum||0) + corr0Sum;
  }
  const rem = p0 + T - outp;
  let padded = 0;
  for(let c=0;c<nch;c++){ const sc=chans[c], o=out[c];
    for(let i=0;i<rem;i++){
      const k2 = src+i;
      if(k2>=a && k2<b) o[outp+i] = sc[k2] || 0;   // b may exceed the channel
      else { o[outp+i] = (o[outp+i-1]||0)*0.995; if(c===0) padded++; }  // decay, not silence
    } }
  if(stat && padded) stat.zeroPad = (stat.zeroPad||0) + padded;
}

// The app's anchor rule (23 Aug 2026): at Tightness 0 only the ACCENT anchors
// the warp — with the ghosts anchored too, the splice's masked-residue
// crossfade landed inside the doum's ring behind a -30 dB ghost (an audible
// click). The ghost anchors stay in the manifest for quantise > 0. Shared
// here so the studio's take editor warps exactly as the player does.
// At quantise 0 the ACCENT alone anchors the warp (23 Aug 2026): with the udu's
// detected ghosts anchored, spliceSeg's masked-residue crossfade landed inside
// the doum's loud ring and clicked (udu_D3_80_04 at 75 BPM). A marker David
// placed BY HAND is a different thing — a deliberate instruction to pin the
// audio there — so it anchors too (28 Aug 2026). Without this a fill's internal
// timing drifted at every non-native tempo, because only the accent held it:
// on udu_F6_90_01 the median transient landed 15.5 ms from where a faithful
// stretch would put it at 75 BPM, against 5.9 ms with its strokes anchored.
// Detected ghosts are untouched by this — David did not place them.
function warpAnchors(st, q){
  if(q>0 || st.length<2) return st;
  const keep = st.filter((s,i) => i===0 || s.manual);
  return keep.length>1 ? keep : st.slice(0,1);
}

function warpCell(buf, strokes, q, ratio, stat, targets){
  const sr = buf.sampleRate, nch = buf.numberOfChannels;
  const chans = Array.from({length:nch},(_,c)=>buf.getChannelData(c));
  const S  = strokes.map(s => Math.round(s.t*sr));
  // Correction per stroke is capped at 20 ms: accents (tightly selected) still
  // quantise fully, but a wildly-placed ornament is not dragged so far that the
  // splice must cut the loud ring underneath it — every quantise splice then
  // fits under the post-attack masking window.
  //
  // `targets` (25 Aug 2026, the studio's Fix-timing mode): explicit per-stroke
  // target positions in SOURCE seconds, overriding the quantise correction —
  // the studio hands warpCell the positions David dragged the strokes to.
  // Omitted (the player, the mini, the lab), nothing changes.
  const CAP = 0.020;
  const Tp = strokes.map((s, i) => {
    if(targets) return Math.round(ratio*targets[i]*sr);
    const dev = s.t - s.grid;
    const corr = Math.sign(dev)*Math.min(Math.abs(dev), CAP)*q;
    return Math.round(ratio*(s.t - corr)*sr);
  });

  const segs = [];
  if(S[0] > 0) segs.push({a:0, b:S[0], T:Math.max(0, Tp[0]), short:true});
  for(let i=0;i<strokes.length;i++){
    const a = S[i], b = (i+1 < strokes.length) ? S[i+1] : buf.length;
    const T = (i+1 < strokes.length)
      ? Tp[i+1]-Tp[i]
      : Math.round((buf.duration - strokes[i].t)*ratio*sr);   // tail stretches too,
    segs.push({a, b, T: Math.max(1, T)});                     // else a gap opens
  }

  const out = ctx.createBuffer(nch, segs.reduce((x,s)=>x+s.T, 0), sr);
  const oc = Array.from({length:nch},(_,c)=>out.getChannelData(c));
  let p = 0;
  for(const s of segs){
    if(s.short) copyAlignEnd(chans, s.a, s.b, s.T, oc, p);
    else        spliceSeg(chans, s.a, s.b, s.T, oc, p, sr, stat);
    p += s.T;
  }
  // Belt and braces: a single non-finite sample entering the graph is
  // unrecoverable (it sticks in every filter and delay line downstream), so no
  // warped buffer leaves this function without being checked.
  let scrubbed = 0;
  for(let c=0;c<nch;c++){
    const d = oc[c];
    for(let i=0;i<d.length;i++) if(!Number.isFinite(d[i])){ d[i]=0; scrubbed++; }
  }
  if(scrubbed && stat) stat.scrubbed = (stat.scrubbed||0) + scrubbed;
  if(scrubbed && typeof DIAG === "object"){
    DIAG.scrubbed = (DIAG.scrubbed||0) + scrubbed;
    DIAG.lastErr = "scrubbed "+scrubbed+" bad samples";
  }
  return out;
}
// ------------------------------------------------------------------
// The ring hand-off (22 Aug 2026) — the udu lab's winner, AUDIO-ENGINE.md §14.
// A sustaining instrument's doum is cut where its cell ends; these helpers let
// a one-shot of the same drum carry the ring on: the one-shot starts in sync
// with the cell's attack (silent), is peak-matched to the take, and fades up
// while the cell fades down over RING.fade, ending where the cell ends. The
// source bank is the D' one-shots (the udu's doum bends UP as the hand lifts
// for the next stroke, so the ring that continues in a groove is the higher
// one); the pick is "match both": level+slope at the hand-off age plus the
// zero-lag correlation of the ring waves. A following doum or pa stops the
// ring in RING.stopMs (the resonance-voice rule). Shared by the app and the
// mini; each player does its own node wiring.
const RING={fade:0.07, db:0, curve:"eq", source:"Dv", pick:"both",
            stop:true, stopMs:0.04, afterLast:0.04, keepTail:0.02};
function ringWinRms(buf,t0,t1){
  const sr=buf.sampleRate,a=Math.max(0,Math.floor(t0*sr)),b=Math.min(buf.length,Math.floor(t1*sr));
  if(b-a<8) return 1e-9; let acc=0;
  for(let c=0;c<buf.numberOfChannels;c++){const d=buf.getChannelData(c); for(let i=a;i<b;i++) acc+=d[i]*d[i];}
  return Math.sqrt(acc/((b-a)*buf.numberOfChannels))||1e-9;
}
function ringWinCorr(bufA,tA,bufB,tB,len){
  const sr=bufA.sampleRate,n=Math.floor(len*sr),a0=Math.floor(tA*sr),b0=Math.floor(tB*sr);
  if(n<8||a0<0||b0<0||a0+n>bufA.length||b0+n>bufB.length) return 0;
  const ca=bufA.getChannelData(0),cb=bufB.getChannelData(0);
  const ca2=bufA.numberOfChannels>1?bufA.getChannelData(1):null,cb2=bufB.numberOfChannels>1?bufB.getChannelData(1):null;
  let xy=0,xx=0,yy=0;
  for(let i=0;i<n;i++){const x=ca[a0+i]+(ca2?ca2[a0+i]:0),y=cb[b0+i]+(cb2?cb2[b0+i]:0); xy+=x*y;xx+=x*x;yy+=y*y;}
  return (xx&&yy)?xy/Math.sqrt(xx*yy):0;
}
function ringDb(x){ return 20*Math.log10(Math.max(x,1e-9)); }
function ringCurveUp(lin,n){ n=n||48; const c=new Float32Array(n); for(let i=0;i<n;i++) c[i]=lin*Math.sin(i/(n-1)*Math.PI/2); c[0]=0; return c; }
function ringCurveDown(lin,n){ n=n||48; const c=new Float32Array(n); for(let i=0;i<n;i++) c[i]=lin*Math.cos(i/(n-1)*Math.PI/2); c[n-1]=0; return c; }
// where the crossfade starts, in seconds from the cell buffer's start: RING.fade
// before its end, never before the last stroke + afterLast, never past the end
function ringFadeFrom(cellLen,lastStrokeT){
  return Math.min(cellLen-RING.keepTail, Math.max(cellLen-RING.fade, lastStrokeT+RING.afterLast));
}
// cands: [{key,j,buf,peak}] one-shots; cellPeak: the take's peak; preC: the
// cell's (warped) pre-roll; osPre: the one-shots' pre-roll. Returns the best
// candidate and the score table (for diagnostics).
function ringChoose(cellBuf,cellPeak,fadeFrom,preC,cands,osPre,how){
  how=how||RING.pick;
  if(!cands.length) return null;
  if(how==="rr") return {best:null, rows:[]};
  const age=fadeFrom-preC;
  const lvlC=ringDb(ringWinRms(cellBuf,fadeFrom-0.10,fadeFrom));
  const slC=ringDb(ringWinRms(cellBuf,fadeFrom-0.05,fadeFrom))-ringDb(ringWinRms(cellBuf,fadeFrom-0.10,fadeFrom-0.05));
  const cw=Math.min(0.15, cellBuf.duration-(fadeFrom-0.075));
  let best=null; const rows=[];
  for(const c of cands){
    const tO=osPre+age, scale=cellPeak/(c.peak||1);
    const lvlO=ringDb(ringWinRms(c.buf,tO-0.10,tO)*scale);
    const slO=ringDb(ringWinRms(c.buf,tO-0.05,tO))-ringDb(ringWinRms(c.buf,tO-0.10,tO-0.05));
    const r=ringWinCorr(cellBuf,fadeFrom-0.075,c.buf,tO-0.075,cw);
    const sDecay=Math.abs(lvlC-lvlO)/6+Math.abs(slC-slO)/6, sRing=1-r;
    const score=how==="decay"?sDecay:how==="ring"?sRing:sDecay+sRing;
    rows.push({key:c.key,j:c.j,dL:lvlO-lvlC,dSl:slO-slC,r,score});
    if(!best||score<best.score) best={c,score};
  }
  return {best:best.c, rows};
}
