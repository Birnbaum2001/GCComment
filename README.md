# GCComment

GCComment is a userscript for [geocaching.com](https://www.geocaching.com). It
lets you write, manage and print your own notes for geocaches, store the final
coordinates of mysteries, and show those finals on the maps.

Your comments stay in your browser. Nothing is sent to a server of ours — there
isn't one.

## Install

1. Install [Tampermonkey](https://tampermonkey.net/) or
   [Violentmonkey](https://violentmonkey.github.io/).
2. Open
   [src/gccomment.user.js](https://raw.githubusercontent.com/ramirezhr/GCComment/master/src/gccomment.user.js)
   and confirm the installation.

Updates are offered automatically once installed.

### Browsers

Works in Firefox and Chromium-based browsers (Chrome, Edge, Opera) with
Tampermonkey or Violentmonkey. On Android only Firefox is an option — Chrome
does not support extensions there.

Greasemonkey is **not** supported: it dropped the synchronous `GM_*` API in
version 4, and the script relies on it.

## What it does

- Comments and solution notes on every cache page, kept per GC code
- Final coordinates for mysteries, with markers and a line on the cache page
  minimap and on the search map (Mystery Mover)
- Custom waypoints per cache
- Overview table on the dashboard with filtering, sorting and bulk delete
- Import and export as GCC, JSON, CSV, HTML, GPX and KML
- Backup to and restore from Dropbox
- GPX patching: inject your finals into a GPX file for your GPSr
- Comment bubbles in cache lists, and comments on the print pages

## Repository layout

    src/gccomment.user.js    the script — this is the whole program
    src/version.json         version and changelog the update check reads
    resources/icon.png       icon referenced by the script header
    test/                    tests for the storage layer
    CHANGELOG.md             what changed per version

## Development

The script is a single file with no build step: edit `src/gccomment.user.js`
and reload.

The storage layer has tests. They run against the real code — `build_harness.py`
cuts the storage functions out of the script rather than copying them, so the
tests cannot drift from the implementation:

    cd test
    python3 build_harness.py ../src/gccomment.user.js harness.js
    node test_migration.js

Regenerate the harness whenever you touch one of the storage functions.

### Releasing

1. Bump `@version` in the script header.
2. Add an entry to `src/version.json` and set `latestVersion` to the same
   number. The update banner renders the `change` field as HTML.
3. Add a section to `CHANGELOG.md`.
4. Push to `master` — `@updateURL` and `@downloadURL` point there, so
   Tampermonkey picks it up.

Version numbers count up as plain integers and must keep doing so: Tampermonkey
compares them segment by segment, and a first segment below the installed one
counts as a downgrade and is never fetched.

## History

Started in 2010 by Birnbaum2001, with lukeIam and ramirez contributing since.
The earlier repository at


Discussion thread (German):
[Geoclub](https://geoclub.de/forum/viewtopic.php?f=117&t=44631)
