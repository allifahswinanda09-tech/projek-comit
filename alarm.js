/**
 * alarm.js — Alarm Manager & Gesture Controller for JadwalSiaga
 * Mengelola deteksi pengingat, gestur geser ke atas (swipe-up),
 * pemutaran jenis suara alarm yang dapat diganti (PRD Bagian 7 Poin 5),
 * serta opsi mengaktifkan suara jika audio tertahan oleh browser (PRD Bagian 7 Poin 4).
 */

import { sirenPlayer } from './sound.js';

export class AlarmManager {
  constructor(options = {}) {
    this.events = [];
    this.settings = {
      soundEnabled: true,
      soundType: 'wail', // 'wail' | 'hilo' | 'beep' | 'chime' | 'buzzer' | 'custom'
      sirenVolume: 0.8,
      maxSirenDuration: 120,
      notificationsEnabled: false
    };
    
    this.dismissedAlarms = new Set();
    this.snoozedAlarms = new Map();
    this.loadDismissedAlarms();

    this.activeAlarmEvent = null;
    this.isAlarmOverlayVisible = false;
    this.checkIntervalId = null;

    // DOM Elements
    this.overlayEl = null;
    this.cardEl = null;
    this.swipeHandleEl = null;
    this.dismissBtnEl = null;
    this.snoozeBtnEl = null;
    this.enableSoundBtnEl = null; // PRD Bagian 7 Poin 4
    this.titleEl = null;
    this.infoEl = null;
    this.badgeEl = null;
    this.repeatBadgeEl = null;
    this.soundNameBadgeEl = null; // PRD Bagian 7 Poin 5

    // Gesture tracking variables
    this.startY = 0;
    this.currentY = 0;
    this.isDragging = false;
    this.dragStartTime = 0;

    // Callbacks
    this.onAlarmTriggered = options.onAlarmTriggered || null;
    this.onAlarmDismissed = options.onAlarmDismissed || null;

    this.initDOM();
    this.startChecking();
  }

  loadDismissedAlarms() {
    try {
      const stored = sessionStorage.getItem('jadwalsiaga_dismissed_alarms');
      if (stored) {
        this.dismissedAlarms = new Set(JSON.parse(stored));
      }
    } catch (e) {}
  }

  saveDismissedAlarms() {
    try {
      sessionStorage.setItem('jadwalsiaga_dismissed_alarms', JSON.stringify([...this.dismissedAlarms]));
    } catch (e) {}
  }

  updateEvents(events) {
    this.events = events || [];
  }

  updateSettings(settings) {
    this.settings = { ...this.settings, ...settings };
  }

