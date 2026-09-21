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
         listening:"Listening…", startTour:"Start the tour", goLesson:"Go to the tutorial lesson", cont:"Continue"},
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
  "sheet.emb":     {title:"HPD studio player - A quick look around", body:"Hi, this is David K. This little embedded player adds some new features to the course videos. I'd love to show you what it can do.", foot:"You can start the tutorial tour again any time with the ? above."},
  "sheet.embVideo":{title:"First, press play on the video", body:"Please press play on the video above once, so it's ready. Then we can start the tour."},
  "sheet.embPlay": {title:"Before we start", body:"You can start and pause the playback any time during the tour, with the space bar or the play button. For now, let the video keep running, so you can see what the player does while the video plays."},
  "sheet.embElse": {title:"The tutorial runs under lesson 2.14", body:"Our tutorial runs under lesson 2.14, Composition 1 Advanced. Do you want to go to the tutorial? This will load a different video lesson."},
  "sheet.embEnd":  {title:"That's it 🙏", body:"I hope this will help you with your practice and to transpose the tunes from one scale to another.\nEnjoy and let us know in the village how the player works for you. 👍"},
  "emb.notation":  {title:"The notation", body:"You already know our notation - Every number is a note on your pan, and D is the ding in the middle. Green numbers are for your left hand, black ones for your right."},
  "emb.follow":    {title:"The player can follow the video", body:"As long as this switch is activated, the notation table in the player follows the video. Keep this option on for now.", try:"Tap Follow video to see it lit"},
  "emb.sound":     {title:"Two sound sources, one at a time", body:"The video and the HPD studio player each have their own sound, and they take turns. The small speaker icon next to the play button turns the player's sound on and off. When you turn it on, the player asks whether it should mute the video for you.", try:"Turn the player's sound on, then answer: Mute the video", okay:"\u2713 Done. For the rest of the tour, the video mutes and unmutes by itself whenever you switch the player's sound.", tip:"Mute the video in the video player above"},
  "emb.space":     {title:"Play and pause", body:"By the way, you can play and pause the playback at any time with the play button or space bar. Give it a try!", try:"Press the space bar to pause and restart playback"},
  "emb.followoff": {title:"Using the player on its own", body:"While the player is following, the video is in charge of the timing. Switch Follow off and the HPD player is in control.", try:"Switch Follow off"},
  "emb.followback": {title:"Back to the video", body:"Follow video connects the player to the video again: the marker walks with the lesson, and the video and player navigate and start together.", try:"Switch Follow back on"},
  "emb.videosound": {title:"New playback options", body:"Now the video is running but the sound is coming from the player. That creates some nice options. For example we can slow the video down in the video player and the pan keeps its natural sound. Let's listen in 0.75 tempo.", try:"Let's listen in 0.75 tempo", btn:"OK", tip:"Change the speed in the video player above"},
  "emb.halfspeed": {title:"Even slower", body:"Let's go even slower and go to half tempo.", try:"Press Switch to half tempo", btn:"Switch to half tempo", try2:"Half tempo is on - have a listen", btn2:"Go back to normal tempo and proceed"},
  "emb.pan":       {title:"The pan tab", body:"Here you see the layout of your selected handpan. The tone fields light up when they are played. You can also listen to the tone fields by clicking them.", try:"Pause playback by pressing space", try2:"Play around on the pan for a while by clicking the tone fields"},
  "emb.controls":  {title:"Tempo and helpers", body:"Here you can adjust:\n• the tempo\n• the count-in\n• half speed\n• the metronome\n• how the marker is animated", try:"Try them out, then press Next - they go back to how they were"},
  "emb.loop":      {title:"Loop a passage", body:"Drag across the notation, over a few beats or a whole row to loop it. This is a great way to practice a tricky passage. The little loop button beside Play clears it again.", try:"Make a loop and play it through twice", phoneBody:"Double-tap and slide your finger over the notation to create a loop. The button beside Play clears it again.", okay:"✓ Well done - you made a loop and heard it twice"},
  "emb.navigate":  {title:"Move around, and the video comes with you", body:"In the notation you can navigate through the different parts of the composition. Select a part here and click straight into the notation: When you scroll back up, you will see how the video follows your navigation. (As long as follow mode is active)", try:"Try it: pick a part, click into the notation, and watch the video follow"},
  "emb.videoback": {title:"Hear the original again", body:"Now mute the player with the speaker icon. The video's sound comes back on by itself, because the two always take turns. Now you hear the sound of the video again.", try:"Mute the player, then press Play", pop:"Press Got it to confirm the pan is muted", then:"Press Play and listen to the original", tip:"Turn the video sound back on in the video player above"},
  "emb.ownscale":  {title:"My favourite part", body:"As a last step, let's see what happens when we unmute the player now. The video mutes itself. You can see me playing the composition in the video, but the sound comes from the player. You will hear the composition transposed to the pan you select in the app.", try:"Turn the player's sound on. The music keeps going: watch me play the tune and, at the same time, hear it transposed to your selected scale", tip:"Mute the video in the video player above"},
  "emb.loopb":     {title:"Now the fun part", body:"I have looped this notation table. Let's listen once to the table and then I'll show you something nice...", try:"Press Play and listen to the whole B section"},
  "emb.mypan":     {title:"Time to swap pans", body:"This piece is written on a D Kurd. But what if you have a different handpan: Let's open the scale selector.", try:"Click scale selector"},
  "emb.pickb2":    {title:"Choose your scale", body:"This is the list of handpan scales. Common shows the ones you meet most often, Rare and All show the rest. Each row is one scale, and the numbers on it are the sizes it comes in. Tap a row to take that scale for your pan.\nLet's try B2 Amara 9 - the row with the arrow.", try:"Tap B2 Amara 9"},
  "emb.mypanwin":  {title:"Your pan and the piece", body:"This window shows the pan you have chosen, and how the piece is played on it. \"As written\" keeps the notation exactly as it was written for the D Kurd. \"For my pan\" transposes it onto your B2 Amara 9. More on that later.\nFor now we stay with As written - let's hear what that sounds like."},
  "emb.ashpanwin":  {title:"As written again", body:"Let's start with As written again, so you can hear what the tone fields of the composition sound like on this major pan."},
  "emb.written":   {title:"Let's listen...", body:"\"As written\" keeps the numbers in the notation exactly as they are, on your pan. Press Play and listen: it doesn't sound amazing. You can't just play the same tone fields on the Amara scale and expect it to sound good.", try:"Press Play and listen to the whole table"},
  "emb.mine":      {title:"Now For my pan", body:"This switch transposes the piece to your selected scale, changing the tone fields so you can play the same tune on a different instrument. You can select this \"For my pan\" option in the dialog card when changing scale, or here in the UI.", try:"Tap For my pan"},
  "emb.report":    {title:"The transposition card", body:"When transposing, a transposition card comes up with a report: how many notes land exactly on the new scale, and how to handle missing notes. The percentage is how much of the music survived the move. It will not work perfectly with every handpan, but it creates really nice and musical results. Below you can see that one tone field can't be transposed to the B Amara instrument, because the new scale doesn't have a fitting equivalent."},
  "emb.listen":    {title:"And hear the difference", body:"Now let's listen to the transposed version of the piece. One note was missing for the transposition, but I'd say that's a compromise that we can work with.", try:"Press Play and listen to the whole table"},
  "emb.ashaki":    {title:"Now something quite different", body:"C Ashakiran 17 is a major scale, a long way from a D Kurd. Tap 17 for the extended version with bottom notes, and tap the row to take it.", try:"Tap 17 on the C Ashakiran row, then the row"},
  "emb.ashwritten": {title:"As written, on a major pan", body:"I've switched on As written again. Let's see what it sounds like when we simply play the tone fields of the composition on the Ashakiran handpan. Press Play and hear what the piece becomes when played on the major scale \"as written.\"", try:"Press Play and listen to the whole table"},
  "emb.ashmode":   {title:"Transposing to another scale", body:"Now let's transpose the tune. Select the \"For my pan\" setting and let's listen to what the automatic transposition does. There are various transposition presets available, for now let's stick to the automatic one.", try:"Tap For my pan, then press Play and listen again"},
  "emb.sides":     {title:"The viewing options", body:"You can activate the pan and chord tabs here. The chord tab shows the chords/harmony of the composition. The pan shows the layout of your instrument and the position of the tone fields. The pan's scale and layout are fully customisable, so you can recreate your personal instruments.", try:"Tap Chords"},
  "emb.views":     {title:"Table, Tab or Flow", body:"Three ways to read the same music. Tab gives each hand its own lane; Flow gets rid of the notation tables and lets the music run on and wrap like text.", try:"For now, select Tab view"},
  "emb.fs":        {title:"Full screen", body:"Just the notation, as big as your screen allows. Good when the pan is in your lap. Press the same button again, or Esc, to come back.", try:"Go full screen, then leave it again"}
};
/* ===================================== END OF THE WORDS ===================================== */

/* THE VIDEO PLAYER'S MUTE BUTTON, AS THE STUDENT WILL SEE IT (David's screenshot, 21 Sep): shown beside the up
   arrow on the sound card, so the student knows what to look for in the video above. Embedded, so the tour stays
   one file to publish. */
