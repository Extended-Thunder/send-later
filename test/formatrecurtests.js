exports.init = function() {
  function FormatRecurTest(spec, expected) {
    const out = SLStatic.FormatRecur(spec);
    if (out == expected) {
      return true;
    } else {
      return "expected " + expected + ", got " + out;
    }
  }

  const tests = [
    ["minutely", "minutely"],
    ["daily", "daily"],
    ["weekly", "weekly"],
    ["monthly 3", "monthly"],
    ["monthly 0 3", "monthly, 3rd Sunday"],
    ["yearly 10 5", "yearly"],
    ["function froodle", "function"],
    ["minutely / 5", "every 5 minutes"],
    ["minutely between 830 1730", "minutely betw. 8:30 and 17:30"],
    ["minutely on 1 2 3", "minutely on Monday, Tuesday, Wednesday"]
  ];
  for (const test of tests) {
    SLTests.AddTest("FormatRecur " + test[0], FormatRecurTest, test);
  }
}
