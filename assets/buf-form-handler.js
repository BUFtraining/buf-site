// BUF form handler — intercepts Manus's contact form
// and routes it to our /api/contact endpoint.
// - Removes all `required` attributes so users can submit any subset of fields
// - Strips asterisks from labels for visual consistency
// - Fires a Google Ads conversion event on success
(function() {
  'use strict';
  
  function isBufContactForm(form) {
    if (!form) return false;
    const inputs = form.querySelectorAll('input[name], textarea[name]');
    if (inputs.length < 2) return false;
    const names = Array.from(inputs).map(i => i.getAttribute('name'));
    return names.includes('email') || names.includes('firstName') || names.includes('phone');
  }
  
  // Aggressively strip `required` attributes and asterisks from ANY label/input on page.
  // React keeps re-rendering and re-adding the asterisks, so we run this on every
  // animation frame to win the race.
  function deRequireBufForm() {
    // Strip required from ALL inputs/textareas/selects on page (safe — only contact form has required)
    document.querySelectorAll('input[required], textarea[required], select[required], [aria-required="true"]').forEach(field => {
      field.removeAttribute('required');
      field.removeAttribute('aria-required');
    });
    
    // Strip asterisks from any label containing "*" character
    document.querySelectorAll('label').forEach(label => {
      // Quick check: if no asterisk in textContent, skip
      if (!label.textContent || label.textContent.indexOf('*') === -1) return;
      
      // Walk all text node descendants
      const walker = document.createTreeWalker(label, NodeFilter.SHOW_TEXT, null);
      let node;
      const toUpdate = [];
      while (node = walker.nextNode()) {
        if (node.textContent.indexOf('*') !== -1) toUpdate.push(node);
      }
      toUpdate.forEach(n => {
        n.textContent = n.textContent.replace(/\s*\*+\s*/g, '').trimEnd();
      });
      
      // Also remove asterisk-only spans
      label.querySelectorAll('span').forEach(span => {
        if (span.textContent.trim() === '*') span.remove();
      });
    });
  }
  
  // Run immediately, then on every animation frame in a tight loop.
  // This ensures we beat React's re-render cycle no matter what.
  function scheduleCleanup() {
    deRequireBufForm();
    requestAnimationFrame(scheduleCleanup);
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleCleanup);
  } else {
    scheduleCleanup();
  }
  
  function showSuccess(form) {
    // Fire Google Ads conversion event
    if (typeof gtag === 'function') {
      try {
        gtag('event', 'conversion', {
          'send_to': 'AW-715536325/-xwYCIjw56kcEMXvmNUC'
        });
      } catch (e) {
        console.error('Conversion tracking failed:', e);
      }
    }
    
    form.innerHTML = '<div style="padding:2rem;text-align:center;background:#f0f9ff;border-radius:8px;color:#0c4a6e;"><h3 style="margin:0 0 0.5rem;">Message sent!</h3><p style="margin:0;">We\'ll be in touch shortly.</p></div>';
  }
  
  function showError(form, submitBtn, originalText) {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText || 'Send';
    }
    alert('Something went wrong sending your message. Please try emailing getfit@trainwithbuf.com directly.');
  }
  
  document.addEventListener('submit', async function(e) {
    const form = e.target;
    if (!isBufContactForm(form)) return;
    
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    
    const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
    const originalText = submitBtn ? submitBtn.textContent : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending...';
    }
    
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
})();
