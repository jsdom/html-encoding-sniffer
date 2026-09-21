import { describe, it } from "node:test";
import assert from "node:assert/strict";
import htmlEncodingSniffer from "../lib/html-encoding-sniffer.js";

describe("XML ignores meta declarations", () => {
  const input = Uint8Array.from('<meta charset="koi8">', c => c.charCodeAt(0));

  it("defaults to UTF-8", () => {
    assert.equal(htmlEncodingSniffer(input, { xml: true }), "UTF-8");
  });

  it("uses the transport encoding when provided", () => {
    assert.equal(htmlEncodingSniffer(input, {
      xml: true,
      transportLayerEncodingLabel: "ISO-8859-2"
    }), "ISO-8859-2");
  });

  it("uses a custom default encoding", () => {
    assert.equal(htmlEncodingSniffer(input, {
      xml: true,
      defaultEncoding: "windows-1252"
    }), "windows-1252");
  });
});

describe("XML default encoding", () => {
  const source = `<script src="script-utf8.js" charset="UTF-8"></script>
                  <script src="script-iso88591.js" charset="ISO-8859-1"></script>
                  <p>\xA9</p>`;
  const input = Uint8Array.from(source, c => c.charCodeAt(0));

  it("defaults to UTF-8", () => {
    assert.equal(htmlEncodingSniffer(input, { xml: true }), "UTF-8");
  });

  it("uses a custom default encoding", () => {
    assert.equal(htmlEncodingSniffer(input, {
      xml: true,
      defaultEncoding: "ISO-8859-1"
    }), "ISO-8859-1");
  });
});

describe("XML rejects maxPrescanBytes", () => {
  const input = Uint8Array.from('<?xml encoding="windows-1251"?>', c => c.charCodeAt(0));

  for (const maxPrescanBytes of [0, 1024, Infinity, -1, NaN, null, "1024"]) {
    it(`throws a TypeError for maxPrescanBytes: ${maxPrescanBytes}`, () => {
      assert.throws(() => htmlEncodingSniffer(input, { xml: true, maxPrescanBytes }), TypeError);
    });
  }

  it("treats undefined as an omitted option", () => {
    assert.equal(htmlEncodingSniffer(input, { xml: true, maxPrescanBytes: undefined }), "windows-1251");
  });

  it("throws even when a BOM supplies the encoding", () => {
    const bomInput = new Uint8Array([0xEF, 0xBB, 0xBF, ...input]);
    assert.throws(() => htmlEncodingSniffer(bomInput, { xml: true, maxPrescanBytes: 1024 }), TypeError);
  });

  it("throws even when the transport layer supplies the encoding", () => {
    assert.throws(() => htmlEncodingSniffer(input, {
      xml: true,
      maxPrescanBytes: 1024,
      transportLayerEncodingLabel: "UTF-8"
    }), TypeError);
  });
});
