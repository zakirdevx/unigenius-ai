// Registers the service worker (needed for the "Install app" button in Chrome / Edge).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  });
}
