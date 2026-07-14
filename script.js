/* ==========================================================================
   HMbyNad — shared behaviour
   ========================================================================== */

// Telegram delivery for form submissions (calculator + course sign-up).
// NOTE: the token below is visible to anyone who views the page source —
// that's an inherent limit of sending Telegram messages without a backend.
// If it ever leaks or gets abused, rotate it with @BotFather (/revoke).
const TG_BOT_TOKEN = '8767724653:AAFsRxcnpsTtI7EwPZFrN7ZUnumQIyElq3Q';
const TG_CHAT_ID = '674647485';

document.addEventListener('DOMContentLoaded', () => {

  /* ---- header scroll state ---- */
  const header = document.querySelector('.site-header');
  const onScroll = () => {
    if (window.scrollY > 24) header.classList.add('is-scrolled');
    else header.classList.remove('is-scrolled');
  };
  if (header) { onScroll(); window.addEventListener('scroll', onScroll, { passive: true }); }

  /* ---- mobile nav drawer ---- */
  const toggle = document.querySelector('.nav-toggle');
  const drawer = document.querySelector('.mobile-drawer');
  if (toggle && drawer) {
    toggle.addEventListener('click', () => {
      toggle.classList.toggle('is-open');
      drawer.classList.toggle('is-open');
      document.body.style.overflow = drawer.classList.contains('is-open') ? 'hidden' : '';
    });
    drawer.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      toggle.classList.remove('is-open');
      drawer.classList.remove('is-open');
      document.body.style.overflow = '';
    }));
  }

  /* ---- active nav link ---- */
  const current = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.main-nav ul a, .mobile-drawer ul a').forEach(a => {
    if (a.getAttribute('href') === current) a.classList.add('is-active');
  });

  /* ---- GSAP scroll reveals ---- */
  if (window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);

    if (document.querySelector('.hero-copy')) {
      gsap.timeline({ defaults: { ease: 'power3.out', duration: 1 } })
        .from('.hero-copy .eyebrow', { opacity: 0, y: 16 })
        .from('.hero-copy h1', { opacity: 0, y: 30 }, '-=0.7')
        .from('.hero-copy .lede', { opacity: 0, y: 20 }, '-=0.7')
        .from('.hero-actions', { opacity: 0, y: 16 }, '-=0.6')
        .from('.hero-visual', { opacity: 0, scale: 0.96 }, '-=0.9');
    }

    document.querySelectorAll('.reveal').forEach((el, i) => {
      gsap.to(el, {
        opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', delay: (i % 4) * 0.08,
        scrollTrigger: { trigger: el, start: 'top 88%', once: true }
      });
    });

    document.querySelectorAll('.trust-num[data-count]').forEach((el) => {
      const target = parseFloat(el.dataset.count);
      const suffix = el.dataset.suffix || '';
      const obj = { val: 0 };
      ScrollTrigger.create({
        trigger: el, start: 'top 90%', once: true,
        onEnter: () => {
          gsap.to(obj, {
            val: target, duration: 1.4, ease: 'power2.out',
            onUpdate: () => { el.textContent = Math.round(obj.val) + suffix; }
          });
        }
      });
    });
  }

  /* ---- smooth anchor scroll offset ---- */
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (id.length < 2) return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      const y = target.getBoundingClientRect().top + window.scrollY - 88;
      window.scrollTo({ top: y, behavior: 'smooth' });
    });
  });

  /* ---- FAQ accordion (smooth, one open at a time) ---- */
  document.querySelectorAll('.faq-list').forEach(list => {
    const items = Array.from(list.querySelectorAll('.faq-item'));
    items.forEach(item => {
      const btn = item.querySelector('.faq-question');
      const answer = item.querySelector('.faq-answer');
      if (!btn || !answer) return;
      btn.addEventListener('click', () => {
        const isOpen = item.classList.contains('is-open');
        items.forEach(other => {
          other.classList.remove('is-open');
          other.querySelector('.faq-answer').style.maxHeight = '';
        });
        if (!isOpen) {
          item.classList.add('is-open');
          answer.style.maxHeight = answer.scrollHeight + 'px';
        }
      });
    });
  });

  /* ======================================================================
     MODAL SYSTEM — generic multi-step popup (calculator / course sign-up)
     ====================================================================== */
  const overlays = document.querySelectorAll('.modal-overlay');

  const openModal = (name) => {
    const overlay = document.querySelector(`.modal-overlay[data-modal="${name}"]`);
    if (!overlay) return;
    overlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  };
  const closeModal = (overlay) => {
    overlay.classList.remove('is-open');
    document.body.style.overflow = '';
  };

  document.querySelectorAll('[data-open-modal]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openModal(btn.dataset.openModal);
    });
  });

  overlays.forEach(overlay => {
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(overlay); });
    overlay.querySelectorAll('[data-close-modal]').forEach(btn => btn.addEventListener('click', () => closeModal(overlay)));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(overlay); });

    const form = overlay.querySelector('[data-modal-form]');
    if (!form) return;

    const steps = Array.from(form.querySelectorAll('.form-step'));
    const progressWrap = overlay.querySelector('.modal-progress');
    const backBtn = overlay.querySelector('[data-action="back"]');
    const nextBtn = overlay.querySelector('[data-action="next"]');
    const submitBtn = overlay.querySelector('[data-action="submit"]');
    const successBox = overlay.querySelector('.modal-success');
    let current = 0;
    const state = {};

    // build progress dots — only meaningful when there is more than one step
    if (progressWrap) {
      if (steps.length > 1) {
        steps.forEach(() => {
          const dot = document.createElement('span');
          progressWrap.appendChild(dot);
        });
      } else {
        progressWrap.classList.add('is-hidden');
      }
    }

    // a step "requires" a choice if it contains an option-grid for a field with no value yet
    const stepIsComplete = (stepEl) => {
      const grids = Array.from(stepEl.querySelectorAll('.option-grid'));
      return grids.every(grid => !!state[grid.dataset.field]);
    };

    const render = () => {
      steps.forEach((s, i) => s.classList.toggle('is-active', i === current));
      if (progressWrap && steps.length > 1) {
        Array.from(progressWrap.children).forEach((dot, i) => dot.classList.toggle('is-done', i <= current));
      }
      if (backBtn) backBtn.style.display = current === 0 ? 'none' : 'inline-flex';
      const onLastStep = current === steps.length - 1;
      if (nextBtn) nextBtn.style.display = onLastStep ? 'none' : 'inline-flex';
      if (submitBtn) submitBtn.style.display = onLastStep ? 'inline-flex' : 'none';

      const activeBtn = onLastStep ? submitBtn : nextBtn;
      if (activeBtn) activeBtn.disabled = !stepIsComplete(steps[current]);
    };
    render();

    if (nextBtn) nextBtn.addEventListener('click', () => {
      if (!stepIsComplete(steps[current])) return;
      if (current < steps.length - 1) { current++; render(); }
    });
    if (backBtn) backBtn.addEventListener('click', () => { if (current > 0) { current--; render(); } });

    // option-card single-select
    form.querySelectorAll('.option-grid').forEach(grid => {
      const field = grid.dataset.field;
      grid.querySelectorAll('.option-card').forEach(card => {
        card.addEventListener('click', () => {
          grid.querySelectorAll('.option-card').forEach(c => c.classList.remove('is-selected'));
          card.classList.add('is-selected');
          state[field] = card.dataset.value;
          render();
        });
      });
    });

    // text inputs
    form.querySelectorAll('input[name], textarea[name]').forEach(input => {
      input.addEventListener('input', () => { state[input.name] = input.value; });
    });

    if (submitBtn) {
      submitBtn.addEventListener('click', () => {
        if (!stepIsComplete(steps[current])) return;

        const phoneField = form.querySelector('input[name="phone"]');
        if (phoneField && !phoneField.value.trim()) {
          phoneField.focus();
          phoneField.style.borderColor = '#b5544a';
          return;
        }

        const lines = [];
        form.querySelectorAll('[data-summary-label]').forEach(el => {
          const label = el.dataset.summaryLabel;
          const key = el.dataset.field || el.name;
          const value = key && state[key];
          if (value) lines.push(`${label}: ${value}`);
        });
        const formTitle = overlay.querySelector('.modal-box h3');
        const heading = formTitle ? formTitle.textContent : 'Нова заявка';
        const text = `Сайт HMBYNAD — ${heading}\n${window.location.pathname}\n\n${lines.join('\n')}`;

        const finish = () => {
          form.style.display = 'none';
          if (progressWrap) progressWrap.style.display = 'none';
          if (successBox) successBox.classList.add('is-active');
        };

        submitBtn.disabled = true;
        const originalLabel = submitBtn.textContent;
        submitBtn.textContent = 'Надсилаємо…';

        fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: TG_CHAT_ID, text })
        })
          .catch(() => { /* still show success — the lead data isn't lost on the page */ })
          .finally(() => {
            submitBtn.textContent = originalLabel;
            submitBtn.disabled = false;
            finish();
          });
      });
    }
  });

});
