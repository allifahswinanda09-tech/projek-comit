/**
 * sound.js — Web Audio API Siren & Sound Synthesizer for JadwalSiaga
 * Fitur:
 * 1. Pilihan suara alarm bawaan:
 *    - 'wail': Sirine Ayun Peringatan Darurat
 *    - 'hilo': Sirine Dua Nada (Hi-Lo European)
 *    - 'beep': Alarm Digital Beep Cepat (Beker Elektronik)
 *    - 'chime': Lonceng Peringatan Melodik
 *    - 'buzzer': Klaxon / Buzzer Tegas
 * 2. Suara Kustom (Unggah Berkas Audio MP3/WAV/OGG oleh pengguna)
 * 3. Deteksi pemblokiran audio browser autoplay dengan status callback
 */

class SirenPlayer {
  constructor() {
    this.audioCtx = null;
    this.gainNode = null;
    this.isPlaying = false;
    this.stopTimeout = null;
    this.audioUnlocked = false;
    this.audioBlocked = false;

    // Active nodes / timers
    this.activeNodes = [];
    this.activeIntervals = [];

    // Custom audio element
    this.customAudioEl = null;
    this.customAudioDataUrl = null;
  }

  /**
   * Inisialisasi AudioContext saat interaksi pengguna
   */
  initContext() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().then(() => {
        this.audioUnlocked = true;
        this.audioBlocked = false;
      }).catch(() => {
        this.audioBlocked = true;
      });
    } else if (this.audioCtx && this.audioCtx.state === 'running') {
      this.audioUnlocked = true;
      this.audioBlocked = false;
    }
    return this.audioCtx;
  }

  isAudioReady() {
    return !!(this.audioCtx && this.audioCtx.state === 'running' && !this.audioBlocked);
  }

  setCustomAudioDataUrl(dataUrl) {
    this.customAudioDataUrl = dataUrl;
  }

  /**
   * Memulai suara alarm
   * @param {number} volume - Volume antara 0.0 s/d 1.0
   * @param {number} maxDurationSec - Batas waktu dalam detik (default 120 detik)
   * @param {string} soundType - 'wail' | 'hilo' | 'beep' | 'chime' | 'buzzer' | 'custom'
   * @param {Function} onAutoStop - Callback saat durasi maksimal tercapai
   * @param {Function} onPlayStateChange - Callback jika audio terblokir oleh browser
   */
  start(volume = 0.8, maxDurationSec = 120, soundType = 'wail', onAutoStop = null, onPlayStateChange = null) {
    if (this.isPlaying) return;

    this.initContext();

    // Jika AudioContext masih suspended atau belum diizinkan interaksi
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioBlocked = true;
      if (typeof onPlayStateChange === 'function') {
        onPlayStateChange({ blocked: true, isPlaying: false });
      }
    }

    try {
      // 1. Jika pengguna memilih suara kustom dan ada berkas audio
      if (soundType === 'custom' && this.customAudioDataUrl) {
        this.playCustomAudio(volume, maxDurationSec, onAutoStop, onPlayStateChange);
        return;
      }

      if (!this.audioCtx) {
        if (typeof onPlayStateChange === 'function') onPlayStateChange({ blocked: true });
        return;
      }

      const now = this.audioCtx.currentTime;
      const targetGain = Math.min(Math.max(volume, 0.05), 1.0) * 0.75;

      this.gainNode = this.audioCtx.createGain();
      this.gainNode.gain.setValueAtTime(0.001, now);
      this.gainNode.gain.linearRampToValueAtTime(targetGain, now + 0.15);
      this.gainNode.connect(this.audioCtx.destination);

      // Jalankan generator suara sintetis sesuai pilihan
      switch (soundType) {
        case 'hilo':
          this.synthesizeHiLo(filterNode(this.audioCtx, this.gainNode));
          break;
        case 'beep':
          this.synthesizeDigitalBeep(this.gainNode);
          break;
        case 'chime':
          this.synthesizeChime(this.gainNode);
          break;
        case 'buzzer':
          this.synthesizeBuzzer(this.gainNode);
          break;
        case 'wail':
        default:
          this.synthesizeWailSiren(filterNode(this.audioCtx, this.gainNode));
          break;
      }

      this.isPlaying = true;
      if (typeof onPlayStateChange === 'function') {
        onPlayStateChange({ blocked: this.audioBlocked, isPlaying: true });
      }

      // Auto stop setelah batas waktu maksimal (2 menit sesuai PRD Bagian 7)
      if (this.stopTimeout) clearTimeout(this.stopTimeout);
      if (maxDurationSec > 0) {
        this.stopTimeout = setTimeout(() => {
          this.stop();
          if (typeof onAutoStop === 'function') onAutoStop();
        }, maxDurationSec * 1000);
      }
    } catch (e) {
      console.error('Error saat memulai suara alarm:', e);
      this.audioBlocked = true;
      if (typeof onPlayStateChange === 'function') onPlayStateChange({ blocked: true, isPlaying: false });
    }
  }

  /**
   * Suara 1: Sirine Ayun Peringatan Darurat (Wail Siren)
   */
  synthesizeWailSiren(outputNode) {
    const now = this.audioCtx.currentTime;

    const osc = this.audioCtx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(750, now);

    const lfo = this.audioCtx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.75, now);

    const lfoGain = this.audioCtx.createGain();
    lfoGain.gain.setValueAtTime(280, now);

    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    osc.connect(outputNode);

    lfo.start(now);
    osc.start(now);

    this.activeNodes.push(osc, lfo, lfoGain);
  }

  /**
   * Suara 2: Sirine Dua Nada (Hi-Lo European)
   */
  synthesizeHiLo(outputNode) {
    const now = this.audioCtx.currentTime;

    const osc = this.audioCtx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(880, now);
    osc.connect(outputNode);
    osc.start(now);

    let isHigh = true;
    const interval = setInterval(() => {
      if (!osc || !this.audioCtx) return;
      const curr = this.audioCtx.currentTime;
      isHigh = !isHigh;
      osc.frequency.cancelScheduledValues(curr);
      osc.frequency.setValueAtTime(isHigh ? 880 : 620, curr);
    }, 480);

    this.activeNodes.push(osc);
    this.activeIntervals.push(interval);
  }

  /**
   * Suara 3: Alarm Digital Beep Cepat (Beker Elektronik)
   */
  synthesizeDigitalBeep(outputNode) {
    const playPulseGroup = () => {
      if (!this.isPlaying || !this.audioCtx) return;
      const now = this.audioCtx.currentTime;
      const pulses = 4;
      const pulseDuration = 0.08;
      const gap = 0.06;

      for (let i = 0; i < pulses; i++) {
        const start = now + i * (pulseDuration + gap);
        const osc = this.audioCtx.createOscillator();
        const g = this.audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, start);

        g.gain.setValueAtTime(0.001, start);
        g.gain.linearRampToValueAtTime(0.6, start + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, start + pulseDuration);

        osc.connect(g);
        g.connect(outputNode);

        osc.start(start);
        osc.stop(start + pulseDuration);
      }
    };

    playPulseGroup();
    const interval = setInterval(playPulseGroup, 950);
    this.activeIntervals.push(interval);
  }

  /**
   * Suara 4: Lonceng Peringatan Melodik (Alert Chime)
   */
  synthesizeChime(outputNode) {
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    const playMelody = () => {
      if (!this.isPlaying || !this.audioCtx) return;
      const now = this.audioCtx.currentTime;

      notes.forEach((freq, idx) => {
        const start = now + idx * 0.16;
        const osc = this.audioCtx.createOscillator();
        const g = this.audioCtx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);

        g.gain.setValueAtTime(0.001, start);
        g.gain.linearRampToValueAtTime(0.5, start + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, start + 0.45);

        osc.connect(g);
        g.connect(outputNode);

        osc.start(start);
        osc.stop(start + 0.45);
      });
    };

    playMelody();
    const interval = setInterval(playMelody, 1600);
    this.activeIntervals.push(interval);
  }

  /**
   * Suara 5: Klaxon / Buzzer Peringatan
   */
  synthesizeBuzzer(outputNode) {
    const playBuzz = () => {
      if (!this.isPlaying || !this.audioCtx) return;
      const now = this.audioCtx.currentTime;

      const osc1 = this.audioCtx.createOscillator();
      const osc2 = this.audioCtx.createOscillator();
      const g = this.audioCtx.createGain();

      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(260, now);
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(265, now);

      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.5, now + 0.02);
      g.gain.linearRampToValueAtTime(0.5, now + 0.35);
      g.gain.linearRampToValueAtTime(0.001, now + 0.38);

      osc1.connect(g);
      osc2.connect(g);
      g.connect(outputNode);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.38);
      osc2.stop(now + 0.38);
    };

    playBuzz();
    const interval = setInterval(playBuzz, 700);
    this.activeIntervals.push(interval);
  }

  /**
   * Memutar berkas audio kustom pengguna
   */
  playCustomAudio(volume, maxDurationSec, onAutoStop, onPlayStateChange) {
    if (this.customAudioEl) {
      try { this.customAudioEl.pause(); } catch(e){}
    }

    this.customAudioEl = new Audio(this.customAudioDataUrl);
    this.customAudioEl.loop = true;
    this.customAudioEl.volume = Math.min(Math.max(volume, 0.05), 1.0);

    const playPromise = this.customAudioEl.play();
    if (playPromise !== undefined) {
      playPromise.then(() => {
        this.isPlaying = true;
        this.audioBlocked = false;
        if (typeof onPlayStateChange === 'function') onPlayStateChange({ blocked: false, isPlaying: true });
      }).catch((err) => {
        console.warn('Autoplay audio kustom dicegah:', err);
        this.audioBlocked = true;
        if (typeof onPlayStateChange === 'function') onPlayStateChange({ blocked: true, isPlaying: false });
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
   * Menghentikan suara seketika
   */
  stop() {
    if (this.stopTimeout) {
      clearTimeout(this.stopTimeout);
      this.stopTimeout = null;
    }

    // Bersihkan intervals
    this.activeIntervals.forEach(id => clearInterval(id));
    this.activeIntervals = [];

    // Hentikan custom audio
    if (this.customAudioEl) {
      try {
        this.customAudioEl.pause();
        this.customAudioEl.currentTime = 0;
      } catch (e) {}
      this.customAudioEl = null;
    }

    try {
      if (this.gainNode && this.audioCtx) {
        const now = this.audioCtx.currentTime;
        this.gainNode.gain.cancelScheduledValues(now);
        this.gainNode.gain.linearRampToValueAtTime(0.001, now + 0.12);

        setTimeout(() => {
          this.activeNodes.forEach(node => {
            try { if (node.stop) node.stop(); } catch(e){}
            try { node.disconnect(); } catch(e){}
          });
          this.activeNodes = [];

          if (this.gainNode) {
            try { this.gainNode.disconnect(); } catch(e){}
            this.gainNode = null;
          }
          this.isPlaying = false;
        }, 130);
      } else {
        this.isPlaying = false;
      }
    } catch (e) {
      this.isPlaying = false;
    }
  }

  /**
   * Beep konfirmasi
   */
  playBeep(freq = 880, duration = 0.15) {
    try {
      this.initContext();
      if (!this.audioCtx) return;

      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + duration);
    } catch (e) {}
  }
}

function filterNode(audioCtx, destination) {
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(2100, audioCtx.currentTime);
  filter.Q.setValueAtTime(2, audioCtx.currentTime);
  filter.connect(destination);
  return filter;
}

export const sirenPlayer = new SirenPlayer();
