const PACKET_SIZE = 188;
const HEADER_SIZE = 4;
const SYNC_BYTE = 0x47;
const PID_OFFSET = 1;
const FLAGS_OFFSET = 3;
const PAT_PID = 0;
const PMT_PID = 0x1000;
const AVC_TYPE = 0x1b;
const AAC_TYPE = 0x0f;
const VIDEO_PID = 0x100;
const AUDIO_PID = 0x101;
const PSI_HEADER_SIZE = 3;
const PMT_HEADER_SIZE = 12;
const TRACK_HEADER_SIZE = 5;
const CRC_SIZE = 4;
const CRC_POLYNOMIAL = 0x04c11db7;
const SECTION_LENGTH_OFFSET = 1;
const SECTION_PCR_OFFSET = 8;
const SECTION_INFO_OFFSET = 10;
const PAT_PROGRAM_OFFSET = 8;
const PAT_PMT_OFFSET = 10;
const PAT_SECTION_LENGTH = 13;
const MIN_SECTION_SIZE = 16;
const TRACK_PID_OFFSET = 1;
const TRACK_INFO_OFFSET = 3;

function readPid(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] & 0x1f) << 8) | bytes[offset + 1];
}

function writePid(bytes: Uint8Array, offset: number, pid: number): void {
  bytes[offset] = (bytes[offset] & 0xe0) | (pid >> 8);
  bytes[offset + 1] = pid & 0xff;
}

function readLength(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] & 0x0f) << 8) | bytes[offset + 1];
}

function mpegCrc32(bytes: Uint8Array, start: number, end: number): number {
  let crc = 0xffffffff;
  for (let index = start; index < end; index++) {
    crc ^= bytes[index] << 24;
    for (let bit = 0; bit < 8; bit++) {
      crc = ((crc << 1) ^ (crc & 0x80000000 ? CRC_POLYNOMIAL : 0)) >>> 0;
    }
  }
  return crc;
}

interface Packet {
  pid: number;
  adaptation: number;
  payload: number;
  payloadStart: boolean;
  end: number;
}
interface Section {
  start: number;
  end: number;
  length: number;
}

function readPacket(bytes: Uint8Array, offset: number): Packet {
  if (bytes[offset] !== SYNC_BYTE) {
    throw new Error('Invalid video transport stream sync byte.');
  }
  if (bytes[offset + PID_OFFSET] & 0x80 || bytes[offset + FLAGS_OFFSET] & 0xc0) {
    throw new Error('Invalid encrypted or errored video packet.');
  }
  const pid = readPid(bytes, offset + PID_OFFSET);
  const adaptation = (bytes[offset + FLAGS_OFFSET] >> 4) & 3;
  if (adaptation === 0) {
    throw new Error('Invalid video adaptation control.');
  }
  const payload = offset + HEADER_SIZE + (adaptation & 2 ? 1 + bytes[offset + HEADER_SIZE] : 0);
  if (payload > offset + PACKET_SIZE || (adaptation & 1 && payload === offset + PACKET_SIZE)) {
    throw new Error('Invalid video adaptation field length.');
  }
  return {
    pid,
    adaptation,
    payload,
    payloadStart: Boolean(bytes[offset + PID_OFFSET] & 0x40),
    end: offset + PACKET_SIZE,
  };
}

function readSection(bytes: Uint8Array, packet: Packet): Section {
  const { pid, adaptation, payload } = packet;
  if (!(adaptation & 1)) {
    throw new Error('Invalid video PSI payload.');
  }
  const section = payload + 1 + bytes[payload];
  if (section + PMT_HEADER_SIZE > packet.end || bytes[section] !== (pid === PAT_PID ? 0 : 0x02)) {
    throw new Error('Invalid video PMT section.');
  }
  const sectionLength = readLength(bytes, section + SECTION_LENGTH_OFFSET);
  const end = section + PSI_HEADER_SIZE + sectionLength;
  // Native two-track PMTs fit one packet. Fail rather than corrupt an unexpected split section.
  if (end > packet.end || end < section + MIN_SECTION_SIZE) {
    throw new Error('Unsupported video PMT size.');
  }
  if (mpegCrc32(bytes, section, end) !== 0) {
    throw new Error('Invalid video PSI CRC.');
  }
  return { start: section, end, length: sectionLength };
}

