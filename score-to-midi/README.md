# Score to MIDI

Reads a picture of printed staff notation and writes a Standard MIDI File.

Open `index.html` in a browser. Nothing to install, no server, no network: the reading, the
drawing, the playback and the file are all done in the page.

---

## What it does

**Drop a picture.** A screenshot, a phone photo of a page, a scan. Several pictures become one
piece in the order they are listed; drag to reorder.

**It reads the notation.** Staffs, clefs, key signatures, bar lines, note heads filled and hollow,
stems, beams and flags, dots, accidentals, rests, ties, triplets, two voices on one staff, pickup
bars, repeat signs, and a printed `♩ = 120` above the first staff.

**It draws back what it found**, as staff notation. This is a mirror, not a typesetter: if a bar
looks wrong here, the reading is wrong, and that is the point of showing it. Bars the reader is
unsure of are tinted violet.

**You can listen to it.** Press Play, or the space bar. A rudimentary piano plays exactly the notes
that will go into the file, and a playhead runs through both the drawing and the picture it was
read from. Click anywhere in either one to put the playhead there.

**You can correct it.** Drag a note head up or down and it moves by staff steps; the arrow keys do
the same. The small bar that appears puts a sharp, a natural or a flat in front of it (keys `s`,
`n`, `f`; backspace clears it). Corrected notes turn green, and the drawing, the playback and the
file all follow. "Undo the corrections" puts everything back as it was read.

**Save `.mid`**, or save the whole reading as JSON if you would rather work with the data.

---

## The files

| | |
|---|---|
| `index.html` | the page: pictures in, notation, playback, corrections, files out |
| `score-reader.js` | the reader. A bitmap in, a score out. No DOM, no dependencies; runs in node too |
| `score-engrave.js` | the reading drawn as staff notation, in SVG. Every symbol is a path in units of the staff spacing |
| `score-midi.js` | the reading as a format-1 Standard MIDI File, and as the note list the player uses |
| `copy-reader.command` | refreshes `score-reader.js` from its source repository, stamping the commit |

### `score-reader.js` on its own

```js
const ScoreReader = require("./score-reader.js");
const res = ScoreReader.read({ w, h, gray });   // gray: Uint8Array, 0 = black … 255 = white
```

```js
res = {
  sp,                       // the staff spacing in pixels — every measurement is a multiple of it
  meter: { beats },         // quarter notes a bar
  key:   { fifths },        // −7 … +7
  tempo: { bpm } | null,
  systems: [ { staffs: [ { clef, lines, x0, x1 } ], bars: [x…] } ],
  bars: [ {
    n, sysIndex, x0, x1, q,               // q: this bar does not add up — look at it
    repeatStart, repeatEnd,               // a bar line with two dots
    staffs: [ {
      clef, total, twoVoice,
      cols: [ { x, onset, dur, q, rest,   // onset and dur are in QUARTER NOTES
                notes: [ { midi, name, step, acc, dur, beams, stem, hollow, q } ] } ]
    } ]
  } ],
  sectionCuts, notes, log
}
```

**One mechanism per stage.** Every measurement is a multiple of `sp`, the staff spacing, found
first. There are no pixel constants, so a phone screenshot at `sp ≈ 14` and a scan at `sp ≈ 22` go
through the same code. Print under 12 px is resampled to double and read again (`res.scale` says
so, and every coordinate is then in the doubled picture). Uncertainty is an output, not a failure:
a bar that does not add up, a head between two positions, a doubtful glyph each carry `q`. The
reader never guesses silently.

---

## What it does not do

- **Grace notes, dynamics, hairpins, slurs, ornaments, articulation, pedal, lyrics.** Not read.
- **The metre's digits.** The reader counts what a bar adds up to, in quarter notes, and takes the
  metre from what most bars agree on. It does not read the printed numerals, so a printed 6/8
  arrives as three quarter notes and you set the denominator by hand. The durations are right
  either way.
- **First and second endings.** A repeated span is played twice; a volta would need reading.
- **Handwritten music.** It reads engraved notation.

## Repeats, and why they are played out

A Standard MIDI File has no repeats. It is a flat line of events with no structure that could say
"go back" — no format-level repeat exists for a player to obey. So when the reader finds a repeat
sign, the bars are written out twice, which is what a player would have done anyway, and a **marker
event** is left at each sign so a person opening the file can still see where the repeat was. Set
Repeats to "Ignore" to write the bars once.

## Where this came from

`score-reader.js` was written for Handpan Studio, where it reads printed scores so they can be
arranged for a handpan. Nothing about that instrument is in it or in this folder: the reader says
what is on the page, and the arranging lives elsewhere.

It is **copied, not shared**. The header names the commit it was taken from. Fixes made here do not
travel back on their own, and fixes made there do not arrive on their own either; port them
deliberately, one at a time, and say which commit you took.
