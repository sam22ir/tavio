// Minimal ZIP writer using the "stored" method (no compression). Enough for OOXML packages.

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = (CRC_TABLE[(crc ^ (data[i] as number)) & 0xff] as number) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** MS-DOS date and time fields for the given instant (local to UTC, which is what the zip stores). */
function dosDateTime(d: Date): { time: number; date: number } {
  const year = Math.max(1980, d.getUTCFullYear());
  return {
    time: (d.getUTCHours() << 11) | (d.getUTCMinutes() << 5) | Math.floor(d.getUTCSeconds() / 2),
    date: ((year - 1980) << 9) | ((d.getUTCMonth() + 1) << 5) | d.getUTCDate(),
  };
}

/** Builds a zip archive with stored entries. Names are written as UTF-8 (general purpose flag bit 11). */
export function zipStored(entries: readonly ZipEntry[], now: Date = new Date()): Uint8Array {
  const encoder = new TextEncoder();
  const { time, date } = dosDateTime(now);
  const prepared = entries.map((e) => ({
    name: encoder.encode(e.name),
    data: e.data,
    crc: crc32(e.data),
  }));

  let localSize = 0;
  let centralSize = 0;
  for (const p of prepared) {
    localSize += 30 + p.name.length + p.data.length;
    centralSize += 46 + p.name.length;
  }
  const total = localSize + centralSize + 22;
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  const offsets: number[] = [];
  let pos = 0;

  for (const p of prepared) {
    offsets.push(pos);
    view.setUint32(pos, 0x04034b50, true);
    view.setUint16(pos + 4, 20, true);        // version needed
    view.setUint16(pos + 6, 0x0800, true);    // UTF-8 names
    view.setUint16(pos + 8, 0, true);         // method: stored
    view.setUint16(pos + 10, time, true);
    view.setUint16(pos + 12, date, true);
    view.setUint32(pos + 14, p.crc, true);
    view.setUint32(pos + 18, p.data.length, true);
    view.setUint32(pos + 22, p.data.length, true);
    view.setUint16(pos + 26, p.name.length, true);
    view.setUint16(pos + 28, 0, true);
    out.set(p.name, pos + 30);
    out.set(p.data, pos + 30 + p.name.length);
    pos += 30 + p.name.length + p.data.length;
  }

  const centralStart = pos;
  prepared.forEach((p, i) => {
    view.setUint32(pos, 0x02014b50, true);
    view.setUint16(pos + 4, 20, true);        // version made by
    view.setUint16(pos + 6, 20, true);        // version needed
    view.setUint16(pos + 8, 0x0800, true);
    view.setUint16(pos + 10, 0, true);
    view.setUint16(pos + 12, time, true);
    view.setUint16(pos + 14, date, true);
    view.setUint32(pos + 16, p.crc, true);
    view.setUint32(pos + 20, p.data.length, true);
    view.setUint32(pos + 24, p.data.length, true);
    view.setUint16(pos + 28, p.name.length, true);
    view.setUint16(pos + 30, 0, true);
    view.setUint16(pos + 32, 0, true);
    view.setUint16(pos + 34, 0, true);
    view.setUint16(pos + 36, 0, true);
    view.setUint32(pos + 38, 0, true);
    view.setUint32(pos + 42, offsets[i] as number, true);
    out.set(p.name, pos + 46);
    pos += 46 + p.name.length;
  });

  view.setUint32(pos, 0x06054b50, true);
  view.setUint16(pos + 4, 0, true);
  view.setUint16(pos + 6, 0, true);
  view.setUint16(pos + 8, prepared.length, true);
  view.setUint16(pos + 10, prepared.length, true);
  view.setUint32(pos + 12, pos - centralStart, true);
  view.setUint32(pos + 16, centralStart, true);
  view.setUint16(pos + 20, 0, true);
  return out;
}
