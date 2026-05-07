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
  // Footer injection — add Blog link to Manus's footer
  // ============================================================
  
  const BLOG_HREF = '/blog/';
  const BLOG_LABEL = 'Blog';
  
  let observerRef = null;
  let injectionDone = false;
  
  function findFooterContainer() {
    // Try <footer> tag first (most semantic, likely how Manus marks it)
    const footer = document.querySelector('footer');
    if (footer) return footer;
    
    // Fallback: any element with "footer" in the class name (case-insensitive)
    return document.querySelector('[class*="footer" i]');
  }
  
  function findFooterRefLink() {
    const footer = findFooterContainer();
    if (!footer) return null;
    
    // Look for a typical nav link in the footer to clone for styling
    return footer.querySelector(
      'a[href="/reviews"], a[href="/reviews/"], ' +
      'a[href="/trainers"], a[href="/trainers/"], ' +
      'a[href="/rates"], a[href="/rates/"], ' +
      'a[href="/about-us"], a[href="/about-us/"]'
    );
  }
  
  function alreadyHasBlogLink() {
    return !!document.querySelector('[data-buf-blog-link="1"], [data-buf-blog-wrapper="1"]');
  }
  
  function disconnectObserver() {
    if (observerRef) {
      observerRef.disconnect();
      observerRef = null;
    }
  }
  
  function injectBlogLink() {
    try {
      if (alreadyHasBlogLink()) {
        injectionDone = true;
        return true;
      }
      
      const refLink = findFooterRefLink();
      if (!refLink) return false;
      
      // Decide what to clone: the link OR its wrapper.
      // Manus likely wraps each footer link in a <li> or <div> that provides
      // spacing. If the parent contains ONLY the link (single child), it's a
      // wrapper element — clone it so we inherit the spacing/separator structure.
      const parent = refLink.parentElement;
      let toClone, insertAfter;
      
      if (parent && parent !== document.body && parent.children.length === 1) {
        // Parent is a single-child wrapper, clone it
        toClone = parent;
        insertAfter = parent;
      } else {
        // No wrapper, just clone the link
        toClone = refLink;
        insertAfter = refLink;
      }
      
      const cloned = toClone.cloneNode(true);
      cloned.setAttribute('data-buf-blog-wrapper', '1');
      
      // Find the inner <a> tag — it's either the cloned element itself or a descendant
      const innerA = cloned.tagName === 'A' ? cloned : cloned.querySelector('a');
      if (!innerA) return false;
      
      innerA.setAttribute('href', BLOG_HREF);
      innerA.setAttribute('data-buf-blog-link', '1');
      innerA.removeAttribute('onclick');
      
      // Replace text content (handles nested span structures)
      const walker = document.createTreeWalker(innerA, NodeFilter.SHOW_TEXT, null, false);
      let firstTextNode = walker.nextNode();
      if (firstTextNode) {
        firstTextNode.nodeValue = BLOG_LABEL;
        let n;
        while ((n = walker.nextNode())) n.nodeValue = '';
      } else {
        innerA.textContent = BLOG_LABEL;
      }
      
      insertAfter.insertAdjacentElement('afterend', cloned);
      injectionDone = true;
      console.log('[BUF] Blog link injected in footer');
      
      // Once successfully injected, disconnect the observer after a brief delay
      // (delay allows React to settle any final renders without us re-injecting)
      setTimeout(disconnectObserver, 1500);
      
      return true;
    } catch (err) {
      console.error('[BUF] Failed to inject blog link:', err);
      return false;
    }
  }
  
  // Observe DOM changes (React may re-render on route change) and re-inject
  let injectScheduled = false;
  function scheduleInject() {
    if (injectScheduled || injectionDone) return;
    injectScheduled = true;
    requestAnimationFrame(() => {
      injectScheduled = false;
      if (!alreadyHasBlogLink()) injectBlogLink();
    });
  }
  
  function setupObserver() {
    if (observerRef) return;
    
    // If footer exists, scope observer to footer (much smaller, less overhead)
    // Otherwise observe body but plan to give up after 10 seconds
    const footer = findFooterContainer();
    const target = footer || document.body;
    
    observerRef = new MutationObserver(() => scheduleInject());
    observerRef.observe(target, { childList: true, subtree: true });
    
    // Safety: if footer never appears within 10s, stop observing
    setTimeout(() => {
      if (!injectionDone) {
        console.warn('[BUF] Could not find footer to inject Blog link, giving up');
        disconnectObserver();
      }
    }, 10000);
  }
  
  function init() {
    injectBlogLink();
    if (!injectionDone) setupObserver();
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
