// Presentation Maker: AI writes the outline, slide text, speaker notes and design ideas.
// The student edits everything, chooses a design, colours and fonts, and downloads a real .pptx file.
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown, ArrowUp, Copy, Download, Lightbulb, Plus, Presentation, RefreshCw, RotateCcw, Shuffle, Sparkles, Trash2, Wand2,
} from 'lucide-react';
import ErrorBanner from '../components/ErrorBanner.jsx';
import Segmented from '../components/Segmented.jsx';
import SlideView from '../components/SlideView.jsx';
import { useSpeed } from '../context/SpeedContext.jsx';
import { errorMessage, postBlob, postJson } from '../services/api.js';
import {
  BULLET_STYLES, DEFAULT_OPTIONS, FONTS, TEMPLATES, TEMPLATE_IDS, THEMES, THEME_IDS, buildSlides, normalizeOptions, paletteFor,
} from '../utils/slideDesign.js';
import { loadString, saveString } from '../utils/storage.js';

const COUNTS = [5, 8, 10, 12, 15];
const STYLES = ['Academic', 'Professional', 'Creative', 'Minimal'];
const LANGS = ['English', 'Urdu'];
const LAYOUTS = [
  { value: 'bullets', label: 'Bullet points' },
  { value: 'two-column', label: 'Two columns' },
  { value: 'section', label: 'Section divider' },
  { value: 'quote', label: 'Quote' },
  { value: 'statement', label: 'Big statement' },
];
const REWRITES = [
  { id: 'shorter', label: 'Shorter' },
  { id: 'simpler', label: 'Simpler words' },
  { id: 'detailed', label: 'More detail' },
  { id: 'example', label: 'Add an example' },
  { id: 'urdu', label: 'اردو' },
  { id: 'english', label: 'English' },
];
const DESIGN_TABS = [
  { value: 'edit', label: 'Edit slide' },
  { value: 'design', label: 'Design' },
  { value: 'notes', label: 'Notes & tips' },
];

const uid = () => Math.random().toString(36).slice(2, 9);
const inputCls = 'w-full rounded-lg border border-line bg-panel2 px-3 py-2 text-sm outline-none transition placeholder:text-mute focus:border-brand';
const labelCls = 'mb-1 block text-xs font-medium text-mute';
const stripIds = (deck) => ({ ...deck, slides: deck.slides.map(({ id, ...rest }) => rest) });

function Switch({ checked, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2 text-sm">
      {label}
      <span className={`relative h-5 w-9 shrink-0 rounded-full transition ${checked ? 'bg-brand' : 'bg-line'}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${checked ? 'left-[1.15rem]' : 'left-0.5'}`} />
      </span>
    </button>
  );
}

