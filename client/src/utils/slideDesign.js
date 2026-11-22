// The design engine of the Presentation Maker. It turns a deck + design options into a list of
// simple drawing instructions ("a rectangle here, text there"). The SAME instructions are used by
//   - the preview in the browser (pages/SlidesPage.jsx), and
//   - the .pptx file builder on the server (server/services/pptx.js),
// so what you see on screen is what you get in PowerPoint. No React and no packages in this file.

export const W = 13.333; // slide size in inches (16:9)
export const H = 7.5;

export const THEMES = {
  ocean: { name: 'Ocean', primary: '0B5FA5', accent: '19B5FE' },
  violet: { name: 'Violet', primary: '6D4AFF', accent: 'A78BFA' },
  emerald: { name: 'Emerald', primary: '0F8A5F', accent: '34D399' },
  sunset: { name: 'Sunset', primary: 'E0522D', accent: 'FBA94C' },
  slate: { name: 'Slate', primary: '334155', accent: '38BDF8' },
  rose: { name: 'Rose', primary: 'BE185D', accent: 'F9A8D4' },
  gold: { name: 'Gold', primary: '92400E', accent: 'F5B301' },
};
export const THEME_IDS = Object.keys(THEMES);

export const TEMPLATES = {
  modern: { name: 'Modern', font: 'Calibri', text: 'Colour header bar' },
  minimal: { name: 'Minimal', font: 'Arial', text: 'Clean and airy' },
  bold: { name: 'Bold', font: 'Trebuchet MS', text: 'Dark and powerful' },
  classic: { name: 'Classic', font: 'Georgia', text: 'Elegant serif' },
  split: { name: 'Split', font: 'Calibri', text: 'Title panel on the side' },
  cards: { name: 'Cards', font: 'Trebuchet MS', text: 'Points in cards' },
};
export const TEMPLATE_IDS = Object.keys(TEMPLATES);

export const FONTS = ['Calibri', 'Arial', 'Georgia', 'Trebuchet MS', 'Verdana', 'Times New Roman'];
export const BULLET_STYLES = ['dots', 'dashes', 'numbers', 'none'];
export const TEXT_SIZES = ['small', 'medium', 'large'];
export const LAYOUTS = ['bullets', 'two-column', 'section', 'quote', 'statement'];

export const DEFAULT_OPTIONS = {
  template: 'modern', theme: 'ocean', font: 'auto', primary: '', accent: '',
  bulletStyle: 'dots', textSize: 'medium', showNumbers: true, showFooter: true, images: true,
};

/** Free AI picture for a slide (made from a short English description). Same address in the preview and the .pptx. */
export const IMAGE_HOST = 'https://image.pollinations.ai/prompt/';
export const imageUrl = (prompt, seed = 0, w = 1024, h = 768) =>
  `${IMAGE_HOST}${encodeURIComponent(`${String(prompt).slice(0, 200)}, professional photography, high quality, clean composition, no text, no watermark`)}` +
  `?width=${w}&height=${h}&nologo=true&seed=${Number(seed) || 0}`;

const HEX = /^#?([0-9a-f]{6})$/i;
const pick = (v, list, fallback) => (list.includes(v) ? v : fallback);

/** Makes any design options (from a form or a request) valid. */
export function normalizeOptions(o = {}) {
  const hex = (v) => (HEX.test(String(v || '')) ? HEX.exec(v)[1].toUpperCase() : '');
  return {
    template: pick(o.template, TEMPLATE_IDS, DEFAULT_OPTIONS.template),
    theme: pick(o.theme, THEME_IDS, DEFAULT_OPTIONS.theme),
    font: pick(o.font, FONTS, 'auto'),
    primary: hex(o.primary),
    accent: hex(o.accent),
    bulletStyle: pick(o.bulletStyle, BULLET_STYLES, DEFAULT_OPTIONS.bulletStyle),
    textSize: pick(o.textSize, TEXT_SIZES, DEFAULT_OPTIONS.textSize),
    showNumbers: o.showNumbers !== false,
    showFooter: o.showFooter !== false,
    images: o.images !== false,
  };
}

