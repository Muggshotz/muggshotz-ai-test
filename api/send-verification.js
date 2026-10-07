import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { cardOffer, cardToken, likeExact } from '../lib/card-bonus.js';
import { readPool, poolHasRoom } from '../lib/free-pool.js';

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

  // A flyer's free tries come from the shared pool (lib/free-pool.js): when
  // it is closed, say so now rather than promise tries the link cannot pay.
  if (offer && offer.pool) {
    try {
      if (!poolHasRoom(await readPool(offer.pool), offer.spins)) {
        return res.status(409).json({ error: "Today's free tries are all taken.", closed: true });
      }
    } catch (e) {
      return res.status(500).json({ error: 'Could not check the free tries just now. Please try again.' });
    }
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
        // From the verified domain (7 Oct 2026): Resend's practice address
        // (onboarding@resend.dev) delivered only to the account's own inbox,
        // so no flyer visitor ever got their link.
        from: process.env.RESEND_FROM || 'Muggshotz <hello@muggshotz.com>',
        to: email,
        subject: offer && offer.pool ? `Your ${offer.spins} free tries are one tap away` : offer ? `Verify your email for your ${offer.spins} free spins!` : 'Verify your email for a free bonus token!',
        html: offer && offer.pool
          ? `<p>Tap below to unlock your ${offer.spins} free tries, then go back to the page you were on: your idea is still waiting there.</p><p><a href="${verifyUrl}">Unlock My ${offer.spins} Free Tries</a></p>`
          : offer
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
