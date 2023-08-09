exports.init = function () {
  function CompareRecurs(a, b) {
    if (!a && !b) return true;
    if (!a || !b) return false;
    if (a.type != b.type) return false;
    if (!a.monthly_day != !b.monthly_day) return false;
    if (
      a.monthly_day &&
      (a.monthly_day.day != b.monthly_day.day ||
        a.monthly_day.week != b.monthly_day.week)
    )
      return false;
    if (a.monthly != b.monthly) return false;
    if (!a.yearly != !b.yearly) return false;
    if (
      a.yearly &&
      (a.yearly.month != b.yearly.month || a.yearly.date != b.yearly.date)
    )
      return false;
    if (a.function != b.function) return false;
    if (a.multiplier != b.multiplier) return false;
    if (!a.between != !b.between) return false;
    if (
      a.between &&
      (a.between.start != b.between.start || a.between.end != b.between.end)
    )
      return false;
    if (!a.days != !b.days) return false;
    if (String(a.days) != String(b.days)) return false;
    return true;
  }

  function ParseRecurGoodTest(spec, expected) {
    const out = SLStatic.parseRecurSpec(spec);
    if (CompareRecurs(out, expected)) {
      return true;
    } else {
      return (
        "expected " + JSON.stringify(expected) + ", got " + JSON.stringify(out)
      );
    }
  }

  const goodTests = [
    ["none", { type: "none" }],
    ["minutely", { type: "minutely" }],
    ["daily", { type: "daily" }],
    ["weekly", { type: "weekly" }],
    ["monthly 3", { type: "monthly", monthly: 3 }],
    ["monthly 0 3", { type: "monthly", monthly_day: { day: 0, week: 3 } }],
    ["yearly 10 5", { type: "yearly", yearly: { month: 10, date: 5 } }],
    ["function froodle", { type: "function", function: "froodle" }],
    ["minutely / 5", { type: "minutely", multiplier: 5 }],
    [
      "minutely between 830 1730",
      {
        type: "minutely",
        between: {
          start: "830",
          end: "1730",
        },
      },
    ],
    ["minutely on 1 2 3 4 5", { type: "minutely", days: [1, 2, 3, 4, 5] }],
  ];

  for (let test of goodTests) {
    SLTests.AddTest("parseRecurSpec " + test[0], ParseRecurGoodTest, test);
  }

  for (let test of goodTests) {
    SLTests.AddTest(
      `parseUnparseRecurSpec ${test[0]}`,
      (spec) => {
        const parsed = SLStatic.parseRecurSpec(spec);
        const unparsed = SLStatic.unparseRecurSpec(parsed);
        return (
          spec === `${unparsed}` || `Expected "${spec}", got "${unparsed}"`
        );
      },
      test,
    );
  }

  function ParseRecurBadTest(spec, expected) {
    try {
      const out = SLStatic.parseRecurSpec(spec);
      return "expected exception, got " + JSON.stringify(out);
    } catch (ex) {
      if ((ex + "").indexOf(expected) === -1) {
        return "exception " + ex + " did not match " + expected;
      } else {
        return true;
      }
    }
  }

  const badTests = [
    ["bad-recurrence-type", "Invalid recurrence type"],
    ["none extra-arg", "Extra arguments"],
    ["monthly bad", "Invalid first monthly argument"],
    ["monthly 7 3", "Invalid monthly day argument"],
    ["monthly 4 6", "Invalid monthly week argument"],
    ["monthly 32", "Invalid monthly date argument"],
    ["yearly bad", "Invalid first yearly argument"],
    ["yearly 10 bad", "Invalid second yearly argument"],
    ["yearly 20 3", "Invalid yearly date"],
    ["yearly 10 31", "Invalid yearly date"],
    ["yearly 01 30", "Invalid yearly date"],
    ["yearly 10 40", "Invalid yearly date"],
    ["function", "Invalid function recurrence spec"],
    ["function foo bar", "Extra arguments"],
    ["daily / bad", "Invalid multiplier argument"],
    ["minutely between 11111 1730", "Invalid between start"],
    ["daily between 1100 17305", "Invalid between end"],
    ["daily extra-argument", "Extra arguments"],
    ["minutely on bad", "Day restriction with no days"],
    ["minutely on", "Day restriction with no days"],
    ["minutely on 8", "Bad restriction day"],
  ];
  for (const test of badTests) {
    SLTests.AddTest("parseRecurSpec " + test[0], ParseRecurBadTest, test);
  }
};
