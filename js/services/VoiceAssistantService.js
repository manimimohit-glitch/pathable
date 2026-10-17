/**
 * VoiceAssistantService — Text-to-speech and speech-to-text.
 * Manages voice settings, command parsing, and audio feedback.
 */
class VoiceAssistantService {
    constructor() {
        this.synth = window.speechSynthesis || null;
        this.recognition = null;
        this.isListening = false;
        this.isSpeaking = false;
        this.settings = this._loadSettings();
        this._initRecognition();
        this._onCommandCallback = null;
        this._onEndCallback = null;
        this._voices = [];

        // Load voices
        if (this.synth) {
            this._voices = this.synth.getVoices();
            this.synth.onvoiceschanged = () => {
                this._voices = this.synth.getVoices();
            };
        }
    }

    _loadSettings() {
        try {
            const s = localStorage.getItem('pathable_voice_settings');
            if (s) return JSON.parse(s);
        } catch (e) { /* ignore */ }
        return {
            speed: 1.0,
            volume: 0.8,
            language: 'en-US',
            autoRepeat: false
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
    }

    _initRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = false;
            this.recognition.lang = this.settings.language;

            this.recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript.trim();
                console.log('VoiceAssistant: Heard:', transcript);
                if (this._onCommandCallback) {
                    this._onCommandCallback(transcript);
                }
            };

            this.recognition.onend = () => {
                this.isListening = false;
                if (this._onEndCallback) {
                    this._onEndCallback();
                }
            };

            this.recognition.onerror = (event) => {
                console.warn('VoiceAssistant: Recognition error:', event.error);
                this.isListening = false;
                if (this._onEndCallback) {
                    this._onEndCallback();
                }
            };
        }
    }

    // ---- Text to Speech ----

    speak(text, priority = 'normal') {
        if (!this.synth) {
            console.warn('VoiceAssistant: SpeechSynthesis not available');
            return;
        }

        // Cancel if critical priority
        if (priority === 'critical') {
            this.synth.cancel();
        }

        // Don't interrupt critical speech
        if (this.isSpeaking && priority !== 'critical') {
            // Queue it
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = this.settings.speed;
        utterance.volume = this.settings.volume;
        utterance.lang = this.settings.language;

        // Pick a voice matching language
        const voice = this._voices.find(v => v.lang.startsWith(this.settings.language.split('-')[0]));
        if (voice) {
            utterance.voice = voice;
        }

        utterance.onstart = () => { this.isSpeaking = true; };
        utterance.onend = () => { this.isSpeaking = false; };
        utterance.onerror = () => { this.isSpeaking = false; };

        this.synth.speak(utterance);
    }

    stopSpeaking() {
        if (this.synth) {
            this.synth.cancel();
            this.isSpeaking = false;
        }
    }

    // ---- Speech to Text ----

    startListening(onCommand, onEnd) {
        if (!this.recognition) {
            console.warn('VoiceAssistant: SpeechRecognition not available');
            if (onEnd) onEnd();
            return false;
        }

        if (this.isListening) {
            this.stopListening();
        }

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

    parseCommand(transcript) {
        const text = transcript.toLowerCase().trim();

        // Emergency commands
        if (text.includes('emergency') || text.includes('help') || text.includes('exit') || text.includes('evacuate')) {
            return { action: 'emergency', confidence: 1.0 };
        }

        // Stop navigation
        if (text.includes('stop') && (text.includes('navigation') || text.includes('navigating') || text === 'stop')) {
            return { action: 'stop_navigation', confidence: 1.0 };
        }

        // Repeat instruction
        if (text.includes('repeat') || text.includes('again') || text.includes('what')) {
            return { action: 'repeat', confidence: 0.9 };
        }

        // Find destination: "navigate to X", "go to X", "take me to X", "where is X"
        const navPatterns = [
            /(?:navigate|go|take me|direct me)\s+(?:to\s+)?(.+)/,
            /(?:where(?:'s| is)\s+)(.+)/,
            /(?:find\s+)(.+)/,
            /(?:show\s+(?:me\s+)?(?:the\s+)?(?:way\s+)?(?:to\s+)?)(.+)/
        ];

        for (const pattern of navPatterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                const destination = match[1].trim();
                return { action: 'navigate', destination, confidence: 0.85 };
            }
        }

        // Obstacle detection toggle
        if (text.includes('obstacle') || text.includes('detect')) {
            return { action: 'toggle_obstacle', confidence: 0.8 };
        }

        // Settings
        if (text.includes('settings') || text.includes('setting')) {
            return { action: 'settings', confidence: 0.8 };
        }

        // Nearby
        if (text.includes('nearby') || text.includes('near')) {
            return { action: 'nearby', confidence: 0.8 };
        }

        return { action: 'unknown', raw: transcript, confidence: 0 };
    }
}

// Global instance
window.VoiceAssistantService = new VoiceAssistantService();
