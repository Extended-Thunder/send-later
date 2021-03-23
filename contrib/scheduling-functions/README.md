# Send Later dynamic scheduling function library

This directory contains dynamic scheduling functions for use with the [Send Later Thunderbird add-on](https://addons.thunderbird.net/thunderbird/addon/send-later-3/). For more information about dynamic scheduling functions, see the [Send Later user guide](https://extended-thunder.github.io/send-later/#dynamic).

The preferred method for contributing a new function to this library is to fork [Send Later on Github](https://github.com/Extended-Thunder/send-later), copy your function from the dynamic function editor into a new file in this directory. Name your new file with an ".slj" extension, and follow the format conventions used in the existing examples. Finally, update this file (README.md) to describe your function (following the format of the existing entries), and submit a pull request.

Alternatively, you can just [email me](mailto:send-later-support@extended-thunder.org) your function as a plain text file attachment and let me know what it does.

Thanks for your contributions!

## Contributed functions

### DaysBeforeNthWeekday.sjl

By: Jonathan Kamens &lt;[jik@extended-thunder.org](mailto:jik@extended-thunder.org)&gt;

A user on the [send-later-users mailing list](https://groups.google.com/forum/#!forum/send-later-users) asked how to generate an email a certain number of days before a particular weekday of a particular weekday of the month, e.g., "five days before the fourth Wednesday of the month." This function demonstrates how to do that. It can be configured by passing in arguments or by editing the defaults at the top of the function.

### FirstFourDaysOfEachMonth.slj

By: Jonathan Kamens &lt;[jik@extended-thunder.org](mailto:jik@extended-thunder.org)&gt;

Schedules a recurring message that sends at 9:00am on the first four days of each month.

You can use variables to control the send time as well as the last day of each month when the message is sent. See the documentation string for the function for details.

### NextChol.slj

By: Jonathan Kamens &lt;[jik@extended-thunder.org](mailto:jik@extended-thunder.org)&gt;

This function is useful if you are Jewish and use email on the Sabbath and Jewish holidays but you have some Jewish friends who don't, and you'd rather not annoy them by sending them emails when they're offline.

The NextChol function will schedule your message to be sent shortly after the end of the current Sabbath or holiday, or after the end of the next one if it is not currently one.

Note that this function calls out to a little HTTP API endpoint I wrote to calculate the end time of the Sabbath or holiday.

You will probably want to edit the function after importing it to specify what city you're in, so the times will be correct for you. See the [API endpoint's help page](https://jewish-holidays.kamens.us/next-chol?help) for a list of supported cities.
