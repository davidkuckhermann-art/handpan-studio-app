/* THE CLICK EAR — snaps and claps, for table practice (designed 20 Sep 2026;
   HANDOVER.md has the rules David settled). Not yet loaded by the app: the
   bench (bench/clicks/run.js) judges it on his takes first.

   THE RULE, ONE SENTENCE: a click is an attack that vanishes far faster than
   this player's own pan strokes do. A pan stroke rings on; a snap or a clap
   arrives from nothing and is gone a tenth of a second later. Both halves are
   measured against the signal itself — the rise over what stood just before,
   the drop from the peak to what stands after — so the microphone's level and
   colour do not enter (David, 20 Sep: "users will have very different kinds
   of microphones and also handpans"). BRIGHTNESS IS NOT THE TEST: on his own
   takes his claps were darker than his taks.
   "This player's own": an attack the pitch ear NAMED (stroke(t)) that did not
   vanish is a pan stroke, and a click must vanish `margin` dB beyond what
   those strokes typically do, never less than `dropMin`. The pitch ear's
   names do two things only: they teach that bar, and a named stroke among
   four clicks means the four were playing, not a count-in.

   One click means nothing — a mouse button and a bumped stand pass the test.
   THE PATTERN is the signal, and the caller says which one it waits for:
     mode "listen": four even clicks, no pan stroke among them  -> {type:"count",bpm,next}
     mode "play":   two quick clicks                            -> {type:"stop"}

   The input is what the app's short AnalyserNode gives each tick (2048
   Blackman, dB, every 512 samples) — transcribe.js's makeFFT is the same
   frame, which is how the bench feeds it. */
