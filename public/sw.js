// Therapia service worker: shows reminder notifications, even when the site is closed.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { /* use the defaults */ }
  event.waitUntil(
    self.registration.showNotification(d.title || "Therapia", {
      body: d.body || "A group you follow starts soon.",
      tag: d.tag || "therapia-reminder",
      data: { url: d.url || "/groups" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/groups";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) if ("focus" in c) { c.navigate(url); return c.focus(); }
      return self.clients.openWindow(url);
    })
  );
});
