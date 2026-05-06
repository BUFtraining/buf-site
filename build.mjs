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

// Configure marked
marked.setOptions({
  gfm: true,
  breaks: false,
  headerIds: true,
  mangle: false,
});

// Categories with display names + slugs
const CATEGORIES = {
  'training-tips': 'Training Tips',
  'client-stories': 'Client Stories',
  'nyc-fitness':    'NYC Fitness',
  'nutrition':      'Nutrition',
  'mobility':       'Mobility & Recovery',
};

// HTML escape
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

// Load all posts
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
    
    // Validate required fields
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
      author: data.author || 'BUF Team',
      bodyHtml: marked(content),
      bodyMd: content,
      filename: f,
    });
  }
  // Sort newest first
  posts.sort((a, b) => b.date - a.date);
  return posts;
}

// HEAD template — common SEO + style for every blog page
function head({ title, description, canonical, ogImage = `${SITE_URL}/manus-storage/gym_studio_3611ab9d.png`, type = 'website' }) {
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

<meta name="theme-color" content="#0d1f3c">

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/blog.css">
<link rel="icon" type="image/png" href="/manus-storage/logo_white_clean_2cd7f9a9.png">
</head>
<body>`;
}

const NAV = `
<header class="site-header">
  <div class="container nav">
    <a href="/" class="nav-logo" aria-label="BUF Personal Training NYC home">
      <img src="/manus-storage/logo_white_clean_2cd7f9a9.png" alt="BUF Personal Training NYC">
      <span>BUF</span>
    </a>
    <nav>
      <a href="/">Home</a>
      <a href="/rates/">Rates</a>
      <a href="/trainers/">Trainers</a>
      <a href="/reviews/">Reviews</a>
      <a href="/blog/" class="active">Blog</a>
      <a href="/contact-us/" class="nav-cta">Contact</a>
    </nav>
  </div>
</header>`;

const FOOTER = `
<footer class="site-footer">
  <div class="container">
    <div class="footer-grid">
      <div>
        <strong>BUF Personal Training NYC</strong>
        <p>347 W 36th St, Suite 1002-1004<br>New York, NY 10018</p>
        <p><a href="tel:+19295543147">929-554-3147</a><br>
        <a href="mailto:getfit@trainwithbuf.com">getfit@trainwithbuf.com</a></p>
      </div>
      <div>
        <strong>Pages</strong>
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
        <strong>Blog Categories</strong>
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
</body>
</html>`;

// Build a single post page
function renderPost(post, allPosts) {
  const url = `${SITE_URL}/blog/${post.slug}/`;
  const description = post.excerpt || post.title;
  
  // Find related posts (same category, exclude current, max 3)
  const related = allPosts
    .filter(p => p.slug !== post.slug && p.category === post.category)
    .slice(0, 3);
  
  // JSON-LD BlogPosting
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
      "logo": { "@type": "ImageObject", "url": `${SITE_URL}/manus-storage/logo_white_clean_2cd7f9a9.png` }
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
      <a href="/contact-us/" class="post-cta">Ready to start training? Book a free consultation →</a>
    </footer>
  </article>
  
  ${related.length ? `
  <aside class="related-posts">
    <h2>More from ${esc(categoryDisplay(post.category))}</h2>
    <div class="post-cards">
      ${related.map(r => `
        <a href="/blog/${r.slug}/" class="post-card">
          <span class="post-card-category">${esc(categoryDisplay(r.category))}</span>
          <h3>${esc(r.title)}</h3>
          <time>${fmtDate(r.date)}</time>
        </a>
      `).join('')}
    </div>
  </aside>` : ''}
</main>`
    + FOOTER;
}

// Build the blog index page (all posts)
function renderBlogIndex(posts) {
  const url = `${SITE_URL}/blog/`;
  return head({
    title: `${BLOG_TITLE} | BUF Personal Training NYC`,
    description: `${BLOG_TAGLINE}. Articles on strength training, mobility, NYC fitness, and the BUF approach to personal training.`,
    canonical: url,
  })
    + NAV
    + `<main class="blog-index">
  <header class="blog-hero">
    <div class="container">
      <h1>${esc(BLOG_TITLE)}</h1>
      <p>${esc(BLOG_TAGLINE)}</p>
    </div>
  </header>
  <section class="container">
    <nav class="category-pills">
      <a href="/blog/" class="active">All</a>
      ${Object.entries(CATEGORIES).map(([slug, name]) =>
        `<a href="/blog/category/${slug}/">${esc(name)}</a>`
      ).join('\n      ')}
    </nav>
    ${posts.length === 0
      ? `<p class="empty-state">No posts yet — check back soon.</p>`
      : `<div class="post-list">
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
  </section>
</main>`
    + FOOTER;
}

// Build a category index page
function renderCategoryIndex(categorySlug, posts) {
  const categoryName = categoryDisplay(categorySlug);
  const url = `${SITE_URL}/blog/category/${categorySlug}/`;
  return head({
    title: `${categoryName} | BUF Blog`,
    description: `${categoryName} articles from BUF Personal Training NYC.`,
    canonical: url,
  })
    + NAV
    + `<main class="blog-index">
  <header class="blog-hero">
    <div class="container">
      <a href="/blog/" class="back-link">← All posts</a>
      <h1>${esc(categoryName)}</h1>
      <p>${posts.length} ${posts.length === 1 ? 'post' : 'posts'}</p>
    </div>
  </header>
  <section class="container">
    <nav class="category-pills">
      <a href="/blog/">All</a>
      ${Object.entries(CATEGORIES).map(([slug, name]) =>
        `<a href="/blog/category/${slug}/" class="${slug === categorySlug ? 'active' : ''}">${esc(name)}</a>`
      ).join('\n      ')}
    </nav>
    ${posts.length === 0
      ? `<p class="empty-state">No posts in this category yet.</p>`
      : `<div class="post-list">
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
  </section>
</main>`
    + FOOTER;
}

// Generate sitemap.xml including all static pages and all blog posts
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
  // Category index pages
  for (const [slug] of Object.entries(CATEGORIES)) {
    entries.push(
      `  <url><loc>${SITE_URL}/blog/category/${slug}/</loc><lastmod>${today}</lastmod>` +
      `<changefreq>weekly</changefreq><priority>0.5</priority></url>`
    );
  }
  // Blog posts
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

// Main build
async function main() {
  console.log('🛠  Building BUF site...');
  
  const posts = await loadPosts();
  console.log(`📝 Found ${posts.length} posts`);
  
  // Build each post page
  for (const post of posts) {
    const dir = path.join(BLOG_OUT, post.slug);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'index.html'), renderPost(post, posts));
  }
  console.log(`✓ Built ${posts.length} post pages`);
  
  // Build blog index
  await writeFile(path.join(BLOG_OUT, 'index.html'), renderBlogIndex(posts));
  console.log('✓ Built /blog/index.html');
  
  // Build category pages
  await mkdir(path.join(BLOG_OUT, 'category'), { recursive: true });
  for (const [slug] of Object.entries(CATEGORIES)) {
    const catPosts = posts.filter(p => p.category === slug);
    const dir = path.join(BLOG_OUT, 'category', slug);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'index.html'), renderCategoryIndex(slug, catPosts));
  }
  console.log(`✓ Built ${Object.keys(CATEGORIES).length} category pages`);
  
  // Update sitemap
  await writeFile(path.join(ROOT, 'sitemap.xml'), renderSitemap(posts));
  console.log('✓ Updated sitemap.xml');
  
  console.log('🎉 Build complete');
}

main().catch(err => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
