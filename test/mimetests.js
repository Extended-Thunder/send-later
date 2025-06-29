exports.init = function () {
  const fs = require("fs");
  const dmp = require("./diff_match_patch.js");

  function diff(aText, bText) {
    const differencer = new dmp.diff_match_patch();
    const a = differencer.diff_linesToChars_(aText, bText);
    const lineText1 = a.chars1;
    const lineText2 = a.chars2;
    const lineArray = a.lineArray;
    const diffs = differencer.diff_main(lineText1, lineText2, false);
    differencer.diff_charsToLines_(diffs, lineArray);
    return diffs;
  }

  SLTests.AddTest(
    "MimeTests 01-plaintext.eml",
    (hdrstring, newvalue) => {
      const original = fs.readFileSync("test/data/01-plaintext.eml", {
        encoding: "utf-8",
      });
      const expected = fs.readFileSync("test/data/01-plaintext.eml.out", {
        encoding: "utf-8",
      });
      let result = original;

      result = SLTools.replaceHeader(result, hdrstring, newvalue, false);

      if (result === expected) {
        return true;
      } else {
        const diffs = diff(result, expected);
        return `Replace headers failed with difference:\n${diffs}`;
      }
    },
    ["Subject", "new subject"],
  );

  function getHeaderTest(data, hdrstring, expected) {
    const original = fs.readFileSync(data, { encoding: "utf-8" });
    result = SLTools.getHeader(original, hdrstring);
    return result === expected || `Expected "${expected}", got "${result}".`;
  }

  SLTests.AddTest("MimeTests getHeader (simple)", getHeaderTest, [
    "test/data/01-plaintext.eml",
    "Subject",
    "1 plaintext",
  ]);

  SLTests.AddTest("MimeTests getHeader (multi-line)", getHeaderTest, [
    "test/data/01-plaintext.eml",
    "User-Agent",
    "Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:59.0) Gecko/20100101 " +
      "Thunderbird/59.0a1",
  ]);

  SLTests.AddTest("MimeTests getHeader (first line)", getHeaderTest, [
    "test/data/01-plaintext.eml",
    "To",
    "test@example.com",
  ]);

  SLTests.AddTest("MimeTests getHeader (last header line)", getHeaderTest, [
    "test/data/01-plaintext.eml",
    "Content-Language",
    "en-GB",
  ]);

  SLTests.AddTest("MimeTests getHeader (case sensitivity)", getHeaderTest, [
    "test/data/01-plaintext.eml",
    "cONtEnt-lAngUage",
    "en-GB",
  ]);

  SLTests.AddTest(
    "MimeTests getHeader (multipart repeated header)",
    getHeaderTest,
    [
      "test/data/05-HTML+embedded-image.eml",
      "Content-Type",
      'multipart/related; boundary="------------B2BBD36A919AB2B2F84E2469"',
    ],
  );

  SLTests.AddTest(
    "MimeTests getHeader (multipart missing header)",
    getHeaderTest,
    [
      "test/data/05-HTML+embedded-image.eml",
      "Content-Transfer-Encoding",
      undefined,
    ],
  );

  SLTests.AddTest(
    "MimeTests getHeader (multipart invalid header)",
    getHeaderTest,
    ["test/data/21-plaintext.eml", "X-fake-header", undefined],
  );

  SLTests.AddTest(
    "MimeTests 21-plaintext.eml",
    () => {
      const original = fs.readFileSync("test/data/21-plaintext.eml", {
        encoding: "utf-8",
      });
      const expected = fs.readFileSync("test/data/21-plaintext.eml.out", {
        encoding: "utf-8",
      });
      let result = original;

      result = SLTools.replaceHeader(
        result,
        "X-Send-Later-[a-zA-Z0-9-]*",
        null,
        true,
      );

      if (result === expected) {
        return true;
      } else {
        const diffs = diff(result, expected);
        return `Replace headers failed with difference:\n${diffs}`;
      }
    },
    [],
  );

  SLTests.AddTest(
    "MimeTests 05-HTML+embedded-image.eml",
    (hdrstring, newvalue) => {
      const original = fs.readFileSync(
        "test/data/05-HTML+embedded-image.eml",
        {
          encoding: "utf-8",
        },
      );
      const expected = fs.readFileSync(
        "test/data/05-HTML+embedded-image.eml.out",
        { encoding: "utf-8" },
      );
      let result = original;

      function appendHeader(content, header, value) {
        const regex = new RegExp(
          `^${header}:([^\r\n]*)\r\n(\\s[^\r\n]*\r\n)*`,
          "im",
        );
        const hdrContent = content.split(/\r\n\r\n/m)[0] + "\r\n";
        const msgContent = content
          .split(/\r\n\r\n/m)
          .slice(1)
          .join("\r\n\r\n");
        if (regex.test(hdrContent)) {
          const values = hdrContent
            .match(regex)[0]
            .trim()
            .slice(header.length + 1)
            .trim()
            .split(/\r\n/)
            .map((s) => s.trim());
          values.push(value);
          const newHdrs = hdrContent.replace(
            regex,
            `${header}: ${values.join("\r\n ")}\r\n`,
          );
          return `${newHdrs.trim()}\r\n\r\n${msgContent}`;
        } else {
          return `${hdrContent.trim()}\r\n${header}: ${value}\r\n\r\n${msgContent}`;
        }
      }

      result = SLTools.appendHeader(
        result,
        hdrstring,
        "RANDOM INTERMEDIATE VALUE 1",
      );
      result = SLTools.appendHeader(
        result,
        hdrstring,
        "RANDOM INTERMEDIATE VALUE 2",
      );
      result = SLTools.appendHeader(
        result,
        hdrstring,
        "RANDOM INTERMEDIATE VALUE 3",
      );
      result = SLTools.replaceHeader(result, hdrstring, newvalue, true);

      if (result === expected) {
        return true;
      } else {
        const diffs = diff(result, expected);
        return `Replace headers failed with difference:\n${diffs}`;
      }
    },
    ["X-Send-Later-At", "Fri, 30 Oct 2020 18:28:18 -0700"],
  );
};
