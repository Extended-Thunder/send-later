exports.init = function() {
  // // Example
  // SLTests.AddTest("Test name", (input, expected) => {
  //   const result = input+"foobar";
  //   return (result === expected) ||`Expected "${expected}", got "${result}"`;
  // }, ['arg1','arg1foobar']);

  SLTests.AddTest("Test flattener", (input, expected) => {
    const result = SLStatic.flatten(input);
    return (JSON.stringify(result) === JSON.stringify(expected)) ||
      `Expected "${expected}", got "${result}"`;
  }, [ [[2,3,4,1],[1,5,2],[1],[44,4],[7]],
       [2,3,4,1,1,5,2,1,44,4,7] ]);

  SLTests.AddTest("Test unparseArgs", (input,expected) => {
    const result = SLStatic.unparseArgs(input);
    return (result === expected) || `Expected "${expected}", got "${result}"`;
  }, [[1,2,"foo",[1,"bar"], 6], '1, 2, "foo", [1, "bar"], 6']);

  function testEstimatedSendTime(scheduledDate, previousLoop, loopMinutes) {
    scheduledDate = SLStatic.floorDateTime(scheduledDate);

    let result = SLStatic.estimateSendTime(
      scheduledDate, previousLoop, loopMinutes);

    if (result.getTime() < Date.now())
      return `Estimated send time is in the past: ${result}`;

    if (result.getTime() < scheduledDate.getTime())
      return `Estimated send time is before scheduled send time: ${result}`;

    if (result.getTime()-scheduledDate.getTime() > loopMinutes*60000
        && result.getTime()-Date.now() > loopMinutes*60000)
      return `Estimated send time is > ${loopMinutes} past scheduled time.`;

    return true;
  }

  SLTests.AddTest("Test estimate send time", testEstimatedSendTime,
                  [new Date(), new Date(Date.now()), 1]);

  SLTests.AddTest("Test estimate send time 2", testEstimatedSendTime,
                  [new Date(), new Date(Date.now()-30e3), 1]);

  SLTests.AddTest("Test estimate send time 3", testEstimatedSendTime,
                  [new Date(), new Date(Date.now()-300e3), 1]);

  SLTests.AddTest("Test estimate send time 4", testEstimatedSendTime,
                  [new Date(), new Date(Date.now()-120e3), 5]);
}