const MUTE_SHOT="data:image/png;base64,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";
/* the video player's speed menu (David's screenshot, 21 Sep), for New possibilities; a null shot would leave the callout its words */
const SPEED_SHOT="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAPAAAAFoCAYAAABpF3YIAAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAARGVYSWZNTQAqAAAACAABh2kABAAAAAEAAAAaAAAAAAADoAEAAwAAAAEAAQAAoAIABAAAAAEAAADwoAMABAAAAAEAAAFoAAAAAP/Clb8AAAHLaVRYdFhNTDpjb20uYWRvYmUueG1wAAAAAAA8eDp4bXBtZXRhIHhtbG5zOng9ImFkb2JlOm5zOm1ldGEvIiB4OnhtcHRrPSJYTVAgQ29yZSA2LjAuMCI+CiAgIDxyZGY6UkRGIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyI+CiAgICAgIDxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PSIiCiAgICAgICAgICAgIHhtbG5zOmV4aWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20vZXhpZi8xLjAvIj4KICAgICAgICAgPGV4aWY6Q29sb3JTcGFjZT4xPC9leGlmOkNvbG9yU3BhY2U+CiAgICAgICAgIDxleGlmOlBpeGVsWERpbWVuc2lvbj40OTI8L2V4aWY6UGl4ZWxYRGltZW5zaW9uPgogICAgICAgICA8ZXhpZjpQaXhlbFlEaW1lbnNpb24+NzM2PC9leGlmOlBpeGVsWURpbWVuc2lvbj4KICAgICAgPC9yZGY6RGVzY3JpcHRpb24+CiAgIDwvcmRmOlJERj4KPC94OnhtcG1ldGE+CpeIyEAAAEAASURBVHgB7F0HgBRF1v52dzZnYIkL7JKDCEgGBUFBggrmnPXuRD31PM879Yynd/ef4c4zK3iKiohgAEGikjNIzuwCy7KJzTn+79Vs707omeme6Z7pWaZgtrurX7169bpehVdV7wU1UIBOgVFv3boVDz74IPr27YsPPvgAMTExOHToEB599FGUlJTgq6++QpcuXXSiwPtoq6qq8Nlnn2HWrFm45JJLMHPmTKSmpiI3Nxf/+te/8O6772Ly5Ml47rnncOGFFyoisLCuED+dWIWlh5cgoywDVfVVMNG/mOBYdEtIxYguw5BWko5VaSvRUBeEGanTcfuFt6BNdBtF+LUAysjIwFtvvYW1a9fi/vvvx+23346IiAhs3rwZL7zwAjZt2oQ//OEPePzxxxEXF6dFlprgeP/559Clbx9cMmUaYuPjNcGpJZKGhnpUV5Wjvr5WFq1JNlajyKCgIJhMVNXoV1NT04S1rq4O1dXV4gOHh4c3xbeEGy7Prbfeiuuuuw6RkZHgZy7rsmXLsHjxYnTs2BFXXXWVaNCUlLeqtgpB1cC0LhMxvvM4nC3PRml1GUKDQpAQEY8OUe2QU5KDA9mHUFHTgKTweCQndERchHeFhMv1/PPPi+8cFRWF0NBQZGdnY9GiRdi+fTtGjhyJiRMnGkp4lfDf6DC6CjAXvn379pg0aRLOnj2L0tJShISEYM+ePUhLS8Mtt1Av0cZ7vYS3PkZ0dDT4x6GiogILFiwQvW9ZWRkee+wxzJgxQ1RwZ/RUk+AeyzuGlcdW4nTRGUztMwXjuo1DuwhrftXTKGfLuS1Iy09DcH0DkmM6oWt8CsJCwpyh1/xdcHBwU5kZeWZmphhtfPTRR+jVq5foeVmIA0FbDuguwNwyP/vss6itrRU97pYtW/Dvf/8bvXv3xgMPPCAEWtsiGQcbV+KPP/4YXIl52MhDyeuvvx6xsbEuicwoysRX+77BqjM/IyQ4BDGnYtE1oQu6te5ulfZgzkGsTFuNjPKziA6NxIC2fdGtVYoVjLcfdu3aJRqsH3/8EaNHj8bTTz+Niy++GDwiCwRtOaC7APNH47lQeXk5+IP+85//FL0uX7t166ZtaQyCjacL69atEw0VDx8nTJiAhx9+GIMGDRINGQ8tmScsyNxzyYWk2DbomtQV0fmxKKspxsazG1BWXYyxyePQiXrZ6vpqHMk/inWZG3G0+BjqUIP+rS/Axclj0DqilRxK3ePOnTuHhQsX4p133kFRUZEYbdx9991ITk5GYWGhmErwyIT1IIGgDQeC9FRiMYn19fVIT08XPdEPP/yAyy+/XPS8iYmJ4l27du1cDie1Kap3sHAlnj17Nt5++22cOnUKrVu3FqMNnhfm5+ejuLgYfM/KLa7cznQA6cVpmLPvS6w8uQY1pMQIInVjSH0IIhrC0YBaVDZUoiakHiE0H+7fqg/uHHArRiWPEs/m0nqvx+Np0RtvvCEEmKcKrJjkBpr1HQUFBaLc3bt3xxNPPIEpU6Z452MoyCWgxHLBJBZeHkLPnTtXKHVYkfPtt9+K1nj8+PF47733EG9A7Z+LYjl8zQo71q5zD8T3PO/ftm2bgOdnHpF07txZ8IIVPc5CSlwqHhh8DzrFdSAN8xqcKctBFQltdQNpoUk2Q0gT3S68FYZ3HIFre12N3q16IZhifRG4oebGiUdaXM4zZ86ANdM8wmC9B195LizpBnxBY0vM03T06FHV5QoLC0Pbtm1FJbRNzEtH/BFzcnJE68sftV+/frjsssvEkJE/Lv94CMlLSzxP5CWWlhJYQLlh4h6Iex8WUu5l+crl5iuXvVWrVjh9+rTooR0NKSsrKxFUGIRLIkcTvq7Yl3cQZ4rO0jC8EiYSiLbxHdCrdU+kxHZBeGEYTpAiy1eBNe733Xef0DRzGbmO8FUqNwsxTxm43MeOHZMlU26OLLfKKQfHIx3WMziakshm2AIig2g+pnodWPoY/JHkAi+bcA/ErTIzW6q4DMvPUjxfGZY/kvRR5D6YXB5GjmP+cJmlskq0ctmkH5ed4bhHcjSM5rl0OQ1Ha2toDTA4COIfXemG/tcTH4PRQHgYVz0Nqjl4b9Aslar5ysLKZbL8hnxv+W1Zmcn0ah24ceCGUcpLKX6/H0JzT6p1YMFOSkrSGu15h48FIj4h4bwrd6DAyjkgrwJVnj4AGeBAgAM+5EBAgH3I/EDWAQ54yoGAAHvKwUD6AAd8yIGAAPuQ+YGsAxzwlAMBAfaUg4H0AQ74kAMBAfYh8wNZBzjgKQd0FWBemXS9yOwawtNCBtIHONBSOaD7YYZ6OpBcS0fjeFdSLf2rr69DHW9oII5GhUYhKiyqpfI2UK4AB3TngK4CHERimlFwEnO2f42TZemoqatCLW3KbwgKRkRwBC7pOhq3Db4JoSEt61C/7l8tkEGAA40c0HUIzQPouuAG5AflIw8FCIoyoU2rdoiIDMWp6jScrshADW3MP5+D5bbD85kPgbK7xwEde2Dz3LZzfCf8deyfaY8qEG4KQ2FFMT779UtU1NZgPFmYiDK5PtzuXtF8l4r3MJ/J4NM4p1FJBzvKK0pRUlpGhzwqUVVVjZ69emLEiBFIaGHbJPPp2OBJOkJZQEcqqyoqyRpJOcq4/OUVCA4JxuDBgzFw4EBxwMF3X6dl5ayjAJu31YcGhSORTuNwqKmvQTqdmNmbsx+DOw7EkPaDKNaX2+8FWZr/4VNGL7/8N8yZ85mY+9tmwEbf+vfvLwRY7eZ7W1xGel69ahVeePFF7N+3z44s3hv/5z//WbEhPzsEgQhZDugowHSYv1E4pXF6QUUhNpzahnoaVk/oOg6RIWQ3ihRaonuWJc8/I9niRmbmGeppwtC5SwfERsegqrqKTl7xdCFIWKjgQ/0tKfAJIz46WkpnoRNpZNG2bTuYqNetotEInzjjY4T8O9+O++n9jXUVYEviWRudVZqNg4VH0KdtH/RL6ite19PYWhJwS3h/vs/KyhIWGQcNHISn//I0xo4fixqqxNVUmevoOB2f/21JRgz4W7GQssURPsM8nYz2/elPf0IHMmhYywLceISQz+vyccNA0I4DugqwNDgmY4nCFOruswdRSXPAcZ1GUu8bSaWoJ+FlKAlSu4L5ChMrpbgisw2oHkN6IKVbV8QbyA6yXnxhe9hsOodXHlJTugqrI44MFehFw/mIV9fOr0k06Sa/Kh8H8vciOToB/dr0suC1WdllEeHXt6zAYpM6tbV16EoVma1yng+Bh89sWSU8LBydkjvbGa7jhi2gcde+JujaA0vk1tZV4yStB58tPo0re09EUlSHxlfcfmhvnUHK1xdX7om49zWFmoQC66elS3EiLZ1GHpXo0jlZmFft2bOXMDnjC/r0ypN7XzboF0fzXxbkj8mU7qlTJ2keHEImlfpjNJmVPV8aM714LIfXKwJcXV2Jgvw8xDS0QeugTsjKIrtO1FPFxsQjPtF47izkGKU0jo3YcQU+y4bN33kfPPevq2v2SsGWGtm9yB133OFyHsybXurEj0cpZIdSmM6pI5zcm9EON9rVxqZ0OL6OfqGkT0iIjBO729j8jjdDdnaOmPcfOnyY3MawhwZyJ9EYwslCyyWXjMVTT/0J4y+bIOxcS+8CV884oLsAV5FyY+O6TXj+Ty/idNZpfFn7PzKPWo8OHcjg+9N/xc233uhZCQyWmm1cXXTRRRg+bASCad2bzeheeGE/nMvLw/ffL8LPP/8sfESxxwp2v+JoGamW7D6vP74Jyw6tREFVEZvEQk0QbUalpbg6si/Lwl3bQNtSeXsqC3MDKcdM0bim33Rc2WsKra97V8vdtWsXjB4zWqz5plIjNYnK3bFTRxzcvx/zyTPFmjW/kBY6kXrhTujXv5/Bvpr/kqO7AFfTkPIEuVHJOJWBfr37ohWtB5ZXVqA92eLqmNzy5oesaWXrjLfffoc4yREe0Wz476LhIxBC66TrfvkZ6SfTaVNHlTDEJl99glBcX4CD1YeQXZlDvRYZsAuSphvcv4YIhRFZtSMdIBu1C0ZeVQG2ZW7FhaTh75PkXSFhk7H/+PvfUf1iDS0VhdAUwWwyl/1A9ejZU6wPHzp4CIcPHTSWAHt3oCL/qT2I1V2AefmkML+QtJLJ+M9//40hQ4eJaW8d9R68O6ulBVbUFBcVI+9cHplRjUPbiGbjfm2pB2qbRL6NqOD1dTT4JVhHIZiMtZvIVYqJfBw1UI8r7E5SGh40B4t/bKiSxJjg+Mqa/lryzpBZkoEzxWfRu01fh727ozw9iefDKjk5udQoVQqTw5IAM042zBefEI/8vHOooSUlQwXHn8BQZDoiRncBrqokpQ4tqySTZrLJlQrprkLoX0sM2TnZePPf/8X33y3CzAd/g9/+7gGhmeWynjhxEseOnkAU2VBu1TrRqSKLh9YxobHkrKwL4kPjaW5LDtPCY4T/oygaKkdTXHxYDM6Wnsb6jA04XZZNPV84urXpg66tunlVeLlsGzduwquvvkLrwFV45pmnxdSB49mM7KmTp2lraSa6d+9Gw+pOHG2c4OediO4CXFpehpM0XMzKzMBfnvozzmblIJF25FxBPnKvnTEd4ZERxvmYGlCSEJ+AjkntUFSQRz6C3sXpM2dxwQX9ScGTQ76hlmIrOXebOvkKDBsy0ummBu4YhnQcjAHt+yM02ITw4FDqd7m35ZVzc60rqSrBN/sXoKSijEY19UiJS8H4LuPIZ3BXDUqiDgWPsNgH0pdffomXXnoZe3bvRes2rYUnyh9/XExrxPmkgb8LAwYMUIc4AO2UA7oLcDBpXxqox83IzEJS2im0I+XVzu2/YvnKFSTMWeTo+xExv3NKpR+9ZOPit9x6E0rIIPt7H7yP1/7v700CFxUViRlXXo0/kH+gCy+8wGmpWEgjQyIQLTa8MCiJdAMJLks2yy9dD+YewYaz25FPDsBjaVvqSHKxMqjdBULIOYU3Q0pKCh566CHRA3/33bfk3G1tU/YdOybj9488RrqBe11q3psSBW4UcYAXYnUN3bt1J2/1n2D7jh34bvEP+OTT2fjsi/9hQL8LsJI2v/Pe2ZYWktq1xajRI9GHXKiGkocGnsHyLz4+Dr1690SHju0RxGplFkYHgWXUvEtNAqCYxiQ8dS6sKsSu7F9xsiSd0ISQ69HudDhkCBLJM6HZXIKUznvX7t17YMzoMejQrn1Tprx1krdU9u7TW7iRaXoRuNGEA7r3wAWFRdi8cbNwH5J8uXn+E00b+eOoMpeT82snehxNCuhtJKyYWrJkCV5+6W/Yum0ruU6JQlIcad7pWF0WHXJ4k3wj81rx4088Loac7tKXRhtj9ubuR3lNORLC4jGi01D0a9ersXNm8fdu4N1nsz6ehddfew2sB2jdqjUiwiNQWFyEHTu34/nnnkUFTaduv+N2h65kvEtxy8hN9x44n+Y+cz7/HI//4XF8M38eNqxfi8/mfI4du37F8OHDSVPbsnzF5pJTtxUrlmMfrX9OmTINX8//Blu3bsXKlavw4IO/Q2iYCcvp/ZbNm92qQbzXuLK2AgdyD+FU4UmEUG/cLa4rLR0NQFxonMDpffEFdu3ciR8W/UA7zirw0MwHsWr1KmzZvhXzaE48ZdIVtGx2CitWrUQaLSkGgnYc0L0H7kKuNLm3+fvf/4l7f/MgamlZqUvnLrj73jvx0O9+61SRo10xvYeJt1HmkMKqffu2uPnmGzCFFFYcOpH2tbS0GAcOHEA6ba0spQP+bgXSTp8uyiBPhftQVFuAmIhYDEkeRstGvQmdL0TXXArefZZLy0hjxozBnXffJQ7u85tOV3ekJbV8HDx8hK7nkJd/zpzAIH95CY6PODraUGMQMh2SobsAs5e+drRpo2f3VKxdZ0JVWSliokJIU9sKkeF8IkmbIJ1H5aEcb5DwVTh79qxwc9mzRw8ioYFcabL7VrNg5dAQmofY7PytsKgQ7NpVbcXhXVcbT2/FoaOHUVVehQ5xnRBTGImck9nIBeFvLLi3RZktbySTJrodzXeLaB38KLkQFTQQQXw6i/eGsz6ggITZkXtRX3yzPPKiGUYND/sz7kSCzOe0/enMchBVKOmb68K/M2cy8c9//AtfzP0CE8ZPoK10Sdi8eSsxLANPPvkkHvn9o2IjgruZs7DuIwsQi2mpYsf2HcijLYs839QvNLOr+c4iN6q1vLmCay83KnbspXixDESJ3VU2cTrGIf5RD8J5uIvLgnLFt0IwraCJEu7JSGHF7k4FPTbVit/zT+6dFSodHuzptc6Ee+FI2gLbvn07jBw5Crx7jPcssHdIXwfe815dVU51SX4DjO49MAvwL+vX4drrpuOd/75NO4tM2EJKrZkP/x5bt+8SvWUkLb24E7hln//NfMz9cq5wKM4aT/6p7dWU580ia64OzXf2qbmXlLpCh7RIgmyf3GUMC64UhOB6gEvCo/baTEFzynrajSUFuXJLjZncOymd1lc5Om3z4G9ZRorFw4eLcOjgQaxevRr33nOP2KvAfoeNHHQXYJ4L3nPXHXSkrC8NHcMFL3h/MP/i4uJpWOXejiw+usabBj799FNhDcKRk2ztmM+fORDkOaBETORTGiWWG5VQGuYDJjJGmIH/vPVfse3zyiuvJEWrcYVYRwHmCt+ALl1IifXYozQMqKItdelIo211c+Z8geioGNxxy43kyV79MKWClp82kxZ3/vz5Qni9bablfBdla3G1fjKKQHpCB+ttikhHMWfOHKSkpGDo0KGGGE7LlUnnZSTzx+W54PadO3DV1dMxbepkbN28Aff/5m4Mo2Ukd4SBjcYt/WmpOEDuHeF1h0o5dgfi/IUDLMTcE69cuVLUM6PSHfICBX2IY+E1/3h4EhUVjdTUVIwaMVIci5s3j/bwlpZjNO1YUqP1Y5M1+/mMKfW+rMDy5nxKHz75F1ZzkyzRbP0kxRrpqorCJmDzDXc8XN+GDRsmTlj5pq6RcwQyCMHKLLmg4xDanB33litXrEBCXCKuueYaEXns2BV4+unnsOaXdZg587eq9sey9UO2+lhE6n81gi9XeGVx1r2v9ZMyDAEo/+QAj+5yaGMOK0v5VJURtNK2nNRdgJkBH3zwHm2ri8TAQf3QoVMXsdEh82wGulCPHKHyNBKfO+U5MPe+RmSoLYNb0nNTByUKZf3UksppWRaua7wsyb2xEYOJx/lqA88PEhMTHe5p5UKzkTMWNur7MWrUWLz7/vuYMu1qdKYjZyfSydgZ4bhv0uXiEDgvL9hWB7nhCsfxPmJuEb0TrPtb6yfvUBDIxUscsK2AlC3XN1+sW6spsYnNgaoNvGTDpmPkAheYBbeMjtPxcDfEFI5bb7sNI0eNwIkjh2kfbzWuvf469O/TT5jXKS6m00iN43s5obXMg99zaxiY+1pyxTv3MvXbOxkHcnHKAVO/ftraTmIhY4PePckOkmUYOND5+VdLWGf33ODs3bvXC0OaQH/r7DsE3hmDAzovI+lTSKPOR/QpbQCruxxwb9TgXip3afQ0nV8KsKeFDqQPcMCKA/4ls1akBwTYih3SQ2D4LHEicDU2BwICbPd9AsJrxxI/jFDcqVoBWj34RakDAuwXnylAZIAD8hzQfSOHfLZGjQ30vkb9Mm7TpbhTVQzoNil6JAz0wE1cDQhvEyv8/MY/RdE9pnutB+YNHlW1VeStvRoRtLkjLNR8Ntg9sgOpvMkBe4Gwj/EmPYrz8hMyFZdHBlB3AWaLEbkleVh2eBU2nN6E8up8dInviku7jceY1NGIJP8/vg+B3tfRNzgPZICK7r+l1F2Ac8vO4fM987DoxGJ0TGiPjvHtcbjgGPbvOoxzlfm4fsB1ZEOqZY7kpW2lwpEZOSgLIa99+pr8cSSG7sXLV2v5WPdy0DGVn5DpKQd0FWD2X3uyMB3bs7ZhdJcheGToTLSOTMKO7J14b8fHWJe5GWO6jSEHXi3PzWgDuQsMIXNBXVO6onfP3sITw7Gjx5B+Kp2cm9d66Sik+9XjPKn/7jPIICl1FeA68iBfWF0qHFL3S7wA7aPNnhm6J/TARW0HYtuZncgsOtPiBJiFl49JXk1+kO4iG8lt2pBLUQp8iuqzzz4jR9/fo4wckrGjMiMGx8Lr+I2hyqGKTFXAhiomE6NrDeIKGk7KqjpyypVVmofqukrBgLDgMHIH0ho0qgT7D/Zt0H7+y3u1+ZDI5CmThSeChx5+iMznPiLuJ06ciN7kM4l74dq6WvOhDCKBGzt+FjaGfFinfJi1JtXA3+lXywRde2B2i5kal4z+bVKx7uRKRJCbwgHtB+A4DatXn1qFevIL0lIP5bMf3EjqhX/66Sds2bKZzOmGkpvRCzD+0vFCuIcNH4aO5KlxwYIF2L13Ny6bcBl5cZiCbdu2YfGSxeRHqMLr5oKcV37nb9VWPN3g7ci0i9Ata18g1lWAuUCdSIDvHXwPvgqNxvrsjdiUtYUcXMegOrieeuEYtI5p5Yty65pncEgwdpI3xizy0nAm4wz1sg1o074NWejsInrcE2knyFtFO8yYPkM8J7VNwjUzrkFYeBiOHD2C8rJyr8+RW3Y11/Vz+xS5rgLMWthzJbk4kXkcV3SdiAeH3Y+qhipk0bLS7O2fIiEiDu1jOviUAXpkzmeiWXBPnjxJI+IGdO3SFXfdeRcuHn0xFi1ehL379mJP3R7yVt9RCO5ll12GzMxMcsM6C7t37za7HtWDMAc4W4rwEtvPu6CrALOHgjPFmZi9dw4SyA70tb2vJc2sCWvS1iCvIgdX956KaFNUy2Q6VabIyEhcPOZi3ENW/juTk7eFCxdi3rx5YKMEvLS07Kdl6NWzF3muv5iG2VuwcdNGMM+Ea5aWyZVAqTTmgK4CzOuePdv1xG1Db8a3h77FGzvepMoZinZxHXH7oFtxSddRGhdHLTrtFVhMAWuh2ezQjOnTceddd9FQOgvPPfccNm3ZREq7GrEeHGwKFktM3AuzHoAVW6kpqdizb4/aQngE31I6rfOx9+UPr6sAcwaRwRHoXJmM0HUhKD1ZgkqqwGXB5fgu8VuYrg3GZZMmMliLCqyFHjRoEKZOnYY9u/fgnffeQdqJNHIjEyrmtqxtZi01z3u5N5739TxcNPgiXHfddcKMaVZOlvAh1aKYEiiMLhzQXYArKiuxbfM2zHpzNkKDQ8knUrgwSpfROR0TJ03SpVC+RMrzfi7jBf0vQA9yMZqUlISXXnhJaJSDgoOEIK9dt5YsdY4SHvA++PAD/PLzL7j//vswbdqVYPekn3/xOcorSJGl8zpxoPf1ZU3RJm/dBZgt2+cX5CMlJYWcfP+d3DeORCUJNSt6WrVqeRpo/iwseCdOnMCiRYsQTW4rLQ3QZ+dkI5ycvPGw+uOPP8aaNWtwruAcvv32OxSVFKOspEwYBSwrJwfgLUXCtKmrASwyHNBdgNkELO9A4t1I7CSqPTmAtgzcY7Ewt5TAZWFzuitXrcTSZUvNGzMsCsfCzLqBOtpmGkz/TGEmOpkVhuMnjuPQO4eE8HMcw+gZWgrHW1DVcetz6y7AbMc5NzcXCQkJwhzszz//LO4vuugidKLNDr4L6hRYqqBJOlgx5WyTCr21KjofcuBfICjjgGiAXLZCLgGUZWZgKN0FmL00HDt2DOvWrcPGjRvF/JeVPCzAL774IngN1LtBlSgK0tSn8G6J1Obmz9W6ifamG7Wlb1nwuu6FZlalpKTg1VdfFZv42fP5vn37xNyPta8fffSR8OCgP0tZBKWfutxamvCqK70E7Vtp4dx5qCyGy+JBosvRVRGQo8R+Fa97DxwWFia8NLCnBklpxa5XBgwYgLy8POG+UT+OBcTPlrdctf0pCKH1J4K9TKvuPXBaWhoefvhh8eMlEvaZdPDgQeHjl3cnRUXptRPLc+H1HIOXv6Yu2flO5N0TXt/Rqwv7XSDVvQdmrfMkWu/929/+hgkTJggFFrsc5Z1Hv/nNb8A9tPYhIHpyPPWrqu1XxMpx2ztxuvfAsbGxuPLKK/Hb3/5WaKN37tyJDh064LHHHsPw4cN1KGVAeHVgqndRkvC6J7/upfJu4bTNTXcBLioqwtdff43XXntN9LYpKSlCkfXUU09h6VJaJ9U0BITXETv9pmoToX5DqyNmezFedwHmOfDnn38ulo2WL18ulpJef/11sQeYTcvwTi1tgrbCqy02bUroLhb3BcL9lG7R6lF2HiV2i1wjJNJ9Dsw7rVq3bi3We9kiBQfekdWxY0fwGrE2rkJbkrgZoVr4jgb3xNC9VL4rpXY56y7AvFzEPbCJzgFz4CH1pk2bUFhYiLFjx4pjd54VJyC8jvjnV9Xar4h1xHHvx+suwCy4rMjav38/3njjDTH/5XVgXlq6++67PSyxPsKrD1YPi6oyuefy4DkGRSRbZGNxqyhpYLass1VK6SvwBv6IiAjxyFYq+JkVWKtWrQIPsd0L7qZzLzd/SqVeEHxQOibSbUI9SuyDwuqXpe5KLD46eOTIEXHiaPbs2eDtlG+//bYYSr/zzjsoLS1VWToWXP2EVz/MKovpJrjbMmGVnzZYrFBKDw5kT1mODhJLuM/Dq+4CzAcZHnnkEbEfmjXOPKTmLZWJiYluKrCCzHtidfhYAeFlpioTJdXsdyJ7rnN0klg1IS0rgamkpER1ifjMKw+FHR1/q62tFYf2eXjMw+V27drhxx9/FJs3+vTpgw0bNgj7xw8++KDIm2lQOpTmHruyskpzIXYpvAzguqY55qWn6R1jFm88Ia0ZtTZYmvHRnQuULl67RmCV2fn3YGLLEWoCCxrPZ5OTk4XlCNu0/J7PAJ8+fRosyBxuuukmochio+WbN28W9pH/9Kc/YfTo0cJbgdKlJG4MGHd+foEYktvmrfuzzkLoLv2uhcBdzPql80ea9eOG+5hNAwcOdD+1TErunePi4tC/f/+mt5zH1KlThUCzsPJBdxZGdwIfQzx4cD8Nv132me6gl09jmZV0b5AaqC0ZGrdQMsTJRMnzXMSqg3aCqMW+0n0ZSeIcC7YzCxUSnOsrmUqXhMg1sH4QEg1K6pgEqzE1SrLWOEu30fkTrW4X0gcJvSbAPiibNlm6Ej5X77Whwg6L4QWikUD36XQ/pR2zWnCEe+PYFswQq6L5SDitaJB50Ldqa1dofemUYcx5GBXogeU+unZ1WA67R3F+IRREpGd0epbaIwb7WeLzXoDtZNUuQsMvKuF2s366mUzDAihD5S90KimN0cty3giwIRRfUo2RBFl65quLmuLitSUmn96TrtLD4DECD/P3r+R+J8BB5PUgNMzaprJLlssJjMtExgDwp+rckoTXX/hu+vAfrxqjpiqkooq8Hhw4fpzclCowgt4ouP4qv/5SifjTeS68CitAAMyKAyY6TWAVYeQHriRBtXUg3yWuyTSQ8PLuND5CyWvhjrafMgxvcuGrFIIJnje8cDojB23IM04ZrSixejDeVzD95m/+1QPzvumF3y7A2j17ERIm0ws3138dzywp/5AslHxwo0uXLsKIAW8xZSG1FEp+joqOQlKbJERGRdJ02Hxgg03w5ubm0d7vcsrQmDVJG+FVzk+9Ia24bPWgd87u4fe7OXADebCv417YNlgILr+yebSFduNZHUbuSPn0VRjN1ydOnIirrroKP/zwAzIyMqx6WSaEhXzoRUPw4MyZwgi+tIecjSB8SO5Ht2zZTD2xTGPlRim0TKKd8BpQUgxIkty38zsBtiqEA5lyEG2VVNmDe5i4kYmJicW4cZeSz9+pwpk3n6AyC2a9XdZ8xLId2c/mk1Zvvvkmdu3aQUPtUPIjVYGsrGyx77u2tloIsckUTMNxHm7XUi8eQsczeS+On9Q2u5IbK8Ifueh/AswyJf1svr974maDRIO+m3tfHiLHx8fRNZhcyJwT56Ath83mQgSJ3piN27P7VRZg7nXT09JRWVWNSjp5FUdeHW+4/gYMuHAAli9fQUcx1wuj+OwMnO2KLVmyGNnZOW4fDrEtvdJn7XpfpTnqC2clvI4f9CXCDex+J8CS7EpXZWXWRrSV5UV2ikjxVFpaQsb8vsCnn36KKVOm4MYbb5IRMj6Y0SCcgPM8mT029qNTXKy8OnkyDfO//ga/sANw8iHVp09fahASiIQG6tnH0VHMMfjkk9nC97J1w6CUSqPAWUmL74myIsfqwfe0yVDgdwIsUwaZKO8KrAwBFMUaZ1ZGhYihrzwMiSM5+majfyzALPS//LJGmNtlIb3/gQdQXVOFdWvXoz15s7jt9tvx0ksv0dC6GmxTe/nyZTTPrpVpGBzlpk288au1unI2lafphtNbPahD6EXoFiTARhBa9V+OlVNZWWfx3//+B3U1dThDDuBqqqpw+PBh3H///RhwwQAyhr8ZK1YsR/cePXDttdeCnaQvW/YT2RUr1uiIpnq6tUnheyFpoqDpRpuSeQtLCziNpG4w7S3GusqHFV2s1GINdGRkFMLDwlFJ69tBNKQOCglBdlaWmOOyMiyc5siJrVqjbdu2Yi7N1lBSU1Oph+f21z8bLlf80eo9y6Wzn8jHTnjtIrQiR3M8fizA/im45i/YQFrqOLFk1KFDe7Je0g/PPPtXPPDA/Yih4TQbK+nevTutC7cRPpSjoqMxY8YMdOrUCYsWLRKCf80116JXr15ig4jmtcIrCPUXEkU52AHZRXiFG+5m0oKG0O6yQP90vPuKNc18ZQ01977smZGN+v366y7Mn/8NDZkPkdmhaSS4PcRcuH+//sJe2M5duzBh/Hjhmmb5smX49LPPcMUVk3DPPffihhuup3XiD4XXR3dNFOlfet/k4FQMnb70Db3u5hoQYHc5pzAda4gzMzOFU7f09DShdWZ7+nl5udi6dQtOnDghDAB+8sknNBfOwvBhw8Ua8pKlS7Bk8Y8oLCoU9sXYqudS+uVkZwuD+GE05GbzvLz8lJubo5Aaz8G0qfvaYHFUGlnsspG2GBQB2Sby6TNNubhP8J/AvpW++eYbvP662V2pP1DO+6Dr6lhbbKI5rHlHFcfV1tYILXVoqEn0yvW19TT/Jc11QxBqaaNGCCm4+FdTV4MG2rxhImOA3IvzvLlGWPxsICWWyamW2z3+OK7ITW+abtzJwaPETjO0w2wX4Si5PCA3wC+++CIuv/xyDfx4OcrbcTyP1qqrysXGHTmoQA8sxxWN41jo+GcZbON4uYn3dtPKsBBgy9NWYcFhgMUJSh4uh4dTnJeDfBVXS4Q2WORytcNsFyGXiuMUAzpC4LN4P1Zi+YxnumZM/a+L+tQ4YNJ13OQCuQHrux1JdhGOPptiQEcIfBofEGCfst86cxdiYwGsHNIikUe3Rq7mdrTZRTgqumJARwh8Hh8QYJ9/AncJICH2khxrV821wyRxzQ6jXYQEaXllIEWAlokMeR8QYIN9FnUyqQ5aXVH1xK2OEjloWRF0KZOyqeTQ+01cQID95lM5IFTnRQSXMuGALL2iHYqgS0JdAuhFsq54AwKsK3vdQ66+71OfQgllslVeNlIJNvdhOEvpJ4vFJU0uAWTR+kNkYBmp6SupEQKDVQgmPUj8aSqNpzfmEmqL0x2aXHLacwB3yDJMmhYowGoE0d3vYJuHy1rkbkbK0wlZ873AKSfYNaRLrnoO4JoIg0P4sQBzZbUVJF9xW44Ol7XLKbHui6L7KeUJ0hqffC7ax3rGf+3p0QejIebAfKyOzcNUKzEXqw8fdMDKFd/2p0M2lig5OxGabqQIVVcjVH2XNLgEUFVkvwX2qQCz4O6i0zZ33XUXLr74Yjz22GNiY79b3LSVFTV12JO0qoiVMlKWSE0R7DF6ltoen4FiXAqvSwADFcYzUtwS4IqKCnGEzWxl0T0C2Obxd999R8fi7iGjbNm44447yA7USfCpG0VBkgXpKpdIeufqqiatHKzqOCZIp2CF2urBgwy1wqOMBKfi5/Ql43cJoIwIP4FSLcAFBQWYNWsWnUW9AZs3b3armJWVleJI3DPPPIO+fftizpw5mDx5sjhqV06WGA0duC47+ykmXkLiPIF3Rcfg1f/8kk3nFaPxrWoB5uN8v/76qzBazobY1AY+vXjo0CG89dZbwiLFP//5T7K2GC/MqXJP3Lt3b7UojQWvTC4taNZBRHVAaUGwrreyMsqRsi9sSVEEZJvIr59Va6E7kHXEP//5z8KsS58+fVQXng+3f0ZWJYqLi/Hyyy+jc+fOOHDgAL766ith84lNq7aIIAmRojrFwI4Bnb9tEdxyXAjHbHGc5jx6o1qAw8PD0YOsI7oTeOi8ceNGYVVxJrkRGTVqlLDpxHNq9h00ffp0cAPBvbR/2zq24I5iQVYMaIHcm7f6NyN2smoX4c3y+kdeVgLMvnz27dsnFElsVO26664TtpykovAyT1paGnJycjB06FCyphgpvVJ0Zb9AbJSNe+6bbrpJpOGD7Yxr8ODBTYfez507h/Xr16Njx47CdpQi5EYHUiyfGglKE5qmG5cc8m958W/qXX4cBwBNc2DuHZeR0bQHyJj4woUL8dFHH+H//u//xFBXSsue9V544QU89dRT2Lt3rxSt6MrCz7aOj5Nv3xtvvBFxcXFW6SwtVrCdqP/85z9YQ14JOLAJmSqylcyBe2a//lSSIIvSOPrDQIoAHSGwidcSlw1qjR79+ptqxAN30AgBZgFhxRQrlIYNGyZ6STYgzvNSXqflwL0zK5+OHDkihHzQoEGq8uNelQUylOw6cY/rKLB/IM6Hh9GXXHIJeebbgrvvvhu3k1cCbjTYllQlCbNUxY1fNWVKKhEv88o6ysPSKc7HOlenT26T5FhEZd/IRjql7Lx8KYbQPLTlpRy2cvj888+LITKv0bLFw27dugnGsF9eFt7WrVsLd5lsJlVNYKUV9+As+Dw0dhRYE71u3Tq0J299u3fvxvvvvy+G1iz4W7duFWvH8+bNs/JIYFmn/Oq7M+EuCVYE5IidFvHO8bgkwwJT4NY4HAhmBdKmTZuwZ88e/P73vwdvsHjllVdEHAuatFTE6788BB44cKAwMK62CLy+y0LMCjDL4bItHoZhD307duzAu+++i5tvvhkPPfQQuAdn7TUL95gxY0QPbZuWn7maWv7kYAwVx8S6DIqAXGIxIkCg4fDsqwTzss6qVavEsJZddzz99NM4deoU/vjHPwp3l8eOHRNz0LPks+fgwYNCAaVWQ8zDYZ4D8zCc13wdBd7ZlZubi/T0dOHg67777hPKrrVr14pRAa8Rv/feeyTAo4VJVmtRtRTb5nu28sj/lMBqA+OodE7iJfKcgJhpcwrg+CXjF6HpRooQV+VCJJ/eCpmKB4f5OnyhAvl5AhrMSiUWTB66Pvzww+Qwq0gICSuzWFv87LPP4qeffhJGx9mc6ZAhQ1SzRiieSPnE6Xm+bRlYaHlo/u2334pelnv6iIgIPPnkk+ClJqaL58SsteaRAQ/rq6trLFEoupdkRNsqKJe1ZU5a56Y1Pjn6A3H+xAET944pKSlCQcT+d1hw2QcPh8cff1wsKXEvzb0n99CpqalulS8qKoo8DsQILwWMgAWZPRGwxpuHxdOmTRPDdXY58vrrrwtD2uy5npezWBves2dPJCUliQZG7QjAlmBLMdC/sZdyU5ATg7oEUwRkW2RzBy5w26e3j7FPrnWMy2KqylBbbKqy9jGwadKkSRg7dqwY4toOb3lTBbu4PHPmjFhW4s0W7MvWncDKL57/zp07VzQG3CjwvJsbhCeeeKJpvZefpUaCGxfucVkbrVfgyisFfauBlJOLXBxIk3W0QlxSwQLXFssBE/dmvCHD2aYMHlbz2iwf+XPXiRZrldmZFw+PeU7LjQEfZpgwYYLDvD3tadV+NUksOJ0LMVOFuoFGG3X0C6IpRAj9HGFvqG8guDoxZ2eXKkHBtOZN34cDN2aMg4NEWzC9CyI49cG6OVCX3pO06nJSBi1xQxl0S4Oy2oklFY4Flpd8JPeVvFeZtcMsbO4Grohdu3YVG0G4MkoV0118eqezFGbOy91qwlOFOBq1dKBpSSnx8CxNG4T7FFGARqyUWV1DHWKiYtC5S2dERUch62wWsnOyxbo3a+1jo2MRExcDk/AJTFMQ8plTWlJKvxJx7z6FZk56Uyzd5aWZ0sBfSw7ICjBbx1i+fDlYocQ7pnjdlY/9SWvClgjcuTe68MqVyVKglVRAbqRYb8A97vjLLhf+fX9cvBjfLlwgdOLmPAgrOTKrp39DLhpK05X7cNGQoWKNOy8vD19/PQ/fzJ9PjsxqcOvtt9KS2q1NDrYY/0LCNfvjj5BfkN/o4MwFZVZSavUgV2TfxLkogjVRqoCtk7aQJ1kB5vkqrwGzJpjXiVNpXspzYXeHz7rwiusf/5wFpd/XFo+LdK6qPg+Zo0hhN2rkSEycNBl8wop7YlsNPJNeT14I27XvgOnswDs5Ge+88zZO0zLeNbQP/cppVwojB+xDuD3BHDiwX2xkKcgvEF4Oc8itaAntXKutqaUOuI7iQsWwu66GvCHSUJyVgM7W3J2xLvDOPzggK8CsLb7qqqvEPJXXhPnUEA9/jRB4Xmjpuc8pTXKCaRsnh8ASxoEwM4iDV6JdCaVhb5euKUhO7iR6YmG9pHE+a5klz2vbtWuLjqQw5A01CxcsEMtp4eT/917qkTtRQ8oKv6jIKHHsko0olJQUo4r2rjMNfXv3weWTJtIGnHKsWLYcuedyMZ6mOsNHDCODC1uwiU5/sTDTbNky28Z7Z6WQAW+KcjedY541oVZ8I1cexYlVAXovJ1VkCWDTv558AiHkYzYqJg5tO3VEd9oskdKrD+JpW+Xo0aPFTz1adSlqaJNH5slTOEonoTJPpqMkvxCVtNbbQENL0t4QMpozk1PsINL/sF/cg7TRI4R6F9WBUakNUhqZr+ioGvNIpZjmpv/7ZDZmz/qYrI1MwfVkwURuBMM9JK91f/PNfOTm5IJ3rEXTHLhN2ySE0ny3lHbGJdA0pm27dhhw4YViGysPzdfT0tvCbxcKY4CJia3IQspNxCHgGCkb77zzTrGq8NPSZeLctlW+johWwxctcKjJz0ewMp/cR5Q4ztbULj4B9XRAoITmUVt/3Y2FH9DeY9p3fAF5ip922x3oR8f89AolpCxb99My/DT3C+SfPYPYhERa9+2BtrR0FB8dTtlKLDRfee5cRcKeERpmlmu9CJPDKwmyzTsRTeRJlFq9psannn7spFm0Q1YvzQ8sXDkkwEuW/CiG2LxePnHSFbjmmmuRSbvf9u3dh+49uok96IWFBdi+fYcYGV1LQ+xYEuz33nmHDp3MFWv0d5BxwNraOvAQ+7M5n2HP3j3UaMhSZkGJt6TRW/lYFM2DW1dc8wC1pklNdz7712aEVMvKiotwhD782kXf4Z+PzsTYqVfi1ocfRSQNq2nGRj8ummfFYwVM2qHDmEUbNM6dTqOG4jYMu3QCkmhpKaRRy9pMlPUdH6oIpmHmyp3bQR6xG186kC7rpB4+OSkzZS+qpy0INTjcK5LK3Wne3DCxIKekpOA2OnU1Zco0HKbdZ5988gmOHD1Mm1cK8PRf/oKs7LM4QwdPuDeeSfvD+9BIqWfvXlj7yy+0k20hGUPoKIbsX5PScdOmjTxmEf/sMveRLDnnAvPJjtJAhAsOWI9DqSJFU488+OKxuGD4SOzfsglfvfVfvPP8c3jwhZcQHctC7JmwsPAeP7gfH77yKvUqbfDE53PRitaIOTBmV3WLFUF1dbyVUoLmlN4IjsrdXOukXpbY6DIwH7gsDNpACdigwcyHHkZKSgq+nvcVvlnwDc5mnhUGFeppfZh7aV4VCAsNpzlwCTJOZ6B/v/5iiYqnE7wJJzo6mtbUo2gnXUck0HfkoXkI/XMdXHHdNYaWBKHg8xmmuKKDkKMmlI4LDiRBvo966HPU8s/78L1GMM+Kl00KmR++nIe4xHj8/tWXhfByxeefZ5jlSuGNOK780s+cnyTIDnMnAN44w1tWE0njn0zXa6+9HtFR0Xj5pRfx5r/fwEmyfFJLy0esSeYTWa+98QbGjBqDiqoKEto4dO3SVawR55NQDxhwIZkjuoYEPF9YCh05ajQmT5ksNs3werFsYJIDwe85YN0D2xSHe5IUWv+9+vY78B0pY47TMb/u/fvbQCl/5BNJR/cfQObRo3jw+b/SsLzxZJKF5FrcKkdsGEhJKoLMDVJjYYJpt1QoKQpZYSVEnXre4cNH4De//R320Jnng4cOomevnrTGG4ErSOF1Ga0b804sXiJa/fMq2qe+h3bBXYJHaW/62EsvRXsaQveh77KY1pVZ6XXTzbeIfeJvv/1fpNHhlIceeQRXXz0DmWfOYjWdNDNvHHHFWabMFYwFo1WCq8BskYn3b/2FTokzTgWYgULDTEiloVpKv35YR4qW7nR1NaeTkNte8+mo4C6am3Xpk4LufdmiJfcODgcBtsn96NksyA20SYN5lUflZkHlPeVCsmm+yzuojh07QnEZtARUSvfHxdC3c+cujbvUGsTBjbiYWKzfsB61dfUklFdTb3sB7Yoza7iXLl2KlNRUyqNBDLu3bNksdnstIB0BryHzXnbeiFNYXNiIU0sWqpRgLbNW09Bomq/xkLkQYG6PghBPWuFeAwdjE+3Oqq6oRFiUOmN2UrHLaCthfm4exl85ldDS3KxxeMc9vdLACp8QTusXoQG8X3nb1i00tN1EiiqakYYEiyZr+47tZC5oMy2N8fJYEJaRMLLG2ipQWhP12qzgWvPzajJJ9AvCaLNGLa3r1pG2mXt0Pj/NuJmFPNwOorgN69ZiLcEG0z3DBPP6m1zwpQzK0ePjOIfV0OELHxNM2bsQYDOBPLRrldQGlaUlyDp9Cl3cML7OSynlJUWoKDyHTtTLcODVXfNfaw6VVRXjeO5xlFSVicraUNdgrrSEg9dF92XsF5VaIDH4H5YRFkD+WY5cRJyFWaKQMOeNkomW9rj3FpsySLDZxJAUGBdFNQVWalljUyqpSuGaslJ0Y0GaInjDAPkB4aajucfQvU0qtdLWn9ySidySxyW0QhjZhD6TfsItAa6lzQfF+edo1ExWORIcW+XgzRunijLxxvYPcKTosJgL8sSRG4A6Gio2VNWjNrtCaFf1qW6WJdfmvolOqYe1lDY1WVA6P6hTTkrUxAknMEpeaYWnOS87vtpFNMMa6S74lfV/x+pjPzeeaHFMmol6iwjSnBaeK3AM5OQND/mqaF91REQs4YlyAkm9Cfcg1CM1mGj/MHU0/EM49WLhNHyOoCsNQ/kTcuCrdC8i/OGPJMge0WpTaptHe9QOAOyi7SLsUQViDMOB4GPlJ/DF/q+xK/NXp0TxXI5/lZUVTuEcvTSvezZQj0q9CM0FHQVu+ELpfUQQj+55FxPvZuLztLU07+OfeaO+bXqudkauena0CSG2i7Utlovn5vTNdy6SaPraN7lqWgRCZtfZ2kVonaN2+OhAP3C64hRWHFmB3m16ISacN2s4CKRVZYFyNwi+sEKlkUGskJILoTScjzCFk7IqFNEmMsUTEomY0EhERdB52NpQZCZk4DD2Exr7hsCSOnnscjl6J45ps6JJEEt/HPBBNVV2GdhicADgINo2deDZeBwQFjmqGqpwsPgwDucdxpBOjo3W8Xf2QH4Vlz4pOgn3D70HN9ffgPjwOMSGxiEaEQg1RaC8tBwLMudjf/0ehMkIsGUmflMvmaluC7FNKW0eLfnh9N4qndWD02T+/tKqQeXC2EUYu4Q0TmWK63Gu6hwO5B4kAebDCw6WHbxUlkhTJPom9pXNrQbVCGkgsrnSO2pNLD4CV0UOFlHmCLf+eo7FoWhoKcROy+aQAqepAi+NyYFg1u5W086gsppS5FRko0bsMzYmsdzQCIEkbbTTwK9tftKj03QuX0pYbK8uE1oBcGrZ4KhBkgV2EukwAydp+JVb6dQmUgvvgmYPXts1x3YREnKHLyQAn11NrUIT0CaqPfom9cLoTqNpvVLR0rDPCOaMeWug6tCYhC9Nn6PpRjU2mwSW9ChDakWHFTbHb6zA7B6UbZg0J1OShwIYBSB2ZBokQtlXMgixTsgwvTP5bcRHxJOSKJoqtpJi8VdzN3BaT9Kbh/bmMzzu0tBMgauOXBE77MiwLJ8SftogEMnpj1tzYk7cmKfFrU0ODh/dSOIQl5FfKP8qyiF9VV5TcqzZiLuvCHAnX61m6FxhOTj8TBKAGcwJoARge3UuEp68tc1J9tl5BrJJ3Iv0WkbukWeRyuG3dvjCIrEBb4OzSnMNSJYTkojRykYKTnDYvOLqpygwoPRTlICBVCcwYxZEiT+Kc7JIqCCNA9xW0VYPCnAaG0SdjKqD9lXJg1/6+R9Yf3KLQ4WurwhzlG9tXS1Kq4sd95qOErqI56qqqrpKCRQnkgeUj20kVrx0CuGiVEZ97f0yORVHpy+NykMzXabdxbtQtaeENkyEY3AndU67fVG0/IoC/Jqxl6aI+nCdq5ZqzFJ9dJnQDewqk5jBVSZy+iG1xOU0I91euvwsuuWsP2JxSOZU6UmsPLYCZdXl+ufoQQ6VdZU4UZiG9OJTpC2334XlAWqrpFxl+ac6KEqoCMgma7eoscGh02MTaU03OmXkHlqXwusSwL18vZVK2CysaqjB4dLjOFl82lv5upUP976bMragpL5U83mwHEFuV0lFCZuBmu/kqKA4AeASyiaxEngHMA6ibTJQ/KgxOsX5ugT0c+Hl8gmFLq8gllSXIK8k22WZfQVQS76DMkvIyfi5Q2QEzoGdJx2Ic7vyuZ3QQSG0xqcqGy9l7oCmQLRjDjSuyLBel04bsQkYg4bSqlLszT6EsxXnHFuY0Il2t6svJ3SauPll852zQiiDasZA8GqTNCdWfueNPJRTc15BCgFmsY0yRaNVTKJhC59fmY+d2b+ilvZCa72MpKTQHtVRp4mdvrQmTYC6hncNYYlWHbRlysC97zkQLDbg0bG9ttFt0T6uo+8pkqGgqrYSaQUncKzoGCmv2M+PFLjyKflJ8I6utjjk4Tyq6k4Tm186BZEnSZdYQYdaYlwkUoROEZAuRfZbpHSYIQitwxJwceeRSIwwZg9cXFWC3Vn7UVRbJHYYBqOOGK7mazOss5/t97OEtX6nJlfrlI0k2EVKEWbMLvELAJdQElLzVSW4deLAk5E5EBwVHIOJqZfi0tSxPhmaumIOjxAKK4txJD9NnEUiO40ki1ptpnSVO7/n2i/9lMC7gFEgTC5BXAK4oMHutRKESmDsEAcidOaA6d6Bd2BK90mIMcXqnJV76CtrqsjQwHEcLTxKFjrq6RB/OJlBZptaxe4h9CiVuRLzX/MwvnkwrwptMwKbZA5f2MDxoxpYmeQuotzC7lYiF4QEXjvlgOnGvtfRWpI3ezSn9Ni95J0mHWLaYGTyMJwsSkNNeS0i24Qjvz7L3u6Am/Jkl6mCCHNd5b9SUJm5i8ru4rVL+XWZXiLb2VUTJM4yCLzzlAMmIwsvFy6cPBAO6XQRBnW8EIXVRcjOz8HKguXYUr8WofTPKnCFk4JKeZKSuX91o7bLJpGNdECWEthGGJegLgEc0OButLfzU0On1yuPGuKsYI1/er+R3BCyUtk6vDVCo0zi7HKjbQ6rwlg9cP2Qgk7fw74K2sdIJOhy9XJ2upQhgNQjDhh37OykWJay6QSs+RUnkH7NsZrc2dMiEyNcotYJd6J2mdqDN4E4edUEY7wb/6TaeHxURpHf9MBScdh/UD35BuLAVUV15+qsfrlCRnkLf2Uuc22mjH0AR5Hf3jbkRpQ9Cebn5wvanf9pTu8cjt6qMYanAq3LfAMAhuCAiZ1At6bKxY6xjBTYifXq1auxZMkSVJBHh8rKSvLiV4YactFSUlJMjq7N819N6yQj4yAjyJI97IiwCFRWVxKIDJA5tfjLxgJramoF1NixYzHjmuuwYvmux/W5AABAAElEQVRP+HbhQguoxltNC9GM3klxmoGs7mQIkYmyShJ48CkHTLfeeitef/11DBpkrLPARUVFVOGX48MPP7RiEGulExLikNyxY5M3P83rmE3N5140LCwcEyZMIMfZU/DWf/6NEydOmB2WEXW2+bOwR0REYtjwCzH+0gm4eOwlwvevVBDGV0eGCerrG4STMi5TbaPXiWBSK4aGUOMkDHY5byQkfK6vthS6TsEQ7qVShjsApQ0HTHl5eaJX0waddlgqyI0pO6huDlyZzf4M5c4C28hcczJP7ggpu3UJJ79Qk8jx9hNP/BGl5HQ7nJy8OQsswAwzZMhQjLl4DGLIxy8Pn1kiWHjbkLvWS8ePRxT5iPrll1+Qnp6GgdSAshPv48ePYf369TTqKBdGCxQJkdeG0Yqoccga+9T2MQ4TB17IcsDErb/Rhs9MaWlJKU6dzmgiml1mRlKvxoY4LF1rNgG4ecPuOuvryNcumdNlp2mWwdzzmoX3j398Ugzh//Pm6zhw4IAdrGVVZJ4WFxfhow8/wMcffYArrpiCa66j9Xby8siWRHhK0LZtO9xw441ISEzEypUrcNttt6NHj544cvSw8D/laohuSWfg/vzlgHCtopd5GnfZyg7MiosKkV9A7kgp8PD10kvH4aWXX+EuDEuWLsbXX30FU6j9vN1SkFzmT41BcqdkXHDBhdi2fQvycvKacJp73nBMmjIZf/zjn4Twvv7a/4lhfUgoCaLMHNg27zpqGOrJKRvP23lOzIF5zfP7BQu+QVJSEqZOu5KG5peJ4eq8eXPJMfca8ntOIw1hasEWo8sSBQDOMw4Ec+9rtB64prYaOXk5yCdn4Byio6MwYMCFGDF8KPr264PUriku3aG6+o4soDFRMZh65VV48eWX8NDDv6e5daKYi4qeNzQMV9gK77LlwuO9nPDK5Wc222XtfJvhmN9nMzOFQuvUqZNISU3Ftq1bsGzpUlRX03FJIbxyGH0Ux+2IqqA6gSrsAeBmDtCoLsR4Akza26KCAlSUmV2ZxsTEoGfPHoJqnl/WUs/mLCipPsHkJbG0vAy//LwaW7duxdSp0/DoHx5HXGy8ENLJU6biCTFsLoXoeVl4TeYhsOguHWTiIFqW3LAw2ktmChX5xcfHIzaO9qPLIJCJksWnTaSHuXmYXJsynD9YqDMgZ9okxEYK1VVVyMnNRW11DZEVTD1wDFJTu2lOIg9rjx05ijdJC//4H/4ghDgiPAIHD+zHfQ/8pnHY/C+ssBReSyq4srqhKGaNc+fOXWhefD3iE+KxadMm9Ot/Aa6efg3+98ksMf9vno8rzMQJmPmVEwDLMgXu/YoDogc2mgCzkufMmQxxfJA1zokJrZGc3OxBQonMcHV1FcRQmPRWrAX+9xtvYNu2LZg+Ywb+/PQzQgv82r+cCK+EnDOyyczmUSw3cUPJyi0eQcTGxYl8LrpoCH74/nu88vKL2LVzp2hAJl4+CaYwmtvbIpHy0+KqJ24t6PMpDiW1y6cEWmVuCgsL01Sra4XdzYcyGtqeSEsTqcPDQ5HaLQWpKanimZVALAhaBRbiBlpzTSMh5p64qrKaFFud8NHHH2ElrUM3DZtdZchCIfPteR5cWFiEY8eOIY9GFTy/7tq1K9q374BVpH1esXwZTp48iR9++A5RUVFI6ZaKtm3a4kzmGcONjFyxIPDe+xww8XolC7GRAs99c3PNWw5jY2PQrVtXpKcdx7oNG7F3717s27dXzB21olkS4vT0dDz312dp62MkzuWeUy68EiEyQsyNzaZNG7Bx43qhgebRzqGDBymfZ0RvzO+Z/9u3bcPWLVuE0AbR/Nx2VCSDWsq18eoawiZB4LEFcMDEa6o8vDNK4KWXkuISFBUWCpKKi0sxd+48zJo1G2fPniWLlEFi3tiZeknWJDsLaqq0GE5Tb1lRWY4K2nTRPAd1loPjd5Z586iBf5bBdhTBz81xnNoyWGKzjPfFvQJaFID4gnK7PP2FTjvCmyNM3NI3V5zmF766YwVP/rk8nKMdYhx4DzTvTvJWYO00jKXT81bRnefTAiq78wL651vDCXAwrYHGt0qkeW93FOzaRVytFw1Mm9ZtMGToEPTq1Qt5tEa8a8dORb2k1+udVhlqhcdn9dLNAriZzGfF9HHGYg4cGRnpYzKasw+lDRSX0Omdhd8uxIJvv8eyZT9hyKALccstN6NP336iR174zTe08WErwshax/kUXNZtlwDnE7cUltXPeWbKJc3osmXLxA6gtm3bYtSoUT6fE/OwvmvXLnjs0Ycw86Hf0OkcWqtudGbGhwJ4mK0m+Oob+SpfRbxRSJxCMEVZBoC054CJhZd/0XTo/Oabb8bIkSO1z0UlRqnS8Hw0ItR88keKU4nKgOAqSqIC1HAF9WfaDcdMxwQF87ok/1iRxUNpI2ikWV/LNOWQsYHtO7bTklKu3BKr41LJvOH65LWgS2a6IPUaS1RldB4VVRVfZIDFYQbea8xWOfhnu9whk0bXKD65s2vHDjw082FcfMmluOvOu7F23Xpd8zx/kAckQ/Zb+zFbTPfddx8ee+wxMYTmDfW+DnU0vz165Ajm/O9/KKuqANP088+rMI1OBkXQCEGsptqsqfqaZl3z58plvYSsa3YB5P7FAVO3bt3Qp08fw1AdHhGBvhcMwNCRo7BmzWqUFJVg/rz5iKajfw88cD8SExPIHI3z00iGKYymhHgmxeZ2wDMcmhbHC8jOh9KKvdBe4KXiLHgIn5qaivvuu4e2TO7BOdrUkZObgzfeeB1z5nyGDh060m6sBtp+aDZqpxhxCwF02SG7BGghjNCtGP7FQNJZGWcbpfRNYmKicdVVV5L9qRK8+uqryMjIEEtHvJUyOyvbbNROwVZKCZ9Prg7rwfnQL/iE4+dlpsHTpk0Tm+qNVvqEhATce++9+Prrr6k3vk+c4OFN/zz9ZdtSgWBwDgTaKa98IBMPV/mMKv98rYG2LTGflOKNJcOGDQPbr+bTQnxOeOPGTVj+0xI6LWS80YNtGYz07HBQoAuRvpVg3+auC0NlkQoJMJrg2lLKw/xONGTmHxuEqygrx9IliwNnDmwZ5ZfP3m1W/JJFTojW7mS8k0y0fuVu68pVJRA85YC73Pc030B6OQ74xRi0trYGmZmncejwMTpaeBI7t221O/AuVzgjxGnTvxhEaLQpjFc+ix+R6hE/DC3AbBtr0+bNZN5mNtbTbqzMzAyyFVVPNrIS0aljuybXKh5xQM/EdrXIIIIoldmOPumF9VUhmHWiwJNXOGBaSM62pk+fbrgejV2+zP54Fl4nY3O8DiwFPqnEZ+7N25O4aqkLgcqojl9uQxuA0QYgwW32KU0Y/OSTT2LevHlK4b0CV0jmdL764iu89MorjcLb3HOxtpwPOgSCexxQ3+S5l4+jVL7O3xFd/hpvYouI7AFw6NChwtqFrwvSQL6Kjh48hE9mz0IZbeRgW1XsQqVHjx7khmQqevXshf3795Ot5qV+s4zkXz1Bc2Pp67qgRf7+xXv1JQ7mfcVs8nQpufUwQmCvhMeOHcbRo2Y7WGER4Rh/+WX4ivwGvfav13ALnVkeTJ786jzohf2rF2hZAuWLOuZf31sdh8Rskoesu8j+lHCBqS695tDlpLg6cTIDpXTlqtuR/ADfdedduHDAQJFXPQ2h+cSS/wX/FkR/FwJ19KuD9mVdFALMJmpYiMvKynxJi8ib3Z1U11STY4I64Zwgio4QdumU7HO6jE+AlxoIDeq2BiiM/zm8RGHTMhIrh4wQ2KhdUlIbcj8SQ4rmYMSRG5IQshbi38FLwuXfTNKdeq7hLe1LCAHmpZnY2FhhUkd3LrrIgAX2tttuw7jxlyIkKES4G2mb1NZFKoO+FrXFkyrjSVpbnmiJyxa3J89GpcuTMnkvrRBg9snDhxrYsJ2vA9vmSkxsJX560uKt1lha9uJqymWT23cuP/rhFHzAhLlA/pv4wgdO+ML3jUEOn/QucG35HBACzOZkx48fL1u5jMYCrrBG8iThjD91tXUIIwsjrVu1EtOA/Px88npYYbdphkdAkosbS2HmWQ3bCKutqyVfUCaC4eOUtLBGUsxwNeR+lbeZGi+IVsd4ZBFF3mq4vVV4Exu0Y1OyfGTPiIGXuU6cOEHe+34QSjZWth06dFBUaCPSa0nToMEX4a677ybeDheNzgHyOzzn00/pOOQGIYAMywrEvn374r77f4Phw4eL5FzJ6im+sroai374Ht9/9y0uu3wSbrzxRvD34m64rq6e3v2AOZ/9T3g/ZI8WeoeWVvn15pc38Ju6d++Ou6mS8RzYiIF7HD4L/N677+H4ieOiB0qIj0Pn5GSXzs18VR7eKdaJ6GM72/3Jcfd35GWCl+gmXTEZN996K7mGyaPNKPuECV8uX0FBAdau+QVpaSdQT4JJPs0xaOBgIdjc05LdI/LQ2E0cpVy0eBGKi4pEL84+o7hHr66uEs8hIaHUUHCvXUd4ahHCjuuodw8Eaw60pIbI9NRTT2HMmDHWJTTAEzOZAw+X2TJlGxrmCwHmSB5DGjiw0HXr1gNdU1KwcsVyvPfeu0KAWdCmTL0SvXv3EqMILgIPn3NycvAtCTkLPo84Bg0ejH59+2PN2jX4/nvyGxwdhVjqebeQ+9HPPv2f8NwoBJuG1SmpKZg06QqU0hLgTrKhXUSeHQcOHIT+/frh8JHDwhWraBQUsUwRkIE5f/6RZuJegnsBowYW5Pj4BIwdNxbxcbFi6Mm2skqKyP2oIenmOWoQ2dhOpGswTp86Jfw5scCdPp0hXJe2btNG+ASupiEyw3IjxdZHWHj53Q033ChcqH75xec4dfIULqGyJ5LN7i4pKUIwq2idfN26dVhNDsLr6xswkqyWDKVh+rvvvE0meY/it7/7LRKIZ6fePSU2vQRxt2wRWlIPZFEsVbcthQcmIwsvfxFuWrp0TsY/6GADC2xxcRG+nvc1Xn/9X4ZzTN5cg4KFA3LuUXmIW0uCySJUSfc1NLdl2162c1YWcBbkESNGYtCgwWRSd43oPXkfeFJSktiRxpZJ8s+do6OUnfD4Y4/TNKIzZn38IeZ+8aUQ/LvuuhuVVVWiMfjfJ7Opx97c2MgZt4Fu5pmR7vyHX0ILbSTWSbTYslAyZGf2Xm/do0hpfH9tpFq68JWUS1JZuLGk/7KBhb1t23YYPmIEDYdLsYkUXWw+yESa50MHDuBNMqubnp6Gw4cPi/n/ww8/QoI+iDw29sWmDZuwYP58/G7mQ8L435zPPsWq1avEkFxbjb0D4mVLFIj0BgcMJ8A8jGRlzo9LfsSZjJPUo1Rj/KUT6czy1aKHEkyRJsje4JDiPJort3k7aI1YOoqOihbKKtY281w2LCxclIm1yNzrcmDB5ns+ccU/HgbzKTFurIKoAThzJhOnTp8WHiRZILNpznyYvFekpHYT6+VifzgNpbkR4F6aPViE0dX3G2NdMa+ZZ64gA+/lOWAlwFyJnA6pyaB645YCeWyKYvksr2MJrKysxPr1G/DHJ/4k1jiTOyWjd/e+zcKrKA9vA9lUROIjr/ny0DklJUXsJuN95l27pojdbufycsVpKt44w8JXRWUOI41xKmmao0jg2bUMa6ZZeCNpbnzn3fdgwIABmD1rltBWs0KP1+75exUXFaN3n16YPmOGGJYfp5Nl48dPwCmae/PyEwu102/qbVYF8tOUA6b7779frEXyOvADDzzgdF4pqqlNXVVKDQ8dWWyF6FLFcxjoXQP1JiFUefnMES+/pKefFgoe1tgaK8gzgwXmGC3xpKelY8Jll1OZG0h5VUFruRNxkkzjHqQh8ZCLhuCe++7F4UOH8en/PhFz5Xbt2gulU1Z2ligvK5/4dNYpSjNlylTwsPmCCy5AcufOGDt2HJkZWofCogJcd90NYpnp448+FGvmM2koPWP6DGGCdwuZJGLe2wb+AjLRtmCBZ4NzwDSLWnXef8y9gTMBkUROcrSttlxcqTktHwWsozVKR8FEPVEr0rhGx8SiKv8cbVIowOKlizBi9AiqqNeI3kTbeZ0jSpzFO6n69Irn61nkReLLLz/nKTAmTrxC8Hbfnt34/PM54vz1mIsvJn6YRE/M0wYeWteQdpmXys6ezaLelVy+0j/uQX/+5ReEhofhhutvxN3UG5eVl9Hy1AqypDIXyZ06i557+fKfsG7tWtFzL1r0A64nTfZFtJHk8KFDtOxURL25K72BkzI5Y4Wb7wINiJuMs0kmhtC8hNGGli+cCXAdWcpgDWpUNO0EciOwEXZOW1NZIZZS4lvLI2FaeNPCwEEX4efVK6jLbiDFzSH8/pFHsHLlchKGicgg43bs/Ns3QVlFZ6h9+/bhmWefoZNVdKKKGjBWSvHWSObzpo0bsXnTJlEEFlLuD99/7z268lyWRiAh9GkICZeTBXbhggVYsnixGILzdyinIXlDQxAyz5zB1q1bRaNongKBbGYvwbLlyyhtkMDlWngFGYE/fsgBsZWyFe3Vbd++vRPyaZ5GljJKyd1nYrt2TuAcvzKZQhHbKhHBpFUtpu2Q7Tt3dQjMu8Nm0lomz+dOnUoTQnw2KxMffPABeMTAxw2TqJeup17Ku0GZ8AqaeMTBQ35qgIqovBz4WKTUSLKwWc9P6QQ0KbaCSM9gO7hlQaSEdE66BlW0dsxjYhZsXoriNLSxUgizNNfltq2BevVagmvWgTMFngd76jzHGcDgPgdM69evF60698COQm1NLYoKzqGetuh17dHdEZjzeKpMETQsjqJtkGdPZaAXW9gQAkiVkyuoRYiKisS0K6ciLj4Wb7z+OjZQb1VaWiogeLjJ66neD9Y0Ks5fCJu8GEkCZ8ZFMCILx/kwfHMaSzgprQVVDGvxGLh1wQE/bZlMAweaTdU4K14lKZLyMs/SbqA2SExyrwdm/FG0HTC2VRvsoaHjuKlTzB0N9US2PQ7DRtJSyKRJk8Q2Tzb3w9sIeWmFtbtnM8+Ql8IsoaVlWH2DCjFQAeoZzV7LyDMyXaSW//IuEgVeW3HAahnJ6o3Fw7mcbOzduhl9SCnCG+vdDa1p6WPIqJH44X+f4vTxo+jcozeh4s/oOLBy7WJS+PCPQ3FxMb6Z/zX++c9/ONWYO8ao5o2xBSUgAGq+ZcuEdakJKiOB2U1D2GI6QTOOzLp6EkykaU3t3Q9JHdtjEQlxPQ2HbYfPrvDz3JGXmfQNLLjeFF41eamB1ZdLLQ673tVKB4Y5FeBq2mCwcz1tmv92Aa646WYktu3gEQlc9drRGuak627E8b17seCD90mRQ0JsiMDUST9DEOT/RCgQCAUg/s8HHUvgUICLaa757Sef4Ms3/4PLpl+DcVfPIDKY3Z6xnJeT+gwZiut/NxOrv1+It597FrlZZ3QsojPUksDy1cPgNgq3E3pIsNovaUGnZ1XAY7oDCJo5YOINAzws5aNtpbTckZ1xBr9u2IC1P9KaI63J3v3EHzBi8hWNKfjLWXzIZjyq7tjMzAhaz23dMQlz3vw3/nDTjRgxbgLGUFyH1BTExiciIiKSVk4ctC9C8aUqSwtgz+m3QObhrVpa7OG1+SL2eD0smP8mFwzVhqveYELQnaOGNNSKTRq0z5nWGuNps0WH5E4Yd9UMjKCD4tF0mN665+WPrd0HZw33Ptrut5oUU6eOHERRZblY6wwzkRMzskoJXhdlfopAGxPoObeyFpmVNWqnzxKSpqt2pSCUCpDZg9jHOCdOHt4u1irC6qEJvXTjaulKgrMtoDld81vrO4s8LW6tYfip+WXznQWUbKT03ulLCcjlVRaLiGx+89JLL+Gyyy4TxzRdItQYQByMqSqnqab87kXTzGeeRzAJS2xcPGLbJiG+TRJi6DB4M3MbBUinnU8RZBFz6IQJGEpG9aoqS1GQnYvi3GyUFfGupWrarMEcMUswr2yW07z8l42b8DXtSuKTN/4UuBTN1aL5TlkZ1MIzVnfSKKMmAGUMDphGTLvKBSVUCbxRD6hJD4+MRfsU/nVzSBMvI6WTcNeTQbdAOJ85YN0cnq+ccDDJ9CU7+MOYe1w5KsQWRNoL7K/BXDJtW0TH3HLNJU/SymPXtmzyeWgXq335taNNCSYDjkH9qwIoYbLnMAGeeM7DlonBgD1wy2R0c6k8N4nQjMt3d17pubySie94qEXOAQHWgot+jUNJg+LBCEBXIdQGuTZYfFMJzmsB9v6HaxYE5Xk3p3FWRZTjc4Yl8M7fOHBeC7B3P5YyQdSOJnX5BRoA7TjvTUznvQC3pIrr7bJomZ+WuLwpQL7O67wXYO98APne0BCV1hBEeOcrtMRcAgJMX1XfOiwvvMoqkydpleXgFSh9GeyVIhg1k4AA+/jLaF23tcbnY/YEsnfBgYAANzJIn4rvox6UrFUGwvnBgYAA6/adlQuR1o2Hu/jcSedOGt1Yfh4iDgiwxUc3VGUM9KIWXyZw64gDAQG24Yw2Qqy897XJ3n8eNWGUNRLrJ++ywpd5e1LSgADLcM+zj2kM4VVVBgtgi1sZzshHuZNGHpNMrK7IZfLjKF/k6YAUV9EGPI3kimTvvOdvqIkoEiLJgwR7G3Rkbp2tBLETtKY82RNkA7WvTRHeKXcgF//iQECAnXwv9UJsLW3sRYIduiUkJAj3qEXFRaitriULKOT310Yy2eMC2wBr9vnEfo3qm4TfCZkOX6mn3yEq377wUkGss7F+8i0DHOceEGDHvBFvlH9Ga+Fl29X9+vXDLbfcilGjR5EAh2DP7t3ksfAL7Nixo7G3NadhQR8yZAhuve029OlNxu7JfBHbnDp48CB5M/wcu3f9Sh4PvTfbUV7mZua5TOMSoBmXIe78hN6AACuoLWq/ZT05HGtPxutvu+12Et7RWEtuPysryjF23KW44867UFRUhEPkcdHEHggJOQsnO/9OTk7GIfIXfOzYUdFj5+bmoUA4Cq9FQ22DsAHGztG4Z65lqyQk5KEhoR64mLFudBSwQncQh7x2+EJPknySqaoC+Z0AC+dezk0iqmKAUmDnn9JaENjsT/fuPYTf3hUrluPt//4XZeQOtKCgEFeQid7effrg6JGjTb1wKHluTCKDgllZ2fj444+wbds2Em6yykneDOPJ2OCIESPQtl1bcle6XzgIZ0d0Fwy4UHi22Ld/LzmeY/+/1jQoLZfv4Zxz1tv0WVFj9eBtSpTlZ3pk2mQxHwsNJ/ef5D0wkSpSa3L92aVnT/QdOAhJnToSJvPwjcvDwbOqImExY+LKXlpShKN79uLY3j3IJbvUBeShvog8z1eSS9M6GooKl5uULJh+NWTHOrOkDKHkCNzbgSm3L7t9DAO1IUdw7Ig8PT2d/CFXiF4z/STdk2fFJLL8yfyuqa4RNrnZkRvPk7t27YoHH5yJB+6vwVFyrbpq5Urh0K0XDavvvfc+rFu3FrNnzcbESRPF0HzxD4uwe8+v2rBBvnDOcbuTxjlG52+9nZ9zagzx1tQ9NYXUpCQYNVUoIU/uB7Zswqm5c1FeVIwEaul7Dx+KS66ejrFTpyG+VZIgmvnIQabqml84/MspzV+hpqoah/fsweIv52DPqlXIpModSkPKTqmpZJc6Ga3bJCCc/AAHkcKH6ePAtiMqa+tRfSYTx/ILSOmjngIzJvf/uqxDBMC9YRg1MDzUraChc21dLdEeJBybV5PQhkeEC+VWDWoETHxCPDlYT0JncjvDadgJ+Ghy5nYRzYv/+9a/wYLaoUNHXE62iTt37oLW5M95y+ZNmL/ga/K1XIwQMgtsF1wSapfCKsKd5O6kscrUqA+8RGDQYHrs7fetSKujuVVRbg6yTp/Goe3bsY48NLzx+B8w/6OPcNvvH8Nl5GLFRJXTvSKxYzLgdNpRzH3rP1g5fyESyF/w5Ouux8BLxyG5R0+0IgfiYZFRVjRZPrCX+4ULvsGGV18lAXbfU6IlTk3ubWpvM38sGhka+luPdGl0QRHlZeVYu2YNfv55FTZt2ES2rytwC/miuuGmmzB69MU4eOhjfLdwoZgjX3755eRqdTPmz/8GZ2i04so2tg1ZmhTVp0jsCmQX4VPyvJ253RyYfRe1otaef/2Gj8C0e+/Fvq3bsPD9d/D2o4/jwKbNuOcvTyOhdWuilZknMdCiojooRQ0toeymnuPdvz6D4pwc/PaZv2DCDTehVVvlPoeFAoccjvsySCWWpYHZQP7aautqqIEJEX6OWVnFvTAPlUNDw4QbG1Z0ccPOAlxIc+MlS34Uiil+rqNRxu49u3HJuHE0EmmD6KhoFJcUk2vVItFD19bWoY7wGTM45Y4ikj3HoCibFgFkJ8C2pQonH0VDxo5Fb1KarPzyS3z57zepwuXh0X+8hlZJPKRmdrsOtTQsZDelbz35JBJpePyXufPQc9Bg1wkNCuGskvG8vqCgQAhbcnJnRERGCCUWD5EjSIjz888JgQ4jX8u8hDR06FDcfOuttLy0HV9+/gWqassQR94xYsgheiXNmbkhmDx5CgaTf+a0tDQxV54+4xrkZOcgh0ZL/F6P4KyMjvJzmsbpS0cYA/HOOOBSgKXEMYkJmHLvPUho3xbvvfACPnrlJfz+7/+gXsXxcFdKyxX6xKED+PT//oHWSa3w1DvvoH1qD3rNX5SD697bDGesv3bUSxWUinP82HGcOnkSPOStrqpCGfmAmjZ1KrJp5HHowCEMHDQId9x+Bw2PD2Hbli3U+9bgphtvEorEcyTgUwmWe2teOx44cCCunj4dB/bvx5zPP8OkiVdgypQpNITOwNfz5qGyqpIUfTI8bCSQz0XIvLVnpkS//RuvxzglxelLr5Pq0wwVCzBTGU69x7CJk3AuLxfz3noLq4ctwLTb7nRZgILcXKxcMB95mWfw9DvvNQpvo2ZKWdWyz6Oxctq/8H6MbX3i3VdnzpzBvHlfIZJ8P918882kaDJhPwng3Llf4PCRwxg7dhwtHbVFZmYm0k+lY+6Xc3HvfffitttvFz3q8ePH8NGHH+Do8eO4/bZbUUxrxz8s+gF7ft0jeu1k6s2HDhuGX3f/il937pJXZGnACtuyKUHpTholeAMw9hxQJcCcPDouDqOumIyD1Gv89MlsjCTHZK07JNtjboyppyFiGlXY7StWY9L1N2DA6DGNb7hPcE8KJdFvmn47zN17L5oqbeNNEHV7O3ftFELbKrEVeX6kuW5+ISmoysV2yQ0b1mPr1i20lktadXLitn37NuylZTTWSNOGShSRso49N4aQwvBNcsHKjtBZO83D7iNHjuCZv/wFpjCaW5NeQVYLbVP0Jvps4j1+VItYBbxyUOWQHpfXYAjc2p+X1LETxpMwltPmhO2rf3ZapFJSvBzctgVB9TXkJHw6jeUUDeac4uSX/Mn452YbwCk1CoIKgav5jh6pmNwTs9CdzTqLTFr64qEux/Fwt44UUbwmXEXLdxx4HsuwueSdMSsnmzw1VtIOrRA0UAMo4Mh/s9Rg8ZJUdW210F5zmkA4fznglgCHUi/QuUcPtCUFzRrSnlaWlznkYCENtw/v3IG+Qy5CV9obrHUwhhA3l8qWHvMhhRAhoFbzVBJwfrY81MDPvK1SEnKBlWEkOIu2T6SkeHdnIGaKrZqc5kLY3PEpKbVBfQr5HLTCI4/d/2PdEmAudiLN3wZeMhZ5ZzORk3lWhhMNYqtfHvU8GcdPoGv/C2moZ7l7imuj9JNJ7izKZmGdP7JNlLPUur/TrdK5i7gxnaLkioA8ZKEWeWiBw8NiGCF5MC9juBMiaYmja+++fNgVp2mOKxdqaNh3jhRYHFJ695EBsehSZN46inL07QwlxI6IdFQoBfE6oFSQqxnEl3krJvI8BAx+6qmncPasXA/qnBshtDkhNpEULrTUcZL27dqHIPDabylpT6NoHbRjZ8eKLvu0zmOshqI2oL4RYvnqLR9rQ7CXH71DkzkXrfLSCo+XWe2V7II/oi2Szz33HG0uyFeVIQtROK0Bm2hYnEPrkXJMrqdtmdVlxQiNikEEnarRKvBuLGfBN0IsT5EcX+QhlcX6smyalkVTZMp41xKhgnlv8Y8//ohZs2aJnUNqChlKa5sRdKqmhHrZWpmhOC8h1VZWiaUPVnxpEfgs7UFaT3WlzfZ+RZepkY1RMm9csEJ9ChcI1b1Wm71aeHXUOIb2Vb6OKfL6m2DeJZWdnY2FtFn+wIEDqgjg9UfeqFBLc916WhaxDeaTNbROyaZiNNjux/P103TIYj1tyQyho3qugpG+r5a0eNo4eUKL2rRq4R19U63wOMJvGe/NvCzzdedeSAEL2okTJ4QQs0ArDUFk+sUUamrsueXTCTWVe7oqOzL4UPy+vXvF7iVF+3+JJBXFsctPkwgLtljceoxaNS7VCTwmMYDACxxo6sZ4KM1b/YqLi0W2igSZBFPUCz4j6CpoUIFyaB/xqtWrUV5aKtZGXWUpvfeeELsupGsIiWrXV09wNadtvnOeYzNc853zFIG3+nOgSYCraMM978tVq8xSQqIWHTAPn5k+NggXTHNvtcF7QixDmR41vhGnPGr5WBnKHEepReEE3uErhy/kyVIJLo+khcU2CTAPo7n3zcvLU1FESTT1Zy2PEHbu3Kl8+CxTCv2plMlUirLI3OJWeuvRVTE+G0CbR49oCCT2DQeaBJizZ0uHPM/k4GytVQA0/SEhluS4KU77m1zaEMLWHXnvr9vZUY3lnpgrrn6V1wlmi1cWt9ozy4AYnZfX+VtfFMd4FMlzwUqAWTHEViPUBFfC1EDzY9qsRcF9lnDDkkFrzb/+ajbg5j6mxpIxAvo1XhojvXSxIN7i1r3MLRBY3KrCZU7nbmpnWemB05Na5IxW/33XJMBsQTExMZGMp3VQVRpSROseeGi/detWnDp1SuTFtCofITghj+sY/Rov4uoE2vCvFImMIqDGojqBlX0lG2l4tjkkkBW5vFypxRKow0w8fNEkftHR0ejVqxfa0iEFo4Vz585h8+bN4iA7Cy6blOW1ZUWaciWF4YrXWPm0qYMusFi8trhVQqmPYTyjVja1bKSPi9mYfT0JMJs1iqWfomVLH5DdJMDc81599dWIiIjQTjA0KBDPedkOFGufObDQ8h5rnstq0gtb0siV6f/buxNgS6ryAMA98JiVAQyrLDKMIaiAgBKUADoYBYMSlgItEyDIIiogbsENAXdREYhWKShGoEqRRXEBFCMMUSRWrDIEkVAgFaMWSsUKwjA7M/m/c+e8Oe++u/R9781ypU9V3+7bfdb//PvZ4lovOFUUUjwWten8tojQemyL1vZ3XPROLyaSplM+6+vd+qqvkY8dd9opbSy4URMw1flVr3pV9YpXvGJ99UHtckydJH3NwBIA9YkYB15ugfu6CoEhk0eSwXIYLHZbwzsm7viylbDjp44vBwdEl2zaatzh7wQTTjBZhwqMeZXU5/AJHXDAAdW2sXnjlAuLMaVN/M8mnFZ/HRuGv/3tb0/SV1ZTWVmztVp7Ifdzd3VuhN0ds/TNMTi1LFXcYsstE0Hn91N6D8SAG+sIP1pVXUeZr6Nsx4F3IuVMJM24gju+mNqc4diee+6ZaIOA21jDJqecckp18cUXp03DN7ZKkrL/Fbs2cmCVYXbMv7Zn8plvelOcaLB12lNqyuzhsiA4EdeaW/ml5nMNpCqijC+n+NivxLaobX/7pV5HjKpmLWpGKxsxgSRl8q7P8IjZNn/+/OoNb3hDnHH17HRETtcEG/jDyGc/+9kNXIXuxT/22GOx2dtP49Cv342J9GdxtMhhhx1WHXnkkck++cIXrohpoL+Ic5RWVSMWOfAcRop272Hq9Igj3kAhKQ+t7W4cLbGqNS42Zjya1kLbiH1IIkpGr3paxybShroWtxTGpxr/Zlz9iyj8A63hu/QwLmrnQloZ+G21Jc4nbmW0Nv1oGWvjrv1YPLXFK76MPo5GGX0TDxkA5bsez6N5jH/okarzJxOZXDYNPOigg6pTTz21ev7zn5/+d06xcbwd+eY3v1kdcsghFaLY2AL1uV368kDjioDMc37Y4YdX++63b7Vw4Z3VXT/6UfWbX/9P7Oi4qHoy7GTpS3PAM+k9kbY6O2pRnEM0I9Y2zw6vZHtYHsehLFn0ZNp6d1bUa2wYxbCxr+MfZvJEDJMtivqWe0+NTzH+zZjMis/aOXfuFtUzYodLTMWyztV1iSOIdsmiJ9Kme7Pmbp7We4+WM1pG62H072iENQ+jH0Yf2mOk/+O+phfj3nZM6+WYmAOmLTM1LLlVmGPzdtst0cKLX/ziasv4PwxhxJ7FDPWzzz67OuaYY6bcXT7RiRxLY1dGyxsdtVkGbv19Y1P0ncI7KAD+Djs8M+29rC1sF7s43nrrrdWb3/zmMXO7nSP0V3Fe72Wxp7Uhs7qBWnV/nJpw+fnnVS895tjq2NPPGJf07ltvqW6+6p+rA2PD9SP+4ZSxyDUu9toXnHSf+tSnqs/EEaTqXYZBzAJE65KGxxSTO/744+OM4r9PQ4Ocf773C0ueXFTd8JlLq0diU/rjzjqnmr/nXv2S/El8h0cbq6e5F4BHEIopivYafii2xuHMokZs6GDyxs9+9rPKGHAZDHdRnwG8U0Ckc+fOTUROSn/rW98ajca2cdwnqc5BMUiQL2ecHSM7HW3qu0F/351MWDfQCFzaUxKsMraIPbi1RX9gXP4b5kue+JgbTsNwMTX4C6RHpJjYAw88UH34wx9OM9je9ra3peNY6tRpZeyw4iwnbVGHTm2tk08TZ/1AYHRZDzvzc5/7XDiFtqlOO+209VN6j1Ly3OcyCuTda6+9qgMPPHD0NaSFsBCYBDOX27OlhzvssMOoVMoJrLYyLPV3cRbRjBkz8uue95KwekacwEeEj4DbmebzYgvef4xzpByh4htCIiEy40LE2ovBWeRx4403Vv8S5wmDWw6k+9VXX51MhnPOOae2Wqi967LNuX7NffIQGMlql6wQsZ05Xv3qVyfkn3z2E8uBVkCC/GecH1wGdbWkkMqJECEvCWSlEhsSQpPc0iNiV9k+eYlHAptX7eT7DR0QpaG8dmaCYNlh3ex1hCwOqbxb2G6vfOUrqxtuuCHB5uc///los8AHYdNGDBc24U8LAqMSWLMgvFlPCIf02lCB5GD7Qr6SABHoj8JR5ZpoIFlI57vvvnujIGDtI2FJ4jKQsK66gUPvNa95TWJsn/jEJ8Z47vXpL+OMpQULFgylnVcXBk/HeGlPrLLhiMTBXFMWTOSIzMI6q52lPbp++MMfpvj9VDkE0OvqVCjpLf92+7pT3PyOM05dpuURovwh36N5aXgp4rRGjvOH3nd1J0ldZWAWuAYJJLmhj913331MMmYFZlg7v9xVqS1jsmr+bGQQiCHI3FutmkFS42F1Q4vAxuaR0yY1L6TLaodZ18zTziCcaffff3/Opudd+b2uTomp2PJnO9YLykDAMRbchRFNC+fV6tVxAFloMWvHgfvnDv6dJHAel+yfw9gYmZmNfdv61+qrTl/Kd9HWGMfWd9PiasLGDYGxelvUlS229dZb16r1UyEhlsQJerPmxgbvrfmSY9LZ+mYkHE9U8xVxAl+dYEcQXvFyax9IyR788ziPiapI0rD9OH/8z57c/MzZJY5LuOuuu9IwjXrkoByqOLswO4byt/Y7xHcYmZ03N41N/DqF1ra509KB3CufWllttkl9Tz6Yt9vAEyFgkta0U/6DMoAHL3a7ml7Gyc8ro436im3erhXkOM1944HASMmVEQrifc5zOh2DMr7SLQJeVm213cwggvGIbSbU9CCipYFYT/7xsWrr7bYfn0nbG15UBFcGQynsu09/+tOJWNWzbtC+nXfeufrOd74zBrGplMqxSGLXXXftmR1iWhyOsqVLFlXTZ8/sGHfW7DnplIonYhKEA70dzl03IJQ6xNUrP3Djcf785z+ftgku4+rT7bffvlYZiHfp0uWx2+hm1fQg/CZs3BAYQ3Wk2l/GodHmgdYJy5evSEv7tn3mjsGxTSMcOzsGEmweknNxqKyP/vaR6lm779EzW6otZwsVugyGtl72spclaVu+r/OM2CHvS2PudCmZ2IO/iskKJFY/An5qxco4YPuJakUQ8lbbdJ6xNnerrWKW1qzq8f97LDGsOZvPrVO9FKeTDcybrr4PPvhg8kTTMsQjGTEUpgZnH688RmQYybTTxaERlUH72cV77713+brr8+Io98lgbnO2nFttNnOw3Vm6Ztp8WGcQGCVgdhjifeMb3zhuTLJj6SHZVgTBhWekmr9mVlO7XJwRHHyHmDG1aTiyfv3Qg9X+4QXtFUgRQx4mJuRAMplVVI795m917yZ/HHXUUdU3vvGNMeOkvNHK8w1hdAtPxQSQpY/9X7VFEOUu88c6iHKabZ65Q7VjSPo//P7RavEfH6+23r6+F78TAXMkmohhhhbGSgvJRIz5GA4DJ6YG1TlrUgi2fNanZmPtsUdv5pnb8cf//UPSNnZ+9vxq8yi3CRs3BEYJmJQzRRHHLyVVt+pDogeC4z/0u99X9zz8cPXYTTeZQT8u+u9Dyj26bHl1y3e/W8XKg3HfyxdmSf3gBz8oXyXbkH1IurQvKxwTsc8f2/EYUy0nOiAC3mjnQxk2y4jfntWTIenuvuOO6pFFi6t/jeGnmfeuHWfNcZkTD/zu0epX9/+imn7dtdX8vULijQdHjj7mbtiutPnzRzPH2OqD7BRatgHhP/e5z01j45hXnfCLn/579R8P/bJauuUzqllhdvTzD9TJs4mzFgIYLGbMTK1r1qxNPf4p8pu2Gmfn8NH5CLNEgvFJWm/EWUZdiwqZvN8tjQrLc2kMTylj05Co3eJCWGp0+Z1k5JyST/m+W706vZc21wPRtgdSXhnd8jceuzzayp5nFnSKJ3+qrfp75jiqG+RPJQanqQjKx/T0KwIE10517lTWMlpVBOl5oeum65RX8248BPQNbZeZanacjTQw2m7B6MfyZYsDtzrjxgjJC4FlrLNkXifY1uap5eGsifgQpVuQ54qQwKvCAzw9ypnZg1DExZ14i12QmnqJ8KdCEsgTgWVC0W6IKn/ldArqBKlXBSNBlMwC79oD+CHEaXFZhjcr4rUvZ2xP47906oNRZSLGCDqV0Sl9ficfeWiPemqPd0K3tuW0+W7V0qroV8sbnXmV6t+hrTl+c58YBPQtP8/HP/7xpBUuCNNSv00khEBpSZRBEEbcFUG8wRaSpxKidEvv28j0lpcVIfBsIsbxJNBCZkiYNYKMyFNBvICDYOWNYAAMs5J3r/obv165fGmSvJhVt3Z6D+FHZkwPJ9bi5ImeEWW1+wXaO0k6bTbMQwvABLTb5dklTnu5ud7SJhhH27zzvz1ue5nd/i+PPtXekcwwo9wmTD0E9Bfc44BcuHBhcjIOuhtsrtWYYaT8st+d9F0WKvH0GTODKDqrlGUe02KMeHoc8r34CfOVF1ez54xfT1vGzwg4VYSb85YfIhFKos3l5Xjl3ZDQyuUr0xpg6XvFRayIfGVoHNYHU7dddULOFwFiNIOGnD7fB03PhueUnBajCdpQwmfQvJr49SCASXNWmv040TDwVJs09htez01i5tHMOOBbR/cLYYEGUoTEC+m7dPGSpJLWSdcv38l874foZI9ZVUuirZuFtN4spFLfNEkKjyRbmYqxZPGTHc9N7ldv5Qx69cuz13dSd2nY+FT/GTF0RJPo19Ze+TXf6kOAhjWZUJuAEdzKlSvSThdsJbtSmJVUt6OlnxnjpFSHJ60YCq6DSDY0IXcD3rJgNItimMYZyLM3bznRusUd8z6IgARj6xs/XhITQMCtDGBGjWePs3sHcTKV+UzFMymwOBbxM4kQ7/QJ2mJTUZcmj8Eh0FdXQ2A6mcpMGglzwtE0Ekhal3hztUhthC9PQzMOBp8ZdiLPtHeD5pfznao7QmIeJFU4pNCscPAtMwXUXlcBA9wy28/9GA9tI5qUGN6iaKuZWq13rcULhndcVGbDdjZUyB7sqWqPfPSdOru71JuKzhygTZG87kYSZoSWkSodDKZOmGh/9YNdt7LXV3nKwVhL6chXVDoG1dF3jlFwFbSLgMp+ifRyHf+gnNEi1j4Z0o35vxCW5zaI12SGzcJBMzsmM3QbShnNqMcD9SxJ70AiDGF5SKHNwj6eOXNGEHLL9io7uB4q9Siww6eynT5rJ6Dvu+8+1XbbblctjLHo41/72urscPN/+9vfri6//PI0acI4ua14vhtj2iZPlPXsUEzAa2Y1N3a3cJ7xoicerzYNYuE8OzImjpz7rnelzQmk++8Y/7YzqLXYo0ha9EunvLu907bcd4iUc8TqJPU2n9w4+P2xVdG9Mfb82xhjRsxzttwiEG+NF7Qm8YIZxAU35dQN6oahCHVtfWkwV2W5Bgm5LOn69Zd8lWUkxIYP5t4jWu3My1jZq/LR/t122y0NA+Wlt77dcsstaSso9a1T3iBt6RR3ZCVvclBJ4iEx5qRirYn7reVs06JBVGVTBUndqRgblAfJiyEsX7I0GER4bUNl3SQcKJsGwlsEsUmorrZ1sSlbO8F1asgg77R1tXauCgYVaq72H/CiA6pLL7k0IcrDMTHlN+Eh5Oo3Zxo3PuKII6r3v//9afMAUxdtIlAHmWgX1Gme+KXRVum2C8lufnYOiGynHXdsLfqI/mitAgpJGfAYFAmiuxLC7Tpv1+qEE09Kc8h3jtlwEDN+RvuPxL/6y1+uboothwaZKKLOEBrS2hX04IMPTsNwuS397urB+4oxIgr41iuIb5jvxBNPrF7ykpckb/0gMDEl9Wtf+1oqSz/2S4vwzPyzKw0NSSBl1cEmEKaqygNjMLvNHH0MMjMx9bX+Wll18KNX2+t8G3k8puKVwbpdK4twHrYf5xOpqYIZCcr4k3lGrLOD25lDzF5csXJ5tTIm0i8Lgk4GsswDIJmCp4KQI7cUWvdwr0Vbnxf7Y7373e+u9oztetIuINFBC8O9b5aWMdXjjjuues973pOI+ZOf/GRaLF+3c3T2ggWHVkcffVSau3x7SPddYvEE+OYAtlsEHPYPDeCQGBPcJYj76zd+vbrte98LhrI8jcvmuL3uQLUqykNU519wfnXQwYdUd//4x9XFscDf8sml4Rnfepttqxe84AXV34YWcOEHP1i9KLYnuuSSS5LUqNMmOKC+hx56aNo32UIJSJ1wo1fl1nxThmmxW4VAQMj2/e5VLkKxEeEZZ5yRZi6RcnXLAnvlOO+Lt1dZdYJ0LoHGQjsykw3zzYRKk7rtttsSsb73ve+NPl6QcKVMW6esycYZ2SI6IAfeYoP4UcvUAJVJiB6dVhdoOa+69xZCBIOYGd7bKiZJzFmzHrkoc0rLjnxx/ZUhfZ17av4yVfmw2JImh9TuiEeVev3rX1+dddZZFalMApO+dWdZQT4LCU4//bS0EZ/8cXbtKQfuEfNpsYn4qaefXs0ILSeAX83bbX7Y3yuqf/vJT0IS91cboZvy9t5nn8SMdv+LPaqLYqLANddcHauTHk1+Bsi3atV91R3BnK6P7XfUhQR5U2yQb5siizt6EVOGjzjUcdLNvuLXXntt/tTzDu47hqbxzne+M92NfffrW9Iek2BbfuQjH6muv/76REjUb/0kuOfnXAH5iiONfdSM/7fHyXHb7zkeZm7305NPPjmZOTQGMAZHbYEfJ510UmJImAOVOqdtz3Nd/Y9h3ECYHKLRZegH3DLupJ+j7Fx65nIpzzWdNOn8ZbCmU9mDee9fU9qoxwL1Cce1ygfXttWuzvtJENEHQ1o5o5gdTP2EWL06C+wgqPXGtu3NASJ2Cu3v949FCH8T9Xo47GOLFsbApEMGRga2jzN8Xve611V7B9O48sorqyu/9KU0xjgn6lEGyGduOOKTr0PtXNLUdaRpnwtCu/rBQ/mJca6Jm9OX9er2nOMqB7OzsoyaaucWzJRUpua294c6uXL6bvmX7+UhL2XZ0dSCF1MeP/rRj1bnnXdeUsV9R7wY+rHHHpuk8/dCW3pX+DV8qwOLsszJPI/o+GEOAN7ecZ3aoxPFY9dQg0nGMkDchSGZPvShDyVub0fIo48+OqlJF154YbJpdBAue3pISkjTKyiPlLWAIk8eyfF18L333ptWQulwRL7ffvuNUavZXCTPzMiDBzwqn5N3vVONqaf2+2JjUm1LR1FGZNNnMRcqLMcZhmZzf+nsRVam6VrYmg8Z9v0YjOg5br73y7v9u/ojYA4mGoCNH0hXi1GS6VMkELdOnYok6VHb+T7e8Y53JFPpkUceSSu/3vrWt6atiO3iAq677LJLghvVmgmC8bv4E3yfSNntdanzfwRCDmvA0S1OoMohin6B6uekubwpfI4vD95D6haOjtvaxZHzw3xVEpnTBvK4s6t4oXupmzqQ5MTFrTdesMZGUqaVVfK9I1Y4QbTbb789qb3WPENuRG3rW8hBAvRDBnlQEREwwme726igrJ844IWBYU4m0FObrfBS1mvD646pcdSIuzGGDNMLLrggaUSWvup7fQZunSQfgnT1g2Fur3wwc4QqDRg6JECfeQ9XaEuI3MEB2ckpvX3MpXFNlEnletS9j2zMJ6/VaQRVRschsrpAK4kdkV133XUJmRHaBz7wgeRd/OIXv5h2t+BpdOzqV77ylcSRETEiqYPk6kP9puqde+65Sd2CELZ95VSCCDrbJgYkMinonTXKH/vYx5Jjyf9+7dIeEok3G8FDrqxugmFJvOpBpb/qqqvS0lHeUiYBxMTYaAuIQr02xgAW+++/f2orRkoTKvuzrLN2810IHFB1gzL0cxn0ofcZLuBLgymJtT1NmX5dPY90a/y6KnAq8wVQBAHJJxKoO+w+G9q/8IUvrC4MVZmEvuyyy5JaZqjnLW95S0Lqa665JpUFKeoQr/qALVV1n3As0XRyZ3uHCZCI4lC1vcvIgZGwtSFInfFmZWVJA1ERI9jkoL5OouA8QrxfjuEjDCrb1tIoRz1KqZ3TD3ov4VPWY9B8OsWXn91EMTlOJbYwhoURleXmtLbYFUjpDN/8re5dvvoq919uk3e+gVl+VzfPqYqXNnafqszWdz6Qn70BYesEwHbpCMSBUL/61a8mCcsh4b1dMEhkHU6NZmOxE3XWvHnzEqJA+H4dphwE4XwizrBnPetZo1U0zMO+5r3lODOealgGEQqI7fzzz0+nZJCUdWyqzAwwBnVXvpDbS73GkErihXjKl0ZdSZWcLiXu8yOuPnCBh8s7d9LIM3MAXMu4nicSch5s3zvvvHO0LH4G3mCnWbRLQWnY9syVOv2mXtKAhXprm/xtnE+a05So0vwTNDPeZxoVOIorjasffkyk/Z3SjOBewxgA2QVwgN0PYL5DctMWzazihWX3IjDOKTti8DSbZUWNRFDGhqmkHEKkItWNkydLrl5wUzdSlc1p6KQM/rNDTzjhhNTp7Gpxy0ATsGsDEweDghTdgm+Qk2Rix6prtmW1W11uvvnmamE46bST2ol4vae90A6o4NREzKIfLNVDHHlIp67SueTJS2z4jWlA0vPeZy1D3Gyz1iknlyUuc0l6d21WlvZgeMaJu20bROswRNbu6OoETzjCFDk5Rh9+HGPo9913XzovDJ7w2mdzAwE7ghTze9/73pcIGRO55557kg8CkddtX6d61H03Uld61c1wQ8SrCyjxDOgbmId4Op10tI2QIQIIZ1jAf0QlLo81h5DvmRCoa1ladmsvBOPgQPBmEJmWVwYd32vzQBoCBxMGglB6Be3Sj5CHI4wn2ng1r6i0vmM6kN3/zAwwPvWC4HwIJAnE69c2SC4vjI63FpNihkjPm258+eUvf3lqP8bCS4xpeGfMGaF9//vfT7Z2v75TVzAAcwfvnXnmmaMSn61ugg3J1ytkGPSKk79pG02FxOXoMyyHmdvVNE/mwPQQ8qWXXpqGkjB+x/Q63ROjcnQPZtavc+MVGwAABVFJREFU33KZk7kPtQo9kYYjQhKQB/Hk4LLUK44ryEBtxc2N++kQlw6FdA4Zo0pTxep2jLQ8wmxgZSIOzivMA9LnfNSJZoDgDOmQujzT9gerwyzAARJjFrynC8LjjZhNelAHRIIQMuHm+BDUli7sf8hJPSzjdIKvvJSFAN1JfCotVXJemBhgSgIL2uHIVwTIVAEL6ijmyLNLJc0w6FSWd5gJSWiEwKmU8sxEjylgkr22pJEH+A4SMkMwyQWxqjuPPQ0lMzdwAjN9Cm/giJGAnHaQ8iYTt2V0TSaHIUoLuLir4zZxS+qycV8dY2wRsjmTmGRiu5FmEJL9aKD+n+JcYUiTO7Ff0yEnR5mdJSGstKS7eb0cShnxmAF50YTxRUhKGygRpk5ZpDYmYy6viRn59IlO9UXYdqxEwNqMWSGGTnHby4a8JDobnnfefxNf7H7pYLzSDqXOay8iRvT2rdYP4tQpC7HqC/C5KTZObCdG3zGMTNTtdZ3I/8zEmDXqrUz2NUefPlQW+IEzdZs2op36O6edSLkTSfO0IWCdAMAAbvK5MV4eSgQGkThFICREFNf854suuijZlVdccUWym9mYdZCu7AgdKl1GBIiLQSDaHPyHEKQtNTTXtZ90yunzHWIZtlJvOx5iAN0Qynt+AF54zIKtN0jbpKcuCtpCLTZnmXbRHkhpRGYsFZPoVqf2dPm/dnUbaQCzfnDSrroErm7MCfXEONjcJwcTVz4tI4//6zPaGpV+XmgemBLipkVlrSfXf13epwVCD6ZfrMvarIe8dTbbjY1Sdj6i4VyBlDqOXcieM2EdcmeimmwVdTRkJ5V4oyEMW9epCnkiwGTLQFBZyvUiFogGEcUppeag5SvLmCzbG7FCdvASEA4GxiYHR3GnMqg/6UejYQq0E7PyFobzjo3OmdYLHrle6kzVpxLn+NqAeHO73LVTPDgjDXiKh5DrBPjH1qYFdvOHrF7de1fKpx0BA7wLwF1lyMil03QGQsC9IUV73DLdoM/KkWeeYI+ZKKsd+QbNd0PG16asSWQkz/UBO3CcDJPIeXW6KxsxcQzqu7J8ZXOkDSoV5enKQb6ZmPM75YhTltcpXo7ffp8KAn7aqNAZeDq0GzGWHYSY1hVBKUfHQyxBfdZVWbnd6/quTYhoQwRlY4A0p26h7Ntuccr34vdLszH029OOgMtO2pDPvRjJhqzXsJb9dIVn99kBw9qTTb0bCAwZBEoVfNCqNwQ8KMSa+A0EphAChqoG8f63F90QcDtEmv8NBNYDBEhdTj1DUXk+wESKHeE5bEIDgQYC6w8CiJdX3Oy+ww8/PA3BTbT0oV7QP9FGN+kaCGwICCBcnm0z7az9Ns/aGDYH3ETDtHC/P60mckwUUE26BgJTBYE6Q1S5rH4TOcJ+bkaSMrCaewOBYYNA48Qath5r6ttAoIBAQ8AFMJrHBgLDBoGGgIetx5r6NhAoINAQcAGM5rGBwLBBoCHgYeuxpr4NBAoINARcAKN5bCAwbBBoCHjYeqypbwOBAgINARfAaB4bCAwbBBoCHrYea+rbQKCAQEPABTCaxwYCwwaBhoCHrcea+jYQKCDQEHABjOaxgcCwQaAh4GHrsaa+DQQKCDQEXACjeWwgMGwQaAh42HqsqW8DgQICDQEXwGgeGwgMGwQaAh62Hmvq20CggEBDwAUwmscGAsMGgYaAh63Hmvo2ECgg0BBwAYzmsYHAsEGgIeBh67Gmvg0ECgg0BFwAo3lsIDBsEGgIeNh6rKlvA4ECAg0BF8BoHhsIDBsEGgIeth5r6ttAoIBAQ8AFMJrHBgLDBoH/B3dKWwggw07mAAAAAElFTkSuQmCC";

