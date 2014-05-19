// ==UserScript==
// @name           	GCComment
// @namespace      	http://www.birnbaum2001.com/gccomment
// @description    	Add comments to your geocaches on geocaching.com.
// @include			http://*geocaching.com/*
// @require			http://cdnjs.cloudflare.com/ajax/libs/dropbox.js/0.6.1/dropbox.min.js
// @grant				GM_getValue
// @grant				GM_setValue
// @grant				GM_xmlhttpRequest
// @grant				GM_listValues
// @grant				GM_registerMenuCommand
// @grant				GM_log
// @version			69
// @author			Birnbaum2001
// ==/UserScript==

/*
 History
 - 2010-04-02 22:00 started hacking a bit
 - 2010-04-02 23:30 worked :)
 - 2010-04-03 0:25 changed saving by GCCode to GUID
 - 2010-04-03 0:58 included icon to show on overview pages (copied some code from gcvote for
 branching depending on URL)
 - 2010-04-03 1:15 hotfix. changed GUID parser from substring to substr because full detail
 URLs contain more than just the GUID after guid=
 - 2010-04-05 0:44 kind of tooltips are created by mouseover
 - 2010-04-05 0:47 weniger Zeilen, wenn kommentar vorhanden, dann gleich auftoggeln
 - 2010-04-05 0:50 Notizblock in Suchseite
 - 2010-04-05 12:11 comment-list & delete function
 - 2010-04-06 hotfix for nullpointer in detailpage without existing comment
 - 2010-04-29 added some icons and changed detailpage to readonly and editmode
 - 2010-04-30 integrated real tooltips
 - 2010-05-02 content for tooltips is loaded when tooltips are shown
 - 2010-05-02 added timestamp to new comments
 - 2010-05-02 added check for updates
 - 2010-05-04 added import/export, cancel editing, copy from gcnote
 - 2010-05-17 small improvements by Schatzjäger2 ('hand' mousepointer and action on mouseout instead of mouseover
 - 2010-05-19 exchanged save and delete buttons and inserted javascript popup to confirm deletion
 - 2010-05-24 import/export handles XML characters
 - 2010-06-16 fixed gc layout update on cache detail page
 - 2010-06-20 implemented first version of server sync
 - 2010-07-31 cleaner code style (comment as object), waiting for gctour to finish before inserting comments
 - 2010-08-05 comments can be categorized and filtered on overview table
 - 2010-08-13 stats on gccomment-icon, server storage available, delete all button
 - further comments and changelog on http://userscripts.org/scripts/show/75959
 */

// version information
var $ = unsafeWindow.$;
var jQuery = unsafeWindow.jQuery;
var version = "69";
var updatechangesurl = 'https://gccomment.svn.sourceforge.net/svnroot/gccomment/trunk/gccomment/src/version.xml';
var updateurl = 'http://userscripts.org/scripts/source/75959.meta.js';

// thanks to Geggi
// Check for Scriptish bug in Fennec browser
GM_setValue("browser", "firefox");
var test_browser = GM_getValue("browser");
if (!test_browser) {
	console.log("Scriptish GM_getValue bug detected");
	var FENNEC_PREFIX = "scriptvals.GCComment@httpwww.birnbaum2001.comgccomment.";

	// GM_getValue Funktion überschreiben
	var GM_getValue_Orig = GM_getValue;
	GM_getValue = function(key, def) {
		return GM_getValue_Orig(FENNEC_PREFIX + key, def);
	};

	// GM_listValues überschreiben: FENNEC_PREFIX wird von den Keys gelöscht
	var GM_listValues_Orig = GM_listValues;
	GM_listValues = function() {
		var keys = GM_listValues_Orig();
		for ( var i = 0; i < keys.length; i++) {
			if (keys[i].indexOf(FENNEC_PREFIX) >= 0) {
				// we got a comment
				keys[i] = keys[i].split(FENNEC_PREFIX)[1];
			}
		}
		return keys;
	};
}
// end thanks ;)

// UI Elements - Profile page
var configDiv;
var commentTable;
var exportDiv;
var importDiv;
var deleteAllDiv;
var patchDiv;
var importText;
var importresult;
var deleteAllResult;
var gccRoot;
var displayFilters;
var waitingTag;
var filter;
var serverImportLink;
var serverExportLink;
var listener;

// UI Elements - Detail page
var detailCommentDiv;
var detailCommentTextArea;
var detailCommentTextPane;
var detailCommentInputLatLng;
var detailCommentLastSaveTime;
var detailCommentCacheState;
var detailFinalInputLatLng;
var detailFinalCacheState;

// Map
var markers = new Array();

// Buttons
var AddComment;
var SaveComment;
var EditComment;
var DeleteComment;
var CopyComment;
var EditCancelComment;
var SaveFinalCoords;
var DeleteFinalCoords;

// Detail page comment details
var currentComment = null;
var currentCacheGUID;
var currentCacheCode;
var currentCacheName;

// general script variables
var DELIM = "#gccom#";
var COMPREFIX = "gccomment";
var COMGCPREFIX = "gccode-";
var DEG = String.fromCharCode(176);
var DEFAULTCOORDS = "<N dd" + DEG + " mm.mmm E dd" + DEG + " mm.mmm>";
var stateOptions = new Array("-", "not solved", "solved", "found");
var LAST_IMPORT = "lastimport";
var LAST_EXPORT = "lastexport";
var INDEXBUILT = "indexbuilt";
var ARCHIVED = "archive";
var browser = "unknown";
var dpkey = "gjgp2VmSkXA=|slxBk5B17uUM44vAflpUrXnRlUqzUFUYHbJm5mcuyg==";
var xmlversion = "<?xml version='1.0' encoding='utf-8'?>\n";

// preferences
var AUTOMOVEMYSTERIESBETA = "autoMoveMysteriesbeta";
var AUTOMOVEMYSTERIESBETAFOUND = "autoMoveMysteriesbetafound";
var AUTOMOVEMYSTERIESBETASOLVED = "autoMoveMysteriesbetasolved";
var AUTOMOVEMYSTERIESBETAHOME = "autoMoveMysteriesbetahome";
var AUTOMOVEMYSTERIESBETAAREA = "autoMoveMysteriesbetaarea";
var AUTOMOVEMYSTERIESBETAUNSOLVED = "autoMoveMysteriesbetaunsolved";
var ADDCOMMENTSETTING = "addCommentSetting";
var CHANGEORIGINALSETTING = "changeOriginalSetting";
var ADDWAYPOINTSETTING = "addWaypointSetting";
var PATCHGPX_CHANGEORIGINAL = "patchGPXChangeOriginal";
var PATCHGPX_ADDFINALWPT = "patchGPXAddFinalWpt";
var ENABLE_EXPORT = "enableExport";
var PATCHGPX_REMOVE_SOLVED = "PATCHGPX_REMOVE_SOLVED";
var PATCHGPX_REMOVE_UNSOLVED = "PATCHGPX_REMOVE_UNSOLVED";
var PATCHGPX_REMOVE_FOUND = "PATCHGPX_REMOVE_FOUND";
var PATCHGPX_REMOVE_OTHERS = "PATCHGPX_REMOVE_OTHERS";
var EXPORT_FILTER_ALL = "EXPORT_FILTER_ALL";
var EXPORT_FILTER_UNTYPED = "EXPORT_FILTER_UNTYPED";
var EXPORT_FILTER_UNSOLVED = "EXPORT_FILTER_UNSOLVED";
var EXPORT_FILTER_SOLVED = "EXPORT_FILTER_SOLVED";
var EXPORT_FILTER_FOUND = "EXPORT_FILTER_FOUND";
var EXPORT_FILTER_ARCHIVE = "EXPORT_FILTER_ARCHIVE";
var DELETEALL_FILTER_ALL = "DELETEALL_FILTER_ALL";
var DELETEALL_FILTER_UNTYPED = "DELETEALL_FILTER_UNTYPED";
var DELETEALL_FILTER_UNSOLVED = "DELETEALL_FILTER_UNSOLVED";
var DELETEALL_FILTER_SOLVED = "DELETEALL_FILTER_SOLVED";
var DELETEALL_FILTER_FOUND = "DELETEALL_FILTER_FOUND";
var DELETEALL_FILTER_ARCHIVED = "DELETEALL_FILTER_ARCHIVED";
var LAZY_TABLE_REFRESH = "lazytablerefresh";
var AUTO_UPDATE_GS_FINAL = "autoupdategsfinal";
var AUTOMARKFOUND = "automarkfound";
var AUTOMARKARCHIVE = "automarkarchive";
var SETTINGS_LANGUAGE = "settings language";
var SETTINGS_LANGUAGE_EN = "English";
var SETTINGS_LANGUAGE_DE = "Deutsch";
var SETTINGS_LANGUAGE_AUTO = "Auto";

// icons
var gccIcon = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAMAAAAoLQ9TAAAABGdBTUEAANbY1E9YMgAAABl0RVh0U29mdHdhcmUAQWRvYmUgSW1hZ2VSZWFkeXHJZTwAAAAwUExURdPer+b9v0mis4rElNjQMVyuXfvzR+O+c0BOO+egPfT93X2FbL/Z3qaxkODo4J2EMhLWxjYAAAB9SURBVHjaVMwJDkMhCATQQawgLtz/tl/kt0mHjMtLFK22Wmuz/blhNHfXP2iqZ7Gl+gVXIyJbQxOqwt4gAUZnXjkQtzVgWOcERrwPMYz7FWYARjQAKBzbypIISgiQlR5QGHTD0hOK6gDEvQdwyrTeE0pm/2BmtmHH7EeAAQAb9gXg4KzWZAAAAABJRU5ErkJggg==';
var commentIcon = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAARFJREFUeNqkU03OREAQbXwRseAYnMy3sJO4BJYsuJQlFm4h/unp10kLZiY6mUqeblX9XlWXolBKyS/2JzZZluVs8SAoRM+rgK7rhe/7/4cCnGma0rquqYzhHM4fidhLLksWVlUVRHIIqOzhOY4jdV8QhmEgruuSrus8+FTZJq7rSvq+5wIfm3jPtG3bhTzPM8eyLFeBewX7vpNpmjhJiGEPInD2v1WA4DiOh4DoNPYAqjIM44jxHmiaVjRNw4m4I8AadAF8iJumSWzbJm3bEsuyisc5KMvycQ4UUQomkZXuiesEQcDXOI55XwQBmd8m8Y4kSXi2KIrop/gZ6rfPiMxhGCpP8/FVQIYMU379nV8CDADQEaUK/jLo9wAAAABJRU5ErkJggg==';
var commentIconEdit = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAYJJREFUeNqUU89LAlEQnn27BMKyNzsmnvYP6FJ3b0XgPei2Ed4M6yheJFaDiPWgB5GIrkHU/9Cha+YmQkpQ2SVEZV3E15uBt2j+SAeGj5l533zzfimcc1jC1oXvCt+w9vfSmChd32UEtBTZoFAoFAVYGMscYigUgmg0CrquQ9nJwnncp9rx7Ro1oQaCzGOxGJimOXcEoRyQnz8ZVD8YPL4xUMPhcFGQN1cho313FXj/UYCJCaxVyVIdt8AWHeIi8sHRKYYttoicsXegux2fpQydTgdT91MTjEYjGA6HQexWv8AztwKy7VxRvl6vI7QnJkBiv9+HwWBAcfrkgfD1pU3ks8sKXS2u6/V6VNNUVS25rmtFIhHwfR88zyOUdlN5IsxelIExBpqmQaPRAMMwSsFjcRyH12o1/teazeZUDtfhevngJl6iGN2SyslkkjCXy9G5SAIqJxKJw2BEWRj3fD5ParZt81n1cZ95jVhA5VQqpfz3y+Y2WIaMpiz5nefarwADACQFMs6fhMd+AAAAAElFTkSuQmCC';
var commentIconDelete = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAXpJREFUeNqUUr9Lw1AQvpd2qFFaRBwFHaQ46x8g0jooQqGjexy6BfpPtB3TweziYkX8tQiOrhkcTIbi4CgilKRJIc3z3YN7pLU19eC4e/fuu/vu3mOcc8iSj9M6+EHIV5aXGMXonKdAt9s9F8bAglSUbDUIFei5emwfPD0Yn1EEQjnDJAHmlUoFyuXyXBZvtSPlIxhla22Vadg5C4yyc/Oo/PVCAV5P6jb6mmBgZIGJAXVGwTGowL/Am5c9Ncb71zfXZgGwaBzHUsfjMWxf3cr43vU9hGGoxpE7mGaQJAlEojomogZBIO1u7w6GwyEMBgOZ97J/CBsXPcinwdgRwaPRSPr0pGk2BbFAupM7yOVytud5EogdUH3fn1CM4b2u61AqlaDf70OxWLTVvJZlcdd1+bQ4jvMrhnmYT+wYUcH/IKgbNI5pmtK22225FwJg50ajcTax8WntdDqyW6vV4rPu0zr3GbFzs9lkWX9kboFFwChskZ/4l/wIMADyMlZUy0YWOAAAAABJRU5ErkJggg==';
var commentIconDeleteAll = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAMAAAAoLQ9TAAAABGdBTUEAANbY1E9YMgAAABl0RVh0U29mdHdhcmUAQWRvYmUgSW1hZ2VSZWFkeXHJZTwAAAAYUExURe6trfLy8tHR0Y+Pj7GxsQAAAIjuhv///20imzoAAAAIdFJOU/////////8A3oO9WQAAAGtJREFUeNpcjwEKwDAIA9Xo/P+Pl9iugwaq5KpgrC9ZV+KoS6CCekZFkDlke7QhQmT5ZwGR5QcYVeWu5x8goY/4AUl4zESeCfogaOx/7UCXNlBlroo5vXkrDNMXYAcmmIhNxY6qLHf8V4ABAESSBHQ3l0TpAAAAAElFTkSuQmCC';
var commentIconSave = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAZBJREFUeNqckz1LxEAQhmeTNGIjWliJIKKltWCjWAgWWihW1hYHgthb2Fmo1aE2dld5wtlZCFoINv4C/8EVnk0u2a8k7jvJHmejOQeGbDLvM7s7MxFFUdD5Taegf9jxwbYQZ812sbyyTr3PLm2tLtQCH54/aHJqmt5enyjIsoyMsWSNqQVDDy0YrKPMWveinZs/QWi0LrVgwEbIhI/wYcvznIW8oxPCsYZ7PdgImZSCK0JBEcC63MUwiGRwb4iDARtBxB8cmCQJpWlKUkpO5HdFYlgQBBSGIWv9JpHmBJKUg65bL7VbCEZzApdNSkVj4xMjzQAYsJHR5Qm8fbl5+M3iuM/Pmdk5Ajs4AcO9LjX210gIwQ7D/X0NUMgrd81+HA9OEKCSWit2FAZ2enlHt/fvg+rDfft8B6Avu+Aq7UFdtbIUKQbxbnnYypbqKsZdwCDZaro4gXsC8oNiq+R+oIaHiOPoQqd1ITb3Dov5xSVuC6CTo10Wx3xX+WMWdDVg7E4rfGBjpzHyL/3YbopvAQYALTKvvIqUmbwAAAAASUVORK5CYII=';
var commentIconAdd = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAXxJREFUeNqMU7uKwlAQnRgLsYitsB+QZn/BQggo+RC3CKQQUqW1UhuDIvohmr+w2cIUlrtNEE0UH/gY78x6ZeP7wDDDZE5mTmYCiAivrFQqsa/Vaj8iRvIyr1BA6HQ6PeEqkkQgr2kaRFHEse/7oHufENjfFCtUkz6T0TAM0HUd7sHzPBgOh4lcuVzGQqHwq7Tb7Z4gVx6Rz8Xc+Ro0SVqM9pRMME0TBvaAYymBQBOkpN5nsG37RkKxWATXdT9S9wj00v1+f7HNZgO73Y6lUHeaSEqDVquF/3E4HHC1WmEcx2xiAzidTjEMQ1wsFrher7mu2+2S+9uChOy23W45liuVk8znc8hkMpDP52E2mzEnpapqPwgCJorObMvlMmGUo+fZbBZyuRxMJhO6j/5Fr1gljsdjvMZoNLrJUR3Vy+kSlyhGr0g51WqVfaPRgOPxeJFDnS3L+kp88WtrNpvcrV6v46v/5OEaqbPjOMqrG3n4gnfIBOWdS3yGkwADADDQiUjr02VlAAAAAElFTkSuQmCC';
var commentIconCopy = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAUJJREFUeNqckj2Kg1AQxyebrQNWHsBSLCQgiJaiZzEH8A56gBXvYCtoLfZ2KUwsPEM+/HYzj/h2JWogAw/GefN+/5lxNrZtmxzH/cCKnc/ng2VZ7uyl7/vDO3vmwNz5XlI9nU7Uv16vi9VRQJIkNMiyLKRpCnme05jjOMPMe3exAnz86HttNAg1v+BDw/4nLSiKQi+PxyP1oyiivmEY9FtV1dcZILXrOmAYZlFZ13W43+9wu92mAFmWoa5rqKoKsixbLDsIAiKy3+//ABiI4xjatiX+breblD3a5XIBSZKoEAWUZQmCIJAgXhZF8TIDhDdNQwT6vif5BIBrGobhZJX/L46mabRnjKMIQhBIAM8dd2f+8YBJDzhJHg+qo/E8Px3inKGiKIpEHavAVhGw3W4paA3gep5nvtkndzNu1Kf2K8AAAxf9KklDG6EAAAAASUVORK5CYII=';
var commentIconEditCancel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAALEgAACxIB0t1+/AAAACB0RVh0U29mdHdhcmUATWFjcm9tZWRpYSBGaXJld29ya3MgTVi7kSokAAAAFnRFWHRDcmVhdGlvbiBUaW1lADExLzA1LzA33bqJ2wAAAx9JREFUeJxVk09om3UYxz/v722ydEmb2HYiS50dWDdT5sS1uoOitTo7LSMFFRHRwnbaSUFBpzgsDHGX1YvgofUg7CIutd2GTIR2A1vcULN2rTYwti7tivRP0vRPkvf9PY+HFmm/1+9feHgcVWUrbr76+BNOMPgFxm1W49aLWKRcykq5dEPLpdMtQ/dubtU7WwPGO59MYdxk8f40Xn4Ja+0GYVzccAQnWgO+3394aLpzW8D02Q9DhevDGW9pvn41e4fA7gZqXkoS3n8QVWFl8i8Wfh3Am72LidXCjlB2ra6+8ciF0SKqyljyYOrPtga9tg+d/LhLvfySirUqXlltqah2fVXX57I6O3heR57fo0OHYjr8TF1KVXHGX29uUZHf87f+oLazi/1ffoeKMNZ7juzoMOXlHAfePUlD61FUhL+//4b7X3+GidXiqD5dIaXimdL8HE5VjEc/OYeK8MNrTzE/kabSQLg6Smz3w6gIiGVvx5vcPv8tVfl/kUDwjHFClQkvv8Su5Hu4kWrG+nqYn0gTdSFSHeXFvktEGxMsTqb57atPQZQHnj1C2SvjqZMwIhq31rIj/giI5faVn6g0EKyK0tp3iVhjgoXJNAPHk+SmxgnsDFPTmGDFKr5I3IhsnkpkY6Yqkert5sHjSfyVPGGj/+uKAiqWCvH9GYwbL87cAbE0tHVQ1fn2hnkizeCJJH4hT8SF+HOvoGJZmLq10WntjHO9be8VL7/4si9Ky+UJAuEIKsLiRJqBExvNEQN1jzXR2nsRbznHha4OQguzhF3zi1E3cMqJ1qAry2TOfoRaAWtZnpnmwX1NJFrbaX7/NK29F0GEkZ5u1uZmqDAGK3LKUVVGX9iT8tfXkn5ugZ3tb9H0QTfBzSWIRUXwlnOM9HST+TlFXcAh5NB/LCOdjqpy9Z22kJn+J2PXVuu1kKMQqibW/gbhh+KgSmH2HpnLP+KvFqgJOAQdsrNlbTx5V4vbnunq4V0pTzRp1lawXpm8VcqbtOs4BFyDK9J/LCPbn2krhg9FD/hKty/a7InWq1iwNuuIveGqfH50Ssa26v8D7vnE690mEL0AAAAASUVORK5CYII=';
var waitingGif = 'data:image/gif;base64,R0lGODlhEAAQAPIAAP///wAAAMLCwkJCQgAAAGJiYoKCgpKSkiH+GkNyZWF0ZWQgd2l0aCBhamF4bG9hZC5pbmZvACH5BAAKAAAAIf8LTkVUU0NBUEUyLjADAQAAACwAAAAAEAAQAAADMwi63P4wyklrE2MIOggZnAdOmGYJRbExwroUmcG2LmDEwnHQLVsYOd2mBzkYDAdKa+dIAAAh+QQACgABACwAAAAAEAAQAAADNAi63P5OjCEgG4QMu7DmikRxQlFUYDEZIGBMRVsaqHwctXXf7WEYB4Ag1xjihkMZsiUkKhIAIfkEAAoAAgAsAAAAABAAEAAAAzYIujIjK8pByJDMlFYvBoVjHA70GU7xSUJhmKtwHPAKzLO9HMaoKwJZ7Rf8AYPDDzKpZBqfvwQAIfkEAAoAAwAsAAAAABAAEAAAAzMIumIlK8oyhpHsnFZfhYumCYUhDAQxRIdhHBGqRoKw0R8DYlJd8z0fMDgsGo/IpHI5TAAAIfkEAAoABAAsAAAAABAAEAAAAzIIunInK0rnZBTwGPNMgQwmdsNgXGJUlIWEuR5oWUIpz8pAEAMe6TwfwyYsGo/IpFKSAAAh+QQACgAFACwAAAAAEAAQAAADMwi6IMKQORfjdOe82p4wGccc4CEuQradylesojEMBgsUc2G7sDX3lQGBMLAJibufbSlKAAAh+QQACgAGACwAAAAAEAAQAAADMgi63P7wCRHZnFVdmgHu2nFwlWCI3WGc3TSWhUFGxTAUkGCbtgENBMJAEJsxgMLWzpEAACH5BAAKAAcALAAAAAAQABAAAAMyCLrc/jDKSatlQtScKdceCAjDII7HcQ4EMTCpyrCuUBjCYRgHVtqlAiB1YhiCnlsRkAAAOwAAAAAAAAAAAA==';
var errorIcon = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAtZJREFUeNpUU7tLI2EQn3y72TWJutnERCRHtBEL8URIUCy0sTsQ7a6xsbG8IsWBl0qut4hgd839Baaw0ubA4k7kCtEQuEAS0DMPjXnt43a/zc3sZcX7YPgeM/Ob3zw+n2ma4K1fx8fzlmlmdV1f+2OacdMwRFEQbL8s11G+iaL4eSGTufHsJUkCnwdQzOU+af3+B2l0NKaEwxBkDPz4bg4G0LMseGo0wOh2uwFFOVrKZPb/A3CdNe1jZGpqTNV1sB8fYYA7t20AQQAIBEBQVWjiuV6t2koy+fXt3t4uAQjvo9H5bqdzHE0k1PDTE1j398A1DRzOQd3Zgd7VFTgE2ulAQBQBolHWLJcXOGN3sdnZnwwZZIl2GJ2seh0cjOogPWVrC0JLS6BubwPHNIiNiXrVcUCUZbFVKBxUKpUYMzRtjXLmGJ2MyNhBGQwLRTvdPRAL7SKTk9CqVBKc802m9/vxABbMJtpDxwEZ452W3e8DfwVk4XtoZAQ6lCrnG8zUNFFCAEIfDKNTNKvd/geAOzl7zDh2RPL7QcOaOI6TxjYLtsG5OMAKk9KL1Lq4cIXOzpAV6XxopxsG+JEFMphmgiTVuzQL+OBFd4u4ugpzuZy7O8PoJD5sabvXg+DEBAFUmIQT1nx4ABaJgIPoHgM2Pu6mICjKizOxFNHuoVwGZXaWUrgUBRzPdqv1rqEoY2o8Dkat5raydnoKWrUK7etr15kGSkZ9DYuqdbvwZnmZGJyxdDZ7E1LVo9+lkt3E4kjJJAjYVh9OWfv2FkCWwY/3wMwMNHEG7opFmFpfB6YoJ8gg//IXvh8efmmWSjtyMChOJBIwirnSqBqo72DEGtLWMHdyVlKpH1jU/VQqde57/Ruv8/nd52Lx4BmHhPqso6MUDEIoFgN1bg7UlRWqyQk65xYXF8/dz0Tteb0KhUIMqW2ibKAujfs0SgXPlyhnKPl0Ot3w7P8KMAB6SM2aovTkagAAAABJRU5ErkJggg==';
var successIcon = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAALEgAACxIB0t1+/AAAACB0RVh0U29mdHdhcmUATWFjcm9tZWRpYSBGaXJld29ya3MgTVi7kSokAAAAFnRFWHRDcmVhdGlvbiBUaW1lADExLzA1LzA33bqJ2wAAAmFJREFUeJyNk89L1FEUxT/vfcfRkdG0yRZqIYiCgmVorloUhCAkKLQxguwvSKiVUJYgFLSwZW3Kje7S3AgRiNQiTDQVhyhE0RkzTPwx4zjfmXnvtpgaZyCss3vvnXPPvedxlYiQjbql6+e8Ku+RI7rZQVcaa3BtIuTa5IxrE33rTRML2XyVXaAxeGPUUbpjzd1kx0QwGAAcNH58BKSYpE2NrbVMdOYUuBcaLJiKzH77mdqtXE1scBwCpgif8YYqDk7WfLw6EtcA7/anR/5HDLDtRIiqw8rlgs0RANUcvHnRItOzsS//FHcH2llJhJmKzHLqwI+1tkXHbWJgzd08Vni5qImVhnEEYerHJ3AtUW+cpDID2qfy63dMJEOu8pbTWFibOQ+euctk7XMGw8MMLb1OX+ZrXI9BJaVei0jFn7QBXlb10V3aTon4Ga1+yp3TXYxtTfJsYQj8DhQ6AIgSrLEV6sJCl8wlvgLQWFjLXN0wADupfUo9xeymIlS9bWXPE4NAXs5ovi2NTlkTdtAA3ApcyzyWeooB6Fl4wp6JQmmuWAkYa8I6amNBPz4AHm684NX38QxpNbbB0PobKPHw2+OoQByMxwZ1nnV6A5J22zNRbof66V66z24yQs/iY/CozNzZ0BGDTZpeJSKcnW4bjRHv2HaOfuO8qmY+HEy37su11/sWiZsx2zbfqQFq3PIun/GGSpKFGdK8LEOZ9+/imAnJymFXOousZSr7cGUUKx1RbxzXYxAlmcBUPN22wY7ZtvncZcrGifeXGjDSL0aaJWUrjVgMJmSUnbFKHtjWz4vZ/F9iIi867oQHZwAAAABJRU5ErkJggg==';
var state_default = commentIcon;
var state_unsolved = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAgY0hSTQAAeiYAAICEAAD6AAAAgOgAAHUwAADqYAAAOpgAABdwnLpRPAAAABl0RVh0U29mdHdhcmUAUGFpbnQuTkVUIHYzLjUuNUmK/OAAAAEoSURBVDhPrVPHSgNRFM3XJ8P0RpJJ75AGKT/hTlFRUWyoCwu6EHV5nHPHZ2KiJAwOnN1p9747mcx/fWEYRjEQBAF83xd4nidwXReO48C2bZC3lknhXqGAj/l8I8gj/9uEjtuKVcBuPr9owsrbJJPzPpvheTQSvqZpSQvOuo3B62SCp+EQd73eZgMmUaDwMh7jvt/HTaeDi2bzpwG3vNzgbTqVmg+xgKCQqVetFs7qdRxXKsLP5XLJCMsGTHwcDHDb7YrgMgYTT2s1HJXLOIgiMSEvm80mBuoVVM3rdhsn1SoOSyUR7BeL8sTc/HmjIa2+nnJxD3/dwc7KeKy+dgfqINjEsiwoqL3oui5PxplZ+9dLXD1N0zRlURSn+lUMw0gvZmLq5DR1PwE9E+oxQiT4SQAAAABJRU5ErkJggg==';
var state_solved = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAgY0hSTQAAeiYAAICEAAD6AAAAgOgAAHUwAADqYAAAOpgAABdwnLpRPAAAABl0RVh0U29mdHdhcmUAUGFpbnQuTkVUIHYzLjUuNUmK/OAAAAEqSURBVDhPrVPJToRAEJ0fNmZkERgIiEIj+3bxezypUaNG4+7BJXow6heUXdX2zCiaIUSSd3tbdRWj0X99bdtucUDTNFDXNaGqKkJZllAUBeR5DsjrZKJQ3VuB+IMtBPKQPzVBx75iGaDujmdNsHKfZORsvocQPPvEj6JItMBZ+xiw1w1Yf1oD785ZbIBJKJAIXnzw711wb2ywL8zvBvjK8w2it4Bq+g+eABdiqnNlgXVmgHGsEZ8xJkaYN6Cajx64tzYJ7EsOnmidroJxpIF+oJAJ8sIwFAZyC7Kmcz0B80QH/VAlgbav0IqVnTFMzk1q9bXK2T38dQfL20udB+7cgTwIbJJlGUhM3yWOaWU4M9b+9RJ/nmaapiKZiwf9KkmSDBdj4uDkIXU/Ae1xwo0cXQQMAAAAAElFTkSuQmCC';
var state_found = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAgY0hSTQAAeiYAAICEAAD6AAAAgOgAAHUwAADqYAAAOpgAABdwnLpRPAAAABl0RVh0U29mdHdhcmUAUGFpbnQuTkVUIHYzLjUuNUmK/OAAAAESSURBVDhPrVNJaoRQEO3TqzhPmxzAjYrihAMqqCiIeqZKV9k/3YkJLRLh7d5Uv8rb7b8+27Y/7gDLssA0TYJhGARd10HTNFBVFZB3yESh7/uwbdtbIA/5XyboeFbMAjzPezbBymeSkbOuK4zjSHxBEPYWOOsZg3meYRgGaNv2vQEmoYBhmiboug7quoaiKL4b4Cu/NliWhWr2fU9AIaaWZQlZlkEcx8TneX4f4dWA1WyahgQITEzTFKIogjAMyQR5HMftBmwLrGZVVZAkCZERQRDQil3XhTzPqdVjlc97+OsOHMc5PPDhDthBYBNFUYCBvYsoirQynBlr/3qJP09TlmVKRvGlX0WSpOtiTLycfKXuJ+0c7jtCU1KuAAAAAElFTkSuQmCC';
var state_clear = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAgY0hSTQAAeiYAAICEAAD6AAAAgOgAAHUwAADqYAAAOpgAABdwnLpRPAAAABl0RVh0U29mdHdhcmUAUGFpbnQuTkVUIHYzLjUuNUmK/OAAAAFkSURBVDhPrZNLa8JQFIT9yy1uC30mNr4fIBXcKC6UCD7+RYvYRQlBwbRaY2pIbSxtKC6mOcdGY7RQQi/M4obMN3PPTSKR/1qFQuHGFfL5PHK5HCubzbIymQzS6TRSqRTcdxZ7mWSUZRm9Xm9Hki0iqOjdMUGwgVDyITPBDgHoWfT2aNuEKgeTvX0QcP0m4Mo4Z3AsFlu3oLP+BSBal7jQz3CqnewDnG4Xfn12OnhvtbBarViO48C2bZimCV3XQWvTgKbsN3+023h1Bzqv17FcLtloWRYMw8BkMoGmaQwQRXF9BD+AUs1GA8+1Gh4rFcxmM04cj8cYjUYYDocMoVaCIKwB7i0o98UiFs0mXtzUp2oVarmMh1KJDYPBAKqqQlEUTKdTbkV71/flv0oQJDiLfr/Pdf3rx7z9DjwKNUkmk/BEMFqSJPHA6MxUeyf5t98gkUhwGzKH+lXi8Xh4MyWGTg5T9xt4yvfg78PulQAAAABJRU5ErkJggg==';
var moveMysteriesIcon = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABGdBTUEAANbY1E9YMgAAABl0RVh0U29mdHdhcmUAQWRvYmUgSW1hZ2VSZWFkeXHJZTwAAAC4SURBVHjaYvz//z8DDDAyMiI4SACohpEBB2BB1nzh+hesikByMEPQLQHJgAVVbKbjsoRhzexYBgNNHqwuAQmgaL5zJBPORhbHZQgLMgekGVkBLpchewPFAFAYIPsXF0CRh8YCyCYwhgihigENhoujYwQDyCSkGaYGBWM1FWoAPpsxXECOZhBmwRVQyFGGL4UyIidldMWEYgMEmEhJ97jilGAYYA19qBwLkZbgdBVGGCCHAzHeAQgwAAYJB8lhWYArAAAAAElFTkSuQmCC';
var deleteMysteryIcon = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAALEgAACxIB0t1+/AAAACB0RVh0U29mdHdhcmUATWFjcm9tZWRpYSBGaXJld29ya3MgTVi7kSokAAAAFnRFWHRDcmVhdGlvbiBUaW1lADExLzA1LzA33bqJ2wAAAp9JREFUeJxVk8tr1FcUxz/3/n55VFMT8gCtQ6uLUBqqCCbiSgqFgpa2mVIEQUo2QnFZioj0QQVduOhf0FXBnTQDpVJ3RkTETqXkYTudjRknhj6m6TiTYfL73XNOF7+ZMHM253Lvh/M9j3ucmdFry2feOOoGB7/GR7Pmo5yqoMlOVZOdoiU7X83dfbbcy7veAKv5Y4v4aL69WSGtbyEi2YOPiPaO4EbHIYTCybuVfF+Ayo3Phhs/L5XTrX9y29WniMHUhwtMX/4GQylf/5Q/C98RAX5sAoaGq63J3PQ73z9sOzNjNX9sMTTq883qU4JBMHjrUY2fzhyhFuDs7cfcOrGfAzHEDtzLY7g4Lpx6+HferX40O2eqj+prj0kNpvILzFz/FtTAFFMFU1Bl5YtP+OuHmww4kNEJnNkJrzvta+3NCtJRPnzxcxDFVDAR6HhT5bULl9hMM863mlhIr8Vu+KWZtL6FAAK8WPqRRhRlHeo2uOM1BJqacT4kpPHQjFe1gyKCkWUdHXqdqfwCmDH5wcdMvncegIl3z5G+cpghl3GYEVQPetVsVN1h1n/7tVO3ZWWo7J5rv6/gHLu8qeA1hA18ROee1sY6dOcvWQDDQJXGxjqDXRCHimx4bTWfRHtHcIB30Cgt96miCgYmQq20RuwyLjhHrPLEWzRwxY2OEwER0Cqt9KmaSJawCrXyGkMu49rmENUrfu5OqUgIBT82QeyA7Rf8W7zPyJtzu2McPPAqz395QNJssMdD4jxOtfB+WYvOzLh3/u1hXymVpbWds8Z/BIPNAA3p2zP2RTA+4EnUqs8Tm764bu2+Zbp3cmoxVZvPPkmS9aHTsOAcbXNd5f5l6rWl46NHgnE1qM2majlTAZGqUylGpl+e/kNXevn/AT0JpV86x3yxAAAAAElFTkSuQmCC';
var finalIcon = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEtGw7AAAABGdBTUEAANbY1E9YMgAAABl0RVh0U29mdHdhcmUAQWRvYmUgSW1hZ2VSZWFkeXHJZTwAAAILSURBVHjanFVBSONAFP0bJaIggbU3FcSDeKkXl4LSXrwGhF5786SHgguCdG+CRVlBKFiiFy305nEXT4UUhNKDWoRAURZaFva4Zrd1QWgp/P0zNmPaJk3ig9c/zUze/Hkz+QOICBYJEWKOaBDRJ6vEPHGlR6srOELMhMNhzOVyaBgG+kW1WsV8Po+RSIQJnRAVu7CWTCax1Wrhe9HpdDCVSjExrasJajQaFQO+6be4vX/OI8fFQaAJVFVlqokP9HNFoP8qn+V78Q6KZYO3j/7tgHz2AhbaWxM8you74hlsfAE7SqUSxGKxkkTtZQK4wRLjgt1J2o9HnPB5jxwdo+0+hKd6nfeR1zww4XGCeHl17iMEBk0Qur58nVyWQVEUWeofE5qfF+3dyeMBDbs1Pavqs0RySmBmdtpXosLzr38H+hyFF2anXH3uyZ428en+wbFv1Onh+toncTLc8LxZ4baFXPoltxctO/p9Zhmypdv3IpBwvx2Q2eOiXoJDrbCOXbHsb9mBMrZnVv75J/DRloZ1rq0u8ei1kW7CbYLnQOuT9TzbpNVsNttM+IYAbscuqB2VSoUHJnxKAK9j9+OX6Us4m82ycCoKfTqddqyvv2s1XptFfR4CTdPeCn1XmKWlxeNxLBQKaJqm78LeaDRQ13VMJBJclBgWwrbLNE4sEM0Al2mDqLNbw671X4ABANNJB/Q2gPgTAAAAAElFTkSuQmCC';
var finalIconLink = 'http://gccomment.svn.sourceforge.net/svnroot/gccomment/trunk/gccomment/res/finalcoord.png';

