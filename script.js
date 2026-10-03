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
      if (window.innerWidth > 860) {
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
  });

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
        tapRevealed = !isMouse && !idleHero.classList.contains('is-active');
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

  /* ---- Kontaktformular: Client-seitige Validierung ---- */
  var form = document.querySelector('#contact-form');

  if (form) {
    var statusBox = form.querySelector('.form-status');

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

      if (statusBox) {
        statusBox.className = 'form-status is-visible success';
        statusBox.innerHTML =
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"></path></svg><span>Vielen Dank. Wir sehen uns Ihre Nachricht an und melden uns bei Ihnen. Wenn es eilig ist, rufen Sie gerne direkt an: 06249 937 9999.</span>';
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
