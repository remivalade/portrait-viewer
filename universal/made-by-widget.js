/**
 * Made By Widget - Web Component
 *
 * A portable, self-contained floating contact widget with glassmorphism effect.
 *
 * Usage:
 *   <script src="made-by-widget.js"></script>
 *   <made-by-widget
 *     name="Rémi"
 *     subtitle="Senior Marketer who likes to do things"
 *     photo="https://..."
 *     linkedin="remivalade"
 *     twitter="remivalade"
 *     telegram="remivalade"
 *     email-user="remi.valade"
 *     email-domain="gmail.com"
 *     source="my-site"
 *     dark
 *   ></made-by-widget>
 *
 * Attributes:
 *   - name: Display name (default: "Rémi")
 *   - subtitle: Tagline text (default: "Senior Marketer who likes to do things")
 *   - label: Collapsed state text (default: "Let's talk")
 *   - photo: Profile image URL
 *   - linkedin: LinkedIn username (optional)
 *   - twitter: X/Twitter username (optional)
 *   - telegram: Telegram handle (optional, obfuscated)
 *   - email-user: Email username part (optional, obfuscated)
 *   - email-domain: Email domain part (optional, obfuscated)
 *   - cta-text: Call-to-action button text (default: "Send an email")
 *   - source: Custom source for tracking (default: auto-detects hostname)
 *   - dark: Add this attribute for dark mode (or auto-detects system preference)
 */

class MadeByWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.isOpen = false;
  }

  static get observedAttributes() {
    return ['dark'];
  }

  connectedCallback() {
    this.render();
    this.setupEventListeners();
    this.setupDarkMode();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'dark') {
      this.updateDarkMode();
    }
  }

  // Getters for attributes with defaults
  get name() { return this.getAttribute('name') || 'Rémi'; }
  get subtitle() { return this.getAttribute('subtitle') || 'Senior Marketer who likes to do things'; }
  get label() { return this.getAttribute('label') || "Let's talk"; }
  get photo() { return this.getAttribute('photo') || 'https://irys.portrait.host/FEQnDav4onGWwukVL1-p1ytDMaZu6Cai0AxvUPMRemw'; }
  get linkedin() { return this.getAttribute('linkedin'); }
  get twitter() { return this.getAttribute('twitter'); }
  get telegram() { return this.getAttribute('telegram'); }
  get emailUser() { return this.getAttribute('email-user'); }
  get emailDomain() { return this.getAttribute('email-domain'); }
  get ctaText() { return this.getAttribute('cta-text') || 'Send an email'; }
  get source() {
    return this.getAttribute('source') || window.location.hostname;
  }

  setupDarkMode() {
    const container = this.shadowRoot.querySelector('.widget');

    // Check for explicit dark attribute
    if (this.hasAttribute('dark')) {
      container.classList.add('dark');
      return;
    }

    // Auto-detect system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      container.classList.add('dark');
    }

    // Listen for changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!this.hasAttribute('dark')) {
        container.classList.toggle('dark', e.matches);
      }
    });
  }

  updateDarkMode() {
    const container = this.shadowRoot.querySelector('.widget');
    if (container) {
      container.classList.toggle('dark', this.hasAttribute('dark'));
    }
  }

  setupEventListeners() {
    const widget = this.shadowRoot.querySelector('.widget');
    const emailBtn = this.shadowRoot.querySelector('.cta-btn');
    const telegramLink = this.shadowRoot.querySelector('.social-telegram');

    // Toggle open/close
    widget.addEventListener('click', (e) => {
      if (e.target.closest('a') || e.target.closest('button')) {
        return;
      }
      this.isOpen = !this.isOpen;
      widget.classList.toggle('open', this.isOpen);
    });

    // Obfuscated email handler
    if (emailBtn && this.emailUser && this.emailDomain) {
      emailBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const user = this.emailUser;
        const domain = this.emailDomain;
        const source = this.source;
        window.location.href = `mailto:${user}@${domain}?subject=Contact from ${source}`;
      });
    }

    // Obfuscated telegram handler
    if (telegramLink) {
      telegramLink.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const handle = this.telegram;
        window.open(`https://t.me/${handle}`, '_blank');
      });
    }
  }

  render() {
    const styles = `
      <style>
        :host {
          display: block;
          position: fixed;
          bottom: 1rem;
          right: 1rem;
          z-index: 9999;
          font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        }

        .widget {
          border-radius: 0.5rem;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
          transition: all 0.3s ease-in-out;
          overflow: hidden;
          cursor: pointer;
          background-color: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }

        .widget.dark {
          background-color: rgba(17, 24, 39, 0.8);
          color: #f3f4f6;
        }

        .widget:hover {
          box-shadow: 0 0 0 2px rgba(168, 85, 247, 0.5);
        }

        /* Collapsed State */
        .header {
          display: flex;
          align-items: center;
          padding: 0.5rem;
          gap: 0.5rem;
        }

        .avatar-sm {
          width: 1.5rem;
          height: 1.5rem;
          border-radius: 9999px;
          border: 1px solid rgba(75, 85, 99, 0.5);
          object-fit: cover;
        }

        .label {
          font-size: 0.75rem;
          font-weight: 500;
          color: #1f2937;
          white-space: nowrap;
        }

        .widget.dark .label {
          color: #e5e7eb;
        }

        .chevron {
          width: 1rem;
          height: 1rem;
          color: #6b7280;
          transition: transform 0.2s;
        }

        .widget.dark .chevron {
          color: #9ca3af;
        }

        /* Expanded State */
        .content {
          display: none;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 1rem;
          width: 12rem;
        }

        .widget.open .header {
          display: none;
        }

        .widget.open .content {
          display: flex;
        }

        .top-row {
          display: flex;
          justify-content: space-between;
          width: 100%;
          align-items: center;
          margin-bottom: 0.75rem;
        }

        .avatar-lg {
          width: 4rem;
          height: 4rem;
          border-radius: 9999px;
          border: 2px solid rgba(75, 85, 99, 0.7);
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          object-fit: cover;
        }

        .chevron-up {
          transform: rotate(180deg);
        }

        .title {
          font-size: 0.875rem;
          font-weight: 500;
          margin: 0 0 0.25rem 0;
          color: #1f2937;
        }

        .widget.dark .title {
          color: #f3f4f6;
        }

        .subtitle {
          font-size: 0.75rem;
          margin: 0 0 0.75rem 0;
          color: #4b5563;
        }

        .widget.dark .subtitle {
          color: #d1d5db;
        }

        /* Social Icons */
        .socials {
          display: flex;
          justify-content: center;
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .social-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.25rem;
          border-radius: 0.375rem;
          border: 1px solid transparent;
          transition: all 0.2s ease-in-out;
          color: #9ca3af;
          cursor: pointer;
          text-decoration: none;
          background: none;
        }

        .social-icon:hover {
          transform: scale(1.1);
          border-color: rgba(168, 85, 247, 0.5);
        }

        .social-icon svg {
          width: 1.25rem;
          height: 1.25rem;
        }

        .social-linkedin:hover { color: #0077b5; }
        .social-x:hover { color: #000000; }
        .widget.dark .social-x:hover { color: #ffffff; }
        .social-telegram:hover { color: #0088cc; }

        /* CTA Button with Shine Effect */
        .cta-btn {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          padding: 0.375rem 0.75rem;
          border: 1px solid #4b5563;
          color: #f3f4f6;
          font-size: 0.75rem;
          font-family: inherit;
          border-radius: 0.375rem;
          overflow: hidden;
          text-decoration: none;
          background: linear-gradient(to right, #a855f7, #f97316, #eab308);
          transition: all 0.3s;
          box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
          cursor: pointer;
        }

        .cta-btn:hover {
          color: #ffffff;
          box-shadow: 0 10px 15px -3px rgba(168, 85, 247, 0.2);
        }

        .cta-btn span {
          position: relative;
          z-index: 10;
        }

        /* Shine Effect */
        .cta-shine {
          position: absolute;
          top: 0;
          right: 0;
          width: 2.5rem;
          height: 100%;
          background: rgba(255, 255, 255, 0.2);
          transform: rotate(12deg) translateX(3rem);
          transition: transform 0.7s ease-out;
        }

        .cta-btn:hover .cta-shine {
          transform: rotate(12deg) translateX(-14rem);
        }
      </style>
    `;

    // Build social links HTML
    let socialsHtml = '';

    if (this.linkedin) {
      socialsHtml += `
        <a href="https://www.linkedin.com/in/${this.linkedin}/" target="_blank" rel="noopener noreferrer" class="social-icon social-linkedin" title="LinkedIn">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
            <rect width="4" height="12" x="2" y="9"/>
            <circle cx="4" cy="4" r="2"/>
          </svg>
        </a>
      `;
    }

    if (this.twitter) {
      socialsHtml += `
        <a href="https://x.com/${this.twitter}" target="_blank" rel="noopener noreferrer" class="social-icon social-x" title="X">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 452" fill="currentColor">
            <path d="M394.033.25h76.67L303.202 191.693l197.052 260.511h-154.29L225.118 294.205 86.844 452.204H10.127l179.16-204.77L.254.25H158.46l109.234 144.417zm-26.908 406.063h42.483L135.377 43.73h-45.59z"/>
          </svg>
        </a>
      `;
    }

    if (this.telegram) {
      socialsHtml += `
        <button type="button" class="social-icon social-telegram" title="Telegram">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.2,4.4L2.9,10.7c-1.1,0.4-1.1,1.1-0.2,1.3l4.1,1.3l1.6,4.8c0.2,0.5,0.1,0.7,0.6,0.7c0.4,0,0.6-0.2,0.8-0.4c0.1-0.1,1-1,2-2l4.2,3.1c0.8,0.4,1.3,0.2,1.5-0.7l2.8-13.1C20.6,4.6,19.9,4,19.2,4.4z M17.1,7.4l-7.8,7.1L9,17.8L7.4,13l9.2-5.8C17,6.9,17.4,7.1,17.1,7.4z"/>
          </svg>
        </button>
      `;
    }

    // CTA button - uses button if email is configured, otherwise a link
    let ctaHtml = '';
    if (this.emailUser && this.emailDomain) {
      ctaHtml = `
        <button type="button" class="cta-btn">
          <span class="cta-shine"></span>
          <span>${this.ctaText}</span>
        </button>
      `;
    }

    const html = `
      <div class="widget">
        <!-- Collapsed State -->
        <div class="header">
          <img src="${this.photo}" alt="Profile" class="avatar-sm">
          <span class="label">${this.label}</span>
          <svg xmlns="http://www.w3.org/2000/svg" class="chevron" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
          </svg>
        </div>

        <!-- Expanded State -->
        <div class="content">
          <div class="top-row">
            <img src="${this.photo}" alt="Profile" class="avatar-lg">
            <svg xmlns="http://www.w3.org/2000/svg" class="chevron chevron-up" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
            </svg>
          </div>

          <p class="title">Hi, I'm ${this.name}.</p>
          <p class="subtitle">${this.subtitle}</p>

          <div class="socials">
            ${socialsHtml}
          </div>

          ${ctaHtml}
        </div>
      </div>
    `;

    this.shadowRoot.innerHTML = styles + html;
  }
}

// Register the custom element
customElements.define('made-by-widget', MadeByWidget);