var origfound = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEtGw7AAAABGdBTUEAANbY1E9YMgAAABl0RVh0U29mdHdhcmUAQWRvYmUgSW1hZ2VSZWFkeXHJZTwAAACaSURBVHja7JXLCoAgEEWdiGjpB4WL6KsjAsWvimhKYdAMgny0iO5qBOfMYzEXEJGRlFLuESEhBFAMBuwD12ph9dacPt3J5FKOX6AOgX03QEyXYQGQUmI4Ropo+oq6zS0L9veTFZxTtNLs4GId/+Af/AXwO0eoyCrstT+u26wnTIVNesSLgxi4b1FPrInihrWMc+48r4SZ7gIMANPlS6BG6nS1AAAAAElFTkSuQmCC';
var origsolved = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEtGw7AAAABGdBTUEAANbY1E9YMgAAABl0RVh0U29mdHdhcmUAQWRvYmUgSW1hZ2VSZWFkeXHJZTwAAAC7SURBVHja7JVLDsIwDETtNkDPwT6rIsQZuCQHghUcgivwS4Y6yCUIKVKp2fVJaaZSPflUGjMAUlbE75cfOBBYNYtxbji7NXSfXz4+KiG1WpMv0BsPNSwtkIzX0SHGQPs6Mhmgp68CP8iFBVlRw6W5kkd+P2ORjfbGlug/MjdWJuPJeDIuhZBmsHkIqbBCIjghQd+CsLk2ED1mbM9LtEniuzXJCST6hrQmqZGddoJ2pyN571+t6R/N9CnAAC9tlQThla5PAAAAAElFTkSuQmCC';
var origunsolved = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEtGw7AAAABGdBTUEAANbY1E9YMgAAABl0RVh0U29mdHdhcmUAQWRvYmUgSW1hZ2VSZWFkeXHJZTwAAACvSURBVHjaYvz//z8DHDAyInGIA39ZEGzm3/8Z4UaBDUYyEKSQ+Q+Q8R+hCK/BrIz/Qep/cSDE2L7/Z2RCtxlsK5GGoqtn+4HkeaBTIa4lwTB84Bcn43+QBUzo4UQpgLkabDA4TKkMmKhuIjRIqW8wzVw8avCowcPBYGgRTPVCiA5BASw0wKUbGdUSOnioyY4o20FVE6iwx8AgcWIwmr6rR4+C9TJSWpliKzJBACDAAOfWdEr4Mcv8AAAAAElFTkSuQmCC';
var finaliconfound = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEtGw7AAAABGdBTUEAANbY1E9YMgAAABl0RVh0U29mdHdhcmUAQWRvYmUgSW1hZ2VSZWFkeXHJZTwAAAFRSURBVHjaYvz//z8DDBw6dAjBIQPY2dkxwtiMIIOxGQhURJRhQL1YLWAh10B09RgWHDx48D8Iw8DGvaf/5zfPBdNgMK/tPykAZh4LLpfsO3aJwWOnKwPbjG8MDAUNYLFfGVxgmk2jDKEwsRKrfiZCXoUZBjYQZAlI7EYXGIMt5GdnYJjfzvDm3j38BlspCJGeHIAWiBxciRLmGAaLKCnB2WW8vRhmwFyN4Su0IMEaFDKy0kQ5FB7mne+JC2M1WWGc4YziemAkvjl/Hasc1lTh52QCThX4wKf0s+BgE8EhjzNVwIIDPZxBLgR5HTkuSDIYPTgYJjSADSVkIN6ggCW7fceI8zZJLkZ22bEH70hO2nhznpOVHjx7U9VglEhDy7KEilG8BoOSHbnBQdDFsGR36/FbkgxGqUGwFfKgIIC5FtkH+IIBVIPQrGpipFVlChBgAFhG0uUgufqcAAAAAElFTkSuQmCC';
var finaliconsolved = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEtGw7AAAABGdBTUEAANbY1E9YMgAAABl0RVh0U29mdHdhcmUAQWRvYmUgSW1hZ2VSZWFkeXHJZTwAAAJtSURBVHjanFU7axRRFP7uncc+shtfK1toQFKI22hjlTKgWR8ICv4AK+1MFbALCIqCkDKNWttEUiUWBmy2EREsjAgbBK2S9ZHd2ZnZ2Zl7nLnrzL5m9uEHw1zuOfe753733HMYESFE2WImU5ARJgQJcCSA/fvLlRxCyYKTB2s7Q9nIJyC+4rCGaCHFPa7NUhF25hCb6SYmwU17Brozi7qyDyFEm+twtlKUk8RLDebk2yc1L2fhtd7A/+CWkwevZ2Gk9tvbedJx3WDW1QOVQmy+fU/3Hz6Xf4kXj2galA9VKjdhqa5G6WNucSiCnconlN9cgr5uAsurcs6515FQP7fSdbzzoG9dTtNhKG5aXpCZ/pN4xJBMEgabBHNfnspPbngkBbx8jNrenrR5CodnoHPznHWJFs4cn15gf4PCu1dyuBHcEWPDKVWYn4/GK/lnQxxh1EOn6pGEa9QhpgHH03OnJgo00vzJ77550fYjZmx4wdm5E4k690XvX2Lt426sTe19SSFuLF6UWTEK9bsfpGyFGJuUgih+YSjHoM5BhMHRe+9iECSlSDAOyoG1VUk6ihA9NURNMgZpt1MZf+wkcIrJisG0q3z7NXVq81HGxYXz0fOeBiwipvHO4ZMdW0b9KhdUTJnHGftorFOQdtPKoQoBJedHrDrMtmw70TFMu6/ff05EbJsu4MKWYS/V4dyuFWPr60G1KmtzVJ9HYLl6jS77XAFnpzW1mEEOdE6qllV1v4kxbKSMCTtHDtwjtCwXjua013583i2VShdYXzM1mcVVpN0miPmbMi0sKjFNtJsCpM74AfrH38pSJpz+K8AAGeJxOI+fpJMAAAAASUVORK5CYII=';
var finaliconunsolved = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEtGw7AAAABGdBTUEAANbY1E9YMgAAABl0RVh0U29mdHdhcmUAQWRvYmUgSW1hZ2VSZWFkeXHJZTwAAAIVSURBVHjaYvz//z8DHDAy/v/PBKT+MRAN3kgyMHwTYGBg/s3wX/o2SDcEsICI/8yM/2GGfeNlYuD+COR8/UqUweyyPAwi1/8zvJJlYAQ5DCz4/z/Iif/BLv3JycjA/h3IfvCAgUFUFKKLi4tol38WATr2PyMD77t/YIOZQIZ+AJrD/uoTUPYzw/aL9xgK+lYwbDpxDaJjfjtRBvO++cfA+/gzPEjBQfHAkIPBgIcHLPabhxdM7zt2icFjpysD24xvDAwFDWCxXxkQH7BplCFMTKxEseAv0ETmPwwM4MDWOfADp0tghoENBFkCErvRBcZgC/nZwb56c+8eOOiYoHHFhG6QlYIQA8kAaIHIwZWQUPj8FbvBIkpKcHYZby+GGTBXY/gKLUiYsDlARlaaKIfCw7zzPYYcVoPVZIVxhjOK64GR+Ob8daxyLNgE/ZxMwKkCH/iUfhYcbCI45JlwaYQFB3o4g1wI8jpyXJBkMHpwMExoABtKyEC8QQFLdvuOEedtklyM7LJjD96RnLSZ8Ek6WenBszdVDUaJNFCWJQL84+Nm+McMNfiKAwcDrmRHanCADf0LNfjvX9xVBizZ3Xr8liiD/7DAUgWwUDYGlp/f+ZgYOJ98QFXFx8eQYKsKdK0wjlzyCYV7OUSdQfcbUg2CXDXBwcePxAU+Pz8K9+6OHdeV3d21GCmtTMFVHEwP0KUwMYAAAwD3trv/JouOHAAAAABJRU5ErkJggg==';

var archive = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABGdBTUEAAK/INwWK6QAAABl0RVh0U29mdHdhcmUAQWRvYmUgSW1hZ2VSZWFkeXHJZTwAAALnSURBVDjLfZNLaFx1HIW/e2fuzJ00w0ymkpQpiUKfMT7SblzU4kayELEptRChUEFEqKALUaRUV2YhlCLYjYq4FBeuiqZgC6FIQzBpEGpDkzHNs5PMTJtmHnfu6//7uSh2IYNnffg23zmWqtIpd395YwiRL1Q0qyIfD56cmOvUs/4LWJg40auiH6jI+7v3ncybdo2Hy9ebKvqNGrn03Nj1+x0Bi1dHHVV9W0U+ye4d2d83+Ca2GJrlGZx0gkppkkfrsysqclFFvh8++3v7CWDh6ugIohfSPcPH+w6fwu05ABoSby9yb3Kc/mePYXc9TdCqslWapVGdn1Zjxo++O33Fujtx4gdEzj61f8xyC8/jN2rsVOcxYZOoVSZtBewZOAT+NonuAWw3S728wFZpFm975cekGjlz8NXLVtSo0SxPImGdtFfFq5epr21wdOxrnMwuaC2jrRJWfYHdxRfIFeDWr0unkyrSUqxcyk2TLQzQrt6hqydPvidDBg/8VTAp8DegvYa3OU1z+SbuM6dQI62kioAAVgondwAnncWvzCDNCk4CLO9vsJVw8xqN+iPiTB5SaTSKURGSaoTHHgxoAMlduL1HiFMZXP8BsvkbO1GD2O3GpLOIF0KsSBijxmCrMY+FqgGJQDzQgGT3XrJ7DuI5EKZd4iDG+CHG84m8AIki1Ai2imRsx4FEBtQHCUB8MG1wi8QKGhjEC4mbAVHTx8kNYSuoiGurkRtLN76ivb0K6SIkusCEoBEgaCQYPyT2QhKpAXKHTiMmQ2lmChWZTrw32v9TsLOyVlu8Nhi2G4Vs32HsTC9IA2KPRuU2Erp097+O5RRYvz3H1r3JldivfY7IR0+mfOu7l3pV5EM1cq744mi+OPwaRD71tSk0Vsp3/uLB6s2minyrIpeOf7a00fFMf1w+MqRGzqvIW/teecdqV5a5P/8ncXv9ZxUdf/lCae5/3/hvpi4OjajIp4ikVOTLY+cXr3Tq/QPcssKNXib9yAAAAABJRU5ErkJggg==';
var archiveAdd = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABGdBTUEAAK/INwWK6QAAABl0RVh0U29mdHdhcmUAQWRvYmUgSW1hZ2VSZWFkeXHJZTwAAAMVSURBVDjLdZNLaFx1GEfPnZk7cyfNkElS0jTVKKRpE2PSpAhKHyqo2QhtShUiCPWBLhTdFKUUlxYUqggGxYqIbsSNFKQmVqMhTVujSQuhtnmMaR5NJs0kncz7ztz5f5+LgguNv/WPszkcS1XZbFPnDrUh8q6KRlTkrdYj/Vc3+1n/Bkz3H65T0TdV5PXapiNRU1jjztxgVkU/UyMfPtg7uLwpYGagx1bVF1Tk7ciO7p3bWp/BJ4ZsfAw75Gc1NsTGrfF5FTmtIl90Hhsp/AOYHujpRvSdUHXnwW0tR3Gqm0FLlJMz3Bw6xb0P7MdXcR/FXILbsXEyiRujasypva+Mfm9N9R/+EpFjW3f2Wk5NO25mjVTiBqaUxcvFCVlF6ht3g5vEX9mIz4mQjk9zOzZOPjn/TUCNPL/ryT7Ly6yRjQ8hpTShfIJ8Ok56cYm9vR9jh7dAbg7NxbDS09Q2dFBVA1d+mH02oCI5xaoKOiEiNY0UEtepqI4SrQ4TJg/uApgguEtQWCS/Mkp27hLO/UdRI7mAioAAVhC7qhk7FMFdHUOyq9h+sPJ/gU8prfxMJr1BORyFYAj1yqgIATXCXQ8GtAiBLTh1XZSDYRx3HVn5iZSXoexUYkIRJF+CsiKlMmoMATXmrlA1IB5IHrRIoHIHkfpdpO6M4fkcLiyFuLwWJu26lNwUB5MTtBghoCJhn20DYSivgxRBXDBFcBooK/yyEGTKruXxRx/inppmfv3zLOevXWByw630qZHh2eGPKCQXINQA/gowJVAPENQTflzw6GzZg/EZ9mx/CmN5PNK+j4s5z/KJMU9nFkdenRw4GZv//WsMQYjsBjsMCqbokcisY1uVHGp9A4DjT5yhqa4Do/j8n343b+o7X7oSHzvzbT4x48UnzrVj+Z1I48NY9lZEwnw1OkT1dpvh2bMcaOrhvfMvkimsc21yyv1PTH/0dbWpkZMq8lzTYy9bhdU5Pr84yPVomX0dB2iu72Jm5SqXJka4dTP1gfV/OV8+3datIicQCarI+8eXc/uB14AIkAE++a1v+cTfDyOvKVPjhy0AAAAASUVORK5CYII=';
var archiveRemove = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABGdBTUEAAK/INwWK6QAAABl0RVh0U29mdHdhcmUAQWRvYmUgSW1hZ2VSZWFkeXHJZTwAAAMNSURBVDjLdZNLaFx1GMV/d+bO3DtJxkwSSWNq05YkrTVa04qIiOiiRIxgE2ohhUIKRQQFBcGiIiJiFaGIYEFERFy5dCE1pQ8JIbSEJhG66GM6idOk6Uwyec7zztz7/z4XlSw0nvXhx4FzjqWqbKXb517rQeRzFY2ryPv7Bkf+3Mpn/RuQHDncqqLvqMjbLZ2DCVNZZjV9uaii36uRr58Yunx/S8Cd8wMRVT2hIqfi2/u6tu17nZAYiplJIk6YpdQo6/em7qrIGRX5sXd4vLIJSJ4f6EP0Y6ep94Vtjx3BbeoGrRGs3eGv0dPsePx5QnU7qZZyLKamKORuTqgxpw++MfGbdXvk8E+IDD/cNWS5zU/iFZbZyN3E1Ir4pQyOVaWtYy94a4QbOgi5cfKZJIupKcprd3+x1cjxPYfOWn5hmWJmFKnlcco5yvkM+fkFDg59SyRWD6U0Wkph5ZO0tO+nsRmmf589aqtISbEao65DvLmDSu4GdU0JEk0xYpTBmwMTBW8BKvOUsxMU01dwdx1BjZRsFQEBrCiRxm4iThxvaRIpLhEJg1WegZBSy16ikF8niCUg6qB+gIpgqxEe9GBAq2DX47YeIIjGcL0VJHuRDb9A4DZgnDhSrkGgSC1AjcFWYx4UqgbEBymDVrEbthNv28PG6iR+yGVlIsfKtTm8xXVCD0VpfY5/EojEQpEIEINgBaQK4oGpgttOoLA6sUIt6/L08Q9xdvdQuX6BG+OX8IP1+pAaGZsd+4bK2hw47RCuA1MD9QFBfSFzJUn3S0dxZ0axfj5G3eyv7Opopja3HthizKuF+fHhW+mxU82dh7oe3d9POL4XyinwSpiqj1mr4bbthv73Nidsf/oIIU+czSlP//Bsq4q8q0bean9qINHe2w++R37+KtOffckzrwxSP3eOaiVLGSjkw9yaYeE/Z7p29kCPGvlIRY51vnjSqiylmb/4B3be0x0tgWWH7lHIBaQXw8b39BPr/+589UxPn4p8gEhURb7ierWntHr/zbCxdpqwLih89/KF4Iu/AXSvuZLBEiNYAAAAAElFTkSuQmCC';

