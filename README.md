# Welcome!

Here is a simple app that facilitates launching Zoom meetings and play videos from JW Broadcasting or special programs from JW Stream, for our dear elderly ones who might have trouble doing so unassisted. There is also a feature to launch a TeamViewer session (if remote help is needed), a setting to ensure system volume is set to the desired level, and a button to shut down the computer. The app can be set to run automatically when Windows boots, which could be especially useful for an older person if combined with a password-less Windows login.

![Main screen of app](https://github.com/sircharlo/jw-launcher/blob/main/screenshots/01-main.png?raw=true)

## Installation and usage

Simply download the latest installer [from here](https://github.com/sircharlo/jw-launcher/releases/latest) and run it.

> **Trouble installing?** Check the *Technical usage notes* section for help.

Once the setup is complete, a shortcut to the app will be placed on your desktop. Open the app, and configure the settings as you please.

## Configuration

Most of the options are self-explanatory, such as language for JW Broadcasting, user's name, and so on. Click on the "+" button to add a link to a meeting or Stream URL; click on the "-" button to remove it.

![Settings screen of app](https://github.com/sircharlo/jw-launcher/blob/main/screenshots/02-settings.png?raw=true)

## Technical usage notes

Zoom should be installed and configured on the computer before attempting to use this app. The app itself should run as is on most modern computers running Windows, Linux, or Mac.

##### Windows

On opening the installer, you might get [an error](https://github.com/sircharlo/jw-meeting-media-fetcher/blob/master/screenshots/07-win-smartscreen.png?raw=true) indicating that "Windows SmartScreen prevented an unrecognized app from starting". This is due to the app not having a high number of downloads, and consequently not being explicitly "trusted" by Windows. To get around this, simply click on "More info", then "Run anyway".

##### Linux

As per the [official AppImage documentation](https://docs.appimage.org/user-guide/troubleshooting/electron-sandboxing.html), if the app fails to open properly, confirm the output of the following command:

`sysctl kernel.unprivileged_userns_clone`

If the output is `0`, then the AppImage will not run unless you run the following command and then reboot:

`echo kernel.unprivileged_userns_clone = 1 | sudo tee /etc/sysctl.d/00-local-userns.conf`

Make sure you read up on [what this change entails](https://lwn.net/Articles/673597/) before you do this.

##### Mac

For technical reasons, the auto-updater does not work on macOS. Mac users will instead see a red, pulsing notification on the main screen of the app and in Settings when an update is available. Clicking on the notification in Settings will open the latest release's download page automatically.

If upon launching the app, you receive a warning that the app cannot be opened, either because "it was not downloaded from the App store" or "the developer cannot be verified", then this [Apple support page](https://support.apple.com/en-ca/HT202491) will help you to get past that.

If you get a message indicating that you "do not have permission to open the application", then try some solutions from [this page](https://stackoverflow.com/questions/64842819/cant-run-app-because-of-permission-in-big-sur/64895860). For example, you could try running this command in Terminal:

`codesign --force --deep --sign - "/path/to/JW Meeting Media Fetcher.app"`

## Help, there's a problem

If ever you run into any issues with the app or the underlying script, please use [GitHub Issues](https://github.com/sircharlo/jw-launcher/issues) to let me know.

## I have an idea for a great new feature!

I'm open to suggestions! Please use [GitHub Discussions](https://github.com/sircharlo/jw-launcher/discussions) to let me know.

*- COS*
