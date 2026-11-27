(() => {
  const titles = {
    success: "Success",
    error: "Action failed",
    warning: "Needs attention",
    info: "Update",
  };
  const duration = 7000;

  function resultFor(tone, text) {
    if (tone === "error") return { name: "failed", title: "Action failed" };
    if (tone === "warning") return { name: "warning", title: "Needs attention" };
    if (/\b(?:deleted|removed|discarded)\b/i.test(text)) return { name: "deleted", title: /draft/i.test(text) ? "Draft deleted" : /request/i.test(text) ? "Request deleted" : "Item deleted" };
    if (tone === "success") {
      const labels = [
        [/decision.*(?:saved|recorded)|^submit decision\b/i, "Decision saved"],
        [/^save sections\b|sections.*(?:saved|updated)/i, "Sections saved"],
        [/preferences.*(?:saved|updated)/i, "Preferences saved"],
        [/draft.*saved|^save draft\b/i, "Draft saved"],
        [/\brestored\b/i, "Item restored"],
        [/\b(?:synced|synchronized)\b/i, "Calendar synced"],
        [/\bsaved\b/i, "Changes saved"],
        [/\bupdated\b/i, "Changes updated"],
      ];
      return { name: "saved", title: labels.find(([pattern]) => pattern.test(text))?.[1] || "Done" };
    }
    return { name: "info", title: "Update" };
  }

  class PortalActionFeedback extends HTMLElement {
    #timer;
    #returnFocus;

    connectedCallback() {
      if (this.card) return;
      this.innerHTML = `
        <div class="action-feedback-announcement" role="status" aria-atomic="true"></div>
        <div class="action-feedback-announcement" role="alert" aria-atomic="true"></div>
        <div class="action-feedback-card" hidden>
          <span class="action-feedback-icon" aria-hidden="true"></span>
          <div><strong></strong><p class="action-feedback-message"></p></div>
          <button type="button" class="action-feedback-dismiss" aria-label="Dismiss feedback">×</button>
        </div>`;
      this.card = this.querySelector(".action-feedback-card");
      this.heading = this.card.querySelector("strong");
      this.message = this.card.querySelector("p");
      this.statusRegion = this.querySelector('[role="status"]');
      this.alertRegion = this.querySelector('[role="alert"]');
      this.card.querySelector("button").addEventListener("click", () => this.clear());
      this.card.addEventListener("pointerenter", () => clearTimeout(this.#timer));
      this.card.addEventListener("pointerleave", () => this.#scheduleDismissal());
      this.card.addEventListener("focusin", () => clearTimeout(this.#timer));
      this.card.addEventListener("focusout", (event) => {
        if (!this.card.contains(event.relatedTarget)) this.#scheduleDismissal(true);
      });
    }

    disconnectedCallback() { clearTimeout(this.#timer); }

    show(tone, text, options = {}) {
      if (!text) return;
      const kind = Object.hasOwn(titles, tone) ? tone : "info";
      if (!this.card.contains(document.activeElement)) this.#returnFocus = document.activeElement;
      this.card.dataset.tone = kind;
      this.card.toggleAttribute("data-compact", Boolean(options.compact));
      this.message.hidden = Boolean(options.compact);
      const result = resultFor(kind, text);
      this.card.dataset.result = result.name;
      const bookmark = kind === "success" && /(?:draft|preferences?|bookmark|favourites?|favorites?).*(?:saved|updated)|(?:saved|updated).*(?:draft|preferences?|bookmark|favourites?|favorites?)/i.test(text);
      this.card.dataset.variant = options.variant || (bookmark ? "bookmark" : "dock");
      this.card.getAnimations().forEach(animation => animation.cancel());
      this.card.classList.remove("feedback-enter");
      void this.card.offsetWidth;
      this.card.classList.add("feedback-enter");
      this.heading.textContent = options.title || result.title;
      this.message.textContent = text;
      this.card.hidden = false;

      const announcement = options.compact ? text : `${this.heading.textContent}. ${this.message.textContent}`;
      const error = kind === "error";
      this.statusRegion.textContent = error ? "" : announcement;
      this.alertRegion.textContent = error ? announcement : "";
      this.#scheduleDismissal();
    }

    clear() {
      clearTimeout(this.#timer);
      const restoreFocus = this.card.contains(document.activeElement);
      this.card.hidden = true;
      this.statusRegion.textContent = "";
      this.alertRegion.textContent = "";
      if (restoreFocus && this.#returnFocus?.isConnected) this.#returnFocus.focus({ preventScroll: true });
      this.#returnFocus = null;
    }

    #scheduleDismissal(leavingFocus = false) {
      clearTimeout(this.#timer);
      if (this.card.hidden || !["success", "info"].includes(this.card.dataset.tone)) return;
      if (this.card.matches(":hover") || (!leavingFocus && this.card.matches(":focus-within"))) return;
      this.#timer = setTimeout(() => this.clear(), duration);
    }
  }

  customElements.define("portal-action-feedback", PortalActionFeedback);
})();
