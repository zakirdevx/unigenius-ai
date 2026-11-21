# UniGenius AI on Android and PC (step by step)

You need an online address (https) so the phone can reach the app. This guide does that for free.

## Part 1: Put the app online (about 15 minutes, one time)

1. Extract `unigenius-for-hosting.zip` into a NEW empty folder. It does not contain your API key.
2. github.com > sign up / log in > **+ > New repository** > name `unigenius-ai` > **Public** > Create.
3. Click **uploading an existing file**, drag in everything from the folder (including the folders), click **Commit changes**.
4. render.com > sign up with GitHub > **New > Blueprint** > choose `unigenius-ai` > paste your `GEMINI_API_KEY` when asked > **Apply**.
5. Wait about 5 minutes. You get an address like `https://unigenius-ai.onrender.com`. Open it in Chrome to check that it works.

### Part 1 (other way): Hugging Face Spaces, free and NO credit card

1. huggingface.co > Sign up (email only).
2. Click your picture > **New Space**. Name: `unigenius-ai`. SDK: **Docker** > **Blank**. Hardware: **CPU basic (free)**. **Public**. Create Space.
3. **Files** tab > **Add file** > **Upload files**. Drag in everything from the extracted folder (including `Dockerfile` and `README.md`). **Commit changes**.
4. **Settings** > **Variables and secrets** > **New secret**: name `GEMINI_API_KEY`, value = your key. Then **New variable**: `GEMINI_MODEL` = `gemini-3.5-flash-lite` (use the same model names as in your `server/.env`).
5. Wait 5 to 8 minutes (it says Building, then Running). If it says "Runtime error" before you added the secret, that is normal: add the secret and it restarts.
6. Your app address is `https://YOURNAME-unigenius-ai.hf.space` (small letters). Open that direct address, not the huggingface.co page.

## Part 2A: Install on Android without making an APK (fastest)

1. On the phone open your address in **Chrome**.
2. Menu (three dots) > **Install app**.
3. Open it from the home screen. It runs full screen with its own icon.

## Part 2B: Make a real APK file (to share with friends)

1. Go to **pwabuilder.com**, paste your address, click **Start**.
2. Click **Package for stores** > **Android** > **Generate package**. Keep the defaults, and download the zip.
3. The zip contains the `.apk` (to install and share) and `signing.keystore` + `signing-key-info.txt`. KEEP THESE SAFE.
4. Copy the **SHA-256 fingerprint** from `signing-key-info.txt`.
5. In your project open `client/public/.well-known/assetlinks.json` and replace `[]` with the text PWABuilder shows
   (it contains your package id and that fingerprint). Upload the changed file to GitHub. Render redeploys by itself.
   This removes the browser address bar inside the APK so it looks like a real app.
6. Send the `.apk` to the phone, tap it, allow "Install unknown apps", and install.

## Part 3: PC

- Open your address in Chrome or Edge and click the **Install** icon in the address bar. It becomes a desktop app.
- Or keep using the local version with the Desktop icon (`start-unigenius-hidden.vbs`).

## Good to know

- Render's free plan sleeps after 15 minutes. The first open can take about a minute. Open the address once before your presentation.
- Anyone with the address can use your Gemini quota. Do not post it publicly.
- Voice needs internet and microphone permission (allow it when asked).
- To update later: upload the changed files to GitHub. Render rebuilds. Phones get the new version the next time they open the app online.
