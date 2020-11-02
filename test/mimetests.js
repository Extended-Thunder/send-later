exports.init = function() {
  const fs = require('fs');
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
      const original = fs.readFileSync("test/data/01-plaintext.eml", {encoding: 'utf-8'});
      const expected = fs.readFileSync("test/data/01-plaintext.eml.out", {encoding: 'utf-8'});
      let result = original;

      result = SLStatic.replaceHeader(result, hdrstring, newvalue, false);

      if (result === expected) {
        return true;
      } else {
        const diffs = diff(result, expected);
        return `Replace headers failed with difference:\n${diffs}`;
      }
    },
    ["Subject", "new subject"]
  );

  SLTests.AddTest(
    "MimeTests 21-plaintext.eml",
    () => {
      const original = fs.readFileSync("test/data/21-plaintext.eml", {encoding: 'utf-8'});
      const expected = fs.readFileSync("test/data/21-plaintext.eml.out", {encoding: 'utf-8'});
      let result = original;

      result = SLStatic.replaceHeader(result, "X-Send-Later-[a-zA-Z0-9\-]*", null, true);

      if (result === expected) {
        return true;
      } else {
        const diffs = diff(result, expected);
        return `Replace headers failed with difference:\n${diffs}`;
      }
    },
    []
  );

  SLTests.AddTest(
    "MimeTests 05-HTML+embedded-image.eml",
    (hdrstring, newvalue) => {
      const original = fs.readFileSync("test/data/05-HTML+embedded-image.eml", {encoding: 'utf-8'});
      const expected = fs.readFileSync("test/data/05-HTML+embedded-image.eml.out", {encoding: 'utf-8'});
      let result = original;

      SLStatic.appendHeader(result, hdrstring, "RANDOM INTERMEDIATE VALUE 1");
      result = SLStatic.appendHeader(result, hdrstring, "RANDOM INTERMEDIATE VALUE 2");
      result = SLStatic.replaceHeader(result, hdrstring, newvalue, true);

      if (result === expected) {
        return true;
      } else {
        const diffs = diff(result, expected);
        return `Replace headers failed with difference:\n${diffs}`;
      }
    },
    ["X-Send-Later-At", "Fri, 30 Oct 2020 18:28:18 -0700"]
  );
}