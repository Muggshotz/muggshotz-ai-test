// api/named-print.js
//
// A NAMED MAT'S PICTURE (lib/named-designs.js): ?design=<key>&name=<name>
// &size=show|print. show is the page's picture with the name on it (the
// preview as they type); print is the print file with the name on it, the
// URL the order carries as its design (occasion.html occOrderMat), fetched
// by the Printify order like any other print. The base picture is read from
// this site. A blank name serves the picture as it is.
import { NAMED_DESIGNS, cleanName, renderNamed } from "../lib/named-designs.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });
  const key = String(req.query.design || ""), d = NAMED_DESIGNS[key];
  if (!d) return res.status(404).json({ error: "Not a named design" });
  const size = req.query.size === "print" ? "print" : "show";
  const name = cleanName(req.query.name, d);
  if (name === null) return res.status(400).json({ error: `Up to ${d.maxLen} letters, numbers, spaces, hyphens or apostrophes.` });
  try {
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    const proto = /^(localhost|127\.0\.0\.1)/.test(host) ? "http" : "https";
    const r = await fetch(`${proto}://${host}/${d[size]}`);
    if (!r.ok) throw new Error(`The picture could not be read: ${r.status}`);
    const out = await renderNamed(d, name, Buffer.from(await r.arrayBuffer()));
    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400");
    return res.status(200).send(out);
  } catch (e) {
    console.error("named-print:", e.message);
    return res.status(500).json({ error: "The picture could not be made just now." });
  }
}
