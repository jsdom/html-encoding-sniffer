import { describe, it } from "node:test";
import assert from "node:assert/strict";
import htmlEncodingSniffer from "../lib/html-encoding-sniffer.js";
import { utf16fromString } from "@exodus/bytes/utf16.js";
import { utf8fromString } from "@exodus/bytes/utf8.js";

const source = '<meta charset="ISO-8859-4"><p>©</p>';
const cases = [
  ["UTF-8", [0xEF, 0xBB, 0xBF], utf8fromString(source)],
  ["UTF-16LE", [0xFF, 0xFE], utf16fromString(source, "uint8-le")],
  ["UTF-16BE", [0xFE, 0xFF], utf16fromString(source, "uint8-be")]
];

for (const xml of [false, true]) {
  describe(`BOM detection with xml: ${xml}`, () => {
    for (const [encoding, bom, content] of cases) {
      const input = new Uint8Array([...bom, ...content]);

      it(`detects ${encoding}`, () => {
        assert.equal(htmlEncodingSniffer(input, { xml }), encoding);
      });

      it(`uses ${encoding} before the transport and default encodings`, () => {
        assert.equal(htmlEncodingSniffer(input, {
          xml,
          transportLayerEncodingLabel: "windows-1252",
          defaultEncoding: xml ? "ISO-8859-1" : "UTF-16LE"
        }), encoding);
      });
    }
  });
}

describe("HTML BOM detection with meta scanning disabled", () => {
  for (const [encoding, bom, content] of cases) {
    it(`detects ${encoding}`, () => {
      const input = new Uint8Array([...bom, ...content]);
      assert.equal(htmlEncodingSniffer(input, { maxPrescanBytes: 0 }), encoding);
    });
  }
});

describe("UTF-32 BOMs in XML", () => {
  it("ignores a UTF-32BE BOM and defaults to UTF-8", () => {
    const input = new Uint8Array([0x00, 0x00, 0xFE, 0xFF, 0x3C, 0x3F, 0x78, 0x6D, 0x6C]);
    assert.equal(htmlEncodingSniffer(input, { xml: true }), "UTF-8");
  });

  it("detects a UTF-32LE BOM as UTF-16LE because of the shared FF FE prefix", () => {
    const input = new Uint8Array([0xFF, 0xFE, 0x00, 0x00, 0x3C, 0x3F, 0x78, 0x6D, 0x6C]);
    assert.equal(htmlEncodingSniffer(input, { xml: true }), "UTF-16LE");
  });

  it("ignores a UTF-32BE BOM and uses the transport encoding", () => {
    const input = new Uint8Array([0x00, 0x00, 0xFE, 0xFF, 0x3C, 0x3F, 0x78, 0x6D, 0x6C]);
    assert.equal(htmlEncodingSniffer(input, {
      xml: true,
      transportLayerEncodingLabel: "KOI8-R"
    }), "KOI8-R");
  });
});
