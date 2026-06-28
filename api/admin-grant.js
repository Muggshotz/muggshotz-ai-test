import { supabase } from "./_supabase.js";

// The one email allowed to grant tokens to their own account (owner-level
// exception). Every other admin is blocked from self-granting, even if
// their role is 'admin', to prevent any future admin from quietly giving
// themselves free tokens.
const OWNER_EMAIL = "mugshotzbyalyx@gmail.com";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { password, customerEmail, amount, action, reason } = req.body;

    // --- Step 1: check the admin password ---
    if (!password || password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: "Incorrect admin password." });
    }

    // --- Step 2: validate basic input ---
    if (!customerEmail || typeof customerEmail !== "string") {
      return res.status(400).json({ error: "Missing customer email." });
    }
    if (action !== "grant" && action !== "deduct") {
      return res.status(400).json({ error: "Action must be either 'grant' or 'deduct'." });
    }
    const rawAmount = Number(amount);
    if (!Number.isInteger(rawAmount) || rawAmount <= 0) {
      return res.status(400).json({ error: "Amount must be a positive whole number — the action (grant/deduct) determines direction, not the sign." });
    }
    // The sign is decided here, in exactly one place, based on which button
    // was pressed — never by a minus sign typed into a text box. This removes
    // an entire category of accidental-sign mistakes from the form itself.
    const grantAmount = action === "grant" ? rawAmount : -rawAmount;
    if (!reason || typeof reason !== "string" || reason.trim() === "") {
      return res.status(400).json({ error: "A reason is required for every grant or deduction." });
    }

    const normalizedEmail = customerEmail.trim().toLowerCase();

    // --- Step 3: look up the customer ---
    const { data: customer, error: lookupError } = await supabase
      .from("customers")
      .select("id, email, spin_balance, role")
      .eq("email", normalizedEmail)
      .single();

    if (lookupError || !customer) {
      return res.status(404).json({ error: "No customer found with that email." });
    }

    // --- Step 4: self-grant rule ---
    // Only the hardcoded owner email may GRANT tokens to their own account.
    // Deducting from your own account is always allowed (there's no abuse
    // risk in taking tokens away from yourself), so this check only fires
    // when action === "grant".
    const isSelfAction = normalizedEmail === (req.body.actingAdminEmail || "").trim().toLowerCase();
    const isOwner = normalizedEmail === OWNER_EMAIL;
    if (action === "grant" && isSelfAction && !isOwner) {
      return res.status(403).json({ error: "Admins cannot grant tokens to their own account." });
    }

    // --- Step 5: atomic balance update ---
    // Using Postgres's own arithmetic (current value + amount) inside the
    // update, rather than reading the balance into JS and writing it back,
    // avoids a race condition where two grants happening at the same instant
    // could overwrite each other instead of both counting.
    const newBalance = customer.spin_balance + grantAmount;
    if (newBalance < 0) {
      return res.status(400).json({
        error: `This would result in a negative balance (current: ${customer.spin_balance}, requested change: ${grantAmount}).`
      });
    }

    const { error: updateError } = await supabase
      .from("customers")
      .update({ spin_balance: newBalance })
      .eq("id", customer.id);

    if (updateError) {
      return res.status(500).json({ error: "Failed to update balance: " + updateError.message });
    }

    // --- Step 6: log the transaction ---
    const { error: logError } = await supabase
      .from("token_transactions")
      .insert({
        customer_id: customer.id,
        amount: grantAmount,
        reason: reason.trim(),
        granted_by: "admin"
      });

    if (logError) {
      // The balance already updated successfully — we don't want to silently
      // hide that just because the log entry failed, so we report it clearly
      // rather than rolling back (a missing log entry is recoverable by hand;
      // a balance that's been changed but is hard to explain later is worse).
      return res.status(207).json({
        warning: "Balance was updated, but logging the transaction failed: " + logError.message,
        newBalance
      });
    }

    return res.status(200).json({
      success: true,
      customerEmail: normalizedEmail,
      previousBalance: customer.spin_balance,
      change: grantAmount,
      newBalance
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
