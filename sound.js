/**
 * sound.js — Web Audio API Siren & Sound Synthesizer for JadwalSiaga
 * Bekerja tanpa modul (CORS-free) sehingga dapat berjalan langsung di file:// dan http://.
 * 
 * Ragam suara:
 * 1. 'wail'   : Sirine Darurat Berayun (Undulating Siren)
 * 2. 'hilo'   : Sirine Dua Nada (Hi-Lo European Ambulance)
 * 3. 'beep'   : Alarm Digital Beep Cepat (Beker Elektronik)
 * 4. 'chime'  : Melodi Lonceng Harmonis (Alert Chime)
 * 5. 'buzzer' : Klaxon Peringatan Tegas (Warning Buzzer)
 * 6. 'custom' : Berkas audio yang diunggah pengguna (MP3/WAV/OGG)
 */

(function(window) {
  'use strict';

  class SirenPlayer {
    constructor() {
      this.audioCtx = null;
      this.masterGain = null;
      this.isPlaying = false;
      this.currentSoundType = 'wail';
      this.volume = 0.8;
      
      this.stopTimeout = null;
      this.activeNodes = [];
      this.activeIntervals = [];

      this.customAudioEl = null;
      this.customAudioDataUrl = null;
      this.fallbackAudioEl = null;

      this.audioUnlocked = false;
      this.audioBlocked = false;

      // Unlock audio pada interaksi pengguna pertama kali
      const unlock = () => {
        this.initContext();
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
          this.audioCtx.resume().then(() => {
            this.audioUnlocked = true;
            this.audioBlocked = false;
          }).catch(() => {});
        } else if (this.audioCtx && this.audioCtx.state === 'running') {
          this.audioUnlocked = true;
          this.audioBlocked = false;
        }
      };

      window.addEventListener('click', unlock, { passive: true });
      window.addEventListener('touchstart', unlock, { passive: true });
      window.addEventListener('keydown', unlock, { passive: true });
    }

    /**
     * Inisialisasi AudioContext dengan dukungan lintas browser
     */
    initContext() {
      try {
        if (!this.audioCtx) {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          if (AudioContextClass) {
            this.audioCtx = new AudioContextClass();
          }
        }
        if (this.audioCtx) {
          if (this.audioCtx.state === 'running') {
            this.audioUnlocked = true;
            this.audioBlocked = false;
          } else if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume().then(() => {
              this.audioUnlocked = true;
              this.audioBlocked = false;
            }).catch(() => {
              this.audioBlocked = true;
            });
          }
        }
      } catch (e) {
        console.warn('AudioContext notice:', e);
      }
      return this.audioCtx;
    }

    setCustomAudioDataUrl(dataUrl) {
      this.customAudioDataUrl = dataUrl;
    }

    /**
     * Mengatur volume secara langsung saat audio sedang berjalan
     */
    setVolume(vol) {
      this.volume = Math.min(Math.max(vol, 0.05), 1.0);
      if (this.masterGain && this.audioCtx) {
        try {
          this.masterGain.gain.setValueAtTime(this.volume * 0.75, this.audioCtx.currentTime);
        } catch (e) {}
      }
      if (this.customAudioEl) {
        try {
          this.customAudioEl.volume = this.volume;
        } catch (e) {}
      }
      if (this.fallbackAudioEl) {
        try {
          this.fallbackAudioEl.volume = this.volume;
        } catch (e) {}
      }
    }

    /**
     * Memulai pemutaran suara alarm
     */
    start(volume = 0.8, maxDurationSec = 120, soundType = 'wail', onAutoStop = null, onStateChange = null) {
      // Hentikan suara sebelumnya secara sinkron
      this.stop();

      this.volume = Math.min(Math.max(volume, 0.05), 1.0);
      this.currentSoundType = soundType || 'wail';

      // 1. Putar audio kustom jika dipilih dan tersedia
      if (this.currentSoundType === 'custom' && this.customAudioDataUrl) {
        this.playCustomAudio(this.volume, maxDurationSec, onAutoStop, onStateChange);
        return;
      }

      // 2. Pastikan AudioContext siap
      const ctx = this.initContext();

      // Fungsi peluncur sintesis Web Audio API
      const launchSynth = () => {
        try {
          // Tandai isPlaying = true SEBELUM memanggil generator suara
          this.isPlaying = true;
          this.audioBlocked = false;

          const now = ctx.currentTime;
          const master = ctx.createGain();
          master.gain.setValueAtTime(this.volume * 0.75, now);
          master.connect(ctx.destination);
          this.masterGain = master;

          switch (this.currentSoundType) {
            case 'hilo':
              this.synthesizeHiLo(master);
              break;
            case 'beep':
              this.synthesizeDigitalBeep(master);
              break;
            case 'chime':
              this.synthesizeChime(master);
              break;
            case 'buzzer':
              this.synthesizeBuzzer(master);
              break;
            case 'wail':
            default:
              this.synthesizeWailSiren(master);
              break;
          }

          if (typeof onStateChange === 'function') {
            onStateChange({ blocked: false, isPlaying: true });
          }

          // Auto-stop setelah batas waktu (default 2 menit sesuai PRD)
          if (maxDurationSec > 0) {
            this.stopTimeout = setTimeout(() => {
              this.stop();
              if (typeof onAutoStop === 'function') onAutoStop();
            }, maxDurationSec * 1000);
          }
        } catch (err) {
          console.error('Audio synthesizer error:', err);
          this.audioBlocked = true;
          this.playFallbackSound(this.volume, maxDurationSec);
          if (typeof onStateChange === 'function') {
            onStateChange({ blocked: false, isPlaying: true });
          }
        }
      };

      if (!ctx) {
        // Fallback jika Web Audio API tidak didukung browser
        this.playFallbackSound(this.volume, maxDurationSec);
        if (typeof onStateChange === 'function') onStateChange({ blocked: false, isPlaying: true });
        return;
      }

      if (ctx.state === 'suspended') {
        ctx.resume().then(() => {
          this.audioUnlocked = true;
          this.audioBlocked = false;
          launchSynth();
        }).catch((err) => {
          console.warn('Autoplay dicegah oleh peramban:', err);
          this.audioBlocked = true;
          if (typeof onStateChange === 'function') {
            onStateChange({ blocked: true, isPlaying: false });
          }
        });
      } else {
        launchSynth();
      }
    }

    /**
     * Suara 1: Sirine Ayun Darurat (Wailing Siren)
     */
    synthesizeWailSiren(outputNode) {
      if (!this.audioCtx) return;
      const now = this.audioCtx.currentTime;

      const osc = this.audioCtx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(700, now);

      const lfo = this.audioCtx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(0.85, now); // Frekuensi ayunan 0.85 Hz (~1.2 detik/siklus)

      const lfoGain = this.audioCtx.createGain();
      lfoGain.gain.setValueAtTime(260, now); // Rentang 440 Hz s/d 960 Hz

      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);

      const filter = this.audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1800, now);

      osc.connect(filter);
      filter.connect(outputNode);

      lfo.start(now);
      osc.start(now);

      this.activeNodes.push(osc, lfo, lfoGain, filter);
    }

    /**
     * Suara 2: Sirine Dua Nada (Hi-Lo European Ambulance)
     */
    synthesizeHiLo(outputNode) {
      if (!this.audioCtx) return;
      const now = this.audioCtx.currentTime;

      const osc = this.audioCtx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, now);

      const filter = this.audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2000, now);

      osc.connect(filter);
      filter.connect(outputNode);
      osc.start(now);

      let isHigh = true;
      const interval = setInterval(() => {
        if (!this.isPlaying || !osc || !this.audioCtx) return;
        isHigh = !isHigh;
        const t = this.audioCtx.currentTime;
        try {
          osc.frequency.cancelScheduledValues(t);
          osc.frequency.setValueAtTime(isHigh ? 880 : 620, t);
        } catch (e) {}
      }, 450);

      this.activeNodes.push(osc, filter);
      this.activeIntervals.push(interval);
    }

    /**
     * Suara 3: Alarm Digital Beep Cepat (Beker Elektronik)
     */
    synthesizeDigitalBeep(outputNode) {
      if (!this.audioCtx) return;

      const playBeepBurst = () => {
        if (!this.isPlaying || !this.audioCtx) return;
        const now = this.audioCtx.currentTime;
        const pulses = 4;
        const dur = 0.07;
        const gap = 0.05;

        for (let i = 0; i < pulses; i++) {
          const t = now + i * (dur + gap);
          try {
            const osc = this.audioCtx.createOscillator();
            const g = this.audioCtx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(1250, t);

            g.gain.setValueAtTime(0.001, t);
            g.gain.linearRampToValueAtTime(0.65, t + 0.01);
            g.gain.exponentialRampToValueAtTime(0.001, t + dur);

            osc.connect(g);
            g.connect(outputNode);

            osc.start(t);
            osc.stop(t + dur);
            this.activeNodes.push(osc, g);
          } catch (e) {}
        }
      };

      playBeepBurst();
      const interval = setInterval(playBeepBurst, 900);
      this.activeIntervals.push(interval);
    }

    /**
     * Suara 4: Melodi Lonceng (Chime)
     */
    synthesizeChime(outputNode) {
      if (!this.audioCtx) return;
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5 - E5 - G5 - C6

      const playChimeSequence = () => {
        if (!this.isPlaying || !this.audioCtx) return;
        const now = this.audioCtx.currentTime;

        notes.forEach((freq, idx) => {
          const t = now + idx * 0.15;
          try {
            const osc = this.audioCtx.createOscillator();
            const g = this.audioCtx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, t);

            g.gain.setValueAtTime(0.001, t);
            g.gain.linearRampToValueAtTime(0.55, t + 0.02);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

            osc.connect(g);
            g.connect(outputNode);

            osc.start(t);
            osc.stop(t + 0.45);
            this.activeNodes.push(osc, g);
          } catch (e) {}
        });
      };

      playChimeSequence();
      const interval = setInterval(playChimeSequence, 1500);
      this.activeIntervals.push(interval);
    }

    /**
     * Suara 5: Klaxon / Buzzer Tegas
     */
    synthesizeBuzzer(outputNode) {
      if (!this.audioCtx) return;

      const playBuzzerPulse = () => {
        if (!this.isPlaying || !this.audioCtx) return;
        const now = this.audioCtx.currentTime;

        try {
          const osc1 = this.audioCtx.createOscillator();
          const osc2 = this.audioCtx.createOscillator();
          const g = this.audioCtx.createGain();

          osc1.type = 'sawtooth';
          osc1.frequency.setValueAtTime(240, now);
          osc2.type = 'square';
          osc2.frequency.setValueAtTime(246, now);

          g.gain.setValueAtTime(0.001, now);
          g.gain.linearRampToValueAtTime(0.5, now + 0.02);
          g.gain.linearRampToValueAtTime(0.5, now + 0.3);
          g.gain.linearRampToValueAtTime(0.001, now + 0.35);

          osc1.connect(g);
          osc2.connect(g);
          g.connect(outputNode);

          osc1.start(now);
          osc2.start(now);
          osc1.stop(now + 0.35);
          osc2.stop(now + 0.35);
          this.activeNodes.push(osc1, osc2, g);
        } catch (e) {}
      };

      playBuzzerPulse();
      const interval = setInterval(playBuzzerPulse, 650);
      this.activeIntervals.push(interval);
    }

    /**
     * Memutar berkas audio kustom pengguna
     */
    playCustomAudio(volume, maxDurationSec, onAutoStop, onStateChange) {
      if (this.customAudioEl) {
        try { this.customAudioEl.pause(); } catch (e) {}
      }

      this.customAudioEl = new Audio(this.customAudioDataUrl);
      this.customAudioEl.loop = true;
      this.customAudioEl.volume = Math.min(Math.max(volume, 0.05), 1.0);

      const playPromise = this.customAudioEl.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          this.isPlaying = true;
          this.audioBlocked = false;
          if (typeof onStateChange === 'function') onStateChange({ blocked: false, isPlaying: true });
        }).catch((err) => {
          console.warn('Autoplay dicegah oleh browser:', err);
          this.audioBlocked = true;
          if (typeof onStateChange === 'function') onStateChange({ blocked: true, isPlaying: false });
        });
      }

      if (maxDurationSec > 0) {
        this.stopTimeout = setTimeout(() => {
          this.stop();
          if (typeof onAutoStop === 'function') onAutoStop();
        }, maxDurationSec * 1000);
      }
    }

    /**
     * Fallback audio generator menggunakan WAV Data URL untuk keandalan 100%
     */
    playFallbackSound(volume, maxDurationSec) {
      try {
        if (!this.fallbackWavUrl) {
          this.fallbackWavUrl = this.generateSirenWavDataUrl();
        }
        if (this.fallbackAudioEl) {
          try { this.fallbackAudioEl.pause(); } catch (e) {}
        }
        this.fallbackAudioEl = new Audio(this.fallbackWavUrl);
        this.fallbackAudioEl.loop = true;
        this.fallbackAudioEl.volume = volume;
        this.fallbackAudioEl.play().catch(() => {});
        this.isPlaying = true;

        if (maxDurationSec > 0) {
          this.stopTimeout = setTimeout(() => {
            this.stop();
          }, maxDurationSec * 1000);
        }
      } catch (e) {}
    }

    generateSirenWavDataUrl() {
      const sampleRate = 22050;
      const duration = 1.2;
      const numSamples = Math.floor(sampleRate * duration);
      const buffer = new Uint8Array(44 + numSamples);

      buffer.set([0x52, 0x49, 0x46, 0x46]); // "RIFF"
      const fileSize = 36 + numSamples;
      buffer[4] = fileSize & 0xff;
      buffer[5] = (fileSize >> 8) & 0xff;
      buffer[6] = (fileSize >> 16) & 0xff;
      buffer[7] = (fileSize >> 24) & 0xff;
      buffer.set([0x57, 0x41, 0x56, 0x45], 8); // "WAVE"
      buffer.set([0x66, 0x6d, 0x74, 0x20], 12); // "fmt "
      buffer.set([16, 0, 0, 0], 16);
      buffer.set([1, 0], 20); // PCM
      buffer.set([1, 0], 22); // Mono
      buffer[24] = sampleRate & 0xff;
      buffer[25] = (sampleRate >> 8) & 0xff;
      buffer[26] = (sampleRate >> 16) & 0xff;
      buffer[27] = (sampleRate >> 24) & 0xff;
      buffer[28] = sampleRate & 0xff;
      buffer[29] = (sampleRate >> 8) & 0xff;
      buffer[30] = (sampleRate >> 16) & 0xff;
      buffer[31] = (sampleRate >> 24) & 0xff;
      buffer.set([1, 0], 32);
      buffer.set([8, 0], 34); // 8-bit
      buffer.set([0x64, 0x61, 0x74, 0x61], 36); // "data"
      buffer[40] = numSamples & 0xff;
      buffer[41] = (numSamples >> 8) & 0xff;
      buffer[42] = (numSamples >> 16) & 0xff;
      buffer[43] = (numSamples >> 24) & 0xff;

      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const freq = 650 + 250 * Math.sin(2 * Math.PI * (1 / duration) * t);
        const sample = Math.sin(2 * Math.PI * freq * t);
        buffer[44 + i] = Math.floor(128 + 95 * sample);
      }

      let bin = '';
      for (let i = 0; i < buffer.length; i++) {
        bin += String.fromCharCode(buffer[i]);
      }
      return 'data:audio/wav;base64,' + btoa(bin);
    }

    /**
     * Menghentikan suara seketika tanpa timeout tunda yang merusak
     */
    stop() {
      if (this.stopTimeout) {
        clearTimeout(this.stopTimeout);
        this.stopTimeout = null;
      }

      this.activeIntervals.forEach(id => clearInterval(id));
      this.activeIntervals = [];

      if (this.customAudioEl) {
        try {
          this.customAudioEl.pause();
          this.customAudioEl.currentTime = 0;
        } catch (e) {}
        this.customAudioEl = null;
      }

      if (this.fallbackAudioEl) {
        try {
          this.fallbackAudioEl.pause();
          this.fallbackAudioEl.currentTime = 0;
        } catch (e) {}
        this.fallbackAudioEl = null;
      }

      const nodes = this.activeNodes;
      this.activeNodes = [];

      const gain = this.masterGain;
      this.masterGain = null;
      this.isPlaying = false;

      if (gain && this.audioCtx) {
        try {
          const now = this.audioCtx.currentTime;
          gain.gain.cancelScheduledValues(now);
          gain.gain.setValueAtTime(0, now);
          gain.disconnect();
        } catch (e) {}
      }

      nodes.forEach(node => {
        try { if (node.stop) node.stop(); } catch (e) {}
        try { node.disconnect(); } catch (e) {}
      });
    }

    /**
     * Bunyi beep konfirmasi pendek saat tombol diklik
     */
    playBeep(freq = 880, duration = 0.12) {
      try {
        const ctx = this.initContext();
        if (!ctx) return;

        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        g.gain.setValueAtTime(0.3, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc.connect(g);
        g.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + duration);
      } catch (e) {}
    }
  }

  // Ekspor ke global window
  window.sirenPlayer = new SirenPlayer();

})(window);
