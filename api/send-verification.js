import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, deviceId } = req.body;

  if (!email || !deviceId) {
    return res.status(400).json({ error: 'Email and device ID are required.' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  try {
    const { data: customer, error: findError } = await supabase
      .from('customers')
      .select('id, email_verified')
      .eq('device_id', deviceId)
      .single();

    if (findError || !customer) {
      return res.status(404).json({ error: 'Could not find your account. Try generating an image first.' });
    }

    if (customer.email_verified) {
      return res.status(400).json({ error: 'This device has already verified an email.' });
    }

    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');

    const { error: updateError } = await supabase
      .from('customers')
      .update({ email, verification_token: token })
      .eq('id', customer.id);

    if (updateError) {
      return res.status(500).json({ error: 'Could not save your email. Please try again.' });
    }

    const verifyUrl = `https://muggshotz-ai-test.vercel.app/api/verify-email?token=${token}`;

    const emailResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Muggshotz <onboarding@resend.dev>',
        to: email,
        subject: 'Verify your email for a free bonus token!',
        html: `<p>Click below to verify your email and unlock a free bonus token:</p><p><a href="${verifyUrl}">Verify My Email</a></p>`
      })
    });

    if (!emailResp.ok) {
      const errText = await emailResp.text();
      return res.status(500).json({ error: 'Could not send verification email.', detail: errText });
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
