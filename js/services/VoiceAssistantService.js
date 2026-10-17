/**
 * VoiceAssistantService — Text-to-speech and speech-to-text.
 *
 * Voice design rules for a blind user walking with a phone in their hand:
 *  - Say a thing once. Repeat only when it gets worse, never on a timer.
 *  - Never talk over itself. Only a critical alert may interrupt.
 *  - Speak naturally. No "detected", no reciting the position noun,
 *    no "About 3 meters" padding.
 */
class VoiceAssistantService {
    constructor() {
        this.synth = window.speechSynthesis || null;
        this.recognition = null;
        this.isListening = false;
        this.settings = this._loadSettings();
        this._initRecognition();
        this._onCommandCallback = null;
        this._onEndCallback = null;
        this._voices = [];
        this._ready = false;

        // Speech queue. Only ever one utterance audible at a time.
        this._queue = [];
        this._current = null;
        this._maxQueue = 3;
        this._onCaption = null;

        if (this.synth) {
            this._loadVoices();
            this.synth.onvoiceschanged = () => this._loadVoices();

            // Chrome silently suspends synthesis after ~15s. Nudge it awake.
            // Runs only while speaking, so it never affects normal use.
            this._keepAlive = setInterval(() => {
                if (this.synth && this.synth.speaking && !this.synth.paused) {
                    this.synth.pause();
                    this.synth.resume();
                }
            }, 12000);
        }
    }

    // ---- Settings ----

    _loadSettings() {
        try {
            const s = localStorage.getItem('pathable_voice_settings');
            if (s) return Object.assign({
                speed: 1.0,
                volume: 0.8,
                language: 'en-US',
                autoRepeat: false,
                muted: false,
                sayInfo: false
            }, JSON.parse(s));
        } catch (e) { /* ignore */ }
        return {
            speed: 1.0,
            volume: 0.8,
            language: 'en-US',
            autoRepeat: false,
            muted: false,
            sayInfo: false   // info-level obstacle chatter stays off by default
        };
    }

    saveSettings() {
        try {
            localStorage.setItem('pathable_voice_settings', JSON.stringify(this.settings));
        } catch (e) { /* ignore */ }
    }

    updateSettings(key, value) {
        this.settings[key] = value;
        this.saveSettings();
        if (key === 'language' && this.recognition) {
            this.recognition.lang = value;
        }
        if (key === 'muted' && value) {
            this.clearQueue();
        }
    }

    // ---- Voice selection ----

    _loadVoices() {
        if (!this.synth) return;
        this._voices = this.synth.getVoices() || [];
        this._ready = this._voices.length > 0;
    }

    /**
     * Pick the best voice for the configured language.
     *
     * Previously this fell back to whatever the OS picked as default, which
     * may be a different language — the single most common cause of garbled,
     * hard-to-understand speech.
     */
    _pickVoice() {
        if (!this._voices.length) this._loadVoices();
        if (!this._voices.length) return null;

        const wanted = this.settings.language.toLowerCase();
        const base = wanted.split('-')[0];
        const norm = v => (v.lang || '').replace('_', '-').toLowerCase();

        // 1. Exact language+region match, preferring an on-device voice.
        const exact = this._voices.filter(v => norm(v) === wanted);
        if (exact.length) {
            return exact.find(v => v.localService) || exact[0];
        }

        // 2. Same base language.
        const sameLang = this._voices.filter(v => norm(v).split('-')[0] === base);
        if (sameLang.length) {
            return sameLang.find(v => v.localService) || sameLang[0];
        }

        // 3. Nothing matches the language — stay silent rather than read it
        //    aloud in a language the user did not choose.
        return null;
    }

    // ---- Captions ----

    /** Visual transcript of everything spoken, for captions + screen readers. */
    setCaptionCallback(cb) {
        this._onCaption = cb;
    }

    _caption(text) {
        if (this._onCaption) {
            try { this._onCaption(text); } catch (e) { /* ignore */ }
        }
    }

    // ---- Text to Speech ----

    /**
     * Queue speech.
     * @param {string} text
     * @param {'info'|'normal'|'high'|'critical'} priority
     *        Only 'critical' may interrupt speech already in progress.
     */
    speak(text, priority = 'normal') {
        if (!this.synth || !text) return false;
        if (this.settings.muted && priority !== 'critical') return false;

        const item = { text, priority };

        if (priority === 'critical') {
            // Drop everything pending, but only interrupt if what is playing
            // right now is itself just routine speech.
            this._queue = [];
            if (this._current && this._current.priority !== 'critical') {
                this.synth.cancel();
                this._current = null;
            }
            this._queue.unshift(item);
        } else {
            // Routine speech is lossy under pressure: if the queue is full,
            // discard the oldest stale item rather than delaying the newest.
            this._queue.push(item);
            while (this._queue.length > this._maxQueue) this._queue.shift();
        }

        this._pump();
        return true;
    }

