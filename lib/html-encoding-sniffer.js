"use strict";
const { getBOMEncoding, labelToName } = require("@exodus/bytes/encoding-lite.js");

module.exports = (
  uint8Array,
  { xml = false, transportLayerEncodingLabel, defaultEncoding, maxPrescanBytes } = {}
) => {
  let encoding;

  if (xml) {
    // Follow WebKit's XML encoding sniffing until https://github.com/whatwg/html/issues/12968 is resolved.
    if (maxPrescanBytes !== undefined) {
      throw new TypeError("maxPrescanBytes cannot be used in XML mode");
    }

    if (defaultEncoding === undefined) {
      defaultEncoding = "UTF-8";
    }

    // https://www.rfc-editor.org/rfc/rfc7303#section-3.2 gives BOMs precedence over transport-layer encodings.
    encoding = labelToName(getBOMEncoding(uint8Array));

    if (encoding === null && transportLayerEncodingLabel !== undefined) {
      encoding = labelToName(transportLayerEncodingLabel);
    }

    // WebKit waits for eight bytes before checking the six-byte UTF-16 `<?x` signatures or an XML declaration.
    if (encoding === null && uint8Array.byteLength >= 8) {
      if (uint8Array[0] === 0x3C && uint8Array[1] === 0x00 &&
          uint8Array[2] === 0x3F && uint8Array[3] === 0x00 &&
          uint8Array[4] === 0x78 && uint8Array[5] === 0x00) {
        encoding = "UTF-16LE";
      } else if (uint8Array[0] === 0x00 && uint8Array[1] === 0x3C &&
                 uint8Array[2] === 0x00 && uint8Array[3] === 0x3F &&
                 uint8Array[4] === 0x00 && uint8Array[5] === 0x78) {
        encoding = "UTF-16BE";
      } else {
        encoding = getXMLDeclarationEncoding(uint8Array);
      }
    }

    if (encoding === null) {
      encoding = defaultEncoding;
    }
  } else {
    // https://html.spec.whatwg.org/multipage/parsing.html#encoding-sniffing-algorithm
    if (maxPrescanBytes === undefined) {
      maxPrescanBytes = 1024;
    }
    if (maxPrescanBytes !== Infinity && (!Number.isInteger(maxPrescanBytes) || maxPrescanBytes < 0)) {
      throw new RangeError("maxPrescanBytes must be a non-negative integer or Infinity");
    }

    if (defaultEncoding === undefined) {
      defaultEncoding = "windows-1252";
    }

    encoding = labelToName(getBOMEncoding(uint8Array));

    if (encoding === null && transportLayerEncodingLabel !== undefined) {
      encoding = labelToName(transportLayerEncodingLabel);
    }

    if (encoding === null) {
      encoding = prescanHTMLEncoding(uint8Array, maxPrescanBytes);
    }

    if (encoding === null) {
      encoding = defaultEncoding;
    }
  }

  return encoding;
};

// https://html.spec.whatwg.org/multipage/parsing.html#prescan-a-byte-stream-to-determine-its-encoding
function prescanHTMLEncoding(uint8Array, maxPrescanBytes) {
  // Six-byte UTF-16 `<?x` signatures.
  if (uint8Array[0] === 0x3C && uint8Array[1] === 0x00 &&
      uint8Array[2] === 0x3F && uint8Array[3] === 0x00 &&
      uint8Array[4] === 0x78 && uint8Array[5] === 0x00) {
    return "UTF-16LE";
  }
  if (uint8Array[0] === 0x00 && uint8Array[1] === 0x3C &&
      uint8Array[2] === 0x00 && uint8Array[3] === 0x3F &&
      uint8Array[4] === 0x00 && uint8Array[5] === 0x78) {
    return "UTF-16BE";
  }

  let encoding = prescanMetaCharset(uint8Array.subarray(0, maxPrescanBytes));
  if (encoding === null) {
    // The XML declaration scan is not subject to the meta prescan's byte limit.
    encoding = getXMLDeclarationEncoding(uint8Array);
  }
  return encoding;
}

