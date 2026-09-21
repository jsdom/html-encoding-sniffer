import { describe, it } from "node:test";
import { TextDecoder } from "@exodus/bytes/encoding.js";
import { TextEncoder } from "node:util";
import assert from "node:assert/strict";
import htmlEncodingSniffer from "../lib/html-encoding-sniffer.js";

// Inspired by https://github.com/web-platform-tests/wpt/tree/master/html/syntax/xmldecl.
// These test the byte prescan, independently of an HTML or XML parser.
// Each row: test name, input, expected HTML encoding, expected XML encoding,
// and expected encoding in either mode with `defaultEncoding: "KOI8-U"`.
const declarations = [
  [
    "ordinary declaration",
    '<?xml version="1.0" encoding="windows-1251"?>',
    "windows-1251",
    "windows-1251",
    "windows-1251"
  ],
  [
    "single quotes",
    "<?xml version='1.0' encoding='windows-1251'?>",
    "windows-1251",
    "windows-1251",
    "windows-1251"
  ],
  [
    "encoding alias",
    '<?xml encoding="cp1251"?>',
    "windows-1251",
    "windows-1251",
    "windows-1251"
  ],
  [
    "case-insensitive label",
    '<?xml encoding="WiNdOwS-1251"?>',
    "windows-1251",
    "windows-1251",
    "windows-1251"
  ],
  [
    "no version",
    '<?xml encoding="windows-1251"?>',
    "windows-1251",
    "windows-1251",
    "windows-1251"
  ],
  [
    "no space or question mark",
    '<?xmlencoding="windows-1251">',
    "windows-1251",
    "windows-1251",
    "windows-1251"
  ],
  [
    "extra letter",
    '<?xmla encoding="windows-1251"?>',
    "windows-1251",
    "windows-1251",
    "windows-1251"
  ],
  [
    "processing instruction without version",
    '<?xmlfoo encoding="windows-1251"?>',
    "windows-1251",
    "windows-1251",
    "windows-1251"
  ],
  [
    "processing instruction with version",
    '<?xmlfoo version="1.0" encoding="windows-1251"?>',
    "windows-1251",
    "windows-1251",
    "windows-1251"
  ],
  [
    "processing instruction without equals signs",
    '<?xmlfoo version "1.0" encoding "windows-1251"?>',
    "windows-1252",
    "UTF-8",
    "KOI8-U"
  ],
  [
    "processing instruction with encoding after >",
    '<?xmlfoo version="1.0" > encoding="windows-1251"?>',
    "windows-1252",
    "UTF-8",
    "KOI8-U"
  ],
  [
    "extra less-than sign",
    '<?xml< encoding="windows-1251"?>',
    "windows-1251",
    "windows-1251",
    "windows-1251"
  ],
  [
    "uppercase version",
    '<?xml VERSION="1.0" encoding="windows-1251"?>',
    "windows-1251",
    "windows-1251",
    "windows-1251"
  ],
  [
    "encoding inside another name",
    '<?xml otherencoding="windows-1251"?>',
    "windows-1251",
    "windows-1251",
    "windows-1251"
  ],
  [
    "encoding inside another value",
    '<?xml version=\'encoding="windows-1251"\'?>',
    "windows-1251",
    "windows-1251",
    "windows-1251"
  ],
  [
    "meta inside declaration",
    '<?xml <meta charset="windows-1253" encoding="windows-1251">',
    "windows-1251",
    "windows-1251",
    "windows-1251"
  ],
  [
    "first declaration wins",
    '<?xml encoding="windows-1251"?><?xml encoding="windows-1253"?>',
    "windows-1251",
    "windows-1251",
    "windows-1251"
  ],
  [
    "first encoding wins",
    '<?xml encoding="windows-1251" encoding="windows-1253"?>',
    "windows-1251",
    "windows-1251",
    "windows-1251"
  ],
  [
    "user-defined is preserved",
    '<?xml encoding="x-user-defined"?>',
    "x-user-defined",
    "x-user-defined",
    "x-user-defined"
  ],
  [
    "replacement is preserved",
    '<?xml encoding="csiso2022kr"?>',
    "replacement",
    "replacement",
    "replacement"
  ],
  [
    "uppercase XML",
    '<?XML encoding="windows-1251"?>',
    "windows-1252",
    "UTF-8",
    "KOI8-U"
  ],
  [
    "uppercase encoding",
    '<?xml ENCODING="windows-1251"?>',
    "windows-1252",
    "UTF-8",
    "KOI8-U"
  ],
  [
    "leading space",
    ' <?xml encoding="windows-1251"?>',
    "windows-1252",
    "UTF-8",
    "KOI8-U"
  ],
  [
    "leading comment",
    '<!-- --><?xml encoding="windows-1251"?>',
    "windows-1252",
    "UTF-8",
    "KOI8-U"
  ],
  [
    "missing greater-than sign",
    '<?xml encoding="windows-1251"?',
    "windows-1252",
    "UTF-8",
    "KOI8-U"
  ],
  [
    "encoding after declaration",
    '<?xml>encoding="windows-1251"?>',
    "windows-1252",
    "UTF-8",
    "KOI8-U"
  ],
  [
    "quote after declaration",
    '<?xml encoding="windows-1251>"',
    "windows-1252",
    "UTF-8",
    "KOI8-U"
  ],
  [
    "empty label",
    '<?xml encoding=""?>',
    "windows-1252",
    "UTF-8",
    "KOI8-U"
  ],
  [
    "unknown label",
    '<?xml encoding="unknown"?>',
    "windows-1252",
    "UTF-8",
    "KOI8-U"
  ],
  [
    "unsupported UTF-32",
    '<?xml encoding="UTF-32"?>',
    "windows-1252",
    "UTF-8",
    "KOI8-U"
  ],
  [
    "unsupported UTF-7",
    '<?xml encoding="UTF-7"?>',
    "windows-1252",
    "UTF-8",
    "KOI8-U"
  ],
  [
    "no quotes",
    "<?xml encoding=windows-1251?>",
    "windows-1252",
    "UTF-8",
    "KOI8-U"
  ],
  [
    "unmatched quotes",
    '<?xml encoding="windows-1251\'?>',
    "windows-1252",
    "UTF-8",
    "KOI8-U"
  ],
  [
    "no equals sign",
    '<?xml encoding "windows-1251"?>',
    "windows-1252",
    "UTF-8",
    "KOI8-U"
  ],
  [
    "repeated encoding substring",
    '<?xml encodingencoding="windows-1251"?>',
    "windows-1252",
    "UTF-8",
    "KOI8-U"
  ],
  [
    "encoding instead of quote",
    '<?xml encoding=encoding="windows-1251"?>',
    "windows-1252",
    "UTF-8",
    "KOI8-U"
  ],
  [
    "invalid first encoding",
    '<?xml encoding="unknown" encoding="windows-1251"?>',
    "windows-1252",
    "UTF-8",
    "KOI8-U"
  ],
  [
    "malformed first encoding",
    '<?xml encoding! encoding="windows-1251"?>',
    "windows-1252",
    "UTF-8",
    "KOI8-U"
  ]
];

