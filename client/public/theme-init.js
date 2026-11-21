// Runs before React loads: applies the saved theme (dark by default) to avoid a white flash.
(function () {
  try {
    var saved = localStorage.getItem('unigenius.theme');
    var theme = saved === 'light' ? 'light' : 'dark';
    document.documentElement.classList.toggle('dark', theme === 'dark');
  } catch (e) {
    document.documentElement.classList.add('dark');
  }
})();
