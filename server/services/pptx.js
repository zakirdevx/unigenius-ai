// Builds a real .pptx file (opens in PowerPoint, Google Slides and LibreOffice).
// The look comes from client/src/utils/slideDesign.js, the same engine the preview in the app uses.
import PptxGenJS from 'pptxgenjs';
import { H, W, buildSlides } from '../../client/src/utils/slideDesign.js';

const BULLETS = {
  dots: (color) => ({ code: '25CF', color }),
  dashes: (color) => ({ code: '2013', color }),
  numbers: () => ({ type: 'number' }),
};

export async function buildPptx(deck, options = {}) {
  const slides = buildSlides(deck, options);
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
        slide.addShape(shape, { x: it.x, y: it.y, w: it.w, h: it.h, fill: { color: it.fill }, line: { color: it.fill, width: 0 }, ...(it.radius ? { rectRadius: it.radius } : {}) });
      } else if (it.t === 'ellipse') {
        slide.addShape(pptx.ShapeType.ellipse, { x: it.x, y: it.y, w: it.w, h: it.h, fill: { color: it.fill }, line: { color: it.fill, width: 0 } });
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
