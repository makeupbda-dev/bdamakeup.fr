const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_MESSAGE_LENGTH = 2000;

function getTrimmedValue(formData, fieldName) {
  const value = formData.get(fieldName);
  return typeof value === 'string' ? value.trim() : '';
}

function textResponse(body, status) {
  return new Response(body, {
    status,
    headers: {
      'content-type': 'text/plain; charset=UTF-8',
      'cache-control': 'no-store'
    }
  });
}

async function forwardSubmission(env, submission) {
  if (!env.CONTACT_WEBHOOK_URL) {
    return;
  }

  const response = await fetch(env.CONTACT_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(submission)
  });

  if (!response.ok) {
    throw new Error(`Webhook request failed with status ${response.status}`);
  }
}

async function handleContact(request, env) {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: {
        Allow: 'POST',
        'cache-control': 'no-store'
      }
    });
  }

  const formData = await request.formData();

  if (getTrimmedValue(formData, 'bot-field')) {
    return Response.redirect(new URL('/success', request.url), 303);
  }

  const name = getTrimmedValue(formData, 'name');
  const email = getTrimmedValue(formData, 'email');
  const phone = getTrimmedValue(formData, 'phone');
  const date = getTrimmedValue(formData, 'date');
  const service = getTrimmedValue(formData, 'service');
  const message = getTrimmedValue(formData, 'message');
  const consent = formData.get('consent');

  if (!name || !email || !service || !message || !consent) {
    return textResponse('Merci de remplir tous les champs obligatoires.', 400);
  }

  if (!EMAIL_PATTERN.test(email)) {
    return textResponse('Merci de fournir une adresse email valide.', 400);
  }

  if (name.length > 200 || service.length > 100 || phone.length > 50 || date.length > 50 || message.length > MAX_MESSAGE_LENGTH) {
    return textResponse('Certaines informations dépassent la longueur autorisée.', 400);
  }

  try {
    await forwardSubmission(env, {
      name,
      email,
      phone,
      date,
      service,
      message,
      consent: true,
      submittedAt: new Date().toISOString(),
      ip: request.headers.get('CF-Connecting-IP') || null,
      userAgent: request.headers.get('User-Agent') || null,
      source: 'cloudflare-pages-contact-form'
    });
  } catch (error) {
    console.error('Contact submission forwarding failed', error);
    return textResponse('Une erreur est survenue lors de l’envoi du message.', 502);
  }

  return Response.redirect(new URL('/success', request.url), 303);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/contact') {
      return handleContact(request, env);
    }

    return env.ASSETS.fetch(request);
  }
};
