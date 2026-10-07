/* fcpxml.js — THE FINAL CUT WRITER of the HPD Notation Lab (SUITE.md §7, stage 1,
   16 Sep 2026). Pure: takes the take's facts, the table marks, the bars and the
   beats, returns one FCPXML 1.14 document as a string. No DOM, no globals of
   the host. bench/fcpxml/check.js must say "same" after every change.

   WHAT IT WRITES (stage 1 — the workflow David's editors use today, read from
   his own export "sample xml export.fcpxmld", 16 Sep 2026):
   - one project holding the take as a clip, at the take's own frame rate and
     size, timecode from 0;
   - a chapter marker at every table mark (its label: A1, B2 … "end"), a plain
     marker at every bar;
   - one connected title per beat from the template his editors place by hand,
     "Percussive Marker Centered", positioned on the table's cell as they
     position it, Darken blend, lasting until the next beat.
   STAGE 3 (16 Sep 2026): input.titles — one connected title per table from
   the cell template "HPD Notation BxS" (tools-cell-moti.py), fully
   materialised by the caller: its template {name, uid}, static params
   (Rows), keyframed params (Row, Beat: two keyframes per beat, the second a
   frame before the next beat, so the value holds — FCPXML has no hold), and
   one <text> block per text layer of the template in document order, each a
   list of runs with a style {font, size, color, kerning, baseline,
   lineSpacing, alignment}; styles are deduplicated into <text-style-def>s per
   title. Read from David's test3 export: a slider's value is NORMALISED,
   (value − 1) / n; a title's keyframe times are in the title's own time,
   which starts at 3600 s.

   TIMES. Every time is a rational "N/Ds" on the frame grid: N = frames × num,
   D = den, where the frame lasts num/den seconds (50p: 100/5000s, as Final Cut
   writes it). A time off the grid is refused by Final Cut, so everything is
   rounded to frames here, once.

   THE TAKE'S OWN TIMECODE. A camera .mov carries a timecode track, and Final
   Cut addresses the media by it: an asset's `start` and every clip's `start`
   and connected `offset` are in that time, not from 0 (David's own exports:
   asset start 1764124000/50000s ≈ 09:48:02). The first import (16 Sep 2026,
   "Flavourful Freestyle 2 test") wrote start 0s for a take whose timecode
   begins at 00:11:10:27 and Final Cut answered "Invalid edit with no
   respective media" and an empty project — the edit lay outside the media.
   So take.tcStart (seconds, read from the tmcd track by the Lab; 0 when the
   file has none) is added to every media time here.

   POSITIONS. adjust-transform's position is in PERCENT OF THE FRAME HEIGHT on
   both axes (his 1080p export: beat step 19.2593 = 416 px of 2160, row step
   9.19259 = 198.56 px of 2160 — the lean template's beat column 415.68 and row
   198.55; the same numbers would hold at 4K). Each notation template has its
   own marker template and its own cell positions, so they are a SET, and the
   positions are the exact values David's editors landed on, read from his two
   exports (16 Sep 2026) — not a formula. A 4/4 table, four rows. */
