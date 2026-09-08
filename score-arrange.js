/* arrange.js — from a read score to a rated pan list and a Handpan Studio piece.
   PROTOTYPE, 8 Sep 2026 (SCORE-IMPORT.md). Pure functions, no DOM; runs in node and the browser.

   THE RULES, as worked out by hand on Let It Be (D Kurd 17) and the Canon (E Kurd 21) on 7 Sep:
   1. Melody = the top voice of the treble staff; harmony = the treble's other notes; bass = the bass staff.
   2. Rate a pan for a piece at every transposition: first how many melody pitches it has, then how much of
      the melody sits on the top shell, then how many bass ROOTS it has low (ding or underside), then how many
      harmony pitches — and prefer the smaller shift. A missing note is not "slightly wrong": it is a note
      the player cannot strike, so coverage comes before everything.
   3. Warnings, not silent compromises: more than 7–8 pitch classes (chromatic, modulating) → "not for one
      pan"; a melody span wider than the pan's top shell; no pan above 90 % → "hard to transport".
   4. The bass: a held or repeated root → one stroke per chord change on the ding/underside; a moving figure
      (eighths) → the figure kept and moved to the octave the pan has; the shape (root · 3rd · 5th · 8ve) is
      preserved by raising or lowering each note to the nearest available octave.
   5. A note the pan has in another octave goes there, unmarked (register, not foreignness — David, 9 Sep); a
      note whose pitch class the pan lacks → the nearest chord tone in the same direction that keeps the
      contour, marked as a stand-in and logged.
   6. Hands: bass on the left, melody alternating from the right; a melody note on a bass eighth takes the
      other hand. Chords stay as written (David, 7 Sep: "let's keep them for now"); the transposer's
      one-hand rule flags what one hand cannot reach.
   7. Tables: eighth grid (sub 2) unless the score has sixteenths; two bars a row; sections cut at double bars,
      repeat signs and rehearsal numbers, filled to four rows where the phrase allows (David: "fill the tables
      to four rows"). */
