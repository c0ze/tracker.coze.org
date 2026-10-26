/**
 * Converts JSON struture to an Impulse Tracker module file.
 * @param {Array} struct - see below
 * @returns {ArrayBuffer} containing the impulse tracker data to be downloaded or written to disk.
 * @note See exampe.js for details of the JSON datastructure specification.

// VENDORED from https://github.com/chr15m/itwriter (MIT) with local additions:
// - sample.loop {start, end, pingpong} / sample.susloop -> IT loop flags + points
// - sample.volume (0-64) -> default sample volume
// - sample.c5speed -> C5Speed override (needed for single-cycle waveforms)

// TODO:
// - sample global volume
// - channel pan & volume settings
// - support impulse tracker instruments
//
// DONE:
// - support embedded message
// - implement pattern names
// - implement channel names
// - encode stereo samples
// - support multiple samples
// - use sample's actual samplerate
// - implement bpm + ticks from structure
// - insert pattern sequence data from structure
// - multiple patterns
// - order patterns correctly

 */

function itwriter(struct) {
  const order = (struct.order || []);
  const patterns = (struct.patterns || []);
  const OrdNum = order.length + 1;
  const InsNum = 0;
  const SmpNum = struct.samples.length;

  const patternBuffers = patterns.map((pattern) => serializePattern(pattern));
  const PatNum = patterns.length;

  // calculate pattern and channel names and sizes
  const patternnames = patterns.map((pattern) => text(pattern.name, 32));
  const PNAMSize = patternnames.length ? ("PNAM".length + 4 + patternnames.length * 32) : 0;
  const channelnamecount = struct.channelnames ? Math.max(-1, ...Object.keys(struct.channelnames).map(Number).filter(Number.isInteger)) : -1;
  const channelnames = [...(new Array(channelnamecount + 1))].map((x, i)=>text(struct.channelnames[i], 20));
  const CNAMSize = channelnames.length ? ("CNAM".length + 4 + channelnames.length * 20) : 0;
  // optional message embedding
  // IT stores 8-bit text with CR line breaks.
  const message = struct.message ? toAscii(struct.message).replace(/\r?\n/g, "\r") : "";
  const MSGSize = message ? message.length + 1 : 0;
  // Calculate output file size
  // Calculate the headerSize of the impulse tracker file
  // Initial part of header is always 0xC0 / 192 bytes
  const headerSize = 0xC0 + OrdNum + (InsNum * 4) + (SmpNum * 4) + (PatNum * 4) + PNAMSize + CNAMSize + MSGSize;
  const sampleHeaderSize  = 0x50 * SmpNum;
  const patternsSize = patternBuffers.reduce((size, buffer) => size + buffer.byteLength, 0);

  // Convert AudioBuffers to the channels layout
  struct.samples.forEach((sample) => {
    if (sample.buffer) {
      sample.samplerate = sample.buffer.sampleRate;
      sample.channels = [...(new Array(sample.buffer.numberOfChannels))].map((_, c)=>sample.buffer.getChannelData(c));
    }
  });

  const [ _lastSampleOffset, sampleHeaderBuffers ] = struct.samples.reduce((collection, sample) => {
    const [ sampleOffset, buffers ] = collection;
    const buffer = serializeSampleHeader(sample, sampleOffset);
    return [
      sampleOffset + sample.channels[0].length * 2 /* 16 bit */ * sample.channels.length,
      buffers.concat([buffer])
    ];
  }, [headerSize + sampleHeaderSize + patternsSize, []]);
  const sampleDataSize = (struct.samples.reduce((size, sample) => size + sample.channels[0].length * 2 /* 16 bit */ * sample.channels.length, 0));
  const fileSize = headerSize + sampleHeaderSize + patternsSize + sampleDataSize;

  // Output buffer/data view
  const buffer = new ArrayBuffer(fileSize);
  const data   = new DataView(buffer);
  let offset = 0;

  // Magic number
  writeString(data, offset, "IMPM");
  offset += 4;

  // Song title
  writeString(data, offset, text(struct.title, 26));
  offset += 26;

  // PHiligt - pattern row hilight information
  data.setUint8(offset, 0x04);
  offset += 1;
  data.setUint8(offset, 0x10);
  offset += 1;

  // OrdNum - number of orders in song
  data.setUint16(offset, OrdNum, true);
  offset += 2;

  // InsNum - number of instruments in song
  data.setUint16(offset, InsNum, true);
  offset += 2;

  // SmpNum - number of samples in song
  data.setUint16(offset, SmpNum, true);
  offset += 2;

  // PatNum - number of patterns in song
  data.setUint16(offset, PatNum, true);
  offset += 2;

  // Cwt/v - created with tracker
  // https://wiki.openmpt.org/Development:_Formats/IT#Tracker_IDs
  // 0x1402 is Impulse Tracker
  data.setUint16(offset, struct.tracker_id || 0xD1CE, true);
  offset += 2;

  // Cmwt - compatible with tracker with version greater than value
  data.setUint16(offset, 0x0214, true);
  offset += 2;

  // Flags (set to default from OpenMPT)
  data.setUint16(offset, 0x0049, true);
  offset += 2;

  // Special: bit 0 message attached, bit 2 row highlights. Bit 1 would promise
  // an edit-history block after the parapointers, which is not written.
  data.setUint16(offset, 0x0004 | (message ? 0x0001 : 0x0000), true);
  offset += 2;

  // GV - global volume
  data.setUint8(offset, 0x80);
  offset++;

  // MV - mix volume
  data.setUint8(offset, (struct.mixvol ?? 48));
  offset++;

  // IS - initial speed of song - ticks per row
  data.setUint8(offset, (struct.ticks || 6));
  offset++;

  // IT - initial tempo / BPM of song
  data.setUint8(offset, (struct.bpm || 120));
  offset++;

  // Sep - panning separation between channels
  data.setUint8(offset, 0x80);
  offset++;

  // PWD - pitch wheel depth for MIDI controllers
  data.setUint8(offset, 0x00);
  offset++;

  // MsgLgth / message offset / reserved
  data.setUint16(offset, MSGSize, true);
  offset += 2;
  
  // MsgOffset
  data.setUint32(offset, message ? headerSize - MSGSize: 0, true);
  offset += 4;

  // Reserved (OpenMPT writes "OMPT" here for interpreted modplug file)
  // writeString(data, offset, "OMPT");
  offset += 4;

  // Channel initial pan
  // 0  = hard left
  // 32 = centre
  // 64 = hard right
  // 0xA0 = mute
  for (let i = 0; i < 64; i++) {
    data.setUint8(offset, 0x20);
    offset++;
  }

  // Channel initial vol
  for (let i = 0; i < 64; i++) {
    data.setUint8(offset, 0x40);
    offset++;
  }

  // Orders - order in which the patterns are played
  for (let o = 0; o < order.length; o++) {
    data.setUint8(offset, order[o]);
    offset += 1;
  }
  data.setUint8(offset, 0xFF); // "---", end of song marker
  offset += 1;

  // Instruments offset
  // no instruments, using samples only

  // Samples offset
  // 0x50 = Impulse Sample header size
  for (let i = 0; i < SmpNum; i++) {
    data.setUint32(offset, headerSize + (i * 0x50), true);
    offset += 4;
  }

  // Patterns offset
  for (let i = 0; i < PatNum; i++) {
    let patternOffset = 0;
    for (let o = 0; o < i; o++) {
      patternOffset += patternBuffers[o].byteLength;
    }
    data.setUint32(offset, headerSize + (SmpNum * 0x50) + patternOffset, true);
    offset += 4;
  }

  // PNAM section
  if (patternnames.length) {
    writeString(data, offset, "PNAM");
    offset += 4;
    data.setUint32(offset, patternnames.length * 32, true);
    offset += 4;
    for (let i = 0; i < patternnames.length; i++) {
      writeString(data, offset, patternnames[i]);
      offset += 32;
    }
  }

  // CNAM section
  if (channelnames.length) {
    writeString(data, offset, "CNAM");
    offset += 4;
    data.setUint32(offset, channelnames.length * 20, true);
    offset += 4;
    for (let i = 0; i < channelnames.length; i++) {
      writeString(data, offset, channelnames[i]);
      offset += 20;
    }
  }
  
  // Write message data
  if (message) {
    writeString(data, offset, message);
    offset += MSGSize;
  }

  // Sample headers
  for (let s = 0; s < sampleHeaderBuffers.length; s++) {
    insertData(data, sampleHeaderBuffers[s], offset);
    offset += sampleHeaderBuffers[s].byteLength;
  }

  // Pattern data
  for (let p = 0; p < patternBuffers.length; p++) {
    insertData(data, patternBuffers[p], offset);
    offset += patternBuffers[p].byteLength;
  }

  // Sample data
  for (let s = 0; s < SmpNum; s++) {
    const wavData = floatChannelsTo16bit(struct.samples[s].channels);
    for (let c = 0; c < wavData.length; c++) {
      insertData(data, wavData[c], offset);
      offset += wavData[c].byteLength;
    }
  }

  return data.buffer;
}