function bytes(string) {
  return Uint8Array.from(string, c => c.charCodeAt(0));
}

describe("XML declarations", () => {
  for (const [name, source, expectedHTML, expectedXML, expectedWithDefault] of declarations) {
    it(name, () => {
      const input = bytes(source);
      assert.equal(htmlEncodingSniffer(input, { xml: false }), expectedHTML);
      assert.equal(htmlEncodingSniffer(input, { xml: true }), expectedXML);
      assert.equal(htmlEncodingSniffer(input, { xml: false, defaultEncoding: "KOI8-U" }), expectedWithDefault);
      assert.equal(htmlEncodingSniffer(input, { xml: true, defaultEncoding: "KOI8-U" }), expectedWithDefault);
    });
  }
});

for (const xml of [false, true]) {
  describe(`XML declarations with xml: ${xml}`, () => {
    for (let c = 0; c <= 0x20; c++) {
      const character = String.fromCharCode(c);

      it(`accepts byte ${c} around the equals sign`, () => {
        const input = bytes(`<?xml encoding${character}=${character}"windows-1251"?>`);
        assert.equal(htmlEncodingSniffer(input, { xml }), "windows-1251");
      });

      it(`rejects byte ${c} anywhere in the label`, () => {
        for (const label of [`${character}windows-1251`, `windows${character}-1251`, `windows-1251${character}`]) {
          const input = bytes(`<?xml encoding="${label}"?>`);
          assert.equal(htmlEncodingSniffer(input, { xml, defaultEncoding: "KOI8-U" }), "KOI8-U");
        }
      });
    }

    it("does not treat DEL or high bytes as whitespace around the equals sign", () => {
      // WebKit uses unsigned bytes here; Blink's signed `char` can incorrectly skip bytes >= 0x80.
      for (let c = 0x7F; c <= 0xFF; c++) {
        const character = String.fromCharCode(c);
        for (const input of [
          `<?xmlfoo encoding${character}="windows-1251"?>`,
          `<?xmlfoo encoding=${character}"windows-1251"?>`
        ]) {
          assert.equal(
            htmlEncodingSniffer(bytes(input), { xml, defaultEncoding: "KOI8-U" }),
            "KOI8-U",
            `byte 0x${c.toString(16)} in ${JSON.stringify(input)}`
          );
        }
      }
    });

    it("rejects DEL and high bytes anywhere in the label", () => {
      for (let c = 0x7F; c <= 0xFF; c++) {
        const character = String.fromCharCode(c);
        for (const label of [`${character}windows-1251`, `windows${character}-1251`, `windows-1251${character}`]) {
          const input = bytes(`<?xml encoding="${label}"?>`);
          assert.equal(
            htmlEncodingSniffer(input, { xml, defaultEncoding: "KOI8-U" }),
            "KOI8-U",
            `label ${JSON.stringify(label)}`
          );
        }
      }
    });

    it("respects the offset and length of a Uint8Array view", () => {
      const declaration = '<?xml encoding="windows-1251"?>';
      const input = bytes(`junk${declaration}junk`);
      assert.equal(htmlEncodingSniffer(input.subarray(4, -4), { xml }), "windows-1251");
      assert.equal(htmlEncodingSniffer(input.subarray(4, -5), { xml, defaultEncoding: "KOI8-U" }), "KOI8-U");
    });

    it("falls back for every truncated prefix of a declaration", () => {
      const input = bytes('<?xml version="1.0" encoding="windows-1251"?>');
      for (let length = 0; length < input.length; length++) {
        assert.equal(htmlEncodingSniffer(input.subarray(0, length), { xml, defaultEncoding: "KOI8-U" }), "KOI8-U");
      }
    });

    it("uses the transport encoding before the declaration", () => {
      const input = bytes('<?xml encoding="windows-1251"?>');
      assert.equal(htmlEncodingSniffer(input, { xml, transportLayerEncodingLabel: "csisolatingreek" }), "ISO-8859-7");
    });

    it("ignores an unknown transport encoding", () => {
      const input = bytes('<?xml encoding="windows-1251"?>');
      assert.equal(htmlEncodingSniffer(input, { xml, transportLayerEncodingLabel: "unknown" }), "windows-1251");
    });

    it("uses a BOM before the transport encoding and declaration", () => {
      const input = new Uint8Array([0xEF, 0xBB, 0xBF, ...bytes('<?xml encoding="windows-1251"?>')]);
      assert.equal(htmlEncodingSniffer(input, { xml, transportLayerEncodingLabel: "windows-1253" }), "UTF-8");
    });

    it("recognizes a BOM even when fewer than eight bytes are available", () => {
      for (const [encoding, bom] of [
        ["UTF-8", [0xEF, 0xBB, 0xBF]],
        ["UTF-16LE", [0xFF, 0xFE]],
        ["UTF-16BE", [0xFE, 0xFF]]
      ]) {
        assert.equal(htmlEncodingSniffer(new Uint8Array(bom), {
          xml,
          transportLayerEncodingLabel: "windows-1251"
        }), encoding);
      }
    });

    it("only honors meta declarations in HTML", () => {
      const input = bytes('<?xml encoding="windows-1251"?><meta charset="windows-1253">');
      assert.equal(htmlEncodingSniffer(input, { xml }), xml ? "windows-1251" : "windows-1253");
    });

    it("only honors http-equiv declarations in HTML", () => {
      const input = bytes(`<?xml encoding="windows-1251"?>
        <meta http-equiv="content-type" content="text/html;charset=windows-1253">`);
      assert.equal(htmlEncodingSniffer(input, { xml }), xml ? "windows-1251" : "windows-1253");
    });

    for (const [label, encoding] of [
      ["UTF-16", "UTF-16LE"],
      ["UTF-16LE", "UTF-16LE"],
      ["UTF-16BE", "UTF-16BE"],
      ["unicode", "UTF-16LE"],
      ["unicodefffe", "UTF-16BE"],
      ["csUnicode", "UTF-16LE"]
    ]) {
      it(`decodes an ASCII declaration of ${label} as UTF-8`, () => {
        const source = `<?xml version="1.0" encoding="${label}"?><p>日本語</p>`;
        const input = new TextEncoder().encode(source);
        const sniffedEncoding = htmlEncodingSniffer(input, { xml });
        assert.equal(sniffedEncoding, "UTF-8");
        assert.equal(new TextDecoder(sniffedEncoding).decode(input), source);
      });

      it(`preserves ${label} from the transport layer`, () => {
        for (const input of [new Uint8Array(), bytes('<?xml encoding="windows-1251"?>')]) {
          assert.equal(htmlEncodingSniffer(input, { xml, transportLayerEncodingLabel: label }), encoding);
        }
      });
    }

    for (const [encoding, signature] of [
      ["UTF-16LE", [0x3C, 0, 0x3F, 0, 0x78, 0]],
      ["UTF-16BE", [0, 0x3C, 0, 0x3F, 0, 0x78]]
    ]) {
      it(`detects the ${encoding} signature before meta declarations`, () => {
        const input = new Uint8Array([...signature, ...bytes('><meta charset="windows-1253">')]);
        assert.equal(htmlEncodingSniffer(input, { xml }), encoding);
        assert.equal(htmlEncodingSniffer(input, { xml, transportLayerEncodingLabel: "utf8" }), "UTF-8");
      });

      it(`requires ${xml ? 8 : 6} bytes of input to recognize a ${encoding} signature`, () => {
        const input = new Uint8Array([...signature, 0, 0]);
        for (let length = 0; length <= input.length; length++) {
          const expected = length >= (xml ? 8 : 6) ? encoding : "KOI8-U";
          assert.equal(
            htmlEncodingSniffer(input.subarray(0, length), { xml, defaultEncoding: "KOI8-U" }),
            expected,
            `${length} bytes`
          );
        }
      });

      it(`requires all six bytes of the ${encoding} signature to match`, () => {
        for (let i = 0; i < signature.length; i++) {
          const input = new Uint8Array([...signature, 0, 0]);
          input[i] ^= 0x80;
          assert.equal(htmlEncodingSniffer(input, { xml, defaultEncoding: "KOI8-U" }), "KOI8-U");
        }
      });

      it(`requires a lowercase x in the ${encoding} signature`, () => {
        const input = new Uint8Array([...signature, ...bytes('><meta charset="windows-1253">')]);
        input[signature.indexOf(0x78)] = 0x58;
        assert.equal(htmlEncodingSniffer(input, { xml, defaultEncoding: "KOI8-U" }), xml ? "KOI8-U" : "windows-1253");
      });

      it(`does not recognize a ${encoding} signature containing only <?`, () => {
        const input = new Uint8Array([...signature.slice(0, 4), ...bytes('><meta charset="windows-1253">')]);
        assert.equal(htmlEncodingSniffer(input, { xml, defaultEncoding: "KOI8-U" }), xml ? "KOI8-U" : "windows-1253");
      });

      it(`uses a BOM before the ${encoding} signature`, () => {
        const input = new Uint8Array([0xEF, 0xBB, 0xBF, ...signature, 0, 0]);
        assert.equal(htmlEncodingSniffer(input, { xml, transportLayerEncodingLabel: "windows-1251" }), "UTF-8");
      });

      it(`does not look for a ${encoding} signature beyond the start`, () => {
        const input = new Uint8Array([0x20, ...signature]);
        assert.equal(htmlEncodingSniffer(input, { xml, defaultEncoding: "KOI8-U" }), "KOI8-U");
      });

      it(`decodes a complete ${encoding} document without a BOM`, () => {
        const source = `<?xml version="1.0" encoding="${encoding}"?><p>日本語</p>`;
        const input = new Uint8Array(source.length * 2);
        const view = new DataView(input.buffer);
        for (let i = 0; i < source.length; i++) {
          view.setUint16(i * 2, source.charCodeAt(i), encoding === "UTF-16LE");
        }
        const sniffedEncoding = htmlEncodingSniffer(input, { xml });
        assert.equal(sniffedEncoding, encoding);
        assert.equal(new TextDecoder(sniffedEncoding).decode(input), source);
      });
    }

    it("decodes non-ASCII text using the declared legacy encoding", () => {
      const input = bytes('<?xml version="1.0" encoding="windows-1251"?><p>\u00C0</p>');
      const encoding = htmlEncodingSniffer(input, { xml });
      assert.equal(encoding, "windows-1251");
      assert.equal(new TextDecoder(encoding).decode(input), '<?xml version="1.0" encoding="windows-1251"?><p>А</p>');
    });

    for (const length of [1023, 1024, 1025, 4096]) {
      for (const position of ["before", "after"]) {
        for (const trailingLength of [0, 8192]) {
          it(`${length} bytes, padding ${position} encoding, ${trailingLength} trailing bytes`, () => {
            const padding = " ".repeat(length - '<?xml encoding="windows-1251"?>'.length);
            const declaration = position === "before" ?
              `<?xml ${padding}encoding="windows-1251"?>` :
              `<?xml encoding="windows-1251"${padding}?>`;
            assert.equal(declaration.length, length);
            const input = bytes(declaration + "\0".repeat(trailingLength));
            assert.equal(htmlEncodingSniffer(input, { xml, defaultEncoding: "KOI8-U" }), "windows-1251");
          });
        }
      }
    }

    it("still requires the closing > in a long declaration", () => {
      const input = bytes(`<?xml encoding="windows-1251"${" ".repeat(4096)}?>`);
      assert.equal(htmlEncodingSniffer(input.subarray(0, -1), { xml, defaultEncoding: "KOI8-U" }), "KOI8-U");
    });

    it("does not search beyond the first > in a long declaration", () => {
      const input = bytes(`<?xml ${" ".repeat(4096)}>encoding="windows-1251"?>`);
      assert.equal(htmlEncodingSniffer(input, { xml, defaultEncoding: "KOI8-U" }), "KOI8-U");
    });
  });
}

