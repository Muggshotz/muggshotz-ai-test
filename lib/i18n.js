/* Muggshotz language suite — runtime translation layer.
 *
 * HOW IT WORKS
 * The English text written into the pages stays exactly where it is and is
 * the source of truth. Each other language is one file, lang/<code>.json,
 * mapping an English phrase to its translation:
 *     { "Tap here to upload a photo": "Toca aquí para subir una foto" }
 * When a language is chosen this script walks the page, swaps every text
 * node and labelled attribute (placeholder, title, alt, aria-label, button
 * value) whose English matches a key, and keeps watching the page so text
 * the studio writes later (status lines, notes, buttons) is swapped as it
 * appears. window.alert/confirm/prompt are wrapped so dialogs translate too.
 * A phrase with no entry stays English. English mode does nothing at all.
 *
 * Keys are the English phrase with whitespace collapsed to single spaces.
 * A key may contain {0}, {1}... where the studio inserts a value:
 *     "Use your photo exactly as it is? ... your {0} unchanged ..."
 * The captured value is itself looked up, so a product name inside a
 * sentence translates when it has its own entry.
 *
 * Nothing sent to the AI is touched: prompts never reach the page as text.
 * Add data-i18n-skip to any element whose text must never be translated.
 *
 * lang/index.json lists the languages that have a file. The picker shows
 * only when more than one is listed, so a page with English alone looks
 * exactly as it did before this script existed.
 */