const DEMO="composition-2", DEMO_TITLE="Composition 1 Advanced";   // Handpan Cookbook 2.14
/* THE EMBED TOUR LIVES UNDER ONE LESSON (David, 21 Sep: "this tutorial should happen below the 2.14 lesson, Composition
   1 Advanced … when the question mark icon is pressed on the player under a different video, bring up a pop-up window
   … that should then lead to 2.14"). Away from a lesson (a test page) every piece may run it. */
const TOUR_LESSON_URL="https://www.masterthehandpan.com/dashboard/lesson/3507";
const onTourLesson=()=>{ try{ return !EMBEDDED||(piece&&(piece.id===DEMO||piece.lesson==="2.14")); }catch(e){ return true; } };
const phone=()=>typeof PHONE!=="undefined"&&PHONE&&!(typeof TABLET!=="undefined"&&TABLET);
const isOpen=id=>{ const d=$(id); return !!(d&&d.open); };
const partIs=b=>typeof viewSec==="string"&&baseOf(viewSec).base===b;
const inRun=i=>{ const r=arrRuns()[i]; return !!(r&&r.ais.includes(selAi)); };
const parkedIn=b=>pendingStart!=null&&arrRuns().some(r=>r.base===b&&pendingStart>=r.from&&pendingStart<r.to);
const byText=(sel,t)=>()=>[...document.querySelectorAll(sel)].find(e=>box(e)&&e.textContent.includes(t));
const titled=(sel,t)=>()=>[...document.querySelectorAll(sel)].find(e=>{ const b=e.querySelector("b"); return box(e)&&b&&b.textContent.trim()===t; });
/* WHERE A CLICK LANDED is judged as it was AT THE CLICK: a control that rebuilds itself when pressed (the part pills)
   leaves the recorded element outside its old home, so each click also keeps the chain of elements it sat in then */
