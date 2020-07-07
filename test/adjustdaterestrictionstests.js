exports.init = function() {
  function NormalTest(dt, start_time, end_time, days, expected) {
    const orig_dt = new Date(dt);
    let orig_days;
    if (days) {
      orig_days = days.slice();
    }
    start_time = new Date(0,0,0,Math.floor(start_time / 100), start_time%100);
    end_time = new Date(0,0,0,Math.floor(end_time / 100), end_time%100);
    const result = SLStatic.AdjustDateForRestrictions(dt, start_time,
                                                      end_time, days);
    if (orig_dt.getTime() != dt.getTime()) {
      throw "AdjustDateForRestrictions modified dt!";
    }
    if (orig_days && String(orig_days) != String(days)) {
      throw "AdjustedDateForRestrictions modified days!";
    }
    return expected.getTime() == result.getTime();
  }

  SLTests.AddTest("AdjustDateForRestrictions no-op", NormalTest,
                   [new Date("1/1/2016 10:37:00"), null, null, null,
                    new Date("1/1/2016 10:37:00")]);
  SLTests.AddTest("AdjustDateForRestrictions before start", NormalTest,
                   [new Date("1/1/2016 05:30:37"), 830, 1700, null,
                    new Date("1/1/2016 08:30:37")]);
  SLTests.AddTest("AdjustDateForRestrictions after end", NormalTest,
                   [new Date("1/1/2016 18:30:37"), 830, 1700, null,
                    new Date("1/2/2016 08:30:37")]);
  SLTests.AddTest("AdjustDateForRestrictions OK time", NormalTest,
                   [new Date("1/1/2016 12:37:00"), 830, 1700, null,
                   new Date("1/1/2016 12:37:00")]);
  SLTests.AddTest("AdjustDateForRestrictions start edge", NormalTest,
                   [new Date("1/1/2016 8:30:00"), 830, 1700, null,
                    new Date("1/1/2016 8:30:00")]);
  SLTests.AddTest("AdjustDateForRestrictions end edge", NormalTest,
                   [new Date("1/1/2016 17:00:00"), 830, 1700, null,
                    new Date("1/1/2016 17:00:00")]);
  SLTests.AddTest("AdjustDateForRestrictions OK day", NormalTest,
                   [new Date("1/1/2016 8:30:00"), null, null, [5],
                    new Date("1/1/2016 8:30:00")]);
  SLTests.AddTest("AdjustDateForRestrictions later day", NormalTest,
                   [new Date("1/1/2016 8:30:00"), null, null, [6],
                    new Date("1/2/2016 8:30:00")]);
  SLTests.AddTest("AdjustDateForRestrictions earlier day", NormalTest,
                   [new Date("1/1/2016 8:30:00"), null, null, [1, 2, 3],
                    new Date("1/4/2016 8:30:00")]);
}