(function () {
  'use strict';
  if (window.MZ_I18N) return;

  var STORAGE_KEY = 'mz_lang';
  var ATTRS = ['placeholder', 'title', 'alt', 'aria-label', 'value'];
  var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEMPLATE: 1 };
  var SKIP_TEXT_IN = { TEXTAREA: 1 }; // attributes translate, the text inside is the customer's
  var LETTERS = /\p{L}\p{L}/u;

  // Native names, picker order. dir marks right-to-left scripts.
  var LANG_INFO = {
    en: { name: 'English' },
    es: { name: 'Español' },
    pt: { name: 'Português' },
    fr: { name: 'Français' },
    it: { name: 'Italiano' },
    de: { name: 'Deutsch' },
    pl: { name: 'Polski' },
    hr: { name: 'Hrvatski' },
    ru: { name: 'Русский' },
    tr: { name: 'Türkçe' },
    hi: { name: 'हिन्दी' },
    'zh-Hans': { name: '简体中文' },
    'zh-Hant': { name: '繁體中文' },
    ja: { name: '日本語' },
    ko: { name: '한국어' },
    vi: { name: 'Tiếng Việt' },
    id: { name: 'Bahasa Indonesia' },
    tl: { name: 'Tagalog' },
    ar: { name: 'العربية', dir: 'rtl' },
    fa: { name: 'فارسی', dir: 'rtl' }
  };

  // Labels the pages draw with CSS content: (pseudo-elements). They are not
  // page text, so the walker never sees them; each gets a style rule instead.
  var CSS_CONTENT = [
    { sel: '#tokenMeterWrap::before', en: 'NEEDLES STUDIO CURRENCY' },
    { sel: '#tokenMeterWrap::after', en: 'CHIPS REMAINING' },
    { sel: '#creditsModalOverlay > .card::before', en: 'NEEDLES STUDIO EXCHANGE' }
  ];
  var cssStyle = null;
  function applyCssContent() {
    var rules = '';
    CSS_CONTENT.forEach(function (c) {
      var t = lookup(c.en);
      if (t != null) rules += c.sel + '{content:"' + t.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"}\n';
    });
    if (!cssStyle) { cssStyle = document.createElement('style'); cssStyle.id = 'mzI18nCss'; document.head.appendChild(cssStyle); }
    cssStyle.textContent = rules;
  }

  var available = ['en'];
  var current = 'en';
  var active = false;          // true when a non-English dictionary is loaded
  var dict = {};               // exact-phrase entries
  var patterns = [];           // entries whose key carries {n} placeholders
  var seen = new Set();        // every English phrase the page has shown (coverage tool)
  // Coverage tool: with localStorage.mz_i18n_collect = '1' every phrase seen is
  // mirrored into sessionStorage so a test run can dump the full list after
  // driving the flows. Off by default, costs nothing when off.
  var collecting = false;
  try { collecting = localStorage.getItem('mz_i18n_collect') === '1'; } catch (e) {}
  var flushTimer = null;
  function noteSeen(key) {
    if (seen.has(key)) return;
    seen.add(key);
    if (!collecting || flushTimer) return;
    flushTimer = setTimeout(function () {
      flushTimer = null;
      try {
        var prev = JSON.parse(sessionStorage.getItem('mz_i18n_seen') || '[]');
        var merged = new Set(prev); seen.forEach(function (k) { merged.add(k); });
        sessionStorage.setItem('mz_i18n_seen', JSON.stringify(Array.from(merged)));
      } catch (e) {}
    }, 200);
  }
  var textSrc = new WeakMap(); // text node -> English it originally held
  var textSet = new WeakMap(); // text node -> the value we last wrote
  var attrRec = new WeakMap(); // element -> { attr: English, 'set:attr': written }
  var observer = null;

  function norm(s) { return String(s).replace(/\s+/g, ' ').trim(); }
  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function compile(d) {
    dict = {}; patterns = [];
    Object.keys(d || {}).forEach(function (k) {
      var v = d[k];
      if (typeof v !== 'string' || !v) return;
      if (/\{\d+\}/.test(k)) {
        var order = [];
        var src = '^' + k.split(/(\{\d+\})/).map(function (p) {
          var m = p.match(/^\{(\d+)\}$/);
          if (m) { order.push(m[1]); return '([\\s\\S]+?)'; }
          return esc(p);
        }).join('') + '$';
        patterns.push({ re: new RegExp(src), out: v, order: order });
      } else {
        dict[k] = v;
      }
    });
  }

  function lookup(s) {
    if (!active) return null;
    var d = dict[s];
    if (d != null) return d;
    for (var i = 0; i < patterns.length; i++) {
      var p = patterns[i];
      var m = s.match(p.re);
      if (m) {
        return p.out.replace(/\{(\d+)\}/g, function (_, n) {
          var idx = p.order.indexOf(n);
          var g = idx < 0 ? '' : m[idx + 1];
          if (g == null) return '';
          var inner = lookup(norm(g));
          return inner != null ? inner : g;
        });
      }
    }
    // Composite labels the studio builds from parts it already shows on their
    // own ("Trimmed, 11oz", "Tundra Tumbler, 30oz - White"): translate part
    // by part, but only when every part is a number or has its own entry.
    var seps = [' - ', ', ', ' — '];
    for (var si = 0; si < seps.length; si++) {
      var parts = s.split(seps[si]);
      if (parts.length < 2) continue;
      var outParts = [], ok = true;
      for (var pi = 0; pi < parts.length; pi++) {
        var part = parts[pi].trim();
        if (!LETTERS.test(part)) { outParts.push(part); continue; }
        var tp = dict[part];
        if (tp == null) { ok = false; break; }
        outParts.push(tp);
      }
      if (ok) return outParts.join(seps[si]);
    }
    return null;
  }

  function skipped(el) {
    for (var e = el; e && e.nodeType === 1; e = e.parentNode) {
      if (SKIP_TAGS[e.tagName] || e.hasAttribute('data-i18n-skip') || e.getAttribute('translate') === 'no') return true;
    }
    return false;
  }

  function translateText(n) {
    var raw = n.nodeValue;
    if (textSet.get(n) !== raw) textSrc.set(n, raw); // the page (not us) wrote this: new source
    var src = textSrc.get(n);
    var key = norm(src);
    if (!key || !LETTERS.test(key)) return;
    noteSeen(key);
    var t = lookup(key);
    var out = t == null ? src : src.match(/^\s*/)[0] + t + src.match(/\s*$/)[0];
    if (n.nodeValue !== out) { textSet.set(n, out); n.nodeValue = out; }
  }

  function translateAttrs(el) {
    var rec = attrRec.get(el);
    for (var i = 0; i < ATTRS.length; i++) {
      var a = ATTRS[i];
      if (!el.hasAttribute(a)) continue;
      if (a === 'value' && !(el.tagName === 'INPUT' && /^(button|submit|reset)$/i.test(el.type))) continue;
      var raw = el.getAttribute(a);
      if (!rec) rec = {};
      if (rec['set:' + a] !== raw) rec[a] = raw;
      var key = norm(rec[a]);
      if (!key || !LETTERS.test(key)) continue;
      noteSeen(key);
      var t = lookup(key);
      var out = t == null ? rec[a] : t;
      if (raw !== out) { rec['set:' + a] = out; el.setAttribute(a, out); }
    }
    if (rec) attrRec.set(el, rec);
  }

  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { if (!skipped(root.parentNode) && !(root.parentNode && SKIP_TEXT_IN[root.parentNode.tagName])) translateText(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 11) return;
    if (root.nodeType === 1) { if (skipped(root)) return; translateAttrs(root); }
    var w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (n.nodeType === 1) return (SKIP_TAGS[n.tagName] || n.hasAttribute('data-i18n-skip') || n.getAttribute('translate') === 'no') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var n;
    while ((n = w.nextNode())) {
      if (n.nodeType === 1) translateAttrs(n);
      else if (!(n.parentNode && SKIP_TEXT_IN[n.parentNode.tagName])) translateText(n);
    }
  }

  function translateAll() { walk(document.body); }

  function startObserver() {
    if (observer || !document.body) return;
    observer = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var m = muts[i];
        if (m.type === 'childList') {
          for (var j = 0; j < m.addedNodes.length; j++) walk(m.addedNodes[j]);
        } else if (m.type === 'characterData') {
          if (!skipped(m.target.parentNode) && !(m.target.parentNode && SKIP_TEXT_IN[m.target.parentNode.tagName])) translateText(m.target);
        } else if (m.type === 'attributes') {
          if (!skipped(m.target)) translateAttrs(m.target);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }

  // Dialogs are not part of the page, so they get their own hook.
  ['alert', 'confirm', 'prompt'].forEach(function (fn) {
    var orig = window[fn];
    if (typeof orig !== 'function') return;
    window[fn] = function (msg) {
      var args = Array.prototype.slice.call(arguments);
      if (typeof msg === 'string') {
        var key = norm(msg);
        if (LETTERS.test(key)) {
          noteSeen(key);
          var t = lookup(key);
          if (t != null) args[0] = t;
        }
      }
      return orig.apply(window, args);
    };
  });

  function detect() {
    var langs = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || 'en'];
    for (var i = 0; i < langs.length; i++) {
      var code = String(langs[i] || '');
      var lower = code.toLowerCase();
      var pick = null;
      if (/^zh/.test(lower)) pick = /hant|tw|hk|mo/.test(lower) ? 'zh-Hant' : 'zh-Hans';
      else if (/^(fil|tl)/.test(lower)) pick = 'tl';
      else if (/^in\b/.test(lower)) pick = 'id';
      else pick = lower.split('-')[0];
      if (available.indexOf(pick) >= 0) return pick;
    }
    return 'en';
  }

  function stored() { try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; } }
  function store(code) { try { localStorage.setItem(STORAGE_KEY, code); } catch (e) {} }

  function setLang(code, opts) {
    opts = opts || {};
    if (!LANG_INFO[code]) code = 'en';
    var done;
    if (code === 'en') {
      compile({}); active = false; done = Promise.resolve();
    } else {
      done = fetch('lang/' + code + '.json', { cache: 'no-cache' }).then(function (r) {
        if (!r.ok) throw new Error(r.status);
        return r.json();
      }).then(function (d) { compile(d); active = true; }).catch(function (e) {
        console.warn('i18n: could not load lang/' + code + '.json', e);
        compile({}); active = false; code = 'en';
      });
    }
    return done.then(function () {
      current = code;
      document.documentElement.lang = code;
      document.documentElement.dir = (LANG_INFO[code].dir === 'rtl') ? 'rtl' : 'ltr';
      if (opts.persist !== false) store(code);
      translateAll();
      applyCssContent();
      renderPicker();
      document.dispatchEvent(new CustomEvent('mz:lang', { detail: { lang: code } }));
      return code;
    });
  }

  // ---- picker ----
  var picker = null;
  function renderPicker() {
    if (!document.body) return;
    if (available.length < 2) { if (picker) { picker.remove(); picker = null; } return; }
    if (!picker) {
      var css = document.createElement('style');
      css.textContent =
        '#mzLang{position:fixed;top:10px;left:10px;z-index:999;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}' +
        '#mzLangBtn{display:flex;align-items:center;gap:6px;background:#0b1220;color:#cfe3ff;border:1px solid #1e3a5f;border-radius:999px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.6);letter-spacing:.3px}' +
        '#mzLangBtn:hover{border-color:#29a3ff}' +
        '#mzLangList{display:none;position:absolute;top:36px;left:0;min-width:180px;max-height:70vh;overflow:auto;background:#0b1220;border:1px solid #1e3a5f;border-radius:12px;padding:6px;box-shadow:0 8px 30px rgba(0,0,0,.7)}' +
        '#mzLang.open #mzLangList{display:block}' +
        '#mzLangList button{display:block;width:100%;text-align:left;background:none;border:none;color:#cfe3ff;padding:8px 10px;border-radius:8px;font-size:14px;cursor:pointer}' +
        '#mzLangList button:hover{background:#12213a}' +
        '#mzLangList button.on{color:#29a3ff;font-weight:700}' +
        '[dir=rtl] #mzLang{left:auto;right:10px}[dir=rtl] #mzLangList{left:auto;right:0}[dir=rtl] #mzLangList button{text-align:right}';
      document.head.appendChild(css);
      picker = document.createElement('div');
      picker.id = 'mzLang';
      picker.setAttribute('data-i18n-skip', '');
      picker.innerHTML = '<button id="mzLangBtn" type="button" aria-haspopup="listbox" aria-label="Language"><span aria-hidden="true">🌐</span><span id="mzLangCur"></span></button><div id="mzLangList" role="listbox"></div>';
      document.body.appendChild(picker);
      picker.querySelector('#mzLangBtn').addEventListener('click', function (e) { e.stopPropagation(); picker.classList.toggle('open'); });
      document.addEventListener('click', function () { picker.classList.remove('open'); });
    }
    picker.querySelector('#mzLangCur').textContent = LANG_INFO[current].name;
    var list = picker.querySelector('#mzLangList');
    list.innerHTML = '';
    available.forEach(function (code) {
      if (!LANG_INFO[code]) return;
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = LANG_INFO[code].name;
      b.setAttribute('role', 'option');
      b.setAttribute('lang', code);
      if (code === current) b.className = 'on';
      b.addEventListener('click', function () { picker.classList.remove('open'); setLang(code); });
      list.appendChild(b);
    });
  }

  function boot() {
    startObserver();
    translateAll(); // collects English phrases even before a language loads
    fetch('lang/index.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (idx) {
      if (idx && Array.isArray(idx.available)) {
        available = idx.available.filter(function (c) { return LANG_INFO[c]; });
        if (available.indexOf('en') < 0) available.unshift('en');
      }
      var want = stored();
      if (!want || available.indexOf(want) < 0) want = detect();
      return setLang(want, { persist: !!stored() });
    }).catch(function () { renderPicker(); });
  }

  window.MZ_I18N = {
    setLang: setLang,
    get lang() { return current; },
    get available() { return available.slice(); },
    seen: seen,
    lookup: lookup,
    refresh: translateAll,
    LANG_INFO: LANG_INFO
  };

  if (document.body) boot(); else document.addEventListener('DOMContentLoaded', boot);
})();
