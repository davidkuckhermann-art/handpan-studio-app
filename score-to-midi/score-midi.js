/* score-midi.js — a score as read by score-reader.js, written out as a Standard MIDI File.
   14 September 2026. No dependencies; runs in a browser or in node.

   The reader's time unit is the QUARTER NOTE: dur 1 is a quarter, 0.5 an eighth, 4 a whole,
   and a column's `onset` is quarter notes from the start of its bar. So a tick is simply
   onset × PPQ, and nothing here needs to know what instrument will play it.

   Input   the reader's result (or several pages merged): {bars, meter:{beats}, key:{fifths}, tempo}
   Output  build(score, opts) → Uint8Array, a format-1 SMF

   opts: {title, tempo, beats, denom, layout:"auto"|"combined"|"separate", repeats:true, velocity:80}

   WHAT A BAR LASTS: the meter, unless a staff of that bar was read as longer — then the longest
   staff, so a misread bar displaces nothing after it and shows up as one odd bar instead of a
   piece that drifts. Bars are laid end to end in the order the repeats give. */
(function(root){
"use strict";
const PPQ=960;

/* ── the bytes ─────────────────────────────────────────────────────── */
function vlq(n){ n=Math.max(0,Math.round(n)); const out=[n&0x7f]; n=Math.floor(n/128);
  while(n>0){ out.unshift((n&0x7f)|0x80); n=Math.floor(n/128); } return out; }
/* meta text must survive a DAW that assumes Latin-1: accidentals are transliterated and
   anything still outside ASCII is dropped rather than written as bytes nobody can read */
function ascii(str){
  const a=String(str).replace(/♭/g,"b").replace(/♯/g,"#").replace(/♮/g,"")
    .replace(/[—–]/g,"-").replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/·/g,"-")
    .replace(/[^\x20-\x7e]/g,"").replace(/\s+/g," ").trim();
  return [...a].map(c=>c.charCodeAt(0));
}
function meta(type,bytes){ return [0xFF,type,...vlq(bytes.length),...bytes]; }
function trackBytes(events){
  events.sort((a,b)=>a.tick-b.tick||a.pri-b.pri);            // metas, then note offs, then note ons
  const out=[]; let last=0;
  for(const e of events){ out.push(...vlq(e.tick-last),...e.data); last=e.tick; }
  out.push(0x00,0xFF,0x2F,0x00);                             // end of track
  return out;
}
function chunk(id,body){ const n=body.length;
  return [...ascii(id),(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255,...body]; }

/* ── what the file is made of ──────────────────────────────────────── */
const DYN={ppp:16,pp:33,p:49,mp:64,mf:80,f:96,ff:112,fff:127,sf:110,sfz:112,fp:96};
const velOf=(mark,dflt)=>DYN[mark]!==undefined?DYN[mark]:dflt;

/* the parts: one per staff slot, named by the clef that slot carries */
function parts(score){
  let n=0; for(const b of score.bars) n=Math.max(n,b.staffs.length);
  const out=[];
  for(let i=0;i<n;i++){
    let clef=null;
    for(const b of score.bars){ const s=b.staffs[i]; if(s){ clef=s.clef; break; } }
    out.push({i,clef,name:n<=2?(clef==="t"?"Treble":"Bass"):("Staff "+(i+1))});
  }
  return out;
}
/* TWO STAFFS ARE ONE INSTRUMENT, MORE ARE SEVERAL (David, 14 Sep 2026): a piano's two staffs are
   two hands of one player and belong on one track; three or more staffs are a score of separate
   instruments and each keeps its own. "combined" and "separate" say it outright. */
function combine(score,layout){
  const n=parts(score).length;
  if(layout==="combined") return true;
  if(layout==="separate") return false;
  return n<=2;
}

/* the order the bars are played in: a repeated span is played twice. A bar that both opens and
   closes a repeat repeats itself. Nothing is repeated more than once — first and second endings
   are not read yet, so a second time through would play the first ending again. */
function playOrder(bars){
  const out=[]; let start=0; const done=new Set();
  for(let i=0;i<bars.length;i++){
    if(bars[i].repeatStart) start=i;
    out.push(i);
    if(bars[i].repeatEnd&&!done.has(i)){ done.add(i); for(let j=start;j<=i;j++) out.push(j); }
  }
  return out;
}

/* every bar with the beat it starts on and the beats it lasts */
function timeline(score,opts){
  const beats=opts.beats||score.meter.beats||4;
  const order=opts.repeats===false?score.bars.map((b,i)=>i):playOrder(score.bars);
  const out=[]; let t=0;
  for(const i of order){
    const b=score.bars[i];
    const totals=b.staffs.map(s=>s.total||0).filter(v=>v>0);
    const len=Math.max(beats,...(totals.length?totals:[0]));
    out.push({bar:b,index:i,at:t,len});
    t+=len;
  }
  return {rows:out,end:t,beats};
}

/* ── the notes, once ──────────────────────────────────────────────────
   WHAT YOU HEAR IS WHAT GETS WRITTEN. The player and the file are the same list of notes, made
   here: an ear that checks a reading is only worth having if it is listening to the file. */
function events(score,opts){
  opts=opts||{};
  const P=parts(score);
  if(!P.length) throw new Error("nothing was read: no staff, no bars");
  const {rows,end,beats}=timeline(score,opts);
  const baseVel=opts.velocity||80;
  const notes=[];
  for(const row of rows){
    for(let pi=0;pi<P.length;pi++){
      const st=row.bar.staffs[pi]; if(!st) continue;
      let vel=baseVel;
      for(const c of st.cols){
        if(c.dyn) vel=velOf(c.dyn,vel);
        if(c.rest||!c.notes||!c.notes.length) continue;
        for(const nt of c.notes){
          if(nt.midi===null||nt.midi===undefined) continue;
          const at=row.at+c.onset+(nt.grace?-Math.min(0.22,c.dur*0.5):0);
          notes.push({at:Math.max(0,at), dur:nt.grace?0.18:Math.max(0.08,(nt.dur||c.dur)),
                      midi:nt.midi, part:pi,
                      vel:Math.max(1,Math.min(127,Math.round((nt.grace?0.78:1)*(nt.vel||vel))))});
        }
      }
    }
  }
  if(!notes.length) throw new Error("nothing was read: no notes");
  notes.sort((a,b)=>a.at-b.at);
  return {parts:P,notes,rows,end,beats};
}

/* ── the file ──────────────────────────────────────────────────────── */
function build(score,opts){
  opts=opts||{};
  const {parts:P,notes,rows,end,beats}=events(score,opts);
  const one=combine(score,opts.layout||"auto");
  const bpm=opts.tempo||(score.tempo&&score.tempo.bpm)||100;
  const tick=beat=>Math.round(beat*PPQ);

  /* track 0 — the conductor: the title, the tempo, the metre, the key, and where the repeats were */
  const us=Math.round(60000000/bpm);
  const t0=[{tick:0,pri:0,data:meta(0x03,ascii(opts.title||"Score"))},
            {tick:0,pri:0,data:meta(0x01,ascii("Read from notation by score-reader.js"))},
            {tick:0,pri:0,data:meta(0x51,[(us>>16)&255,(us>>8)&255,us&255])}];
  const denom=opts.denom||4, dd=Math.round(Math.log2(denom));
  const num=Math.max(1,Math.round(beats*denom/4));
  t0.push({tick:0,pri:0,data:meta(0x58,[num,dd,24,8])});
  const f=(score.key&&score.key.fifths)||0;
  t0.push({tick:0,pri:0,data:meta(0x59,[f<0?256+f:f,0])});
  /* A MIDI FILE HAS NO REPEATS — it is a flat line of events, and nothing in the format says
     "go back". So the repeats are played out (that is what a player would do), and a MARKER is
     left at each sign so a person opening the file can still see where they were. */
  for(const row of rows){
    if(row.bar.repeatStart) t0.push({tick:tick(row.at),pri:0,data:meta(0x06,ascii("repeat open (bar "+row.bar.n+")"))});
    if(row.bar.repeatEnd) t0.push({tick:tick(row.at+row.len),pri:0,data:meta(0x06,ascii("repeat close (bar "+row.bar.n+")"))});
  }

  const lists=P.map(()=>[]);
  for(const n of notes){
    lists[n.part].push({tick:tick(n.at),pri:2,data:[0x90,n.midi,n.vel]});
    lists[n.part].push({tick:tick(n.at+n.dur),pri:1,data:[0x80,n.midi,0x40]});
  }

  const tracks=[trackBytes(t0)];
  if(one){
    const all=[{tick:0,pri:0,data:meta(0x03,ascii(opts.title||"Score"))}];
    for(const L of lists) all.push(...L);
    tracks.push(trackBytes(all));
  } else {
    P.forEach((p,i)=>{
      if(!lists[i].length) return;
      const ch=i<9?i:i+1;                                   // channel 10 is percussion; step over it
      const ev=[{tick:0,pri:0,data:meta(0x03,ascii(p.name))}];
      for(const e of lists[i]) ev.push({tick:e.tick,pri:e.pri,data:[e.data[0]|ch,e.data[1],e.data[2]]});
      tracks.push(trackBytes(ev));
    });
  }
  const head=chunk("MThd",[0,1,(tracks.length>>8)&255,tracks.length&255,(PPQ>>8)&255,PPQ&255]);
  const bytes=[...head]; for(const t of tracks) bytes.push(...chunk("MTrk",t));
  return new Uint8Array(bytes);
}

const api={build,events,parts,combine,playOrder,timeline,PPQ,DYN};
if(typeof module!=="undefined"&&module.exports) module.exports=api; else root.ScoreMidi=api;
})(typeof window!=="undefined"?window:globalThis);
