// GPA Calculator: semester GPA, overall CGPA, target CGPA planner, course grade calculator
// and academic progress. Everything is calculated in the browser and saved on this device only.
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, GraduationCap, Plus, RotateCcw, Target, Trash2, TrendingUp, Award } from 'lucide-react';
import Segmented from '../components/Segmented.jsx';
import {
  SCALES, academicProgress, fmt, gradeCalculator, gradeFor, gradeForPoints, num, overallCgpa, requiredGpa, semesterGpa,
  standing, subjectResult,
} from '../utils/gpa.js';
import { loadJson, saveJson } from '../utils/storage.js';

const uid = () => Math.random().toString(36).slice(2, 9);
const blankSubject = () => ({ id: uid(), name: '', credits: '3', obtained: '', total: '100', expected: '' });
const newSemester = (n) => ({ id: uid(), name: `Semester ${n}`, subjects: [blankSubject(), blankSubject(), blankSubject()] });

const defaults = () => {
  const first = newSemester(1);
  return {
    scale: 'standard',
    prior: { cgpa: '', credits: '' },
    semesters: [first],
    active: first.id,
    target: { cgpa: '3.5', remaining: '30' },
    grade: {
      target: '85',
      items: [
        { id: uid(), name: 'Quizzes', weight: '10', score: '' },
        { id: uid(), name: 'Assignments', weight: '10', score: '' },
        { id: uid(), name: 'Midterm', weight: '30', score: '' },
        { id: uid(), name: 'Final exam', weight: '50', score: '' },
      ],
    },
    program: { totalCredits: '130', perSemester: '18' },
  };
};

/** Saved data can be old or damaged, so fill any gaps with defaults. */
function loadState() {
  const saved = loadJson('gpa', null);
  const base = defaults();
  if (!saved || !Array.isArray(saved.semesters) || saved.semesters.length === 0) return base;
  const state = { ...base, ...saved };
  state.semesters = saved.semesters.map((sem) => ({
    id: sem.id || uid(),
    name: String(sem.name || 'Semester'),
    subjects: Array.isArray(sem.subjects) ? sem.subjects.map((s) => ({ ...blankSubject(), ...s, id: s.id || uid() })) : [],
  }));
  if (!state.semesters.some((s) => s.id === state.active)) state.active = state.semesters[0].id;
  state.grade = { ...base.grade, ...saved.grade, items: Array.isArray(saved.grade?.items) ? saved.grade.items : base.grade.items };
  return state;
}

const TONES = { good: 'text-good', bad: 'text-bad', brand: 'text-brand', mute: 'text-mute' };

