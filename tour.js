/* Handpan Studio — THE TOUR (David, 21 Sep 2026).
   A guided walk through the practice page, on the real app: a spotlight on the real control, one card, and
   the student DOES each thing before moving on (David: "For each thing that is explained, ask the user to
   actually operate that thing and try out the settings, the buttons, all of that"). The demonstration piece
   is Composition 1 Advanced from the Handpan Cookbook (his choice). It replaced the tutorial notes the same
   day ("we can get rid of the tutorial notes altogether"). Approved design: mockups-tutorial.html.

   ONE MECHANISM, in three sentences:
   - A step names its target as a list of candidates, and the spotlight falls on the FIRST one with a box on
     screen. That one rule walks a phone student through the menu (the menu button is lit until the menu is
     open, then the row inside it) and lets the library wait for its folder.
   - A step with nothing on screen to point at is skipped, and so is a "try it" step whose goal is already
     met when it opens; so a control that the test version's switches take away takes its step with it.
   - A "try it" step moves on by itself once its goal is met, read from the app's own state after every
     click and every 200 ms.
   Loaded after the app's script, so it reads the app's globals by name. THE WORDS ARE THE BLOCK BELOW, and
   only that block: David edits them.

   TWO SCRIPTS, ONE MECHANISM. The full app walks six chapters; the EMBED PLAYER (21 Sep, David: "create a
   short tour for the Embed Player as well … those functions that are currently part of the Embed Player")
   walks one short chapter of the controls that build has - no library, no Settings, no rooms. It keeps the
   LESSON's piece, never a demonstration piece, and its door is the ? in the header, because the embed has
   no Settings to put a Tour row in. */
