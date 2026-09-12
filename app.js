(function () {
  const notes = document.getElementById('notes');
  const micBtn = document.getElementById('micBtn');
  const langSelect = document.getElementById('langSelect');
  const exportBtn = document.getElementById('exportBtn');
  const clearBtn = document.getElementById('clearBtn');
  const pauseBtn = document.getElementById('pauseBtn');
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
    mixedLanguageIndex = 0;
    if (shouldKeepListening || isPaused) restartRecognition();
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
  let isPaused = false;
  let sessionStarted = false;
  let mixedLanguageIndex = 0;
  let restartTimer = null;
  let activeRecognitionToken = null;

  function getRecognitionLanguage() {
    if (langSelect.value !== 'mixed-PH') return langSelect.value;
    const language = mixedLanguageIndex % 2 === 0 ? 'fil-PH' : 'en-US';
    mixedLanguageIndex++;
    return language;
  }

  if (!SpeechRecognition) {
    unsupportedBanner.hidden = false;
    micBtn.disabled = true;
    micBtn.style.opacity = '0.4';
  } else {
    recognition = createRecognition();
  }

  function createRecognition() {
    const r = new SpeechRecognition();
    const token = {};
    const processedFinalIndexes = new Set();
    activeRecognitionToken = token;
    r.continuous = true;
    r.interimResults = true;
    r.lang = langSelect.value === 'mixed-PH' ? 'fil-PH' : langSelect.value;

    r.onresult = (event) => {
      if (token !== activeRecognitionToken) return;
      let finalChunk = '';
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          if (!processedFinalIndexes.has(i)) {
            finalChunk += result[0].transcript;
            processedFinalIndexes.add(i);
          }
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
      if (token !== activeRecognitionToken) return;
      if (event.error === 'not-allowed') {
        alert('Microphone access was denied. Allow microphone permission for this page to enable auto-transcription.');
        shouldKeepListening = false;
        setListeningUI(false);
      } else if (event.error === 'service-not-allowed' || event.error === 'language-not-supported') {
        alert('Speech recognition is unavailable for this language in this browser. Try English, Chrome or Edge, or use a different speech-recognition service.');
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
      if (token !== activeRecognitionToken) return;
      isListening = false;
      if (shouldKeepListening && !isPaused) {
        scheduleRecognitionStart();
      } else {
        setListeningUI(false);
        showCaption('');
      }
    };

    return r;
  }

  function startRecognition() {
    if (!recognition || isListening || !shouldKeepListening || isPaused) return;
    try {
      recognition.lang = getRecognitionLanguage();
      recognition.start();
      isListening = true;
      setListeningUI(true);
    } catch (e) {
      scheduleRecognitionStart(300);
    }
  }

  function scheduleRecognitionStart(delay = 200) {
    clearTimeout(restartTimer);
    restartTimer = setTimeout(() => {
      restartTimer = null;
      startRecognition();
    }, delay);
  }

  function restartRecognition() {
    clearTimeout(restartTimer);
    const oldRecognition = recognition;
    activeRecognitionToken = null;
    recognition = null;
    isListening = false;
    try { oldRecognition.stop(); } catch (e) {}
    recognition = createRecognition();
    if (shouldKeepListening && !isPaused) scheduleRecognitionStart();
  }

  function setListeningUI(listening) {
    micBtn.classList.toggle('listening', listening);
    micBtn.setAttribute('aria-label', listening ? 'Stop recording' : 'Start recording');
    pauseBtn.hidden = !listening && !isPaused;
    pauseBtn.textContent = isPaused ? 'Resume' : 'Pause';
    pauseBtn.setAttribute('aria-label', isPaused ? 'Resume listening' : 'Pause listening');
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
    if (isListening || shouldKeepListening || isPaused) {
      shouldKeepListening = false;
      isPaused = false;
      sessionStarted = false;
      restartRecognition();
      setListeningUI(false);
      showCaption('');
    } else {
      shouldKeepListening = true;
      isPaused = false;
      sessionStarted = false;
      startRecognition();
    }
  });

  pauseBtn.addEventListener('click', () => {
    if (!recognition) return;
    if (isPaused) {
      isPaused = false;
      shouldKeepListening = true;
      setListeningUI(false);
      scheduleRecognitionStart();
      return;
    }
    if (!shouldKeepListening && !isListening) return;
    shouldKeepListening = false;
    isPaused = true;
    restartRecognition();
    setListeningUI(false);
    showCaption('');
  });

  // ---- PWA service worker ----
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
})();
