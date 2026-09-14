/* score-engrave.js — draws a score as score-reader.js read it, back as staff notation.
   14 September 2026. No dependencies, no fonts beyond the digits: every symbol is an SVG path
   in units of the staff spacing, so the drawing is the same at any size.

   This is not a typesetter. It is a MIRROR: it shows exactly what the reader found and nothing
   it did not — every head at the pitch that will go into the MIDI file, every duration as read,
   and every uncertainty in violet. If a bar looks wrong here, the reading is wrong, not the
   drawing, and that is the whole point of showing it.

   Engrave.draw(score, opts) → an <svg> element
   opts: {width, sp, beats, title, colour:{...}} */
(function(root){
"use strict";
const NS="http://www.w3.org/2000/svg";
const VIOLET="#6E5A8C", INK="#15130f", GREY="#a7a29a", EDIT="#1f7a6b";   // a note corrected by hand

/* ── the staff ─────────────────────────────────────────────────────── */
/* a diatonic step, C4 = 0, to the y of its line or space: the top line of a treble staff is F5
   (step 10), of a bass staff A3 (step −2), and every step is half a spacing below the last */
const topIdx=clef=>clef==="t"?10:-2;
const yOf=(step,clef,top,sp)=>top+(topIdx(clef)-step)*sp/2;

/* ── the glyphs, in spacing units, drawn from the staff's top-left ──── */
/* Each returns a <path d> string. The clefs are stroked (a clef is a written stroke, and a
   stroked path keeps its weight at any size); heads, rests and accidentals are filled. */
const G={
  /* the G clef: the stem from above the staff down past it, the tail curling left, and the
     body — down the left, round below, up the right, and in to the spiral whose eye sits on
     the G line (y = 3) */
  trebleStem:"M 1.30 -0.60 C 1.34 1.20 1.26 3.10 1.18 4.86",
  trebleTail:"M 1.18 4.86 C 1.14 5.52 0.72 5.88 0.36 5.66 C 0.06 5.48 0.10 5.04 0.50 5.00",
  trebleBody:"M 1.30 -0.60 C 1.20 -1.34 0.66 -1.22 0.48 -0.60 "+
             "C 0.26 0.14 0.54 0.94 0.98 1.50 "+
             "C 1.44 2.08 2.02 2.34 2.32 2.88 "+
             "C 2.64 3.46 2.30 4.30 1.55 4.44 "+
             "C 0.76 4.58 0.16 4.02 0.24 3.30 "+
             "C 0.32 2.58 1.02 2.20 1.55 2.50 "+
             "C 1.98 2.74 2.00 3.30 1.55 3.44",
  /* the F clef: the blob on the F line, the curve over it and down to the left, and the two dots */
  bassBody:"M 0.45 1.60 C 0.45 0.62 1.72 0.38 2.34 1.08 C 2.98 1.82 2.34 3.16 0.30 3.86",
  bassBlob:[0.50,1.42],
  bassDot1:[3.30,0.62], bassDot2:[3.30,1.42],
  /* accidentals, drawn about their note's row (y = 0 is the note) */
  sharp:"M -0.30 -1.10 L -0.30 0.86 M 0.24 -1.30 L 0.24 0.66 "+
        "M -0.58 -0.32 L 0.52 -0.62 M -0.58 0.42 L 0.52 0.12",
  natural:"M -0.26 -1.16 L -0.26 0.62 M 0.26 -0.62 L 0.26 1.16 "+
          "M -0.26 -0.28 L 0.26 -0.44 M -0.26 0.34 L 0.26 0.18",
  flatStem:"M -0.20 -1.42 L -0.20 0.58",
  flatBowl:"M -0.20 0.58 C 0.20 0.18 0.62 0.10 0.62 -0.24 C 0.62 -0.60 0.18 -0.62 -0.20 -0.18",
  /* the quarter rest, the classic zigzag, hanging from the staff's second line */
  quarterRest:"M 0.10 0 C 0.44 0.44 0.62 0.62 0.34 1.02 C 0.10 1.36 0.12 1.60 0.46 1.92 "+
              "C 0.12 1.74 -0.20 1.86 -0.10 2.20 C 0.00 2.54 0.34 2.72 0.52 2.82 "+
              "C 0.16 2.62 -0.26 2.66 -0.20 2.24 C -0.14 1.86 0.30 1.62 0.18 1.26 "+
              "C 0.08 0.94 -0.28 0.70 -0.34 0.34 Z",
  /* the eighth rest: a slanted stroke with a hook and a dot */
  eighthRest:"M 0.62 0.10 C 0.44 0.34 0.16 0.36 0.04 0.18 C -0.06 0.02 0.04 -0.16 0.26 -0.18 "+
             "C 0.48 -0.20 0.62 -0.06 0.68 0.06 L 0.34 1.72 L 0.06 1.72 L 0.40 0.30 Z"
};

function el(tag,attrs,parent){
  const e=document.createElementNS(NS,tag);
  for(const k in attrs) if(attrs[k]!==null&&attrs[k]!==undefined) e.setAttribute(k,attrs[k]);
  if(parent) parent.appendChild(e);
  return e;
}
/* a glyph laid down at (x,y) and scaled to the spacing */
function glyph(g,d,x,y,sp,attrs){
  return el("path",Object.assign({d,transform:`translate(${x},${y}) scale(${sp})`},attrs||{}),g);
}

/* ── how wide a bar wants to be ────────────────────────────────────── */
/* THE SPACE AFTER A NOTE GROWS WITH ITS LENGTH, not with its number: a bar of four quarters and
   a bar of sixteen sixteenths are near enough the same width, and the eye reads time off the
   page. One rule, used for every bar, and the line is stretched to fill afterwards. */
const spaceFor=d=>1.05+2.15*Math.sqrt(Math.max(0.125,d));
function barPlan(bar,beats){
  const set=new Set();
  for(const st of bar.staffs||[]) for(const c of st.cols||[]) set.add(Math.round((c.onset||0)*1000)/1000);
  const at=[...set].sort((a,b)=>a-b);
  if(!at.length) at.push(0);
  const len=Math.max(beats,...(bar.staffs||[]).map(s=>s.total||0));
  const w=at.map((o,i)=>spaceFor((i+1<at.length?at[i+1]:len)-o));
  const x=[]; let run=0.9;
  for(let i=0;i<at.length;i++){ x.push(run); run+=w[i]; }
  return {at,x,width:run+0.5,len};
}

/* ── the drawing ───────────────────────────────────────────────────── */
function draw(score,opts){
  opts=opts||{};
  const sp=opts.sp||9;
  const W=opts.width||1000;
  const beats=opts.beats||(score.meter&&score.meter.beats)||4;
  const fifths=(score.key&&score.key.fifths)||0;
  const bars=score.bars||[];
  let nStaff=0; for(const b of bars) nStaff=Math.max(nStaff,(b.staffs||[]).length);
  if(!nStaff||!bars.length){ const s=el("svg",{width:W,height:40}); el("text",{x:8,y:26,fill:GREY,"font-size":14,"font-family":"Georgia,serif"},s).textContent="nothing was read"; return s; }
  const clefs=[]; for(let i=0;i<nStaff;i++){ let c="t"; for(const b of bars){ const s=b.staffs[i]; if(s){ c=s.clef; break; } } clefs.push(c); }

  const MARG=3.2*sp, HEAD=(4.2+Math.abs(fifths)*0.62+2.8)*sp;   // clef, key signature, metre
  const staffGap=(nStaff<=2?9:11)*sp, sysGap=(nStaff<=2?7:5)*sp;
  const sysH=(nStaff-1)*staffGap+4*sp;

  /* pack the bars into lines */
  const plans=bars.map(b=>barPlan(b,beats));
  const lines=[]; let cur=null;
  for(let i=0;i<bars.length;i++){
    const want=plans[i].width*sp;
    if(!cur||cur.w+want>W-2*MARG-HEAD){ cur={from:i,to:i,w:want}; lines.push(cur); }
    else { cur.to=i; cur.w+=want; }
  }
  const H=MARG+lines.length*(sysH+sysGap)+2.5*sp;
  const svg=el("svg",{width:W,height:Math.round(H),viewBox:`0 0 ${W} ${Math.round(H)}`,
                      xmlns:NS,"font-family":"Georgia,'Times New Roman',serif"});
  /* where every bar was drawn, so a playhead can be laid over it afterwards */
  const boxes=[]; svg.__bars=boxes;
  /* every head drawn keeps a handle on the note it came from, so a correction can take hold of it */
  const handles=[]; svg.__heads=handles; svg.__sp=sp;
  el("rect",{x:0,y:0,width:W,height:Math.round(H),fill:"none"},svg);

  let y=MARG+2*sp;
  lines.forEach((L,li)=>{
    const tops=[]; for(let i=0;i<nStaff;i++) tops.push(y+i*staffGap);
    const x0=MARG+HEAD;
    const avail=W-MARG-x0;
    const raw=[]; for(let i=L.from;i<=L.to;i++) raw.push(plans[i].width*sp);
    const total=raw.reduce((a,b)=>a+b,0);
    /* the last line keeps its natural width unless it nearly fills the page */
    const stretch=(li===lines.length-1&&total<avail*0.72)?1:avail/total;

    /* the staff lines and the brace */
    for(let i=0;i<nStaff;i++) for(let k=0;k<5;k++)
      el("line",{x1:MARG,y1:tops[i]+k*sp,x2:W-MARG,y2:tops[i]+k*sp,stroke:INK,"stroke-width":Math.max(0.7,sp*0.09)},svg);
    if(nStaff>1){
      el("line",{x1:MARG,y1:tops[0],x2:MARG,y2:tops[nStaff-1]+4*sp,stroke:INK,"stroke-width":sp*0.18},svg);
      if(nStaff===2) el("path",{d:`M ${MARG-sp*0.7} ${tops[0]-sp*0.3} C ${MARG-sp*2.2} ${tops[0]+sp*1.6} ${MARG-sp*2.2} ${tops[1]+sp*2.4} ${MARG-sp*0.7} ${tops[1]+sp*4.3}`,
                                fill:"none",stroke:INK,"stroke-width":sp*0.22,"stroke-linecap":"round"},svg);
    }

    /* the clef, the key signature and (on the first line) the metre */
    for(let i=0;i<nStaff;i++) drawHead(svg,clefs[i],fifths,tops[i],MARG+sp*0.8,sp,li===0?{beats,denom:opts.denom||4}:null);

    /* the bars */
    let x=x0;
    for(let bi=L.from;bi<=L.to;bi++){
      const bar=bars[bi], plan=plans[bi], bw=plan.width*sp*stretch;
      if(bar.q) el("rect",{x,y:tops[0]-1.6*sp,width:bw,height:tops[nStaff-1]+4*sp-tops[0]+3.2*sp,
                           fill:VIOLET,opacity:0.07},svg);
      /* the bar number over every line's first bar and every fifth bar */
      if(bi===L.from||(bi+1)%5===0)
        el("text",{x:x+2,y:tops[0]-1.9*sp,fill:GREY,"font-size":sp*1.05},svg).textContent=String(bi+1);
      for(let i=0;i<nStaff;i++){
        const st=bar.staffs[i]; if(!st) continue;
        drawStaffBar(svg,st,plan,x,tops[i],sp,stretch,clefs[i],bar.q,handles);
      }
      boxes[bi]={x,w:bw,top:tops[0]-1.4*sp,bottom:tops[nStaff-1]+4*sp+1.4*sp};
      x+=bw;
      const last=bi===L.to;
      const thick=bar.repeatEnd||(score.sectionCuts||[]).includes(bi+1);
      for(let i=0;i<nStaff;i++)
        el("line",{x1:x-(thick?sp*0.16:0),y1:tops[i],x2:x-(thick?sp*0.16:0),y2:tops[i]+4*sp,
                   stroke:INK,"stroke-width":thick?sp*0.34:sp*0.11},svg);
      if(bar.repeatEnd) for(let i=0;i<nStaff;i++) for(const k of [1.5,2.5])
        el("circle",{cx:x-sp*0.62,cy:tops[i]+k*sp,r:sp*0.16,fill:INK},svg);
      if(bar.repeatStart) for(let i=0;i<nStaff;i++){
        el("line",{x1:x+sp*0.16,y1:tops[i],x2:x+sp*0.16,y2:tops[i]+4*sp,stroke:INK,"stroke-width":sp*0.34},svg);
        for(const k of [1.5,2.5]) el("circle",{cx:x+sp*0.68,cy:tops[i]+k*sp,r:sp*0.16,fill:INK},svg);
      }
    }
    y+=sysH+sysGap;
  });
  return svg;
}

/* the clef, the key signature and the metre at a line's head */
/* THE KEY SIGNATURE'S PLACES, as diatonic steps with C4 = 0, in the order they are written.
   On a bass staff the same accidental stands FOURTEEN steps lower — two octaves — which puts it
   one staff position below its treble place, the way every engraver writes it. (Fourteen, not two:
   two left every flat of an E flat piece hanging in the gap under the treble staff, and the bass
   staff with none. David, 14 Sep: "the lower two flats should sit in the bass clef staff".) */
const SHARPS=[10,7,11,8,5,9,6], FLATS=[6,9,5,8,4,7,3], BASS_DROP=14;
function drawHead(svg,clef,fifths,top,x,sp,metre){
  if(clef==="t"){
    const gx=x, gy=top;
    for(const d of [G.trebleBody,G.trebleStem,G.trebleTail])
      glyph(svg,d,gx,gy,sp,{fill:"none",stroke:INK,"stroke-width":0.26,"stroke-linecap":"round","stroke-linejoin":"round"});
    x+=3.6*sp;
  } else {
    glyph(svg,G.bassBody,x,top,sp,{fill:"none",stroke:INK,"stroke-width":0.40,"stroke-linecap":"round"});
    el("circle",{cx:x+G.bassBlob[0]*sp,cy:top+G.bassBlob[1]*sp,r:sp*0.30,fill:INK},svg);
    for(const d of [G.bassDot1,G.bassDot2]) el("circle",{cx:x+d[0]*sp,cy:top+d[1]*sp,r:sp*0.17,fill:INK},svg);
    x+=4.0*sp;
  }
  const n=Math.abs(fifths), list=(fifths>=0?SHARPS:FLATS).slice(0,n);
  for(const s0 of list){
    const step=s0-(clef==="t"?0:BASS_DROP), y=yOf(step,clef,top,sp);
    if(fifths>=0) glyph(svg,G.sharp,x+sp*0.4,y,sp,{fill:"none",stroke:INK,"stroke-width":0.13,"stroke-linecap":"round"});
    else { glyph(svg,G.flatStem,x+sp*0.4,y,sp,{fill:"none",stroke:INK,"stroke-width":0.12,"stroke-linecap":"round"});
           glyph(svg,G.flatBowl,x+sp*0.4,y,sp,{fill:"none",stroke:INK,"stroke-width":0.15,"stroke-linecap":"round"}); }
    x+=0.62*sp;
  }
  if(metre){
    const X=x+1.1*sp, num=Math.max(1,Math.round(metre.beats*metre.denom/4));
    const t=(s,yy)=>el("text",{x:X,y:yy,fill:INK,"font-size":sp*2.32,"font-weight":"bold","text-anchor":"middle"},svg).textContent=s;
    t(String(num),top+1.86*sp); t(String(metre.denom),top+3.92*sp);
  }
}

/* one staff of one bar */
function drawStaffBar(svg,st,plan,x0,top,sp,stretch,clef,barQ,handles){
  const X=o=>x0+(plan.x[plan.at.indexOf(Math.round(o*1000)/1000)]||0.9)*sp*stretch;
  const cols=(st.cols||[]).slice();
  /* the beam groups: neighbours of an eighth or shorter inside one beat, with nothing but notes
     between them — one rule, and a group of one gets a flag instead */
  const groups=[]; let g=null;
  for(const c of cols){
    const beamable=!c.rest&&c.notes&&c.notes.length&&c.dur<=0.5&&c.dur>0;
    if(!beamable){ g=null; continue; }
    const beat=Math.floor(c.onset*1.0001);
    if(g&&g.beat===beat&&Math.abs(g.end-c.onset)<0.001){ g.cols.push(c); g.end=c.onset+c.dur; }
    else { g={beat,cols:[c],end:c.onset+c.dur}; groups.push(g); }
  }
  const groupOf=new Map(); for(const gg of groups) if(gg.cols.length>1) for(const c of gg.cols) groupOf.set(c,gg);

  for(const c of cols){
    const x=X(c.onset), q=c.q||barQ;
    const col=q?VIOLET:INK;
    if(c.rest){ drawRest(svg,c.rest.kind||"quarter",x,top,sp,col); continue; }
    if(!c.notes||!c.notes.length) continue;
    drawColumn(svg,c,x,top,sp,clef,col,groupOf.get(c)||null,X,handles);
  }
  /* the beams themselves, once every stem is known */
  for(const gg of groups){
    if(gg.cols.length<2) continue;
    const xs=gg.cols.map(c=>c._stemX), ys=gg.cols.map(c=>c._stemEnd);
    const dir=gg.cols[0]._dir;
    const x1=xs[0], x2=xs[xs.length-1];
    const yA=ys[0], yB=ys[ys.length-1];
    const th=sp*0.5;
    const nb=Math.max(...gg.cols.map(c=>c.dur<=0.25?2:1));
    for(let k=0;k<nb;k++){
      const off=dir<0?k*th*1.35:-k*th*1.35;
      el("path",{d:`M ${x1} ${yA+off} L ${x2} ${yB+off} L ${x2} ${yB+off+th*(dir<0?1:-1)} L ${x1} ${yA+off+th*(dir<0?1:-1)} Z`,
                 fill:gg.cols[0]._col},svg);
    }
    /* every stem in the group reaches its beam */
    gg.cols.forEach((c,i)=>{ const t=(x2===x1)?0:(xs[i]-x1)/(x2-x1); const yy=yA+(yB-yA)*t;
      if(c._stemLine) c._stemLine.setAttribute("y2",yy); });          // the far end of every stem sits on the beam
  }
  /* the triplets: three neighbours whose length is two thirds of a written one */
  const trip=[]; let run=[];
  for(const c of cols){
    const isTrip=c.dur>0&&Math.abs(Math.log2(c.dur*3)-Math.round(Math.log2(c.dur*3)))<0.02;
    if(isTrip&&(!run.length||Math.abs(run[run.length-1].dur-c.dur)<0.001)) run.push(c); else { if(run.length>=3) trip.push(run.slice(0,3)); run=isTrip?[c]:[]; }
  }
  if(run.length>=3) trip.push(run.slice(0,3));
  for(const t of trip){
    const a=X(t[0].onset), b=X(t[2].onset)+sp*0.7, yy=top-1.5*sp;
    el("text",{x:(a+b)/2,y:yy,fill:GREY,"font-size":sp*1.15,"font-style":"italic","text-anchor":"middle"},svg).textContent="3";
    el("path",{d:`M ${a} ${yy+sp*0.2} L ${a} ${yy-sp*0.35} M ${b} ${yy+sp*0.2} L ${b} ${yy-sp*0.35}`,
               stroke:GREY,"stroke-width":sp*0.09,fill:"none"},svg);
  }
  /* the dynamics written under the staff */
  for(const c of cols) if(c.dyn)
    el("text",{x:X(c.onset),y:top+6.1*sp,fill:INK,"font-size":sp*1.55,"font-style":"italic","font-weight":"bold"},svg).textContent=c.dyn;
}

/* one column: its heads, its accidentals, its stem, its flag, its dots */
function drawColumn(svg,c,x,top,sp,clef,col,inGroup,X,handles){
  const notes=c.notes.slice().sort((a,b)=>a.step-b.step);
  const ys=notes.map(n=>yOf(n.step,clef,top,sp));
  const hollow=c.dur>=2;
  const whole=c.dur>=4&&notes.every(n=>n.hollow);
  const mid=top+2*sp;
  let dir=notes[0].stem||0;
  if(!dir) dir=(ys[0]+ys[ys.length-1])/2>mid?-1:1;             // low notes stem up, high notes down
  const rx=whole?sp*0.72:sp*0.62, ry=sp*0.45;

  /* the grace notes of this column stand to its left, small */
  notes.forEach((n,i)=>{
    const small=n.grace?0.62:1;
    const gx=n.grace?x-sp*1.15:x;
    const shown=n.edited?EDIT:(n.q?"#8a6fae":col);
    const head=el("ellipse",{cx:gx,cy:ys[i],rx:rx*small,ry:ry*small,
                  fill:(hollow&&!n.grace)?"none":shown,
                  stroke:(hollow&&!n.grace)?(n.edited?EDIT:col):"none","stroke-width":sp*0.17,
                  transform:`rotate(-20 ${gx} ${ys[i]})`},svg);
    if(handles){
      const grip=el("circle",{cx:gx,cy:ys[i],r:sp*0.85,fill:"transparent",style:"cursor:ns-resize"},svg);
      const H={note:n,col:c,clef,top,sp,head,grip,cx:gx,cy:ys[i]};
      grip.__h=H; head.__h=H; handles.push(H);
    }
    if(n.acc!==undefined&&n.acc!==null){
      const ac=n.edited?EDIT:col;
      const ax=gx-sp*1.15, d=n.acc>0?G.sharp:n.acc<0?null:G.natural;
      if(d) glyph(svg,d,ax,ys[i],sp,{fill:"none",stroke:ac,"stroke-width":0.13,"stroke-linecap":"round"});
      else { glyph(svg,G.flatStem,ax,ys[i],sp,{fill:"none",stroke:ac,"stroke-width":0.12,"stroke-linecap":"round"});
             glyph(svg,G.flatBowl,ax,ys[i],sp,{fill:"none",stroke:ac,"stroke-width":0.15,"stroke-linecap":"round"}); }
    }
    /* the ledger lines this head needs */
    const above=Math.round((top-ys[i])/(sp/2)), below=Math.round((ys[i]-(top+4*sp))/(sp/2));
    for(let k=2;k<=above;k+=2) el("line",{x1:gx-sp*0.95,y1:top-k*sp/2,x2:gx+sp*0.95,y2:top-k*sp/2,stroke:col,"stroke-width":sp*0.1},svg);
    for(let k=2;k<=below;k+=2) el("line",{x1:gx-sp*0.95,y1:top+4*sp+k*sp/2,x2:gx+sp*0.95,y2:top+4*sp+k*sp/2,stroke:col,"stroke-width":sp*0.1},svg);
  });

  /* the stem: one for the whole column, from the far head to a length of three spacings and a half */
  if(!whole&&c.dur<4){
    const yTop=Math.min(...ys), yBot=Math.max(...ys);
    const sx=dir<0?x+rx*0.92:x-rx*0.92;
    const yEnd=dir<0?yTop-3.3*sp:yBot+3.3*sp;
    const line=el("line",{x1:sx,y1:dir<0?yBot:yTop,x2:sx,y2:yEnd,stroke:col,"stroke-width":sp*0.13},svg);
    c._stemX=sx; c._stemEnd=yEnd; c._dir=dir; c._col=col; c._stemLine=line;
    if(!inGroup&&c.dur<=0.5){                                   // a flag, when no beam carries it
      const n=c.dur<=0.25?2:1;
      for(let k=0;k<n;k++){
        const yy=yEnd+(dir<0?k*0.78*sp:-k*0.78*sp);
        el("path",{d:dir<0
            ? `M ${sx} ${yy} C ${sx+sp*1.15} ${yy+sp*0.85} ${sx+sp*0.95} ${yy+sp*1.75} ${sx+sp*0.35} ${yy+sp*2.15} C ${sx+sp*0.95} ${yy+sp*1.35} ${sx+sp*0.85} ${yy+sp*0.75} ${sx} ${yy+sp*0.55} Z`
            : `M ${sx} ${yy} C ${sx+sp*1.15} ${yy-sp*0.85} ${sx+sp*0.95} ${yy-sp*1.75} ${sx+sp*0.35} ${yy-sp*2.15} C ${sx+sp*0.95} ${yy-sp*1.35} ${sx+sp*0.85} ${yy-sp*0.75} ${sx} ${yy-sp*0.55} Z`,
            fill:col},svg);
      }
    }
    /* a grace note carries its own little stem and slash */
    for(let i=0;i<notes.length;i++) if(notes[i].grace){
      const gx=x-sp*1.15, gy=ys[i];
      el("line",{x1:gx+rx*0.6,y1:gy,x2:gx+rx*0.6,y2:gy-2.1*sp,stroke:col,"stroke-width":sp*0.1},svg);
      el("line",{x1:gx+rx*0.1,y1:gy-1.25*sp,x2:gx+rx*1.5,y2:gy-1.95*sp,stroke:col,"stroke-width":sp*0.1},svg);
    }
  }
  /* the dot of a dotted note */
  const base=c.dur/1.5;
  if(Math.abs(Math.log2(base)-Math.round(Math.log2(base)))<0.02&&c.dur>0.3){
    notes.forEach((n,i)=>{ const yy=ys[i]; const onLine=Math.abs(((yy-top)/(sp/2))%2)<0.01;
      el("circle",{cx:x+rx+sp*0.52,cy:onLine?yy-sp*0.5:yy,r:sp*0.15,fill:col},svg); });
  }
}

function drawRest(svg,kind,x,top,sp,col){
  if(kind==="whole") el("rect",{x:x-sp*0.6,y:top+sp,width:sp*1.2,height:sp*0.48,fill:col},svg);
  else if(kind==="half") el("rect",{x:x-sp*0.6,y:top+sp*1.52,width:sp*1.2,height:sp*0.48,fill:col},svg);
  else if(kind==="eighth") glyph(svg,G.eighthRest,x-sp*0.3,top+sp*1.35,sp,{fill:col});
  else glyph(svg,G.quarterRest,x,top+sp*0.75,sp,{fill:col,stroke:col,"stroke-width":0.1,"stroke-linejoin":"round"});
}

const api={draw,yOf,barPlan};
if(typeof module!=="undefined"&&module.exports) module.exports=api; else root.Engrave=api;
})(typeof window!=="undefined"?window:globalThis);
