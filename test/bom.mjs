import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { utf8fromString } from "@exodus/bytes/utf8.js";
import { utf16fromString } from "@exodus/bytes/utf16.js";

import htmlEncodingSniffer from "../lib/html-encoding-sniffer.js";

const source = '<meta charset="ISO-8859-4"><p>©</p>';
const cases = [
  ["UTF-8", [0xef, 0xbb, 0xbf], utf8fromString(source)],
  ["UTF-16LE", [0xff, 0xfe], utf16fromString(source, "uint8-le")],
  ["UTF-16BE", [0xfe, 0xff], utf16fromString(source, "uint8-be")],
];

for (const xml of [false, true]) {
  describe(`BOM detection with xml: ${xml}`, () => {
    for (const [encoding, bom, content] of cases) {
      const input = new Uint8Array([...bom, ...content]);

      it(`detects ${encoding}`, () => {
        assert.equal(htmlEncodingSniffer(input, { xml }), encoding);
      });

      it(`uses ${encoding} before the transport and default encodings`, () => {
        assert.equal(
          htmlEncodingSniffer(input, {
            xml,
            transportLayerEncodingLabel: "windows-1252",
            defaultEncoding: xml ? "ISO-8859-1" : "UTF-16LE",
          }),
          encoding,
        );
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
    const input = new Uint8Array([0x00, 0x00, 0xfe, 0xff, 0x3c, 0x3f, 0x78, 0x6d, 0x6c]);
    assert.equal(htmlEncodingSniffer(input, { xml: true }), "UTF-8");
  });

  it("detects a UTF-32LE BOM as UTF-16LE because of the shared FF FE prefix", () => {
    const input = new Uint8Array([0xff, 0xfe, 0x00, 0x00, 0x3c, 0x3f, 0x78, 0x6d, 0x6c]);
    assert.equal(htmlEncodingSniffer(input, { xml: true }), "UTF-16LE");
  });

  it("ignores a UTF-32BE BOM and uses the transport encoding", () => {
    const input = new Uint8Array([0x00, 0x00, 0xfe, 0xff, 0x3c, 0x3f, 0x78, 0x6d, 0x6c]);
    assert.equal(
      htmlEncodingSniffer(input, {
        xml: true,
        transportLayerEncodingLabel: "KOI8-R",
      }),
      "KOI8-R",
    );
  });
});
