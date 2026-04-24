# Active context

*Last updated: 2026-04-24*

## Current focus

1. **Shippable single-file build** — `npm run bundle` runs `scripts/bundle-html.mjs` to emit **Metrology Data Analyzer Ver 1.6.html** (inlined CSS + concatenated JS; CDNs unchanged).
2. **Modular app** — Dev workflow remains `index.html` + `css/app.css` + `js/**` ES modules (`npm run dev` uses `serve`).
3. **Standard analysis fixes** — Series filter now allows true empty selections, standard steel adjustment reloads per selected dimension, and Excel drawing export stores reload data plus visible thumbnails.

## Recent decisions

- Prefer **native ES modules** + local static server first; Vite optional later.
- Keep **CDN** vendor strategy unless bundle size or offline requirements change.
- Use **`window` bridges** temporarily for `onclick` handlers if markup is not rewritten in the first pass.

## Open questions (none blocking)

- Whether to archive the original single HTML file after parity or keep it as `legacy/` reference.

## What not to assume

- Do not rename public `onclick` entry points until callers are updated or bridged on `window`.
