/* staff.js — the Staff view: classical notation drawn from the app's own score.
   Handpan Studio, 22 Sep 2026. Prepared outside app.html so the wiring is a small patch.

   One renderer over the same data the table draws: bars of events {t, v, f, hand, flam?, roll?, chord?},
   the section's metrics (beats, den, sub, groups) and its tuplet ranges (sec.tup: {bar, from, len, per, n}),
   and the pan that names each field. Nothing is stored; the staff is a second picture of the piece.

   Decisions (David, 22 Sep 2026, mockups-staff*.html, STAFF-VIEW.md):
   - Glyphs from Leland (MuseScore's SMuFL font, SIL OFL, fonts/Leland.otf); measures from its metadata.
   - One treble staff per pan, at sounding pitch unless a note would need more than four ledger lines;
     then the octave that needs the fewest (8vb or 15mb). The PIECE decides, over the notes it plays in every
     section (opts.clefFrom; David, 23 Sep 2026 -- the pan decided until then, and a wide pan tied at sounding pitch).
   - The grand staff (treble + bass, split at middle C, sounding pitch) is an option, off by default.
   - The pan's numbers on the notes are an option, off by default; when on, one line above the staff
     ("placement B"). A numbers row under the staff exists for the printed sheet only.
   - A note lasts until the next sounding stroke in its bar (a tuplet range's start counts as a stroke);
     ghosts do not cut it off. Inside a tuplet range every position is one tuplet unit: a note or a rest.
   - Hands stay as colour: right --hand-r, left --hand-l, stand-in --hand-s; a slap is an x-head.
   - The staff sits on the page background, no frame.

   API (window.StaffView):
     render(el, input, opts) -> {svg, W, H, key, clef}      draws into el (replaces its content)
       input: {bars, pan, beats (4), den (4), sub (4), groups ([3,2,2] or null), tup ([] ranges)}
              (meter:[b,d] is accepted in place of beats/den)
     paint(el, bar, beat)                                    lights the band for that count; paint(el,-1) clears
     keyFor(pan) -> {flats, sharps, k}                       the key signature with the fewest accidentals
     clefFor(pan, fields) -> {clef:"g"|"g8vb"|"g15mb", shift}  the octave rule, over the piece's fields (the pan's without them)
     opts: sp (staff space px, 8), pw (px per pulse; default fits the container), mode "grid"|"flow", width (flow),
           colour (true; the numbers' hand colours), heads (true; false = every notehead in ink, David 22 Sep), numbers (false), numbersRow (false), grand (false), barNumbers (true), chords (false),
           timeSig (true), band {bar,beat}|null, fontUrl, label, finalBar, left, right,
           perSystem (0: one line; n: the table breaks into systems of n bars, stacked — the phone's way; the time
           signature shows on the first system only, clef and key on every one)
   The pan may be the app's derived pan (posLabel(p), fields[], bottom[]) or a plain {ding:"D3", fields:[…], bottom:[…]}.
*/
(function(){
"use strict";

/* ---------- SMuFL glyphs (Leland) and engraving defaults from leland_metadata.json ---------- */
const G={gClef:"",gClef8vb:"",gClef15mb:"",fClef:"",black:"",half:"",whole:"",x:"",
  flag8U:"",flag8D:"",flag16U:"",flag16D:"",flag32U:"",flag32D:"",
  restW:"",restH:"",restQ:"",rest8:"",rest16:"",rest32:"",
  flat:"",natural:"",sharp:"",dot:"",trem2:"",accA:"\uE4A0",accB:"\uE4A1",ts:d=>String(d).split("").map(c=>String.fromCharCode(0xE080+ +c)).join("")};
const E={staffLine:.11,stem:.10,beam:.5,beamGap:.25,ledger:.16,ledgerExt:.33,thin:.18,thick:.55,headW:1.3,
  stemUpSE:[1.3,.16],stemDownNW:[0,-.168],xUpSE:[1.3,.424],xDownNW:[0,-.424],accW:.81,clefW:2.56,tsW:1.77,
  /* the widest flag's ink, from its stem (Leland: 8th up 1.16, 16th up 1.12,
     down 1.24 staff spaces) -- what spacing() reserves after an unbeamed note */
  flagW:1.24};
const CLEFS={g:{bottom:30,glyph:G.gClef,glyphStep:32,shift:0,keyOff:0},g8vb:{bottom:30,glyph:G.gClef8vb,glyphStep:32,shift:7,keyOff:0},
  g15mb:{bottom:30,glyph:G.gClef15mb,glyphStep:32,shift:14,keyOff:0},f:{bottom:18,glyph:G.fClef,glyphStep:24,shift:0,keyOff:-14}};
const KEYPOS={flats:{B:34,E:37,A:33,D:36,G:32,C:35,F:31},sharps:{F:37,C:34,G:38,D:35,A:32,E:36,B:33}};
const ORDER={sharps:["F","C","G","D","A","E","B"],flats:["B","E","A","D","G","C","F"]};
const COL={ink:"var(--sc-ink,#17150F)",line:"var(--st-line,#2A2620)",band:"var(--sc-band,#FBE7C6)",count:"var(--sc-count,#C6BEB1)",ink3:"var(--ink3,#8D8578)",
  R:"var(--hand-r,#17150F)",L:"var(--hand-l,#469957)",S:"var(--hand-s,#A21AF1)"};
const LEDGER_GUARD=4;      // more than this many ledger lines at sounding pitch → written in another octave
const MIDDLE_C=28;         // the grand staff's split (step of C4)
const FONT="Inter,Figtree,sans-serif";

/* ---------- pitch ---------- */
const isBot=p=>typeof p==="string"&&p.charCodeAt(0)===98;
function parse(n){const m=/^([A-G])([#♯b♭]?)(-?\d)$/.exec(String(n));if(!m)return null;const acc=m[2]==="#"?"♯":m[2]==="b"?"♭":m[2];return{letter:m[1],acc,oct:+m[3]}}
function stepOf(n){const p=parse(n);return p?"CDEFGAB".indexOf(p.letter)+7*p.oct:null}   // C4 = 28; treble lines E4 30 … F5 38
function panNames(pan){
  if(!pan)return{ding:null,fields:[],bottom:[]};
  if(typeof pan.posLabel==="function"){
    const fields=(pan.fields||[]).map((f,i)=>pan.posLabel(i+1)),bottom=(pan.bottom||[]).map((b,i)=>pan.posLabel("b"+(i+1)));
    return{ding:pan.posLabel(0),fields,bottom};
  }
  const nm=x=>typeof x==="string"?x:(x&&x.label)||null;
  return{ding:nm(pan.ding),fields:(pan.fields||[]).map(nm),bottom:(pan.bottom||[]).map(nm)};
}
function nameOf(names,f){return f===0?names.ding:isBot(f)?names.bottom[+String(f).slice(1)-1]:names.fields[f-1]}
function labelOf(f){return f===0?"D":isBot(f)?String(+String(f).slice(1)):String(f)}
function keyFor(pan){
  const names=panNames(pan);const notes=[names.ding,...names.fields,...names.bottom].map(parse).filter(Boolean);
  let best=null;
  for(let k=-7;k<=7;k++){
    const flats=k<0?ORDER.flats.slice(0,-k):[],sharps=k>0?ORDER.sharps.slice(0,k):[];
    let cost=0;for(const p of notes){const inF=flats.includes(p.letter),inS=sharps.includes(p.letter);if(p.acc==="♭"?!inF:p.acc==="♯"?!inS:(inF||inS))cost++}
    const flatty=notes.filter(p=>p.acc==="♭").length,sharpy=notes.filter(p=>p.acc==="♯").length;
    const pref=(k<0&&flatty>=sharpy)||(k>0&&sharpy>flatty)||k===0?0:1;
    const score=[cost,Math.abs(k),pref];
    if(!best||score[0]<best.score[0]||(score[0]===best.score[0]&&(score[1]<best.score[1]||(score[1]===best.score[1]&&score[2]<best.score[2]))))best={k,flats,sharps,score};
  }
  return{flats:best.flats,sharps:best.sharps,k:best.k};
}
function accidentalFor(name,key){const p=parse(name);if(!p)return "";const inF=key.flats.includes(p.letter),inS=key.sharps.includes(p.letter);
  if(p.acc==="♭")return inF?"":G.flat;if(p.acc==="♯")return inS?"":G.sharp;return(inF||inS)?G.natural:""}
/* within a bar a sign holds for its letter and octave until another sign changes it (the convention); state starts at the key */
function accidentalInBar(name,key,state){const p=parse(name);if(!p)return "";const k=p.letter+p.oct;const keyAcc=key.flats.includes(p.letter)?"♭":key.sharps.includes(p.letter)?"♯":"";
  const cur=state.has(k)?state.get(k):keyAcc;if(cur===p.acc)return "";state.set(k,p.acc);return p.acc==="♭"?G.flat:p.acc==="♯"?G.sharp:G.natural}
const ledgerBelow=s=>s>=30?0:Math.ceil((30-s)/2), ledgerAbove=s=>s<=38?0:Math.ceil((s-38)/2);
/* THE PIECE DECIDES (David, 23 Sep 2026: "let the piece decide"). The octave rule runs over the notes the piece plays,
   every section of it, so one piece keeps one clef. Over the pan's whole range the E Kurd 21 (B2-A5) tied 5 ledger
   lines to 5 and stayed at sounding pitch, so Canon in D -- B2-E5, 3 at most an octave up -- hung 5 under the staff.
   Without the piece's fields, or with no pitched note among them, the pan's range decides as it did. */
function clefFor(pan,fields){
  const names=panNames(pan);const whole=[names.ding,...names.fields,...names.bottom].map(stepOf).filter(s=>s!=null);
  const played=Array.isArray(fields)?fields.map(f=>stepOf(nameOf(names,f))).filter(s=>s!=null):[];
  const steps=played.length?played:whole;
  if(!steps.length)return{clef:"g",shift:0};
  const lo=Math.min(...steps),hi=Math.max(...steps);
  const worst=sh=>Math.max(ledgerBelow(lo+sh),ledgerAbove(hi+sh));
  if(worst(0)<=LEDGER_GUARD)return{clef:"g",shift:0};
  let best={clef:"g",shift:0,w:worst(0)};
  for(const [clef,sh] of [["g8vb",7],["g15mb",14]]){const w=worst(sh);if(w<best.w)best={clef,shift:sh,w}}
  return{clef:best.clef,shift:best.shift};
}

/* ---------- rhythm: everything in 32nds ---------- */
/* a note value by its length in 32nds; dotted where a plain value does not exist */
const VALUES={1:{den:32,dot:0},2:{den:16,dot:0},3:{den:16,dot:1},4:{den:8,dot:0},6:{den:8,dot:1},8:{den:4,dot:0},12:{den:4,dot:1},16:{den:2,dot:0},24:{den:2,dot:1},32:{den:1,dot:0}};
const near=(x,eps=1e-6)=>Math.abs(x-Math.round(x))<eps?Math.round(x):null;
/* split a length (32nds) starting at t (32nds into the bar) into plain values, breaking at count boundaries */
function spell32(len,t,beat){
  const L=near(len);if(L!=null&&VALUES[L])return[{len:L,...VALUES[L]}];
  const out=[];let tt=t,rest=len,guard=0;
  while(rest>1e-6&&guard++<64){
    const into=((tt%beat)+beat)%beat;const toBeat=near(beat-into)===0?beat:beat-into;let k=Math.min(rest,toBeat);
    let K=near(k);if(K==null)K=Math.floor(k);
    if(K>=1){while(K>0&&!VALUES[K])K--;if(K<1)K=1;out.push({len:K,...VALUES[K]});tt+=K;rest-=K}
    else{out.push({len:rest,den:32,dot:0});rest=0}
  }
  return out;
}
const restGlyph=den=>den>=32?G.rest32:den===16?G.rest16:den===8?G.rest8:den===4?G.restQ:den===2?G.restH:G.restW;
const FLOWW={32:1.6,16:2.0,8:2.6,4:3.6,2:5,1:7};
const flowW=(den,dot)=>(FLOWW[den]||3)*(dot?1.2:1);

/* the items of one bar: notes and rests, each at a position p (pulses, may be fractional) with a value (den, dot);
   tuplet units carry .tup = {id, n, m, den, plain}. Outside a range a note lasts to the next stroke. */
function barItems(bar,bi,ctx,keep){
  const {sub,beats,ppb,pulse32,beat32,tup}=ctx;
  const byT=new Map();
  for(const e of bar||[]){if(!e||e.v==="ghost")continue;if(keep&&!keep(e))continue;if(!byT.has(e.t))byT.set(e.t,[]);byT.get(e.t).push(e)}   // a slap goes where the staff's filter says (build)
  /* THE STROKES DECIDE THE DIVISION (David, 24 Sep 2026: "yes, build the robust staff rule", after his Let It Be drew a
     6-bracket of rests around two plain sixteenths and garbled a triplet whose range was never stored). ONE RULE: a
     stored range is kept only where its strokes need it (off the 32nd grid, and on the range's own equal positions);
     every other count is written at the plainest division that holds its strokes - halves first when they are simpler,
     a tuplet only where three, five, six, seven… are needed, a plain division finer than a 32nd without a figure. A
     whole-table triplet grid needs no rule of its own: its strokes ask for their triplets. */
  const strokeTs=[...byT.keys()].sort((a,b)=>a-b), on32=t=>near(t*pulse32)!=null, pow2=d=>d>0&&(d&(d-1))===0;
  const inSpan=(a,e)=>strokeTs.filter(t=>t>=a-1e-6&&t<e-1e-6);
  let ranges=(tup||[]).filter(r=>r&&r.bar===bi&&r.n>1).map(r=>{const step=sub/(r.per||1);return{a:r.from*step,e:(r.from+r.len)*step,n:r.n}})
    .filter(r=>{const S=inSpan(r.a,r.e);if(!S.length||S.every(on32))return false;const u=(r.e-r.a)/r.n;return S.every(t=>near((t-r.a)/u)!=null)});
  const minDiv=(a,e,S)=>{for(let d=1;d<=96;d++)if(S.every(t=>near((t-a)*d/(e-a))!=null))return d;return 0};
  const need=(a,e)=>{const S=inSpan(a,e);return(!S.length||S.every(on32))?1:minDiv(a,e,S)};
  const plan=(a,e)=>{
    const L=e-a;
    if(ranges.some(r=>r.a<e-1e-6&&r.e>a+1e-6)){if(ranges.some(r=>r.a<=a+1e-6&&r.e>=e-1e-6))return;if(L%2===0&&L>=2){plan(a,a+L/2);plan(a+L/2,e)}return}
    const d=need(a,e);if(d===1)return;
    const ok=d>0&&((pow2(d)&&d<=16)||(!pow2(d)&&d<=12));
    if(L%2===0&&L>=2){const h=L/2,d1=need(a,a+h),d2=need(a+h,e);if(!ok||(d1>0&&d2>0&&Math.max(d1,d2)<d)){plan(a,a+h);plan(a+h,e);return}}
    if(d>1)ranges.push({a,e,n:d});
  };
  for(let c=0;c<beats;c++)plan(c*sub,(c+1)*sub);
  ranges.sort((x,y)=>x.a-y.a);ranges.forEach((r,i)=>r.id=bi*100+i);
  const inRange=t=>ranges.find(r=>t>=r.a-1e-6&&t<r.e-1e-6);
  const items=[];
  const pushNotes=(p,len32,notes,info)=>{if(info){items.push({p,len32,den:info.den,dot:0,notes,tup:info});return}
    let t32=p*pulse32;spell32(len32,t32,beat32).forEach((v,i)=>{items.push({p:t32/pulse32,len32:v.len,den:v.den,dot:v.dot,notes,tie:i>0});t32+=v.len})};
  const pushRest=(p,len32,info)=>{if(len32<=1e-6)return;if(info){items.push({p,len32,den:info.den,dot:0,rest:true,tup:info});return}
    let t32=p*pulse32;for(const v of spell32(len32,t32,beat32)){items.push({p:t32/pulse32,len32:v.len,den:v.den,dot:v.dot,rest:true});t32+=v.len}};
  const outside=[...byT.keys()].filter(t=>!inRange(t)).sort((a,b)=>a-b);
  const starts=[...outside,...ranges.map(r=>r.a)].sort((a,b)=>a-b);
  const first=starts.length?starts[0]:ppb;
  if(first>1e-6)pushRest(0,first*pulse32,null);
  outside.forEach(t=>{const nxt=Math.min(ppb,...outside.filter(u=>u>t),...ranges.map(r=>r.a).filter(a=>a>t));pushNotes(t,(nxt-t)*pulse32,byT.get(t),null)});
  for(const r of ranges){
    const S=(r.e-r.a)*pulse32,unit=S/r.n;let v=1;while(v<unit-1e-6)v*=2;while(v/2>=unit-1e-6)v/=2;   // the written unit: the smallest plain value not shorter than the real one - below a 32nd too (a 64th is plain, 24 Sep)
    const m=S/v,plain=near(m)!=null&&Math.abs(v-unit)<1e-6;
    const info={id:r.id,n:r.n,m:near(m)!=null?near(m):Math.round(m),den:32/v,plain};
    for(let k=0;k<r.n;k++){const p=r.a+k*(r.e-r.a)/r.n;let ev=byT.get(p);if(!ev){const key=[...byT.keys()].find(t=>Math.abs(t-p)<.26);if(key!=null)ev=byT.get(key)}
      if(ev&&ev.length)pushNotes(p,v,ev,info);else pushRest(p,v,info)}
  }
  items.sort((x,y)=>x.p-y.p||(x.rest?1:0)-(y.rest?1:0));
  return{items,ranges,empty:!byT.size};
}

/* ---------- spacing: where each moment of the bar sits ---------- */
/* ROOM BY NEED, NOT BY THE CLOCK (David, 23 Sep 2026: "the sixteenth note flags
   still touch the next symbol or sometimes the bar line", and four bars of
   sixteenths must fit one line). The grid gave every pulse the same width, so a
   quarter took four times a sixteenth's room while the sixteenths were crushed:
   an unbeamed flag reaches about 2.4 staff spaces from its head's left edge, and a
   pulse at the desktop width is about 2. Engraved music spaces by need, and so
   does this -- one rule for the whole line:
     · every moment at which something starts, in EITHER staff, is a column, so
       the two staves of the grand staff stand on one x for one moment;
     · a column is never narrower than its ink -- the head, a second's shifted
       head, a dot, an unbeamed flag, a rest -- with the next column's accidental
       or grace note in front of it and a clear gap between;
     · what is left over is shared by LENGTH, by its square root, so a quarter
       gets about twice a sixteenth's room rather than four times;
     · the line keeps its total width; only the room inside it moves. Bars and
       beats become as wide as their music, and the beat bands follow them.
   When even the ink will not fit, every column shrinks alike and `fits` is
   false; what to do about that (pages) is the caller's decision. */
const SPACE={gap:.35,padL:1.0,restW:{32:1.6,16:1.45,8:1.15,4:1.0,2:1.25,1:1.25},durW:d32=>1.9*Math.sqrt(Math.max(d32,.25)/2)};
/* A BEAM JOINS NOTES THAT ARE NEXT TO EACH OTHER (23 Sep 2026). The run was
   keyed by the count alone and rests were merely skipped, so two notes in one
   count with a rest between them shared a group and the beam was drawn straight
   over the rest. A rest now ends the run: the key carries a serial that steps
   whenever the stream is interrupted, by a rest or by a note too long to beam.
   One function, used by the staff to draw beams and by spacing() to know which
   notes will wear a flag. */
function beamRuns(items,sub,groupOf){
  const runs=new Map();let runK=null,runN=0;
  items.forEach(it=>{
    if(it.rest||it.den<8){runK=null;return}                       // the stream is broken here
    const base=it.tup?"T"+it.tup.id:"C"+groupOf(Math.floor(it.p/sub));
    if(base!==runK){runK=base;runN++}                             // a new count, or a fresh run after a break
    const k=base+"#"+runN;
    if(!runs.has(k))runs.set(k,[]);runs.get(k).push(it)});
  return runs;
}
function spacing(bars,ctx,keeps,avail,sp){
  const {names,key,sub,beats,ppb,pulse32,groupOf}=ctx;
  const per=bars.map((bar,bi)=>{
    const cols=new Map();const col=p=>{const k=p.toFixed(4);if(!cols.has(k))cols.set(k,{p,L:0,R:0});return cols.get(k)};
    for(const keep of keeps){
      const B=barItems(bar,bi,ctx,keep);if(B.empty)continue;
      /* a note the pan cannot name is drawn as a rest by the staff (no head, no
         step); it is one here too, or a beam would be counted that the staff breaks */
      const items=B.items.map(it=>it.rest||it.notes.some(n=>n.v==="perc"||stepOf(nameOf(names,n.f))!=null)?it:{...it,rest:true});
      const beamed=new Set();for(const run of beamRuns(items,sub,groupOf).values())if(run.length>1)run.forEach(it=>beamed.add(it));
      for(const it of items){const c=col(it.p);let L=0,R;
        if(it.rest){R=SPACE.restW[it.den]||1.25;if(it.dot)R=Math.max(R,1.65)}
        else{
          const steps=it.notes.filter(n=>n.v!=="perc").map(n=>stepOf(nameOf(names,n.f))).filter(s=>s!=null).sort((a,b)=>a-b);
          const shift=steps.some((s,i)=>i>0&&s-steps[i-1]===1)?E.headW-E.stem:0;    // a second: one head stands beside the stem
          R=E.headW+shift;
          if(it.dot)R=Math.max(R,E.headW+shift+.35+.4);
          if(it.den>=8&&!beamed.has(it))R=Math.max(R,E.stemUpSE[0]-E.stem+E.flagW);   // an unbeamed flag, reckoned stem-up (the wider reach)
          if(!it.tie&&it.notes.some(n=>n.v!=="perc"&&n.f!=null&&accidentalFor(nameOf(names,n.f),key)))L=E.accW+.25;
          if(!it.tie&&it.notes.some(n=>n.flam))L=Math.max(L,1.9)}
        c.L=Math.max(c.L,L);c.R=Math.max(c.R,R)}
    }
    const list=[...cols.values()].sort((a,b)=>a.p-b.p);
    list.forEach((c,i)=>{const nx=list[i+1];c.d32=((nx?nx.p:ppb)-c.p)*pulse32;c.need=c.L+c.R+SPACE.gap});
    return{list};
  });
  const wholeW=k=>Math.max(3*sp,k*SPACE.durW(ppb*pulse32)*sp);
  const colW=(c,k)=>Math.max(c.need*sp,k*SPACE.durW(c.d32)*sp);
  const widthAt=k=>{let t=0;for(const B of per){t+=SPACE.padL*sp;if(!B.list.length)t+=wholeW(k);else for(const c of B.list)t+=colW(c,k)}return t};
  const floor=widthAt(0),fits=floor<=avail+1e-6;let k=0,s=1;
  if(fits){let lo=0,hi=1;while(widthAt(hi)<avail&&hi<1e6)hi*=2;for(let i=0;i<48;i++){const m=(lo+hi)/2;if(widthAt(m)<avail)lo=m;else hi=m}k=lo}
  else s=avail/floor;
  let start=0;
  const out=per.map(B=>{
    let x=SPACE.padL*sp*s;const at=new Map();
    if(!B.list.length)x+=wholeW(k)*s;
    else for(const c of B.list){c.x=x;at.set(c.p.toFixed(4),{x,L:c.L*sp*s});x+=colW(c,k)*s}
    const w=x;
    /* a beat's band starts just before the first thing in it; a beat with nothing
       starting in it (inside a long note) is placed by its time between its neighbours */
    const xAt=p=>{const hit=B.list.find(c=>Math.abs(c.p-p)<1e-6);if(hit)return Math.max(0,hit.x-SPACE.gap*sp*s/2);
      let a={p:0,x:0},b={p:ppb,x:w};for(const c of B.list){if(c.p<p)a=c;else{b=c;break}}return a.x+(p-a.p)/((b.p-a.p)||1)*(b.x-a.x)};
    const edges=[0];for(let b=1;b<beats;b++)edges.push(xAt(b*sub));edges.push(w);
    const r={start,w,edges,at:p=>at.get(p.toFixed(4))||null};start+=w;return r});
  return{fits,floor,bars:out};   // floor: the width the ink alone needs, in px -- what a caller shrinks the staff against
}

/* ---------- one staff ---------- */
function staff(bars,ctx,o){
  const {sp,pw,left,top,clef,keep,numbers,numbersRow,collect,band,barNumbers,timeSig,firstBar,prelude,colour,heads,chords,mode,width}=o;
  const {names,key,sub,beats,den,ppb,pulse32,groupOf}=ctx;
  const C=CLEFS[clef];const bottom=C.bottom,topS=bottom+8,mid=bottom+4;
  const yW=s=>top+(topS-s)*sp/2, y=s=>yW(s+C.shift);
  const topY=yW(topS),botY=yW(bottom),midY=yW(mid);
  const fs=4*sp;let g="";
  const glyph=(ch,x,yy,fill,size)=>`<text x="${x.toFixed(2)}" y="${yy.toFixed(2)}" font-family="Leland" font-size="${size||fs}" fill="${fill||COL.ink}">${ch}</text>`;
  const rect=(x,yy,w,h,fill)=>`<rect x="${x.toFixed(2)}" y="${yy.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" fill="${fill||COL.ink}"/>`;
  const text=(s,x,yy,size,fill,extra)=>`<text x="${x.toFixed(2)}" y="${yy.toFixed(2)}" font-family="${FONT}" font-weight="700" font-size="${size}" fill="${fill||COL.ink}" ${extra||""}>${s}</text>`;
  const nKey=key.flats.length+key.sharps.length;
  const preludeW=(prelude?(.4+E.clefW+.6+nKey*.9+(timeSig?.4+E.tsW*(beats>9?1.6:1):0)+.9):.6)*sp;
  const laid=[];let totalFlow=0;
  bars.forEach((bar,bi)=>{const B=barItems(bar,bi,ctx,keep);const L={bar,items:B.items,ranges:B.ranges,empty:B.empty};laid.push(L);
    if(mode==="flow"){let w=1.2;B.items.forEach(it=>{w+=flowW(it.den,it.dot)*(it.tup?.85:1);if(!it.rest&&it.notes.some(n=>n.f!=null&&accidentalFor(nameOf(names,n.f),key)))w+=.8});w+=.5;L.w=w;totalFlow+=w}});
  let W;
  /* THE GRID IS LAID BY NEED (23 Sep 2026; spacing() above). build() works the
     columns out once for every staff of the system and hands them in, so the
     treble and the bass stand on the same x for the same moment. The bar line's
     room -- the old gutter -- is simply the last column's own gap. */
  if(mode==="grid"){let bx=left+preludeW;const S=o.cols;
    laid.forEach((L,bi)=>{const B=S.bars[bi];L.x0=bx;L.x1=bx+B.w;L.edges=B.edges.map(e=>bx+e);
      L.items.forEach(it=>{const c=B.at(it.p);it.x=bx+(c?c.x+c.L:0)});bx=L.x1});
    W=bx+(o.right||0)}
  else{W=width;const k=(width-left-(o.right||0)-preludeW)/(totalFlow*sp);let bx=left+preludeW;laid.forEach(L=>{L.x0=bx;let cx=bx+1.2*sp*k;L.items.forEach(it=>{if(!it.rest&&it.notes.some(n=>n.f!=null&&accidentalFor(nameOf(names,n.f),key)))cx+=.8*sp*k;it.x=cx;cx+=flowW(it.den,it.dot)*(it.tup?.85:1)*sp*k});L.x1=bx+L.w*sp*k;bx=L.x1})}
  let bands="";
  /* the band is built at the end of this function, once the ink has been
     measured -- see THE BAND COVERS THE NOTES below (David, 24 Sep 2026) */
  for(let i=0;i<5;i++){const yy=yW(bottom+2*i);g+=rect(left,yy-E.staffLine*sp/2,W-left-(o.right||0),E.staffLine*sp,COL.line)}
  if(prelude){let cx=left+.4*sp;g+=glyph(C.glyph,cx,yW(C.glyphStep));cx+=(E.clefW+.6)*sp;
    for(const l of key.flats){g+=glyph(G.flat,cx,yW(KEYPOS.flats[l]+C.keyOff));cx+=.9*sp}
    for(const l of key.sharps){g+=glyph(G.sharp,cx,yW(KEYPOS.sharps[l]+C.keyOff));cx+=.9*sp}
    if(timeSig){cx+=.4*sp;const wide=beats>9;g+=glyph(G.ts(beats),cx,yW(topS-2));g+=glyph(G.ts(den),cx+(wide?E.tsW*sp*.45:0),yW(bottom+2))}}
  laid.forEach((L,i)=>{if(i>0)g+=rect(L.x0-E.thin*sp/2,topY,E.thin*sp,4*sp);
    if(barNumbers)g+=`<text x="${(L.x0+2).toFixed(1)}" y="${(topY-1.7*sp).toFixed(1)}" font-family="${FONT}" font-weight="600" font-size="${sp*1.1}" fill="${COL.count}">${firstBar+i+1}</text>`;
    });
  const xL=laid[laid.length-1].x1;
  if(o.finalBar)g+=rect(xL-E.thick*sp-E.thin*sp-.37*sp,topY,E.thin*sp,4*sp)+rect(xL-E.thick*sp,topY,E.thick*sp,4*sp);
  else g+=rect(xL-E.thin*sp,topY,E.thin*sp,4*sp);
  if(o.label){const bw=sp*3.4,bh=sp*2.3,bx=left,by=topY-5.4*sp;g+=`<rect x="${bx}" y="${by.toFixed(1)}" width="${bw}" height="${bh}" rx="1.5" fill="none" stroke="${COL.ink}" stroke-width="${(sp*.14).toFixed(2)}"/>`+text(o.label,bx+bw/2,by+bh*.73,sp*1.55,COL.ink,'text-anchor="middle" font-weight="800"')}
  let lowest=bottom,highest=topS,over=[],attMin=Infinity,attMax=-Infinity;
  laid.forEach(L=>{
    if(L.empty){g+=glyph(G.restW,L.x0+(L.x1-L.x0)/2-.7*sp,yW(topS-2));return}
    const accState=new Map();
    L.items.forEach(it=>{
      if(it.rest)return;
      it.heads=it.notes.map(n=>n.v==="perc"?{step:mid-C.shift,perc:true,hand:n.hand,acc:"",ev:n}:{step:stepOf(nameOf(names,n.f)),acc:accidentalInBar(nameOf(names,n.f),key,accState),hand:n.hand,f:n.f,ev:n}).filter(h=>h.step!=null).sort((a,b)=>a.step-b.step);
      if(!it.heads.length){it.rest=true;return}
      const w0=it.heads[0].step+C.shift,w1=it.heads[it.heads.length-1].step+C.shift;it.up=(mid-w0)>=(w1-mid);lowest=Math.min(lowest,w0);highest=Math.max(highest,w1)});
    const groups=beamRuns(L.items,sub,groupOf);   // one rule for beams and for spacing()
    for(const grp of groups.values()){if(grp.length<2)continue;let glo=99,ghi=-99;grp.forEach(d=>{glo=Math.min(glo,d.heads[0].step+C.shift);ghi=Math.max(ghi,d.heads[d.heads.length-1].step+C.shift)});const up=(mid-glo)>=(ghi-mid);grp.forEach(d=>{d.up=up;d.beamed=true});
      const sx=d=>up?d.x+E.stemUpSE[0]*sp-E.stem*sp/2:d.x+E.stem*sp/2;const hy=d=>up?y(d.heads[d.heads.length-1].step):y(d.heads[0].step);
      const f=grp[0],l=grp[grp.length-1];const dx=sx(l)-sx(f)||1;let slope=(hy(l)-hy(f))/dx;const maxRise=(grp.length===2?.5:1)*sp;slope=Math.max(-maxRise/dx,Math.min(maxRise/dx,slope));
      let y0;grp.forEach(d=>{const need=up?Math.min(hy(d)-3.25*sp,midY):Math.max(hy(d)+3.25*sp,midY);const at=need-slope*(sx(d)-sx(f));y0=y0==null?at:(up?Math.min(y0,at):Math.max(y0,at))});grp.forEach(d=>{d.tipY=y0+slope*(sx(d)-sx(f))});
      const th=E.beam*sp,dir=up?1:-1;const beam=(xa,xb,off)=>{const ya=y0+slope*(xa-sx(f))+off*dir,yb=y0+slope*(xb-sx(f))+off*dir;g+=`<path d="M${xa.toFixed(2)} ${ya.toFixed(2)}L${xb.toFixed(2)} ${yb.toFixed(2)}L${xb.toFixed(2)} ${(yb+th*dir).toFixed(2)}L${xa.toFixed(2)} ${(ya+th*dir).toFixed(2)}Z" fill="${COL.ink}"/>`};
      beam(sx(f)-E.stem*sp/2,sx(l)+E.stem*sp/2,0);
      for(const level of [16,32]){let i=0;const off=(E.beam+E.beamGap)*sp*(level===16?1:2),stub=1.1*sp;while(i<grp.length){if(grp[i].den<level){i++;continue}let j=i;while(j+1<grp.length&&grp[j+1].den>=level)j++;if(j>i)beam(sx(grp[i])-E.stem*sp/2,sx(grp[j])+E.stem*sp/2,off);else if(i>0)beam(sx(grp[i])-stub,sx(grp[i])+E.stem*sp/2,off);else beam(sx(grp[i])-E.stem*sp/2,sx(grp[i])+stub,off);i=j+1}}}
    L.items.forEach((it,i)=>{
      if(it.rest){g+=glyph(restGlyph(it.den),it.x,it.den===1?yW(topS-2):midY);if(it.dot)g+=glyph(G.dot,it.x+1.2*sp,midY-sp/2);return}
      const hs=it.heads,lo=hs[0].step,hi=hs[hs.length-1].step,up=it.up;const stemX=up?it.x+E.stemUpSE[0]*sp-E.stem*sp/2:it.x+E.stem*sp/2;
      const lx=it.x-E.ledgerExt*sp,lw=(E.headW+2*E.ledgerExt)*sp;
      for(let s=bottom-2;s>=lo+C.shift;s-=2)g+=rect(lx,yW(s)-E.ledger*sp/2,lw,E.ledger*sp,COL.line);
      for(let s=topS+2;s<=hi+C.shift;s+=2)g+=rect(lx,yW(s)-E.ledger*sp/2,lw,E.ledger*sp,COL.line);
      hs.forEach((hd,k)=>{const cy=y(hd.step);const fill=(colour&&heads!==false)?(COL[hd.hand]||COL.ink):COL.ink;let hx=it.x;if(k>0&&hd.step-hs[k-1].step===1&&!hs[k-1].shifted){hx=up?it.x+(E.headW-E.stem)*sp:it.x-(E.headW-E.stem)*sp;hd.shifted=true}hd.x=hx;
        const gl=hd.perc?G.x:it.den<=1?G.whole:it.den<=2?G.half:G.black;g+=glyph(gl,hx,cy,fill);
        if(hd.acc)g+=glyph(hd.acc,hx-(E.accW+.25)*sp,cy);
        if(it.dot){const dy=((hd.step+C.shift)%2===0)?cy-sp/2:cy;g+=glyph(G.dot,hx+(E.headW+.35)*sp,dy)}
        if(hd.ev&&hd.ev.flam&&!it.tie){const gx=hx-1.7*sp,gy=cy+(up?-sp/2:sp/2);g+=glyph(G.black,gx,gy,fill,fs*.62);g+=rect(gx+E.headW*sp*.62-E.stem*sp/2,gy-2.2*sp,E.stem*sp,2.1*sp);g+=`<path d="M${(gx+.2*sp).toFixed(1)} ${(gy-1.2*sp).toFixed(1)}L${(gx+1.4*sp).toFixed(1)} ${(gy-2*sp).toFixed(1)}" stroke="${COL.ink}" stroke-width="${(.12*sp).toFixed(2)}"/>`}});
      /* AN ACCENT (David, 24 Sep 2026, scale exercises): once per chord, beside the head furthest from the stem; the
         picture's bounds take it in */
      if(!it.tie&&hs.some(h=>h.ev&&h.ev.accent)){const far=up?hs[0]:hs[hs.length-1],ay=y(far.step)+(up?1.8:-1.8)*sp;g+=glyph(up?G.accB:G.accA,it.x,ay);if(up)attMax=Math.max(attMax,ay+.8*sp);else attMin=Math.min(attMin,ay-.8*sp)}
      if(numbers||numbersRow||collect){const rows=[...hs].reverse().map(hd=>({label:hd.perc?"×":labelOf(hd.f),bot:isBot(hd.f),fill:colour?(COL[hd.hand]||COL.ink):COL.ink}));it.rows=rows;if(!it.tie)over.push({x:it.x+E.headW*sp/2,rows})}
      if(it.den>1){const aTop=hs[hs.length-1],aBot=hs[0];const anchorFar=up?y(aBot.step)-(aBot.perc?E.xUpSE[1]:E.stemUpSE[1])*sp:y(aTop.step)-(aTop.perc?E.xDownNW[1]:E.stemDownNW[1])*sp;const tip=it.tipY!=null?it.tipY:(up?Math.min(y(hi)-(it.dot&&it.den>=8?4.25:3.5)*sp,midY):Math.max(y(lo)+3.5*sp,midY));   /* a flag's tail hangs 3.27 spaces below its tip, onto the dot of a dotted note on a 3.5 stem; the stem grows, the dot stays by its head (23 Sep 2026) */it.tipY=tip;const y1=Math.min(tip,anchorFar),y2=Math.max(tip,anchorFar);g+=rect(stemX-E.stem*sp/2,y1,E.stem*sp,y2-y1);
        /* THE PICTURE HOLDS EVERY STEM (David, 23 Sep 2026: "The notation is cut off at the bottom"): its ends set the
           staff's edges, with the 0.74 spaces an unbeamed stem-up 32nd's flag rises past the tip; a beam lies between
           its stems' tips, so the stems carry it */
        attMin=Math.min(attMin,y1-(up&&!it.beamed&&it.den>=32?.8*sp:0));attMax=Math.max(attMax,y2);
        if(!it.beamed&&it.den>=8){const fl=it.den>=32?(up?G.flag32U:G.flag32D):it.den===16?(up?G.flag16U:G.flag16D):(up?G.flag8U:G.flag8D);g+=glyph(fl,stemX-E.stem*sp/2,tip)}
        if(hs.some(h=>h.ev&&h.ev.roll)&&!it.tie){const my=(anchorFar+tip)/2;g+=glyph(G.trem2,stemX-.6*sp,my+.6*sp)}}
      if(it.tie&&i>0){const p=L.items.slice(0,i).reverse().find(q=>!q.rest);if(p){hs.forEach((hd,k)=>{const ph=p.heads[k]||p.heads[0];const yy=y(hd.step)+(up?.8:-.8)*sp;let xa=ph.x+E.headW*sp+.15*sp,xb=hd.x-.15*sp;if(xb-xa<1.2*sp){xa=ph.x+E.headW*sp*.5;xb=hd.x+E.headW*sp*.5}const mx=(xa+xb)/2,bul=(up?1:-1)*Math.max(.85*sp,Math.min(1.1*sp,(xb-xa)*.28));g+=`<path d="M${xa.toFixed(2)} ${yy.toFixed(2)}Q${mx.toFixed(2)} ${(yy+bul).toFixed(2)} ${xb.toFixed(2)} ${yy.toFixed(2)}Q${mx.toFixed(2)} ${(yy+bul+.22*sp*(up?1:-1)).toFixed(2)} ${xa.toFixed(2)} ${yy.toFixed(2)}Z" fill="${COL.ink}"/>`})}}
      if(numbers&&!it.tie){const cx=it.x+E.headW*sp/2,fsz=sp*1.25,stepY=1.3*sp;const tipTop=(it.den>1&&up)?Math.min(it.tipY,y(hi)):y(hi);let yy=Math.min(tipTop,yW(topS))-0.9*sp-(it.tup&&!it.tup.plain?2.0*sp:0);
        [...hs].forEach(hd=>{const l={t:hd.perc?"×":labelOf(hd.f),fill:colour?(COL[hd.hand]||COL.ink):COL.ink,bot:isBot(hd.f)};g+=text(l.t,cx,yy,fsz,l.fill,'text-anchor="middle"');if(l.bot)g+=rect(cx-.5*sp,yy+.3*sp,sp,.14*sp,l.fill);attMin=Math.min(attMin,yy-fsz);yy-=stepY})}
    });
    /* tuplet numbers and brackets: one per range that is not a plain division; the number sits beyond the beam,
       a bracket joins the units when they are not one beamed group */
    for(const r of L.ranges){const its=L.items.filter(it=>it.tup&&it.tup.id===r.id);if(!its.length||its[0].tup.plain)continue;
      const notes=its.filter(it=>!it.rest);const up=notes.length?notes.filter(n=>n.up).length>=notes.length/2:true;
      const oneBeam=notes.length===its.length&&notes.length>=2&&notes.every(n=>n.beamed);
      const xa=its[0].x-.2*sp,xb=its[its.length-1].x+E.headW*sp+.2*sp,cx=(xa+xb)/2;
      const edgeOf=it=>it.rest?(up?midY-1.2*sp:midY+1.2*sp):(it.tipY!=null?it.tipY:(up?y(it.heads[it.heads.length-1].step):y(it.heads[0].step)));
      const edge=up?Math.min(...its.map(edgeOf)):Math.max(...its.map(edgeOf));
      const dir=up?-1:1;let ny=edge+dir*1.6*sp;
      if(!oneBeam){const by=edge+dir*1.0*sp;const hook=.7*sp*-dir;g+=`<path d="M${xa.toFixed(1)} ${(by+hook).toFixed(1)}V${by.toFixed(1)}H${(cx-1.1*sp).toFixed(1)}M${(cx+1.1*sp).toFixed(1)} ${by.toFixed(1)}H${xb.toFixed(1)}V${(by+hook).toFixed(1)}" fill="none" stroke="${COL.ink}" stroke-width="${(.13*sp).toFixed(2)}"/>`;ny=by}
      g+=text(String(its[0].tup.n),cx,ny+(up?.45*sp:1.0*sp),sp*1.3,COL.ink,'text-anchor="middle" font-style="italic"');
      if(up)attMin=Math.min(attMin,ny-1.2*sp);else attMax=Math.max(attMax,ny+1.2*sp)}
  });
  /* THE BAND IS THE INK PLUS ONE PADDING (David, 24 Sep 2026: "bring them a bit closer
     to the notation"). The top used to allow a whole stem's length above the highest head,
     3.5 spaces, whether or not anything was drawn up there -- 13.9 units of air above the
     topmost beam on his own piece -- and the chord line, which must clear the band, sat on
     top of all of it. One number now governs both edges: the ink, plus PAD, and never less
     than the staff itself. attMin and attMax carry the stems, beams, flags, tuplet figures
     and number rows; the head terms carry a note with no stem. */
  const PAD=.6*sp;
  const noteTop=Math.min(topY-PAD,yW(highest)-.5*sp-PAD,attMin-PAD), noteBot=Math.max(botY+PAD,yW(lowest)+.5*sp+PAD,attMax+PAD);
  /* THE BAND COVERS THE NOTES (David, 24 Sep 2026: "no notes reach out of it",
     and "keep the chord names outside the amber"). Built here, after the ink has
     been measured, and spanning the note ink alone -- heads, ledger lines, stems,
     beams, tuplet figures -- so what is a label rather than music stays outside
     it: the section label above, the numbers row below. It used to be a fixed box
     3.2 spaces above the top line and 10.4 tall, which a low piece fell out of. */
  /* THE CHORD ROW SITS ABOVE THE BAND (David, 24 Sep 2026: "move the chord row up",
     after "keep the chord names outside the amber"). Drawn here, not in the bar loop,
     because its line is measured from the note ink: one line 0.7 of a space above the
     band's top edge, so the amber stops below it whatever the notes do. It used to sit
     2.7 spaces above the top line, which the band now covers. */
  let chordTop=Infinity;
  if(chords){const cy=noteTop-.35*sp,fsz=sp*1.45,raise=.36*.68*fsz;
    laid.forEach(L=>{const evs=(L.bar||[]).filter(e=>e&&e.chord).sort((a,b)=>(a.t||0)-(b.t||0));if(!evs.length)return;
      const done=new Set();
      /* EVERY CHORD OF THE BAR, EACH OVER ITS OWN NOTE (David, 24 Sep 2026: "give the staff
         the spans so both chords show"). A bar that changes at the half carries two names,
         as the chord row has since 12 Sep; each sits above the first note at or after its
         position, and a name already written at that place is not written twice. */
      evs.forEach(ev=>{
        const at=L.items.find(it=>!it.rest&&it.p>=(ev.t||0))||L.items.find(it=>!it.rest);
        const cx=at?at.x:L.x0+sp,key=cx.toFixed(1)+"|"+ev.chord;if(done.has(key))return;done.add(key);
        const inf=!!ev.chordInf,parts=String(ev.chord).split("♭");
        /* THE CHORD TAB'S OWN HAND (.cname / .cname.inf, and .fl for the flat): a name the piece
           carries is ink and heavy, a name the app worked out is lighter and italic, and the flat
           is a small raised b in the page's own font, not the music font. */
        let t=`<text x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" font-family="${FONT}" font-weight="${inf?700:800}" font-size="${fsz}"${inf?' font-style="italic"':''} fill="${inf?COL.ink3:COL.ink}">${parts[0]}`;
        if(parts.length>1)t+=`<tspan font-size="${(fsz*.68).toFixed(2)}" dy="${(-raise).toFixed(2)}">b</tspan><tspan font-size="${fsz}" dy="${raise.toFixed(2)}">${parts[1]}</tspan>`;
        g+=t+`</text>`;chordTop=Math.min(chordTop,cy-1.5*sp)})})}
  if(mode==="grid"&&o.bands!==false){laid.forEach((L,bi)=>{for(let b=0;b<beats;b++){const bx=L.edges[b];bands+=`<rect class="sv-band${band&&band.bar===firstBar+bi&&band.beat===b?" on":""}" data-bar="${firstBar+bi}" data-beat="${b}" x="${bx.toFixed(1)}" y="${noteTop.toFixed(1)}" width="${(L.edges[b+1]-L.edges[b]).toFixed(1)}" height="${(noteBot-noteTop).toFixed(1)}" rx="${(sp*.6).toFixed(1)}" fill="${COL.band}"/>`}})}
  const extentTop=Math.min(noteTop,chordTop,o.label?topY-5.8*sp:Infinity), extentBotRaw=noteBot;
  let extentBot=extentBotRaw;
  if(numbersRow&&!collect){const ny=extentBotRaw+2*sp;let maxRows=1;over.forEach(oo=>{maxRows=Math.max(maxRows,oo.rows.length);oo.rows.forEach((r,k)=>{const yy=ny+k*1.45*sp;g+=text(r.label,oo.x,yy,sp*1.5,r.fill,'text-anchor="middle"');if(r.bot)g+=rect(oo.x-.6*sp,yy+.35*sp,1.2*sp,.16*sp,r.fill)})});extentBot=ny+(maxRows-1)*1.45*sp+1.2*sp}
  return{inner:g,bands,W,topY,botY,extentTop,extentBot,noteTop,noteBot,preludeW,over,laid};
}

/* ---------- the context of a section ---------- */
function makeCtx(input,opts){
  const names=panNames(input.pan);const key=opts.key||keyFor(input.pan);
  const beats=input.beats||(input.meter||[4,4])[0],den=input.den||(input.meter||[4,4])[1]||4,sub=input.sub||4,ppb=sub*beats;
  const beat32=32/den,pulse32=beat32/sub;
  let groups=Array.isArray(input.groups)&&input.groups.length>1&&input.groups.reduce((a,b)=>a+b,0)===beats?input.groups:null;
  /* AN EIGHTH-NOTE METER GROUPS ITS EIGHTHS (David, 23 Sep 2026, of a jam in
     7/8: "Why are the eighth notes not connected here?"). A count in x/8 IS an
     eighth, and beams group by count, so without this every group held one
     note and every eighth wore a lone flag. Threes where the count divides by
     three (6/8, 9/8, 12/8, as before); otherwise twos with a three at the end
     for the remainder: 5/8 = 2+3, 7/8 = 2+2+3, 8/8 = 3+2+3, 11/8 = 2+2+2+2+3
     (checked for every meter from 4/8 to 13/8; each sums to its own bar).
     A section that carries its own `groups` never reaches this line. */
  if(!groups&&den===8&&beats>3){
    if(beats%3===0)groups=Array.from({length:beats/3},()=>3);
    else{const g=[];let left=beats;
      while(left>4){g.push(beats%2===0&&left>4&&(left-3)%2!==0?3:2);left-=g[g.length-1]}
      if(left===4)g.push(2,2);else if(left)g.push(left);
      groups=g}
  }
  const gi=[];if(groups){let c=0;groups.forEach((n,i)=>{for(let k=0;k<n;k++)gi[c++]=i})}
  const groupOf=c=>groups?(gi[c]!=null?gi[c]:c):c;
  return{names,key,sub,beats,den,ppb,beat32,pulse32,groupOf,tup:input.tup||[]};
}

/* ---------- the staves' filters, a table's slice, and the plan of a line ---------- */
/* the grand staff's two filters: split at middle C.
   A SLAP IS WRITTEN ONCE, ON THE TREBLE (David, 23 Sep 2026: "the slap ...
   should always be displayed in the violin clef"). It has no pitch, so the
   split decides: the treble takes it, the bass declines it. */
function keepsFor(grand,names){
  return grand?[e=>e.v==="perc"||stepOf(nameOf(names,e.f))>=MIDDLE_C,e=>e.v!=="perc"&&stepOf(nameOf(names,e.f))<MIDDLE_C]:[null];
}
/* bars a..b of a table, with its tuplet ranges renumbered to match -- a range
   is keyed by its bar's index, so a cut that keeps the old numbers misreads it */
function slice(input,a,b){
  const bars=(input.bars||[]).slice(a,b),n=bars.length;
  const tup=(input.tup||[]).filter(r=>r&&r.bar>=a&&r.bar<a+n).map(r=>({...r,bar:r.bar-a}));
  return{...input,bars,tup};
}
/* ONE LINE, AND PAGES ONLY AS A LAST RESORT (David, 23 Sep 2026: "Instead of
   creating two lines, let's rather have two pages, but keep it to one line";
   "we need to find a way to make 4 bars always work on one page"). In order:
     1. the whole table on one line at the normal size, if its ink fits;
     2. otherwise pages, split evenly (8 bars: 4 + 4, never 5 + 3), as few as
        fit -- never fewer than four bars to a page while the table has four;
     3. pages of four that still do not fit are drawn smaller, down to minSp,
        rather than cut again;
     4. only a table whose four bars fit at no size is cut below four.
   The ink's floor is spacing()'s, which is linear in the staff space. */
function plan(input,opts){
  opts=opts||{};const n=(input.bars||[]).length,sp=opts.sp||8,minSp=Math.min(opts.minSp||sp,sp);
  const width=opts.width||900,side=(opts.left||0)+(opts.right||0),least=Math.min(n,opts.least||4);
  if(!n)return{per:0,sp,pages:1};
  const key=opts.key||keyFor(input.pan),nKey=key.flats.length+key.sharps.length;
  const prelude=s=>(.4+E.clefW+.6+nKey*.9+(opts.timeSig!==false?.4+E.tsW:0)+.9)*s;
  const floors=new Map();   // the ink's width at a staff space of 1, per page
  const floorOf=(a,b)=>{const k=a+":"+b;if(!floors.has(k)){const part=slice(input,a,b);const ctx=makeCtx(part,{key});floors.set(k,spacing(part.bars,ctx,keepsFor(!!opts.grand,ctx.names),1,1).floor)}return floors.get(k)};
  const fits=(per,s)=>{for(let a=0;a<n;a+=per)if(floorOf(a,Math.min(n,a+per))*s>width-prelude(s)-side+1e-6)return false;return true};
  const most=Math.max(1,Math.ceil(n/least));                  // the most pages: never fewer than `least` bars to one
  for(let pages=1;pages<=most;pages++){const per=Math.ceil(n/pages);if(fits(per,sp))return{per,sp,pages:Math.ceil(n/per)}}
  const per=Math.ceil(n/most);
  for(let s=sp-.25;s>=minSp-1e-9;s-=.25)if(fits(per,s))return{per,sp:s,pages:Math.ceil(n/per)};
  /* 4. the last resort, for a table whose four bars will not fit even small
     (Handpan tune 8, every sextuplet position printed): fewer bars to a page,
     the fewest pages first, each at the largest size that fits */
  for(let pages=most+1;pages<=n;pages++){const q=Math.ceil(n/pages);if(q===Math.ceil(n/(pages-1)))continue;
    for(let s=sp;s>=minSp-1e-9;s-=.25)if(fits(q,s))return{per:q,sp:s,pages:Math.ceil(n/q)}}
  return{per:1,sp:minSp,pages:n,squeezed:true};   // not even one bar fits the smallest staff: drawn, and said
}

/* ---------- the system: one staff, or the grand staff ---------- */
function build(input,opts){
  const ctx=makeCtx(input,opts);const {names}=ctx;
  const sp=opts.sp||8,mode=opts.mode||"grid";
  const base={sp,left:opts.left||0,right:opts.right||0,keep:null,numbers:!!opts.numbers,numbersRow:!!opts.numbersRow,collect:false,band:opts.band||null,barNumbers:opts.barNumbers!==false&&!opts.numbers,timeSig:opts.timeSig!==false,firstBar:opts.firstBar||0,prelude:opts.prelude!==false,colour:opts.colour!==false,heads:opts.heads!==false,chords:!!opts.chords,mode,width:opts.width,pw:opts.pw||13.5,finalBar:!!opts.finalBar,label:opts.label||null,bands:opts.bands};
  const bars=input.bars||[];
  let parts=[],W;
  /* the staves' filters, said once (keepsFor): spacing() and plan() read the same bars the staves draw */
  const keeps=keepsFor(opts.grand,names);
  const cols=mode==="grid"?spacing(bars,ctx,keeps,bars.length*ctx.ppb*base.pw,sp):null;
  if(opts.grand){
    const gap=3.5*sp;
    const t=staff(bars,ctx,{...base,top:200,clef:"g",keep:keeps[0],cols,numbersRow:false,collect:!!opts.numbersRow});
    const b=staff(bars,ctx,{...base,top:t.extentBot+gap,clef:"f",keep:keeps[1],cols,barNumbers:false,numbersRow:false,collect:!!opts.numbersRow});
    W=t.W;
    const x=base.left,y1=t.topY,y2=b.botY,ym=(y1+y2)/2;
    let brace=`<rect x="${x}" y="${y1.toFixed(1)}" width="${(E.thin*sp).toFixed(2)}" height="${(y2-y1).toFixed(1)}" fill="${COL.ink}"/>`;
    brace+=`<path d="M${(x-.5*sp).toFixed(1)} ${y1.toFixed(1)} Q${(x-2.3*sp).toFixed(1)} ${(y1+(y2-y1)*.28).toFixed(1)} ${(x-1.1*sp).toFixed(1)} ${ym.toFixed(1)} Q${(x-2.3*sp).toFixed(1)} ${(y1+(y2-y1)*.72).toFixed(1)} ${(x-.5*sp).toFixed(1)} ${y2.toFixed(1)}" fill="none" stroke="${COL.ink}" stroke-width="${(.26*sp).toFixed(2)}" stroke-linecap="round"/>`;
    let bands="";const bandTop=t.noteTop,bandH=b.noteBot-t.noteTop;   // the notes' own reach, not the picture's (David, 24 Sep 2026)
    if(mode==="grid"&&opts.bands!==false){for(let bi=0;bi<bars.length;bi++)for(let be=0;be<ctx.beats;be++){const ed=t.laid[bi].edges,bx=ed[be];bands+=`<rect class="sv-band${opts.band&&opts.band.bar===base.firstBar+bi&&opts.band.beat===be?" on":""}" data-bar="${base.firstBar+bi}" data-beat="${be}" x="${bx.toFixed(1)}" y="${bandTop.toFixed(1)}" width="${(ed[be+1]-ed[be]).toFixed(1)}" height="${bandH.toFixed(1)}" rx="${(sp*.6).toFixed(1)}" fill="${COL.band}"/>`}}
    let extentBot=b.extentBot,rows="";
    if(opts.numbersRow){const byX=new Map();[...t.over,...b.over].forEach(oo=>{const k=oo.x.toFixed(1);if(!byX.has(k))byX.set(k,{x:oo.x,rows:[]});byX.get(k).rows.push(...oo.rows)});const ny=b.extentBot+2*sp;let maxRows=1;for(const oo of byX.values()){maxRows=Math.max(maxRows,oo.rows.length);oo.rows.forEach((r,k)=>{const yy=ny+k*1.45*sp;rows+=`<text x="${oo.x.toFixed(2)}" y="${yy.toFixed(2)}" text-anchor="middle" font-family="${FONT}" font-weight="700" font-size="${sp*1.5}" fill="${r.fill}">${r.label}</text>`;if(r.bot)rows+=`<rect x="${(oo.x-.6*sp).toFixed(2)}" y="${(yy+.35*sp).toFixed(2)}" width="${1.2*sp}" height="${.16*sp}" fill="${r.fill}"/>`})}extentBot=ny+(maxRows-1)*1.45*sp+1.2*sp}
    parts=[{inner:bands+t.inner+b.inner+brace+rows,extentTop:t.extentTop,extentBot}];
  }else{
    const cf=opts.clef?{clef:opts.clef}:clefFor(input.pan,opts.clefFrom);
    const s=staff(bars,ctx,{...base,top:200,clef:cf.clef,cols});W=s.W;
    parts=[{inner:s.bands+s.inner,extentTop:s.extentTop,extentBot:s.extentBot}];
  }
  const top=Math.min(...parts.map(p=>p.extentTop)),bot=Math.max(...parts.map(p=>p.extentBot));
  const H=bot-top;
  const svg=`<svg class="sv" viewBox="0 ${top.toFixed(1)} ${W.toFixed(1)} ${H.toFixed(1)}" ${opts.fixed?`width="${W.toFixed(0)}" height="${H.toFixed(0)}"`:""} xmlns="http://www.w3.org/2000/svg">${parts.map(p=>p.inner).join("")}</svg>`;
  return{svg,W,H,key:ctx.key,clef:opts.grand?"grand":(opts.clef||clefFor(input.pan,opts.clefFrom).clef),fits:cols?cols.fits:true,need:cols?cols.floor:0,room:cols?bars.length*ctx.ppb*base.pw:0};
}

/* ---------- font and style ---------- */
let fontDone=false;
function ensureFont(url){
  if(fontDone)return;fontDone=true;
  const st=document.createElement("style");st.id="sv-style";
  st.textContent=`@font-face{font-family:"Leland";src:url("${url||"fonts/Leland.otf"}") format("opentype");font-display:block}
.sv{display:block;width:100%;height:auto}
.sv .sv-band{opacity:0}.sv .sv-band.on{opacity:1}`;
  document.head.appendChild(st);
}

/* ---------- public ---------- */
function render(el,input,opts){
  opts=opts||{};ensureFont(opts.fontUrl);
  const bars=input.bars||[];const per=opts.perSystem&&opts.perSystem>0?Math.min(opts.perSystem,bars.length||1):0;
  let pw=opts.pw;
  if(!pw&&(opts.mode||"grid")==="grid"){
    const sp=opts.sp||8,key=opts.key||keyFor(input.pan),nKey=key.flats.length+key.sharps.length;
    const beats=input.beats||(input.meter||[4,4])[0],sub=input.sub||4;
    const preludeW=(.4+E.clefW+.6+nKey*.9+(opts.timeSig!==false?.4+E.tsW:0)+.9)*sp;
    const w=(el&&el.getBoundingClientRect().width)||opts.width||900;const ppb=sub*beats;
    /* THE WIDTH IS THE WIDTH (David, 24 Sep 2026: "the staff notation is so small"): a floor of 4 px per grid
       position made a raised grid (48 to the count in Let It Be's A2) draw 3132 px wide and shrink to 29 %; plan()
       never knew of it. The position's share of the real width, whatever it is - spacing() shrinks the ink itself. */
    pw=Math.max(1e-3,(w-preludeW-(opts.left||0)-(opts.right||0))/(Math.max(1,per||bars.length)*ppb));
  }
  if(per&&bars.length>per){   // systems of `per` bars, stacked
    const parts=[];let H=0,W=0,key=null,clef=null;
    for(let i=0;i<bars.length;i+=per){const r=build(slice(input,i,i+per),{...opts,pw,firstBar:i,timeSig:i===0&&opts.timeSig!==false});parts.push(r.svg);H+=r.H;W=Math.max(W,r.W);key=r.key;clef=r.clef}
    const svg=parts.join("");if(el){el.innerHTML=svg}return{svg,W,H,key,clef,systems:parts.length};
  }
  const r=build(input,{...opts,pw});
  if(el){el.innerHTML=r.svg}
  return r;
}
/* light one count's band; when the container scrolls (stacked systems on a phone), bring that system into view */
function paint(el,bar,beat){
  if(!el)return;let lit=null;
  el.querySelectorAll(".sv-band").forEach(b=>{const on=+b.dataset.bar===bar&&+b.dataset.beat===beat;if(on){b.classList.add("on");lit=b}else b.classList.remove("on")});
  if(lit&&el.scrollHeight>el.clientHeight+4){const svg=lit.closest("svg");if(svg){const top=svg.offsetTop-el.offsetTop;if(top<el.scrollTop||top+svg.offsetHeight>el.scrollTop+el.clientHeight)el.scrollTop=Math.max(0,top-4)}}
}
window.StaffView={version:3,render,paint,plan,slice,keyFor,clefFor,panNames,stepOf,LEDGER_GUARD,G,E};
})();