const hitAt=(i,sel)=>{ const t=T.clicks[i]; try{ if(t&&t.closest&&t.closest(sel)) return true; }catch(e){}
  return (T.cpaths&&T.cpaths[i]||[]).some(n=>{ try{ return n.matches&&n.matches(sel); }catch(e){ return false; } }); };
const clicked=sel=>T.clicks.some((t,i)=>hitAt(i,sel));
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
/* THE VIDEO FOLLOWS THE PLAYER'S SOUND, FOR THE REST OF THE TOUR (David, 21 Sep: "the first time we unmute the player,
   there should be a pop-up if the user wants to mute the video. We should then place a little note that, for the rest
   of the tutorial, we will deactivate this function. Every time we mute the embed player, the video will automatically
   unmute, and every time we unmute the embed player, the video will automatically mute"). The app's `vidAsk`: "ask"
   on the sound card (asked even where an answer is remembered), "auto" once it is answered, null when the tour ends. */
function tourVidAsk(v){ try{ if(typeof vidAsk!=="undefined") vidAsk=v; }catch(e){} }
const vidAskIs=v=>{ try{ return typeof vidAsk!=="undefined"&&vidAsk===v; }catch(e){ return false; } };
/* The same for the other notice (David, 21 Sep, of "Hear the original again": "wait until the user clicks the OK
   button on the pop-up window, and also … gray out all other options again"): "Don't warn me again" is greyed, and
   the notice, which normally closes itself after four seconds, stays until Got it is pressed (tick() holds its timer). */
