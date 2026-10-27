// Admission policy v1 for the hosted studio (spec §7). Bump `version` whenever a value changes:
// admission results record the version they were judged under.
export const POLICY = Object.freeze({
  version: 1,
  maxJsonBytes: 2_000_000, // UTF-8 bytes of JSON.stringify(song)
  maxPatterns: 128,
  maxChannels: 32,
  maxRows: 256, // per pattern
  maxSamples: 64,
  maxSampleBytes16: 8_388_608, // all sample data as 16-bit PCM: frames x channels x 2
  maxAudioSeconds: 360,
  maxRenderWallMs: 120_000,
  maxMemoryBytes: 1_000_000_000,
  renderRates: Object.freeze([22050, 44100, 48000]),
  maxTimelineRows: 16_384, // rows the order list plays
  maxAnalysisTicks: 500_000, // those rows x the largest speed
  maxAnalysisWork: 4_000_000, // those ticks x the channel count (clash checks grow with it)
  maxAnalysisWarnings: 1_000, // warnings past this are dropped (a limitation says so)
  maxSidBytes: 32_768, // a built .sid (enforced at build)
});
