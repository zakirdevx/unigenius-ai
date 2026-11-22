// Builds a real .pptx file (opens in PowerPoint, Google Slides and LibreOffice).
// The look comes from client/src/utils/slideDesign.js, the same engine the preview in the app uses.
import PptxGenJS from 'pptxgenjs';
import { H, W, buildSlides, imageUrl } from '../../client/src/utils/slideDesign.js';

const BULLETS = {
  dots: (color) => ({ code: '25CF', color }),
  dashes: (color) => ({ code: '2013', color }),
  numbers: () => ({ type: 'number' }),
};

const IMAGE_TIME_BUDGET_MS = 38000; // stop waiting for pictures after this long (the host limits one request to about a minute)
const IMAGE_TRIES = 2;
const IMAGE_MAX_BYTES = 4 * 1024 * 1024;

/** Downloads one picture and returns it as "image/jpeg;base64,..." for pptxgenjs, or null if it could not be made. */
async function fetchPicture(url, deadline) {
  for (let attempt = 0; attempt < IMAGE_TRIES; attempt++) {
    const left = deadline - Date.now();
    if (left < 3000) return null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), Math.min(left, 22000));
    try {
      const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'image/*' } });
      const type = (res.headers.get('content-type') || '').split(';')[0].trim();
      if (res.ok && /^image\/(jpeg|png)$/.test(type)) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > 1000 && buf.length <= IMAGE_MAX_BYTES) return `${type};base64,${buf.toString('base64')}`;
      }
    } catch {
      /* timeout or network problem: try again, then give up (the slide keeps its coloured panel) */
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

/** Fetches every picture of the deck (a few at a time) and returns a Map: address -> image data. */
async function loadPictures(slides) {
  const urls = new Map(); // address -> true
  for (const spec of slides) for (const it of spec.items) if (it.t === 'image') urls.set(imageUrl(it.prompt, it.seed), true);
  const list = [...urls.keys()];
  const result = new Map();
  const deadline = Date.now() + IMAGE_TIME_BUDGET_MS;
  let next = 0;
  const worker = async () => {
    while (next < list.length) {
      const url = list[next++];
      const data = await fetchPicture(url, deadline);
      if (data) result.set(url, data);
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, list.length) }, worker));
  return result;
}

const fillOf = (color, alpha) => ({ color, ...(alpha == null || alpha >= 1 ? {} : { transparency: Math.round((1 - alpha) * 100) }) });

export async function buildPptx(deck, options = {}) {
  const slides = buildSlides(deck, options);
  const pictures = await loadPictures(slides);
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5 inches (16:9)
  pptx.title = deck.title;
  pptx.author = deck.presenter || 'UniGenius AI';

  for (const spec of slides) {
    const slide = pptx.addSlide();
    slide.background = { color: spec.bg };
    if (spec.notes) slide.addNotes(spec.notes);

    for (const it of spec.items) {
      if (it.t === 'rect') {
        const shape = it.radius ? pptx.ShapeType.roundRect : pptx.ShapeType.rect;
        slide.addShape(shape, { x: it.x, y: it.y, w: it.w, h: it.h, fill: fillOf(it.fill, it.alpha), line: { color: it.fill, width: 0, transparency: 100 }, ...(it.radius ? { rectRadius: it.radius } : {}) });
      } else if (it.t === 'ellipse') {
        slide.addShape(pptx.ShapeType.ellipse, { x: it.x, y: it.y, w: it.w, h: it.h, fill: fillOf(it.fill, it.alpha), line: { color: it.fill, width: 0, transparency: 100 } });
      } else if (it.t === 'image') {
        const data = pictures.get(imageUrl(it.prompt, it.seed));
        // The colour panel first (it stays visible if the picture could not be made), then the picture on top.
        slide.addShape(pptx.ShapeType.rect, { x: it.x, y: it.y, w: it.w, h: it.h, fill: { color: it.fill }, line: { color: it.fill, width: 0, transparency: 100 } });
        if (data) slide.addImage({ data, x: it.x, y: it.y, w: it.w, h: it.h, sizing: { type: 'cover', w: it.w, h: it.h } });
      } else if (it.t === 'text') {
        slide.addText(it.text, {
          x: it.x, y: it.y, w: it.w, h: it.h, fontFace: spec.font, fontSize: it.size, bold: Boolean(it.bold), italic: Boolean(it.italic),
          color: it.color, align: it.align, valign: it.valign, margin: 0, rtlMode: spec.rtl, fit: 'shrink',
        });
      } else if (it.t === 'list') {
        const bullet = it.bullet === 'none' ? false : { ...BULLETS[it.bullet](it.markerColor), indent: 26 };
        const runs = it.items.map((text) => ({ text, options: { breakLine: true, bullet, paraSpaceAfter: it.gapPt } }));
        slide.addText(runs, {
          x: it.x, y: it.y, w: it.w, h: it.h, fontFace: spec.font, fontSize: it.size, color: it.color,
          align: it.align, valign: it.valign, margin: 0, rtlMode: spec.rtl, fit: 'shrink',
        });
      }
    }
  }
  return pptx.write({ outputType: 'nodebuffer' });
}

export { H, W };