function serializeSampleHeader(sample, previousOffset) {
  const buffer = new ArrayBuffer(0x50);
  const data = new DataView(buffer);
  const bitDepth = 16;
  let offset = 0;

  writeString(data, offset, "IMPS");
  offset += 4;

  // DOS filename
  writeString(data, offset, text(sample.filename || sample.name, 12));
  offset += 12;

  // Always null
  offset++;

  // GvL - global volume for instrument
  data.setUint8(offset, 0x40);
  offset++;

  // Flg
  // bit 0 = sample associated with this header
  // bit 1 on = 16-bit; off = 8-bit
  // bit 2 on = stereo; off = mono
  // bit 4 on = use loop; bit 5 on = use sustain loop
  // bit 6 on = pingpong loop; bit 7 on = pingpong sustain loop
  const flagBitDepth = (bitDepth === 16 ? 0x02 : 0x00);
  const flagStereo = (sample.channels.length === 2 ? 0x04 : 0x00);
  const flagLoop = (sample.loop ? 0x10 : 0x00);
  const flagSusLoop = (sample.susloop ? 0x20 : 0x00);
  const flagPingpong = (sample.loop && sample.loop.pingpong ? 0x40 : 0x00);
  const flagSusPingpong = (sample.susloop && sample.susloop.pingpong ? 0x80 : 0x00);
  data.setUint8(offset, 0x01 | flagBitDepth | flagStereo | flagLoop | flagSusLoop | flagPingpong | flagSusPingpong);
  offset++;

  // Vol - default volume for instrument (0-64)
  data.setUint8(offset, sample.volume === undefined ? 0x40 : sample.volume);
  offset++;

  // Skip sample name
  writeString(data, offset, text(sample.name || sample.filename, 26));
  offset += 26;

  // Cvt / convert (bitmask; bit 1 on = signed samples; off = unsigned)
  // IT 2.02 and above use signed samples
  // OpenMPT appears to automatically convert 8-bit unsigned audio to signed
  data.setUint8(offset, 0x01);
  offset++;

  // DfP / default pan
  data.setUint8(offset, 0x20);
  offset++;

  // Length - length of sample in no. of samples (not bytes)
  data.setUint32(offset, sample.channels[0].length, true);
  offset += 4;

  // Loop Begin - start of loop (no of samples in, not bytes)
  data.setUint32(offset, sample.loop ? (sample.loop.start || 0) : 0, true);
  offset += 4;

  // Loop End - sample no. AFTER end of loop
  data.setUint32(offset, sample.loop ? (sample.loop.end === undefined ? sample.channels[0].length : sample.loop.end) : 0, true);
  offset += 4;

  // C5Speed - number of samples a second for C-5 (ranges from 0->9999999)
  data.setUint32(offset, sample.c5speed || sample.samplerate, true);
  offset += 4;

  // SusLoop Begin - start of sustain loop
  data.setUint32(offset, sample.susloop ? (sample.susloop.start || 0) : 0, true);
  offset += 4;

  // SusLoop End - sample no. AFTER end of sustain loop
  data.setUint32(offset, sample.susloop ? (sample.susloop.end === undefined ? sample.channels[0].length : sample.susloop.end) : 0, true);
  offset += 4;

  // SamplePointer - offset of sample in file (the WAV data)
  data.setUint32(offset, previousOffset, true);
  offset += 4;

  // ViS - vibrato speed
  // ViD - vibrato depth
  // ViR - vibrato waveform type
  // ViT - vibrato rate, rate at which vibrato is applied
  // ignored
  offset += 4;

  return data.buffer;
}

