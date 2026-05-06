---
title: "Replace this with your post title"
slug: "replace-with-url-slug"
date: "2026-05-06"
category: "training-tips"
excerpt: "A 1-2 sentence summary that shows on the blog index and as the meta description for SEO. Keep it under 160 characters for best results."
author: "Ben Unger"
---

Write your post content here in Markdown.

## Use ## for section headings

Regular paragraphs of text. **Bold text** with double asterisks. *Italics* with single asterisks. [Link text](https://example.com) for hyperlinks.

## Available frontmatter fields

The block at the top (between the `---` lines) is called "frontmatter." It controls the post's metadata:

- `title` — required. The post title.
- `slug` — required. Becomes the URL: `/blog/your-slug/`. Use lowercase, hyphens, no spaces.
- `date` — required. Format: `YYYY-MM-DD`.
- `category` — required. One of: `training-tips`, `client-stories`, `nyc-fitness`, `nutrition`, `mobility`.
- `excerpt` — required. 1-2 sentences for the index page and SEO meta description.
- `author` — optional. Defaults to "BUF Team".

## Markdown basics

### Lists

- Bullet point one
- Bullet point two
- Bullet point three

1. Numbered item one
2. Numbered item two

### Quotes

> A quote from a client, expert, or anyone else worth highlighting.

### Code (rarely needed for this blog)

Inline `code` with backticks.

```
Code block with triple backticks
```

## How to publish a new post

1. In GitHub, copy this file to `/blog/posts/YYYY-MM-DD-your-slug.md`
2. Edit the frontmatter and write your content
3. Commit changes
4. Wait ~90 seconds — Cloudflare auto-builds and deploys
5. Post is live at `https://www.trainwithbuf.com/blog/your-slug/`
