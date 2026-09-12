# Lecture Notes

A mobile-friendly web app that transcribes speech (e.g. a teacher talking) live into a notes area, while letting you type freely at any time. No backend, no account — everything is stored locally in the browser (`localStorage`).

## Run it locally

From this folder:

```
npx serve .
```

or

```
python -m http.server 8000
```

Then open the printed `http://localhost:PORT` address in Chrome or Edge on your computer.

## Use it on your phone

The browser's speech recognition requires a "secure context" — `https://` or `localhost`. A plain `http://your-computer-ip:8000` link on your phone will **not** allow the microphone. Two easy options:

1. **Deploy for free** to [Netlify Drop](https://app.netlify.com/drop), [Vercel](https://vercel.com), or [GitHub Pages](https://pages.github.com/) — drag this folder in, get an `https://` URL, open it on your phone.
2. **Tunnel for a quick test**: run `npx serve .` locally, then `npx localtunnel --port 3000` (or `ngrok http 3000`) to get a temporary `https://` URL.

Once opened on your phone, use "Add to Home Screen" (Safari share menu / Chrome menu) to install it like an app.

## Browser support

Auto-transcription uses the Web Speech API, supported in Chrome, Edge, and Safari (iOS 14.5+). Firefox doesn't support it — typing still works everywhere.

## How it works

- Tap the mic button to start listening; it keeps listening continuously (auto-restarts through pauses) until you tap it again.
- Choose **Filipino + English (mixed)** when a lecture switches between Tagalog and English. The browser alternates Filipino and Philippine-English recognition models between speech segments; results vary by browser because the Web Speech API does not provide true simultaneous language detection.
- Recognized speech is appended to the notes area, each recording session prefixed with a timestamp.
- While listening, the current in-progress phrase shows in the caption bar above the mic button before it's finalized into the notes.
- You can click/tap into the notes and type or edit at any time, whether or not it's listening.
- Notes autosave to your browser's local storage as you go.
- Use the download icon to export the current notes as a `.txt` file, or the trash icon to clear them.
