/* Shared date picker for Portal and embedded service shadow roots. */
(() => {
  'use strict';
  const selector = 'input[type="date"],input[type="datetime-local"]';
  const pad = n => String(n).padStart(2, '0');
  const iso = date => String(date.getFullYear()).padStart(4, '0') + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  const calendarDate = (year, month, day) => {
    const date = new Date(0);
    date.setFullYear(year, month, day);
    date.setHours(12, 0, 0, 0);
    return date;
  };
  const parse = value => {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || '');
    if (!match) return null;
    const date = calendarDate(+match[1], +match[2] - 1, +match[3]);
    return iso(date) === match[0] ? date : null;
  };
  const shift = (date, days) => { const next = new Date(date); next.setDate(next.getDate() + days); return next; };
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let active;

  function close(restore = true) {
    if (!active) return;
    const { panel, trigger, onClose } = active;
    active = null;
    panel.close();
    panel.remove();
    onClose?.();
    if (restore && trigger.isConnected) trigger.focus({ preventScroll: true });
  }

  function open(trigger, root, commit) {
    if (trigger.disabled || trigger.readOnly) return;
    close(false);
    const key = trigger.dataset.calendarRange;
    const candidates = key ? [...root.querySelectorAll(selector)].filter(input => input.dataset.calendarRange === key && !input.disabled && !input.readOnly) : [trigger];
    const start = candidates.find(input => input.dataset.calendarEdge === 'start') || trigger;
    const end = candidates.find(input => input.dataset.calendarEdge === 'end');
    const inputs = end && end !== start ? [start, end] : [trigger];
    const range = inputs.length === 2;
    const timed = inputs.some(input => input.type === 'datetime-local');
    const values = inputs.map(input => input.value.slice(0, 10));
    const times = inputs.map((input, index) => input.value.slice(11, 16) || (index ? '17:00' : '09:00'));
    const lower = (range ? start.min : trigger.min).slice(0, 10);
    const upper = (range ? end.max : trigger.max).slice(0, 10);
    let edge = range && trigger === end ? 1 : 0;
    let focused = values[edge] || values[0] || iso(new Date());
    let month = parse(focused) || new Date();
    month = calendarDate(month.getFullYear(), month.getMonth(), 1);
    let choosingPeriod = false;
    let yearDraft = String(month.getFullYear());
    const panel = document.createElement('dialog');
    panel.className = 'quiet-calendar';
    panel.setAttribute('aria-labelledby', 'quiet-calendar-title');
    const fieldLabel = trigger.labels?.[0]?.textContent?.trim() || trigger.getAttribute('aria-label') || 'Choose date';
    const zone = /\bUTC\b/.test(fieldLabel) ? ' (UTC)' : '';
    const available = value => (!lower || value >= lower) && (!upper || value <= upper);
    const firstYear = lower ? +lower.slice(0, 4) : 1;
    const lastYear = upper ? +upper.slice(0, 4) : 9999;
    const validYear = () => Number.isInteger(+yearDraft) && +yearDraft >= firstYear && +yearDraft <= lastYear;
    const monthAvailable = (year, index) => {
      const first = calendarDate(year, index, 1);
      const last = new Date(first); last.setMonth(last.getMonth() + 1); last.setDate(0);
      return (!lower || iso(last) >= lower) && (!upper || iso(first) <= upper);
    };
    const state = { panel, trigger, root };
    active = state;
    trigger.setAttribute('aria-expanded', 'true');
    state.onClose = () => trigger.removeAttribute('aria-expanded');

    function position() {
      if (!trigger.isConnected) { close(false); return; }
      const anchor = trigger.getBoundingClientRect();
      const rect = panel.getBoundingClientRect();
      panel.style.left = `${Math.max(12, Math.min(anchor.left, innerWidth - rect.width - 12))}px`;
      panel.style.top = `${Math.max(12, Math.min(anchor.bottom + 12, innerHeight - rect.height - 12))}px`;
      panel.style.setProperty('--quiet-pointer', `${Math.max(24, Math.min(anchor.left + 28 - parseFloat(panel.style.left), rect.width - 24))}px`);
    }

    function render(focusDay = false) {
      const first = calendarDate(month.getFullYear(), month.getMonth(), 1);
      const count = calendarDate(month.getFullYear(), month.getMonth() + 1, 0).getDate();
      const cells = Array.from({ length: Math.ceil((first.getDay() + count) / 7) * 7 }, (_, index) => {
        const day = index - first.getDay() + 1;
        if (day < 1 || day > count) return '<span role="gridcell" class="quiet-calendar-blank"></span>';
        const date = calendarDate(month.getFullYear(), month.getMonth(), day);
        const value = iso(date);
        const selected = values.includes(value);
        const between = range && values[0] && values[1] && value > values[0] && value < values[1];
        const completeRange = range && values[0] && values[1];
        const classes = [selected ? 'is-selected' : '', between ? 'is-between' : '', completeRange && value === values[0] ? 'is-start' : '', completeRange && value === values[1] ? 'is-end' : ''].filter(Boolean).join(' ');
        return `<button type="button" role="gridcell" class="${classes}" data-date="${value}" tabindex="${value === focused ? 0 : -1}" aria-label="${date.toLocaleDateString('en-US', {weekday:'long',month:'long',day:'numeric',year:'numeric'})}" aria-selected="${selected}" ${value === iso(new Date()) ? 'aria-current="date"' : ''} ${available(value) ? '' : 'disabled'}>${day}</button>`;
      });
      const rows = [];
      for (let i = 0; i < cells.length; i += 7) rows.push(`<div role="row">${cells.slice(i, i + 7).join('')}</div>`);
      const periodChooser = `<div class="quiet-calendar-month-head"><button type="button" data-action="previous-year" aria-label="Previous year" ${+yearDraft <= firstYear ? 'disabled' : ''}>‹</button><label class="quiet-calendar-year">Year<input type="number" aria-label="Year" data-year min="${firstYear}" max="${lastYear}" step="1" value="${escape(yearDraft)}"></label><button type="button" data-action="next-year" aria-label="Next year" ${+yearDraft >= lastYear ? 'disabled' : ''}>›</button></div><div class="quiet-calendar-months" role="group" aria-label="Choose a month">${Array.from({length:12}, (_, index) => `<button type="button" data-month="${index}" aria-pressed="${month.getMonth() === index && month.getFullYear() === +yearDraft}" ${validYear() && monthAvailable(+yearDraft, index) ? '' : 'disabled'}>${new Date(2025, index, 1).toLocaleDateString('en-US', {month:'short'})}</button>`).join('')}</div><button type="button" data-action="choose-period" class="quiet-calendar-today">Back to dates</button>`;
      const dayChooser = `<div class="quiet-calendar-month-head"><button type="button" data-action="previous" aria-label="Previous month">‹</button><h3 aria-live="polite" aria-label="${month.toLocaleDateString('en-US', {month: 'long', year: 'numeric'})}"><button type="button" data-action="choose-period" aria-label="Choose month and year" aria-expanded="false">${month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} <span aria-hidden="true">⌄</span></button></h3><button type="button" data-action="next" aria-label="Next month">›</button></div><div class="quiet-calendar-grid" role="grid" aria-label="Choose a date"><div role="row" class="quiet-calendar-weekdays">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day => `<span role="columnheader">${day}</span>`).join('')}</div>${rows.join('')}</div><button type="button" class="quiet-calendar-today" data-action="today">Today</button>`;
      panel.innerHTML = `<header><div><h2 id="quiet-calendar-title">Calendar</h2><p>${range ? 'Select a date range' : 'Select a date'}${timed ? ' and time' : ''}${zone}.</p></div><button type="button" class="quiet-calendar-close" data-action="cancel" aria-label="Close calendar">×</button></header>
        <div class="quiet-calendar-layout"><section class="quiet-calendar-month">${choosingPeriod ? periodChooser : dayChooser}</section>
        ${range ? `<div class="quiet-calendar-edges"><button type="button" data-edge="0" aria-pressed="${edge === 0}">Start date</button><button type="button" data-edge="1" aria-pressed="${edge === 1}">End date</button></div><p class="quiet-calendar-hint">Choose the ${edge ? 'end' : 'start'} date.</p>` : ''}
        ${timed ? `<div class="quiet-calendar-times"><span class="quiet-calendar-label">${range ? 'Time range' : 'Time'}${zone}</span><div>${inputs.map((input, i) => `<label>${range ? (i ? 'End time' : 'Start time') : 'Time'}<input type="time" data-time="${i}" value="${times[i]}" step="${escape(input.step || '60')}"></label>`).join('<span aria-hidden="true">–</span>')}</div></div>${range ? '<div class="quiet-calendar-presets"><button type="button" data-preset="00:00,23:59">All day</button><button type="button" data-preset="09:00,17:00">09:00 – 17:00</button><button type="button" data-preset="00:00,12:00">00:00 – 12:00</button><button type="button" data-preset="12:00,23:59">12:00 – 24:00</button></div>' : ''}` : ''}
        <p class="quiet-calendar-error" role="alert"></p></div><footer><button type="button" data-action="clear" ${inputs.some(input => input.required) ? 'disabled' : ''}>Clear</button><div><button type="button" data-action="cancel">Cancel</button><button type="button" class="quiet-calendar-apply" data-action="apply">Apply</button></div></footer>`;
      // Always offer a tab stop, including when the selected date is in another month.
      if (!panel.querySelector('[data-date][tabindex="0"]:not(:disabled)')) {
        const firstEnabled = panel.querySelector('[data-date]:not(:disabled)');
        if (firstEnabled) { firstEnabled.tabIndex = 0; focused = firstEnabled.dataset.date; }
      }
      if (panel.open) position();
      if (focusDay) panel.querySelector('[data-date][tabindex="0"]')?.focus({ preventScroll: true });
    }

    function apply() {
      const proposed = inputs.map((input, i) => values[i] ? values[i] + (input.type === 'datetime-local' ? 'T' + times[i] : '') : '');
      let message = '';
      if (proposed.some((value, i) => !value && inputs[i].required)) message = 'Choose a date before applying.';
      else if (inputs.some((input, i) => input.type === 'datetime-local' && values[i] && !times[i])) message = 'Choose a time before applying.';
      else if (values.some(value => value && !available(value))) message = 'Choose a date within the allowed dates.';
      else if (range && proposed[0] && proposed[1] && proposed[0] > proposed[1]) message = 'The end must be on or after the start.';
      else if (range && ((proposed[0] && start.min && proposed[0] < start.min) || (proposed[1] && end.max && proposed[1] > end.max))) message = 'Choose a date and time within the allowed range.';
      else if (inputs.some((input, i) => {
        const probe = input.cloneNode();
        probe.removeAttribute('min'); probe.removeAttribute('max');
        if (!range) { probe.min = input.min; probe.max = input.max; }
        probe.value = proposed[i];
        return !probe.validity.valid;
      })) message = 'Choose a valid date and time.';
      if (message) { panel.querySelector('.quiet-calendar-error').textContent = message; return; }
      // Close before committing: a React update may unmount the source fields.
      close(false);
      inputs.forEach((input, i) => {
        if (!input.isConnected) return;
        const update = () => {
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, proposed[i]);
          input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
          input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
        };
        commit ? commit(update) : update();
      });
      if (trigger.isConnected) trigger.focus({ preventScroll: true });
    }

    panel.addEventListener('click', event => {
      event.stopPropagation();
      const button = event.target.closest('button');
      if (!button) { if (event.target === panel) { const r = panel.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) close(); } return; }
      const action = button.dataset.action;
      if (action === 'cancel') return close();
      if (action === 'apply') return apply();
      if (action === 'choose-period') {
        choosingPeriod = !choosingPeriod; yearDraft = String(month.getFullYear()); render();
        panel.querySelector(choosingPeriod ? '[data-year]' : '[data-action="choose-period"]')?.focus({preventScroll:true});
        if (choosingPeriod) panel.querySelector('[data-year]').select();
        return;
      }
      if (action === 'previous-year' || action === 'next-year') {
        const year = (validYear() ? +yearDraft : month.getFullYear()) + (action === 'next-year' ? 1 : -1);
        yearDraft = String(Math.max(firstYear, Math.min(lastYear, year)));
        render(); panel.querySelector(`[data-action="${action}"]`)?.focus(); return;
      }
      if (button.dataset.month !== undefined) {
        if (!validYear()) return;
        month.setFullYear(+yearDraft, +button.dataset.month, 1);
        focused = iso(month); choosingPeriod = false; render(true); return;
      }
      if (action === 'clear') { values.fill(''); render(); return; }
      if (button.dataset.edge) { edge = +button.dataset.edge; render(); panel.querySelector(`[data-edge="${edge}"]`)?.focus(); return; }
      if (button.dataset.preset) { times.splice(0, 2, ...button.dataset.preset.split(',')); render(); return; }
      if (action === 'previous' || action === 'next') {
        month.setMonth(month.getMonth() + (action === 'next' ? 1 : -1));
        focused = iso(month); render(); panel.querySelector(`[data-action="${action}"]`).focus(); return;
      }
      const value = action === 'today' ? iso(new Date()) : button.dataset.date;
      if (!value || !available(value)) return;
      values[edge] = value;
      if (range && values[0] && values[1] && values[0] > values[1]) values.reverse();
      focused = value;
      month = parse(value); month.setDate(1);
      if (range) edge = edge ? 0 : 1;
      render(true);
    });
    panel.addEventListener('input', event => {
      if (event.target.matches('[data-time]')) times[+event.target.dataset.time] = event.target.value;
      if (event.target.matches('[data-year]')) {
        yearDraft = event.target.value;
        panel.querySelectorAll('[data-month]').forEach(button => {
          button.disabled = !validYear() || !monthAvailable(+yearDraft, +button.dataset.month);
          button.setAttribute('aria-pressed', String(month.getFullYear() === +yearDraft && month.getMonth() === +button.dataset.month));
        });
        panel.querySelector('[data-action="previous-year"]').disabled = !validYear() || +yearDraft <= firstYear;
        panel.querySelector('[data-action="next-year"]').disabled = !validYear() || +yearDraft >= lastYear;
        panel.querySelector('.quiet-calendar-error').textContent = validYear() ? '' : `Choose a year from ${firstYear} to ${lastYear}.`;
      }
    });
    panel.addEventListener('keydown', event => {
      event.stopPropagation();
      if (event.target.matches('[data-year]') && event.key === 'Enter') {
        event.preventDefault();
        if (validYear()) panel.querySelector('[data-month]:not(:disabled)')?.focus();
        return;
      }
      const cell = event.target.closest('[data-date]');
      if (!cell) return;
      const date = parse(cell.dataset.date);
      let next;
      const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
      if (Object.hasOwn(offsets, event.key)) next = shift(date, offsets[event.key]);
      if (event.key === 'Home') next = shift(date, -date.getDay());
      if (event.key === 'End') next = shift(date, 6 - date.getDay());
      if (event.key === 'PageUp' || event.key === 'PageDown') {
        next = new Date(date); next.setDate(1); next.setMonth(next.getMonth() + (event.key === 'PageDown' ? 1 : -1) * (event.shiftKey ? 12 : 1));
        next.setDate(Math.min(date.getDate(), calendarDate(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
      }
      if (!next) return;
      event.preventDefault();
      if (!available(iso(next))) return;
      focused = iso(next); month = calendarDate(next.getFullYear(), next.getMonth(), 1); render(true);
    });
    panel.addEventListener('cancel', event => { event.preventDefault(); close(); });
    render();
    document.body.append(panel);
    panel.showModal();
    position();
    panel.querySelector('[data-date][tabindex="0"]')?.focus({ preventScroll: true });
  }

  function mount(root, options = {}) {
    const decorate = () => root.querySelectorAll(selector).forEach(input => input.setAttribute('aria-haspopup', 'dialog'));
    decorate();
    const inputFor = event => event.target instanceof HTMLInputElement && event.target.matches(selector) ? event.target : null;
    const pointer = event => {
      const input = inputFor(event);
      if (input && !input.disabled && !input.readOnly && event.button === 0) event.preventDefault();
    };
    const click = event => {
      const input = inputFor(event);
      if (!input || input.disabled || input.readOnly) return;
      event.preventDefault(); open(input, root, options.commit);
    };
    const key = event => {
      const input = inputFor(event);
      if (input && !input.disabled && !input.readOnly && (event.key === 'Enter' || event.key === ' ' || (event.altKey && event.key === 'ArrowDown'))) {
        event.preventDefault(); open(input, root, options.commit);
      }
    };
    root.addEventListener('pointerdown', pointer, true);
    root.addEventListener('click', click, true);
    root.addEventListener('keydown', key, true);
    const observer = new MutationObserver(() => { decorate(); if (active?.root === root && !active.trigger.isConnected) close(false); });
    observer.observe(root, { childList: true, subtree: true });
    return () => {
      if (active?.root === root) close(false);
      observer.disconnect();
      root.removeEventListener('pointerdown', pointer, true);
      root.removeEventListener('click', click, true);
      root.removeEventListener('keydown', key, true);
    };
  }
  window.BobosCalendar = { mount, close, version: '3' };
  mount(document);
  window.addEventListener('resize', () => close());
  window.addEventListener('popstate', () => close(false));
})();