var languages = [];
languages[SETTINGS_LANGUAGE_EN] = {
	mycomments : "My comments",
	mycomment : "My comment",
	myfinalcoords : "My final coordinates",
	and : "and",
	never : "never",
	finale : "Final",
	final_coordinate : "Final coordinate",
	final_location : "Final location",
	final_location_byGCC : "Final location by GCC",
	menu_options : 'Show options',
	menu_showmycomments : "Show my comments",
	menu_export : "Export",
	menu_import : "Import",
	menu_delete : "Delete",
	menu_patchgpx : "Patch GPX",
	type_untyped : "untyped",
	type_unsolved : "unsolved",
	type_solved : "solved",
	type_found : "found",
	type_archived : "archived",
	ov_totalamount : "Total amount",
	ov_amountarchive : "Amount of them in archive",
	ov_lastex : "Last export",
	ov_lastim : "Last import",
	ov_lastup : "Last check for updates",
	settings_intro : "Thanks for using GCComment. Visit <a href='http://userscripts.org/scripts/show/75959' target='blank'>userscripts.org</a> for general information and documentation or <a href='http://www.geoclub.de/viewtopic.php?f=117&t=44631' target='blank'>geoclub.de</a> for discussions & feedback. If you have direct feedback or questions, contact me at <a href='mailto:birnbaum2001@gmx.de'>birnbaum2001@gmx.de</a>.",
	settings_feelfree : "Feel free to show your appreciation :)",
	settings_enterUUID : "UUID for server synchronisation",
	settings_enterServer : "Server for server synchronisation",
	settings_allowExport : "Allow export of comment data to other scripts (e.g., GC Tour)",
	settings_lazyTable : "Lazy table refresh (no update on state change or delete from overview)",
	settings_syncWithGS : "When saving the final coordindates, also correct coordinates at Groundspeak",
	settings_saveprefs : "Save preferences",
	settings_language : "Language",
	thank_you : "Thank you",
	table_comments : "My comment & final coordinates",
	table_lastsave : "Last save",
	table_actions : "Actions",
	table_ihaveit : 'I have the final coordinates :)',
	table_fromhome : "from home",
	table_markcacheas : "Mark cache as ",
	table_editondetail : "Edit on Detail page",
	table_removefromarchive : "Remove from archive",
	table_addtoarchive : "Add to archive",
	table_finalat : "Final at ",
	table_filter_all : 'Show all',
	table_filter_untyped : "Show all untyped",
	table_filter_unsolved : "Show all unsolved",
	table_filter_solved : "Show all solved",
	table_filter_found : "Show all found",
	table_filter_archived : "Show all archived",
	export_step1 : "Choose which type of comments to export.",
	export_step2 : "Choose the target format:",
	export_explain : "By pressing the 'Perform filtered Export' button, your caches will be filtered and the output will be generated. You will be asked to save a cryptically named file. Just store it where you like and rename it appropriately, e.g., 'myfinds2012.html'.\n\nYou can also export to Dropbox. You will be asked for a file name that will be created in your Dropbox folder.",
	export_perform : "Perform filtered export",
	export_toServer : "Export all to server",
	export_toDropbox : "Export all to Dropbox",
	export_toDropboxEnterFileName : "Please enter the file name",
	export_toDropboxPerformFilteredExport : "Perform filtered export to Dropbox",
	export_toServer_result : "The server said",
	import_explain : "You can import backups that were previously exported using GCComment. The only file formatted supported right now is GCC, i.e., GCComments own file format. After pressing the 'Execute Import' button, the import will be parsed. Comments will be imported, unless there is already a comment with a newer time stamp. So more recent comments cannot be overwritten by older backups.",
	import_choose : "Choose GCC file to import from (*.gcc):",
	import_fromServer : "Load from server",
	import_fromDropbox : "Load from Dropbox",
	import_fromDropboxCheckForFiles : "Check on Dropbox",
	import_perform : "Execute import",
	import_close : "Close import window",
	import_resultimported : "Imported comments",
	import_resultnotimported : "Already existing",
	delete_select : "Select the types you want to delete:",
	all : "all",
	delete_perform : "Perform delete all",
	delete_result : "Removed caches",
	delete_confirmation : "Do you really want to delete comments according to your filters?\n\nIf you press ok, all comments according to the selected filters will be removed! Make sure to have a backup! All removed comments will be written to the error console.",
	patchgpx_explain : "You can open an existing GPX file and patch it according to the options selected below. By pressing 'Patch and Download', the GPX file will be loaded and you will be asked to save a file with a strange filename. Save it and rename the file to something useful, e.g., 'onlysolved.gpx'.",
	patchgpx_remove : "Remove caches from GPX that ...",
	patchgpx_filter_nogcc : "have no GCC entry",
	patchgpx_filter_markednotsolved : "you marked as not solved",
	patchgpx_filter_markedsolved : "you marked as solved",
	patchgpx_filter_markfound : "you marked as found",
	patchgpx_changeorig : "Change the original waypoint's coordinates to your final coordinates",
	patchgpx_addwptforfinal : "Add additional waypoints for final coordinates",
	patchgpx_perform : "Patch and download",
	detail_final : "Final coordinate",
	detail_finalsave : "Save final coordinate",
	detail_finaldelete : "Delete final coordinate",
	detail_lastsaved : "last saved",
	detail_edit : "Edit comment",
	detail_delete : "Delete comment",
	detail_thestate : "The state:",
	detail_save : "Save comment",
	detail_cancel : "Cancel editing",
	detail_add : "Add comment",
	detail_finaldeleteconfirmation : "Do you really want to delete the final coordinates?",
	detail_deleteconfirmation : 'Do you really want to delete this comment?',
	detail_inclfinal : "incl. final",
	map_enablemm : "Enable mystery mover",
	map_area : "Area",
	map_home : "Home",
	log_markfound : "Mark as found in GCC",
	log_movearchive : "Move to archive in GCC",
	alert_couldnotparse : 'Coordinates could not be parsed. Please correct them before saving.\nError Message:',
	alert_coordsnotvalid : "Coordinates do not match DegMin, Dec, or Plain",
	gpxexporttitle : "Waypoint listing with final coordinates of geocaches",
	gpxexportdesc : "This is an export of ",
	gpxexportwpttitle : 'GCComment Final and Comment',
	actionfailed : "Action failed",
	savegpx_explain : 'Use GCComment information to configure your GPX ',
	savegpx_addgcc : 'Add your GCComment',
	savegpx_changeorig : 'Change the original coordinates to your final coordinates',
	savegpx_addfinal : 'Add final coordinates as separate waypoint',
	update_changes : 'Changes in version ',
	update_clickToUpdate : "Click here to update!",
	tmpl_commentremoved : "Removed <a target='blank' href='data:text/html;base64,{{1}}' class='gcccomment' data-gcccom='{{2}}'>comment.</a>",
	tmpl_patchresult : "Patching removed {{countWPTRemoved}} waypoints.<br/>Patching added {{countWPTAdded}} waypoints.<br/>Patching changed Coords of {{countCoordChanged}} waypoints.<br/>The GPX now contains {{total}} waypoints.",
	tmpl_import_replace : "Replacing the <a target='blank' href='data:text/html;base64,{{oldTooltipBase64}}' class='gcccomment' data-gcccom='{{oldTooltip}}'>old comment</a> with a <a target='blank' href='data:text/html;base64,{{importTooltipBase64}}' class='gcccomment' data-gcccom='{{importTooltip}}'>new comment</a>.",
	tmpl_import_save : "Saving <a target='blank' href='data:text/html;base64,{{importTooltipBase64}}' class='gcccomment' data-gcccom='{{importTooltip}}'>new comment.</a></li>",
	tmpl_update : "Hooray, a GCComment update is available. The new version is {{serverVersion}} while your installed version is {{version}}."
};
languages[SETTINGS_LANGUAGE_DE] = {
	mycomments : "Meine Kommentare",
	mycomment : "Mein Kommentar",
	myfinalcoords : "Meine Finalkoordinaten",
	and : "und",
	never : "niemals",
	finale : "Finale",
	final_coordinate : "Finalkoordinate",
	final_location : "Finalort",
	final_location_byGCC : "Finalort von GCC",
	menu_options : 'Optionen anzeigen',
	menu_showmycomments : "Zeige meine Kommentare",
	menu_export : "Export",
	menu_import : "Import",
	menu_delete : "Löschen",
	menu_patchgpx : "GPX patchen",
	type_untyped : "ungetypt",
	type_unsolved : "ungelöst",
	type_solved : "gelöst",
	type_found : "gefunden",
	type_archived : "archiviert",
	ov_totalamount : "Gesamtanzahl",
	ov_amountarchive : "Anzahl derer im Archiv",
	ov_lastex : "Letzter Export",
	ov_lastim : "Letzter Import",
	ov_lastup : "Letzte Prüfung auf Aktualisierung",
	settings_intro : "Vielen Dank für die Verwendung von GCComment. Besuche <a href='http://userscripts.org/scripts/show/75959' target='blank'>userscripts.org</a> für allgemeine Informationen und Dokumentation oder <a href='http://www.geoclub.de/viewtopic.php?f=117&t=44631' target='blank'>geoclub.de</a> für Diskussionen und Rückmeldungen. Wenn du direkte Rückmeldungen oder Fragen hast, dann kannst du mich über <a href='mailto:birnbaum2001@gmx.de'>birnbaum2001@gmx.de</a> kontaktieren.",
	settings_feelfree : "Zögere nicht, deiner Wertschätzung Ausdruck zu verleihen :)",
	settings_enterUUID : "UUID zur Serversynchronisierung",
	settings_enterServer : "Server zur Serversynchronisierung",
	settings_allowExport : "Erlaube den Export der Kommentare an andere Skripte (z.B. GC Tour)",
	settings_lazyTable : "Träge Tabellenaktualisierung (Keine Aktualisierung der Übersichtstabelle nach Statusänderung oder Löschen)",
	settings_syncWithGS : "Korrigiere die Finalkoordinaten bei Groundspeak beim Speichern",
	settings_saveprefs : "Einstellungen speichern",
	settings_language : "Language / Sprache",
	thank_you : "Danke",
	table_comments : "Mein Kommentare & Finalkoordinaten",
	table_lastsave : "Letztes Speichern",
	table_actions : "Aktionen",
	table_ihaveit : 'Ich habe die Finalkoordinate :)',
	table_fromhome : "von zuhause",
	table_markcacheas : "Markiere Cache als ",
	table_editondetail : "Auf Detailseite editieren",
	table_removefromarchive : "Aus dem Archiv entfernen",
	table_addtoarchive : "In das Archiv einfügen",
	table_finalat : "Finale bei ",
	table_filter_all : 'Zeige alle',
	table_filter_untyped : "Zeige alle ungetypten",
	table_filter_unsolved : "Zeige alle ungelösten",
	table_filter_solved : "Zeige alle gelösten",
	table_filter_found : "Zeige alle gefundenen",
	table_filter_archived : "Zeige alle archivierten",
	export_step1 : "Wähle den Typ der zu exportierenden Kommentare.",
	export_step2 : "Wähle das Zielformat:",
	export_explain : "Durch drücken des 'Gefilterten Export durchführen'-Knopf werden die Kommentare gemäß der Einstellungen gefiltert und das gewählte Ausgabeformat erzeugt. Es wird eine Datei mit einem kryptischen Namen gespeichert. Diese einfach irgendwo ablegen und entsprechend umbenennen z.B. 'MeineFunde_2012.html'.\n\nBeim Export zur Dropbox wird nach einem Dateinamen gefragt, welche in der Dropbox erstellt werden soll.",
	export_perform : "Gefilterten Export durchführen",
	export_toServer : "Alle zum Server exportieren",
	export_toDropbox : "Alle zur Dropbox exportieren",
	export_toDropboxEnterFileName : "Bitte Dateinamen eingeben",
	export_toDropboxPerformFilteredExport : "Gefilterten Export zu Dropbox durchführen",
	export_toServer_result : "Der Server sagte",
	import_explain : "Es können Sicherungskopien importiert werden, die zuvor von GCComment exportiert wurden. Es wird nur das GCComment-eigene Dateiformat unterstützt (*.gcc). Nach dem Drücken des 'Import durchführen'-Knopf wird der Import geprüft. Die Kommentare werden importiert solange nicht schon ein Kommentar mit einem neueren Zeitstempel vorhanden ist. Daher können aktuellere Kommentare nicht durch ältere überschrieben werden.",
	import_choose : "Wähle GCC-Datei zum Importieren (*.gcc):",
	import_fromServer : "Lade vom Server",
	import_fromDropbox : "Lade von Dropbox",
	import_fromDropboxCheckForFiles : "Prüfe in Dropbox",
	import_perform : "Import durchführen",
	import_close : "Importfenster schließen",
	import_resultimported : "Importierte Kommentare",
	import_resultnotimported : "Bereits existierende Kommentare",
	delete_select : "Wähle die zu löschenden Kommentartypen:",
	all : "alle",
	delete_perform : "Alle löschen",
	delete_result : "Gelöschte Kommentare",
	delete_confirmation : "Möchtest du wirklich die Kommentare gemäß der Filtereinstellungen löschen?\n\nWenn du Ok drückst, werden diese gelöscht! Stelle sicher, dass du ein Backup hast. Zur Sicherheit werden alle gelöschten Kommentare auf die Fehlerkonsole (CTRL-Shift-J) geschrieben.",
	patchgpx_explain : "Du kannst eine existierende GPX-Datei öffnen und entsprechend der folgenden Optionen patchen. Durch klicken von 'Patch und Download' wird die GPX-Datei geladen und du wirst gebeten, eine Datei mit seltsamem Dateinamen abzuspeichern. Tu dies und benenne die Datei in etwas Sinnvolles um, z.B. 'nur_gelöste.gpx'.",
	patchgpx_remove : "Entferne Caches aus dem GPX, die ...",
	patchgpx_filter_nogcc : "keinen GCComment-Eintrag haben",
	patchgpx_filter_markednotsolved : "als ungelöst markiert sind",
	patchgpx_filter_markedsolved : "als gelöst markiert sind",
	patchgpx_filter_markfound : "als gefunden markiert sind",
	patchgpx_changeorig : "Ändere die Koordinaten des Original-Wegpunktes auf deine Finalkoordinaten",
	patchgpx_addwptforfinal : "Füge einen zusätzlichen Wegpunkt für deine Finalkoordinaten ein",
	patchgpx_perform : "Patch und Download",
	detail_final : "Finalkoordinate",
	detail_finalsave : "Finalkoordinate speichern",
	detail_finaldelete : "Finalkoordinate löschen",
	detail_lastsaved : "zuletzt gespeichert",
	detail_edit : "Kommentar editieren",
	detail_delete : "Kommentar löschen",
	detail_thestate : "Kommentarstatus:",
	detail_save : "Kommentar speichern",
	detail_cancel : "Editieren abbrechen",
	detail_add : "Kommentar hinzufügen",
	detail_finaldeleteconfirmation : "Möchtest du wirklich die Finalkoordinate löschen?",
	detail_deleteconfirmation : 'Möchtest du wirklich diesen Kommentar löschen?',
	detail_inclfinal : "inkl. Finale",
	map_enablemm : "Aktiviere den Mystery-Verschieber",
	map_area : "Finalgebiet",
	map_home : "Heimat",
	log_markfound : "In GCC als gefunden markieren",
	log_movearchive : "In GCC ins Archiv bewegen",
	alert_couldnotparse : 'Koordinaten konnten nicht geparst werden. Bitte vor dem Speichern korrigieren:\nFehlermeldung:',
	alert_coordsnotvalid : "Koordinaten sind nicht DegMin, Dec, or Plain",
	gpxexporttitle : "Wegpunkte mit Finalkoordinaten von Geocaches",
	gpxexportdesc : "Das ist ein Export von ",
	gpxexportwpttitle : 'GCComment Finale und Kommentar',
	actionfailed : "Aktion fehlgeschlagen",
	savegpx_explain : 'Benutze GCComment-Information, um das GPX zu konfigurieren ',
	savegpx_addgcc : 'Füge deinen Kommentar hinzu',
	savegpx_changeorig : 'Ändere die Originalkoordinate auf deine Finalkoordinate',
	savegpx_addfinal : 'Füge die Finalkoordinate als zusätzlichen Wegpunkt hinzu',
	update_changes : 'Änderungen in Version ',
	update_clickToUpdate : "Hier klicken, um das Update einzuspielen!",
	tmpl_commentremoved : "<a target='blank' href='data:text/html;base64,{{1}}' class='gcccomment' data-gcccom='{{2}}'>Kommentar</a> gelöscht.",
	tmpl_patchresult : "Patching hat {{countWPTRemoved}} Wegpunkte entfernt.<br/>Patching hat {{countWPTAdded}} Wegpunkte hinzugefügt.<br/>Patching hat {{countCoordChanged}} Koordinaten von Wegpunkten geändert.<br/>Die GPX-Datei enthält nun {{total}} Wegpunkte.",
	tmpl_import_replace : "Der <a target='blank' href='data:text/html;base64,{{oldTooltipBase64}}' class='gcccomment' data-gcccom='{{oldTooltip}}'>alte Kommentar</a> wurde durch den <a target='blank' href='data:text/html;base64,{{importTooltipBase64}}' class='gcccomment' data-gcccom='{{importTooltip}}'>neuen Kommentar</a> ersetzt.",
	tmpl_import_save : "Ein <a target='blank' href='data:text/html;base64,{{importTooltipBase64}}' class='gcccomment' data-gcccom='{{importTooltip}}'>neuer Kommentar</a> wurde gespeichert.</li>",
	tmpl_update : "Hooray, eine Aktualisierung für GCComment ist verfügbar. Die neue Version ist {{serverVersion}}, während die installierte Version {{version}} ist."
};
var langsetting = GM_getValue(SETTINGS_LANGUAGE);
var lang = languages[SETTINGS_LANGUAGE_EN];

function main() {
	$ = unsafeWindow.$;
	jQuery = unsafeWindow.jQuery;
	version = "68";
	updatechangesurl = 'https://gccomment.svn.sourceforge.net/svnroot/gccomment/trunk/gccomment/src/version.xml';
	updateurl = 'http://userscripts.org/scripts/source/75959.meta.js';

	if (langsetting === SETTINGS_LANGUAGE_AUTO) {
		var gslang = $('#selected_language a').text();
		if (gslang.indexOf("English") > -1)
			lang = languages[SETTINGS_LANGUAGE_EN];
		else if (gslang.indexOf("Deutsch") > -1)
			lang = languages[SETTINGS_LANGUAGE_DE];
	} else {
		lang = languages[langsetting];
	}
	if (!lang)
		lang = languages[SETTINGS_LANGUAGE_EN];

	// Opera has no GM_registerMenuCommand
	if (browser != "Opera") {
		GM_registerMenuCommand("Enter a GCComment UUID", function() {
			var newUUID = window.prompt("Enter a new GCComment UUID. Previous one is "
					+ GM_getValue("gccUUID") + ".");
			if ((newUUID != null) && (newUUID != "")) {
				GM_setValue("gccUUID", newUUID);
			}
		});
		GM_registerMenuCommand("Enter a GCComment Server", function() {
			var newServer = window.prompt("Enter a new GCComment Server. Previous one is "
					+ GM_getValue("gccServer") + ".");
			if ((newServer != null) && (newServer != "")) {
				GM_setValue("gccServer", newServer);
			}
		});
	}

	var indexbuilt = GM_getValue(INDEXBUILT);
	if (indexbuilt != 'done') {
		log('info',
				'Building index for GCCode-GUID assignment. This is done only once after update on version 46');
		var keys = GM_listValues();
		for ( var i = 0; i < keys.length; i++) {
			if (keys[i].indexOf(COMPREFIX) >= 0) {
				// we got a comment
				var guid = keys[i].split(COMPREFIX)[1];
				var comment = doLoadCommentFromGUID(guid);
				if (!comment)
					continue;
				var indexKey = COMGCPREFIX + comment.gccode;
				GM_setValue(indexKey, guid);
				log("info", indexKey + "=" + guid);
			}
		}
		log('info', 'Finished building index.');
		GM_setValue(INDEXBUILT, 'done');
	}

	if (GM_getValue(ENABLE_EXPORT)) {
		log('info', 'Enabling export to other scripts');
		unsafeWindow.getGCComment = function(guid) {
			return doLoadCommentFromGUID(guid);
		};
	}

	// register own CSS styles
	appendCSS("text",
			"a.gccselect {padding-bottom:5px;background-color:#EBECED;outline:1px solid #D7D7D7}", null);

	// starting the GCC
	log('debug', 'found URL: ' + document.URL);
	if (document.URL.search("cache_details\.aspx") >= 0) {
		log('debug', 'matched gccommentOnDetailpage');
		gccommentOnDetailpage();
	} else if ((document.URL.search("\/my\/logs\.aspx") >= 0)
			|| (document.URL.search("\/seek\/nearest\.aspx") >= 0)
			|| (document.URL.search("\/watchlist\.aspx") >= 0)
			|| (document.URL.search("\/my\/recentlyviewedcaches\.aspx") >= 0)
			|| (document.URL.search("\/bookmarks\/view\.aspx") >= 0)) {
		log('debug', 'matched addCommentBubblesToPage');
		addCommentBubblesToPage();
	} else if (document.URL.search("cdpf\.aspx") >= 0) {
		log('debug', 'matched gccommentOnPrintPage');
		gccommentOnPrintPage();
	} else if ((document.URL.search("\/my\/default\.aspx") >= 0)
			|| (document.URL.search("\/my\/$") >= 0) || (document.URL.search("\/my\/#") >= 0)
			|| (document.URL.search("\/my\/?") >= 0)) {
		log('debug', 'matched gccommentOnProfilePage');
		gccommentOnProfilePage();
	} else if (document.URL.search("www.geocaching.com\/map") >= 0) {
		log('debug', 'matched mysteryMoverOnMapPage');
		mysteryMoverOnMapPage();
	} else if (document.URL.search("sendtogps\.aspx") >= 0) {
		log('debug', 'matched sendToGPS');
		sendToGPS();
	} else if (document.URL.search("\/account\/ManageLocations\.aspx") >= 0) {
		log('debug', 'matched gccommentOnManageLocations');
		gccommentOnManageLocations();
	} else if (document.URL.search("\/seek\/log\.aspx") >= 0) {
		log('debug', 'matched gccommentOnLogPage');
		gccommentOnLogPage();
	}
}

// GCComment auf der Profilseite
function gccommentOnProfilePage() {
	checkforupdates();
	// appendScript('src',
	// 'http://cdnjs.cloudflare.com/ajax/libs/dropbox.js/0.6.1/dropbox.min.js');

	appendScript('src', 'http://ajax.aspnetcdn.com/ajax/jquery.dataTables/1.9.0/jquery.dataTables.js');

	appendCSS('src',
			'http://ajax.aspnetcdn.com/ajax/jquery.dataTables/1.9.0/css/jquery.dataTables.css');
	appendCSS('text',
			'.odd{background-color:#ffffff} .even{background-color:#E8E8E8} .ui-icon{display:inline-block;}');

	// add links to each entry on that page
	addCommentBubblesToPage();

	// add overview of all comments on top of page
	var h2list = document.getElementsByTagName('h2');
	if (h2list.length > 0) {
		var root = h2list[0];

		gccRoot = document.createElement('div');
		gccRoot.setAttribute('style', 'outline:1px solid #D7D7D7;margin-bottom:10px;padding:3px;');
		root.parentNode.insertBefore(gccRoot, root.nextSibling);

		var gcclink = document.createElement('a');
		gcclink.setAttribute('style',
				'cursor:pointer;padding-left:5px;padding-right:5px;margin-left:5px');
		gcclink.setAttribute('id', 'configDivButton');
		gcclink.setAttribute('title', lang.menu_options);
		var icon = document.createElement('img');
		icon.setAttribute('src', gccIcon);
		icon.setAttribute('style', 'vertical-align:middle;');
		gcclink.appendChild(icon);
		gccRoot.appendChild(gcclink);

		gcclink.addEventListener('mouseover', function(evt) {
			var stats = "<u><b>GCComment v" + version + "</b></u><br><b>" + lang.ov_totalamount + "</b>"
					+ getNumberOfComments() + " (" + GM_getValue('countWhite') + " " + lang.type_untyped
					+ ", " + GM_getValue('countRed') + " " + lang.type_unsolved + ", "
					+ GM_getValue('countGreen') + " " + lang.type_solved + ", " + lang.and + " "
					+ GM_getValue('countGray') + " " + lang.type_found + ")<br/><b>" + lang.ov_amountarchive
					+ "</b> " + GM_getValue('countArchive');
			stats = stats + "<br/><b>" + lang.ov_lastim + ": </b>";
			var lastim = GM_getValue(LAST_IMPORT);
			if (lastim)
				stats = stats + createTimeString(lastim);
			else
				stats = stats + " " + lang.never;
			stats = stats + "<br/><b>" + lang.ov_lastex + ": </b>";
			var lastex = GM_getValue(LAST_EXPORT);
			if (lastex)
				stats = stats + createTimeString(lastex);
			else
				stats = stats + " " + lang.never;

			stats = stats + "<br/><b>" + lang.ov_lastup + ": </b>";
			stats = stats + createTimeString(new Date(Date.parse(GM_getValue('updateDate'))));
			unsafeWindow.tooltip.show(stats, 500);
		}, false);
		gcclink.addEventListener('mouseup', function(evt) {
			toggleTabOnProfile('configDiv');
		}, false);
		gcclink.setAttribute('onmouseout', 'tooltip.hide();');

		gccRoot.appendChild(document.createTextNode(' | '));

		var showCommentsLink = document.createElement('a');
		showCommentsLink.setAttribute('id', 'gccommenttabledivButton');
		showCommentsLink.appendChild(document.createTextNode(lang.menu_showmycomments));
		showCommentsLink.addEventListener('mouseup', function() {
			toggleTabOnProfile('gccommenttablediv');
		}, false);
		showCommentsLink.setAttribute('style',
				'cursor:pointer;text-decoration:none;padding-left:5px;padding-right:5px');
		gccRoot.appendChild(showCommentsLink);

		// -----
		displayFilters = document.createElement("div");
		displayFilters.style.display = "none";
		displayFilters.setAttribute('id', 'displayFilters');

		var filterclear = document.createElement('img');
		filterclear.setAttribute('src', state_clear);
		filterclear.setAttribute('style', 'cursor:pointer;vertical-align:bottom');
		filterclear.setAttribute('title', lang.table_filter_all);
		filterclear.addEventListener('mouseup', function() {
			filter = null;
			refreshTable(true);
		}, false);
		displayFilters.appendChild(document.createTextNode(' '));
		displayFilters.appendChild(filterclear);

		var filterall = document.createElement('img');
		filterall.setAttribute('src', state_default);
		filterall.setAttribute('style', 'cursor:pointer;vertical-align:bottom');
		filterall.setAttribute('title', lang.table_filter_untyped);
		filterall.addEventListener('mouseup', function() {
			filter = stateOptions[0];
			refreshTable(true);
		}, false);
		displayFilters.appendChild(document.createTextNode(' '));
		displayFilters.appendChild(filterall);

		var filterunsolved = document.createElement('img');
		filterunsolved.setAttribute('src', state_unsolved);
		filterunsolved.setAttribute('style', 'cursor:pointer;vertical-align:bottom');
		filterunsolved.setAttribute('title', lang.table_filter_unsolved);
		filterunsolved.addEventListener('mouseup', function() {
			filter = stateOptions[1];
			refreshTable(true);
		}, false);
		displayFilters.appendChild(document.createTextNode(' '));
		displayFilters.appendChild(filterunsolved);

		var filtersolved = document.createElement('img');
		filtersolved.setAttribute('src', state_solved);
		filtersolved.setAttribute('style', 'cursor:pointer;vertical-align:bottom');
		filtersolved.setAttribute('title', lang.table_filter_solved);
		filtersolved.addEventListener('mouseup', function() {
			filter = stateOptions[2];
			refreshTable(true);
		}, false);
		displayFilters.appendChild(document.createTextNode(' '));
		displayFilters.appendChild(filtersolved);

		var filterFound = document.createElement('img');
		filterFound.setAttribute('src', state_found);
		filterFound.setAttribute('style', 'cursor:pointer;vertical-align:bottom');
		filterFound.setAttribute('title', lang.table_filter_found);
		filterFound.addEventListener('mouseup', function() {
			filter = stateOptions[3];
			refreshTable(true);
		}, false);
		displayFilters.appendChild(document.createTextNode(' '));
		displayFilters.appendChild(filterFound);

		var filterArchive = document.createElement('img');
		filterArchive.setAttribute('src', archive);
		filterArchive.setAttribute('style', 'cursor:pointer;vertical-align:bottom');
		filterArchive.setAttribute('title', lang.table_filter_archived);
		filterArchive.addEventListener('mouseup', function() {
			filter = ARCHIVED;
			refreshTable(true);
		}, false);
		displayFilters.appendChild(document.createTextNode(' '));
		displayFilters.appendChild(filterArchive);
		gccRoot.appendChild(displayFilters);
		// ------

		gccRoot.appendChild(document.createTextNode(' | '));

		var exportToggleButton = document.createElement('a');
		exportToggleButton.setAttribute('id', 'exportDivButton');
		exportToggleButton.appendChild(document.createTextNode(lang.menu_export));
		exportToggleButton.setAttribute('style',
				'cursor:pointer;text-decoration:none;padding-left:5px;padding-right:5px');
		exportToggleButton.addEventListener('mouseup', function() {
			toggleTabOnProfile('exportDiv');
		}, false);

		gccRoot.appendChild(exportToggleButton);
		gccRoot.appendChild(document.createTextNode(' '));

		gccRoot.appendChild(document.createTextNode(' | '));

		var importLink = document.createElement('a');
		importLink.setAttribute('id', 'importDivButton');
		importLink.appendChild(document.createTextNode(lang.menu_import));
		importLink.addEventListener('mouseup', function() {
			toggleTabOnProfile('importDiv');
		}, false);
		importLink.setAttribute('style',
				'cursor:pointer;text-decoration:none;padding-left:5px;padding-right:5px');
		gccRoot.appendChild(importLink);

		gccRoot.appendChild(document.createTextNode(' | '));

		var deleteAllLink = document.createElement('a');
		deleteAllLink.setAttribute('id', 'deleteAllDivButton');
		deleteAllLink.appendChild(document.createTextNode(lang.menu_delete));
		deleteAllLink.addEventListener('mouseup', function() {
			toggleTabOnProfile('deleteAllDiv');
		}, false);
		deleteAllLink.setAttribute('style',
				'cursor:pointer;text-decoration:none;padding-left:5px;padding-right:5px');
		gccRoot.appendChild(deleteAllLink);

		//
		// PATCH DIV
		//
		if (unsafeWindow.File && unsafeWindow.FileReader && unsafeWindow.FileList && unsafeWindow.Blob) {
			gccRoot.appendChild(document.createTextNode(' | '));
			var patchGPXLink = document.createElement('a');
			patchGPXLink.setAttribute('id', 'patchDivButton');
			patchGPXLink.appendChild(document.createTextNode(lang.menu_patchgpx));
			patchGPXLink.addEventListener('mouseup', function() {
				toggleTabOnProfile('patchDiv');
			}, false);
			patchGPXLink.setAttribute('style',
					'cursor:pointer;text-decoration:none;padding-left:5px;padding-right:5px');
			gccRoot.appendChild(patchGPXLink);

			patchDiv = document.createElement('div');
			patchDiv.setAttribute('id', 'patchDiv');
			patchDiv
					.setAttribute('style',
							'margin:5px;padding:10px;outline:1px solid #D7D7D7;position:relative;background-color:#EBECED');
			patchDiv.style.display = 'none';
			gccRoot.appendChild(patchDiv);

			var patchDivExplanation = document.createElement('p');
			patchDivExplanation.appendChild(document.createTextNode(lang.patchgpx_explain));
			patchDiv.appendChild(patchDivExplanation);

			var removeUnusedDiv = document.createElement('div');
			removeUnusedDiv.setAttribute('id', 'removeUnusedDiv');
			removeUnusedDiv.setAttribute('style', 'margin-left:20px');
			appendCheckBox(removeUnusedDiv, PATCHGPX_REMOVE_OTHERS, lang.patchgpx_filter_nogcc);
			appendCheckBox(removeUnusedDiv, PATCHGPX_REMOVE_UNSOLVED,
					lang.patchgpx_filter_markednotsolved);
			appendCheckBox(removeUnusedDiv, PATCHGPX_REMOVE_SOLVED, lang.patchgpx_filter_markedsolved);
			appendCheckBox(removeUnusedDiv, PATCHGPX_REMOVE_FOUND, lang.patchgpx_filter_markfound);

			var removeUnused = document.createElement('p');
			removeUnused.appendChild(document.createTextNode(lang.patchgpx_remove));
			removeUnused.appendChild(removeUnusedDiv);
			patchDiv.appendChild(removeUnused);

			appendCheckBox(removeUnused, PATCHGPX_CHANGEORIGINAL, lang.patchgpx_changeorig);

			appendCheckBox(removeUnused, PATCHGPX_ADDFINALWPT, lang.patchgpx_addwptforfinal);

			var input = document.createElement('input');
			input.setAttribute('id', 'patchgpxinput');
			input.setAttribute('name', 'files[]');
			input.setAttribute('type', 'file');
			input.setAttribute('style', 'margin:3px');
			input.addEventListener('change', function(evt) {
				var files = evt.target.files;
				var file = files[0];
				var reader = new FileReader();
				reader.onload = (function(theFile) {
					return function(e) {
						handleGPXFileSelected(file.name, e.target.result);
					};
				})(file);
				if (file.name.indexOf('.gpx') > 0) {
					reader.readAsText(file);
				}
			}, false);
			patchDiv.appendChild(input);
			download = document.createElement('input');
			download.setAttribute('type', 'button');
			download.setAttribute('id', 'patchndownload');
			download.setAttribute('style', 'margin:3px');
			download.setAttribute('value', lang.patchgpx_perform);
			download.setAttribute('disabled', '');
			patchDiv.appendChild(download);
			var patchResultDiv = document.createElement('div');
			patchResultDiv.setAttribute('id', 'patchResultDiv');
			patchDiv.appendChild(patchResultDiv);
		}

		//
		// CONFIG DIV
		//
		configDiv = document.createElement('div');
		configDiv.setAttribute('id', 'configDiv');
		configDiv
				.setAttribute('style',
						'margin:5px;padding:10px;outline:1px solid #D7D7D7;position:relative;background-color:#EBECED');
		configDiv.style.display = 'none';

		var gccintro = document.createElement('p');
		gccintro.setAttribute('style', 'width:600px');
		gccintro.innerHTML = lang.settings_intro;
		configDiv.appendChild(gccintro);

		var paypallink = document.createElement('a');
		paypallink.setAttribute('style',
				'position:absolute;left:650px;top:10px;text-align:center;text-decoration:none;');
		paypallink.setAttribute('href',
				'https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=3RG7N2ELTYRX4');
		paypallink.setAttribute('target', 'blank');
		paypallink.appendChild(document.createTextNode(lang.settings_feelfree));
		paypallink.appendChild(document.createElement('br'));
		var paypalImg = document.createElement('img');
		paypalImg.setAttribute('src', 'https://www.paypal.com/en_US/i/btn/btn_donate_SM.gif');
		paypallink.appendChild(paypalImg);
		paypallink.appendChild(document.createElement('br'));
		paypallink.appendChild(document.createTextNode(lang.thank_you));
		configDiv.appendChild(paypallink);

		var configTable = document.createElement('table');
		var tr = document.createElement('tr');
		var td = document.createElement('td');

		var uuidText = document.createElement('input');
		uuidText.setAttribute('id', 'uuidText');
		uuidText.value = GM_getValue("gccUUID");
		uuidText.size = '40';
		var uuidLabel = document.createElement('label');
		uuidLabel.setAttribute('for', 'uuidText');
		uuidLabel.appendChild(document.createTextNode(lang.settings_enterUUID));
		td.appendChild(uuidLabel);
		tr.appendChild(td);
		td = document.createElement('td');
		td.appendChild(uuidText);
		tr.appendChild(td);
		configTable.appendChild(tr);

		var serverText = document.createElement('input');
		serverText.setAttribute('id', 'serverText');
		serverText.value = GM_getValue("gccServer");
		serverText.size = '40';
		var serverLabel = document.createElement('label');
		serverLabel.setAttribute('for', 'serverText');
		serverLabel.appendChild(document.createTextNode(lang.settings_enterServer));
		tr = document.createElement('tr');
		td = document.createElement('td');
		td.appendChild(serverLabel);
		tr.appendChild(td);
		td = document.createElement('td');
		td.appendChild(serverText);
		tr.appendChild(td);
		configTable.appendChild(tr);

		var label = document.createElement('label');
		label.appendChild(document.createTextNode(lang.settings_allowExport));
		tr = document.createElement('tr');
		td = document.createElement('td');
		td.appendChild(label);
		tr.appendChild(td);
		td = document.createElement('td');
		appendCheckBox(td, ENABLE_EXPORT, null);
		tr.appendChild(td);
		configTable.appendChild(tr);

		label = document.createElement('label');
		label.appendChild(document.createTextNode(lang.settings_lazyTable));
		tr = document.createElement('tr');
		td = document.createElement('td');
		td.appendChild(label);
		tr.appendChild(td);
		td = document.createElement('td');
		appendCheckBox(td, LAZY_TABLE_REFRESH, null);
		tr.appendChild(td);
		configTable.appendChild(tr);

		label = document.createElement('label');
		label.appendChild(document.createTextNode(lang.settings_syncWithGS));
		tr = document.createElement('tr');
		td = document.createElement('td');
		td.appendChild(label);
		tr.appendChild(td);
		td = document.createElement('td');
		appendCheckBox(td, AUTO_UPDATE_GS_FINAL, null);
		tr.appendChild(td);
		configTable.appendChild(tr);

		label = document.createElement('label');
		label.appendChild(document.createTextNode(lang.settings_language));
		tr = document.createElement('tr');
		td = document.createElement('td');
		td.appendChild(label);
		tr.appendChild(td);
		td = document.createElement('td');
		var languageSelector = document.createElement('select');
		languageSelector.setAttribute("name", "languageSelector");
		languageSelector.setAttribute("id", "languageSelector");
		languageSelector.setAttribute('size', 1);
		languageSelector.addEventListener('change', function() {
			var language = $('#languageSelector option:selected').text();
			GM_setValue(SETTINGS_LANGUAGE, language);
		});
		var option0 = document.createElement('option');
		option0.appendChild(document.createTextNode(SETTINGS_LANGUAGE_AUTO));
		var option1 = document.createElement('option');
		option1.appendChild(document.createTextNode(SETTINGS_LANGUAGE_EN));
		var option2 = document.createElement('option');
		option2.appendChild(document.createTextNode(SETTINGS_LANGUAGE_DE));
		languageSelector.appendChild(option0);
		languageSelector.appendChild(option1);
		languageSelector.appendChild(option2);
		var langsetting = GM_getValue(SETTINGS_LANGUAGE);
		if (langsetting === SETTINGS_LANGUAGE_EN)
			option1.setAttribute('selected', 'true');
		else if (langsetting === SETTINGS_LANGUAGE_DE)
			option2.setAttribute('selected', 'true');
		else
			option0.setAttribute('selected', 'true');
		td.appendChild(languageSelector);
		tr.appendChild(td);
		configTable.appendChild(tr);

		configDiv.appendChild(configTable);
		var saveButton = document.createElement('input');
		saveButton.setAttribute('type', 'button');
		saveButton.setAttribute('value', lang.settings_saveprefs);
		saveButton.addEventListener('mouseup', function() {
			GM_setValue('gccUUID', uuidText.value);
			GM_setValue('gccServer', serverText.value);
			saveButton.parentNode.appendChild(waitingTag);
			waitingTag.setAttribute('style', 'display:inline');
			waitingTag.setAttribute("src", successIcon);
			setTimeout(function() {
				unsafeWindow.$("#waiting").fadeOut('slow', function() {
				});
			}, 5000);

		}, false);
		configDiv.appendChild(saveButton);
		gccRoot.appendChild(configDiv);

		//
		// gccommenttablediv
		//
		var tableDiv = document.createElement('div');
		tableDiv.setAttribute('id', 'gccommenttablediv');
		tableDiv
				.setAttribute(
						'style',
						'margin: 5px; padding: 4px; outline: 1px solid rgb(215, 215, 215); position: relative; background-color: rgb(235, 236, 237);display:none');
		gccRoot.appendChild(tableDiv);

		//
		// EXPORT DIV
		//
		exportDiv = document.createElement('div');
		exportDiv.setAttribute('id', 'exportDiv');
		exportDiv
				.setAttribute('style',
						'margin:5px;padding:10px;outline:1px solid #D7D7D7;position:relative;background-color:#EBECED');
		exportDiv.style.display = 'none';

		exportDiv.appendChild(document.createTextNode(lang.export_step1));
		// single selection: gcc, gpx, csv, html, server
		// multi selection: all, untyped, unsolved, solved, found
		var exportFilterDiv = document.createElement('div');
		appendCheckBox(exportFilterDiv, EXPORT_FILTER_ALL, lang.all, toggleExportFilterOptions);
		appendCheckBox(exportFilterDiv, EXPORT_FILTER_UNTYPED, lang.type_untyped);
		appendCheckBox(exportFilterDiv, EXPORT_FILTER_UNSOLVED, lang.type_unsolved);
		appendCheckBox(exportFilterDiv, EXPORT_FILTER_SOLVED, lang.type_solved);
		appendCheckBox(exportFilterDiv, EXPORT_FILTER_FOUND, lang.type_found);
		appendCheckBox(exportFilterDiv, EXPORT_FILTER_ARCHIVE, lang.type_archived);
		exportDiv.appendChild(exportFilterDiv);

		var exportTypeDiv = document.createElement('div');
		exportTypeDiv.appendChild(document.createTextNode(lang.export_step2));
		var exportTypeSelector = document.createElement('select');
		exportTypeSelector.setAttribute("name", "exportTypeSelector");
		exportTypeSelector.setAttribute("id", "exportTypeSelector");
		exportTypeSelector.setAttribute('size', 1);
		var option0 = document.createElement('option');
		option0.appendChild(document.createTextNode("GCC"));
		var option1 = document.createElement('option');
		option1.appendChild(document.createTextNode("GPX"));
		var option2 = document.createElement('option');
		option2.appendChild(document.createTextNode("CSV"));
		var option3 = document.createElement('option');
		option3.appendChild(document.createTextNode("HTML"));
		exportTypeSelector.appendChild(option0);
		exportTypeSelector.appendChild(option1);
		exportTypeSelector.appendChild(option2);
		exportTypeSelector.appendChild(option3);
		exportTypeDiv.appendChild(exportTypeSelector);
		exportDiv.appendChild(exportTypeDiv);

		var explainP = document.createElement('p');
		explainP.setAttribute('style', 'margin-top:1.5em');
		explainP.appendChild(document.createTextNode(lang.export_explain));
		exportDiv.appendChild(explainP);

		var exportButton = document.createElement('input');
		exportButton.setAttribute('type', 'button');
		exportButton.setAttribute('value', lang.export_perform);
		exportButton.addEventListener('click', performFilteredExport, false);
		exportButton.setAttribute('style', 'margin:5px');
		exportDiv.appendChild(exportButton);

		exportDropboxButton = document.createElement('input');
		exportDropboxButton.setAttribute('type', 'button');
		exportDropboxButton.setAttribute('value', lang.export_toDropboxPerformFilteredExport);
		exportDropboxButton.addEventListener('click', performFilteredDropboxExport, false);
		exportDropboxButton.setAttribute('style', 'margin:5px');
		exportDiv.appendChild(exportDropboxButton);

		exportDiv.appendChild(document.createElement('hr'));

		if ((GM_getValue("gccServer") != undefined) && (GM_getValue("gccServer") != "")) {
			serverExportLink = document.createElement('input');
			serverExportLink.setAttribute('style', 'margin:5px');
			serverExportLink.setAttribute('type', 'button');
			serverExportLink.setAttribute('value', lang.export_toServer);
			serverExportLink.addEventListener('mouseup', storeToServer, false);
			exportDiv.appendChild(serverExportLink);
		}

		dropboxExportLink = document.createElement('input');
		dropboxExportLink.setAttribute('type', 'button');
		dropboxExportLink.setAttribute('style', 'margin:5px');
		dropboxExportLink.setAttribute('value', lang.export_toDropbox);
		dropboxExportLink.addEventListener('mouseup', storeToDropbox, false);
		exportDiv.appendChild(dropboxExportLink);

		gccRoot.appendChild(exportDiv);

		//
		// IMPORT DIV
		//
		importDiv = document.createElement('div');
		importDiv.setAttribute('id', 'importDiv');
		importDiv
				.setAttribute('style',
						'margin:5px;padding:10px;outline:1px solid #D7D7D7;position:relative;background-color:#EBECED');
		importDiv.style.display = 'none';
		gccRoot.appendChild(importDiv);
		var importDivExplanation = document.createElement('p');
		importDivExplanation.appendChild(document.createTextNode(lang.import_explain));
		importDiv.appendChild(importDivExplanation);

		if (unsafeWindow.File && unsafeWindow.FileReader && unsafeWindow.FileList && unsafeWindow.Blob) {
			var input = document.createElement('input');
			input.setAttribute('id', 'fileinput');
			input.setAttribute('name', 'files[]');
			input.setAttribute('type', 'file');
			importDiv.appendChild(document.createTextNode(lang.import_choose));
			importDiv.appendChild(input);
			document.getElementById('fileinput').addEventListener('change', function(evt) {
				var files = evt.target.files;
				var file = files[0];
				var reader = new FileReader();
				reader.onload = (function(theFile) {
					return function(e) {
						importText.value = e.target.result;
					};
				})(file);
				if (file.name.indexOf('.gcc') > 0)
					reader.readAsText(file);
			}, false);
		}
		if ((GM_getValue("gccServer") != undefined) && (GM_getValue("gccServer") != "")) {
			serverImportLink = document.createElement('input');
			serverImportLink.setAttribute('style', 'margin:5px');
			serverImportLink.setAttribute('type', 'button');
			serverImportLink.setAttribute('value', lang.import_fromServer);
			serverImportLink.addEventListener('mouseup', loadFromServer, false);
			importDiv.appendChild(serverImportLink);
		}
		importDiv.appendChild(document.createElement('br'));

		dropboxCheck = document.createElement('input');
		dropboxCheck.setAttribute('type', 'button');
		dropboxCheck.setAttribute('value', lang.import_fromDropboxCheckForFiles);
		dropboxCheck.addEventListener('mouseup', checkDropbox, false);
		importDiv.appendChild(dropboxCheck);

		dropboxSelect = document.createElement('select');
		dropboxSelect.setAttribute('id', 'dropboxSelect');
		importDiv.appendChild(dropboxSelect);

		dropboxImportLink = document.createElement('input');
		dropboxImportLink.setAttribute('id', 'dropboxImportLink');
		dropboxImportLink.setAttribute('disabled', 'disabled');
		dropboxImportLink.setAttribute('type', 'button');
		dropboxImportLink.setAttribute('value', lang.import_fromDropbox);
		dropboxImportLink.addEventListener('mouseup', loadFromDropbox, false);
		importDiv.appendChild(dropboxImportLink);

		importText = document.createElement('textarea');
		importText.setAttribute('id', 'gccommentimporttextarea');
		importText.cols = 100;
		importText.rows = 10;
		importDiv.appendChild(importText);

		var submitImport = document.createElement('input');
		submitImport.setAttribute('type', 'button');
		submitImport.setAttribute('value', lang.import_perform);
		submitImport.setAttribute('style', 'margin:5px');
		submitImport.addEventListener('mouseup', parseXMLImport, false);
		importDiv.appendChild(document.createElement('br'));
		importDiv.appendChild(submitImport);

		var cancelImport = document.createElement('input');
		cancelImport.setAttribute('type', 'button');
		cancelImport.setAttribute('value', lang.import_close);
		cancelImport.addEventListener('mouseup', function() {
			importresult.innerHTML = "";
			toggleTabOnProfile('importDiv');
		}, false);
		cancelImport.setAttribute('style', 'margin:5px');
		importDiv.appendChild(document.createTextNode('\t'));
		importDiv.appendChild(cancelImport);

		importresult = document.createElement('p');
		submitImport.parentNode.appendChild(importresult);

		//
		// DELETE DIV
		//
		deleteAllDiv = document.createElement('div');
		deleteAllDiv.setAttribute('id', 'deleteAllDiv');
		deleteAllDiv
				.setAttribute('style',
						'margin:5px;padding:10px;outline:1px solid #D7D7D7;position:relative;background-color:#EBECED');
		deleteAllDiv.style.display = 'none';
		deleteAllDiv.appendChild(document.createTextNode(lang.delete_select));
		deleteAllDiv.appendChild(document.createElement('br'));

		appendCheckBox(deleteAllDiv, DELETEALL_FILTER_ALL, lang.all, toggleDeleteAllFilterOptions);
		appendCheckBox(deleteAllDiv, DELETEALL_FILTER_UNTYPED, lang.type_untyped);
		appendCheckBox(deleteAllDiv, DELETEALL_FILTER_UNSOLVED, lang.type_unsolved);
		appendCheckBox(deleteAllDiv, DELETEALL_FILTER_SOLVED, lang.type_solved);
		appendCheckBox(deleteAllDiv, DELETEALL_FILTER_FOUND, lang.type_found);
		appendCheckBox(deleteAllDiv, DELETEALL_FILTER_ARCHIVED, lang.type_archived);

		var deleteAllButton = document.createElement('input');
		deleteAllButton.setAttribute('type', 'button');
		deleteAllButton.setAttribute('value', lang.delete_perform);
		deleteAllButton.addEventListener('click', performFilteredDeleteAll, false);
		deleteAllDiv.appendChild(deleteAllButton);

		deleteAllResult = document.createElement('div');
		deleteAllDiv.appendChild(deleteAllResult);

		gccRoot.appendChild(deleteAllDiv);

		waitingTag = document.createElement('img');
		waitingTag.setAttribute('src', waitingGif);
		waitingTag.setAttribute('id', 'waiting');
		waitingTag.setAttribute('style', 'padding-right:5px');

		if (GM_getValue(EXPORT_FILTER_ALL))
			toggleExportFilterOptions();
		if (GM_getValue(DELETEALL_FILTER_ALL))
			toggleDeleteAllFilterOptions();
	}
}

