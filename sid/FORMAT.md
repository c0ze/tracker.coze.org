# The SID driver and its data

`sid/driver.s` + `sid/voice.s` is a 3-voice SID music driver with sound effects on voice 3, written for cozy-tracker (ISC, like the rest of the repository). `tools/sid-compile.js` turns a song JSON into this data, appends it to the driver source and assembles both with `tools/asm6502.js`.

Design follows Cadaver's "Building a musicroutine" (covert bitops rants, `music.html`):
- hard restart the "old" way (§2.6.1): the gate is cleared and ADSR set to 0 two frames before a new note, and a note starts by writing waveform, attack/decay, sustain/release in that order;
- ghost registers written every frame (§1.1);
- a combined waveform/arpeggio table per instrument (§2.5);
- sound effects interrupt voice 3 while the music keeps its timing underneath (§2.9).

## Song JSON

A SID song is a cozy-tracker song with a `sid` object and at most 3 channels; every instrument has a `sid` object instead of sample data (`tools/validate-sid.js` checks both). `node tools/json2sid.js songs/<song>.json` builds it; `--measure 60` reports the play routine's cost.

`song.sid`:

| Field | Meaning (default) |
|---|---|
| `model` | `"6581"` or `"8580"`, written to the PSID header (`"6581"`) |
| `volume` | master volume 0..15 (15) |
| `speed` | frames per row, overriding the IT speed and tempo (from `ticks` and `bpm`) |
| `funktempo` | alternate long and short rows for a fractional speed (see Speed and funktempo) |
| `hardRestart` | frames before a note with the gate off and the restart ADSR, 0..3 (2) |
| `hardRestartAdsr` | `[attack/decay, sustain/release]` bytes during the hard restart (`[0, 0]`; GoatTracker's default is `[15, 0]`), or `"keep"`: only the gate drops and the ADSR stays as it is (Daglish, Galway) |
| `loop` | order position the song returns to after the last order (0) |
| `sections` | names for order positions a host starts with `restart` (see Sections) |
| `sfx` | `[{ name, instrument, note, frames, tail }]`: sound effects on voice 3; `frames` (1..255) with the gate on, then `tail` (10) frames of release |
| `author`, `released` | PSID header text |

`samples[i].sid`, an instrument:

| Field | Meaning |
|---|---|
| `adsr` | `[attack, decay, sustain, release]`, each 0..15. A note's volume column (`vNN`) replaces the sustain. |
| `wave` | steps, one per frame from the note's start: `"pulse"`, `["noise", "C-7"]`, `["pulse", 12]`. A waveform is `noise`, `pulse`, `saw`, `tri`, `test`, `ring`, `sync` or a `+` combination. The note is semitones from the row's note (-64..63) or a fixed note name (drums). |
| `loop` | step the wavetable returns to after the last; without it the last step holds |
| `transpose` | semitones added to every note of this instrument (-48..48) |
| `pulse` | `{ width, speed, min, max }`: width 0..4095 at the note's start, then `speed` (-127..127) added each frame, turning round at `min` and `max` (compared in steps of 256; defaults 256 and 3840). `"carry"` (or leaving `pulse` out, which warns for a pulse waveform) keeps the width, sweep and limits the voice already has, so a sweep runs on across notes. A saw, triangle or noise instrument needs no `pulse`. |
| `filter` | `{ mode, cutoff, resonance, speed, min, max }`: `mode` is `low`, `band`, `high` or a `+` combination; `cutoff` 0..2047 (the driver writes only `$D416`, so in steps of 8), moving `speed` steps of 8 per frame (-128..127) and stopping at `min` (0) or `max` (2047); `resonance` 0..15. There is one filter: a note whose instrument has one takes it for its voice, and a later note without one on that voice lets it go. `"carry"` takes the filter as it is running (cutoff, sweep, mode) for this voice without starting it again, so a sweep goes on across notes and across voices. |

## Entry points (at the load address)

Each entry point clears decimal mode first (an IRQ handler does not).

| Offset | What |
|---|---|
| +0 | `jmp init`: A is ignored. Starts at order `start_order`. |
| +3 | `jmp play`: call once per PAL frame (50 Hz). |
| +6 | `jmp sfx`: A = effect number. Safe to call from the main loop while `play` runs in an IRQ. |
| +9 | `start_order`: written by the host before `init`. |
| +10 | `mute`: bit n silences voice n (bit 2 also silences effects). |
| +11, +12 | `cur_order`, `cur_row`: the row playing now, for the host to read. |
| +13 | `restart`: the host writes order + 1; the next `play` starts over from that order (as `init`). One byte, so safe while `play` runs in an IRQ. An effect asked for before that `play` still plays. |

## Sections

`song.sid.sections` names song order positions, e.g. `{ "cleared": 15, "fallen": 16 }`: a jingle or a sting in the same song, started with `restart`. A section ends by jumping (`B`) where it should go on: back to the loop, or to a silent pattern that jumps to itself. `tools/sid-compile.js` reports them as driver orders (`sections` in its result).

## Frame

1. `tick` advances. On tick 0 the pending row (fetched earlier) is applied, and `speed` becomes the even- or odd-row length (see Speed and funktempo).
2. On tick `max(1, speed - HR_FRAMES)` the next row is fetched: the order position advances, each voice's track is decoded into pending state, and a voice with a new, non-legato note gets its hard restart now.
3. Each voice runs its wavetable, arpeggio, slide, vibrato and pulse, and its 7 registers are written.
4. The filter runs and `$D415`-`$D418` are written.

## Track bytes (one track per voice per pattern)

| Byte | Meaning | Ends the row |
|---|---|---|
| `$00`-`$5F` | note (0 = C-1 in cozy-tracker names, 48 = C-5) | yes |
| `$60` | key off (gate off) | yes |
| `$61` | note cut (gate off, ADSR 0) | yes |
| `$62`+n | empty row, then n more empty rows (n = 0..29) | yes |
| `$80`+i | instrument i (0..31) for this row's note | no |
| `$A0`+s | sustain level s (0..15) for this row's note, from the volume column | no |
| `$B0`+f, p | effect f with parameter p | no |

Prefixes come in this order: effect, instrument, volume, then the note. A row whose note needs a hard restart therefore never begins with a `G` effect.

In the song, `==` is a key off (the gate closes and the release runs) and `^^` a note cut (gate and ADSR to 0). As in IT, an effect lasts its row only: a vibrato, arpeggio, slide or portamento that should go on needs `H00`, `J00`, `E00`/`F00` or `G00` on each following row.

Effects: 1 arpeggio (`J`), 2 slide up (`F`), 3 slide down (`E`), 4 tone portamento (`G`, legato: no restart), 5 vibrato (`H`), 6 speed (`A` and `T`), 7 jump to order (`B` and `C`). Parameters of 0 have already been replaced by the channel's last parameter (effect memory resolved at compile time).

- **Effect memory follows playback.** The compiler walks the order list as the driver plays it: from order 0 along jumps and the loop, then from each section start with the initial state. Each order is compiled with the state that playback brings to it (effect memory, the instrument a bare note plays, the note slides are measured from, the speed). An order reached in two states that would compile differently gets a warning, and plays as on its first arrival. Orders playback never reaches compile from the initial state.
- **Flow** resolves as in IT: on one row the rightmost `B` picks the order, a `C` alone goes to the next order (row 0; `Cxx` with a row warns), and a `B` with a `C` goes to the `B`'s order. The driver gets one jump per row. `C` on the last order goes to the loop order.
- **Vibrato** parameters are a pitch step and a quarter period in frames. Bit 7 of the period marks a vibrato whose speed or depth changed from the row before (the step scales with the note, so a new note can change it): it starts over. Otherwise a vibrato that continues from the row before keeps its phase.
- **Slides** (`E`, `F`) are a signed 16-bit offset from the note, so a slide moves at most $7FFF in frequency from its note and holds there; the frequency stops at 0 and $FFFF. A portamento stops at its target, and where it got to holds when it is cut short.
- **Volume** (`vNN`) is the note's sustain level. It is ignored on a `G` portamento note, which keeps the sustain it has (the compiler warns). IT gains (`mixvol`, an instrument's `volume`) are not carried over: set `sid.volume` and the sustain levels.

## Speed and funktempo

A speed effect carries two frame counts: one for even pattern rows and one for odd ones. The compiler turns IT speed and tempo (`A`, `T`, both on one row acting together) into frames per row at 50 Hz. A whole number plays as it is. Otherwise it rounds, unless the song sets `"sid": { "funktempo": true }`: then two rows take `round(2 x exact)` frames, the even row the longer. Speed 4 at 150 BPM is 3.33 frames a row and plays as 4+3, so 8th notes stay even at 143 BPM instead of rounding to 3 frames (167 BPM). Rows on the 16th grid swing slightly. The compiler reports either approximation. A row lasts 2 to 255 frames.

Patterns longer than 254 rows are split into 254-row driver patterns (the row counter is a byte), so every split starts on an even row and the alternation runs on across it.

## Wavetable

`wt_wave`/`wt_note` pairs, one step per frame from the instrument's start:
- `wt_wave`: waveform bits for `$D404` without the gate (the driver owns the gate), or `$FF` for a jump.
- `wt_note`: `$00`-`$3F` up 0..63 semitones, `$40`-`$7F` down 64..1, `$80`+n absolute note n. After a `$FF` wave, it is the step to jump to (executed in the same frame), or `$FF` to hold the last step.
