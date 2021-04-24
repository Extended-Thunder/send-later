exports.init = function() {
    function popupDOMTest(headers, expected) {
      const result = SLStatic.parseHeadersForPopupUICache(headers);
      return (DeepCompare(result, expected) ||
              `expected ${ObjToStr(expected)}", got "${ObjToStr(result)}"`);
    }

    SLTests.AddTest("popupCacheTest simple-norecur", popupDOMTest, [
      {
        'x-send-later-at': '2021-01-22T15:31',
        'x-send-later-recur': 'none'
      },
      {
        'send-datetime': "1/22/2021, 3:31 PM",
        'once': true,
        'minutely': false,
        'daily': false,
        'weekly': false,
        'monthly': false,
        'yearly': false,
        'function': false
      }
    ]);

    SLTests.AddTest("popupDOMTest recur every 3 days", popupDOMTest, [
      {
        'x-send-later-at': 'Fri, 22 Jan 2021 15:31:00 -0800',
        'x-send-later-recur': 'daily / 3'
      },
      {
        'send-datetime': "1/22/2021, 3:31 PM",
        'once': false,
        'minutely': false,
        'daily': true,
        'weekly': false,
        'monthly': false,
        'yearly': false,
        'function': false,
        'recur-cancelonreply': false,
        'recur-multiplier': 3,
        'recur-function-args': "",
        'sendbetween': false,
        'sendon': false
      }
    ]);

    SLTests.AddTest("popupDOMTest recur every other month on the second Friday", popupDOMTest, [
      {
        'x-send-later-at': 'Fri, 22 Jan 2021 15:31:00 -0800',
        'x-send-later-recur': 'monthly 6 2 / 2'
      },
      {
        'send-datetime': "1/22/2021, 3:31 PM",
        'once': false,
        'minutely': false,
        'daily': false,
        'weekly': false,
        'monthly': true,
        'yearly': false,
        'function': false,
        'recur-cancelonreply': false,
        'recur-multiplier': 2,
        'recur-function-args': "",
        'recur-monthly-byweek': true,
        'recur-monthly-byweek-day': "6",
        'recur-monthly-byweek-week': "2",
        'sendbetween': false,
        'sendon': false
      }
    ]);
  }