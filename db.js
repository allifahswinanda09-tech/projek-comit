/**
 * db.js — IndexedDB Data Layer for JadwalSiaga
 * Bekerja tanpa modul (CORS-free) sehingga dapat berjalan langsung di file:// dan http://.
 * Mengelola penyimpanan lokal data jadwal (events), preferensi (settings),
 * serta berkas audio kustom pengguna dengan fail-safe localStorage fallback.
 */

(function(window) {
  'use strict';

  const DB_NAME = 'JadwalSiagaDB';
  const DB_VERSION = 2; // Versi untuk object store audio & events

  let dbInstance = null;

  function openDatabase() {
    return new Promise((resolve) => {
      if (dbInstance) {
        resolve(dbInstance);
        return;
      }

      if (!('indexedDB' in window)) {
        resolve(null);
        return;
      }

      let settled = false;
      const finish = (result) => {
        if (!settled) {
          settled = true;
          resolve(result);
        }
      };

      // Timeout fallback 250ms agar peramban tidak pernah membeku jika IndexedDB tertahan pada protokol file://
      const timer = setTimeout(() => {
        finish(null);
      }, 250);

      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          try {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('events')) {
              const eventsStore = db.createObjectStore('events', { keyPath: 'id' });
              eventsStore.createIndex('date', 'date', { unique: false });
              eventsStore.createIndex('category', 'category', { unique: false });
              eventsStore.createIndex('completed', 'completed', { unique: false });
            }
            if (!db.objectStoreNames.contains('settings')) {
              db.createObjectStore('settings', { keyPath: 'key' });
            }
            if (!db.objectStoreNames.contains('custom_audio')) {
              db.createObjectStore('custom_audio', { keyPath: 'key' });
            }
          } catch (e) {
            console.warn('Upgrade error:', e);
          }
        };

        request.onsuccess = (event) => {
          clearTimeout(timer);
          dbInstance = event.target.result;
          finish(dbInstance);
        };

        request.onerror = () => {
          clearTimeout(timer);
          finish(null);
        };

        request.onblocked = () => {
          clearTimeout(timer);
          finish(null);
        };
      } catch (err) {
        clearTimeout(timer);
        finish(null);
      }
    });
  }

  // Fallback LocalStorage Helpers
  const STORAGE_KEY_EVENTS = 'jadwalsiaga_events_backup';
  const STORAGE_KEY_SETTINGS = 'jadwalsiaga_settings_backup';
  const STORAGE_KEY_CUSTOM_AUDIO = 'jadwalsiaga_custom_audio';

  function getLocalEvents() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_EVENTS);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveLocalEvents(events) {
    try {
      localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(events));
    } catch (e) {}
  }

  async function getAllEvents() {
    const db = await openDatabase();
    if (!db) {
      return getLocalEvents();
    }

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction(['events'], 'readonly');
        const store = transaction.objectStore('events');
        const request = store.getAll();

        request.onsuccess = () => {
          const res = request.result || [];
          if (res.length > 0) {
            saveLocalEvents(res);
            resolve(res);
          } else {
            resolve(getLocalEvents());
          }
        };
        request.onerror = () => resolve(getLocalEvents());
      } catch (e) {
        resolve(getLocalEvents());
      }
    });
  }

  async function saveEvent(eventData) {
    const currentEvents = getLocalEvents();
    const index = currentEvents.findIndex(e => e.id === eventData.id);
    if (index >= 0) {
      currentEvents[index] = eventData;
    } else {
      currentEvents.push(eventData);
    }
    saveLocalEvents(currentEvents);

    const db = await openDatabase();
    if (!db) return eventData;

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction(['events'], 'readwrite');
        const store = transaction.objectStore('events');
        const request = store.put(eventData);

        request.onsuccess = () => resolve(eventData);
        request.onerror = () => resolve(eventData);
      } catch (e) {
        resolve(eventData);
      }
    });
  }

  async function deleteEvent(id) {
    const currentEvents = getLocalEvents().filter(e => e.id !== id);
    saveLocalEvents(currentEvents);

    const db = await openDatabase();
    if (!db) return true;

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction(['events'], 'readwrite');
        const store = transaction.objectStore('events');
        const request = store.delete(id);

        request.onsuccess = () => resolve(true);
        request.onerror = () => resolve(true);
      } catch (e) {
        resolve(true);
      }
    });
  }

  async function clearAllEvents() {
    saveLocalEvents([]);
    const db = await openDatabase();
    if (!db) return true;

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction(['events'], 'readwrite');
        const store = transaction.objectStore('events');
        const request = store.clear();
        request.onsuccess = () => resolve(true);
        request.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  }

  async function getSettings() {
    const defaultSettings = {
      soundEnabled: true,
      soundType: 'wail', // 'wail' | 'hilo' | 'beep' | 'chime' | 'buzzer' | 'custom'
      sirenVolume: 0.8,
      clockVariant: 'orange',
      defaultReminder: 10,
      maxSirenDuration: 120,
      notificationsEnabled: false,
      customSoundName: ''
    };

    let localResult = defaultSettings;
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (raw) localResult = { ...defaultSettings, ...JSON.parse(raw) };
    } catch (e) {}

    const db = await openDatabase();
    if (!db) return localResult;

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction(['settings'], 'readonly');
        const store = transaction.objectStore('settings');
        const request = store.get('app_settings');

        request.onsuccess = () => {
          if (request.result && request.result.value) {
            const merged = { ...defaultSettings, ...request.result.value };
            try { localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(merged)); } catch (e) {}
            resolve(merged);
          } else {
            resolve(localResult);
          }
        };

        request.onerror = () => resolve(localResult);
      } catch (e) {
        resolve(localResult);
      }
    });
  }

  async function saveSettings(settings) {
    try {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
    } catch (e) {}

    const db = await openDatabase();
    if (!db) return settings;

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction(['settings'], 'readwrite');
        const store = transaction.objectStore('settings');
        const request = store.put({ key: 'app_settings', value: settings });

        request.onsuccess = () => resolve(settings);
        request.onerror = () => resolve(settings);
      } catch (e) {
        resolve(settings);
      }
    });
  }

  /**
   * Menyimpan berkas audio kustom
   */
  async function saveCustomAudio(dataUrl, fileName) {
    try {
      localStorage.setItem(STORAGE_KEY_CUSTOM_AUDIO, JSON.stringify({ dataUrl, fileName }));
    } catch (e) {}

    const db = await openDatabase();
    if (!db) return true;

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction(['custom_audio'], 'readwrite');
        const store = transaction.objectStore('custom_audio');
        const request = store.put({ key: 'user_alarm_sound', dataUrl, fileName });
        request.onsuccess = () => resolve(true);
        request.onerror = () => resolve(true);
      } catch (e) {
        resolve(true);
      }
    });
  }

  /**
   * Mengambil berkas audio kustom
   */
  async function getCustomAudio() {
    let localCustom = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CUSTOM_AUDIO);
      if (raw) localCustom = JSON.parse(raw);
    } catch (e) {}

    const db = await openDatabase();
    if (!db) return localCustom;

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction(['custom_audio'], 'readonly');
        const store = transaction.objectStore('custom_audio');
        const request = store.get('user_alarm_sound');

        request.onsuccess = () => {
          if (request.result) {
            resolve(request.result);
          } else {
            resolve(localCustom);
          }
        };

        request.onerror = () => resolve(localCustom);
      } catch (e) {
        resolve(localCustom);
      }
    });
  }

  /**
   * Menghapus audio kustom
   */
  async function deleteCustomAudio() {
    try {
      localStorage.removeItem(STORAGE_KEY_CUSTOM_AUDIO);
    } catch (e) {}

    const db = await openDatabase();
    if (!db) return true;

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction(['custom_audio'], 'readwrite');
        const store = transaction.objectStore('custom_audio');
        const request = store.delete('user_alarm_sound');
        request.onsuccess = () => resolve(true);
        request.onerror = () => resolve(true);
      } catch (e) {
        resolve(true);
      }
    });
  }

  // Ekspor ke global window
  window.JadwalSiagaDB = {
    openDatabase,
    getAllEvents,
    saveEvent,
    deleteEvent,
    clearAllEvents,
    getSettings,
    saveSettings,
    saveCustomAudio,
    getCustomAudio,
    deleteCustomAudio
  };

})(window);
