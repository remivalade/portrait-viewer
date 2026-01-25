# Reusable "Made By" Module

This repository provides three versions of the "Made By" module.

1.  **Web Component:** Best for any website - Hugo, Jekyll, WordPress, plain HTML, or even React/Vue. Most portable option.
2.  **React Component:** Best for Next.js, Remix, Vite, or any React app with Tailwind CSS.
3.  **Universal HTML/CSS/JS:** Legacy version for static sites.

---

## 1. Web Component (`made-by-widget.js`) - Recommended

The most portable option. Works anywhere with a single `<script>` tag.

### Features

- **Shadow DOM encapsulation** - No CSS conflicts with your site
- **Glassmorphism effect** - Blur + transparency
- **Shine animation** - Sweep effect on the CTA button
- **Contact obfuscation** - Email and Telegram handles are not exposed in HTML
- **Auto source tracking** - Automatically detects hostname for analytics
- **Dark mode** - Auto-detects system preference or set manually

### Basic Usage

```html
<!-- Include the script (in head or before </body>) -->
<script src="path/to/made-by-widget.js"></script>

<!-- Use the component -->
<made-by-widget
  name="Rémi"
  linkedin="remivalade"
  twitter="remivalade"
  telegram="remivalade"
  email-user="remi.valade"
  email-domain="gmail.com"
></made-by-widget>
```

### All Attributes

| Attribute | Default | Description |
|-----------|---------|-------------|
| `name` | "Rémi" | Display name in greeting |
| `subtitle` | "Senior Marketer who likes to do things" | Tagline text |
| `label` | "Let's talk" | Text shown in collapsed state |
| `photo` | (default image) | Profile image URL |
| `linkedin` | - | LinkedIn username |
| `twitter` | - | X/Twitter username |
| `telegram` | - | Telegram handle (obfuscated) |
| `email-user` | - | Email username part (obfuscated) |
| `email-domain` | - | Email domain part (obfuscated) |
| `cta-text` | "Send an email" | CTA button text |
| `source` | (auto: hostname) | Custom source for tracking |
| `dark` | (auto-detects) | Force dark mode |

### Usage in Hugo

```html
<!-- In layouts/partials/footer.html or layouts/_default/baseof.html -->
<script src="{{ "js/made-by-widget.js" | relURL }}"></script>
<made-by-widget
  name="Rémi"
  linkedin="remivalade"
  twitter="remivalade"
  telegram="remivalade"
  email-user="remi.valade"
  email-domain="gmail.com"
  source="hugo-blog"
></made-by-widget>
```

### Self-Hosting

1. Copy `universal/made-by-widget.js` to your static assets folder
2. Reference it with a `<script>` tag
3. Add the `<made-by-widget>` element anywhere in your HTML

### CDN Hosting (for multiple sites)

Host the JS file on any CDN (jsDelivr, unpkg, Cloudflare, your own server) and reference it from all your sites:

```html
<script src="https://your-cdn.com/made-by-widget.js"></script>
```

### Security: Contact Obfuscation

Email and Telegram handles are **never exposed in the HTML source**. They are constructed in JavaScript only when the user clicks, preventing bot scraping.

---

## 2. React Component (`MadeBy.jsx`)

Perfect for modern React applications using Tailwind CSS.

### Usage

1.  Copy `frontend/src/components/MadeBy.jsx` into your project.
2.  Import it:
    ```jsx
    import MadeBy from './components/MadeBy';

    // ... inside your component
    <MadeBy isDarkMode={true} />
    ```

---

## 3. Universal Version (HTML/CSS) - Legacy

For static sites where you prefer inline HTML over a Web Component.

### Usage in Hugo

1.  Create a new partial file: `layouts/partials/made-by.html`.
2.  Copy the content of `universal/made-by.html` into that file.
3.  Include it in your footer template (e.g., `layouts/partials/footer.html`):
    ```html
    {{ partial "made-by.html" . }}
    ```

### Usage in Plain HTML

Simply copy the entire content of `universal/made-by.html` and paste it just before the closing `</body>` tag of your website.

### Customization

*   **Dark Mode:** The script automatically detects system preference. To force dark mode, add the class `dark` to the outer div:
    ```html
    <div id="made-by-component" class="made-by-component dark">
    ```
*   **Links/Images:** Edit the HTML directly to change the profile picture, name, or social links.

### Note

This version does not include the shine animation or contact obfuscation. Consider using the Web Component version instead.
