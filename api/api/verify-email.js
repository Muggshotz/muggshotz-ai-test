import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  const { token } = req.query;

  if (!token) {
    return res.status(400).send('Missing verification link. Please check the link in your email and try again.');
  }

  try {
    const { data: customer, error: findError } = await supabase
      .from('customers')
      .select('id, email_verified, token_balance')
      .eq('verification_token', token)
      .single();

    if (findError || !customer) {
      return res.status(404).send('This verification link is invalid or has expired.');
    }

    if (customer.email_verified) {
      return res.status(200).send('This email is already verified. You\'re all set!');
    }

    const newBalance = (customer.token_balance || 0) + 1;

    const { error: updateError } = await supabase
      .from('customers')
      .update({ email_verified: true, token_balance: newBalance, verification_token: null })
      .eq('id', customer.id);

    if (updateError) {
      return res.status(500).send('Something went wrong crediting your token. Please contact support.');
    }

    return res.status(200).send(`
      <html>
        <body style="font-family: sans-serif; text-align: center; padding: 60px 20px; background: #111; color: #fff;">
          <h1 style="color: #ff6a00;">Email Verified!</h1>
          <p>You've got a free bonus token waiting for you.</p>
          <a href="https://muggshotz-ai-test.vercel.app/" style="display:inline-block;margin-top:20px;background:#ff6a00;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Go Create Your Caricature</a>
        </body>
      </html>
    `);

  } catch (err) {
    return res.status(500).send('Something went wrong. Please try again.');
  }
}