function Stat({ icon: Icon, label, value, sub, tone = 'brand' }) {
  return (
    <div className="rounded-2xl border border-line bg-panel p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-mute">
        <Icon size={14} /> {label}
      </div>
      <p className={`mt-2 text-3xl font-bold tracking-tight ${TONES[tone] || ''}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-mute">{sub}</p>}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, suffix, className = '', text = false }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium text-mute">{label}</span>
      <span className="flex items-center rounded-lg border border-line bg-panel2 px-3 focus-within:border-brand">
        <input
          value={value}
          inputMode={text ? 'text' : 'decimal'}
          onChange={(e) => onChange(text ? e.target.value.slice(0, 60) : e.target.value.replace(/[^\d.]/g, '').slice(0, 7))}
          placeholder={placeholder}
          dir={text ? 'auto' : undefined}
          className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-mute/70"
        />
        {suffix && <span className="ps-2 text-xs text-mute">{suffix}</span>}
      </span>
    </label>
  );
}

const cell = 'w-full rounded-md border border-transparent bg-panel2 px-2 py-1.5 text-sm outline-none focus:border-brand';

function Note({ tone = 'mute', icon: Icon = AlertTriangle, children }) {
  const colors = { good: 'border-good/30 bg-good/10', bad: 'border-bad/30 bg-bad/10', mute: 'border-line bg-panel2', brand: 'border-brand/30 bg-brand/10' };
  return (
    <div className={`mt-4 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm ${colors[tone]}`}>
      <Icon size={16} className={`mt-0.5 shrink-0 ${TONES[tone]}`} />
      <div>{children}</div>
    </div>
  );
}

// ---------------- Semesters tab ----------------
function SemestersTab({ state, update }) {
  const sem = state.semesters.find((s) => s.id === state.active) || state.semesters[0];
  const setSem = (patch) => update((st) => ({ ...st, semesters: st.semesters.map((x) => (x.id === sem.id ? { ...x, ...patch } : x)) }));
  const setSubject = (id, patch) => setSem({ subjects: sem.subjects.map((s) => (s.id === id ? { ...s, ...patch } : s)) });

  const addSemester = () =>
    update((st) => {
      const n = newSemester(st.semesters.length + 1);
      return { ...st, semesters: [...st.semesters, n], active: n.id };
    });
  const removeSemester = () =>
    update((st) => {
      if (st.semesters.length < 2) return st;
      const rest = st.semesters.filter((x) => x.id !== sem.id);
      return { ...st, semesters: rest, active: rest[0].id };
    });

  const result = semesterGpa(sem.subjects, state.scale, 'projected');
  const current = semesterGpa(sem.subjects, state.scale, 'current');

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {state.semesters.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => update((st) => ({ ...st, active: s.id }))}
            className={`rounded-full border px-3 py-1.5 text-sm transition ${
              s.id === sem.id ? 'border-brand bg-brand/15 text-brand' : 'border-line bg-panel text-mute hover:text-ink'
            }`}
          >
            {s.name}
          </button>
        ))}
        <button type="button" onClick={addSemester} className="inline-flex items-center gap-1 rounded-full border border-dashed border-line px-3 py-1.5 text-sm text-mute hover:border-brand hover:text-brand">
          <Plus size={14} /> Add semester
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <Field text className="w-56" label="Semester name" value={sem.name} onChange={(v) => setSem({ name: v })} />
        {state.semesters.length > 1 && (
          <button type="button" onClick={removeSemester} className="mb-0.5 inline-flex items-center gap-1 rounded-lg border border-line px-3 py-2 text-sm text-bad hover:bg-bad/10">
            <Trash2 size={14} /> Delete semester
          </button>
        )}
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-panel">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wider text-mute">
            <tr className="border-b border-line">
              <th className="px-3 py-2.5 font-semibold">Subject</th>
              <th className="px-2 py-2.5 font-semibold">Credit hours</th>
              <th className="px-2 py-2.5 font-semibold">Obtained marks</th>
              <th className="px-2 py-2.5 font-semibold">Out of</th>
              <th className="px-2 py-2.5 font-semibold">Expected marks</th>
              <th className="px-2 py-2.5 font-semibold">%</th>
              <th className="px-2 py-2.5 font-semibold">Grade</th>
              <th className="px-2 py-2.5 font-semibold">Points</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {sem.subjects.map((s, i) => {
              const r = subjectResult(s, state.scale);
              return (
                <tr key={s.id} className="border-b border-line/60 last:border-0">
                  <td className="px-3 py-1.5"><input dir="auto" value={s.name} maxLength={60} onChange={(e) => setSubject(s.id, { name: e.target.value })} placeholder={`Subject ${i + 1}`} aria-label="Subject name" className={cell} /></td>
                  {['credits', 'obtained', 'total', 'expected'].map((k) => (
                    <td key={k} className="px-2 py-1.5">
                      <input
                        value={s[k]}
                        inputMode="decimal"
                        aria-label={k}
                        onChange={(e) => setSubject(s.id, { [k]: e.target.value.replace(/[^\d.]/g, '').slice(0, 7) })}
                        placeholder={k === 'obtained' ? 'done?' : k === 'expected' ? 'plan' : ''}
                        className={`${cell} w-20`}
                      />
                    </td>
                  ))}
                  <td className="px-2 py-1.5 tabular-nums">{r.counted ? fmt(r.percent, 1) : '–'}</td>
                  <td className="px-2 py-1.5 font-semibold">
                    {r.counted ? <span className={r.points === 0 ? 'text-bad' : 'text-brand'}>{r.grade}</span> : '–'}
                    {r.estimated && <span className="ms-1 text-[0.65rem] font-normal text-mute">est.</span>}
                  </td>
                  <td className="px-2 py-1.5 tabular-nums">{r.counted ? fmt(r.points) : '–'}</td>
                  <td className="px-1">
                    <button type="button" onClick={() => setSem({ subjects: sem.subjects.filter((x) => x.id !== s.id) })} aria-label="Remove subject" className="rounded p-1.5 text-mute hover:text-bad">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => setSem({ subjects: [...sem.subjects, blankSubject()] })} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm text-mute hover:border-brand hover:text-brand">
          <Plus size={15} /> Add subject
        </button>
        <p className="text-sm text-mute">
          {sem.name}: <strong className="text-ink">{fmt(current.gpa)}</strong> GPA from finished subjects
          {result.gpa !== current.gpa && <> · <strong className="text-brand">{fmt(result.gpa)}</strong> with expected marks</>}
          {' '}({result.credits} credit hours)
        </p>
      </div>
      <p className="mt-2 text-xs text-mute">
        Enter <strong>obtained marks</strong> for finished subjects. For a subject you have not finished, enter <strong>expected marks</strong> to see a projected GPA (shown as “est.”).
      </p>
    </div>
  );
}

// ---------------- Target tab ----------------
function TargetTab({ state, update, overall }) {
  const t = state.target;
  const setT = (patch) => update((st) => ({ ...st, target: { ...st.target, ...patch } }));
  const target = num(t.cgpa);
  const remaining = num(t.remaining);
  const plan = target !== null && remaining ? requiredGpa({ currentCredits: overall.credits, currentPoints: overall.points, targetCgpa: target, remainingCredits: remaining }) : null;

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Target CGPA" value={t.cgpa} onChange={(v) => setT({ cgpa: v })} placeholder="3.5" suffix="/ 4.0" />
        <Field label="Credit hours still to study" value={t.remaining} onChange={(v) => setT({ remaining: v })} placeholder="30" suffix="credit hrs" />
      </div>
      <p className="mt-2 text-xs text-mute">Your current CGPA is calculated from the marks you entered in the Semesters tab (and the earlier record, if you added one).</p>

      {overall.credits === 0 && <Note icon={AlertTriangle}>Add some obtained marks in the Semesters tab first, or enter your earlier CGPA and credit hours at the top.</Note>}

      {plan && overall.credits > 0 && (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Stat icon={GraduationCap} label="Current CGPA" value={fmt(overall.gpa)} sub={`${overall.credits} credit hours`} />
            <Stat
              icon={Target}
              label="Needed GPA from now"
              value={plan.possible ? fmt(plan.required) : '> 4.00'}
              sub={plan.possible ? `about a ${gradeForPoints(plan.required, state.scale)} average` : 'not reachable'}
              tone={plan.possible ? 'brand' : 'bad'}
            />
            <Stat icon={TrendingUp} label="Best possible CGPA" value={fmt(plan.maxCgpa)} sub={`if you get 4.0 in all ${remaining} hours`} tone="good" />
          </div>

          {plan.alreadySecured && <Note tone="good" icon={CheckCircle2}>Great news: even with the lowest grades you would stay above {fmt(target)}. Keep going!</Note>}
          {!plan.alreadySecured && plan.possible && <Note tone="brand" icon={Target}>To finish with a CGPA of <strong>{fmt(target)}</strong> you need an average GPA of <strong>{fmt(plan.required)}</strong> over your next {remaining} credit hours.</Note>}
          {!plan.possible && <Note tone="bad">A CGPA of {fmt(target)} cannot be reached with only {remaining} more credit hours. The highest you can reach is <strong>{fmt(plan.maxCgpa)}</strong>. Try a lower target or add more credit hours.</Note>}

          <h3 className="mb-2 mt-6 text-sm font-semibold">What if I get… in the remaining credit hours?</h3>
          <div className="overflow-hidden rounded-xl border border-line bg-panel">
            <table className="w-full text-sm">
              <thead className="bg-panel2 text-xs uppercase tracking-wider text-mute">
                <tr><th className="px-3 py-2 text-left">Average GPA</th><th className="px-3 py-2 text-left">Grade</th><th className="px-3 py-2 text-left">Final CGPA</th></tr>
              </thead>
              <tbody>
                {[4, 3.67, 3.33, 3, 2.67, 2.33, 2].map((g) => {
                  const final = (overall.points + g * remaining) / (overall.credits + remaining);
                  const hit = final >= target;
                  return (
                    <tr key={g} className="border-t border-line/60">
                      <td className="px-3 py-1.5 tabular-nums">{fmt(g)}</td>
                      <td className="px-3 py-1.5">{gradeForPoints(g, state.scale)}</td>
                      <td className={`px-3 py-1.5 font-semibold tabular-nums ${hit ? 'text-good' : ''}`}>{fmt(final)} {hit && <span className="text-xs font-normal">✓ reaches target</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------- Grade calculator tab ----------------
function GradeTab({ state, update }) {
  const g = state.grade;
  const setG = (patch) => update((st) => ({ ...st, grade: { ...st.grade, ...patch } }));
  const setItem = (id, patch) => setG({ items: g.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) });
  const target = num(g.target) ?? 0;
  const r = gradeCalculator(g.items, target);
  const rows = (SCALES[state.scale] || SCALES.standard).rows.filter((x) => x[0] > 0);

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-mute">Grade I want in this course</p>
      <div className="flex flex-wrap items-center gap-2">
        {rows.map(([min, letter]) => (
          <button key={letter} type="button" onClick={() => setG({ target: String(min) })} className={`rounded-full border px-3 py-1.5 text-sm transition ${target === min ? 'border-brand bg-brand/15 text-brand' : 'border-line bg-panel text-mute hover:text-ink'}`}>
            {letter} ({min}%)
          </button>
        ))}
        <Field className="w-32" label="Or exact %" value={g.target} onChange={(v) => setG({ target: v })} suffix="%" />
      </div>

      <div className="mt-5 overflow-x-auto rounded-2xl border border-line bg-panel">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wider text-mute">
            <tr className="border-b border-line"><th className="px-3 py-2.5">Assessment</th><th className="px-2 py-2.5">Weight %</th><th className="px-2 py-2.5">My score % (empty = not done)</th><th className="w-10" /></tr>
          </thead>
          <tbody>
            {g.items.map((it) => (
              <tr key={it.id} className="border-b border-line/60 last:border-0">
                <td className="px-3 py-1.5"><input dir="auto" value={it.name} maxLength={40} onChange={(e) => setItem(it.id, { name: e.target.value })} aria-label="Assessment name" className={cell} /></td>
                <td className="px-2 py-1.5"><input value={it.weight} inputMode="decimal" onChange={(e) => setItem(it.id, { weight: e.target.value.replace(/[^\d.]/g, '').slice(0, 6) })} aria-label="Weight" className={`${cell} w-24`} /></td>
                <td className="px-2 py-1.5"><input value={it.score} inputMode="decimal" placeholder="not done" onChange={(e) => setItem(it.id, { score: e.target.value.replace(/[^\d.]/g, '').slice(0, 6) })} aria-label="Score" className={`${cell} w-28`} /></td>
                <td className="px-1"><button type="button" onClick={() => setG({ items: g.items.filter((x) => x.id !== it.id) })} aria-label="Remove" className="rounded p-1.5 text-mute hover:text-bad"><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" onClick={() => setG({ items: [...g.items, { id: uid(), name: '', weight: '', score: '' }] })} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm text-mute hover:border-brand hover:text-brand">
        <Plus size={15} /> Add assessment
      </button>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Stat icon={Award} label="Marks earned so far" value={`${fmt(r.earned, 1)} / ${fmt(r.gradedWeight, 0)}`} sub={r.currentPercent !== null ? `${fmt(r.currentPercent, 1)}% of finished work · grade ${gradeFor(r.currentPercent, state.scale).grade}` : 'nothing finished yet'} />
        <Stat icon={Target} label="Weight still to come" value={`${fmt(r.remainingWeight, 0)}%`} sub="of the course" />
        <Stat
          icon={TrendingUp}
          label="Average needed in the rest"
          value={r.needed === null ? '–' : r.alreadySecured ? '0%' : `${fmt(r.needed, 1)}%`}
          sub={r.needed === null ? 'everything is graded' : r.alreadySecured ? 'target already secured' : r.possible ? `to reach ${fmt(target, 0)}% overall` : 'more than 100%: not reachable'}
          tone={r.possible ? 'brand' : 'bad'}
        />
      </div>
      {Math.abs(r.totalWeight - 100) > 0.01 && <Note>The weights add up to {fmt(r.totalWeight, 0)}%, not 100%. Check your course outline.</Note>}
      {r.needed === null && r.gradedWeight > 0 && <Note tone={r.possible ? 'good' : 'bad'} icon={r.possible ? CheckCircle2 : AlertTriangle}>Final result: {fmt(r.earned, 1)}% (grade {gradeFor(r.earned, state.scale).grade}). {r.possible ? 'You reached your target.' : 'This is below your target.'}</Note>}
      {r.needed !== null && !r.possible && <Note tone="bad">Even with 100% in everything left you would reach {fmt(r.earned + r.remainingWeight, 1)}%. Pick a lower target grade.</Note>}
    </div>
  );
}

// ---------------- Progress tab ----------------
function TrendChart({ points }) {
  if (points.length === 0) return <p className="text-sm text-mute">Enter marks to see your GPA trend.</p>;
  const w = 480;
  const h = 190;
  const pad = { l: 28, r: 8, t: 14, b: 28 };
  const slot = (w - pad.l - pad.r) / points.length;
  const bar = Math.min(46, slot * 0.6);
  const y = (v) => pad.t + (1 - v / 4) * (h - pad.t - pad.b);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="GPA of each semester" className="w-full">
      {[0, 1, 2, 3, 4].map((v) => (
        <g key={v}>
          <line x1={pad.l} x2={w - pad.r} y1={y(v)} y2={y(v)} stroke="var(--c-line)" strokeWidth="1" />
          <text x={pad.l - 6} y={y(v) + 3} textAnchor="end" fontSize="9" fill="var(--c-mute)">{v}</text>
        </g>
      ))}
      {points.map((p, i) => {
        const x = pad.l + slot * i + (slot - bar) / 2;
        const value = p.gpa ?? 0;
        return (
          <g key={p.name + i}>
            <rect x={x} y={y(value)} width={bar} height={Math.max(0, y(0) - y(value))} rx="5" fill="var(--c-brand)" opacity={p.estimated ? 0.45 : 1} />
            <text x={x + bar / 2} y={y(value) - 4} textAnchor="middle" fontSize="10" fontWeight="600" fill="var(--c-ink)">{p.gpa === null ? '' : fmt(p.gpa)}</text>
            <text x={x + bar / 2} y={h - 10} textAnchor="middle" fontSize="9" fill="var(--c-mute)">{p.name.length > 9 ? `${p.name.slice(0, 8)}…` : p.name}</text>
          </g>
        );
      })}
    </svg>
  );
}

function ProgressTab({ state, update, overall, projected }) {
  const p = state.program;
  const setP = (patch) => update((st) => ({ ...st, program: { ...st.program, ...patch } }));
  const prog = academicProgress(state.semesters, state.prior, p, state.scale);
  const st = standing(overall.gpa);
  const trend = state.semesters.map((s) => {
    const cur = semesterGpa(s.subjects, state.scale, 'current');
    const all = semesterGpa(s.subjects, state.scale, 'projected');
    return { name: s.name, gpa: cur.gpa ?? all.gpa, estimated: cur.gpa === null };
  });

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Credit hours needed for my degree" value={p.totalCredits} onChange={(v) => setP({ totalCredits: v })} placeholder="130" suffix="credit hrs" />
        <Field label="Credit hours I take each semester" value={p.perSemester} onChange={(v) => setP({ perSemester: v })} placeholder="18" suffix="credit hrs" />
      </div>

      <div className="mt-5 rounded-2xl border border-line bg-panel p-4">
        <div className="flex items-end justify-between">
          <p className="text-sm font-semibold">Degree progress</p>
          <p className="text-2xl font-bold text-brand">{fmt(prog.percent, 0)}%</p>
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-panel2" role="progressbar" aria-valuenow={Math.round(prog.percent)} aria-valuemin={0} aria-valuemax={100}>
          <div className="gradient-brand h-full rounded-full transition-all" style={{ width: `${prog.percent}%` }} />
        </div>
        <p className="mt-2 text-xs text-mute">{prog.completed} of {prog.total} credit hours completed (failed and unfinished subjects are not counted)</p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Stat icon={GraduationCap} label="Remaining credits" value={prog.remaining} sub="credit hours to graduate" />
        <Stat icon={TrendingUp} label="Semesters left" value={prog.semestersLeft ?? '–'} sub={prog.semestersLeft ? `at ${p.perSemester} credit hrs per semester` : 'enter credit hours per semester'} />
        <Stat icon={Award} label="Standing" value={st.label} sub={`CGPA ${fmt(overall.gpa)}`} tone={st.tone} />
      </div>

      <div className="mt-5 rounded-2xl border border-line bg-panel p-4">
        <p className="mb-2 text-sm font-semibold">GPA of each semester</p>
        <TrendChart points={trend} />
        <p className="mt-1 text-xs text-mute">Lighter bars use expected marks. {projected.gpa !== null && overall.gpa !== null && projected.gpa !== overall.gpa && <>Projected CGPA with expected marks: <strong className="text-ink">{fmt(projected.gpa)}</strong>.</>}</p>
      </div>
    </div>
  );
}

// ---------------- Page ----------------
const TABS = [
  { value: 'semesters', label: 'Semesters' },
  { value: 'target', label: 'Target CGPA' },
  { value: 'grade', label: 'Grade calculator' },
  { value: 'progress', label: 'Progress' },
];

export default function GpaPage() {
  const [state, setState] = useState(loadState);
  const [tab, setTab] = useState('semesters');
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => saveJson('gpa', state), 300);
    return () => clearTimeout(id);
  }, [state]);

  const sem = state.semesters.find((s) => s.id === state.active) || state.semesters[0];
  const overall = useMemo(() => overallCgpa(state.semesters, state.prior, state.scale, 'current'), [state.semesters, state.prior, state.scale]);
  const projected = useMemo(() => overallCgpa(state.semesters, state.prior, state.scale, 'projected'), [state.semesters, state.prior, state.scale]);
  const semCurrent = semesterGpa(sem.subjects, state.scale, 'current');
  const semProjected = semesterGpa(sem.subjects, state.scale, 'projected');
  const prog = academicProgress(state.semesters, state.prior, state.program, state.scale);
  const st = standing(overall.gpa ?? projected.gpa);

  const setPrior = (patch) => setState((s) => ({ ...s, prior: { ...s.prior, ...patch } }));

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-12 pt-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">GPA <span className="gradient-text">Calculator</span></h2>
          <p className="mt-1 text-sm text-mute">Semester GPA, overall CGPA, target planner, grade calculator and academic progress. Saved on this device only.</p>
        </div>
        <label className="text-xs text-mute">
          Grading scale
          <select value={state.scale} onChange={(e) => setState((s) => ({ ...s, scale: e.target.value }))} className="mt-1 block rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink outline-none focus:border-brand">
            {Object.entries(SCALES).map(([id, sc]) => <option key={id} value={id}>{sc.name}</option>)}
          </select>
        </label>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={GraduationCap} label="Semester GPA" value={fmt(semCurrent.gpa ?? semProjected.gpa)} sub={semCurrent.gpa === null && semProjected.gpa !== null ? 'projected (expected marks)' : semProjected.gpa !== semCurrent.gpa ? `${fmt(semProjected.gpa)} with expected marks` : sem.name} />
        <Stat icon={Award} label="Overall CGPA" value={fmt(overall.gpa ?? projected.gpa)} sub={overall.gpa === null && projected.gpa !== null ? 'projected (expected marks)' : projected.gpa !== overall.gpa ? `${fmt(projected.gpa)} with expected marks` : `${overall.credits} credit hours`} />
        <Stat icon={TrendingUp} label="Credits completed" value={prog.completed} sub={`${fmt(prog.percent, 0)}% of ${prog.total}`} />
        <Stat icon={Target} label="Standing" value={st.label} sub="from your CGPA" tone={st.tone} />
      </div>

      <details className="mt-4 rounded-xl border border-line bg-panel px-4 py-3 text-sm">
        <summary className="cursor-pointer font-medium">Already finished some semesters? Add your earlier CGPA</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="CGPA before the semesters below" value={state.prior.cgpa} onChange={(v) => setPrior({ cgpa: v })} placeholder="3.2" suffix="/ 4.0" />
          <Field label="Credit hours completed before" value={state.prior.credits} onChange={(v) => setPrior({ credits: v })} placeholder="45" suffix="credit hrs" />
        </div>
      </details>

      <div className="mt-6 overflow-x-auto pb-1">
        <Segmented label="GPA tools" options={TABS} value={tab} onChange={setTab} />
      </div>

      <div className="mt-5">
        {tab === 'semesters' && <SemestersTab state={state} update={setState} />}
        {tab === 'target' && <TargetTab state={state} update={setState} overall={overall} />}
        {tab === 'grade' && <GradeTab state={state} update={setState} />}
        {tab === 'progress' && <ProgressTab state={state} update={setState} overall={overall} projected={projected} />}
      </div>

      <div className="mt-10 border-t border-line pt-4 text-right">
        {confirmReset ? (
          <span className="text-sm">
            Delete all GPA data?{' '}
            <button type="button" onClick={() => { setState(defaults()); setConfirmReset(false); }} className="font-semibold text-bad hover:underline">Yes, reset</button>
            {' · '}
            <button type="button" onClick={() => setConfirmReset(false)} className="text-mute hover:underline">Cancel</button>
          </span>
        ) : (
          <button type="button" onClick={() => setConfirmReset(true)} className="inline-flex items-center gap-1.5 text-sm text-mute hover:text-bad">
            <RotateCcw size={14} /> Reset all GPA data
          </button>
        )}
      </div>
    </div>
  );
}