function prescanMetaCharset(uint8Array) {
  const l = uint8Array.byteLength;
  for (let i = 0; i < l; i++) {
    let c = uint8Array[i];
    if (c === 0x3C) {
      // "<"
      const c1 = uint8Array[i + 1];
      const c2 = uint8Array[i + 2];
      const c3 = uint8Array[i + 3];
      const c4 = uint8Array[i + 4];
      const c5 = uint8Array[i + 5];
      // !-- (comment start)
      if (c1 === 0x21 && c2 === 0x2D && c3 === 0x2D) {
        i += 4;
        for (; i < l; i++) {
          c = uint8Array[i];
          const cMinus1 = uint8Array[i - 1];
          const cMinus2 = uint8Array[i - 2];
          // --> (comment end)
          if (c === 0x3E && cMinus1 === 0x2D && cMinus2 === 0x2D) {
            break;
          }
        }
      } else if ((c1 === 0x4D || c1 === 0x6D) &&
         (c2 === 0x45 || c2 === 0x65) &&
         (c3 === 0x54 || c3 === 0x74) &&
         (c4 === 0x41 || c4 === 0x61) &&
         (isSpaceCharacter(c5) || c5 === 0x2F)) {
        // "meta" + space or /
        i += 6;
        const attributeList = new Set();
        let gotPragma = false;
        let needPragma = null;
        let charset = null;

        let attrRes;
        do {
          attrRes = getAttribute(uint8Array, i, l);
          // Reaching the prescan limit aborts the entire prescan, including attribute processing.
          if (attrRes.i >= l) {
            return null;
          }
          if (attrRes.attr && !attributeList.has(attrRes.attr.name)) {
            attributeList.add(attrRes.attr.name);
            if (attrRes.attr.name === "http-equiv") {
              gotPragma = attrRes.attr.value === "content-type";
            } else if (attrRes.attr.name === "content" && !charset) {
              charset = extractCharacterEncodingFromMeta(attrRes.attr.value);
              if (charset !== null) {
                needPragma = true;
              }
            } else if (attrRes.attr.name === "charset") {
              charset = labelToName(attrRes.attr.value);
              needPragma = false;
            }
          }
          i = attrRes.i;
        } while (attrRes.attr);

        if (needPragma === null) {
          continue;
        }
        if (needPragma === true && gotPragma === false) {
          continue;
        }
        if (charset === null) {
          continue;
        }

        if (charset === "UTF-16LE" || charset === "UTF-16BE") {
          charset = "UTF-8";
        }
        if (charset === "x-user-defined") {
          charset = "windows-1252";
        }

        return charset;
      } else if ((c1 >= 0x41 && c1 <= 0x5A) || (c1 >= 0x61 && c1 <= 0x7A)) {
        // a-z or A-Z
        for (i += 2; i < l; i++) {
          c = uint8Array[i];
          // space or >
          if (isSpaceCharacter(c) || c === 0x3E) {
            break;
          }
        }
        let attrRes;
        do {
          attrRes = getAttribute(uint8Array, i, l);
          i = attrRes.i;
        } while (attrRes.attr);
      } else if (c1 === 0x21 || c1 === 0x2F || c1 === 0x3F) {
        // ! or / or ?
        for (i += 2; i < l; i++) {
          c = uint8Array[i];
          // >
          if (c === 0x3E) {
            break;
          }
        }
      }
    }
  }
  return null;
}

// https://html.spec.whatwg.org/multipage/parsing.html#concept-get-xml-encoding-when-sniffing
function getXMLDeclarationEncoding(uint8Array) {
  // Case-sensitive `<?xml` at the start of the stream.
  if (uint8Array[0] !== 0x3C || uint8Array[1] !== 0x3F || uint8Array[2] !== 0x78 ||
      uint8Array[3] !== 0x6D || uint8Array[4] !== 0x6C) {
    return null;
  }

  const end = uint8Array.indexOf(0x3E, 5);
  if (end === -1) {
    return null;
  }

  let i = 5;
  for (; i + 7 < end; i++) {
    // The first case-sensitive `encoding` substring, even within another name.
    if (uint8Array[i] === 0x65 && uint8Array[i + 1] === 0x6E && uint8Array[i + 2] === 0x63 &&
        uint8Array[i + 3] === 0x6F && uint8Array[i + 4] === 0x64 && uint8Array[i + 5] === 0x69 &&
        uint8Array[i + 6] === 0x6E && uint8Array[i + 7] === 0x67) {
      break;
    }
  }
  if (i + 7 >= end) {
    return null;
  }
  i += 8;

  // Unlike HTML attribute whitespace, this includes every ASCII control byte.
  while (i < end && uint8Array[i] <= 0x20) {
    i++;
  }
  if (i >= end || uint8Array[i] !== 0x3D) {
    return null;
  }
  i++;
  while (i < end && uint8Array[i] <= 0x20) {
    i++;
  }

  const quote = uint8Array[i];
  if (i >= end || (quote !== 0x22 && quote !== 0x27)) {
    return null;
  }

  let label = "";
  for (i++; i < end; i++) {
    const c = uint8Array[i];
    if (c === quote) {
      const encoding = labelToName(label);
      return encoding === "UTF-16LE" || encoding === "UTF-16BE" ? "UTF-8" : encoding;
    }
    if (c <= 0x20) {
      return null;
    }
    label += String.fromCharCode(c);
  }
  return null;
}

