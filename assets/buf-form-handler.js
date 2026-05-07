// BUF form handler — intercepts Manus's contact form (which posts to /api/trpc)
// and routes it to our /api/contact Pages Function instead.
// Uses capture-phase event listener to fire BEFORE React's handler.
//
// Also handles: injecting a "Blog" link into Manus's main nav, since Manus's
// React app doesn't include one. Keeps it in place via MutationObserver
// in case React re-renders the nav.
(function() {
  'use strict';
  
  function isBufContactForm(form) {
    if (!(form instanceof HTMLFormElement)) return false;
    return !!(form.querySelector('input[name="firstName"]') &&
              form.querySelector('input[name="email"]'));
  }
  
  function showSuccess(form) {
    // Hide form by setting display:none on its wrapper element
    form.style.display = 'none';
    
    // Insert a styled thank-you message just above the form
    const thanks = document.createElement('div');
    thanks.setAttribute('data-buf-success', '1');
    thanks.style.cssText = [
      'padding: 48px 32px',
      'margin: 24px 0',
      'background: #f0f5fa',
      'border: 1px solid rgba(8,91,135,0.15)',
      'border-radius: 8px',
      'text-align: center',
      'font-family: inherit',
    ].join(';');
    thanks.innerHTML = [
      '<div style="font-size:3rem;line-height:1;margin-bottom:16px;">✓</div>',
      '<h3 style="font-size:1.75rem;font-weight:700;margin:0 0 12px;color:#001828;text-transform:uppercase;letter-spacing:-0.01em;">Thanks!</h3>',
      '<p style="font-size:1.1rem;color:#444;margin:0;max-width:480px;margin:0 auto;">',
      "We've received your message and will be in touch within 24 hours. ",
      'In the meantime, feel free to call us at ',
      '<a href="tel:+19295543147" style="color:#940015;font-weight:600;">929-554-3147</a>.',
      '</p>',
    ].join('');
    form.parentNode.insertBefore(thanks, form);
    
    // Scroll the success message into view
    setTimeout(() => {
      thanks.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }
  
  function showError(form, submitBtn, originalText) {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
    alert(
      "Sorry — there was a problem sending your message.\n\n" +
      "Please try again, or call us directly at 929-554-3147."
    );
  }
  
  document.addEventListener('submit', async function(e) {
    const form = e.target;
    if (!isBufContactForm(form)) return;
    
    // Block React's tRPC handler
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    
    const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
    const originalText = submitBtn ? submitBtn.textContent : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending...';
    }
    
    // Collect form data
    const fd = new FormData(form);
    const data = {};
    const interestedIn = [];
    for (const [key, value] of fd.entries()) {
      if (key === 'interestedIn') {
        interestedIn.push(value);
      } else {
        data[key] = value;
      }
    }
    if (interestedIn.length) data.interestedIn = interestedIn.join(', ');
    
    try {
      const resp = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        console.error('BUF form: server returned', resp.status, text);
        showError(form, submitBtn, originalText);
        return;
      }
      
      showSuccess(form);
    } catch (err) {
      console.error('BUF form: network error', err);
      showError(form, submitBtn, originalText);
    }
  }, true);

  // ============================================================
  // Nav injection — add Blog link to Manus's nav
  // ============================================================
  
  const BLOG_HREF = '/blog/';
  const BLOG_LABEL = 'Blog';
  
  function findNavLinks() {
    // Find the main nav by looking for the existing link to /rates or /trainers
    // (Manus's nav has these). If we can find them, we're in the right nav.
    const candidates = document.querySelectorAll(
      'header a[href$="/rates"], header a[href$="/rates/"], ' +
      'header a[href$="/trainers"], header a[href$="/trainers/"], ' +
      'nav a[href$="/rates"], nav a[href$="/rates/"], ' +
      'nav a[href$="/trainers"], nav a[href$="/trainers/"]'
    );
    if (candidates.length === 0) return null;
    // Pick the first one's parent <nav> or <ul> or whatever as the container
    const sample = candidates[0];
    const container = sample.closest('nav') || sample.closest('ul') || sample.parentElement;
    if (!container) return null;
    return container.querySelectorAll('a');
  }
  
  function alreadyHasBlogLink() {
    return !!document.querySelector('header a[data-buf-blog-link], nav a[data-buf-blog-link]');
  }
  
  function injectBlogLink() {
    if (alreadyHasBlogLink()) return true;
    
    const links = findNavLinks();
    if (!links || links.length < 2) return false;
    
    // Prefer to insert AFTER the Reviews link (logical grouping with content pages)
    let referenceLink = null;
    for (const a of links) {
      const href = (a.getAttribute('href') || '').replace(/\/$/, '');
      if (href.endsWith('/reviews')) {
        referenceLink = a;
        break;
      }
    }
    
    // Fallback: insert before the LAST link (often Contact, which is a CTA button)
    if (!referenceLink) {
      // Use second-to-last to slot before any CTA button
      referenceLink = links[Math.max(0, links.length - 2)];
    }
    
    if (!referenceLink) return false;
    
    // Clone the reference link to inherit React's classes and styling
    const blogLink = referenceLink.cloneNode(true);
    blogLink.setAttribute('href', BLOG_HREF);
    blogLink.setAttribute('data-buf-blog-link', '1');
    
    // Replace the visible text (handles both simple textContent and nested span structures)
    const walker = document.createTreeWalker(blogLink, NodeFilter.SHOW_TEXT, null, false);
    let firstTextNode = walker.nextNode();
    if (firstTextNode) {
      firstTextNode.nodeValue = BLOG_LABEL;
      // Empty out any other text nodes so we don't get "ReviewsBlog" etc.
      let n;
      while ((n = walker.nextNode())) n.nodeValue = '';
    } else {
      blogLink.textContent = BLOG_LABEL;
    }
    
    referenceLink.insertAdjacentElement('afterend', blogLink);
    return true;
  }
  
  // Observe DOM changes (React may re-render on route change) and re-inject
  let injectScheduled = false;
  function scheduleInject() {
    if (injectScheduled) return;
    injectScheduled = true;
    requestAnimationFrame(() => {
      injectScheduled = false;
      if (!alreadyHasBlogLink()) injectBlogLink();
    });
  }
  
  function setupObserver() {
    const observer = new MutationObserver(() => scheduleInject());
    observer.observe(document.body, { childList: true, subtree: true });
  }
  
  function init() {
    injectBlogLink();
    setupObserver();
    // Belt-and-suspenders: try a few times in the first 3 seconds
    // in case Manus's React mounts late
    let tries = 0;
    const interval = setInterval(() => {
      tries++;
      if (alreadyHasBlogLink() || tries > 6) {
        clearInterval(interval);
      } else {
        injectBlogLink();
      }
    }, 500);
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