function checkPat(bytes: Uint8Array, section: number, sectionLength: number): void {
  if (
    sectionLength !== PAT_SECTION_LENGTH ||
    bytes[section + PAT_PROGRAM_OFFSET] !== 0 ||
    bytes[section + PAT_PROGRAM_OFFSET + 1] !== 1 ||
    readPid(bytes, section + PAT_PMT_OFFSET) !== PMT_PID
  ) {
    throw new Error('Unexpected video PAT program mapping.');
  }
}

function normalizePmt(bytes: Uint8Array, section: number, end: number, pidMap: Map<number, number>): void {
  const entriesEnd = end - CRC_SIZE;
  let entry = section + PMT_HEADER_SIZE + readLength(bytes, section + SECTION_INFO_OFFSET);
  while (entry < entriesEnd) {
    if (entry + TRACK_HEADER_SIZE > entriesEnd) {
      throw new Error('Invalid video PMT track entry.');
    }
    const streamType = bytes[entry];
    const sourcePid = readPid(bytes, entry + TRACK_PID_OFFSET);
    const targetPid = streamType === AVC_TYPE ? VIDEO_PID : streamType === AAC_TYPE ? AUDIO_PID : undefined;
    if (targetPid === undefined) {
      throw new Error('Unexpected video transport stream codec.');
    }
    const previous = pidMap.get(sourcePid);
    if (previous !== undefined && previous !== targetPid) {
      throw new Error('Inconsistent video transport stream PID.');
    }
    pidMap.set(sourcePid, targetPid);
    writePid(bytes, entry + TRACK_PID_OFFSET, targetPid);
    entry += TRACK_HEADER_SIZE + readLength(bytes, entry + TRACK_INFO_OFFSET);
  }
  if (entry !== entriesEnd) {
    throw new Error('Invalid video PMT descriptor length.');
  }
  const pcrPid = readPid(bytes, section + SECTION_PCR_OFFSET);
  const mappedPcrPid = pidMap.get(pcrPid);
  if (mappedPcrPid !== undefined) {
    writePid(bytes, section + SECTION_PCR_OFFSET, mappedPcrPid);
  }
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).setUint32(
    entriesEnd,
    mpegCrc32(bytes, section, entriesEnd),
  );
}

/** Normalize Mediabunny 1.55.1's per-segment PID allocation, including audio-only encoder tails. */
export function normalizeVideoTransportStream(buffer: ArrayBuffer): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(buffer);
  if (!bytes.length || bytes.length % PACKET_SIZE !== 0) {
    throw new Error('Invalid video transport stream packet length.');
  }
  const pidMap = new Map<number, number>();
  let foundPat = false;
  let foundPmt = false;
  for (let offset = 0; offset < bytes.length; offset += PACKET_SIZE) {
    const packet = readPacket(bytes, offset);
    if ((packet.pid !== PAT_PID && packet.pid !== PMT_PID) || !packet.payloadStart) {
      continue;
    }
    const section = readSection(bytes, packet);
    if (packet.pid === PAT_PID) {
      checkPat(bytes, section.start, section.length);
      foundPat = true;
    } else {
      normalizePmt(bytes, section.start, section.end, pidMap);
      foundPmt = true;
    }
  }
  if (!foundPat || !foundPmt) {
    throw new Error('Video transport stream is missing its PAT or PMT.');
  }
  for (let offset = 0; offset < bytes.length; offset += PACKET_SIZE) {
    const pid = readPid(bytes, offset + PID_OFFSET);
    const mappedPid = pidMap.get(pid);
    if (mappedPid !== undefined) {
      writePid(bytes, offset + PID_OFFSET, mappedPid);
    }
  }
  return bytes;
}
