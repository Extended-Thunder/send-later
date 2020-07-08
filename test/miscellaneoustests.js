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

  SLTests.AddTest("Test dateTimeFormat", (input, expected) => {
    opts = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC',
      hour12: false };
    const result = SLStatic.dateTimeFormat(new Date(input),opts);
    return (result === expected) || `Expected "${expected}", got "${result}"`;
  }, [ "Sun Feb 01 1998 15:03:00 GMT+2", "Sun, Feb 1, 1998, 13:03:00" ]);

  function TestCompareTimes(a,comparison,b,expected) {
    a = new Date(a), b = new Date(b);
    const result = SLStatic.compareTimes(a,comparison,b);
    return (result === expected) || `Expected "${expected}", got "${result}"`;
  }

  SLTests.AddTest("Test compareTimes a < b", TestCompareTimes, [
    "8/31/2020, 05:00:00 AM", "<", "8/30/2020, 07:00:00 AM", true
  ]);
  SLTests.AddTest("Test compareTimes a >= b", TestCompareTimes, [
    "8/31/2020, 05:00:00 AM", "<=", "8/30/2020, 05:00:00 AM", true
  ]);
  SLTests.AddTest("Test compareTimes a > b", TestCompareTimes, [
    "8/31/2020, 05:15:00 PM", ">", "8/30/2020, 05:00:00 AM", true
  ]);
  SLTests.AddTest("Test compareTimes a >= b", TestCompareTimes, [
    "8/31/2020, 05:15:00 PM", ">=", "8/30/2020, 05:15:00 AM", true
  ]);
  SLTests.AddTest("Test compareTimes a === b", TestCompareTimes, [
    "8/31/2019, 05:01:00 PM", "===", "8/30/2020, 05:01:00 PM", true
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
}