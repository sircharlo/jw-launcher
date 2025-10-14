# JW Launcher

Here is a simple app that facilitates launching Zoom meetings and special programs from JW Stream, as well as playing videos from JW Broadcasting, made specifically for our dear elderly ones who might have trouble connecting to meetings, service, assemblies, conventions and the like, on their own.

There are also optional buttons to launch a TeamViewer session, should remote help be needed, and a button to shut down the computer.

The app can be set to run automatically when the computer boots, and even to launch certain Zoom meetings or JW Stream events at specified times. This could be especially useful for an older person if combined with a password-less computer login. After turning on the computer, the user would then be automatically connected to the appropriate meeting, at the right time.

![Main screen of app](https://github.com/sircharlo/jw-launcher/blob/main/screenshots/01-main.png?raw=true)

## Features

- **One-click launchers** for Zoom, JW Stream events, and JW Broadcasting videos
- **Auto-start** with Windows login to minimize manual steps
- **Weekly scheduling** to auto-launch meetings within a safe reconnect window
- **Remote help shortcuts** (optional TeamViewer button) and **Shutdown** button
- **Elder-friendly UI** with large buttons and configurable labels

## Installation and usage

Simply download the latest installer [from here](https://github.com/sircharlo/jw-launcher/releases/latest) and run it.

> **Trouble installing?** Check the *Technical usage notes* section for help.

Once the setup is complete, a shortcut to the app will be placed on your desktop. Open the app, and configure the settings as you please.

## Configuration

![Settings screen of app](https://github.com/sircharlo/jw-launcher/blob/main/screenshots/02-settings.png?raw=true)

### User preferences

Here, you can set the name to display on Zoom, the language for JW Broadcasting, and if the app should automatically launch on start-up.

### Links to meetings and special events

Click on the "+" button to add a link to a Zoom meeting or JW Stream URL. Items can be rearranged by dragging and dropping. To delete a line, click on the red "-" button.

### Schedule

Click on the "+" button to add a recurring weekly event, such as a service group or a congregation meeting. Set the usual weekday and time of the event, and the associated action to launch at that time.

Events in this list will be auto-launched at the defined time, if JW Launcher is opened or already running at that time.

> **Note:** The predetermined window during which a scheduled event will be auto-launched is defined as the time period extending from 30 minutes *before* the event's start time, to 105 minutes (1h45m) *after* the start time. This will ensure that the user is automatically reconnected if the computer or JW Launcher is restarted during an event.

 As many items as needed can be created. Actions can be scheduled more than once per week, and can be rearranged by dragging and dropping. The Sort All button will sort events by weekday and time. To delete an event, click on the red "-" button.

### Action buttons

 Here, you can hide or show the buttons that allow the user to shutdown their computer, or launch a TeamViewer session. You can also set the names of the action buttons, to make them easier to recognize for the user.

## Technical usage notes

Zoom should be installed and configured on the computer before attempting to use this app. The app itself should run as is on most modern computers running Windows, Linux, or Mac.

### Windows

On opening the installer, you might get [an error](https://github.com/sircharlo/jw-meeting-media-fetcher/blob/master/screenshots/07-win-smartscreen.png?raw=true) indicating that "Windows SmartScreen prevented an unrecognized app from starting". This is due to the app not having a high number of downloads, and consequently not being explicitly "trusted" by Windows. To get around this, simply click on "More info", then "Run anyway".

### Linux

As per the [official AppImage documentation](https://docs.appimage.org/user-guide/troubleshooting/electron-sandboxing.html), if the app fails to open properly, confirm the output of the following command:

`sysctl kernel.unprivileged_userns_clone`

If the output is `0`, then the AppImage will not run unless you run the following command and then reboot:

`echo kernel.unprivileged_userns_clone = 1 | sudo tee /etc/sysctl.d/00-local-userns.conf`

Make sure you read up on [what this change entails](https://lwn.net/Articles/673597/) before you do this.

### Mac

For technical reasons, the auto-updater does not work on macOS. Mac users will instead see a red, pulsing notification on the main screen of the app and in Settings when an update is available. Clicking on the notification in Settings will open the latest release's download page automatically.

If upon launching the app, you receive a warning that the app cannot be opened, either because "it was not downloaded from the App store" or "the developer cannot be verified", then this [Apple support page](https://support.apple.com/en-ca/HT202491) will help you to get past that.

If you get a message indicating that you "do not have permission to open the application", then try some solutions from [this page](https://stackoverflow.com/questions/64842819/cant-run-app-because-of-permission-in-big-sur/64895860). For example, you could try running this command in Terminal:

 `codesign --force --deep --sign - "/path/to/JW Launcher.app"`

## Help, there's a problem

If ever you run into any issues with the app or the underlying script, please use [GitHub Issues](https://github.com/sircharlo/jw-launcher/issues) to let me know.

## I have an idea for a great new feature

I'm open to suggestions! Please use [GitHub Discussions](https://github.com/sircharlo/jw-launcher/discussions) to let me know.
