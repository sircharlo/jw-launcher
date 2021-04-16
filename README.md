# Welcome!

Here is a simple app that facilitates launching Zoom meetings and play videos from JW Broadcasting or special programs from JW Stream, for our dear elderly ones who might have trouble doing so unassisted. There is also a feature to launch a TeamViewer session (if remote help is needed), a setting to ensure system volume is set to the desired level, and a button to shut down the computer. The app can be set to run automatically when Windows boots, which could be especially useful for an older person if combined with a password-less Windows login.

![Main screen of app](https://github.com/sircharlo/jw-launcher/blob/main/screenshots/01-main.png?raw=true)

## Installation

Simply download the latest installer [from here](https://github.com/sircharlo/jw-launcher/releases/latest) and run it. Once the
setup is complete, a shortcut to the app will be placed on your desktop. Open the app, and configure the settings as you please.

## Usage

![Settings screen of app](https://github.com/sircharlo/jw-launcher/blob/main/screenshots/02-settings.png?raw=true)

The settings section is mostly self-explanatory.

Note that you can input an URL to a settings file. If used, this URL should point to a publicly accessible file. The app will attempt to download this file when opening up, and will then overwrite its settings with the ones retrieved from that file.

This is especially useful when setting up a Zoom meeting for special events; the local app "administrator" can export his settings file with whatever Zoom codes or program URLs are needed, and then make this file publicly accessible. All those who are configured to be synced to that particular settings file will then have the possibility of connecting to the appropriate meetings when needed.

This feature can also be useful to set up different labels and meetings based on different users or groups, for example with elderly elders who need access to a special meeting ID and password, or for ones who speak a different language than the congregation, and would therefore be disoriented if the app's button labels weren't in their language.

## App usage notes

Zoom should be installed and configured on the computer before attempting to use this app. The app itself should run as is on most modern computers running Windows, Linux, or Mac.

### Windows

There are no specific prerequisites.

### Linux

As per the [official AppImage documentation](https://docs.appimage.org/user-guide/troubleshooting/electron-sandboxing.html):

>AppImages based on Electron require the kernel to be configured in a certain way to allow for its sandboxing to work as intended (specifically, the kernel needs to be allowed to provide “unprivileged namespaces”). Many distributions come with this configured out of the box (like Ubuntu for instance), but some do not (for example Debian).

Simply put, this means that if the AppImage fails to open properly, then you'll need to confirm the output of the following command:

`sysctl kernel.unprivileged_userns_clone`

If the output is `kernel.unprivileged_userns_clone = 0`, then the AppImage will not run unless you run the following command and then reboot:

`echo kernel.unprivileged_userns_clone = 1 | sudo tee /etc/sysctl.d/00-local-userns.conf`

Before you do this however, make sure you read up on what this change entails, for example [here](https://lwn.net/Articles/673597/).

### Mac

For technical reasons, the auto-updater does not work on Macs. Mac users will however see a button displayed on the main screen of the app when an update is available. Clicking on this button will take you to the latest release's download page automatically.

## Help, there's a problem

If ever you run into any issues with the app or the underlying script, please use [GitHub Issues](https://github.com/sircharlo/jw-launcher/issues) to let me know.

## I have an idea for a great new feature!

I'm open to suggestions! Please use [GitHub Discussions](https://github.com/sircharlo/jw-launcher/discussions) to let me know.

*- COS*