// https://html.spec.whatwg.org/multipage/syntax.html#concept-get-attributes-when-sniffing
function getAttribute(uint8Array, i, l) {
  for (; i < l; i++) {
    let c = uint8Array[i];
    // space or /
    if (isSpaceCharacter(c) || c === 0x2F) {
      continue;
    }
    // ">"
    if (c === 0x3E) {
      break;
    }
    let name = "";
    let value = "";
    nameLoop:for (; i < l; i++) {
      c = uint8Array[i];
      // "="
      if (c === 0x3D && name !== "") {
        i++;
        break;
      }
      // space
      if (isSpaceCharacter(c)) {
        for (i++; i < l; i++) {
          c = uint8Array[i];
          // space
          if (isSpaceCharacter(c)) {
            continue;
          }
          // not "="
          if (c !== 0x3D) {
            return { attr: { name, value }, i };
          }

          i++;
          break nameLoop;
        }
        break;
      }
      // / or >
      if (c === 0x2F || c === 0x3E) {
        return { attr: { name, value }, i };
      }
      // A-Z
      if (c >= 0x41 && c <= 0x5A) {
        name += String.fromCharCode(c + 0x20); // lowercase
      } else {
        name += String.fromCharCode(c);
      }
    }
    c = uint8Array[i];
    // space
    if (isSpaceCharacter(c)) {
      for (i++; i < l; i++) {
        c = uint8Array[i];
        // space
        if (isSpaceCharacter(c)) {
          continue;
        } else {
          break;
        }
      }
    }
    // " or '
    if (c === 0x22 || c === 0x27) {
      const quote = c;
      for (i++; i < l; i++) {
        c = uint8Array[i];

        if (c === quote) {
          i++;
          return { attr: { name, value }, i };
        }

        // A-Z
        if (c >= 0x41 && c <= 0x5A) {
          value += String.fromCharCode(c + 0x20); // lowercase
        } else {
          value += String.fromCharCode(c);
        }
      }
    }

    // >
    if (c === 0x3E) {
      return { attr: { name, value }, i };
    }

    // A-Z
    if (c >= 0x41 && c <= 0x5A) {
      value += String.fromCharCode(c + 0x20); // lowercase
    } else {
      value += String.fromCharCode(c);
    }

    for (i++; i < l; i++) {
      c = uint8Array[i];

      // space or >
      if (isSpaceCharacter(c) || c === 0x3E) {
        return { attr: { name, value }, i };
      }

      // A-Z
      if (c >= 0x41 && c <= 0x5A) {
        value += String.fromCharCode(c + 0x20); // lowercase
      } else {
        value += String.fromCharCode(c);
      }
    }
  }
  return { i };
}

function extractCharacterEncodingFromMeta(string) {
  let position = 0;

  while (true) {
    const indexOfCharset = string.substring(position).search(/charset/ui);

    if (indexOfCharset === -1) {
      return null;
    }
    let subPosition = position + indexOfCharset + "charset".length;

    while (isSpaceCharacter(string.charCodeAt(subPosition))) {
      ++subPosition;
    }

    if (string[subPosition] !== "=") {
      position = subPosition - 1;
      continue;
    }

    ++subPosition;

    while (isSpaceCharacter(string.charCodeAt(subPosition))) {
      ++subPosition;
    }

    position = subPosition;
    break;
  }

  if (string[position] === "\"" || string[position] === "'") {
    const nextIndex = string.indexOf(string[position], position + 1);

    if (nextIndex !== -1) {
      return labelToName(string.substring(position + 1, nextIndex));
    }

    // It is an unmatched quotation mark
    return null;
  }

  if (string.length === position + 1) {
    return null;
  }

  const indexOfASCIIWhitespaceOrSemicolon = string.substring(position + 1).search(/\x09|\x0A|\x0C|\x0D|\x20|;/u);
  const end = indexOfASCIIWhitespaceOrSemicolon === -1 ?
    string.length :
    position + indexOfASCIIWhitespaceOrSemicolon + 1;

  return labelToName(string.substring(position, end));
}

function isSpaceCharacter(c) {
  return c === 0x09 || c === 0x0A || c === 0x0C || c === 0x0D || c === 0x20;
}
