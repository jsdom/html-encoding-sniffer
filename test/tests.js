"use strict";
const { describe, it } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const htmlEncodingSniffer = require("..");

function read(relative) {
  // Test that the module works with Uint8Arrays, not just Buffers:
  const buffer = fs.readFileSync(path.resolve(__dirname, relative));
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}

for (const file of fs.readdirSync(path.resolve(__dirname, "fixtures/bom"))) {
  describe(file, () => {
    const buffer = read(`fixtures/bom/${file}`);
    const desiredEncoding = path.basename(file, ".html");

    it(`should sniff as ${desiredEncoding}, given no options`, () => {
      const sniffedEncoding = htmlEncodingSniffer(buffer);

      assert.strictEqual(sniffedEncoding, desiredEncoding);
    });

    it(`should sniff as ${desiredEncoding}, given overriding options`, () => {
      const sniffedEncoding = htmlEncodingSniffer(buffer, {
        transportLayerEncodingLabel: "windows-1252",
        defaultEncoding: "UTF-16LE"
      });

      assert.strictEqual(sniffedEncoding, desiredEncoding);
    });
  });
}

for (const file of fs.readdirSync(path.resolve(__dirname, "fixtures/normal"))) {
  describe(file, () => {
    const buffer = read(`fixtures/normal/${file}`);
    const desiredEncoding = path.basename(file, ".html").split("_")[1];

    it(`should sniff as ${desiredEncoding}, given no options`, () => {
      const sniffedEncoding = htmlEncodingSniffer(buffer);

      assert.strictEqual(sniffedEncoding, desiredEncoding);
    });

    it("should sniff as the transport layer encoding, given that", () => {
      const sniffedEncoding = htmlEncodingSniffer(buffer, {
        transportLayerEncodingLabel: "windows-1251",
        defaultEncoding: "ISO-8859-16"
      });

      assert.strictEqual(sniffedEncoding, "windows-1251");
    });


    it(`should sniff as ${desiredEncoding}, given only a default encoding`, () => {
      const sniffedEncoding = htmlEncodingSniffer(buffer, {
        defaultEncoding: "ISO-8859-16"
      });

      assert.strictEqual(sniffedEncoding, desiredEncoding);
    });
  });
}

for (const file of fs.readdirSync(path.resolve(__dirname, "fixtures/no-result"))) {
  describe(file, () => {
    const buffer = read(`fixtures/no-result/${file}`);
    const desiredEncoding = path.basename(file, ".html").split("_")[1];

    it(`should sniff as ${desiredEncoding}, given no options`, () => {
      const sniffedEncoding = htmlEncodingSniffer(buffer);

      assert.strictEqual(sniffedEncoding, desiredEncoding);
    });

    it("should sniff as the transport layer encoding, given that", () => {
      const sniffedEncoding = htmlEncodingSniffer(buffer, {
        transportLayerEncodingLabel: "windows-1251",
        defaultEncoding: "ISO-8859-16"
      });

      assert.strictEqual(sniffedEncoding, "windows-1251");
    });


    it("should sniff as the default encoding, given that", () => {
      const sniffedEncoding = htmlEncodingSniffer(buffer, {
        defaultEncoding: "ISO-8859-16"
      });

      assert.strictEqual(sniffedEncoding, "ISO-8859-16");
    });
  });
}

for (const file of fs.readdirSync(path.resolve(__dirname, "fixtures/utf"))) {
  describe(file, () => {
    const buffer = read(`fixtures/utf/${file}`);

    it("should sniff as UTF-8, given no options", () => {
      const sniffedEncoding = htmlEncodingSniffer(buffer);

      assert.strictEqual(sniffedEncoding, "UTF-8");
    });

    it("should sniff as the transport layer encoding, given that", () => {
      const sniffedEncoding = htmlEncodingSniffer(buffer, {
        transportLayerEncodingLabel: "windows-1251",
        defaultEncoding: "ISO-8859-16"
      });

      assert.strictEqual(sniffedEncoding, "windows-1251");
    });


    it("should sniff as UTF-8, given only a default encoding", () => {
      const sniffedEncoding = htmlEncodingSniffer(buffer, {
        defaultEncoding: "ISO-8859-16"
      });

      assert.strictEqual(sniffedEncoding, "UTF-8");
    });
  });
}

