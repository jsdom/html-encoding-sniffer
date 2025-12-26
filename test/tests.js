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
