(() => {
    const storageKey = "gamefusionxMusicEnabled";
    let enabled = localStorage.getItem(storageKey) !== "false";
    let audioContext = null;
    let musicTimer = null;
    let step = 0;

    const themeName = document.body?.dataset?.musicTheme || "arcade";
    const themes = {
        arcade: {
            lead: [523.25, 659.25, 783.99, 659.25, 587.33, 659.25, 698.46, 783.99],
            bass: [130.81, 146.83, 164.81, 146.83],
            accent: [783.99, 880.0, 987.77, 880.0],
            tempo: 280,
            leadType: "square",
            bassType: "triangle",
            accentType: "sine",
        },
        car: {
            lead: [392.0, 440.0, 523.25, 659.25, 587.33, 523.25, 440.0, 392.0],
            bass: [98.0, 110.0, 130.81, 110.0],
            accent: [196.0, 220.0, 246.94, 220.0],
            tempo: 210,
            leadType: "sawtooth",
            bassType: "triangle",
            accentType: "square",
        },
        bike: {
            lead: [440.0, 493.88, 587.33, 659.25, 739.99, 659.25, 587.33, 493.88],
            bass: [110.0, 123.47, 130.81, 146.83],
            accent: [659.25, 739.99, 659.25, 587.33],
            tempo: 300,
            leadType: "triangle",
            bassType: "square",
            accentType: "sine",
        },
        tower: {
            lead: [349.23, 392.0, 440.0, 523.25, 587.33, 523.25, 440.0, 392.0],
            bass: [87.31, 98.0, 110.0, 123.47],
            accent: [698.46, 659.25, 587.33, 523.25],
            tempo: 330,
            leadType: "sine",
            bassType: "triangle",
            accentType: "triangle",
        },
        shooting: {
            lead: [659.25, 783.99, 880.0, 987.77, 880.0, 783.99, 698.46, 659.25],
            bass: [164.81, 196.0, 220.0, 196.0],
            accent: [1318.51, 1174.66, 1046.5, 987.77],
            tempo: 190,
            leadType: "square",
            bassType: "sawtooth",
            accentType: "triangle",
        },
        space: {
            lead: [261.63, 329.63, 392.0, 523.25, 493.88, 392.0, 329.63, 293.66],
            bass: [65.41, 73.42, 82.41, 98.0],
            accent: [523.25, 587.33, 659.25, 587.33],
            tempo: 250,
            leadType: "sine",
            bassType: "triangle",
            accentType: "sawtooth",
        },
        obstacle: {
            lead: [523.25, 493.88, 466.16, 440.0, 493.88, 523.25, 587.33, 523.25],
            bass: [130.81, 123.47, 116.54, 110.0],
            accent: [783.99, 739.99, 698.46, 659.25],
            tempo: 220,
            leadType: "sawtooth",
            bassType: "square",
            accentType: "sine",
        },
    };

    function getTheme() {
        return themes[themeName] || themes.arcade;
    }

    function ensureContext() {
        if (!enabled) {
            return null;
        }

        if (!audioContext) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) {
                return null;
            }
            audioContext = new AudioContextClass();
        }

        if (audioContext.state === "suspended") {
            audioContext.resume();
        }

        return audioContext;
    }

    function playNote(frequency, duration, type, volume, delay = 0) {
        const context = ensureContext();
        if (!context || !frequency) {
            return;
        }

        const startAt = context.currentTime + delay;
        const oscillator = context.createOscillator();
        const gainNode = context.createGain();

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, startAt);
        oscillator.connect(gainNode);
        gainNode.connect(context.destination);

        gainNode.gain.setValueAtTime(0.0001, startAt);
        gainNode.gain.exponentialRampToValueAtTime(volume, startAt + 0.03);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

        oscillator.start(startAt);
        oscillator.stop(startAt + duration + 0.02);
    }

    function playStep() {
        const theme = getTheme();
        const noteIndex = step % theme.lead.length;
        const bassIndex = step % theme.bass.length;
        const accentIndex = step % theme.accent.length;

        playNote(theme.lead[noteIndex], 0.16, theme.leadType || "square", 0.02);
        playNote(theme.bass[bassIndex], 0.28, theme.bassType || "triangle", 0.012, 0.02);

        if (step % 2 === 0) {
            playNote(theme.accent[accentIndex], 0.1, theme.accentType || "sine", 0.007, 0.07);
        }

        if (themeName === "space") {
            playNote(theme.bass[bassIndex] / 2, 0.42, "sine", 0.004, 0.04);
        }

        step += 1;
    }

    function start() {
        if (!enabled || musicTimer) {
            updateButtons();
            return enabled;
        }

        if (!ensureContext()) {
            return false;
        }

        const theme = getTheme();
        step = 0;
        playStep();
        musicTimer = window.setInterval(playStep, theme.tempo);
        updateButtons();
        return true;
    }

    function stop() {
        if (musicTimer) {
            window.clearInterval(musicTimer);
            musicTimer = null;
        }
        updateButtons();
    }

    function setEnabled(value) {
        enabled = Boolean(value);
        localStorage.setItem(storageKey, String(enabled));

        if (enabled) {
            start();
        } else {
            stop();
        }

        updateButtons();
        return enabled;
    }

    function toggle() {
        return setEnabled(!enabled);
    }

    function isEnabled() {
        return enabled;
    }

    function updateButtons() {
        const button = document.getElementById("soundToggle");
        if (button) {
            button.textContent = enabled ? "🔊 Sound On" : "🔇 Sound Off";
        }
    }

    function beginFromInteraction() {
        if (enabled) {
            start();
        }
    }

    document.addEventListener("pointerdown", beginFromInteraction, { once: true });
    document.addEventListener("keydown", beginFromInteraction, { once: true });
    updateButtons();

    window.GameFusionMusic = {
        start,
        stop,
        toggle,
        setEnabled,
        isEnabled,
        updateButtons,
    };
})();