describe("xml: true", () => {
  describe("BOM detection", () => {
    for (const file of fs.readdirSync(path.resolve(__dirname, "fixtures/bom"))) {
      const buffer = read(`fixtures/bom/${file}`);
      const desiredEncoding = path.basename(file, ".html");

      it(`should sniff ${file} as ${desiredEncoding}`, () => {
        const sniffedEncoding = htmlEncodingSniffer(buffer, { xml: true });

        assert.strictEqual(sniffedEncoding, desiredEncoding);
      });

      it(`should sniff ${file} as ${desiredEncoding}, given overriding options`, () => {
        const sniffedEncoding = htmlEncodingSniffer(buffer, {
          xml: true,
          transportLayerEncodingLabel: "windows-1252",
          defaultEncoding: "ISO-8859-1"
        });

        assert.strictEqual(sniffedEncoding, desiredEncoding);
      });
    }
  });

  describe("UTF-32 BOMs (not recognized, should fall back to default)", () => {
    it("should ignore UTF-32BE BOM and return UTF-8", () => {
      // UTF-32BE BOM: 00 00 FE FF
      const buffer = new Uint8Array([0x00, 0x00, 0xFE, 0xFF, 0x3C, 0x3F, 0x78, 0x6D, 0x6C]);
      const sniffedEncoding = htmlEncodingSniffer(buffer, { xml: true });

      assert.strictEqual(sniffedEncoding, "UTF-8");
    });

    it("should detect UTF-32LE BOM as UTF-16LE (since FF FE prefix matches)", () => {
      // UTF-32LE BOM: FF FE 00 00 — but FF FE is also UTF-16LE BOM
      const buffer = new Uint8Array([0xFF, 0xFE, 0x00, 0x00, 0x3C, 0x3F, 0x78, 0x6D, 0x6C]);
      const sniffedEncoding = htmlEncodingSniffer(buffer, { xml: true });

      assert.strictEqual(sniffedEncoding, "UTF-16LE");
    });

    it("should ignore UTF-32BE BOM and use transport layer encoding if provided", () => {
      const buffer = new Uint8Array([0x00, 0x00, 0xFE, 0xFF, 0x3C, 0x3F, 0x78, 0x6D, 0x6C]);
      const sniffedEncoding = htmlEncodingSniffer(buffer, {
        xml: true,
        transportLayerEncodingLabel: "KOI8-R"
      });

      assert.strictEqual(sniffedEncoding, "KOI8-R");
    });
  });

  describe("meta charset ignored", () => {
    it("should ignore meta charset and return UTF-8 default", () => {
      const buffer = read("fixtures/normal/charset_KOI8-R.html");
      const sniffedEncoding = htmlEncodingSniffer(buffer, { xml: true });

      assert.strictEqual(sniffedEncoding, "UTF-8");
    });

    it("should ignore meta charset but use transport layer encoding", () => {
      const buffer = read("fixtures/normal/charset_KOI8-R.html");
      const sniffedEncoding = htmlEncodingSniffer(buffer, {
        xml: true,
        transportLayerEncodingLabel: "ISO-8859-2"
      });

      assert.strictEqual(sniffedEncoding, "ISO-8859-2");
    });

    it("should ignore meta charset but use custom default encoding", () => {
      const buffer = read("fixtures/normal/charset_KOI8-R.html");
      const sniffedEncoding = htmlEncodingSniffer(buffer, {
        xml: true,
        defaultEncoding: "windows-1252"
      });

      assert.strictEqual(sniffedEncoding, "windows-1252");
    });
  });

  describe("default encoding", () => {
    it("should default to UTF-8 for XML", () => {
      const buffer = read("fixtures/no-result/no-indicators_windows-1252.html");
      const sniffedEncoding = htmlEncodingSniffer(buffer, { xml: true });

      assert.strictEqual(sniffedEncoding, "UTF-8");
    });

    it("should allow overriding the default encoding", () => {
      const buffer = read("fixtures/no-result/no-indicators_windows-1252.html");
      const sniffedEncoding = htmlEncodingSniffer(buffer, {
        xml: true,
        defaultEncoding: "ISO-8859-1"
      });

      assert.strictEqual(sniffedEncoding, "ISO-8859-1");
    });
  });
});
