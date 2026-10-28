/**
 * app.js — Main Application Controller for JadwalSiaga
 * Bekerja tanpa modul (CORS-free) sehingga dapat berjalan langsung di file:// dan http://.
 * Mengontrol logika antarmuka, navigasi tab, kalender, WatchClockCard,
 * deteksi konflik jadwal, pencarian, jadwal berulang (F-14),
 * Modal Pengganti Suara Alarm (PRD Bagian 7 Poin 5) dengan pratinjau audio instan & upload kustom,
 * serta Progressive Web App (PWA) installation, offline sync, dan Service Worker registration.
 */

(function(window) {
  'use strict';

  const getDB = () => window.JadwalSiagaDB || {};
  const getAllEvents = (args) => (getDB().getAllEvents ? getDB().getAllEvents(args) : Promise.resolve([]));
  const saveEvent = (args) => (getDB().saveEvent ? getDB().saveEvent(args) : Promise.resolve(args));
  const deleteEvent = (args) => (getDB().deleteEvent ? getDB().deleteEvent(args) : Promise.resolve(true));
  const clearAllEvents = () => (getDB().clearAllEvents ? getDB().clearAllEvents() : Promise.resolve(true));
  const getSettings = () => (getDB().getSettings ? getDB().getSettings() : Promise.resolve(null));
  const saveSettings = (args) => (getDB().saveSettings ? getDB().saveSettings(args) : Promise.resolve(args));
  const saveCustomAudio = (d, f) => (getDB().saveCustomAudio ? getDB().saveCustomAudio(d, f) : Promise.resolve(true));
  const getCustomAudio = () => (getDB().getCustomAudio ? getDB().getCustomAudio() : Promise.resolve(null));
  const deleteCustomAudio = () => (getDB().deleteCustomAudio ? getDB().deleteCustomAudio() : Promise.resolve(true));

  const getSirenPlayer = () => window.sirenPlayer;
  const getAlarmManagerClass = () => window.AlarmManager;

class App {
  constructor() {
    this.events = [];
    this.settings = {
      soundEnabled: true,
      soundType: 'wail',
      sirenVolume: 0.8,
      clockVariant: 'orange',
      defaultReminder: 10,
      maxSirenDuration: 120,
      notificationsEnabled: false,
      customSoundName: ''
    };
    this.activeTab = 'agenda';
    this.activeCategoryFilter = 'all';
    this.searchQuery = '';
    
    // Kalender state
    this.currentCalendarDate = new Date();
    this.selectedCalendarDate = new Date();

    // Form editing state
    this.editingEventId = null;

    // Sound picker state
    this.soundPickerTarget = 'global'; // 'global' | 'event'
    this.selectedSoundInPicker = 'wail';
    this.previewTimeoutId = null;
    this.currentlyPreviewingSound = null;

    // PWA state
    this.deferredInstallPrompt = null;
    this.isAppInstalled = false;

    // Inisialisasi Alarm Manager dengan fail-safe
    const AlarmClass = getAlarmManagerClass();
    if (AlarmClass) {
      this.alarmManager = new AlarmClass({
        onAlarmTriggered: (event) => {
          this.renderAgenda();
        },
        onAlarmDismissed: (event) => {
          if (event && event.snoozed) {
            this.showToast(`Alarm "${event.title}" ditunda selama ${event.snoozeMinutes} menit.`);
          } else if (event) {
            this.showToast(`Alarm "${event.title}" telah dihentikan.`);
          }
          this.renderAgenda();
        }
      });
    } else {
      this.alarmManager = {
        updateEvents: () => {},
        updateSettings: () => {},
        isEventOccurringOnDate: () => false,
        getAlarmStatusForEvent: () => ({ code: 'ready', label: '🔔 Siaga', colorClass: 'status-ready' }),
        triggerAlarm: () => {},
        resetDismissed: () => {}
      };
    }

    this.init();
  }

  async init() {
    // 1. Setup DOM Listeners & Clock SEGERA (interaktif 100% tanpa menunggu database)
    this.setupEventListeners();
    this.setupSoundPickerModal();
    this.setupPwaFeatures();
    this.startWatchClock();

    // 2. Varian jam awal & label suara awal
    this.applyClockVariant(this.settings.clockVariant || 'orange');
    this.updateSoundDisplayUI(this.settings.soundType || 'wail');

    // 3. Muat Pengaturan dari Penyimpanan Lokal
    try {
      const savedSettings = await getSettings();
      if (savedSettings) {
        this.settings = { ...this.settings, ...savedSettings };
      }
    } catch (e) {
      console.warn('Gagal memuat preferensi pengguna:', e);
    }
    this.alarmManager.updateSettings(this.settings);
    this.applyClockVariant(this.settings.clockVariant || 'orange');

    // 4. Muat Berkas Audio Kustom
    try {
      const customAudioData = await getCustomAudio();
      const player = getSirenPlayer();
      if (customAudioData && customAudioData.dataUrl && player) {
        player.setCustomAudioDataUrl(customAudioData.dataUrl);
        this.updateCustomSoundUI(customAudioData.fileName);
      }
    } catch (e) {}

    // 5. Muat Data Jadwal (Events)
    try {
      this.events = await getAllEvents();
      if (!this.events || this.events.length === 0) {
        await this.seedSampleEvents();
        this.events = await getAllEvents();
      }
    } catch (e) {
      console.warn('Gagal memuat jadwal dari database:', e);
      this.events = [];
    }
    this.alarmManager.updateEvents(this.events);

    // 6. Render Tampilan Awal
    this.renderCurrentView();
    this.updateSoundDisplayUI(this.settings.soundType || 'wail');
    this.checkAudioState();
    this.updateNotificationPermissionStatus();
    this.updateStats();

    // 7. Evaluasi URL Parameters dari PWA Shortcuts
    this.handleUrlParameters();
  }

  /**
   * Evaluasi URL Query Params dari PWA App Shortcuts
   */
  handleUrlParameters() {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    const tab = params.get('tab');

    if (tab && ['agenda', 'kalender', 'pengaturan'].includes(tab)) {
      this.switchTab(tab);
    }

    if (action === 'new') {
      setTimeout(() => this.openEventModal(), 200);
    } else if (action === 'sound') {
      setTimeout(() => this.openSoundPickerModal('global', this.settings.soundType || 'wail'), 200);
    }
  }

  /**
   * Setup Dukungan Progressive Web App (PWA)
   */
  setupPwaFeatures() {
    const pwaBanner = document.getElementById('pwaInstallBanner');
    const btnInstallBanner = document.getElementById('btnInstallPwaBanner');
    const btnDismissBanner = document.getElementById('btnDismissPwaBanner');
    const btnInstallSettings = document.getElementById('btnInstallPwaSettings');
    const pwaStatusText = document.getElementById('pwaStatusText');
    const offlineBanner = document.getElementById('offlineBanner');

    // Cek apakah sedang berjalan dalam mode standalone PWA
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (isStandalone) {
      this.isAppInstalled = true;
      if (pwaStatusText) pwaStatusText.textContent = '✓ Terpasang (Mode Standalone PWA)';
      if (btnInstallSettings) {
        btnInstallSettings.disabled = true;
        btnInstallSettings.textContent = '✓ Aplikasi Terpasang';
      }
      if (pwaBanner) pwaBanner.classList.add('hidden');
    } else {
      if (pwaStatusText) pwaStatusText.textContent = 'Dapat dipasang di Layar Beranda / Desktop';
    }

    // Tangkap event sebelum instalasi muncul (Chromium / Edge / Android)
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredInstallPrompt = e;

      // Tampilkan banner instalasi jika belum pernah ditutup di sesi ini
      if (!sessionStorage.getItem('pwa_banner_dismissed') && !this.isAppInstalled) {
        if (pwaBanner) pwaBanner.classList.remove('hidden');
      }

      if (btnInstallSettings) {
        btnInstallSettings.disabled = false;
        btnInstallSettings.textContent = '📲 Pasang Sekarang';
      }
      if (pwaStatusText) {
        pwaStatusText.textContent = 'Siap dipasang sebagai aplikasi';
        pwaStatusText.style.color = 'var(--color-cyan)';
      }
    });

    const triggerInstall = async () => {
      if (!this.deferredInstallPrompt) {
        alert('Untuk memasang aplikasi:\n- Di HP: Tekan menu browser (titik tiga) lalu pilih "Tambahkan ke Layar Utama / Install".\n- Di Komputer: Klik ikon Pasang Aplikasi di bilah alamat browser.');
        return;
      }

      this.deferredInstallPrompt.prompt();
      const choice = await this.deferredInstallPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        this.showToast('Memasang JadwalSiaga...');
      }
      this.deferredInstallPrompt = null;
      if (pwaBanner) pwaBanner.classList.add('hidden');
    };

    if (btnInstallBanner) btnInstallBanner.addEventListener('click', triggerInstall);
    if (btnInstallSettings) btnInstallSettings.addEventListener('click', triggerInstall);

    if (btnDismissBanner) {
      btnDismissBanner.addEventListener('click', () => {
        if (pwaBanner) pwaBanner.classList.add('hidden');
        sessionStorage.setItem('pwa_banner_dismissed', 'true');
      });
    }

    // Event saat aplikasi berhasil dipasang
    window.addEventListener('appinstalled', () => {
      this.isAppInstalled = true;
      this.deferredInstallPrompt = null;
      if (pwaBanner) pwaBanner.classList.add('hidden');
      if (pwaStatusText) {
        pwaStatusText.textContent = '✓ Berhasil Dipasang!';
        pwaStatusText.style.color = 'var(--color-teal)';
      }
      if (btnInstallSettings) {
        btnInstallSettings.disabled = true;
        btnInstallSettings.textContent = '✓ Aplikasi Terpasang';
      }
      this.showToast('🎉 JadwalSiaga berhasil dipasang sebagai aplikasi!');
    });

    // Deteksi Online / Offline
    const updateOnlineStatus = () => {
      if (navigator.onLine) {
        if (offlineBanner) offlineBanner.classList.add('hidden');
      } else {
        if (offlineBanner) offlineBanner.classList.remove('hidden');
        this.showToast('Mode offline aktif (Aplikasi tetap bekerja lokal)');
      }
    };

    window.addEventListener('online', () => {
      updateOnlineStatus();
      this.showToast('Koneksi terhubung kembali');
    });
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();

    // Registrasi Service Worker (hanya aktif pada protokol http/https, bukan file://)
    if ('serviceWorker' in navigator && (window.location.protocol.startsWith('http') || window.location.hostname === 'localhost')) {
      navigator.serviceWorker.register('./sw.js', { scope: './' })
        .then((reg) => {
          console.log('Service Worker PWA berhasil didaftarkan dengan cakupan:', reg.scope);
        })
        .catch((err) => {
          console.warn('Registrasi Service Worker gagal:', err);
        });
    }
  }

  async seedSampleEvents() {
    const today = new Date();
    const todayStr = this.formatDateISO(today);

    const nextHour = new Date(today.getTime() + 15 * 60000);
    const startHourStr = String(nextHour.getHours()).padStart(2, '0') + ':' + String(nextHour.getMinutes()).padStart(2, '0');

    const sample1 = {
      id: 'sample-' + Date.now() + '-1',
      title: 'Kuliah Pemrograman Web',
      category: 'kuliah',
      date: todayStr,
      startTime: startHourStr,
      durationMinutes: 90,
      reminderMinutes: 10,
      repeat: 'weekly',
      soundType: 'default',
      notes: 'Lab Komputer 3 · Bawa laptop dan tugas modul 4',
      completed: false,
      createdAt: new Date().toISOString()
    };

    const sample2 = {
      id: 'sample-' + Date.now() + '-2',
      title: 'Rapat Proyek Siaga',
      category: 'kerja',
      date: todayStr,
      startTime: '16:00',
      durationMinutes: 60,
      reminderMinutes: 15,
      repeat: 'none',
      soundType: 'hilo',
      notes: 'Review MVP JadwalSiaga dan alarm testing',
      completed: false,
      createdAt: new Date().toISOString()
    };

    await saveEvent(sample1);
    await saveEvent(sample2);
  }

  setupEventListeners() {
    // Navigasi Tab Bawah
    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.getAttribute('data-tab');
        this.switchTab(tab);
      });
    });

    // Tombol Tambah Jadwal Cepat di Header
    const btnAddQuick = document.getElementById('btnAddQuick');
    if (btnAddQuick) {
      btnAddQuick.addEventListener('click', () => {
        this.openEventModal();
      });
    }

    // Modal Form Events
    const btnCloseModal = document.getElementById('btnCloseModal');
    const btnCancelModal = document.getElementById('btnCancelModal');
    if (btnCloseModal) btnCloseModal.addEventListener('click', () => this.closeEventModal());
    if (btnCancelModal) btnCancelModal.addEventListener('click', () => this.closeEventModal());

    const eventForm = document.getElementById('eventForm');
    if (eventForm) {
      eventForm.addEventListener('submit', (e) => this.handleSaveEventForm(e));
    }

    // Buka Sound Picker dari Formulir Jadwal
    const btnChooseEventSound = document.getElementById('btnChooseEventSound');
    if (btnChooseEventSound) {
      btnChooseEventSound.addEventListener('click', () => {
        const currentEventSound = document.getElementById('eventSoundType').value || 'wail';
        this.openSoundPickerModal('event', currentEventSound === 'default' ? this.settings.soundType : currentEventSound);
      });
    }

    // Deteksi bentrok live
    const inputDate = document.getElementById('eventDate');
    const inputStartTime = document.getElementById('eventStartTime');
    const inputDuration = document.getElementById('eventDuration');
    const conflictChecker = () => this.checkFormConflict();
    if (inputDate) inputDate.addEventListener('change', conflictChecker);
    if (inputStartTime) inputStartTime.addEventListener('change', conflictChecker);
    if (inputDuration) inputDuration.addEventListener('input', conflictChecker);

    // Filter Kategori di Agenda
    document.querySelectorAll('.filter-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.activeCategoryFilter = e.currentTarget.getAttribute('data-category');
        this.renderAgenda();
      });
    });

    // Pencarian Jadwal
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.renderAgenda();
      });
    }

    // Kalender Navigasi
    const btnPrevMonth = document.getElementById('btnPrevMonth');
    const btnNextMonth = document.getElementById('btnNextMonth');
    if (btnPrevMonth) {
      btnPrevMonth.addEventListener('click', () => {
        this.currentCalendarDate.setMonth(this.currentCalendarDate.getMonth() - 1);
        this.renderCalendar();
      });
    }
    if (btnNextMonth) {
      btnNextMonth.addEventListener('click', () => {
        this.currentCalendarDate.setMonth(this.currentCalendarDate.getMonth() + 1);
        this.renderCalendar();
      });
    }

    // Pengaturan: Suara & Volume
    const switchSound = document.getElementById('switchSound');
    if (switchSound) {
      switchSound.addEventListener('change', async (e) => {
        this.settings.soundEnabled = e.target.checked;
        await saveSettings(this.settings);
        this.alarmManager.updateSettings(this.settings);
        this.showToast(this.settings.soundEnabled ? 'Suara alarm diaktifkan' : 'Suara alarm dibisukan');
      });
    }

    // Tombol Buka Modal Pengganti Suara dari Pengaturan
    const btnOpenSoundPickerSettings = document.getElementById('btnOpenSoundPickerSettings');
    if (btnOpenSoundPickerSettings) {
      btnOpenSoundPickerSettings.addEventListener('click', () => {
        this.openSoundPickerModal('global', this.settings.soundType || 'wail');
      });
    }

    // Tombol Buka Modal Pengganti Suara dari Header
    const btnOpenSoundPickerHeader = document.getElementById('btnOpenSoundPickerHeader');
    if (btnOpenSoundPickerHeader) {
      btnOpenSoundPickerHeader.addEventListener('click', () => {
        this.openSoundPickerModal('global', this.settings.soundType || 'wail');
      });
    }

    const sliderVolume = document.getElementById('sliderVolume');
    if (sliderVolume) {
      sliderVolume.addEventListener('input', async (e) => {
        this.settings.sirenVolume = parseFloat(e.target.value);
        const player = getSirenPlayer();
        if (player) player.setVolume(this.settings.sirenVolume);
        await saveSettings(this.settings);
        this.alarmManager.updateSettings(this.settings);
      });
    }

    const selectDefaultReminder = document.getElementById('selectDefaultReminder');
    if (selectDefaultReminder) {
      selectDefaultReminder.addEventListener('change', async (e) => {
        this.settings.defaultReminder = parseInt(e.target.value, 10);
        await saveSettings(this.settings);
        this.alarmManager.updateSettings(this.settings);
        this.showToast(`Waktu pengingat bawaan: ${this.settings.defaultReminder} menit`);
      });
    }

    // Pemilih Warna Jam WatchClockCard (DESIGN.md 3.2)
    document.querySelectorAll('.color-pill-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const variant = e.currentTarget.getAttribute('data-variant');
        this.settings.clockVariant = variant;
        await saveSettings(this.settings);
        this.applyClockVariant(variant);
        this.showToast(`Warna jam diubah ke: ${variant}`);
      });
    });

    // Uji Suara Sirine (F-12 & PRD 7 Poin 5)
    const btnTestSiren = document.getElementById('btnTestSiren');
    if (btnTestSiren) {
      let isTesting = false;
      btnTestSiren.addEventListener('click', () => {
        const player = getSirenPlayer();
        if (!isTesting) {
          const soundType = this.settings.soundType || 'wail';
          if (player) {
            player.start(this.settings.sirenVolume || 0.8, 10, soundType, () => {
              btnTestSiren.textContent = '🔊 Uji Suara (10 dtk)';
              btnTestSiren.classList.remove('btn-danger');
              isTesting = false;
            });
          }
          btnTestSiren.textContent = '⏹️ Hentikan Uji Suara';
          btnTestSiren.classList.add('btn-danger');
          isTesting = true;
        } else {
          if (player) player.stop();
          btnTestSiren.textContent = '🔊 Uji Suara (10 dtk)';
          btnTestSiren.classList.remove('btn-danger');
          isTesting = false;
        }
      });
    }

    // Minta Izin Notifikasi (F-13)
    const btnRequestNotif = document.getElementById('btnRequestNotif');
    if (btnRequestNotif) {
      btnRequestNotif.addEventListener('click', () => {
        this.requestNotificationPermission();
      });
    }

    // Ekspor Data Cadangan
    const btnExportData = document.getElementById('btnExportData');
    if (btnExportData) {
      btnExportData.addEventListener('click', () => this.exportData());
    }

    // Impor Data Cadangan
    const btnTriggerImport = document.getElementById('btnTriggerImport');
    const fileInputImport = document.getElementById('fileInputImport');
    if (btnTriggerImport && fileInputImport) {
      btnTriggerImport.addEventListener('click', () => fileInputImport.click());
      fileInputImport.addEventListener('change', (e) => this.handleImportFile(e));
    }

    // Reset Semua Data
    const btnClearAllData = document.getElementById('btnClearAllData');
    if (btnClearAllData) {
      btnClearAllData.addEventListener('click', async () => {
        if (confirm('Apakah Anda yakin ingin MENGHAPUS SEMUA jadwal? Tindakan ini tidak dapat dibatalkan.')) {
          await clearAllEvents();
          this.events = [];
          this.alarmManager.updateEvents(this.events);
          this.renderCurrentView();
          this.updateStats();
          this.showToast('Semua data berhasil dikosongkan.');
        }
      });
    }

    // Audio Unlock Banner
    const audioBanner = document.getElementById('audioBanner');
    if (audioBanner) {
      audioBanner.addEventListener('click', () => {
        const player = getSirenPlayer();
        if (player) {
          player.initContext();
          player.playBeep(880, 0.1);
        }
        audioBanner.classList.add('hidden');
        this.showToast('Audio alarm aktif dan siap bersuara');
      });
    }

    window.addEventListener('click', () => {
      const player = getSirenPlayer();
      if (player && !player.audioUnlocked) {
        player.initContext();
        if (audioBanner) audioBanner.classList.add('hidden');
      }
    }, { once: true });
  }

  setupSoundPickerModal() {
    const modal = document.getElementById('soundPickerModal');
    const btnClose = document.getElementById('btnCloseSoundPicker');
    const btnApply = document.getElementById('btnApplySoundChoice');
    const btnUpload = document.getElementById('btnUploadInPicker');
    const fileInput = document.getElementById('fileInputCustomInPicker');

    if (btnClose) {
      btnClose.addEventListener('click', () => this.closeSoundPickerModal());
    }

    document.querySelectorAll('.sound-option-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target && e.target.closest('.btn-preview-sound')) return;

        const soundKey = card.getAttribute('data-sound');
        this.selectSoundCard(soundKey);
        this.previewSound(soundKey);
      });
    });

    document.querySelectorAll('.btn-preview-sound').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const soundKey = btn.getAttribute('data-sound');
        if (this.currentlyPreviewingSound === soundKey) {
          this.stopSoundPreview();
        } else {
          this.previewSound(soundKey);
        }
      });
    });

    if (btnUpload && fileInput) {
      btnUpload.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => this.handleCustomAudioUploadInPicker(e));
    }

    if (btnApply) {
      btnApply.addEventListener('click', async () => {
        await this.applySelectedSound();
      });
    }
  }

  openSoundPickerModal(target = 'global', initialSound = 'wail') {
    this.soundPickerTarget = target;
    const modal = document.getElementById('soundPickerModal');
    if (!modal) return;

    this.selectSoundCard(initialSound);
    modal.classList.remove('hidden');
  }

  closeSoundPickerModal() {
    this.stopSoundPreview();
    const modal = document.getElementById('soundPickerModal');
    if (modal) modal.classList.add('hidden');
  }

  selectSoundCard(soundKey) {
    this.selectedSoundInPicker = soundKey;
    document.querySelectorAll('.sound-option-card').forEach(card => {
      card.classList.toggle('selected', card.getAttribute('data-sound') === soundKey);
    });
  }

  previewSound(soundKey) {
    this.stopSoundPreview();

    const player = getSirenPlayer();
    if (!player) return;

    player.initContext();
    this.currentlyPreviewingSound = soundKey;

    document.querySelectorAll('.btn-preview-sound').forEach(btn => {
      if (btn.getAttribute('data-sound') === soundKey) {
        btn.textContent = '⏹';
        btn.classList.add('is-playing');
      } else {
        btn.textContent = '▶';
        btn.classList.remove('is-playing');
      }
    });

    player.start(this.settings.sirenVolume || 0.8, 4.0, soundKey, () => {
      this.stopSoundPreview();
    });

    this.previewTimeoutId = setTimeout(() => {
      this.stopSoundPreview();
    }, 4200);
  }

  stopSoundPreview() {
    if (this.previewTimeoutId) {
      clearTimeout(this.previewTimeoutId);
      this.previewTimeoutId = null;
    }
    const player = getSirenPlayer();
    if (player) player.stop();
    this.currentlyPreviewingSound = null;

    document.querySelectorAll('.btn-preview-sound').forEach(btn => {
      btn.textContent = '▶';
      btn.classList.remove('is-playing');
    });
  }

  async handleCustomAudioUploadInPicker(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 12 * 1024 * 1024) {
      alert('Ukuran berkas audio maksimal 12MB.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target.result;
      await saveCustomAudio(dataUrl, file.name);
      const player = getSirenPlayer();
      if (player) player.setCustomAudioDataUrl(dataUrl);

      this.updateCustomSoundUI(file.name);
      this.selectSoundCard('custom');
      this.previewSound('custom');
      this.showToast(`Audio "${file.name}" berhasil diunggah!`);
    };

    reader.onerror = () => {
      alert('Gagal membaca berkas audio.');
    };

    reader.readAsDataURL(file);
    e.target.value = '';
  }

  updateCustomSoundUI(fileName) {
    const desc = document.getElementById('pickerCustomSoundDesc');
    const previewBtn = document.getElementById('btnPreviewCustomInPicker');
    if (!desc) return;

    if (fileName) {
      desc.textContent = `File: ${fileName}`;
      if (previewBtn) previewBtn.style.display = 'flex';
    } else {
      desc.textContent = 'Belum ada berkas audio (Unggah di bawah)';
      if (previewBtn) previewBtn.style.display = 'none';
    }
  }

  async applySelectedSound() {
    const chosenSound = this.selectedSoundInPicker;
    this.stopSoundPreview();

    const soundNames = {
      wail: '🚨 Sirine Ayun',
      hilo: '🚑 Dua Nada (Hi-Lo)',
      beep: '⏰ Alarm Digital Beep',
      chime: '🔔 Melodi Chime',
      buzzer: '📢 Buzzer Klaxon',
      custom: '📁 Suara Audio Kustom'
    };

    if (this.soundPickerTarget === 'global') {
      this.settings.soundType = chosenSound;
      await saveSettings(this.settings);
      this.alarmManager.updateSettings(this.settings);
      this.updateSoundDisplayUI(chosenSound);
      this.showToast(`Suara alarm utama berhasil diganti: ${soundNames[chosenSound] || chosenSound}`);
    } else if (this.soundPickerTarget === 'event') {
      const inputHidden = document.getElementById('eventSoundType');
      const labelDisplay = document.getElementById('eventSoundLabel');
      if (inputHidden) inputHidden.value = chosenSound;
      if (labelDisplay) labelDisplay.textContent = soundNames[chosenSound] || chosenSound;
      this.showToast(`Suara alarm kegiatan diatur ke: ${soundNames[chosenSound] || chosenSound}`);
    }

    this.closeSoundPickerModal();
  }

  updateSoundDisplayUI(soundType) {
    const soundShortNames = {
      wail: 'Sirine',
      hilo: 'Hi-Lo',
      beep: 'Beep',
      chime: 'Chime',
      buzzer: 'Buzzer',
      custom: 'Kustom'
    };
    const soundFullNames = {
      wail: '🚨 Sirine Ayun (Wail)',
      hilo: '🚑 Dua Nada (Hi-Lo)',
      beep: '⏰ Digital Beep Cepat',
      chime: '🔔 Melodi Chime Lembut',
      buzzer: '📢 Klaxon / Buzzer Tegas',
      custom: '📁 Suara Audio Kustom'
    };

    const headerLabel = document.getElementById('headerSoundLabel');
    if (headerLabel) {
      headerLabel.textContent = soundShortNames[soundType] || 'Sirine';
    }

    const settingsDisplay = document.getElementById('currentSoundNameDisplay');
    if (settingsDisplay) {
      settingsDisplay.textContent = soundFullNames[soundType] || soundType;
    }
  }

  applyClockVariant(variant) {
    const watchClockCard = document.getElementById('watchClockCard');
    if (!watchClockCard) return;

    watchClockCard.classList.remove('variant-orange', 'variant-cyan', 'variant-magenta', 'variant-purple');
    watchClockCard.classList.add(`variant-${variant}`);

    document.querySelectorAll('.color-pill-btn').forEach(btn => {
      btn.classList.toggle('selected', btn.getAttribute('data-variant') === variant);
    });
  }

  checkAudioState() {
    const audioBanner = document.getElementById('audioBanner');
    if (audioBanner) {
      const player = getSirenPlayer();
      if (player && player.audioUnlocked) {
        audioBanner.classList.add('hidden');
      } else {
        audioBanner.classList.remove('hidden');
      }
    }
  }

  async requestNotificationPermission() {
    if (!('Notification' in window)) {
      alert('Peramban ini tidak mendukung notifikasi desktop.');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      this.updateNotificationPermissionStatus();
      if (permission === 'granted') {
        this.settings.notificationsEnabled = true;
        await saveSettings(this.settings);
        this.alarmManager.updateSettings(this.settings);
        new Notification('JadwalSiaga', {
          body: 'Notifikasi aktif! Anda akan menerima pengingat jadwal.',
          icon: 'icon.svg'
        });
        this.showToast('Izin notifikasi diberikan.');
      } else {
        this.settings.notificationsEnabled = false;
        await saveSettings(this.settings);
        this.showToast('Izin notifikasi ditolak/dibatalkan.');
      }
    } catch (e) {
      console.error(e);
    }
  }

  updateNotificationPermissionStatus() {
    const notifStatusEl = document.getElementById('notifStatusText');
    const btnRequestNotif = document.getElementById('btnRequestNotif');
    if (!notifStatusEl) return;

    if (!('Notification' in window)) {
      notifStatusEl.textContent = 'Tidak Didukung';
      if (btnRequestNotif) btnRequestNotif.disabled = true;
      return;
    }

    if (Notification.permission === 'granted') {
      notifStatusEl.textContent = 'Aktif (Diizinkan)';
      notifStatusEl.style.color = 'var(--color-teal)';
      if (btnRequestNotif) {
        btnRequestNotif.textContent = 'Notifikasi Aktif';
        btnRequestNotif.disabled = true;
      }
    } else if (Notification.permission === 'denied') {
      notifStatusEl.textContent = 'Ditolak (Setelan browser)';
      notifStatusEl.style.color = 'var(--color-danger)';
    } else {
      notifStatusEl.textContent = 'Belum Diizinkan';
      notifStatusEl.style.color = 'var(--color-orange)';
    }
  }

  switchTab(tab) {
    this.activeTab = tab;

    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
    });

    document.getElementById('viewAgenda').classList.toggle('hidden', tab !== 'agenda');
    document.getElementById('viewKalender').classList.toggle('hidden', tab !== 'kalender');
    document.getElementById('viewPengaturan').classList.toggle('hidden', tab !== 'pengaturan');

    const headerTitle = document.getElementById('pageHeaderTitle');
    if (headerTitle) {
      if (tab === 'agenda') headerTitle.textContent = 'Agenda';
      else if (tab === 'kalender') headerTitle.textContent = 'Kalender';
      else if (tab === 'pengaturan') headerTitle.textContent = 'Pengaturan';
    }

    this.renderCurrentView();
  }

  renderCurrentView() {
    if (this.activeTab === 'agenda') {
      this.renderAgenda();
    } else if (this.activeTab === 'kalender') {
      this.renderCalendar();
    } else if (this.activeTab === 'pengaturan') {
      this.renderSettings();
    }
    this.updateStats();
  }

  updateStats() {
    const statTotal = document.getElementById('statTotalEvents');
    const statCompleted = document.getElementById('statCompletedEvents');
    const statToday = document.getElementById('statTodayEvents');

    if (!statTotal) return;

    const total = this.events.length;
    const completed = this.events.filter(e => e.completed).length;
    const today = this.events.filter(e => this.alarmManager.isEventOccurringOnDate(e, new Date())).length;

    statTotal.textContent = total;
    statCompleted.textContent = completed;
    statToday.textContent = today;
  }

  startWatchClock() {
    const clockDigits = document.getElementById('clockDigits');
    const clockAmPm = document.getElementById('clockAmPm');
    const clockDateLine = document.getElementById('clockDateLine');
    const clockProgressCircle = document.getElementById('clockProgressCircle');
    const nextAgendaText = document.getElementById('nextAgendaText');
    const headerDateTime = document.getElementById('headerDateTime');

    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const shortDays = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

    const updateClock = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const seconds = now.getSeconds();

      const hours12 = hours % 12 || 12;
      const ampm = hours >= 12 ? 'PM' : 'AM';

      if (clockDigits) {
        clockDigits.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      }
      if (clockAmPm) {
        clockAmPm.textContent = `${ampm} :${String(seconds).padStart(2, '0')}`;
      }

      if (clockDateLine) {
        clockDateLine.textContent = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
      }

      if (headerDateTime) {
        headerDateTime.textContent = `${shortDays[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} · ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      }

      if (clockProgressCircle) {
        const circumference = 201;
        const progress = seconds / 60;
        const offset = circumference - (progress * circumference);
        clockProgressCircle.style.strokeDashoffset = offset;
      }

      if (nextAgendaText) {
        const nextEvent = this.findNextUpcomingEvent(now);
        if (nextEvent) {
          nextAgendaText.innerHTML = `Berikutnya: <span class="next-agenda-pill">${this.escapeHtml(nextEvent.title)}</span> (${nextEvent.startTime})`;
        } else {
          nextAgendaText.textContent = 'Tidak ada jadwal tersisa hari ini';
        }
      }
    };

    updateClock();
    setInterval(updateClock, 1000);
  }

  findNextUpcomingEvent(now) {
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    const todayEvents = this.events
      .filter(e => this.alarmManager.isEventOccurringOnDate(e, now) && !e.completed)
      .sort((a, b) => this.timeToMinutes(a.startTime) - this.timeToMinutes(b.startTime));

    for (const ev of todayEvents) {
      const evStart = this.timeToMinutes(ev.startTime);
      if (evStart >= nowMinutes) {
        return ev;
      }
    }
    return null;
  }

  renderAgenda() {
    const listTodayEl = document.getElementById('listTodayAgenda');
    const listUpcomingEl = document.getElementById('listUpcomingAgenda');
    const countTodayBadge = document.getElementById('countTodayBadge');
    const countUpcomingBadge = document.getElementById('countUpcomingBadge');

    const now = new Date();
    const todayStr = this.formatDateISO(now);

    let filtered = this.events;

    if (this.activeCategoryFilter !== 'all') {
      filtered = filtered.filter(e => e.category === this.activeCategoryFilter);
    }

    if (this.searchQuery) {
      filtered = filtered.filter(e => 
        (e.title && e.title.toLowerCase().includes(this.searchQuery)) ||
        (e.notes && e.notes.toLowerCase().includes(this.searchQuery))
      );
    }

    filtered.sort((a, b) => {
      const d = a.date.localeCompare(b.date);
      if (d !== 0) return d;
      return this.timeToMinutes(a.startTime) - this.timeToMinutes(b.startTime);
    });

    const todayEvents = filtered.filter(e => this.alarmManager.isEventOccurringOnDate(e, now));
    const upcomingEvents = filtered.filter(e => {
      if (this.alarmManager.isEventOccurringOnDate(e, now)) return false;
      return e.date > todayStr || (e.repeat && e.repeat !== 'none');
    });

    if (countTodayBadge) countTodayBadge.textContent = todayEvents.length;
    if (countUpcomingBadge) countUpcomingBadge.textContent = upcomingEvents.length;

    if (listTodayEl) {
      if (todayEvents.length === 0) {
        listTodayEl.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">☕</div>
            <div class="empty-state-text">Tidak ada jadwal untuk hari ini.</div>
          </div>
        `;
      } else {
        listTodayEl.innerHTML = todayEvents.map(e => this.createScheduleCardHTML(e, false)).join('');
      }
    }

    if (listUpcomingEl) {
      if (upcomingEvents.length === 0) {
        listUpcomingEl.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">📅</div>
            <div class="empty-state-text">Belum ada agenda di hari mendatang.</div>
          </div>
        `;
      } else {
        listUpcomingEl.innerHTML = upcomingEvents.map(e => this.createScheduleCardHTML(e, true)).join('');
      }
    }

    this.bindScheduleCardActions();
    this.updateStats();
  }

  createScheduleCardHTML(event, showDate = false) {
    const endMinutes = this.timeToMinutes(event.startTime) + (event.durationMinutes || 60);
    const endTimeStr = this.minutesToTimeStr(endMinutes);

    const categoryNames = {
      kuliah: 'Kuliah',
      sekolah: 'Sekolah',
      kerja: 'Kerja',
      lainnya: 'Lainnya'
    };

    const repeatNames = {
      daily: '🔁 Tiap Hari',
      weekdays: '🔁 Sen-Jum',
      weekly: '🔁 Mingguan',
      none: ''
    };

    const soundNames = {
      wail: '🚨 Sirine',
      hilo: '🚑 Hi-Lo',
      beep: '⏰ Beep',
      chime: '🔔 Chime',
      buzzer: '📢 Buzzer',
      custom: '📁 Kustom'
    };

    const repeatText = repeatNames[event.repeat] || '';
    const repeatBadge = repeatText ? `<span class="schedule-repeat-badge">${repeatText}</span>` : '';
    const soundTag = (event.soundType && event.soundType !== 'default') ? `<span class="schedule-sound-tag">${soundNames[event.soundType] || ''}</span>` : '';

    const dateDisplay = showDate ? `<span>📅 ${this.formatReadableDate(event.date)}</span> · ` : '';
    const alarmStatus = this.alarmManager.getAlarmStatusForEvent(event);

    return `
      <div class="schedule-card cat-${event.category} ${event.completed ? 'completed' : ''}" data-id="${event.id}">
        <div class="category-accent-bar"></div>
        <div class="schedule-content">
          <div class="schedule-meta-top">
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              <span class="category-tag cat-badge-${event.category}">${categoryNames[event.category] || event.category}</span>
              ${repeatBadge}
              ${soundTag}
            </div>
            <span class="alarm-status-pill ${alarmStatus.colorClass}">${alarmStatus.label}</span>
          </div>
          <div class="schedule-title">${this.escapeHtml(event.title)}</div>
          <div class="schedule-sub-info">
            <span class="schedule-time-badge">${event.startTime} – ${endTimeStr} (${event.durationMinutes}m)</span>
            ${dateDisplay}
            <span class="schedule-reminder-tag">
              🔔 -${event.reminderMinutes}m
            </span>
          </div>
          ${event.notes ? `<div class="schedule-notes">${this.escapeHtml(event.notes)}</div>` : ''}
          <div class="schedule-actions">
            <button class="btn-card-action btn-toggle-complete" data-id="${event.id}" title="${event.completed ? 'Batal Selesai' : 'Tandai Selesai'}">
              ${event.completed ? '↩️ Batal' : '✓ Selesai'}
            </button>
            <button class="btn-card-action btn-trigger-test" data-id="${event.id}" title="Uji Alarm">
              🚨 Uji
            </button>
            <button class="btn-card-action btn-edit-event" data-id="${event.id}" title="Edit Jadwal">
              ✏️ Edit
            </button>
            <button class="btn-card-action btn-danger btn-delete-event" data-id="${event.id}" title="Hapus Jadwal">
              🗑️
            </button>
          </div>
        </div>
      </div>
    `;
  }

  bindScheduleCardActions() {
    document.querySelectorAll('.btn-toggle-complete').forEach(btn => {
      btn.onclick = async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const ev = this.events.find(item => item.id === id);
        if (ev) {
          ev.completed = !ev.completed;
          await saveEvent(ev);
          this.alarmManager.updateEvents(this.events);
          this.renderCurrentView();
          this.showToast(ev.completed ? 'Jadwal ditandai selesai.' : 'Status jadwal diperbarui.');
        }
      };
    });

    document.querySelectorAll('.btn-trigger-test').forEach(btn => {
      btn.onclick = (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const ev = this.events.find(item => item.id === id);
        if (ev) {
          const fakeStartTime = new Date();
          this.alarmManager.resetDismissed(ev.id);
          this.alarmManager.triggerAlarm(ev, ev.reminderMinutes, fakeStartTime);
        }
      };
    });

    document.querySelectorAll('.btn-edit-event').forEach(btn => {
      btn.onclick = (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const ev = this.events.find(item => item.id === id);
        if (ev) {
          this.openEventModal(ev);
        }
      };
    });

    document.querySelectorAll('.btn-delete-event').forEach(btn => {
      btn.onclick = async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const ev = this.events.find(item => item.id === id);
        if (ev && confirm(`Hapus jadwal "${ev.title}"?`)) {
          await deleteEvent(id);
          this.events = this.events.filter(item => item.id !== id);
          this.alarmManager.updateEvents(this.events);
          this.renderCurrentView();
          this.showToast('Jadwal berhasil dihapus.');
        }
      };
    });
  }

  renderCalendar() {
    const monthTitle = document.getElementById('calMonthTitle');
    const calGrid = document.getElementById('calGridDays');
    const selectedDateLabel = document.getElementById('calSelectedDateLabel');
    const calEventsList = document.getElementById('calEventsList');

    if (!calGrid) return;

    const year = this.currentCalendarDate.getFullYear();
    const month = this.currentCalendarDate.getMonth();

    const monthNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];

    if (monthTitle) {
      monthTitle.textContent = `${monthNames[month]} ${year}`;
    }

    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevDaysInMonth = new Date(year, month, 0).getDate();

    let gridHTML = '';

    for (let x = firstDayIndex; x > 0; x--) {
      const dayNum = prevDaysInMonth - x + 1;
      gridHTML += `<div class="cal-date-cell other-month">${dayNum}</div>`;
    }

    const todayStr = this.formatDateISO(new Date());
    const selectedDateStr = this.formatDateISO(this.selectedCalendarDate);

    for (let i = 1; i <= daysInMonth; i++) {
      const curDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const curDateObj = new Date(curDateStr + 'T00:00:00');
      const isToday = curDateStr === todayStr;
      const isSelected = curDateStr === selectedDateStr;

      const eventsOnDate = this.events.filter(e => this.alarmManager.isEventOccurringOnDate(e, curDateObj));
      let dotsHTML = '';
      if (eventsOnDate.length > 0) {
        dotsHTML = `<div class="cal-dots-container">` +
          eventsOnDate.slice(0, 3).map(() => `<span class="cal-event-dot"></span>`).join('') +
          `</div>`;
      }

      gridHTML += `
        <div class="cal-date-cell ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''}" data-date="${curDateStr}">
          <span>${i}</span>
          ${dotsHTML}
        </div>
      `;
    }

    calGrid.innerHTML = gridHTML;

    calGrid.querySelectorAll('.cal-date-cell:not(.other-month)').forEach(cell => {
      cell.addEventListener('click', (e) => {
        const dateStr = e.currentTarget.getAttribute('data-date');
        if (dateStr) {
          this.selectedCalendarDate = new Date(dateStr + 'T00:00:00');
          this.renderCalendar();
        }
      });
    });

    if (selectedDateLabel) {
      selectedDateLabel.textContent = this.formatReadableDate(selectedDateStr);
    }

    if (calEventsList) {
      const selectedEvents = this.events.filter(e => this.alarmManager.isEventOccurringOnDate(e, this.selectedCalendarDate));
      if (selectedEvents.length === 0) {
        calEventsList.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">🗓️</div>
            <div class="empty-state-text">Tidak ada kegiatan pada tanggal ini.</div>
          </div>
        `;
      } else {
        calEventsList.innerHTML = selectedEvents.map(e => this.createScheduleCardHTML(e, false)).join('');
      }
    }

    this.bindScheduleCardActions();
  }

  renderSettings() {
    const switchSound = document.getElementById('switchSound');
    const sliderVolume = document.getElementById('sliderVolume');
    const selectDefaultReminder = document.getElementById('selectDefaultReminder');

    if (switchSound) switchSound.checked = this.settings.soundEnabled;
    if (sliderVolume) sliderVolume.value = this.settings.sirenVolume || 0.8;
    if (selectDefaultReminder) selectDefaultReminder.value = this.settings.defaultReminder || 10;

    this.updateSoundDisplayUI(this.settings.soundType || 'wail');
    this.updateNotificationPermissionStatus();
  }

  openEventModal(eventToEdit = null) {
    const modal = document.getElementById('eventModal');
    const modalTitle = document.getElementById('modalTitle');
    const conflictBox = document.getElementById('conflictWarningBox');
    if (!modal) return;

    if (conflictBox) conflictBox.classList.add('hidden');

    const soundNames = {
      wail: '🚨 Sirine Ayun',
      hilo: '🚑 Dua Nada',
      beep: '⏰ Digital Beep',
      chime: '🔔 Melodi Chime',
      buzzer: '📢 Buzzer Klaxon',
      custom: '📁 Audio Kustom'
    };

    if (eventToEdit) {
      this.editingEventId = eventToEdit.id;
      if (modalTitle) modalTitle.textContent = 'Edit Jadwal';
      document.getElementById('eventTitle').value = eventToEdit.title;
      document.getElementById('eventDate').value = eventToEdit.date;
      document.getElementById('eventStartTime').value = eventToEdit.startTime;
      document.getElementById('eventDuration').value = eventToEdit.durationMinutes;
      document.getElementById('eventReminder').value = eventToEdit.reminderMinutes;
      document.getElementById('eventRepeat').value = eventToEdit.repeat || 'none';
      
      const sType = eventToEdit.soundType || 'default';
      document.getElementById('eventSoundType').value = sType;
      document.getElementById('eventSoundLabel').textContent = sType === 'default' ? 'Ikuti Bawaan' : (soundNames[sType] || sType);

      document.getElementById('eventNotes').value = eventToEdit.notes || '';

      const catRadio = document.querySelector(`input[name="category"][value="${eventToEdit.category}"]`);
      if (catRadio) catRadio.checked = true;
    } else {
      this.editingEventId = null;
      if (modalTitle) modalTitle.textContent = 'Tambah Jadwal Baru';
      document.getElementById('eventTitle').value = '';
      document.getElementById('eventDate').value = this.formatDateISO(this.selectedCalendarDate || new Date());
      
      const now = new Date();
      now.setMinutes(Math.ceil((now.getMinutes() + 15) / 15) * 15);
      const hoursStr = String(now.getHours()).padStart(2, '0');
      const minStr = String(now.getMinutes()).padStart(2, '0');
      document.getElementById('eventStartTime').value = `${hoursStr}:${minStr}`;

      document.getElementById('eventDuration').value = '60';
      document.getElementById('eventReminder').value = this.settings ? this.settings.defaultReminder : 10;
      document.getElementById('eventRepeat').value = 'none';
      document.getElementById('eventSoundType').value = 'default';
      document.getElementById('eventSoundLabel').textContent = `Ikuti Bawaan (${soundNames[this.settings.soundType || 'wail'] || 'Sirine'})`;
      document.getElementById('eventNotes').value = '';

      const defaultCat = document.getElementById('catKuliah');
      if (defaultCat) defaultCat.checked = true;
    }

    modal.classList.remove('hidden');
    document.getElementById('eventTitle').focus();
    this.checkFormConflict();
  }

  closeEventModal() {
    const modal = document.getElementById('eventModal');
    if (modal) modal.classList.add('hidden');
    this.editingEventId = null;
  }

  checkFormConflict() {
    const date = document.getElementById('eventDate').value;
    const startTime = document.getElementById('eventStartTime').value;
    const duration = parseInt(document.getElementById('eventDuration').value, 10);
    const conflictBox = document.getElementById('conflictWarningBox');
    const conflictText = document.getElementById('conflictWarningText');

    if (!conflictBox || !date || !startTime || isNaN(duration)) {
      if (conflictBox) conflictBox.classList.add('hidden');
      return false;
    }

    const newStart = this.timeToMinutes(startTime);
    const newEnd = newStart + duration;

    const conflictingEvent = this.events.find(e => {
      if (e.id === this.editingEventId) return false;
      if (e.date !== date || e.completed) return false;

      const eStart = this.timeToMinutes(e.startTime);
      const eEnd = eStart + (e.durationMinutes || 60);

      return (newStart < eEnd && newEnd > eStart);
    });

    if (conflictingEvent) {
      const eEnd = this.timeToMinutes(conflictingEvent.startTime) + (conflictingEvent.durationMinutes || 60);
      conflictText.textContent = `Waktu bentrok dengan: "${conflictingEvent.title}" (${conflictingEvent.startTime} - ${this.minutesToTimeStr(eEnd)})`;
      conflictBox.classList.remove('hidden');
      return true;
    } else {
      conflictBox.classList.add('hidden');
      return false;
    }
  }

  async handleSaveEventForm(e) {
    e.preventDefault();

    const title = document.getElementById('eventTitle').value.trim();
    const date = document.getElementById('eventDate').value;
    const startTime = document.getElementById('eventStartTime').value;
    const durationMinutes = parseInt(document.getElementById('eventDuration').value, 10) || 60;
    const reminderMinutes = parseInt(document.getElementById('eventReminder').value, 10);
    const repeat = document.getElementById('eventRepeat').value || 'none';
    const soundType = document.getElementById('eventSoundType').value || 'default';
    const notes = document.getElementById('eventNotes').value.trim();
    const category = document.querySelector('input[name="category"]:checked')?.value || 'kuliah';

    if (!title || !date || !startTime) {
      alert('Harap isi judul, tanggal, dan jam mulai kegiatan.');
      return;
    }

    const eventData = {
      id: this.editingEventId || 'ev-' + Date.now(),
      title,
      category,
      date,
      startTime,
      durationMinutes,
      reminderMinutes,
      repeat,
      soundType,
      notes,
      completed: false,
      createdAt: new Date().toISOString()
    };

    await saveEvent(eventData);

    const index = this.events.findIndex(item => item.id === eventData.id);
    if (index >= 0) {
      this.events[index] = eventData;
      this.alarmManager.resetDismissed(eventData.id);
    } else {
      this.events.push(eventData);
    }

    this.alarmManager.updateEvents(this.events);
    this.closeEventModal();
    this.renderCurrentView();

    this.showToast(this.editingEventId ? 'Jadwal berhasil diperbarui!' : 'Jadwal baru berhasil disimpan!');
  }

  exportData() {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.events, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `JadwalSiaga-Backup-${this.formatDateISO(new Date())}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      this.showToast('Cadangan data berhasil diunduh.');
    } catch (e) {
      console.error(e);
      alert('Gagal mengekspor data.');
    }
  }

  async handleImportFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const imported = JSON.parse(text);

      if (Array.isArray(imported)) {
        for (const item of imported) {
          if (item.id && item.title) {
            await saveEvent(item);
          }
        }
        this.events = await getAllEvents();
        this.alarmManager.updateEvents(this.events);
        this.renderCurrentView();
        this.showToast(`Berhasil mengimpor ${imported.length} jadwal.`);
      } else {
        alert('Format berkas tidak valid.');
      }
    } catch (err) {
      alert('Gagal membaca berkas cadangan JSON.');
    } finally {
      e.target.value = '';
    }
  }

  timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  }

  minutesToTimeStr(minutes) {
    const h = Math.floor(minutes / 60) % 24;
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  formatDateISO(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  formatReadableDate(isoDateStr) {
    if (!isoDateStr) return '';
    const parts = isoDateStr.split('-');
    if (parts.length < 3) return isoDateStr;
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  }

  escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  showToast(msg) {
    const existing = document.querySelector('.toast-msg');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast-msg';
    toast.textContent = msg;
    document.body.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 2800);
  }
}

  function initApp() {
    if (!window.jadwalSiagaApp) {
      window.jadwalSiagaApp = new App();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }

})(window);
