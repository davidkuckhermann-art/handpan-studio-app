/* score-reader.js — reads engraved staff notation from a bitmap.
   7–8 Sep 2026, benched on seven of David's screenshots (bench/score/). Loaded by reader.html, the
   HPD Notation Import Tool, as its fourth picture kind — see SCORE-IMPORT.md. Not used by app.html.

   ONE MECHANISM: every measurement is a multiple of the staff spacing `sp`
   (the distance between two staff lines), found first and used everywhere.
   Nothing is a pixel constant. The reader is deterministic and says what it
   is unsure of (`q` on a bar or a column) instead of guessing silently.

   Input:  {w, h, gray: Uint8Array|Uint8ClampedArray}   0 = black … 255 = white
   Output: readScore() → {
     sp, ink, systems:[{staffs:[{clef, key, lines, x0, x1}], bars:[{x0,x1}]}],
     bars:[{n, sysIndex, staffs:[{clef, cols:[{x, onset, dur, notes:[{midi,name,step,q}], rest, q}], total, q}], q}],
     meter:{beats}, key:{fifths}, notes:[…every head with its pitch…], log:[…] }

   Runs in a browser (the bench) or in node with a decoded bitmap. No dependencies. */
(function(root){
"use strict";

/* ─────────────────────────── small tools ─────────────────────────── */
const med=a=>{ if(!a.length) return 0; const s=[...a].sort((p,q)=>p-q); return s[s.length>>1]; };
const NAMES=["C","C♯","D","E♭","E","F","F♯","G","A♭","A","B♭","B"];
const STEP_PC=[0,2,4,5,7,9,11];                       // C D E F G A B
const noteName=m=>NAMES[((m%12)+12)%12]+(Math.floor(m/12)-1);

/* threshold: halfway between the paper's grey and the ink's — so grey staff
   lines (the Canon scan prints them at ~110) count as ink and anti-aliasing
   does not */
function binarize(img){
  const {w,h,gray}=img, n=w*h;
  const hist=new Uint32Array(256); for(let i=0;i<n;i++) hist[gray[i]]++;
  let paper=255,best=0; for(let v=128;v<256;v++) if(hist[v]>best){best=hist[v];paper=v;}
  let inkSum=0,inkN=0; for(let v=0;v<128;v++){ inkSum+=v*hist[v]; inkN+=hist[v]; }
  const inkMode=inkN?inkSum/inkN:0;
  /* two thresholds: the LIGHT one (three quarters of the way to the paper) sees grey hairlines — staff lines,
     bar lines — and closes the rim of a hollow head; the MIDPOINT one keeps symbol shapes true to size */
  const T=Math.round((paper+inkMode)/2), TL=Math.round(paper-0.25*(paper-inkMode));
  const ink=new Uint8Array(n), inkL=new Uint8Array(n);
  for(let i=0;i<n;i++){ const g=gray[i]; ink[i]=g<T?1:0; inkL[i]=g<TL?1:0; }
  return {ink,inkL,T,TL,paper};
}

/* ─────────────────────────── staff lines ─────────────────────────── */
/* a staff line is a row whose LONGEST run of ink is at least 40 % of the
   image width; consecutive such rows are one line; five lines at one spacing
   are a staff */
function longestRun(ink,w,y){
  let best=0,run=0,bx=0,x0=0;
  for(let x=0;x<w;x++){ if(ink[y*w+x]){ if(!run) x0=x; run++; if(run>best){best=run;bx=x0;} } else run=0; }
  return {len:best,x0:bx};
}
function findStaffs(ink,w,h,log){
  const rows=[];
  for(let y=0;y<h;y++){
    let n=0,x0=-1,x1=-1; const row=y*w;
    for(let x=0;x<w;x++) if(ink[row+x]){ n++; if(x0<0) x0=x; x1=x; }
    if(n>0.4*w) rows.push({y,x0,x1});
  }
  const lines=[];
  for(const r of rows){
    const L=lines[lines.length-1];
    if(L&&r.y-L.yb<=1){ L.yb=r.y; L.rows.push(r); }
    else lines.push({ya:r.y,yb:r.y,rows:[r]});
  }
  for(const L of lines){ L.y=(L.ya+L.yb)/2; L.th=L.yb-L.ya+1; L.x0=med(L.rows.map(r=>r.x0)); L.x1=med(L.rows.map(r=>r.x1)); }
  // groups of five at one spacing
  const staffs=[]; let i=0;
  while(i+4<lines.length){
    const g=lines.slice(i,i+5); const gaps=[]; for(let k=1;k<5;k++) gaps.push(g[k].y-g[k-1].y);
    const sp=med(gaps); const even=gaps.every(d=>Math.abs(d-sp)<0.2*sp) && sp>2*med(g.map(l=>l.th));   // a small scan draws 3–4 px lines 12 px apart
    if(even){ staffs.push({lines:g.map(l=>l.y),sp,th:med(g.map(l=>l.th)),x0:Math.min(...g.map(l=>l.x0)),x1:Math.max(...g.map(l=>l.x1))}); i+=5; }
    else i++;
  }
  log.push(`${lines.length} long lines → ${staffs.length} staffs`);
  return staffs;
}

/* remove the staff lines: a pixel on a line row stays only when the ink
   through it continues past the line's band on either side (a symbol
   crossing the line); a bare line vanishes */
function removeLines(ink,w,h,staffs){
  const sym=new Uint8Array(ink);
  for(const st of staffs){
    const half=Math.ceil(st.th/2)+1;
    const rows=st.lines.slice(); for(let k=1;k<=4;k++){ rows.push(st.lines[0]-k*st.sp); rows.push(st.lines[4]+k*st.sp); }   // ledger rows
    for(const ly of rows){
      const ya=Math.max(0,Math.round(ly)-half), yb=Math.min(h-1,Math.round(ly)+half);
      for(let x=0;x<w;x++){
        let inkHere=false; for(let y=ya;y<=yb;y++) if(ink[y*w+x]){inkHere=true;break;}
        if(!inkHere) continue;
        const above=ya-2>=0&&(ink[(ya-1)*w+x]||ink[(ya-2)*w+x]);
        const below=yb+2<h&&(ink[(yb+1)*w+x]||ink[(yb+2)*w+x]);
        if(!(above||below)) for(let y=ya;y<=yb;y++) sym[y*w+x]=0;
      }
    }
  }
  return sym;
}

/* ───────────────────── connected components ───────────────────── */
function components(mask,w,h,accept){
  const lab=new Int32Array(w*h); const out=[]; let id=0;
  const stack=[];
  for(let i=0;i<w*h;i++){
    if(!mask[i]||lab[i]) continue;
    id++; lab[i]=id; stack.push(i);
    let x0=w,x1=0,y0=h,y1=0,n=0,sx=0,sy=0;
    while(stack.length){
      const p=stack.pop(); const x=p%w, y=(p-x)/w; n++; sx+=x; sy+=y;
      if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y;
      if(x>0&&mask[p-1]&&!lab[p-1]){lab[p-1]=id;stack.push(p-1);}
      if(x<w-1&&mask[p+1]&&!lab[p+1]){lab[p+1]=id;stack.push(p+1);}
      if(y>0&&mask[p-w]&&!lab[p-w]){lab[p-w]=id;stack.push(p-w);}
      if(y<h-1&&mask[p+w]&&!lab[p+w]){lab[p+w]=id;stack.push(p+w);}
    }
    const c={id,x0,x1,y0,y1,w:x1-x0+1,h:y1-y0+1,n,cx:sx/n,cy:sy/n};
    if(!accept||accept(c)) out.push(c);
  }
  return {comps:out,lab};
}
function erode(mask,w,h,r){          // square (2r+1)
  const out=new Uint8Array(w*h);
  for(let y=r;y<h-r;y++) for(let x=r;x<w-r;x++){
    let ok=1;
    for(let dy=-r;dy<=r&&ok;dy++){ const row=(y+dy)*w; for(let dx=-r;dx<=r;dx++) if(!mask[row+x+dx]){ok=0;break;} }
    out[y*w+x]=ok;
  }
  return out;
}
function holes(ink,w,h){              // white regions not connected to the border
  const white=new Uint8Array(w*h); for(let i=0;i<w*h;i++) white[i]=ink[i]?0:1;
  const seen=new Uint8Array(w*h); const st=[];
  const push=i=>{ if(white[i]&&!seen[i]){seen[i]=1;st.push(i);} };
  for(let x=0;x<w;x++){ push(x); push((h-1)*w+x); }
  for(let y=0;y<h;y++){ push(y*w); push(y*w+w-1); }
  while(st.length){ const p=st.pop(); const x=p%w,y=(p-x)/w;
    if(x>0)push(p-1); if(x<w-1)push(p+1); if(y>0)push(p-w); if(y<h-1)push(p+w); }
  const hol=new Uint8Array(w*h); for(let i=0;i<w*h;i++) hol[i]=white[i]&&!seen[i]?1:0;
  return hol;
}

/* ─────────────────────────── the reading ─────────────────────────── */
function readScore(img,opts){
  opts=opts||{};
  const log=[]; const {w,h}=img;
  const {ink,inkL}=binarize(img);
  const staffs=findStaffs(inkL,w,h,log);
  if(!staffs.length) return {sp:0,systems:[],bars:[],notes:[],meter:{beats:0},key:{fifths:0},log:log.concat(["no staff found"])};
  const sp=med(staffs.map(s=>s.sp));
  const sym=removeLines(ink,w,h,staffs);
  const {comps:symComps,lab:symLab}=components(sym,w,h,c=>c.n>=3);
  const compById=new Map(symComps.map(c=>[c.id,c]));
  const erR=Math.max(1,Math.round(0.27*sp));
  /* a beam is a run of ink at least two spacings long on one row (a sloped beam still is, being thick);
     nothing about a head is that long — so beams are erased before the erosion that finds heads, and a
     head sitting close under its beam keeps its own centre */
  const noBeam=new Uint8Array(sym); const beamLen=Math.round(2*sp);
  for(let y=0;y<h;y++){ let run=0; const row=y*w;
    for(let x=0;x<=w;x++){ if(x<w&&sym[row+x]) run++; else { if(run>=beamLen) for(let k=x-run;k<x;k++){ noBeam[row+k]=0; if(y>0) noBeam[row-w+k]=0; if(y<h-1) noBeam[row+w+k]=0; } run=0; } } }
  const eroded=erode(noBeam,w,h,erR);       // on the line-free, beam-free image
  let hasHeadIn=()=>false;                  // becomes "a stemmed head lies in this box" once the staff's heads are known

  /* systems: staffs whose gap is under 8 sp belong together (a grand staff);
     clef by the height of the tallest symbol at the staff's left edge */
  const systems=[]; let cur=null;
  for(const st of staffs){
    st.top=st.lines[0]; st.bot=st.lines[4];
    /* THE CLEF IS THE UNION OF ITS PIECES (Game of Thrones at 10 px spacing, 9 Sep: the staff lines cut the bass
       clef into three, the biggest piece began too far right and the clef was never found). Everything at the
       staff's left edge that is not the brace (tall and thin) or a system line (hairline), grown rightwards while
       the next piece overlaps or touches the union in x; a key signature stands off by half a spacing or more. */
    const near=symComps.filter(c=>c.y1>st.top-2*sp&&c.y0<st.bot+2*sp&&c.w>0.3*sp&&c.h>0.5*sp&&c.h<9*sp&&!(c.h>5*sp&&c.w<1.6*sp)).sort((a,b)=>a.x0-b.x0);
    let u=null; for(const c of near){ if(c.x0<st.x0-sp) continue; if(!u){ if(c.x0>=st.x0+3*sp) break; u={x0:c.x0,x1:c.x1,y0:c.y0,y1:c.y1,n:c.n}; continue; }
      if(c.x0>u.x1+0.3*sp) break; u.x1=Math.max(u.x1,c.x1); u.y0=Math.min(u.y0,c.y0); u.y1=Math.max(u.y1,c.y1); u.n+=c.n; }
    const tall=u&&u.x1>st.x0+1.4*sp?u:null;
    st.clef=tall&&tall.y1>st.bot+0.8*sp?"t":"b";                       // the treble clef's tail hangs below the staff; the bass clef stays inside
    st.clefX1=tall?tall.x1:st.x0+2.5*sp;
    // top-line diatonic index (C4 = 0): treble top line F5 = 10, bass top line A3 = -2
    st.topIdx=st.clef==="t"?10:-2;
  }
  /* systems: a piano system is two staffs — a treble and the staff under it (a bass, or a treble when the
     left hand climbs). Lyrics between them can widen the gap to 14 sp. A bass never opens a system while a
     treble stands alone above it. */
  for(const st of staffs){
    const prev=cur&&cur.staffs[cur.staffs.length-1];
    /* a treble followed by a bass is one system whatever lies between (five verses of lyrics can push
       the bass 20 sp down); two trebles pair only when close */
    if(cur&&cur.staffs.length<2&&((prev.clef==="t"&&st.clef==="b")||(st.top-prev.bot<14*sp&&!(prev.clef==="b"&&st.clef==="t")))){ cur.staffs.push(st); st.lower=true; }
    else { cur={staffs:[st]}; systems.push(cur); }
  }
  /* heads first, from the clef on — so the signature steps can tell a note from a glyph */
  for(const sys of systems) for(const st of sys.staffs){
    st._eroded=eroded; st._erR=erR; st._inkL=inkL; st._sym=sym; st._w=w; st._compById=compById; st.keyX1=st.clefX1; st.heads=findHeads(ink,sym,symLab,symComps,w,h,st,sp,log);
    for(const hd of st.heads) readStem(hd,sym,w,h,sp,st);
  }
  /* key signature: accidentals right after the clef, glyphs 2–3.4 sp tall */
  for(const sys of systems) for(const st of sys.staffs){
    /* THE SIGNATURES BY COLUMN PROFILE. Right of the clef, every column's ink within the staff band is
       counted; runs of inked columns are objects. An accidental is an object 0.5–1.4 sp wide and 1.9–3.6 sp
       tall whose profile shows vertical strokes (two for a sharp, one for a flat); touching accidentals make
       one wider object, split by width. The signature ends at the first object that is not one. A time
       signature is the object after it that spans the staff top to bottom; the music starts after that. */
    const r=readSignatures(st,sym,w,sp);
    st.keyFifths=r.fifths; st.keyGlyphs=r.glyphs; st.timeGlyphs=r.timeSig?[r.timeSig]:[]; st.hasTimeSig=!!r.timeSig; st.keyX1=r.x1;
    st._sig=r;
  }
  /* the staffs that carry a time signature bound their key signature exactly; every other staff of the same
     clef takes that reading and that width (a key signature is repeated on every system, a time signature is not) */
  const ref={}; for(const sys of systems) for(const st of sys.staffs) if(st.hasTimeSig&&!ref[st.clef]) ref[st.clef]={fifths:st.keyFifths,width:st.keyX1-st.clefX1,sigWidth:(st.keyGlyphs.length?st.keyGlyphs[st.keyGlyphs.length-1].x1:st.clefX1)-st.clefX1};
  for(const sys of systems) for(const st of sys.staffs) if(!st.hasTimeSig&&ref[st.clef]){ st.keyFifths=ref[st.clef].fifths; st.keyX1=st.clefX1+ref[st.clef].sigWidth; }
  const fifths=modeOf(systems.flatMap(s=>s.staffs.map(st=>st.keyFifths)));
  const keyAcc=keyAccidentals(fifths);          // step → ±1
  log.push(`sp ${sp.toFixed(2)} · ${systems.length} systems · key ${fifths>0?fifths+"♯":fifths<0?(-fifths)+"♭":"C"}`);

  /* bar lines: thin columns of ink covering a staff top to bottom, with no
     note head beside them (a stem is beside a head; a bar line is not) */
  const headsAll=[];
  for(const sys of systems){
    for(const st of sys.staffs){
      st.heads=st.heads.filter(hd=>hd.x>st.keyX1+0.3*sp);                                               // nothing inside the signatures is a note
      /* a stemless hollow far outside the staff is text — unless a LEDGER LINE runs through or beside it, which
         makes it a whole note (Wellerman, 9 Sep: the E2 under the bass staff) */
      const ledger=hd=>{ const x=Math.round(hd.x); for(let y=Math.round(hd.y-0.6*sp);y<=Math.round(hd.y+0.6*sp);y++){ if(y<0||y>=h||!ink[y*w+x]) continue; let a=x,b=x; while(a>0&&ink[y*w+a-1]) a--; while(b<w-1&&ink[y*w+b+1]) b++; const run=b-a+1; if(run>=1.4*sp&&run<=3.2*sp) return true; } return false; };
      st.heads=st.heads.filter(hd=>!(hd.hollow&&!hd.stem&&(hd.y<st.top-1.2*sp||hd.y>st.bot+1.2*sp)&&!ledger(hd)));
      headsAll.push(...st.heads);
    }
    sys.bars=findBarLines(inkL,w,h,sys,sp);
  }
  for(const sys of systems) for(const st of sys.staffs){ st.heads=st.heads.filter(hd=>!hd.fake); findDots(st,symComps,sp,sys.bars); findAccidentals(st,symComps,sp,sym,w); }

  /* columns and onsets per staff per bar */
  const bars=[]; let n=0; const sectionCuts=[];
  for(const sys of systems){
    for(let bi=0;bi<sys.bars.length-1;bi++){
      const bx0=sys.bars[bi], bx1=sys.bars[bi+1]; n++;
      if(sys.wideBars&&sys.wideBars.some(x=>Math.abs(x-bx1)<0.5*sp)&&bi<sys.bars.length-2) sectionCuts.push(n);   // the bar ends at a double bar
      const bar={n,sysIndex:systems.indexOf(sys),x0:bx0,x1:bx1,staffs:[],q:false};
      for(const st of sys.staffs){
        const heads=st.heads.filter(hd=>hd.x>bx0&&hd.x<bx1&&hd.dur).sort((a,b)=>a.x-b.x);
        const rests=findRests(st,symComps,sp,bx0,bx1,heads);
        const items=heads.map(hd=>({x:hd.x,head:hd})).concat(rests.map(r=>({x:r.x,rest:r})));
        items.sort((a,b)=>a.x-b.x);
        const cols=[];
        for(const it of items){
          const C=cols[cols.length-1];
          if(C&&it.x-C.xLast<0.45*sp&&!it.rest&&!C.rest){ C.heads.push(it.head); C.xLast=Math.max(C.xLast,it.x); }
          else cols.push({x:it.x,xLast:it.x,heads:it.head?[it.head]:[],rest:it.rest||null});
        }
        /* TIES: a head of the same pitch in the next column, joined by an arc — a thin curved symbol spanning the
           gap just above or below the heads — continues the note: it sounds once (David, 8 Sep). The second
           column loses that head; if it held nothing else, its time goes to the first. */
        for(let i=0;i+1<cols.length;i++){
          const A=cols[i], B=cols[i+1]; if(A.rest||B.rest) continue;
          for(const ha of A.heads){ const hb=B.heads.find(x=>x.step===ha.step&&x.acc===ha.acc); if(!hb) continue;
            const gap=hb.x-ha.x; const yLo=Math.min(ha.y,hb.y)-1.8*sp, yHi=Math.max(ha.y,hb.y)+1.8*sp;
            const arc=symComps.find(c=>c.x0>ha.x-0.6*sp&&c.x1<hb.x+0.6*sp&&c.w>=0.55*gap&&c.h<=1.3*sp&&c.h>=0.15*sp&&c.cy>yLo&&c.cy<yHi
                                     &&c.n/(c.w*c.h)<0.45&&!(c.x0<=ha.hx1&&c.x1>=ha.hx0&&c.y0<=ha.hy1&&c.y1>=ha.hy0));
            if(arc){ ha.tiedTo=hb; hb.tied=true; } }
        }
        for(const C of cols){ C._origHeads=C.heads; C.heads=C.heads.filter(hd=>!hd.tied); }
        let onset=0;
        for(let i=0;i<cols.length;i++){ const C=cols[i];
          if(!C.rest&&!C.heads.length){ C.empty=true; continue; }               // a column of tied continuations: its time flows to the note before
          C.dur=C.rest?C.rest.dur:Math.min(...C.heads.map(hd=>hd.dur));
          let j=i+1; while(j<cols.length&&!cols[j].rest&&!cols[j].heads.length){ C.dur+=Math.min(...(cols[j]._origHeads||[]).map(hd=>hd.dur).concat([0.5])); j++; }
          C.onset=onset; onset+=C.dur;
          C.notes=C.heads.map(hd=>({midi:hd.midi,name:hd.name,step:hd.step,hollow:hd.hollow,q:!!hd.q,acc:hd.acc})).sort((a,b)=>b.step-a.step);
          C.q=C.heads.some(hd=>hd.q);
          C.x=Math.round(C.x);
        }
        bar.staffs.push({clef:st.clef,cols:cols.filter(c=>!c.empty),total:onset});
      }
      bars.push(bar);
    }
  }
  /* the meter is what most bars add up to; a bar that does not is uncertain */
  const plain=bars.flatMap(b=>b.staffs.filter(s=>!s.cols.some(c=>c.rest&&c.rest.kind==="whole")).map(s=>s.total)).filter(t=>t>0);
  const beats=plain.length?modeOf(plain.map(t=>Math.round(t*4)/4)):4;
  for(const b of bars) for(const s of b.staffs){ let t=0; for(const c of s.cols){ if(c.rest&&c.rest.kind==="whole") c.dur=beats; c.onset=t; t+=c.dur; } s.total=t; }
  for(const b of bars){ for(const s of b.staffs){ s.q=s.cols.length>0&&Math.abs(s.total-beats)>0.01; if(s.total===0) s.empty=true; }
    b.q=b.staffs.some(s=>s.q||s.cols.some(c=>c.q)); }
  const notes=headsAll.map(hd=>({x:Math.round(hd.x),y:Math.round(hd.y),midi:hd.midi,name:hd.name,dur:hd.dur,hollow:hd.hollow,q:!!hd.q,clef:hd.clef}));
  log.push(`${notes.length} heads · ${bars.length} bars · meter ${beats} beats · ${bars.filter(b=>b.q).length} bars uncertain${sectionCuts.length?` · sections end after bar ${sectionCuts.join(", ")}`:""}`);
  const tempo=readTempo(staffs[0],symComps,ink,w,sp); if(tempo) log.push(`tempo ♩ = ${tempo.bpm}`);
  return {tempo,sp,w,h,systems:systems.map(s=>({staffs:s.staffs.map(st=>({clef:st.clef,lines:st.lines,x0:st.x0,x1:st.x1,key:st.keyFifths})),bars:s.bars})),
          bars,sectionCuts,meter:{beats},key:{fifths},notes,log,
          _debug:opts.debug?{ink,sym,staffs,systems}:undefined};
}

function modeOf(a){ const m=new Map(); let best=null; for(const v of a){ m.set(v,(m.get(v)||0)+1); if(best===null||m.get(v)>m.get(best)) best=v; } return best; }


/* signatures by column profile — see the call site */
function readSignatures(st,sym,w,sp){
  const xa=Math.round(st.clefX1+1), xb=Math.min(w-1,Math.round(st.clefX1+9*sp));
  const ya=Math.max(0,Math.round(st.top-1.6*sp)), yb=Math.round(st.bot+1.6*sp);
  const cols=[],tops=[],bots=[];
  for(let x=xa;x<=xb;x++){ let n=0,t=-1,b=-1; for(let y=ya;y<=yb;y++) if(sym[y*w+x]){ n++; if(t<0)t=y; b=y; } cols.push(n); tops.push(t); bots.push(b); }
  // objects: runs of inked columns, gaps under 0.2 sp bridged
  const objs=[]; let cur=null,gap=0;
  for(let i=0;i<cols.length;i++){
    if(cols[i]){ if(!cur) cur={i0:i,i1:i}; cur.i1=i; gap=0; }
    else if(cur){ if(++gap>=0.2*sp){ objs.push(cur); cur=null; } }
  }
  if(cur) objs.push(cur);
  const measure=(i0,i1)=>{ let t=1e9,b=-1,strokes=0,inStroke=false,rightTall=false;
    for(let i=i0;i<=i1;i++){ if(tops[i]>=0){ t=Math.min(t,tops[i]); b=Math.max(b,bots[i]); }
      const tall=cols[i]>=1.8*sp; if(tall&&!inStroke) strokes++; inStroke=tall;
      if(tall&&i>i0+0.55*(i1-i0)) rightTall=true; }
    return {x0:xa+i0,x1:xa+i1,w:i1-i0+1,top:t,bot:b,h:b-t+1,strokes,sharp:rightTall}; };
  let glyphs=[], sharps=0,flats=0,x1=st.clefX1,timeSig=null;
  const isTime=m=>{ if(!(Math.abs(m.top-st.top)<0.6*sp&&Math.abs(m.bot-st.bot)<0.6*sp&&m.h>3.3*sp&&m.w>=0.7*sp&&m.w<2.6*sp)) return false;
    let wide=0; for(let y=m.top;y<=m.bot;y++){ let a=-1,b=-1; for(let x=m.x0;x<=m.x1;x++) if(sym[y*w+x]){ if(a<0)a=x; b=x; } if(b-a+1>=0.5*sp) wide++; }
    return wide/m.h>0.7; };
  /* THE SIGNATURE IS ONE GROUP (9 Sep, Game of Thrones at 10 px spacing: two flats fused into one object 1.3 sp wide
     and 4.4 sp tall that was neither "one accidental" nor "touching accidentals", so a 3-flat key read as C):
     the run of objects hugging the clef, each starting within half a spacing of the last, ended by the time
     signature or a gap. Its accidentals are counted as tall strokes over the whole span — one per flat, two per
     sharp — and told apart by how many strokes a spacing of width carries. */
  const group=[]; let gx1=-1;
  for(const o of objs){ const m=measure(o.i0,o.i1);
    if(isTime(m)) break;
    if(!group.length){ if(m.x0-st.clefX1>1.6*sp) break; if(m.w<0.5*sp||m.h<1.9*sp) continue; group.push(m); gx1=m.x1; continue; }
    if(m.x0-gx1>(m.h<1.9*sp?0.3:0.5)*sp) break;
    group.push(m); gx1=m.x1; }
  if(group.length){
    const gx0=group[0].x0, top=Math.min(...group.map(m=>m.top)), bot=Math.max(...group.map(m=>m.bot));
    if(bot-top+1<=5.2*sp){
      const spans=[]; let cur=null;
      for(let x=gx0;x<=gx1;x++){ const tall=cols[x-xa]>=1.8*sp; if(tall){ if(cur) cur.x1=x; else cur={x0:x,x1:x}; } else if(cur){ spans.push(cur); cur=null; } }
      if(cur) spans.push(cur);
      const W=gx1-gx0+1, n=spans.length, byWidth=Math.max(1,Math.round(W/sp));
      const sharpish=n>=1.6*byWidth;
      const count=Math.min(7,sharpish?Math.round(n/2):n);
      if(count>0){ if(sharpish) sharps=count; else flats=count; x1=gx1;
        for(let k=0;k<count;k++) glyphs.push(measure(gx0-xa+Math.floor(k*W/count),gx0-xa+Math.floor((k+1)*W/count)-1)); }
    } }
  // the time signature: the next object spanning the staff, wide over most of its height
  const after=objs.find(o=>xa+o.i0>x1+0.2*sp);
  if(after){ const m=measure(after.i0,after.i1); if(isTime(m)){ timeSig=m; x1=m.x1; } }
  const fifths=sharps>=flats?sharps:-flats;
  return {fifths,glyphs,timeSig,x1,objs:objs.map(o=>measure(o.i0,o.i1))};
}

/* a sharp has two uprights, so its top row band is inked across most of its
   width; a flat's top is one thin stem */
function accidentalKind(c,sym,w,sp){
  // the glyph's own top within its box (a slice of a merged group starts lower than the group)
  let top=c.y0; outer: for(let y=c.y0;y<=c.y1;y++){ for(let x=c.x0;x<=c.x1;x++) if(sym[y*w+x]){ top=y; break outer; } }
  const band=Math.max(1,Math.round((c.y1-top+1)*0.12)); let inkW=0;
  for(let y=top;y<top+band;y++){ let x0=-1,x1=-1; for(let x=c.x0;x<=c.x1;x++) if(sym[y*w+x]){ if(x0<0)x0=x; x1=x; } if(x0>=0) inkW=Math.max(inkW,x1-x0+1); }
  return inkW>0.5*c.w?"sharp":"flat";
}
function keyAccidentals(f){           // diatonic step (0=C…6=B) → semitone shift
  const acc=[0,0,0,0,0,0,0];
  const sharps=[3,0,4,1,5,2,6], flats=[6,2,5,1,4,0,3];   // F C G D A E B / B E A D G C F
  if(f>0) for(let i=0;i<f;i++) acc[sharps[i]]=1;
  if(f<0) for(let i=0;i<-f;i++) acc[flats[i]]=-1;
  return acc;
}

/* ─────────────────────────── heads ─────────────────────────── */
function findHeads(ink,sym,symLab,symComps,w,h,st,sp,log){
  const heads=[];
  const yTop=st.top-(st.lower?2.5:3.2)*sp, yBot=st.bot+3.2*sp, xMin=st.keyX1+0.3*sp;
  /* filled heads survive an erosion of 0.4 sp; stems, lines and beams do not */
  const r=st._erR; const er=st._eroded;
  const {comps:fc0,lab:flab}=components(er,w,h,c=>c.cy>yTop&&c.cy<yBot&&c.x0>xMin&&c.w>0.25*sp&&c.w<1.5*sp&&c.h>0.1*sp&&c.h<3.3*sp);
  /* STACKED HEADS A SECOND OR THIRD APART erode to cores joined by a thread (Game of Thrones at 10 px spacing: the
     accented D4+B♭3 chord became one blob 1.5 sp tall and was no head at all). A core taller than a head is cut
     at its waists — rows a third as wide as its widest — into the heads it holds; without a waist it is not a head. */
  const fc=[];
  for(const c of fc0){ if(c.h<=1.1*sp){ fc.push(c); continue; }
    const rows=[]; for(let y=c.y0;y<=c.y1;y++){ let n=0,xa=w,xb=-1; for(let x=c.x0;x<=c.x1;x++) if(flab[y*w+x]===c.id){ n++; if(x<xa)xa=x; if(x>xb)xb=x; } rows.push({y,n,xa,xb}); }
    const maxW=Math.max(...rows.map(r=>r.n)); const segs=[]; let seg=null;
    for(const r of rows){ if(r.n<=Math.max(1,0.34*maxW)){ if(seg){ segs.push(seg); seg=null; } continue; }
      if(!seg) seg={y0:r.y,y1:r.y,x0:r.xa,x1:r.xb,n:0,sx:0,sy:0}; seg.y1=r.y; seg.x0=Math.min(seg.x0,r.xa); seg.x1=Math.max(seg.x1,r.xb); seg.n+=r.n; seg.sx+=r.n*(r.xa+r.xb)/2; seg.sy+=r.n*r.y; }
    if(seg) segs.push(seg);
    if(segs.length<2) continue;
    for(const g of segs){ const hh=g.y1-g.y0+1; if(hh<0.15*sp||hh>1.1*sp) continue; fc.push({x0:g.x0,x1:g.x1,y0:g.y0,y1:g.y1,w:g.x1-g.x0+1,h:hh,n:g.n,cx:g.sx/g.n,cy:g.sy/g.n}); } }
  for(const c of fc){
    // an eroded head is the core of the head: widen the box back by r, and ask whether the box is really a head's ink
    const hx0=c.x0-r,hx1=c.x1+r,hy0=c.y0-r,hy1=c.y1+r; let n=0,k=0;
    for(let y=Math.max(0,hy0);y<=Math.min(h-1,hy1);y++) for(let x=Math.max(0,hx0);x<=Math.min(w-1,hx1);x++){ k++; n+=sym[y*w+x]; }
    if(n/k<0.62){ (st._fillLog=st._fillLog||[]).push({x:Math.round(c.cx),y:Math.round(c.cy),fill:+(n/k).toFixed(2)}); continue; }
    heads.push({x:c.cx,y:c.cy,hx0,hx1,hy0,hy1,hollow:false});
  }
  /* hollow heads are enclosed holes of head proportions; a staff line through
     one splits it in two, so twin holes at one x merge */
  if(!st._holes) st._holes=holes(ink,w,h);        // the midpoint image: a small hollow head (12 px spacing) keeps its hole open there
  /* a white sliver between a stem, a head and two staff lines is a filled rectangle whose top and bottom ARE
     staff (or ledger) lines; a head's hole is an ellipse and touches at most one line */
  const lineRows=st.lines.slice(); for(let k=1;k<=4;k++){ lineRows.push(st.lines[0]-k*sp); lineRows.push(st.lines[4]+k*sp); }
  const onLine=y=>lineRows.some(ly=>Math.abs(y-ly)<0.12*sp+1);
  const longRun=(y,xm)=>{ if(y<0||y>=h||!ink[y*w+xm]) return false; let a=xm,b=xm; while(a>0&&ink[y*w+a-1]) a--; while(b<w-1&&ink[y*w+b+1]) b++; return b-a+1>=1.6*sp; };
  const sideRun=(y,x,dir)=>{ let n=0; x+=dir; while(x>=0&&x<w&&ink[y*w+x]){ n++; x+=dir; } return n; };
  /* a WHOLE NOTE IN A SPACE touches the lines above and below too (Wellerman, 9 Sep: every whole note and every
     stacked whole-note chord was thrown out as a sliver): the sliver has a STEM at its side — a vertical run
     reaching beyond the hole both ways — the whole note only its rim, a spacing tall */
  const stemBeside=c=>{ const ya=Math.round(c.y0-0.4*sp), yb=Math.round(c.y1+0.4*sp);
    for(const x of [c.x0-1,c.x0-2,c.x0-3,c.x1+1,c.x1+2,c.x1+3]){ if(x<0||x>=w) continue; let ok=true; for(let y=Math.max(0,ya);y<=Math.min(h-1,yb)&&ok;y++) if(!ink[y*w+x]&&!(x>0&&ink[y*w+x-1])&&!(x<w-1&&ink[y*w+x+1])) ok=false; if(ok) return true; }
    return false; };
  const sliver=c=>{ const fill=c.n/(c.w*c.h); const xm=Math.round(c.cx), ym=Math.round(c.cy);
    const up=longRun(c.y0-1,xm)||longRun(c.y0-2,xm), down=longRun(c.y1+1,xm)||longRun(c.y1+2,xm);
    if(fill>0.7&&up&&down&&stemBeside(c)) return true;                                    // a rectangle between two lines, beside a stem
    if(fill>0.5&&(sideRun(ym,c.x0,-1)>=1.0*sp||sideRun(ym,c.x1,1)>=1.0*sp)) return true;    // a wedge open into a line or a beam; a head's rim is short
    return false; };
  const {comps:hc}=components(st._holes,w,h,c=>{ if(c.cy>yTop&&c.cy<yBot&&c.x0>xMin) (st._holeRaw=st._holeRaw||[]).push({x:Math.round(c.cx),y:Math.round(c.cy),w:c.w,h:c.h,fill:+(c.n/(c.w*c.h)).toFixed(2),sliver:sliver(c)});
    return c.cy>yTop&&c.cy<yBot&&c.x0>xMin&&c.w>=0.3*sp&&c.w<1.3*sp&&c.h>0.08*sp&&c.h<0.9*sp&&!sliver(c); });
  hc.sort((a,b)=>a.cx-b.cx);
  const used=new Set();
  for(let i=0;i<hc.length;i++){
    if(used.has(i)) continue;
    let c=hc[i]; let box={x0:c.x0,x1:c.x1,y0:c.y0,y1:c.y1};
    for(let j=i+1;j<hc.length;j++){
      const d=hc[j]; if(used.has(j)) continue;
      if(Math.abs(d.cx-c.cx)<0.6*sp&&Math.min(Math.abs(d.y0-c.y1),Math.abs(c.y0-d.y1))<0.45*sp&&d.h<0.5*sp&&c.h<0.5*sp){ used.add(j);   // halves are short; whole holes stacked a third apart are two heads
        box.x0=Math.min(box.x0,d.x0); box.x1=Math.max(box.x1,d.x1); box.y0=Math.min(box.y0,d.y0); box.y1=Math.max(box.y1,d.y1); }
    }
    const members=new Set([c]); for(const j of used) if(hc[j]&&Math.abs(hc[j].cx-c.cx)<0.6*sp&&hc[j].cy>=box.y0-1&&hc[j].cy<=box.y1+1) members.add(hc[j]);
    const bw=box.x1-box.x0+1, bh=box.y1-box.y0+1;
    const bhEff=members.size>1?[...members].reduce((n,m)=>n+m.h,0):bh;                     // two halves across a staff line: the line's rows are not hole
    const trace=(why)=>{ (st._holeLog=st._holeLog||[]).push({x:Math.round((box.x0+box.x1)/2),y:Math.round((box.y0+box.y1)/2),w:bw,h:bh,why}); };
    if(bw/bhEff<0.7||bh>0.95*sp||bh<0.3*sp){ trace("shape"); continue; }     // letters and digits are taller; a pocket under a beam is thinner
    /* WHAT STANDS RIGHT BESIDE THE HOLE IS THE HEAD'S RIM — short, since a rim is curved: the ink in the column
       next to the hole runs no taller than 1.3 sp. A bar line there (the paper between a bar line, two staff
       lines and the next glyph — Tchaikovsky's half notes hard after the line, Game of Thrones' tie pockets) or a
       letter's upright (the Canon's chord symbol) runs on. A stem stands outside the rim, not against the hole;
       stacked whole notes' rims meet only at their outer edge. */
    { const cyw=Math.round((box.y0+box.y1)/2);
      /* a stem can stand against the hole too (a down-stem is flush with the head's left edge), a chord's stem
         runs past a head both ways, and a half note in the lowest space sends its stem exactly to the top line
         (Amazing Grace) — so the wall is known as a JOINED bar line: it covers this staff and runs on into the
         next, four spacings and more beyond an outer line, which no stem does. A lone staff's pocket beside a
         bar line is left to the other tests. */
      const wall=x=>{ if(x<0||x>=w||!ink[cyw*w+x]) return false; let a=cyw,b=cyw; while(a>0&&ink[(a-1)*w+x]) a--; while(b<h-1&&ink[(b+1)*w+x]) b++;
        return a<=st.top+0.3*sp&&b>=st.bot-0.3*sp&&(st.top-a>4*sp||b-st.bot>4*sp); };
      if(wall(box.x0-1)||wall(box.x1+1)){ trace("wall"); continue; } }
    /* a ROUND hole is a WHOLE NOTE's, and a whole note's rim is thick — a quarter to two thirds of a spacing on
       each side; the round pocket between a flat's curve and a head (Für Elise) or where a flag leaves its stem
       has thin walls. Measured on the top half's row when a line splits the hole. */
    if(bw/bhEff<1.1){ const top=[...members].reduce((a,m)=>m.y0<a.y0?m:a); const cyr=Math.round((top.y0+top.y1)/2);
      const thick=(x,dir)=>{ let n=0; while(x>=0&&x<w&&ink[cyr*w+x]){ n++; x+=dir; } return n; };
      const l=thick(box.x0-1,-1), r=thick(box.x1+1,1);
      if(l<0.25*sp||l>0.7*sp||r<0.25*sp||r>0.7*sp){ trace("round, thin rim "+l+"/"+r); continue; } }
    /* THE SPACE INSIDE AN ACCIDENTAL: a sharp's or a natural's hole has an upright of accidental length (1.8–3.2 sp,
       measured whole — a stem runs longer) on EACH side; a flat's bowl has one on its left, rising well above the
       hole and ending with it. Read off the light image, so a glyph whose crossbars broke into pieces (Mad World,
       Für Elise) is still one accidental. A hollow head has a rim, a spacing tall, and at most a stem. */
    { const inkL=st._inkL; const cy=Math.round((box.y0+box.y1)/2);
      const upright=(xa,xb)=>{ for(let x=Math.max(0,xa);x<=Math.min(w-1,xb);x++){ if(!inkL[cy*w+x]) continue;
          let l=x,r=x; while(l>0&&inkL[cy*w+l-1]) l--; while(r<w-1&&inkL[cy*w+r+1]) r++; if(r-l+1>0.3*sp) continue;   // an upright is thin; a rim (stacked whole notes make a tall run of rims) is not
          let a=cy,b=cy; while(a>0&&inkL[(a-1)*w+x]) a--; while(b<h-1&&inkL[(b+1)*w+x]) b++; const run=b-a+1; if(run>=1.8*sp&&run<=3.2*sp) return {x,top:a,bot:b}; } return null; };
      const L=upright(box.x0-Math.round(0.7*sp),box.x0-1), Rr=upright(box.x1+1,box.x1+Math.round(0.7*sp));
      if(L&&Rr){ trace("inside an accidental"); continue; }
      if(L&&!Rr&&L.top<box.y0-0.8*sp&&L.bot<box.y1+0.5*sp){ trace("flat bowl"); continue; } }
    /* the lens between two stacked hollow heads has a hole close above AND close below it — half a head
       apart; a head's own hole has its neighbours a whole head apart, if any (a rule by position, not by
       size: at 12 px spacing a real hole is only 3 px tall) */
    { const lensGap=0.65*sp, near=d=>Math.abs(d.cx-(box.x0+box.x1)/2)<0.5*sp;
      const cy=(box.y0+box.y1)/2;
      const others=hc.filter(d=>!members.has(d));
      const above=others.some(d=>near(d)&&cy-d.cy>0.2*sp&&cy-d.cy<lensGap), below=others.some(d=>near(d)&&d.cy-cy>0.2*sp&&d.cy-cy<lensGap);
      if(above&&below){ trace("lens"); continue; } }
    // the hole must sit inside a ring of ink about 0.15–0.35 sp thick
    const ring=Math.round(0.55*sp);
    const ox0=box.x0-ring, ox1=box.x1+ring, oy0=box.y0-ring, oy1=box.y1+ring;
    if(ox0<0||oy0<0||ox1>=w||oy1>=h) continue;
    let ringInk=0,ringN=0;                                     // on the line-free image: a staff line half a spacing away is not the head's ink
    for(let x=ox0;x<=ox1;x++){ ringN+=2; ringInk+=sym[oy0*w+x]+sym[oy1*w+x]; }
    for(let y=oy0;y<=oy1;y++){ ringN+=2; ringInk+=sym[y*w+ox0]+sym[y*w+ox1]; }
    if(ringInk/ringN>0.45){ trace("ring "+(ringInk/ringN).toFixed(2)); continue; }   // a hole deep inside ink (a letter's bowl in bold text) is not a head
    // the head's own outline: is there ink immediately around the hole?
    let edge=0,edgeN=0; const e=Math.max(1,Math.round(0.08*sp));
    { const m=Math.round(bw*0.2); for(let x=box.x0+m;x<=box.x1-m;x++){ edgeN+=2; edge+=st._inkL[(box.y0-e)*w+x]+st._inkL[(box.y1+e)*w+x]; } }
    if(edge/edgeN<0.6){ trace("edge "+(edge/edgeN).toFixed(2)); continue; }
    // text has more letters close on both sides; a note has paper (or one thin stem) beside it
    const side=(xa,xb)=>{ let n=0,k=0; for(let y=box.y0;y<=box.y1;y++) for(let x=xa;x<=xb;x++){ k++; n+=sym[y*w+x]; } return k?n/k:0; };
    const gap=Math.round(0.25*sp), wd=Math.round(0.45*sp);
    const left=side(Math.max(0,box.x0-gap-wd),Math.max(0,box.x0-gap)), right=side(Math.min(w-1,box.x1+gap),Math.min(w-1,box.x1+gap+wd));
    if(left>0.35&&right>0.35){ trace(`text ${left.toFixed(2)}/${right.toFixed(2)}`); continue; }
    trace("kept");
    heads.push({x:(box.x0+box.x1)/2,y:(box.y0+box.y1)/2,hx0:box.x0-e,hx1:box.x1+e,hy0:box.y0-e,hy1:box.y1+e,hollow:true});
  }
  /* pitch from the staff position: half a spacing per step */
  for(const hd of heads){
    const stepsDown=Math.round((hd.y-st.top)/(sp/2));
    const idx=st.topIdx-stepsDown;                              // diatonic index, C4 = 0
    hd.step=idx; hd.clef=st.clef;
    hd.offGrid=Math.abs((hd.y-st.top)/(sp/2)-stepsDown);        // 0 = dead centre, 0.5 = between two positions
    if(hd.offGrid>0.3) hd.q=true;
  }
  // duplicates (a filled head also caught as a hole never happens; two eroded blobs of one head can): keep one per position
  heads.sort((a,b)=>a.x-b.x);
  const out=[];
  for(const hd of heads){ const p=out[out.length-1]; if(p&&Math.abs(p.x-hd.x)<0.3*sp&&p.step===hd.step) continue; out.push(hd); }
  return out;
}

/* the diatonic index → midi, with the key signature and bar accidentals */
function pitchOf(step,keyAcc,barAcc){
  const oct=Math.floor(step/7), deg=((step%7)+7)%7;
  let m=60+12*oct+STEP_PC[deg];
  const a=barAcc&&(step in barAcc)?barAcc[step]:keyAcc[deg];
  return m+a;
}

/* ─────────────────────────── bar lines ─────────────────────────── */
function findBarLines(ink,w,h,sys,sp){
  const st0=sys.staffs[0], stN=sys.staffs[sys.staffs.length-1];
  const heads=sys.staffs.flatMap(s=>s.heads);
  const xStart=Math.max(...sys.staffs.map(s=>s.keyX1))+0.5*sp;
  const cols=[];
  for(let x=Math.max(2,Math.round(xStart));x<w-2;x++){
    // ink must run from the first staff's top line to its bottom line (± 0.3 sp)
    let ok=true;
    for(const st of sys.staffs){
      const ya=Math.round(st.top+0.3*sp), yb=Math.round(st.bot-0.3*sp); let gaps=0;
      for(let y=ya;y<=yb;y++){ const r=y*w+x; if(!ink[r]&&!ink[r-1]&&!ink[r+1]&&!ink[r-2]&&!ink[r+2]) gaps++; }
      if(gaps>0.12*(yb-ya)){ ok=false; break; }
    }
    if(!ok) continue;
    // a bar line stops at the system's outer lines; a stem runs on past them
    { const ya=Math.round(st0.top-0.6*sp), yb=Math.round(stN.bot+0.6*sp); let above=0,below=0;
      for(let y=Math.max(0,ya-Math.round(1.2*sp));y<ya;y++) if(ink[y*w+x]||ink[y*w+x-1]||ink[y*w+x+1]) above++;
      for(let y=yb+1;y<Math.min(h,yb+Math.round(1.2*sp));y++) if(ink[y*w+x]||ink[y*w+x-1]||ink[y*w+x+1]) below++;
      if(above>0.6*sp||below>0.6*sp) continue; }
    // between two staffs a bar line either joins them (ink all the way) or stops at each (no ink beyond half a
    // spacing); a stem reaching into the gap does neither
    { let bad=false;
      for(let k=0;k+1<sys.staffs.length;k++){ const ya=Math.round(sys.staffs[k].bot+0.5*sp), yb=Math.round(sys.staffs[k+1].top-0.5*sp); let n=0,m=0;
        for(let y=ya;y<=yb;y++){ m++; if(ink[y*w+x]||ink[y*w+x-1]||ink[y*w+x+1]) n++; }
        if(m>0&&n/m>0.15&&n/m<0.9) bad=true; }
      if(bad) continue; }
    (sys._cover=sys._cover||[]).push(x);
    /* a HALF-HEIGHT HOLLOW "head" whose box touches this column is a hole against the bar line — the paper between
       a tie's arc, a staff line and the line (Game of Thrones at 10 px spacing, 9 Sep) — and it goes. A real hollow
       head's hole stands 0.8 sp tall with its rim; tight engraving does set real heads right against a bar line,
       so nearness alone says nothing. Any other head within a spacing means this column is a stem. */
    if(heads.some(hd=>Math.abs(hd.x-x)<1.0*sp)) continue;      // a stem beside a head
    cols.push(x);
  }
  // group neighbouring columns; a double bar (two lines within 1.2 sp) is one boundary
  const bars=[]; for(const x of cols){ const B=bars[bars.length-1]; if(B&&x-B.x1<=1.2*sp){ B.x1=x; } else bars.push({x0:x,x1:x}); }
  let xs=bars.map(b=>(b.x0+b.x1)/2);
  // a section ends at a THICK bar line (final and repeat bars carry one): the ink run at the staff's middle row
  const midY=Math.round(st0.lines[1]+sp/2);                            // a row inside a space, not on a line
  const thick=b=>{ let run=0,best=0; for(let x=Math.max(1,Math.round(b.x0-0.3*sp));x<=Math.min(w-2,Math.round(b.x1+0.3*sp));x++){ if(ink[midY*w+x]){ run++; if(run>best) best=run; } else run=0; } return best; };
  const th=bars.map(thick), medTh=med(th);
  sys.wideBars=bars.filter((b,i)=>th[i]>=0.25*sp&&th[i]>=2.2*medTh).map(b=>(b.x0+b.x1)/2);   // thick relative to this system's own bar lines
  // the bar before the first line begins after the key/time signature
  const first=xStart-0.5*sp+0.2*sp;
  if(!xs.length||xs[0]>first+2*sp) xs.unshift(first);
  return xs;
}

/* ─────────────────────────── stems, beams, flags ─────────────────────────── */
function readStem(hd,sym,w,h,sp,st){
  const span=v=>Math.max(0,Math.min(h-1,Math.round(v)));
  let best=null;
  // a stem is a thin vertical run touching the head's left or right edge
  for(const side of [1,-1]){
    for(let k=0;k<=Math.round(0.25*sp)+1;k++){
      const x=side>0?Math.round(hd.hx1)+k-1:Math.round(hd.hx0)-k+1;
      if(x<1||x>=w-1) continue;
      // walk up and down from the head's centre
      let yUp=span(hd.y), yDn=span(hd.y);
      const has=y=>sym[y*w+x]||sym[y*w+x-1]||sym[y*w+x+1];
      let miss=0; for(let y=span(hd.y);y>=0;y--){ if(has(y)){yUp=y;miss=0;} else if(++miss>4) break; }   // a light hairline breaks for a few rows at small sizes
      miss=0; for(let y=span(hd.y);y<h;y++){ if(has(y)){yDn=y;miss=0;} else if(++miss>4) break; }
      const up=hd.hy0-yUp, dn=yDn-hd.hy1;
      const len=Math.max(up,dn);
      if(len>1.8*sp&&(!best||len>best.len)) best={x,len,dir:up>dn?-1:1,yEnd:up>dn?yUp:yDn};
    }
  }
  hd.stem=best;
  if(!best){ hd.dur=hd.hollow?4:0; if(!hd.hollow) hd.q=true; hd.beams=0; return; }   // no stem: whole note, or a filled blob that is not a note
  /* beams and flags: thick ink beside the stem's far end, counted on a scan
     line half a spacing to each side, over the outer 2.5 sp of the stem */
  let beams=0;
  for(const off of [0.55,1.1]) for(const side of [1,-1]){
    const x=Math.round(best.x+side*off*sp); if(x<0||x>=w) continue;
    let runs=0,run=0,onStem=0; const yA=best.yEnd+best.dir*1.0*sp, yB=best.yEnd-best.dir*Math.min(2.5*sp,best.len-1.4*sp);   // from a spacing past the stem's end (a sloping beam sits higher there) toward the head
    const step=-best.dir;                                                   // from the end toward the head, stopping short of the head
    const beamMin=Math.max(0.22*sp,1.3*st.th);   // a beam or a flag is clearly thicker than a staff line; a line kept beside a beam is not
    const close=()=>{ if(run>=beamMin&&onStem>=run*0.5){ runs++; (hd._beamRuns=hd._beamRuns||[]).push([side,run,onStem]); } run=0; onStem=0; };
    for(let y=span(yA);best.dir<0?y<=span(yB):y>=span(yB);y+=step){
      if(sym[y*w+x]){ run++; if(sym[y*w+best.x]||sym[y*w+best.x-1]||sym[y*w+best.x+1]) onStem++; } else close();
    }
    close();
    beams=Math.max(beams,runs);
  }
  hd.beams=Math.min(beams,2);
  hd.dur=hd.hollow?2:beams===0?1:beams===1?0.5:0.25;
}

/* a dot to the right of a head at its height lengthens it by half */
function findDots(st,symComps,sp,barXs){
  const sym=st._sym, w=st._w, h=sym?sym.length/w:0;
  /* the dot as INK AT ITS PLACE, not as a component of its own (Game of Thrones, 9 Sep: a dotted half whose tie
     starts right after the dot fuses dot and arc into one component, and the dot was lost in every tied bar):
     a disc of a fifth of a spacing, somewhere between 0.3 and 1.1 sp right of the head, at the head's row or the
     space beside it, filled over 70 %. An arc or a stem passing through such a disc fills a third of it at most. */
  const dotInk=hd=>{ if(!sym) return 0; const R=Math.max(1,Math.round(0.2*sp)); let best=0;
    const next=st.heads.filter(o=>o!==hd&&o.hx0>hd.hx1&&Math.abs(o.y-hd.y)<1.6*sp).reduce((a,o)=>o.hx0<(a?a.hx0:1e9)?o:a,null);   // the window ends before the next head of the line
    const xEnd=Math.min(Math.round(hd.hx1+1.1*sp),next?Math.round(next.hx0-0.3*sp-R):1e9);
    let edge=hd.hx1; if(hd.hollow){ const Y=Math.round(hd.y); while(edge<w-1&&sym[Y*w+edge+1]) edge++; }   // a hollow head's box is its hole: step out over the rim (a whole note's is 0.4 sp thick)
    for(const yc of [hd.y,hd.y-sp/2,hd.y+sp/2]) for(let x=Math.round(edge+0.3*sp);x<=xEnd;x++){
      if(barXs.some(bx=>Math.abs(bx-x)<0.3*sp)) continue;
      let n=0,k=0; for(let dy=-R;dy<=R;dy++) for(let dx=-R;dx<=R;dx++){ if(dx*dx+dy*dy>R*R) continue; k++; const X=x+dx,Y=Math.round(yc)+dy; if(X>=0&&X<w&&Y>=0&&Y<h) n+=sym[Y*w+X]; }
      if(n/k<=best) continue;
      /* a dot is round: the ink through its centre runs under 0.7 sp both ways — a flag's tail, a stem or a rest
         runs on vertically, a beam or a line's residue horizontally; a tie leaving the dot's side is thin */
      { const Y=Math.round(yc); if(!sym[Y*w+x]) continue; let a=Y,b=Y; while(a>0&&sym[(a-1)*w+x]) a--; while(b<h-1&&sym[(b+1)*w+x]) b++; if(b-a+1>0.7*sp) continue;
        let l=x,r=x; while(l>0&&sym[Y*w+l-1]) l--; while(r<w-1&&sym[Y*w+r+1]) r++; if(r-l+1>0.7*sp) continue; }
      best=n/k; }
    return best; };
  for(const hd of st.heads){
    if(!hd.dur) continue;
    const dot=symComps.find(c=>c.w>0.12*sp&&c.w<0.6*sp&&c.h>0.12*sp&&c.h<0.6*sp
      &&c.x0>hd.hx1+0.1*sp&&c.x0<hd.hx1+1.3*sp&&Math.abs(c.cy-hd.y)<0.7*sp
      &&!barXs.some(bx=>Math.abs(bx-c.cx)<1.2*sp));
    if(dot||dotInk(hd)>0.7) hd.dur*=1.5;
  }
}
/* an accidental immediately left of a head changes that head (and, in a
   full reader, the rest of the bar); the prototype applies it to the head */
function findAccidentals(st,symComps,sp,sym,w){
  /* AN ACCIDENTAL IS ITS TALL STROKES, read off the light image left of the head (Mad World at 11 px spacing,
     9 Sep: a natural's two crossbars fell under the symbol threshold, its uprights were two hairline
     components 0.2 sp wide, and no component looked like an accidental — D♮ came out D♭). A stroke of accidental
     length (1.8–3.2 sp, measured over its whole run: a stem or a bar line runs longer) within 1.3 sp of the head:
     two strokes are a sharp or a natural — a sharp's uprights run together, a natural's start and stop apart —
     one stroke with a bowl (an enclosed hole at its lower right) is a flat; one stroke alone is a grace note or
     a stem, not an accidental. */
  const inkL=st._inkL||sym, h=Math.floor(inkL.length/w);
  for(const hd of st.heads){
    const x0=Math.max(0,Math.round(hd.hx0-1.3*sp)), x1=Math.max(0,Math.round(hd.hx0-0.15*sp));
    const ya=Math.max(0,Math.round(hd.y-6*sp)), yb=Math.min(h-1,Math.round(hd.y+6*sp));       // tall enough that a bar line shows its whole height
    const strokes=[]; let cur=null;
    for(let x=x0;x<=x1;x++){ let run=0,best=0,t=-1,bt=-1; for(let y=ya;y<=yb;y++){ if(inkL[y*w+x]){ if(!run) t=y; run++; if(run>best){ best=run; bt=t; } } else run=0; }
      let ok=best>=1.8*sp&&best<=3.2*sp&&bt<hd.y+1.2*sp&&bt+best>hd.y-1.2*sp;
      /* a stem ends in a head or a beam — ink a spacing wide within the last half spacing of its run; an
         accidental's stroke ends in a crossbar or a bowl, under 0.9 sp */
      if(ok&&st.heads.some(o=>o.y>bt-0.6*sp&&o.y<bt+best+0.6*sp&&(Math.abs(o.hx0-x)<0.35*sp||Math.abs(o.hx1-x)<0.35*sp))) ok=false;   // a stroke at a head's edge is a stem — this head's own, on its left, included
      if(ok){ const wide=y=>{ if(y<0||y>=h||!sym[y*w+x]) return 0; let a=x,b=x; while(a>0&&sym[y*w+a-1]) a--; while(b<w-1&&sym[y*w+b+1]) b++; return b-a+1; };   // on the line-free image: a staff line is not a head
        const half=Math.round(0.5*sp); let mx=0; for(let k=0;k<=half;k++){ mx=Math.max(mx,wide(bt+k),wide(bt+best-1-k)); }
        if(mx>=1.0*sp) ok=false; }
      if(ok){ if(cur&&x-cur.x1<=1){ cur.x1=x; cur.top=Math.min(cur.top,bt); cur.bot=Math.max(cur.bot,bt+best-1); } else { if(cur) strokes.push(cur); cur={x0:x,x1:x,top:bt,bot:bt+best-1}; } }
      else if(cur){ strokes.push(cur); cur=null; } }
    if(cur) strokes.push(cur);
    if(!strokes.length) continue;
    const L=strokes[0], Rt=strokes[strokes.length-1]; const top=Math.min(...strokes.map(o=>o.top)), bot=Math.max(...strokes.map(o=>o.bot)), H=bot-top+1;
    if(Rt.x1-L.x0+1>1.3*sp) continue;                                                     // wider than any accidental
    let acc=null;
    if(strokes.length>=2) acc=(Rt.top-L.top>0.2*H&&Rt.bot-L.bot>0.2*H)?0:1;               // 0 natural · 1 sharp
    else { let hole=false; if(st._holes) for(let y=Math.round(bot-1.3*sp);y<=bot&&!hole;y++) for(let x=L.x1+1;x<=Math.min(w-1,L.x1+Math.round(0.9*sp));x++) if(st._holes[y*w+x]){ hole=true; break; }
      if(hole) acc=-1; }                                                                  // -1 flat
    if(acc===null) continue;
    hd.acc=acc; hd.accInfo={strokes:strokes.length,box:[L.x0,Rt.x1,top,bot]};
    for(const c of symComps) if(c.x0>=L.x0-1&&c.x1<=Rt.x1+Math.round(0.9*sp)&&c.y0>=top-1&&c.y1<=bot+1) c.isAcc=true;   // its components are not rests
  }
}
function strokeSpans(c,sym,w,sp){                                     // the tall strokes with where each begins and ends
  const out=[]; let cur=null;
  for(let x=c.x0;x<=c.x1;x++){ let run=0,best=0,t=-1,bt=-1; for(let y=c.y0;y<=c.y1;y++){ if(sym[y*w+x]){ if(!run) t=y; run++; if(run>best){ best=run; bt=t; } } else run=0; }
    if(best>=1.8*sp){ if(cur){ cur.x1=x; cur.top=Math.min(cur.top,bt); cur.bot=Math.max(cur.bot,bt+best-1); } else cur={x0:x,x1:x,top:bt,bot:bt+best-1}; }
    else if(cur){ out.push(cur); cur=null; } }
  if(cur) out.push(cur); return out; }
function tallStrokes(c,sym,w,sp){ let n=0,inS=false;                 // columns holding one continuous run of at least 1.8 sp
  for(let x=c.x0;x<=c.x1;x++){ let run=0,best=0; for(let y=c.y0;y<=c.y1;y++){ if(sym[y*w+x]){ run++; if(run>best) best=run; } else run=0; }
    const tall=best>=1.8*sp; if(tall&&!inS) n++; inS=tall; }
  return n; }
function hasTallStroke(c,sym,w,sp){                                   // for rests: an accidental's stroke runs the glyph's full height (≥ 2.2 sp); a quarter rest's body does not
  for(let x=c.x0;x<=c.x1;x++){ let run=0,best=0; for(let y=c.y0;y<=c.y1;y++){ if(sym[y*w+x]){ run++; if(run>best) best=run; } else run=0; } if(best>=2.2*sp) return true; }
  return false; }
/* rests: symbols in the bar that are not heads, stems, beams or dots */
function findRests(st,symComps,sp,bx0,bx1,heads){
  const out=[];
  const mid=st.lines[2];
  for(const c of symComps){
    if(c.cx<bx0+0.3*sp||c.cx>bx1-0.3*sp) continue;
    if(heads.some(hd=>c.x0<=hd.hx1+0.3*sp&&c.x1>=hd.hx0-0.3*sp&&c.y0<=hd.hy1+3*sp&&c.y1>=hd.hy0-3*sp)) continue;  // touches a note
    if(c.w>0.8*sp&&c.w<2.0*sp&&c.h>0.3*sp&&c.h<0.9*sp&&Math.abs(c.cy-mid)<1.1*sp){
      const dTop=Math.min(...st.lines.map(ly=>Math.abs(c.y0-ly))), dBot=Math.min(...st.lines.map(ly=>Math.abs(c.y1-ly)));
      const whole=dTop<dBot;                      // a whole rest hangs from a line, a half rest sits on one
      out.push({x:c.cx,dur:whole?4:2,kind:whole?"whole":"half"});
    }
    else if(c.h>2.3*sp&&c.h<3.6*sp&&c.w>0.5*sp&&c.w<1.1*sp&&c.cy>st.top&&c.cy<st.bot&&!c.isAcc&&!hasTallStroke(c,st._sym,st._w,sp))
      out.push({x:c.cx,dur:1,kind:"quarter"});
    else if(c.h>1.6*sp&&c.h<2.3*sp&&c.w>0.6*sp&&c.w<1.2*sp&&c.cy>st.top&&c.cy<st.bot&&c.n<0.5*c.w*c.h)
      out.push({x:c.cx,dur:0.5,kind:"eighth"});
  }
  out.sort((a,b)=>a.x-b.x); return out.filter((r,i)=>!i||r.x-out[i-1].x>0.4*sp);   // one rest per place (a glyph and its line remnant are two symbols)
}

/* pitches need the key: done after reading, in one pass */
function assignPitches(res){
  const keyAcc=keyAccidentals(res.key.fifths);
  for(const b of res.bars) for(const s of b.staffs) for(const c of s.cols) for(const nt of c.notes){
    nt.midi=pitchOf(nt.step,keyAcc,null); nt.name=noteName(nt.midi);
  }
  for(const nt of res.notes){ nt.midi=pitchOf(nt.step===undefined?0:nt.step,keyAcc,null); }
}

/* the public reading: read, then name */
function read(img,opts){
  const res=readScore(img,opts);
  if(!res.bars.length) return res;
  const keyAcc=keyAccidentals(res.key.fifths);
  for(const b of res.bars) for(const s of b.staffs){
    const barAcc={};
    for(const c of s.cols) for(const nt of c.notes){
      if(nt.acc!==undefined) barAcc[nt.step]=nt.acc;
      nt.midi=pitchOf(nt.step,keyAcc,barAcc); nt.name=noteName(nt.midi);
    }
  }
  return res;
}

/* ─────────────────────────── the tempo mark (9 Sep 2026) ───────────────────────────
   "♩ = 168" above the first staff (David: "does the import feature read tempo when it's written into the
   notation?"). A small filled note (0.4–0.9 sp wide, 1.3–2 sp tall), an equals sign (two thin bars of the same
   width, one over the other) within 3 sp of it, and up to three digits after the sign, on one baseline, 1.2–2 sp
   tall. No equals sign, no tempo — a word like Andante is left alone. The digits are read by their shape. */
function readTempo(st,symComps,ink,w,sp){
  if(!st) return null;
  const band=symComps.filter(c=>c.y1<st.top-1.0*sp&&c.y0>st.top-10*sp).sort((a,b)=>a.x0-b.x0);
  const notes=band.filter(c=>c.w>=0.4*sp&&c.w<=0.9*sp&&c.h>=1.3*sp&&c.h<=2.0*sp);
  for(const nt of notes){
    const bars=band.filter(c=>c.x0>nt.x1&&c.x0<nt.x1+3*sp&&c.w>=0.9*sp&&c.w<=1.8*sp&&c.h<=0.35*sp&&c.y0>nt.y0-0.5*sp&&c.y1<nt.y1+0.5*sp);
    const eq=bars.find(a=>bars.some(b=>b!==a&&Math.abs(b.x0-a.x0)<0.3*sp&&Math.abs(b.w-a.w)<0.3*sp&&b.y0>a.y1&&b.y0-a.y1<0.6*sp));
    if(!eq) continue;
    const digits=[]; let x=eq.x1;
    for(const c of band){ if(c.x0<=x||c.x0>x+3*sp) continue; if(!(c.h>=1.2*sp&&c.h<=2.0*sp&&c.w>=0.3*sp&&c.w<=1.3*sp&&Math.abs(c.y1-nt.y1)<0.7*sp)) continue;
      if(digits.length&&Math.abs(c.y1-digits[0].y1)>0.3*sp) continue; digits.push(c); x=c.x1; if(digits.length===3) break; }
    if(digits.length<2) continue;
    const str=digits.map(c=>classifyDigit(c,ink,w)).join(""); const bpm=+str;      // on the raw ink: the ledger pass thins a digit's bottom curve and opens its hole
    if(!/^\d+$/.test(str)||bpm<30||bpm>300) continue;
    return {bpm,x:nt.x0,y:nt.y0,digits:str};
  }
  return null;
}
/* a printed digit by its shape: its holes, and where its ink lies in the top, middle and bottom bands and along
   its left and right edges — enough for the bold digits of a tempo mark */
function classifyDigit(c,mask,w){
  const W=c.w+2,H=c.h+2; const on=(x,y)=>x>=0&&y>=0&&x<W&&y<H&&!!mask[(c.y0-1+y)*w+c.x0-1+x];   // the box a pixel wider each way
  // holes: white not reachable from the border of the box
  const seen=new Uint8Array((W+2)*(H+2)); const idx=(x,y)=>(y+1)*(W+2)+x+1; const stack=[];
  const push=(x,y)=>{ if(x<-1||y<-1||x>W||y>H) return; const i=idx(x,y); if(seen[i]||on(x,y)) return; seen[i]=1; stack.push([x,y]); };
  for(let x=-1;x<=W;x++){ push(x,-1); push(x,H); } for(let y=-1;y<=H;y++){ push(-1,y); push(W,y); }
  while(stack.length){ const [x,y]=stack.pop(); push(x-1,y); push(x+1,y); push(x,y-1); push(x,y+1); }
  const holes=[]; for(let y=0;y<H;y++) for(let x=0;x<W;x++){ const i=idx(x,y); if(seen[i]||on(x,y)) continue;
    let n=0,sy=0,y0=y,y1=y; const q=[[x,y]]; seen[i]=1; while(q.length){ const [a,b]=q.pop(); n++; sy+=b; if(b<y0)y0=b; if(b>y1)y1=b;
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ const X=a+dx,Y=b+dy; if(X<0||Y<0||X>=W||Y>=H) continue; const j=idx(X,Y); if(seen[j]||on(X,Y)) continue; seen[j]=1; q.push([X,Y]); } }
    if(n>=3) holes.push({n,cy:sy/n/H,h:(y1-y0+1)/H}); }
  const first=y=>{ for(let x=0;x<W;x++) if(on(x,y)) return x; return -1; }, last=y=>{ for(let x=W-1;x>=0;x--) if(on(x,y)) return x; return -1; };
  const extent=(a,b)=>{ let e=0; for(let y=Math.floor(a*H);y<Math.min(H,Math.ceil(b*H));y++){ const f=first(y); if(f<0) continue; e=Math.max(e,(last(y)-f+1)/W); } return e; };
  const leftIn=(a,b)=>{ let n=0,k=0; for(let y=Math.floor(a*H);y<Math.min(H,Math.ceil(b*H));y++){ k++; const f=first(y); if(f>=0&&f<0.3*W) n++; } return k?n/k:0; };
  const rightIn=(a,b)=>{ let n=0,k=0; for(let y=Math.floor(a*H);y<Math.min(H,Math.ceil(b*H));y++){ k++; const l=last(y); if(l>=0&&l>0.7*W) n++; } return k?n/k:0; };
  const top=extent(0,0.2), mid=extent(0.4,0.6), bot=extent(0.8,1), bar=extent(0.62,0.8);
  const lu=leftIn(0.1,0.45), ll=leftIn(0.55,0.9), lb=leftIn(0.8,0.95), ru=rightIn(0.1,0.45), rm=rightIn(0.25,0.48), rl=rightIn(0.55,0.9);
  /* tuned on six faces at two sizes (scratch bench, 9 Sep): a 1 is narrow; 8 has two holes; 0's hole is tall,
     4's and 9's sit high — 4 with its crossbar, 9 without — 6's low; among the open shapes 7 is a top bar over
     nothing, an open 4 a crossbar over a stem at the right, 5 a left upright under a bar with its upper right
     empty, 2 a full base with its lower right empty, 3 its bowls on the right */
  if(W/H<0.56) return "1";
  if(holes.length>=2) return "8";
  if(holes.length===1){ const o=holes[0]; if(o.h>0.55) return "0"; if(o.cy<0.5) return top<0.6?"4":"9"; return "6"; }   // a 4's top is its stem and a diagonal; a 9's is its bowl
  if(mid<=0.45&&top<0.7) return "1";
  if(top>=0.75&&bot<=0.6&&rl<0.5) return "7";
  if(bar>=0.85&&rl>=0.6&&lb<0.3&&bot<0.6) return "4";
  if(lu>=0.8&&rm<=0.5) return "5";      // under the top bar, a 5's right side is empty
  if(bot>=0.8&&rl<0.5) return "2";
  if(rl>=0.6) return "3";
  return "2";
}
const api={read,readScore,binarize,findStaffs,noteName,keyAccidentals,pitchOf,STEP_PC,classifyDigit,components};
if(typeof module!=="undefined"&&module.exports) module.exports=api; else root.ScoreReader=api;
})(typeof window!=="undefined"?window:globalThis);
