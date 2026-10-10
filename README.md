# patchedpatches.co.uk

A static site of practical, UK-focused guides to patches. Markdown in `content/` is built into plain HTML in `dist/` by `build.mjs`. Its only dependency is `marked`. Same engine as treatmycat.com.

## Build

```
npm install
npm run build   # outputs dist/
```

## Deploy (Cloudflare Pages)

- Build command: `npm run build`
- Build output directory: `dist`
- Custom domain: `patchedpatches.co.uk` (and `www.patchedpatches.co.uk`, redirected to the apex)

Every push to `main` redeploys automatically.

## Money

- Affiliate links: set `amazonTag` in `site.config.json` to the Amazon.co.uk Associates tracking ID. Until it's set, `amazon:` links render as plain text, so nothing is linked before the account exists. See `AFFILIATES.md`.
- Analytics: put the Cloudflare Web Analytics token in `analytics`.
- Ads: `adsenseClient` (e.g. `ca-pub-...`) once AdSense approves the site. Ads need a UK cookie consent banner before they go live.

## Adding a guide

Create `content/guides/<slug>.md`:

```
---
title: How to ...
description: One sentence for search results and cards.
category: Applying patches | Patch care | Choosing patches | Projects and ideas | Tools and kit
date: YYYY-MM-DD
reviewed: YYYY-MM-DD
---
Body in Markdown.
```

Add `draft: true` to keep it unpublished. Read `CONTENT.md` before writing.

## Topics and images

Topics are listed in `TOPICS` at the top of `build.mjs`. Each has a colour (`tint`), an illustration in `public/img/<slug>.svg`, an icon in `public/img/icons/<slug>.svg` and a share image in `public/og/<slug>.png`. To add a topic, add it to `TOPICS`, add its drawing to `scripts/illustrations.mjs` and run `npm run art`, then `npm run og` (needs Playwright) to make the share images.