export default function SlidesPage() {
  const { speed } = useSpeed();
  const [topic, setTopic] = useState('');
  const [details, setDetails] = useState('');
  const [audience, setAudience] = useState('');
  const [count, setCount] = useState(8);
  const [style, setStyle] = useState('Academic');
  const [language, setLanguage] = useState('English');

  const [phase, setPhase] = useState('form'); // form | loading | deck
  const [deck, setDeck] = useState(null);
  const [opts, setOpts] = useState(DEFAULT_OPTIONS);
  const [sel, setSel] = useState('title'); // 'title' or a slide id
  const [tab, setTab] = useState('edit');
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [rewriting, setRewriting] = useState('');
  const abortRef = useRef(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  const setOpt = (patch) => setOpts((o) => normalizeOptions({ ...o, ...patch }));

  const generate = async (e) => {
    e?.preventDefault();
    if (topic.trim().length < 3) {
      setError('Please type the topic of your presentation first.');
      return;
    }
    setError('');
    setPhase('loading');
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const data = await postJson('/api/slides', { topic: topic.trim(), details, audience, count, style, language, speed }, { signal: controller.signal });
      const d = { ...data.deck, presenter: loadString('presenter', ''), slides: data.deck.slides.map((s) => ({ ...s, id: uid() })) };
      setDeck(d);
      setOpts(normalizeOptions({ ...DEFAULT_OPTIONS, template: d.designSuggestion || 'modern', theme: d.themeSuggestion }));
      setSel('title');
      setTab('edit');
      setPhase('deck');
    } catch (err) {
      if (err?.name === 'AbortError') return;
      setError(errorMessage(err));
      setPhase('form');
    }
  };

  const patchDeck = (patch) => setDeck((d) => ({ ...d, ...patch }));
  const patchSlide = (id, patch) => setDeck((d) => ({ ...d, slides: d.slides.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
  const move = (id, dir) =>
    setDeck((d) => {
      const i = d.slides.findIndex((s) => s.id === id);
      const j = i + dir;
      if (j < 0 || j >= d.slides.length) return d;
      const slides = [...d.slides];
      [slides[i], slides[j]] = [slides[j], slides[i]];
      return { ...d, slides };
    });
  const remove = (id) => {
    setDeck((d) => ({ ...d, slides: d.slides.filter((s) => s.id !== id) }));
    setSel('title');
  };
  const duplicate = (id) => {
    const copy = { ...deck.slides.find((s) => s.id === id), id: uid() };
    copy.title = `${copy.title} (copy)`.slice(0, 120);
    setDeck((d) => {
      const i = d.slides.findIndex((s) => s.id === id);
      const slides = [...d.slides];
      slides.splice(i + 1, 0, copy);
      return { ...d, slides };
    });
    setSel(copy.id);
  };
  const addSlide = () => {
    const slide = { id: uid(), title: 'New slide', layout: 'bullets', bullets: ['First point'], speakerNotes: '', visualIdea: '' };
    patchDeck({ slides: [...deck.slides, slide] });
    setSel(slide.id);
    setTab('edit');
  };

  const rewrite = async (action) => {
    const current = deck.slides.find((s) => s.id === sel);
    if (!current) return;
    setError('');
    setRewriting(action);
    try {
      const { id, ...slide } = current;
      const data = await postJson('/api/slides/rewrite', { slide, action, topic: deck.title, speed });
      patchSlide(current.id, data.slide);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setRewriting('');
    }
  };

  const download = async () => {
    setError('');
    setDownloading(true);
    try {
      const blob = await postBlob('/api/slides/pptx', { deck: stripIds(deck), options: opts });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(deck.title || 'presentation').replace(/[^\w؀-ۿ -]+/g, '').trim().slice(0, 60) || 'presentation'}.pptx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setDownloading(false);
    }
  };

  const surprise = () => {
    const pickOne = (list, not) => {
      const options = list.filter((x) => x !== not);
      return options[Math.floor(Math.random() * options.length)];
    };
    setOpt({ template: pickOne(TEMPLATE_IDS, opts.template), theme: pickOne(THEME_IDS, opts.theme), primary: '', accent: '' });
  };

  // All slides drawn with the current design (title slide first).
  const specs = useMemo(() => (deck ? buildSlides(deck, opts) : []), [deck, opts]);
  const demoIndex = useMemo(() => {
    if (!deck) return 0;
    const i = deck.slides.findIndex((s) => s.layout === 'bullets' || s.layout === 'two-column');
    return i < 0 ? 0 : i + 1;
  }, [deck]);
  const templateThumbs = useMemo(
    () => (deck && tab === 'design' ? TEMPLATE_IDS.map((t) => [t, buildSlides(deck, { ...opts, template: t })[demoIndex]]) : []),
    [deck, opts, tab, demoIndex],
  );

  // ------------------------------------------------------------------ form / loading
  if (phase !== 'deck') {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="gradient-brand flex h-11 w-11 items-center justify-center rounded-xl text-white"><Presentation size={22} /></span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Presentation Maker</h1>
            <p className="text-sm text-mute">AI writes your slides, notes and design ideas. Edit everything, change the design, then download PowerPoint.</p>
          </div>
        </div>

        {phase === 'loading' ? (
          <div className="rounded-2xl border border-line bg-panel p-6" role="status">
            <div className="space-y-3">
              <div className="skeleton h-6 w-1/2" />
              <div className="skeleton h-40 w-full" />
              <div className="skeleton h-5 w-2/3" />
            </div>
            <p className="mt-4 text-center text-sm text-mute">Designing your slides… this can take 10 to 30 seconds.</p>
            <div className="mt-3 text-center">
              <button type="button" onClick={() => { abortRef.current?.abort(); setPhase('form'); }} className="text-sm text-mute underline underline-offset-4 hover:text-ink">Cancel</button>
            </div>
          </div>
        ) : (
          <form onSubmit={generate} className="space-y-5 rounded-2xl border border-line bg-panel p-6">
            <ErrorBanner message={error} onDismiss={() => setError('')} />
            <div>
              <label htmlFor="topic" className="mb-2 block text-sm font-medium">Presentation topic</label>
              <input id="topic" dir="auto" value={topic} maxLength={300} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. How neural networks learn" className={inputCls} />
            </div>
            <div>
              <label htmlFor="details" className="mb-2 block text-sm font-medium">Notes or points to include <span className="font-normal text-mute">(optional)</span></label>
              <textarea id="details" dir="auto" rows={3} value={details} maxLength={3000} onChange={(e) => setDetails(e.target.value)} placeholder="Paste your own notes or list what the teacher asked for. The AI will build the slides from them." className={`${inputCls} resize-none`} />
            </div>
            <div>
              <label htmlFor="aud" className="mb-2 block text-sm font-medium">Audience <span className="font-normal text-mute">(optional)</span></label>
              <input id="aud" dir="auto" value={audience} maxLength={100} onChange={(e) => setAudience(e.target.value)} placeholder="e.g. first-semester students and our teacher" className={inputCls} />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div><p className="mb-2 text-sm font-medium">Number of slides</p><Segmented label="Number of slides" options={COUNTS} value={count} onChange={setCount} /></div>
              <div><p className="mb-2 text-sm font-medium">Language</p><Segmented label="Language" options={LANGS} value={language} onChange={setLanguage} /></div>
            </div>
            <div><p className="mb-2 text-sm font-medium">Style</p><Segmented label="Style" options={STYLES} value={style} onChange={setStyle} /></div>
            <button type="submit" className="gradient-brand glow flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold text-white transition hover:brightness-110">
              <Sparkles size={18} /> Create presentation
            </button>
          </form>
        )}
      </div>
    );
  }

  // ------------------------------------------------------------------ deck editor
  const current = deck.slides.find((s) => s.id === sel) || null;
  const index = current ? deck.slides.indexOf(current) : -1;
  const palette = paletteFor(opts);
  const customColours = Boolean(opts.primary || opts.accent);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-12 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight">Your presentation</h1>
          <p className="text-sm text-mute">{deck.slides.length + 1} slides · design: {TEMPLATES[opts.template].name}. Click a slide to edit it.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => { setPhase('form'); setDeck(null); }} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm text-mute hover:text-ink">
            <RotateCcw size={15} /> New presentation
          </button>
          <button type="button" onClick={download} disabled={downloading} className="gradient-brand glow inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition enabled:hover:brightness-110 disabled:opacity-60">
            {downloading ? <RefreshCw size={16} className="animate-spin" /> : <Download size={16} />} Download PowerPoint (.pptx)
          </button>
        </div>
      </div>
      <ErrorBanner className="mt-4" message={error} onDismiss={() => setError('')} />

      <div className="mt-5 grid gap-5 lg:grid-cols-[14.5rem_1fr]">
        {/* outline with live thumbnails */}
        <aside className="rounded-2xl border border-line bg-panel p-3 lg:max-h-[calc(100dvh-9rem)] lg:overflow-y-auto">
          <ol className="space-y-2.5">
            {specs.map((spec, k) => {
              const id = k === 0 ? 'title' : deck.slides[k - 1].id;
              const active = sel === id;
              return (
                <li key={id}>
                  <button type="button" onClick={() => setSel(id)} aria-current={active ? 'true' : undefined} className="flex w-full items-start gap-2 text-left">
                    <span className={`mt-1 w-4 shrink-0 text-center text-xs ${active ? 'font-bold text-brand' : 'text-mute'}`}>{k + 1}</span>
                    <SlideView spec={spec} className={`min-w-0 flex-1 rounded-md ring-2 transition ${active ? 'ring-brand' : 'ring-line hover:ring-brand/50'}`} />
                  </button>
                </li>
              );
            })}
          </ol>
          <button type="button" onClick={addSlide} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-line py-2 text-sm text-mute hover:border-brand hover:text-brand">
            <Plus size={14} /> Add slide
          </button>
        </aside>

        <section className="min-w-0 space-y-4">
          <SlideView spec={specs[current ? index + 1 : 0]} className="rounded-xl shadow-lg ring-1 ring-line" />

          <div className="overflow-x-auto"><Segmented label="Editor tabs" options={DESIGN_TABS} value={tab} onChange={setTab} /></div>

          <div className="rounded-2xl border border-line bg-panel p-4">
            {/* ---------- edit ---------- */}
            {tab === 'edit' && !current && (
              <div className="grid gap-3">
                <label className="block"><span className={labelCls}>Presentation title</span><input dir="auto" value={deck.title} maxLength={150} onChange={(e) => patchDeck({ title: e.target.value })} className={inputCls} /></label>
                <label className="block"><span className={labelCls}>Subtitle</span><input dir="auto" value={deck.subtitle} maxLength={200} onChange={(e) => patchDeck({ subtitle: e.target.value })} className={inputCls} /></label>
                <label className="block"><span className={labelCls}>Your name and course (shown on the title slide and in the footer)</span>
                  <input dir="auto" value={deck.presenter} maxLength={100} onChange={(e) => { patchDeck({ presenter: e.target.value }); saveString('presenter', e.target.value); }} placeholder="e.g. Ali Khan · Generative AI" className={inputCls} />
                </label>
              </div>
            )}
            {tab === 'edit' && current && (
              <div className="grid gap-3">
                <div className="flex flex-wrap items-end gap-3">
                  <label className="block min-w-0 flex-1"><span className={labelCls}>Slide title</span><input dir="auto" value={current.title} maxLength={120} onChange={(e) => patchSlide(current.id, { title: e.target.value })} className={inputCls} /></label>
                  <label className="block"><span className={labelCls}>Layout</span>
                    <select value={current.layout} onChange={(e) => patchSlide(current.id, { layout: e.target.value })} className={inputCls}>
                      {LAYOUTS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                    </select>
                  </label>
                  <div className="flex gap-1 pb-0.5">
                    <button type="button" onClick={() => move(current.id, -1)} disabled={index === 0} aria-label="Move slide up" title="Move up" className="rounded-lg border border-line p-2 text-mute enabled:hover:text-ink disabled:opacity-30"><ArrowUp size={15} /></button>
                    <button type="button" onClick={() => move(current.id, 1)} disabled={index === deck.slides.length - 1} aria-label="Move slide down" title="Move down" className="rounded-lg border border-line p-2 text-mute enabled:hover:text-ink disabled:opacity-30"><ArrowDown size={15} /></button>
                    <button type="button" onClick={() => duplicate(current.id)} aria-label="Duplicate slide" title="Duplicate" className="rounded-lg border border-line p-2 text-mute hover:text-ink"><Copy size={15} /></button>
                    <button type="button" onClick={() => remove(current.id)} aria-label="Delete slide" title="Delete" className="rounded-lg border border-line p-2 text-bad hover:bg-bad/10"><Trash2 size={15} /></button>
                  </div>
                </div>
                <label className="block"><span className={labelCls}>Slide text (one point per line). Quote slide: line 1 = quote, line 2 = who said it.</span>
                  <textarea dir="auto" rows={5} value={current.bullets.join('\n')} onChange={(e) => patchSlide(current.id, { bullets: e.target.value.split('\n').slice(0, 10) })} className={`${inputCls} resize-y`} />
                </label>
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-mute"><Wand2 size={14} className="text-brand" /> Improve this slide with AI</p>
                  <div className="flex flex-wrap gap-2">
                    {REWRITES.map((r) => (
                      <button key={r.id} type="button" onClick={() => rewrite(r.id)} disabled={Boolean(rewriting)} className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm text-mute transition enabled:hover:border-brand enabled:hover:text-brand disabled:opacity-50">
                        {rewriting === r.id && <RefreshCw size={13} className="animate-spin" />}{r.label}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="block"><span className={labelCls}>Speaker notes (what you say; saved in the PowerPoint notes)</span>
                  <textarea dir="auto" rows={3} value={current.speakerNotes} onChange={(e) => patchSlide(current.id, { speakerNotes: e.target.value })} className={`${inputCls} resize-y`} />
                </label>
                <label className="block"><span className={labelCls}>Visual idea (picture, chart or diagram to add yourself)</span>
                  <input dir="auto" value={current.visualIdea} maxLength={300} onChange={(e) => patchSlide(current.id, { visualIdea: e.target.value })} className={inputCls} />
                </label>
              </div>
            )}

            {/* ---------- design ---------- */}
            {tab === 'design' && (
              <div className="space-y-6">
                <div>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">Design</p>
                    <button type="button" onClick={surprise} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm text-mute hover:border-brand hover:text-brand"><Shuffle size={14} /> Surprise me</button>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {templateThumbs.map(([id, spec]) => (
                      <button key={id} type="button" onClick={() => setOpt({ template: id })} aria-pressed={opts.template === id} className="text-left">
                        <SlideView spec={spec} className={`rounded-lg ring-2 transition ${opts.template === id ? 'ring-brand' : 'ring-line hover:ring-brand/50'}`} />
                        <span className={`mt-1.5 block text-sm font-medium ${opts.template === id ? 'text-brand' : ''}`}>{TEMPLATES[id].name}</span>
                        <span className="block text-xs text-mute">{TEMPLATES[id].text}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-3 text-sm font-semibold">Colours</p>
                  <div className="flex flex-wrap gap-2">
                    {THEME_IDS.map((id) => (
                      <button key={id} type="button" onClick={() => setOpt({ theme: id, primary: '', accent: '' })} aria-pressed={opts.theme === id && !customColours} className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${opts.theme === id && !customColours ? 'border-brand bg-brand/15 text-brand' : 'border-line text-mute hover:text-ink'}`}>
                        <span className="h-4 w-4 rounded-full" style={{ background: `linear-gradient(135deg, #${THEMES[id].primary} 50%, #${THEMES[id].accent} 50%)` }} />
                        {THEMES[id].name}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-2 text-sm text-mute">Main colour
                      <input type="color" value={`#${palette.primary}`} onChange={(e) => setOpt({ primary: e.target.value })} className="h-9 w-12 cursor-pointer rounded border border-line bg-transparent p-0.5" />
                    </label>
                    <label className="flex items-center gap-2 text-sm text-mute">Accent colour
                      <input type="color" value={`#${palette.accent}`} onChange={(e) => setOpt({ accent: e.target.value })} className="h-9 w-12 cursor-pointer rounded border border-line bg-transparent p-0.5" />
                    </label>
                    {customColours && <button type="button" onClick={() => setOpt({ primary: '', accent: '' })} className="text-sm text-mute underline underline-offset-4 hover:text-ink">Back to theme colours</button>}
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="block"><span className={labelCls}>Font</span>
                    <select value={opts.font} onChange={(e) => setOpt({ font: e.target.value })} className={inputCls}>
                      <option value="auto">Automatic (best for this design)</option>
                      {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </label>
                  <div><span className={labelCls}>Text size</span><Segmented label="Text size" options={[{ value: 'small', label: 'Small' }, { value: 'medium', label: 'Medium' }, { value: 'large', label: 'Large' }]} value={opts.textSize} onChange={(v) => setOpt({ textSize: v })} /></div>
                  <div className="sm:col-span-2"><span className={labelCls}>Bullet style</span>
                    <Segmented label="Bullet style" options={BULLET_STYLES.map((b) => ({ value: b, label: { dots: '● Dots', dashes: '– Dashes', numbers: '1. Numbers', none: 'None' }[b] }))} value={opts.bulletStyle} onChange={(v) => setOpt({ bulletStyle: v })} />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Switch checked={opts.showNumbers} onChange={(v) => setOpt({ showNumbers: v })} label="Slide numbers" />
                  <Switch checked={opts.showFooter} onChange={(v) => setOpt({ showFooter: v })} label="Footer (your name and title)" />
                </div>
              </div>
            )}

            {/* ---------- notes & tips ---------- */}
            {tab === 'notes' && (
              <div className="space-y-5">
                <div>
                  <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><Lightbulb size={16} className="text-brand" /> Design suggestions from the AI</p>
                  {deck.designTips.length === 0 ? <p className="text-sm text-mute">No tips this time.</p> : (
                    <ul className="list-disc space-y-1.5 ps-5 text-sm">{deck.designTips.map((tip, i) => <li key={i} dir="auto">{tip}</li>)}</ul>
                  )}
                  {deck.designSuggestion && <p className="mt-3 text-xs text-mute">Suggested for this topic: {TEMPLATES[deck.designSuggestion]?.name} design, {THEMES[deck.themeSuggestion]?.name} colours.</p>}
                </div>
                <div>
                  <p className="mb-3 text-sm font-semibold">Speaker notes for the whole talk</p>
                  <ol className="space-y-3 text-sm">
                    {deck.slides.filter((s) => s.speakerNotes).map((s) => (
                      <li key={s.id}><button type="button" onClick={() => { setSel(s.id); setTab('edit'); }} className="font-medium text-brand hover:underline" dir="auto">{s.title}</button><p dir="auto" className="mt-0.5 text-mute">{s.speakerNotes}</p></li>
                    ))}
                  </ol>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