function serializePattern(pattern) {
  const rows = pattern.rows;
  const channels = pattern.channels.length;

  const result = [];

  // Length and Rows - placeholder for now
  result.push(0, 0, rows & 0xFF, (rows >> 8) & 0xFF);

  // Blank space
  result.push(0, 0, 0, 0);

  for (let row = 0; row < rows; row++) {
    for (let channel = 0; channel < channels; channel++) {
      if (pattern.channels[channel][row] !== undefined) {
        let channelData = pattern.channels[channel][row];
        let maskVariable = 0;
        if (channelData.note) maskVariable |= 1;
        if (channelData.instrument != null) maskVariable |= 2;
        if (channelData.vol) maskVariable |= 4;
        if (channelData.fx) maskVariable |= 8;

        // Channel marker and mask variable
        result.push(0x81 + channel);
        result.push(maskVariable);

        if (maskVariable & 1) {
          result.push(noteToValue(channelData.note));
        }

        if (maskVariable & 2) {
          result.push(channelData.instrument + 1);
        }

        if (maskVariable & 4) {
          result.push(volToValue(channelData.vol));
        }

        if (maskVariable & 8) {
          let fx = channelData.fx;
          let fxChar = fx.charCodeAt(0) - 64; // Convert 'A'-'Z' to 1-26
          let fxVal = parseInt(fx.slice(1), 16);
          result.push(fxChar);
          result.push(fxVal);
        }
      }
    }
    result.push(0); // End of row
  }

  // Convert to ArrayBuffer
  let length = result.length - 8; // Packed pattern length, excluding the 8 byte header
  result[0] = length & 0xFF;
  result[1] = (length >> 8) & 0xFF;

  const buffer = new ArrayBuffer(result.length);
  const dataView = new DataView(buffer);

  for (let i = 0; i < result.length; i++) {
    dataView.setUint8(i, result[i]);
  }

  return buffer;
}