const HPC=(()=>{
  const DEF={lo:200, hi:12000,      // the band the level is read in: above the pan's body, where a ringing note holds least
    riseMin:12,                     // dB over the level 50–90 ms before: an attack at all
    after:[0.10,0.14],              // where "after" is read, seconds past the peak
    dropMin:12, margin:5,           // a click drops at least this, and this much beyond the player's strokes
    learn:40, pct:0.9,              // the strokes remembered, and which of their drops stands for "typically"
    refractory:0.10,
    even:0.15, gapMin:0.3, gapMax:1.5,   // the count-in: each gap within 15 % of the mean, 40–200 quarter notes a minute
    pairMin:0.12, pairMax:0.6,           // the stop: two clicks this far apart
    muteWin:0.07};                       // how wide a sound the app made itself is ignored (STAGE B): its own
                                         // click lasts ~30 ms, and while the music runs EVERY metronome beat is muted
  function create(opt){
    const o=Object.assign({},DEF,opt||{});
    const ring=[], open=[], clicks=[], strokes=[], drops=[], log=[], muted=[];
    let mode="listen", lastPeak=-1, fired=-1, pair=o.pairMax;
    const level=(db,binHz)=>{ let s=0; const a=Math.max(1,Math.floor(o.lo/binHz)), b=Math.min(db.length-1,Math.ceil(o.hi/binHz)); for(let i=a;i<=b;i++) s+=Math.pow(10,db[i]/10); return 10*Math.log10(s+1e-14); };
    const typical=()=>{ if(drops.length<4) return -Infinity; const s=drops.slice().sort((a,b)=>a-b); return s[Math.min(s.length-1,Math.floor(o.pct*s.length))]; };
    const need=()=>Math.max(o.dropMin,typical()+o.margin);
    const isStroke=t=>strokes.some(u=>Math.abs(u-t)<0.07);
    function pattern(now){
      if(mode==="play"){
        const n=clicks.length; if(n<2) return null;
        const a=clicks[n-2], b=clicks[n-1], g=b.t-a.t;
        if(b.t>fired&&g>=o.pairMin&&g<=pair){ fired=b.t; return {type:"stop",t:b.t,at:now}; }
        return null;
      }
      const n=clicks.length; if(n<4) return null;
      const c=clicks.slice(n-4), g=[c[1].t-c[0].t,c[2].t-c[1].t,c[3].t-c[2].t], m=(g[0]+g[1]+g[2])/3;
      if(c[3].t<=fired||m<o.gapMin||m>o.gapMax||g.some(x=>Math.abs(x-m)>o.even*m)) return null;
      if(strokes.some(u=>u>c[0].t+0.07&&u<c[3].t-0.07&&!c.some(k=>Math.abs(k.t-u)<0.07))) return null;   // a pan note among them — one that is not a click the pitch ear misnamed: that was playing
      /* the beat is the line through the four, not the last gap: one late snap moves it a quarter as far */
      const beat=(-3*c[0].t-c[1].t+c[2].t+3*c[3].t)/10, t0=(c[0].t+c[1].t+c[2].t+c[3].t)/4-1.5*beat;
      fired=c[3].t; return {type:"count",t:c[3].t,at:now,bpm:60/beat,beat,next:t0+4*beat};
    }
    return {
      /* THE BEAT, once the music runs: a stop is two claps CLOSER TOGETHER than the beat — without that,
         the metronome's own clicks, exactly one beat apart, would stop the playback they are counting. */
      setMode(m,beat){ mode=m; clicks.length=0; pair=(beat>0)?Math.min(o.pairMax,0.75*beat):o.pairMax; },
      /* THE APP MADE THAT SOUND ITSELF (stage B): its metronome, its own count-in clicks, the moment
         after a press. A click inside such a window is not the student's and is never counted. */
      mute(t,win){ muted.push({t,w:win||o.muteWin}); while(muted.length>64) muted.shift(); },
      stroke(t){ strokes.push(t); if(strokes.length>200) strokes.shift(); },    // the pitch ear named a pan note at t
      /* one tick: the time of the frame's END and its dB spectrum; returns a pattern or null */
      push(now,db,binHz){
        const L=level(db,binHz); ring.push({t:now,L}); while(ring.length&&ring[0].t<now-0.5) ring.shift();
        const n=ring.length;
        if(n>=3){                                                              // a peak one tick back, risen out of what stood before it
          const p=ring[n-2];
          if(p.L>ring[n-1].L&&p.L>=ring[n-3].L&&p.t-lastPeak>=o.refractory){
            const pre=ring.filter(r=>r.t>=p.t-0.09&&r.t<=p.t-0.05);
            if(pre.length){ const before=pre.reduce((s,r)=>s+r.L,0)/pre.length;
              if(p.L-before>=o.riseMin){ lastPeak=p.t; open.push({t:p.t,L:p.L,rise:p.L-before,acc:[]}); }
              else if(o.onNear&&p.L-before>=o.riseMin/3) try{ o.onNear(p.t,p.L-before,o.riseMin); }catch(e){}
            }
          }
        }
        let out=null;
        for(const a of open){ if(now>=a.t+o.after[0]&&now<=a.t+o.after[1]) a.acc.push(L); }
        while(open.length&&now>open[0].t+o.after[1]){
          const a=open.shift(); if(!a.acc.length) continue;
          const drop=a.L-a.acc.reduce((s,v)=>s+v,0)/a.acc.length, bar=need();
          /* THE VANISHING IS JUDGED FIRST (the bench's simulation, 20 Sep): in a poor signal the pitch ear names
             some claps as pan notes. A name must not veto a click, and what vanished is never a stroke to learn
             from — that mistake drove the learned bar to 29–43 dB. */
          const click=drop>=bar, stroke=!click&&isStroke(a.t);
          log.push({t:a.t,rise:a.rise,drop,stroke,bar,click});
          if(stroke){ drops.push(drop); if(drops.length>o.learn) drops.shift(); }
          const own=click&&muted.some(m=>Math.abs(m.t-a.t)<=m.w);
          if(own) log[log.length-1].own=true;
          if(o.onJudge) try{ o.onJudge(log[log.length-1],mode,pair,clicks); }catch(e){}   // a diagnostic's window on every decision (20 Sep)
          if(click&&!own){ clicks.push({t:a.t}); if(clicks.length>8) clicks.shift();
            if(o.onClick) try{ o.onClick(a.t,clicks.length); }catch(e){}
            out=pattern(now)||out; }
        }
        return out;
      },
      log, DEF:o };
  }
  return {DEF,create};
})();
if(typeof module!=="undefined") module.exports=HPC;
