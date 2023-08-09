exports.init = function() {
  // // Example
  // SLTests.AddTest("Test name", (input, expected) => {
  //   const result = input+"foobar";
  //   return (result === expected) ||`Expected "${expected}", got "${result}"`;
  // }, ['arg1','arg1foobar']);

  function testParseableDateTimeFormat(name, input, output) {
    SLTests.AddTest(name, () => {
      const result = SLStatic.parseableDateTimeFormat(new Date(input));
      return result == output || `Expected "${output}", got "${result}"`;
    }, []);
  }

  testParseableDateTimeFormat(
    "Test parseableDateTimeFormat (raw) 1",
    "Jan 1 1998 04:03", "Thu, 1 Jan 1998 04:03:00 -0800");
  testParseableDateTimeFormat(
    "Test parseableDateTimeFormat (raw) 2",
    "Sun Feb 29 2000 15:03:00 GMT+2", "Tue, 29 Feb 2000 05:03:00 -0800");
  testParseableDateTimeFormat(
    "Test parseableDateTimeFormat (raw) 3",
    "Sun Mar 01 1998 15:03:00 GMT+2", "Sun, 1 Mar 1998 05:03:00 -0800");
  testParseableDateTimeFormat(
    "Test parseableDateTimeFormat (raw) 4",
    "Wed Apr 01 1998 15:03:00 GMT+2", "Wed, 1 Apr 1998 05:03:00 -0800");
  testParseableDateTimeFormat(
    "Test parseableDateTimeFormat (raw) 5",
    "May 1 1998 04:03", "Fri, 1 May 1998 04:03:00 -0700");
  testParseableDateTimeFormat(
    "Test parseableDateTimeFormat (raw) 6",
    "June 1 1998 04:03", "Mon, 1 Jun 1998 04:03:00 -0700");
  testParseableDateTimeFormat(
    "Test parseableDateTimeFormat (raw) 7",
    "July 1 1998 04:03", "Wed, 1 Jul 1998 04:03:00 -0700");
  testParseableDateTimeFormat(
    "Test parseableDateTimeFormat (raw) 8",
    "August 1 1998 04:03", "Sat, 1 Aug 1998 04:03:00 -0700");
  testParseableDateTimeFormat(
    "Test parseableDateTimeFormat (raw) 9",
    "September 1 1998 04:03", "Tue, 1 Sep 1998 04:03:00 -0700");
  testParseableDateTimeFormat(
    "Test parseableDateTimeFormat (raw) 10",
    "Oct 1 1998 04:03", "Thu, 1 Oct 1998 04:03:00 -0700");
  testParseableDateTimeFormat(
    "Test parseableDateTimeFormat (raw) 11",
    "Nov 1 1998 04:03", "Sun, 1 Nov 1998 04:03:00 -0800");
  testParseableDateTimeFormat(
    "Test parseableDateTimeFormat (raw) 12",
    "Dec 1 2098 04:03", "Mon, 1 Dec 2098 04:03:00 -0800");

  SLTests.AddTest("Test parseableDateTimeFormat (half-hour tz)", () => {
    let d = new Date('"Mon, 6 Sep 2021 07:28:10 -0700"');
    d.getTimezoneOffset = () => -570;
    let expected = "Mon, 6 Sep 2021 07:28:10 +0930";
    let result = SLStatic.RFC5322.format(d);
    return result == expected || `Expected "${expected}", got "${result}"`;
  }, []);

  SLTests.AddTest("Test parseableDateTimeFormat (quarter-hour tz)", () => {
    let d = new Date('"Mon, 6 Sep 2021 07:28:10 -0700"');
    d.getTimezoneOffset = () => 555;
    let expected = "Mon, 6 Sep 2021 07:28:10 -0915";
    let result = SLStatic.RFC5322.format(d);
    return result == expected || `Expected "${expected}", got "${result}"`;
  }, []);

  SLTests.AddTest("Timezone offset UTC +0000", () => {
    let d = new Date();
    d.getTimezoneOffset = () => 0;
    let result = SLStatic.RFC5322.tz(d);
    return result === '+0000' || `Expected "+0000", got "${result}"`;
  }, []);

  SLTests.AddTest("Local timezone offset comparison", () => {
    let d = new Date();
    let rfc = SLStatic.RFC5322.tz(d);
    let match = d.toString().match(/[+-]\d\d\d\d/);
    if (!match)
      return `Unable to parse date string: ${d.toString()}`;
    else
      return(rfc === match[0] ||
             `Timezone offset does not match: "${rfc}" != "${match[0]}"`);
  }, []);

  SLTests.AddTest("Timezone offset positive/negative", () => {
    for (let m=1; m<12*60; m+=1) {
      let d = new Date();

      d.getTimezoneOffset = () => m;
      let tz = SLStatic.RFC5322.tz(d);
      let sign = tz.substr(0,1);
      let hr = tz.substr(1,2)|0;
      let min = tz.substr(3,2)|0;
      if (sign != '-')
        return `Incorrect sign: ${tz}`;
      if (hr < 0 || hr > 12)
        return `Invalid hour: ${tz}`;
      if (min < 0 || min > 59)
        return `Invalid minute: ${tz}`;
      if (m != hr*60 + min)
        return `Invalid timezone offset: ${tz} (${m} minutes)`;

      d.getTimezoneOffset = () => -m;
      let tz2 = SLStatic.RFC5322.tz(d);
      if (tz2 != '+'+tz.substr(1))
        return `Invalid tz comparison: ${tz} vs ${tz2}`;
    }
    return true;
  }, []);

  SLTests.AddTest("RFC5322 short weekday names", () => {
    let d = new Date();
    let days = ["Sun", "Mon", "Tue", "Wed",
                "Thu", "Fri", "Sat"];

    for (let wd=0; wd<days.length; wd++) {
      d.getDay = () => wd;
      let result = SLStatic.RFC5322.dayOfWeek(d);
      if (result !== days[wd])
        return `Incorrect day of week. Expected "${days[wd]}", got "${result}"`;
    }
    return true;
  }, []);

  SLTests.AddTest("RFC5322 short month names", () => {
    let d = new Date();
    let months = ["Jan", "Feb", "Mar", "Apr",
                  "May", "Jun", "Jul", "Aug",
                  "Sep", "Oct", "Nov", "Dec"];

    for (let mo=0; mo<months.length; mo++) {
      d.getMonth = () => mo;
      let result = SLStatic.RFC5322.month(d);
      if (result !== months[mo])
        return `Incorrect weekday. Expected "${months[mo]}", got "${result}"`;
    }
    return true;
  }, []);

  SLTests.AddTest(
    "Test parseableDateTimeFormat (current time fallback)", () => {
      const result = SLStatic.parseableDateTimeFormat();
      const expected = SLStatic.parseableDateTimeFormat(Date.now());
      return SLStatic.compareDateTimes(result, "==", expected, 100) ||
        `Expected "${expected}", got "${result}"`;
    }, []);

  SLTests.AddTest(
    "Test parseableDateTimeFormat (relative time string)", () => {
      const result = SLStatic.parseableDateTimeFormat("1 minute from now");
      const expected = SLStatic.parseableDateTimeFormat(
        new Date(Date.now() + 60000));
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

  SLTests.AddTest("Test customHumanDateTimeFormat", (input, expected) => {
    const result = SLStatic.customHumanDateTimeFormat(
      new Date(input[0]), input[1]);
    return result == expected ||
      `Expected "${expected}", got "${result}"`;
  }, [
    ["Sun Feb 01 1998 15:03:00 GMT+2", "%Y-%m-%d %H:%M"],
    "1998-02-01 05:03" ]);

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
  SLTests.AddTest(
    "Test compareDateTimes a < b differentmonth", TestComparison, [
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

  SLTests.AddTest(
    "Test convertDate (text string relative)", (input,expected) => {
      const result = SLStatic.convertDate(input, false);
      return SLStatic.compareDateTimes(result, "==", expected, 100) ||
        `Expected "${expected.getTime()}", got "${result.getTime()}"`;
    }, ['in 1 minute', new Date(Date.now()+60000)]);

  SLTests.AddTest(
    "Test convertDate (text string absolute)", (input,expected) => {
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

  SLTests.AddTest(
    "Test relativeDateFormat '1 hour ago'", compareRelativeTime, [
      new Date(Date.now()-3600*1000), null, "1 hour ago"
    ]);

  SLTests.AddTest(
    "Test relativeDateFormat '1 hour from now'", compareRelativeTime, [
      new Date(Date.now()+3600*1000), null, "1 hour from now"
    ]);

  SLTests.AddTest("Test relativeDateFormat '1 day ago'", compareRelativeTime, [
    new Date(Date.now()-3600*24*1000), null, "1 day ago"
  ]);

  SLTests.AddTest(
    "Test relativeDateFormat '7.5 hours from now'", compareRelativeTime, [
      new Date(Date.now()+3600*7.5*1000), null, "7.5 hours from now"
    ]);

  SLTests.AddTest(
    "Test relativeDateFormat '0 seconds from now'", compareRelativeTime, [
      new Date(Date.now()), null, "0 seconds from now"
    ]);

  SLTests.AddTest(
    "Test relativeDateFormat '364 days from now'", compareRelativeTime, [
      new Date(Date.now()+364*24*3600*1000), null, "364 days from now"
    ]);

  SLTests.AddTest(
    "Test relativeDateFormat (364.5 days) -> '1 year from now'",
    compareRelativeTime, [
      new Date(Date.now()+364.5*24*3600*1000), null, "1 year from now"
    ]);

  SLTests.AddTest(
    "Test relativeDateFormat (90 seconds) -> '1.5 minutes from now'",
    compareRelativeTime, [
      new Date(Date.now()+90*1000), null, "1.5 minutes from now"
    ]);
}