function askPanOnly(on){
  const dlgs=[$("panSoundDlg"),$("panMutedDlg"),$("vidSoundDlg")].filter(Boolean);
  document.documentElement.classList.toggle("tour-askpan",on);
  ["psNo","psNever","pmNever","vsNo","vsNever"].forEach(id=>{ const b=$(id); if(b) b.disabled=on; });
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
/* THE LIST STAYS ON THE ROW (David, 21 Sep: "while the scale selector is open here, can you deactivate scrolling in it so
   the user cannot scroll away from the scale that they're supposed to open"): the tour scrolls it to the row, then the
   student cannot - given back when the card is left */
function listLock(on){ const l=$("ppList"); if(!l) return; l.style.overflowY=on?"hidden":""; l.style.touchAction=on?"none":""; l.style.overscrollBehavior=on?"contain":""; }
const myPanUp=()=>{ try{ const d=$("myPanDlg"); if(d&&!d.open){ const pk=$("panPickDlg"); if(pk&&pk.open) pk.close(); openDlg(d); } }catch(e){} };
const pickAll=()=>{ const a=$("ppAll"); if(a&&a.getAttribute("aria-pressed")!=="true") a.click(); };
/* THE PRACTICE HELPERS, AS THEY STAND, AND BACK AGAIN (David, 21 Sep, of Tempo and helpers: "let's activate the
   different options that are highlighted … Once the user moves on to the next card, we should set them back to
   their initial settings") */
const helpersNow=()=>({half:halfSpeed, count:countIn, met:metOn, mark:markMode, bpm:bpm});
function helpersBack(h){
  if(!h) return;
  try{ if(typeof closePop==="function") closePop(); }catch(e){}
  try{ if(halfSpeed!==h.half) $("halfBtn").click(); }catch(e){}
  try{ if(countIn!==h.count) $("countBtn").click(); }catch(e){}
  try{ if(metOn!==h.met) $("metBtn").click(); }catch(e){}
  try{ if(markMode!==h.mark){ markMode=h.mark; try{ localStorage.setItem("hps.marker",markMode); }catch(e){} if(typeof clearMarks==="function") clearMarks(); } }catch(e){}
  try{ if(bpm!==h.bpm&&typeof setTempo==="function") setTempo(h.bpm); }catch(e){}
}
/* THE COMPOSITION'S OWN DEFAULTS BEFORE THE TOUR (David, 21 Sep: "before the tutorial starts, everything should be set
   to their default settings for this composition"): stopped, no loop, the lesson's tempo, no half speed, no count-in,
   no click, the marker on its default, Table, As written, the pan it is written for, full screen off - and, under a
   lesson, following the video */
function compositionDefaults(){
  try{ stopPlay(); }catch(e){}
  try{ if(typeof fsOn==="function"&&fsOn()&&typeof fsLeave==="function") fsLeave(); }catch(e){}
  try{ clearLoop(); }catch(e){}
  plainPlayback();
  try{ if(markMode!=="subdiv"){ markMode="subdiv"; try{ localStorage.setItem("hps.marker",markMode); }catch(e){} if(typeof clearMarks==="function") clearMarks(); } }catch(e){}
  try{ if(view!=="table"&&typeof setView==="function") setView("table"); }catch(e){}
  try{ if(mode!=="pos"&&typeof setMode==="function") setMode("pos"); }catch(e){}
  try{ if(piece&&piece.writtenFor&&myPanId!==piece.writtenFor&&typeof choosePan==="function") choosePan(piece.writtenFor); }catch(e){}
  try{ if(PLAYER&&EMBEDDED&&!follow){ const b=$("followBtn"); if(b) b.click(); } }catch(e){}
}
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
  {id:"emb.follow",   ch:"emb", at:["#followBtn"], gate:()=>follow, gateLive:true},   // Next greyed until Follow video is on (David, 21 Sep)
  /* the pan starts muted in an embed (followMuted = EMBEDDED), and the two players take turns */
  /* THE STUDENT MUTES THE VIDEO ABOVE, AND ANSWERS THE PLAYER (David, 21 Sep): the mute switch framed but not lit,
     an arrow up to the video, and Next greyed until the pan's sound is on BY THAT ROUTE - the positive answer to the
     pop-up, or (where the choice is remembered and no pop-up comes) the video reported muted with the pan on. No
     goal: the card waits for Next, and so it is never skipped on the way back either. */
  /* …AND NOW THE STUDENT SWITCHES THE PLAYER'S OWN SOUND (David, 21 Sep: "instead of pointing the user to the video
     player, we will now point him to simply mute the embed player or unmute"; "we don't need the screenshots anymore"):
     with a bridge that can (can: sound) the sound button is lit, the app asks "Mute the video?" (only its yes), and the
     green line says the video follows by itself from here on. An older bridge keeps the old route: the arrow up to the
     video and its screenshot, the video muted there, and the pan's own question. */
  {id:"emb.sound",    ch:"emb", at:["#folMute"], quiet:()=>!T.canSound, arrowUp:()=>!T.canSound&&vidMuted!==true, tipShot:MUTE_SHOT, tipPoint:[44,52],
                      okayIf:()=>T.canSound, enter:()=>{ if(!vidAskIs("auto")) tourVidAsk("ask"); },
                      gate:()=>!followMuted&&(clicked("#psYes")||(typeof vidMuted!=="undefined"&&vidMuted===true)),
                      done:()=>{ const d=!followMuted&&(clicked("#psYes")||(typeof vidMuted!=="undefined"&&vidMuted===true));
                        if(d&&T.canSound) tourVidAsk("auto"); return d; }, hold:900,
                      onShow:()=>askPanOnly(true), exit:()=>askPanOnly(false)},
  /* WHY THE PAN'S SOUND IS WORTH HAVING (David, 21 Sep): with the video's own controls at half speed his
     playing drops in pitch, while the pan is scheduled from the video's clock (vRate) and stays natural. It
     points at Follow video, the link between the two - and that is what makes it vanish with no video behind the
     player, like the other video cards (found on the live player, opened without a lesson video). */
  /* NEW POSSIBILITIES POINT UP TO THE VIDEO (David, 21 Sep: "does not need to highlight the follow video button …
     add this screenshot as a pop-up with an arrow above that shows that you can change these settings in the video
     player"): no target, the card in the middle, the arrow and the video's speed menu for as long as it is up */
  /* THE SPACE BAR (David, 21 Sep: "you can play and pause playback at any time with the spacebar. Give it a try …
     wait for the user to press spacebar before giving the option to proceed"): Play lit, Next greyed until a Space
     arrives - in the player, or from the lesson page through the bridge */
  /* …and it waits for a STOP AND A RESTART (David, 21 Sep: "wait until the user has stopped and restarted playback at
     least once. Then it can turn green, and the button to continue can come up") - however it is done: Space, Play, or
     the video's own button */
  {id:"emb.space",    ch:"emb", at:["#playBtn"], enter:()=>{ T.ppLast=null; T.ppStop=false; },
                      checks:[{key:"try", ok:()=>{ const h=hearing(), was=T.ppLast; T.ppLast=h;
                        if(was!=null&&h!==was){ if(!h) T.ppStop=true; else if(T.ppStop) return true; } return false; }}],
                      gate:()=>checksDone()},
  /* THE TOUR SETS THE VIDEO'S SPEED (David, 21 Sep: "since we now have control of the playback speed, we can actually set
     the slower tempo for the user … the first prompt … wait for the user to click OK, and the speed goes to 0.75. Then
     another card … go to half tempo … wait for the user to click Next. This option should say Go back to normal tempo and
     proceed"). With a bridge that can (can: rate) the card's button says OK and sets 0.75, starting playback if nothing
     plays; without one it is the old card - the arrow up to the video's own speed menu, and the half-tempo card is left out */
  {id:"emb.videosound",ch:"emb", arrowUp:()=>!T.canRate, tipShot:SPEED_SHOT, tipPoint:[51,87],   // the small arrow at the speed icon (David, 21 Sep)
                      phases:()=>T.canRate?[{btn:"btn", run:()=>{ videoRate(0.75); if(!hearing()) $("playBtn").click(); }}]:null},
  {id:"emb.halfspeed",ch:"emb", only:()=>!!T.canRate,
                      phases:()=>[{btn:"btn", run:()=>{ videoRate(0.5); if(!hearing()) $("playBtn").click(); }},{btn:"btn2", run:()=>videoRate(1)}]},
  /* THE PAN TAB (David, 21 Sep: "ask the user here to stop playback by pressing space, then play around on the pan for
     a while, then press next. The next option should only be available once the user has paused playback … and then
     played a few notes on the pan"): Next greyed until nothing is playing and three notes have been struck here */
  /* …IN TWO STEPS, EACH TICKED GREEN IN TURN (David, 21 Sep: "1. We ask the user to pause playback by pressing space.
     2. Once that is done, the orange writing should turn green with a checkmark, and then we wait for them to play
     around on the pan with a few clicks. 3. Once that is done, the next step can turn green, and then the user can
     press Next"): the notes count from the moment the music has stopped */
  {id:"emb.pan",      ch:"emb", at:["#panbox","#pvsvg"],
                      checks:[{key:"try", ok:()=>!hearing(), then:()=>{ T.pvfN=0; }}, {key:"try2", ok:()=>(T.pvfN||0)>=3}],
                      gate:()=>checksDone()},
  /* navigating still works while the video is the clock, because seekToPulse seeks the recording too
     (David, 21 Sep: "navigating in the Embed player also will navigate the video") */
  /* DONE, THEN GREEN, THEN NEXT (David, 21 Sep: "we also want to wait until the user actually did this, then the writing
     should turn green with a checkmark, and then the option to proceed comes up"): a part picked, then a click into the
     notation after it - the pills AND the notation lit */
  /* the arrow at the part pills until one has been pressed (David, 21 Sep: "add an arrow that points to the navigation
     section pills") */
  {id:"emb.navigate", ch:"emb", at:["#arrChips"], also:["#score"], point:()=>!T.clicks.some((t,i)=>hitAt(i,"#arrChips")),
                      checks:[{key:"try", ok:()=>{ const k=T.clicks.findIndex((t,i)=>hitAt(i,"#arrChips"));
                        return k>=0&&T.clicks.some((t,i)=>i>k&&hitAt(i,"#score")); }}],
                      gate:()=>checksDone()},
  /* and only now the controls the video's clock keeps out of reach */
  /* Next only once Follow is OFF (David, 21 Sep: "give the user the option to proceed only once they have deactivated
     the follow video option") - and greyed again if it goes back on; the student moves on with Next */
  {id:"emb.followoff",ch:"emb", at:["#followBtn"], gate:()=>!follow, gateLive:true,
                      /* …and the video rests once the player goes its own way (David, 21 Sep: "when the user switches follow off
                         and we move on to the next card, can we pause the video?") - the pause every bridge knows */
                      exit:()=>{ try{ if(needVideo()&&vidPlaying) window.parent.postMessage({type:"hps-video-ctl",action:"pause"},"*"); }catch(e){}
                        /* …and the player takes over at the same moment (David, 21 Sep: "at the same time that the video is paused,
                           let's start the player") - on the way forward only */
                        try{ if(T.dir>0&&!follow&&!playing) $("playBtn").click(); }catch(e){} }},
  /* ONE CARD FOR THE PRACTICE CONTROLS, NO DEMONSTRATION (David, 21 Sep: "the tempo and the three little helpers
     don't need an interactive demonstration … combine these into one card"). #footL holds exactly those five; the
     phone keeps them in the drawer's top row. */
  /* hands on: the lit helpers can be used (the marker's menu opens outside the footer, the experimental ear stays
     shut), and on the way out every one goes back to where the card found it */
  {id:"emb.controls", ch:"emb", at:["#footL","#dwTop","#bpmCtl"], allow:["#markPop"], deny:["#tpBtn"], stay:true,
                      enter:()=>{ T.help=helpersNow(); }, exit:()=>{ helpersBack(T.help); T.help=null; }},
  /* A LOOP, HEARD TWICE (David, 21 Sep: "wait until the user has created a loop and played it back two times
     before stopping the playback and proceeding"). lastPaint is the pulse the marker is on; inside a loop it jumps
     back to the loop's start on every pass, so two jumps back are two full passes. The next card stops the music. */
  {id:"emb.loop",     ch:"emb", at:["#score"], allow:["#playBtn","#loopBtn"], enter:()=>{ T.passes=0; T.lastP=null; },
                      /* heard twice, and it KEEPS PLAYING (David, 21 Sep: "let's not automatically move on, but let's keep the
                         loop playing until the user manually selects Next … the orange writing … should make space for the
                         green checkmark"): a gate, not a goal - Next lights and the line turns green; the next card stops it */
                      gate:()=>{ if(T.gateMet.has("emb.loop")) return true;
                        if(!loopSec||!playing){ T.lastP=null; return false; }
                        const p=lastPaint; if(T.lastP!=null&&p>=0&&p<T.lastP) T.passes++; if(p>=0) T.lastP=p;
                        return T.passes>=2; }},
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
                      at:["#score"], also:["#playBtn"], deny:["#score"], listen:true, done:onePass, hold:900, autoNext:true},   // the loop is the tour's: only Play (David, 21 Sep)
  /* THE PAN IS CHOSEN IN TWO CARDS (David, 21 Sep: "we have to walk them through the pan selection process … click
     scale selector, and then, when the scale selector card opens, we need another tutorial card here that explains
     it, explains exactly how to select another scale, highlights the B2 Amara 9 scale, teaches the user how to
     select it"). The first asks for the selector; the second lives in the list, with an arrow at the row. */
  /* the B section keeps looping while the pan is chosen (David, 21 Sep: "playback should not stop, but the card should
     move on to the next one. Time to swap pans while the playback is looping") */
  {id:"emb.mypan",    ch:"emb", at:["#myPanBtn","#panSel","#drawerGrip"], done:()=>isOpen("panPickDlg"), hold:300, autoNext:true},   // straight on once the list is open (David, 21 Sep)
  /* ONLY THE RIGHT PAN (David, 21 Sep: "all options except selecting the correct pan should be deactivated. That
     includes the chord overview for the pan and any favoriting or preview options"): the row and its 9 - not its 17,
     not its chords, heart or preview */
  {id:"emb.pickb2",   ch:"emb", need:PICK, at:[titled("#ppList .pprow","B2 Amara 9")], point:true,
                      deny:[".pprow .ppv",'.ppbuilds button:not([aria-label="B2 Amara 9"])'],
                      onShow:()=>listLock(true), exit:()=>listLock(false),
                      done:()=>/^b2-amara/.test(myPanId), hold:900, autoNext:true},   // straight on to the My pan window once it is chosen (David, 21 Sep)
  /* the two listens (as written, then for my pan) each play the whole table, Play lit with the switch */
  /* THE MY PAN WINDOW, A MOMENT OF ITS OWN (David, 21 Sep: "after the Choose Your Scale card, we need to stay for a
     moment on the scale selection card that comes up. Briefly explain this card, and the as written option should be
     selected here with no option to change it. This needs its own card"): the window the app opens after a pan is
     chosen, lit; As written set; a card that only tells, so nothing in the window can be pressed */
  /* THE CARD OPENS ITS WINDOW (David, 21 Sep: "card 21 seems to be skipped. This card should come up together with the pan
     selection dialog card"): the app opens My pan after a pick only when the list was reached through its own button, so
     a card that is ABOUT that window opens it when it is not up - a card with nothing to point at is passed over */
  {id:"emb.mypanwin", ch:"emb", at:["#myPanDlg"], enter:()=>{ myPanUp(); try{ if(mode!=="pos"&&typeof setMode==="function") setMode("pos"); }catch(e){} }},
  {id:"emb.written",  ch:"emb", enter:asWritten, onShow:plainPlayback, at:["#modePos2","#modePos",byText("#mpModeRow button","As written"),"#drawerGrip"],
                      also:["#playBtn"], listen:true, done:()=>mode==="pos"&&onePass(), hold:900, autoNext:true},   // on by itself after its table (David, 21 Sep)
  /* FOR MY PAN, FROM THE TOP (David, 21 Sep: "the moment the user switches the For My Pan option on, playback should start
     from the beginning of that notation table"): once, when the switch goes on - the table laid again from its first
     beat, and playing */
  {id:"emb.mine",     ch:"emb", at:["#modeTrans2","#modeTrans",byText("#mpModeRow button","For my pan"),"#drawerGrip"],
                      /* …AND NOW IT STOPS AND MOVES ON (David, 21 Sep: "after card 17, stop playback and proceed automatically to the
                         next card") - the transposed table is heard on its own listening card a little later */
                      enter:()=>{ T.mineTop=false; },
                      done:()=>{ if(mode!=="trans") return false;
                        if(!T.mineTop){ T.mineTop=true; stopPlay(); }
                        return true; }, hold:600, autoNext:true},
  {id:"emb.report",   ch:"emb", enter:()=>{ closeAll(); setMode("trans"); }, at:["#report"]},
  {id:"emb.listen",   ch:"emb", enter:listenFresh, onShow:plainPlayback, at:["#score"], also:["#playBtn"], listen:true, done:onePass, hold:600},
  /* AND STRAIGHT ON TO A MAJOR PAN (David, 21 Sep: "the last one should be the C Ashakiran 17, which is a major
     scale … first … as written and then … transposed to the instrument (with the same mode option)"). Tier 3, so
     it is not in the picker's Common list: the All filter is the candidate under the row, and the card says so. */
  {id:"emb.ashaki",   ch:"emb", enter:()=>{ pickAll(); }, need:PICK, point:true, onShow:()=>listLock(true), exit:()=>listLock(false),
                      /* ONLY WHERE WE GUIDE (David, 21 Sep: "I can still click around and do all kinds of naughty things … the only
                         thing I want the user to be able to do is to click exactly where we guide them"): the 17 chip, then the row -
                         not its chords, heart or preview, not another size, and never the whole list as a fallback */
                      at:[buildChip("C Ashakiran","17"),builtRow("C Ashakiran","17"),"#myPanBtn","#panSel","#drawerGrip"],
                      deny:[".pprow .ppv",'.ppbuilds button:not([aria-label="C Ashakiran 17"])'],
                      done:()=>myPanId==="c-ashakiran-17", hold:900, autoNext:true},   // straight on to the My pan window once chosen (David, 21 Sep)
  /* THE MY PAN WINDOW AGAIN, FOR THE MAJOR PAN (David, 21 Sep: "just as we did when we selected the B2 Amara scale, we need
     to pause here for a second and say Let's start with as written again, and we lock the as-written option") */
  {id:"emb.ashpanwin", ch:"emb", at:["#myPanDlg"], enter:()=>{ myPanUp(); try{ if(mode!=="pos"&&typeof setMode==="function") setMode("pos"); }catch(e){} }},
  {id:"emb.ashwritten",ch:"emb", enter:asWritten, onShow:plainPlayback, at:["#modePos2","#modePos",byText("#mpModeRow button","As written"),"#drawerGrip"],
                      also:["#playBtn"], listen:true, done:()=>mode==="pos"&&onePass(), hold:600},
  /* the music PLAYS ON from the card before (David, 21 Sep: "after the user listened to the complete table, playback
     should not stop. It should continue, and then … only the exact button should be highlighted that we want the user
     to press: the For my pan button"): nothing stopped on the way in, the count starts afresh - a whole table heard
     once For my pan is on - and only For my pan is lit (Play stays usable, as on every card) */
  {id:"emb.ashmode",  ch:"emb", enter:()=>{ T.passes=0; T.lastP=null; if(!loopSec&&!hearing()) loopPhrase(); }, onShow:plainPlayback,
                      at:["#modeTrans2","#modeTrans",byText("#mpModeRow button","For my pan"),"#drawerGrip"],
                      listen:true, listenAfter:howMode,
                      /* …and For my pan starts the table from its first beat (David, 21 Sep: "when the For my pan setting is
                         switched on, playback should start from the beginning of the table") - once, when it goes on here */
                      exit:()=>{ T.ashTop=null; },
                      done:()=>{ if(T.ashTop==null) T.ashTop=mode==="trans"; sameMode();
                        if(!howMode()) return false;
                        if(!T.ashTop){ T.ashTop=true; stopPlay(); loopPhrase(); T.passes=0; T.lastP=null; T.heldAt=0; try{ $("playBtn").click(); }catch(e){} return false; }
                        return onePass(); }, hold:600},
  /* THE MUSIC PLAYS ON (David, 21 Sep: "after these listening steps, playback should not stop except if there's a reason
     for it") - no card stops it on the way in unless it must: a listen that restarts the table from its first beat, or
     the video taking over again (Back to the video, which also clears the loop) */
  {id:"emb.sides",    ch:"emb", at:["#chordBtn",'[aria-label="Show chords"]'], done:()=>phone()?(chordRowOn&&!panOn):chordRowOn},   // chords ON, by the student's own tap
  {id:"emb.views",    ch:"emb", at:["#viewTab"], done:()=>view==="tab"},
  /* in AND out again (David, 21 Sep: "ask them to exit full screen mode and wait until full screen mode is exited
     before proceeding") */
  {id:"emb.fs",       ch:"emb", at:["#fsBtn"], enter:()=>{ T.fsIn=false; }, done:()=>{ if(fsOn()) T.fsIn=true; return T.fsIn&&!fsOn(); }, hold:900,
                      autoNext:true},   // on by itself once full screen has been left (David, 21 Sep: "after card 26, move automatically")
  /* it ends where it began: back with the video - and THAT is where the scale pays off (David, 21 Sep:
     "we can add the thing about the different scale at the end of the tutorial when you switch the follow
     video option back on") */
  {id:"emb.followback",ch:"emb", at:["#followBtn"], enter:()=>{ stopPlay(); clearLoop(); }, done:()=>follow, hold:1200},
  /* THE SOUND GOES BACK TO THE VIDEO FIRST (David, 21 Sep: "let's first turn the sound of the video back on.
     Listen to the original, and then switch to the selected scale"). Both cards STAY, and each asks for a switch
     of the video's own sound and an answer to the pop-up the app raises ("the user should now unmute the video
     and then mute it again and answer the pop-up every time") - the pop-up rule lights each one as it comes up.
     Unmute: "Video sound is on", the pan steps aside. Mute: "Video sound is off - turn the pan on?". */
  /* HEAR THE ORIGINAL AGAIN (David, 21 Sep): the arrow up to the video and its screenshot until the video's sound is
     on; Next greyed until the notice's Got it (its other option greyed, its timer held); then Play lit, and after
     TWO BARS of the video's sound the tour moves on WITH THE MUSIC STILL PLAYING ("after 2 bars of listening, you can
     proceed to the next card, but keep the playback going") */
  /* …with a bridge that can, the student mutes the PLAYER and the video's sound comes back by itself (the tour's "auto");
     Next once the player is muted and the video is heard */
  {id:"emb.videoback",ch:"emb", at:["#folMute"], quiet:()=>!T.canSound, arrowUp:()=>!T.canSound&&typeof vidMuted!=="undefined"&&vidMuted!==false, tipShot:MUTE_SHOT, tipPoint:[44,52],
                      thenAt:["#playBtn"], enter:()=>{ listenFresh(); T.vb0=null; }, onShow:()=>askPanOnly(true), exit:()=>askPanOnly(false), listen:true,
                      gate:()=>T.canSound?(followMuted&&vidMuted===false):
                        (clicked("#pmOk")||(followMuted&&vidMuted===false&&!isOpen("panMutedDlg")&&typeof panPref==="function"&&panPref(PK_WARN)==="off")),
                      done:()=>{ if(!T.gateMet.has("emb.videoback")) return false;
                        if(!hearing()){ T.vb0=null; return false; }
                        const p=heardAt(); if(p<0) return false;
                        if(T.vb0==null||p<T.vb0) T.vb0=p;
                        return p-T.vb0>=twoBars(); }, hold:300},
  /* MY FAVOURITE PART, WHILE THE MUSIC PLAYS (David, 21 Sep: "the user is asked to mute the video sound and then
     confirm that the player sound comes back on. All this can happen while the playback is still going"): nothing is
     stopped on the way in; the arrow up to the video and its screenshot until the video is muted, as on the sound card;
     the pop-up offers only its yes */
  {id:"emb.ownscale", ch:"emb", at:["#folMute","#panbox"], stay:true, quiet:()=>!T.canSound, arrowUp:()=>!T.canSound&&vidMuted!==true, tipShot:MUTE_SHOT, tipPoint:[44,52],
                      /* Finish only once the video is muted and the player's sound is on (David, 21 Sep: "the finish option should
                         only be available once the user has muted the video and switched back to the embed player for the sound") */
                      gate:()=>!followMuted&&typeof vidMuted!=="undefined"&&vidMuted===true,
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
  return {title:w.title||"", body:(p&&w.phoneBody)||w.body||"", try:(p&&w.phoneTry)||w.try||"", foot:(p&&w.phoneFoot)||w.foot||"", tip:w.tip||"", pop:w.pop||"", then:w.then||"", okay:w.okay||"", btn:w.btn||"", btn2:w.btn2||"", try2:w.try2||""}; }
