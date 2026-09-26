// PITCH IN AND REPORT A BUG (Alyx, 26 Sep 2026). One window, two uses:
//   openPitch('idea') -- Pitch In: a customer's idea for a product, under the
//                        Pitch In terms (PITCH-IN-TERMS.md);
//   openPitch('bug')  -- Report a bug, from the small button this file puts
//                        in the corner of every page that loads it.
// Both send to /api/admin (action "pitch"), which saves the pitch, emails it
// to Alyx ("My Idea: ..." / "Bug Report: ...") and rings his phone. Needs no
// photo and no account: an idea can come from anyone, before any upload.
(function () {
  const TERMS = [
    ['Pitch an idea.', 'Tell us what you would like to see on a mug, a shirt, a card, or anything else we make. Explain the premise of the idea, and the punch line if there is one. A sketch or photo helps.'],
    ["We'll try to read every pitch.", "We can't reply to every one. If we make yours, we'll let you know."],
    ['If we make it, you earn.', 'Your idea becomes a product in the shop and you are credited as its inventor. On every sale you get 5% of our net profit on that item, and 10 free chips so you can try it yourself.'],
    ['One year per item.', 'Your 5% is paid on every sale of an item for one year from the day it goes on sale. You also hold a 5% stake in your category: every new item added to it earns you 5% for its own year.'],
    ['Found a bug? Tell us.', 'The first person to report a bug gets two free tokens when we fix it.']
  ];
  const css = `
#pitchOverlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:2500;align-items:flex-start;justify-content:center;padding:4vh 16px;overflow-y:auto}
#pitchOverlay.open{display:flex}
#pitchBox{background:#131b27;border:1px solid #24344a;border-radius:14px;max-width:480px;width:100%;padding:1.4rem 1.3rem;color:#cfe3ff;font-family:inherit;box-sizing:border-box}
#pitchBox h2{margin:0 0 .3rem;font-family:Georgia,serif;font-style:italic;font-size:17px;letter-spacing:.5px;text-transform:uppercase;color:#9fb3e0}
#pitchBox .pi-lead{color:#29a3ff;font-size:13px;line-height:1.5;margin:0 0 1rem}
#pitchBox label{display:block;font-size:12px;color:#7ab8ff;margin:.8rem 0 .3rem}
#pitchBox textarea,#pitchBox input[type=text],#pitchBox input[type=email]{width:100%;box-sizing:border-box;background:#0b1018;border:1px solid #24344a;border-radius:8px;color:#e6f0ff;padding:.6rem .7rem;font-size:14px;font-family:inherit}
#pitchBox textarea{min-height:110px;resize:vertical}
#pitchBox .pi-row{display:flex;gap:10px}#pitchBox .pi-row>div{flex:1}
#pitchBox .pi-pic{display:flex;align-items:center;gap:10px;font-size:12px;color:#5b7aa6}
#pitchBox .pi-pic img{max-height:60px;border-radius:6px}
#pitchBox details{margin-top:1rem;font-size:12px;color:#7ab8ff}
#pitchBox details ol{padding-left:1.2rem;line-height:1.5;color:#9fb3e0}
#pitchBox .pi-agree{display:flex;gap:8px;align-items:flex-start;font-size:13px;color:#cfe3ff;margin-top:.9rem}
#pitchBox .pi-agree input{margin-top:3px}
#pitchBox .pi-send{display:block;width:100%;margin-top:1.1rem;background:#1d6fd0;color:#fff;border:0;border-radius:10px;padding:.85rem;font-size:15px;font-weight:600;cursor:pointer}
#pitchBox .pi-send:disabled{opacity:.6;cursor:default}
#pitchBox .pi-close{display:block;width:100%;margin-top:.6rem;background:transparent;border:1px solid #1d4f91;border-radius:10px;padding:.7rem;color:#1d6fd0;font-size:14px;cursor:pointer}
#pitchBox .pi-msg{margin-top:.8rem;font-size:13px;min-height:1em}
#pitchBox .pi-msg.bad{color:#ff8a80}
#pitchBox .pi-done{font-size:15px;line-height:1.6;color:#cfe3ff;text-align:center;padding:1.2rem 0 .4rem}
#pitchBox .pi-hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
#bugReportBtn{position:fixed;left:6px;bottom:26px;z-index:998;background:#0b1018;border:1px solid #24344a;border-radius:14px;color:#7ab8ff;font-size:11px;padding:4px 10px;cursor:pointer;opacity:.85}
#bugReportBtn:hover{opacity:1}
`;
  let kind = 'idea', image = null;

  function build() {
    if (document.getElementById('pitchOverlay')) return;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    const ov = document.createElement('div');
    ov.id = 'pitchOverlay';
    ov.setAttribute('role', 'dialog');
    ov.innerHTML = '<div id="pitchBox"></div>';
    ov.addEventListener('click', (e) => { if (e.target === ov) closePitch(); });
    document.body.appendChild(ov);
    const bug = document.createElement('button');
    bug.type = 'button'; bug.id = 'bugReportBtn'; bug.textContent = '🐞 Report a bug';
    bug.addEventListener('click', () => openPitch('bug'));
    document.body.appendChild(bug);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && ov.classList.contains('open')) closePitch(); });
  }

  function render() {
    const idea = kind === 'idea';
    document.getElementById('pitchBox').innerHTML =
      '<h2>' + (idea ? '💡 Pitch In' : '🐞 Report a bug') + '</h2>'
      + '<p class="pi-lead">' + (idea
        ? 'Got an idea for a mug, a shirt, a card, anything? Tell us. If we make it, you earn 5% of our profit on it.'
        : 'Tell us what went wrong and what you were doing. The first person to report a bug gets <b>two free tokens</b> when we fix it.') + '</p>'
      + '<label for="pitchText">' + (idea ? 'Your idea' : 'What went wrong?') + '</label>'
      + '<textarea id="pitchText" maxlength="3000" placeholder="' + (idea ? 'Explain the premise of your idea, and the punch line if there is one.' : 'What you did, what you expected, what happened.') + '"></textarea>'
      + '<label>' + (idea ? 'A sketch or photo (optional)' : 'A screenshot (optional)') + '</label>'
      + '<div class="pi-pic"><input type="file" id="pitchPic" accept="image/*"/><img id="pitchPicPreview" alt="" style="display:none"/></div>'
      + '<div class="pi-row"><div><label for="pitchName">Your name' + (idea ? '' : ' (optional)') + '</label><input type="text" id="pitchName" maxlength="80"/></div>'
      + '<div><label for="pitchEmail">Your email' + (idea ? '' : ' (optional)') + '</label><input type="email" id="pitchEmail" maxlength="120"/></div></div>'
      + '<div class="pi-hp" aria-hidden="true"><input type="text" id="pitchWebsite" tabindex="-1" autocomplete="off"/></div>'
      + (idea ? '<details><summary>The Pitch In terms</summary><ol>' + TERMS.map(([h, t]) => '<li><b>' + h + '</b> ' + t + '</li>').join('') + '</ol></details>'
        + '<label class="pi-agree"><input type="checkbox" id="pitchAgree"/> I agree to the Pitch In terms.</label>' : '')
      + '<button type="button" class="pi-send" id="pitchSend">' + (idea ? 'Send my idea' : 'Send the report') + '</button>'
      + '<div class="pi-msg" id="pitchMsg"></div>'
      + '<button type="button" class="pi-close" id="pitchClose">← Back</button>';
    image = null;
    document.getElementById('pitchPic').addEventListener('change', readPicture);
    document.getElementById('pitchSend').addEventListener('click', send);
    document.getElementById('pitchClose').addEventListener('click', closePitch);
    try {
      const saved = JSON.parse(localStorage.getItem('muggshotz_pitch_from') || 'null');
      if (saved) { document.getElementById('pitchName').value = saved.name || ''; document.getElementById('pitchEmail').value = saved.email || ''; }
    } catch (e) {}
  }

  // A picture is shrunk in the browser (longest side 1600) before it is sent.
  function readPicture(e) {
    const f = e.target.files && e.target.files[0];
    image = null;
    const pv = document.getElementById('pitchPicPreview');
    pv.style.display = 'none';
    if (!f) return;
    const url = URL.createObjectURL(f), im = new Image();
    im.onload = () => {
      const s = Math.min(1, 1600 / Math.max(im.naturalWidth, im.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s);
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height);
      image = c.toDataURL('image/jpeg', 0.85);
      pv.src = image; pv.style.display = 'block';
      URL.revokeObjectURL(url);
    };
    im.onerror = () => { msg('That picture could not be read.', true); URL.revokeObjectURL(url); };
    im.src = url;
  }

  function msg(t, bad) { const m = document.getElementById('pitchMsg'); m.textContent = t; m.className = 'pi-msg' + (bad ? ' bad' : ''); }
  const val = (id) => (document.getElementById(id) || {}).value || '';

  function context() {
    // The page's own globals (APP_VERSION, product), read if the page has them.
    const g = (n) => { try { return new Function('return typeof ' + n + '!=="undefined"?' + n + ':""')(); } catch (e) { return ''; } };
    return {
      page: location.pathname + location.search,
      focus: Array.from(document.body.classList).filter((c) => c.endsWith('-focus')).join(' '),
      version: String(g('APP_VERSION') || ''),
      product: String(g('product') || ''),
      viewport: innerWidth + 'x' + innerHeight,
      userAgent: navigator.userAgent
    };
  }

  async function send() {
    const idea = kind === 'idea';
    const text = val('pitchText').trim(), name = val('pitchName').trim(), email = val('pitchEmail').trim();
    if (text.length < 5) return msg(idea ? 'Please tell us your idea.' : 'Please tell us what went wrong.', true);
    if (idea && !email) return msg('Please give your email, so we can reach you if we make it.', true);
    if (idea && !document.getElementById('pitchAgree').checked) return msg('Please agree to the Pitch In terms.', true);
    const btn = document.getElementById('pitchSend');
    btn.disabled = true; msg('Sending…');
    let deviceId = '';
    try { deviceId = localStorage.getItem('muggshotz_device_id') || ''; } catch (e) {}
    try {
      const resp = await fetch('/api/admin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pitch', kind, text, name, email, image, deviceId, website: val('pitchWebsite'),
          agree: idea ? true : undefined, context: idea ? undefined : context() })
      });
      const j = await resp.json().catch(() => ({}));
      if (!resp.ok) { btn.disabled = false; return msg(j.error || 'Sorry, that did not go through. Please try again.', true); }
      try { if (name || email) localStorage.setItem('muggshotz_pitch_from', JSON.stringify({ name, email })); } catch (e) {}
      document.getElementById('pitchBox').innerHTML = '<h2>' + (idea ? '💡 Pitch In' : '🐞 Report a bug') + '</h2>'
        + '<div class="pi-done" id="pitchDone">' + (idea
          ? 'Thank you! We have your idea.<br/>If we make it, we\'ll let you know.'
          : 'Thank you! We have your report.<br/>If you\'re the first to report it, you\'ll get two free tokens when it\'s fixed.') + '</div>'
        + '<button type="button" class="pi-close" id="pitchClose">← Back</button>';
      document.getElementById('pitchClose').addEventListener('click', closePitch);
    } catch (e) {
      btn.disabled = false; msg('Sorry, that did not go through. Please check your connection and try again.', true);
    }
  }

  function openPitch(k) {
    build();
    kind = k === 'bug' ? 'bug' : 'idea';
    render();
    document.getElementById('pitchOverlay').classList.add('open');
    document.getElementById('pitchOverlay').scrollTop = 0;
    setTimeout(() => { const t = document.getElementById('pitchText'); if (t) t.focus({ preventScroll: true }); }, 50);
  }
  function closePitch() {
    const ov = document.getElementById('pitchOverlay'); if (ov) ov.classList.remove('open');
  }
  window.openPitch = openPitch;
  window.closePitch = closePitch;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