(function(root){
"use strict";
const NOTE={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
function midiOf(s){ const m=String(s).match(/^([A-G])([♯♭#b]?)(-?\d)$/); if(!m) return null;
  return 12*(+m[3]+1)+NOTE[m[1]]+({"♯":1,"#":1,"♭":-1,"b":-1,"":0})[m[2]]; }
const NAMES=["C","C♯","D","E♭","E","F","F♯","G","A♭","A","B♭","B"];
const nameOf=m=>NAMES[((m%12)+12)%12]+(Math.floor(m/12)-1);

/* ───────── the pan as positions: 0 = ding, 1..n = top shell, "b1".. = underside ───────── */
function panMap(pan){
  const pos=[{p:0,midi:midiOf(pan.ding),top:false,ding:true}];
  (pan.fields||[]).forEach((s,i)=>pos.push({p:i+1,midi:midiOf(s),top:true}));
  (pan.bottom||[]).forEach((s,i)=>pos.push({p:"b"+(i+1),midi:midiOf(s),top:false,under:true}));
  const byMidi=new Map(); for(const q of pos) if(!byMidi.has(q.midi)) byMidi.set(q.midi,q);
  return {pan,pos,byMidi,pcs:new Set(pos.map(q=>((q.midi%12)+12)%12)),low:pos.filter(q=>!q.top)};
}

/* one hand's reach — copied from app.html derive()/zigzag at commit 7bf55c3 (8 Sep 2026), not shared:
   the ring is the top shell's zigzag by pitch; neighbours on the ring lie under one hand, and so do the
   ding and the two lowest fields. The underside is nobody's neighbour. */
function zigzag(n){ const odds=[],evens=[]; for(let i=1;i<=n;i++)(i%2?odds:evens).push(i); return odds.concat(evens.reverse()); }
function reach(pan){
  const ring=zigzag((pan.fields||[]).length); const adj=new Set(); const pair=(a,b)=>{ adj.add(a+"|"+b); adj.add(b+"|"+a); };
  for(let k=0;k<ring.length;k++) pair(ring[k],ring[(k+1)%ring.length]); pair(0,1); pair(0,2);
  return (a,b)=>a===b||adj.has(a+"|"+b);
}
/* ───────── the score's voices ───────── */
/* score: the reader's result — bars[{staffs:[{clef,cols:[{onset,dur,notes:[{midi}],rest}]}]}]
   returns {melody:[{bar,onset,dur,midi}], harmony:[…], bass:[…], pcs, beats} */
function voices(score){
  const melody=[],harmony=[],bass=[]; const pcs=new Set();
  score.bars.forEach((b,bi)=>{
    b.staffs.forEach((s,si)=>{
      /* the MELODY IS THE TOP STAFF, whatever its clef (Wellerman, 9 Sep: both staffs bass clefs, so everything
         went to the bass and the tune came out as roots on the ding); the staffs below it are the bass */
      const isTreble=si===0;
      for(const c of s.cols){
        if(c.rest||!c.notes.length) continue;
        const ns=c.notes.slice().sort((a,b)=>b.midi-a.midi);
        for(const n of ns) pcs.add(((n.midi%12)+12)%12);
        if(isTreble){ melody.push({bar:bi,onset:c.onset,dur:c.dur,midi:ns[0].midi,q:c.q});
                      for(const n of ns.slice(1)) harmony.push({bar:bi,onset:c.onset,dur:c.dur,midi:n.midi}); }
        else for(const n of ns) bass.push({bar:bi,onset:c.onset,dur:c.dur,midi:n.midi});
      }
    });
  });
  return {melody,harmony,bass,pcs,beats:score.meter?score.meter.beats:4,fifths:score.key?score.key.fifths:0};
}

/* ───────── the rating ───────── */
/* every pan × every shift (−30…+18 semitones). Score tuple, lexicographic:
   melody coverage · melody on the top shell · bass roots low · harmony coverage · |shift| small.
   Bass roots = the lowest bass note at each chord change (each bar's first bass onset and each half bar). */
function bassRoots(v){
  const roots=[]; const seen=new Set();
  for(const n of v.bass){ const key=n.bar+":"+Math.floor(n.onset/(v.beats/2)); if(seen.has(key)) continue;
    const same=v.bass.filter(m=>m.bar===n.bar&&Math.floor(m.onset/(v.beats/2))===Math.floor(n.onset/(v.beats/2)));
    roots.push(Math.min(...same.map(m=>m.midi))); seen.add(key); }
  return roots;
}
function ratePan(pan,v){
  const pm=panMap(pan); const roots=bassRoots(v);
  const mel=v.melody.map(n=>n.midi), har=v.harmony.map(n=>n.midi);
  let best=null;
  for(let sh=-30;sh<=18;sh++){
    let pcHit=0,hit=0,top=0; for(const m of mel){ const q=pm.byMidi.get(m+sh); if(pm.pcs.has((((m+sh)%12)+12)%12)) pcHit++; if(q){ hit++; if(q.top) top++; } }
    let low=0; for(const r of roots){ const pc=(((r+sh)%12)+12)%12; if(pm.low.some(q=>((q.midi%12)+12)%12===pc)) low++; }
    let hh=0; for(const m of har) if(pm.byMidi.get(m+sh)) hh++;
    const score=[mel.length?pcHit/mel.length:1, mel.length?hit/mel.length:1, mel.length?top/mel.length:1, roots.length?low/roots.length:1, har.length?hh/har.length:1, -Math.abs(sh)/100];
    if(!best||cmp(score,best.score)>0) best={score,shift:sh,hit,top,low,hh};
  }
  const [pitchClasses,melody,onTop,bassLow,harmony]=best.score;
  return {pan,shift:best.shift,pitchClasses,melody,onTop,bassLow,harmony,counts:{melody:mel.length,harmony:har.length,roots:roots.length},
          key:keyName(v,best.shift)};
}
function cmp(a,b){ for(let i=0;i<a.length;i++){ if(a[i]>b[i]+1e-9) return 1; if(a[i]<b[i]-1e-9) return -1; } return 0; }
function keyName(v,shift){ // the score's key signature, transposed: the major key with that many fifths
  const f=v.fifths||0; const majorPc=(((f*7)%12)+12)%12; return NAMES[(((majorPc+shift)%12)+12)%12]; }

/* the popup's content: tiers and warnings */
function rateAll(pans,score){
  const v=voices(score);
  const rated=pans.map(p=>ratePan(p,v)).sort((a,b)=>cmp([b.pitchClasses,b.melody,b.onTop,b.bassLow,b.harmony,-Math.abs(b.shift)/100],[a.pitchClasses,a.melody,a.onTop,a.bassLow,a.harmony,-Math.abs(a.shift)/100]));
  const warnings=[];
  const nPcs=v.pcs.size;
  if(nPcs>8) warnings.push({kind:"chromatic",text:`This piece uses ${nPcs} different pitch classes. A handpan holds a scale of seven or eight, so it cannot be played as written on one pan — expect substituted notes.`});
  const melMidis=v.melody.map(n=>n.midi); if(melMidis.length){ const span=Math.max(...melMidis)-Math.min(...melMidis);
    if(span>19) warnings.push({kind:"range",text:`The melody spans ${span} semitones — wider than most top shells. Parts of it will move to the underside or an octave.`}); }
  const bestMel=rated.length?rated[0].melody:0;
  if(bestMel<0.9) warnings.push({kind:"hard",text:`No pan in the list holds more than ${Math.round(bestMel*100)} % of the melody. This piece is hard to bring to a single handpan.`});
  const maxStack=Math.max(0,...score.bars.flatMap(b=>b.staffs.flatMap(s=>s.cols.map(c=>c.notes?c.notes.length:0))));
  if(maxStack>3) warnings.push({kind:"polyphony",text:`Chords of ${maxStack} notes occur. Two hands strike at most two or three fields at once; the arrangement keeps the chords for you to thin.`});
  for(const r of rated){ r.tier=r.melody<0.999?"missing":r.onTop>=0.999&&r.bassLow>=0.999?"top":r.onTop>=0.75?"mostly":"split"; }
  return {rated,warnings,voices:v};
}

/* ───────── the arrangement ───────── */
/* pan: the app's pan record; shift: semitones; opts {sub, barsPerRow, keepChords, title, author, id, tempo}
   → an hpd-2 piece plus a log of every substitution */
function arrange(score,pan,shift,opts){
  opts=opts||{}; const pm=panMap(pan); const v=voices(score); const log=[];
  const beats=v.beats; const sub=opts.sub||gridOf(score); const slotsPerBar=beats*sub;
  const F=(t,f,h,extra)=>Object.assign({t,v:"field",f,hand:h},extra||{});
  const tOf=onset=>Math.round(onset*sub);
  // a pitch on the pan, or the nearest chord tone in the same direction, or an octave away
  const dingMidi=midiOf(pan.ding);
  /* a note outside the pan's scale: PLACED — the nearest that keeps the line, marked sub with the written interval — or
     KEPT FOREIGN (David, 9 Sep): the same stand-in field as a fallback for older builds, plus fo:true, so the app draws
     the note's name in the stand-in colour and sounds it as written */
  const keepFo=opts.foreign==="keep";
  const mark=(pl,target)=>Object.assign(pl,{sub:true,oi:target-dingMidi},keepFo?{fo:true}:{});
  const place=(midi,prevMidi,context)=>{
    const q=pm.byMidi.get(midi+shift); if(q) return {p:q.p,sub:false};
    const target=midi+shift; const dir=prevMidi==null?0:Math.sign(midi-prevMidi);
    const cands=pm.pos.filter(x=>context==="bass"?!x.top||true:true).map(x=>({x,d:x.midi-target})).filter(c=>c.d!==0);
    // REGISTER IS NOT FOREIGNNESS (David, 9 Sep: "stand-ins should really be used for notes that are foreign to
    // the scale of the selected handpan; register-wise, put those notes into the register we have"): a pitch
    // class the pan has goes to the nearest octave the pan holds, unmarked, in every voice
    const oct=cands.filter(c=>Math.abs(c.d)%12===0).sort((a,b)=>Math.abs(a.d)-Math.abs(b.d))[0];
    if(oct){ log.push(`${nameOf(target)} → ${nameOf(oct.x.midi)} (register, ${context})`); return {p:oct.x.p,sub:false}; }
    // a neighbour keeping the contour: above if the line was rising, below if falling
    // the line was rising → a note above the missing one keeps it rising; falling → one below; a still line → the nearest
    const same=cands.filter(c=>dir===0||Math.sign(c.d)===dir).sort((a,b)=>Math.abs(a.d)-Math.abs(b.d));
    const pick=(same[0]&&Math.abs(same[0].d)<=4)?same[0]:cands.sort((a,b)=>Math.abs(a.d)-Math.abs(b.d))[0];
    if(!pick) return null;
    log.push(`${nameOf(target)} → ${nameOf(pick.x.midi)} (${context}, the pan has no ${nameOf(target)})`);
    return mark({p:pick.x.p},target);
  };
  const bars=score.bars.map(()=>[]);
  // bass: figure or roots (rule 4)
  const bassByBar={}; for(const n of v.bass) (bassByBar[n.bar]=bassByBar[n.bar]||[]).push(n);
  let prevBass=null;
  for(const bi in bassByBar){
    const notes=bassByBar[bi].sort((a,b)=>a.onset-b.onset||a.midi-b.midi);
    const moving=notes.filter(n=>n.dur<=0.5).length>=notes.length/2;
    if(moving){
      // groups of a half bar keep their shape: the whole group moves by the octave that the pan holds best (lowest wins a tie)
      const groups={}; for(const n of notes) (groups[Math.floor(n.onset/(beats/2))]=groups[Math.floor(n.onset/(beats/2))]||[]).push(n);
      for(const g of Object.values(groups)){
        let bestK=0,bestHit=-1;
        for(const k of [0,12,24,-12]){ const hit=g.filter(n=>pm.byMidi.get(n.midi+shift+k)).length; if(hit>bestHit||(hit===bestHit&&k<bestK)){ bestHit=hit; bestK=k; } }
        if(bestK) log.push(`bass group ${g.map(n=>nameOf(n.midi+shift)).join(" ")} moved ${bestK>0?"up":"down"} ${Math.abs(bestK)/12} octave${Math.abs(bestK)>12?"s":""}`);
        // in a moved group only the notes whose WRITTEN pitch the pan lacks are stand-ins; the rest are the pan's own notes, an octave along
        for(const n of g){ const pl=place(n.midi+bestK,prevBass,"bass"); if(pl){ bars[bi].push(F(tOf(n.onset),pl.p,"L",pl.sub?Object.assign({sub:true,oi:pl.oi},pl.fo?{fo:true}:{}):null)); prevBass=n.midi+bestK; } }   // an octave is register, not a stand-in
      }
    }
    else { // one stroke per chord change: the lowest note at each new onset group
      const groups={}; for(const n of notes) (groups[n.onset]=groups[n.onset]||[]).push(n);
      for(const on in groups){ const low=groups[on].sort((a,b)=>a.midi-b.midi)[0]; const pl=place(low.midi,prevBass,"bass"); if(pl){ bars[bi].push(F(tOf(+on),pl.p,"L",pl.sub?Object.assign({sub:true,oi:pl.oi},pl.fo?{fo:true}:{}):null)); prevBass=low.midi; } }
    }
  }
  // melody and harmony (rules 1, 5, 6)
  let prevMel=null;
  for(const n of v.melody){ const pl=place(n.midi,prevMel,"melody"); if(!pl) continue;
    const t=tOf(n.onset); const bassHere=bars[n.bar].some(e=>e.t===t&&e.hand==="L"); const hand=bassHere?"R":(t%2?"L":"R");
    bars[n.bar].push(F(t,pl.p,hand,Object.assign({_mel:true},pl.sub?Object.assign({sub:true,oi:pl.oi},pl.fo?{fo:true}:{}):{},n.q?{q:true}:{}))); prevMel=n.midi; }
  const chordMode=opts.chords||(opts.keepChords===false?"adapt":"keep");
  for(const n of v.harmony){ const pl=place(n.midi,null,"harmony"); if(!pl) continue;
    bars[n.bar].push(F(tOf(n.onset),pl.p,"R",Object.assign({_har:true},pl.sub?Object.assign({sub:true,oi:pl.oi},pl.fo?{fo:true}:{}):{}))); }
  if(chordMode==="adapt") adaptVoicings(bars,pm,log);
  for(const b of bars){ b.sort((a,b)=>a.t-b.t); for(const e of b){ delete e._mel; delete e._har; } }
  // sections (rule 7): cut at the reader's double bars if known, else 8-bar tables; a short intro stays its own table
  const barsPerRow=opts.barsPerRow||2, rowsPerTable=4, perTable=barsPerRow*rowsPerTable;
  const cuts=(score.sectionCuts&&score.sectionCuts.length)?score.sectionCuts.slice():[];
  const sections={}, arrangement=[]; let start=0, letter=opts.letterOffset||0;
  const names=["Intro","A","B","C","D","E","F","G","H"];
  const pushSection=(from,to)=>{ if(to<=from) return; let i=from;
    while(i<to){ const n=Math.min(perTable,to-i); const name=(from===0&&to-from<perTable&&score.bars.length>to&&!opts.letterOffset)?"Intro":names[Math.min(names.length-1,1+letter++)];
      const key=sections[name]?name+"'":name; sections[key]={bars:bars.slice(i,i+n)}; arrangement.push(key); i+=n; } };
  for(const c of cuts){ pushSection(start,c); start=c; } pushSection(start,bars.length);
  return { format:"hpd-2", id:opts.id||"imported-score", title:opts.title||"Imported score", author:opts.author||"",
    writtenFor:pan.id, tempo:opts.tempo||72, meter:[beats,4], sub, barsPerRow, sections, arrangement, importLog:log };
}
/* ADAPT CHORD VOICINGS TO THE HANDPAN (David, 8–9 Sep 2026): "Three notes in one hand is often one hand
   playing a chord and the other hand playing a melody. When one hand plays a chord, it should be: 1. root
   (highest priority) 2. third 3. fifth. Play two that can be reached together if possible, or otherwise
   only the root note of the chord." So, per moment: the melody hand plays the melody alone; everything
   else — the bass and the chord's other notes — is the chord hand's, and it keeps the root (the lowest
   note), adds the third when root and third lie under one hand, else the fifth when those two do, else
   plays the root alone. Under a running bass on the underside nothing is reachable, and the chord falls
   to its bass note, which is what David asked for. */
function adaptVoicings(bars,pm,log){
  const near=reach(pm.pan); const midiOfPos=p=>{ const q=pm.pos.find(x=>x.p===p); return q?q.midi:null; };
  const iv=(m,root)=>(((m-root)%12)+12)%12;
  bars.forEach((bar,bi)=>{
    const ts=[...new Set(bar.map(e=>e.t))];
    for(const t of ts){
      const here=bar.filter(e=>e.t===t);
      const mel=here.filter(e=>e._mel);
      const chord=here.filter(e=>!e._mel).map(e=>({e,m:midiOfPos(e.f)})).filter(x=>x.m!=null);
      if(chord.length<=1) continue;                                    // one note is not a chord
      if(chord.length===2&&near(chord[0].e.f,chord[1].e.f)) continue;  // two under one hand already
      chord.sort((a,b)=>a.m-b.m);
      const root=chord[0];
      const third=chord.find(x=>x!==root&&[3,4].includes(iv(x.m,root.m))&&near(root.e.f,x.e.f));
      const fifth=chord.find(x=>x!==root&&iv(x.m,root.m)===7&&near(root.e.f,x.e.f));
      const keep=new Set([root.e,(third||fifth||{}).e].filter(Boolean));
      for(const x of chord) if(!keep.has(x.e)){ const i=bar.indexOf(x.e); if(i>=0) bar.splice(i,1); }
      for(const e of keep) e.hand=mel.length?"L":e.hand;                  // the chord hand, when the other is on the melody
      const names=[...keep].map(e=>nameOf(midiOfPos(e.f))).join(" + ");
      log.push(`bar ${bi+1}: chord ${third?"root + third":fifth?"root + fifth":"root alone"} — ${names}`);
    }
  });
}
function hasSixteenths(score){ return score.bars.some(b=>b.staffs.some(s=>s.cols.some(c=>c.dur<0.5-1e-9))); }
/* THE GRID A SCORE NEEDS (8 Sep 2026, triplets): the smallest count of positions per beat on which every onset
   lands — 2 for eighths, 4 for sixteenths, 3 for triplets, 6 when both share the page. The table draws up to 8
   positions a beat; when no grid up to 8 lands everything, the one that lands the most onsets is taken (the
   smallest among equals) and the rest move to their nearest position — a page of triplet arpeggios with one
   dotted eighth and sixteenth in two bars is a triplet page, not a 12-a-beat one. */
function gridOf(score){
  const vals=[]; for(const b of score.bars) for(const s of b.staffs) for(const c of s.cols) if(c.onset!=null&&!c.rest) vals.push(c.onset);
  const lands=k=>vals.filter(v=>Math.abs(v*k-Math.round(v*k))<0.02).length;
  let best=4,bestN=-1; for(const k of [2,3,4,6,8]){ const n=lands(k); if(n===vals.length) return k; if(n>bestN){ best=k; bestN=n; } }
  return best;
}

const api={rateAll,ratePan,arrange,voices,panMap,midiOf,nameOf};
if(typeof module!=="undefined"&&module.exports) module.exports=api; else root.ScoreArrange=api;
})(typeof window!=="undefined"?window:globalThis);