  initDOM() {
    this.overlayEl = document.getElementById('alarmOverlay');
    this.cardEl = document.getElementById('alarmCard');
    this.swipeHandleEl = document.getElementById('alarmSwipeHandle');
    this.dismissBtnEl = document.getElementById('btnDismissAlarm');
    this.snoozeBtnEl = document.getElementById('btnSnoozeAlarm');
    this.enableSoundBtnEl = document.getElementById('btnEnableAlarmSound'); // PRD Bagian 7 Poin 4
    this.titleEl = document.getElementById('alarmEventTitle');
    this.infoEl = document.getElementById('alarmEventInfo');
    this.badgeEl = document.getElementById('alarmEventBadge');
    this.repeatBadgeEl = document.getElementById('alarmEventRepeatBadge');
    this.soundNameBadgeEl = document.getElementById('alarmSoundNameBadge'); // PRD Bagian 7 Poin 5

    if (!this.overlayEl) return;

    // Touch event listeners for swipe up
    this.overlayEl.addEventListener('touchstart', (e) => this.handleDragStart(e), { passive: true });
    this.overlayEl.addEventListener('touchmove', (e) => this.handleDragMove(e), { passive: false });
    this.overlayEl.addEventListener('touchend', (e) => this.handleDragEnd(e));
    this.overlayEl.addEventListener('touchcancel', (e) => this.handleDragEnd(e));

    // Mouse event listeners for swipe up on desktop
    this.overlayEl.addEventListener('mousedown', (e) => this.handleDragStart(e));
    window.addEventListener('mousemove', (e) => this.handleDragMove(e));
    window.addEventListener('mouseup', (e) => this.handleDragEnd(e));

    // Tombol alternatif aksesibilitas
    if (this.dismissBtnEl) {
      this.dismissBtnEl.addEventListener('click', () => {
        this.dismissCurrentAlarm();
      });
    }

    // Tombol Tunda Alarm (Snooze 5 Menit)
    if (this.snoozeBtnEl) {
      this.snoozeBtnEl.addEventListener('click', () => {
        this.snoozeCurrentAlarm(5);
      });
    }

    // PRD Bagian 7 Poin 4: Tombol opsi mengaktifkan suara jika peramban menahan autoplay
    if (this.enableSoundBtnEl) {
      this.enableSoundBtnEl.addEventListener('click', () => {
        this.activateAlarmSound();
      });
    }

    // Keyboard accessibility: ESC or Space or Enter to dismiss
    window.addEventListener('keydown', (e) => {
      if (this.isAlarmOverlayVisible) {
        if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          this.dismissCurrentAlarm();
        }
      }
    });
  }

  startChecking() {
    if (this.checkIntervalId) clearInterval(this.checkIntervalId);
    this.checkIntervalId = setInterval(() => {
      this.checkAlarms();
    }, 1000);
  }

  stopChecking() {
    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
      this.checkIntervalId = null;
    }
  }

  isEventOccurringOnDate(event, dateObj) {
    if (!event.date) return false;
    const eventStartDate = new Date(event.date + 'T00:00:00');
    const targetDate = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());

    if (targetDate.getTime() < eventStartDate.getTime()) {
      return false;
    }

    const repeat = event.repeat || 'none';
    if (repeat === 'none') {
      const targetStr = this.formatDateISO(targetDate);
      return event.date === targetStr;
    }

    if (repeat === 'daily') {
      return true;
    }

    if (repeat === 'weekdays') {
      const day = targetDate.getDay();
      return day >= 1 && day <= 5;
    }

    if (repeat === 'weekly') {
      return eventStartDate.getDay() === targetDate.getDay();
    }

    return false;
  }

  checkAlarms() {
    if (this.isAlarmOverlayVisible) return;

    const now = new Date();
    const nowMs = now.getTime();
    const todayStr = this.formatDateISO(now);

    for (const ev of this.events) {
      if (ev.completed) continue;
      if (!this.isEventOccurringOnDate(ev, now)) continue;
      if (!ev.startTime) continue;

      const dismissKey = `${ev.id}_${todayStr}`;
      if (this.dismissedAlarms.has(dismissKey) || this.dismissedAlarms.has(ev.id)) continue;

      const snoozedUntil = this.snoozedAlarms.get(ev.id);
      if (snoozedUntil && nowMs < snoozedUntil) {
        continue;
      }

      const eventStart = new Date(`${todayStr}T${ev.startTime}:00`);
      const eventStartMs = eventStart.getTime();
      if (isNaN(eventStartMs)) continue;

      const durationMs = (ev.durationMinutes || 60) * 60 * 1000;
      const eventEndMs = eventStartMs + durationMs;

      const reminderMinutes = ev.reminderMinutes !== undefined ? parseInt(ev.reminderMinutes, 10) : 10;
      const reminderMs = eventStartMs - (reminderMinutes * 60 * 1000);

      if (nowMs >= reminderMs && nowMs <= Math.min(eventEndMs, eventStartMs + 15 * 60 * 1000)) {
        this.triggerAlarm(ev, reminderMinutes, eventStart);
        break;
      }
    }
  }

  triggerAlarm(event, reminderMinutes, eventStart) {
    this.activeAlarmEvent = event;
    this.isAlarmOverlayVisible = true;

    const now = new Date();
    const diffMinutes = Math.round((eventStart.getTime() - now.getTime()) / 60000);

    let countdownText = '';
    if (diffMinutes > 0) {
      countdownText = `Jadwal dimulai dalam ${diffMinutes} menit (${event.startTime})`;
    } else if (diffMinutes === 0) {
      countdownText = `Jadwal sedang dimulai sekarang (${event.startTime})!`;
    } else {
      countdownText = `Jadwal telah dimulai ${Math.abs(diffMinutes)} menit yang lalu (${event.startTime})`;
    }

    if (this.titleEl) this.titleEl.textContent = event.title || 'Kegiatan';
    if (this.infoEl) this.infoEl.textContent = countdownText;
    
    if (this.badgeEl) {
      const categoryMap = {
        kuliah: 'Kuliah',
        sekolah: 'Sekolah',
        kerja: 'Kerja',
        lainnya: 'Lainnya'
      };
      this.badgeEl.textContent = categoryMap[event.category] || (event.category || 'Jadwal');
      this.badgeEl.className = `alarm-event-badge cat-badge-${event.category || 'lainnya'}`;
    }

    if (this.repeatBadgeEl) {
      const repeatMap = {
        daily: '🔁 Setiap Hari',
        weekdays: '🔁 Senin - Jumat',
        weekly: '🔁 Setiap Minggu',
        none: ''
      };
      const text = repeatMap[event.repeat] || '';
      this.repeatBadgeEl.textContent = text;
      this.repeatBadgeEl.style.display = text ? 'inline-block' : 'none';
    }

    // PRD Bagian 7 Poin 5: Tampilkan nama suara alarm yang sedang aktif
    const soundType = event.soundType || this.settings.soundType || 'wail';
    const soundNames = {
      wail: '🔊 Sirine Ayun',
      hilo: '🔊 Dua Nada (Hi-Lo)',
      beep: '🔊 Beep Elektronik',
      chime: '🔊 Melodi Chime',
      buzzer: '🔊 Buzzer',
      custom: '🔊 Audio Kustom'
    };
    if (this.soundNameBadgeEl) {
      this.soundNameBadgeEl.textContent = soundNames[soundType] || '🔊 Sirine';
      this.soundNameBadgeEl.style.display = 'inline-block';
    }

    // Reset posisi kartu
    if (this.cardEl) {
      this.cardEl.style.transform = 'translateY(0px)';
      this.cardEl.style.transition = 'none';
      this.cardEl.style.opacity = '1';
    }

    // Tampilkan overlay
    if (this.overlayEl) {
      this.overlayEl.classList.remove('hidden');
      this.overlayEl.setAttribute('aria-hidden', 'false');
      setTimeout(() => {
        if (this.dismissBtnEl) this.dismissBtnEl.focus();
      }, 80);
    }

    // PRD Bagian 7 Poin 4: Periksa & Jalankan Suara Alarm
    if (this.settings.soundEnabled) {
      sirenPlayer.start(
        this.settings.sirenVolume || 0.8,
        this.settings.maxSirenDuration || 120,
        soundType,
        () => {},
        (state) => {
          // Callback jika browser menolak pemutaran audio otomatis
          if (this.enableSoundBtnEl) {
            if (state && state.blocked) {
              this.enableSoundBtnEl.classList.remove('hidden');
            } else {
              this.enableSoundBtnEl.classList.add('hidden');
            }
          }
        }
      );
    } else {
      // Jika suara sengaja dibisukan pengguna di pengaturan
      if (this.enableSoundBtnEl) {
        this.enableSoundBtnEl.classList.remove('hidden');
        this.enableSoundBtnEl.textContent = '🔊 Suara Dibisukan — Klik untuk Bunyikan';
      }
    }

    // Tampilkan notifikasi sistem jika didukung
    this.showSystemNotification(event, countdownText);

    if (typeof this.onAlarmTriggered === 'function') {
      this.onAlarmTriggered(event);
    }
  }

  /**
   * Mengaktifkan suara alarm saat tombol di layar alarm diklik (PRD Bagian 7 Poin 4)
   */
  activateAlarmSound() {
    const soundType = (this.activeAlarmEvent && this.activeAlarmEvent.soundType) || this.settings.soundType || 'wail';
    sirenPlayer.initContext();
    sirenPlayer.start(
      this.settings.sirenVolume || 0.8,
      this.settings.maxSirenDuration || 120,
      soundType
    );
    if (this.enableSoundBtnEl) {
      this.enableSoundBtnEl.classList.add('hidden');
    }
  }

  showSystemNotification(event, message) {
    if ('Notification' in window && Notification.permission === 'granted' && this.settings.notificationsEnabled) {
      try {
        const notif = new Notification(`🚨 Peringatan: ${event.title}`, {
          body: message + (event.notes ? `\nCatatan: ${event.notes}` : ''),
          icon: 'icon.svg',
          requireInteraction: true,
          tag: 'jadwalsiaga-alarm-' + event.id
        });

        notif.onclick = () => {
          window.focus();
          notif.close();
        };
      } catch (e) {
        console.warn('Gagal menampilkan notifikasi sistem:', e);
      }
    }
  }

  handleDragStart(e) {
    if (!this.isAlarmOverlayVisible) return;
    if (e.target && (e.target.closest('#btnDismissAlarm') || e.target.closest('#btnSnoozeAlarm') || e.target.closest('#btnEnableAlarmSound'))) return;

    this.isDragging = true;
    this.dragStartTime = Date.now();
    const clientY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY;
    this.startY = clientY;
    this.currentY = clientY;

    if (this.cardEl) {
      this.cardEl.style.transition = 'none';
    }
  }

  handleDragMove(e) {
    if (!this.isDragging || !this.isAlarmOverlayVisible) return;

    const clientY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY;
    this.currentY = clientY;
    const deltaY = this.currentY - this.startY;

    if (deltaY < 0) {
      if (e.cancelable) e.preventDefault();
      const translateY = deltaY;
      const opacity = Math.max(0.15, 1 - Math.abs(deltaY) / 360);

      if (this.cardEl) {
        this.cardEl.style.transform = `translateY(${translateY}px)`;
        this.cardEl.style.opacity = opacity;
      }
    }
  }

  handleDragEnd(e) {
    if (!this.isDragging) return;
    this.isDragging = false;

    const deltaY = this.currentY - this.startY;
    const dragDuration = Date.now() - this.dragStartTime;
    const isFlickUp = deltaY < -60 && dragDuration < 280;
    const isDraggedFarEnough = deltaY < -110;

    if (isFlickUp || isDraggedFarEnough) {
      if (this.cardEl) {
        this.cardEl.style.transition = 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.25s ease';
        this.cardEl.style.transform = 'translateY(-100vh)';
        this.cardEl.style.opacity = '0';
      }

      setTimeout(() => {
        this.dismissCurrentAlarm();
      }, 230);
    } else {
      if (this.cardEl) {
        this.cardEl.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease';
        this.cardEl.style.transform = 'translateY(0px)';
        this.cardEl.style.opacity = '1';
      }
    }
  }

  snoozeCurrentAlarm(minutes = 5) {
    sirenPlayer.stop();

    const currentEvent = this.activeAlarmEvent;
    if (currentEvent) {
      const snoozeUntil = Date.now() + (minutes * 60 * 1000);
      this.snoozedAlarms.set(currentEvent.id, snoozeUntil);
    }

    this.closeOverlay();

    if (typeof this.onAlarmDismissed === 'function' && currentEvent) {
      this.onAlarmDismissed({ ...currentEvent, snoozed: true, snoozeMinutes: minutes });
    }
  }

  dismissCurrentAlarm() {
    sirenPlayer.stop();

    const dismissedEvent = this.activeAlarmEvent;
    if (dismissedEvent && dismissedEvent.id) {
      const todayStr = this.formatDateISO(new Date());
      this.dismissedAlarms.add(`${dismissedEvent.id}_${todayStr}`);
      this.dismissedAlarms.add(dismissedEvent.id);
      this.snoozedAlarms.delete(dismissedEvent.id);
      this.saveDismissedAlarms();
    }

    this.closeOverlay();

    if (typeof this.onAlarmDismissed === 'function' && dismissedEvent) {
      this.onAlarmDismissed(dismissedEvent);
    }
  }

  closeOverlay() {
    this.isAlarmOverlayVisible = false;
    this.activeAlarmEvent = null;

    if (this.overlayEl) {
      this.overlayEl.classList.add('hidden');
      this.overlayEl.setAttribute('aria-hidden', 'true');
    }

    if (this.cardEl) {
      this.cardEl.style.transform = 'translateY(0px)';
      this.cardEl.style.opacity = '1';
      this.cardEl.style.transition = 'none';
    }

    if (this.enableSoundBtnEl) {
      this.enableSoundBtnEl.classList.add('hidden');
    }
  }

  resetDismissed(eventId) {
    const todayStr = this.formatDateISO(new Date());
    this.dismissedAlarms.delete(`${eventId}_${todayStr}`);
    this.dismissedAlarms.delete(eventId);
    this.snoozedAlarms.delete(eventId);
    this.saveDismissedAlarms();
  }

  getAlarmStatusForEvent(event) {
    if (event.completed) {
      return { code: 'completed', label: '✓ Selesai', colorClass: 'status-completed' };
    }

    const todayStr = this.formatDateISO(new Date());
    const isToday = this.isEventOccurringOnDate(event, new Date());

    if (!isToday && event.date < todayStr && (!event.repeat || event.repeat === 'none')) {
      return { code: 'passed', label: '⏱️ Lewat', colorClass: 'status-passed' };
    }

    if (this.activeAlarmEvent && this.activeAlarmEvent.id === event.id) {
      return { code: 'active', label: '🚨 Berbunyi', colorClass: 'status-active' };
    }

    const dismissKey = `${event.id}_${todayStr}`;
    if (this.dismissedAlarms.has(dismissKey) || this.dismissedAlarms.has(event.id)) {
      return { code: 'dismissed', label: '🔕 Alarm Dihentikan', colorClass: 'status-dismissed' };
    }

    const snoozedUntil = this.snoozedAlarms.get(event.id);
    if (snoozedUntil && Date.now() < snoozedUntil) {
      const remainingMin = Math.ceil((snoozedUntil - Date.now()) / 60000);
      return { code: 'snoozed', label: `⏱️ Ditunda (${remainingMin}m)`, colorClass: 'status-snoozed' };
    }

    return { code: 'ready', label: '🔔 Alarm Siaga', colorClass: 'status-ready' };
  }

  formatDateISO(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
