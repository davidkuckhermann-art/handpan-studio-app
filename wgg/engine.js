/* wgg/engine.js — COPIED VERBATIM from World Groove Grid, engine.js @ commit e837a02 (11 Sep 2026),
   by sync_wgg.py. Every playback rule of the jam's rhythm track lives here.
   Do not edit — run sync_wgg.py to take a newer WGG. Below this line is WGG's. */
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
// An instrument may bring its own crossfade length (instruments.json
// ring_fade_ms — the frame drum, 11 Sep 2026: David heard the 70 ms hand-off
// and asked for a longer one, "it is okay if the ghost note tail gets faded
// out a little"); then the crossfade may begin over the last ghost's tail.
function ringFadeFrom(cellLen,lastStrokeT,fade,afterLast){
  fade=fade??RING.fade; afterLast=afterLast??RING.afterLast;
  return Math.min(cellLen-RING.keepTail, Math.max(cellLen-fade, lastStrokeT+afterLast));
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

// ---- THE INSTRUMENT EQ (David, 11 Sep 2026): "a nice and flexible EQ" per
// instrument, heard everywhere — the app, the minis and the studio's own
// auditions build the SAME chain from instruments.json `eq`. Seven biquads in
// a fixed order: low cut · low shelf · three bells · high shelf · high cut. A
// band that is off (a cut switched off, a shelf or bell at 0 dB) is a peaking
// filter at 0 dB, which is the identity — so an instrument without an EQ, or
// with a flat one, sounds exactly as before, and a live edit only ever sets
// parameters on nodes that already exist (no rewiring, no clicks).
// eq = {lc:{on,f}, ls:{f,g}, b1:{f,g,q}, b2:{…}, b3:{…}, hs:{f,g}, hc:{on,f}}
const EQ_BANDS=[
  {k:"lc", type:"highpass",  f:80,    q:0.707, cut:true},
  {k:"ls", type:"lowshelf",  f:150,   g:0},
  {k:"b1", type:"peaking",   f:300,   g:0, q:1},
  {k:"b2", type:"peaking",   f:1200,  g:0, q:1},
  {k:"b3", type:"peaking",   f:4000,  g:0, q:1},
  {k:"hs", type:"highshelf", f:8000,  g:0},
  {k:"hc", type:"lowpass",   f:14000, q:0.707, cut:true}];
function eqBand(eq,b){ return Object.assign({on:false}, b, (eq&&eq[b.k])||{}); }
function eqActive(v){ return v.cut ? !!v.on : Math.abs(+v.g||0) > 0.01; }
function eqSet(nodes,eq,ac,smooth){
  const t=ac?ac.currentTime:0;
  EQ_BANDS.forEach((b,i)=>{
    const v=eqBand(eq,b), n=nodes[i], on=eqActive(v);
    const type=on ? b.type : "peaking";
    if(n.type!==type) n.type=type;
    const f=Math.max(20,Math.min(20000,+v.f||b.f)), q=+(v.q!=null?v.q:b.q!=null?b.q:0.707), g=on&&!b.cut ? +v.g : 0;
    if(smooth&&ac){ n.frequency.setTargetAtTime(f,t,0.015); n.Q.setTargetAtTime(q,t,0.015); n.gain.setTargetAtTime(g,t,0.015); }
    else{ n.frequency.value=f; n.Q.value=q; n.gain.value=g; }
  });
}
function eqChain(ac,eq){
  const nodes=EQ_BANDS.map(()=>ac.createBiquadFilter());
  for(let i=0;i<nodes.length-1;i++) nodes[i].connect(nodes[i+1]);
  eqSet(nodes,eq,ac,false);
  return {input:nodes[0], output:nodes[nodes.length-1], nodes,
          set:e=>eqSet(nodes,e,ac,true)};
}

// ==== THE PLAYBACK CORE (David, 12 Sep 2026: "the behavior rules … should be
// part of the core engine of the player. When we update the player like that,
// all the embeds should also adapt those changes.") ==========================
// ONE place decides what sounds and when: loading an instrument, the tempo
// sessions and the per-take warp, which cell and which take, the cut at the
// next stroke, the stop, the ghost fill, short high accents, the drum computer,
// the ring hand-off and its muting — and plays it. A player supplies only what
// differs between players (env): its audio context, clock, the node a row's
// voices go to, its groove feel, and hooks for visuals and diagnostics.
// Moved verbatim from the app (build_grid.py) on 12 Sep 2026 and checked
// against recordings of the app before the move, stroke for stroke.
//   env = {LIB, SETS, DIAG, EXPECT, ctx(), cycle(), quant(), pulseDur(),
//          cutCorr(), ghostFill(), out(row), feel(pi), rows(),
//          onCutCorr?(ms), flagLog?(row,step,type,i,when), onHit?(row,pi,t),
//          pfFire?(row,cell)}
// one instrument definition (instruments.json) -> the player's view of it, for
// EVERY player (moved here from the app's setOf, 12 Sep 2026). `base` is the
// page's way to the files: "" for the app on its own folder, "bank/" or
// "../bank/" for a player loading the hosted bank (make_bank.py). Bank files are
// named by their content, so the browser may cache them freely; files read
// straight off the disk may change under the same name and are fetched fresh.
function wggInstView(i, base){
  base=base||"";
  return {label:i.label, dir:base+i.dir, manifest:base+i.manifest, pack:i.pack,
          oneshots:i.oneshots ? base+i.oneshots : null,   // the one-shot bank, if recorded
          cache: base ? "default" : "no-store",
          // short high accents play the one-shot instead of the fragment
          // (udu only for now, David 22 Aug 2026 — see fireShortOneShot)
          shortOneShots:i.short_oneshots===true,
          // the ring hand-off under every doum — instruments with a long sustain
          // only (David, 11 Sep 2026: the udu yes, the cajon no; its bank is
          // there for one-shot mode)
          ring:i.ring===true,
          // which one-shots carry that ring: RING.source for every doum (the
          // udu's D′, chosen by ear), or "match" — the plain doums for a doum,
          // the doum variations for a doum variation (the frame drum, 11 Sep 2026)
          ringMatch:i.ring_source==="match",
          // taks ring too, at most this many at once (the frame drum: 3 —
          // David, 11 Sep 2026: "a tak should only be cut off by a pa"); 0 = no
          takRing:+i.tak_ring||0,
          // the ring's crossfade, when the instrument sets its own (s; null = RING.fade)
          ringFade:i.ring_fade_ms ? i.ring_fade_ms/1000 : null,
          // the instrument's EQ (engine.js eqChain; null = flat)
          eq:i.eq||null};
}
function wggDerive(row,n){
  const at=[];
  for(let i=0;i<n;i++) if(row.slots[i]) at.push(i);
  if(!at.length) return [];
  return at.map((s,k)=>{
    const end=(k+1<at.length)?at[k+1]:at[0]+n;
    return {start:s, len:end-s, accent:row.slots[s]};
  });
}
function WGGCore(env){
const LIB=env.LIB, SETS=env.SETS, DIAG=env.DIAG, EXPECT=env.EXPECT;
const ctx=()=>env.ctx(), CYC=()=>env.cycle(), QUANT=()=>env.quant(), pulseDur=()=>env.pulseDur();
const live=[];                                // every voice still sounding, for kill()
const artOf=(row,i)=> (row.art && row.slots[i] && row.slots[i]!=="F") ? (row.art[i]||null) : null;
function peakOf(b){
  let p=0;
  for(let c=0;c<b.numberOfChannels;c++){const d=b.getChannelData(c);
    for(let i=0;i<d.length;i+=7){const v=Math.abs(d[i]); if(v>p)p=v;}}
  return p||1;
}
function scrubBuf(buf){
  if(!buf) return buf;
  for(let c=0;c<buf.numberOfChannels;c++){
    const d=buf.getChannelData(c);
    for(let i=0;i<d.length;i++) if(!Number.isFinite(d[i])){ d[i]=0; DIAG.scrubbed++; }
  }
  return buf;
}
// ONE instrument's library — manifest, takes, gains, one-shot bank — from its
// definition. loadAll runs it for every instrument at start; the studio's
// preview runs it again whenever the studio changes one (gbStudio.refresh,
// David, 11 Sep 2026: "all the changes I make to an instrument should be
// reflected in the preview player"). The new library replaces the old in one
// assignment at the end, so a groove that is playing never sees half of it.
// every decoded file, by URL and version: the studio preview's refresh (a gain
// change, a reorder) then reloads an instrument without decoding ~200 files
// again — only a file whose audio really changed (a repair, a re-import) is
// fetched anew (David, 11 Sep 2026: "the interface got a little bit laggy").
// At start-up every key is new, so the app loads exactly as before.
const DECODED=new Map();
async function decodeOnce(u, ver, cm){
  const key=u+"#"+(ver||"");
  // the decode line is written exactly as make_artifact.py expects to find it:
  // the phone build swaps it for the embedded asset, in this one place
  if(!DECODED.has(key)) DECODED.set(key, (async()=>{
    const b=await ctx().decodeAudioData(await (await fetch(u,{cache:cm||"no-store"})).arrayBuffer());
    return b; })());
  try{ return await DECODED.get(key); }
  catch(e){ DECODED.delete(key); throw e; }
}
async function loadSet(id, def){
    const set=SETS[id], cm=set.cache||"no-store";
    const man=await (await fetch(set.manifest,{cache:cm})).json();
    const L={bpm:man.bpm, div:man.div, pulseSrc:60/man.bpm/man.div,
             files:{}, pulses:{}, preroll:{}, manstrokes:{}, manmanual:{}, wavOnset:{}, buffers:{}, strokes:{}, cutcorr:{},
             gains:{}, setGain:Math.pow(10, (def.gain_db || 0) / 20),
             // session boundaries from the studio's tempo map: the player
             // range is partitioned, every tempo belongs to one session
             handoffs:def.handoffs || {},
             cbpm:{}, sessions:[], srcBpm:man.bpm, pool:null,
             trims:{}, peaks:{}, warped:null, ratio:1, os:null, ver:{}};
    for(const c of man.cells){
      if(c.enabled === false) continue;      // rejected in the studio tool
      const ty = c.type[0]==="K" ? "T"+c.type.slice(1) : c.type;
      (L.files[ty] ||= []).push(set.dir+"/"+c.file);
      L.pulses[ty]=c.pulses;
      L.preroll[ty]=(c.preroll_ms||0)/1000;
      (L.manstrokes[ty] ||= []).push(c.strokes_ms||[]);
      // markers David placed by hand — never filtered off the grid, and they
      // anchor the warp at Tightness 0 (engine.js). A cell whose per-cell
      // switch is OFF hands over an empty list, so it behaves exactly as it did
      // before markers were honoured: accent-anchored, off-grid ones filtered.
      (L.manmanual[ty] ||= []).push(c.warp_manual_off ? [] : (c.strokes_ms_manual||[]));
      // three gain levels, all non-destructive (25 Aug 2026): per-take
      // gain_db + the take's SESSION gain (instruments.json session_gains,
      // keyed by the session tempo) fold together here; the set gain rides
      // L.setGain as before
      (L.gains[ty] ||= []).push(Math.pow(10,
        ((c.gain_db || 0) + (+((def.session_gains || {})[String(+(c.bpm ?? man.bpm))]) || 0)) / 20));
      // the tempo this take was played at: one instrument may hold several
      // recording sessions, and only one of them is right for a given tempo
      (L.cbpm[ty] ||= []).push(+c.bpm || man.bpm);
      // measured cut error (measure_cuts.py, 31 Aug 2026): how far this
      // take's real attack sits from the point the slicer aimed at the beat.
      // Applied at schedule time only while Diagnostics' A/B stands on B —
      // takes David repaired by hand never carry one.
      (L.cutcorr[ty] ||= []).push((c.cut_corr_ms || 0) / 1000);
      (L.wavOnset[ty] ||= []).push(c.onset_ms ?? null);
      // which VERSION of the file this is: a repair rewrites the audio under the
      // same name and stamps repaired_at, so the pair names the audio exactly
      (L.ver[ty] ||= []).push((c.repaired_at || "") + "|" + (c.imported_at || ""));
    }
    L.sessions=[...new Set(Object.values(L.cbpm).flat())].sort((a,b)=>a-b);
    await Promise.all(Object.keys(L.files).flatMap(k=>L.files[k].map(async(u,i)=>{
      (L.buffers[k] ||= [])[i]=await decodeOnce(u, (L.ver[k]||[])[i], cm);
    })));
    for(const k of Object.keys(L.buffers)){
      const peaks=L.buffers[k].map(peakOf);
      const t=Math.max(...peaks);
      L.trims[k]=peaks.map(p=>t/p);
      L.peaks[k]=peaks;                  // the ring hand-off peak-matches to these
      L.strokes[k]=L.buffers[k].map((b,i)=>{
        const ms=L.manstrokes[k][i], ps=60/((L.cbpm[k]||[])[i]||L.bpm)/L.div;
        // >=1 stroke, not >1 (21 Aug 2026): analyzeCell on decoded AAC can
        // hear codec pre-echo as a false onset just before the attack and
        // splice into it; the manifest stroke is always the safer anchor
        return (ms&&ms.length) ? strokesFromList(ms,ps,L.preroll[k]||0,(L.manmanual[k]||[])[i],b.duration)
                               : analyzeCell(b,ps,L.preroll[k]||0);
      });
    }
    // the ONE-SHOT BANK (22 Aug 2026): isolated strokes ringing to silence,
    // cut by slice_oneshots.py — D D' T T' P P', four each, 30 ms pre-roll
    // like the cells. The D' ring carries on under every doum cell in the
    // natural engine; all six banks are the drum computer's voices.
    if(set.oneshots){
      const om=await (await fetch(set.oneshots,{cache:cm})).json();
      const odir=set.oneshots.replace(/[^/]*$/,"");
      const os={pre:(om.preroll_ms||30)/1000, files:{}, buffers:{}, peaks:{}, trims:{}};
      const over={};
      for(const h of om.hits){ if(!/^[DTP]v?$/.test(h.type)) continue;
        (os.files[h.type]||=[]).push(odir+h.file); (over[h.type]||=[]).push(h.imported_at||""); }
      await Promise.all(Object.keys(os.files).flatMap(k=>os.files[k].map(async(u,i)=>{
        (os.buffers[k] ||= [])[i]=await decodeOnce(u, over[k][i], cm);
      })));
      for(const k of Object.keys(os.buffers)){
        const peaks=os.buffers[k].map(peakOf), t=Math.max(...peaks);
        os.peaks[k]=peaks; os.trims[k]=peaks.map(p=>t/p);
      }
      if(Object.keys(os.buffers).length) L.os=os;
    }
    L.rr={};
    LIB[id]=L;
}

// which recording session to play an instrument from at this tempo. The player
// range is partitioned among the sessions; each boundary is either set by hand
// on the studio's tempo map or defaults to the crossover where both neighbours
// are overdriven equally, relative to what stretching can take (speeding up
// tolerates ~3x more than slowing down).
function handoffAt(L,a,b){
  return L.handoffs[a+"|"+b]
      ?? Math.exp((0.03*Math.log(a)+0.10*Math.log(b))/0.13);
}
function pickSession(L,target){
  const ss=L.sessions;
  if(ss.length<2) return ss[0] ?? L.bpm;
  for(let i=0;i<ss.length-1;i++)
    if(target < handoffAt(L,ss[i],ss[i+1])) return ss[i];
  return ss[ss.length-1];
}
// only the chosen session's takes may play; a type recorded at just one tempo
// keeps all of its takes rather than falling silent
function poolFor(L){
  if(L.sessions.length<2){ L.pool=null; return; }
  L.pool={};
  for(const k of Object.keys(L.buffers)){
    const mine=(L.cbpm[k]||[]).map((b,i)=>b===L.srcBpm?i:-1).filter(i=>i>=0);
    L.pool[k]=mine.length?mine:L.buffers[k].map((_,i)=>i);
  }
}
// ---- the warp, lazily, per take (option A, 23 Aug 2026). Until today a tempo
// change re-spliced EVERY take of EVERY instrument (~315 warps, 425 ms on the
// Mac, seconds on an iPhone) — synchronously it froze the phone and ate the
// touches, sliced it played the wrong stretch for seconds. Now a take is warped
// the first time it is about to PLAY at the current ratio (1–3 ms, inside the
// 0.4 s look-ahead) and cached; a tempo change only clears the cache. Work is
// proportional to the groove, not to the library; nothing is ever stale.
function syncRatio(L){
  const pd=pulseDur();
  const src=pickSession(L, 60/pd/L.div);
  if(src!==L.srcBpm || !L.pool){ L.srcBpm=src; L.pulseSrc=60/src/L.div; poolFor(L); }
  // The cache is keyed on the PLAYING pulse, not on the session ratio: two
  // different sessions can yield the same ratio at different tempos, and a
  // take is now stretched from its OWN recorded tempo, not the session's.
  const key=pd.toFixed(6)+"|"+QUANT();
  if(L.warpKey!==key){ L.warpKey=key; L.ratio=pd/L.pulseSrc; L.wcache={};
                       L.native=(Math.abs(L.ratio-1)<1e-4 && QUANT()===0); }
  return L;
}
// The stretch for ONE take (24 Aug 2026). `poolFor` hands out takes from
// another session when a cell type has none at this one — David: "if there
// are no strokes or fill recordings in a specific tempo, the gap should be
// filled by what's available" — and such a take must be stretched from the
// tempo IT was played at, not from the session's. The udu's fills were the
// first case: recorded at 90 only, they played 11 % fast below the 87.6 BPM
// hand-off because the 80 session's ratio was used on a 90 BPM recording.
// The stroke maps have always used the take's own pulse (`ps` above), so
// this makes the warp agree with them.
function takeRatio(L,type,i){
  syncRatio(L);
  const src=(L.cbpm[type]||[])[i] || L.srcBpm || L.bpm;
  return pulseDur()/(60/src/L.div);
}
// take i of a type at the current tempo — raw at a session tempo, else warped once and cached
function takeBuf(L,type,i){
  const r=takeRatio(L,type,i);
  if(QUANT()===0 && Math.abs(r-1)<1e-4) return L.buffers[type][i];
  const c=(L.wcache[type]||=[]);
  if(!c[i]){
    const t0=performance.now();
    // At quantise 0 only the ACCENT anchors the warp (23 Aug 2026): with the
    // ghosts anchored too, the splice engine's masked-residue crossfade (22 ms
    // after each stroke's attack) landed inside the doum's loud ring behind a
    // −30 dB ghost — an audible click on udu_D3_80_04 at 75 BPM (David:
    // "a little click every 2nd round right after the initial doum"). The
    // ghost anchors stay in the manifest for quantise > 0 (the lab's Tightness).
    const anchors=warpAnchors(L.strokes[type][i],QUANT());   // engine.js — shared with the studio's editor
    c[i]=scrubBuf(warpCell(L.buffers[type][i],anchors,QUANT(),r,null));
    DIAG.warps=(DIAG.warps||0)+1; DIAG.warpMs=+(performance.now()-t0).toFixed(1);
  }
  return c[i];
}
// kept for its callers: now only syncs every set's session/ratio (cheap)
function rebuildWarp(){ for(const id of Object.keys(LIB)) syncRatio(LIB[id]); }
// the instrument's shortest cell of a stroke (a variation-marked step prefers
// the shortest's own variation cell, exactly as resolve() does)
function shortestType(L,accent,variation){
  if(!L) return null;
  const alts=Object.keys(L.files)
    .filter(k=>k[0]===accent && /^\d+$/.test(k.slice(1)))
    .map(k=>({k,n:+k.slice(1)})).sort((a,b)=>a.n-b.n);
  if(!alts.length) return null;
  const t=alts[0].k;
  return (variation && L.files[t+"v"]) ? t+"v" : t;
}
// 0 when pi is the cell's own start; for a JINGLE cell, k when pi is its k-th
// repeat inside the gap (the recording's length in pulses times k); else -1
function cellRepeat(row,c,pi){
  if(c.start===pi) return 0;
  if(c.accent!=="J" || artOf(row,c.start)==="stop") return -1;   // a stopped jingle sounds once
  const L=LIB[row.set]; if(!L) return -1;
  const r=resolve(row,c), n=r ? (L.pulses[r.type]||0) : 0;
  if(n<=0) return -1;
  const off=(pi-c.start+CYC())%CYC();
  return (off<c.len && off%n===0) ? off/n : -1;
}
function resolve(row,c,pfFire){
  const L=LIB[row.set]; if(!L) return null;
  // a FIRING periodic fill replaces the accent's cell outright with a recorded
  // fill spanning to the next accent — exact length first, else the nearest
  // recorded one, exactly like the painted cross. An instrument with no fill
  // recordings falls through and plays its normal cell: nothing goes silent.
  if(pfFire){
    if(L.files["F"+c.len]) return {type:"F"+c.len, exact:true, fill:true};
    const fAlts=Object.keys(L.files)
      .filter(k=>k[0]==="F" && /^\d+$/.test(k.slice(1)))
      .map(k=>({k,n:+k.slice(1)}))
      .sort((a,b)=>Math.abs(a.n-c.len)-Math.abs(b.n-c.len));
    if(fAlts.length) return {type:fAlts[0].k, exact:false, fill:true};
  }
  // variation-flagged slot prefers its variation cell (type suffix v — typed
  // as a prime, D3', in the studio; spec §14 called these fill variants);
  // until variation cells are recorded this silently plays the base cell
  if(row.fills && row.fills[c.start] && L.files[c.accent+c.len+"v"])
    return {type:c.accent+c.len+"v", exact:true, fill:true};
  const exact=c.accent+c.len;
  if(L.files[exact]) return {type:exact, exact:true};
  const alts=Object.keys(L.files)
    .filter(k=>k[0]===c.accent && /^\d+$/.test(k.slice(1)))
    .map(k=>({k,n:+k.slice(1)}))
    .sort((a,b)=>Math.abs(a.n-c.len)-Math.abs(b.n-c.len));
  return alts.length ? {type:alts[0].k, exact:false} : null;
}
// ------------------------------------------------------------------ audio
function takeIdxs(L,type){
  const bank=L.buffers[type];
  return (L.pool&&L.pool[type]&&L.pool[type].length) ? L.pool[type] : bank.map((_,n)=>n);
}
// ROUND-ROBIN PER INSTRUMENT, NOT PER ROW (David, 23 Aug 2026): two rows of the
// same instrument used to start at the same take and, on a shared pulse, play the
// identical sample at the identical instant — a phase-locked double. One counter
// per instrument set and cell type (and per one-shot bank) means rows interleave
// the takes instead. Reset on Play (start()). The ring under a doum is score-
// picked, so it gets a same-pulse guard instead (ringUsed).
function rrOf(row){ const L=LIB[row.set]; return L.rr||(L.rr={}); }
// ---- ghost fill (31 Aug 2026, David: "as long as an instrument is not in
// one-shot mode, let's fill all spaces with ghost notes … always use loop
// fragments, not one shot samples"). Every 16th NOT covered by a cell's own
// sample gets a fragment of a recorded G4 ghost run — the takes that were
// documented as unreachable from the grid. His hand pattern is preserved by
// construction: he played every beat R then hand-to-hand, each G4 take is one
// beat of four 16ths (R L R L), and a fragment always starts at the phase of
// the 16th it fills — so fragments never cross a beat, and every beat
// restarts R. Developer-mode switch; a "drum"-engine row is excluded.
// ON by default since 11 Sep 2026 (David: steps no cell covers are filled with
// the recorded ghost runs on every instrument that has them); a device that
// switched it off keeps it off
// which pulses of the cycle need ghosts, as run-start -> run-length (in
// pulses, capped at the beat boundary). Coverage is the RESOLVED cell's
// pulse count — David: "anything after a X4 cell once the sample stopped" —
// so a 7-pulse gap behind a D4 gets ghosts on its last three 16ths. An empty
// row is all spaces, and gets the full carpet.
function ghostRuns(row,cells){
  if(!env.ghostFill() || row.eng==="drum") return null;
  const L=LIB[row.set];
  if(!L || !L.buffers.G4 || !L.buffers.G4.length) return null;
  const cov=new Array(CYC()).fill(false);
  for(const c of cells){
    const r=resolve(row,c);
    if(!r) continue;
    // a jingle tiles its gap; a STOPPED stroke owns its gap in silence
    const span=(c.accent==="J" || artOf(row,c.start)==="stop") ? c.len
             : Math.min(L.pulses[r.type]||c.len, c.len);
    for(let k=0;k<span;k++) cov[(c.start+k)%CYC()]=true;
  }
  const runs=new Map();
  let i=0;
  while(i<CYC()){
    if(cov[i]){ i++; continue; }
    let n=1;
    while(n<4-(i%4) && i+n<CYC() && !cov[i+n]) n++;
    runs.set(i,n); i+=n;
  }
  return runs.size?runs:null;
}
// one fragment: G4 take, cut at stroke boundaries, phase-matched. The first
// ghost lands ON the (groove-mapped) grid exactly like an accent: the cut
// leads its validated attack stroke by 12 ms and the source starts that much
// early. The cut END is the expected grid position, not a stroke — some G4
// maps are imperfect (take 01 is missing a 16th), and a mid-ring cut under a
// 15 ms fade is inaudible while a wrong-stroke START never is; a take that
// cannot offer a valid attack at this phase passes to the next in the
// round-robin.
function fireGhost(row,pi,n,when){
  const L=LIB[row.set];
  const idxs=takeIdxs(L,"G4"), rr=rrOf(row);
  const p=pi%4;
  for(let tries=0;tries<idxs.length;tries++){
    const i=idxs[(rr.G4=(rr.G4||0)+1)%idxs.length];
    const st=(L.manstrokes.G4||[])[i]||[];
    const srcPulse=60/((L.cbpm.G4||[])[i]||L.bpm)/(L.div||4);   // seconds
    const pre=(L.preroll.G4||0.03);
    const want=pre+p*srcPulse;
    const hit=st.map(v=>v/1000).find(v=>Math.abs(v-want)<srcPulse/4);
    if(hit==null) continue;                       // this take lacks the phase
    const buf=takeBuf(L,"G4",i);
    if(!buf) return;
    const ratio=takeRatio(L,"G4",i);
    const t0=hit*ratio, lead=Math.min(0.012,t0);
    const off=t0-lead;
    const endSrc=pre+(p+n)*srcPulse;
    const end=Math.min(buf.duration, endSrc*ratio);
    const dur=Math.max(0.03,end-off);
    const lin=(L.trims.G4?L.trims.G4[i]:1)*((L.gains.G4||[])[i]??1)*(L.setGain??1);
    const at=Math.max(ctx().currentTime,when-lead);
    const s2=ctx().createBufferSource(); s2.buffer=buf;
    const g=ctx().createGain();
    g.gain.setValueAtTime(0,at);
    g.gain.linearRampToValueAtTime(lin,at+0.004);
    g.gain.setValueAtTime(lin,Math.max(at+0.004,at+dur-0.015));
    g.gain.linearRampToValueAtTime(0.0001,at+dur);
    s2.connect(g); g.connect(env.out(row));
    s2.start(at,off,dur+0.01);
    EXPECT.push(at);
    const node={s:s2,g}; live.push(node);
    s2.onended=()=>{const j=live.indexOf(node); if(j>=0) live.splice(j,1);};
    DIAG.ghosts=(DIAG.ghosts||0)+1;
    return;
  }
}
// which take the NEXT fire() of this type would play, without consuming it
function peekTake(row,type){
  const idxs=takeIdxs(LIB[row.set],type), rr=rrOf(row);
  return idxs[((rr[type]||0)+1)%idxs.length];
}
// opts (the ring hand-off, 22 Aug 2026): {fadeFrom} replaces the 8 ms cut
// with the slow crossfade-out (equal-power) from that point to the cell's
// end. The caller learns the take from peekTake() first — fire() then
// advances the round-robin onto exactly that index. Returns the voice
// {i,buf,lin,at,len} so the ring can be laid under it.
function fire(row,type,when,step,opts){
  const L=LIB[row.set];
  const bank=L.buffers[type];
  if(!bank||!bank.length) return null;
  const idxs=takeIdxs(L,type);
  const rr=rrOf(row);
  const i=idxs[(rr[type]=(rr[type]||0)+1)%idxs.length];
  // the flag loop (Diagnostics): remember which take just sounded at which
  // cell, so a tap can name the exact fragment David heard
  if(step!=null && env.flagLog) env.flagLog(row, step, type, i, when);
  const buf=takeBuf(L,type,i);                 // warped for this tempo on first use
  // peak match within the type, then the studio's per-cell and per-set trims
  const lin=L.trims[type][i] * ((L.gains[type]||[])[i] ?? 1) * (L.setGain ?? 1);
  const ccRatio=takeRatio(L,type,i);
  const effPre=(L.preroll[type]||0)*ccRatio;
  // cut correction (Diagnostics A/B, 31 Aug 2026): the measured attack error,
  // scaled like the pre-roll. Negative = the take sounds early as cut, so it
  // starts later by exactly that much and the real attack lands on the beat.
  const cc=env.cutCorr() ? (((L.cutcorr||{})[type]||[])[i]||0)*ccRatio : 0;
  if(cc && env.onCutCorr) env.onCutCorr(Math.round(-cc*1000));
  const at=Math.max(ctx().currentTime, when-effPre-cc);
  // A cell's sound ends where the row's next stroke begins (David, 6 Sep
  // 2026). A substituted cell longer than its gap — the riq's D3 standing in
  // for a one-step doum — used to run its ghosts under the next cell: across
  // the cycle wrap the D3's second ghost landed 5 ms off the D4's first, a
  // flam from the second pass on that the studio, auditioning one cell alone,
  // could never show. Fade 15 ms, ending 5 ms before the next stroke's time —
  // the slicer's own margin when it cuts a cell from a take. Exact-length
  // cells are already cut there on disk; cells shorter than their gap are
  // untouched; the ring hand-off is its own voice and runs on.
  let len=buf.duration;
  let cutAt=(opts&&opts.cutAt!=null) ? opts.cutAt-0.005 : null;
  // a STOP (David, 6 Sep 2026): the same fade, with an earlier deadline — this
  // take's first recorded ghost (its second stroke on the manifest map), or
  // one pulse after the attack where no ghost was detected. opts.stop carries
  // the pulse length for that fallback.
  if(opts&&opts.stop){
    const st=L.strokes[type][i]||[];
    const atk=at+(st.length ? st[0].t*ccRatio : effPre);
    const ghost=st.length>1 ? at+st[1].t*ccRatio : atk+opts.stop;
    if(cutAt==null || ghost-0.005<cutAt) cutAt=ghost-0.005;
    DIAG.stops=(DIAG.stops||0)+1;
  }
  const cut=cutAt!=null && cutAt<at+len;
  if(cut){ len=Math.max(0.0015,cutAt-at); DIAG.cuts=(DIAG.cuts||0)+1; }
  const s=ctx().createBufferSource(); s.buffer=buf;
  const g=ctx().createGain();
  g.gain.setValueAtTime(0,at);
  g.gain.linearRampToValueAtTime(lin,at+0.0015);
  if(cut){
    g.gain.setValueAtTime(lin,Math.max(at+0.0015,at+len-0.015));
    g.gain.linearRampToValueAtTime(0,at+len);
  }else if(opts&&opts.fadeFrom!=null){
    const f0=at+opts.fadeFrom, d=Math.max(0.001,len-opts.fadeFrom);
    if(RING.curve==="eq") g.gain.setValueCurveAtTime(ringCurveDown(lin),f0,d);
    else { g.gain.setValueAtTime(lin,f0); g.gain.linearRampToValueAtTime(0,at+len); }
  }else{
    g.gain.setValueAtTime(lin,at+len-0.008);
    g.gain.linearRampToValueAtTime(0,at+len);
  }
  s.connect(g); g.connect(env.out(row));
  s.start(at); s.stop(at+len+0.02);
  EXPECT.push(at);                 // this stroke should make sound at 'at'
  const node={s,g}; live.push(node);
  s.onended=()=>{const j=live.indexOf(node); if(j>=0) live.splice(j,1);};
  return {i,buf,lin,at,len};
}
// ---- the ring hand-off and the drum computer (22 Aug 2026; RING in engine.js)
// A doum cell ends where the slicer cut it, at the next accent — on the udu
// that is ~0.5 s into a ring that lasts over a second. Under every doum cell
// the natural engine lays a D' one-shot of the same drum: started in sync
// with the cell's attack, silent, peak-matched to the take, faded up while
// the cell fades down over RING.fade to the cell's end, then ringing on under
// whatever follows. Chosen per stroke among the four D' one-shots by "match
// both" (ringChoose). Doums only — taks and pas are short anyway.
let SCHED_PULSE=0, RING_USED={pulse:-1, sets:{}};
function ringUsed(setId){
  if(RING_USED.pulse!==SCHED_PULSE){ RING_USED={pulse:SCHED_PULSE, sets:{}}; }
  return RING_USED.sets[setId]||(RING_USED.sets[setId]=new Set());
}
function fireRing(row,type,when,step,cutAt){
  const L=LIB[row.set], os=L.os;
  const acc=type[0];                         // D, or T on an instrument whose taks ring
  const want=SETS[row.set].ringMatch ? acc+(type.endsWith("v")?"v":"") : RING.source;
  const key=(os.buffers[want]&&os.buffers[want].length)?want:acc;
  const bank=os.buffers[key];
  if(!bank||!bank.length) return fire(row,type,when,step,{cutAt});
  const ti=peekTake(row,type);
  const cellBuf=takeBuf(L,type,ti), ratio=takeRatio(L,type,ti);
  const strokes=L.strokes[type][ti], last=strokes.length?strokes[strokes.length-1].t*ratio:0;
  const rf=SETS[row.set].ringFade;
  const fadeFrom=ringFadeFrom(cellBuf.duration,last,rf??undefined,rf?0.01:undefined);
  const cell=fire(row,type,when,step,{fadeFrom,cutAt});
  if(!cell) return null;
  const preC=(L.preroll[type]||0)*ratio;
  const cands=bank.map((b,j)=>({key,j,buf:b,peak:os.peaks[key][j]}));
  let pick=ringChoose(cellBuf,L.peaks[type][cell.i],fadeFrom,preC,cands,os.pre,RING.pick);
  let c=pick&&pick.best;
  // same-pulse guard (David, 23 Aug 2026): another row of this instrument may
  // already have taken the best ring on this pulse — take the next-best instead
  if(c && pick.rows && pick.rows.length){
    const used=ringUsed(row.set);
    if(used.has(c.key+"#"+c.j)){
      const order=pick.rows.slice().sort((a,b)=>a.score-b.score);
      const alt=order.find(r=>!used.has(r.key+"#"+r.j));
      if(alt) c=cands.find(x=>x.key===alt.key&&x.j===alt.j)||c;
    }
    used.add(c.key+"#"+c.j);
  }
  if(!c){ const k="os:"+key, rr=rrOf(row); c=cands[(rr[k]=(rr[k]||0)+1)%cands.length]; }
  const lin=cell.lin*(L.peaks[type][cell.i]/(c.peak||1))*Math.pow(10,RING.db/20);
  const at=cell.at+preC-os.pre;             // both attacks land on 'when'
  const f0=cell.at+fadeFrom, f1=cell.at+cell.len, d=Math.max(0.001,f1-f0);
  const s=ctx().createBufferSource(); s.buffer=c.buf;
  const g=ctx().createGain();
  g.gain.setValueAtTime(0,at);
  if(RING.curve==="eq") g.gain.setValueCurveAtTime(ringCurveUp(lin),f0,d);
  else { g.gain.setValueAtTime(0,f0); g.gain.linearRampToValueAtTime(lin,f1); }
  const end=at+c.buf.duration;
  g.gain.setValueAtTime(lin,end-0.02); g.gain.linearRampToValueAtTime(0,end);
  s.connect(g); g.connect(env.out(row));
  s.start(at); s.stop(end+0.02);
  if(acc==="T") limitTaks(row,when);
  const node={s,g,end,kind:acc}; live.push(node); row.rings.push(node);
  s.onended=()=>{const j=live.indexOf(node); if(j>=0) live.splice(j,1);
                 const k=row.rings.indexOf(node); if(k>=0) row.rings.splice(k,1);};
  return cell;
}
// the drum computer: one one-shot on the accent, the primed bank for a
// variation-dotted step, round-robin per row and bank, nothing in between
// returns false when the bank has no single stroke for this accent — the caller
// then plays the recorded cell instead (David, 12 Sep 2026: never silence)
function fireOneShot(row,accent,when,variation){
  const L=LIB[row.set], os=L.os; if(!os) return false;
  const key=(variation&&os.buffers[accent+"v"])?accent+"v":accent;
  const bank=os.buffers[key]; if(!bank||!bank.length) return false;
  const k="os:"+key, rr=rrOf(row), i=(rr[k]=(rr[k]||0)+1)%bank.length;
  const buf=bank[i];
  const lin=os.trims[key][i]*(L.setGain??1);
  const at=Math.max(ctx().currentTime,when-os.pre), len=buf.duration;
  const s=ctx().createBufferSource(); s.buffer=buf;
  const g=ctx().createGain();
  g.gain.setValueAtTime(0,at); g.gain.linearRampToValueAtTime(lin,at+0.0015);
  g.gain.setValueAtTime(lin,at+len-0.02); g.gain.linearRampToValueAtTime(0,at+len);
  s.connect(g); g.connect(env.out(row));
  s.start(at); s.stop(at+len+0.02);
  EXPECT.push(at);
  const node={s,g,end:at+len,kind:accent}; live.push(node);
  // ring rules only on an instrument that rings (David, 11 Sep 2026: "the cajon
  // should not have any ring rule"): there a doum single stroke rings until the
  // next doum or pa and, where taks ring, a tak single stroke until a pa (at most
  // takRing at once); everywhere else a single stroke plays out as recorded
  const S0=SETS[row.set];
  if(S0.ring){
    if(accent==="T" && S0.takRing) limitTaks(row,at);
    if(accent==="D" || (accent==="T" && S0.takRing)) row.rings.push(node);
  }
  s.onended=()=>{const j=live.indexOf(node); if(j>=0) live.splice(j,1);
                 const k=row.rings.indexOf(node); if(k>=0) row.rings.splice(k,1);};
  return true;
}
// SHORT HIGH ACCENTS (David, 22 Aug 2026, from the udu lab). A one-step cell
// has no ghost behind it: the slicer cuts it at the next accent — about 0.21 s
// on the udu — so a bare tak or pa never rings at all. For the HIGH accents
// the one-shot is simply the better recording of that same event, ringing to
// silence, and it costs nothing musically because there are no ghosts to lose.
// Level is peak-matched to the fragment it replaces, so the groove's balance
// does not move (trims normalise a type's takes to one peak, so the match is
// the same whichever take would have played). A variation-marked step plays
// the PRIMED one-shot, not the plain one (David). These voices are
// deliberately NOT registered in row.rings: they ring out whatever follows —
// unlike a doum's ring, which the next doum or pa mutes. DOUMS ARE EXCLUDED
// on purpose: the udu bass sounds different depending on when the next stroke
// lands, so a fixed one-shot would be wrong there.
function fireShortOneShot(row,accent,when,variation){
  const L=LIB[row.set], os=L.os; if(!os) return false;
  const key=(variation&&os.buffers[accent+"v"]&&os.buffers[accent+"v"].length)
            ? accent+"v" : accent;
  const bank=os.buffers[key]; if(!bank||!bank.length) return false;
  const k="os:"+key, rr=rrOf(row), i=(rr[k]=(rr[k]||0)+1)%bank.length;
  const buf=bank[i];
  const ty=accent+"1";
  let lin;
  const cb=L.buffers[ty];
  if(cb&&cb.length){
    const ci=peekTake(row,ty);
    lin=L.trims[ty][ci]*((L.gains[ty]||[])[ci] ?? 1)*(L.setGain ?? 1)
        *(L.peaks[ty][ci]/(os.peaks[key][i]||1));
  }else{
    lin=os.trims[key][i]*(L.setGain ?? 1);
  }
  const at=Math.max(ctx().currentTime,when-os.pre), len=buf.duration;
  const s=ctx().createBufferSource(); s.buffer=buf;
  const g=ctx().createGain();
  g.gain.setValueAtTime(0,at); g.gain.linearRampToValueAtTime(lin,at+0.0015);
  g.gain.setValueAtTime(lin,at+len-0.02); g.gain.linearRampToValueAtTime(0,at+len);
  s.connect(g); g.connect(env.out(row));
  s.start(at); s.stop(at+len+0.02);
  EXPECT.push(at);
  const node={s,g,end:at+len}; live.push(node);
  s.onended=()=>{const j=live.indexOf(node); if(j>=0) live.splice(j,1);};
  return true;
}
// the resonance-voice rule: a doum's ring carries on through taks and ghosts;
// the next doum or pa on the same drum stops it (RING.stopMs from the attack)
// at most SETS[set].takRing tak rings sound at once (David: three); a new one
// mutes the oldest, in the same RING.stopMs fade
function limitTaks(row,when){
  const max=SETS[row.set].takRing||0; if(!max||!row.rings) return;
  const on=row.rings.filter(v=>v.kind==="T" && v.end>when);   // oldest first: push order
  while(on.length>=max){
    const v=on.shift();
    try{
      v.g.gain.cancelScheduledValues(when); v.g.gain.setValueAtTime(v.g.gain.value,when);
      v.g.gain.linearRampToValueAtTime(0,when+RING.stopMs); v.s.stop(when+RING.stopMs+0.02);
      v.end=when+RING.stopMs+0.02;
    }catch(e){}
  }
}
function muteRings(row,when,accent){
  if(!RING.stop||!row.rings) return;
  for(const v of row.rings){
    if(v.end<=when) continue;
    // a pa damps the whole skin; a doum stops the doum ring before it and leaves
    // tak rings alone (the frame drum, David 11 Sep 2026: "a tak should only be
    // cut off by a pa"). On the udu and the cajon every ring is a doum's, so a
    // doum or a pa stops them all, exactly as before.
    if(accent==="D" && v.kind==="T") continue;
    try{
      v.g.gain.cancelScheduledValues(when); v.g.gain.setValueAtTime(v.g.gain.value,when);
      v.g.gain.linearRampToValueAtTime(0,when+RING.stopMs); v.s.stop(when+RING.stopMs+0.02);
      v.end=when+RING.stopMs+0.02;
    }catch(e){}
  }
  row.rings=row.rings.filter(v=>v.end>ctx().currentTime-0.1);
}
function kill(rel){
  const now=ctx()?ctx().currentTime:0;
  for(const {s,g} of live){ try{
    g.gain.cancelScheduledValues(now); g.gain.setValueAtTime(g.gain.value,now);
    g.gain.linearRampToValueAtTime(0,now+rel); s.stop(now+rel+0.005);
  }catch(e){} }
  live.length=0;
  for(const r of env.rows()) r.rings=[];
}

// one pulse of one row: everything that sounds, in the order it is decided
function playPulse(row,cells,ghosts,pi,nextTime,pd,absPulse){
  SCHED_PULSE=absPulse;                        // the ring guard keys on the absolute pulse
  // THE FEEL OF A PULSE IS DECIDED ONCE (David, 12 Sep 2026: a cell is cut where
  // the next stroke ACTUALLY lands). The groove offset of each row's pulse —
  // map plus any random nudge — is drawn the first time anything needs it and
  // remembered: the cell before a stroke cuts at exactly the time that stroke
  // then starts. (The cut used to draw a fresh nudge of its own.)
  const fm=row._feel||(row._feel=new Map());
  const feelAt=(abs,p)=>{ if(!fm.has(abs)) fm.set(abs, env.feel(p)); return fm.get(abs); };
  for(const k of fm.keys()) if(k<absPulse) fm.delete(k);
    // the ghost carpet: the run's FIRST note rides the groove map exactly
    // like an accent fragment (David, 31 Aug 2026); the rest of the
    // fragment carries his recorded hand-to-hand feel
    if(ghosts && ghosts.has(pi)) fireGhost(row,pi,ghosts.get(pi),nextTime+feelAt(absPulse,pi));
    for(const c of cells){
      // a JINGLE cell tiles its gap (David, 6 Sep 2026): the recording repeats
      // at its own length until the row's next stroke, each repeat ending
      // under the cut rule — a four-step X on the riq is the two-ghost J2
      // twice. Repeat 0 is the painted stroke; visuals and fills are its alone.
      const rep=cellRepeat(row,c,pi);
      if(rep<0) continue;
      if(rep===0 && env.onHit) env.onHit(row,pi,nextTime);   // the player's visual, released on the ear's beat
      const at=nextTime+feelAt(absPulse,pi);             // the groove engine: where this accent lands
      // periodic fill, audio side (David, 22 Aug 2026): on the firing cycle
      // the fill takes the place of the accent's cell. The decision comes
      // from the AUDIO cycle counter (_pfq), not the visual one (_pfc): the
      // scheduler runs LOOKAHEAD ahead of the marker, so beat 1 of a new
      // cycle is queued before the visual counter has ticked — both counters
      // count the same boundaries, audio's just leads by the look-ahead
      const pfFire = rep===0 && !!env.pfFire && env.pfFire(row,c);   // the app's periodic fills
      const r=resolve(row,c,pfFire);
      const L=LIB[row.set];
      // a doum or pa on a drum with a one-shot bank stops the rings that
      // are still sounding from earlier doums (the resonance-voice rule)
      if(L&&L.os&&SETS[row.set].ring&&(c.accent==="D"||c.accent==="P")) muteRings(row,at,c.accent);
      // where this row's next stroke lands — the cell's sound ends there
      const left=c.len-((pi-c.start+CYC())%CYC());   // pulses to the row's next stroke
      const cutAt=nextTime+left*pd+feelAt(absPulse+left,(c.start+c.len)%CYC());
      const variation=!!(row.fills&&row.fills[c.start]);
      // a STOP (David, 6 Sep 2026): one stroke, nothing after — the one-shot
      // where a bank exists, else the shortest cell cut before its first
      // ghost (fire's stop deadline); a firing fill still wins
      if(artOf(row,c.start)==="stop" && !(r&&r.type[0]==="F")){
        if(!(L&&L.os&&/^[DTP]$/.test(c.accent)&&fireOneShot(row,c.accent,at,variation))){
          const ty=shortestType(L,c.accent,variation);   // no single stroke: the shortest cell
          if(ty) fire(row,ty,at,c.start,{cutAt, stop:pd}); }
        DIAG.fired++;
      }else
      // a bare high accent (the next accent is on the very next step) plays
      // its one-shot instead of the barely-there fragment — natural engine,
      // instruments flagged for it (udu today); a firing fill still wins
      if(row.eng!=="drum" && L&&L.os && SETS[row.set].shortOneShots
         && c.len===1 && (c.accent==="T"||c.accent==="P")
         && !(r&&r.type[0]==="F")
         && fireShortOneShot(row,c.accent,at,!!(row.fills&&row.fills[c.start]))){
        DIAG.fired++;
      }else if(row.eng==="drum" && L&&L.os && /^[DTP]$/.test(c.accent) && !(r&&r.type[0]==="F")
               && fireOneShot(row,c.accent,at,!!(row.fills&&row.fills[c.start]))){
        // the drum computer: one-shots only; a FILL still plays its recorded
        // fill cell (below), so nothing a student painted goes silent — and an
        // accent with no single stroke falls through to its recorded cell
        DIAG.fired++;
      }else if(r){
        // ring rules only where the instrument rings: a doum ring needs `ring`,
        // a tak ring needs `ring` AND `tak_ring` (David, 11 Sep 2026)
        const S1=SETS[row.set];
        if(L&&L.os&&S1.ring&&(r.type[0]==="D"||(S1.takRing&&r.type[0]==="T")))
          fireRing(row,r.type,at,c.start,cutAt);
        else fire(row,r.type,at,c.start,{cutAt});
        DIAG.fired++;
      }
    }
}

// on Play: the ring guard and every row's remembered feel start afresh
function resetRing(){ RING_USED={pulse:-1, sets:{}}; for(const r of env.rows()) delete r._feel; }
return {live, loadSet, decodeOnce, syncRatio, takeRatio, takeBuf, rebuildWarp, resolve,
        shortestType, cellRepeat, ghostRuns, fireGhost, peekTake, fire, fireRing,
        fireOneShot, fireShortOneShot, limitTaks, muteRings, kill, playPulse, resetRing,
        peakOf, scrubBuf, pickSession};
}
