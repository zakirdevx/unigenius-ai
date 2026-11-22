// The first screen of a new chat: heading, four feature cards and suggested prompts.
import { BookOpen, Calculator, Code, ListChecks, MessageSquare, Mic, Presentation, Sparkles } from 'lucide-react';

const FEATURES = [
  { id: 'ask', title: 'Ask Anything', text: 'Get clear answers in English or Urdu.', icon: MessageSquare, color: 'from-violet-500 to-indigo-500' },
  { id: 'voice', title: 'Voice Tutor', text: 'Talk with an AI teacher out loud.', icon: Mic, color: 'from-rose-500 to-orange-500' },
  { id: 'code', title: 'Learn Programming', text: 'Explain, write and debug code.', icon: Code, color: 'from-sky-500 to-indigo-500' },
  { id: 'quiz', title: 'Generate Quizzes', text: 'Practise with instant MCQs.', icon: ListChecks, color: 'from-fuchsia-500 to-violet-500' },
  { id: 'slides', title: 'Presentation Maker', text: 'AI slides you can download as PPTX.', icon: Presentation, color: 'from-amber-500 to-rose-500' },
  { id: 'gpa', title: 'GPA Calculator', text: 'GPA, CGPA, targets and progress.', icon: Calculator, color: 'from-teal-500 to-cyan-500' },
  { id: 'notes', title: 'Summarize Notes', text: 'Turn PDFs into revision notes.', icon: BookOpen, color: 'from-emerald-500 to-sky-500' },
];

const CHAT_PROMPTS = [
  'Explain recursion with a simple example',
  'پائتھون میں لوپ کیا ہوتا ہے؟',
  'What is the difference between RAM and ROM?',
  'Make me a 7-day exam preparation plan',
];

const STUDY_PROMPTS = [
  'Photosynthesis',
  'Binary search trees',
  'Normalization in databases',
  "Newton's laws of motion",
];

export default function Welcome({ mode, onFeature, onPrompt }) {
  const isStudy = mode === 'study';
  const prompts = isStudy ? STUDY_PROMPTS : CHAT_PROMPTS;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 pb-4 pt-6 text-center sm:pb-6 sm:pt-14">
      <div className="gradient-brand glow fade-up mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-white sm:mb-5 sm:h-16 sm:w-16">
        <Sparkles size={28} />
      </div>

      <h1 className="fade-up text-2xl font-bold tracking-tight sm:text-4xl">
        {isStudy ? (
          <>
            Study Mode: <span className="gradient-text">learn step by step</span>
          </>
        ) : (
          <>
            Your Personal <span className="gradient-text">AI Learning Partner</span>
          </>
        )}
      </h1>
      <p className="fade-up mt-2 max-w-xl text-sm text-mute sm:mt-3 sm:text-lg">
        {isStudy
          ? 'Type any topic. Pick your level above and get a simple explanation, steps, an example and a summary.'
          : 'Learn smarter, understand faster, and achieve more with AI.'}
      </p>

      {!isStudy && (
        <div className="mt-6 grid w-full grid-cols-2 gap-2.5 sm:mt-8 sm:gap-3">
          {FEATURES.map(({ id, title, text, icon: Icon, color }) => (
            <button
              key={id}
              type="button"
              onClick={() => onFeature(id)}
              className="fade-up group flex flex-col items-start gap-2.5 rounded-2xl border border-line bg-panel p-3.5 text-left transition last:col-span-2 hover:-translate-y-0.5 hover:border-brand hover:shadow-lg sm:flex-row sm:items-center sm:gap-4 sm:p-4"
            >
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br sm:h-11 sm:w-11 ${color} text-white`}>
                <Icon size={19} />
              </span>
              <span>
                <span className="block text-sm font-semibold sm:text-base">{title}</span>
                <span className="block text-xs text-mute sm:text-sm">{text}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      <p className="mb-3 mt-6 text-xs font-semibold uppercase tracking-wider text-mute sm:mt-8">
        {isStudy ? 'Try a topic' : 'Try asking'}
      </p>
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-center">
        {prompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onPrompt(prompt)}
            dir="auto"
            className="rounded-2xl border border-line bg-panel px-4 py-2.5 text-start text-sm transition hover:border-brand hover:bg-panel2 sm:rounded-full sm:text-center"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
