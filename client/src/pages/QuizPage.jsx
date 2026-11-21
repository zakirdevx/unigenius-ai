// Quiz Generator: form -> loading -> questions (one at a time) -> score and review.
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, ListChecks, RotateCcw, Sparkles, Trophy, XCircle } from 'lucide-react';
import ErrorBanner from '../components/ErrorBanner.jsx';
import Segmented from '../components/Segmented.jsx';
import { useSpeed } from '../context/SpeedContext.jsx';
import { errorMessage, postJson } from '../services/api.js';

const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];
const COUNTS = [5, 10, 15];
const LETTERS = ['A', 'B', 'C', 'D'];

function PageShell({ children }) {
  return <div className="mx-auto w-full max-w-3xl px-4 py-8">{children}</div>;
}

function QuizSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Generating quiz">
      <div className="skeleton h-6 w-1/3" />
      <div className="skeleton h-24 w-full" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="skeleton h-12 w-full" />
      ))}
      <p className="text-center text-sm text-mute">Writing your questions… this takes a few seconds.</p>
    </div>
  );
}

export default function QuizPage() {
  const { speed } = useSpeed();
  const [topic, setTopic] = useState('');
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState('Beginner');

  const [phase, setPhase] = useState('form'); // form | loading | quiz | results
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState([]); // chosen option index per question, or null
  const [current, setCurrent] = useState(0);
  const [error, setError] = useState('');
  const abortRef = useRef(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const generate = async (e) => {
    e?.preventDefault();
    if (topic.trim().length < 2) {
      setError('Please type a subject or topic first.');
      return;
    }
    setError('');
    setPhase('loading');
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const data = await postJson('/api/quiz', { topic: topic.trim(), count, difficulty, speed }, { signal: controller.signal });
      setQuiz(data);
      setAnswers(Array(data.questions.length).fill(null));
      setCurrent(0);
      setPhase('quiz');
    } catch (err) {
      if (err?.name === 'AbortError') return;
      setError(errorMessage(err));
      setPhase('form');
    }
  };

  const cancel = () => {
    abortRef.current?.abort();
    setPhase('form');
  };

  const choose = (index) => {
    if (answers[current] !== null) return; // answer is locked once chosen
    setAnswers((prev) => prev.map((a, i) => (i === current ? index : a)));
  };

  const next = () => {
    if (current < quiz.questions.length - 1) setCurrent((c) => c + 1);
    else setPhase('results');
  };

  const retake = () => {
    setAnswers(Array(quiz.questions.length).fill(null));
    setCurrent(0);
    setPhase('quiz');
  };

  // ------------------------------------------------------------------ form
  if (phase === 'form' || phase === 'loading') {
    return (
      <PageShell>
        <div className="mb-6 flex items-center gap-3">
          <span className="gradient-brand flex h-11 w-11 items-center justify-center rounded-xl text-white">
            <ListChecks size={22} />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Quiz Generator</h1>
            <p className="text-sm text-mute">Pick a topic and test yourself with AI-made MCQs.</p>
          </div>
        </div>

        {phase === 'loading' ? (
          <div className="rounded-2xl border border-line bg-panel p-6">
            <QuizSkeleton />
            <div className="mt-4 text-center">
              <button type="button" onClick={cancel} className="text-sm text-mute underline underline-offset-4 hover:text-ink">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={generate} className="space-y-6 rounded-2xl border border-line bg-panel p-6">
            <ErrorBanner message={error} onDismiss={() => setError('')} />

            <div>
              <label htmlFor="topic" className="mb-2 block text-sm font-medium">Subject or topic</label>
              <input
                id="topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                maxLength={300}
                dir="auto"
                placeholder="e.g. Operating system scheduling, Organic chemistry, Python basics…"
                className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-[0.95rem] outline-none transition placeholder:text-mute focus:border-brand"
              />
            </div>

            <div className="flex flex-wrap gap-x-8 gap-y-5">
              <div>
                <p className="mb-2 text-sm font-medium">Number of questions</p>
                <Segmented label="Number of questions" options={COUNTS} value={count} onChange={setCount} />
              </div>
              <div>
                <p className="mb-2 text-sm font-medium">Difficulty</p>
                <Segmented label="Difficulty" options={LEVELS} value={difficulty} onChange={setDifficulty} />
              </div>
            </div>

            <button
              type="submit"
              className="gradient-brand glow inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110"
            >
              <Sparkles size={17} /> Generate quiz
            </button>
          </form>
        )}
      </PageShell>
    );
  }

  const questions = quiz.questions;
  const score = answers.reduce((sum, a, i) => sum + (a === questions[i].correctIndex ? 1 : 0), 0);

  // --------------------------------------------------------------- results
  if (phase === 'results') {
    const percent = Math.round((score / questions.length) * 100);
    const message =
      percent >= 80 ? 'Excellent work!' : percent >= 50 ? 'Good effort. Review the answers below.' : 'Keep practising. You will get there!';
    return (
      <PageShell>
        <div className="fade-up rounded-2xl border border-line bg-panel p-8 text-center">
          <span className="gradient-brand glow mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl text-white">
            <Trophy size={30} />
          </span>
          <p className="text-sm text-mute">Your score</p>
          <p className="gradient-text text-5xl font-bold">{score} / {questions.length}</p>
          <p className="mt-1 text-lg font-semibold">{percent}%</p>
          <p className="mt-2 text-mute">{message}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button type="button" onClick={retake} className="inline-flex items-center gap-2 rounded-xl border border-line bg-panel2 px-4 py-2.5 text-sm font-medium transition hover:bg-line">
              <RotateCcw size={16} /> Retake quiz
            </button>
            <button type="button" onClick={() => setPhase('form')} className="gradient-brand inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110">
              <Sparkles size={16} /> New quiz
            </button>
          </div>
        </div>

        <h2 className="mb-3 mt-8 text-lg font-semibold">Review your answers</h2>
        <div className="space-y-4">
          {questions.map((q, i) => {
            const right = answers[i] === q.correctIndex;
            return (
              <div key={i} className="rounded-2xl border border-line bg-panel p-5">
                <div className="flex items-start gap-3">
                  {right ? <CheckCircle2 className="mt-0.5 shrink-0 text-good" size={20} /> : <XCircle className="mt-0.5 shrink-0 text-bad" size={20} />}
                  <p dir="auto" className="font-medium">{i + 1}. {q.question}</p>
                </div>
                <div className="mt-3 space-y-1.5 ps-8 text-sm">
                  {!right && (
                    <p dir="auto" className="text-bad">Your answer: {answers[i] === null ? 'Not answered' : q.options[answers[i]]}</p>
                  )}
                  <p dir="auto" className="text-good">Correct answer: {q.options[q.correctIndex]}</p>
                  <p dir="auto" className="text-mute">{q.explanation}</p>
                </div>
              </div>
            );
          })}
        </div>
      </PageShell>
    );
  }

  // ------------------------------------------------------------ one question
  const q = questions[current];
  const picked = answers[current];
  const answered = picked !== null;
  const progress = ((current + (answered ? 1 : 0)) / questions.length) * 100;

  return (
    <PageShell>
      <div className="mb-2 flex items-center justify-between text-sm text-mute">
        <span dir="auto" className="truncate pe-3">{quiz.topic} · {quiz.difficulty}</span>
        <span className="shrink-0">Question {current + 1} of {questions.length}</span>
      </div>
      <div className="mb-6 h-2 overflow-hidden rounded-full bg-panel2" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
        <div className="gradient-brand h-full rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>

      <div key={current} className="fade-up rounded-2xl border border-line bg-panel p-6">
        <h2 dir="auto" className="mb-5 text-lg font-semibold leading-snug">{q.question}</h2>

        <div className="space-y-2.5" role="group" aria-label="Answer options">
          {q.options.map((option, i) => {
            const isCorrect = i === q.correctIndex;
            const isPicked = i === picked;
            let style = 'border-line bg-surface hover:border-brand';
            if (answered && isCorrect) style = 'border-good bg-good/10';
            else if (answered && isPicked) style = 'border-bad bg-bad/10';
            else if (answered) style = 'border-line bg-surface opacity-60';
            return (
              <button
                key={i}
                type="button"
                onClick={() => choose(i)}
                disabled={answered}
                className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-start transition disabled:cursor-default ${style}`}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-panel2 text-xs font-bold">{LETTERS[i]}</span>
                <span dir="auto" className="flex-1 text-[0.95rem]">{option}</span>
                {answered && isCorrect && <CheckCircle2 size={18} className="shrink-0 text-good" />}
                {answered && isPicked && !isCorrect && <XCircle size={18} className="shrink-0 text-bad" />}
              </button>
            );
          })}
        </div>

        {answered && (
          <div className="fade-up mt-5 rounded-xl border border-line bg-panel2 p-4 text-sm" aria-live="polite">
            <p className={`mb-1 font-semibold ${picked === q.correctIndex ? 'text-good' : 'text-bad'}`}>
              {picked === q.correctIndex ? 'Correct!' : 'Not quite.'}
            </p>
            <p dir="auto" className="text-mute">{q.explanation}</p>
          </div>
        )}
      </div>

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={next}
          disabled={!answered}
          className="gradient-brand inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition enabled:hover:brightness-110 disabled:opacity-40"
        >
          {current < questions.length - 1 ? 'Next question' : 'See results'} <ArrowRight size={16} />
        </button>
      </div>
    </PageShell>
  );
}