describe("HTML prescan falling back to an XML declaration", () => {
  for (const suffix of [
    '<meta charset="unknown">',
    '<meta content="text/html;charset=windows-1253">',
    '<!-- <meta charset="windows-1253">',
    '<div title="',
    '<meta charset="',
    '<meta charset="windows-1253"',
    '<meta charset="windows-1253" unfinished="',
    `<meta charset="windows-1253" ${" ".repeat(1024)}>`
  ]) {
    it(`falls back after ${JSON.stringify(suffix.slice(0, 70))}`, () => {
      const input = bytes(`<?xml encoding="windows-1251"?>${suffix}`);
      assert.equal(htmlEncodingSniffer(input), "windows-1251");
    });
  }

  it("does not honor meta declarations beyond the prescan limit", () => {
    const input = bytes(`<?xml encoding="windows-1251"?>${" ".repeat(1024)}<meta charset="windows-1253">`);
    assert.equal(htmlEncodingSniffer(input), "windows-1251");
  });

  it("does not extend the meta prescan to the end of a long XML declaration", () => {
    const input = bytes(`<?xml ${" ".repeat(4096)}encoding="windows-1251"?><meta charset="windows-1253">`);
    assert.equal(htmlEncodingSniffer(input), "windows-1251");
  });

  for (const length of [1024, 1025]) {
    it(`handles a meta declaration ending at byte ${length}`, () => {
      const declaration = '<?xml encoding="windows-1251"?>';
      const meta = '<meta charset="windows-1253">';
      const padding = " ".repeat(length - declaration.length - meta.length);
      const input = bytes(declaration + padding + meta);
      assert.equal(htmlEncodingSniffer(input), length === 1024 ? "windows-1253" : "windows-1251");
    });
  }
});
