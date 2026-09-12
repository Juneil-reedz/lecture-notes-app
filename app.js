(function () {
  const notes = document.getElementById('notes');
  const micBtn = document.getElementById('micBtn');
  const langSelect = document.getElementById('langSelect');
  const exportBtn = document.getElementById('exportBtn');
  const clearBtn = document.getElementById('clearBtn');
  const unsupportedBanner = document.getElementById('unsupportedBanner');
  const captionBar = document.getElementById('captionBar');
  const captionText = document.getElementById('captionText');

  const STORAGE_KEY = 'lecture-notes-content';
  const LANG_KEY = 'lecture-notes-lang';

  // ---- Restore saved state ----
  notes.value = localStorage.getItem(STORAGE_KEY) || '';
  const savedLang = localStorage.getItem(LANG_KEY);
  if (savedLang) langSelect.value = savedLang;

  let saveTimer = null;
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, notes.value);
    }, 300);
  }
  notes.addEventListener('input', scheduleSave);
  langSelect.addEventListener('change', () => {
    localStorage.setItem(LANG_KEY, langSelect.value);
    if (isListening) restartRecognition();
  });

  // ---- Export ----
  exportBtn.addEventListener('click', () => {
    const blob = new Blob([notes.value], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    a.href = url;
    a.download = `lecture-notes-${stamp}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  // ---- Clear ----
  clearBtn.addEventListener('click', () => {
    if (notes.value.trim() && !confirm('Clear all notes? This cannot be undone.')) return;
    notes.value = '';
    localStorage.removeItem(STORAGE_KEY);
    notes.focus();
  });

  // ---- Speech recognition ----
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let isListening = false;
  let shouldKeepListening = false;
  let sessionStarted = false;

  if (!SpeechRecognition) {
    unsupportedBanner.hidden = false;
    micBtn.disabled = true;
    micBtn.style.opacity = '0.4';
  } else {
    recognition = createRecognition();
  }

  function createRecognition() {
    const r = new SpeechRecognition();
    r.continuous = true;
    r.interimResults = true;
    r.lang = langSelect.value;

    r.onresult = (event) => {
      let finalChunk = '';
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalChunk += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      if (finalChunk.trim()) {
        appendFinalText(finalChunk.trim());
      }
      showCaption(interim.trim());
    };

    r.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        alert('Microphone access was denied. Allow microphone permission for this page to enable auto-transcription.');
        shouldKeepListening = false;
        setListeningUI(false);
      } else if (event.error === 'audio-capture') {
        alert('No microphone was found.');
        shouldKeepListening = false;
        setListeningUI(false);
      }
      // 'no-speech' and transient network hiccups: let onend restart it.
    };

    r.onend = () => {
      isListening = false;
      if (shouldKeepListening) {
        setTimeout(() => {
          if (shouldKeepListening) startRecognition();
        }, 200);
      } else {
        setListeningUI(false);
        showCaption('');
      }
    };

    return r;
  }

  function startRecognition() {
    if (!recognition) return;
    try {
      recognition.lang = langSelect.value;
      recognition.start();
      isListening = true;
      setListeningUI(true);
    } catch (e) {
      // start() throws if already started; ignore
    }
  }

  function restartRecognition() {
    if (!recognition) return;
    try { recognition.stop(); } catch (e) {}
    recognition = createRecognition();
    if (shouldKeepListening) startRecognition();
  }

  function setListeningUI(listening) {
    micBtn.classList.toggle('listening', listening);
    micBtn.setAttribute('aria-label', listening ? 'Stop recording' : 'Start recording');
  }

  function showCaption(text) {
    if (!text) {
      captionBar.hidden = true;
      captionText.textContent = '';
      return;
    }
    captionBar.hidden = false;
    captionText.textContent = text;
  }

  function appendFinalText(text) {
    const needsLeadingSpace = notes.value.length > 0 && !/\s$/.test(notes.value);
    let prefix = needsLeadingSpace ? ' ' : '';
    if (!sessionStarted) {
      prefix = notes.value.length ? '\n\n' : '';
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      prefix += `[${time}] `;
      sessionStarted = true;
    }
    notes.value += prefix + text;
    notes.scrollTop = notes.scrollHeight;
    scheduleSave();
  }

  micBtn.addEventListener('click', () => {
    if (!recognition) return;
    if (isListening || shouldKeepListening) {
      shouldKeepListening = false;
      sessionStarted = false;
      try { recognition.stop(); } catch (e) {}
      setListeningUI(false);
      showCaption('');
    } else {
      shouldKeepListening = true;
      sessionStarted = false;
      startRecognition();
    }
  });

  // ---- PWA service worker ----
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
})();
