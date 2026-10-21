/*
  Web push worker (founder, 15 Oct 2026). Hand-written, no library.

  Registered at scope "/" only when web push is configured and someone turns
  it on (src/features/webPush). SEPARATE from /offline-sw.js, which keeps its
  own scope (/posttube/offline): this worker has no fetch handler and no
  cache, so it changes nothing about how any page loads.

  It needs no configuration. notification-service sends through FCM HTTP v1
  (internal/push/fcm.go): a `notification` block { title, body } and a `data`
  map (type, deep_link, icon, priority, sometimes title/body/collapse_key).
  FCM delivers that JSON to this worker as the push message's data.

  push               shows the notification (title/body from the payload).
  notificationclick  focuses or opens the deep link — same-origin paths only.
                     Anything else (another site, momentum:// app links,
                     javascript:, protocol-relative //host) is ignored and
                     the app's home is focused or opened instead.
*/

"use strict";

var FALLBACK_TITLE = "New notification";
var ICON = "/favicon.ico";

function text(v) {
  return typeof v === "string" ? v.trim() : "";
}

/** A same-origin path ("/x?y#z") for `link`, or null. */
function sameOriginPath(link, origin) {
  var s = text(link);
  if (!s) return null;
  var url;
  try {
    url = new URL(s, origin);
  } catch (e) {
    return null;
  }
  if (url.origin !== origin) return null;
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  return url.pathname + url.search + url.hash;
}

function readPayload(data) {
  if (!data) return {};
  try {
    var json = data.json();
    return json && typeof json === "object" ? json : {};
  } catch (e) {
    try {
      return { notification: { body: data.text() } };
    } catch (e2) {
      return {};
    }
  }
}

function notificationFor(payload, origin) {
  var n = payload.notification && typeof payload.notification === "object" ? payload.notification : {};
  var d = payload.data && typeof payload.data === "object" ? payload.data : {};
  var fcm = payload.fcmOptions && typeof payload.fcmOptions === "object" ? payload.fcmOptions : {};
  var title = text(n.title) || text(d.title) || FALLBACK_TITLE;
  var options = {
    body: text(n.body) || text(d.body),
    icon: ICON,
    data: { path: sameOriginPath(d.deep_link || d.link || fcm.link || n.click_action, origin) },
  };
  var tag = text(d.collapse_key) || text(payload.collapse_key);
  if (tag) options.tag = tag;
  return { title: title, options: options };
}

self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", function (event) {
  var shown = notificationFor(readPayload(event.data), self.location.origin);
  event.waitUntil(self.registration.showNotification(shown.title, shown.options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var origin = self.location.origin;
  // Checked again here: whatever was stored, only a same-origin path is followed.
  var path = sameOriginPath(event.notification.data && event.notification.data.path, origin);
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (windows) {
      var target = path ? origin + path : null;
      for (var i = 0; i < windows.length; i++) {
        var w = windows[i];
        if (target ? w.url === target : new URL(w.url).origin === origin) {
          if ("focus" in w) return w.focus();
        }
      }
      // A new window rather than navigating an open one away from unsaved work.
      return self.clients.openWindow(path || "/");
    })
  );
});
