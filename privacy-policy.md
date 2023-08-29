# Send Later Privacy Policy


Send Later collects anonymous usage data to help us improve the add-on, measure its usage, and identify where to focus our efforts. The data we collect contains no identifying information, email content, or account information. We don't share the data with anyone.

## What we collect

We collect the following data:

* the version of the add-on you are using;
* the name of the application Send Later is running in, e.g., Thunderbird;
* the version of the application Send Later is running in;
* your operating system and hardware platform;
* the locale (i.e., language and region) configured in your operating system; and
* events and errors that occur within the add-on (but just to to be clear, identifying information and content are carefully excluded).

We also collect by default a persistent, unique identifier so that we can associate disparate data points with the same Thunderbird user. We cannot associate this identifier with any individual since we do not collect any personally identifiable information. If you wish, you may disable the collection of this identifier as described below while still allowing other data collection.

When we say we don't collect any identifying information, we mean it; our data collection server (which we host and control) does not even log your IP address. Furthermore, when we say we don't collect the data, we mean that it isn't even transmitted to our data collection server, i.e., we are careful to ensure that the add-on only transmits the data that is appropriate to collect.

For those who are so inclined, you can <span class="notranslate">[search our source code][telemetry]</span> to see exactly what data we are currently collecting.

## How to opt out in or out of data collection

If you have not opted in or out of data collection before, then you are initially opted in, and the add-on prompts you on startup to ask whether you wish to allow data collection. Click the Yes or No button on the dialog to respond.

If you would like to change your answer, open the add-on preferences, expand the Advanced configuration editor section, find the line in it with the key telemetryEnabled, change its value to either "true" or "false" as desired, and click Save.

If you would like to opt in or out of a unique identifier being associated with your data, open the add-on preferences, expand the Advanced configuration editor section, find the line in it with the key telemetryUUIDEnabled, change its value to either "true or "false" as desired, and click Save.

## Right to access your data and right to be forgotten

If you have opted out of data collection then we have no data about you whatsoever for you to access or for us to be able to delete.

If you have opted in to data collection but opted out of a unique identifier being associated with your data, then it is impossible for us to tell you what data we have about you or delete it, since there is nothing in the data associating it with you in any way.

If you have opted in to data collection with a unique identifier and you would like to know what data we have about your usage of the add-on, please <span class="notranslate">[contact us][emailus]</span> with your request. Include in your request the value of the telemetryUUID preference in the Advanced configuration editor in the add-on preferences. We will either send back an export of your data or remove it from our database as requested. Note that if you do not disable data collection as described above, the add-on will continue to collect new data about you even after we've deleted the old data upon request.

## History

The history of this privacy policy can be viewed <span class="notranslate">[on GitHub][history]</span>.

[telemetry]: https://github.com/search?q=repo%3AExtended-Thunder%2Fsend-later+%22telemetrySend%28%22&type=code
[emailus]: mailto:send-later-support@extended-thunder.org
[history]: https://github.com/Extended-Thunder/send-later/commits/webpage/privacy-policy.md
