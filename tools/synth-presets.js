/**
 * The sound library: named synth presets, usable from song JSON as
 *   { "name": "snare", "synth": { "preset": "snare.tight" } }
 * with optional overrides of the preset's own parameters
 *   { "synth": { "preset": "snare.tight", "seed": 9, "tone": 210 } }.
 *
 * Pure data, no imports: synth.js reads it in Node and in the browser player.
 * A published preset keeps its sound (tests pin each one's PCM hash). To change
 * a sound, add a new name instead, so existing songs keep compiling identically.
 *
 * Fields: synth (a synth.js spec), role (percussion | bass | keys | lead | pad | fx),
 * range (lowest and highest note that sounds right, JSON note names; percussion
 * lists its natural pitch at C-5 and how far it bends), about (what it is), and
 * play (the articulation it needs: sample mode has no envelopes).
 */

// Harmonic recipes (studsup_amiga.samples.js BASS_AMPS / BRASS_AMPS; heliobane_stage11 organ drawbars).
const BASS_AMPS = [1, 0.62, 0.45, 0.3, 0.25, 0.18, 0.14, 0.11, 0.09, 0.08, 0.07, 0.06];
const BRASS_AMPS = Array.from({ length: 20 }, (_, k) => Math.round((k === 1 ? 0.8 : 1 / (k + 1) ** 1.15) * 1000) / 1000);
const ORGAN_AMPS = [1, 0.75, 0.5, 0.55, 0, 0.35, 0, 0.3, 0, 0.08, 0, 0.1];