function checkDropbox() {
	var client = new Dropbox.Client( {
		key : dpkey,
		sandbox : true
	});

	client.authDriver(new Dropbox.Drivers.Redirect( {
		useQuery : true,
		rememberUser : true
	}));

	client.authenticate(function(error, client) {
		if (error) {
			log("debug", 'There was an error during authentication: ' + error.status);
		}
	});

	dropboxExportLink.parentNode.insertBefore(waitingTag, dropboxExportLink);
	waitingTag.setAttribute('style', 'display:inline');
	waitingTag.setAttribute('src', waitingGif);

	client.readdir("/", function(error, entries) {
		if (error) {
			waitingTag.setAttribute("src", errorIcon);
			return log("debug", error); // Something went wrong.
		}
		waitingTag.setAttribute("src", successIcon);
		setTimeout(function() {
			$("#waiting").fadeOut('slow', function() {
			});
		}, 5000);
		$('#dropboxSelect').empty();
		if (entries.length > 0)
			$('#dropboxImportLink').removeAttr('disabled');

		for ( var count = 0; count < entries.length; count++) {
			$('#dropboxSelect').append('<option>' + entries[count] + '</option>');
		}

		log("debug", "reading dir entries on dropbox successful");
	});
}

function storeToDropbox() {
	var client = new Dropbox.Client( {
		key : dpkey,
		sandbox : true
	});

	client.authDriver(new Dropbox.Drivers.Redirect( {
		useQuery : true,
		rememberUser : true
	}));

	client.authenticate(function(error, client) {
		if (error) {
			log("debug", 'There was an error during authentication: ' + error.status);
		}
	});

	dropboxExportLink.parentNode.insertBefore(waitingTag, dropboxExportLink);
	waitingTag.setAttribute('style', 'display:inline');
	waitingTag.setAttribute('src', waitingGif);

	client.writeFile("" + createTimeString(new Date(), true) + "_backup-all.gcc",
			buildGCCExportString(false), function(error, stat) {
				if (error) {
					waitingTag.setAttribute("src", errorIcon);
					return log("debug", error); // Something went wrong.
		}
		waitingTag.setAttribute("src", successIcon);
		setTimeout(function() {
			unsafeWindow.$("#waiting").fadeOut('slow', function() {
			});
		}, 5000);

		log("debug", "Export to dropbox successful");
	});
}

function loadFromDropbox() {
	var client = new Dropbox.Client( {
		key : dpkey,
		sandbox : true
	});

	client.authDriver(new Dropbox.Drivers.Redirect( {
		useQuery : true,
		rememberUser : true
	}));

	client.authenticate(function(error, client) {
		if (error) {
			log("debug", 'There was an error during authentication: ' + error.status);
		}
	});

	dropboxImportLink.parentNode.insertBefore(waitingTag, dropboxImportLink);
	waitingTag.setAttribute('style', 'display:inline');
	waitingTag.setAttribute('src', waitingGif);

	var select = document.getElementById('dropboxSelect');
	var fileName = select.options[select.selectedIndex].text;

	client.readFile(fileName, function(error, data) {
		if (error) {
			waitingTag.setAttribute("src", errorIcon);
			return log("debug", error); // Something went wrong.
		}
		waitingTag.setAttribute("src", successIcon);
		setTimeout(function() {
			$("#waiting").fadeOut('slow', function() {
			});
		}, 5000);

		importText.value = data;
	});
}

function toggleExportFilterOptions() {
	if (GM_getValue(EXPORT_FILTER_ALL)) {
		$('#EXPORT_FILTER_UNTYPED').attr('disabled', 'disabled');
		$('#EXPORT_FILTER_UNSOLVED').attr('disabled', 'disabled');
		$('#EXPORT_FILTER_SOLVED').attr('disabled', 'disabled');
		$('#EXPORT_FILTER_FOUND').attr('disabled', 'disabled');
		$('#EXPORT_FILTER_ARCHIVED').attr('disabled', 'disabled');
	} else {
		$('#EXPORT_FILTER_UNTYPED').removeAttr('disabled');
		$('#EXPORT_FILTER_UNSOLVED').removeAttr('disabled');
		$('#EXPORT_FILTER_SOLVED').removeAttr('disabled');
		$('#EXPORT_FILTER_FOUND').removeAttr('disabled');
		$('#EXPORT_FILTER_ARCHIVED').removeAttr('disabled');
	}
}

function toggleDeleteAllFilterOptions() {
	if (GM_getValue(DELETEALL_FILTER_ALL)) {
		$('#DELETEALL_FILTER_UNTYPED').attr('disabled', 'disabled');
		$('#DELETEALL_FILTER_UNSOLVED').attr('disabled', 'disabled');
		$('#DELETEALL_FILTER_SOLVED').attr('disabled', 'disabled');
		$('#DELETEALL_FILTER_FOUND').attr('disabled', 'disabled');
		$('#DELETEALL_FILTER_ARCHIVED').attr('disabled', 'disabled');
	} else {
		$('#DELETEALL_FILTER_UNTYPED').removeAttr('disabled');
		$('#DELETEALL_FILTER_UNSOLVED').removeAttr('disabled');
		$('#DELETEALL_FILTER_SOLVED').removeAttr('disabled');
		$('#DELETEALL_FILTER_FOUND').removeAttr('disabled');
		$('#DELETEALL_FILTER_ARCHIVED').removeAttr('disabled');
	}
}

function performFilteredDeleteAll() {
	var check = confirm(lang.delete_confirmation);
	if (check) {
		var keys = GM_listValues();
		// log("info", "all keys: " + keys);
		var resultRemoved = "<ul>";
		var removedCount = 0;
		for ( var i = 0; i < keys.length; i++) {
			var key = keys[i];
			if (key.indexOf(COMPREFIX) > -1) {
				var comment = doLoadCommentFromGUID(key.substr(COMPREFIX.length));
				var isArchived = (comment.archived === ARCHIVED);
				if (GM_getValue(DELETEALL_FILTER_ALL)
						|| (comment.state === stateOptions[0] && GM_getValue(DELETEALL_FILTER_UNTYPED) && !isArchived)
						|| (comment.state === stateOptions[1] && GM_getValue(DELETEALL_FILTER_UNSOLVED) && !isArchived)
						|| (comment.state === stateOptions[2] && GM_getValue(DELETEALL_FILTER_SOLVED) && !isArchived)
						|| (comment.state === stateOptions[3] && GM_getValue(DELETEALL_FILTER_FOUND) && !isArchived)
						|| (isArchived && GM_getValue(DELETEALL_FILTER_ARCHIVED))) {

					var removeTooltip = createImportComment(comment.commentValue, comment.lat, comment.lng,
							comment.state, comment.archived);
					resultRemoved = resultRemoved
							+ "<li><a target='blank' href='http://www.geocaching.com/seek/cache_details.aspx?guid="
							+ comment.guid
							+ "'>"
							+ comment.name
							+ " ("
							+ comment.gccode
							+ ")</a>. "
							+ lang.tmpl_commentremoved.replace("{{1}}", Base64.encode(removeTooltip)).replace(
									"{{2}}", encodeURIComponent(removeTooltip)) + "</li>";
					removedCount++;

					log("info", "deleted: " + key + "(" + GM_getValue(key) + ")");
					GM_deleteValue(key);
				}
			}
		}
		deleteAllResult.innerHTML = "<h4>" + lang.delete_result + ": " + removedCount + "</h4>"
				+ resultRemoved;
	}
}

function patchNDownloadGPX(gccString) {
	unsafeWindow.$('#patchResultDiv').empty();
	var parser = new DOMParser();
	var xmlDoc = parser.parseFromString(gccString, "text/xml");
	var urls = xmlDoc.getElementsByTagName('url');
	var toRemove = new Array();
	var toAdd = new Array();
	var countCoordChanged = 0;
	var countWPTAdded = 0;
	var countWPTRemoved = 0;

	for ( var i = 0; i < urls.length; i++) {
		var url = urls[i];
		var guid = url.childNodes[0].nodeValue.split('guid=')[1];
		var comment = doLoadCommentFromGUID(guid);

		var wpt = url.parentNode;
		if (comment) {
			if ((comment.state == stateOptions[1]) && GM_getValue(PATCHGPX_REMOVE_UNSOLVED)) {
				countWPTRemoved++;
				toRemove.push(wpt);
				continue;
			} else if ((comment.state == stateOptions[2]) && GM_getValue(PATCHGPX_REMOVE_SOLVED)) {
				toRemove.push(wpt);
				countWPTRemoved++;
				continue;
			} else if ((comment.state == stateOptions[3]) && GM_getValue(PATCHGPX_REMOVE_FOUND)) {
				toRemove.push(wpt);
				countWPTRemoved++;
				continue;
			}
			// weave comment into existing WPT
			// br - br - gccomment - br content
			var long = wpt.getElementsByTagName('groundspeak:long_description')[0];
			if (long)
				long.appendChild(xmlDoc
						.createTextNode("\n&lt;br /&gt;\n&lt;br /&gt;\nGCComment:\n&lt;br /&gt;\n"
								+ comment.commentValue + "&lt;br /&gt;\n"));
			// create new WPT
			if (comment.lat && comment.lng) {
				if (GM_getValue(PATCHGPX_ADDFINALWPT)) {
					var newWpt = xmlDoc.createElement('wpt');
					newWpt.setAttribute('lat', comment.lat);
					newWpt.setAttribute('lon', comment.lng);

					var newTime = xmlDoc.createElement('time');
					newTime.appendChild(xmlDoc.createTextNode(isoTime(comment.saveTime)));
					newWpt.appendChild(newTime);

					var newName = xmlDoc.createElement('name');
					newName.appendChild(xmlDoc.createTextNode(comment.gccode + " - GCC " + comment.state));
					newWpt.appendChild(newName);

					var newDesc = xmlDoc.createElement('desc');
					newDesc.appendChild(xmlDoc.createTextNode(comment.name + " - GCC " + comment.state));
					newWpt.appendChild(newDesc);

					var newCmt = xmlDoc.createElement('cmt');
					newCmt.appendChild(xmlDoc.createTextNode(comment.commentValue));
					newWpt.appendChild(newCmt);

					// var newSym = xmlDoc.createElement('sym');
					// newSym.appendChild(xmlDoc.createTextNode(''));
					// newWpt.appendChild(newSym);

					// alternativ gr�ne fahne
					// <sym>Flag, Green</sym>

					// oder goldene fahne mit stern
					// <sym>Civil</sym>
					var newType = xmlDoc.createElement('type');
					newType.appendChild(xmlDoc.createTextNode('Waypoint|Final Location'));
					newWpt.appendChild(newType);

					var gc = xmlDoc.createElement('groundspeak:cache');
					gc.setAttribute('xmlns:groundspeak', 'http://www.groundspeak.com/cache/1/0');
					gc.setAttribute('archived', 'false');
					gc.setAttribute('available', 'true');
					var gcname = xmlDoc.createElement('groundspeak:name');
					gcname.appendChild(document.createTextNode(comment.name + " - GCC " + comment.state));
					gc.appendChild(gcname);
					var gclongdesc = document.createElement('groundspeak:long_description');
					gclongdesc.appendChild(document.createTextNode(comment.commentValue));
					gc.appendChild(gclongdesc);
					newWpt.appendChild(gc);

					toAdd.push(newWpt);
					countWPTAdded++;
				}
				if (GM_getValue(PATCHGPX_CHANGEORIGINAL)) {
					wpt.setAttribute('lat', comment.lat);
					wpt.setAttribute('lon', comment.lng);
					countCoordChanged++;
				}
			}
		} else {
			if (GM_getValue(PATCHGPX_REMOVE_OTHERS)) {
				toRemove.push(wpt);
				countWPTRemoved++;
			}
		}
	}

	while (toRemove.length > 0) {
		var removeWpt = toRemove.pop();
		removeWpt.parentNode.removeChild(removeWpt);
	}
	var gpx = xmlDoc.getElementsByTagName('gpx')[0];
	while (toAdd.length > 0) {
		var addWpt = toAdd.pop();
		gpx.appendChild(addWpt);
	}
	var serializer = new XMLSerializer();
	var result = serializer.serializeToString(xmlDoc);
	var patchResult = document.createElement('p');
	patchResult.innerHTML = lang.tmpl_patchresult.replace("countWPTRemoved", countWPTRemoved)
			.replace("countWPTAdded", countWPTAdded).replace("countCoordChanged", countCoordChanged)
			.replace("total", xmlDoc.getElementsByTagName('wpt').length);
	// +
	// "Patching removed " + countWPTRemoved + " waypoints.<br/>Patching added "
	// + countWPTAdded + " waypoints.<br/>Patching changed Coords of " +
	// countCoordChanged
	// + " waypoints.<br/>The GPX now contains " +
	// xmlDoc.getElementsByTagName('wpt').length
	// + " waypoints.";
	unsafeWindow.$('#patchResultDiv').append(patchResult);

	openDownloadWindow(result, "PatchGPX", "application/gccomment");
}

var download;
var oldhandler;

function handleGPXFileSelected(filename, gccString) {
	unsafeWindow.$('#patchResultDiv').empty();

	var parser = new DOMParser();
	var xmlDoc = parser.parseFromString(gccString, "text/xml");

	var parseStatus = document.createElement('p');
	parseStatus.innerHTML = 'The file ' + filename + " contains "
			+ xmlDoc.getElementsByTagName('wpt').length + " waypoints.";
	unsafeWindow.$('#patchResultDiv').append(parseStatus);
	download.removeAttribute('disabled');
	if (oldhandler)
		download.removeEventListener('mouseup', oldhandler);
	oldhandler = function() {
		patchNDownloadGPX(gccString);
	};
	download.addEventListener('mouseup', oldhandler, false);
}

function gccommentOnLogPage() {
	var guid = document.getElementById('ctl00_ContentBody_LogBookPanel1_WaypointLink').getAttribute(
			'href').split("guid=")[1];
	if (guid) {
		var comment = doLoadCommentFromGUID(guid);
		if (comment) {
			var submitButton = $('#ctl00_ContentBody_LogBookPanel1_LogButton');
			submitButton.css('margin-top', '10px');

			var gccActionDiv = document.createElement('div');
			var markfound = appendCheckBox(gccActionDiv, AUTOMARKFOUND, lang.log_markfound);
			var markarchive = appendCheckBox(gccActionDiv, AUTOMARKARCHIVE, lang.log_movearchive);
			submitButton.before(gccActionDiv);
			var actionDiv = $(gccActionDiv);
			submitButton.appendTo(actionDiv);
			actionDiv.css('padding', '5px').css('border', 'solid 1px lightgray');
			// submitButton.attr('onclick', '');
			document.getElementById('ctl00_ContentBody_LogBookPanel1_LogButton').addEventListener(
					'mouseup', function(event) {
						// event.preventDefault();
					var input = document.getElementById('ctl00_ContentBody_LogBookPanel1_ddLogType');

					var c = doLoadCommentFromGUID(guid);
					var markFoundState = (input.value == 2) && GM_getValue(AUTOMARKFOUND) ? stateOptions[3]
							: c.state;
					var markArchiveState = GM_getValue(AUTOMARKARCHIVE) ? ARCHIVED : c.archived;

					doSaveCommentToGUID(guid, c.gccode, c.name, c.commentValue, markFoundState, c.lat, c.lng,
							c.origlat, c.origlng, markArchiveState);
				}, false);

			var input = document.getElementById('ctl00_ContentBody_LogBookPanel1_ddLogType');
			if (input.value == 2)
				markfound.style.display = 'inline';
			else
				markfound.style.display = 'none';

			input.addEventListener('change', function() {
				if (input.value == 2) {
					markfound.style.display = 'inline';
				} else
					markfound.style.display = 'none';
			}, false);
		}
	}
}

function toggleTabOnProfile(tabid) {
	log('debug', 'tabid ' + tabid);
	// do specials
	if ((tabid == 'gccommenttablediv')
			&& (!commentTable || ($('#gccommenttablediv').css('display') === 'none'))) {
		refreshTable(false);
		displayFilters.style.display = "inline";
	} else {
		displayFilters.style.display = "none";
	}

	// perfom actual toggle
	$('#' + tabid).slideToggle('slow');
	$('#' + tabid + 'Button').toggleClass('gccselect');

	// hide others
	if ((tabid != 'configDiv') && (configDiv.style.display != 'none')) {
		$('#configDiv').slideToggle('slow');
		$('#configDivButton').removeClass('gccselect');
	}
	if ((tabid != 'exportDiv') && (exportDiv.style.display != 'none')) {
		$('#exportDiv').slideToggle('slow');
		$('#exportDivButton').removeClass('gccselect');
	}
	if ((tabid != 'importDiv') && (importDiv.style.display != 'none')) {
		$('#importDiv').slideToggle('slow');
		$('#importDivButton').removeClass('gccselect');
	}
	if ((tabid != 'deleteAllDiv') && (deleteAllDiv.style.display != 'none')) {
		$('#deleteAllDiv').slideToggle('slow');
		$('#deleteAllDivButton').removeClass('gccselect');
	}
	if ((tabid != 'patchDiv') && (patchDiv.style.display != 'none')) {
		$('#patchDiv').slideToggle('slow');
		$('#patchDivButton').removeClass('gccselect');
	}
	if ((tabid != 'gccommenttablediv') && commentTable
			&& ($('#gccommenttablediv').css('display') != 'none')) {
		$('#gccommenttablediv').slideToggle('slow');
		$('#gccommenttabledivButton').removeClass('gccselect');
		displayFilters.style.display = "none";
	}
}

