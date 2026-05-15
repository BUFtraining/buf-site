#!/usr/bin/env node
// BUF blog build script.
// Reads /blog/posts/*.md, generates HTML pages for each post,
// builds /blog/index.html, category pages, and updates sitemap.xml.

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';
import matter from 'gray-matter';

const ROOT = process.cwd();
const POSTS_DIR = path.join(ROOT, 'blog', 'posts');
const BLOG_OUT = path.join(ROOT, 'blog');
const SITE_URL = 'https://www.trainwithbuf.com';
const BLOG_TITLE = 'BUF Blog';
const BLOG_TAGLINE = 'Strength training, mobility, and NYC fitness from BUF Personal Training';
const LOGO_URL = '/manus-storage/logo_white_clean_2cd7f9a9.png';
const DEFAULT_OG = `${SITE_URL}/manus-storage/gym_studio_3611ab9d.png`;

marked.setOptions({
  gfm: true,
  breaks: false,
  headerIds: true,
  mangle: false,
});

const CATEGORIES = {
  'training-tips': 'Training Tips',
  'client-stories': 'Client Stories',
  'nyc-fitness':    'NYC Fitness',
  'nutrition':      'Nutrition',
  'mobility':       'Mobility & Recovery',
};

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function fmtDate(d) {
  if (!(d instanceof Date)) d = new Date(d);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function isoDate(d) {
  if (!(d instanceof Date)) d = new Date(d);
  return d.toISOString().split('T')[0];
}

function categoryDisplay(slug) {
  return CATEGORIES[slug] || slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// Editorial design tokens + base styles, used in every blog page
const EDITORIAL_STYLES = `
  :root {
    --ink: #0d1117; --ink-soft: #1b2330;
    --paper: #fbfaf6; --paper-soft: #f1ede4;
    --rule: rgba(13,17,23,0.12); --rule-light: rgba(255,255,255,0.15);
    --red: #c42a1c; --red-deep: #9f1f12; --red-light: #ff6e60;
    --mute: #6b7280;
  }
  * { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; }
  body {
    margin: 0; background: var(--paper); color: var(--ink);
    font-family: "Lora", Georgia, serif; font-size: 17px; line-height: 1.55;
    -webkit-font-smoothing: antialiased;
  }
  img { display: block; max-width: 100%; height: auto; }
  a { color: inherit; text-decoration: none; }
  h1, h2, h3, h4 {
    font-family: "Barlow Condensed", sans-serif;
    margin: 0; line-height: 1.05; font-weight: 700; letter-spacing: -0.01em;
  }
  p { margin: 0 0 1rem; }
  .wrap { width: 100%; max-width: 1240px; margin: 0 auto; padding: 0 1.5rem; }
  .eyebrow {
    font-family: "Barlow Condensed", sans-serif; font-weight: 600;
    font-size: 0.78rem; letter-spacing: 0.28em; text-transform: uppercase;
    color: var(--red); display: inline-flex; align-items: center; gap: 0.65rem;
  }
  .eyebrow::before { content: ""; width: 1.75rem; height: 1px; background: var(--red); }
  .eyebrow-light { color: var(--red-light) !important; }
  .eyebrow-light::before { background: var(--red-light) !important; }

  /* Header */
  .header {
    position: fixed; inset: 0 0 auto 0; z-index: 50;
    background: rgba(13,17,23,0.92);
    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    border-bottom: 1px solid var(--rule-light);
  }
  .header-inner { display: flex; align-items: center; justify-content: space-between; height: 4.5rem; }
  .logo img { height: 2.25rem; width: auto; }
  .nav { display: none; gap: 0.25rem; }
  .nav a {
    font-family: "Barlow Condensed", sans-serif; font-size: 0.92rem; font-weight: 600;
    letter-spacing: 0.18em; text-transform: uppercase; color: rgba(255,255,255,0.85);
    padding: 0.5rem 0.9rem; transition: color 0.2s; position: relative;
  }
  .nav a:hover { color: #fff; }
  .nav a.is-active { color: #fff; }
  .nav a.is-active::after { content: ""; position: absolute; left: 0.9rem; right: 0.9rem; bottom: 0.15rem; height: 2px; background: var(--red); }
  .call-btn {
    display: none;
    font-family: "Barlow Condensed", sans-serif; font-weight: 700; font-size: 0.88rem;
    letter-spacing: 0.18em; text-transform: uppercase; color: #fff; background: var(--red);
    padding: 0.7rem 1.1rem; border-radius: 2px; align-items: center; gap: 0.5rem; transition: background 0.2s;
  }
  .call-btn:hover { background: var(--red-deep); }
  .menu-btn { background: none; border: none; padding: 0.5rem; cursor: pointer; color: #fff; }
  .mobile-menu { display: none; background: var(--ink-soft); border-top: 1px solid var(--rule-light); padding: 1rem 0; }
  .mobile-menu.is-open { display: block; }
  .mobile-menu a {
    display: block; padding: 0.9rem 1.5rem;
    font-family: "Barlow Condensed", sans-serif; font-weight: 600; font-size: 0.95rem;
    letter-spacing: 0.18em; text-transform: uppercase; color: rgba(255,255,255,0.85);
    border-bottom: 1px solid var(--rule-light);
  }
  .mobile-menu a.is-active { color: var(--red); }
  .mobile-menu .call-btn { display: inline-flex; margin: 1rem 1.5rem 0; }
  @media (min-width: 1024px) {
    .nav { display: flex; }
    .call-btn { display: inline-flex; }
    .menu-btn { display: none; }
    .mobile-menu { display: none !important; }
  }

  /* Blog hero */
  .blog-hero {
    position: relative; background: var(--ink); color: #fff;
    padding: 8rem 0 5rem; overflow: hidden;
  }
  .blog-hero::before {
    content: ""; position: absolute; inset: 0;
    background: radial-gradient(circle at 85% 30%, rgba(196,42,28,0.18), transparent 50%), radial-gradient(circle at 15% 80%, rgba(196,42,28,0.08), transparent 60%);
    pointer-events: none;
  }
  .blog-hero .wrap { position: relative; }
  .blog-hero h1 {
    font-size: clamp(3.25rem, 9vw, 6rem);
    line-height: 0.9; letter-spacing: -0.02em; text-transform: uppercase;
    margin: 1rem 0 1rem;
  }
  .blog-hero h1 .red {
    color: var(--red); font-style: italic; font-family: "Lora", serif; font-weight: 600;
    text-transform: none; font-size: 0.55em; letter-spacing: -0.02em; display: block; margin-top: 0.5rem; line-height: 1.05;
  }
  .blog-hero .tagline {
    font-family: "Lora", serif; font-size: 1.1rem; line-height: 1.65;
    color: rgba(255,255,255,0.78); max-width: 36rem; margin-top: 0.5rem;
  }
  .blog-hero .back-link {
    display: inline-flex; align-items: center; gap: 0.5rem;
    font-family: "Barlow Condensed", sans-serif; font-size: 0.85rem; font-weight: 600;
    letter-spacing: 0.22em; text-transform: uppercase; color: rgba(255,255,255,0.65);
    margin-bottom: 1rem; transition: color 0.15s;
  }
  .blog-hero .back-link:hover { color: #fff; }
  .blog-hero .post-count {
    font-family: "Barlow Condensed", sans-serif; font-size: 0.85rem;
    letter-spacing: 0.22em; text-transform: uppercase; color: rgba(255,255,255,0.65);
  }

  /* Category pills */
  .category-pills {
    display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 3rem 0 3rem;
    padding-bottom: 1.5rem; border-bottom: 1px solid var(--rule);
  }
  .category-pills a {
    font-family: "Barlow Condensed", sans-serif; font-size: 0.85rem; font-weight: 600;
    letter-spacing: 0.18em; text-transform: uppercase; color: var(--ink);
    padding: 0.55rem 1.1rem; border: 1px solid var(--rule); border-radius: 2px;
    background: #fff; transition: background 0.15s, color 0.15s, border-color 0.15s;
  }
  .category-pills a:hover { border-color: var(--red); color: var(--red); }
  .category-pills a.active { background: var(--ink); color: #fff; border-color: var(--ink); }

  /* Post list / cards */
  .blog-list { padding: 1rem 0 6rem; }
  .post-grid {
    display: grid; grid-template-columns: 1fr; gap: 2rem;
  }
  @media (min-width: 700px)  { .post-grid { grid-template-columns: 1fr 1fr; } }
  @media (min-width: 1000px) { .post-grid { grid-template-columns: 1fr 1fr 1fr; gap: 2.25rem; } }
  .post-card {
    background: #fff; border: 1px solid var(--rule); border-radius: 4px;
    overflow: hidden; transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
    display: flex; flex-direction: column;
  }
  .post-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 28px rgba(0,0,0,0.08);
    border-color: rgba(196,42,28,0.3);
  }
  .post-card-link {
    padding: 2rem; display: flex; flex-direction: column; flex: 1;
  }
  .post-card-category {
    font-family: "Barlow Condensed", sans-serif; font-size: 0.78rem; font-weight: 600;
    letter-spacing: 0.22em; text-transform: uppercase; color: var(--red); margin-bottom: 0.85rem;
  }
  .post-card h2 {
    font-family: "Barlow Condensed", sans-serif;
    font-size: 1.5rem; text-transform: uppercase; letter-spacing: -0.01em; line-height: 1.1;
    margin: 0 0 0.75rem; color: var(--ink);
  }
  .post-card time {
    font-family: "Lora", serif; font-style: italic; font-size: 0.9rem;
    color: var(--mute); display: block; margin-bottom: 1rem;
  }
  .post-card p {
    font-family: "Lora", serif; font-size: 1rem; line-height: 1.65;
    color: var(--ink); flex: 1; margin: 0 0 1.5rem;
  }
  .post-card-cta {
    font-family: "Barlow Condensed", sans-serif; font-size: 0.85rem; font-weight: 700;
    letter-spacing: 0.22em; text-transform: uppercase; color: var(--red);
    display: inline-flex; align-items: center; gap: 0.5rem; margin-top: auto;
  }
  .empty-state {
    text-align: center; padding: 4rem 0; color: var(--mute); font-style: italic;
  }

  /* Single post */
  .post-page { padding: 4rem 0 6rem; }
  .post { max-width: 44rem; margin: 0 auto; }
  .post-header { margin-bottom: 3rem; }
  .post-category-badge {
    display: inline-block;
    font-family: "Barlow Condensed", sans-serif; font-size: 0.78rem; font-weight: 600;
    letter-spacing: 0.22em; text-transform: uppercase; color: var(--red);
    padding: 0.4rem 0.85rem; background: rgba(196,42,28,0.08); border-radius: 2px;
    margin-bottom: 1.5rem;
  }
  .post-category-badge:hover { background: rgba(196,42,28,0.14); }
  .post h1 {
    font-size: clamp(2rem, 5vw, 3.25rem);
    line-height: 1.1; text-transform: none; letter-spacing: -0.015em;
    margin: 0 0 1.25rem;
  }
  .post-meta {
    display: flex; align-items: center; gap: 0.65rem;
    font-family: "Barlow Condensed", sans-serif; font-size: 0.85rem;
    letter-spacing: 0.18em; text-transform: uppercase; color: var(--mute);
  }
  .post-body {
    font-family: "Lora", Georgia, serif; font-size: 1.075rem; line-height: 1.75; color: var(--ink);
  }
  .post-body > * + * { margin-top: 1.4rem; }
  .post-body h2 {
    font-size: clamp(1.6rem, 3.5vw, 2.1rem);
    text-transform: none; letter-spacing: -0.01em;
    margin-top: 3rem !important; margin-bottom: 1.25rem;
    padding-top: 0.5rem; line-height: 1.2;
  }
  .post-body h3 {
    font-size: 1.35rem; text-transform: none; letter-spacing: -0.005em;
    margin-top: 2.25rem !important; margin-bottom: 0.85rem; line-height: 1.25;
  }
  .post-body p { margin: 0; }
  .post-body ul, .post-body ol { margin: 0 0 0 1.4rem; padding: 0; }
  .post-body li { margin-bottom: 0.5rem; }
  .post-body a {
    color: var(--red); border-bottom: 1px solid currentColor;
    transition: color 0.15s, border-color 0.15s;
  }
  .post-body a:hover { color: var(--red-deep); }
  .post-body strong { font-weight: 700; }
  .post-body em { font-style: italic; }
  .post-body blockquote {
    border-left: 3px solid var(--red);
    padding: 0.5rem 0 0.5rem 1.5rem; margin: 2rem 0 !important;
    font-family: "Lora", serif; font-style: italic; font-size: 1.15rem; color: var(--ink);
  }
  .post-body code {
    font-family: "SFMono-Regular", Menlo, Consolas, monospace; font-size: 0.92em;
    background: var(--paper-soft); padding: 0.15em 0.4em; border-radius: 2px;
  }
  .post-body pre {
    background: var(--ink); color: #f1f1f1; padding: 1rem 1.25rem;
    border-radius: 4px; overflow-x: auto; font-size: 0.9rem; line-height: 1.55;
  }
  .post-body pre code { background: none; padding: 0; color: inherit; }
  .post-body img {
    border-radius: 4px; margin: 1.5rem auto;
    box-shadow: 0 6px 24px rgba(0,0,0,0.08);
  }
  .post-body hr { border: 0; border-top: 1px solid var(--rule); margin: 2.5rem 0; }

  /* Post footer */
  .post-footer {
    margin-top: 4rem; padding-top: 2.5rem; border-top: 1px solid var(--rule);
  }
  .share {
    display: flex; flex-wrap: wrap; align-items: center; gap: 0.65rem 1rem;
    margin-bottom: 2.5rem;
    font-family: "Barlow Condensed", sans-serif; font-size: 0.85rem; font-weight: 600;
    letter-spacing: 0.18em; text-transform: uppercase;
  }
  .share span { color: var(--mute); }
  .share a, .share button {
    background: none; border: none; padding: 0; cursor: pointer;
    font: inherit; letter-spacing: inherit; text-transform: inherit;
    color: var(--ink); transition: color 0.15s;
  }
  .share a:hover, .share button:hover { color: var(--red); }
  .post-cta {
    display: inline-flex; align-items: center; gap: 0.7rem;
    font-family: "Barlow Condensed", sans-serif; font-weight: 700; font-size: 1rem;
    letter-spacing: 0.2em; text-transform: uppercase;
    padding: 1.05rem 2rem; background: var(--red); color: #fff;
    border-radius: 2px; transition: background 0.2s;
  }
  .post-cta:hover { background: var(--red-deep); }
  .post-cta svg { transition: transform 0.2s; }
  .post-cta:hover svg { transform: translateX(4px); }

  /* Related posts */
  .related-posts {
    background: var(--paper-soft); padding: 5rem 0; margin-top: 5rem;
  }
  .related-posts h2 {
    font-size: clamp(1.85rem, 3.5vw, 2.5rem);
    text-transform: uppercase; text-align: center; margin: 0 0 3rem;
  }
  .related-grid {
    display: grid; grid-template-columns: 1fr; gap: 1.5rem;
  }
  @media (min-width: 700px) { .related-grid { grid-template-columns: repeat(3, 1fr); } }

  /* Footer */
  .footer { background: #07090d; color: rgba(255,255,255,0.7); padding: 4rem 0 2rem; }
  .footer-grid { display: grid; grid-template-columns: 1fr; gap: 2.5rem; margin-bottom: 2.5rem; }
  @media (min-width: 700px) { .footer-grid { grid-template-columns: 2fr 1fr 1fr; } }
  .footer h3 {
    font-family: "Barlow Condensed", sans-serif; font-size: 0.85rem;
    letter-spacing: 0.25em; text-transform: uppercase; color: #fff; margin: 0 0 1rem;
  }
  .footer ul { list-style: none; padding: 0; margin: 0; }
  .footer li { margin-bottom: 0.45rem; }
  .footer a { color: rgba(255,255,255,0.7); transition: color 0.15s; font-size: 0.93rem; }
  .footer a:hover { color: #fff; }
  .footer-tag {
    font-family: "Lora", serif; font-style: italic; color: rgba(255,255,255,0.65);
    font-size: 0.95rem; line-height: 1.65; max-width: 24rem;
  }
  .footer-bottom {
    padding-top: 2rem; border-top: 1px solid var(--rule-light);
    display: flex; flex-direction: column; gap: 0.75rem;
    font-size: 0.78rem; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(255,255,255,0.5);
  }
  @media (min-width: 700px) { .footer-bottom { flex-direction: row; justify-content: space-between; } }
`;

// HEAD template — SEO + favicons + gtag + editorial CSS
function head({ title, description, canonical, ogImage = DEFAULT_OG, type = 'website' }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${esc(canonical)}">

<meta property="og:type" content="${type}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(ogImage)}">
<meta property="og:site_name" content="BUF Personal Training NYC">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(ogImage)}">

<meta name="theme-color" content="#0d1117">

<link rel="icon" type="image/x-icon" href="/favicon.ico" />
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
<link rel="icon" type="image/png" sizes="192x192" href="/android-chrome-192x192.png" />
<link rel="icon" type="image/png" sizes="512x512" href="/android-chrome-512x512.png" />

<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=AW-715536325"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'AW-715536325');
</script>

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700;800&family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet">

<style>${EDITORIAL_STYLES}</style>
</head>
<body>`;
}

const NAV = `
<header class="header" id="header">
  <div class="wrap header-inner">
    <a href="/" class="logo" aria-label="BUF Personal Training">
      <img src="${LOGO_URL}" alt="BUF Personal Training" />
    </a>
    <nav class="nav" aria-label="Main">
      <a href="/">Home</a>
      <a href="/rates/">Rates</a>
      <a href="/trainers/">Trainers</a>
      <a href="/reviews/">Reviews</a>
      <a href="/mobility-sessions/">Mobility</a>
      <a href="/about-us/">About</a>
      <a href="/contact-us/">Contact</a>
    </nav>
    <a href="tel:+19295543147" class="call-btn">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92Z"/></svg>
      929-554-3147
    </a>
    <button class="menu-btn" id="menuBtn" aria-label="Open menu" aria-expanded="false">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="7" x2="21" y2="7"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="17" x2="21" y2="17"/></svg>
    </button>
  </div>
  <div class="mobile-menu" id="mobileMenu">
    <a href="/">Home</a>
    <a href="/rates/">Rates</a>
    <a href="/trainers/">Trainers</a>
    <a href="/reviews/">Reviews</a>
    <a href="/mobility-sessions/">Mobility</a>
    <a href="/about-us/">About</a>
    <a href="/contact-us/">Contact</a>
    <a href="tel:+19295543147" class="call-btn">Call 929-554-3147</a>
  </div>
</header>`;

const FOOTER = `
<footer class="footer">
  <div class="wrap">
    <div class="footer-grid">
      <div>
        <h3>BUF Personal Training</h3>
        <p class="footer-tag">Honest, affordable personal training in Midtown Manhattan. Serving Hell's Kitchen, Hudson Yards, and Chelsea since 2017. Every session under $100.</p>
      </div>
      <div>
        <h3>Explore</h3>
        <ul>
          <li><a href="/">Home</a></li>
          <li><a href="/rates/">Rates</a></li>
          <li><a href="/trainers/">Trainers</a></li>
          <li><a href="/reviews/">Reviews</a></li>
          <li><a href="/mobility-sessions/">Mobility</a></li>
          <li><a href="/about-us/">About</a></li>
          <li><a href="/blog/">Blog</a></li>
        </ul>
      </div>
      <div>
        <h3>Blog Categories</h3>
        <ul>
          ${Object.entries(CATEGORIES).map(([slug, name]) =>
            `<li><a href="/blog/category/${slug}/">${esc(name)}</a></li>`
          ).join('\n          ')}
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <span>© 2026 BUF Personal Training LLC</span>
      <a href="/privacy-policy/">Privacy</a>
    </div>
  </div>
</footer>
<script>
  (function() {
    var btn = document.getElementById('menuBtn');
    var menu = document.getElementById('mobileMenu');
    if (!btn || !menu) return;
    btn.addEventListener('click', function() {
      var open = menu.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  })();
</script>
</body>
</html>`;

async function loadPosts() {
  if (!existsSync(POSTS_DIR)) {
    console.warn(`No posts directory found at ${POSTS_DIR}`);
    return [];
  }
  const files = (await readdir(POSTS_DIR)).filter(f => f.endsWith('.md'));
  const posts = [];
  for (const f of files) {
    const raw = await readFile(path.join(POSTS_DIR, f), 'utf8');
    const { data, content } = matter(raw);
    if (!data.title || !data.date || !data.slug) {
      console.warn(`Skipping ${f}: missing title, date, or slug in frontmatter`);
      continue;
    }
    posts.push({
      ...data,
      slug: data.slug,
      title: data.title,
      date: new Date(data.date),
      category: data.category || 'training-tips',
      excerpt: data.excerpt || '',
      author: data.author || 'BUF Personal Training',
      bodyHtml: marked(content),
      bodyMd: content,
      filename: f,
    });
  }
  posts.sort((a, b) => b.date - a.date);
  return posts;
}

function renderPost(post, allPosts) {
  const url = `${SITE_URL}/blog/${post.slug}/`;
  const description = post.excerpt || post.title;
  const related = allPosts
    .filter(p => p.slug !== post.slug && p.category === post.category)
    .slice(0, 3);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": post.title,
    "datePublished": post.date.toISOString(),
    "dateModified": post.date.toISOString(),
    "author": { "@type": "Person", "name": post.author },
    "publisher": {
      "@type": "Organization",
      "name": "BUF Personal Training NYC",
      "logo": { "@type": "ImageObject", "url": `${SITE_URL}${LOGO_URL}` }
    },
    "description": description,
    "articleSection": categoryDisplay(post.category),
    "url": url,
    "mainEntityOfPage": { "@type": "WebPage", "@id": url },
  };

  return head({ title: `${post.title} | BUF Blog`, description, canonical: url, type: 'article' })
    + NAV
    + `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<main class="post-page">
  <div class="wrap">
    <article class="post">
      <header class="post-header">
        <a href="/blog/category/${post.category}/" class="post-category-badge">${esc(categoryDisplay(post.category))}</a>
        <h1>${esc(post.title)}</h1>
        <div class="post-meta">
          <span>${esc(post.author)}</span>
          <span>·</span>
          <time datetime="${isoDate(post.date)}">${fmtDate(post.date)}</time>
        </div>
      </header>
      <div class="post-body">
        ${post.bodyHtml}
      </div>
      <footer class="post-footer">
        <div class="share">
          <span>Share:</span>
          <a href="https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(post.title)}" target="_blank" rel="noopener">Twitter</a>
          <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}" target="_blank" rel="noopener">Facebook</a>
          <a href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}" target="_blank" rel="noopener">LinkedIn</a>
          <button class="copy-link" onclick="navigator.clipboard.writeText('${url}').then(()=>{this.textContent='Copied!';setTimeout(()=>this.textContent='Copy link',2000)})">Copy link</button>
        </div>
        <a href="/contact-us/" class="post-cta">
          Are You Ready To Get Fit?
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </a>
      </footer>
    </article>
  </div>
  ${related.length ? `
  <aside class="related-posts">
    <div class="wrap">
      <h2>More from ${esc(categoryDisplay(post.category))}</h2>
      <div class="related-grid">
        ${related.map(r => `
          <a href="/blog/${r.slug}/" class="post-card">
            <div class="post-card-link">
              <span class="post-card-category">${esc(categoryDisplay(r.category))}</span>
              <h2>${esc(r.title)}</h2>
              <time>${fmtDate(r.date)}</time>
            </div>
          </a>
        `).join('')}
      </div>
    </div>
  </aside>` : ''}
</main>`
    + FOOTER;
}

function renderBlogIndex(posts) {
  const url = `${SITE_URL}/blog/`;
  return head({
    title: `${BLOG_TITLE} | BUF Personal Training NYC`,
    description: `${BLOG_TAGLINE}. Articles on strength training, mobility, NYC fitness, and the BUF approach to personal training.`,
    canonical: url,
  })
    + NAV
    + `<main>
  <section class="blog-hero">
    <div class="wrap">
      <span class="eyebrow eyebrow-light">The BUF Blog</span>
      <h1>
        Train Smarter,<br>
        <span class="red">live stronger.</span>
      </h1>
      <p class="tagline">${esc(BLOG_TAGLINE)}.</p>
    </div>
  </section>
  <section class="blog-list">
    <div class="wrap">
      <nav class="category-pills">
        <a href="/blog/" class="active">All</a>
        ${Object.entries(CATEGORIES).map(([slug, name]) =>
          `<a href="/blog/category/${slug}/">${esc(name)}</a>`
        ).join('\n        ')}
      </nav>
      ${posts.length === 0
        ? `<p class="empty-state">No posts yet — check back soon.</p>`
        : `<div class="post-grid">
        ${posts.map(p => `
          <article class="post-card">
            <a href="/blog/${p.slug}/" class="post-card-link">
              <span class="post-card-category">${esc(categoryDisplay(p.category))}</span>
              <h2>${esc(p.title)}</h2>
              <time>${fmtDate(p.date)}</time>
              <p>${esc(p.excerpt || '')}</p>
              <span class="post-card-cta">Read →</span>
            </a>
          </article>
        `).join('')}
      </div>`
      }
    </div>
  </section>
</main>`
    + FOOTER;
}

function renderCategoryIndex(categorySlug, posts) {
  const categoryName = categoryDisplay(categorySlug);
  const url = `${SITE_URL}/blog/category/${categorySlug}/`;
  return head({
    title: `${categoryName} | BUF Blog`,
    description: `${categoryName} articles from BUF Personal Training NYC.`,
    canonical: url,
  })
    + NAV
    + `<main>
  <section class="blog-hero">
    <div class="wrap">
      <a href="/blog/" class="back-link">← All Posts</a>
      <span class="eyebrow eyebrow-light">${esc(categoryName)}</span>
      <h1>${esc(categoryName)}.</h1>
      <p class="post-count">${posts.length} ${posts.length === 1 ? 'post' : 'posts'}</p>
    </div>
  </section>
  <section class="blog-list">
    <div class="wrap">
      <nav class="category-pills">
        <a href="/blog/">All</a>
        ${Object.entries(CATEGORIES).map(([slug, name]) =>
          `<a href="/blog/category/${slug}/" class="${slug === categorySlug ? 'active' : ''}">${esc(name)}</a>`
        ).join('\n        ')}
      </nav>
      ${posts.length === 0
        ? `<p class="empty-state">No posts in this category yet.</p>`
        : `<div class="post-grid">
        ${posts.map(p => `
          <article class="post-card">
            <a href="/blog/${p.slug}/" class="post-card-link">
              <span class="post-card-category">${esc(categoryDisplay(p.category))}</span>
              <h2>${esc(p.title)}</h2>
              <time>${fmtDate(p.date)}</time>
              <p>${esc(p.excerpt || '')}</p>
              <span class="post-card-cta">Read →</span>
            </a>
          </article>
        `).join('')}
      </div>`
      }
    </div>
  </section>
</main>`
    + FOOTER;
}

function renderSitemap(posts) {
  const staticPages = [
    { url: '/', priority: 1.0, changefreq: 'weekly' },
    { url: '/rates/', priority: 0.9, changefreq: 'monthly' },
    { url: '/trainers/', priority: 0.8, changefreq: 'monthly' },
    { url: '/reviews/', priority: 0.8, changefreq: 'weekly' },
    { url: '/mobility-sessions/', priority: 0.8, changefreq: 'monthly' },
    { url: '/about-us/', priority: 0.7, changefreq: 'monthly' },
    { url: '/contact-us/', priority: 0.7, changefreq: 'monthly' },
    { url: '/blog/', priority: 0.9, changefreq: 'weekly' },
    { url: '/privacy-policy/', priority: 0.3, changefreq: 'yearly' },
  ];
  const today = isoDate(new Date());
  const entries = [];
  for (const page of staticPages) {
    entries.push(
      `  <url><loc>${SITE_URL}${page.url}</loc><lastmod>${today}</lastmod>` +
      `<changefreq>${page.changefreq}</changefreq><priority>${page.priority}</priority></url>`
    );
  }
  for (const [slug] of Object.entries(CATEGORIES)) {
    entries.push(
      `  <url><loc>${SITE_URL}/blog/category/${slug}/</loc><lastmod>${today}</lastmod>` +
      `<changefreq>weekly</changefreq><priority>0.5</priority></url>`
    );
  }
  for (const p of posts) {
    entries.push(
      `  <url><loc>${SITE_URL}/blog/${p.slug}/</loc><lastmod>${isoDate(p.date)}</lastmod>` +
      `<changefreq>monthly</changefreq><priority>0.6</priority></url>`
    );
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>
`;
}

async function main() {
  console.log('🛠  Building BUF blog...');
  const posts = await loadPosts();
  console.log(`📝 Found ${posts.length} posts`);

  for (const post of posts) {
    const dir = path.join(BLOG_OUT, post.slug);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'index.html'), renderPost(post, posts));
  }
  console.log(`✓ Built ${posts.length} post pages`);

  await writeFile(path.join(BLOG_OUT, 'index.html'), renderBlogIndex(posts));
  console.log('✓ Built /blog/index.html');

  await mkdir(path.join(BLOG_OUT, 'category'), { recursive: true });
  for (const [slug] of Object.entries(CATEGORIES)) {
    const catPosts = posts.filter(p => p.category === slug);
    const dir = path.join(BLOG_OUT, 'category', slug);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'index.html'), renderCategoryIndex(slug, catPosts));
  }
  console.log(`✓ Built ${Object.keys(CATEGORIES).length} category pages`);

  await writeFile(path.join(ROOT, 'sitemap.xml'), renderSitemap(posts));
  console.log('✓ Updated sitemap.xml');

  console.log('🎉 Build complete');
}

main().catch(err => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