/** Mixes colour a towards colour b (ratio 0 = a, 1 = b). Hex without "#". */
export function mix(a, b, ratio) {
  const n = (hex, i) => parseInt(hex.slice(i, i + 2), 16);
  return [0, 2, 4]
    .map((i) => Math.round(n(a, i) + (n(b, i) - n(a, i)) * ratio).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

export function paletteFor(opts) {
  const theme = THEMES[opts.theme] || THEMES.ocean;
  const primary = opts.primary || theme.primary;
  const accent = opts.accent || theme.accent;
  return {
    primary,
    accent,
    dark: mix(primary, '000000', 0.72),
    light: mix(primary, 'FFFFFF', 0.94),
    cream: mix(primary, 'FFF8EC', 0.93),
    text: '1F2937',
    muted: '6B7280',
    white: 'FFFFFF',
  };
}

/** Largest font size (pt) at which the lines fit into the box. A simple estimate, good enough to avoid overflow. */
export function fitSize(items, w, h, start, { min = 14, gapPt = 12, indent = 0.45 } = {}) {
  for (let s = start; s >= min; s -= 1) {
    const perLine = Math.max(4, Math.floor((w - indent) / ((s * 0.52) / 72)));
    let lines = 0;
    for (const t of items) lines += Math.max(1, Math.ceil(t.length / perLine));
    if ((lines * s * 1.22) / 72 + (items.length * gapPt) / 72 <= h) return s;
  }
  return min;
}

const titleSize = (text, base) => (text.length > 70 ? base - 10 : text.length > 50 ? base - 6 : text.length > 34 ? base - 3 : base);
const SCALE = { small: 0.88, medium: 1, large: 1.14 };

const isDark = (hex) => {
  const n = (i) => parseInt(hex.slice(i, i + 2), 16);
  return 0.299 * n(0) + 0.587 * n(2) + 0.114 * n(4) < 140;
};

/**
 * Builds every slide of the deck as drawing instructions.
 * Returns [{ bg, items, notes, rtl, font }], title slide first.
 * Instruction types: rect {x,y,w,h,fill,radius?}, ellipse {x,y,w,h,fill},
 * text {x,y,w,h,text,size,bold,italic,color,align,valign}, list {x,y,w,h,items,size,color,bullet,markerColor,gapPt,valign}
 */
export function buildSlides(deck, rawOptions) {
  const opts = normalizeOptions(rawOptions);
  const p = paletteFor(opts);
  const tpl = opts.template;
  const font = opts.font === 'auto' ? TEMPLATES[tpl].font : opts.font;
  const rtl = /[؀-ۿ]/.test(`${deck.title} ${deck.slides[0]?.bullets?.[0] || ''}`);
  const scale = SCALE[opts.textSize];
  const bulletStyle = tpl === 'classic' && opts.bulletStyle === 'dots' ? 'dashes' : opts.bulletStyle;
  const flip = (a) => (rtl && a === 'left' ? 'right' : a);

  const rect = (x, y, w, h, fill, radius, alpha) => ({ t: 'rect', x, y, w, h, fill, radius, alpha });
  const ellipse = (x, y, w, h, fill, alpha) => ({ t: 'ellipse', x, y, w, h, fill, alpha });
  // A picture (AI image). `fill` is the colour shown while it loads or if it cannot be made.
  const pic = (x, y, w, h, prompt, seed) => ({ t: 'image', x, y, w, h, prompt, seed: seed || 0, fill: p.accent });
  const veil = (color, alpha) => rect(0, 0, W, H, color, 0, alpha); // colour layer over a full-slide picture
  const text = (x, y, w, h, str, o = {}) => ({
    t: 'text', x, y, w, h, text: str, size: 18, color: p.text, valign: 'top', ...o, align: flip(o.align || 'left'),
  });
  const list = (x, y, w, h, items, o = {}) => {
    const n = items.length;
    const longest = Math.max(0, ...items.map((i) => i.length));
    const start = Math.round((n <= 4 && longest <= 100 ? 26 : n <= 5 ? 24 : 20) * scale);
    const gapPt = 12;
    const size = fitSize(items, w, h, start, { gapPt, indent: bulletStyle === 'none' ? 0 : 0.45 });
    return {
      t: 'list', x, y, w, h, items, size, gapPt, color: p.text, bullet: bulletStyle, markerColor: p.primary,
      valign: 'top', ...o, align: flip('left'),
    };
  };
  const split = (items) => [items.slice(0, Math.ceil(items.length / 2)), items.slice(Math.ceil(items.length / 2))];

  const footerText = deck.presenter ? `${deck.presenter}  ·  ${deck.title}` : deck.title;
  const chrome = (items, i, { x = 0.7, w = W - 3.2, color = p.muted, numColor = color } = {}) => {
    if (opts.showFooter) items.push(text(x, H - 0.55, w, 0.3, footerText, { size: 10, color, valign: 'middle' }));
    if (opts.showNumbers) items.push(text(W - 1.5, H - 0.55, 0.8, 0.3, String(i + 1), { size: 10, color: numColor, align: 'right', valign: 'middle' }));
  };

  const out = [];

  // ================= title slide =================
  {
    const items = [];
    let bg = p.dark;
    const tsz = titleSize(deck.title, 46);
    const cover = opts.images && deck.coverPrompt;
    if (cover && tpl === 'split') {
      bg = p.primary;
      items.push(pic(6.4, 0, W - 6.4, H, deck.coverPrompt, deck.coverSeed), rect(6.4, 0, 0.12, H, p.accent));
      items.push(text(0.7, 1.0, 5.1, 3.4, deck.title, { size: titleSize(deck.title, 38), bold: true, color: p.white, valign: 'bottom' }));
      items.push(rect(0.7, 4.65, 1.3, 0.07, p.accent));
      items.push(text(0.7, 4.95, 5.1, 1.4, deck.subtitle, { size: 20, color: 'E5E7EB' }));
      items.push(text(0.7, H - 1, 5.1, 0.4, deck.presenter, { size: 14, color: 'D1D5DB' }));
    } else if (cover) {
      const center = tpl === 'classic';
      const tint = tpl === 'bold' || tpl === 'cards' ? p.primary : p.dark;
      items.push(pic(0, 0, W, H, deck.coverPrompt, deck.coverSeed), veil(tint, tpl === 'bold' || tpl === 'cards' ? 0.78 : 0.72));
      if (tpl === 'bold') items.push(ellipse(W - 4.2, H - 3.6, 6, 6, p.accent, 0.35));
      items.push(center ? rect(W / 2 - 0.8, 4.45, 1.6, 0.07, p.accent) : rect(1, 4.4, 1.6, 0.08, p.accent));
      items.push(text(1, 1.5, W - 2, 2.7, deck.title, { size: titleSize(deck.title, 50), bold: true, color: p.white, valign: 'bottom', align: center ? 'center' : 'left' }));
      items.push(text(1, 4.7, W - 2, 1.2, deck.subtitle, { size: 22, color: 'E5E7EB', align: center ? 'center' : 'left' }));
      items.push(text(1, H - 1, W - 2, 0.4, deck.presenter, { size: 14, color: 'D1D5DB', align: center ? 'center' : 'left' }));
    } else if (tpl === 'modern') {
      items.push(rect(0, 0, 0.35, H, p.accent), rect(1, 4.35, 1.6, 0.08, p.accent));
      items.push(text(1, 1.5, W - 2, 2.7, deck.title, { size: tsz, bold: true, color: p.white, valign: 'bottom' }));
      items.push(text(1, 4.65, W - 2, 1.2, deck.subtitle, { size: 22, color: 'D1D5DB' }));
      items.push(text(1, H - 1, W - 2, 0.4, deck.presenter, { size: 14, color: '9CA3AF' }));
    } else if (tpl === 'minimal') {
      bg = p.white;
      items.push(rect(0.8, 1.9, 0.12, 3.4, p.primary), rect(1.4, 4.35, 1.2, 0.06, p.accent));
      items.push(text(1.4, 1.7, W - 2.8, 2.5, deck.title, { size: tsz, bold: true, color: p.dark, valign: 'bottom' }));
      items.push(text(1.4, 4.65, W - 2.8, 1.2, deck.subtitle, { size: 22, color: p.muted }));
      items.push(text(1.4, H - 1, W - 2.8, 0.4, deck.presenter, { size: 14, color: p.muted }));
    } else if (tpl === 'bold') {
      bg = p.primary;
      items.push(ellipse(W - 6, -2.2, 8, 8, p.dark), ellipse(W - 3.4, 4.3, 4.6, 4.6, p.accent), rect(0.9, 4.45, 1.6, 0.1, p.white));
      items.push(text(0.9, 1.4, 8.6, 2.9, deck.title, { size: titleSize(deck.title, 50), bold: true, color: p.white, valign: 'bottom' }));
      items.push(text(0.9, 4.8, 7.6, 1.2, deck.subtitle, { size: 22, color: p.white }));
      items.push(text(0.9, H - 1, 7, 0.4, deck.presenter, { size: 14, color: p.white }));
    } else if (tpl === 'classic') {
      bg = p.cream;
      items.push(rect(4.2, 2.1, W - 8.4, 0.03, p.primary), rect(5.7, 4.45, W - 11.4, 0.05, p.accent));
      items.push(text(1.5, 2.3, W - 3, 2.0, deck.title, { size: titleSize(deck.title, 42), bold: true, color: p.dark, align: 'center', valign: 'middle' }));
      items.push(text(1.5, 4.7, W - 3, 1.1, deck.subtitle, { size: 20, italic: true, color: p.muted, align: 'center' }));
      items.push(text(1.5, H - 1.1, W - 3, 0.4, deck.presenter, { size: 14, color: p.dark, align: 'center' }));
    } else if (tpl === 'split') {
      bg = p.light;
      items.push(rect(0, 0, 6.4, H, p.primary), rect(7.1, 2.6, 1.2, 0.07, p.accent));
      items.push(text(0.7, 1.2, 5, 5.1, deck.title, { size: titleSize(deck.title, 40), bold: true, color: p.white, valign: 'middle' }));
      items.push(text(7.1, 2.9, 5.5, 2.2, deck.subtitle, { size: 24, color: p.text }));
      items.push(text(7.1, H - 1.2, 5.5, 0.4, deck.presenter, { size: 14, color: p.muted }));
    } else {
      items.push(ellipse(W - 3.8, -1.6, 5.2, 5.2, p.primary), ellipse(W - 3.2, H - 2.2, 4.2, 4.2, p.primary), rect(1, 4.5, 1.6, 0.08, p.accent));
      items.push(text(1, 1.7, 9.4, 2.7, deck.title, { size: tsz, bold: true, color: p.white, valign: 'bottom' }));
      items.push(text(1, 4.85, 9, 1.2, deck.subtitle, { size: 20, color: 'C7CEDA' }));
      items.push(text(1, H - 1, 9, 0.4, deck.presenter, { size: 14, color: '9CA3AF' }));
    }
    out.push({ bg, items: items.filter((i) => i.t !== 'text' || i.text), notes: '' });
  }

  // ================= content slides =================
  deck.slides.forEach((s, idx) => {
    const i = idx + 1; // slide number minus 1
    const items = [];
    const notes = [s.speakerNotes, s.visualIdea && `Visual idea: ${s.visualIdea}`].filter(Boolean).join('\n\n');
    const bullets = s.bullets.filter(Boolean);
    const body = bullets.length ? bullets : [''];
    const img = opts.images && !s.noImage && s.imagePrompt ? s : null;
    const withPic = img && s.layout === 'bullets'; // a picture beside the text (normal slides)
    let bg;

    if (s.layout === 'section') {
      bg = tpl === 'classic' ? p.dark : tpl === 'minimal' ? p.dark : p.primary;
      if (img) items.push(pic(0, 0, W, H, s.imagePrompt, s.imageSeed), veil(bg, 0.8));
      const center = tpl === 'classic' ? 'center' : 'left';
      items.push(rect(center === 'center' ? W / 2 - 0.6 : 1, 3.7, 1.2, 0.07, tpl === 'bold' || tpl === 'cards' ? p.accent : p.white));
      items.push(text(1, 1.5, W - 2, 2.1, s.title, { size: titleSize(s.title, 42), bold: true, color: p.white, valign: 'bottom', align: center }));
      items.push(text(1, 3.95, W - 2, 1.6, bullets.slice(0, 2).join('\n'), { size: 22, color: 'E5E7EB', align: center }));
    } else if (s.layout === 'quote') {
      bg = tpl === 'classic' ? p.cream : tpl === 'bold' ? p.dark : p.light;
      const dark = isDark(bg);
      items.push(text(1.4, 0.25, 2, 1.6, '“', { size: 110, bold: true, color: p.accent, valign: 'top' }));
      items.push(text(1.6, 1.75, W - 3.2, 0.45, s.title, { size: 16, bold: true, color: dark ? p.accent : p.primary }));
      items.push(text(1.6, 2.35, W - 3.2, 2.95, body[0] || s.title, { size: fitSize([body[0] || s.title], W - 3.2, 2.95, 34, { min: 20, indent: 0 }), italic: true, color: dark ? p.white : p.dark, valign: 'middle' }));
      if (body[1]) items.push(text(1.6, 5.5, W - 3.2, 0.6, `— ${body[1]}`, { size: 18, color: dark ? 'D1D5DB' : p.muted }));
    } else if (s.layout === 'statement') {
      bg = tpl === 'minimal' || tpl === 'classic' ? p.primary : p.dark;
      if (img) items.push(pic(0, 0, W, H, s.imagePrompt, s.imageSeed), veil(bg, 0.82));
      items.push(rect(W / 2 - 0.6, 1.3, 1.2, 0.07, p.accent));
      items.push(text(1.2, 1.6, W - 2.4, 4.2, body[0] || s.title, { size: fitSize([body[0] || s.title], W - 2.4, 4, 44, { min: 22, indent: 0 }), bold: true, color: p.white, align: 'center', valign: 'middle' }));
      items.push(text(1.2, 6.0, W - 2.4, 0.5, body[0] ? s.title : '', { size: 16, color: p.accent, align: 'center', bold: true }));
    } else if (tpl === 'modern') {
      bg = p.light;
      items.push(rect(0, 0, W, 1.35, p.primary), rect(0, 1.35, W, 0.06, p.accent));
      items.push(text(0.7, 0.15, W - 1.4, 1.05, s.title, { size: titleSize(s.title, 32), bold: true, color: p.white, valign: 'middle' }));
      if (s.layout === 'two-column' && body.length > 1) {
        const [a, b] = split(body);
        items.push(list(0.7, 1.9, 5.8, 4.7, a), list(6.85, 1.9, 5.8, 4.7, b), rect(6.62, 2.0, 0.03, 4.4, p.accent));
      } else if (withPic) {
        items.push(rect(8.6, 2.05, 4.1, 4.6, p.accent), pic(8.3, 1.8, 4.1, 4.6, s.imagePrompt, s.imageSeed), list(0.7, 1.9, 7.3, 4.7, body));
      } else items.push(list(0.7, 1.9, W - 1.4, 4.7, body));
      chrome(items, i, { w: withPic ? 6.5 : W - 3.2 });
    } else if (tpl === 'minimal') {
      bg = p.white;
      if (withPic) items.push(pic(8.7, 0, W - 8.7, H, s.imagePrompt, s.imageSeed));
      items.push(rect(0, 0, 0.18, H, p.primary), rect(0.9, 1.75, 1.0, 0.06, p.accent));
      items.push(text(0.9, 0.5, withPic ? 7.4 : W - 1.8, 1.15, s.title, { size: titleSize(s.title, 34), bold: true, color: p.dark, valign: 'bottom' }));
      if (s.layout === 'two-column' && body.length > 1) {
        const [a, b] = split(body);
        items.push(list(0.9, 2.2, 5.6, 4.3, a), list(6.9, 2.2, 5.6, 4.3, b));
      } else items.push(list(0.9, 2.2, withPic ? 7.4 : W - 1.8, 4.3, body));
      chrome(items, i, { x: 0.9, w: withPic ? 5.5 : W - 3.2, ...(withPic ? { numColor: p.white } : {}) });
    } else if (tpl === 'bold') {
      bg = p.dark;
      if (withPic) items.push(pic(8.4, 0, W - 8.4, H, s.imagePrompt, s.imageSeed), rect(8.4, 0, W - 8.4, H, p.primary, 0, 0.25), rect(8.4, 0, 0.1, H, p.accent));
      items.push(rect(0.9, 1.75, 1.3, 0.08, p.accent));
      items.push(text(0.9, 0.45, withPic ? 6.3 : W - 3.6, 1.2, s.title, { size: titleSize(s.title, 34), bold: true, color: p.white, valign: 'bottom' }));
      items.push(text(withPic ? 6.3 : W - 2.6, 0.45, 1.8, 1.2, String(i).padStart(2, '0'), { size: 44, bold: true, color: p.accent, align: 'right', valign: 'bottom' }));
      const light = { color: 'E5E7EB', markerColor: p.accent };
      if (s.layout === 'two-column' && body.length > 1) {
        const [a, b] = split(body);
        items.push(list(0.9, 2.2, 5.6, 4.3, a, light), list(6.9, 2.2, 5.6, 4.3, b, light));
      } else items.push(list(0.9, 2.2, withPic ? 7.2 : W - 1.8, 4.3, body, light));
      chrome(items, i, { x: 0.9, w: withPic ? 5.5 : W - 3.2, color: '9CA3AF', ...(withPic ? { numColor: p.white } : {}) });
    } else if (tpl === 'classic') {
      bg = p.cream;
      items.push(text(0.9, 0.45, W - 1.8, 1.1, s.title, { size: titleSize(s.title, 34), bold: true, color: p.dark, align: 'center', valign: 'middle' }));
      items.push(rect(3.4, 1.65, W - 6.8, 0.025, p.primary), rect(3.4, 1.72, W - 6.8, 0.015, p.accent));
      if (s.layout === 'two-column' && body.length > 1) {
        const [a, b] = split(body);
        items.push(list(1.1, 2.2, 5.3, 4.3, a), list(6.9, 2.2, 5.3, 4.3, b));
      } else if (withPic) {
        items.push(rect(8.2, 2.1, 4.5, 4.4, p.primary), pic(8.3, 2.2, 4.3, 4.2, s.imagePrompt, s.imageSeed), list(1.1, 2.2, 6.7, 4.3, body));
      } else items.push(list(1.4, 2.2, W - 2.8, 4.3, body));
      chrome(items, i, { x: 1.1 });
    } else if (tpl === 'split') {
      bg = p.light;
      if (withPic) items.push(pic(0, 0, 4.4, H, s.imagePrompt, s.imageSeed), rect(0, 0, 4.4, H, p.primary, 0, 0.68));
      else items.push(rect(0, 0, 4.4, H, p.primary));
      items.push(text(0.5, 0.9, 3.4, 4.6, s.title, { size: titleSize(s.title, 32) - 4, bold: true, color: p.white, valign: 'top' }));
      items.push(text(0.5, H - 1.8, 3.4, 1.2, String(i).padStart(2, '0'), { size: 60, bold: true, color: p.accent, valign: 'bottom' }));
      if (s.layout === 'two-column' && body.length > 1) {
        const [a, b] = split(body);
        items.push(list(5.0, 1.2, 3.8, 5.0, a), list(9.1, 1.2, 3.8, 5.0, b));
      } else items.push(list(5.0, 1.2, W - 5.8, 5.0, body, { valign: 'middle' }));
      chrome(items, i, { x: 5.0, w: W - 7 });
    } else {
      // cards: every point sits in its own white card
      bg = p.light;
      items.push(text(0.8, 0.4, W - 1.6, 1.0, s.title, { size: titleSize(s.title, 34), bold: true, color: p.dark, valign: 'middle' }));
      items.push(rect(0.8, 1.45, 1.2, 0.07, p.accent));
      const n = body.length;
      const cols = withPic ? 1 : s.layout === 'two-column' || n > 4 ? 2 : 1;
      const rows = Math.ceil(n / cols);
      const gap = 0.22;
      if (withPic) items.push(rect(W - 4.55, 1.95, 3.75, 4.55, p.accent, 0.12), pic(W - 4.7, 1.8, 3.75, 4.55, s.imagePrompt, s.imageSeed));
      const cw = ((withPic ? W - 5.85 : W - 1.6) - gap * (cols - 1)) / cols;
      const ch = Math.min(1.25, (4.55 - gap * (rows - 1)) / rows);
      body.forEach((b, k) => {
        const col = cols === 1 ? 0 : k % 2;
        const row = cols === 1 ? k : Math.floor(k / 2);
        const x = 0.8 + col * (cw + gap);
        const y = 1.85 + row * (ch + gap);
        items.push(rect(x, y, cw, ch, p.white, 0.12), rect(x, y + 0.14, 0.09, ch - 0.28, p.accent));
        items.push(ellipse(x + 0.3, y + ch / 2 - 0.26, 0.52, 0.52, p.primary));
        items.push(text(x + 0.3, y + ch / 2 - 0.26, 0.52, 0.52, String(k + 1), { size: 16, bold: true, color: p.white, align: 'center', valign: 'middle' }));
        items.push(text(x + 1.05, y + 0.08, cw - 1.25, ch - 0.16, b, { size: fitSize([b], cw - 1.25, ch - 0.16, Math.round(20 * scale), { min: 12, gapPt: 0, indent: 0 }), color: p.text, valign: 'middle' }));
      });
      chrome(items, i, { x: 0.8 });
    }

    out.push({ bg, items: items.filter((it) => it.t !== 'text' || it.text), notes });
  });

  return out.map((s) => ({ ...s, rtl, font }));
}