// wir sind auf der Detailbeschreibungsseite eines Caches
function gccommentOnDetailpage() {
	appendCSS('text', '#gccommenttextarea{font-family:monospace;font-size:medium}');
	var findtag = document.getElementById('ctl00_ContentBody_uxFindLinksHeader');
	if (findtag) {
		AddComment = document.createElement('a');
		var imgAdd = document.createElement('img');
		imgAdd.src = commentIconAdd;
		imgAdd.title = lang.detail_add;
		imgAdd.setAttribute('style', 'cursor:pointer');
		AddComment.appendChild(imgAdd);
		AddComment.addEventListener('mouseup', function() {
			AddComment.style.display = 'none';
			detailCommentCacheState.removeAttribute('disabled');
			SaveComment.style.display = 'inline';
			EditCancelComment.style.display = 'inline';
			detailCommentTextArea.style.display = 'inline';
			detailCommentInputLatLng.removeAttribute("disabled");
			setTimeout(function() {
				detailCommentTextArea.focus();
			}, 50);
		}, false);

		EditComment = document.createElement('a');
		var imgEdit = document.createElement('img');
		imgEdit.src = commentIconEdit;
		imgEdit.title = lang.detail_edit;
		imgEdit.setAttribute('style', 'cursor:pointer');
		EditComment.appendChild(imgEdit);
		EditComment.addEventListener('mouseup', editComment, false);

		EditCancelComment = document.createElement('a');
		var imgEditCancel = document.createElement('img');
		imgEditCancel.src = commentIconEditCancel;
		imgEditCancel.title = lang.detail_cancel;
		imgEditCancel.setAttribute('style', 'cursor:pointer');
		EditCancelComment.appendChild(imgEditCancel);
		EditCancelComment.addEventListener('mouseup', function() {
			detailCommentTextArea.style.display = 'none';
			detailCommentCacheState.setAttribute('disabled', '');
			SaveComment.style.display = 'none';
			detailCommentTextPane.style.display = 'inline';
			detailCommentInputLatLng.setAttribute("disabled", "");
			EditCancelComment.style.display = 'none';
			if (currentComment == null) {
				AddComment.style.display = 'inline';
				EditComment.style.display = 'none';
				detailCommentTextArea.value = "";
			} else {
				AddComment.style.display = 'none';
				EditComment.style.display = 'inline';
				DeleteComment.style.display = 'inline';
				detailCommentTextArea.value = currentComment.commentValue;
				if (currentComment.lat && currentComment.lng) {
					detailCommentInputLatLng.value = convertDec2DMS(currentComment.lat, currentComment.lng);
				} else
					detailCommentInputLatLng.value = DEFAULTCOORDS;
			}
		}, false);

		SaveComment = document.createElement("a");
		var imgSave = document.createElement('img');
		imgSave.src = commentIconSave;
		imgSave.title = lang.detail_save;
		imgSave.setAttribute('style', 'cursor:pointer');
		SaveComment.appendChild(imgSave);
		SaveComment.addEventListener('mouseup', saveComment, false);

		SaveFinalCoords = document.createElement("a");
		SaveFinalCoords.setAttribute('style', 'margin-left:3px;margin-right:3px');
		var imgSave = document.createElement('img');
		imgSave.src = commentIconSave;
		imgSave.title = lang.detail_finalsave;
		imgSave.setAttribute('style', 'cursor:pointer');
		SaveFinalCoords.appendChild(imgSave);
		SaveFinalCoords.addEventListener('mouseup', saveFinalCoords, false);

		DeleteFinalCoords = document.createElement("a");
		DeleteFinalCoords.setAttribute('style', 'margin-left:3px;margin-right:3px');
		var imgDelete = document.createElement('img');
		imgDelete.src = deleteMysteryIcon;
		imgDelete.title = lang.detail_finaldelete;
		imgDelete.setAttribute('style', 'cursor:pointer');
		DeleteFinalCoords.appendChild(imgDelete);
		DeleteFinalCoords.addEventListener('mouseup', function() {
			var check = confirm(lang.detail_finaldeleteconfirmation);
			if (check) {
				detailFinalInputLatLng.value = DEFAULTCOORDS;
				detailFinalInputLatLng.setAttribute('style', 'color:grey');

				saveFinalCoords();
				if (GM_getValue(AUTO_UPDATE_GS_FINAL) == 1) {
					$.pageMethod("ResetUserCoordinate", JSON.stringify( {
						dto : {
							ut : unsafeWindow.userToken
						}
					}), function(r) {
						var r = JSON.parse(r.d);
						if (r.status == "success") {
							window.location.reload();
						}
					});
				}
			}
		}, false);

		DeleteComment = document.createElement('a');
		var imgDelete = document.createElement('img');
		imgDelete.src = commentIconDelete;
		imgDelete.title = lang.detail_delete;
		imgDelete.setAttribute('style', 'cursor:pointer');
		DeleteComment.appendChild(imgDelete);
		DeleteComment
				.addEventListener(
						'mouseup',
						function() {
							var check = confirm(lang.detail_deleteconfirmation);
							if (check) {
								GM_deleteValue(COMPREFIX + currentCacheGUID);
								currentComment = null;
								detailCommentCacheState.setAttribute('disabled', '');
								detailFinalCacheState.options.selectedIndex = detailCommentCacheState.options.selectedIndex = 0;
								detailCommentTextArea.value = "";
								detailCommentTextPane.innerHTML = "";
								detailCommentTextArea.style.display = 'none';
								detailCommentTextPane.style.display = 'none';
								AddComment.style.display = 'inline';
								EditComment.style.display = 'none';
								SaveComment.style.display = 'none';
								DeleteComment.style.display = 'none';
								EditCancelComment.style.display = 'none';
								detailCommentInputLatLng.setAttribute('disabled', '');
								detailCommentInputLatLng.value = DEFAULTCOORDS;
								detailFinalInputLatLng.value = DEFAULTCOORDS;
								updateSaveTime(-1);
							}
						}, false);

		CopyComment = document.createElement('a');
		var imgCopy = document.createElement('img');
		imgCopy.src = commentIconCopy;
		imgCopy.title = 'Copy Comment from GC-Note';
		imgCopy.setAttribute('style', 'cursor:pointer');
		CopyComment.appendChild(imgCopy);
		CopyComment.addEventListener('mouseup', function() {
			var gcnote = document.getElementById('notestatic');
			var text = gcnote.innerHTML;
			text = text.replace(/<br>/g, "\n");
			if (text != null) {
				editComment();
				detailCommentTextArea.value = detailCommentTextArea.value + "\n\ncopy from GC-Note:\n"
						+ text;
			}
		}, false);

		var url = document.getElementById('ctl00_ContentBody_lnkPrintFriendly').getAttribute('href');
		var guidIndex = url.indexOf('guid=');
		var length = "3331cc55-49a2-4883-a5ad-06657e8c1aab".length;
		currentCacheGUID = url.substr(guidIndex + 5, length);
		currentCacheCode = trim(document
				.getElementById('ctl00_ContentBody_CoordInfoLinkControl1_uxCoordInfoCode').innerHTML);
		currentCacheName = unescapeXML(trim(document.getElementById('ctl00_ContentBody_CacheName').innerHTML));

		// laden des aktuellen comments
		currentComment = doLoadCommentFromGUID(currentCacheGUID);

		detailCommentDiv = document.createElement('div');
		detailCommentDiv.setAttribute('name', 'mycomments');
		var header = document.createElement('p');
		header.innerHTML = "<strong>" + lang.mycomments + "</strong>";
		detailCommentDiv.appendChild(header);
		detailCommentDiv.id = 'gccommentarea';

		var small = document.createElement('small');
		detailCommentLastSaveTime = document.createTextNode('');
		small.appendChild(detailCommentLastSaveTime);

		detailCommentCacheState = document.createElement('select');
		detailCommentCacheState.setAttribute("name", "detailCommentCacheState");
		detailCommentCacheState.setAttribute('size', 1);
		detailCommentCacheState.setAttribute('disabled', '');
		var option0 = document.createElement('option');
		option0.appendChild(document.createTextNode(stateOptions[0]));
		var option1 = document.createElement('option');
		option1.appendChild(document.createTextNode(stateOptions[1]));
		var option2 = document.createElement('option');
		option2.appendChild(document.createTextNode(stateOptions[2]));
		var option3 = document.createElement('option');
		option3.appendChild(document.createTextNode(stateOptions[3]));
		detailCommentCacheState.appendChild(option0);
		detailCommentCacheState.appendChild(option1);
		detailCommentCacheState.appendChild(option2);
		detailCommentCacheState.appendChild(option3);
		if (currentComment) {
			if (currentComment.state === stateOptions[0]) {
				option0.setAttribute('selected', 'true');
			} else if (currentComment.state === stateOptions[1]) {
				option1.setAttribute('selected', 'true');
			} else if (currentComment.state === stateOptions[2]) {
				option2.setAttribute('selected', 'true');
			} else if (currentComment.state === stateOptions[3]) {
				option3.setAttribute('selected', 'true');
			} else
				log('debug', 'Error, invalid state ' + currentComment.state);
		}

		header.appendChild(document.createTextNode('   '));
		header.appendChild(AddComment);
		header.appendChild(document.createTextNode('   '));
		header.appendChild(EditComment);
		header.appendChild(document.createTextNode('   '));
		header.appendChild(SaveComment);
		header.appendChild(document.createTextNode('   '));
		header.appendChild(EditCancelComment);
		header.appendChild(document.createTextNode('   '));
		header.appendChild(DeleteComment);
		var gcnote = document.getElementById('notestatic');
		if (gcnote != null) {
			header.appendChild(document.createTextNode('   '));
			header.appendChild(CopyComment);
		}
		header.appendChild(document.createTextNode('          '));
		header.appendChild(small);
		header.appendChild(document.createElement('br'));
		header.appendChild(document.createTextNode(lang.detail_thestate + ': '));
		header.appendChild(detailCommentCacheState);

		header.appendChild(document.createTextNode('  ' + lang.finale));
		detailCommentInputLatLng = document.createElement('input');
		detailCommentInputLatLng.setAttribute('style', 'margin-left:5px;margin-right:5px');
		detailCommentInputLatLng.setAttribute("disabled", "");
		detailCommentInputLatLng.setAttribute('size', '30');
		header.appendChild(detailCommentInputLatLng);

		if (currentComment && currentComment.lat && currentComment.lng) {
			detailCommentInputLatLng.value = convertDec2DMS(currentComment.lat, currentComment.lng);
		} else {
			detailCommentInputLatLng.value = DEFAULTCOORDS;
			detailCommentInputLatLng.setAttribute('style', 'color:grey');
		}

		detailCommentInputLatLng.addEventListener('click', function() {
			if (detailCommentInputLatLng.value == DEFAULTCOORDS) {
				detailCommentInputLatLng.value = "";
				detailCommentInputLatLng.setAttribute('style', 'color:black');
			}
		}, false);
		detailCommentInputLatLng.addEventListener('blur', function() {
			if (detailCommentInputLatLng.value == "") {
				detailCommentInputLatLng.value = DEFAULTCOORDS;
				detailCommentInputLatLng.setAttribute('style', 'color:grey');
			}
		}, false);

		detailCommentTextArea = document.createElement('textarea');
		detailCommentTextPane = document.createElement('p');
		detailCommentTextPane.setAttribute('style', 'font-family:monospace;font-size:medium');
		detailCommentTextArea.id = 'gccommenttextarea';
		detailCommentTextArea.cols = 60;
		detailCommentTextArea.rows = 10;
		if (currentComment) {
			detailCommentTextArea.value = currentComment.commentValue;
			detailCommentTextPane.innerHTML = prepareTextPane(currentComment.commentValue);

			AddComment.style.display = 'none';
			EditComment.style.display = "inline";
			EditCancelComment.style.display = "none";
			SaveComment.style.display = 'none';
			detailCommentTextArea.style.display = 'none';
			detailCommentTextPane.style.display = 'inline';
			DeleteComment.style.display = 'inline';

			if (currentComment.saveTime) {
				updateSaveTime(currentComment.saveTime);
			} else
				updateSaveTime(-1);
		} else {
			AddComment.style.display = 'inline';
			EditComment.style.display = "none";
			EditCancelComment.style.display = "none";
			SaveComment.style.display = 'none';
			DeleteComment.style.display = 'none';
			detailCommentTextArea.style.display = 'none';
		}
		detailCommentDiv.appendChild(detailCommentTextPane);
		detailCommentDiv.appendChild(detailCommentTextArea);

		detailCommentDiv.appendChild(document.createElement('br'));
		detailCommentDiv.appendChild(document.createElement('br'));
		findtag.parentNode.insertBefore(detailCommentDiv, findtag);

		// instant edit when opening the page
		var url = "" + window.location;
		if (url.indexOf('mycomments') > -1) {
			editComment();
		}
	}

	waitingTag = document.createElement('img');
	waitingTag.setAttribute('src', waitingGif);
	waitingTag.setAttribute('id', 'waiting');
	waitingTag.setAttribute('style', 'padding-right:5px');

	var hookTBody = document.getElementById('Print');
	if (hookTBody) {
		var mysteryRow = document.createElement('div');
		mysteryRow.setAttribute('class', 'LocationData');
		hookTBody.parentNode.insertBefore(mysteryRow, hookTBody);
		var mysteryData = document.createElement('td');
		mysteryRow.appendChild(mysteryData);

		detailFinalInputLatLng = document.createElement('input');
		detailFinalInputLatLng.setAttribute('style', 'margin-left:5px;margin-right:5px');
		detailFinalInputLatLng.setAttribute('size', '30');

		detailFinalCacheState = document.createElement('select');
		detailFinalCacheState.setAttribute("name", "detailFinalCacheState");
		detailFinalCacheState.setAttribute('size', 1);
		var option0 = document.createElement('option');
		option0.appendChild(document.createTextNode(stateOptions[0]));
		var option1 = document.createElement('option');
		option1.appendChild(document.createTextNode(stateOptions[1]));
		var option2 = document.createElement('option');
		option2.appendChild(document.createTextNode(stateOptions[2]));
		var option3 = document.createElement('option');
		option3.appendChild(document.createTextNode(stateOptions[3]));
		detailFinalCacheState.appendChild(option0);
		detailFinalCacheState.appendChild(option1);
		detailFinalCacheState.appendChild(option2);
		detailFinalCacheState.appendChild(option3);
		if (currentComment) {
			if (currentComment.state === stateOptions[0]) {
				option0.setAttribute('selected', 'true');
			} else if (currentComment.state === stateOptions[1]) {
				option1.setAttribute('selected', 'true');
			} else if (currentComment.state === stateOptions[2]) {
				option2.setAttribute('selected', 'true');
			} else if (currentComment.state === stateOptions[3]) {
				option3.setAttribute('selected', 'true');
			} else
				log('debug', 'Invalid state: ' + currentComment.state);
		}

		if (currentComment && currentComment.lat && currentComment.lng) {
			detailFinalInputLatLng.value = convertDec2DMS(currentComment.lat, currentComment.lng);
			unsafeWindow.L.OrigMap = unsafeWindow.L.Map;
			unsafeWindow.L.Map = function(id, params) {
				var result = new unsafeWindow.L.OrigMap(id, params);

				if (id === 'map_canvas' | id === 'map_preview_canvas')
					setTimeout(function() {
						var latlng = new unsafeWindow.L.LatLng(currentComment.lat, currentComment.lng);
						var pinIcon = unsafeWindow.L.Icon.extend( {
							iconSize : new unsafeWindow.L.Point(20, 23),
							iconAnchor : new unsafeWindow.L.Point(10, 23),
							shadowUrl : null
						});
						var marker = new unsafeWindow.L.Marker(latlng, {
							icon : new pinIcon( {
								iconUrl : finalIcon,
								iconAnchor : new unsafeWindow.L.Point(10, 23)
							}),
							title : lang.finale,
							clickable : false
						});
						result.addLayer(marker);

						var bounds = new unsafeWindow.L.LatLngBounds();
						bounds.extend(latlng);

						if (currentComment.origlat && currentComment.origlng) {
							var latlngHome = new unsafeWindow.L.LatLng(currentComment.origlat,
									currentComment.origlng);
							bounds.extend(latlngHome);
						}

						result.fitBounds(bounds);
					}, 1000);

				return result;
			};

		} else {
			detailFinalInputLatLng.value = DEFAULTCOORDS;
			detailFinalInputLatLng.setAttribute('style', 'color:grey');
		}
		detailFinalInputLatLng.addEventListener('click', function() {
			if (detailFinalInputLatLng.value == DEFAULTCOORDS) {
				detailFinalInputLatLng.value = "";
				detailFinalInputLatLng.setAttribute('style', 'color:black');
			}
		}, false);
		detailFinalInputLatLng.addEventListener('blur', function() {
			if (detailFinalInputLatLng.value == "") {
				detailFinalInputLatLng.value = DEFAULTCOORDS;
				detailFinalInputLatLng.setAttribute('style', 'color:grey');
			}
		}, false);

		mysteryData.appendChild(document.createTextNode(lang.final_coordinate));
		mysteryData.appendChild(detailFinalInputLatLng);
		mysteryData.appendChild(detailFinalCacheState);
		mysteryData.appendChild(SaveFinalCoords);
		mysteryData.appendChild(DeleteFinalCoords);
	}

	// check for waypoints table
	var wpttable = document.getElementById('ctl00_ContentBody_Waypoints');
	if (wpttable && currentComment && (currentComment.lat && currentComment.lng)) {
		var wpttr = document.createElement('tr');
		var wpttd = document.createElement('td');
		wpttd.setAttribute('class', 'AlignCenter');
		wpttd.setAttribute('isHidden', 'false');
		wpttr.appendChild(wpttd);

		wpttd = document.createElement('td');
		var wptViewable = document.createElement('img');
		wptViewable.setAttribute('width', '16');
		wptViewable.setAttribute('height', '16');
		wptViewable.setAttribute('alt', 'viewable');
		wptViewable.setAttribute('src', '/images/icons/icon_viewable.jpg');
		wpttd.appendChild(wptViewable);
		wpttr.appendChild(wpttd);

		wpttd = document.createElement('td');
		var wptIcon = document.createElement('img');
		wptIcon.setAttribute('width', '16');
		wptIcon.setAttribute('height', '16');
		wptIcon.setAttribute('alt', lang.final_location);
		wptIcon.setAttribute('src', finalIcon);
		wpttd.appendChild(wptIcon);
		wpttr.appendChild(wpttd);

		wpttd = document.createElement('td');
		var wptSpan = document.createElement('span');
		wptSpan.appendChild(document.createTextNode('FL'));
		wpttd.appendChild(wptSpan);
		wpttr.appendChild(wpttd);

		wpttd = document.createElement('td');
		wpttd.appendChild(document.createTextNode('FL'));
		wpttr.appendChild(wpttd);

		wpttd = document.createElement('td');
		wpttd.appendChild(document.createTextNode(lang.final_location_byGCC));
		wpttr.appendChild(wpttd);

		wpttd = document.createElement('td');
		wpttd.appendChild(document
				.createTextNode(convertDec2DMS(currentComment.lat, currentComment.lng)));
		wpttr.appendChild(wpttd);

		wpttd = document.createElement('td');
		wpttd.appendChild(document.createTextNode("  "));
		wpttr.appendChild(wpttd);
		wpttable.getElementsByTagName('tbody')[0].appendChild(wpttr);

		// note row
		// var wptnote = document.createElement('tr');
		// wptnote.setAttribute('class', 'BorderBottom');
		//
		// wpttd = document.createElement('td');
		// wpttd.appendChild(document.createTextNode(" "));
		// wptnote.appendChild(wpttd);
		//
		// wpttd = document.createElement('td');
		// wpttd.appendChild(document.createTextNode(" Note: "));
		// wptnote.appendChild(wpttd);
		//
		// wpttd = document.createElement('td');
		// wpttd.setAttribute('colspan', '6');
		// wpttd.appendChild(document.createTextNode(" "));
		// wptnote.appendChild(wpttd);
		// wpttable.getElementsByTagName('tbody')[0].appendChild(wptnote);
	}

	// check for "links to maps" table
	var mapLinks = document.getElementById('ctl00_ContentBody_MapLinks_MapLinks');
	if (mapLinks && currentComment && (currentComment.lat && currentComment.lng)) {
		var items = mapLinks.getElementsByTagName('li');
		var newlink = "";
		for ( var index = 0; index < items.length; index++) {
			var link = items[index].getElementsByTagName('a')[0];
			if (link.getAttribute('href').search('maps.google.com') > -1) {
				newlink = link.getAttribute('href') + " to: "
						+ convertDec2DMS(currentComment.lat, currentComment.lng) + " (" + lang.final_coordinate
						+ ")";
			} else if (link.getAttribute('href').search('mapquest.com') > -1) {
				var chunks = link.getAttribute('href').split('&');
				for ( var i = 0; i < chunks.length; i++) {
					var chunk = chunks[i];
					var maplat, maplng;
					if (chunk.search('latitude') > -1) {
						maplat = chunk.split('=')[1];
					} else if (chunk.search('longitude') > -1) {
						maplng = chunk.split('=')[1];
					}
				}
				newlink = "http://www.mapquest.com/?saddr=" + maplat + "," + maplng + "&daddr="
						+ currentComment.lat + "," + currentComment.lng + "&zoom=10";
			} else
				continue;

			if (newlink != "") {
				var a = document.createElement('a');
				a.setAttribute('target', '_blank');
				a.setAttribute('href', newlink);
				a.appendChild(document.createTextNode("(" + lang.detail_inclfinal + ")"));
				link.parentNode.appendChild(document.createTextNode(' '));
				link.parentNode.appendChild(a);
			}
		}
	}
}

function gccommentOnPrintPage() {
	log('debug', 'determining print page');
	setTimeout(function() {
		var hook = document.getElementById('Content');
		// log("debug", "print page: " + hook);
			if (hook == null) {
				log("debug", "gctour print page found");
				// setTimeout(function() {
				var overLay = document.getElementsByClassName('dark_msg_overlay')[0];

				if (overLay == null) { // kein overlay vorhanden? dann sofort
					gcTourPrintPage();
				} else { // overlay, erst warten, bis es weg ist und dann
					// rein
					overLay.addEventListener('DOMNodeRemoved', function(evt) {
						// log("info", "removed: " + evt);
							gcTourPrintPage();
						}, false);
				}
				// }, 100);
			} else {
				log("debug", "regular print page found");
				var actionString = document.getElementById('Form1').getAttribute('action');
				currentCacheGUID = actionString.split('&')[0].split('=')[1];
				var comment = doLoadCommentFromGUID(currentCacheGUID);
				if (comment != null) {
					// add marker to map
					if (comment.lat && comment.lng) {
						var mapImg = document.getElementById('map');
						if (mapImg) {
							mapImg.setAttribute('src', addToGoogleMapsStatic(mapImg.getAttribute('src'),
									comment.lat, comment.lng, finalIconLink));
						}

						unsafeWindow.__imageResize = unsafeWindow.imageResize;
						unsafeWindow.imageResize = function(width, height) {
							unsafeWindow.__imageResize(width, height);
							var finalMarker = "&markers=color:green|label:F|icon:" + finalIconLink + "|"
									+ comment.lat + "," + comment.lng;
							var mapImgSrc = mapImg.getAttribute('src').split('&sensor');
							mapImg.setAttribute('src', mapImgSrc[0] + finalMarker + "&sensor" + mapImgSrc[1]);
						};
					}

					// add comment sortable
					var contentGroup = hook.lastChild;
					while ((contentGroup.nodeName.toLowerCase() != "div") && (contentGroup != null)) {
						contentGroup = contentGroup.previousSibling;
					}

					var commentDiv = document.createElement('div');
					commentDiv.setAttribute('class', 'item ui-widget ui-widget-content ui-helper-clearfix');

					var headerDiv = document.createElement('div');
					headerDiv.setAttribute('class', 'item-header');
					var headText = "<span id='gccommentwidget' class='ui-icon ui-icon-minusthick'></span><h2>"
							+ lang.mycomment;

					if (comment.lat && comment.lng)
						headText = headText + " (final at " + convertDec2DMS(comment.lat, comment.lng) + ")";

					headText = headText + "</h2>";
					headerDiv.innerHTML = headText;

					var contentDiv = document.createElement('div');
					contentDiv.setAttribute('class', 'item-content');
					contentDiv.innerHTML = comment.commentValue.replace(/\n/g, '<br/>');

					commentDiv.appendChild(headerDiv);
					commentDiv.appendChild(contentDiv);

					contentGroup.insertBefore(commentDiv, contentGroup.firstChild);
					unsafeWindow.$("#gccommentwidget").click(
							function() {
								unsafeWindow.$(this).toggleClass("ui-icon-minusthick").toggleClass(
										"ui-icon-plusthick");
								unsafeWindow.$(this).parents(".item:first").toggleClass("no-print").find(
										".item-content").toggle();
							});

				}
			}
		}, 1000);
}

function gccommentOnManageLocations() {
	setTimeout(function() {
		var span = document.getElementById('LatLng');
		var coords = parseCoordinates(span.innerHTML);
		log('debug', coords.length);
		if (coords.length == 2) {
			GM_setValue('HOMELAT', "" + coords[0]);
			GM_setValue('HOMELNG', "" + coords[1]);
			log('info', 'stored new Home : ' + GM_getValue('HOMELAT') + " " + GM_getValue('HOMELNG'));
		}
	}, 2000);
}

