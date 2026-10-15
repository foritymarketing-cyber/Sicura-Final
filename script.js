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
    heroVideo.removeAttribute('autoplay');
    heroVideo.pause();
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
     Nur auf Geräten mit Maus (Hover möglich) und ohne Wunsch nach
     reduzierter Bewegung: Einblenden bei Mausbewegung oder Tastatur,
     Ausblenden nach 3 s ohne Interaktion, damit das Video zur Geltung
     kommt. Solange ein per Tastatur fokussiertes Element im Hero liegt
     (:focus-visible), bleibt der Text sichtbar. Auf Touch-Geräten und bei
     reduzierter Bewegung bleibt der Text dauerhaft sichtbar (siehe CSS),
     wichtige Inhalte hängen also nie von einer Mausbewegung ab. */
  var idleHero = document.querySelector('.hero--idle');
  var idleContent = idleHero && idleHero.querySelector('.hero-content');
  var canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  if (idleHero && idleContent && canHover && !prefersReducedMotion) {
    var idleDelay = 3000;
    var idleTimer = null;

    var hasKeyboardFocus = function () {
      try {
        return !!idleContent.querySelector(':focus-visible');
      } catch (err) {
        return false;
      }
    };

    var scheduleHide = function () {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(function () {
        if (hasKeyboardFocus()) {
          scheduleHide();
          return;
        }
        idleHero.classList.remove('is-active');
      }, idleDelay);
    };

    var showText = function () {
      idleHero.classList.add('is-active');
      scheduleHide();
    };

    window.addEventListener('pointermove', showText, { passive: true });
    window.addEventListener('pointerdown', showText, { passive: true });
    window.addEventListener('keydown', showText);
    idleHero.addEventListener('focusin', showText);

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
        return checked ? '' : 'Bitte bestätigen Sie, dass Sie die Datenschutzhinweise gelesen haben.';
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
       Der Server (api/captcha.php) erzeugt Hintergrund mit Lücke und Puzzleteil
       und merkt sich die richtige Position in der Sitzung; der Browser kennt
       sie nicht. Hier wird nur das Teil per Schieberegler bewegt und die
       erreichte Position zur Prüfung an den Server geschickt. Alle Positionen
       sind in Pixeln des Server-Bildes (data.w × data.h). */
    var captcha = (function () {
      var root = form.querySelector('[data-captcha]');
      if (!root) return null;

      var endpoint = root.getAttribute('data-captcha-endpoint');
      var bg = root.querySelector('.puzzle-captcha-bg');
      var piece = root.querySelector('.puzzle-captcha-piece');
      var track = root.querySelector('.puzzle-captcha-track');
      var fill = root.querySelector('.puzzle-captcha-fill');
      var handle = root.querySelector('.puzzle-captcha-handle');
      var refresh = root.querySelector('.puzzle-captcha-refresh');
      var input = form.elements.captcha;
      var status = root.querySelector('.puzzle-captcha-status');

      var data = null;
      var fraction = 0;
      var solved = false;
      var busy = true;
      var dragStartX = 0, dragStartFraction = 0, dragging = false;

      function travel() {
        return Math.max(track.clientWidth - handle.offsetWidth - 6, 1);
      }

      function pieceX() {
        return data ? data.minX + fraction * (data.maxX - data.minX) : 0;
      }

      function render() {
        var offset = fraction * travel();
        handle.style.transform = 'translateX(' + offset + 'px)';
        fill.style.width = (offset + handle.offsetWidth / 2 + 3) + 'px';
        root.classList.toggle('is-moved', fraction > 0);
        if (data) piece.style.left = ((pieceX() - data.ox) / data.w * 100) + '%';
        handle.setAttribute('aria-valuenow', String(Math.round(fraction * 100)));
      }

      function setUnavailable(message) {
        busy = true;
        root.classList.add('is-unavailable');
        status.textContent = message || 'Die Sicherheitsprüfung konnte nicht geladen werden. Bitte laden Sie ein neues Puzzle oder rufen Sie uns an.';
      }

      function newPuzzle() {
        fraction = 0;
        solved = false;
        busy = true;
        data = null;
        input.value = '';
        root.classList.remove('is-solved', 'is-failed', 'is-unavailable');
        root.classList.add('is-loading');
        handle.removeAttribute('aria-disabled');
        handle.setAttribute('aria-valuetext', 'Nicht gelöst');
        render();

        fetch(endpoint, { credentials: 'same-origin', cache: 'no-store' })
          .then(function (response) { return response.json(); })
          .then(function (result) {
            root.classList.remove('is-loading');
            if (!result || !result.ok) {
              setUnavailable(result && result.error);
              return;
            }
            data = result;
            bg.src = data.bg;
            piece.src = data.piece;
            piece.style.width = (data.pw / data.w * 100) + '%';
            piece.style.top = ((data.y - data.oy) / data.h * 100) + '%';
            busy = false;
            render();
          })
          .catch(function () {
            root.classList.remove('is-loading');
            setUnavailable();
          });
      }

      function fail() {
        busy = true;
        root.classList.add('is-failed');
        status.textContent = 'Nicht ganz – bitte mit dem neuen Puzzle noch einmal versuchen.';
        window.setTimeout(newPuzzle, 700);
      }

      function check() {
        if (solved || busy || fraction === 0) return;
        busy = true;
        var body = new FormData();
        body.append('action', 'verify');
        body.append('x', String(Math.round(pieceX())));

        fetch(endpoint, { method: 'POST', body: body, credentials: 'same-origin' })
          .then(function (response) { return response.json(); })
          .then(function (result) {
            if (!result || !result.ok) {
              fail();
              return;
            }
            solved = true;
            input.value = 'solved';
            root.classList.add('is-solved');
            handle.setAttribute('aria-disabled', 'true');
            handle.setAttribute('aria-valuetext', 'Gelöst');
            status.textContent = 'Geprüft – danke!';
            setFieldError(input, '');
          })
          .catch(fail);
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

      // Versand über api/kontakt.php; bei Erfolg geht es weiter zur Danke-Seite
      var submitButton = form.querySelector('[type="submit"]');
      var submitLabel = submitButton.textContent;
      submitButton.disabled = true;
      submitButton.textContent = 'Wird gesendet …';
      if (statusBox) statusBox.className = 'form-status';

      function showSubmitError(message) {
        submitButton.disabled = false;
        submitButton.textContent = submitLabel;
        if (!statusBox) return;
        statusBox.className = 'form-status is-visible error';
        statusBox.innerHTML =
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><line x1="12" y1="8" x2="12" y2="13"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg><span></span>';
        statusBox.querySelector('span').textContent = message;
      }

      fetch(form.getAttribute('action'), {
        method: 'POST',
        body: new FormData(form),
        credentials: 'same-origin'
      })
        .then(function (response) { return response.json(); })
        .then(function (result) {
          if (result && result.ok) {
            window.location.href = 'danke.html';
            return;
          }
          if (result && result.fields) {
            Object.keys(result.fields).forEach(function (fieldName) {
              var field = form.elements[fieldName];
              if (field) setFieldError(field, result.fields[fieldName]);
            });
          }
          if (result && result.captcha && captcha) captcha.reset();
          showSubmitError((result && result.error) || 'Ihre Nachricht konnte nicht gesendet werden.');
        })
        .catch(function () {
          if (captcha) captcha.reset();
          showSubmitError('Ihre Nachricht konnte gerade nicht gesendet werden. Bitte rufen Sie uns an: 06249 937 9999.');
        });
    });
  }

  /* ---- Referenzen: Laufbänder ----
     Jede Reihe läuft langsam in ihre Richtung (data-direction), bremst beim
     Überfahren mit der Maus weich ab und lässt sich per Ziehen (Maus, Finger)
     oder waagerechtem Trackpad-Wischen verschieben. Nach dem Loslassen gleitet
     sie mit Schwung aus. Eingaben ändern nur den Sollwert; gezeichnet wird
     einmal pro Bild in tick(). Die Spur enthält ihre Karten in zwei gleichen
     Hälften; der Versatz wird auf eine Hälfte begrenzt, damit die Schleife
     nahtlos ist. Bei reduzierter Bewegung läuft nichts von selbst und es gibt
     keinen Schwung, Verschieben bleibt möglich. */
  var sectorRows = document.querySelectorAll('.sector-row');

  // Bilder vorab laden und dekodieren, damit beim Ziehen keine Karte erst
  // mitten in der Bewegung nachlädt (das verursacht spürbare Ruckler)
  document.querySelectorAll('.sector-track img').forEach(function (img) {
    img.loading = 'eager';
    img.decoding = 'async';
  });

  sectorRows.forEach(function (row) {
    var track = row.querySelector('.sector-track');
    if (!track) return;

    var autoSpeed = 22; // px pro Sekunde
    var friction = 0.0045; // Abbremsen des Schwungs pro ms (exponentiell)
    var direction = row.getAttribute('data-direction') === 'right' ? -1 : 1;
    var halfWidth = 0;
    var offset = 0;
    var renderedOffset = null;
    var speed = prefersReducedMotion ? 0 : autoSpeed; // aktuelle Eigenbewegung
    var momentum = 0; // px pro ms nach dem Loslassen
    var isHovered = false;
    var isDragging = false;
    var isVisible = true;
    var resumeAt = 0;
    var dragPointerId = null;
    var dragPointerType = '';
    var dragStartX = 0;
    var dragStartY = 0;
    var dragStartOffset = 0;
    var dragLocked = false;
    var samples = [];
    var wheelUntil = 0;
    var lastTime = 0;

    var wrap = function (value) {
      if (halfWidth <= 0) return value;
      return ((value % halfWidth) + halfWidth) % halfWidth;
    };

    var render = function () {
      var shown = wrap(offset);
      if (shown === renderedOffset) return;
      renderedOffset = shown;
      track.style.transform = 'translate3d(' + (-shown) + 'px, 0, 0)';
    };

    var measure = function () {
      halfWidth = track.scrollWidth / 2;
      offset = wrap(offset);
      renderedOffset = null;
      render();
    };

    var tick = function (time) {
      var ms = lastTime ? Math.min(time - lastTime, 64) : 0;
      lastTime = time;

      if (!isDragging) {
        // Schwung nach dem Loslassen ausgleiten lassen
        if (momentum !== 0) {
          offset += momentum * ms;
          momentum *= Math.exp(-friction * ms);
          if (Math.abs(momentum) < 0.01) momentum = 0;
        }
        // Eigenbewegung weich an- und abschwellen lassen statt hart zu stoppen
        var target = prefersReducedMotion || isHovered || time < resumeAt ? 0 : autoSpeed;
        speed += (target - speed) * Math.min(1, ms / 350);
        if (Math.abs(speed - target) < 0.05) speed = target;
        offset += direction * speed * ms / 1000;
      }

      if (isVisible) render();
      window.requestAnimationFrame(tick);
    };

    // Nur echte Mäuse halten die Reihe beim Überfahren an; Touch-Geräte
    // melden sonst nach dem Antippen dauerhaft „Hover“
    row.addEventListener('pointerenter', function (event) {
      if (event.pointerType === 'mouse') isHovered = true;
    });
    row.addEventListener('pointerleave', function (event) {
      if (event.pointerType === 'mouse') isHovered = false;
    });

    var addSample = function (event) {
      samples.push({ x: event.clientX, t: event.timeStamp });
      if (samples.length > 6) samples.shift();
    };

    var startDrag = function (event) {
      dragLocked = true;
      // Ab der aktuellen Position weiterziehen, damit die Reihe nach der
      // Richtungserkennung nicht um die Totzone springt
      dragStartX = event.clientX;
      dragStartOffset = offset;
      samples = [];
      addSample(event);
      try { row.setPointerCapture(event.pointerId); } catch (e) { /* bereits beendet */ }
      row.classList.add('is-dragging');
    };

    row.addEventListener('pointerdown', function (event) {
      if (isDragging) return;
      if (event.pointerType === 'mouse') {
        if (event.button !== 0) return;
        // Verhindert natives Ziehen/Markieren, das das Loslassen verschlucken kann
        event.preventDefault();
      }
      isDragging = true;
      momentum = 0;
      speed = 0;
      dragLocked = false;
      dragPointerId = event.pointerId;
      dragPointerType = event.pointerType;
      dragStartX = event.clientX;
      dragStartY = event.clientY;
      dragStartOffset = offset;
      if (event.pointerType === 'mouse') startDrag(event);
    });

    row.addEventListener('pointermove', function (event) {
      if (!isDragging || event.pointerId !== dragPointerId) return;
      // Maustaste wurde losgelassen, ohne dass ein pointerup ankam (z. B.
      // außerhalb des Fensters): Ziehen beenden statt am Cursor zu kleben
      if (event.pointerType === 'mouse' && (event.buttons & 1) === 0) {
        endDrag(event);
        return;
      }
      // Touch: erst entscheiden, ob waagerecht verschoben oder senkrecht gescrollt wird
      if (!dragLocked) {
        var mx = Math.abs(event.clientX - dragStartX);
        var my = Math.abs(event.clientY - dragStartY);
        if (mx < 6 && my < 6) return;
        if (mx <= my) {
          isDragging = false;
          resumeAt = performance.now() + 600;
          return;
        }
        startDrag(event);
        return;
      }
      offset = dragStartOffset - (event.clientX - dragStartX);
      addSample(event);
    });

    var endDrag = function (event) {
      if (!isDragging || (event && event.pointerId !== dragPointerId)) return;
      isDragging = false;
      dragPointerId = null;
      row.classList.remove('is-dragging');

      // Wurfgeschwindigkeit aus den letzten ~100 ms der Bewegung
      momentum = 0;
      if (dragLocked && !prefersReducedMotion && event && event.type === 'pointerup') {
        var now = event.timeStamp;
        var recent = samples.filter(function (s) { return now - s.t < 100; });
        if (recent.length >= 2) {
          var first = recent[0];
          var last = recent[recent.length - 1];
          var dt = Math.max(last.t - first.t, 8);
          momentum = -(last.x - first.x) / dt;
          // Sehr schnelle Würfe begrenzen
          momentum = Math.max(-4, Math.min(4, momentum));
        }
      }
      samples = [];

      // Nach dem Loslassen auf Touch-Geräten kurz stehen bleiben
      resumeAt = performance.now() + (dragPointerType === 'mouse' ? 0 : 1500);
    };
    row.addEventListener('pointerup', endDrag);
    row.addEventListener('pointercancel', endDrag);
    row.addEventListener('lostpointercapture', endDrag);
    window.addEventListener('blur', function () {
      endDrag();
    });

    // Waagerechtes Wischen auf dem Trackpad. Hat eine Geste waagerecht
    // begonnen, bleibt sie bei der Reihe, auch wenn einzelne Ereignisse leicht
    // senkrecht ausschlagen; sonst springt die Seite zwischendurch nach oben
    // oder unten.
    row.addEventListener('wheel', function (event) {
      var now = performance.now();
      var horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY);
      if (!horizontal && now > wheelUntil) return;
      event.preventDefault();
      wheelUntil = now + 150;
      var factor = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? row.clientWidth : 1;
      offset += event.deltaX * factor;
      momentum = 0;
      speed = 0;
      resumeAt = now + 800;
    }, { passive: false });

    // Reihen außerhalb des Sichtbereichs nicht neu zeichnen
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        isVisible = entries[0].isIntersecting;
      }).observe(row);
    }

    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('load', measure);
    window.requestAnimationFrame(tick);
  });

  /* ---- Aktuelles Jahr im Footer ---- */
  var yearEls = document.querySelectorAll('[data-current-year]');
  yearEls.forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });
})();
