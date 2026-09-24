import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { cardOffer, cardToken, likeExact } from '../lib/card-bonus.js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, deviceId, cardCode } = req.body;
  // A business-card claim (lib/card-bonus.js); null when there is none or the
  // code has been switched off.
  const offer = cardCode ? cardOffer(cardCode) : null;
  if (cardCode && !offer) {
    return res.status(400).json({ error: 'That card offer has ended.' });
  }

  if (!email || !deviceId) {
    return res.status(400).json({ error: 'Email and device ID are required.' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  try {
    let { data: customer, error: findError } = await supabase
      .from('customers')
      .select('id, email_verified')
      .eq('device_id', deviceId)
      .maybeSingle();

    // A card visitor arrives brand new: no row yet, and at 0 spins the studio
    // will not let them generate to make one. Create it here at 0 -- the spins
    // come only from the verified email, never from the device.
    if (!customer && !findError && offer) {
      const created = await supabase.from('customers').insert({ device_id: deviceId, token_balance: 0 }).select('id, email_verified').single();
      customer = created.data; findError = created.error;
    }

    if (findError || !customer) {
      return res.status(404).json({ error: 'Could not find your account. Try generating an image first.', detail: findError ? findError.message : 'no customer' });
    }

    if (customer.email_verified) {
      return res.status(400).json({ error: 'This device has already verified an email.' });
    }

    // Once per email address: an address already verified anywhere has had
    // its free spins, so a card cannot pay it again from another device.
    if (offer) {
      const { data: used, error: usedError } = await supabase
        .from('customers')
        .select('id')
        .ilike('email', likeExact(email))
        .eq('email_verified', true)
        .limit(1);
      if (usedError) {
        return res.status(500).json({ error: 'Could not check your email just now. Please try again.' });
      }
      if (used && used.length) {
        return res.status(400).json({ error: 'That email has already claimed its free spins.' });
      }
    }

    const random = crypto.randomBytes(32).toString('hex');
    const token = offer ? cardToken(offer.code, random) : random;

    const { error: updateError } = await supabase
      .from('customers')
      .update({ email, verification_token: token })
      .eq('id', customer.id);

    if (updateError) {
      return res.status(500).json({ error: 'Could not save your email. Please try again.', detail: updateError.message });
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
        subject: offer ? `Verify your email for your ${offer.spins} free spins!` : 'Verify your email for a free bonus token!',
        html: offer
          ? `<p>Thanks for scanning our card! Click below to verify your email and unlock your ${offer.spins} free spins:</p><p><a href="${verifyUrl}">Verify My Email</a></p>`
          : `<p>Click below to verify your email and unlock a free bonus token:</p><p><a href="${verifyUrl}">Verify My Email</a></p>`
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
