import fs from "fs";
import path from "path";

// Vercel kills a function once it exceeds this duration and returns its
// own plain-text error page instead of JSON — which is what caused the
// front end's "Unexpected token 'A'... is not valid JSON" crash. 300s is
// the maximum allowed on the Hobby plan (with Fluid Compute enabled),
// giving real caricature generations enough headroom to finish normally.
export const config = {
  maxDuration: 300,
};

// Maps the theme name sent from the front end to its exact reference image
// filename in the repo root. Filenames include spaces exactly as uploaded.
const TEMPLATE_FILES = {
  "Marbling": "laced marble.png",
  "Cloud Mist": "clouds.png",
  "Pastel Leaf": "pastel leaf.png",
  "Satin Sheets": "satin sheets.png",
  "Frosted Glass": "frosted mirror.png",
  "Bubble Drift": "bubble drift.png",
  "Rose Crepe": "rose crepe.png",
  "Fade to White": "fade to white.png"
};

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Looks up a customer row by device ID. Returns null if no row exists yet.
async function findCustomerByDeviceId(deviceId) {
  const url = `${SUPABASE_URL}/rest/v1/customers?device_id=eq.${encodeURIComponent(deviceId)}&select=id,token_balance,role`;
  const resp = await fetch(url, {
    headers: {
      "apikey": SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
    }
  });
  const rows = await resp.json();
  if (!resp.ok) throw new Error("Supabase lookup failed: " + JSON.stringify(rows));
  return rows.length > 0 ? rows[0] : null;
}

// Creates a brand-new customer row for a first-time device, starting with
// 1 free token (their first free generation).
async function createCustomerForDevice(deviceId) {
  const url = `${SUPABASE_URL}/rest/v1/customers`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "apikey": SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation"
    },
    body: JSON.stringify({ device_id: deviceId, token_balance: 1 })
  });
  const rows = await resp.json();
  if (!resp.ok) throw new Error("Supabase insert failed: " + JSON.stringify(rows));
  return rows[0];
}

// Deducts exactly 1 token from a customer's balance after a successful
// generation. Now runs for admin accounts too, so the meter shows a real,
// moving countdown instead of a static infinity symbol. Admin accounts
// are still never blocked from generating regardless of how low (or
// negative) this number goes — that's enforced separately below, not here.
async function deductOneToken(customerId, currentBalance) {
  const url = `${SUPABASE_URL}/rest/v1/customers?id=eq.${customerId}`;
  const resp = await fetch(url, {
    method: "PATCH",
    headers: {
      "apikey": SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation"
    },
    body: JSON.stringify({ token_balance: currentBalance - 1 })
  });
  const rows = await resp.json();
  if (!resp.ok) throw new Error("Supabase token deduction failed: " + JSON.stringify(rows));
  return rows[0];
}

// Uploads the generated image bytes to Supabase Storage and returns a
// permanent public URL, so we never store giant base64 blobs in the
// database or send them back over the wire more than once.
async function uploadGenerationToStorage(imageBuffer, deviceId) {
  const fileName = `${deviceId}-${Date.now()}.png`;
  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/generations/${fileName}`;
  const resp = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "apikey": SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "image/png"
    },
    body: imageBuffer
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error("Supabase storage upload failed: " + errText);
  }
  return `${SUPABASE_URL}/storage/v1/object/public/generations/${fileName}`;
}

// Saves a record of this generation so it can later be shown in the
// "pick from your recent generations" picker for multi-placement orders.
async function saveGenerationRecord(customerId, promptText, theme, imageUrl) {
  const
