// BUF form handler — intercepts Manus's contact form (which posts to /api/trpc)
// and routes it to our /api/contact Pages Function instead.
// Uses capture-phase event listener to fire BEFORE React's handler.
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
})();