(function(root){
"use strict";
const FCPXML={};

FCPXML.RATES=[ {fps:23.976,num:1001,den:24000},{fps:24,num:100,den:2400},{fps:25,num:100,den:2500},
  {fps:29.97,num:1001,den:30000},{fps:30,num:100,den:3000},{fps:50,num:100,den:5000},
  {fps:59.94,num:1001,den:60000},{fps:60,num:100,den:6000} ];
FCPXML.rate=function(frameDur){ // the nearest rate Final Cut knows to a measured frame length
  const fps=frameDur>0?1/frameDur:50; let best=null;
  for(const r of FCPXML.RATES){ const d=Math.abs(r.fps-fps); if(!best||d<best.d) best={r,d}; }
  return best.r;
};
FCPXML.frames=function(t,r){ return Math.max(0,Math.round(t*r.den/r.num)); };
FCPXML.tc=function(t,r){ return (FCPXML.frames(t,r)*r.num)+"/"+r.den+"s"; };
FCPXML.tcFrames=function(n,r){ return (Math.max(0,Math.round(n))*r.num)+"/"+r.den+"s"; };

FCPXML.SETS={
  /* "test 2.fcpxmld", a 4K50 lesson: Notation Template V 3.1 with Highlight Marker, 96 markers, four rows seen */
  v31:{ table:"Notation Template V 3.1", name:"Highlight Marker",
    uid:"~/Titles.localized/*Davids custom FCPX titles/Handpandojo Notations/Highlight Marker/Highlight Marker.moti",
    xs:[-0.196492,18.0981,36.3276,54.6708], ys:[0,-8.90741,-17.8426,-26.713] },
  /* "sample xml export.fcpxmld", a 1080p30 lesson: Percussive Notation Template v2.00 with Percussive Marker Centered; two rows seen, rows 3–4 continue the step */
  v200:{ table:"Percussive Notation Template v2.00", name:"Percussive Marker Centered",
    uid:"~/Titles.localized/*Davids custom FCPX titles/!Percussive Notations/Percussive Marker Centered/Percussive Marker Centered.moti",
    xs:[-0.0241319,19.2593,38.5204,57.7935], ys:[0,-9.19259,-18.38518,-27.57777] }
};
FCPXML.cellPosition=function(set,row,beat){ const S=FCPXML.SETS[set]||FCPXML.SETS.v31; return S.xs[Math.min(beat,4)-1]+" "+S.ys[Math.min(row,4)-1]; };

FCPXML.esc=function(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); };
FCPXML.fileURL=function(path){ // a POSIX path → file:// URL, every segment encoded (spaces, &, #)
  if(!path) return null; const segs=String(path).split("/").map(s=>encodeURIComponent(s).replace(/%3A/g,":"));
  return "file://"+segs.join("/");
};

/* a title's keyframe time: the title's media starts at 3600 s; k frames in */
FCPXML.titleTime=function(k,r){ return (3600*r.den+Math.max(0,Math.round(k))*r.num)+"/"+r.den+"s"; };
FCPXML.styleAttrs=function(st){ // the text-style attributes for a run's style, in a fixed order (the dedupe key)
  const a=[]; a.push('font="'+FCPXML.esc(st.font||"Loopiejuice Mono")+'"'); a.push('fontSize="'+(+(+st.size).toFixed(3))+'"'); a.push('fontFace="'+FCPXML.esc(st.face||"Regular")+'"');   // a run may name its face (the chord boxes' ♭ is Helvetica Neue Bold, 18 Sep)
  const c=st.color||[0,0,0]; a.push('fontColor="'+c.slice(0,3).map(x=>+(+x).toFixed(6)).join(" ")+' '+(c.length>3?+(+c[3]).toFixed(3):1)+'"');   // a fourth number is the alpha (the chord boxes' invisible twin of a ♭, 18 Sep)
  if(st.kerning!=null) a.push('kerning="'+(+(+st.kerning).toFixed(4))+'"');
  if(st.baseline!=null&&st.baseline!==0) a.push('baseline="'+(+(+st.baseline).toFixed(3))+'"');
  if(st.lineSpacing!=null&&st.lineSpacing!==0) a.push('lineSpacing="'+(+(+st.lineSpacing).toFixed(3))+'"');
  a.push('alignment="'+(st.alignment||"center")+'"');
  return a.join(" ");
};
FCPXML.titleXML=function(T,r,ref,ind,ids){ // one connected title; T = {t, dur, name, params:[{name,key,value}|{name,key,keyframes:[{k,value}]}], texts:[[{text,style}]...]}
  /* A text-style-def's id is an XML ID: unique in the WHOLE document, not per
     title (David's first tables import, 16 Sep: "DTD validation failed. ID ts1
     already defined …" — one ts1 per table). `ids` is the document's counter. */
  const E=FCPXML.esc, L=[], p=ind, styles=new Map(); ids=ids||{n:0};
  const sid=(st)=>{ const k=FCPXML.styleAttrs(st); if(!styles.has(k)) styles.set(k,"ts"+(++ids.n)); return styles.get(k); };
  const f0=T.offsetFrames, fd=Math.max(1,FCPXML.frames(T.dur,r));
  L.push(p+'<title ref="'+ref+'" lane="'+(T.lane|0||1)+'" offset="'+FCPXML.tcFrames(f0,r)+'" name="'+E(T.name)+'" start="3600s" duration="'+FCPXML.tcFrames(fd,r)+'">');
  for(const P of (T.params||[])){
    if(P.keyframes){ L.push(p+'    <param name="'+E(P.name)+'" key="'+E(P.key)+'">',p+'        <keyframeAnimation>');
      for(const kf of P.keyframes) L.push(p+'            <keyframe time="'+FCPXML.titleTime(kf.k,r)+'" value="'+(+(+kf.value).toFixed(6))+'" curve="linear"/>');
      L.push(p+'        </keyframeAnimation>',p+'    </param>'); }
    else L.push(p+'    <param name="'+E(P.name)+'" key="'+E(P.key)+'" value="'+E(P.value)+'"/>'); }
  for(const runs of (T.texts||[])){ L.push(p+'    <text>');
    for(const run of runs){ const id=sid(run.style); const parts=String(run.text==null?" ":run.text).split("\n");
      parts.forEach((part,i)=>{ if(i>0) L.push(p+'        <text-style ref="'+id+'">\n</text-style>'); L.push(p+'        <text-style ref="'+id+'">'+E(part)+'</text-style>'); }); }
    L.push(p+'    </text>'); }
  for(const [attrs,id] of styles) L.push(p+'    <text-style-def id="'+id+'">',p+'        <text-style '+attrs+'/>',p+'    </text-style-def>');
  if(T.transform){ const tr=T.transform; L.push(p+'    <adjust-transform position="'+(+(+tr.x).toFixed(4))+' '+(+(+tr.y).toFixed(4))+'"'+(tr.s&&tr.s!==1?' scale="'+(+(+tr.s).toFixed(4))+' '+(+(+tr.s).toFixed(4))+'"':'')+'/>'); }   // the piece's place and size in the frame (David, 16 Sep); after the text-style-defs, as the DTD orders
  /* A FADE IN AND OUT (David, 16 Sep 2026: "a relatively short fade-in and fade-out
     … somehow also exported to Final Cut"): the title's Compositing → Opacity, written
     as Final Cut writes its own fade handles — the same fadeIn/fadeOut his audio fades
     carry under adjust-volume, here under adjust-blend (the DTD's intrinsic video
     params, after adjust-transform). T.fadeIn / T.fadeOut are seconds, 0 or absent for none. */
  if(T.fadeIn>0||T.fadeOut>0){
    const fd=(s)=>FCPXML.tcFrames(Math.max(1,FCPXML.frames(s,r)),r);
    L.push(p+'    <adjust-blend amount="1.0">',p+'        <param name="amount">');
    if(T.fadeIn>0)  L.push(p+'            <fadeIn type="easeInOut" duration="'+fd(T.fadeIn)+'"/>');
    if(T.fadeOut>0) L.push(p+'            <fadeOut type="easeInOut" duration="'+fd(T.fadeOut)+'"/>');
    L.push(p+'        </param>',p+'    </adjust-blend>'); }
  L.push(p+'</title>');
  return L;
};

/* write({project, set:"v31"|"v200", take:{name, path, dur, frameDur, width, height, tcStart},
          chapters:[{t,label}], bars:[{t,label}], beats:[{t, dur, row, beat, label}],
          titles:[{t, dur, name, template:{name, uid}, params, texts}]}) → the document */
FCPXML.write=function(input){
  const take=input.take, r=FCPXML.rate(take.frameDur), E=FCPXML.esc, tc=(t)=>FCPXML.tc(t,r);
  const set=FCPXML.SETS[input.set]?input.set:"v31", S=FCPXML.SETS[set];
  const tc0=take.tcStart||0, t0F=FCPXML.frames(tc0,r), media=(t)=>FCPXML.tcFrames(t0F+FCPXML.frames(t,r),r);   // a moment of the take, in the media's own time
  const durF=FCPXML.frames(take.dur,r), oneFrame=FCPXML.tcFrames(1,r);
  const src=FCPXML.fileURL(take.path)||("file:///"+encodeURIComponent(take.name));   // no path known: Final Cut asks where the take is
  const L=[];
  L.push('<?xml version="1.0" encoding="UTF-8"?>','<!DOCTYPE fcpxml>','','<fcpxml version="1.14">','    <resources>');
  L.push('        <format id="r1" frameDuration="'+r.num+'/'+r.den+'s" width="'+(take.width|0)+'" height="'+(take.height|0)+'" colorSpace="1-1-1 (Rec. 709)"/>');
  L.push('        <asset id="r2" name="'+E(take.name)+'" start="'+FCPXML.tcFrames(t0F,r)+'" duration="'+FCPXML.tcFrames(durF,r)+'" hasVideo="1" format="r1" hasAudio="1" videoSources="1" audioSources="1">');
  L.push('            <media-rep kind="original-media" src="'+E(src)+'"/>','        </asset>');
  L.push('        <effect id="r3" name="'+E(S.name)+'" uid="'+E(S.uid)+'"/>');
  const titles=(input.titles||[]).slice().sort((a,b)=>a.t-b.t), effects=new Map(), styleIds={n:0};   // one <effect> per template used; one style-id counter for the document
  for(const T of titles){ const k=T.template.uid; if(!effects.has(k)){ const id="r"+(4+effects.size); effects.set(k,id); L.push('        <effect id="'+id+'" name="'+E(T.template.name)+'" uid="'+E(k)+'"/>'); } }
  L.push('    </resources>');
  L.push('    <library>','        <event name="'+E(input.project)+'">','            <project name="'+E(input.project)+'">');
  L.push('                <sequence format="r1" duration="'+FCPXML.tcFrames(durF,r)+'" tcStart="0s" tcFormat="NDF" audioLayout="stereo" audioRate="48k">','                    <spine>');
  L.push('                        <asset-clip ref="r2" offset="0s" name="'+E(take.name)+'" start="'+FCPXML.tcFrames(t0F,r)+'" duration="'+FCPXML.tcFrames(durF,r)+'" format="r1" tcFormat="NDF" audioRole="dialogue">');
  const beats=(input.beats||[]).slice().sort((a,b)=>a.t-b.t);
  for(const b of beats){ const f0=FCPXML.frames(b.t,r); if(f0>=durF) continue;
    const fd=Math.max(1,Math.min(FCPXML.frames(b.dur,r),durF-f0));
    L.push('                            <title ref="r3" lane="2" offset="'+FCPXML.tcFrames(t0F+f0,r)+'" name="'+E(b.label)+'" start="3600s" duration="'+FCPXML.tcFrames(fd,r)+'">');
    L.push('                                <adjust-transform position="'+FCPXML.cellPosition(set,b.row,b.beat)+'"/>');
    L.push('                                <adjust-blend mode="3 (Darken)"/>','                            </title>'); }
  for(const T of titles){ const f0=FCPXML.frames(T.t,r); if(f0>=durF) continue;
    L.push(...FCPXML.titleXML(Object.assign({},T,{offsetFrames:t0F+f0,dur:Math.min(T.dur,take.dur-T.t)}),r,effects.get(T.template.uid),'                            ',styleIds)); }
  for(const c of (input.chapters||[]).slice().sort((a,b)=>a.t-b.t)){ if(FCPXML.frames(c.t,r)>=durF) continue;
    L.push('                            <chapter-marker start="'+media(c.t)+'" duration="'+oneFrame+'" value="'+E(c.label)+'"/>'); }
  for(const m of (input.bars||[]).slice().sort((a,b)=>a.t-b.t)){ if(FCPXML.frames(m.t,r)>=durF) continue;
    L.push('                            <marker start="'+media(m.t)+'" duration="'+oneFrame+'" value="'+E(m.label)+'"/>'); }
  L.push('                        </asset-clip>','                    </spine>','                </sequence>','            </project>','        </event>','    </library>','</fcpxml>','');
  return L.join("\n");
};

root.FCPXML=FCPXML;
})(typeof window!=="undefined"?window:globalThis);
