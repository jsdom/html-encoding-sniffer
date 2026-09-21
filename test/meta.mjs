import { describe, it } from "node:test";
import assert from "node:assert/strict";
import htmlEncodingSniffer from "../lib/html-encoding-sniffer.js";

const cases = [
  [
    "charset immediately after another tag",
    '<head><meta charset="utf-8">',
    "UTF-8"
  ],
  [
    "charset after a short comment",
    '<!--><meta charset="iso-8859-2">',
    "ISO-8859-2"
  ],
  [
    "x-user-defined maps to windows-1252",
    '<meta charset="x-user-defined">',
    "windows-1252"
  ],
  [
    "charset alias after script encodings",
    `<script src="script-utf8.js" charset="UTF-8"></script>
     <script src="script-iso88591.js" charset="ISO-8859-1"></script>
     <meta charset="koi8">`,
    "KOI8-R"
  ],
  [
    "unquoted http-equiv after a commented-out declaration",
    `<!--<meta http-equiv="Content-Type" content="text/html;charset=ISO-8859-8">-->
     <meta http-equiv=Content-Type content=text/html;charset=ISO-8859-5>`,
    "ISO-8859-5"
  ],
  [
    "second charset substring in content",
    '<meta http-equiv=Content-Type content="text/html;charsetcharset=iso-8859-2">',
    "ISO-8859-2"
  ],
  [
    "trailing space in content charset",
    '<meta http-equiv=Content-Type content="text/html;charset=iso-8859-2 ">',
    "ISO-8859-2"
  ],
  [
    "quoted charset alias in content after script encodings",
    `<script src="script-utf8.js" charset="UTF-8"></script>
     <script src="script-iso88591.js" charset="ISO-8859-1"></script>
     <meta http-equiv="content-type" content="text/html;charset='tis-620'">`,
    "windows-874"
  ],
  [
    "truncated charset followed by a valid declaration",
    '<meta http-equiv=Content-Type content="text/html; charset"><meta charset="utf-8">',
    "UTF-8"
  ],
  [
    "truncated charset and space followed by a valid declaration",
    '<meta http-equiv=Content-Type content="text/html; charset "><meta charset="utf-8">',
    "UTF-8"
  ],
  [
    "truncated charset and equals followed by a valid declaration",
    '<meta http-equiv=Content-Type content="text/html; charset="><meta charset="utf-8">',
    "UTF-8"
  ],
  [
    "truncated charset, equals, and space followed by a valid declaration",
    '<meta http-equiv=Content-Type content="text/html; charset= "><meta charset="utf-8">',
    "UTF-8"
  ],
  [
    "UTF-16 maps to UTF-8",
    '<meta charset="utf-16">',
    "UTF-8"
  ],
  [
    "UTF-16LE maps to UTF-8",
    '<meta charset="utf-16le">',
    "UTF-8"
  ],
  [
    "UTF-16BE maps to UTF-8",
    '<meta charset="utf-16be">',
    "UTF-8"
  ],
  [
    "first http-equiv attribute wins",
    '<meta http-equiv=refresh http-equiv=Content-Type content="text/html;charset=iso-8859-2">',
    null
  ],
  [
    "truncated charset",
    '<meta http-equiv=Content-Type content="text/html; charset">',
    null
  ],
  [
    "truncated charset and space",
    '<meta http-equiv=Content-Type content="text/html; charset ">',
    null
  ],
  [
    "truncated charset and equals",
    '<meta http-equiv=Content-Type content="text/html; charset=">',
    null
  ],
  [
    "truncated charset, equals, and space",
    '<meta http-equiv=Content-Type content="text/html; charset= ">',
    null
  ],
  [
    "script encodings are ignored",
    `<script src="script-utf8.js" charset="UTF-8"></script>
     <script src="script-iso88591.js" charset="ISO-8859-1"></script>
     <p>\xA9</p>`,
    null
  ]
];

describe("HTML meta declarations", () => {
  for (const [name, source, encoding] of cases) {
    describe(name, () => {
      const input = Uint8Array.from(source, c => c.charCodeAt(0));

      it("sniffs the encoding with no options", () => {
        assert.equal(htmlEncodingSniffer(input), encoding ?? "windows-1252");
      });

      it("uses the transport encoding when provided", () => {
        assert.equal(htmlEncodingSniffer(input, {
          transportLayerEncodingLabel: "windows-1251",
          defaultEncoding: "ISO-8859-16"
        }), "windows-1251");
      });

      it("uses the default encoding only as a fallback", () => {
        assert.equal(htmlEncodingSniffer(input, {
          defaultEncoding: "ISO-8859-16"
        }), encoding ?? "ISO-8859-16");
      });
    });
  }
});
