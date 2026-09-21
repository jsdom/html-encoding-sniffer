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
