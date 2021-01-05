const Sugar = require("../utils/sugar-custom");

exports.init = function() {
  // Example
  SLTests.AddTest("Test name", (input, expected) => {
    const result = input+"foobar";
    return (result === expected) || `Expected "${expected}", got "${result}"`;
  }, ['arg1','arg1foobar']);

  SLTests.AddTest("Test flattener", (input, expected) => {
    const result = SLStatic.flatten(input);
    return (JSON.stringify(result) === JSON.stringify(expected)) ||
            `Expected "${expected}", got "${result}"`;
  }, [ [[2,3,4,1],[1,5,2],[1],[44,4],[7]],
       [2,3,4,1,1,5,2,1,44,4,7] ]);

  SLTests.AddTest("Test parseableDateTimeFormat (plain)", (input, expected) => {
    const result = SLStatic.parseableDateTimeFormat(new Date(input));
    return result == expected ||
          `Expected "${expected}", got "${result}"`;
  }, [ "Sun Feb 01 1998 15:03:00 GMT+2", "Sun, 01 Feb 1998 05:03:00 -0800" ]);

  SLTests.AddTest("Test parseableDateTimeFormat (current time fallback)", () => {
    const result = SLStatic.parseableDateTimeFormat();
    const expected = SLStatic.parseableDateTimeFormat(Date.now());
    return SLStatic.compareDateTimes(result, "==", expected, 100) ||
          `Expected "${expected}", got "${result}"`;
  }, []);

  SLTests.AddTest("Test parseableDateTimeFormat (relative time string)", () => {
    const result = SLStatic.parseableDateTimeFormat("1 minute from now");
    const expected = SLStatic.parseableDateTimeFormat(new Date(Date.now()+60000));
    return SLStatic.compareDateTimes(result, "==", expected, 100) ||
          `Expected "${expected}", got "${result}"`;
  }, []);

  SLTests.AddTest("Test humanDateTimeFormat", (input, expected) => {
    const result = SLStatic.humanDateTimeFormat(new Date(input));
    return result == expected ||
          `Expected "${expected}", got "${result}"`;
  }, [ "Sun Feb 01 1998 15:03:00 GMT+2", "Sun, Feb 1, 1998, 5:03 AM" ]);

  SLTests.AddTest("Test shortHumanDateTimeFormat", (input, expected) => {
    const result = SLStatic.shortHumanDateTimeFormat(new Date(input));
    return result == expected ||
          `Expected "${expected}", got "${result}"`;
  }, [ "Sun Feb 01 1998 15:03:00 GMT+2", "2/1/1998, 5:03 AM" ]);

  SLTests.AddTest("Test getWkdayName Sunday", (input, expected) => {
    const result = SLStatic.getWkdayName(input[0], input[1]);
    return result == expected ||
          `Expected "${expected}", got "${result}"`;
  }, [ [0, null], "Sunday" ]);

  SLTests.AddTest("Test getWkdayName Tuesday long", (input, expected) => {
    const result = SLStatic.getWkdayName(input[0], input[1]);
    return result == expected ||
          `Expected "${expected}", got "${result}"`;
  }, [ [2, "long"], "Tuesday" ]);

  SLTests.AddTest("Test getWkdayName Wednesday short", (input, expected) => {
    const result = SLStatic.getWkdayName(input[0], input[1]);
    return result == expected ||
          `Expected "${expected}", got "${result}"`;
  }, [ [3, "short"], "Wed" ]);

  SLTests.AddTest("Test formatTime from number", (input, expected) => {
    const result = SLStatic.formatTime(input[0], input[1]);
    return result == expected ||
          `Expected "${expected}", got "${result}"`;
  }, [ [(new Date(2020,5,3,6,55)).getTime(), true], "0655" ]);

  SLTests.AddTest("Test formatTime from date", (input, expected) => {
    const result = SLStatic.formatTime(input[0], input[1]);
    return result == expected ||
          `Expected "${expected}", got "${result}"`;
  }, [ [(new Date(2020,5,3,6,5)), false], "605" ]);

  SLTests.AddTest("Test formatTime from string", (input, expected) => {
    const result = SLStatic.formatTime(input[0], input[1]);
    return result == expected ||
          `Expected "${expected}", got "${result}"`;
  }, [ ["4:02", true], "0402" ]);

  function TestComparison(func,a,comparison,b,ignoreSec,expected) {
    a = new Date(a), b = new Date(b);
    const result = func(a,comparison,b,ignoreSec);
    return (result === expected) || `Expected "${expected}", got "${result}"`;
  }

  SLTests.AddTest("Test compareTimes a < b", TestComparison, [
    SLStatic.compareTimes,
    "8/31/2020, 05:00:00 AM", "<", "8/30/2020, 07:00:00 AM", false, true
  ]);
  SLTests.AddTest("Test compareTimes a >= b", TestComparison, [
    SLStatic.compareTimes,
    "8/31/2020, 05:00:00 AM", "<=", "8/30/2020, 05:00:00 AM", false, true
  ]);
  SLTests.AddTest("Test compareTimes a > b", TestComparison, [
    SLStatic.compareTimes,
    "8/31/2020, 05:15:00 PM", ">", "8/30/2020, 05:00:00 AM", false, true
  ]);
  SLTests.AddTest("Test compareTimes a >= b", TestComparison, [
    SLStatic.compareTimes,
    "8/31/2020, 05:15:00 PM", ">=", "8/30/2020, 05:15:00 AM", false, true
  ]);
  SLTests.AddTest("Test compareTimes a === b", TestComparison, [
    SLStatic.compareTimes,
    "8/31/2019, 05:01:00 PM", "===", "8/30/2020, 05:01:00 PM", false, true
  ]);
  SLTests.AddTest("Test compareDates a < b differentmonth", TestComparison, [
    SLStatic.compareDates,
    "7/31/2020, 09:01:00 AM", "<", "8/01/2020, 05:01:00 AM", null, true
  ]);
  SLTests.AddTest("Test compareDates ! a == b false", TestComparison, [
    SLStatic.compareDates,
    "7/31/2020, 09:01:00 AM", "==", "8/01/2020, 05:01:00 AM", null, false
  ]);
  SLTests.AddTest("Test compareDates a == b false", TestComparison, [
    SLStatic.compareDates,
    "7/31/2020, 09:01:00 AM", "==", "7/31/2020, 05:01:00 AM", null, true
  ]);
  SLTests.AddTest("Test compareDateTimes a === b !ignoreSec", TestComparison, [
    SLStatic.compareDateTimes,
    "7/31/2020, 09:00:00 AM", "===", "7/31/2020, 09:00:20 AM", false, false
  ]);
  SLTests.AddTest("Test compareDateTimes a === b ignoreSec", TestComparison, [
    SLStatic.compareDateTimes,
    "7/31/2020, 09:00:00 AM", "===", "7/31/2020, 09:00:20 AM", true, true
  ]);
  SLTests.AddTest("Test compareDateTimes a < b differentmonth", TestComparison, [
    SLStatic.compareDateTimes,
    "7/31/2020, 09:01:00 AM", "<", "8/01/2020, 05:01:00 AM", false, true
  ]);

  SLTests.AddTest("Test parseDateTime", (dstr,tstr,expected) => {
    const result = SLStatic.parseDateTime(dstr,tstr);
    return (result.getTime() === expected.getTime()) ||
            `Expected "${expected}", got "${result}"`;
  }, ['2015/01/17','0130', new Date(2015,0,17,1,30)]);

  SLTests.AddTest("Test parseDateTime (time only)", (input,expected) => {
    const result = SLStatic.parseDateTime(null,input);
    return (result.getTime() === expected.getTime()) ||
            `Expected "${expected}", got "${result}"`;
  }, ['1:30', new Date(0,0,0,1,30)]);

  SLTests.AddTest("Test unparseArgs", (input,expected) => {
    const result = SLStatic.unparseArgs(input);
    return (result === expected) || `Expected "${expected}", got "${result}"`;
  }, [[1,2,"foo",[1,"bar"], 6], '1, 2, "foo", [1, "bar"], 6']);

  SLTests.AddTest("Test convertDate (text string relative)", (input,expected) => {
    const result = SLStatic.convertDate(input, false);
    return SLStatic.compareDateTimes(result, "==", expected, 100) ||
            `Expected "${expected.getTime()}", got "${result.getTime()}"`;
  }, ['in 1 minute', new Date(Date.now()+60000)]);

  SLTests.AddTest("Test convertDate (text string absolute)", (input,expected) => {
    const result = SLStatic.convertDate(input);
    return SLStatic.compareDateTimes(result, "==", expected, 100) ||
            `Expected "${expected.getTime()}", got "${result.getTime()}"`;
  }, ["8/01/2020, 05:01:00 AM", new Date("8/01/2020, 05:01:00 AM")]);

  SLTests.AddTest("Test convertDate (number)", (input,expected) => {
    const result = SLStatic.convertDate(input);
    return SLStatic.compareDateTimes(result, "==", expected, 100) ||
            `Expected "${expected}", got "${result}"`;
  }, [Date.now(), new Date()]);

  SLTests.AddTest("Test convertDate (Date)", (input,expected) => {
    const result = SLStatic.convertDate(input);
    return SLStatic.compareDateTimes(result, "==", expected, 100) ||
            `Expected "${expected}", got "${result}"`;
  }, [new Date(), new Date()]);

  function compareRelativeTime(dateTime, relativeTo, expected) {
    const result = SLStatic.formatRelative(dateTime, relativeTo);
    return result === expected || `Expected "${expected}", got "${result}"`;
  }

  SLTests.AddTest("Test relativeDateFormat '1 hour ago'", compareRelativeTime, [
    new Date(Date.now()-3600*1000), null, "1 hour ago"
  ]);

  SLTests.AddTest("Test relativeDateFormat '1 hour from now'", compareRelativeTime, [
    new Date(Date.now()+3600*1000), null, "1 hour from now"
  ]);

  SLTests.AddTest("Test relativeDateFormat '1 day ago'", compareRelativeTime, [
    new Date(Date.now()-3600*24*1000), null, "1 day ago"
  ]);

  SLTests.AddTest("Test relativeDateFormat '7.5 hours from now'", compareRelativeTime, [
    new Date(Date.now()+3600*7.5*1000), null, "7.5 hours from now"
  ]);

  SLTests.AddTest("Test relativeDateFormat '0 seconds from now'", compareRelativeTime, [
    new Date(Date.now()), null, "0 seconds from now"
  ]);

  SLTests.AddTest("Test relativeDateFormat '364 days from now'", compareRelativeTime, [
    new Date(Date.now()+364*24*3600*1000), null, "364 days from now"
  ]);

  SLTests.AddTest("Test relativeDateFormat (364.5 days) -> '1 year from now'", compareRelativeTime, [
    new Date(Date.now()+364.5*24*3600*1000), null, "1 year from now"
  ]);

  SLTests.AddTest("Test relativeDateFormat (90 seconds) -> '1 minute from now'", compareRelativeTime, [
    new Date(Date.now()+90*1000), null, "1 minute from now"
  ]);
}