    _pump() {
        if (!this.synth || this._current) return;

        const next = this._queue.shift();
        if (!next) return;

        const voice = this._pickVoice();
        if (!voice) {
            // Language unavailable — caption it so the info is not lost,
            // then continue with whatever else is queued.
            this._caption(next.text);
            this._current = null;
            this._pump();
            return;
        }

        const utterance = new SpeechSynthesisUtterance(next.text);
        utterance.rate = this.settings.speed;
        utterance.volume = this.settings.volume;
        utterance.voice = voice;
        utterance.lang = voice.lang;

        this._current = next;
        this._caption(next.text);

        const done = () => {
            if (this._current === next) this._current = null;
            this._pump();
        };
        utterance.onend = done;
        utterance.onerror = done;

        this.synth.speak(utterance);
    }

    /** Drop everything pending. Does not stop what is currently playing. */
    clearQueue() {
        this._queue = [];
    }

    stopSpeaking() {
        this.clearQueue();
        if (this.synth) {
            this.synth.cancel();
            this._current = null;
        }
    }

    /** True while anything is queued or speaking — used to suppress stacking. */
    get isBusy() {
        return !!this._current || this._queue.length > 0;
    }

    // ---- Speech to Text ----

    _initRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.lang = this.settings.language;

        this.recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript.trim();
            if (this._onCommandCallback) this._onCommandCallback(transcript);
        };

        this.recognition.onend = () => {
            this.isListening = false;
            if (this._onEndCallback) this._onEndCallback();
        };

        this.recognition.onerror = (event) => {
            // 'no-speech' and 'aborted' are routine, not failures worth reporting.
            if (event.error !== 'no-speech' && event.error !== 'aborted') {
                console.warn('VoiceAssistant: Recognition error:', event.error);
            }
            this.isListening = false;
            if (this._onEndCallback) this._onEndCallback();
        };
    }

    startListening(onCommand, onEnd) {
        if (!this.recognition) {
            console.warn('VoiceAssistant: SpeechRecognition not available');
            if (onEnd) onEnd();
            return false;
        }

        if (this.isListening) this.stopListening();

        this._onCommandCallback = onCommand;
        this._onEndCallback = onEnd;
        this.recognition.lang = this.settings.language;

        try {
            this.recognition.start();
            this.isListening = true;
            return true;
        } catch (e) {
            console.warn('VoiceAssistant: Failed to start recognition', e);
            return false;
        }
    }

    stopListening() {
        if (this.recognition && this.isListening) {
            this.recognition.stop();
            this.isListening = false;
        }
    }

    // ---- Command Parsing ----

    /**
     * Order matters. A destination request must beat the emergency keyword,
     * otherwise "where is the exit?" triggers a full evacuation.
     */
    parseCommand(transcript) {
        const text = transcript.toLowerCase().trim();

        // 1. Stop always wins.
        if (/(^|\s)(stop|cancel|halt|never ?mind|forget it)(\s|$)/.test(text)) {
            return { action: 'stop_navigation', confidence: 1.0 };
        }

        // 2. Unambiguous distress phrases only. Note "exit" is NOT here.
        if (/\b(emergency|evacuat\w*|get me out|take me out|i need help|sos)\b/.test(text)) {
            return { action: 'emergency', confidence: 1.0 };
        }

        // 3. Repeat.
        if (/\b(repeat|say again|what was that|come again|what did you say)\b/.test(text)) {
            return { action: 'repeat', confidence: 0.9 };
        }

        // 4. Destinations.
        const navPatterns = [
            /(?:navigate|go|take me|direct me|lead me)\s+(?:to\s+)?(.+)/,
            /(?:where(?:'s| is)\s+)(.+)/,
            /(?:find\s+)(.+)/,
            /(?:show\s+(?:me\s+)?(?:the\s+)?(?:way\s+)?(?:to\s+)?)(.+)/
        ];

        for (const pattern of navPatterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                return { action: 'navigate', destination: match[1].trim(), confidence: 0.85 };
            }
        }

        // 5. Bare "help" with nothing else — short enough to be genuine distress.
        if (/\bhelp\b/.test(text) && text.split(/\s+/).length <= 2) {
            return { action: 'emergency', confidence: 0.7 };
        }

        // 6. Remaining toggles.
        if (/\b(obstacle|detect|scan)\b/.test(text)) {
            return { action: 'toggle_obstacle', confidence: 0.8 };
        }
        if (/\bsettings?\b/.test(text)) {
            return { action: 'settings', confidence: 0.8 };
        }
        if (/\bnearby\b|\bnear me\b/.test(text)) {
            return { action: 'nearby', confidence: 0.8 };
        }

        return { action: 'unknown', raw: transcript, confidence: 0 };
    }
}

// Global instance
window.VoiceAssistantService = new VoiceAssistantService();