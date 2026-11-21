/* Marshall Relay — shared site script: sticky nav, mobile menu, screenshot galleries, reveal on scroll, privacy contents */
(function () {
  window.MR_READY = true;
  var doc = document;
  var nav = doc.getElementById('nav');

  if (nav) {
    var onScroll = function () { nav.classList.toggle('is-scrolled', window.scrollY > 8); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    var btn = doc.getElementById('menu-btn');
    var menu = doc.getElementById('mobile-menu');
    if (btn && menu) {
      var setOpen = function (open) {
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        nav.classList.toggle('menu-open', open);
      };
      btn.addEventListener('click', function () {
        setOpen(btn.getAttribute('aria-expanded') !== 'true');
      });
      menu.addEventListener('click', function (e) {
        if (e.target.closest('a')) setOpen(false);
      });
      doc.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && nav.classList.contains('menu-open')) { setOpen(false); btn.focus(); }
      });
      window.addEventListener('resize', function () {
        if (window.innerWidth > 860) setOpen(false);
      });
    }
  }

  var years = doc.querySelectorAll('[data-year]');
  for (var i = 0; i < years.length; i++) years[i].textContent = String(new Date().getFullYear());

  /* Home page: screenshot galleries — arrows and progress bar for the native scroll-snap track */
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var galleries = doc.querySelectorAll('[data-gallery]');
  for (var g = 0; g < galleries.length; g++) initGallery(galleries[g]);

  function initGallery(root) {
    var track = root.querySelector('.gallery-track');
    var thumb = root.querySelector('.gallery-thumb');
    var prev = root.querySelector('[data-dir="-1"]');
    var next = root.querySelector('[data-dir="1"]');
    var items = track ? track.querySelectorAll('.gallery-item') : [];
    var last = items[items.length - 1];
    if (!prev || !next || !last) return;
    var smooth = reduceMotion ? 'auto' : 'smooth';
    var useEnd = 'onscrollend' in window;
    var target = null; /* where an arrow scroll is heading, so quick repeat clicks keep paging */
    var index = 0;     /* shot the gallery rests on; kept when the window is resized */
    var width = track.clientWidth;
    var touching = false;
    var tries = 0;
    var timer = 0;
    var update = function () {
      var max = track.scrollWidth - track.clientWidth;
      var x = Math.max(0, Math.min(track.scrollLeft, max));
      /* All shots visible (only the end spacer overflows): no arrows, no progress bar */
      var end = last.getBoundingClientRect().right - track.getBoundingClientRect().left + track.scrollLeft;
      var fits = end <= track.clientWidth + 2;
      if (fits && track.scrollLeft) { track.scrollLeft = 0; x = 0; }
      root.classList.toggle('is-static', fits);
      prev.disabled = x < 4;
      next.disabled = x > max - 4;
      if (thumb) {
        var ratio = Math.min(1, track.clientWidth / track.scrollWidth);
        thumb.style.width = (ratio * 100) + '%';
        thumb.style.transform = 'translateX(' + (max > 0 ? (x / max) * (1 / ratio - 1) * 100 : 0) + '%)';
      }
    };
    /* Snap point of every shot (the scroll position that lines it up with the track start) and its right edge */
    var measure = function () {
      var max = track.scrollWidth - track.clientWidth;
      var pad = parseFloat(getComputedStyle(track).scrollPaddingLeft) || 0;
      var origin = track.getBoundingClientRect().left - track.scrollLeft;
      var m = { view: track.clientWidth, snap: [], right: [] };
      for (var i = 0; i < items.length; i++) {
        var r = items[i].getBoundingClientRect();
        m.snap.push(Math.max(0, Math.min(max, Math.round(r.left - origin - pad))));
        m.right.push(r.right - origin);
      }
      return m;
    };
    var nearest = function (snap, x) {
      var k = 0;
      for (var i = 1; i < snap.length; i++) if (Math.abs(snap[i] - x) < Math.abs(snap[k] - x)) k = i;
      return k;
    };
    var scrollTo = function (x) { track.scrollTo({ left: x, behavior: smooth }); };
    /* Arrows scroll to an exact snap point: Safari does not snap smooth programmatic scrolls by itself */
    var go = function (dir) {
      var m = measure();
      var from = target !== null ? target : track.scrollLeft;
      var n = items.length;
      var to = from;
      var i, k;
      if (dir > 0) {
        for (k = 0; k + 1 < n && m.snap[k + 1] <= from + 1; k++);
        /* the first shot that is not fully visible becomes the first one */
        for (i = k + 1; i < n; i++) {
          to = m.snap[i];
          if (m.right[i] > from + m.view + 1) break;
        }
      } else {
        for (k = 0; k < n && m.snap[k] < from - 1; k++);
        /* page back until the shot before the first visible one is the last fully visible one */
        if (k > 0) {
          to = m.snap[k - 1];
          for (i = k - 2; i >= 0 && m.right[k - 1] <= m.snap[i] + m.view + 1; i--) to = m.snap[i];
        }
      }
      if (Math.abs(to - from) < 2) return;
      target = to;
      tries = 0;
      scrollTo(to);
    };
    /* Once scrolling has really stopped, make sure it rests exactly on a shot: finish an arrow move, or go to the
       nearest shot. Safari fires scrollend before its own snap animation, so wait until the position stays put. */
    var settle = function () {
      clearTimeout(timer);
      if (touching) return;
      var x0 = track.scrollLeft;
      timer = setTimeout(function () {
        if (touching || Math.abs(track.scrollLeft - x0) > 0.5) return; /* still moving: the next stop calls settle again */
        var m = measure();
        var x = track.scrollLeft;
        var to = target !== null ? Math.min(target, track.scrollWidth - track.clientWidth) : m.snap[nearest(m.snap, x)];
        if (Math.abs(to - x) > 1 && tries < 3) {
          tries++;
          scrollTo(to);
          return;
        }
        target = null;
        tries = 0;
        index = nearest(m.snap, x);
      }, 150);
    };
    var later = function () { clearTimeout(timer); timer = setTimeout(settle, 180); };
    var takeOver = function () { target = null; tries = 0; };
    prev.addEventListener('click', function () { go(-1); });
    next.addEventListener('click', function () { go(1); });
    track.addEventListener('scroll', function () {
      update();
      if (useEnd) clearTimeout(timer); else later();
    }, { passive: true });
    if (useEnd) track.addEventListener('scrollend', settle);
    track.addEventListener('wheel', function (e) { if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) takeOver(); }, { passive: true });
    track.addEventListener('touchstart', function () { touching = true; takeOver(); clearTimeout(timer); }, { passive: true });
    var release = function () { touching = false; later(); };
    track.addEventListener('touchend', release, { passive: true });
    track.addEventListener('touchcancel', release, { passive: true });
    /* A new window width changes the shot size: keep the same shot lined up (Safari does not re-snap) */
    window.addEventListener('resize', function () {
      if (track.clientWidth !== width) {
        width = track.clientWidth;
        if (!touching) {
          takeOver();
          var to = measure().snap[index];
          if (Math.abs(track.scrollLeft - to) > 1) track.scrollLeft = to;
        }
      }
      update();
    });
    window.addEventListener('load', update);
    update();

    /* Hidden slides load lazily; fetch them once the gallery comes near the screen so swiping never shows blanks */
    if ('IntersectionObserver' in window) {
      var near = new IntersectionObserver(function (entries) {
        if (!entries[0].isIntersecting) return;
        var imgs = root.querySelectorAll('img[loading="lazy"]');
        for (var i = 0; i < imgs.length; i++) imgs[i].loading = 'eager';
        near.disconnect();
      }, { rootMargin: '300px 0px' });
      near.observe(root);
    }
  }

  /* Privacy page: close the mobile contents list after a tap */
  var tocMobile = doc.querySelector('.toc-mobile');
  if (tocMobile) {
    tocMobile.addEventListener('click', function (e) {
      if (e.target.closest('a')) tocMobile.removeAttribute('open');
    });
  }

  if (!('IntersectionObserver' in window)) {
    var all = doc.querySelectorAll('.rv');
    for (var j = 0; j < all.length; j++) all[j].classList.add('in');
    return;
  }

  /* Privacy page: highlight the current section in the side contents */
  var sideLinks = doc.querySelectorAll('.doc-side a[href^="#"]');
  if (sideLinks.length) {
    var byId = {};
    for (var s = 0; s < sideLinks.length; s++) byId[sideLinks[s].getAttribute('href').slice(1)] = sideLinks[s];
    var setActive = function (id) {
      for (var key in byId) byId[key].classList.toggle('is-active', key === id);
    };
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) setActive(entry.target.id);
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    for (var id in byId) {
      var target = doc.getElementById(id);
      if (target) spy.observe(target);
    }
  }

  var items = doc.querySelectorAll('.rv');
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) { entry.target.classList.add('in'); io.unobserve(entry.target); }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  for (var k = 0; k < items.length; k++) io.observe(items[k]);
})();