export const PRESETS = {
  // ------------------------------------------------------------ drums
  "kick.punch": {
    synth: { wave: "membrane", seconds: 0.24, freqStart: 190, freqEnd: 48, sweep: 30, decay: 10, click: 0.5, drive: 2.2 },
    role: "percussion", range: ["C-5", "C-5"],
    about: "Punchy electronic kick: swept sine body, short click, soft clip. 0.24 s.",
    play: "Trigger at C-5 on its own channel or a shared drum lane; a hat on the same channel cuts its tail.",
  },
  "kick.soft": {
    synth: { wave: "membrane", seconds: 0.3, freqStart: 120, freqEnd: 46, sweep: 22, decay: 9, click: 0.08, drive: 0.8 },
    role: "percussion", range: ["C-5", "C-5"],
    about: "Rounded, low-click kick for lo-fi, ambient and gentle grooves. 0.3 s.",
    play: "Pairs with the rim or brush-like snares; vary v40-v56 for ghosted kicks.",
  },
  "snare.tight": {
    synth: { wave: "snare", seconds: 0.18, tone: 196, toneDecay: 30, noise: 0.9, noiseDecay: 18, snap: 0.45, drive: 1.6 },
    role: "percussion", range: ["A#4", "D-5"],
    about: "Bright, short snare: two body modes, high-passed noise and a crack. 0.18 s.",
    play: "Backbeat at v48-v60; ghost notes at v14-v24 for breaks. Small pitch shifts change its weight.",
  },
  "snare.gated": {
    synth: { wave: "snare", seconds: 0.34, tone: 175, toneDecay: 22, noise: 0.8, noiseDecay: 10, snap: 0.35, room: 0.9, roomDecay: 3, drive: 1.8, release: 0.05 },
    role: "percussion", range: ["A-4", "C#5"],
    about: "Big snare with a baked, abruptly gated room tail (synthwave, power ballads). 0.34 s.",
    play: "Mostly beats 2 and 4. Its tail fills the gap, so avoid rolls with it; use snare.tight for fills.",
  },
  "rim": {
    synth: { wave: "modal", seconds: 0.09, freq: 1700, partials: [[1, 1, 60], [1.74, 0.5, 80], [2.9, 0.25, 110]], strike: 0.6, strikeDecay: 600, drive: 1.5 },
    role: "percussion", range: ["G-4", "D-5"],
    about: "Rimshot / side-stick click: a high woody resonance and a noise tick. 0.09 s.",
    play: "Lo-fi and bossa backbeats, or a quiet timekeeper; it barely masks anything.",
  },
  "clap": {
    synth: { wave: "clap", seconds: 0.18, bursts: 3, spacing: 0.009, tail: 24 },
    role: "percussion", range: ["A#4", "D-5"],
    about: "Hand clap: three close noise bursts and a short diffuse tail. 0.18 s.",
    play: "Layer with a snare by putting it on another channel on the same row, a few volume steps under.",
  },
  "hat.closed": {
    synth: { wave: "hat", seconds: 0.05, decay: 70, metal: 0.5 },
    role: "percussion", range: ["G-4", "E-5"],
    about: "Closed hi-hat: metallic square cluster plus noise, high-passed. 0.05 s.",
    play: "Alternate v24/v14 on eighths or sixteenths. Share a channel with hat.open so the closed hat chokes it.",
  },
  "hat.open": {
    synth: { wave: "hat", seconds: 0.4, decay: 9, metal: 0.55 },
    role: "percussion", range: ["G-4", "E-5"],
    about: "Open hi-hat, same metal as hat.closed with a long tail. 0.4 s.",
    play: "Off-beats. Choke it with the next closed hat on the same channel, or ^^ it.",
  },
  "cymbal.crash": {
    synth: { wave: "hat", seconds: 1.6, decay: 2.6, metal: 0.4, tune: 1.45, seed: 9 },
    role: "percussion", range: ["F-4", "D-5"],
    about: "Crash cymbal: wide metallic cluster and noise with a slow decay. 1.6 s.",
    play: "Section downbeats only. Give it its own channel so drums don't cut it; ^^ before a quiet entry.",
  },
  "tom.round": {
    synth: { wave: "membrane", seconds: 0.34, freqStart: 230, freqEnd: 105, sweep: 14, decay: 8, overtone: 0.3, click: 0.25, drive: 1.4, seed: 41 },
    role: "percussion", range: ["E-4", "G-5"],
    about: "Round tom: swept skin with an inharmonic overtone. Pitch it with the note for fills.",
    play: "Fills descend in thirds or fourths (G-5, E-5, C-5, G-4); keep them under two beats.",
  },
  "shaker": {
    synth: { wave: "shaker", seconds: 0.12, grains: 7, spread: 0.011, grainDecay: 420 },
    role: "percussion", range: ["A#4", "D-5"],
    about: "Shaker: a seeded cluster of short band-passed grains. 0.12 s.",
    play: "Sixteenths with an accent shape (v20 v10 v14 v10); seeds give alternative takes.",
  },
  "perc.block": {
    synth: { wave: "modal", seconds: 0.14, freq: 880, partials: [[1, 1, 38], [2.57, 0.45, 60], [4.4, 0.2, 90]], strike: 0.25, strikeDecay: 900 },
    role: "percussion", range: ["C-4", "C-6"],
    about: "Wood block: short woody modes. Pitch it with the note for two-tone clave patterns.",
    play: "Off-beat ostinatos or a clave. Two notes a fifth apart make a tick/tock.",
  },
  "perc.cowbell": {
    synth: { wave: "modal", seconds: 0.3, freq: 562, partials: [[1, 0.6, 9], [3, 0.2, 14], [5, 0.08, 20], [1.504, 0.4, 9], [4.51, 0.13, 14], [7.52, 0.05, 20]], strike: 0.2 },
    role: "percussion", range: ["A#4", "D-5"],
    about: "Cowbell: two square-like inharmonic tones with a two-stage ring (heliobane_shop cowbell). 0.3 s.",
    play: "Sparingly: quarter or dotted rhythms. It cuts through everything.",
  },
  "perc.clank": {
    synth: { wave: "modal", seconds: 0.42, freq: 180, partials: [[1, 1, 5], [1.63, 0.85, 7], [2.62, 0.7, 9], [4.1, 0.55, 12], [6.6, 0.45, 15], [10.3, 0.35, 19], [16.2, 0.25, 25]], strike: 0.8, strikeDecay: 90, drive: 1.8 },
    role: "percussion", range: ["C-4", "C-6"],
    about: "Inharmonic metal hit: plating, anvil, chain (heliobane_shop clank).",
    play: "Industrial accents; pitch changes the size of the object.",
  },
  // ------------------------------------------------------------ basses
  "bass.round": {
    synth: { wave: "additive", harmonics: BASS_AMPS, cycle: 128 },
    role: "bass", range: ["A#2", "C-5"],
    about: "Rounded harmonic bass: a fundamental with enough upper harmonics to read on small speakers. Static loop.",
    play: "Needs authored volume (v48 accent, v34 held) and ^^ endings. Center roots on D-3..C-4.",
  },
  "bass.pluck": {
    synth: { wave: "filterpluck", source: "saw", seconds: 0.9, octave: -2, cutoff: 160, envAmount: 2600, envDecay: 22, resonance: 0.45, decay: 3.5, drive: 1.3 },
    role: "bass", range: ["E-2", "C-5"],
    about: "Plucked synth bass: saw through a resonant low-pass that closes. Generated at C-3, so it decays naturally there.",
    play: "Eighth-note synthwave basses and funky lines. It decays by itself; ^^ only to shorten it.",
  },
  "bass.detuned": {
    synth: { wave: "ensemble", cycle: 64, periods: 64, voices: [[0, 1], [1, 0.7]], harmonics: [1, 0.7, 0.5, 0.36, 0.3, 0.2, 0.16, 0.12, 0.1, 0.08, 0.06, 0.05], drive: 1.6 },
    role: "bass", range: ["C-3", "C-5"],
    about: "Two beating voices with saturation: a slow throb (heliobane_stage11 flesh bass). Moving loop.",
    play: "Sustained bass under sparse music. It fills a lot of low end: don't stack it with another bass.",
  },
  // ------------------------------------------------------------ keys
  "keys.tine": {
    synth: { wave: "fm", seconds: 2.5, ratio: 1, index: 2.2, indexDecay: 5, decay: 1.1, tine: 0.18, tineDecay: 45 },
    role: "keys", range: ["C-4", "C-7"],
    about: "Electric-piano tine: two-operator FM whose brightness falls after the strike. Decays by itself.",
    play: "Chords spread over three channels (rootless voicings), one note each; v28-v40 per voice.",
  },
  "keys.mallet": {
    synth: { wave: "modal", seconds: 1.4, partials: [[1, 1, 3.2], [3.93, 0.28, 12], [9.2, 0.08, 30]], strike: 0.05, attack: 0.002 },
    role: "keys", range: ["C-5", "C-8"],
    about: "Wooden mallet (marimba-like): rounded fundamental, fast-decaying upper modes.",
    play: "Arpeggios and hooks; repeated notes need re-strikes, there is no sustain.",
  },
  "bell.clear": {
    synth: { wave: "modal", seconds: 4.5, partials: [[1, 1, 0.7], [2, 0.5, 1.1], [3.01, 0.32, 1.7], [4.17, 0.18, 2.4], [5.43, 0.12, 3.3], [6.79, 0.06, 4.5]], attack: 0.001, release: 0.5 },
    role: "keys", range: ["C-5", "C-8"],
    about: "Clear bell / celesta: a strong fundamental with soft, slightly stretched partials. Rings about 2.6 s at C-5 before falling 20 dB, half that an octave up.",
    play: "Sparse melody or answers; alternate two channels so each tail rings under the next strike. Longer: override seconds and the partial decays.",
  },
  "organ.drawbar": {
    synth: { wave: "additive", harmonics: ORGAN_AMPS, cycle: 64 },
    role: "keys", range: ["C-4", "C-7"],
    about: "Drawbar organ (8', 4', 2 2/3', 2', 1 3/5', 1'). Static loop: it holds until cut.",
    play: "Chords or bass+chord stabs. It never decays: write every release as a cut.",
  },
  // ------------------------------------------------------------ leads
  "lead.brass": {
    synth: { wave: "additive", harmonics: BRASS_AMPS, cycle: 128 },
    role: "lead", range: ["A#3", "C-7"],
    about: "Brassy lead: bright saw-like harmonics with a strong second partial. Static loop.",
    play: "Swell the attack (v30, v44, v40) and add shallow H vibrato on held notes.",
  },
  "lead.pwm": {
    synth: { wave: "pwm", cycle: 128, periods: 96, center: 0.5, depth: 0.32, harmonics: 24 },
    role: "lead", range: ["C-4", "C-7"],
    about: "Pulse lead whose width sweeps about 2.7 times a second at C-5 (faster when played higher).",
    play: "Synthwave and Amiga leads. Shape its volume; the movement alone does not articulate.",
  },
  // ------------------------------------------------------------ pads
  "pad.warm": {
    synth: { wave: "ensemble", cycle: 64, periods: 240, voices: [[0, 1], [-1, 0.8], [1, 0.8]], source: "saw", rolloff: 0.9 },
    role: "pad", range: ["C-4", "C-6"],
    about: "Warm ensemble pad: three softened saw voices beating about 1.1 Hz at C-5 (the rate doubles each octave up). Moving loop.",
    play: "Fade in over 4-8 rows, hold low (v16-v24), fade out, then ^^. One chord tone per channel.",
  },
  "pad.vowel": {
    synth: { wave: "ensemble", cycle: 64, periods: 240, voices: [[0, 1], [-1, 0.8], [1, 0.8], [-2, 0.35], [2, 0.35]], source: "saw", formant: "a" },
    role: "pad", range: ["F-4", "C-6"],
    about: "Choir 'aah': five detuned voices through vowel formants (heliobane_stage11 choir); beats 1.1-2.2 Hz at C-5. Formants move with pitch.",
    play: "Slow swells in its range; outside it the vowel turns into a different color.",
  },
  // ------------------------------------------------------------ fx
  "fx.riser": {
    synth: { wave: "swell", shape: "rise", seconds: 2, from: 300, to: 7000, resonance: 0.55 },
    role: "fx", range: ["C-5", "C-5"],
    about: "Noise riser: a sweep up into the next downbeat. 2 s at C-5.",
    play: "Start it 2 s before a section; trigger lower/higher notes to stretch/shorten it.",
  },
  "fx.downwash": {
    synth: { wave: "swell", shape: "fall", seconds: 2.4, from: 6000, to: 250, resonance: 0.5 },
    role: "fx", range: ["C-5", "C-5"],
    about: "Noise downwash: a falling sweep after an impact or into a breakdown. 2.4 s.",
    play: "On a section's first row with a crash or alone; keep it out from under the lead's entry.",
  },
};