const U=()=>TEXT.ui;
function ok(f){ try{ return !!f(); }catch(e){ return false; } }
/* a quiet frame (framed, not lit, not pressable) - `quiet` true, or a function answering for the moment. ONE reading for
   the look and the lock: the lock read the raw value, took the function for "quiet" and kept card 3's sound button
   shut to a real click (David, 21 Sep: "during card 3, I can't currently unmute the player") */
const isQuiet=s=>typeof s.quiet==="function"?ok(s.quiet):!!s.quiet;

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
const POPUPS=["#panSoundDlg","#panMutedDlg","#vidSoundDlg"];
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
  transition:left .4s cubic-bezier(.4,0,.2,1),top .4s cubic-bezier(.4,0,.2,1),width .4s cubic-bezier(.4,0,.2,1),height .4s cubic-bezier(.4,0,.2,1)}
#tourSpot.none{display:none}
#tourSpot.split{outline-color:transparent}
.tframe{position:fixed;display:none;border-radius:12px;outline:2.5px solid #E59315;pointer-events:none}
.tframe.on{display:block}
#tourSpot.ring{box-shadow:none}
#tourArrow{position:fixed;left:50%;top:6px;width:64px;height:78px;margin-left:-32px;display:none;pointer-events:none;
  filter:drop-shadow(0 6px 14px rgba(0,0,0,.5));animation:tourBob 1.1s ease-in-out infinite}
