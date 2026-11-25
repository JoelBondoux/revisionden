/*
 * Applies this device's appearance settings (theme, colours, background pattern) before the app's
 * first paint, so there is no flash of the wrong theme. Same rules as
 * src/features/appearance/settings.ts (a test keeps them in step). No network, no cookies.
 */
(function () {
  var root = document.documentElement;
  var saved = {};
  try {
    saved = JSON.parse(window.localStorage.getItem('revisionden.appearance') || '{}') || {};
  } catch {
    saved = {};
  }
  var choice = ['system', 'light', 'dark'].indexOf(saved.theme) >= 0 ? saved.theme : 'system';
  var dark =
    choice === 'dark' ||
    (choice === 'system' &&
      !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches));
  root.dataset.theme = dark ? 'dark' : 'light';
  root.dataset.palette = saved.palette === 'colourblind' ? 'colourblind' : 'standard';
  root.dataset.pattern = saved.pattern === 'off' ? 'off' : 'on';
  if (root.style) root.style.colorScheme = dark ? 'dark' : 'light';
})();
