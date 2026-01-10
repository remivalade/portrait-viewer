# Reusable "Made By" Module

This repository provides two versions of the "Made By" module.

1.  **React Component:** Best for Next.js, Remix, Vite, or any React app.
2.  **Universal HTML/CSS/JS:** Best for static sites (Hugo, Jekyll), WordPress, or plain HTML.

---

## 1. React Component (`MadeBy.jsx`)

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

## 2. Universal Version (HTML/CSS)

Perfect for Hugo, Jekyll, Ghost, WordPress, or any non-React site.

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
