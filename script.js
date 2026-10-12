// ==========================================================================
// Sicura Sicherheitstechnik — Interaktionen
// Mobile Navigation, Scroll-Reveal, Kontaktformular-Validierung
// ==========================================================================

(function () {
  'use strict';

  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- Mobile Navigation ---- */
  var navToggle = document.querySelector('.nav-toggle');
  var navDesktop = document.querySelector('.nav-desktop');

  if (navToggle && navDesktop) {
    navToggle.addEventListener('click', function () {
      var isOpen = navToggle.getAttribute('aria-expanded') === 'true';
      navToggle.setAttribute('aria-expanded', String(!isOpen));
      navDesktop.classList.toggle('is-open', !isOpen);
      document.body.style.overflow = !isOpen ? 'hidden' : '';
    });

    navDesktop.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        navToggle.setAttribute('aria-expanded', 'false');
        navDesktop.classList.remove('is-open');
        document.body.style.overflow = '';
      });
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth > 1024) {
        navToggle.setAttribute('aria-expanded', 'false');
        navDesktop.classList.remove('is-open');
        document.body.style.overflow = '';
      }
    });
  }

  /* ---- Transparenter Header über dem Video-Hero (nur Startseite) ---- */
  var header = document.querySelector('.site-header');

  if (header && document.body.classList.contains('has-video-hero')) {
    var scrollThreshold = 40;
    var headerTicking = false;

    var updateHeaderState = function () {
      header.classList.toggle('is-scrolled', window.scrollY > scrollThreshold);
      headerTicking = false;
    };

    window.addEventListener(
      'scroll',
      function () {
        if (!headerTicking) {
          window.requestAnimationFrame(updateHeaderState);
          headerTicking = true;
        }
      },
      { passive: true }
    );

    updateHeaderState();
  }

  /* ---- Hero-Video: bei reduzierter Bewegung als Standbild anhalten ----
     Die ersten Sekunden zeigen nur das Logo-Intro, daher wird auf ein
     aussagekräftiges Motiv (Sekunde 5, entspricht dem Poster) gesprungen. */
  var heroVideo = document.querySelector('.hero-video');

  if (heroVideo && prefersReducedMotion) {
    heroVideo.addEventListener(
      'loadeddata',
      function () {
        heroVideo.pause();
        heroVideo.currentTime = 5;
      },
      { once: true }
    );
  }

  /* ---- Kachel-Videos: bei reduzierter Bewegung auf die Explosionsansicht
     (Sekunde 6) springen und dort anhalten. */
  if (prefersReducedMotion) {
    document.querySelectorAll('.card-video:not(.card-video--hover)').forEach(function (video) {
      video.removeAttribute('autoplay');
      video.pause();
      video.addEventListener(
        'loadeddata',
        function () {
          video.pause();
          video.currentTime = 6;
        },
        { once: true }
      );
    });
  }

  /* ---- Hover-Video-Kachel: beim Hover vorwärts bis zum Ende abspielen und
     dort anhalten, beim Verlassen rückwärts zum Anfang zurückspulen.
     Rückwärts per requestAnimationFrame, da negative playbackRate nicht in
     allen Browsern unterstützt wird. Bei reduzierter Bewegung bleibt das
     Standbild stehen, nur der Text wird eingeblendet. */
  document.querySelectorAll('.card-video--hover').forEach(function (video) {
    var card = video.closest('.card');
    if (!card || prefersReducedMotion) return;

    var rewindFrame = null;
    var lastTs = null;

    var stopRewind = function () {
      if (rewindFrame) cancelAnimationFrame(rewindFrame);
      rewindFrame = null;
      lastTs = null;
    };

    var rewindStep = function (ts) {
      if (lastTs !== null) {
        var t = video.currentTime - (ts - lastTs) / 1000;
        if (t <= 0) {
          video.currentTime = 0;
          stopRewind();
          return;
        }
        video.currentTime = t;
      }
      lastTs = ts;
      rewindFrame = requestAnimationFrame(rewindStep);
    };

    var playForward = function () {
      stopRewind();
      if (video.ended || video.currentTime >= video.duration) return;
      var p = video.play();
      if (p && p.catch) p.catch(function () {});
    };

    var playBackward = function () {
      video.pause();
      stopRewind();
      rewindFrame = requestAnimationFrame(rewindStep);
    };

    card.addEventListener('mouseenter', playForward);
    card.addEventListener('mouseleave', playBackward);
    card.addEventListener('focus', playForward);
    card.addEventListener('blur', playBackward);
    card._hoverVideo = { play: playForward, rewind: playBackward };
  });

  /* Service-Kachel (Logo-Zoom) hat kein Video, soll aber beim Darüberwischen
     genauso aktiv werden – der Zoom selbst läuft rein über CSS. */
  document.querySelectorAll('.card--media-zoom-logo').forEach(function (card) {
    card._hoverVideo = { play: function () {}, rewind: function () {} };
  });

  /* ---- Touch: Hover-Video-Kachel beim Darüberwischen mit dem Finger abspielen.
     Aktiv ist die Kachel unter dem Finger (auch wenn der Finger von einer
     Kachel auf die nächste wandert); `.is-touch-active` spiegelt den
     Hover-Zustand im CSS. Nach dem Loslassen bleibt die Kachel noch kurz
     aktiv, damit das Video zu Ende laufen kann. Listener sind passiv und
     beeinträchtigen das Scrollen nicht. */
  if (!prefersReducedMotion && document.querySelector('.card-video--hover')) {
    var touchCard = null;
    var touchReleaseTimer = null;
    var touchFrame = null;
    var touchPoint = null;
    var touchReleaseDelay = 2500;

    var setTouchCard = function (card) {
      if (card === touchCard) return;
      if (touchCard) {
        touchCard.classList.remove('is-touch-active');
        touchCard._hoverVideo.rewind();
      }
      touchCard = card;
      if (card) {
        card.classList.add('is-touch-active');
        card._hoverVideo.play();
      }
    };

    var cardAtPoint = function (x, y) {
      var el = document.elementFromPoint(x, y);
      var card = el && el.closest('.card');
      return card && card._hoverVideo ? card : null;
    };

    var updateTouch = function () {
      touchFrame = null;
      if (touchPoint) setTouchCard(cardAtPoint(touchPoint.x, touchPoint.y));
    };

    var onTouch = function (e) {
      var t = e.touches[0];
      if (!t) return;
      clearTimeout(touchReleaseTimer);
      touchPoint = { x: t.clientX, y: t.clientY };
      if (!touchFrame) touchFrame = requestAnimationFrame(updateTouch);
    };

    var onTouchEnd = function (e) {
      if (e.touches.length) return;
      touchPoint = null;
      clearTimeout(touchReleaseTimer);
      touchReleaseTimer = setTimeout(function () {
        setTouchCard(null);
      }, touchReleaseDelay);
    };

    document.addEventListener('touchstart', onTouch, { passive: true });
    document.addEventListener('touchmove', onTouch, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    document.addEventListener('touchcancel', onTouchEnd, { passive: true });
  }

  /* ---- Hero-Text erst bei Interaktion einblenden ----
     Desktop: Mausbewegung, Ausblenden nach 3 s ohne Bewegung.
     Touch: Antippen, Ausblenden nach 3 s ohne Interaktion.
     Tastatur: bleibt sichtbar, solange ein per Tastatur fokussiertes
     Element im Hero liegt (:focus-visible), damit Tab-Nutzer die Buttons
     erreichen. */
  var idleHero = document.querySelector('.hero--idle');
  var idleContent = idleHero && idleHero.querySelector('.hero-content');

  if (idleHero && idleContent) {
    var mouseIdleDelay = 3000;
    var touchIdleDelay = 3000;
    var idleTimer = null;
    var tapRevealed = false;
    var textAlwaysVisible = window.matchMedia('(max-width: 1024px)');

    var hasKeyboardFocus = function () {
      try {
        return !!idleContent.querySelector(':focus-visible');
      } catch (err) {
        return false;
      }
    };

    var scheduleHide = function (delay) {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(function () {
        if (hasKeyboardFocus()) {
          scheduleHide(delay);
          return;
        }
        idleHero.classList.remove('is-active');
      }, delay);
    };

    var showText = function (delay) {
      idleHero.classList.add('is-active');
      scheduleHide(delay);
    };

    window.addEventListener(
      'pointermove',
      function (e) {
        if (e.pointerType === 'mouse') showText(mouseIdleDelay);
      },
      { passive: true }
    );

    // Ein Tippen auf den noch unsichtbaren Text soll ihn nur einblenden,
    // nicht versehentlich einen der (unsichtbaren) Buttons auslösen.
    window.addEventListener(
      'pointerdown',
      function (e) {
        var isMouse = e.pointerType === 'mouse';
        // Unterhalb Desktop-Breite ist der Text immer sichtbar (siehe CSS).
        tapRevealed =
          !isMouse &&
          !idleHero.classList.contains('is-active') &&
          !textAlwaysVisible.matches;
        showText(isMouse ? mouseIdleDelay : touchIdleDelay);
      },
      { passive: true }
    );

    idleContent.addEventListener(
      'click',
      function (e) {
        if (tapRevealed) {
          e.preventDefault();
          tapRevealed = false;
        }
      },
      true
    );

    idleHero.addEventListener('focusin', function () {
      if (hasKeyboardFocus()) showText(touchIdleDelay);
    });
    window.addEventListener('keydown', function () {
      showText(touchIdleDelay);
    });

    idleHero.classList.add('is-idle-ready');
  }

  /* ---- Scroll-Reveal ---- */
  var revealEls = document.querySelectorAll('[data-reveal]');

  if (revealEls.length) {
    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      revealEls.forEach(function (el) {
        el.classList.add('is-visible');
      });
    } else {
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry, index) {
            if (entry.isIntersecting) {
              var el = entry.target;
              var group = el.closest('[data-reveal-group]');
              var delay = 0;

              if (group) {
                var siblings = Array.prototype.slice.call(group.querySelectorAll('[data-reveal]'));
                delay = siblings.indexOf(el) * 60;
              }

              el.style.animationDelay = delay + 'ms';
              el.classList.add('is-visible');
              observer.unobserve(el);
            }
          });
        },
        { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
      );

      revealEls.forEach(function (el) {
        observer.observe(el);
      });
    }
  }

  /* ---- Ablauf-Zeitstrahl: Linie füllt sich mit dem Scrollen ----
     Bezugspunkt ist eine Linie bei 60 % der Fensterhöhe: Was darüber liegt,
     gilt als erreicht. Ohne JS / bei reduzierter Bewegung bleibt alles voll. */
  var processEls = document.querySelectorAll('[data-process]');

  if (processEls.length && !prefersReducedMotion) {
    processEls.forEach(function (process) {
      var line = process.querySelector('.process-line');
      var steps = Array.prototype.slice.call(process.querySelectorAll('.process-step'));
      var dots = steps.map(function (step) { return step.querySelector('.process-dot'); });
      var ticking = false;

      if (!line || !dots.length) return;

      function dotCenter(dot) {
        var r = dot.getBoundingClientRect();
        return r.top + r.height / 2;
      }

      function update() {
        ticking = false;
        var anchor = window.innerHeight * 0.6;
        var first = dotCenter(dots[0]);
        var last = dotCenter(dots[dots.length - 1]);

        // Linie exakt von der Mitte des ersten bis zur Mitte des letzten
        // Punkts spannen, damit Füllstand und Punkte deckungsgleich sind.
        var processTop = process.getBoundingClientRect().top;
        line.style.top = (first - processTop) + 'px';
        line.style.height = Math.max(0, last - first) + 'px';
        line.style.bottom = 'auto';

        var progress = last > first ? (anchor - first) / (last - first) : 1;
        progress = Math.min(1, Math.max(0, progress));
        process.style.setProperty('--process-progress', progress.toFixed(4));

        // Ein Punkt wird grün, sobald die Füllung seinen oberen Rand erreicht.
        dots.forEach(function (dot, i) {
          steps[i].classList.toggle('is-active', i === 0 ? anchor >= first : dot.getBoundingClientRect().top <= anchor);
        });
      }

      function requestUpdate() {
        if (!ticking) {
          ticking = true;
          window.requestAnimationFrame(update);
        }
      }

      process.classList.add('is-animated');
      update();
      window.addEventListener('scroll', requestUpdate, { passive: true });
      window.addEventListener('resize', requestUpdate);
    });
  }

  /* ---- Kontaktformular: Client-seitige Validierung ---- */
  var form = document.querySelector('#contact-form');

  if (form) {
    var statusBox = form.querySelector('.form-status');

    // Anliegen aus ?anliegen=… vorauswählen (CTAs der Leistungsseiten).
    // Nur Werte übernehmen, die als Option existieren.
    var topicSelect = form.elements.topic;
    var topicParam = new URLSearchParams(window.location.search).get('anliegen');
    if (topicSelect && topicParam) {
      Array.prototype.forEach.call(topicSelect.options, function (option) {
        if (option.value && option.value === topicParam) topicSelect.value = topicParam;
      });
    }

    var validators = {
      name: function (value) {
        return value.trim().length >= 2 ? '' : 'Bitte tragen Sie Ihren Namen ein.';
      },
      email: function (value) {
        var pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return pattern.test(value.trim()) ? '' : 'Bitte prüfen Sie Ihre E-Mail-Adresse.';
      },
      message: function (value) {
        return value.trim().length >= 10 ? '' : 'Bitte schreiben Sie uns kurz, worum es geht.';
      },
      consent: function (checked) {
        return checked ? '' : 'Bitte bestätigen Sie die Einwilligung.';
      }
    };

    function setFieldError(field, message) {
      var row = field.closest('.form-row');
      if (!row) return;
      var errorEl = row.querySelector('.field-error');
      if (message) {
        row.classList.add('has-error');
        if (errorEl) errorEl.textContent = message;
        field.setAttribute('aria-invalid', 'true');
      } else {
        row.classList.remove('has-error');
        if (errorEl) errorEl.textContent = '';
        field.removeAttribute('aria-invalid');
      }
    }

    function validateField(field) {
      var validator = validators[field.name];
      if (!validator) return true;

      var value = field.type === 'checkbox' ? field.checked : field.value;
      var message = validator(value);
      setFieldError(field, message);
      return !message;
    }

    ['name', 'email', 'message', 'consent'].forEach(function (fieldName) {
      var field = form.elements[fieldName];
      if (!field) return;
      var eventName = field.type === 'checkbox' ? 'change' : 'blur';
      field.addEventListener(eventName, function () {
        validateField(field);
      });
    });

    /* ---- Puzzle-Captcha ----
       Ein Puzzleteil wird an einer zufälligen Stelle aus dem Bild „ausgeschnitten“
       und muss per Schieberegler in die Lücke geschoben werden. Gezeichnet wird
       auf Canvas in festen internen Koordinaten (W × H), die per CSS skaliert
       werden. Hinweis: Die Prüfung läuft nur im Browser und hält einfache Bots
       ab; sobald ein Backend existiert, muss sie zusätzlich serverseitig erfolgen. */
    var captcha = (function () {
      var root = form.querySelector('[data-captcha]');
      if (!root) return null;

      var W = 360, H = 240;          // interne Bildgröße
      var L = 44, R = 9;             // Kantenlänge und Nasenradius des Teils
      var PW = L + 2 * R + 4;        // Canvas-Größe des Teils
      var OX = 2, OY = 2 * R + 2;    // Lage des Quadrats im Teil-Canvas
      var MIN_X = 4, MAX_X = W - L - R - 8;
      var TOLERANCE = 5;

      var bg = root.querySelector('.puzzle-captcha-bg');
      var piece = root.querySelector('.puzzle-captcha-piece');
      var track = root.querySelector('.puzzle-captcha-track');
      var fill = root.querySelector('.puzzle-captcha-fill');
      var handle = root.querySelector('.puzzle-captcha-handle');
      var refresh = root.querySelector('.puzzle-captcha-refresh');
      var input = form.elements.captcha;
      var status = root.querySelector('.puzzle-captcha-status');
      var dpr = Math.min(window.devicePixelRatio || 1, 2);

      var image = new Image();
      var imageReady = false;
      var target = { x: 0, y: 0 };
      var fraction = 0;
      var solved = false;
      var busy = false;
      var dragStartX = 0, dragStartFraction = 0, dragging = false;

      function setupCanvas(canvas, w, h) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        var ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        return ctx;
      }

      function piecePath(ctx, x, y) {
        var PI = Math.PI;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.arc(x + L / 2, y - R + 2, R, 0.72 * PI, 2.26 * PI);
        ctx.lineTo(x + L, y);
        ctx.arc(x + L + R - 2, y + L / 2, R, 1.21 * PI, 2.78 * PI);
        ctx.lineTo(x + L, y + L);
        ctx.lineTo(x, y + L);
        ctx.arc(x + R - 2, y + L / 2, R + 0.4, 2.76 * PI, 1.24 * PI, true);
        ctx.lineTo(x, y);
        ctx.closePath();
      }

      function drawSource(ctx, dx, dy) {
        if (imageReady) {
          ctx.drawImage(image, dx, dy, W, H);
        } else {
          ctx.fillStyle = '#2a2a2e';
          ctx.fillRect(dx, dy, W, H);
        }
      }

      function draw() {
        var ctx = setupCanvas(bg, W, H);
        drawSource(ctx, 0, 0);
        piecePath(ctx, target.x, target.y);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.stroke();

        var pctx = setupCanvas(piece, PW, PW);
        pctx.save();
        piecePath(pctx, OX, OY);
        pctx.clip();
        drawSource(pctx, OX - target.x, OY - target.y);
        pctx.restore();
        piecePath(pctx, OX, OY);
        pctx.lineWidth = 1.5;
        pctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        pctx.stroke();

        piece.style.width = (PW / W * 100) + '%';
        piece.style.height = (PW / H * 100) + '%';
        piece.style.top = ((target.y - OY) / H * 100) + '%';
      }

      function travel() {
        return Math.max(track.clientWidth - handle.offsetWidth - 6, 1);
      }

      function pieceX() {
        return MIN_X + fraction * (MAX_X - MIN_X);
      }

      function render() {
        var offset = fraction * travel();
        handle.style.transform = 'translateX(' + offset + 'px)';
        fill.style.width = (offset + handle.offsetWidth / 2 + 3) + 'px';
        root.classList.toggle('is-moved', fraction > 0);
        piece.style.left = ((pieceX() - OX) / W * 100) + '%';
        handle.setAttribute('aria-valuenow', String(Math.round(fraction * 100)));
      }

      function newPuzzle() {
        target.x = Math.round(W * 0.4 + Math.random() * (MAX_X - 4 - W * 0.4));
        target.y = Math.round(2 * R + 4 + Math.random() * (H - L - 6 - (2 * R + 4)));
        fraction = 0;
        solved = false;
        busy = false;
        input.value = '';
        root.classList.remove('is-solved', 'is-failed');
        handle.removeAttribute('aria-disabled');
        handle.setAttribute('aria-valuetext', 'Nicht gelöst');
        draw();
        render();
      }

      function check() {
        if (solved || busy) return;
        if (Math.abs(pieceX() - target.x) <= TOLERANCE) {
          solved = true;
          fraction = (target.x - MIN_X) / (MAX_X - MIN_X);
          render();
          input.value = 'solved';
          root.classList.add('is-solved');
          handle.setAttribute('aria-disabled', 'true');
          handle.setAttribute('aria-valuetext', 'Gelöst');
          status.textContent = 'Geprüft – danke!';
          setFieldError(input, '');
        } else if (fraction > 0) {
          busy = true;
          root.classList.add('is-failed');
          status.textContent = 'Nicht ganz – bitte mit dem neuen Puzzle noch einmal versuchen.';
          window.setTimeout(newPuzzle, 700);
        }
      }

      handle.addEventListener('pointerdown', function (event) {
        if (solved || busy) return;
        dragging = true;
        setFieldError(input, '');
        dragStartX = event.clientX;
        dragStartFraction = fraction;
        handle.setPointerCapture(event.pointerId);
        event.preventDefault();
      });

      handle.addEventListener('pointermove', function (event) {
        if (!dragging) return;
        status.textContent = '';
        fraction = Math.min(Math.max(dragStartFraction + (event.clientX - dragStartX) / travel(), 0), 1);
        render();
      });

      function endDrag() {
        if (!dragging) return;
        dragging = false;
        check();
      }

      handle.addEventListener('pointerup', endDrag);
      handle.addEventListener('pointercancel', endDrag);

      handle.addEventListener('keydown', function (event) {
        if (solved || busy) return;
        var step = event.shiftKey ? 0.05 : 0.01;
        setFieldError(input, '');
        if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
          fraction = Math.min(fraction + step, 1);
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
          fraction = Math.max(fraction - step, 0);
        } else if (event.key === 'Home') {
          fraction = 0;
        } else if (event.key === 'End') {
          fraction = 1;
        } else if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          check();
          return;
        } else {
          return;
        }
        event.preventDefault();
        render();
      });

      refresh.addEventListener('click', function () {
        status.textContent = '';
        newPuzzle();
      });
      window.addEventListener('resize', render);

      image.onload = function () { imageReady = true; draw(); };
      image.src = root.getAttribute('data-captcha-src');
      newPuzzle();

      return {
        isSolved: function () { return solved; },
        reset: function () {
          status.textContent = '';
          newPuzzle();
        },
        input: input,
        handle: handle
      };
    })();

    form.addEventListener('submit', function (event) {
      event.preventDefault();

      var fieldsToValidate = ['name', 'email', 'message', 'consent'];
      var isValid = true;
      var firstInvalid = null;

      fieldsToValidate.forEach(function (fieldName) {
        var field = form.elements[fieldName];
        if (!field) return;
        var fieldIsValid = validateField(field);
        if (!fieldIsValid) {
          isValid = false;
          if (!firstInvalid) firstInvalid = field;
        }
      });

      if (captcha && !captcha.isSolved()) {
        setFieldError(captcha.input, 'Bitte schieben Sie das Puzzleteil in die passende Lücke.');
        isValid = false;
        if (!firstInvalid) firstInvalid = captcha.handle;
      }

      if (!isValid) {
        if (firstInvalid) firstInvalid.focus();
        if (statusBox) {
          statusBox.className = 'form-status is-visible error';
          statusBox.innerHTML =
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><line x1="12" y1="8" x2="12" y2="13"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg><span>Bitte prüfen Sie Ihre Angaben und füllen Sie die markierten Felder aus.</span>';
        }
        return;
      }

      // Hinweis: Dieses Formular ist aktuell nicht an ein Backend/E-Mail-Postfach angebunden.
      // Für den produktiven Einsatz muss hier eine Übermittlung (z. B. per Formularservice
      // oder eigenem Endpunkt) ergänzt werden.
      form.reset();
      if (captcha) captcha.reset();

      if (statusBox) {
        statusBox.className = 'form-status is-visible success';
        statusBox.innerHTML =
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"></path></svg><span>Vielen Dank. Wir sehen uns Ihre Nachricht an und melden uns bei Ihnen. Wenn es eilig ist, rufen Sie gerne direkt an: <a class="phone" href="tel:+4962499379999">06249 937 9999</a>.</span>';
        statusBox.setAttribute('role', 'status');
        statusBox.setAttribute('aria-live', 'polite');
      }
    });
  }

  /* ---- Referenzen: Fließband-Karussell ----
     Läuft automatisch langsam von rechts nach links (steigender scrollLeft),
     lässt sich aber jederzeit von Hand bewegen (Ziehen, Touch, Trackpad,
     Pfeiltasten) und hält beim Überfahren/Fokussieren an, damit ein
     einzelnes Referenzprojekt in Ruhe gelesen werden kann. Der Track enthält
     die drei Karten doppelt (zweite Hälfte per aria-hidden ausgeblendet),
     damit die Schleife nahtlos wirkt. */
  var conveyor = document.querySelector('[data-conveyor]');
  var conveyorTrack = conveyor ? conveyor.querySelector('[data-conveyor-track]') : null;

  if (conveyor && conveyorTrack) {
    var conveyorSpeed = 0.25; // px pro Frame – bewusst langsam, wie ein Fließband
    var conveyorHalfWidth = 0;
    var isConveyorPaused = prefersReducedMotion;
    var isConveyorDragging = false;
    var dragStartX = 0;
    var dragStartScroll = 0;

    var updateConveyorHalfWidth = function () {
      conveyorHalfWidth = conveyorTrack.scrollWidth / 2;
    };
    updateConveyorHalfWidth();
    window.addEventListener('resize', updateConveyorHalfWidth);

    var conveyorTick = function () {
      if (!isConveyorPaused && !isConveyorDragging && conveyorHalfWidth > 0) {
        conveyor.scrollLeft += conveyorSpeed;
        if (conveyor.scrollLeft >= conveyorHalfWidth) {
          conveyor.scrollLeft -= conveyorHalfWidth;
        }
      }
      window.requestAnimationFrame(conveyorTick);
    };
    window.requestAnimationFrame(conveyorTick);

    /* Anhalten beim Überfahren/Fokussieren eines Referenzprojekts */
    conveyor.addEventListener('mouseenter', function () {
      isConveyorPaused = true;
    });
    conveyor.addEventListener('mouseleave', function () {
      if (!isConveyorDragging) isConveyorPaused = prefersReducedMotion;
    });
    conveyor.addEventListener('focusin', function () {
      isConveyorPaused = true;
    });
    conveyor.addEventListener('focusout', function () {
      if (!isConveyorDragging) isConveyorPaused = prefersReducedMotion;
    });

    /* Von Hand ziehen (Maus/Stift/Touch) */
    conveyor.addEventListener('pointerdown', function (event) {
      isConveyorDragging = true;
      isConveyorPaused = true;
      dragStartX = event.clientX;
      dragStartScroll = conveyor.scrollLeft;
      conveyor.setPointerCapture(event.pointerId);
    });

    conveyor.addEventListener('pointermove', function (event) {
      if (!isConveyorDragging) return;
      conveyor.scrollLeft = dragStartScroll - (event.clientX - dragStartX);
    });

    var endConveyorDrag = function () {
      if (!isConveyorDragging) return;
      isConveyorDragging = false;
      isConveyorPaused = prefersReducedMotion;
    };
    conveyor.addEventListener('pointerup', endConveyorDrag);
    conveyor.addEventListener('pointercancel', endConveyorDrag);

    /* Nach manuellem Scrollen (Trackpad, Touch, Pfeiltasten) nahtlos umbrechen */
    conveyor.addEventListener('scroll', function () {
      if (conveyorHalfWidth <= 0) return;
      if (conveyor.scrollLeft >= conveyorHalfWidth) {
        conveyor.scrollLeft -= conveyorHalfWidth;
      } else if (conveyor.scrollLeft < 0) {
        conveyor.scrollLeft += conveyorHalfWidth;
      }
    });
  }

  /* ---- Aktuelles Jahr im Footer ---- */
  var yearEls = document.querySelectorAll('[data-current-year]');
  yearEls.forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });
})();
