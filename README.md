---
title: UniGenius AI
emoji: 🎓
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
---

# UniGenius AI – Smart Student Assistant

A full-stack AI study assistant for university students. Built with **React + Vite + Tailwind CSS** (frontend), **Node.js + Express** (backend) and **Google Gemini** (AI).

## Features

| Mode | What it does |
|---|---|
| **AI Chat** | Streaming answers, Stop / Regenerate / Copy / Clear, English + Urdu, conversation memory (last 20 messages) |
| **Study Mode** | Pick Beginner / Intermediate / Advanced. Gets explanation, steps, example, summary and self-check questions |
| **Quiz Generator** | Topic + 5/10/15 questions + difficulty. Interactive MCQs, instant explanations, score and full review |
| **Notes Summarizer** | Upload a real `.pdf` / `.txt` (parsed on the server) or paste text. Gets summary, detailed notes, key takeaways, revision questions. Copy or download as `.md` |
| **Code Assistant** | HTML, CSS, JavaScript, Python, C++, SQL. Explain, generate or debug with highlighted code and Copy buttons |
| **Chat history** | Saved in localStorage. Open, rename, delete, new chat |
| **Theme** | Dark by default, light toggle (remembered) |

## 1. Requirements

- **Node.js 20 or newer** (download the LTS version from https://nodejs.org). Check with `node -v`.
- A **free Gemini API key**: open https://aistudio.google.com, sign in, click **Get API key**.

## 2. Install

Open a terminal in this folder (`unigenius-ai`) and run:

```bash
npm run install:all
```

## 3. Add your API key

1. Go to the `server` folder and copy `.env.example` to `.env`
   - Windows PowerShell: `copy server\.env.example server\.env`
   - Mac / Linux: `cp server/.env.example server/.env`
2. Open `server/.env` and replace `paste_your_key_here` with your key.
3. Check `GEMINI_MODEL`. Google changes model names often. Open Google AI Studio, look at the model list, and use a current **Flash** model name if the default gives "model not found".

**Never share `.env`, never upload it to GitHub, never put the key in the React code.** The browser only talks to your own server.

## 4. Run

```bash
npm run dev
```

Open **http://localhost:5173**. This starts the API (port 5000) and the React app (port 5173) together.

Optional production mode (one server): `npm run build` then `npm start`, and open http://localhost:5000.

Run the logic tests: `npm test`

## Project structure

```
unigenius-ai/
  package.json            root scripts (dev, build, install:all) using concurrently
  client/                 React + Vite + Tailwind
    src/components        Sidebar, MessageBubble, Markdown, CodeBlock, ChatInput ...
    src/pages             ChatPage (chat + study), QuizPage, NotesPage, CodePage
    src/context           ChatContext (history + localStorage), ThemeContext
    src/hooks             useChatStream, useStreamText
    src/services/api.js   fetch + streaming helpers (calls /api only)
    src/utils             storage, text helpers
  server/                 Express API
    index.js  app.js      start-up and middleware (helmet, CORS, rate limit)
    routes/api.js         /api/health, /chat, /code, /quiz, /notes
    controllers/          chat, quiz, notes
    services/gemini.js    the ONLY file that talks to Gemini
    services/pdf.js       PDF/TXT text extraction (pdf-parse v2)
    prompts/system.js     the system instruction + mode prompts
    middleware/           upload (multer), rate limit, error handler
    utils/                validation, errors, SSE, language detection
    tests/                unit tests (node --test)
```

## How it works (for your viva)

1. The React app sends your message to **`/api/chat`** on the Express server.
2. The server validates it, adds the **system instruction** (UniGenius AI personality + mode rules) and calls Gemini with the official `@google/genai` SDK.
3. Gemini's answer is **streamed** back with Server-Sent Events, so text appears word by word. The Stop button cancels the request with an `AbortController`.
4. The **Quiz** and **Notes** features ask Gemini for **structured JSON** (a response schema). The server validates the JSON before sending it to the browser.
5. For PDFs, **multer** keeps the file in memory and **pdf-parse** extracts the text. Nothing is saved to disk.
6. Chats are stored in the browser's **localStorage**.

## Security

- API key only in `server/.env` (listed in `.gitignore`). The server refuses to start without it.
- CORS limited to your app, `helmet` headers, rate limiting, request size limits, input validation.
- Uploads: only `.pdf` / `.txt`, max 5 MB, in memory only.
- AI text is rendered as safe Markdown (no raw HTML).
- Errors are shown as friendly messages. Stack traces and keys are never sent to the browser.

## Troubleshooting

| Problem | Fix |
|---|---|
| Red banner "Cannot reach the server" | Run `npm run dev` from the project folder and refresh |
| Server exits: "GEMINI_API_KEY is missing" | Create `server/.env` from `.env.example` and paste your key |
| "The server could not use the Gemini API key" | The key is wrong or has spaces. Create a new one in AI Studio |
| "model not found" | Change `GEMINI_MODEL` in `server/.env` to a current Flash model from AI Studio, then restart |
| "free AI quota is used up" (429) | Wait a minute. The free tier has per-minute and per-day limits |
| Port already in use | Change `PORT` in `server/.env` and the proxy target in `client/vite.config.js` |
| CORS error | `CLIENT_ORIGIN` in `server/.env` must match the address in your browser |
| PDF says "no readable text" | It is a scanned image. Use a text-based PDF or paste the text |
| Urdu looks wrong | You need internet for the Google Fonts (Noto Naskh Arabic) to load |
| `npm run install:all` fails | Check `node -v` is 20+ and that you are online |

## 5-minute demo script

1. **(30 s)** Show the welcome screen and toggle dark/light theme.
2. **(60 s)** Chat: ask "Explain recursion with a simple example". Press **Stop** on a second question, then **Regenerate**.
3. **(30 s)** Ask in Urdu: `پائتھون میں لوپ کیا ہوتا ہے؟` and show the Urdu reply.
4. **(45 s)** Study Mode: topic "Binary search trees", switch level Beginner → Advanced.
5. **(60 s)** Quiz: "Operating systems", 5 questions. Answer, show explanations and the final score.
6. **(60 s)** Notes: upload a lecture PDF and show summary, takeaways, and Download .md.
7. **(45 s)** Code Assistant: paste buggy Python, choose **Debug**.
8. **(30 s)** Show history (rename, delete) and explain the security design (key only on the server).

## Test checklist

- [ ] Server starts; `/api/health` shows `keyConfigured: true`
- [ ] Chat streams; Stop, Regenerate, Copy and Clear chat work
- [ ] Urdu question gets an Urdu answer, right-to-left
- [ ] Study Mode follows the 5-part structure and level changes the depth
- [ ] Quiz: 5, 10 and 15 questions; answers lock; score and review correct
- [ ] Notes: PDF works, TXT works, pasted text works, scanned PDF and 6 MB file show friendly errors
- [ ] Code Assistant: Explain, Generate, Debug work for each language; Copy button works
- [ ] History persists after refresh; rename and delete work
- [ ] Theme choice persists after refresh
- [ ] Layout works on a phone-width window (sidebar becomes a drawer)
- [ ] Stop the server: a clear error with Retry appears

## Run it like a normal app (no black window)

One-time setup (after copying the update into the project folder):

1. Double-click `build-app.bat` and wait until it says DONE.
2. Double-click `make-shortcuts.vbs` to put a **UniGenius AI** icon on the Desktop
   (answer Yes to also start it with Windows).
3. From now on, double-click the Desktop icon. It starts the server hidden and opens the app in its own window.

Open it in any browser at `http://localhost:5000`. To stop the hidden server, double-click `stop-unigenius.bat`.
After you receive a new code update, run `build-app.bat` again. If something does not start, open `unigenius.log`.

## Voice Tutor

Sidebar > **Voice Tutor**. Pick or write a role (for example "You are my physics teacher, quiz me on the PN junction"),
choose English or Urdu and press **Start talking**. The AI speaks first, listens to your answers and replies aloud.
Tap the orb to send early or to interrupt; you can also type an answer. In normal chat, the microphone button types with
your voice and **Listen** reads an answer aloud.

Voice uses the browser's own speech features: use Chrome or Edge, stay online and allow the microphone.

## Put it on the internet and install it on Android

1. Upload this project (without `server/.env` and without `node_modules`) to a new GitHub repository.
2. On render.com: **New > Blueprint**, pick the repository. Render reads `render.yaml`; paste your `GEMINI_API_KEY` when asked.
3. After the deploy finishes you get an address like `https://unigenius-ai.onrender.com`.
4. On the Android phone open that address in **Chrome**, tap the menu (three dots) > **Install app** (or **Add to Home screen**).
   It then opens full screen like a normal app, with its own icon, and voice works because the address is HTTPS.

The free plan goes to sleep after 15 minutes without visitors, so the first open can take about a minute.

## New in update 7

- **Voice Tutor**: natural male teacher voice (Gemini text-to-speech, simple clear English, much better Urdu) with automatic fallback to the browser voice; **interrupt by speaking** (headphones work best); switches on the setup screen.
- **GPA Calculator**: subjects with credit hours, obtained and expected marks; semester GPA, overall CGPA, target-CGPA planner, course grade calculator and academic progress. Saved on your device.
- **Presentation Maker**: AI outline, slide text, speaker notes, visual ideas and design tips; edit slides, choose a colour theme and download a real `.pptx` file.

After copying the update run `npm install --prefix server` once (it adds the `pptxgenjs` package), then `build-app.bat`.

## Presentation Maker designs (update 8)

Six designs (Modern, Minimal, Bold, Classic, Split, Cards), 7 colour themes plus custom colours, fonts, bullet styles, text size,
slide numbers, footer with your name, extra layouts (quote, big statement), duplicate/move slides, "improve this slide with AI"
(shorter, simpler, more detail, example, Urdu/English). The preview and the downloaded .pptx use the same design engine.

## Android / PC app

See `ANDROID-APP-GUIDE.md`. The app is an installable PWA (works offline for the app shell, shortcuts for Voice Tutor, Presentation Maker and GPA Calculator).
