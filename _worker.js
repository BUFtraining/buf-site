// BUF Personal Training - Worker handler
// Routes POST /api/contact to email handler; everything else falls through to static assets.

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Handle contact form submissions
    // - /api/contact: our own clean endpoint
    // - /api/trpc/*:  Manus's React form posts here (tRPC mutations); intercept and treat as contact
    if (url.pathname === '/api/contact' || url.pathname.startsWith('/api/trpc')) {
      if (request.method === 'POST') {
        return handleContact(request, env, url);
      }
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        });
      }
      return new Response('Method not allowed', { status: 405 });
    }
    
    // Everything else: static assets (HTML, CSS, JS, images, _redirects, _headers)
    return env.ASSETS.fetch(request);
  },
};

async function handleContact(request, env, url) {
  const isTrpc = url && url.pathname.startsWith('/api/trpc');
  
  // Parse the body (JSON or form-encoded)
  let data;
  try {
    const ct = request.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const raw = await request.json();
      // tRPC wraps payloads — unwrap common shapes:
      //   { json: { ...fields } }
      //   { 0: { json: { ...fields } } }
      //   [{ json: { ...fields } }]
      data = unwrapTrpc(raw);
    } else {
      const fd = await request.formData();
      data = Object.fromEntries(fd);
      const interestedIn = fd.getAll('interestedIn');
      if (interestedIn.length) data.interestedIn = interestedIn.join(', ');
    }
  } catch (err) {
    return errorResponse(isTrpc, 'Invalid request body', 400);
  }
  
  // Validate — all fields optional, but reject completely empty submissions
  // and validate email format if email is provided
  if (!data || typeof data !== 'object') {
    return errorResponse(isTrpc, 'Invalid request body', 400);
  }
  const hasAnyContent = ['firstName','lastName','email','phone','message','interestedIn','referral']
    .some(k => data[k] && String(data[k]).trim() !== '');
  if (!hasAnyContent) {
    return errorResponse(isTrpc, 'Please fill out at least one field', 400);
  }
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    return errorResponse(isTrpc, 'Invalid email address', 400);
  }
  
  // Normalize array values (tRPC checkbox arrays, etc.)
  if (Array.isArray(data.interestedIn)) data.interestedIn = data.interestedIn.join(', ');
  
  // Build email
  const fullName = `${data.firstName || ''} ${data.lastName || ''}`.trim();
  const subject = fullName
    ? `New BUF contact: ${fullName}`
    : 'New BUF contact (no name provided)';
  
  const lines = [
    `Name:           ${fullName || '(not provided)'}`,
    `Email:          ${data.email || '(not provided)'}`,
    `Phone:          ${data.phone || '(not provided)'}`,
    `Interested In:  ${data.interestedIn || '(none specified)'}`,
    `How they heard: ${data.referral || '(not provided)'}`,
    `Email updates:  ${data.updates ? 'Yes' : 'No'}`,
    '',
    '----- Message -----',
    data.message || '(no message)',
    '',
    '---',
    'Submitted via trainwithbuf.com contact form',
  ];
  
  const emailLinkHtml = data.email
    ? `<a href="mailto:${encodeURIComponent(data.email)}">${escapeHtml(data.email)}</a>`
    : '(not provided)';
  
  const htmlBody = `
    <h2>New contact from BUF website</h2>
    <p><strong>Name:</strong> ${escapeHtml(fullName || '(not provided)')}</p>
    <p><strong>Email:</strong> ${emailLinkHtml}</p>
    <p><strong>Phone:</strong> ${escapeHtml(data.phone || '(not provided)')}</p>
    <p><strong>Interested In:</strong> ${escapeHtml(data.interestedIn || '(none specified)')}</p>
    <p><strong>How they heard:</strong> ${escapeHtml(data.referral || '(not provided)')}</p>
    <p><strong>Email updates:</strong> ${data.updates ? 'Yes' : 'No'}</p>
    <hr>
    <p><strong>Message:</strong></p>
    <p>${escapeHtml(data.message || '(no message)').replace(/\n/g, '<br>')}</p>
    <hr>
    <p style="color:#888;font-size:.9em;">Submitted via trainwithbuf.com contact form</p>
  `;
  
  // Send via Resend
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY environment variable not set');
    return jsonResponse({ error: 'Server misconfigured (no API key)' }, 500);
  }
  
  const recipientEmail = env.CONTACT_EMAIL || 'getfit@trainwithbuf.com';
  const senderEmail = env.SENDER_EMAIL || 'BUF Contact Form <onboarding@resend.dev>';
  
  try {
    const emailPayload = {
      from: senderEmail,
      to: [recipientEmail],
      subject,
      text: lines.join('\n'),
      html: htmlBody,
    };
    if (data.email) {
      emailPayload.reply_to = data.email;
    }
    const emailResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    });
    
    if (!emailResp.ok) {
      const errText = await emailResp.text();
      console.error('Resend API error:', emailResp.status, errText);
      return errorResponse(isTrpc, 'Email delivery failed', 500);
    }
    
    return successResponse(isTrpc);
  } catch (err) {
    console.error('Send error:', err);
    return errorResponse(isTrpc, 'Network error', 500);
  }
}

// Unwrap nested tRPC payload shapes
function unwrapTrpc(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  // Array form: [{ json: {...} }] or [{ ...fields }]
  if (Array.isArray(payload)) {
    return unwrapTrpc(payload[0] || {});
  }
  // { 0: {...} } indexed form
  if (payload['0']) return unwrapTrpc(payload['0']);
  // { json: {...} } wrapped form
  if (payload.json && typeof payload.json === 'object') return unwrapTrpc(payload.json);
  // Otherwise assume it's already the data
  return payload;
}

function successResponse(isTrpc) {
  if (isTrpc) {
    // tRPC v10 success format
    return jsonResponse({ result: { data: { success: true } } });
  }
  return jsonResponse({ success: true });
}

function errorResponse(isTrpc, message, status) {
  if (isTrpc) {
    // tRPC v10 error format — but we return 200 with error in body for client to handle
    return jsonResponse({
      error: { message, code: status === 400 ? 'BAD_REQUEST' : 'INTERNAL_SERVER_ERROR', data: { httpStatus: status } }
    }, status);
  }
  return jsonResponse({ error: message }, status);
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
