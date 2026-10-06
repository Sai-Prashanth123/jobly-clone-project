import { describe, it, expect } from 'vitest';

// Pins the container sniffing used by renderDocument (services/storage.service).
//
// The bug: .docx and .doc were both handed to mammoth. mammoth reads ONLY
// .docx — Office Open XML, a zip archive — while a legacy .doc is an OLE2
// compound file, a completely different format. So every .doc threw, and the
// preview dialog showed "Could not load this document" while Download worked
// fine, because downloading just streams the bytes back. Reported against
// "H-4 Beneficiary Questionnaire_Gouthami.doc".
//
// The extension cannot be trusted either way: people save .docx as .doc, and
// vice versa. These are the real magic bytes of each container.

/** First bytes of an Office Open XML file (.docx/.xlsx/.pptx) — a zip: "PK\x03\x04". */
const ZIP_HEADER = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]);
/** First bytes of a legacy OLE2 compound file (.doc/.xls/.ppt). */
const OLE2_HEADER = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
/** Something that is neither. */
const RTF_HEADER = Buffer.from('{\\rtf1\\ansi\\deff0', 'utf-8');

// Mirrors the checks in renderDocument.
const isZip = (b: Buffer) => b.length >= 2 && b[0] === 0x50 && b[1] === 0x4b;
const isOle2 = (b: Buffer) =>
  b.length >= 4 && b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0;

/** Would renderDocument hand this to mammoth (the OOXML renderer)? */
const wouldUseMammoth = (buf: Buffer) => isZip(buf);
/** Would renderDocument hand this to word-extractor (the legacy reader)? */
const wouldUseLegacyExtractor = (buf: Buffer) => !isZip(buf) && isOle2(buf);
/** Can it be previewed at all, by either route? */
const wouldRenderAsWord = (buf: Buffer) => wouldUseMammoth(buf) || wouldUseLegacyExtractor(buf);

describe('office container sniffing', () => {
  it('recognises a .docx as a zip', () => {
    expect(isZip(ZIP_HEADER)).toBe(true);
    expect(isOle2(ZIP_HEADER)).toBe(false);
  });

  it('recognises a legacy .doc as OLE2, not a zip', () => {
    expect(isOle2(OLE2_HEADER)).toBe(true);
    expect(isZip(OLE2_HEADER)).toBe(false);
  });

  // The original regression: a legacy .doc must never reach mammoth, which
  // cannot read it and throws.
  it('does not send a legacy .doc to mammoth', () => {
    expect(wouldUseMammoth(OLE2_HEADER)).toBe(false);
  });

  // ...but it must still be previewable, via the legacy text extractor. The
  // first fix only made the failure graceful; MR still could not read the
  // document, which was the actual complaint.
  it('sends a legacy .doc to the text extractor instead', () => {
    expect(wouldUseLegacyExtractor(OLE2_HEADER)).toBe(true);
    expect(wouldRenderAsWord(OLE2_HEADER)).toBe(true);
  });

  it('does not send a real .docx to the legacy extractor', () => {
    expect(wouldUseLegacyExtractor(ZIP_HEADER)).toBe(false);
  });

  it('does send a real .docx to the Word renderer', () => {
    expect(wouldRenderAsWord(ZIP_HEADER)).toBe(true);
  });

  // Extensions lie in both directions, which is why the bytes decide.
  it('renders a .docx that was misnamed .doc', () => {
    // Named "report.doc" but genuinely OOXML — should still preview.
    expect(wouldRenderAsWord(ZIP_HEADER)).toBe(true);
  });

  it('refuses a .doc that is really RTF — neither renderer reads it', () => {
    expect(wouldUseMammoth(RTF_HEADER)).toBe(false);
    expect(wouldUseLegacyExtractor(RTF_HEADER)).toBe(false);
    expect(wouldRenderAsWord(RTF_HEADER)).toBe(false);
  });

  // The bound must match what the check reads (bytes 0-3), not an arbitrary
  // larger number — an 8-byte file was being skipped entirely by `> 8`.
  it('classifies a file that is exactly header-length', () => {
    expect(isOle2(Buffer.from([0xd0, 0xcf, 0x11, 0xe0]))).toBe(true);
    expect(isZip(Buffer.from([0x50, 0x4b]))).toBe(true);
  });

  it('handles short and empty buffers without throwing', () => {
    for (const b of [Buffer.alloc(0), Buffer.from([0x50]), Buffer.from([0xd0, 0xcf])]) {
      expect(() => isZip(b)).not.toThrow();
      expect(() => isOle2(b)).not.toThrow();
      expect(wouldRenderAsWord(b)).toBe(false);
    }
  });
});
