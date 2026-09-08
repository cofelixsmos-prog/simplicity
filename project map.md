# Project Map

This project is a small modular website for Simplicity.

## Structure

```text
simplicity/
├── index.html
├── style.css
├── main.js
├── package.json
├── project map.md
├── sections/
│   ├── nav.html
│   ├── hero.html
│   ├── works.html
│   ├── product.html
│   └── harness.html
├── scripts/
│   ├── wordmark.js
│   ├── pixel-field.js
│   └── swarm.js
└── assets/
```

## Main Files

- `index.html` - The main HTML shell. It loads the stylesheet and JavaScript entry point.
- `style.css` - All page styling, layout, colors, responsive rules, and animations.
- `main.js` - Loads the HTML sections in order and starts the page interactions.
- `package.json` - Project configuration and available commands or dependencies.
- `project map.md` - This guide to the project structure.

## Sections

- `sections/nav.html` - Navigation bar, menus, theme button, and account buttons.
- `sections/hero.html` - Main introduction area with the wordmark and calls to action.
- `sections/works.html` - Featured work area and video card.
- `sections/product.html` - Simplicity Work features such as slides, documents, and PDFs.
- `sections/harness.html` - Harness explanation, agent visualization, and workflow steps.

## Scripts

- `scripts/wordmark.js` - Builds and animates the dot-based wordmarks.
- `scripts/pixel-field.js` - Creates the animated pixel field in the hero section.
- `scripts/swarm.js` - Creates the agent swarm visualization in the Harness section.

## Assets

- `assets/` - Place images, videos, fonts, and other static files here.

## How It Fits Together

1. The browser opens `index.html`.
2. `style.css` provides the shared design.
3. `main.js` loads the files in `sections/`.
4. `main.js` then loads the files in `scripts/`.
5. The finished page appears as one complete website.