function refreshTable(show) {
	if (commentTable) {
		$('#gccommenttablediv').empty();
	}
	commentTable = document.createElement('table');
	commentTable.setAttribute('id', 'gccommentoverviewtable');
	commentTable
			.setAttribute('style',
					'width:auto; outline: 1px solid rgb(215, 215, 215); position: relative;background-color:#EBECED');
	// commentTable.setAttribute('class', 'Table');
	var thead = document.createElement('thead');
	commentTable.appendChild(thead);

	var header = document.createElement('tr');
	var headeritem = document.createElement('th');
	headeritem.innerHTML = 'Cache';
	headeritem.setAttribute('style', 'width:200px;font-weight:bold');
	header.appendChild(headeritem);

	headeritem = document.createElement('th');
	headeritem.innerHTML = lang.table_comments;
	headeritem.setAttribute('style', 'font-weight:bold');
	header.appendChild(headeritem);

	headeritem = document.createElement('th');
	headeritem.innerHTML = lang.table_lastsave;
	headeritem.setAttribute('style', 'width:65px;font-weight:bold');
	header.appendChild(headeritem);

	headeritem = document.createElement('th');
	headeritem.innerHTML = lang.table_actions;
	headeritem.setAttribute('style', 'width:120px;font-weight:bold');
	header.appendChild(headeritem);
	thead.appendChild(header);

	var tbody = document.createElement('tbody');
	commentTable.appendChild(tbody);

	var tr;
	var td_guid;
	var td_comment;
	var td_savetime;
	var td_action;

	var keys = GM_listValues();
	var counter = 0;
	var commentCountWhite = 0;
	var commentCountRed = 0;
	var commentCountGreen = 0;
	var commentCountGray = 0;
	var commentCountArchive = 0;
	var start = new Date();
	for ( var ind = 0; ind < keys.length; ind++) {
		var commentKey = keys[ind];
		if (commentKey.indexOf(COMPREFIX) == -1)
			continue;

		tr = document.createElement('tr');
		var comment = doLoadCommentFromGUID(commentKey.substr(COMPREFIX.length));

		if (!comment.state || (comment.state == "undefined") || (comment.state == undefined))
			comment.state = stateOptions[0];

		if (comment.state == stateOptions[0])
			commentCountWhite++;
		else if (comment.state == stateOptions[1])
			commentCountRed++;
		else if (comment.state == stateOptions[2])
			commentCountGreen++;
		else if (comment.state == stateOptions[3])
			commentCountGray++;

		if (comment.archived === ARCHIVED) {
			commentCountArchive++;
		}
		if (filter
				&& (((filter != ARCHIVED) && ((filter != comment.state) || comment.archived === ARCHIVED)) || (filter === ARCHIVED && (filter != comment.archived))))
			continue;
		else if ((filter != ARCHIVED) && comment.archived === ARCHIVED)
			continue;

		// if (counter++ % 2 == 0)
		// tr.setAttribute('class', 'AlternatingRow');

		td_guid = document.createElement('td');
		var img = document.createElement('img');
		if (comment.state == stateOptions[1])
			img.src = state_unsolved;
		else if (comment.state == stateOptions[2])
			img.src = state_solved;
		else if (comment.state == stateOptions[3])
			img.src = state_found;
		else
			img.src = state_default;
		td_guid.appendChild(img);
		td_guid.appendChild(document.createTextNode(' '));

		var guid = commentKey.replace(/gccomment/, '');
		var link = document.createElement('a');
		link.href = 'http://www.geocaching.com/seek/cache_details.aspx?guid=' + guid;
		link.appendChild(document.createTextNode(comment.name + " (" + comment.gccode + ")"));
		td_guid.appendChild(link);
		if ((comment.lat != null) && (comment.lng != null)) {
			var haveFinal = document.createElement('img');
			haveFinal.setAttribute('src', finalIcon);
			haveFinal.setAttribute('width', '16px');
			haveFinal.setAttribute('height', '16px');
			haveFinal.setAttribute('style', 'margin-left:3px');
			haveFinal.setAttribute('title', lang.table_ihaveit);
			td_guid.appendChild(haveFinal);
		}
		tr.appendChild(td_guid);

		td_comment = document.createElement('td');
		var td_commentValue = "";
		if (comment.lat && comment.lng) {
			td_commentValue = td_commentValue + lang.table_finalat
					+ convertDec2DMS(comment.lat, comment.lng);
			if (GM_getValue('HOMELAT') && GM_getValue('HOMELNG')) {
				td_commentValue = td_commentValue
						+ " ("
						+ calculateDistance(GM_getValue('HOMELAT'), GM_getValue('HOMELNG'), comment.lat,
								comment.lng).toFixed(2) + "km " + lang.table_fromhome + ")";
			}
			td_commentValue = td_commentValue + "</br>";
		}
		if (comment.commentValue) {
			td_commentValue = td_commentValue + "<p style='font-family:monospace;font-size:small'>"
					+ comment.commentValue.replace(/\n/g, '<br/>') + "</p>";
		}
		td_comment.innerHTML = td_commentValue;
		tr.appendChild(td_comment);

		td_savetime = document.createElement('td');
		if (comment.saveTime)
			td_savetime.innerHTML = "<small>" + createTimeString(comment.saveTime) + "</small>";
		tr.appendChild(td_savetime);

		td_action = document.createElement('td');

		var action_markdefault = document.createElement('a');
		var mdefimg = document.createElement('img');
		mdefimg.src = state_default;
		mdefimg.title = lang.table_markcacheas + " " + lang.type_untyped;
		action_markdefault.appendChild(mdefimg);
		action_markdefault.setAttribute('style', 'margin-right:3px');
		action_markdefault.href = "#" + guid + "=markdefault";
		action_markdefault.addEventListener('click', changeState, false);
		td_action.appendChild(action_markdefault);

		var action_markunsolved = document.createElement('a');
		var muimg = document.createElement('img');
		muimg.src = state_unsolved;
		muimg.title = lang.table_markcacheas + " " + lang.type_unsolved;
		action_markunsolved.appendChild(muimg);
		action_markunsolved.setAttribute('style', 'margin-right:3px');
		action_markunsolved.href = "#" + guid + "=markunsolved";
		action_markunsolved.addEventListener('click', changeState, false);
		td_action.appendChild(action_markunsolved);

		var action_marksolved = document.createElement('a');
		var msimg = document.createElement('img');
		msimg.src = state_solved;
		msimg.title = lang.table_markcacheas + " " + lang.type_solved;
		action_marksolved.appendChild(msimg);
		action_marksolved.setAttribute('style', 'margin-right:3px');
		action_marksolved.href = "#" + guid + "=marksolved";
		action_marksolved.addEventListener('click', changeState, false);
		td_action.appendChild(action_marksolved);

		var action_markfound = document.createElement('a');
		var mfimg = document.createElement('img');
		mfimg.src = state_found;
		mfimg.title = lang.table_markcacheas + " " + lang.type_found;
		action_markfound.appendChild(mfimg);
		action_markfound.setAttribute('style', 'margin-right:3px');
		action_markfound.href = "#" + guid + "=markfound";
		action_markfound.addEventListener('click', changeState, false);
		td_action.appendChild(action_markfound);

		var action_del = document.createElement('a');
		var delImg = document.createElement('img');
		delImg.src = commentIconDelete;
		delImg.title = lang.detail_delete;
		action_del.appendChild(delImg);
		action_del.setAttribute('style', 'margin-right:3px');
		action_del.href = "#" + guid + "=del";
		action_del.addEventListener('click', function(event) {
			var check = confirm(lang.delete_confirmation);
			if (check) {
				var url = "" + this;
				var guid = url.split("#")[1].split("=")[0];
				var action = url.split("#")[1].split("=")[1];

				var row = $(event.target).parents('tr');
				$('#gccommentoverviewtable').dataTable().fnDeleteRow(row[0]);

				if (action === "del") {
					GM_deleteValue(COMPREFIX + guid);
				}
				if (GM_getValue(LAZY_TABLE_REFRESH) == 0) {
					refreshTable(true);
				}
			}
		}, false);

		td_action.appendChild(action_del);

		var action_edit = document.createElement('a');
		var editimg = document.createElement('img');
		editimg.src = commentIconEdit;
		editimg.title = lang.table_editondetail;
		action_edit.appendChild(editimg);
		action_edit.setAttribute('style', 'margin-right:3px');
		action_edit.href = "http://www.geocaching.com/seek/cache_details.aspx?guid=" + guid
				+ "#mycomments";
		td_action.appendChild(action_edit);

		if (filter === ARCHIVED) {
			var action_removeFromArchive = document.createElement('a');
			var mdefimg = document.createElement('img');
			mdefimg.src = archiveRemove;
			mdefimg.title = lang.table_removefromarchive;
			action_removeFromArchive.appendChild(mdefimg);
			action_removeFromArchive.setAttribute('style', 'margin-right:3px');
			action_removeFromArchive.href = "#" + guid + "=removeFromArchive";
			action_removeFromArchive.addEventListener('click', changeState, false);
			td_action.appendChild(action_removeFromArchive);
		} else {
			var action_addToArchive = document.createElement('a');
			var mdefimg = document.createElement('img');
			mdefimg.src = archiveAdd;
			mdefimg.title = lang.table_addtoarchive;
			action_addToArchive.appendChild(mdefimg);
			action_addToArchive.setAttribute('style', 'margin-right:3px');
			action_addToArchive.href = "#" + guid + "=addToArchive";
			action_addToArchive.addEventListener('click', changeState, false);
			td_action.appendChild(action_addToArchive);
		}
		tr.appendChild(td_action);
		tbody.appendChild(tr);
	}
	var end = new Date();
	// alert("Duration " + (end - start) + "ms.");

	$('#gccommenttablediv').append(commentTable);
	if (!show) {
		$('#gccommenttablediv').css('display', 'none');
		// $('#gccommentoverviewtable').css('display', 'none');
	} else {
		// commentTable.style.display = 'block';
		// commentTable.setAttribute('style', 'table-layout:fixed;');
	}
	$('#gccommentoverviewtable').dataTable( {
		"bAutoWidth" : false,
		"bJQueryUI" : true,
		"aoColumns" : [ {
			"sWidth" : "200px"
		}, {
			"sWidth" : "505px"
		}, {
			"sWidth" : "80px"
		}, {
			"sWidth" : "72px",
			"bSortable" : false
		} ]
	});
	$('#gccommentoverviewtable_length').append(
			$('#gccommentoverviewtable_filter > label').css('margin', '10px')).css('padding', '5px').css(
			'font-weight', '500').append($('#gccommentoverviewtable_paginate')).append(
			$('#gccommentoverviewtable_info')).children().css('float', 'left').css('margin',
			'0px 10px 5px 10px');

	$('#gccommentoverviewtable').css('margin-bottom', '0px');

	GM_setValue('countWhite', "" + commentCountWhite);
	GM_setValue('countRed', "" + commentCountRed);
	GM_setValue('countGreen', "" + commentCountGreen);
	GM_setValue('countGray', "" + commentCountGray);
	GM_setValue('countArchive', "" + commentCountArchive);
}

function gcTourPrintPage() {
	log("info", 'weaving into gctour print page');
	var bodychilds = document.getElementsByTagName('body')[0].childNodes;
	for ( var i = 0; i < bodychilds.length; i++) {
		var child = bodychilds[i];
		if ((child.getAttribute('class') != null) && (child.getAttribute('class') == 'cacheDetail')) {
			var guid = child.getAttribute('id');
			if (guid != null) {
				var contentDiv = child.getElementsByTagName('div')[5];
				var waypointDiv = contentDiv.getElementsByTagName('div')[3];
				var savedComment = doLoadCommentFromGUID(guid);
				if (savedComment != null) {
					var mycomment = document.createElement('div');
					if ((savedComment.lat != null) && (savedComment.lng != null))
						mycomment.innerHTML = mycomment.innerHTML + "<b>" + lang.final_coordinate + "</b><br/>"
								+ convertDec2DMS(savedComment.lat, savedComment.lng) + "<br/>";
					mycomment.innerHTML = mycomment.innerHTML + "<b>" + lang.mycomment + ": </b>"
							+ savedComment.commentValue.replace(/\n/g, '<br/>');
					waypointDiv.parentNode.insertBefore(mycomment, waypointDiv);
				}
			}
		}
	}
}

// es wird eine Tabelle angezeigt (suchergebnis, profilseite, etc.).
// Tooltips werden hier eingewebt.
function addCommentBubblesToPage() {
	log("info", "weaving comments into table...");
	appendScript('text', "var tooltip = function(){	" + "var id = 'tt';	" + "var top = 3;	"
			+ "var left = 3;	" + "var maxw = 500;	" + "var speed = 10;	" + "var timer = 20;	"
			+ "var endalpha = 95;	" + "var alpha = 0;	" + "var tt,t,c,b,h;	"
			+ "var ie = document.all ? true : false;	" + "return {		" + "show:function(v,w) {			"
			+ "if(tt == null) {				" + "tt = document.createElement('div');				"
			+ "tt.setAttribute('id',id);				" + "t = document.createElement('div');				"
			+ "t.setAttribute('id',id + 'top');				" + "c = document.createElement('div');				"
			+ "c.setAttribute('id',id + 'cont');				" + "b = document.createElement('div');				"
			+ "b.setAttribute('id',id + 'bot');				" + "tt.appendChild(t);				"
			+ "tt.appendChild(c);				" + "tt.appendChild(b);				" + "document.body.appendChild(tt);				"
			+ "tt.style.opacity = 0;				" + "tt.style.filter = 'alpha(opacity=0)';				"
			+ "document.onmousemove = this.pos;			" + "}			" + "tt.style.display = 'block';			"
			+ "c.innerHTML = v;			" + "tt.style.width = w ? w + 'px' : 'auto';			" + "if(!w && ie){				"
			+ "t.style.display = 'none';				" + "b.style.display = 'none';				"
			+ "tt.style.width = tt.offsetWidth;				" + "t.style.display = 'block';				"
			+ "b.style.display = 'block';			" + "}			" + "if(tt.offsetWidth > maxw){"
			+ "tt.style.width = maxw + 'px'" + "}			" + "h = parseInt(tt.offsetHeight) + top;			"
			+ "clearInterval(tt.timer);			"
			+ "tt.timer = setInterval(function(){tooltip.fade(1)},timer);" + "},		"
			+ "pos:function(e){			"
			+ "var u = ie ? event.clientY + document.documentElement.scrollTop : e.pageY;			"
			+ "var l = ie ? event.clientX + document.documentElement.scrollLeft : e.pageX;			"
			+ "tt.style.top = (u - h) + 'px';			" + "tt.style.left = (l + left) + 'px';		" + "},		"
			+ "fade:function(d){			" + "var a = alpha;			"
			+ "if((a != endalpha && d == 1) || (a != 0 && d == -1)){				" + "var i = speed;				"
			+ "if(endalpha - a < speed && d == 1){					" + "i = endalpha - a;				"
			+ "}else if(alpha < speed && d == -1){					" + "i = a;				" + "}				"
			+ "alpha = a + (i * d);				" + "tt.style.opacity = alpha * .01;				"
			+ "tt.style.filter = 'alpha(opacity=' + alpha + ')';			" + "}else{				"
			+ "clearInterval(tt.timer);				" + "if(d == -1){tt.style.display = 'none'}			" + "}		"
			+ "},		" + "hide:function(){			" + "clearInterval(tt.timer);			"
			+ "tt.timer = setInterval(function(){tooltip.fade(-1)},timer);		" + "}	};}();", null);

	var style = document.createElement('style');
	style.type = 'text/css';
	style.media = 'screen';
	style.innerHTML = '* {margin:0; padding:0}#text {margin:50px auto; width:500px}.hotspot {color:#900; padding-bottom:1px; border-bottom:1px dotted #900; cursor:pointer}#tt {position:absolute; display:block}#tttop {display:block; height:5px; margin-left:5px; overflow:hidden}#ttcont {display:block; padding:2px 12px 3px 7px; margin-left:5px; background:#666; color:#FFF}#ttbot {display:block; height:5px; margin-left:5px; overflow:hidden}';
	document.getElementsByTagName('head')[0].appendChild(style);

	var anchors = document.getElementsByTagName('a');
	var reg = /cache_details\.aspx\?guid=([^&]*)/;
	var previousAnchor = null;

	for ( var i = 0; i < anchors.length; i++) { // check all links
		var a = anchors[i];
		if (reg.exec(a.href)) { // anchor is a link to a cache
			if (a.href == previousAnchor) {
				continue;
			}
			previousAnchor = a.href;

			var guid = RegExp.$1;
			var comment = doLoadCommentFromGUID(guid);
			if (!comment || (!comment.commentValue && !comment.lat && !comment.lng))
				continue;

			var target = document.createElement('img');

			if (!comment.state)
				target.src = state_default;
			else {
				if (comment.state == stateOptions[1])
					target.src = state_unsolved;
				else if (comment.state == stateOptions[2])
					target.src = state_solved;
				else if (comment.state == stateOptions[3])
					target.src = state_found;
				else
					target.src = state_default;
			}

			target.width = '16';
			target.height = '16';
			target.alt = 'Comment available';
			target.addEventListener('mouseover', function(evt) {
				var targetNode = evt.relatedTarget;
				if (!targetNode)
					return;

				var cacheLink, commValue, cID;

				while (targetNode.nodeName.toLowerCase() != "td") {
					targetNode = targetNode.parentNode;
					if (!targetNode)
						break;
				}

				if (!targetNode || (targetNode.nodeName.toLowerCase() != "td"))
					return;

				var anchs = targetNode.getElementsByTagName('a');
				for ( var x = 0; x < anchs.length; x++) {
					if (reg.exec(anchs[x].getAttribute('href'))) {
						cacheLink = anchs[x];
						cID = RegExp.$1;
						commValue = doLoadCommentFromGUID(cID);
						if (!commValue) {
							targetNode.removeChild(tdElement.getElementsByTagName('img')[0]);
							return;
						}
						break;
					}
				}
				var commentTooltip = "";
				if ((commValue.lat != null) && (commValue.lng != null)) {
					commentTooltip = commentTooltip + "<strong>" + lang.myfinalcoords + "</strong><br/>"
							+ convertDec2DMS(commValue.lat, commValue.lng);
				}
				commentTooltip = commentTooltip + "<br/><br/><strong>" + lang.mycomment + "</strong><br/>"
						+ commValue.commentValue.replace(/\n/g, '<br/>');
				unsafeWindow.tooltip.show(commentTooltip, 400);
			}, false);
			target.setAttribute('onmouseout', 'tooltip.hide();');
			// if (a.parentNode.getElementsByTagName('br').length = 2)
			// a.parentNode.removeChild(a.parentNode
			// .getElementsByTagName('br')[1]);
			a.parentNode.appendChild(document.createTextNode(' '));
			a.parentNode.appendChild(target);
			// a.parentNode.insertBefore(target, a.nextSibling);
			target.style.display = 'inline';
		}
	}
}

// helper detailpage. formatiert die Zeit des letzten Speicherns und f�gt es ein
function updateSaveTime(time) {
	var txt = lang.detail_lastsaved + ": " + createTimeString(time);
	var newNode = document.createTextNode(txt);
	detailCommentLastSaveTime.parentNode.insertBefore(newNode, detailCommentLastSaveTime);
	detailCommentLastSaveTime.parentNode.removeChild(detailCommentLastSaveTime);
	detailCommentLastSaveTime = newNode;
}

function prepareTextPane(value) {
	var result = value;
	result = result.replace(/(http:\/\/\S*)/g, '<a href="$1">$1<\/a>');
	result = result.replace(/(https:\/\/\S*)/g, '<a href="$1">$1<\/a>');
	result = result.replace(/(file:\/\/\S*)/g, '<a href="$1">$1<\/a>');
	result = result.replace(/(ftp:\/\/\S*)/g, '<a href="$1">$1<\/a>');
	result = result.replace(/\n/g, '<br/>');
	return result;
}

function doSaveCommentWTimeToGUID(guid, gccode, name, commentValue, saveTime, state, lat, lng,
		origlat, origlng, archived) {
	var key = COMPREFIX + guid;
	var value = gccode + DELIM + name + DELIM + commentValue + DELIM + saveTime + DELIM + state
			+ DELIM + lat + DELIM + lng + DELIM + origlat + DELIM + origlng + DELIM + archived;
	var keyIndex = COMGCPREFIX + gccode;

	GM_setValue(key, value);
	// index entry for fast gccode-guid determination
	GM_setValue(keyIndex, guid);
	log("info", "saving " + key + " - " + value);
}

function doSaveCommentToGUID(guid, gccode, name, commentValue, state, lat, lng, origlat, origlng,
		archived) {
	var now = new Date();
	doSaveCommentWTimeToGUID(guid, gccode, name, commentValue, (now - 0), state, lat, lng, origlat,
			origlng, archived);
}

function doLoadCommentFromGUID(guid) {
	var c = GM_getValue(COMPREFIX + guid);
	// log("info", "loaded: " + c);
	if (!c)
		return null;
	var details = c.split(DELIM);
	var comment = new Object();
	comment.guid = guid;
	comment.gccode = details[0];
	comment.name = details[1];
	comment.commentValue = details[2];
	comment.saveTime = details[3];
	comment.state = details[4];
	if ((details[5] != "undefined") && (details[5] != "null") && (details[5] != ""))
		comment.lat = details[5];
	if ((details[6] != "undefined") && (details[6] != "null") && (details[6] != ""))
		comment.lng = details[6];
	if ((details[7] != "undefined") && (details[7] != "null") && (details[7] != ""))
		comment.origlat = details[7];
	if ((details[8] != "undefined") && (details[8] != "null") && (details[8] != ""))
		comment.origlng = details[8];
	if ((details[9] != "undefined") && (details[9] != "null") && (details[9] != ""))
		comment.archived = details[9];
	return comment;
}

function doLoadCommentFromGCCode(gcCode) {
	var guid = getGUIDFromGCCode(gcCode);
	return doLoadCommentFromGUID(guid);
}

function editComment() {
	AddComment.style.display = 'none';
	detailCommentCacheState.removeAttribute('disabled');
	SaveComment.style.display = 'inline';
	detailCommentTextPane.style.display = 'none';
	detailCommentTextArea.style.display = 'block';
	detailCommentInputLatLng.removeAttribute("disabled");
	if (currentComment)
		detailCommentTextArea.value = currentComment.commentValue;
	EditComment.style.display = 'none';
	EditCancelComment.style.display = 'inline';
	setTimeout(function() {
		detailCommentTextArea.focus();
	}, 50);
}

function retrieveOriginalCoordinates() {
	var origCoordinates;
	// try to get it from GS
	if (unsafeWindow.userDefinedCoords && unsafeWindow.userDefinedCoords.data
			&& unsafeWindow.userDefinedCoords.data.oldLatLngDisplay) {
		origCoordinates = parseCoordinates(unsafeWindow.userDefinedCoords.data.oldLatLngDisplay);
	} else { // grab it from page
		origCoordinates = parseCoordinates(document.getElementById('uxLatLon').innerHTML);
	}

	if (origCoordinates.length == 2) {
		return origCoordinates;
	} else {
		log('error', 'Original Coordinates of cache could not be determined.');
		return [ "", "" ];
	}
}

function saveFinalCoords() {
	var cstr = detailFinalInputLatLng.value;
	detailCommentCacheState.options.selectedIndex = detailFinalCacheState.options.selectedIndex;
	var orig = retrieveOriginalCoordinates();
	log('info', 'orig ' + orig);

	var error = "";
	if (cstr == DEFAULTCOORDS) {
		if (currentComment != null)
			doSaveCommentToGUID(currentCacheGUID, currentComment.gccode, currentComment.name,
					currentComment.commentValue,
					detailFinalCacheState.options[detailFinalCacheState.options.selectedIndex].value, null,
					null, currentComment.origlat, currentComment.origlng, currentComment.archived);
		else { // save new
			doSaveCommentToGUID(currentCacheGUID, currentCacheCode, currentCacheName, " ",
					detailFinalCacheState.options[detailFinalCacheState.options.selectedIndex].value, null,
					null, orig[0], orig[1], null);
		}
		currentComment = doLoadCommentFromGUID(currentCacheGUID);
		detailCommentInputLatLng.value = DEFAULTCOORDS;
		detailFinalInputLatLng.value = DEFAULTCOORDS;
		// log('info', 'deleted final coords');
		// error = "default coords!";
	} else {
		var fin = parseCoordinates(cstr);
		if (fin.length == 2) {
			if (currentComment == null) {
				detailCommentInputLatLng.value = cstr;
				saveComment();
			} else { // save new
				doSaveCommentToGUID(currentCacheGUID, currentComment.gccode, currentComment.name,
						currentComment.commentValue,
						detailFinalCacheState.options[detailFinalCacheState.options.selectedIndex].value,
						fin[0], fin[1], orig[0], orig[1], null);
			}
			currentComment = doLoadCommentFromGUID(currentCacheGUID);
			var clean = convertDec2DMS(currentComment.lat, currentComment.lng);
			detailCommentInputLatLng.value = clean;
			detailFinalInputLatLng.value = clean;
			// saveComment();
			// detailCommentInputLatLng.value = cstr;
			// log("info", "coordinatestring: " + cstr);

			if (GM_getValue(AUTO_UPDATE_GS_FINAL) == 1) {
				$.pageMethod("SetUserCoordinate", JSON.stringify( {
					dto : {
						data : {
							lat : fin[0],
							lng : fin[1]
						},
						ut : unsafeWindow.userToken
					}
				}), function(r) {
					var r = JSON.parse(r.d);
					if (r.status == "success") {
						window.location.reload();
					}
				});
			}
		} else {
			error = fin[0];
		}
	}

	if (error == "") {
		SaveFinalCoords.parentNode.appendChild(waitingTag);
		waitingTag.setAttribute('style', 'display:inline');
		waitingTag.setAttribute("src", successIcon);
		setTimeout(function() {
			unsafeWindow.$("#waiting").fadeOut('slow', function() {
			});
		}, 5000);

		// if (document.getElementById('gctidy-small-map-link')) {
		if (typeof unsafeWindow.GCTidyWaypoints == "object") {
			var finalwpt = {
				lat : currentComment.lat,
				lng : currentComment.lng,
				type : 'Trailhead',
				title : lang.final_location,
				html : '<div class=\"gctidy-waypoint-infowindow-text\"><p class=\"gctidy-waypoint-cache-title\"><img src=\"' + finalIcon + '\"> <strong>Final!</strong></p></div>'
			};
			unsafeWindow.GCTidyWaypoints.push(finalwpt);
		}
	} else {
		log("info", "parsing failed (" + error + ")");
		SaveFinalCoords.parentNode.appendChild(waitingTag);
		waitingTag.setAttribute('style', 'display:inline');
		waitingTag.setAttribute("src", errorIcon);
		setTimeout(function() {
			unsafeWindow.$("#waiting").fadeOut('slow', function() {
			});
		}, 5000);
	}
}

function saveComment() {
	var fin = parseCoordinates(detailCommentInputLatLng.value);
	var finlat, finlng;
	if (fin.length == 2) {
		finlat = fin[0];
		finlng = fin[1];
	} else if (detailCommentInputLatLng.value != DEFAULTCOORDS) {
		alert(lang.alert_couldnotparse + fin[0]);
		return;
	}
	detailFinalCacheState.options.selectedIndex = detailCommentCacheState.options.selectedIndex;

	detailCommentCacheState.setAttribute('disabled', '');
	detailCommentTextArea.style.display = 'none';
	SaveComment.style.display = 'none';
	EditCancelComment.style.display = 'none';
	detailCommentTextPane.innerHTML = prepareTextPane(detailCommentTextArea.value);
	detailCommentTextPane.style.display = 'inline';
	detailCommentInputLatLng.setAttribute("disabled", "");
	if ((detailCommentTextArea.value == "") && (detailCommentInputLatLng.value == DEFAULTCOORDS)) {
		AddComment.style.display = 'inline';
		EditComment.style.display = 'none';
		DeleteComment.style.display = 'none';
		GM_deleteValue(COMPREFIX + currentCacheGUID);
		updateSaveTime(-1);
		currentComment = null;
		detailCommentCacheState.options.selectedIndex = 0;
	} else {
		AddComment.style.display = 'none';
		EditComment.style.display = 'inline';
		DeleteComment.style.display = 'inline';
		updateSaveTime(new Date());
		var orig = retrieveOriginalCoordinates();
		doSaveCommentToGUID(currentCacheGUID, currentCacheCode, currentCacheName,
				detailCommentTextArea.value,
				detailCommentCacheState.options[detailCommentCacheState.options.selectedIndex].value,
				finlat, finlng, orig[0], orig[1], null);
		currentComment = doLoadCommentFromGUID(currentCacheGUID);
		var clean = DEFAULTCOORDS;
		if (currentComment.lat && currentComment.lng) {
			clean = convertDec2DMS(currentComment.lat, currentComment.lng);
		}
		detailCommentInputLatLng.value = clean;
		detailFinalInputLatLng.value = clean;
	}
}

function changeState(event) {
	var url = "" + this;
	var guid = url.split("#")[1].split("=")[0];
	var action = url.split("#")[1].split("=")[1];
	var targetState = "";

	var comment = doLoadCommentFromGUID(guid);

	if (!comment)
		return;

	if (action === "markunsolved") {
		doSaveCommentToGUID(guid, comment.gccode, comment.name, comment.commentValue, stateOptions[1],
				comment.lat, comment.lng, comment.origlat, comment.origlng, comment.archived);
		targetState = stateOptions[1];
	} else if (action === "marksolved") {
		doSaveCommentToGUID(guid, comment.gccode, comment.name, comment.commentValue, stateOptions[2],
				comment.lat, comment.lng, comment.origlat, comment.origlng, comment.archived);
		targetState = stateOptions[2];
	} else if (action === "markfound") {
		doSaveCommentToGUID(guid, comment.gccode, comment.name, comment.commentValue, stateOptions[3],
				comment.lat, comment.lng, comment.origlat, comment.origlng, comment.archived);
		targetState = stateOptions[3];
	} else if (action === "markdefault") {
		doSaveCommentToGUID(guid, comment.gccode, comment.name, comment.commentValue, stateOptions[0],
				comment.lat, comment.lng, comment.origlat, comment.origlng, comment.archived);
		targetState = stateOptions[0];
	} else if (action === "addToArchive") {
		doSaveCommentToGUID(guid, comment.gccode, comment.name, comment.commentValue, comment.state,
				comment.lat, comment.lng, comment.origlat, comment.origlng, ARCHIVED);
		targetState = comment.state;
	} else if (action === "removeFromArchive") {
		doSaveCommentToGUID(guid, comment.gccode, comment.name, comment.commentValue, comment.state,
				comment.lat, comment.lng, comment.origlat, comment.origlng, undefined);
		targetState = comment.state;
	}
	if (GM_getValue(LAZY_TABLE_REFRESH) == 0) {
		// refreshTable(true);
	}

	// change state to sth not matching the filter
	console.log('filter ' + comment.state + " " + targetState);
	if ((targetState != comment.state) && ((filter != null) && (filter != ARCHIVED))) {
		var row = $(event.target).parents('tr');
		$('#gccommentoverviewtable').dataTable().fnDeleteRow(row[0]);
	}

	// change archive state to or from archive
	if (action.indexOf('Archive') > 0) {
		var row = $(event.target).parents('tr');
		$('#gccommentoverviewtable').dataTable().fnDeleteRow(row[0]);
	}
}

