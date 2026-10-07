import { createClient } from '@supabase/supabase-js';
import { cardOffer, cardFromToken, likeExact } from '../lib/card-bonus.js';
import { takeFromPool } from '../lib/free-pool.js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  const { token } = req.query;

  if (!token) {
    return res.status(400).send('Missing verification link. Please check the link in your email and try again.');
  }

  try {
    const { data: customer, error: findError } = await supabase
      .from('customers')
      .select('id, email, email_verified, token_balance')
      .eq('verification_token', token)
      .single();

    if (findError || !customer) {
      return res.status(404).send('This verification link is invalid or has expired.');
    }

    if (customer.email_verified) {
      return res.status(200).send('This email is already verified. You\'re all set!');
    }

    // A business-card claim pays the card's spins -- if the code is still on,
    // and if this email has not been verified anywhere else in the meantime
    // (two claims sent from two windows, both links clicked). Otherwise the
    // ordinary single bonus token.
    let credit = 1;
    let cardSpins = 0;
    let poolOffer = null;     // a flyer's offer: where to send them back, and whether the pool paid
    let poolShut = false;
    const cardCode = cardFromToken(token);
    if (cardCode) {
      const offer = cardOffer(cardCode);
      if (offer && offer.pool) poolOffer = offer;
      const { data: used, error: usedError } = await supabase
        .from('customers')
        .select('id')
        .ilike('email', likeExact(customer.email))
        .eq('email_verified', true)
        .neq('id', customer.id)
        .limit(1);
      if (usedError) {
        return res.status(500).send('Something went wrong checking your email. Please try again.');
      }
      if (used && used.length) credit = 0;
      // A flyer's tries are drawn from the shared pool (lib/free-pool.js); if it
      // closed between the email and the click, the ordinary bonus token.
      else if (offer && offer.pool) {
        if (await takeFromPool(offer.pool, offer.spins)) { credit = offer.spins; cardSpins = offer.spins; }
        else poolShut = true;
      }
      else if (offer) { credit = offer.spins; cardSpins = offer.spins; }
    }
    const newBalance = (customer.token_balance || 0) + credit;

    const { error: updateError } = await supabase
      .from('customers')
      .update({ email_verified: true, token_balance: newBalance, verification_token: null })
      .eq('id', customer.id);

    if (updateError) {
      return res.status(500).send('Something went wrong crediting your token. Please contact support.');
    }

    // A flyer's visitor goes back to the flyer's page, where their idea is
    // still typed in the box; nothing about the studio.
    if (poolOffer) {
      const page = 'https://muggshotz.com' + poolOffer.page;
      const said = cardSpins ? `Your ${cardSpins} free tries are ready.` : poolShut ? "Today's free tries were all taken just before you tapped, so you've got one free try instead." : credit ? "You've got a free try waiting." : 'This email has already had its free tries.';
      return res.status(200).send(`
      <html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
        <body style="font-family: sans-serif; text-align: center; padding: 60px 20px; background: #111; color: #fff;">
          <h1 style="color: #ff6a00;">You're in!</h1>
          <p>${said}</p>
          <p>Go back to the page you came from: your idea is still there, ready to go.</p>
          <a href="${page}" style="display:inline-block;margin-top:20px;background:#ff6a00;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Back to my idea</a>
        </body>
      </html>
    `);
    }

    return res.status(200).send(`
      <html>
        <body style="font-family: sans-serif; text-align: center; padding: 60px 20px; background: #111; color: #fff;">
          <h1 style="color: #ff6a00;">Email Verified!</h1>
          <p>${cardSpins ? `Your ${cardSpins} free spins are waiting for you.` : credit ? "You've got a free bonus token waiting for you." : 'This email has already claimed its free spins.'}</p>
          <a href="https://muggshotz-ai-test.vercel.app/" style="display:inline-block;margin-top:20px;background:#ff6a00;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Go Create Your Caricature</a>
        </body>
      </html>
    `);

  } catch (err) {
    return res.status(500).send('Something went wrong. Please try again.');
  }
}
