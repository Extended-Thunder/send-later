exports.init = function () {
  function FormatRecurTest(spec, expected) {
    const recur = SLStatic.parseRecurSpec(spec);
    const out = SLStatic.formatRecurForUI(recur).replace(/\n/g, " ");
    if (out == expected) {
      return true;
    } else {
      return `expected "${expected}", got "${out}"`;
    }
  }

  const tests = [
    ["none", ""],
    ["none between 730 1930", ""],
    ["none on 1 3 5", ""],
    ["none between 100 600 on 1 3 6", ""],
    ["minutely", "Recur minutely"],
    ["daily", "Recur daily"],
    ["weekly", "Recur weekly"],
    ["monthly 3", "Recur monthly"],
    ["monthly 0 3", "Recur monthly, 3rd Sunday of the month"],
    ["yearly 10 5", "Recur yearly"],
    ["function froodle", "Recur according to function “froodle”"],
    ["minutely / 5", "Recur every 5 minutes"],
    ["minutely between 830 1730", "Recur minutely betw. 8:30 and 17:30"],
    [
      "minutely on 1 2 3",
      "Recur minutely Only on Monday, Tuesday, and Wednesday",
    ],
    ["none until 2021-09-16T16:16:24.397Z", ""],
    ["none between 730 1930 until 2021-09-16T16:16:24.397Z", ""],
    ["none until 2021-09-16T16:16:24.397Z on 1 3 5", ""],
    ["none between 100 600 on 1 3 6 until 2021-09-16T16:16:24.397Z", ""],
    [
      "minutely until 2021-09-16T16:16:24.397Z",
      "Recur minutely until 9/16/2021, 9:16 AM",
    ],
    [
      "daily until 2021-09-16T16:16:24.397Z",
      "Recur daily until 9/16/2021, 9:16 AM",
    ],
    [
      "weekly until 2021-09-16T16:16:24.397Z",
      "Recur weekly until 9/16/2021, 9:16 AM",
    ],
    [
      "monthly 3 until 2021-09-16T16:16:24.397Z",
      "Recur monthly until 9/16/2021, 9:16 AM",
    ],
    [
      "monthly 0 3 until 2021-09-16T16:16:24.397Z",
      "Recur monthly, 3rd Sunday of the month until 9/16/2021, 9:16 AM",
    ],
    [
      "yearly 10 5 until 2021-09-16T16:16:24.397Z",
      "Recur yearly until 9/16/2021, 9:16 AM",
    ],
    [
      "function froodle until 2021-09-16T16:16:24.397Z",
      "Recur according to function “froodle” until 9/16/2021, 9:16 AM",
    ],
    [
      "minutely / 5 until 2021-09-16T16:16:24.397Z",
      "Recur every 5 minutes until 9/16/2021, 9:16 AM",
    ],
    [
      "minutely until 2021-09-16T16:16:24.397Z between 830 1730",
      "Recur minutely betw. 8:30 and 17:30 until 9/16/2021, 9:16 AM",
    ],
    [
      "minutely on 1 2 3 until 2021-09-16T16:16:24.397Z",
      "Recur minutely Only on Monday, Tuesday, and Wednesday until 9/16/2021, 9:16 AM",
    ],
  ];
  for (const test of tests) {
    SLTests.AddTest("FormatRecur " + test[0], FormatRecurTest, test);
  }
};
