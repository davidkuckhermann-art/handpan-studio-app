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
         left:"The tour is waiting for you in Settings, under Help", leftPhone:"The tour is waiting for you in the menu",
         listening:"Listening…"},
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
  "sheet.emb":     {title:"HPD studio player - A quick look around", body:"Hi, this is David. This little player is where you read and play along with the piece from this lesson. I'd love to show you what it can do? It takes about a minute.", foot:"You can start the tutorial tour again any time with the ? above."},
  "sheet.embEnd":  {title:"That's it 🙏", body:"I hope this will help you with your practice and to transpose the tunes from one scale to another.\nEnjoy and let us know in the village how the player works for you. 👍"},
  "emb.notation":  {title:"The notation", body:"You already know our notation - Every number is a note on your pan, and D is the ding in the middle. Green numbers are for your left hand, black ones for your right."},
  "emb.follow":    {title:"The player can follow the video", body:"As long as this switch is activated, the notation table in the player follows the video. Keep this option on for now.", try:"Tap Follow video to see it lit"},
  "emb.sound":     {title:"Two sound sources, one at a time", body:"Here is where you can mute/unmute the player's sound. While you can hear the video, the pan should probably stay quiet. Mute the video up in video controls and the player asks whether you would like to unmute the player. Now look for the sound option in the video player and mute the video sound.", try:"Mute the video, then answer: Turn the pan on", tip:"Mute the video in the video player above"},
  "emb.followoff": {title:"Using the player on its own", body:"While the player is following, the video is in charge of the timing. Switch Follow off and the player is yours: your own tempo, half speed, the little helpers and looping all wake up. Switch it back on whenever you want to play along with the video again.", try:"Switch Follow off"},
  "emb.followback": {title:"Back to the video", body:"Follow video connects the player to the video again: the marker walks with the lesson, and the video and player navigate and start together.", try:"Switch Follow back on"},
  "emb.videosound": {title:"New possibilities", body:"With the video running and the sound coming from the player, we have some nice options. For example you can slow the video down in the video player and the pan keeps its natural sound. There are some really cool other possibilities that we will cover a little later."},
  "emb.pan":       {title:"The pan tab", body:"Here you see the layout of the selected handpan. The tone fields light up when they are played.", try:"Play around on the pan for a while, then press Next"},
  "emb.play":      {title:"The player on its own", body:"The marker walks through the notation while the pan lights up with it. You now have full manual control of the player.", try:"Press Play"},
  "emb.controls":  {title:"Tempo and helpers", body:"Here you can adjust:\n• the tempo\n• the count-in\n• half speed\n• the metronome\n• how the marker is animated"},
  "emb.loop":      {title:"Loop a passage", body:"Drag across the notation, over a few beats or a whole row to loop it. This is a great way to practice a tricky passage. The little loop button beside Play clears it again.", try:"Make a loop and play it through twice", phoneBody:"Double-tap and slide your finger over the notation to create a loop. The button beside Play clears it again."},
  "emb.navigate":  {title:"Move around, and the video comes with you", body:"A piece is built from parts, with the table numbers beside them. Select a part and click straight into the notation: while the player is following, the video jumps to that spot too. Let's say you want to jump to the B section - you simply select the table and click into it and the video follows.", try:"Try it: pick a part, click into the notation, and watch the video follow"},
  "emb.videoback": {title:"Hear the original again", body:"Unmute the video in the video player above. The player mutes the pan, because the two always take turns, and tells you so. Now you hear the sound of the video again.", try:"Turn the video sound back on, then press Got it", pop:"Press Got it to confirm the pan is muted", then:"Press Play and listen to the original", tip:"Turn the video sound back on in the video player above"},
  "emb.ownscale":  {title:"My favourite part", body:"As a last step, let's see what happens when we mute the video and unmute the player. You can see me playing the composition, but the sound comes from the player. You will hear the composition played on the pan you select in the app.", try:"Mute the video and answer the pop-up with Turn the pan on. The music keeps going: watch me play the tune and, at the same time, hear it transposed to your selected scale", tip:"Mute the video in the video player above"},
  "emb.loopb":     {title:"Now the fun part", body:"Before we put other pans under it, I have looped the B section. Every instrument we try from here plays exactly the same music, so what you hear changing is the pan and not the piece.", try:"Press Play and listen to the whole B section"},
  "emb.mypan":     {title:"Time to swap pans", body:"This piece is written for a D Kurd. But what if you have a different handpan? Open the scale selector, and I'll show you how to choose another one.", try:"Open the scale selector"},
  "emb.pickb2":    {title:"Choose your scale", body:"This is the list of handpan scales. Common shows the ones you meet most often, Rare and All show the rest. Each row is one scale, and the numbers on it are the sizes it comes in. Tap a row to take that scale for your pan.\nLet's try B2 Amara 9 - the row with the arrow.", try:"Tap B2 Amara 9"},
  "emb.written":   {title:"First, as it is written", body:"I've switched on As written for you. It keeps the numbers in the notation exactly as they are, on your pan. Press Play and listen: it doesn't sound great. You can't just play the same tone fields on the Amara scale and expect it to sound good.", try:"Press Play and listen to the whole table"},
  "emb.mine":      {title:"Now For my pan", body:"For my pan transposes the piece to your instrument instead, keeping the music and changing the numbers.", try:"Tap For my pan"},
  "emb.report":    {title:"What the card tells you", body:"A transposition card comes up at the bottom with the honest arithmetic: how many notes land exactly on your pan, and whether one had to stand in for a note you do not have. The percentage is how much of the music survived the move. It will not work perfectly with every handpan, but there are many ways to make it work nicely. For now let's stick to the automatic transposition."},
  "emb.listen":    {title:"And hear the difference", body:"Press Play once more. Same piece, same lesson, your pan.", try:"Press Play and listen to the whole table"},
  "emb.ashaki":    {title:"Now something quite different", body:"C Ashakiran 17 is a major scale, a long way from a D Kurd. It is not in the Common list, so I've opened All for you, right at the C Ashakiran row. Tap 17 for the extended version with bottom notes, then tap the row to take it.", try:"Tap 17 on the C Ashakiran row, then the row"},
  "emb.ashwritten": {title:"As written, on a major pan", body:"I've switched on As written again. Let's see what it sounds like when we simply play the tone fields of the composition on the Ashakiran handpan. Press Play and hear what the piece becomes when played on the major scale \"as written.\"", try:"Press Play and listen to the whole table"},
  "emb.ashmode":   {title:"Transposition to the same mode on another scale", body:"Now let's transpose the tune. Tap For my pan and press Play. The player moves the piece to the same mode on your pan, so the original tune, which is written in minor, can be played on the major handpan. An instrument with a different scale, but it's the same piece.", try:"Tap For my pan, then press Play and listen to the whole table"},
  "emb.sides":     {title:"The viewing options", body:"You can activate the pan and chord tabs here. The chord tab shows the chords/harmony of the composition. The pan shows the layout of your instrument and the position of the tone fields. The pan's scale and layout are fully customisable, so you can recreate your personal instruments.", try:"Tap Chords"},
  "emb.views":     {title:"Table, Tab or Flow", body:"Three ways to read the same music. Tab gives each hand its own lane; Flow gets rid of the notation tables and lets the music run on and wrap like text.", try:"Tap Tab"},
  "emb.fs":        {title:"Full screen", body:"Just the notation, as big as your screen allows. Good when the pan is in your lap. Press the same button again, or Esc, to come back.", try:"Go full screen, then leave it again"}
};
/* ===================================== END OF THE WORDS ===================================== */