// ***
// *** MysteryMover
// ***
function mysteryMoverOnMapPage() {
	// TODO GS icons change at less that zoom level 14

	var stm_myCaches = document.getElementById("search");
	if (stm_myCaches != null) {
		var mmDiv = document.createElement('div');

		var mmOption = document.createElement('input');
		mmOption.setAttribute('id', 'autoMoveMysteriesBeta');
		mmOption.setAttribute('type', 'checkbox');
		mmOption.setAttribute('class', 'Checkbox');

		var mmOptionLabel = document.createElement('label');
		mmOptionLabel.setAttribute('id', 'autoMoveMysteriesLabelBeta');
		mmOptionLabel.setAttribute('for', 'autoMoveMysteriesBeta');
		mmOptionLabel.appendChild(document.createTextNode(lang.map_enablemm));
		mmOptionLabel.addEventListener('click', toggleMoveMysteries, false);

		var mmSub = document.createElement('div');
		mmSub.setAttribute('id', 'mmSub');
		mmSub.setAttribute('data-role', 'controlgroup');
		mmSub.setAttribute('data-type', 'horizontal');
		mmSub.setAttribute('style', 'display:none');

		var mmSubSolvedOption = document.createElement('input');
		mmSubSolvedOption.setAttribute('id', 'mmSubSolvedOption');
		mmSubSolvedOption.setAttribute('type', 'checkbox');
		mmSubSolvedOption.setAttribute('class', 'Checkbox');
		mmSub.appendChild(mmSubSolvedOption);
		var mmSubSolvedLabel = document.createElement('label');
		mmSubSolvedLabel.setAttribute('for', 'mmSubSolvedOption');
		mmSubSolvedLabel.appendChild(document.createTextNode(lang.type_solved));
		mmSubSolvedLabel.setAttribute('style', 'font-size:12px;width:107px;text-align:center;');
		mmSub.appendChild(mmSubSolvedLabel);
		mmSubSolvedLabel.addEventListener('click', function() {
			var oldValue = GM_getValue(AUTOMOVEMYSTERIESBETASOLVED);
			if (oldValue === 1) {
				GM_setValue(AUTOMOVEMYSTERIESBETASOLVED, 0);
			} else {
				GM_setValue(AUTOMOVEMYSTERIESBETASOLVED, 1);
			}
			moveMysteriesBeta();
		}, false);

		var mmSubFoundOption = document.createElement('input');
		mmSubFoundOption.setAttribute('id', 'mmSubFoundOption');
		mmSubFoundOption.setAttribute('type', 'checkbox');
		mmSubFoundOption.setAttribute('class', 'Checkbox');
		mmSub.appendChild(mmSubFoundOption);
		var mmSubFoundLabel = document.createElement('label');
		mmSubFoundLabel.setAttribute('for', 'mmSubFoundOption');
		mmSubFoundLabel.appendChild(document.createTextNode(lang.type_found));
		mmSubFoundLabel.setAttribute('style', 'font-size:12px;width:107px;text-align:center;');
		mmSub.appendChild(mmSubFoundLabel);
		mmSubFoundLabel.addEventListener('click', function() {
			var oldValue = GM_getValue(AUTOMOVEMYSTERIESBETAFOUND);
			if (oldValue === 1) {
				GM_setValue(AUTOMOVEMYSTERIESBETAFOUND, 0);
			} else {
				GM_setValue(AUTOMOVEMYSTERIESBETAFOUND, 1);
			}
			moveMysteriesBeta();
		}, false);

		var mmSubUnsolvedOption = document.createElement('input');
		mmSubUnsolvedOption.setAttribute('id', 'mmSubUnsolvedOption');
		mmSubUnsolvedOption.setAttribute('type', 'checkbox');
		mmSubUnsolvedOption.setAttribute('class', 'Checkbox');
		mmSub.appendChild(mmSubUnsolvedOption);
		var mmSubUnsolvedLabel = document.createElement('label');
		mmSubUnsolvedLabel.setAttribute('for', 'mmSubUnsolvedOption');
		mmSubUnsolvedLabel.appendChild(document.createTextNode(lang.type_unsolved));
		mmSubUnsolvedLabel.setAttribute('style', 'font-size:12px;width:107px;text-align:center;');
		mmSub.appendChild(mmSubUnsolvedLabel);
		mmSubUnsolvedLabel.addEventListener('click', function() {
			var oldValue = GM_getValue(AUTOMOVEMYSTERIESBETAUNSOLVED);
			if (oldValue === 1) {
				GM_setValue(AUTOMOVEMYSTERIESBETAUNSOLVED, 0);
			} else {
				GM_setValue(AUTOMOVEMYSTERIESBETAUNSOLVED, 1);
			}
			moveMysteriesBeta();
		}, false);

		var mmSubShowHomeOption = document.createElement('input');
		mmSubShowHomeOption.setAttribute('id', 'mmSubShowHomeOption');
		mmSubShowHomeOption.setAttribute('type', 'checkbox');
		mmSubShowHomeOption.setAttribute('class', 'Checkbox');
		mmSub.appendChild(mmSubShowHomeOption);
		var mmSubShowHomeLabel = document.createElement('label');
		mmSubShowHomeLabel.setAttribute('for', 'mmSubShowHomeOption');
		mmSubShowHomeLabel.appendChild(document.createTextNode(lang.map_home));
		mmSubShowHomeLabel.setAttribute('style', 'font-size:12px;width:107px;text-align:center;');
		mmSub.appendChild(mmSubShowHomeLabel);
		mmSubShowHomeLabel.addEventListener('click', function() {
			var oldValue = GM_getValue(AUTOMOVEMYSTERIESBETAHOME);
			if (oldValue === 1) {
				GM_setValue(AUTOMOVEMYSTERIESBETAHOME, 0);
			} else {
				GM_setValue(AUTOMOVEMYSTERIESBETAHOME, 1);
			}
			moveMysteriesBeta();
		}, false);

		var mmSubShowAreaOption = document.createElement('input');
		mmSubShowAreaOption.setAttribute('id', 'mmSubShowAreaOption');
		mmSubShowAreaOption.setAttribute('type', 'checkbox');
		mmSubShowAreaOption.setAttribute('class', 'Checkbox');
		mmSub.appendChild(mmSubShowAreaOption);
		var mmSubShowAreaLabel = document.createElement('label');
		mmSubShowAreaLabel.setAttribute('for', 'mmSubShowAreaOption');
		mmSubShowAreaLabel.appendChild(document.createTextNode(lang.map_area));
		mmSubShowAreaLabel.setAttribute('style', 'font-size:12px;width:107px;text-align:center;');
		mmSub.appendChild(mmSubShowAreaLabel);
		mmSubShowAreaLabel.addEventListener('click', function() {
			var oldValue = GM_getValue(AUTOMOVEMYSTERIESBETAAREA);
			if (oldValue === 1) {
				GM_setValue(AUTOMOVEMYSTERIESBETAAREA, 0);
			} else {
				GM_setValue(AUTOMOVEMYSTERIESBETAAREA, 1);
			}
			moveMysteriesBeta();
		}, false);

		mmDiv.appendChild(mmOption);
		mmDiv.appendChild(mmOptionLabel);
		mmDiv.appendChild(mmSub);

		$('#search').children('h3:first-child').css('clear', 'both');
		stm_myCaches.insertBefore(mmDiv, stm_myCaches.firstChild);

		// fill with already set content
		var ammbeta = GM_getValue(AUTOMOVEMYSTERIESBETA);
		var ammfound = GM_getValue(AUTOMOVEMYSTERIESBETAFOUND);
		var ammsolved = GM_getValue(AUTOMOVEMYSTERIESBETASOLVED);
		var ammhome = GM_getValue(AUTOMOVEMYSTERIESBETAHOME);
		var ammunsolved = GM_getValue(AUTOMOVEMYSTERIESBETAUNSOLVED);
		var ammarea = GM_getValue(AUTOMOVEMYSTERIESBETAAREA);
		if (ammfound == 1)
			mmSubFoundOption.setAttribute('checked', 'checked');
		if (ammsolved == 1)
			mmSubSolvedOption.setAttribute('checked', 'checked');
		if (ammhome == 1)
			mmSubShowHomeOption.setAttribute('checked', 'checked');
		if (ammunsolved == 1)
			mmSubUnsolvedOption.setAttribute('checked', 'checked');
		if (ammarea == 1)
			mmSubShowAreaOption.setAttribute('checked', 'checked');

		if (ammbeta == 1) {
			GM_setValue(AUTOMOVEMYSTERIESBETA, 0);
			setTimeout(function() {
				var event = document.createEvent('MouseEvent');
				event.initMouseEvent('click', true, true, window, 1, 0, 0, 0, 0, false, false, false,
						false, 0, mmOptionLabel);
				mmOptionLabel.dispatchEvent(event);
			}, 100);
		}

		$(unsafeWindow.document).trigger("create");

		setTimeout(function() {
			$('#mmSub span.ui-btn-inner').css('padding', '5px 10px 5px 10px');
			$('#autoMoveMysteriesLabelBeta span.ui-btn-inner').css('width', '257');
			$('#autoMoveMysteriesLabelBeta').css('width', '327');
		}, 1000);
	}
}

function toggleMoveMysteries() {
	var oldValue = GM_getValue(AUTOMOVEMYSTERIESBETA);
	$('#mmSub').slideToggle();
	if (oldValue === 1) {
		removeMarkers("all");
		GM_setValue(AUTOMOVEMYSTERIESBETA, 0);
	} else {
		GM_setValue(AUTOMOVEMYSTERIESBETA, 1);
		moveMysteriesBeta();
	}
}

function drawMarker(lat, lng, type, state, gccode, comment) {
	var oldIconProto = unsafeWindow.L.Icon.prototype;
	if (type === "final" && state === "found")
		unsafeWindow.L.Icon.prototype.options.iconUrl = finaliconfound;
	else if (type === "final" && state === "solved")
		unsafeWindow.L.Icon.prototype.options.iconUrl = finaliconsolved;
	else if (type === "final" && state === "not solved")
		unsafeWindow.L.Icon.prototype.options.iconUrl = finaliconunsolved;
	else if (type === "home" && state === "found")
		unsafeWindow.L.Icon.prototype.options.iconUrl = origfound;
	else if (type === "home" && state === "solved")
		unsafeWindow.L.Icon.prototype.options.iconUrl = origsolved;
	else if (type === "home" && state === "not solved")
		unsafeWindow.L.Icon.prototype.options.iconUrl = origunsolved;

	unsafeWindow.L.Icon.prototype.options.iconSize = new unsafeWindow.L.Point(22, 22);
	unsafeWindow.L.Icon.prototype.options.iconAnchor = new unsafeWindow.L.Point(11, 11);
	unsafeWindow.L.Icon.prototype.options.shadowSize = new unsafeWindow.L.Point(0, 0);

	var FinalIcon = unsafeWindow.L.Icon.extend( {
		iconUrl : finalIcon
	});

	// http://www.geocaching.com/map/map.details?i=GC2KHDH&_=1330805175632
	var finalMarker = new FinalIcon();
	var marker = new unsafeWindow.L.Marker(new unsafeWindow.L.LatLng(lat, lng), {
		icon : finalMarker
	});
	marker.on('click', function(event) {
		var gcurl = "http://www.geocaching.com/map/map.details?i=" + gccode + "&_=" + (new Date() - 0);
		// log('debug', 'gcurl: ' + gcurl);
			$.ajax( {
				url : gcurl,
				success : function(a) {
					// log('debug', 'result: ' + a.data);
				var b = "cd" + Math.ceil(9999999999999 * Math.random());
				var h = [ '<div id="', b, '"></div>' ].join("");
				// h = h + "<div id='comment' class='links Clear'>" + comment
				// + "</div>";

				var popup = new unsafeWindow.L.Popup( {
					offset : new unsafeWindow.L.Point(-178, 2)
				});
				popup.setContent(h);
				popup.setLatLng(marker.getLatLng());
				unsafeWindow.MapSettings.Map.openPopup(popup);
				$('#map_canvas').find("#" + b).link(a, "#cachePopupTemplate").delegate("a.prev-item",
						"click", function(a) {
							a.preventDefault();
							$(this).parents("div.map-item").hide().prev().show();
							return false;
						}).delegate("a.next-item", "click", function(a) {
					a.preventDefault();
					$(this).parents("div.map-item").hide().next().show();
					return false;
				});
				$('#map_canvas').find("#" + b).parent().width('401px');
				setTimeout(function() {
					popup._adjustPan();
				}, 100);
			}
			});
		});

	unsafeWindow.MapSettings.Map.addLayer(marker);
	markers.push(marker);
	unsafeWindow.L.Icon.prototype = oldIconProto;
}

function drawLine(finallat, finallng, origlat, origlng, state) {
	var latlngs = new Array();
	latlngs.push(new unsafeWindow.L.LatLng(finallat, finallng));
	latlngs.push(new unsafeWindow.L.LatLng(origlat, origlng));
	var color = "red";
	if (state === "found")
		color = "#cccccc";
	else if (state === "solved")
		color = "#66ff00";
	else if (state === "not solved")
		color = "#ff0000";

	var link = new unsafeWindow.L.Polyline(latlngs, {
		color : color,
		weight : 2,
		clickable : false,
		opacity : 1,
		fillOpacity : 1
	});

	unsafeWindow.MapSettings.Map.addLayer(link);
	markers.push(link);
}

function drawCircle(finallat, finallng, radius) {
	var latlng = new unsafeWindow.L.LatLng(finallat, finallng);
	var color = "#000000";

	var circle = new unsafeWindow.L.Circle(latlng, radius, {
		color : color,
		weight : 2,
		fill : true,
		clickable : false,
		opacity : 1,
		fillOpacity : 0.2
	});

	unsafeWindow.MapSettings.Map.addLayer(circle);
	markers.push(circle);
}

function removeMarkers(type) {
	for ( var i = 0; i < markers.length; i++) {
		unsafeWindow.MapSettings.Map.removeLayer(markers[i]);
	}
	markers = new Array();
}

function createMovedFinal(finallat, finallng, name, origlat, origlng, guid, commentValue, state,
		home, newid, gccode) {
	// log('debug', 'drawing ' + guid + " lat: " + finallat + " lng: " +
	// finallng
	// + " origlat: " + origlat + " origlng: " + origlng);
	drawMarker(finallat, finallng, "final", state, gccode, commentValue);

	if (GM_getValue(AUTOMOVEMYSTERIESBETAAREA) == 1) {
		drawCircle(finallat, finallng, "161");
	}

	if (home && origlat && origlng) {
		drawLine(finallat, finallng, origlat, origlng, state);
		drawMarker(origlat, origlng, "home", state, gccode, commentValue);
	}
}

function moveMysteriesBeta() {
	// log("info", "moving mysteries beta ... " + solved + ":" + found);

	var found = GM_getValue(AUTOMOVEMYSTERIESBETAFOUND);
	var solved = GM_getValue(AUTOMOVEMYSTERIESBETASOLVED);
	var unsolved = GM_getValue(AUTOMOVEMYSTERIESBETAUNSOLVED);
	var home = GM_getValue(AUTOMOVEMYSTERIESBETAHOME);

	var stUnsolved = null;
	if (unsolved)
		stUnsolved = stateOptions[1];

	var stSolved = null;
	if (solved)
		stSolved = stateOptions[2];

	var stFound = null;
	if (found)
		stFound = stateOptions[3];

	removeMarkers("all");

	var keys = GM_listValues();
	for ( var i = 0; i < keys.length; i++) {
		var key = keys[i];
		if (key.indexOf(COMPREFIX) > -1) {
			var guid = key.substring(COMPREFIX.length, key.length);
			var comment = doLoadCommentFromGUID(guid);
			if (((comment.state == stSolved) || (comment.state == stFound) || (comment.state == stUnsolved))
					&& ((comment.lat != undefined) && (comment.lng != undefined))
					&& (comment.archived != ARCHIVED)) {
				// log('debug', "doMoveBeta(" + comment.lat + ", "
				// + comment.lng + ", " + comment.name + ", "
				// + comment.origlat + ", " + comment.origlng + ", "
				// + comment.guid + ", "
				// + comment.commentValue.replace(/\n/g, "<br/>"));

				createMovedFinal(comment.lat, comment.lng, comment.name, parseFloat(comment.origlat),
						parseFloat(comment.origlng), comment.guid,
						comment.commentValue.replace(/\n/g, '<br/>'), comment.state, home,
						DBId2GCNew(GC2DBId(comment.gccode)), comment.gccode);
			}
		}
	}
}

function addToGCTidyDetailPage(finlat, finlng) {
	var gctidyMinimap = document.getElementById('gctidy-small-map-link');
	var finalwpt = {
		lat : finlat,
		lng : finlng,
		type : 'Trailhead',
		title : lang.final_location,
		html : '<div class=\"gctidy-waypoint-infowindow-text\"><p class=\"gctidy-waypoint-cache-title\"><img src=\"' + finalIcon + '\"> <strong>Final!</strong></p></div>'
	};
	unsafeWindow.GCTidyWaypoints.push(finalwpt);
	var gctstyle = gctidyMinimap.getAttribute('style');
	var newStyle = addToGoogleMapsStatic(gctstyle, finlat, finlng);
	gctidyMinimap.setAttribute('style', newStyle);
}

function addToGoogleMapsStatic(href, finlat, finlng, icon) {
	// log('debug', href);
	var GMstaticDelim = '&sensor';
	var hrefParts = href.split(GMstaticDelim);
	// log('debug', hrefParts);
	var result = hrefParts[0] + "&&markers=color:green|label:F|";
	if (icon)
		result = result + "icon:" + icon + "|";
	result = result + finlat + "," + finlng + '&sensor' + hrefParts[1];
	return result;
}

// ***
// *** import & export
// ***
function buildGCCExportString(filtered) {
	var result = "<gccomment>";
	var filteredComments = getComments(filtered);
	for ( var i = 0; i < filteredComments.length; i++) {
		var comment = filteredComments[i];
		result = result + "<comment>";
		result = result + "<gcid>";
		result = result + comment.guid;
		result = result + "</gcid>";
		result = result + "<gccode>";
		result = result + comment.gccode;
		result = result + "</gccode>";
		result = result + "<name>";
		result = result + escapeXML(comment.name);
		result = result + "</name>";
		result = result + "<content>";
		result = result + escapeXML(comment.commentValue);
		result = result + "</content>";
		result = result + "<save>";
		result = result + comment.saveTime;
		result = result + "</save>";
		result = result + "<state>";
		result = result + comment.state;
		result = result + "</state>";
		result = result + "<finallat>";
		if (comment.lat)
			result = result + comment.lat;
		result = result + "</finallat>";
		result = result + "<finallng>";
		if (comment.lng)
			result = result + comment.lng;
		result = result + "</finallng>";
		result = result + "<origlat>";
		if (comment.origlat)
			result = result + comment.origlat;
		result = result + "</origlat>";
		result = result + "<origlng>";
		if (comment.origlng)
			result = result + comment.origlng;
		result = result + "</origlng>";
		result = result + "<archived>";
		if (comment.archived)
			result = result + comment.archived;
		result = result + "</archived>";
		result = result + "</comment>";
		// }
	}
	result = result + "</gccomment>";
	GM_setValue(LAST_EXPORT, "" + (new Date() - 0));
	return result;
}

function getComments(filtered) {
	var filteredComments = new Array();
	var commentKeys = GM_listValues();
	for ( var i = 0; i < commentKeys.length; i++) {
		if (commentKeys[i].indexOf(COMPREFIX) > -1) {
			// log('debug', 'key: ' + commentKeys[i]);
			var guid = commentKeys[i].substr(COMPREFIX.length);
			// log('debug', 'guid: ' + guid);
			var comment = doLoadCommentFromGUID(guid);

			if (filtered) {
				var isArchived = (comment.archived === ARCHIVED);

				var filteredInclude = false;
				if (GM_getValue(EXPORT_FILTER_ALL))
					filteredInclude = true;
				if (GM_getValue(EXPORT_FILTER_UNTYPED) && comment.state === stateOptions[0] && !isArchived)
					filteredInclude = true;
				if (GM_getValue(EXPORT_FILTER_UNSOLVED) && comment.state === stateOptions[1] && !isArchived)
					filteredInclude = true;
				if (GM_getValue(EXPORT_FILTER_SOLVED) && comment.state === stateOptions[2] && !isArchived)
					filteredInclude = true;
				if (GM_getValue(EXPORT_FILTER_FOUND) && comment.state === stateOptions[3] && !isArchived)
					filteredInclude = true;
				if (GM_getValue(EXPORT_FILTER_ARCHIVE) && isArchived)
					filteredInclude = true;

				if (!filteredInclude)
					continue;
			}

			filteredComments.push(comment);
		}
	}
	return filteredComments;
}

function exportToGPX() {
	var result = xmlversion
			+ "<gpx xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\" version=\"1.0\" creator=\"Groundspeak, Inc. All Rights Reserved. http://www.groundspeak.com\" xsi:schemaLocation=\"http://www.topografix.com/GPX/1/0 http://www.topografix.com/GPX/1/0/gpx.xsd http://www.groundspeak.com/cache/1/0 http://www.groundspeak.com/cache/1/0/cache.xsd\" xmlns=\"http://www.topografix.com/GPX/1/0\" xmlns:groundspeak=\"http://www.groundspeak.com/cache/1/0\">\n";

	result = result + "  <name>" + lang.gpxexporttitle + "</name>\n";
	result = result + "  <desc>" + lang.gpxexportdesc + getUserName() + "</desc>\n";
	result = result + "  <author>" + getUserName() + "</author>\n";
	result = result + "  <email>contact@geocaching.com</email>\n";
	result = result + "  <url>http://www.geocaching.com</url>\n";
	result = result + "  <urlname>Geocaching - High Tech Treasure Hunting</urlname>\n";
	result = result + "  <time>" + isoTime(new Date()) + "</time>\n";
	result = result + "  <keywords>cache, geocache, finals</keywords>\n";
	result = result
			+ "  <bounds minlat=\"51.0505\" minlon=\"13.73365\" maxlat=\"51.0505\" maxlon=\"13.73365\" />\n";

	var filteredComments = getComments(true);
	for ( var i = 0; i < filteredComments.length; i++) {
		var comment = filteredComments[i];
		if (comment.lat && comment.lng) {
			var newwpt = "  <wpt lat=\"" + comment.lat + "\" lon=\"" + comment.lng + "\">\n"
					+ "    <time>" + isoTime(comment.saveTime) + "</time>\n" + "    <name>" + comment.gccode
					+ "</name>\n" + "    <cmt>GCComment: " + escapeXML(comment.commentValue) + "</cmt>\n"
					+ "    <desc>" + escapeXML(comment.name) + "</desc>\n"
					+ "    <url>http://www.geocaching.com/seek/cache_details.aspx?guid=" + comment.guid
					+ "</url>\n" + "    <urlname>GCComment Final</urlname>\n"
					+ "    <sym>Final Location</sym>\n"
					// alternativ
					// <sym>Flag,
					// Green</sym>
					// gr�ne
					// fahne
					// oder
					// <sym>Civil</sym>
					// goldene
					// fahne mit
					// stern
					+ "    <type>Waypoint|Final Location</type>\n" + "  </wpt>\n";
			result = result + newwpt;
		}
	}
	result = result + "</gpx>";
	return result;
	// openDownloadWindow(result, "Export as GPX", "application/gccomment");
}

function performFilteredDropboxExport() {
	var exportType = $('#exportTypeSelector option:selected').text();
	var data;
	if (exportType === "GCC") {
		data = xmlversion + buildGCCExportString(true);
	} else if (exportType === "CSV")
		data = exportToCSV();
	else if (exportType === "HTML")
		data = exportToHTML();
	else if (exportType === "GPX")
		data = xmlversion + exportToGPX();

	if (data) {
		var fileNameSuggest = "" + createTimeString(new Date(), true) + "_filteredExport."
				+ exportType.toLowerCase();
		var fileName = prompt(lang.export_toDropboxEnterFileName, fileNameSuggest);
		if (fileName) {
			var client = new Dropbox.Client( {
				key : dpkey,
				sandbox : true
			});

			client.authDriver(new Dropbox.Drivers.Redirect( {
				useQuery : true,
				rememberUser : true
			}));

			client.authenticate(function(error, client) {
				if (error) {
					log("debug", 'There was an error during authentication: ' + error.status);
				}
			});

			exportDropboxButton.parentNode.insertBefore(waitingTag, exportDropboxButton);
			waitingTag.setAttribute('style', 'display:inline');
			waitingTag.setAttribute('src', waitingGif);

			client.writeFile(fileName, data, function(error, stat) {
				if (error) {
					waitingTag.setAttribute("src", errorIcon);
					return log("debug", error); // Something went wrong.
				}
				waitingTag.setAttribute("src", successIcon);
				setTimeout(function() {
					unsafeWindow.$("#waiting").fadeOut('slow', function() {
					});
				}, 5000);

				log("debug", "Export to dropbox successful");
			});
		}
	}
}

function performFilteredExport() {
	var exportType = $('#exportTypeSelector option:selected').text();
	if (exportType === "GCC") {
		var data = xmlversion + buildGCCExportString(true);
		openDownloadWindow(data, "Export data", "application/gccomment");
	} else if (exportType === "CSV") {
		openDownloadWindow(exportToCSV(), "Export data", "text/csv");
	} else if (exportType === "HTML") {
		openDownloadWindow(exportToHTML(), "Export data", "text/html");
	} else if (exportType === "GPX") {
		openDownloadWindow(exportToGPX(), "Export data", "text/gpx");
	}
}

function exportToCSV() {
	// CSV
	var filestart = "";
	var fileend = "";
	var post = "\",";
	var pre = "\"";
	var lastpost = "\"";
	var linestart = "";
	var lineend = "\n";
	var replaceLineEnd = "  ";
	return performExport(filestart, fileend, pre, post, lastpost, linestart, lineend, replaceLineEnd);
}

function exportToHTML() {
	// HTML table
	var filestart = "<!DOCTYPE html><html><head><meta http-equiv='Content-Type' content='text/html; charset=utf-8'></head><body><style type='text/css'>td{border:1px solid}</style><table>";
	var fileend = "</table></body></html>";
	var post = "</td>";
	var lastpost = post;
	var pre = "<td>";
	var linestart = "<tr>";
	var lineend = "</tr>";
	var replaceLineEnd = "<br/>";
	return performExport(filestart, fileend, pre, post, lastpost, linestart, lineend, replaceLineEnd);
}

function performExport(filestart, fileend, pre, post, lastpost, linestart, lineend, replaceLineEnd) {
	var result = "";

	result = result + filestart;
	var filteredComments = getComments(true);
	for ( var i = 0; i < filteredComments.length; i++) {
		var comment = filteredComments[i];
		result = result + linestart;
		result = result + pre + comment.guid + post;
		result = result + pre + comment.gccode + post;
		result = result + pre + comment.name + post;
		result = result + pre + convertDec2DMS(comment.lat, comment.lng) + post;
		if (replaceLineEnd)
			result = result + pre + comment.commentValue.replace(/\n/g, replaceLineEnd) + post;
		else
			result = result + pre + comment.commentValue + post;

		result = result + pre + comment.saveTime + post;
		result = result + pre + comment.state + post;
		result = result + pre + comment.lat + post;
		result = result + pre + comment.lng + post;
		result = result + pre + comment.origlat + post;
		result = result + pre + comment.origlng + lastpost;
		result = result + lineend;
	}
	result = result + fileend;
	return result;
	// openDownloadWindow(result, "Export comments", "text/xls");
}

function parseXMLImport() {
	// log("debug", "parsing..." + importText.value);
	var parser = new DOMParser();
	var xmlDoc = parser.parseFromString(importText.value, "text/xml");
	var comments = xmlDoc.getElementsByTagName('comment');
	var resultImported = "<ul>";
	var resultNotImported = "  ";
	var importedCount = 0;
	var notImportedCount = 0;
	for ( var i = 0; i < comments.length; i++) {
		var imID = comments[i].childNodes[0].childNodes[0].nodeValue;
		var imCode = "";
		if (comments[i].childNodes[1].childNodes[0])
			imCode = comments[i].childNodes[1].childNodes[0].nodeValue;
		var imName = unescapeXML(unescape(comments[i].childNodes[2].childNodes[0].nodeValue));
		var imContent = "";
		if (comments[i].childNodes[3].childNodes[0]) {
			imContent = unescapeXML(unescape(comments[i].childNodes[3].childNodes[0].nodeValue));
		}
		if ((imContent == "null") || (imContent == "undefined"))
			imContent = "";

		var imSave = comments[i].childNodes[4].childNodes[0].nodeValue;

		var imState; // new property "state" with version 40
		if (comments[i].childNodes[5])
			imState = comments[i].childNodes[5].childNodes[0].nodeValue;

		var imLat = "", imLng = ""; // new props lat, lng since v46
		if (comments[i].childNodes[6] && comments[i].childNodes[7]) {
			if (comments[i].childNodes[6].childNodes[0])
				imLat = comments[i].childNodes[6].childNodes[0].nodeValue;
			if (comments[i].childNodes[7].childNodes[0])
				imLng = comments[i].childNodes[7].childNodes[0].nodeValue;
		}

		var imOriglat = "", imOriglng = ""; // new props for orig coordinate of
		// cache
		if (comments[i].childNodes[8] && comments[i].childNodes[9]) {
			if (comments[i].childNodes[8].childNodes[0])
				imOriglat = comments[i].childNodes[8].childNodes[0].nodeValue;
			if (comments[i].childNodes[9].childNodes[0])
				imOriglng = comments[i].childNodes[9].childNodes[0].nodeValue;
		}

		var imArchived = "";
		if (comments[i].childNodes[10]) {
			if (comments[i].childNodes[10].childNodes[0])
				imArchived = comments[i].childNodes[10].childNodes[0].nodeValue;
		}
		// log('debug', "importing: " + imID + ":" + imCode + ":" + imName + ":"
		// + imContent + ":" + imSave + ":" + imState + ":" + imLat + ":"
		// + imLng + ":" + imOriglat + ":" + imOriglng + ":" + imArchived);

		var existing = doLoadCommentFromGUID(imID);
		if (existing != null) {
			if ((existing.saveTime != null) && (existing.saveTime >= imSave)) {
				resultNotImported = resultNotImported
						+ "<a target='blank' href='http://www.geocaching.com/seek/cache_details.aspx?guid="
						+ imID + "'>" + imName + " (" + imCode + ")</a>, ";
				notImportedCount++;
			} else {
				var importTooltip = createImportComment(imContent, imLat, imLng, imState, imArchived);
				var oldTooltip = createImportComment(existing.commentValue, existing.lat, existing.lng,
						existing.state, existing.archived);
				resultImported = resultImported
						+ "<li><a target='blank' href='http://www.geocaching.com/seek/cache_details.aspx?guid="
						+ imID
						+ "'>"
						+ imName
						+ " ("
						+ imCode
						+ ")</a>. "
						+ lang.tmpl_import_replace.replace("{{oldTooltipBase64}}", Base64.encode(oldTooltip))
								.replace("{{oldTooltip}}", encodeURIComponent(oldTooltip)).replace(
										"{{importTooltipBase64", Base64.encode(importTooltip)).replace(
										"{{importTooltip}}", encodeURIComponent(importTooltip)) +
						// "Replacing the <a target='blank'
						// href='data:text/html;base64," +
						// Base64.encode(oldTooltip)
						// + "' class='gcccomment' data-gcccom='" +
						// encodeURIComponent(oldTooltip)
						// + "'>old comment</a> with a <a target='blank'
						// href='data:text/html;base64,"
						// + Base64.encode(importTooltip) + "' class='gcccomment'
						// data-gcccom='"
						// + encodeURIComponent(importTooltip) + "'>new comment</a>." +
						"</li>";
				importedCount++;
				doSaveCommentWTimeToGUID(imID, imCode, imName, imContent, imSave, imState, imLat, imLng,
						imOriglat, imOriglng, imArchived);
			}
		} else {
			doSaveCommentWTimeToGUID(imID, imCode, imName, imContent, imSave, imState, imLat, imLng,
					imOriglat, imOriglng, imArchived);
			var importTooltip = createImportComment(imContent, imLat, imLng, imState, imArchived);
			resultImported = resultImported
					+ "<li><a target='blank' href='http://www.geocaching.com/seek/cache_details.aspx?guid="
					+ imID
					+ "'>"
					+ imName
					+ " ("
					+ imCode
					+ ")</a>."
					+ lang.tmpl_import_save.replace("{{importTooltipBase64}}", Base64.encode(importTooltip))
							.replace("{{importTooltip}}", encodeURIComponent(importTooltip)) + "</li>";
			importedCount++;
		}
	}
	var nil = resultNotImported.length;
	importresult.innerHTML = "<h4>" + lang.import_resultimported + " (" + importedCount + ")</h4>"
			+ resultImported + "</ul><h4>" + lang.import_resultnotimported + " (" + notImportedCount
			+ ")</h4>" + resultNotImported.substring(0, nil - 2);
	importresult.style.display = 'inline';

	$('.gcccomment').hover(function(event) {
		var comment = decodeURIComponent($(event.target).data('gcccom')).replace(/\n/g, "<br/>");
		unsafeWindow.tooltip.show(comment, 400);
	}, function(event) {
		unsafeWindow.tooltip.hide();
	});

	GM_setValue(LAST_IMPORT, "" + (new Date() - 0));
}

function createImportComment(comment, lat, lng, state, archived) {
	var commentTooltip = "";
	if (lat && lng) {
		commentTooltip = commentTooltip + "<strong>" + lang.myfinalcoords + "</strong><br/>"
				+ convertDec2DMS(lat, lng) + "<br/><br/>";
	}
	commentTooltip = commentTooltip + "<strong>" + lang.mycomment + " (" + state + ", " + archived
			+ ")</strong><br/>" + comment.replace(/\n/g, '<br/>');

	return commentTooltip;
}

// ***
// *** server functions
// ***
function loadFromServer() {
	serverImportLink.parentNode.insertBefore(waitingTag, serverImportLink);
	waitingTag.style.display = "inline";
	waitingTag.setAttribute('src', waitingGif);

	GM_xmlhttpRequest( {
		method : 'POST',
		url : "http://" + GM_getValue("gccServer") + ":18080/GCComment-ServerServlet/GCCommentServlet",
		data : xmlversion + "<gccommentmessage id='gccomment' method='load' uuid='"
				+ GM_getValue("gccUUID") + "' username='" + escapeXML(getUserName()) + "' />",
		onload : function(responseDetails) {
			performedLoad(responseDetails.responseText);
		},
		onerror : function(responseDetails) {
			syncerror(responseDetails.responseText);
		}
	});
}

