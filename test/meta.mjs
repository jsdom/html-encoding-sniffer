import { describe, it } from "node:test";
import assert from "node:assert/strict";
import htmlEncodingSniffer from "../lib/html-encoding-sniffer.js";
import { utf8fromString } from "@exodus/bytes/utf8.js";

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

describe("HTML meta declaration boundaries", () => {
  // Each row: test name, input, expected encoding, and expected encoding with `defaultEncoding: "ISO-8859-16"`.
  for (const [name, source, expected, expectedWithDefault] of [
    [
      "charset without a closing > at EOF",
      '<meta charset="windows-1253"',
      "windows-1252",
      "ISO-8859-16"
    ],
    [
      "charset followed by an unfinished attribute at EOF",
      '<meta charset="windows-1253" unfinished="',
      "windows-1252",
      "ISO-8859-16"
    ],
    [
      "http-equiv without a closing > at EOF",
      '<meta http-equiv="content-type" content="text/html;charset=windows-1253"',
      "windows-1252",
      "ISO-8859-16"
    ],
    [
      "content before http-equiv without a closing > at EOF",
      '<meta content="text/html;charset=windows-1253" http-equiv="content-type"',
      "windows-1252",
      "ISO-8859-16"
    ],
    [
      "charset with a closing > at byte offset 1023",
      `${'<meta charset="windows-1253"'.padEnd(1023)}>`,
      "windows-1253",
      "windows-1253"
    ],
    [
      "charset with a closing > at byte offset 1024",
      `${'<meta charset="windows-1253"'.padEnd(1024)}>`,
      "windows-1252",
      "ISO-8859-16"
    ],
    [
      "http-equiv with a closing > at byte offset 1023",
      `${'<meta http-equiv="content-type" content="text/html;charset=windows-1253"'.padEnd(1023)}>`,
      "windows-1253",
      "windows-1253"
    ],
    [
      "http-equiv with a closing > at byte offset 1024",
      `${'<meta http-equiv="content-type" content="text/html;charset=windows-1253"'.padEnd(1024)}>`,
      "windows-1252",
      "ISO-8859-16"
    ],
    [
      "charset followed by an attribute extending beyond the prescan limit",
      `<meta charset="windows-1253" unfinished="${"x".repeat(1024)}">`,
      "windows-1252",
      "ISO-8859-16"
    ]
  ]) {
    it(name, () => {
      const input = Uint8Array.from(source, c => c.charCodeAt(0));
      assert.equal(htmlEncodingSniffer(input), expected);
      assert.equal(htmlEncodingSniffer(input, { defaultEncoding: "ISO-8859-16" }), expectedWithDefault);
    });
  }
});

describe("Configurable HTML meta prescan", () => {
  // Each row: declaration type and input.
  for (const [name, declaration] of [
    ["charset", '<meta charset="windows-1253">'],
    ["http-equiv", '<meta http-equiv="content-type" content="text/html;charset=windows-1253">']
  ]) {
    describe(name, () => {
      const lateInput = utf8fromString(declaration.padStart(2048));

      // Each row: byte limit and expected encoding for a declaration ending at byte offset 2047.
      for (const [maxPrescanBytes, expected] of [
        [undefined, "windows-1252"],
        [1024, "windows-1252"],
        [2047, "windows-1252"],
        [2048, "windows-1253"],
        [4096, "windows-1253"],
        [Infinity, "windows-1253"]
      ]) {
        it(`sniffs a late declaration with maxPrescanBytes: ${maxPrescanBytes}`, () => {
          assert.equal(htmlEncodingSniffer(lateInput, { maxPrescanBytes }), expected);
        });
      }

      const earlyInput = utf8fromString(declaration);

      // Each row: byte limit and expected encoding for a declaration at the start of the input.
      for (const [maxPrescanBytes, expected] of [
        [0, "windows-1252"],
        [1, "windows-1252"],
        [earlyInput.length - 1, "windows-1252"],
        [earlyInput.length, "windows-1253"]
      ]) {
        it(`sniffs an early declaration with maxPrescanBytes: ${maxPrescanBytes}`, () => {
          assert.equal(htmlEncodingSniffer(earlyInput, { maxPrescanBytes }), expected);
        });
      }
    });
  }

  it("uses the custom default when meta scanning is disabled", () => {
    const input = utf8fromString('<meta charset="windows-1253">');
    assert.equal(htmlEncodingSniffer(input, { maxPrescanBytes: 0, defaultEncoding: "KOI8-U" }), "KOI8-U");
  });

  it("uses the transport encoding before a late meta declaration", () => {
    const input = utf8fromString('<meta charset="windows-1253">'.padStart(2048));
    assert.equal(htmlEncodingSniffer(input, {
      maxPrescanBytes: Infinity,
      transportLayerEncodingLabel: "ISO-8859-2"
    }), "ISO-8859-2");
  });

  it("requires a closing > even when scanning the entire input", () => {
    const input = utf8fromString('<meta charset="windows-1253"'.padStart(2048));
    assert.equal(htmlEncodingSniffer(input, { maxPrescanBytes: Infinity }), "windows-1252");
  });

  it("stops at the custom limit while reading a later attribute", () => {
    const input = utf8fromString(`<meta charset="windows-1253" title="${"x".repeat(2048)}">`);
    assert.equal(htmlEncodingSniffer(input, { maxPrescanBytes: 2048 }), "windows-1252");
    assert.equal(htmlEncodingSniffer(input, { maxPrescanBytes: Infinity }), "windows-1253");
  });

  it("measures the limit from the start of a Uint8Array view", () => {
    const source = '<meta charset="windows-1253">'.padStart(2048);
    const input = utf8fromString(`junk${source}junk`).subarray(4, -4);
    assert.equal(htmlEncodingSniffer(input, { maxPrescanBytes: 2047 }), "windows-1252");
    assert.equal(htmlEncodingSniffer(input, { maxPrescanBytes: 2048 }), "windows-1253");
  });

  it("does not read beyond a Uint8Array view with an unlimited scan", () => {
    const input = utf8fromString('<meta charset="windows-1253">').subarray(0, -1);
    assert.equal(htmlEncodingSniffer(input, { maxPrescanBytes: Infinity }), "windows-1252");
  });

  it("rejects invalid byte limits", () => {
    const input = utf8fromString('<meta charset="windows-1253">');
    for (const maxPrescanBytes of [-1, -Infinity, NaN, 1.5, null, "1024"]) {
      assert.throws(() => htmlEncodingSniffer(input, { maxPrescanBytes }), RangeError);
    }
  });
});