/* THE VIDEO PLAYER'S MUTE BUTTON, AS THE STUDENT WILL SEE IT (David's screenshot, 21 Sep): shown beside the up
   arrow on the sound card, so the student knows what to look for in the video above. Embedded, so the tour stays
   one file to publish. */
const MUTE_SHOT="data:image/png;base64,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";

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
function phrase(){
  try{ const es=arrEntries(); if(!es||!es.length) return null;
    return es.find(x=>x.nm==="B1")||es.find(x=>baseOf(x.nm).base==="B")||es[1]||es[0]; }catch(e){ return null; }
}
/* the playhead on the phrase's first beat - with Follow on this moves the video there too */
function sectionStart(){
  try{ const e=phrase(); if(!e) return;
    if(typeof pinView==="function") pinView(e.ai,piece.arrangement[e.ai]);
    if(typeof render==="function") render();
    if(typeof goTo==="function") goTo(e.from,e.to);
  }catch(err){}
}
function loopPhrase(){
  try{
    const e=phrase(); if(!e) return;
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
/* ONLY THE POSITIVE ANSWER (David, 21 Sep: "When the pop-up comes here, only the positive answer that enables the
   player sound should be available. Everything else should be grayed out"). While the sound card is up, "No, stay
   quiet" and "Don't ask again" are greyed and disabled, and the two ways of dismissing the question - a click outside
   it, and Esc - do nothing. All of it is given back when the card is left. */
let askBlock=null;
/* The same for the other notice (David, 21 Sep, of "Hear the original again": "wait until the user clicks the OK
   button on the pop-up window, and also … gray out all other options again"): "Don't warn me again" is greyed, and
   the notice, which normally closes itself after four seconds, stays until Got it is pressed (tick() holds its timer). */
function askPanOnly(on){
  const dlgs=[$("panSoundDlg"),$("panMutedDlg")].filter(Boolean);
  document.documentElement.classList.toggle("tour-askpan",on);
  ["psNo","psNever","pmNever"].forEach(id=>{ const b=$(id); if(b) b.disabled=on; });
  if(on&&!askBlock&&dlgs.length){
    askBlock={
      click:e=>{ const t=e.target; if(dlgs.some(d=>d.open&&t===d)||(t&&t.id==="dlgShade")){ e.stopPropagation(); e.preventDefault(); } },
      cancel:e=>{ e.preventDefault(); }
    };
    document.addEventListener("click",askBlock.click,true);
    dlgs.forEach(d=>d.addEventListener("cancel",askBlock.cancel));
  } else if(!on&&askBlock){
    document.removeEventListener("click",askBlock.click,true);
    dlgs.forEach(d=>d.removeEventListener("cancel",askBlock.cancel));
    askBlock=null;
  }
}
/* THE LESSON'S OWN TEMPO, read when this script loads - right after the lesson opens, before anyone has touched it.
   It has to be kept here: setTempo writes the new tempo INTO the piece, so once a student has changed it (the tour
   invites exactly that) nothing in the piece remembers the original any more. */
const TEMPO0=(()=>{ try{ return piece&&piece.tempo||null; }catch(e){ return null; } })();
/* PLAIN PLAYBACK FOR LISTENING (David, 21 Sep): the lesson's own tempo, no half speed, no click, no count-in */
function plainPlayback(){
  try{ if(halfSpeed) $("halfBtn").click(); }catch(e){}
  try{ if(countIn) $("countBtn").click(); }catch(e){}
  try{ if(metOn) $("metBtn").click(); }catch(e){}
  try{ if(TEMPO0&&bpm!==TEMPO0&&typeof setTempo==="function") setTempo(TEMPO0); }catch(e){}
}
/* ONE WHOLE TABLE, AND ALWAYS THE SAME ONE (David, 21 Sep: "one complete table should be played before it moves on
   to the next card automatically" … "always the same table, the first table of the B section" … "if the user has
   navigated somewhere else in the meantime, for all these listening examples, go back to this first table of the
   B section"). ONE rule for every card that listens: the phrase is the table; a pass counts when the playhead
   began at its first beat and then left its last stretch - looping back to the start (Follow off, the loop on)
   or running on into the next table (Follow on, the video in charge). Found playing anywhere else, the tour puts
   it back on the first beat: the loop laid again where loops are allowed, the video sent there where it leads. */
/* WHAT IS BEING HEARD, AND WHERE. The player's own playback reports `playing` and `lastPaint`; with Follow on and the
   pan muted the VIDEO is what plays, and the marker is painted from its clock instead (`vidPlaying`,
   `lastFollowPaint`) - the card that listens to the original counts that. */
const hearing=()=>{ try{ return !!playing||(!!follow&&!!vidPlaying); }catch(e){ return false; } };
const heardAt=()=>{ try{ if(playing) return lastPaint; if(follow&&lastFollowPaint!=null) return lastFollowPaint; }catch(e){} return -1; };
function onePass(){
  const e=phrase();
  if(!e||!hearing()){ T.lastP=null; T.passes=0; return false; }
  const p=heardAt(); if(p<0) return false;
  const inB=p>=e.from&&p<e.to, late=e.from+(e.to-e.from)*0.75;
  if(T.lastP==null){ if(!inB){ backToPhrase(); return false; } T.whole=p<=e.from+1; T.lastP=p; return false; }
  const wrapped=p<T.lastP, ended=p>=e.to;
  if((wrapped||ended)&&T.whole&&T.lastP>=late){ T.passes++; return true; }
  if(!inB||ended){ backToPhrase(); return false; }
  if(wrapped) T.whole=p<=e.from+1;
  T.lastP=p; return false;
}
/* TWO BARS OF THE PHRASE, in its own metre (a bar is beats × subdivision, scaled for the beat's note value) */
function twoBars(){
  try{ const e=phrase(), sec=e&&piece.sections[piece.arrangement[e.ai]]||{}, m=sec.meter||piece.meter||[4,4], sub=sec.sub||piece.sub||4;
    return Math.round(2*m[0]*sub*4/m[1]); }catch(err){ return 32; }
}
function backToPhrase(){
  const now=performance.now(); if(now-(T.heldAt||0)<1500) return;   // a seek takes a moment to land
  T.heldAt=now; T.lastP=null; T.passes=0;
  if(typeof follow!=="undefined"&&follow) sectionStart(); else loopPhrase();
}
const listenFresh=()=>{ stopPlay();
  try{ if(follow&&vidPlaying) $("playBtn").click(); }catch(e){}     // with Follow on, Play pauses the video
  if(typeof follow!=="undefined"&&follow) sectionStart(); else loopPhrase(); T.passes=0; T.lastP=null; T.heldAt=0; };
/* AS WRITTEN, SWITCHED ON BY THE TOUR (David, 21 Sep: "for the first as it is written card, please activate the as
   written option" … "when the Ashakiran is first selected, please activate the option as written") */
const asWritten=()=>{ closeAll(); stopPlay(); if(mode!=="pos"&&typeof setMode==="function") setMode("pos"); listenFresh(); };
/* FOR MY PAN, THEN PLAY (David, 21 Sep: "let's drop the detour to the transposition card. The user should simply
   select for my pan and then, again, press play"). The card's Same mode - his choice for this major pan ("with the
   same mode option") - is taken for the student the moment For my pan is on */
const sameMode=()=>{ try{ if(mode!=="trans"||!REPORT||!REPORT.howMatters||REPORT.how==="mode") return;
  const b=document.querySelector('#report [data-how="mode"]'); if(b&&!b.disabled) b.click(); }catch(e){} };
/* THE PICKER OPENED AT C ASHAKIRAN (David, 21 Sep: "open the menu automatically at that spot where the user can
   select the Ashakiran 17 scale. It's too difficult to find it at the moment"): All, so the row is listed; the
   step's own bring() then scrolls the list to it */
const pickAll=()=>{ const a=$("ppAll"); if(a&&a.getAttribute("aria-pressed")!=="true") a.click(); };
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
  {id:"emb.follow",   ch:"emb", at:["#followBtn"], gate:()=>follow},   // Next greyed until Follow video is on (David, 21 Sep)
  /* the pan starts muted in an embed (followMuted = EMBEDDED), and the two players take turns */
  /* THE STUDENT MUTES THE VIDEO ABOVE, AND ANSWERS THE PLAYER (David, 21 Sep): the mute switch framed but not lit,
     an arrow up to the video, and Next greyed until the pan's sound is on BY THAT ROUTE - the positive answer to the
     pop-up, or (where the choice is remembered and no pop-up comes) the video reported muted with the pan on. No
     goal: the card waits for Next, and so it is never skipped on the way back either. */
  {id:"emb.sound",    ch:"emb", at:["#folMute"], quiet:true, arrowUp:true, tipShot:MUTE_SHOT,
                      gate:()=>!followMuted&&(clicked("#psYes")||(typeof vidMuted!=="undefined"&&vidMuted===true)),
                      onShow:()=>askPanOnly(true), exit:()=>askPanOnly(false)},
  /* WHY THE PAN'S SOUND IS WORTH HAVING (David, 21 Sep): with the video's own controls at half speed his
     playing drops in pitch, while the pan is scheduled from the video's clock (vRate) and stays natural. It
     points at Follow video, the link between the two - and that is what makes it vanish with no video behind the
     player, like the other video cards (found on the live player, opened without a lesson video). */
  {id:"emb.videosound",ch:"emb", at:["#followBtn"]},
  {id:"emb.pan",      ch:"emb", at:["#panbox","#pvsvg"], stay:true},   // play as long as they like (David, 21 Sep)
  /* navigating still works while the video is the clock, because seekToPulse seeks the recording too
     (David, 21 Sep: "navigating in the Embed player also will navigate the video") */
  {id:"emb.navigate", ch:"emb", at:["#arrChips"], stay:true},          // try it, and stay until they move on (David, 21 Sep)
  /* and only now the controls the video's clock keeps out of reach */
  {id:"emb.followoff",ch:"emb", at:["#followBtn"], done:()=>!follow, hold:1200},
  {id:"emb.play",     ch:"emb", at:["#playBtn"], done:()=>playing, hold:3500},
  /* ONE CARD FOR THE PRACTICE CONTROLS, NO DEMONSTRATION (David, 21 Sep: "the tempo and the three little helpers
     don't need an interactive demonstration … combine these into one card"). #footL holds exactly those five; the
     phone keeps them in the drawer's top row. */
  {id:"emb.controls", ch:"emb", at:["#footL","#dwTop","#bpmCtl"]},
  /* A LOOP, HEARD TWICE (David, 21 Sep: "wait until the user has created a loop and played it back two times
     before stopping the playback and proceeding"). lastPaint is the pulse the marker is on; inside a loop it jumps
     back to the loop's start on every pass, so two jumps back are two full passes. The next card stops the music. */
  {id:"emb.loop",     ch:"emb", at:["#score"], enter:()=>{ stopPlay(); T.passes=0; T.lastP=null; },
                      done:()=>{ if(!loopSec||!playing){ T.lastP=null; return false; }
                        const p=lastPaint; if(T.lastP!=null&&p>=0&&p<T.lastP) T.passes++; if(p>=0) T.lastP=p;
                        return T.passes>=2; }, hold:300},
  /* THE SCALE, DEMONSTRATED TWICE (David, 21 Sep: "have the student switch from D Kurd to E Amara, and first
     show what it sounds like when the composition is played as written. Afterwards, switch to for my pan,
     explain the transposition card and have the user listen to what a difference that makes"). It sits with
     Follow OFF, so Play is the player's own sound and the two listens can be compared. The pan is B2 Amara 9
     (David changed it from E Amara an hour later); it is in the picker's Common list, just under the Kurds.
     A pan's id names its SCALE and not its build, so the check matches by prefix. */
  /* NOW THE FUN PART (David, 21 Sep): the notation and Play lit together, playback made plain, a green Listening
     line while the B section plays, and on after ONE full pass (lastPaint jumps back to the loop's start); the next
     card stops the music. */
  {id:"emb.loopb",    ch:"emb", enter:()=>{ stopPlay(); loopPhrase(); T.passes=0; T.lastP=null; }, onShow:plainPlayback,
                      at:["#score"], also:["#playBtn"], listen:true, done:onePass, hold:600},
  /* THE PAN IS CHOSEN IN TWO CARDS (David, 21 Sep: "we have to walk them through the pan selection process … click
     scale selector, and then, when the scale selector card opens, we need another tutorial card here that explains
     it, explains exactly how to select another scale, highlights the B2 Amara 9 scale, teaches the user how to
     select it"). The first asks for the selector; the second lives in the list, with an arrow at the row. */
  {id:"emb.mypan",    ch:"emb", enter:stopPlay, at:["#myPanBtn","#panSel","#drawerGrip"], done:()=>isOpen("panPickDlg"), hold:300},
  {id:"emb.pickb2",   ch:"emb", need:PICK, at:[titled("#ppList .pprow","B2 Amara 9"),"#ppList"], point:true,
                      done:()=>/^b2-amara/.test(myPanId), hold:900},
  /* the two listens (as written, then for my pan) each play the whole table, Play lit with the switch */
  {id:"emb.written",  ch:"emb", enter:asWritten, onShow:plainPlayback, at:["#modePos2","#modePos",byText("#mpModeRow button","As written"),"#drawerGrip"],
                      also:["#playBtn"], listen:true, done:()=>mode==="pos"&&onePass(), hold:600},
  {id:"emb.mine",     ch:"emb", enter:stopPlay, at:["#modeTrans2","#modeTrans",byText("#mpModeRow button","For my pan"),"#drawerGrip"], done:()=>mode==="trans"},
  {id:"emb.report",   ch:"emb", enter:()=>{ closeAll(); setMode("trans"); }, at:["#report"]},
  {id:"emb.listen",   ch:"emb", enter:listenFresh, onShow:plainPlayback, at:["#score"], also:["#playBtn"], listen:true, done:onePass, hold:600},
  /* AND STRAIGHT ON TO A MAJOR PAN (David, 21 Sep: "the last one should be the C Ashakiran 17, which is a major
     scale … first … as written and then … transposed to the instrument (with the same mode option)"). Tier 3, so
     it is not in the picker's Common list: the All filter is the candidate under the row, and the card says so. */
  {id:"emb.ashaki",   ch:"emb", enter:()=>{ stopPlay(); pickAll(); }, need:PICK, point:true,
                      at:[buildChip("C Ashakiran","17"),builtRow("C Ashakiran","17"),"#ppAll","#ppList","#myPanBtn","#panSel","#drawerGrip"],
                      done:()=>myPanId==="c-ashakiran-17", hold:900},
  {id:"emb.ashwritten",ch:"emb", enter:asWritten, onShow:plainPlayback, at:["#modePos2","#modePos",byText("#mpModeRow button","As written"),"#drawerGrip"],
                      also:["#playBtn"], listen:true, done:()=>mode==="pos"&&onePass(), hold:600},
  {id:"emb.ashmode",  ch:"emb", enter:listenFresh, onShow:plainPlayback, at:["#modeTrans2","#modeTrans",byText("#mpModeRow button","For my pan"),"#drawerGrip"],
                      also:["#playBtn"], listen:true, done:()=>{ sameMode(); return howMode()&&onePass(); }, hold:600},
  {id:"emb.sides",    ch:"emb", enter:()=>{ stopPlay(); clearLoop(); }, at:["#chordBtn",'[aria-label="Show chords"]'], done:()=>phone()?(chordRowOn&&!panOn):clicked("#chordBtn")},
  {id:"emb.views",    ch:"emb", at:["#viewTab"], done:()=>view==="tab"},
  /* in AND out again (David, 21 Sep: "ask them to exit full screen mode and wait until full screen mode is exited
     before proceeding") */
  {id:"emb.fs",       ch:"emb", at:["#fsBtn"], enter:()=>{ T.fsIn=false; }, done:()=>{ if(fsOn()) T.fsIn=true; return T.fsIn&&!fsOn(); }, hold:900},
  /* it ends where it began: back with the video - and THAT is where the scale pays off (David, 21 Sep:
     "we can add the thing about the different scale at the end of the tutorial when you switch the follow
     video option back on") */
  {id:"emb.followback",ch:"emb", at:["#followBtn"], enter:stopPlay, done:()=>follow, hold:1200},
  /* THE SOUND GOES BACK TO THE VIDEO FIRST (David, 21 Sep: "let's first turn the sound of the video back on.
     Listen to the original, and then switch to the selected scale"). Both cards STAY, and each asks for a switch
     of the video's own sound and an answer to the pop-up the app raises ("the user should now unmute the video
     and then mute it again and answer the pop-up every time") - the pop-up rule lights each one as it comes up.
     Unmute: "Video sound is on", the pan steps aside. Mute: "Video sound is off - turn the pan on?". */
  /* HEAR THE ORIGINAL AGAIN (David, 21 Sep): the arrow up to the video and its screenshot until the video's sound is
     on; Next greyed until the notice's Got it (its other option greyed, its timer held); then Play lit, and after
     TWO BARS of the video's sound the tour moves on WITH THE MUSIC STILL PLAYING ("after 2 bars of listening, you can
     proceed to the next card, but keep the playback going") */
  {id:"emb.videoback",ch:"emb", at:["#folMute"], quiet:true, arrowUp:()=>typeof vidMuted!=="undefined"&&vidMuted!==false, tipShot:MUTE_SHOT,
                      thenAt:["#playBtn"], enter:()=>{ listenFresh(); T.vb0=null; }, onShow:()=>askPanOnly(true), exit:()=>askPanOnly(false), listen:true,
                      gate:()=>clicked("#pmOk")||(followMuted&&vidMuted===false&&!isOpen("panMutedDlg")&&typeof panPref==="function"&&panPref(PK_WARN)==="off"),
                      done:()=>{ if(!T.gateMet.has("emb.videoback")) return false;
                        if(!hearing()){ T.vb0=null; return false; }
                        const p=heardAt(); if(p<0) return false;
                        if(T.vb0==null||p<T.vb0) T.vb0=p;
                        return p-T.vb0>=twoBars(); }, hold:300},
  /* MY FAVOURITE PART, WHILE THE MUSIC PLAYS (David, 21 Sep: "the user is asked to mute the video sound and then
     confirm that the player sound comes back on. All this can happen while the playback is still going"): nothing is
     stopped on the way in; the arrow up to the video and its screenshot until the video is muted, as on the sound card;
     the pop-up offers only its yes */
  {id:"emb.ownscale", ch:"emb", at:["#folMute","#panbox"], stay:true, quiet:true, arrowUp:true, tipShot:MUTE_SHOT,
                      onShow:()=>askPanOnly(true), exit:()=>askPanOnly(false)}   // the last one: enjoy it, then Finish
];
/* the lesson embed marks itself before first paint; its tour is the short one */
const PLAYER=document.documentElement.classList.contains("player");
const SEQ=PLAYER?EMB:STEPS;
const CHS=PLAYER?[{id:"emb", name:"This player", mins:"1 min", desc:"What everything here does"}]:CHAPTERS;

/* ======================================== THE ENGINE ======================================== */
const T={mode:"off", k:-1, ch:null, clicks:[], passed:false, token:0, snap:null, sig:"", iv:null, pan0:null, bpm0:null, gateMet:new Set(), cur:null};
const canPop=typeof HTMLElement!=="undefined"&&"showPopover" in HTMLElement.prototype;
const store={ get(){ try{ return JSON.parse(localStorage.getItem("hps.tour")||"{}")||{}; }catch(e){ return {}; } },
              set(o){ try{ localStorage.setItem("hps.tour",JSON.stringify(o)); }catch(e){} } };
const h=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
function words(id){ const w=TEXT[id]||{}, p=phone();
  return {title:w.title||"", body:(p&&w.phoneBody)||w.body||"", try:(p&&w.phoneTry)||w.try||"", foot:(p&&w.phoneFoot)||w.foot||"", tip:w.tip||"", pop:w.pop||"", then:w.then||""}; }
const U=()=>TEXT.ui;
function ok(f){ try{ return !!f(); }catch(e){ return false; } }

function box(el){
  if(!el||!el.getClientRects||!el.getClientRects().length) return false;
  const r=el.getBoundingClientRect(); if(r.width<1||r.height<1) return false;
  return getComputedStyle(el).visibility!=="hidden";
}
function find(c){ if(typeof c==="function"){ let e=null; try{ e=c(); }catch(err){} return box(e)?e:null; }
  return [...document.querySelectorAll(c)].find(box)||null; }
/* THE APP'S OWN POP-UPS TAKE THE SPOTLIGHT WHILE THEY ARE OPEN (David, 21 Sep: the embed tour asks the student to
   mute the video and answer "Turn the pan on", and that question was hidden behind the card). A pop-up is the app
   asking or telling the student something, so for as long as one is up it is what is lit, and the card stands
   clear of it; when it closes, the step's own target comes back. One rule for every step and every such pop-up -
   add one here and every step already defers to it. The SKIP rule still asks only about the step's own targets. */
const POPUPS=["#panSoundDlg","#panMutedDlg"];
/* `thenAt`: where the card points once its gate is met (David, 21 Sep, of "Hear the original again": "the press the
   play button should be highlighted so the user presses play again") */
function ownTarget(s){ if(!s||!s.at) return null;
  if(s.thenAt&&T.gateMet.has(s.id)) for(const c of s.thenAt){ const e=find(c); if(e) return e; }
  for(const c of s.at){ const e=find(c); if(e) return e; } return null; }
function target(s){ for(const c of POPUPS){ const e=find(c); if(e) return e; } return ownTarget(s); }

/* the layer: one element, a popover so it paints above the app's modal dialogs and the fullscreen notation.
   A modal dialog makes everything outside it inert, so the layer moves INTO whichever one is up. */
let L=null, spot=null, card=null, arrow=null, tip=null, point=null;
function css(){
  const st=document.createElement("style"); st.id="tourCss"; st.textContent=`
#tourLayer{position:fixed;inset:0;width:auto;height:auto;max-width:none;max-height:none;margin:0;padding:0;border:0;background:transparent;
  overflow:visible;pointer-events:none;z-index:2147483000;display:none;color:#fff;font:14px/1.45 Figtree,"Helvetica Neue",Arial,sans-serif}
#tourLayer.on{display:block} #tourLayer::backdrop{display:none}
#tourLayer.dim{background:rgba(30,27,22,.55)} #tourLayer.block{pointer-events:auto}
#tourSpot{position:fixed;border-radius:12px;box-shadow:0 0 0 200vmax rgba(30,27,22,.55);outline:2.5px solid #E59315;pointer-events:none;
  transition:left .25s,top .25s,width .25s,height .25s}
#tourSpot.none{display:none}
#tourSpot.ring{box-shadow:none}
#tourArrow{position:fixed;left:50%;top:6px;width:64px;height:78px;margin-left:-32px;display:none;pointer-events:none;
  filter:drop-shadow(0 6px 14px rgba(0,0,0,.5));animation:tourBob 1.1s ease-in-out infinite}
#tourArrow.on{display:block}
#tourTip{position:fixed;top:8px;right:calc(50% + 40px);display:none;align-items:center;gap:10px;pointer-events:none;
  max-width:min(380px,calc(50vw - 52px));background:#1E1B16;color:#fff;border:1.5px solid #E59315;border-radius:12px;
  padding:8px 12px 8px 8px;box-shadow:0 12px 30px -8px rgba(0,0,0,.55);font:700 13.5px/1.35 Figtree,"Helvetica Neue",Arial,sans-serif}
#tourTip.on{display:flex}
#tourTip img{width:136px;height:auto;border-radius:8px;flex:none;display:block}
#tourTip span{max-width:175px}
@media (max-width:600px){ #tourTip{flex-direction:column;align-items:flex-start;padding:8px} #tourTip img{width:100%} #tourTip span{max-width:none} }
@keyframes tourBob{50%{transform:translateY(-12px)}}
#tourPoint{position:fixed;width:78px;height:64px;display:none;pointer-events:none;
  filter:drop-shadow(0 6px 14px rgba(0,0,0,.5));animation:tourNudge 1.1s ease-in-out infinite}
#tourPoint.on{display:block}
#tourPoint svg{display:block;transform:rotate(var(--rot,0deg))}
@keyframes tourNudge{50%{transform:translate(var(--nx,0px),var(--ny,0px))}}
@media (prefers-reduced-motion:reduce){#tourArrow,#tourPoint{animation:none}}
html.tour-askpan #psNo,html.tour-askpan #panSoundDlg .dlgask,html.tour-askpan #panMutedDlg .dlgask{opacity:.35;pointer-events:none}
#tourCard{position:fixed;box-sizing:border-box;pointer-events:auto;background:#1E1B16;color:#fff;border-radius:14px;padding:14px 16px 12px;
  border:1px solid rgba(255,255,255,.1);box-shadow:0 20px 50px -10px rgba(0,0,0,.55);transition:left .25s,top .25s;text-align:left}
#tourCard .tk{display:flex;justify-content:space-between;align-items:center;font-size:10.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#B9B0A1}
#tourCard .tx{background:none;border:0;color:#B9B0A1;font-size:17px;line-height:1;padding:2px 4px;margin:-4px -6px 0 0;cursor:pointer}
#tourCard h4{margin:6px 0 4px;font-size:16.5px;font-weight:700;color:#fff}
#tourCard p{margin:0;font-size:13.5px;line-height:1.5;color:#E9E3D8;white-space:pre-line}
#tourCard .ttry{margin-top:9px;font-size:12.5px;font-weight:700;color:#FFD08A;display:flex;gap:7px;align-items:center}
#tourCard .ttry::before{content:"";flex:none;width:8px;height:8px;border-radius:50%;background:#E59315;animation:tourPulse 1.2s infinite}
#tourCard.passed .ttry{color:#9FD7A9} #tourCard.passed .ttry::before{display:none}
#tourCard.listening .ttry{color:#9FD7A9} #tourCard.listening .ttry::before{background:#3FA95B;animation:tourPulse .9s infinite}
@keyframes tourPulse{50%{transform:scale(1.7);opacity:.4}}
#tourCard .tf{display:flex;align-items:center;gap:6px;margin-top:12px}
#tourCard .tpips{display:flex;gap:4px;flex:1;flex-wrap:wrap} #tourCard .tpips i{width:6px;height:6px;border-radius:3px;background:#4A453C}
#tourCard .tpips i.on{background:#fff;width:16px}
#tourCard .tb{border:0;border-radius:9px;padding:7px 13px;font:700 13px/1.2 inherit;cursor:pointer;white-space:nowrap}
#tourCard .tb.pri{background:#fff;color:#1E1B16}
#tourCard .tb:disabled{opacity:.35;cursor:default} #tourCard .tb.sec{background:#3A352D;color:#fff} #tourCard .tb.gho{background:none;color:#CFC7B9;padding:7px 8px}
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
  L.innerHTML='<div id="tourSpot" class="none"></div><div id="tourArrow" aria-hidden="true"><svg viewBox="0 0 64 78" width="64" height="78">'
    +'<path d="M32 3 L61 38 L43 38 L43 75 L21 75 L21 38 L3 38 Z" fill="#E59315" stroke="#fff" stroke-width="3" stroke-linejoin="round"/></svg></div>'
    +'<div id="tourTip" aria-live="polite"><img alt=""><span></span></div>'
    +'<div id="tourPoint" aria-hidden="true"><svg viewBox="0 0 78 64" width="78" height="64">'
    +'<path d="M3 32 L38 3 L38 21 L75 21 L75 43 L38 43 L38 61 Z" fill="#E59315" stroke="#fff" stroke-width="3" stroke-linejoin="round"/></svg></div>'
    +'<div id="tourCard"></div>';
  document.body.appendChild(L); spot=L.firstChild; card=L.lastChild; arrow=L.children[1]; tip=L.children[2]; point=L.children[3];
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
  /* A QUIET STEP (David, 21 Sep, of the sound card: the player's mute switch "should receive an orange frame, but
     not be highlighted. Instead, we need a big animated arrow that points upwards towards the video player"). Its
     target gets the orange frame while staying dimmed like the rest; `arrowUp` points out of the top of the player,
     toward the lesson's video above it. A pop-up the app raises is still lit in full, and the arrow goes then, and
     once the card's gate is met. */
  const isPop=!!(el&&POPUPS.some(c=>{ try{ return el.matches(c); }catch(e){ return false; } }));
  /* the arrow and its callout go together, THE MOMENT THE VIDEO IS MUTED (David, 21 Sep): the lesson's bridge reports
     the video muted, or the app's pop-up comes up because of it, or the card's gate is met */
  const vidQuiet=(typeof vidMuted!=="undefined"&&vidMuted===true);
  /* `arrowUp` true: until the video is muted; a function: for as long as it answers true (the card that asks for the
     video's sound back on shows it until the lesson reports the video unmuted) */
  const vidDone=typeof s.arrowUp==="function"?!ok(s.arrowUp):vidQuiet;
  const up=!!(s.arrowUp&&!isPop&&!vidDone&&!(s.gate&&ok(s.gate)));
  if(arrow) arrow.classList.toggle("on",up);
  if(tip){ const t=up&&s.tipShot?words(s.id).tip:"";
    tip.classList.toggle("on",!!t);
    if(t){ const im=tip.firstChild, sp=tip.lastChild; if(im.getAttribute("src")!==s.tipShot) im.src=s.tipShot; if(sp.textContent!==t) sp.textContent=t; } }
  if(point&&!(s.point&&el&&!isPop&&!T.passed)) point.classList.remove("on");
  if(!el){ spot.className="none"; L.classList.add("dim");
    card.style.left=(vw-cw)/2+"px"; card.style.top=Math.max(10,(vh-ch)/2)+"px"; return; }
  const quiet=!!(s.quiet&&!isPop&&!(s.thenAt&&T.gateMet.has(s.id)));
  L.classList.toggle("dim",quiet); spot.className=quiet?"ring":"";
  /* A SECOND ELEMENT LIT WITH THE TARGET (`also`, David, 21 Sep, of "Now the fun part": "highlight the notation,
     but also the play button"): the spotlight spans both, and the card places itself against the whole. */
  let r=el.getBoundingClientRect();
  if(s.also&&!isPop) for(const c of s.also){ const e=find(c); if(!e) continue; const q=e.getBoundingClientRect();
    const L0=Math.min(r.left,q.left), T0=Math.min(r.top,q.top), R0=Math.max(r.right,q.right), B0=Math.max(r.bottom,q.bottom);
    r={left:L0,top:T0,right:R0,bottom:B0,width:R0-L0,height:B0-T0}; }
  Object.assign(spot.style,{left:r.left-pad+"px",top:r.top-pad+"px",width:r.width+2*pad+"px",height:r.height+2*pad+"px"});
  /* AN ARROW AT THE ONE TO CHOOSE (`point`, David, 21 Sep: "highlight that scale and point an arrow towards it so the
     user knows exactly what they are supposed to select"): beside the target where there is room, pointing at it,
     else above it pointing down; gone once the choice is made */
  if(point&&s.point&&!isPop&&!T.passed){
    const room=86, cy=r.top+r.height/2; let cx, y=cy, rot="0deg", nx="12px", ny="0px";
    if(vw-(r.right+pad)>=room) cx=r.right+pad+6+39;
    else if(r.left-pad>=room){ cx=r.left-pad-6-39; rot="180deg"; nx="-12px"; }
    else { cx=Math.min(Math.max(r.right-70,45),vw-45); y=r.top-pad-6-39; rot="-90deg"; nx="0px"; ny="-12px"; }
    Object.assign(point.style,{left:cx-39+"px",top:y-32+"px"});
    point.style.setProperty("--rot",rot); point.style.setProperty("--nx",nx); point.style.setProperty("--ny",ny);
    point.classList.add("on");
  }
  let left=r.left+r.width/2-cw/2, top;
  if(r.bottom+pad+gap+ch<=vh-8) top=r.bottom+pad+gap;
  else if(r.top-pad-gap-ch>=8) top=r.top-pad-gap-ch;
  else { top=Math.min(Math.max(r.top,8),vh-ch-8);
    if(r.right+pad+gap+cw<=vw-8) left=r.right+pad+gap;
    else if(r.left-pad-gap-cw>=8) left=r.left-pad-gap-cw;
    else top=vh-ch-10; }
  left=Math.min(Math.max(left,10),vw-cw-10); top=Math.max(8,top);
  /* the card never covers the arrow's callout (on a phone the two meet): it steps below it */
  if(tip&&tip.classList.contains("on")){ const t=tip.getBoundingClientRect();
    if(left<t.right&&left+cw>t.left&&top<t.bottom+8&&top+ch>t.top) top=Math.min(t.bottom+10,vh-ch-8); }
  card.style.left=left+"px"; card.style.top=top+"px";
}
/* bring a target into view INSTANTLY and only as far as needed - a smooth scroll can be left half-way in a
   background tab, with the card chasing a moving target - and leave room for the spotlight's own border */
function bring(el,s){
  const m=26;
  /* a step that lights two things (`also`) brings their shared container into view when it fits the screen */
  if(s&&s.also){ for(const c of s.also){ const o=find(c); if(!o) continue; let a=el; while(a&&!a.contains(o)) a=a.parentElement;
    if(a&&a!==document.body&&a.getBoundingClientRect().height<innerHeight-2*m) el=a; } }
  /* a row in one of the app's scrolling lists (the scale picker, the library) is centred in its list, so the card
     finds room above or below it and never sits on the row's name */
  if(el.closest(".pplist,#libList")){ el.scrollIntoView({block:"center"}); place(); return; }
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
  if(askBlock&&typeof panMutedT!=="undefined"&&isOpen("panMutedDlg")) clearTimeout(panMutedT);
  gateNext(s); listenLine(s);
  place();
  if(s.done&&!T.passed&&ok(s.done)) pass(s);
}
/* A GATED CARD (David, 21 Sep, of "The player can follow the video": "the next option to move on … should be grayed
   out when Follow Video is not active"). Its Next stays greyed while `gate` is false and lights up the moment it
   holds; the card still waits for the student to press it. */
/* THE LISTENING LINE (`listen`, David, 21 Sep: "while the B section is running, maybe have a little green animation
   that says listening, just so the user knows that they are supposed to wait here") */
function listenLine(s){
  if(!s||!s.listen||!card) return;
  const tr=card.querySelector(".ttry"); if(!tr||T.passed) return;
  if(s.gate&&!T.gateMet.has(s.id)) return;                 // the gate's own step comes first, and owns the line
  const on=hearing(); card.classList.toggle("listening",on);
  const w=words(s.id), want=on?U().listening:(s.gate&&w.then?w.then:w.try); if(tr.textContent!==want) tr.textContent=want;
}
function gateNext(s){
  if(!s||!s.gate) return;
  const b=card&&card.querySelector('[data-a="next"]'); if(!b) return;
  if(ok(s.gate)) T.gateMet.add(s.id);
  const open=T.gateMet.has(s.id); if(b.disabled===open) b.disabled=!open;
  if(open&&s.listen){ card.classList.remove("passed"); return; }   // past its gate a listening card's line is listenLine's
  const tr=card.querySelector(".ttry"); if(!tr) return;
  card.classList.toggle("passed",open);
  /* while one of the app's notices is up, a card may say what to press in it (`pop`) */
  const w=words(s.id), pop=w.pop&&POPUPS.some(c=>find(c));
  const want=open?U().nice:(pop?w.pop:w.try); if(tr.textContent!==want) tr.textContent=want;
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
    if(s.at&&!s.anywhere&&!ownTarget(s)) continue;  // nothing here to point at: not a step for this screen
    /* NO CARD IS SKIPPED FOR HAVING ITS GOAL MET (David, 21 Sep: "deactivate the skip" - Back and Next skipped the
       sound card once its goal stayed true). A card whose goal is already met is SHOWN as done, with its Try it line
       ticked and a Next button, and it waits: it does not count itself done and jump ahead. */
    const met=!!(s.done&&ok(s.done));
    T.k=k; T.clicks=[]; T.passed=met;
    if(T.cur!==s){ exitHook(); T.cur=s; if(s.onShow) try{ s.onShow(); }catch(e){} }
    paint(s,met); place();
    const el=target(s);
    if(el) bring(el,s);
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
function paint(s,met){
  /* A STEP THAT STAYS (David, 21 Sep: "give the user the opportunity to play around … don't automatically
     progress to the next card. Wait until the user progresses manually"): it shows its Try it line as an
     invitation, has no goal to meet, and its button says Next, never Skip - the student moves on when done. */
  const w=words(s.id), ci=CHS.findIndex(c=>c.id===s.ch), mine=SEQ.filter(x=>x.ch===s.ch), n=mine.indexOf(s),
        last=T.k===lastOf(s.ch), u=U(), tries=!!((s.done||s.stay||s.gate)&&w.try), skippy=tries&&!s.stay&&!s.gate&&!met;
  card.className=met?"passed":"";
  card.innerHTML='<div class="tk"><span>'+h(PLAYER?CHS[ci].name:(ci+1)+" · "+CHS[ci].name)+'</span><button class="tx" data-a="x" aria-label="'+h(u.leave)+'">✕</button></div>'
    +"<h4>"+h(w.title)+"</h4><p>"+h(w.body)+"</p>"
    +(tries?'<div class="ttry">'+h(met?u.nice:w.try)+"</div>":"")
    +'<div class="tf"><span class="tpips">'+mine.map((x,i)=>"<i"+(i===n?' class="on"':"")+"></i>").join("")+"</span>"
    +(last?'<button class="tb gho" data-a="stop">'+h(u.stopHere)+"</button>":(n>0?'<button class="tb gho" data-a="back">'+h(u.back)+"</button>":""))
    +'<button class="tb '+(skippy?"sec":"pri")+'" data-a="next"'+(s.gate&&!T.gateMet.has(s.id)&&!ok(s.gate)?" disabled":"")+'>'+h(last?(ci<CHS.length-1?u.nextChapter:u.finish):(skippy?u.skip:u.next))+"</button></div>";
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
  T.mode="steps"; T.ch=null; T.gateMet=new Set();
  clearInterval(T.iv); T.iv=setInterval(tick,200);
  open(SEQ.findIndex(s=>s.ch===ch),1);
}
function exitHook(){ const c=T.cur; T.cur=null; if(c&&c.exit) try{ c.exit(); }catch(e){} }
function leave(){
  exitHook();
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
  [arrow,tip,point].forEach(e=>e&&e.classList.remove("on"));
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
  /* one chapter: the ? opens its welcome card, every time (David, 21 Sep: "every time the tour is started again,
     the first card, HPD Studio Player: A Quick Look Around, should come first"), and its Show me starts the walk */
  if(PLAYER) welcome();
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
  go:id=>{ const k=SEQ.findIndex(x=>x.id===id); if(k<0||T.mode!=="steps") return false; open(k,1); return true; },
  probe:id=>{ const s=SEQ.find(x=>x.id===id)||SEQ[T.k]; if(!s) return null;
    const el=ownTarget(s); return el?("#"+(el.id||"")+"."+(el.className&&el.className.baseVal!==undefined?el.className.baseVal:el.className||"")+" "+el.tagName).trim():null; }};
})();
