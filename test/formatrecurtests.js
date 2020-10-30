exports.init = function() {
  function FormatRecurTest(spec, expected) {
    const recur = SLStatic.parseRecurSpec(spec);
    const out = SLStatic.formatRecurForUI(recur).replace(/\n/g," ");;
    if (out == expected) {
      return true;
    } else {
      return `expected "${expected}", got "${out}"`;
    }
  }

  const tests = [
    ["minutely", "Recur minutely"],
    ["daily", "Recur daily"],
    ["weekly", "Recur weekly"],
    ["monthly 3", "Recur monthly"],
    ["monthly 0 3", "Recur every 3rd Sunday"],
    ["yearly 10 5", "Recur yearly"],
    ["function froodle", 'Recur according to function “froodle”'],
    ["minutely / 5", "Recur every 5 minutes"],
    ["minutely between 830 1730", "Recur minutely betw. 8:30 and 17:30"],
    ["minutely on 1 2 3", "Recur minutely on Monday, Tuesday, and Wednesday"]
  ];
  for (const test of tests) {
    SLTests.AddTest("FormatRecur " + test[0], FormatRecurTest, test);
  }
}