function performedLoad(response) {
	waitingTag.setAttribute('src', successIcon);
	importText.value = response;

	setTimeout(function() {
		unsafeWindow.$("#waiting").fadeOut('slow', function() {
		});
	}, 3000);
}

function syncerror(answer) {
	waitingTag.setAttribute("src", errorIcon);
	listener = function() {
		unsafeWindow.tooltip.show("<strong>" + lang.actionfailed + "</strong><br>" + answer, 200);
	};
	waitingTag.addEventListener('mouseover', listener, false);
	waitingTag.setAttribute('onmouseout', 'tooltip.hide();');
	waitingTag.addEventListener('mouseup', function() {
		waitingTag.style.display = "none";
	}, false);
}

function storeToServer() {
	serverExportLink.parentNode.insertBefore(waitingTag, serverExportLink);
	waitingTag.style.display = "inline";
	waitingTag.setAttribute('src', waitingGif);
	waitingTag.removeEventListener('mouseover', listener, false);

	var dataString = encodeURIComponent(xmlversion
			+ "<gccommentmessage id='gccomment' method='store' uuid='" + GM_getValue("gccUUID")
			+ "' username='" + escapeXML(getUserName()) + "'>" + buildGCCExportString(false)
			+ "</gccommentmessage>");
	log('debug', 'Data string size: ' + dataString.length);
	// log('debug', 'Data string content: ' + dataString);

	GM_xmlhttpRequest( {
		method : 'POST',
		url : "http://" + GM_getValue("gccServer") + ":18080/GCComment-ServerServlet/GCCommentServlet",
		data : dataString,
		headers : {
			"Content-Type" : "application/x-www-form-urlencoded"
		},
		onload : function(responseDetails) {
			performedSave(responseDetails.responseText);
		},
		onerror : function(responseDetails) {
			syncerror(responseDetails.responseText);
		}
	});
	log("info", "request sent");
}

function performedSave(response) {
	log("info", "save response: " + response);
	var parser = new DOMParser();
	var xmlDoc = parser.parseFromString(response, "text/xml");
	var response = xmlDoc.getElementsByTagName('response');
	if (response.length > 0) {
		var msg = response[0].getAttribute('msg');
		if (msg != 'storing successful') {
			waitingTag.setAttribute("src", errorIcon);
			// waitingTag.setTitle(msg);
			waitingTag.addEventListener('mouseover', function(evt) {
				unsafeWindow.tooltip.show("<b>" + lang.export_toServer_result + ":</b><br/>" + msg, 200);
			}, false);
			waitingTag.setAttribute('onmouseout', 'tooltip.hide();');
		} else {
			waitingTag.setAttribute("src", successIcon);
			setTimeout(function() {
				unsafeWindow.$("#waiting").fadeOut('slow', function() {
				});
			}, 5000);
		}
	} else {
		waitingTag.setAttribute("src", successIcon);
		setTimeout(function() {
			unsafeWindow.$("#waiting").fadeOut('slow', function() {
			});
		}, 5000);
	}
}

function getUserName() {
	var logout = document.getElementById('ctl00_ContentBody_WidgetMiniProfile1_LoggedInPanel');
	var username;
	if (logout) {
		username = logout.parentNode.getElementsByTagName('span')[0].firstChild.nodeValue;
		GM_setValue("GCCUSER", username);
	} else {
		username = GM_getValue('GCCUSER');
	}
	return username;
}

var originalGPX = "";
// Original idea from Schatzj�ger2
function sendToGPS() {
	setTimeout(function() {
		var gpxTextArea = document.getElementById('dataString');
		// gpxTextArea.parentNode.setAttribute('style', "");
			var gpx = gpxTextArea.value;
			originalGPX = gpx;
			var anfang = gpx.indexOf('guid=');
			var laenge = 'a5493497-70a7-4e07-946c-6d79c7a59994'.length + 5;
			var currentCacheGUID = gpx.substring(anfang + 5, anfang + laenge);
			currentComment = doLoadCommentFromGUID(currentCacheGUID);
			if (currentComment
					&& (currentComment.commentValue || (currentComment.lat && currentComment.lng))) {
				// build special config
				var writebox = document.getElementById('writeBox');
				var configdiv = document.createElement('div');
				configdiv.setAttribute('style', 'outline:1px solid grey;margin-bottom:5px');
				var configlabel = document.createElement('p');
				configlabel.appendChild(document.createTextNode(lang.savegpx_explain));
				configdiv.appendChild(configlabel);

				// add your comment
				var addComment = document.createElement('input');
				addComment.setAttribute('id', 'addComment');
				addComment.setAttribute('type', 'checkbox');
				addComment.setAttribute('class', 'Checkbox');
				addComment.addEventListener('click', function() {
					var state = addComment.getAttribute('checked');
					if (state)
						addComment.removeAttribute('checked');
					else
						addComment.setAttribute('checked', 'checked');
					GM_setValue(ADDCOMMENTSETTING, state ? 0 : 1);
					patchGarminGPX();
				}, false);
				configdiv.appendChild(addComment);

				var addCommentSetting = GM_getValue(ADDCOMMENTSETTING);
				if (addCommentSetting == 1)
					addComment.setAttribute('checked', 'checked');

				var addCommentLabel = document.createElement('label');
				addCommentLabel.setAttribute('for', 'addComment');
				addCommentLabel.appendChild(document.createTextNode(lang.savegpx_addgcc));
				configdiv.appendChild(addCommentLabel);

				var addCommentSetting = GM_getValue(ADDCOMMENTSETTING);
				if (addCommentSetting == 1)
					addComment.setAttribute('checked', 'checked');
				configdiv.appendChild(document.createElement('br'));

				// change Original
				var changeOriginal = document.createElement('input');
				changeOriginal.setAttribute('id', 'changeOriginal');
				changeOriginal.setAttribute('type', 'checkbox');
				changeOriginal.setAttribute('class', 'Checkbox');
				changeOriginal.addEventListener('click', function() {
					var state = changeOriginal.getAttribute('checked');
					if (state)
						changeOriginal.removeAttribute('checked');
					else
						changeOriginal.setAttribute('checked', 'checked');
					GM_setValue(CHANGEORIGINALSETTING, state ? 0 : 1);
					patchGarminGPX();
				}, false);
				configdiv.appendChild(changeOriginal);

				var changeOrigSetting = GM_getValue(CHANGEORIGINALSETTING);
				if (changeOrigSetting == 1)
					changeOriginal.setAttribute('checked', 'checked');

				var changeOriginalLabel = document.createElement('label');
				changeOriginalLabel.setAttribute('for', 'changeOriginal');
				changeOriginalLabel.appendChild(document.createTextNode(lang.savegpx_changeorig));
				configdiv.appendChild(changeOriginalLabel);

				var changeOrigSetting = GM_getValue(CHANGEORIGINALSETTING);
				if (changeOrigSetting == 1)
					changeOriginal.setAttribute('checked', 'checked');
				configdiv.appendChild(document.createElement('br'));

				if (!currentComment.lat && !currentComment.lng) {
					changeOriginal.setAttribute('disabled', '');
				}

				// add waypoint
				var addWaypoint = document.createElement('input');
				addWaypoint.setAttribute('id', 'addWaypoint');
				addWaypoint.setAttribute('type', 'checkbox');
				addWaypoint.setAttribute('class', 'Checkbox');
				addWaypoint.addEventListener('click', function() {
					var state = addWaypoint.getAttribute('checked');
					if (state)
						addWaypoint.removeAttribute('checked');
					else
						addWaypoint.setAttribute('checked', 'checked');
					GM_setValue(ADDWAYPOINTSETTING, state ? 0 : 1);
					patchGarminGPX();
				}, false);
				configdiv.appendChild(addWaypoint);

				var addWaypointLabel = document.createElement('label');
				addWaypointLabel.setAttribute('for', 'addWaypoint');
				addWaypointLabel.appendChild(document.createTextNode(lang.savegpx_addfinal));
				configdiv.appendChild(addWaypointLabel);

				var addWaypointSetting = GM_getValue(ADDWAYPOINTSETTING);
				if (addWaypointSetting == 1)
					addWaypoint.setAttribute('checked', 'checked');
				configdiv.appendChild(document.createElement('br'));

				if (!currentComment.lat && !currentComment.lng) {
					addWaypoint.setAttribute('disabled', '');
				}

				writebox.parentNode.insertBefore(configdiv, writebox);
				patchGarminGPX();
				window.resizeTo(450, 550);
			}
		}, 500);
}

function buildGPXWPT(commentObject) {
	var newwpt = "<wpt lat='" + commentObject.lat + "' lon='" + commentObject.lng + "'>"
			+ "    <time>" + isoTime(commentObject.saveTime) + "</time>" + "    <name>"
			+ commentObject.gccode + "</name>" + "    <cmt>GCComment: " + commentObject.commentValue
			+ "</cmt>" + "    <desc>" + lang.gpxexportwpttitle + "</desc>"
			+ "    <url>http://www.geocaching.com/seek/cache_details.aspx?guid=" + commentObject.guid
			+ "</url>" + "    <urlname>GCComment Final</urlname>" + "    <sym>Final Location</sym>"
			// alternativ
			// <sym>Flag,
			// Green</sym>
			// gr�ne
			// fahne
			// oder
			// <sym>Civil</sym>
			// goldene
			// fahne mit
			// stern
			+ "    <type>Waypoint|Final Location</type>" + "   </wpt>";
	return newwpt;
}

function patchGarminGPX() {
	var gpxTextArea = document.getElementById('dataString');
	var newGPX = originalGPX;
	var positioncomment = originalGPX.indexOf('</groundspeak:long_description>');
	if (currentComment.commentValue && (GM_getValue(ADDCOMMENTSETTING) == 1)) {
		newGPX = originalGPX.substring(0, positioncomment)
				+ "\n&lt;br /&gt;\n&lt;br /&gt;\nGCComment:\n&lt;br /&gt;\n" + currentComment.commentValue
				+ "&lt;br /&gt;\n" + originalGPX.substring(positioncomment, originalGPX.length);
	}

	if (currentComment.lat && currentComment.lng) {
		if (GM_getValue(CHANGEORIGINALSETTING) == 1) {
			var latstart = newGPX.indexOf('<wpt lat=\"') + 10;
			var latstop = newGPX.indexOf('\"', latstart) + 1;
			newGPX = newGPX.substring(0, latstart) + currentComment.lat
					+ newGPX.substring(latstop - 1, newGPX.length);

			var lngstart = newGPX.indexOf('\" lon=\"') + 7;
			var lngstop = newGPX.indexOf('\"', lngstart) + 1;
			newGPX = newGPX.substring(0, lngstart) + currentComment.lng
					+ newGPX.substring(lngstop - 1, newGPX.length);
		}

		if (GM_getValue(ADDWAYPOINTSETTING) == 1) {
			var newwpt = buildGPXWPT(currentComment);
			var endindex = newGPX.indexOf('</gpx>');
			newGPX = newGPX.substring(0, endindex) + newwpt + newGPX.substring(endindex, newGPX.length);
		}
	}
	// set text area
	gpxTextArea.value = newGPX;

	// set text child of text area
	gpxTextArea.replaceChild(document.createTextNode(newGPX), gpxTextArea.firstChild);
}

function isoTime(time) {
	var saved = null;
	if (typeof time === "object")
		saved = time;
	else
		saved = new Date(parseInt(time));
	// saved.setTime(time);
	var result = saved.getFullYear() + "-"
			+ ((saved.getMonth() < 9) ? "0" + (saved.getMonth() + 1) : (saved.getMonth() + 1)) + "-"
			+ ((saved.getDate() < 9) ? "0" + saved.getDate() : saved.getDate()) + "T"
			+ ((saved.getHours() < 9) ? "0" + saved.getHours() : saved.getHours()) + ":"
			+ ((saved.getMinutes() < 9) ? "0" + saved.getMinutes() : saved.getMinutes()) + ":"
			+ ((saved.getSeconds() < 9) ? "0" + saved.getSeconds() : saved.getSeconds()) + "."
			+ ((saved.getMilliseconds() < 9) ? "0" + saved.getMilliseconds() : saved.getMilliseconds());
	return result;
}

// ***
// *** helper functions
// ***
function trim(zeichenkette) {
	return zeichenkette.replace(/^\s+/, '').replace(/\s+$/, '');
}

function escapeXML(unescaped) {
	var result = unescaped.replace(/&/g, "&amp;");
	result = result.replace(/>/g, "&gt;");
	result = result.replace(/</g, "&lt;");
	result = result.replace(/"/g, "&quot;");
	result = result.replace(/'/g, "&apos;");

	// zeilenumbr�che escapen
	// result = result.replace(/\n/g, "&#10;");

	return result;
}

function unescapeXML(escaped) {
	var result = escaped.replace(/&gt;/g, ">");
	result = result.replace(/&lt;/g, "<");
	result = result.replace(/&quot;/g, "\"");
	result = result.replace(/&amp;/g, "&");
	result = result.replace(/&apos;/g, "'");
	// result = result.replace(/&#10;/g, "\n");
	return result;
}

function updateAvailable(serverVersion) {
	GM_xmlhttpRequest( {
		method : 'GET',
		header : {
			'Cache-Control' : 'max-age=3600, must-revalidate'
		},
		url : updatechangesurl,
		onload : function(responseDetails) {
			handleChangesReply(responseDetails.responseText);
		},
		onerror : function(responseDetails) {
			log("info", "Unable to get changes from Sourceforge! Errorcode " + responseDetails.status);
		}
	});

	log("info", "current version: " + version + " latest version: " + serverVersion);
	var updateInfo = document.createElement('div');
	updateInfo.setAttribute('id', 'gccupdateinfo');
	var updatelnk = document.createElement('a');
	updatelnk.setAttribute('href', 'http://userscripts.org/scripts/source/75959.user.js');
	updatelnk.innerHTML = lang.update_clickToUpdate;
	updateInfo.appendChild(document.createTextNode(lang.tmpl_update.replace("{{serverVersion}}",
			serverVersion).replace("{{version}}", version)));
	updateInfo.appendChild(updatelnk);
	updateInfo.appendChild(document.createElement('br'));
	updateInfo.appendChild(document.createElement('br'));
	gccRoot.insertBefore(updateInfo, gccRoot.firstChild);
}

function handleChangesReply(xmlString) {
	var updateInfo = document.getElementById('gccupdateinfo');
	var parser = new DOMParser();
	var xmlDoc = parser.parseFromString(xmlString, "text/xml");
	var changes = xmlDoc.getElementsByTagName("change");
	if (changes) {
		for ( var chindex = 0; chindex < changes.length; chindex++) {
			var change = changes[chindex];
			var vversion, date, content;
			for ( var elems = 0; elems < change.childNodes.length; elems++) {
				var elem = change.childNodes[elems];
				if (elem.nodeName == "version")
					vversion = elem.firstChild.nodeValue;
				else if (elem.nodeName == "date")
					date = elem.firstChild.nodeValue;
				else if (elem.nodeName == "content")
					content = elem.firstChild.nodeValue;
			}
			if (vversion <= version)
				break;
			updateInfo.appendChild(document.createTextNode(lang.update_changes + vversion + " (" + date
					+ ")"));
			updateInfo.appendChild(document.createElement('br'));

			var divv = document.createElement('div');
			divv.innerHTML = content;
			updateInfo.appendChild(divv);
		}

		updateInfo.appendChild(document.createElement('br'));
	}
}

function checkforupdates() {
	var updateDate = new Date(Date.parse(GM_getValue('updateDate')));
	if (!updateDate) {
		updateDate = new Date();
		GM_setValue('updateDate', updateDate.toString());
	}
	var currentDate = new Date();

	// in ms. equals 1 day
	if (currentDate - updateDate > 86400000) {

		GM_xmlhttpRequest( {
			method : 'GET',
			header : {
				'Cache-Control' : 'max-age=3600, must-revalidate'
			},
			url : updateurl,
			onload : function(responseDetails) {
				// handleChangesReply(responseDetails.responseText);
				var content = responseDetails.responseText;
				var parseResult = /@version\s+([.\d]+)[\r\n]/.exec(content);
				if (parseResult) {
					var serverVersion = parseInt(parseResult[1]);
					log('info', 'updatecheck: installed version=' + version + ", server version="
							+ serverVersion);
					if (serverVersion > version)
						updateAvailable(serverVersion);
				}
			},
			onerror : function(responseDetails) {
				log("info", "Unable to get version from Userscripts.org! Errorcode "
						+ responseDetails.status);
			}
		});

		GM_setValue('updateDate', currentDate.toString());
	}
}

// helper detailpage: macht aus dem Time-Long eine lesbare Zeitangabe
function createTimeString(time, simple) {
	if (time < 0)
		return lang.never;
	else {
		var lastSave = null;
		if (typeof time === "object")
			lastSave = time;
		else
			lastSave = new Date(parseInt(time));
		// lastSave.setTime(time);
		var month = lastSave.getMonth() + 1;
		var day = lastSave.getDate();
		var hour = lastSave.getHours();
		var minute = lastSave.getMinutes();
		var sec = lastSave.getSeconds();
		if (month < 10)
			month = "0" + month;
		if (day < 10)
			day = "0" + day;
		if (hour < 10)
			hour = "0" + hour;
		if (minute < 10)
			minute = "0" + minute;
		if (sec < 10)
			sec = "0" + sec;

		if (simple)
			return lastSave.getFullYear() + "-" + month + "-" + day;
		else
			return lastSave.getFullYear() + "-" + month + "-" + day + " " + hour + ":" + minute + ":"
					+ sec;
	}
}

function appendScript(type, script, context) {
	var element = document.createElement('script');
	element.setAttribute('type', 'text/javascript');
	if (type == 'src') {
		element.setAttribute('src', script);
	} else if (type == 'text') {
		element.textContent = script;
	}
	context = context || document;
	context.getElementsByTagName('head')[0].appendChild(element);
	return element;
}

function appendCSS(type, css, context) {
	var element = document.createElement('style');
	element.setAttribute('type', 'text/css');
	if (type == 'src') {
		element.setAttribute('src', css);
	} else if (type == 'text') {
		element.textContent = css;
	}
	context = context || document;
	context.getElementsByTagName('head')[0].appendChild(element);
	return element;
}

function getNumberOfComments() {
	var keys = GM_listValues();
	var counter = 0;
	for ( var ind = 0; ind < keys.length; ind++) {
		var commentKey = keys[ind];
		if (commentKey.indexOf(COMPREFIX) > -1)
			counter++;
	}
	return counter;
}

function addEvent(obj, type, fn) {
	if (obj.addEventListener)
		obj.addEventListener(type, fn, false);
	else if (obj.attachEvent)
		obj.attachEvent('on' + type, function() {
			return fn.apply(obj, new Array(window.event));
		});
}

function log(level, text) {
	GM_log(level + ": " + text);
}

function getGUIDFromGCCode(gcCode) {
	var value = GM_getValue(COMGCPREFIX + gcCode);
	if (value)
		return value;
	// else
	// log('info', 'no GUID for GCCode ' + gcCode + ' saved. ');
}

function convertDec2DMS(lt, lg) {
	var lat = lt;
	var lng = lg;
	var result = "";
	if (lat < 0) {
		result = result + "S ";
		lat = lat * -1;
	} else
		result = result + "N ";

	if ((lat < 10) && (lat > -10))
		result = result + "0";
	result = result + parseInt(lat) + String.fromCharCode(176) + " ";
	lat = lat - parseInt(lat);
	var latFormatted = (Math.round(parseFloat(lat * 60) * 1000) / 1000).toFixed(3);
	if ((latFormatted < 10) && (latFormatted > -10))
		result = result + "0";
	result = result + latFormatted + " ";

	if (lng < 0) {
		result = result + " W ";
		lng = lng * -1;
	} else
		result = result + " E ";

	if ((lng < 10) && (lng > -10))
		result = result + "00";
	else if ((lng < 100) && (lng > -100))
		result = result + "0";

	result = result + parseInt(lng) + String.fromCharCode(176) + " ";
	lng = lng - parseInt(lng);
	var lngFormatted = (Math.round(parseFloat(lng * 60) * 1000) / 1000).toFixed(3);
	if ((lngFormatted < 10) && (lngFormatted > -10))
		result = result + "0";
	result = result + lngFormatted;

	return result;
}

function parseCoordinates(cstr) {
	var regexDegMin = /([NS])\s*(\d+)\D\s*(\d+\.\d+)'*\s*([EW])\s*(\d+)\D\s*(\d+\.\d+)'*/i;

	var fin = new Array();
	var items = regexDegMin.exec(cstr);
	if ((items != null) && (items.length == 7)) {
		log("info", "parsing successful DegMin: " + items);
		var lat1 = RegExp.$2;
		while (lat1.indexOf(0) == 0) {
			lat1 = lat1.substring(1, lat1.length);
		}
		if (lat1.length == 0)
			lat1 = 0;

		var lat2 = RegExp.$3;
		var lat = parseInt(lat1) + parseFloat(lat2) / 60;
		if (RegExp.$1 == "S")
			lat = lat * -1;

		var lng1 = RegExp.$5;
		while (lng1.indexOf(0) == 0) {
			lng1 = lng1.substring(1, lng1.length);
		}
		if (lng1.length == 0)
			lng1 = 0;
		var lng2 = RegExp.$6;
		var lng = parseInt(lng1) + parseFloat(lng2) / 60;
		if (RegExp.$4 == "W")
			lng = lng * -1;

		fin.push(lat);
		fin.push(lng);
		return fin;
	}

	var regexPlain = /(\d+)\s+(\d+\.\d+)\s+(\d+)\s+(\d+\.\d+)/i;
	items = regexPlain.exec(cstr);
	if ((items != null) && (items.length == 5)) {
		log("info", "parsing successful Plain: " + items);
		var lat1 = RegExp.$1;
		while (lat1.indexOf(0) == 0) {
			lat1 = lat1.substring(1, lat1.length);
		}
		if (lat1.length == 0)
			lat1 = 0;

		var lat2 = RegExp.$2;
		var lat = parseInt(lat1) + parseFloat(lat2) / 60;

		var lng1 = RegExp.$3;
		while (lng1.indexOf(0) == 0) {
			lng1 = lng1.substring(1, lng1.length);
		}
		if (lng1.length == 0)
			lng1 = 0;
		var lng2 = RegExp.$4;
		var lng = parseInt(lng1) + parseFloat(lng2) / 60;
		fin.push(lat);
		fin.push(lng);
		return fin;
	}

	var regexDec = /(\d+\.\d+)(,\s*|\s+)(\d+\.\d+)/i;
	items = regexDec.exec(cstr);
	if ((items != null) && (items.length == 4)) {
		log("info", "parsing successful Dec: " + items);
		var lat1 = RegExp.$1;
		while (lat1.indexOf(0) == 0) {
			lat1 = lat1.substring(1, lat1.length);
		}
		if (lat1.length == 0)
			lat1 = 0;

		var lat = parseFloat(lat1);

		var lng1 = RegExp.$3;
		while (lng1.indexOf(0) == 0) {
			lng1 = lng1.substring(1, lng1.length);
		}
		if (lng1.length == 0)
			lng1 = 0;
		var lng = parseFloat(lng1);
		fin.push(lat);
		fin.push(lng);
		return fin;
	}

	fin.push(lang.alert_coordsnotvalid);
	return fin;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
	if (typeof (Number.prototype.toRad) === "undefined") {
		Number.prototype.toRad = function() {
			return this * Math.PI / 180;
		};
	}
	var R = 6371; // km
	var lat1dec = parseFloat(lat1);
	var lon1dec = parseFloat(lon1);
	var lat2dec = parseFloat(lat2);
	var lon2dec = parseFloat(lon2);
	var dLat = (lat2dec - lat1dec).toRad();
	var dLon = (lon2dec - lon1dec).toRad();
	var lat1 = lat1dec.toRad();
	var lat2 = lat2dec.toRad();

	var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.sin(dLon / 2) * Math.sin(dLon / 2)
			* Math.cos(lat1) * Math.cos(lat2);
	var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	var d = R * c;
	return d;
}

function appendCheckBox(parentNode, id, label, extrafunction) {
	var checkboxdiv = document.createElement('div');
	checkboxdiv.setAttribute('id', 'div' + id);
	var currentValue = GM_getValue(id);
	// log('debug', 'cv: ' + currentValue);
	if ((currentValue == undefined) || (currentValue == null) || (currentValue == "undefined"))
		GM_setValue(id, false);
	var checkbox = document.createElement('input');
	checkbox.setAttribute('type', 'checkbox');
	checkbox.setAttribute('id', id);
	checkbox.setAttribute('class', 'Checkbox');
	checkbox.setAttribute('style', 'margin:3px');
	checkbox.addEventListener('mouseup', function() {
		var oldValue = GM_getValue(id);
		GM_setValue(id, !oldValue);
	}, false);

	var checked = GM_getValue(id);
	if (checked) {
		checkbox.setAttribute('checked', 'checked');
	}
	checkboxdiv.appendChild(checkbox);

	if (label) {
		var newLabel = document.createElement('label');
		newLabel.setAttribute('for', id);
		newLabel.appendChild(document.createTextNode(label));
		checkboxdiv.appendChild(newLabel);
		newLabel.addEventListener('mouseup', function() {
			if (!checkbox.getAttribute('disabled')) {
				var oldValue = GM_getValue(id);
				GM_setValue(id, !oldValue);
			}
		}, false);
	}

	if (extrafunction) {
		checkbox.addEventListener('mouseup', extrafunction);
		newLabel.addEventListener('mouseup', extrafunction);
	}

	parentNode.appendChild(checkboxdiv);
	return checkboxdiv;
}

/**
 * Base64 encode / decode http://www.webtoolkit.info/
 */
var Base64 = {

	// private property
	_keyStr : "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",

	// public method for encoding
	encode : function(input) {
		var output = "";
		var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
		var i = 0;

		input = Base64._utf8_encode(input);

		while (i < input.length) {

			chr1 = input.charCodeAt(i++);
			chr2 = input.charCodeAt(i++);
			chr3 = input.charCodeAt(i++);

			enc1 = chr1 >> 2;
			enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
			enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
			enc4 = chr3 & 63;

			if (isNaN(chr2)) {
				enc3 = enc4 = 64;
			} else if (isNaN(chr3)) {
				enc4 = 64;
			}

			output = output + this._keyStr.charAt(enc1) + this._keyStr.charAt(enc2)
					+ this._keyStr.charAt(enc3) + this._keyStr.charAt(enc4);

		}

		return output;
	},

	// public method for decoding
	decode : function(input) {
		var output = "";
		var chr1, chr2, chr3;
		var enc1, enc2, enc3, enc4;
		var i = 0;

		input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");

		while (i < input.length) {

			enc1 = this._keyStr.indexOf(input.charAt(i++));
			enc2 = this._keyStr.indexOf(input.charAt(i++));
			enc3 = this._keyStr.indexOf(input.charAt(i++));
			enc4 = this._keyStr.indexOf(input.charAt(i++));

			chr1 = (enc1 << 2) | (enc2 >> 4);
			chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
			chr3 = ((enc3 & 3) << 6) | enc4;

			output = output + String.fromCharCode(chr1);

			if (enc3 != 64) {
				output = output + String.fromCharCode(chr2);
			}
			if (enc4 != 64) {
				output = output + String.fromCharCode(chr3);
			}

		}

		output = Base64._utf8_decode(output);

		return output;

	},

	// private method for UTF-8 encoding
	_utf8_encode : function(string) {
		string = string.replace(/\r\n/g, "\n");
		var utftext = "";

		for ( var n = 0; n < string.length; n++) {

			var c = string.charCodeAt(n);

			if (c < 128) {
				utftext += String.fromCharCode(c);
			} else if ((c > 127) && (c < 2048)) {
				utftext += String.fromCharCode((c >> 6) | 192);
				utftext += String.fromCharCode((c & 63) | 128);
			} else {
				utftext += String.fromCharCode((c >> 12) | 224);
				utftext += String.fromCharCode(((c >> 6) & 63) | 128);
				utftext += String.fromCharCode((c & 63) | 128);
			}

		}

		return utftext;
	},

	// private method for UTF-8 decoding
	_utf8_decode : function(utftext) {
		var string = "";
		var i = 0;
		var c = c1 = c2 = 0;

		while (i < utftext.length) {

			c = utftext.charCodeAt(i);

			if (c < 128) {
				string += String.fromCharCode(c);
				i++;
			} else if ((c > 191) && (c < 224)) {
				c2 = utftext.charCodeAt(i + 1);
				string += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
				i += 2;
			} else {
				c2 = utftext.charCodeAt(i + 1);
				c3 = utftext.charCodeAt(i + 2);
				string += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
				i += 3;
			}

		}

		return string;
	}
};

function openDownloadWindow(content, title, mimetype) {
	var c = Base64.encode(content);
	window.open("data:" + mimetype + ";base64," + c, title, "width=300,height=400,left=100,top=200");
}

function GC2DBId(gcCode) {
	var gcId = 0;

	var sequence = "0123456789ABCDEFGHJKMNPQRTVWXYZ";

	var rightPart = gcCode.substring(2).toUpperCase();

	var base = 31;
	if ((rightPart.length < 4)
			|| ((rightPart.length == 4) && (sequence.indexOf(rightPart.charAt(0)) < 16))) {
		base = 16;
	}

	for ( var p = 0; p < rightPart.length; p++) {
		gcId *= base;
		gcId += sequence.indexOf(rightPart.charAt(p));
	}

	if (base == 31) {
		gcId += Math.pow(16, 4) - 16 * Math.pow(31, 3);
	}
	return gcId;
}

function DBId2GCNew(newGcId) {
	var gcNewCode = "";
	var sequence = "tHpXJR8gyfzCrdV5G0Kb3Y92N47lTBPAhWnvLZkaexmSwq6sojDcEQMFO";

	var base = 57;

	var rest = 0;
	var divResult = newGcId;

	do {
		rest = divResult % base;
		divResult = Math.floor(divResult / base);
		gcNewCode = sequence.charAt(rest) + gcNewCode;
	} while (divResult != 0);

	return gcNewCode;
}

if (typeof (opera) != "undefined") {
	// Opera detected
	browser = "Opera";

	// Start the mainpart, if the site is loaded
	window.addEventListener('DOMContentLoaded', main, true);
} else {
	browser = "FireFox";
	main();
}

//
//
// filling lots of end content so that it works in opera
// filling lots of end content so that it works in opera
// filling lots of end content so that it works in opera
//