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
/* ─────────────────────── a clef inside a staff (14 Sep 2026) ───────────────────────
   A CLEF SIGN INSIDE A STAFF IS THE SAME SHAPE AS THE CLEF AT THE HEAD OF A STAFF ON THE SAME PAGE.
   That is the whole rule, and it needs no invented thresholds: every page prints its own clefs,
   correctly located and at the right size, so a candidate is simply laid on the same small grid as
   those and the ink compared. A first attempt asked instead whether a shape was tall and spanned
   the staff; 685 stems with beams answered yes and twenty scores were ruined.

   Für Elise's left hand climbs into the treble and comes back, and both signs used to be read as
   notes while everything after them was read in the wrong clef — whole systems an octave and a half
   out. Measured over all 43 pictures: a real mid-staff clef scores 0.61 to 0.79 against the page's
   own, and the best thing that is not one scores 0.52. */
const CLEF_GW=14, CLEF_GH=22, CLEF_MATCH=0.60;
function clefGrid(sym,w,box){
  const g=new Float32Array(CLEF_GW*CLEF_GH);
  const bw=box.x1-box.x0+1, bh=box.y1-box.y0+1;
  for(let y=0;y<CLEF_GH;y++) for(let x=0;x<CLEF_GW;x++){
    const x0=box.x0+Math.floor(x*bw/CLEF_GW), x1=box.x0+Math.max(Math.floor((x+1)*bw/CLEF_GW),Math.floor(x*bw/CLEF_GW)+1);
    const y0=box.y0+Math.floor(y*bh/CLEF_GH), y1=box.y0+Math.max(Math.floor((y+1)*bh/CLEF_GH),Math.floor(y*bh/CLEF_GH)+1);
    let n=0,m=0; for(let b=y0;b<y1;b++) for(let a=x0;a<x1;a++){ m++; if(sym[b*w+a]) n++; }
    g[y*CLEF_GW+x]=m?n/m:0;
  }
  return g;
}
function clefIoU(a,b){ let i=0,u=0; for(let k=0;k<a.length;k++){ i+=Math.min(a[k],b[k]); u+=Math.max(a[k],b[k]); } return u?i/u:0; }
function findClefChanges(staffs,symComps,sym,w,sp,log){
  const T={t:[],b:[]};
  for(const st of staffs) if(st.clefBox&&T[st.clef].length<2) T[st.clef].push(clefGrid(sym,w,st.clefBox));
  for(const st of staffs){
    st.clefs=[{x:-1e9,clef:st.clef,topIdx:st.topIdx}];
    for(const c of symComps){
      if(c.x0<=st.clefX1+2*sp) continue;
      if(c.cy<st.top-3*sp||c.cy>st.bot+3*sp) continue;
      if(c.w<0.8*sp||c.w>3.5*sp||c.h<1.8*sp||c.h>7.5*sp) continue;
      const g=clefGrid(sym,w,c);
      let bestK=null,bestS=0;
      for(const k of ["t","b"]) for(const t of T[k]){ const v=clefIoU(g,t); if(v>bestS){ bestS=v; bestK=k; } }
      if(bestS>=CLEF_MATCH) st.clefs.push({x:c.x0,clef:bestK,topIdx:bestK==="t"?10:-2,box:c,score:+bestS.toFixed(2)});
    }
    st.clefs.sort((a,b)=>a.x-b.x);
    if(st.clefs.length>1&&log) log.push(`clef change on a ${st.clef==="t"?"treble":"bass"} staff: `+st.clefs.slice(1).map(k=>k.clef+" at "+Math.round(k.x)+" ("+k.score+")").join(", "));
  }
}
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
    /* THE UNION STARTS ON A PIECE THAT CROSSES THE STAFF (Brahms' Lullaby, 13 Sep 2026: a chord symbol and two
       fingerings sit above the first staff at its left edge, the leftmost of them opened the union, the next
       piece was too far right to join it, and the treble clef never got in — the melody of three systems was
       read in the bass clef, an octave and a half low). A clef stands ON its staff; a symbol floating above it
       is not a clef, whatever its x. */
    const onStaff=c=>c.y1>st.top+0.5*sp&&c.y0<st.bot-0.5*sp;
    /* …AND IT IS CLEF-SIZED, OR THE SEARCH GOES ON (a cello-and-guitar duet, 13 Sep 2026: "Vc." and "Guit." are
       printed over the first inches of every staff, so the union was a word, never a clef, and every staff
       fell to the bass default — the guitar's treble staffs included). A union that closes narrower than 1.4 sp
       or shorter than 2.5 sp is not the clef; the next piece opens a new one, out to 8 sp from the staff's start. */
    const clefLike=v=>v&&v.x1-v.x0+1>=1.4*sp&&v.y1-v.y0+1>=2.5*sp;
    let u=null, found=null; for(const c of near){ if(c.x0<st.x0-sp) continue; if(c.x0>=st.x0+20*sp) break;   // 20 sp: "Acoustic Guitar" spelled out over the first staff puts the clef 17 sp in
      if(u&&c.x0>u.x1+0.3*sp){ if(clefLike(u)){ found=u; break; } u=null; }
      if(!u){ if(!onStaff(c)) continue; u={x0:c.x0,x1:c.x1,y0:c.y0,y1:c.y1,n:c.n}; continue; }
      u.x1=Math.max(u.x1,c.x1); u.y0=Math.min(u.y0,c.y0); u.y1=Math.max(u.y1,c.y1); u.n+=c.n; }
    if(!found&&clefLike(u)) found=u;
    const tall=found;
    st.clef=tall&&tall.y1>st.bot+0.8*sp?"t":"b";                       // the treble clef's tail hangs below the staff; the bass clef stays inside
    st.clefX1=tall?tall.x1:st.x0+2.5*sp;
    st.clefBox=tall||null;                       // the page's own example of this clef, for matching
    // top-line diatonic index (C4 = 0): treble top line F5 = 10, bass top line A3 = -2
    st.topIdx=st.clef==="t"?10:-2;
  }
  findClefChanges(staffs,symComps,sym,w,sp,log);

  /* systems: a piano system is two staffs — a treble and the staff under it (a bass, or a treble when the
     left hand climbs). Lyrics between them can widen the gap to 14 sp. A bass never opens a system while a
     treble stands alone above it. */
  /* A SYSTEM IS WHAT THE SYSTEM LINE JOINS (a violin-cello-piano trio, 14 Sep 2026: four staffs a system,
     paired two and two, so every bar became two and the melody alternated between the violin and the piano).
     Staffs joined by a continuous vertical line at their left edge — the line every score draws down the front
     of a system — are one system, however many; the two-staff rules below serve the pages that draw none. */
  const xL=Math.min(...staffs.map(s=>s.x0)), xR=Math.max(...staffs.map(s=>s.x0));      // the page's left edges: instrument names blur where a first system's lines begin
  const joinedByLine=(a,b)=>{ const y0=Math.round(a.bot), y1=Math.round(b.top); if(y1-y0<2) return true;
    for(let x=Math.max(1,Math.round(xL-2.5*sp));x<=Math.min(w-2,Math.round(xR+3*sp));x++){ let n=0; for(let y=y0;y<=y1;y++) if(inkL[y*w+x]||inkL[y*w+x-1]||inkL[y*w+x+1]) n++; if(n>=0.8*(y1-y0+1)) return true; } return false; };   // 0.8: the Canon's line covers 82 % of its gap; a system break shows 8 % at most
  for(const st of staffs){
    const prev=cur&&cur.staffs[cur.staffs.length-1];
    if(prev&&joinedByLine(prev,st)){ cur.staffs.push(st); st.lower=true; continue; }
    /* a treble followed by a bass is one system whatever lies between (five verses of lyrics can push
       the bass 20 sp down); two trebles pair only when close */
    /* a bass staff over a treble one is a system break in a piano score — and the system itself in a duet
       (cello over guitar, 13 Sep 2026): paired when they stand close, under 8 sp apart */
    if(cur&&cur.staffs.length<2&&((prev.clef==="t"&&st.clef==="b")||(st.top-prev.bot<14*sp&&!(prev.clef==="b"&&st.clef==="t"))||(prev.clef==="b"&&st.clef==="t"&&st.top-prev.bot<8*sp))){ cur.staffs.push(st); st.lower=true; }
    else { cur={staffs:[st]}; systems.push(cur); }
  }
  /* heads first, from the clef on — so the signature steps can tell a note from a glyph */
  for(const sys of systems) for(const st of sys.staffs){
    st._eroded=eroded; st._erR=erR; st._inkL=inkL; st._sym=sym; st._w=w; st._compById=compById; st.keyX1=st.clefX1; st.heads=findHeads(ink,sym,symLab,symComps,w,h,st,sp,log);
    for(const hd of st.heads) readStem(hd,sym,w,h,sp,st);
    /* THE HEADS OF ONE CHORD SHARE ONE STEM (Brahms' Lullaby, 13 Sep 2026: a two-note chord's upper head saw the
       stem run as far down to the lower head as up to its end, chose down, and read its beam off the other head —
       a quarter chord as an eighth). Heads in one column whose stems disagree take the stem whose far end lies
       farthest outside the chord, and read their beams again from it. */
    { const cols=[]; for(const hd of st.heads.slice().sort((a,b)=>a.x-b.x)){ const c=cols[cols.length-1]; if(c&&Math.abs(hd.x-c[0].x)<0.3*sp) c.push(hd); else cols.push([hd]); }
      for(const c of cols){ const withStem=c.filter(hd=>hd.stem); if(withStem.length<2||new Set(withStem.map(hd=>hd.stem.dir)).size<2) continue;
        const xs=withStem.map(hd=>hd.stem.x); if(Math.max(...xs)-Math.min(...xs)>0.3*sp) continue;   // two stem lines are two voices, not a chord (the triplet pages' dotted eighth over a triplet head)
        const yMin=Math.min(...c.map(hd=>hd.hy0)), yMax=Math.max(...c.map(hd=>hd.hy1));
        const out=hd=>hd.stem.dir<0?yMin-hd.stem.yEnd:hd.stem.yEnd-yMax;
        const pick=withStem.reduce((a,hd)=>out(hd)>out(a)?hd:a).stem;
        for(const hd of c) if(hd.stem!==pick) readStem(hd,sym,w,h,sp,st,Object.assign({},pick,{len:Math.abs(pick.yEnd-hd.y)})); } }
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
    sys.repeats=findRepeats(ink,w,h,sys,sp,sys.bars);
  }
  for(const sys of systems) for(const st of sys.staffs){ st.heads=st.heads.filter(hd=>!hd.fake); findTuplets(st,symComps,sp,sym,w); findDots(st,symComps,sp,sys.bars); findAccidentals(st,symComps,sp,sym,w); }

  /* columns and onsets per staff per bar */
  const bars=[]; let n=0; const sectionCuts=[];
  for(const sys of systems){
    for(let bi=0;bi<sys.bars.length-1;bi++){
      const bx0=sys.bars[bi], bx1=sys.bars[bi+1]; n++;
      if(sys.wideBars&&sys.wideBars.some(x=>Math.abs(x-bx1)<0.5*sp)&&bi<sys.bars.length-2) sectionCuts.push(n);   // the bar ends at a double bar
      const bar={n,sysIndex:systems.indexOf(sys),x0:bx0,x1:bx1,staffs:[],q:false};
      { const R=sys.repeats; if(R){ const a=R.get(bi), b=R.get(bi+1);
          if(a&&a.start) bar.repeatStart=true; if(b&&b.end) bar.repeatEnd=true; } }
      for(const st of sys.staffs){
        const heads=st.heads.filter(hd=>hd.x>bx0&&hd.x<bx1&&hd.dur).sort((a,b)=>a.x-b.x);
        const rests=findRests(st,symComps,sp,bx0,bx1,heads);
        for(const r of rests){ const t=(st.tupletSpans||[]).find(t=>r.x>=t.x0&&r.x<=t.x1); if(t){ r.dur*=2/3; r.voice=t.dir; } }   // a rest under a tuplet's bracket is the tuplet's, in the bracket's voice
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
        /* TWO VOICES (triplet arpeggios, 8 Sep 2026: a dotted eighth and a sixteenth above a triplet, the sixteenth
           landing after the bar's end): a bar that shows stems of both directions in one column is written in two
           voices, and each direction keeps its own clock — a head starts where its voice's clock stands, and the
           column where the earliest of its heads does. Every other bar is one voice, the columns in sequence. */
        const dirOf=hd=>hd.stem?hd.stem.dir:0;
        /* Two voices are told by their stems: the upper voice's go up, the lower's down, and every up-stem head
           stands above every down-stem head. One voice stems by pitch — up below the middle line, down above —
           so its up-stem heads sit BELOW its down-stem heads, and a chord's heads reading their one stem either
           way fall the same side. (The first statement, opposite stems in one column, missed the bar where the
           upper voice never shares a column — a dotted half over rests and eighths, page 2, 8 Sep 2026.) */
        const ups=[], downs=[]; for(const C of cols) for(const hd of C.heads){ if(!hd.stem) continue; (hd.stem.dir<0?ups:downs).push(hd.y); }
        const twoVoice=ups.length>0&&downs.length>0&&Math.max(...ups)<Math.min(...downs);
        let onset=0; const clock={"-1":0,"1":0};
        for(let i=0;i<cols.length;i++){ const C=cols[i];
          if(!C.rest&&!C.heads.length){ C.empty=true; continue; }               // a column of tied continuations: its time flows to the note before
          C.dur=C.rest?C.rest.dur:Math.min(...C.heads.map(hd=>hd.dur));
          let j=i+1; while(j<cols.length&&!cols[j].rest&&!cols[j].heads.length){ C.dur+=Math.min(...(cols[j]._origHeads||[]).map(hd=>hd.dur).concat([0.5])); j++; }
          if(twoVoice){
            const at=hd=>{ const d=dirOf(hd); return d?clock[d]:Math.min(clock[-1],clock[1]); };
            if(C.rest){ const d=C.rest.voice||(clock[-1]<=clock[1]?-1:1); C.onset=clock[d]; clock[d]+=C.dur; }
            else { C.onset=Math.max(...C.heads.map(at)); for(const hd of C.heads){ const d=dirOf(hd)||(clock[-1]<=clock[1]?-1:1); clock[d]=C.onset+hd.dur; } }   // a voice entering into the other's column starts with it: its rests were not found or not written
            onset=Math.max(clock[-1],clock[1]);
          } else { C.onset=onset; onset+=C.dur; }
          C.notes=C.heads.map(hd=>({midi:hd.midi,name:hd.name,step:hd.step,hollow:hd.hollow,q:!!hd.q,acc:hd.acc,dur:hd.dur,beams:hd.beams||0,stem:hd.stem?hd.stem.dir:0})).sort((a,b)=>b.step-a.step);
          C.q=C.heads.some(hd=>hd.q);
          C.x=Math.round(C.x);
        }
        bar.staffs.push({clef:st.clef,cols:cols.filter(c=>!c.empty),total:onset,twoVoice});
      }
      bars.push(bar);
    }
  }
  /* the meter is what most bars add up to; a bar that does not is uncertain */
  const plain=bars.flatMap(b=>b.staffs.filter(s=>!s.cols.some(c=>c.rest&&c.rest.kind==="whole")).map(s=>s.total)).filter(t=>t>0);
  const beats=plain.length?modeOf(plain.map(t=>Math.round(t*4)/4)):4;
  const clock=s=>{ let t=0; for(const c of s.cols){ if(c.rest&&c.rest.kind==="whole") c.dur=beats; c.onset=t; if(!c.held) t+=c.dur; } s.total=t; };
  for(const b of bars) for(const s of b.staffs){ if(s.twoVoice) continue; clock(s);
    /* A BAR THAT ADDS UP TO MORE THAN THE METER HOLDS TWO VOICES ON THE SAME STEMS (Brahms' Lullaby, 13 Sep 2026:
       a half note held over a line of eighths, a dotted quarter over two quarter rests, a dotted half under four
       eighths — the voices cross in pitch, so the stem rule of the triplet pages cannot part them). The surplus
       is what the other voice was holding: first the rests that coincide with a note (they are that voice's
       silence while this one plays), then the other rests, then the long hollow notes themselves, taken in
       that order until the bar adds up exactly — and only then; a bar that will not add up stays flagged. */
    const over=s.total-beats; if(over>0.01){
      /* the long hollow notes first, then the rests that coincide with a note that still moves the clock, then
         the other rests (Brahms' bass, 13 Sep 2026: the quarter rest under a held dotted half is the second
         voice's own first beat, not surplus — dropped, the voice started a beat early; caught by the generated
         truth's round trip) */
      const isNote=c=>!c.rest&&c.heads&&c.heads.length; const longHollow=c=>isNote(c)&&c.dur>=2&&c.heads.every(hd=>hd.hollow);
      const near=r=>s.cols.some(c=>isNote(c)&&!longHollow(c)&&Math.abs(c.x-r.x)<0.45*sp);
      const cands=[...s.cols.filter(longHollow), ...s.cols.filter(c=>c.rest&&near(c)), ...s.cols.filter(c=>c.rest&&!near(c))];
      let left=over; const take=new Set(); for(const c of cands){ if(c.dur<=left+0.01&&!take.has(c)){ take.add(c); left-=c.dur; if(left<0.01) break; } }
      if(Math.abs(left)<0.01&&take.size){ for(const c of take) if(c.rest) c.gone=true; else c.held=true; s.cols=s.cols.filter(c=>!c.gone); clock(s); } } }
  /* AN INCOMPLETE FIRST BAR IS A PICKUP (David, 13 Sep 2026: "the beginning is incorrect" — Lul-la, two eighths,
     sat at the front of a full bar with two beats of silence after). When every staff of the page's first bar
     stops short of the meter by the same amount, its notes belong at the END of the bar. */
  { const b=bars[0]; if(b){ const ts=b.staffs.filter(s=>s.cols.length).map(s=>s.total); const t0=ts[0];
      if(ts.length&&t0>0&&t0<beats-0.01&&ts.every(t=>Math.abs(t-t0)<0.01)){ const shift=beats-t0; b.pickup=shift;
        for(const s of b.staffs){ for(const c of s.cols) c.onset+=shift; if(s.cols.length) s.total=beats; } } } }
  for(const b of bars){ for(const s of b.staffs){ s.q=s.cols.length>0&&Math.abs(s.total-beats)>0.01; if(s.total===0) s.empty=true; }
    b.q=b.staffs.some(s=>s.q||s.cols.some(c=>c.q)); }
  const notes=headsAll.map(hd=>({x:Math.round(hd.x),y:Math.round(hd.y),midi:hd.midi,name:hd.name,dur:hd.dur,hollow:hd.hollow,q:!!hd.q,clef:hd.clef}));
  log.push(`${notes.length} heads · ${bars.length} bars · meter ${beats} beats · ${bars.filter(b=>b.q).length} bars uncertain${sectionCuts.length?` · sections end after bar ${sectionCuts.join(", ")}`:""}`);
  { const rs=bars.filter(b=>b.repeatStart).map(b=>b.n), re=bars.filter(b=>b.repeatEnd).map(b=>b.n);
    if(rs.length||re.length) log.push(`repeats: ${rs.length?"open at bar "+rs.join(", "):"open at the start"} · ${re.length?"close after bar "+re.join(", "):"none closed"}`); }
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
    return c.cy>yTop&&c.cy<yBot&&c.x0>xMin&&c.w>=0.3*sp&&c.w<1.3*sp&&c.h>0.08*sp&&c.h<=1.0*sp&&!sliver(c); });   // a whole note's hole in a space is a spacing tall (page 2, bar 15's bass)
  hc.sort((a,b)=>a.cx-b.cx);
  const used=new Set();
  for(let i=0;i<hc.length;i++){
    if(used.has(i)) continue;
    let c=hc[i]; let box={x0:c.x0,x1:c.x1,y0:c.y0,y1:c.y1};
    for(let j=i+1;j<hc.length;j++){
      const d=hc[j]; if(used.has(j)) continue;
      /* …and the two halves of ONE head are still one head tall: four fragments in a column are two hollow heads
         a third apart, each cut by a staff line, and merging all four made a box too tall to be a head, so the
         chord was thrown away (Brahms' Lullaby, 13 Sep 2026 — page 2 opened on a half-note chord and lost it) */
      const wouldBe=Math.max(box.y1,d.y1)-Math.min(box.y0,d.y0)+1;
      if(wouldBe<=1.05*sp&&Math.abs(d.cx-c.cx)<0.6*sp&&Math.min(Math.abs(d.y0-c.y1),Math.abs(c.y0-d.y1))<0.45*sp&&d.h<0.5*sp&&c.h<0.5*sp){ used.add(j);   // halves are short; whole holes stacked a third apart are two heads
        box.x0=Math.min(box.x0,d.x0); box.x1=Math.max(box.x1,d.x1); box.y0=Math.min(box.y0,d.y0); box.y1=Math.max(box.y1,d.y1); }
    }
    const members=new Set([c]); for(const j of used) if(hc[j]&&Math.abs(hc[j].cx-c.cx)<0.6*sp&&hc[j].cy>=box.y0-1&&hc[j].cy<=box.y1+1) members.add(hc[j]);
    const bw=box.x1-box.x0+1, bh=box.y1-box.y0+1;
    const bhEff=members.size>1?[...members].reduce((n,m)=>n+m.h,0):bh;                     // two halves across a staff line: the line's rows are not hole
    const trace=(why)=>{ (st._holeLog=st._holeLog||[]).push({x:Math.round((box.x0+box.x1)/2),y:Math.round((box.y0+box.y1)/2),w:bw,h:bh,why}); };
    if(bw/bhEff<0.7||bh>1.0*sp||bh<0.3*sp){ trace("shape"); continue; }     // letters and digits are taller; a pocket under a beam is thinner
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
    if(bw/bhEff<1.2){ const top=[...members].reduce((a,m)=>m.y0<a.y0?m:a); const cyr=Math.round((top.y0+top.y1)/2);   // 1.2: a space-filling pocket beside a stem is as round as a whole note's hole (Let It Be) — the rim tells them apart
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
    /* measured beyond the head's own rim: a whole note's rim is half a spacing thick on each side, and the window
       beside the hole used to fall inside it (triplet arpeggios, 8 Sep 2026: every whole note on the page was
       "text"). The rim is the ink walked outward from the hole on its middle row — the top half's row when a
       line splits the hole. */
    const rimRow=members.size>1?Math.round(([...members].reduce((a,m)=>m.y0<a.y0?m:a).y0+[...members].reduce((a,m)=>m.y0<a.y0?m:a).y1)/2):Math.round((box.y0+box.y1)/2);
    const rim=(x,dir)=>{ let n=0; while(x>=0&&x<w&&ink[rimRow*w+x]&&n<sp){ n++; x+=dir; } return n<=0.7*sp?n:0; };   // thicker than a rim is a neighbouring glyph (the pocket between two beamed heads): measure from the hole
    const rimL=rim(box.x0-1,-1), rimR=rim(box.x1+1,1);
    const left=side(Math.max(0,box.x0-rimL-gap-wd),Math.max(0,box.x0-rimL-gap)), right=side(Math.min(w-1,box.x1+rimR+gap),Math.min(w-1,box.x1+rimR+gap+wd));
    if(left>0.35&&right>0.35){ trace(`text ${left.toFixed(2)}/${right.toFixed(2)}`); continue; }
    trace("kept");
    heads.push({x:(box.x0+box.x1)/2,y:(box.y0+box.y1)/2,hx0:box.x0-e,hx1:box.x1+e,hy0:box.y0-e,hy1:box.y1+e,hollow:true});
  }
  /* pitch from the staff position: half a spacing per step */
  /* A HEAD'S POSITION IS MEASURED FROM THE NEAREST STAFF LINE, at that staff's own spacing (a piano piece in F,
     13 Sep 2026: its lines stood 15, 15.5, 15.5, 15 apart while the page's spacing came out 15.5, so every note
     in the space under the staff read 0.4 of a step off from the top line and was flagged, though it rounded to
     the right note). Between two lines the step is half their own gap; beyond the outer lines the outer gap
     carries on. */
  const clefAt=x=>{ let c=st.clefs?st.clefs[0]:{clef:st.clef,topIdx:st.topIdx};
    if(st.clefs) for(const k of st.clefs) if(k.x<=x+0.3*sp) c=k; return c; };
  const L=st.lines; const posOf=y=>{ let i=0; while(i<L.length-2&&y>L[i+1]) i++; const gap=L[i+1]-L[i]; return 2*i+(y-L[i])/(gap/2); };
  for(const hd of heads){
    const pos=posOf(hd.y); const stepsDown=Math.round(pos);
    const cl=clefAt(hd.x);
    const idx=cl.topIdx-stepsDown;                              // diatonic index, C4 = 0
    hd.step=idx; hd.clef=cl.clef;
    hd.offGrid=Math.abs(pos-stepsDown);                         // 0 = dead centre, 0.5 = between two positions
    if(hd.offGrid>0.3) hd.q=true;
  }
  /* nothing inside a clef sign is a note: its dots and its curls erode to head-sized cores */
  if(st.clefs&&st.clefs.length>1){
    const boxes=st.clefs.filter(k=>k.box).map(k=>k.box);
    for(let i=heads.length-1;i>=0;i--){ const hd=heads[i];
      if(boxes.some(b=>hd.x>b.x0-0.3*sp&&hd.x<b.x1+1.8*sp&&hd.y>b.y0-0.4*sp&&hd.y<b.y1+0.4*sp)) heads.splice(i,1); }
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

/* ─────────────────────────── repeat signs (14 Sep 2026) ───────────────────────────
   A REPEAT SIGN IS A BAR LINE WITH TWO DOTS IN THE TWO MIDDLE SPACES of a staff; dots on its
   LEFT close a repeat, dots on its RIGHT open one. Nothing else in a score puts two blobs a
   spacing apart, centred on the same column, hard against a bar line — a staccato pair sits on
   notes, and a colon of a word is not on the staff at all.

   The dots are looked for on EVERY staff of the system and one staff is enough: a piano's lower
   staff often carries them where the upper one is crowded, and a scan can lose one of four. */
function findRepeats(ink,w,h,sys,sp,xs){
  const out=new Map();
  /* A DOT IS SMALL AND ROUND, and that is what tells it from a note head (the Canon and Carol of
     the Bells, 14 Sep 2026: a third written just after a bar line puts a head in each of the two
     middle spaces at one column, and seven bars of the Canon opened a repeat that is not there).
     Both runs through the centre, across and down, stay inside two thirds of a spacing — a head
     is a spacing and a quarter wide. */
  const run=(cx,cy,dx,dy)=>{ let n=0, x=Math.round(cx), y=Math.round(cy);
    if(x<0||y<0||x>=w||y>=h||!ink[y*w+x]) return 99;
    for(const s of [1,-1]){ let a=x+(s>0?dx:-dx), b=y+(s>0?dy:-dy);
      while(a>=0&&b>=0&&a<w&&b<h&&ink[b*w+a]&&n<4*sp){ n++; a+=s>0?dx:-dx; b+=s>0?dy:-dy; } }
    return n+1;
  };
  const dot=(cx,cy)=>{                                   // ink filling a small box, as a dot does
    const r=Math.max(1,Math.round(0.15*sp)); let n=0,m=0;
    for(let y=Math.round(cy-r);y<=Math.round(cy+r);y++) for(let x=Math.round(cx-r);x<=Math.round(cx+r);x++){
      if(y<0||y>=h||x<0||x>=w) return 0; m++; if(ink[y*w+x]) n++; }
    if(run(cx,cy,1,0)>0.66*sp||run(cx,cy,0,1)>0.66*sp) return 0;      // wider than a dot: a head, a stem, a beam
    return m?n/m:0;
  };
  const side=(X,dir)=>{                                  // the best column of two dots on one side
    for(const st of sys.staffs){
      const yA=st.top+1.5*sp, yB=st.top+2.5*sp;          // the two middle spaces
      /* A DOT IS NOT A NOTE HEAD, and the reader already knows where every head is (more11 and
         more18, 14 Sep 2026: a chord standing hard against a bar line put a head in each middle
         space and opened a repeat that is not printed). Asked of the heads themselves, not of a
         proxy for them. */
      const onHead=(cx,cy)=>st.heads.some(hd=>cx>hd.hx0-0.35*sp&&cx<hd.hx1+0.35*sp&&cy>hd.hy0-0.35*sp&&cy<hd.hy1+0.35*sp);
      let best=0;
      for(let d=0.35*sp;d<=1.9*sp;d+=0.08*sp){
        const cx=X+dir*d;
        if(onHead(cx,yA)||onHead(cx,yB)) continue;
        best=Math.max(best,Math.min(dot(cx,yA),dot(cx,yB)));
      }
      /* 0.6: a repeat dot fills its own box, a fragment of a stem or a beam does not fill both
         boxes a spacing apart at ONE column — the minimum of the pair is what is tested */
      if(best>=0.6) return true;
    }
    return false;
  };
  /* NOTHING CLOSES A REPEAT AT THE HEAD OF A SYSTEM: the first bar line of a system stands right
     after the clef, the key and the metre, and those read as dots often enough (the Minuet's 3/4,
     the triplet pages', a B flat in more1). Only an opening is looked for there. */
  xs.forEach((X,i)=>{ const end=i>0&&side(X,-1), start=side(X,+1); if(end||start) out.set(i,{end,start}); });
  return out;
}

/* ─────────────────────────── stems, beams, flags ─────────────────────────── */
function readStem(hd,sym,w,h,sp,st,forced){
  const span=v=>Math.max(0,Math.min(h-1,Math.round(v)));
  let best=forced||null;
  if(!forced)
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
    /* ANOTHER HEAD ON THIS STEM IS NOT A BEAM (Brahms' Lullaby, 13 Sep 2026: a two-note chord whose heads lie
       two and a half spacings apart put the upper head inside the lower head's beam window, so a quarter chord
       counted as two eighths and the bar came out short). A beam lies at the stem's far end with paper around
       it; a head is a head, and the staff's heads are all known by now. */
    const others=st.heads?st.heads.filter(o=>o!==hd&&Math.abs(o.x-hd.x)<3*sp):[];
    const onHead=(x,y)=>others.some(o=>x>=o.hx0-1&&x<=o.hx1+1&&y>=o.hy0-1&&y<=o.hy1+1);
    /* nor is a STROKE: ink whose own vertical run is of accidental length, 1.7 sp and more — a sharp's upright
       half a spacing from the stem, inside the scan's reach (the Matusa arrangement, 13 Sep 2026); a beam is as
       tall as it is thick, a flag's hairline shorter than that */
    const onStroke=(x,y)=>{ let a=y,b=y; while(a>0&&sym[(a-1)*w+x]) a--; while(b<h-1&&sym[(b+1)*w+x]) b++; return b-a+1>=1.7*sp; };
    let runs=0,run=0,onStem=0,att=0; const yA=best.yEnd+best.dir*1.0*sp, yB=best.yEnd-best.dir*Math.min(2.5*sp,best.len-1.4*sp);   // from a spacing past the stem's end (a sloping beam sits higher there) toward the head
    const step=-best.dir;                                                   // from the end toward the head, stopping short of the head
    const beamMin=Math.max(0.22*sp,1.3*st.th);   // a beam or a flag is clearly thicker than a staff line; a line kept beside a beam is not
    /* an accidental's upright half a spacing from the stem is a hairline running long (triplet arpeggios, 8 Sep
       2026: a flat's stroke beside a stem was a second beam, and an eighth of a triplet became a sixteenth). A
       flag is a hairline where the scan line crosses it too, but a short one — under half a spacing at every
       size benched — and a beam is broad. A run that is a hairline on most of its rows and longer than 0.8 sp
       is a stroke, not a beam. */
    const broad=y=>{ let a=x,b=x; while(a>0&&sym[y*w+a-1]) a--; while(b<w-1&&sym[y*w+b+1]) b++; return b-a+1>=0.4*sp; };
    const close=()=>{ if(run>=beamMin&&onStem>=run*0.5&&!(att<run*0.5&&run>=0.8*sp)){ runs++; (hd._beamRuns=hd._beamRuns||[]).push([side,run,onStem,att]); } run=0; onStem=0; att=0; };
    for(let y=span(yA);best.dir<0?y<=span(yB):y>=span(yB);y+=step){
      if(sym[y*w+x]&&!onHead(x,y)&&!onStroke(x,y)){ run++; if(sym[y*w+best.x]||sym[y*w+best.x-1]||sym[y*w+best.x+1]) onStem++; if(broad(y)) att++; } else close();
    }
    close();
    beams=Math.max(beams,runs);
  }
  /* EVERY BEAM HALVES THE NOTE, and the count was clamped at two — so a thirty-second read as a
     sixteenth and Für Elise's fast passages came out at twice their length, twelve of them filling
     a bar of three eighths twice over (14 Sep 2026). */
  hd.beams=Math.min(beams,4);
  hd.dur=hd.hollow?2:beams===0?1:0.5/Math.pow(2,hd.beams-1);
}

/* TUPLETS (8 Sep 2026 — a page of triplet arpeggios, David: "look at the timing in the third bar"): a small figure —
   the 3 — beyond the beam of a group, at the stems' far end. Every beamed eighth counted half a beat, a triplet added
   up to a beat and a half, the bar to six, and the meter followed. The mark itself was also read as a tiny head at the
   end of some groups. A mark is a glyph 0.7–1.5 sp tall and under 1.2 sp wide, beyond the beam of a beamed head
   within 2.5 sp of its stem; a head that coincides with a mark goes; the group under a mark — beamed heads joined by
   one continuous beam — is scaled by two thirds when its count is a multiple of three. */
function findTuplets(st,symComps,sp,sym,w){
  /* A TUPLET IS ITS FIGURE BEYOND THE BEAM (triplet arpeggios, 9 Sep 2026): a beamed group with a "3" past its
     stems' ends plays three in the time of two. The figure is read as INK AT ITS PLACE, not as a component —
     the italic 3 of this engraving falls into two or three fragments in the symbol image, and no fragment was
     a figure. Ink in the window beyond a group's beam (0.15–2.5 sp past the stems' ends, between its outer
     stems) is clustered across gaps of a third of a spacing; a cluster 0.7–1.5 sp tall and under 1.2 sp wide is
     the figure. A slur or a bracket through the window is wider, a dynamic taller. */
  const h=Math.floor(sym.length/w), inkL=st._inkL||sym;
  const beamed=()=>st.heads.filter(hd=>hd.stem&&hd.beams>=1);
  if(!beamed().length) return;
  const bm=beamed().sort((a,b)=>a.x-b.x);
  /* one continuous beam joins a group: ink along the beam's row between two stems' ends */
  const joined=(a,b)=>{ if(a.stem.dir!==b.stem.dir||b.x-a.x>6*sp) return false; const y0=Math.min(a.stem.yEnd,b.stem.yEnd)-Math.round(0.3*sp), y1=Math.max(a.stem.yEnd,b.stem.yEnd)+Math.round(0.3*sp);
    let n=0,k=0; for(let x=Math.round(Math.min(a.stem.x,b.stem.x));x<=Math.round(Math.max(a.stem.x,b.stem.x));x++){ k++; let inked=false; for(let y=Math.max(0,y0);y<=Math.min(h-1,y1)&&!inked;y++) if(sym[y*w+x]) inked=true; if(inked) n++; } return k>0&&n/k>0.85; };
  const groups=[]; for(const hd of bm){ const g=groups.slice().reverse().find(g=>{ const l=g[g.length-1]; return (Math.abs(hd.x-l.x)<0.3*sp&&hd.stem.dir===l.stem.dir)||joined(l,hd); });   // a chord shares one stem; two voices in one column do not — and two voices' groups interleave, so the group is searched for, not the last one taken
    if(g) g.push(hd); else groups.push([hd]); }
  const figures=[];
  for(const g of groups){
    const dir=g[0].stem.dir, stems=g.map(hd=>hd.stem).sort((a,b)=>a.x-b.x);
    const beamAt=x=>{ if(x<=stems[0].x) return stems[0].yEnd; if(x>=stems[stems.length-1].x) return stems[stems.length-1].yEnd;
      for(let i=1;i<stems.length;i++) if(x<=stems[i].x){ const a=stems[i-1],b=stems[i]; return a.yEnd+(b.yEnd-a.yEnd)*(x-a.x)/Math.max(1,b.x-a.x); } return stems[0].yEnd; };
    const x0=Math.max(0,Math.round(stems[0].x-1.0*sp)), x1=Math.min(w-1,Math.round(stems[stems.length-1].x+1.0*sp));
    const gap=Math.max(1,Math.round(0.3*sp)); const pts=[]; const idx=new Map(); const linePts=[];
    /* a thin line's pixels (a horizontal run of 0.8 sp and more, under 0.35 sp tall, off the staff's own lines) are
       kept apart from the figure's: a bracket's line runs into its figure's gap closer than the cluster's reach */
    const isLine=(x,y)=>{ if(st.lines.some(ly=>Math.abs(y-ly)<=1)) return false; let a=y,b=y; while(a>0&&inkL[(a-1)*w+x]) a--; while(b<h-1&&inkL[(b+1)*w+x]) b++; if(b-a+1>0.35*sp) return false;
      let l=x,r=x; while(l>0&&inkL[y*w+l-1]) l--; while(r<w-1&&inkL[y*w+r+1]) r++; return r-l+1>=0.8*sp; };
    for(let x=x0;x<=x1;x++){ const ye=beamAt(x); const ya=dir<0?ye-2.5*sp:ye+0.15*sp, yb=dir<0?ye-0.15*sp:ye+2.5*sp;
      for(let y=Math.max(0,Math.round(ya));y<=Math.min(h-1,Math.round(yb));y++) if(inkL[y*w+x]){ if(isLine(x,y)){ linePts.push({x,y}); continue; } idx.set(y*w+x,pts.length); pts.push({x,y,c:-1}); } }
    let nc=0; for(let i=0;i<pts.length;i++){ if(pts[i].c>=0) continue; const stack=[i]; pts[i].c=nc; while(stack.length){ const p=pts[stack.pop()];
        for(let dy=-gap;dy<=gap;dy++) for(let dx=-gap;dx<=gap;dx++){ const j=idx.get((p.y+dy)*w+p.x+dx); if(j!==undefined&&pts[j].c<0){ pts[j].c=nc; stack.push(j); } } } nc++; }
    const boxes=[]; for(const p of pts){ const b=boxes[p.c]||(boxes[p.c]={x0:p.x,x1:p.x,y0:p.y,y1:p.y,n:0}); b.x0=Math.min(b.x0,p.x); b.x1=Math.max(b.x1,p.x); b.y0=Math.min(b.y0,p.y); b.y1=Math.max(b.y1,p.y); b.n++; }
    const fig=boxes.find(b=>{ const bw=b.x1-b.x0+1, bh=b.y1-b.y0+1; return bh>=0.7*sp&&bh<=1.5*sp&&bw>=0.35*sp&&bw<=1.2*sp&&b.n>=0.15*bw*bh&&b.n<=0.6*bw*bh; });   // a figure has paper inside its box: a solid block is a stroke's end (the Minuet)
    if(!fig) continue;
    figures.push({cx:(fig.x0+fig.x1)/2,cy:(fig.y0+fig.y1)/2});
    /* A BRACKET SAYS WHAT THE TUPLET SPANS (page 2 of the triplet arpeggios, 8 Sep 2026: an eighth rest and two
       beamed eighths under a bracket, four times a bar): thin lines beside the figure at its height — under
       0.35 sp tall, 0.8 sp and longer — are the bracket, and everything on the bracket's side inside its reach is
       the tuplet: the heads whose stems point at it, and the rests, which the bar's reading scales when it finds
       them (st.tupletSpans). Without a bracket the beamed group is the tuplet, three columns or six. */
    const fcy=(fig.y0+fig.y1)/2; const segs=linePts.filter(p=>Math.abs(p.y-fcy)<0.8*sp);
    if(segs.length){
      /* the bracket runs on past the window: followed along its row to its hooks, a gap of two pixels allowed */
      const follow=(x,y,d)=>{ let miss=0,last=x; for(;x>=0&&x<w;x+=d){ if(inkL[y*w+x]||inkL[(y-1)*w+x]||inkL[(y+1)*w+x]){ last=x; miss=0; } else if(++miss>2) break; } return last; };
      const L=segs.reduce((a,p)=>p.x<a.x?p:a), Rr=segs.reduce((a,p)=>p.x>a.x?p:a);
      const xl=follow(L.x,L.y,-1), xr=follow(Rr.x,Rr.y,1);
      /* a bracket ends in hooks — a tick of 0.3 sp and more standing off the line at each end; a hairpin's lines
         and a slur's ends have none (page 2's bar 19 under a crescendo, Amazing Grace under a slur) */
      const hook=(x,y)=>{ let best=0; for(const X of [x-1,x,x+1]){ if(X<0||X>=w) continue; let a=y,b=y; while(a>0&&inkL[(a-1)*w+X]) a--; while(b<h-1&&inkL[(b+1)*w+X]) b++; best=Math.max(best,b-a+1); } return best>=0.3*sp+2; };
      if(hook(xl,L.y)&&hook(xr,Rr.y)){
        const x0=xl-0.3*sp, x1=xr+0.3*sp;
        (st.tupletSpans=st.tupletSpans||[]).push({x0,x1,dir});
        for(const hd of st.heads) if(hd.x>=x0&&hd.x<=x1&&hd.stem&&hd.stem.dir===dir&&hd.beams>=1&&!hd.tuplet){ hd.dur*=2/3; hd.tuplet=3; }   // beamed heads only: a half note is never inside an eighth-note tuplet (Brahms' Lullaby, a fingering over a beam)
        continue; } }
    const cols=new Set(g.map(hd=>Math.round(hd.x/(0.3*sp)))).size;                                        // heads of one chord share a column
    if(cols%3===0) for(const hd of g){ hd.dur*=2/3; hd.tuplet=3; }
  }
  if(figures.length) st.heads=st.heads.filter(hd=>!figures.some(m=>Math.abs(m.cx-hd.x)<0.6*sp&&Math.abs(m.cy-hd.y)<0.8*sp));     // a figure read as a head is no head
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
        let l=x,r=x; while(l>0&&sym[Y*w+l-1]) l--; while(r<w-1&&sym[Y*w+r+1]) r++; if(r-l+1>0.7*sp) continue;
        /* …and the whole blob the disc sits in, not only the runs through its centre: a natural's crossbar beside
           a head is short both ways at its middle but runs on into the upright (triplet arpeggios, page 2,
           8 Sep 2026: a triplet eighth before a natural read dotted) */
        /* — within 0.7 sp of the disc, the blob must hold no stroke (a vertical run of 0.9 sp or more). A tie
           leaving the dot is thin all the way and reaches the next head only a spacing on (Game of Thrones keeps
           its dotted halves). */
        const cap=0.7*sp; const seen=new Set([Y*w+x]); const stack=[[x,Y]]; let big=false;
        const vrun=(px,py)=>{ let a=py,b=py; while(a>0&&sym[(a-1)*w+px]) a--; while(b<h-1&&sym[(b+1)*w+px]) b++; return b-a+1; };
        while(stack.length&&!big){ const [px,py]=stack.pop(); if(vrun(px,py)>=0.9*sp){ big=true; break; }
          for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ const X=px+dx,YY=py+dy; if(X<0||X>=w||YY<0||YY>=h||Math.abs(X-x)>cap||Math.abs(YY-Y)>cap) continue; const k=YY*w+X; if(seen.has(k)||!sym[k]) continue; seen.add(k); stack.push([X,YY]); } }
        if(big) continue; }
      best=n/k; }
    return best; };
  for(const hd of st.heads){
    if(!hd.dur) continue;
    const dot=symComps.find(c=>c.w>=0.2*sp&&c.w<0.6*sp&&c.h>=0.2*sp&&c.h<0.6*sp   // a dot is a fifth of a spacing and more each way; a two-pixel crumb off a flat's bowl is not (page 2 of the triplet arpeggios)
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
    /* THE WINDOW HOLDS THE WHOLE ACCIDENTAL (David, 8 Sep 2026: a C♯ read as C♭, so the piece transposed up a
       tone put it back at C♯ and he saw a note that "still says C#"). A sharp is 1.1 sp wide and can sit a third
       of a spacing clear of the head, which put its LEFT upright outside a window of 1.3 sp: one stroke was
       left, the crossbars closed a hole beside it, and one stroke with a hole is a flat. 1.9 sp holds a sharp
       with its gap; the "wider than any accidental" test below still throws out anything broader. */
    const x0=Math.max(0,Math.round(hd.hx0-1.9*sp)), x1=Math.max(0,Math.round(hd.hx0-0.15*sp));
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
    else { let hy0=1e9,hy1=-1; if(st._holes) for(let y=Math.round(bot-1.3*sp);y<=bot;y++) for(let x=L.x1+1;x<=Math.min(w-1,L.x1+Math.round(0.9*sp));x++) if(st._holes[y*w+x]){ if(y<hy0) hy0=y; if(y>hy1) hy1=y; }
      /* A FLAT BELONGS TO THE HEAD AT ITS BOWL, not to anything its stem passes (triplet arpeggios, 8 Sep 2026:
         with a window wide enough to hold a sharp, a flat before the lower note of a third reached the note above
         it too). A sharp and a natural are symmetrical about their note's row and are left to the run's own test. */
      if(hy1>=0){ const cy=(hy0+hy1)/2; if(Math.abs(hd.y-cy)<=0.7*sp) acc=-1; } }          // -1 flat
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
  /* A GLYPH A STAFF LINE CUT IN TWO IS STILL ONE GLYPH (Für Elise, 14 Sep 2026: an eighth rest
     whose stroke crossed a line came apart into a blob above and a tail below; the blob had the
     proportions of a half rest and put two beats into a bar of three eighths, and the rest itself
     was never read). In this bar's band, pieces that stand in one column and are separated by no
     more than a line's thickness are put back together before anything is named. What the line
     ITSELF leaves behind is not a piece of anything and is dropped first: either a crumb, or the
     band of contact where a glyph sat ON a line — solid, lying on the line, and at least three
     times as wide as it is tall. (Amazing Grace's whole rest hangs from a line and keeps such a
     band above it; joined to the rest it made a glyph too tall to be one, and bar 1 lost its rest
     on both staves.) A rest that merely sits on a line has its centre half a spacing off it and
     is no wider than twice its height, so it stays. */
    const onLine=c=>st.lines.some(ly=>Math.abs(c.cy-ly)<=0.15*sp);
    const remnant=c=>(c.h<=0.25*sp&&c.w<0.8*sp)||(c.n>=0.8*c.w*c.h&&c.w>=3*c.h&&onLine(c));
    const piece=c=>c.cx>bx0-0.5*sp&&c.cx<bx1+0.5*sp&&c.cy>st.top-3.5*sp&&c.cy<st.bot+3.5*sp&&!remnant(c);
    const parts=symComps.filter(piece).map(c=>({x0:c.x0,x1:c.x1,y0:c.y0,y1:c.y1,w:c.w,h:c.h,n:c.n,cx:c.cx,cy:c.cy,isAcc:c.isAcc,src:[c]}));
    let joined=true;
    while(joined){ joined=false;
      outer:
      for(let i=0;i<parts.length;i++) for(let j=i+1;j<parts.length;j++){
        const a=parts[i],b=parts[j];
        const lo=Math.max(a.x0,b.x0), hi=Math.min(a.x1,b.x1);
        const over=hi-lo+1, narrow=Math.min(a.w,b.w);
        const gap=Math.max(a.y0,b.y0)-Math.min(a.y1,b.y1);
        if(over<0.4*narrow||gap>0.3*sp) continue;
        /* …AND THE SEAM MUST LIE ON A LINE, or the rule joins things a line never touched
           (Amazing Grace lost two durations to it on the first try). The cut was made by a staff
           line, so the join is only allowed where one runs. */
        const seam=(Math.min(a.y1,b.y1)+Math.max(a.y0,b.y0))/2;
        if(!st.lines.some(ly=>Math.abs(seam-ly)<=0.35*sp)) continue;
        const m={x0:Math.min(a.x0,b.x0),x1:Math.max(a.x1,b.x1),y0:Math.min(a.y0,b.y0),y1:Math.max(a.y1,b.y1),
                 n:a.n+b.n,isAcc:a.isAcc||b.isAcc,src:a.src.concat(b.src)};
        m.w=m.x1-m.x0+1; m.h=m.y1-m.y0+1;
        m.cx=(a.cx*a.n+b.cx*b.n)/(a.n+b.n); m.cy=(a.cy*a.n+b.cy*b.n)/(a.n+b.n);
        parts.splice(j,1); parts.splice(i,1,m); joined=true; break outer;
      }
    }
  for(const c of parts){
    if(c.cx<bx0+0.3*sp||c.cx>bx1-0.3*sp) continue;
    /* touches a note: its box meets a head's box, or it stands on a head's stem. Not merely near one — a rest of
       the lower voice sits right under the upper voice's note (triplet arpeggios, page 2, 8 Sep 2026: the eighth
       rest under a dotted half and the one under a quarter were skipped, and the bar ran to nine beats) */
    if(heads.some(hd=>(c.x0<=hd.hx1+0.3*sp&&c.x1>=hd.hx0-0.3*sp&&c.y0<=hd.hy1+0.3*sp&&c.y1>=hd.hy0-0.3*sp)||(hd.stem&&Math.abs(c.cx-hd.stem.x)<0.4*sp&&c.y0<=Math.max(hd.y,hd.stem.yEnd)&&c.y1>=Math.min(hd.y,hd.stem.yEnd)))) continue;
    /* A WHOLE OR HALF REST IS A SOLID BLOCK — and that is what tells it from the piece of some
       other glyph that happens to be block-shaped (Für Elise, 14 Sep 2026: a sixteenth rest cut in
       two where it crosses a staff line left a top fragment of exactly these proportions, and six
       bars gained a half rest of two beats in a bar of three eighths). Measured over the whole
       corpus: every real whole and half rest fills 0.97 or more of its box; every fragment fills
       0.63 or less. */
    if(c.w>0.8*sp&&c.w<2.0*sp&&c.h>0.3*sp&&c.h<0.9*sp&&Math.abs(c.cy-mid)<1.1*sp&&c.n>=0.75*c.w*c.h){
      const dTop=Math.min(...st.lines.map(ly=>Math.abs(c.y0-ly))), dBot=Math.min(...st.lines.map(ly=>Math.abs(c.y1-ly)));
      const whole=dTop<dBot;                      // a whole rest hangs from a line, a half rest sits on one
      out.push({x:c.cx,dur:whole?4:2,kind:whole?"whole":"half"});
    }
    /* a voice's rest may straddle an outer line — the upper voice's quarter rest in Brahms' bass sits with its
       middle half a pixel above the top line (13 Sep 2026) — so its middle may lie half a spacing outside */
    else if(c.h>2.3*sp&&c.h<3.6*sp&&c.w>0.5*sp&&c.w<1.1*sp&&c.cy>st.top-0.5*sp&&c.cy<st.bot+0.5*sp&&!c.isAcc&&!hasTallStroke(c,st._sym,st._w,sp))
      out.push({x:c.cx,dur:1,kind:"quarter"});
    else if(c.h>1.6*sp&&c.h<2.3*sp&&c.w>0.6*sp&&c.w<1.2*sp&&c.cy>st.top-0.5*sp&&c.cy<st.bot+0.5*sp&&c.n<0.5*c.w*c.h)
      out.push({x:c.cx,dur:0.5,kind:"eighth"});
    /* A FLAGGED REST ADDS A SPACING AND A BLOB FOR EVERY FLAG (Für Elise, the Lawrence Rosen
       edition, 14 Sep 2026: three quarters of its bars would not add up, every one of them short by
       a sixteenth, because a sixteenth rest was not known and was simply passed over). One flag is
       the eighth rest above, at about 1.8 spacings; each further flag adds a spacing and hangs
       another blob out to the LEFT of the stroke, which is why a flagged rest is wider than the
       quarter rest it is as tall as — the quarter rest is a narrow ribbon that doubles back, 0.9 to
       1.1 spacings across, where a sixteenth rest measures 1.3. Measured on Elise, Brahms, the
       Minuet and Let It Be; the quarter rest's own clause above is untouched. */
    else if(c.h>2.4*sp&&c.h<4.4*sp&&c.w>=1.15*sp&&c.w<2.0*sp&&c.cy>st.top-0.6*sp&&c.cy<st.bot+0.6*sp
            &&!c.isAcc&&c.n<0.42*c.w*c.h&&!hasTallStroke(c,st._sym,st._w,sp)){
      const flags=Math.max(2,Math.min(3,Math.round(c.h/sp-0.85)));
      out.push({x:c.cx,dur:flags===2?0.25:0.125,kind:flags===2?"sixteenth":"thirtysecond"});
    }
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
/* SMALL PRINT IS READ AT TWICE ITS SIZE (a violin-cello-piano trio at a 9 px spacing, 14 Sep 2026: eighth
   rests read as hollow whole notes, beam pockets as hollow halves, flags lost; at 18 px the same page read four
   beats in every bar of the cello, and the two Game of Thrones pages at 10 px gained a bar). Under 12 px the
   page is resampled to double and read again; every coordinate in the result is then in the doubled image,
   and res.scale says so. */
function upscale2(img){ const {w,h,gray}=img; const W=w*2,H=h*2;
  /* bicubic (Catmull-Rom), separable: a bilinear resample cost Game of Thrones 2 eight bars at 10 px; this one
     keeps it at forty of forty and lifts the trio the same */
  const K=t=>{ t=Math.abs(t); return t<1?1.5*t*t*t-2.5*t*t+1:t<2?-0.5*t*t*t+2.5*t*t-4*t+2:0; };
  const tmp=new Float32Array(W*h);
  for(let y=0;y<h;y++) for(let x=0;x<W;x++){ const sx=(x+0.5)/2-0.5, x0=Math.floor(sx), f=sx-x0; let v=0,ws=0;
    for(let k=-1;k<=2;k++){ const xx=Math.min(w-1,Math.max(0,x0+k)); const wt=K(k-f); v+=gray[y*w+xx]*wt; ws+=wt; } tmp[y*W+x]=v/ws; }
  const out=new Uint8Array(W*H);
  for(let y=0;y<H;y++){ const sy=(y+0.5)/2-0.5, y0=Math.floor(sy), f=sy-y0; for(let x=0;x<W;x++){ let v=0,ws=0;
    for(let k=-1;k<=2;k++){ const yy=Math.min(h-1,Math.max(0,y0+k)); const wt=K(k-f); v+=tmp[yy*W+x]*wt; ws+=wt; } out[y*W+x]=Math.max(0,Math.min(255,Math.round(v/ws))); } }
  return {w:W,h:H,gray:out}; }
function read(img,opts){
  opts=opts||{};
  let res=readScore(img,opts);
  if(res.sp&&res.sp<12&&!opts.noScale){ res=readScore(upscale2(img),opts); res.scale=2; }
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
  /* THE MARK IS AN EQUALS SIGN WITH A NOTE TO ITS LEFT AND DIGITS TO ITS RIGHT (13 Sep 2026, Wellerman's
     "Vivace (♩ = c. 144)" and the Takeda Lullaby's "Gently (♩ = 72)": anchored on the note, both were lost — one
     note stood 2.6 sp tall on a long stem, the other 1.2 sp wide, and a "c." for circa, or a closing bracket
     read as a fourth digit, undid the rest). The sign is the one shape nothing else in the band has: two bars
     of one width, one over the other. The note is anything note-sized left of it; a small word right of it
     is stepped over; the digits run until a shape is not a digit. */
  const band=symComps.filter(c=>c.y1<st.top-1.0*sp&&c.y0>st.top-10*sp).sort((a,b)=>a.x0-b.x0);
  const bars=band.filter(c=>c.w>=0.9*sp&&c.w<=1.8*sp&&c.h<=0.35*sp);
  for(const a of bars){ const b=bars.find(o=>o!==a&&Math.abs(o.x0-a.x0)<0.3*sp&&Math.abs(o.w-a.w)<0.3*sp&&o.y0>a.y1&&o.y0-a.y1<0.6*sp); if(!b) continue;
    const eq={x0:a.x0,x1:Math.max(a.x1,b.x1),y0:a.y0,y1:b.y1}, cy=(eq.y0+eq.y1)/2;
    const nt=band.filter(c=>c.x1<eq.x0&&c.x1>eq.x0-4*sp&&c.w>=0.4*sp&&c.w<=1.3*sp&&c.h>=1.2*sp&&c.h<=2.8*sp&&c.y0<cy&&c.y1>cy-0.3*sp).sort((p,q)=>q.x1-p.x1)[0];
    if(!nt) continue;
    let str="", x=eq.x1, n=0;
    for(const c of band){ if(c.x0<=x||c.x0>x+3*sp) continue;
      if(!n&&c.h<1.2*sp&&c.h>=0.4*sp&&c.y1<eq.y1+1.2*sp){ x=c.x1; continue; }                     // "c." — a small word before the digits
      if(!(c.h>=1.2*sp&&c.h<=2.0*sp&&c.w>=0.3*sp&&c.w<=1.3*sp&&Math.abs(c.y1-(eq.y1+0.6*sp))<0.9*sp)) continue;
      const d=classifyDigit(c,ink,w); if(!/^\d$/.test(d)) break; str+=d; x=c.x1; if(++n===3) break; }
    if(str.length===3&&+str>300&&+str.slice(0,2)>=30) str=str.slice(0,2);                 // a bracket's fragment after a valid pair is not a third digit (Takeda, ")")
    const bpm=+str; if(str.length<2||bpm<30||bpm>300) continue;
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
