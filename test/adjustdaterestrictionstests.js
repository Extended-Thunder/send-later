exports.init = function() {
  function NormalTest(dt, start_time, end_time, days, expected) {
    const orig_dt = new Date(dt);
    let orig_days;
    if (days) {
      orig_days = days.slice();
    }
    const result = SLStatic.adjustDateForRestrictions(dt, start_time,
                                                      end_time, days);
    if (orig_dt.getTime() != dt.getTime()) {
      throw "adjustDateForRestrictions modified dt!";
    }
    if (orig_days && String(orig_days) != String(days)) {
      throw "AdjustedDateForRestrictions modified days!";
    }
    return (expected.getTime() == result.getTime()) ||
            `Expected ${expected}, got ${result}`;
  }

  SLTests.AddTest("adjustDateForRestrictions no-op", NormalTest,
                   [new Date("1/1/2016 10:37:00"), null, null, null,
                    new Date("1/1/2016 10:37:00")]);
  SLTests.AddTest("adjustDateForRestrictions before start", NormalTest,
                   [new Date("1/1/2016 05:30:37"), 830, 1700, null,
                    new Date("1/1/2016 08:30:37")]);
  SLTests.AddTest("adjustDateForRestrictions after end", NormalTest,
                   [new Date("1/1/2016 18:30:37"), 830, 1700, null,
                    new Date("1/2/2016 08:30:37")]);
  SLTests.AddTest("adjustDateForRestrictions OK time", NormalTest,
                   [new Date("1/1/2016 12:37:00"), 830, 1700, null,
                   new Date("1/1/2016 12:37:00")]);
  SLTests.AddTest("adjustDateForRestrictions start edge", NormalTest,
                   [new Date("1/1/2016 8:30:00"), 830, 1700, null,
                    new Date("1/1/2016 8:30:00")]);
  SLTests.AddTest("adjustDateForRestrictions end edge", NormalTest,
                   [new Date("1/1/2016 17:00:00"), 830, 1700, null,
                    new Date("1/1/2016 17:00:00")]);
  SLTests.AddTest("adjustDateForRestrictions OK day", NormalTest,
                   [new Date("1/1/2016 8:30:00"), null, null, [5],
                    new Date("1/1/2016 8:30:00")]);
  SLTests.AddTest("adjustDateForRestrictions later day", NormalTest,
                   [new Date("1/1/2016 8:30:00"), null, null, [6],
                    new Date("1/2/2016 8:30:00")]);
  SLTests.AddTest("adjustDateForRestrictions earlier day", NormalTest,
                   [new Date("1/1/2016 8:30:00"), null, null, [1, 2, 3],
                    new Date("1/4/2016 8:30:00")]);
}
