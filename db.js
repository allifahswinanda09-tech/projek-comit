/**
 * db.js — IndexedDB Data Layer for JadwalSiaga
 * Mengelola penyimpanan lokal data jadwal (events), preferensi (settings),
 * serta berkas audio kustom pengguna.
 */

const DB_NAME = 'JadwalSiagaDB';
const DB_VERSION = 2; // Naikkan versi untuk object store audio

let dbInstance = null;

export function openDatabase() {
  return new Promise((resolve) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    if (!('indexedDB' in window)) {
      console.warn('IndexedDB tidak didukung oleh peramban ini. Menggunakan localStorage fallback.');
      resolve(null);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
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

      // Store khusus audio kustom (PRD Bagian 7 poin 5)
      if (!db.objectStoreNames.contains('custom_audio')) {
        db.createObjectStore('custom_audio', { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error('Gagal membuka IndexedDB:', event.target.error);
      resolve(null);
    };
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

export async function getAllEvents() {
  const db = await openDatabase();
  if (!db) {
    return getLocalEvents();
  }

  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(['events'], 'readonly');
      const store = transaction.objectStore('events');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve(getLocalEvents());
    } catch (e) {
      resolve(getLocalEvents());
    }
  });
}

export async function saveEvent(eventData) {
  const db = await openDatabase();
  
  const currentEvents = getLocalEvents();
  const index = currentEvents.findIndex(e => e.id === eventData.id);
  if (index >= 0) {
    currentEvents[index] = eventData;
  } else {
    currentEvents.push(eventData);
  }
  saveLocalEvents(currentEvents);

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

export async function deleteEvent(id) {
  const db = await openDatabase();
  
  const currentEvents = getLocalEvents().filter(e => e.id !== id);
  saveLocalEvents(currentEvents);

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

export async function clearAllEvents() {
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

export async function getSettings() {
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

  const db = await openDatabase();
  if (!db) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
      return raw ? { ...defaultSettings, ...JSON.parse(raw) } : defaultSettings;
    } catch (e) {
      return defaultSettings;
    }
  }

  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(['settings'], 'readonly');
      const store = transaction.objectStore('settings');
      const request = store.get('app_settings');

      request.onsuccess = () => {
        if (request.result && request.result.value) {
          resolve({ ...defaultSettings, ...request.result.value });
        } else {
          resolve(defaultSettings);
        }
      };

      request.onerror = () => resolve(defaultSettings);
    } catch (e) {
      resolve(defaultSettings);
    }
  });
}

export async function saveSettings(settings) {
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
export async function saveCustomAudio(dataUrl, fileName) {
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
export async function getCustomAudio() {
  const db = await openDatabase();
  if (!db) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CUSTOM_AUDIO);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(['custom_audio'], 'readonly');
      const store = transaction.objectStore('custom_audio');
      const request = store.get('user_alarm_sound');

      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result);
        } else {
          try {
            const raw = localStorage.getItem(STORAGE_KEY_CUSTOM_AUDIO);
            resolve(raw ? JSON.parse(raw) : null);
          } catch(e) {
            resolve(null);
          }
        }
      };

      request.onerror = () => resolve(null);
    } catch (e) {
      resolve(null);
    }
  });
}

/**
 * Menghapus audio kustom
 */
export async function deleteCustomAudio() {
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
export async function getCustomAudio() {
  const db = await openDatabase();
  if (!db) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CUSTOM_AUDIO);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(['custom_audio'], 'readonly');
      const store = transaction.objectStore('custom_audio');
      const request = store.get('user_alarm_sound');

      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result);
        } else {
          try {
            const raw = localStorage.getItem(STORAGE_KEY_CUSTOM_AUDIO);
            resolve(raw ? JSON.parse(raw) : null);
          } catch(e) {
            resolve(null);
          }
        }
      };

      request.onerror = () => resolve(null);
    } catch (e) {
      resolve(null);
    }
  });
}

/**
 * Menghapus audio kustom
 */
export async function deleteCustomAudio() {
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

