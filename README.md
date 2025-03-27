# SUPER Experimental
This branch contains some fixes to the code, including some code to stabilize the bot from crashing. The bot is now mostly stable, and doesn't crash as much anymore. 1.6 discontinues refreshToken support for a more stable long-term approach using the deviceAuth method, which still auto logs you in. The 15-30 seconds delay should be mostly gone.<br><br><u>**SUPER Experimental may never release, and before it does, it'll be moved to Experimental.**</u><br><br><u>**This is an experimental branch with no official support, and any official and supported releases are on the main branch. Please download them [here](https://github.com/kitstudios/Fortnite-Bot-Royale/). Thank you**</u>.

# Fortnite Bot Royale

This is based on AjaxFNC's [NexBL V1](https://github.com/AjaxFNC-YT/NexBL-V1/), which was pretty broken lol
<br>
This is very broken too, expect instability.
<br>
This is not meant for use on any production server, and it will most likely never get updated again after this month, enjoy.
<br>
# To use
Install Node.js, available [here](https://nodejs.org/en/download), as it is necessary for this bot to function.
* Run `npm install` in the extracted directory
* rename `env` to `.env`
* run `node main.js` once everything is set up, and follow the first time setup for your bot. (How to get authorization code is below)
* From then, select BR/ZBBR, or Reload, make sure to have no fill on, and get ready
<br>
If any bugs are found, report in the issue tracker, thanks!
<br>

# Authorization code
```diff
- Make sure to be signed into the Epic Games account that will serve as the bot account!! Use incognito mode, or another browser to make sure!
```
To get an authorization code, click on this click [right here](https://www.epicgames.com/id/api/redirect?clientId=3f69e56c7649492c8cc29f1af08a8a12&responseType=code), and copy the "authorizationCode" value into the console.
<br>

