# Determine the Encoding of an HTML or XML Byte Stream

This package determines the character encoding of an HTML or XML byte stream. It follows the HTML Standard's [encoding sniffing algorithm](https://html.spec.whatwg.org/multipage/parsing.html#encoding-sniffing-algorithm) for HTML, and WebKit's encoding sniffing behavior for XML.

```js
const htmlEncodingSniffer = require("html-encoding-sniffer");
const fs = require("node:fs");

const bytes = fs.readFileSync("./page.html");
const sniffedEncoding = htmlEncodingSniffer(bytes);
```

For XML, pass `{ xml: true }`:

```js
const bytes = fs.readFileSync("./document.xml");
const sniffedEncoding = htmlEncodingSniffer(bytes, { xml: true });
```

The passed bytes are given as a `Uint8Array`; the Node.js `Buffer` subclass of `Uint8Array` will also work, as shown above.

The returned value will be a canonical [encoding name](https://encoding.spec.whatwg.org/#names-and-labels) (not a label). You might then combine this with the [`@exodus/bytes`](https://github.com/ExodusOSS/bytes/) package to decode the result:

```js
const { TextDecoder } = require("@exodus/bytes/encoding.js");
const decodedString = (new TextDecoder(sniffedEncoding)).decode(bytes);
```

## Options

You can pass the following options to `htmlEncodingSniffer`:

```js
const sniffedEncoding = htmlEncodingSniffer(bytes, {
  xml,
  transportLayerEncodingLabel,
  defaultEncoding,
  maxPrescanBytes
});
```

The `xml` option is a boolean, defaulting to `false`. It selects XML sniffing when `true` and HTML sniffing when `false`. XML sniffing ignores HTML `<meta>` declarations and leaves well-formedness validation to the caller's XML parser.

The `transportLayerEncodingLabel` is an encoding label that is obtained from the "transport layer" (probably a HTTP `Content-Type` header), which overrides everything but a BOM.

The `defaultEncoding` is the ultimate fallback encoding used if no valid encoding is supplied by the transport layer, and no encoding is sniffed from the bytes. For HTML, it defaults to `"windows-1252"`, as recommended by the algorithm's table of suggested defaults for "All other locales" (including the `en` locale). For XML, it defaults to `"UTF-8"`.

The `maxPrescanBytes` option sets how many bytes to scan for HTML `<meta>` encoding declarations, defaulting to `1024`. Set a larger value to recognize declarations later in the input, `Infinity` to scan the entire input, or `0` to skip meta scanning. It must be a non-negative integer or `Infinity`. This limit does not apply to XML declarations or UTF-16 byte signatures. Supplying it when `xml` is `true` throws a `TypeError`.

## Credits

This package was originally based on the excellent work of [@nicolashenry](https://github.com/nicolashenry), [in jsdom](https://github.com/tmpvar/jsdom/blob/16fd85618f2705d181232f6552125872a37164bc/lib/jsdom/living/helpers/encoding.js). It has since been pulled out into this separate package.