(function(){
"use strict";
/* the gate stops the app's script with a throw, and its function declarations exist all the same, so ask
   for a value the script only reaches after the gate: in its dead zone, reading it throws */
/* `libPieces` is NOT asked for: the lesson player shakes it out with the rest of the library, and only the
   full app's tour ever loads a piece of its own. */
try{ if(!piece||!piece.sections||typeof $!=="function") return; }catch(e){ return; }

/* ======================================== THE WORDS ======================================== */
const CHAPTERS=[
  {id:"page", name:"The page",               mins:"1 min", desc:"The music, your pan, Play, and the parts of a piece"},
  {id:"lib",  name:"Find a piece",           mins:"1 min", desc:"The library, its folders, search, and your own copies"},
  {id:"prac", name:"Practise",               mins:"2 min", desc:"Half speed, count-in, metronome, the marker and loops"},
  {id:"nav",  name:"Move through the piece", mins:"1 min", desc:"Parts, tables, starting anywhere, full screen"},
  {id:"pan",  name:"Your pan, your scale",   mins:"2 min", desc:"Choose your pan and play the piece on it"},
  {id:"look", name:"Make it yours",          mins:"1 min", desc:"Table or Tab, chords, note names, Settings"}];

const TEXT={
  "ui": {next:"Next", back:"Back", skip:"Skip", nextChapter:"Next chapter", finish:"Finish", stopHere:"Stop here",
         nice:"✓ Nice", leave:"Leave the tour", show:"Show me around", notNow:"Not now", close:"Close",
         left:"The tour is waiting for you in Settings, under Help", leftPhone:"The tour is waiting for you in the menu"},
  "sheet.welcome": {title:"Welcome to HPD Handpan Studio",
    body:"Hi, this is David. I'd love to show you around and show you the main functionalities of the app. It takes about a minute, and you'll be playing along the whole time.",
    foot:"You can take the tour any time: Settings, then Help.", phoneFoot:"You can take the tour any time from the menu."},
  "sheet.menu": {title:"The tour", body:"Six short chapters. Take them in order, or just the one you need."},
  "sheet.finish": {title:"That's the tour 🙏", body:"You've seen everything the practice page can do. Now comes the best part: playing. Have great practice!"},

  /* 1 · The page */
  "page.piece":    {title:"Our piece for the tour", body:"I've opened Composition 1 Advanced from the Handpan Cookbook for you. We'll use it all the way through, so you can try everything right away."},
  "page.notation": {title:"This is the music", body:"Every number is a note on your pan, and D is the ding in the middle. Green numbers are for your left hand, black ones for your right. Read it like a sentence: left to right, row by row."},
  "page.pan":      {title:"And this is your pan", body:"The same numbers, sitting where they are on your instrument. While the music plays, the notes light up here.", try:"Tap any note to hear it"},
  "page.play":     {title:"Let's hear it", body:"Watch the marker walk through the notation while the pan lights up with it.", try:"Press Play"},
  "page.stop":     {title:"And stop", body:"The same button stops the music.", try:"Press it again to stop"},
  "page.tempo":    {title:"Find your tempo", body:"This is the speed of the piece. Swipe up or down on it, or tap it and type a number. There's no prize for fast; the right tempo is the one where it feels easy.", try:"Change the tempo"},
  "page.parts":    {title:"The parts of the piece", body:"A piece is built from parts, like A and B. Tapping/clicking a part shows it to you. You always see one part at a time, so the page never gets crowded.", try:"Tap B"},
  "page.cell":     {title:"Now choose where to start", body:"Tap into the notation, right on the note where you'd like to begin. The marker jumps there. That's how you practise the middle of a piece without sitting through the beginning.", try:"Tap the first note of B"},
  "page.playfrom": {title:"Play from here", body:"Play now starts right where the marker is.", try:"Press Play"},
  "page.end":      {title:"That's the heart of it", body:"Stop the music whenever you like. The rest of the tour shows you how to find pieces, practise slowly and play on your own pan. It's always waiting in Settings, under Help.",
                    phoneBody:"Stop the music whenever you like. The rest of the tour shows you how to find pieces, practise slowly and play on your own pan. It's always waiting in the menu."},

  /* 2 · Find a piece */
  "lib.open":    {title:"Your library", body:"Every piece you can play lives in here.", try:"Open the Library"},
  "lib.folders": {title:"Folders", body:"My courses come first, with the pieces in lesson order. Then the collections, and at the bottom your own pieces.", try:"Tap Traditionals"},
  "lib.search":  {title:"Search", body:"Type a word from a title or a lesson number, and every folder is searched at once.", try:"Type simple"},
  "lib.pick":    {title:"Open a piece", body:"The line under each title tells you how long the piece is and which pan it was written for. VIDEO means there's a lesson that goes with it.", try:"Tap Composition 1 - Simple"},
  "lib.back":    {title:"And back again", body:"Now let's go back to our piece. Open the Library once more and find Composition 1 Advanced in the Handpan Cookbook.", try:"Open Composition 1 Advanced"},
  "lib.io":      {title:"Your own copies", body:"Save current piece keeps a piece in My pieces, with your pan and your tempo. Import / Export moves pieces between your devices, or sends one to a friend as a link.", try:"Tap Import / Export to have a look"},
  "lib.end":     {title:"That's the library", body:"Whatever you save shows up under My pieces, right next to my courses."},

  /* 3 · Practise */
  "prac.half":     {title:"Half speed", body:"This is my favourite button for a tricky passage. One tap and the whole piece plays at half the tempo.", try:"Press ½, then Play"},
  "prac.full":     {title:"Back to full speed", body:"Tap ½ again and you're back at your tempo.", try:"Press ½ again"},
  "prac.count":    {title:"Count-in", body:"With Count-in on, you get one bar of clicks before the music starts. Time to get your hands on the pan.", try:"Switch on Count-in, then press Play"},
  "prac.met":      {title:"Metronome", body:"A click on every beat while the music plays. It keeps you steady.", try:"Switch the metronome on"},
  "prac.mark":     {title:"What the marker follows", body:"The marker can step through the music note by note, or in bigger steps: by the beat, the half bar or the whole bar. Bigger steps are calmer once you know a piece.", try:"Open this menu and choose Bar"},
  "prac.loop":     {title:"Loop a passage", body:"Drag across the notation, over a few beats or a whole row. Only that part will repeat, as often as you need it.",
                    phoneBody:"Double-tap a row of the notation. Only that row will repeat, as often as you need it.", try:"Make a loop"},
  "prac.loopplay": {title:"Play the loop", body:"The orange frame shows what repeats. Play along until it feels easy.", try:"Press Play"},
  "prac.loopoff":  {title:"Let it go", body:"When you've got it, this button clears the loop, and the whole piece plays again.", try:"Clear the loop"},
  "prac.end":      {title:"That's practising", body:"When you leave the tour, half speed, count-in, the metronome and the marker go back to how you had them. Now you know where to find them."},

  /* 4 · Move through the piece */
  "nav.parts":  {title:"Where you are", body:"The dark part is the one you're looking at. When the music comes back, so do the letters: this piece goes A, B, A, B.", try:"Tap the second A"},
  "nav.tables": {title:"Tables", body:"A long part is split into tables of four rows. The numbers take you from one to the next.", try:"Tap 3"},
  "nav.cell":   {title:"Put the marker there", body:"Showing a table doesn't move the marker yet. Tap into the notation where you want to start, and the marker jumps there. A second tap on the table's number takes it to the top of the table.", try:"Tap a note in this table"},
  "nav.play":   {title:"Start anywhere", body:"And Play starts from exactly that spot.", try:"Press Play"},
  "nav.fs":     {title:"Full screen", body:"Just the notation, as big as your screen allows. Lovely on a music stand.", try:"Press full screen"},
  "nav.fsback": {title:"And back", body:"The same button brings you back. Esc works too.", try:"Leave full screen"},
  "nav.end":    {title:"That's moving around", body:"A part to see it, a table to narrow it down, a tap in the notation to say where to start: that's all you need to find your way through any piece."},

  /* 5 · Your pan, your scale */
  "pan.badge":   {title:"Written for one pan", body:"Every piece is written for one particular pan. This one is for a D Kurd, and it says so up here."},
  "pan.open":    {title:"Which pan do you play?", body:"Let's tell the app about your pan.", try:"Tap My pan", phoneBody:"Let's tell the app about your pan. It lives in the drawer at the bottom: pull it up by the little handle.", phoneTry:"Pull up the drawer, then tap the pan's name"},
  "pan.hear":    {title:"Hear a scale first", body:"Every scale has a little play button. Tap it and you'll hear the whole pan, from the lowest note to the highest.", try:"Tap ▸ next to any scale"},
  "pan.loopb":   {title:"One phrase, over and over", body:"Before we put other pans under it, I have looped the B section. Every instrument we try from here plays exactly the same music, so what you hear changing is the pan and not the piece."},
  "pan.choose":  {title:"Now choose", body:"This piece is written for a D Kurd, so let's put a different pan under it: choose B2 Amara 9, and watch the notation change under your hands. You can always come back to your own.", try:"Choose B2 Amara 9"},
  "pan.written": {title:"First, as it is written", body:"As written keeps my numbers exactly as they are, on your pan. Press Play and listen: the same fingering, but a different tune, because your scale has different notes in those places.", try:"Tap As written, then press Play", phoneTry:"Tap As written in the drawer, then press Play"},
  "pan.mine":    {title:"Now For my pan", body:"For my pan moves the whole piece onto your instrument instead, keeping the music and changing the numbers. Switch between the two as often as you like; nothing gets lost.", try:"Tap For my pan", phoneTry:"Tap For my pan in the drawer"},
  "pan.moved":   {title:"What the card tells you", body:"This card gives you the honest arithmetic: how many notes land exactly on your pan, and whether one had to stand in for a note you do not have. The percentage is how much of the music survived the move."},
  "pan.play":    {title:"And hear the difference", body:"Press Play once more. Same piece, your pan. This is what all the transposing is for.", try:"Press Play"},
  "pan.ashaki":  {title:"Now something quite different", body:"C Ashakiran 17 is a major scale, a long way from a D Kurd. It is not in the Common list, so tap All first. Then, on the C Ashakiran row, tap 17 for the size with the bottom notes, and tap the row to take it.", try:"Tap All, then 17 on the C Ashakiran row"},
  "pan.ashwritten":{title:"As written, on a major pan", body:"The same numbers again, on a major instrument. Press Play and hear what the piece becomes when nothing is moved.", try:"Tap As written, then press Play", phoneTry:"Tap As written in the drawer, then press Play"},
  "pan.ashmode": {title:"Root to root, or same mode", body:"Now For my pan, and look at the card: there are two ways to move a piece. Root to root puts my central note on yours. Same mode lands a minor piece where this pan is minor, which is what keeps the tune on a major pan like this one, and the app often chooses it for you here.", try:"Tap For my pan, and see which way the card chose"},
  "pan.ashlisten":{title:"And listen again", body:"The same phrase, a major instrument, still the piece I wrote. That is the transposing doing its best work.", try:"Press Play"},
  "pan.own":     {title:"Not in the list?", body:"If your pan isn't in the list, you can describe it yourself under My pans.", try:"Open My pan, then tap My pans", phoneTry:"Open the pan list from the drawer, then tap My pans"},
  "pan.ownrow":  {title:"Your own pan", body:"Tap here to type in your pan's notes, lowest first. The drawing builds itself as you type, and you can drag each note to where it sits on your instrument."},
  "pan.end":     {title:"One last thing", body:"If you picked a pan just to try it out, choose your own one again under My pan. And when you open a piece written for another pan, the app moves to that pan and tells you so."},

  /* 6 · Make it yours */
  "look.tab":      {title:"Table or Tab", body:"Two ways to read the same music. Tab gives each hand its own lane, and some people find that easier to follow.", try:"Tap Tab"},
  "look.table":    {title:"Back to Table", body:"Table is the notation you know from my courses.", try:"Tap Table"},
  "look.chords":   {title:"Chords", body:"This button shows the chord of each bar, right in the notation. Tap it to switch the chords on or off.", try:"Tap Chords",
                    phoneBody:"Swipe the pan to the side and you'll see the chord of each bar instead.", phoneTry:"Swipe the pan to the side, or tap the left dot"},
  "look.pan":      {title:"And the pan again", body:"Swipe back to bring your instrument back.", try:"Swipe back, or tap the right dot"},
  "look.panmenu":  {title:"Your pan, your way", body:"This little button holds the settings for the pan drawing.", try:"Open it"},
  "look.notes":    {title:"Numbers or note names", body:"Choose Notes to show the note names big, or Numbers for the numbers. Try both and keep the one you like.", try:"Tap Notes or Numbers"},
  "look.settings": {title:"Settings", body:"Light or dark, the colours of the hands, and a few more things live in here.", try:"Open Settings",
                    phoneBody:"Light or dark, the colours of the hands, and a few more things live in the menu.", phoneTry:"Open the menu"},
  "look.tour":     {title:"And the tour", body:"This tour lives here too. Come back whenever you like and take any chapter again."},

  /* THE EMBED PLAYER'S OWN SHORT TOUR (David, 21 Sep 2026) — the player under a lesson video. It covers only
     what that build carries: no library, no Settings, no rooms. It runs on the LESSON's piece, never on a
     demonstration piece of its own. */
  "sheet.emb":     {title:"A quick look around", body:"Hi, this is David. This little player shows the notation for the piece in this lesson, and it follows my video as it plays. Shall I show you what it can do? It takes about a minute.",
                    foot:"You can start it again any time with the ? above."},
  "sheet.embEnd":  {title:"That's it 🙏", body:"Follow video to play along with me, Follow off to work on a passage in your own time. That one switch is the whole thing. The ? in the corner brings this back whenever you want it."},
  "emb.notation":  {title:"The music", body:"Every number is a note on your pan, and D is the ding in the middle. Green numbers are for your left hand, black ones for your right."},
  "emb.follow":    {title:"The player follows the video", body:"This is switched on while you watch: as my video plays, the marker walks through the notation with me, so you can always see where we are. Play here starts and stops the video itself.",
                    try:"Tap Follow video to see it lit"},
  "emb.sound":     {title:"Two sounds, one at a time", body:"The video and the pan take turns. While you can hear me, the pan stays quiet. Mute the video up in the lesson and the player asks whether you would like the pan's sound instead; you can also switch it on here whenever you want it.",
                    try:"Switch the pan's sound on"},
  "emb.followoff": {title:"Using the player on its own", body:"Everything so far happened with my video in charge of the timing. Switch Follow off and the player is yours alone: your own tempo, half speed, the little helpers and looping all wake up. Switch it back on whenever you want to come back to me.",
                    try:"Switch Follow off"},
  "emb.followback":{title:"Back to the video", body:"Follow video puts you back with me: the marker walks with the lesson again, and Play starts the video. That is the switch to remember, more than any other here.",
                    try:"Switch Follow back on"},
  "emb.videosound":{title:"My video, the player's sound", body:"With the video running and the sound coming from here, some nice things open up. Slow my video down in its own controls and my playing goes deep and strange, but the pan keeps its natural sound and simply plays along slower with me. There is more of this later on."},
  "emb.pan":       {title:"Your pan, beside it", body:"The same numbers where they sit on the instrument. They light up as the piece plays.", try:"Tap any note to hear it"},
  "emb.play":      {title:"Play it", body:"The marker walks through the notation while the pan lights up with it. The same button stops.", try:"Press Play"},
  "emb.tempo":     {title:"Your tempo", body:"Swipe up or down on the number, or tap it and type. Take the piece as slowly as you need it.", try:"Change the tempo"},
  "emb.half":      {title:"Half speed", body:"My favourite button for a tricky passage: one tap and everything plays at half the tempo. Tap it again to come back.", try:"Press ½"},
  "emb.extras":    {title:"Three small helpers", body:"Count-in gives you a bar of clicks before the music starts. The metronome clicks on every beat. The last one sets how the marker steps through the music.", try:"Switch on Count-in"},
  "emb.loop":      {title:"Loop a passage", body:"Drag across the notation, over a few beats or a whole row, and only that part repeats. The button beside Play clears it again.",
                    phoneBody:"Double-tap a row of the notation and only that row repeats. The button beside Play clears it again.", try:"Make a loop"},
  "emb.navigate":  {title:"Move around, and the video comes with you", body:"A piece is built from parts, with the table numbers beside them. Tap a part, a table, or straight into the notation: while the player is following, my video jumps to that spot too. That is how you play one passage of the lesson over and over without touching the video.",
                    try:"Tap a part, or a note in the notation"},
  "emb.videoback": {title:"Hear the original again", body:"Turn my video's sound back up in its own controls and let it run. The pan steps aside by itself, because the two always take turns, so what you hear now is exactly what I played, with the notation following along.",
                    try:"Turn my sound back on and listen"},
  "emb.ownscale":  {title:"And now in your scale", body:"Now turn my sound down again and switch the pan's sound back on here. Same lesson, same passage, my video keeping the time, and you hear it on the C Ashakiran you chose. That is the whole trick of this little player."},
  "emb.loopb":     {title:"One phrase, over and over", body:"Before we put other pans under it, I have looped the B section. Every instrument we try from here plays exactly the same music, so what you hear changing is the pan and not the piece."},
  "emb.mypan":     {title:"Put another pan under it", body:"This piece is written for a D Kurd. Let's pretend you play something else: open My pan and choose B2 Amara 9, and watch the notation change under your hands.", try:"Choose B2 Amara 9"},
  "emb.written":   {title:"First, as it is written", body:"As written keeps my numbers exactly as they are, on your pan. Press Play and listen: the same fingering, but a different tune, because your scale has different notes in those places.", try:"Tap As written, then press Play"},
  "emb.mine":      {title:"Now For my pan", body:"For my pan moves the whole piece onto your instrument instead, keeping the music and changing the numbers.", try:"Tap For my pan"},
  "emb.report":    {title:"What the card tells you", body:"A card comes up at the bottom with the honest arithmetic: how many notes land exactly on your pan, and whether one had to stand in for a note you do not have. The percentage is how much of the music survived the move."},
  "emb.listen":    {title:"And hear the difference", body:"Press Play once more. Same piece, same lesson, your pan. This is what all of it is for.", try:"Press Play"},
  "emb.ashaki":    {title:"Now something quite different", body:"C Ashakiran 17 is a major scale, a long way from a D Kurd. It is not in the Common list, so tap All first. Then, on the C Ashakiran row, tap 17 for the size with the bottom notes, and tap the row to take it.", try:"Tap All, then 17 on the C Ashakiran row"},
  "emb.ashwritten":{title:"As written, on a major pan", body:"The same numbers again, on a major instrument. Press Play and hear what the piece becomes when nothing is moved.", try:"Tap As written, then press Play"},
  "emb.ashmode":   {title:"Root to root, or same mode", body:"Now For my pan, and look at the card: there are two ways to move a piece. Root to root puts my central note on yours. Same mode lands a minor piece where this pan is minor, which is what keeps the tune on a major pan like this one, and the app often chooses it for you here.", try:"Tap For my pan, and see which way the card chose"},
  "emb.ashlisten": {title:"And listen again", body:"The same phrase, a major instrument, still the piece I wrote. That is the transposing doing its best work.", try:"Press Play"},
  "emb.sides":     {title:"What sits beside the music", body:"The pan, the chord of each bar, or nothing at all when you want only the notation.", try:"Tap Chords"},
  "emb.views":     {title:"Table, Tab or Flow", body:"Three ways to read the same music. Tab gives each hand its own lane; Flow lets the music run on and wrap like text.", try:"Tap Tab"},
  "emb.fs":        {title:"Full screen", body:"Just the notation, as big as your screen allows. Good when the pan is in your lap.", try:"Press full screen"}
};
/* ===================================== END OF THE WORDS ===================================== */

const DEMO="composition-2", DEMO_TITLE="Composition 1 Advanced";   // Handpan Cookbook 2.14
const phone=()=>typeof PHONE!=="undefined"&&PHONE&&!(typeof TABLET!=="undefined"&&TABLET);
const isOpen=id=>{ const d=$(id); return !!(d&&d.open); };
const partIs=b=>typeof viewSec==="string"&&baseOf(viewSec).base===b;
const inRun=i=>{ const r=arrRuns()[i]; return !!(r&&r.ais.includes(selAi)); };
const parkedIn=b=>pendingStart!=null&&arrRuns().some(r=>r.base===b&&pendingStart>=r.from&&pendingStart<r.to);
const byText=(sel,t)=>()=>[...document.querySelectorAll(sel)].find(e=>box(e)&&e.textContent.includes(t));
const titled=(sel,t)=>()=>[...document.querySelectorAll(sel)].find(e=>{ const b=e.querySelector("b"); return box(e)&&b&&b.textContent.trim()===t; });
const clicked=sel=>T.clicks.some(t=>t&&t.closest&&t.closest(sel));
const HEAR='#ppList .ppv[aria-label^="Hear"]';

/* THE SCALE DEMONSTRATION RUNS OVER ONE PHRASE (David, 21 Sep: "for this whole demonstration of the different
   scales, let's loop the B1 section of the tune"), so what changes from pan to pan is the instrument and not
   the passage. B1 by name where the piece has one - a lesson's piece may not - then the first B, then the
   second table, then whatever there is. */
function loopPhrase(){
  try{
    const es=arrEntries(); if(!es||!es.length) return;
    const e=es.find(x=>x.nm==="B1")||es.find(x=>baseOf(x.nm).base==="B")||es[1]||es[0];
    if(typeof pinView==="function") pinView(e.ai,piece.arrangement[e.ai]);
    if(typeof render==="function") render();
    loopSec={from:e.from,to:e.to};
    if(typeof paintLoopFrame==="function") paintLoopFrame();
    if(typeof reanchorLoop==="function") reanchorLoop();
    if(typeof goTo==="function") goTo(e.from,e.to);
  }catch(err){}
}
function clearLoop(){ try{ if(loopSec){ loopSec=null; if(typeof paintLoopFrame==="function") paintLoopFrame();
  if(typeof reanchorLoop==="function") reanchorLoop(); } }catch(e){} }
/* the card's two ways to move a piece; Same mode is greyed when both give the same shift, and then the step
   has nothing to ask for */
/* THE PICKER LISTS ONE ROW PER SCALE, with the builds as size chips inside it, so "C Ashakiran 17" is the 17
   chip on the C Ashakiran row and then the row itself. These two give the spotlight that gesture in order; both
   answer null when the row is not listed at all, and the All filter below them is then what is lit. */
const buildChip=(scale,size)=>()=>{ const c=document.querySelector('#ppList .ppbuilds button[aria-label="'+scale+' '+size+'"]');
  return c&&!/\blit\b/.test(c.className)?c:null; };
const builtRow=(scale,size)=>()=>{ const c=document.querySelector('#ppList .ppbuilds button[aria-label="'+scale+' '+size+'"]');
  return c&&/\blit\b/.test(c.className)?c.closest(".pprow"):null; };
const howMode=()=>{ try{ return mode==="trans"&&(!REPORT||!REPORT.howMatters||REPORT.how==="mode"); }catch(e){ return false; } };

/* ======================================== THE STEPS ========================================
   at: candidates, first with a box wins · done: the goal of a "try it" step · hold: ms to let it be heard
   need: a dialog the step lives in, opened by its door when the step opens · enter: run when the step opens
   anywhere: no target on screen is fine (the card then sits in the middle) */
const DLIB={dlg:"libDlg",door:"#shareBtn"}, PICK={dlg:"panPickDlg",door:"#myPanBtn"}, PANMENU={dlg:"panMenuDlg",door:"#panmenu"};
const STEPS=[
  {id:"page.piece",    ch:"page"},
  {id:"page.notation", ch:"page", at:["#score"]},
  {id:"page.pan",      ch:"page", at:["#panbox","#pvsvg"], done:()=>clicked(".pvf")},
  {id:"page.play",     ch:"page", at:["#playBtn"], done:()=>playing, hold:3500},
  {id:"page.stop",     ch:"page", at:["#playBtn"], done:()=>!playing},
  {id:"page.tempo",    ch:"page", at:["#bpmCtl"], enter:()=>{ T.bpm0=bpm; }, done:()=>bpm!==T.bpm0, hold:1500},
  {id:"page.parts",    ch:"page", at:['#arrChips .chip[data-base="B"]',"#arrChips"], enter:stopPlay, done:()=>partIs("B")},
  /* SHOWING A PART DOES NOT MOVE THE PLAYHEAD (David, 21 Sep: "the student not only needs to tap the arrangement
     pill to move the playhead, but also needs to tap into the notation itself"). A tap in the notation parks it
     (pendingStart, set by seekToPulse while stopped), and Play starts there. */
  {id:"page.cell",     ch:"page", at:["#score"], enter:stopPlay, done:()=>clicked("#score")&&parkedIn("B"), hold:900},
  {id:"page.playfrom", ch:"page", at:["#playBtn"], done:()=>playing, hold:3500},
  {id:"page.end",      ch:"page", at:["#shareBtn"]},

  {id:"lib.open",    ch:"lib", at:["#shareBtn"], done:()=>isOpen("libDlg")},
  {id:"lib.folders", ch:"lib", need:DLIB, at:[byText("#libFolders .folder","Traditionals"),"#libFolders","#shareBtn"],
                     done:()=>[...document.querySelectorAll("#libFolders .folder.on")].some(b=>b.textContent.includes("Traditionals"))},
  {id:"lib.search",  ch:"lib", need:DLIB, at:["#libSearch","#shareBtn"], done:()=>/simp/i.test($("libSearch").value), hold:900},
  /* the phone's library opens on its folders and shows the pieces after one is tapped, so the folder is the
     candidate under the row - the same rule that lights the menu button until the menu is open */
  {id:"lib.pick",    ch:"lib", need:DLIB, at:[titled("#libList .pprow","Composition 1 - Simple"),byText("#libFolders .folder","Handpan Cookbook"),"#libList","#shareBtn"], done:()=>piece.id==="composition-1", hold:900},
  {id:"lib.back",    ch:"lib", at:[titled("#libList .pprow",DEMO_TITLE),byText("#libFolders .folder","Handpan Cookbook"),"#shareBtn"], done:()=>piece.id===DEMO, hold:900},
  {id:"lib.io",      ch:"lib", need:DLIB, at:["#libIO","#shareBtn"], done:()=>isOpen("ioDlg"), hold:1800},
  {id:"lib.end",     ch:"lib", enter:closeAll},

  {id:"prac.half",     ch:"prac", at:["#halfBtn"], done:()=>halfSpeed&&playing, hold:3000},
  {id:"prac.full",     ch:"prac", at:["#halfBtn"], done:()=>!halfSpeed},
  {id:"prac.count",    ch:"prac", at:["#countBtn"], enter:stopPlay, done:()=>countIn&&playing, hold:4500},
  {id:"prac.met",      ch:"prac", at:["#metBtn"], done:()=>metOn, hold:2500},
  {id:"prac.mark",     ch:"prac", at:['#markPop .it[data-v="bar"]',"#markBtn"], done:()=>markMode==="bar", hold:1200},
  {id:"prac.loop",     ch:"prac", at:["#score"], enter:stopPlay, done:()=>!!loopSec, hold:700},
  {id:"prac.loopplay", ch:"prac", at:["#playBtn"], done:()=>playing&&!!loopSec, hold:4000},
  {id:"prac.loopoff",  ch:"prac", at:["#loopBtn"], done:()=>!loopSec},
  {id:"prac.end",      ch:"prac", enter:stopPlay},

  {id:"nav.parts",  ch:"nav", at:[()=>{ const r=arrRuns()[2]; return r&&document.querySelector("#arrChips .chip[data-ai-"+r.ais[0]+"]"); },"#arrChips"], done:()=>inRun(2)},
  {id:"nav.tables", ch:"nav", at:[byText("#subChips .chip","3"),"#subChips"], done:()=>String(baseOf(viewSec).num)==="3"},
  {id:"nav.cell",   ch:"nav", at:["#score"], enter:()=>{ stopPlay(); T.ps0=pendingStart; }, done:()=>clicked("#score")&&pendingStart!=null&&pendingStart!==T.ps0, hold:900},
  {id:"nav.play",   ch:"nav", at:["#playBtn"], done:()=>playing, hold:3000},
  {id:"nav.fs",     ch:"nav", at:["#fsBtn"], enter:stopPlay, done:()=>fsOn(), hold:1500},
  {id:"nav.fsback", ch:"nav", at:["#fsBtn"], anywhere:true, done:()=>!fsOn()},
  {id:"nav.end",    ch:"nav", enter:stopPlay},

  /* THE PHONE KEEPS MY PAN AND THE TWO MODE PILLS IN THE DRAWER, not in the menu (the menu's rows are hidden
     there): #panSel, #modePos, #modeTrans. With the drawer down none of them has a box, so the spotlight falls
     on its grip and the card asks for the drawer - the candidate rule again, no second mechanism. */
  {id:"pan.badge",   ch:"pan", at:["#srcBadge"]},
  {id:"pan.open",    ch:"pan", at:["#myPanBtn","#panSel","#drawerGrip"], done:()=>isOpen("panPickDlg")},
  {id:"pan.hear",    ch:"pan", need:PICK, at:[HEAR,"#myPanBtn","#panSel","#drawerGrip"], done:()=>clicked(HEAR), hold:2500},
  {id:"pan.loopb",   ch:"pan", enter:()=>{ stopPlay(); loopPhrase(); }, at:["#score"]},
  /* the goal is THE PAN, not a change of pan: a student already on B2 Amara 9 could never satisfy
     "it is different from what you had", and the step would wait for ever (caught while testing) */
  {id:"pan.choose",  ch:"pan", need:PICK, at:[titled("#ppList .pprow","B2 Amara 9"),"#ppList","#myPanBtn","#panSel","#drawerGrip"],
                     done:()=>/^b2-amara/.test(myPanId), hold:900},
  {id:"pan.written", ch:"pan", at:[byText("#mpModeRow button","As written"),"#modePos2","#modePos","#drawerGrip"], done:()=>mode==="pos"&&playing, hold:5000},
  {id:"pan.mine",    ch:"pan", enter:stopPlay, at:[byText("#mpModeRow button","For my pan"),"#modeTrans2","#modeTrans","#drawerGrip"], done:()=>mode==="trans"},
  {id:"pan.moved",   ch:"pan", enter:()=>{ closeAll(); setMode("trans"); }, at:["#report"]},
  {id:"pan.play",    ch:"pan", at:["#playBtn"], done:()=>playing, hold:3500},
  /* and on to a major pan, the same two listens (David, 21 Sep) */
  {id:"pan.ashaki",  ch:"pan", enter:stopPlay, need:PICK,
                     at:[buildChip("C Ashakiran","17"),builtRow("C Ashakiran","17"),"#ppAll","#ppList","#myPanBtn","#panSel","#drawerGrip"],
                     done:()=>myPanId==="c-ashakiran-17", hold:900},
  {id:"pan.ashwritten",ch:"pan", enter:closeAll, at:[byText("#mpModeRow button","As written"),"#modePos2","#modePos","#drawerGrip"],
                     done:()=>mode==="pos"&&playing, hold:5000},
  {id:"pan.ashmode", ch:"pan", enter:stopPlay, at:['#report [data-how="mode"]',"#modeTrans2","#modeTrans","#report","#drawerGrip"], done:howMode},
  {id:"pan.ashlisten",ch:"pan", at:["#playBtn"], done:()=>playing, hold:5000},
  {id:"pan.own",     ch:"pan", enter:()=>{ stopPlay(); clearLoop(); }, at:["#ppMine","#myPanBtn","#panSel","#drawerGrip"],
                     done:()=>isOpen("panPickDlg")&&$("ppMine").getAttribute("aria-pressed")==="true"},
  {id:"pan.ownrow",  ch:"pan", at:[byText("#ppList button","My own pan")]},
  {id:"pan.end",     ch:"pan", enter:closeAll},

  {id:"look.tab",      ch:"look", at:["#viewTab"], done:()=>view==="tab"},
  {id:"look.table",    ch:"look", at:["#viewTable"], done:()=>view==="table"},
  {id:"look.chords",   ch:"look", at:["#chordBtn",'[aria-label="Show chords"]'], done:()=>phone()?(chordRowOn&&!panOn):clicked("#chordBtn")},
  {id:"look.pan",      ch:"look", at:['[aria-label="Show the pan"]'], done:()=>panOn},    // the phone's pager only: on the desktop both show at once
  {id:"look.panmenu",  ch:"look", at:["#panmenu"], done:()=>isOpen("panMenuDlg")},
  {id:"look.notes",    ch:"look", need:PANMENU, at:["#pmNotes","#panmenu"], done:()=>clicked("#pmNotes,#pmNums"), hold:1200},
  {id:"look.settings", ch:"look", enter:closeAll, at:["#setBtn","#menuBtn"], done:()=>isOpen("setDlg")||isOpen("menuDlg")},
  {id:"look.tour",     ch:"look", at:["#setTourBtn","#mTourBtn"]}
];

/* THE EMBED PLAYER'S SHORT SCRIPT — one chapter, the controls that build actually has. Same mechanism, same
   words block; what differs is the list. It runs on the LESSON's piece (see chapterStart), and its door is
   the ? in the header, because the player has no Settings. */
const EMB=[
  {id:"emb.notation", ch:"emb", at:["#score"]},
  /* THE EMBED OPENS IN FOLLOW (David, 21 Sep: "the app starts in video sync mode … you have to explain the
     interaction between the video and the player"). `?follow=1` arms it and the first timecode engages it. With
     no video at all — a player opened outside a lesson — #followBtn and #folMute have no box and the candidate
     rule drops every step that belongs to the video. */
  {id:"emb.follow",   ch:"emb", at:["#followBtn"]},
  /* the pan starts muted in an embed (followMuted = EMBEDDED), and the two players take turns */
  {id:"emb.sound",    ch:"emb", at:["#folMute"], done:()=>!followMuted, hold:1200},
  /* WHY THE PAN'S SOUND IS WORTH HAVING (David, 21 Sep): with the video's own controls at half speed his
     playing drops in pitch, while the pan is scheduled from the video's clock (vRate) and stays natural. No
     target: the video it talks about is outside the player, above it in the lesson. */
  {id:"emb.videosound",ch:"emb"},
  {id:"emb.pan",      ch:"emb", at:["#panbox","#pvsvg"], done:()=>clicked(".pvf")},
  /* navigating still works while the video is the clock, because seekToPulse seeks the recording too
     (David, 21 Sep: "navigating in the Embed player also will navigate the video") */
  {id:"emb.navigate", ch:"emb", at:["#arrChips"], enter:()=>{ T.ai0=selAi; }, done:()=>clicked("#score,#arrChips,#subChips")||selAi!==T.ai0, hold:900},
  /* and only now the controls the video's clock keeps out of reach */
  {id:"emb.followoff",ch:"emb", at:["#followBtn"], done:()=>!follow, hold:1200},
  {id:"emb.play",     ch:"emb", at:["#playBtn"], done:()=>playing, hold:3500},
  {id:"emb.tempo",    ch:"emb", at:["#bpmCtl"], enter:()=>{ stopPlay(); T.bpm0=bpm; }, done:()=>bpm!==T.bpm0, hold:1500},
  {id:"emb.half",     ch:"emb", at:["#halfBtn"], done:()=>halfSpeed},
  {id:"emb.extras",   ch:"emb", at:["#countBtn"], enter:()=>{ if(halfSpeed) $("halfBtn").click(); }, done:()=>countIn},
  {id:"emb.loop",     ch:"emb", at:["#score"], enter:stopPlay, done:()=>!!loopSec, hold:700},
  /* THE SCALE, DEMONSTRATED TWICE (David, 21 Sep: "have the student switch from D Kurd to E Amara, and first
     show what it sounds like when the composition is played as written. Afterwards, switch to for my pan,
     explain the transposition card and have the user listen to what a difference that makes"). It sits with
     Follow OFF, so Play is the player's own sound and the two listens can be compared. The pan is B2 Amara 9
     (David changed it from E Amara an hour later); it is in the picker's Common list, just under the Kurds.
     A pan's id names its SCALE and not its build, so the check matches by prefix. */
  {id:"emb.loopb",    ch:"emb", enter:()=>{ stopPlay(); loopPhrase(); }, at:["#score"]},
  {id:"emb.mypan",    ch:"emb", enter:stopPlay, at:["#myPanBtn","#panSel","#drawerGrip"], done:()=>/^b2-amara/.test(myPanId), hold:900},
  {id:"emb.written",  ch:"emb", enter:closeAll, at:["#modePos2","#modePos",byText("#mpModeRow button","As written"),"#drawerGrip"],
                      done:()=>mode==="pos"&&playing, hold:5000},
  {id:"emb.mine",     ch:"emb", enter:stopPlay, at:["#modeTrans2","#modeTrans",byText("#mpModeRow button","For my pan"),"#drawerGrip"], done:()=>mode==="trans"},
  {id:"emb.report",   ch:"emb", enter:()=>{ closeAll(); setMode("trans"); }, at:["#report"]},
  {id:"emb.listen",   ch:"emb", at:["#playBtn"], done:()=>playing, hold:5000},
  /* AND STRAIGHT ON TO A MAJOR PAN (David, 21 Sep: "the last one should be the C Ashakiran 17, which is a major
     scale … first … as written and then … transposed to the instrument (with the same mode option)"). Tier 3, so
     it is not in the picker's Common list: the All filter is the candidate under the row, and the card says so. */
  {id:"emb.ashaki",   ch:"emb", enter:stopPlay, need:PICK,
                      at:[buildChip("C Ashakiran","17"),builtRow("C Ashakiran","17"),"#ppAll","#ppList","#myPanBtn","#panSel","#drawerGrip"],
                      done:()=>myPanId==="c-ashakiran-17", hold:900},
  {id:"emb.ashwritten",ch:"emb", enter:closeAll, at:["#modePos2","#modePos",byText("#mpModeRow button","As written"),"#drawerGrip"],
                      done:()=>mode==="pos"&&playing, hold:5000},
  {id:"emb.ashmode",  ch:"emb", enter:stopPlay, at:['#report [data-how="mode"]',"#modeTrans2","#modeTrans","#report","#drawerGrip"], done:howMode},
  {id:"emb.ashlisten",ch:"emb", at:["#playBtn"], done:()=>playing, hold:5000},
  {id:"emb.sides",    ch:"emb", enter:()=>{ stopPlay(); clearLoop(); }, at:["#chordBtn",'[aria-label="Show chords"]'], done:()=>phone()?(chordRowOn&&!panOn):clicked("#chordBtn")},
  {id:"emb.views",    ch:"emb", at:["#viewTab"], done:()=>view==="tab"},
  {id:"emb.fs",       ch:"emb", at:["#fsBtn"], done:()=>fsOn(), hold:1500},
  /* it ends where it began: back with the video - and THAT is where the scale pays off (David, 21 Sep:
     "we can add the thing about the different scale at the end of the tutorial when you switch the follow
     video option back on") */
  {id:"emb.followback",ch:"emb", at:["#followBtn"], enter:stopPlay, done:()=>follow, hold:1200},
  /* THE SOUND GOES BACK TO THE VIDEO FIRST (David, 21 Sep: "let's first turn the sound of the video back on.
     Listen to the original, and then switch to the selected scale"). The video's own controls are outside this
     player, so the tour cannot police the first one: where the lesson's bridge reports the video's sound the
     step passes by itself (the app mutes the pan on that change), and otherwise the card is read and skipped.
     The last card has no goal at all - by then the student has the scale under the lesson, which is the point. */
  {id:"emb.videoback",ch:"emb", at:["#folMute","#score"],
                      done:()=>followMuted||(typeof vidMuted!=="undefined"&&vidMuted===false), hold:3000},
  {id:"emb.ownscale", ch:"emb", at:["#folMute","#panbox"]}
];
/* the lesson embed marks itself before first paint; its tour is the short one */
const PLAYER=document.documentElement.classList.contains("player");
const SEQ=PLAYER?EMB:STEPS;
const CHS=PLAYER?[{id:"emb", name:"This player", mins:"1 min", desc:"What everything here does"}]:CHAPTERS;

/* ======================================== THE ENGINE ======================================== */
const T={mode:"off", k:-1, ch:null, clicks:[], passed:false, token:0, snap:null, sig:"", iv:null, pan0:null, bpm0:null};
const canPop=typeof HTMLElement!=="undefined"&&"showPopover" in HTMLElement.prototype;
const store={ get(){ try{ return JSON.parse(localStorage.getItem("hps.tour")||"{}")||{}; }catch(e){ return {}; } },
              set(o){ try{ localStorage.setItem("hps.tour",JSON.stringify(o)); }catch(e){} } };
const h=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
function words(id){ const w=TEXT[id]||{}, p=phone();
  return {title:w.title||"", body:(p&&w.phoneBody)||w.body||"", try:(p&&w.phoneTry)||w.try||"", foot:(p&&w.phoneFoot)||w.foot||""}; }
const U=()=>TEXT.ui;
function ok(f){ try{ return !!f(); }catch(e){ return false; } }

function box(el){
  if(!el||!el.getClientRects||!el.getClientRects().length) return false;
  const r=el.getBoundingClientRect(); if(r.width<1||r.height<1) return false;
  return getComputedStyle(el).visibility!=="hidden";
}
function find(c){ if(typeof c==="function"){ let e=null; try{ e=c(); }catch(err){} return box(e)?e:null; }
  return [...document.querySelectorAll(c)].find(box)||null; }
function target(s){ if(!s||!s.at) return null; for(const c of s.at){ const e=find(c); if(e) return e; } return null; }

/* the layer: one element, a popover so it paints above the app's modal dialogs and the fullscreen notation.
   A modal dialog makes everything outside it inert, so the layer moves INTO whichever one is up. */
let L=null, spot=null, card=null;
function css(){
  const st=document.createElement("style"); st.id="tourCss"; st.textContent=`
#tourLayer{position:fixed;inset:0;width:auto;height:auto;max-width:none;max-height:none;margin:0;padding:0;border:0;background:transparent;
  overflow:visible;pointer-events:none;z-index:2147483000;display:none;color:#fff;font:14px/1.45 Figtree,"Helvetica Neue",Arial,sans-serif}
#tourLayer.on{display:block} #tourLayer::backdrop{display:none}
#tourLayer.dim{background:rgba(30,27,22,.55)} #tourLayer.block{pointer-events:auto}
#tourSpot{position:fixed;border-radius:12px;box-shadow:0 0 0 200vmax rgba(30,27,22,.55);outline:2.5px solid #E59315;pointer-events:none;
  transition:left .25s,top .25s,width .25s,height .25s}
#tourSpot.none{display:none}
#tourCard{position:fixed;box-sizing:border-box;pointer-events:auto;background:#1E1B16;color:#fff;border-radius:14px;padding:14px 16px 12px;
  border:1px solid rgba(255,255,255,.1);box-shadow:0 20px 50px -10px rgba(0,0,0,.55);transition:left .25s,top .25s;text-align:left}
#tourCard .tk{display:flex;justify-content:space-between;align-items:center;font-size:10.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#B9B0A1}
#tourCard .tx{background:none;border:0;color:#B9B0A1;font-size:17px;line-height:1;padding:2px 4px;margin:-4px -6px 0 0;cursor:pointer}
#tourCard h4{margin:6px 0 4px;font-size:16.5px;font-weight:700;color:#fff}
#tourCard p{margin:0;font-size:13.5px;line-height:1.5;color:#E9E3D8}
#tourCard .ttry{margin-top:9px;font-size:12.5px;font-weight:700;color:#FFD08A;display:flex;gap:7px;align-items:center}
#tourCard .ttry::before{content:"";flex:none;width:8px;height:8px;border-radius:50%;background:#E59315;animation:tourPulse 1.2s infinite}
#tourCard.passed .ttry{color:#9FD7A9} #tourCard.passed .ttry::before{display:none}
@keyframes tourPulse{50%{transform:scale(1.7);opacity:.4}}
#tourCard .tf{display:flex;align-items:center;gap:6px;margin-top:12px}
#tourCard .tpips{display:flex;gap:4px;flex:1;flex-wrap:wrap} #tourCard .tpips i{width:6px;height:6px;border-radius:3px;background:#4A453C}
#tourCard .tpips i.on{background:#fff;width:16px}
#tourCard .tb{border:0;border-radius:9px;padding:7px 13px;font:700 13px/1.2 inherit;cursor:pointer;white-space:nowrap}
#tourCard .tb.pri{background:#fff;color:#1E1B16} #tourCard .tb.sec{background:#3A352D;color:#fff} #tourCard .tb.gho{background:none;color:#CFC7B9;padding:7px 8px}
#tourCard.tsheet{background:var(--card,#fff);color:var(--ink,#1E1B16);padding:22px;border-color:var(--rule,#E4DCD0)}
#tourCard.tsheet h3{margin:0 0 6px;font-size:20px;color:var(--ink,#1E1B16)}
#tourCard.tsheet p{color:var(--ink2,#5E5749);font-size:14px;margin:0 0 14px}
#tourCard.tsheet .fine{font-size:12px;color:var(--ink3,#8D8578);margin:12px 0 0}
#tourCard .trow{display:flex;gap:8px;align-items:center}
#tourCard .tbig{border:0;border-radius:11px;padding:10px 16px;font:700 14px/1.2 inherit;cursor:pointer;background:var(--ink,#1E1B16);color:var(--card,#fff)}
#tourCard .tplain{border:1px solid var(--rule,#E4DCD0);border-radius:11px;padding:10px 16px;font:600 14px/1.2 inherit;cursor:pointer;background:var(--card,#fff);color:var(--ink,#1E1B16)}
#tourCard .tch{display:flex;align-items:center;gap:12px;padding:10px 4px;border:0;border-top:1px solid var(--rule2,#EFE9E0);width:100%;background:none;
  text-align:left;cursor:pointer;color:var(--ink,#1E1B16);font:inherit}
#tourCard .tch .n{width:26px;height:26px;border-radius:50%;border:1.5px solid var(--rule,#E4DCD0);display:grid;place-items:center;font-size:12px;font-weight:700;flex:none}
#tourCard .tch.done .n{background:var(--ink,#1E1B16);border-color:var(--ink,#1E1B16);color:var(--card,#fff)}
#tourCard .tch b{display:block;font-size:14px} #tourCard .tch small{font-size:12px;color:var(--ink3,#8D8578)}
#tourCard .tch .m{margin-left:auto;font-size:12px;color:var(--ink3,#8D8578);white-space:nowrap}`;
  document.head.appendChild(st);
}
function build(){
  if(L) return;
  css();
  L=document.createElement("div"); L.id="tourLayer";
  if(canPop) L.setAttribute("popover","manual");
  L.innerHTML='<div id="tourSpot" class="none"></div><div id="tourCard"></div>';
  document.body.appendChild(L); spot=L.firstChild; card=L.lastChild;
  card.addEventListener("click",onCard);
}
function popOpen(){ try{ return L.matches(":popover-open"); }catch(e){ return false; } }
function hostFor(el){
  const modals=[...document.querySelectorAll("dialog[open]")].filter(d=>{ try{ return d.matches(":modal"); }catch(e){ return false; } });
  return (el&&modals.find(d=>d.contains(el)))||modals[modals.length-1]
    ||document.fullscreenElement||document.webkitFullscreenElement||document.body;
}
function raise(el){
  const host=hostFor(el);
  if(L.parentElement!==host){ host.appendChild(L); T.sig=""; }
  if(!canPop) return;
  const sig=[...document.querySelectorAll("dialog[open]")].map(d=>d.id).join()+"|"+!!(document.fullscreenElement||document.webkitFullscreenElement);
  if(sig!==T.sig||!popOpen()){ try{ if(popOpen()) L.hidePopover(); L.showPopover(); }catch(e){} T.sig=sig; }
}
function showLayer(){ build(); L.classList.add("on"); raise(null); }
function hideLayer(){ if(!L) return; L.classList.remove("on","dim","block"); if(canPop&&popOpen()) try{ L.hidePopover(); }catch(e){} }

/* where the card goes: under the target, else over it, else beside it, else at the foot of the screen */
function place(){
  const s=SEQ[T.k]; if(T.mode!=="steps"||!s) return;
  const el=target(s);
  raise(el);
  const vw=innerWidth, vh=innerHeight, pad=6, gap=12, cw=Math.min(340,vw-20);
  card.style.width=cw+"px";
  const ch=card.offsetHeight;
  if(!el){ spot.className="none"; L.classList.add("dim");
    card.style.left=(vw-cw)/2+"px"; card.style.top=Math.max(10,(vh-ch)/2)+"px"; return; }
  L.classList.remove("dim"); spot.className="";
  const r=el.getBoundingClientRect();
  Object.assign(spot.style,{left:r.left-pad+"px",top:r.top-pad+"px",width:r.width+2*pad+"px",height:r.height+2*pad+"px"});
  let left=r.left+r.width/2-cw/2, top;
  if(r.bottom+pad+gap+ch<=vh-8) top=r.bottom+pad+gap;
  else if(r.top-pad-gap-ch>=8) top=r.top-pad-gap-ch;
  else { top=Math.min(Math.max(r.top,8),vh-ch-8);
    if(r.right+pad+gap+cw<=vw-8) left=r.right+pad+gap;
    else if(r.left-pad-gap-cw>=8) left=r.left-pad-gap-cw;
    else top=vh-ch-10; }
  card.style.left=Math.min(Math.max(left,10),vw-cw-10)+"px"; card.style.top=Math.max(8,top)+"px";
}
/* bring a target into view INSTANTLY and only as far as needed - a smooth scroll can be left half-way in a
   background tab, with the card chasing a moving target - and leave room for the spotlight's own border */
function bring(el){
  const m=26;
  let r=el.getBoundingClientRect();
  if(r.top<0||r.bottom>innerHeight) el.scrollIntoView({block:"nearest"});
  r=el.getBoundingClientRect();
  if(r.top<m) scrollBy(0,r.top-m);
  else if(r.bottom>innerHeight-m&&r.height<innerHeight-2*m) scrollBy(0,r.bottom-(innerHeight-m));
  place();
}
function tick(){
  if(T.mode!=="steps") return;
  const s=SEQ[T.k]; if(!s) return;
  place();
  if(s.done&&!T.passed&&ok(s.done)) pass(s);
}
function pass(s){
  T.passed=true; const tk=++T.token;
  card.classList.add("passed");
  const tr=card.querySelector(".ttry"); if(tr) tr.textContent=U().nice;
  setTimeout(()=>{ if(T.mode==="steps"&&tk===T.token) next(); },s.hold||800);
}
const lastOf=ch=>{ for(let i=SEQ.length-1;i>=0;i--) if(SEQ[i].ch===ch) return i; return -1; };

/* open step k, walking in direction dir past the steps that are not for this screen */
function open(k,dir){
  T.token++;
  for(;k>=0&&k<SEQ.length;k+=dir){
    const s=SEQ[k];
    if(s.ch!==T.ch) chapterStart(s.ch);
    if(s.need&&!isOpen(s.need.dlg)){ const d=document.querySelector(s.need.door); if(d) d.click(); }
    if(s.enter) try{ s.enter(); }catch(e){}
    if(s.at&&!s.anywhere&&!target(s)) continue;     // nothing here to point at: not a step for this screen
    if(s.done&&ok(s.done)) continue;                // its goal is met already
    T.k=k; T.clicks=[]; T.passed=false;
    paint(s); place();
    const el=target(s);
    if(el) bring(el);
    return;
  }
  if(k>=SEQ.length) finish();
}
function next(){
  const s=SEQ[T.k];
  if(s&&T.k===lastOf(s.ch)) markDone(s.ch);
  if(T.k>=SEQ.length-1){ finish(); return; }
  open(T.k+1,1);
}
function markDone(ch){ const st=store.get(); st.done=[...new Set([...(st.done||[]),ch])]; store.set(st); }
function chapterStart(ch){
  T.ch=ch; closeAll(); stopPlay();
  if(typeof fsOn==="function"&&fsOn()&&typeof fsLeave==="function") fsLeave();
  /* THE EMBED PLAYER KEEPS THE LESSON'S PIECE. Its tour is about the player, and the student is here to
     play along with the video above it - opening a demonstration piece would take that away. */
  if(!PLAYER&&(!piece||piece.id!==DEMO)){ const p=libPieces().find(x=>x.id===DEMO); if(p) openPiece(p); }
  T.pan0=myPanId;
}
function paint(s){
  const w=words(s.id), ci=CHS.findIndex(c=>c.id===s.ch), mine=SEQ.filter(x=>x.ch===s.ch), n=mine.indexOf(s),
        last=T.k===lastOf(s.ch), u=U(), tries=!!(s.done&&w.try);
  card.className=""; T.passed=false;
  card.innerHTML='<div class="tk"><span>'+h(PLAYER?CHS[ci].name:(ci+1)+" · "+CHS[ci].name)+'</span><button class="tx" data-a="x" aria-label="'+h(u.leave)+'">✕</button></div>'
    +"<h4>"+h(w.title)+"</h4><p>"+h(w.body)+"</p>"
    +(tries?'<div class="ttry">'+h(w.try)+"</div>":"")
    +'<div class="tf"><span class="tpips">'+mine.map((x,i)=>"<i"+(i===n?' class="on"':"")+"></i>").join("")+"</span>"
    +(last?'<button class="tb gho" data-a="stop">'+h(u.stopHere)+"</button>":(n>0?'<button class="tb gho" data-a="back">'+h(u.back)+"</button>":""))
    +'<button class="tb '+(tries?"sec":"pri")+'" data-a="next">'+h(last?(ci<CHS.length-1?u.nextChapter:u.finish):(tries?u.skip:u.next))+"</button></div>";
}
function onCard(e){
  e.stopPropagation();
  const b=e.target.closest("[data-a],[data-ch]"); if(!b) return;
  if(b.dataset.ch){ start(b.dataset.ch); return; }
  const a=b.dataset.a;
  if(a==="x"){ leave(); toast(phone()?U().leftPhone:U().left); }
  else if(a==="stop"){ markDone(T.ch); leave(); toast(phone()?U().leftPhone:U().left); }
  else if(a==="back") open(T.k-1,-1);
  else if(a==="next") next();
  else if(a==="go") start();          // whichever script this build walks: six chapters, or the player's one
  else if(a==="close"||a==="later") leave();
}

/* what the tour switches for the student, it switches back */
function snapshot(){ return {half:halfSpeed, count:countIn, met:metOn, mark:markMode}; }
function stopPlay(){ if(typeof playing!=="undefined"&&playing) $("playBtn").click(); }
function closeAll(){
  document.querySelectorAll("dialog[open]").forEach(d=>{ try{ d.close(); }catch(e){} });
  if(typeof closePop==="function") try{ closePop(); }catch(e){}
}
function restore(){
  const s=T.snap; T.snap=null;
  stopPlay();
  if(typeof loopSec!=="undefined"&&loopSec) $("loopBtn").click();
  if(typeof fsOn==="function"&&fsOn()&&typeof fsLeave==="function") fsLeave();
  if(!s) return;
  if(halfSpeed!==s.half) $("halfBtn").click();
  if(countIn!==s.count) $("countBtn").click();
  if(metOn!==s.met) $("metBtn").click();
  if(markMode!==s.mark){ markMode=s.mark; try{ localStorage.setItem("hps.marker",markMode); }catch(e){} if(typeof clearMarks==="function") clearMarks(); }
}

function start(ch){
  ch=ch||CHS[0].id;
  if(T.mode!=="steps") T.snap=snapshot();
  showLayer(); L.classList.remove("block");
  T.mode="steps"; T.ch=null;
  clearInterval(T.iv); T.iv=setInterval(tick,200);
  open(SEQ.findIndex(s=>s.ch===ch),1);
}
function leave(){
  const wasSteps=T.mode==="steps";
  T.mode="off"; T.token++; clearInterval(T.iv); T.iv=null;
  if(wasSteps){ closeAll(); restore(); }
  T.ch=null; T.k=-1;
  hideLayer();
}
function sheet(html){
  if(T.mode==="steps"){ closeAll(); restore(); clearInterval(T.iv); }
  showLayer(); T.mode="sheet"; T.token++;
  L.classList.add("dim","block"); spot.className="none";
  card.className="tsheet"; card.innerHTML=html;
  const cw=Math.min(430,innerWidth-24); card.style.width=cw+"px";
  raise(null);
  card.style.left=(innerWidth-cw)/2+"px"; card.style.top=Math.max(12,(innerHeight-card.offsetHeight)/2)+"px";
}
function welcome(){
  const w=words(PLAYER?"sheet.emb":"sheet.welcome"), u=U();
  sheet("<h3>"+h(w.title)+"</h3><p>"+h(w.body)+'</p><div class="trow"><button class="tbig" data-a="go">'+h(u.show)
    +'</button><button class="tplain" data-a="later">'+h(u.notNow)+'</button></div><p class="fine">'+h(w.foot)+"</p>");
}
function menu(fin){
  const w=words(fin?"sheet.finish":"sheet.menu"), done=new Set(store.get().done||[]);
  sheet("<h3>"+h(w.title)+"</h3><p>"+h(w.body)+"</p>"
    +CHS.map((c,i)=>'<button class="tch'+(done.has(c.id)?" done":"")+'" data-ch="'+c.id+'"><span class="n">'+(done.has(c.id)?"✓":i+1)
      +"</span><span><b>"+h(c.name)+"</b><small>"+h(c.desc)+'</small></span><span class="m">'+h(c.mins)+"</span></button>").join("")
    +'<div class="trow" style="margin-top:14px;justify-content:flex-end"><button class="tplain" data-a="close">'+h(U().close)+"</button></div>");
}
function finish(){ if(T.ch) markDone(T.ch); leave();
  if(!PLAYER){ menu(true); return; }
  const w=words("sheet.embEnd");
  sheet("<h3>"+h(w.title)+"</h3><p>"+h(w.body)+'</p><div class="trow"><button class="tbig" data-a="close">'+h(U().close)+"</button></div>");
}

/* the doors: the Tour row in Settings (and the phone's menu), and the first start */
document.addEventListener("click",e=>{
  if(!(e.target.closest&&e.target.closest(".tourbtn"))) return;
  closeAll();
  if(PLAYER) start();            // one chapter: the ? is the tour itself, not a list of one
  else menu(false);
});
const rec=e=>{ if(T.mode!=="steps"||(L&&L.contains(e.target))) return; T.clicks.push(e.target); setTimeout(tick,60); };
document.addEventListener("pointerdown",rec,true);
document.addEventListener("click",rec,true);
document.addEventListener("close",()=>setTimeout(tick,30),true);          // a dialog closed: the layer comes home
new MutationObserver(()=>setTimeout(tick,30)).observe(document.body,{attributes:true,attributeFilter:["open"],subtree:true});
addEventListener("resize",()=>{ if(T.mode==="steps") place(); else if(T.mode==="sheet"&&card){ const cw=Math.min(430,innerWidth-24);
  card.style.width=cw+"px"; card.style.left=(innerWidth-cw)/2+"px"; card.style.top=Math.max(12,(innerHeight-card.offsetHeight)/2)+"px"; } });
document.addEventListener("fullscreenchange",()=>setTimeout(tick,60));
document.addEventListener("keydown",e=>{
  if(e.key!=="Escape"||T.mode==="off") return;
  if(document.querySelector("dialog[open]")||(typeof fsOn==="function"&&fsOn())) return;   // Esc closes those first
  leave();
});

/* THE FIRST START OFFERS CHAPTER 1 (David, 21 Sep: yes) — on the test version for now, never inside a
   lesson embed, and only once: "Not now" is an answer, and the tour stays in Settings. */
function firstStart(tries){
  const st=store.get(); if(st.seen) return;
  if(!PLAYER&&(!(typeof TESTV!=="undefined"&&TESTV)||(typeof EMBEDDED!=="undefined"&&EMBEDDED))) return;
  if(document.querySelector("dialog[open]")||(typeof editing!=="undefined"&&editing)){ if(tries<20) setTimeout(()=>firstStart(tries+1),3000); return; }
  st.seen=1; store.set(st);
  welcome();
}
setTimeout(()=>firstStart(0),1500);

/* for the bench, the text editor and the console. `probe` answers what a step would point at RIGHT NOW, which is
   the only honest way to check a step from a script: the spotlight's own box is mid-animation, and in a hidden
   tab that animation never finishes. */
window.HPS_TOUR={start, menu, welcome, leave, TEXT, CHAPTERS:CHS, STEPS:SEQ, PLAYER,
  at:()=>{ const s=SEQ[T.k]; return T.mode==="steps"&&s?s.id:null; },
  probe:id=>{ const s=SEQ.find(x=>x.id===id)||SEQ[T.k]; if(!s) return null;
    const el=target(s); return el?("#"+(el.id||"")+"."+(el.className&&el.className.baseVal!==undefined?el.className.baseVal:el.className||"")+" "+el.tagName).trim():null; }};
})();
