/**
 * Minimal WAV reader: PCM 8/16/24/32-bit and float32, mono or stereo.
 * WAVE_FORMAT_EXTENSIBLE is supported for the PCM and IEEE float subformats.
 * Returns { samplerate, channels: [Float array, ...] } for itwriter.
 * Enough for AKWF single-cycles and typical CC0 sample packs.
 */

export function readWav(buffer) {
  const view = new DataView(buffer.buffer || buffer, buffer.byteOffset || 0, buffer.byteLength);
  const tag = (off) => String.fromCharCode(view.getUint8(off), view.getUint8(off + 1), view.getUint8(off + 2), view.getUint8(off + 3));

  if (view.byteLength < 12 || tag(0) !== "RIFF" || tag(8) !== "WAVE") throw new Error("Not a WAV file");
  const STREAMED = 0xffffffff; // size marker written by recorders that never seek back
  const riffSize = view.getUint32(4, true);
  const riffEnd = riffSize === STREAMED ? view.byteLength : riffSize + 8;
  if (riffEnd < 12 || riffEnd > view.byteLength) throw new Error("Truncated WAV RIFF container");

  let fmt = null;
  let dataOff = -1;
  let dataLen = 0;
  let streamedData = false;

  let off = 12;
  // Some tracker-exported packs have a stale RIFF size after adding metadata.
  // Keep accepting these files, while bounding every chunk by the actual input.
  while (off + 8 <= view.byteLength) {
    const id = tag(off);
    let size = view.getUint32(off + 4, true);
    if (off + 8 + size > view.byteLength) {
      if (id === "data" && size === STREAMED) { size = view.byteLength - off - 8; streamedData = true; } // runs to EOF
      else if (dataOff >= 0 && id !== "data") break; // damaged trailing metadata after complete audio
      else throw new Error(`Truncated WAV ${id} chunk`);
    }
    if (id === "fmt ") {
      if (size < 16) throw new Error("Truncated WAV fmt chunk");
      fmt = {
        format: view.getUint16(off + 8, true),
        numChannels: view.getUint16(off + 10, true),
        samplerate: view.getUint32(off + 12, true),
        blockAlign: view.getUint16(off + 20, true),
        bitsPerSample: view.getUint16(off + 22, true),
      };
      if (fmt.format === 0xfffe) {
        if (size < 40 || view.getUint16(off + 24, true) < 22) throw new Error("Truncated WAV extensible fmt chunk");
        // Standard format-tag GUID: {tag}-0000-0010-8000-00aa00389b71.
        // https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/ksmedia/ns-ksmedia-waveformatextensible
        const guidTail = [0, 0, 0x10, 0, 0x80, 0, 0, 0xaa, 0, 0x38, 0x9b, 0x71];
        const subformat = view.getUint32(off + 32, true);
        if (![1, 3].includes(subformat) || !guidTail.every((v, i) => view.getUint8(off + 36 + i) === v)) {
          throw new Error("Unsupported WAV extensible subformat");
        }
        fmt.format = subformat;
        const validBits = view.getUint16(off + 26, true);
        if (validBits > fmt.bitsPerSample || (fmt.format === 3 && validBits !== 0 && validBits !== 32)) {
          throw new Error("Invalid WAV valid bits per sample");
        }
      }
    } else if (id === "data") {
      dataOff = off + 8;
      dataLen = size;
    }
    off += 8 + size + (size & 1); // chunks are word-aligned
  }

  if (!fmt || dataOff < 0) throw new Error("Missing fmt/data chunk");
  if (![1, 3].includes(fmt.format)) throw new Error(`Unsupported WAV format code ${fmt.format}`);
  if (![1, 2].includes(fmt.numChannels)) throw new Error("WAV must have 1 or 2 channels");
  if (fmt.samplerate === 0) throw new Error("Invalid WAV sample rate");
  if (![8, 16, 24, 32].includes(fmt.bitsPerSample) || (fmt.format === 3 && fmt.bitsPerSample !== 32)) {
    throw new Error(`Unsupported WAV bit depth ${fmt.bitsPerSample} for format ${fmt.format}`);
  }

  const bytesPer = fmt.bitsPerSample / 8;
  const frameSize = bytesPer * fmt.numChannels;
  if (streamedData) dataLen -= dataLen % frameSize; // a stream may stop mid-frame
  if (fmt.blockAlign !== frameSize || dataLen % frameSize !== 0) throw new Error("Invalid WAV frame alignment");
  const frames = dataLen / frameSize;
  const channels = Array.from({ length: fmt.numChannels }, () => new Array(frames));

  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < fmt.numChannels; c++) {
      const p = dataOff + (i * fmt.numChannels + c) * bytesPer;
      let v;
      switch (fmt.bitsPerSample) {
        case 8: v = (view.getUint8(p) - 128) / 128; break;
        case 16: v = view.getInt16(p, true) / 32768; break;
        case 24: {
          let u = view.getUint8(p) | (view.getUint8(p + 1) << 8) | (view.getUint8(p + 2) << 16);
          if (u & 0x800000) u -= 0x1000000;
          v = u / 8388608;
          break;
        }
        case 32: v = fmt.format === 3 ? view.getFloat32(p, true) : view.getInt32(p, true) / 2147483648; break;
        default: throw new Error(`Unsupported bit depth ${fmt.bitsPerSample}`);
      }
      if (!Number.isFinite(v)) throw new Error("Non-finite WAV sample");
      channels[c][i] = v;
    }
  }

  return { samplerate: fmt.samplerate, channels };
}
