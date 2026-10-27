/* GIGO – shared top navigation. Included as the first thing in <body> on every page; marks the current page. */
(function () {
  'use strict';
  var page = location.pathname.split('/').pop() || 'index.html';
  if (page === 'play.html') page = 'projects.html';
  var links = [['index.html', 'Overview'], ['projects.html', 'Projects'], ['learn.html', 'Learn more']];
  var html = '<header class="sitenav"><div class="sitenav-in">' +
    '<a class="logo" href="index.html" aria-label="Datamaker GIGO home"><img src="assets/logo.png" alt="" width="1065" height="234"><span class="logo-app">GIGO</span></a>' +
    '<nav aria-label="Main">' + links.map(function (l) {
      return '<a href="' + l[0] + '"' + (l[0] === page ? ' aria-current="page"' : '') + '>' + l[1] + '</a>';
    }).join('') + '</nav>' +
    '<a class="nav-cta" href="projects.html">Try a scene</a></div></header>';
  document.currentScript.insertAdjacentHTML('beforebegin', html);
})();