/*** utility functions ***/

function noteToValue(note) {
  if (note === '==') return 255;
  if (note === '^^') return 254;
  const notes = ['C-', 'C#', 'D-', 'D#', 'E-', 'F-', 'F#', 'G-', 'G#', 'A-', 'A#', 'B-'];
  const octave = parseInt(note[2]);
  const noteIdx = notes.indexOf(note.slice(0, 2));
  return noteIdx + octave * 12;
}

function volToValue(vol) {
  const volType = vol[0];
  const volVal = parseInt(vol.slice(1));
  switch (volType) {
    case 'v': return volVal;                // Volume set
    case 'p': return 128 + volVal;          // Panning set
    case 'a': return 65 + volVal;           // Fine volume slide up
    case 'b': return 75 + volVal;           // Fine volume slide down
    case 'c': return 85 + volVal;           // Volume slide up
    case 'd': return 95 + volVal;           // Volume slide down
    case 'e': return 105 + volVal;          // Portamento down
    case 'f': return 115 + volVal;          // Portamento up
    case 'g': return 193 + volVal;          // Tone portamento
    case 'h': return 203 + volVal;          // Vibrato depth
    default: return 0;                      // Default case if not recognized
  }
}

function insertData(data, incoming, offset) {
  const view = new Uint8Array(data.buffer);
  view.set(new Uint8Array(incoming), offset);
}

function floatChannelsTo16bit(channels) {
  return channels.map((channel) => {
    const int16Array = new Int16Array(channel.length);
    channel.map((sample, i) => {
      const s = Math.max(-1, Math.min(1, sample));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    });
    int16Array.buffer.sampleLength = channel.length;
    return int16Array.buffer;
  });
}

// IT text fields are single-byte; transliterate common Unicode punctuation
// before truncating so a wide character cannot spill into the next field.
const ASCII = { "→": "->", "←": "<-", "—": "-", "–": "-", "‘": "'", "’": "'", "“": '"', "”": '"', "…": "...", "·": ".", "×": "x", "♪": "~", "♯": "#", "♭": "b" };
function toAscii(value) {
  return String(value ?? "").replace(/[^\x00-\x7f]/g, (c) => ASCII[c] ??
    (c.normalize("NFKD").replace(/[^\x20-\x7e]/g, "") || "?"));
}
function text(value, length) {
  return toAscii(value).slice(0, length);
}

function writeString(view, offset, string) {
  for (var i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

// exports etc.

// If we're in the browser attach to the window as a top level var
if (typeof window !== 'undefined') {
  window.itwriter = itwriter;
}

export default itwriter;