#tourArrow.on{display:block}
#tourTip{position:fixed;top:8px;left:calc(50% + 40px);display:none;align-items:center;gap:10px;pointer-events:none;
  max-width:min(380px,calc(50vw - 52px));background:#1E1B16;color:#fff;border:1.5px solid #E59315;border-radius:12px;
  padding:8px 12px 8px 8px;box-shadow:0 12px 30px -8px rgba(0,0,0,.55);font:700 13.5px/1.35 Figtree,"Helvetica Neue",Arial,sans-serif}
#tourTip.on{display:flex}
#tourTip img{width:136px;height:auto;border-radius:8px;flex:none;display:block}
#tourTip .ttext{max-width:175px}
#tourTip .tshot{position:relative;flex:none;display:block;line-height:0}
#tourTip .tsmall{position:absolute;width:20px;height:24px;margin-left:-10px;display:none;filter:drop-shadow(0 2px 4px rgba(0,0,0,.6));
  animation:tourBobSmall 1.1s ease-in-out infinite}
#tourTip .tsmall.on{display:block}
@keyframes tourBobSmall{50%{transform:translateY(6px)}}
@media (prefers-reduced-motion:reduce){#tourTip .tsmall{animation:none}}
#tourTip img{max-height:210px;object-fit:contain}
@media (max-width:600px){ #tourTip{flex-direction:column;align-items:flex-start;padding:8px} #tourTip img{width:auto;max-width:100%;max-height:180px} #tourTip .ttext{max-width:none} }
@keyframes tourBob{50%{transform:translateY(-12px)}}
#tourPoint{position:fixed;width:78px;height:64px;display:none;pointer-events:none;
  filter:drop-shadow(0 6px 14px rgba(0,0,0,.5));animation:tourNudge 1.1s ease-in-out infinite}
#tourPoint.on{display:block}
#tourPoint svg{display:block;transform:rotate(var(--rot,0deg))}
@keyframes tourNudge{50%{transform:translate(var(--nx,0px),var(--ny,0px))}}
@media (prefers-reduced-motion:reduce){#tourArrow,#tourPoint{animation:none}}
html.tour-askpan #psNo,html.tour-askpan #vsNo,html.tour-askpan #panSoundDlg .dlgask,html.tour-askpan #panMutedDlg .dlgask,html.tour-askpan #vidSoundDlg .dlgask{opacity:.35;pointer-events:none}
#tourCard{position:fixed;box-sizing:border-box;pointer-events:auto;background:#1E1B16;color:#fff;border-radius:14px;padding:14px 16px 12px;
  border:1px solid rgba(255,255,255,.1);box-shadow:0 20px 50px -10px rgba(0,0,0,.55);transition:left .4s cubic-bezier(.4,0,.2,1),top .4s cubic-bezier(.4,0,.2,1);text-align:left}
#tourCard .tk{display:flex;justify-content:space-between;align-items:center;font-size:10.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#B9B0A1}
#tourCard .tx{background:none;border:0;color:#B9B0A1;font-size:17px;line-height:1;padding:2px 4px;margin:-4px -6px 0 0;cursor:pointer}
#tourCard h4{margin:6px 0 4px;font-size:16.5px;font-weight:700;color:#fff}
#tourCard p{margin:0;font-size:13.5px;line-height:1.5;color:#E9E3D8;white-space:pre-line}
#tourCard .ttry{margin-top:9px;font-size:12.5px;font-weight:700;color:#FFD08A;display:flex;gap:7px;align-items:center}
#tourCard .ttry::before{content:"";flex:none;width:8px;height:8px;border-radius:50%;background:#E59315;animation:tourPulse 1.2s infinite}
#tourCard.passed .ttry{color:#9FD7A9} #tourCard.passed .ttry::before{display:none}
#tourCard .ttry.ok{color:#9FD7A9} #tourCard .ttry.ok::before{display:none}
#tourCard .ttry.wait{opacity:.45} #tourCard .ttry.wait::before{animation:none}
#tourCard .ttry+.ttry{margin-top:5px}
#tourCard.listening .ttry{color:#9FD7A9} #tourCard.listening .ttry::before{background:#3FA95B;animation:tourPulse .9s infinite}
@keyframes tourPulse{50%{transform:scale(1.7);opacity:.4}}
#tourCard .tf{display:flex;align-items:center;gap:6px;margin-top:12px;flex-wrap:wrap;row-gap:10px;justify-content:flex-end}
#tourCard .tpips{display:flex;gap:4px;flex:1 1 150px;min-width:150px;flex-wrap:wrap} #tourCard .tpips i{width:6px;height:6px;border-radius:3px;background:#4A453C}
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
#tourCard .tbig:disabled{opacity:.35;cursor:default}
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
  L.innerHTML='<div id="tourSpot" class="none"></div><div class="tframe"></div><div class="tframe"></div><div id="tourArrow" aria-hidden="true"><svg viewBox="0 0 64 78" width="64" height="78">'
    +'<path d="M32 3 L61 38 L43 38 L43 75 L21 75 L21 38 L3 38 Z" fill="#E59315" stroke="#fff" stroke-width="3" stroke-linejoin="round"/></svg></div>'
    +'<div id="tourTip" aria-live="polite"><span class="tshot"><img alt=""><svg class="tsmall" viewBox="0 0 20 24" width="20" height="24" aria-hidden="true">'
    +'<path d="M10 1 L19 11 L13.5 11 L13.5 23 L6.5 23 L6.5 11 L1 11 Z" fill="#E59315" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg></span><span class="ttext"></span></div>'
    +'<div id="tourPoint" aria-hidden="true"><svg viewBox="0 0 78 64" width="78" height="64">'
    +'<path d="M3 32 L38 3 L38 21 L75 21 L75 43 L38 43 L38 61 Z" fill="#E59315" stroke="#fff" stroke-width="3" stroke-linejoin="round"/></svg></div>'
    +'<div id="tourCard"></div>';
  document.body.appendChild(L); spot=L.querySelector("#tourSpot"); card=L.querySelector("#tourCard"); arrow=L.querySelector("#tourArrow"); tip=L.querySelector("#tourTip"); point=L.querySelector("#tourPoint");   // by name: the frames sit among them
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
  if(tip){ const t=up&&"tipShot" in s?words(s.id).tip:"";
    tip.classList.toggle("on",!!t);
    if(t){ const im=tip.querySelector("img"), sp=tip.querySelector(".ttext"), sm=tip.querySelector(".tsmall"), shot=typeof s.tipShot==="string"?s.tipShot:"";
      /* A SMALL ARROW AT THE ICON IN THE PICTURE (David, 21 Sep: "a second small arrow that points to the icon that is
         encircled in red in the screenshot, and also animate this"): `tipPoint` is where the icon sits in the picture,
         in percent; the arrow stands just below it, pointing up */
      const tp=shot&&s.tipPoint; if(sm){ sm.classList.toggle("on",!!tp); if(tp){ sm.style.left=tp[0]+"%"; sm.style.top="calc("+tp[1]+"% + 14px)"; } }
      im.hidden=!shot; if(shot&&im.getAttribute("src")!==shot) im.src=shot; if(sp.textContent!==t) sp.textContent=t; } }
  if(point&&!(s.point&&el&&!isPop&&!T.passed&&!(typeof s.point==="function"&&!ok(s.point)))) point.classList.remove("on");
  if(!el){ spot.className="none"; L.classList.add("dim"); L.querySelectorAll(".tframe").forEach(f=>f.classList.remove("on"));
    card.style.left=(vw-cw)/2+"px"; card.style.top=sheetTop()+"px"; return; }   // nothing to point at: at the top of the notation, not the middle of a tall lesson frame (David, 21 Sep)
  const quiet=!!(isQuiet(s)&&!isPop&&!(s.thenAt&&T.gateMet.has(s.id)));
  L.classList.toggle("dim",quiet); spot.className=quiet?"ring":"";
  /* A SECOND ELEMENT LIT WITH THE TARGET (`also`, David, 21 Sep, of "Now the fun part": "highlight the notation,
     but also the play button"): the spotlight spans both, and the card places itself against the whole. */
  let r=el.getBoundingClientRect();
  if(s.also&&!isPop) for(const c of s.also){ const e=find(c); if(!e) continue; const q=e.getBoundingClientRect();
    const L0=Math.min(r.left,q.left), T0=Math.min(r.top,q.top), R0=Math.max(r.right,q.right), B0=Math.max(r.bottom,q.bottom);
    r={left:L0,top:T0,right:R0,bottom:B0,width:R0-L0,height:B0-T0}; }
  Object.assign(spot.style,{left:r.left-pad+"px",top:r.top-pad+"px",width:r.width+2*pad+"px",height:r.height+2*pad+"px"});
  /* ONE FRAME PER LIT THING (David, 21 Sep, of Move around: "one frame around the navigation section pills and the other
     one around the actual notation window … right now, it's not clear what the app wants the user to do"): the dimming
     still opens over the whole area, but the orange line is drawn round each element on its own */
  const lit=[el,...((s.also&&!isPop)?s.also.map(find).filter(Boolean):[])], frames=[...L.querySelectorAll(".tframe")];
  const split=lit.length>1&&!quiet; spot.classList.toggle("split",split);
  frames.forEach((f,i)=>{ const e=split&&lit[i]; f.classList.toggle("on",!!e); if(!e) return; const q=e.getBoundingClientRect();
    Object.assign(f.style,{left:q.left-pad+"px",top:q.top-pad+"px",width:q.width+2*pad+"px",height:q.height+2*pad+"px"}); });
  /* AN ARROW AT THE ONE TO CHOOSE (`point`, David, 21 Sep: "highlight that scale and point an arrow towards it so the
     user knows exactly what they are supposed to select"): beside the target where there is room, pointing at it,
     else above it pointing down; gone once the choice is made */
  if(point&&s.point&&!isPop&&!T.passed&&!(typeof s.point==="function"&&!ok(s.point))){
    const r=el.getBoundingClientRect();              // at the card's own target, not the whole lit area
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
  /* …NOR WHAT IS ALWAYS THE STUDENT'S - Play and the part pills (David, 21 Sep: both usable throughout): where the card
     would sit on one, it moves below it, else above its own target, else it stays */
  const hostDlg=L.parentElement&&L.parentElement.tagName==="DIALOG"?L.parentElement:null;   // behind an open window they cannot be pressed anyway
  /* (while one of the app's pop-ups is up the card sits right under it - David, 21 Sep - so this list is empty then) */
  /* …and the same under one of the app's own windows (David, 21 Sep, of Your pan and the piece: "the card still moves too
     far down") - a card that points into an open window sits right under it, whatever it covers behind */
  const inWin=!!(el&&el.closest&&el.closest("dialog[open]"));
  for(const kc of (isPop||inWin?[]:["#arrChips","#subChips","#playBtn"])){ const ke=find(kc); if(!ke||(el&&el.contains(ke))||(hostDlg&&!hostDlg.contains(ke))) continue; const q=ke.getBoundingClientRect();
    const over=T0=>left<q.right+6&&left+cw>q.left-6&&T0<q.bottom+6&&T0+ch>q.top-6;
    if(!over(top)) continue;
    if(q.bottom+10+ch<=vh-8) top=q.bottom+10;
    else if(r.top-pad-gap-ch>=8&&!over(r.top-pad-gap-ch)) top=r.top-pad-gap-ch; }
  /* THE CARD NEVER COVERS WHAT IT POINTS AT (found on Move around: the pills and the notation together left no room above
     or below, the card fell to the foot of the screen - onto the pills - and took the student's click). When the lit
     area as a whole has no room, the card goes above, else below, the card's OWN target, over the rest if it must */
  if(!isPop){ const pr=(el.closest&&el.closest(".pprow")||el).getBoundingClientRect();   // a size chip's whole row stays readable
    if(left<pr.right+pad&&left+cw>pr.left-pad&&top<pr.bottom+pad&&top+ch>pr.top-pad){
      if(pr.top-pad-gap-ch>=8) top=pr.top-pad-gap-ch;
      else if(pr.bottom+pad+gap+ch<=vh-8) top=pr.bottom+pad+gap; } }
  /* the card never covers the arrow's callout (on a phone the two meet): it steps below it */
  if(tip&&tip.classList.contains("on")){ const t=tip.getBoundingClientRect();
    if(left<t.right&&left+cw>t.left&&top<t.bottom+8&&top+ch>t.top) top=Math.min(t.bottom+10,vh-ch-8); }
  /* …nor an app menu the student opened from a lit control (the marker's list opens upward, where the card sat and
     took the click): it moves to the other side of the lit area, else beside the menu */
  const pm=document.querySelector("body>.pop");
  if(pm&&box(pm)){ const q=pm.getBoundingClientRect(), hit=(L0,T0)=>L0<q.right+8&&L0+cw>q.left-8&&T0<q.bottom+8&&T0+ch>q.top-8;
    if(hit(left,top)){
      const below=r.bottom+pad+gap, above=r.top-pad-gap-ch;
      if(below+ch<=vh-8&&!hit(left,below)) top=below;
      else if(above>=8&&!hit(left,above)) top=above;
      else if(q.right+12+cw<=vw-8) left=q.right+12;
      else if(q.left-12-cw>=8) left=q.left-12-cw;
      else top=Math.max(8,Math.min(q.top-ch-12,vh-ch-8)); } }
  /* THE FURTHER IT GOES, THE LONGER IT TAKES (0.4 s for a hop, up to 1.5 s across the player - David, 21 Sep: "twice
     as fast" as the first 0.8-3 s) - so a card that sets off for something below the fold is seen going there */
  const dist=Math.hypot(left-(parseFloat(card.style.left)||left), top-(parseFloat(card.style.top)||top));
  if(dist>2){ const dur=Math.min(1.5,Math.max(.4,dist/660)).toFixed(2)+"s"; card.style.transitionDuration=dur; spot.style.transitionDuration=dur; }
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
  /* THE TOUR DOES NOT SCROLL THE PAGE (David, 21 Sep: "I don't think we need a gentle scroll. We just need to see how the
     card moves downwards slower … maybe 3 seconds, and then the user can scroll down by themselves"). The card travels
     to its target at a pace that grows with the distance (place()), and the student follows it. Only a row in one of
     the app's own lists (the scale picker, the library) is centred in that list, so the card never sits on its name. */
  if(el.closest(".pplist,#libList")) el.scrollIntoView({block:"center"});
  place();
}
function tick(){
  if(T.mode!=="steps") return;
  const s=SEQ[T.k]; if(!s) return;
  if(askBlock&&typeof panMutedT!=="undefined"&&isOpen("panMutedDlg")) clearTimeout(panMutedT);
  checkLines(s); gateNext(s); listenLine(s);
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
  const on=hearing()&&(!s.listenAfter||ok(s.listenAfter)); card.classList.toggle("listening",on);
  const w=words(s.id), want=on?U().listening:(s.gate&&w.then?w.then:w.try); if(tr.textContent!==want) tr.textContent=want;
}
function gateNext(s){
  if(!s||!s.gate) return;
  const b=card&&card.querySelector('[data-a="next"]'); if(!b) return;
  /* `gateLive` (David, 21 Sep, of the Follow card: "gray out any option to proceed when Follow Video is not active"):
     Next follows the gate both ways instead of staying open once it was met */
  const was=T.doneIds&&T.doneIds.has(s.id)&&!s.gateLive;
  if(s.gateLive){ if(ok(s.gate)) T.gateMet.add(s.id); else T.gateMet.delete(s.id); }
  else if(ok(s.gate)) T.gateMet.add(s.id);
  if(was) T.gateMet.add(s.id);
  const open=T.gateMet.has(s.id);
  if(open) (T.doneIds=T.doneIds||new Set()).add(s.id); if(b.disabled===open) b.disabled=!open;
  if(open&&s.listen){ card.classList.remove("passed"); return; }   // past its gate a listening card's line is listenLine's
  if(s.checks) return;                                              // a card with steps ticks its own lines
  const tr=card.querySelector(".ttry"); if(!tr) return;
  card.classList.toggle("passed",open);
  /* while one of the app's notices is up, a card may say what to press in it (`pop`) */
  const w=words(s.id), pop=w.pop&&POPUPS.some(c=>find(c));
  const want=open?(okayOf(s,w)||U().nice):(pop?w.pop:w.try); if(tr.textContent!==want) tr.textContent=want;
}
/* NO CARD MOVES ON BY ITSELF (David, 21 Sep: "let's generally adapt a policy that we don't automatically proceed to
   the next card. We wait for the user's input to click the next button"). A card whose task is done turns its line
   green with a tick and lights Next; the student moves on. Music that is playing keeps playing until they do. */
/* a green line that is only true on some lessons (`okayIf`) falls back to the plain tick where it is not */
function okayOf(s,w){ return s.okayIf&&!ok(s.okayIf)?"":w.okay; }
function pass(s){
  T.passed=true; T.token++; (T.doneIds=T.doneIds||new Set()).add(s.id);
  card.classList.add("passed"); card.classList.remove("listening");
  const w=words(s.id), tr=card.querySelector(".ttry"); if(tr) tr.textContent=okayOf(s,w)||U().nice;
  const b=card.querySelector('[data-a="next"]'); if(b) b.disabled=false;
  /* THE ONE EXCEPTION, BY NAME (`autoNext`, David, 21 Sep, of Now the fun part: "once the user has listened to the complete
     table, it should automatically proceed to the next card, and playback should continue") */
  if(s.autoNext){ const tk=T.token; setTimeout(()=>{ if(T.mode==="steps"&&tk===T.token&&SEQ[T.k]===s) next(); },s.hold||900); }
}
const lastOf=ch=>{ for(let i=SEQ.length-1;i>=0;i--) if(SEQ[i].ch===ch) return i; return -1; };

/* open step k, walking in direction dir past the steps that are not for this screen */
function open(k,dir){
  T.token++; T.dir=dir;                             // which way the student is going (a card's exit may care)
  for(;k>=0&&k<SEQ.length;k+=dir){
    const s=SEQ[k];
    if(s.ch!==T.ch) chapterStart(s.ch);
    if(s.need&&!isOpen(s.need.dlg)){ const d=document.querySelector(s.need.door); if(d) d.click(); }
    if(s.enter) try{ s.enter(); }catch(e){}
    if(s.at&&!s.anywhere&&!ownTarget(s)) continue;  // nothing here to point at: not a step for this screen
    if(s.only&&!ok(s.only)) continue;                // a card for a situation that is not this one
    /* NO CARD IS SKIPPED FOR HAVING ITS GOAL MET (David, 21 Sep: "deactivate the skip" - Back and Next skipped the
       sound card once its goal stayed true). A card whose goal is already met is SHOWN as done, with its Try it line
       ticked and a Next button, and it waits: it does not count itself done and jump ahead. */
    /* A CARD DONE ONCE STAYS DONE (David, 21 Sep: "when the condition for a certain card has been met once and I navigate
       back to it, please give me the freedom to navigate through it without fulfilling the transition again") */
    const was=!!(T.doneIds&&T.doneIds.has(s.id))&&!s.gateLive;   // a live condition (Follow on / off) is never remembered (David, 21 Sep)
    const met=was||!!(s.done&&ok(s.done));
    T.k=k; T.clicks=[]; T.cpaths=[]; T.passed=met;
    if(T.cur!==s){ exitHook(); T.cur=s; T.phase=0; T.ck=was&&s.checks?s.checks.map(()=>true):[]; if(was&&s.gate) T.gateMet.add(s.id); if(s.onShow) try{ s.onShow(); }catch(e){} }
    paint(s,met);
    const el=target(s);
    if(el) bring(el,s); else place();     // bring() places the card itself - after the page has come to rest
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
/* EVERY CARD HAS ITS NUMBER (David, 21 Sep: "give each tutorial card a number starting from 1"): its place among the cards
   of its chapter that this visit shows - a card for another situation (`only`) takes no number, so none are missing */
function cardNo(s){
  let n=0; for(const x of SEQ){ if(x.ch!==s.ch) continue; if(x.only&&!ok(x.only)&&x!==s) continue; n++; if(x===s) break; }
  return n+". ";
}
function paint(s,met){
  /* A STEP THAT STAYS (David, 21 Sep: "give the user the opportunity to play around … don't automatically
     progress to the next card. Wait until the user progresses manually"): it shows its Try it line as an
     invitation, has no goal to meet, and its button says Next, never Skip - the student moves on when done. */
  const w=words(s.id), ci=CHS.findIndex(c=>c.id===s.ch), mine=SEQ.filter(x=>x.ch===s.ch), n=mine.indexOf(s),
        last=T.k===lastOf(s.ch), u=U(), ph=phasesOf(s), tries=!!((s.done||s.stay||s.gate||ph)&&w.try), skippy=false,
        tryNow=ph&&(T.phase||0)>0&&w.try2?w.try2:w.try, btnNow=ph&&w[ph[Math.min(T.phase||0,ph.length-1)].btn];
  card.className=met?"passed":"";
  card.innerHTML='<div class="tk"><span>'+h(PLAYER?CHS[ci].name:(ci+1)+" · "+CHS[ci].name)+'</span><button class="tx" data-a="x" aria-label="'+h(u.leave)+'">✕</button></div>'
    +"<h4>"+cardNo(s)+h(w.title)+"</h4><p>"+h(w.body)+"</p>"
    +(s.checks?s.checks.map((c,i)=>'<div class="ttry'+(i>0?" wait":"")+'" data-ck="'+i+'">'+h(w[c.key])+"</div>").join("")
      :(tries?(ph&&(T.phase||0)>0?'<div class="ttry ok">✓ '+h(tryNow)+"</div>"   // the step before is done: green, ticked (David, 21 Sep)
        :'<div class="ttry">'+h(met?u.nice:tryNow)+"</div>"):""))
    +'<div class="tf"><span class="tpips">'+mine.map((x,i)=>"<i"+(i===n?' class="on"':"")+"></i>").join("")+"</span>"
    +(last?'<button class="tb gho" data-a="stop">'+h(u.stopHere)+"</button>":(n>0?'<button class="tb gho" data-a="back">'+h(u.back)+"</button>":""))
    +'<button class="tb '+(skippy?"sec":"pri")+'" data-a="next"'+((s.gate&&!T.gateMet.has(s.id)&&!ok(s.gate))||(s.done&&!met&&!T.passed)?" disabled":"")+'>'+h(btnNow||(last?(ci<CHS.length-1?u.nextChapter:u.finish):(skippy?u.skip:u.next)))+"</button></div>";
}
/* A CARD WITH STEPS (`checks`): lines worked through in order, each turning green with a tick once its condition holds;
   the next one only counts from then. checksDone() is the card's gate. */
function checksDone(){ const s=SEQ[T.k]; return !!(s&&s.checks&&T.ck&&s.checks.every((c,i)=>T.ck[i])); }
function checkLines(s){
  if(!s||!s.checks||!card) return;
  T.ck=T.ck||[];
  for(let i=0;i<s.checks.length;i++){ const c=s.checks[i];
    if(T.ck[i]) continue; if(i>0&&!T.ck[i-1]) break;
    if(ok(c.ok)){ T.ck[i]=true; if(c.then) try{ c.then(); }catch(e){} } else break; }
  const w=words(s.id);
  card.querySelectorAll(".ttry[data-ck]").forEach(el=>{ const i=+el.dataset.ck, done=!!T.ck[i], txt=(done?"✓ ":"")+w[s.checks[i].key];
    el.classList.toggle("ok",done); el.classList.toggle("wait",!done&&i>0&&!T.ck[i-1]); if(el.textContent!==txt) el.textContent=txt; });
}
/* A CARD WITH PHASES: its button runs each phase in turn, relabelled from the words (btn, btn2), and the last one moves on */
const phasesOf=s=>{ try{ return typeof s.phases==="function"?s.phases():(s.phases||null); }catch(e){ return null; } };
function onCard(e){
  e.stopPropagation();
  const b=e.target.closest("[data-a],[data-ch]"); if(!b) return;
  if(b.dataset.ch){ start(b.dataset.ch); return; }
  const a=b.dataset.a;
  if(a==="x"){ leave(); toast(phone()?U().leftPhone:U().left); }
  else if(a==="stop"){ markDone(T.ch); leave(); toast(phone()?U().leftPhone:U().left); }
  else if(a==="back") open(T.k-1,-1);
  else if(a==="next"){ const s=SEQ[T.k], ph=s&&phasesOf(s);
    if(ph&&(T.phase||0)<ph.length){ try{ ph[T.phase].run(); }catch(err){} T.phase=(T.phase||0)+1;
      if(T.phase<ph.length){ paint(s,false); place(); return; } }
    next(); }
  else if(a==="go"){ if(needVideo()&&!videoReady()) videoFirst(); else if(PLAYER) playNote(); else start(); }   // six chapters, or the player's one
  else if(a==="begin") playNote();
  /* …and the video plays when the tour begins (David, 21 Sep: "if the video is not playing and the student starts the
     tour, please start playback on the video") - the play command every bridge knows */
  else if(a==="begin2"){ start();
    try{ if(needVideo()&&!vidPlaying) window.parent.postMessage({type:"hps-video-ctl",action:"play"},"*"); }catch(err){} }
  else if(a==="golesson"){ const st=store.get(); st.pend=Date.now(); store.set(st); }   // the link itself loads the lesson
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
  if(T.mode!=="steps") T.snap=snapshot();       // what the student had, for the end - taken before the defaults
  if(PLAYER) compositionDefaults();
  videoUp();                                        // the tour begins with the video's own sound (and the player muted)
  /* THE PAN TAB IS ON (David, 21 Sep: "make sure that the pan tab is actually active when the tutorial starts") -
     the player's own switch, pressed only when it is off */
  try{ if(PLAYER&&typeof panOn!=="undefined"&&!panOn){ const b=$("panBtn"); if(b) b.click(); } }catch(e){}
  /* …AND THE CHORDS OFF (David, 21 Sep: "chords don't have to show in the beginning. Let's deactivate it in the
     beginning, and then in the viewing options card, we ask the user to activate it manually") */
  try{ if(PLAYER&&typeof chordRowOn!=="undefined"&&chordRowOn){ const b=$("chordBtn"); if(b) b.click(); } }catch(e){}
  showLayer(); L.classList.remove("block");
  T.mode="steps"; T.ch=null; T.gateMet=new Set(); T.doneIds=new Set(); tourVidAsk(null);
  clearInterval(T.iv); T.iv=setInterval(tick,200);
  open(SEQ.findIndex(s=>s.ch===ch),1);
}
function exitHook(){ const c=T.cur; T.cur=null; if(c&&c.exit) try{ c.exit(); }catch(e){} }
function leave(){
  T.dir=0; exitHook(); listLock(false); tourVidAsk(null);   // the student's own setting again
  if(T.rate&&T.rate!==1) videoRate(1);             // a tour left at a slower speed gives the video its own speed back
  const wasSteps=T.mode==="steps";
  T.mode="off"; T.token++; clearInterval(T.iv); T.iv=null;
  if(wasSteps){ closeAll(); restore(); }
  T.ch=null; T.k=-1;
  hideLayer();
}
/* WHERE THE WHITE CARDS SIT (David, 21 Sep: "have the white pop-ups at the beginning and the end of the tour come up further
   upwards, sitting above the notation table, not vertically centered when the transposition card is open"): in the
   lesson player the frame is as tall as the whole player, so its middle can be far down the page - the card sits at the
   top of the notation instead; elsewhere (a window that scrolls) it stays in the middle of the screen */
function sheetTop(){
  const ch=card.offsetHeight, mid=Math.max(12,(innerHeight-ch)/2);
  try{ if(PLAYER){ const sc=$("score"); if(sc){ const t=sc.getBoundingClientRect().top; if(t>=0&&t+ch<innerHeight) return Math.max(12,Math.min(mid,t)); } } }catch(e){}
  return mid;
}
function sheet(html){
  if(T.mode==="steps"){ closeAll(); restore(); clearInterval(T.iv); }
  T.soundSheet=false;                                  // only the cards before the tour keep the video's sound up
  showLayer(); T.mode="sheet"; T.token++;
  L.classList.add("dim","block"); spot.className="none"; L.querySelectorAll(".tframe").forEach(f=>f.classList.remove("on"));
  [arrow,tip,point].forEach(e=>e&&e.classList.remove("on"));
  card.className="tsheet"; card.innerHTML=html;
  const cw=Math.min(430,innerWidth-24); card.style.width=cw+"px";
  raise(null);
  card.style.left=(innerWidth-cw)/2+"px"; card.style.top=sheetTop()+"px";
}
/* THE VIDEO FIRST (David, 21 Sep: "when Show me around is clicked and the video hasn't been played, please don't gray it
   out … bring up a pop-up window that asks the user to press play on the video once. And only then give the option to
   proceed to the tour"). Under a lesson the video counts as ready once it has been seen PLAYING (the bridge's report);
   browsers do not let a page start a video with sound by itself, so the student's own press is the reliable start.
   Away from a lesson there is no video to wait for. */
const needVideo=()=>{ try{ return PLAYER&&EMBEDDED; }catch(e){ return false; } };
function videoReady(){ try{ if(vidPlaying||vidState===true) T.vidOk=true; }catch(e){} return !!T.vidOk; }
function welcome(){
  const w=words(PLAYER?"sheet.emb":"sheet.welcome"), u=U();
  sheet("<h3>"+h(w.title)+"</h3><p>"+h(w.body)+'</p><div class="trow"><button class="tbig" data-a="go">'+h(u.show)
    +'</button><button class="tplain" data-a="later">'+h(u.notNow)+'</button></div><p class="fine">'+h(w.foot)+"</p>");
  soundWatch();
}
function videoFirst(){
  const w=words("sheet.embVideo"), u=U();
  sheet("<h3>"+h(w.title)+"</h3><p>"+h(w.body)+'</p><div class="trow"><button class="tbig" data-a="begin" hidden>'+h(u.cont)
    +'</button><button class="tplain" data-a="later">'+h(u.notNow)+"</button></div>");
  soundWatch();
  /* the arrow up to the video, as on every card that asks for something in the video player (David, 21 Sep) - until
     the video has played */
  if(arrow) arrow.classList.add("on");
  clearInterval(T.wv);
  T.wv=setInterval(()=>{
    if(T.mode!=="sheet"){ clearInterval(T.wv); return; }
    if(!videoReady()) return;
    clearInterval(T.wv); if(arrow) arrow.classList.remove("on");
    const b=card.querySelector('[data-a="begin"]'); if(b) b.hidden=false;
  },300);
}
/* BEFORE THE FIRST CARD (David, 21 Sep: "before the actual tour starts … we want to say that the users can start and pause
   playback anytime during the tutorial with the spacebar or the play button. For starters, we want to keep the video
   running"): a white card of its own, after the video's pop-up, whose button starts the tour */
function playNote(){
  const w=words("sheet.embPlay"), u=U();
  sheet("<h3>"+h(w.title)+"</h3><p>"+h(w.body)+'</p><div class="trow"><button class="tbig" data-a="begin2">'+h(u.startTour)
    +'</button><button class="tplain" data-a="later">'+h(u.notNow)+"</button></div>");
  soundWatch();
}
/* THE VIDEO'S OWN SOUND, FROM THE FIRST CARD (David, 21 Sep: "at the beginning of the tour, the video should already be
   unmuted … even after the very first card, a quick look around. If the check can happen there, that would be perfect").
   ONE check, `videoUp()`: under a lesson whose bridge can, a muted video is unmuted - and the player's sound steps aside
   first, so the app's turn-taking has nothing to announce and card 3 finds the player muted, as it expects. It runs
   while the welcome card, the video card and Before we start are up (the video's state may arrive after the card),
   and once more as the tour starts. Never on the end card: the tour ends with the player's sound on. */
function videoUp(){ try{ if(!needVideo()||vidMuted!==true||!T.canSound) return;
  if(typeof followMuted!=="undefined"&&!followMuted){ followMuted=true; if(typeof updateScoreTools==="function") updateScoreTools(); }
  videoSound(true); }catch(e){} }
function soundWatch(){ T.soundSheet=true; videoUp(); clearInterval(T.sw);
  T.sw=setInterval(()=>{ if(T.mode!=="sheet"||!T.soundSheet){ clearInterval(T.sw); return; } videoUp(); },400); }
/* under any other lesson: go to the one the tour runs under; the player there opens the welcome card by itself */
function elsewhere(){
  const w=words("sheet.embElse"), u=U();
  sheet("<h3>"+h(w.title)+"</h3><p>"+h(w.body)+'</p><div class="trow"><a class="tbig" data-a="golesson" target="_top" href="'+TOUR_LESSON_URL+'" style="text-decoration:none">'+h(u.goLesson)
    +'</a><button class="tplain" data-a="later">'+h(u.notNow)+"</button></div>");
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
  if(PLAYER){ if(onTourLesson()) welcome(); else elsewhere(); }
  else menu(false);
});
/* ONLY WHAT THE CARD ASKS FOR (David, 21 Sep: "ideally, the user could only ever click the highlighted options, and
   the rest of the user interface is deactivated for the duration of the tutorial" … "whenever one of the listening
   sequences happens … they would not have the option to navigate away or stop the playback"). ONE rule, asked of
   every press and key while a card is up: it goes through when it lands on the card itself; on a pop-up the card
   has lit; or on what the card lit - its target, the things lit with it (`also`, `thenAt`) and anything it names
   in `allow` - but only on a card that asks the student to do something (a card that only tells asks nothing, so
   nothing but the card can be touched), never on a quiet frame (framed, not lit), and not at all while a listening
   card is listening. Play and the space bar always go through. Everything else is swallowed before the app sees it. Scrolling is never blocked, Esc always
   reaches the tour, and the card's ✕ and Skip are always the way out. Off the moment the tour ends. */
function mayTouch(el){
  if(T.mode!=="steps"||!el) return true;
  if(L&&L.contains(el)) return true;
  const s=SEQ[T.k]; if(!s) return true;
  for(const c of POPUPS){ const d=find(c); if(d) return d.contains(el); }
  /* PLAY IS ALWAYS THE STUDENT'S (David, 21 Sep: "the ability to play and pause playback with space should be active
     during the tutorial, and also the play button should be usable during the tutorial. Nothing else.") */
  if(el.closest&&el.closest("#playBtn,#landPlay")) return true;   // every Play the player has: the header's, and the phone's sideways view
  /* …AND SO IS FINDING ONE'S WAY (David, 21 Sep: "keep the option to move through the arrangement and click into the
     notation to move the playhead throughout the tutorial") - on every card, unless the card names it shut (`deny`:
     the fun part's loop, which a click or a drag in the notation would change) */
  /* the whole of it (David, 21 Sep: "the full navigation options should be available during the tutorial, including
     right-clicking to see all the tables of a section and then clicking into one of those tables"): the part pills, the
     table numbers beside them, the table menu a right-click opens (a page-level pop-up), and the notation */
  if(el.closest&&el.closest("#arrChips,#subChips,#score,body>.pop")){
    const shut=(s.deny||[]).some(c=>{ try{ return typeof c==="string"&&el.closest(c); }catch(e){ return false; } });
    if(!shut) return true; }
  if(s.listen&&hearing()&&(!s.gate||T.gateMet.has(s.id))&&(!s.listenAfter||ok(s.listenAfter))) return false;   // listening: hands off (from `listenAfter` on, where a card first asks for something)
  if(!(s.done||s.stay||s.gate)) return false;
  /* `deny` names what stays shut inside a lit area: a selector matches ANY element it describes (el.closest) */
  for(const c of (s.deny||[])){ if(typeof c==="string"){ try{ if(el.closest(c)) return false; }catch(e){} } else { const e=find(c); if(e&&e.contains(el)) return false; } }
  const lit=[], thenPhase=s.thenAt&&T.gateMet.has(s.id);
  if(!isQuiet(s)||thenPhase){ const t=ownTarget(s); if(t) lit.push(t); }
  for(const c of [...(s.also||[]),...(s.allow||[])]){ const e=find(c); if(e) lit.push(e); }
  return lit.some(e=>e.contains(el));
}
const guard=e=>{
  if(T.mode!=="steps"||!e.isTrusted) return;               // the tour's own presses (a door, Stop, All) are not a person's
  if(e.type==="keydown"&&(e.key==="Escape"||e.key==="Tab"||e.key===" ")) return;   // Space plays and pauses, always
  const el=e.type==="keydown"?(document.activeElement||e.target):e.target;
  if(mayTouch(el)) return;
  e.stopImmediatePropagation();
  if(e.type!=="touchstart") e.preventDefault();          // a touch may still scroll the page
};
["pointerdown","mousedown","touchstart","click","dblclick","auxclick","contextmenu","keydown"].forEach(t=>
  window.addEventListener(t,guard,{capture:true,passive:false}));
/* THE VIDEO'S SOUND (David, 21 Sep: "make sure the video is unmuted when the tour starts" … "also add mute as a
   function"). The lesson page's bridge mutes and unmutes the video on request - from build 2026-09-21a, which says
   so in its status message (can: sound). An older bridge takes any command it does not know for a PAUSE, so the
   request goes only to a bridge that has said it can; otherwise nothing is sent and the sound stays as it is. */
addEventListener("message",e=>{ const d=e.data;
  if(d&&d.type==="hps-bridge"&&Array.isArray(d.can)&&d.can.includes("sound")) T.canSound=true;
  if(d&&d.type==="hps-bridge"&&Array.isArray(d.can)&&d.can.includes("rate")) T.canRate=true;
  if(d&&d.type==="hps-key"&&d.key===" ") T.spaceHit=true; });          // a Space pressed on the lesson page
addEventListener("keydown",e=>{ if(e.key===" "&&e.isTrusted) T.spaceHit=true; },true);   // …or in the player
function videoRate(r){
  if(!T.canRate) return false; T.rate=r;
  try{ window.parent.postMessage({type:"hps-video-ctl",action:"rate",rate:r},"*"); return true; }catch(e){ return false; }
}
function videoSound(on){
  if(!T.canSound) return false;
  try{ window.parent.postMessage({type:"hps-video-ctl",action:on?"unmute":"mute"},"*"); return true; }catch(e){ return false; }
}
const rec=e=>{ if(T.mode!=="steps"||(L&&L.contains(e.target))) return; T.clicks.push(e.target);
  { const path=[]; for(let n=e.target;n&&n.nodeType===1;n=n.parentElement) path.push(n); (T.cpaths=T.cpaths||[]).push(path); }
  if(e.type==="pointerdown"&&e.target.closest&&e.target.closest(".pvf")) T.pvfN=(T.pvfN||0)+1;   // a note struck on the pan
  setTimeout(tick,60); };
document.addEventListener("pointerdown",rec,true);
document.addEventListener("click",rec,true);
document.addEventListener("close",()=>setTimeout(tick,30),true);          // a dialog closed: the layer comes home
new MutationObserver(()=>setTimeout(tick,30)).observe(document.body,{attributes:true,attributeFilter:["open"],subtree:true});
addEventListener("resize",()=>{ if(T.mode==="steps") place(); else if(T.mode==="sheet"&&card){ const cw=Math.min(430,innerWidth-24);
  card.style.width=cw+"px"; card.style.left=(innerWidth-cw)/2+"px"; card.style.top=sheetTop()+"px"; } });
document.addEventListener("fullscreenchange",()=>setTimeout(tick,60));
document.addEventListener("keydown",e=>{
  if(e.key!=="Escape"||T.mode==="off") return;
  if(document.querySelector("dialog[open]")||(typeof fsOn==="function"&&fsOn())) return;   // Esc closes those first
  leave();
});

/* THE FIRST START OFFERS CHAPTER 1 (David, 21 Sep: yes) — on the test version for now, never inside a
   lesson embed, and only once: "Not now" is an answer, and the tour stays in Settings. */
function firstStart(tries){
  const st=store.get();
  /* SENT HERE FROM ANOTHER LESSON'S ? (within the quarter of an hour): the welcome card opens by itself */
  const sent=PLAYER&&st.pend&&Date.now()-st.pend<15*60*1000;
  if(PLAYER&&!onTourLesson()) return;                  // the player offers its tour only under the lesson it runs under
  if(sent){ if(document.querySelector("dialog[open]")&&tries<20){ setTimeout(()=>firstStart(tries+1),1000); return; }
    delete st.pend; st.seen=1; store.set(st); welcome(); return; }
  if(st.seen) return;
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
  videoSound, videoRate,
  go:id=>{ const k=SEQ.findIndex(x=>x.id===id); if(k<0||T.mode!=="steps") return false; open(k,1); return true; },
  probe:id=>{ const s=SEQ.find(x=>x.id===id)||SEQ[T.k]; if(!s) return null;
    const el=ownTarget(s); return el?("#"+(el.id||"")+"."+(el.className&&el.className.baseVal!==undefined?el.className.baseVal:el.className||"")+" "+el.tagName).trim():null; }};
})();
