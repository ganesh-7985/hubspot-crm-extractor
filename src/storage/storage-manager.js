// Storage Manager handles all data operations for the extension
// It prevents duplicate records and manages locks to avoid conflicts when multiple tabs extract data
export class StorageManager {
  constructor() {
    this.LOCK_TIMEOUT = 30000; // 30 seconds lock timeout
    this.STORAGE_KEY = 'hubspot_data';
    this.LOCK_KEY = 'extraction_lock';
  }

  // Set up storage with empty arrays when extension is first installed
  async initializeStorage() {
    const existing = await this.getAllData();
    if (!existing || !existing.contacts) {
      await chrome.storage.local.set({
        [this.STORAGE_KEY]: {
          contacts: [],
          deals: [],
          tasks: [],
          lastSync: null
        },
        [this.LOCK_KEY]: {
          tabId: null,
          timestamp: null
        }
      });
    }
    return { success: true };
  }

  // Fetch all contacts, deals, and tasks from storage
  async getAllData() {
    const result = await chrome.storage.local.get(this.STORAGE_KEY);
    return result[this.STORAGE_KEY] || {
      contacts: [],
      deals: [],
      tasks: [],
      lastSync: null
    };
  }

  // Try to get a lock so only one tab can save data at a time
  async acquireLock(tabId) {
    const result = await chrome.storage.local.get(this.LOCK_KEY);
    const lock = result[this.LOCK_KEY];

    // If another tab has the lock and it hasn't expired yet, we can't proceed
    if (lock?.tabId && lock?.timestamp) {
      const elapsed = Date.now() - lock.timestamp;
      if (elapsed < this.LOCK_TIMEOUT) {
        return false;
      }
    }

    // Lock is available, so grab it
    await chrome.storage.local.set({
      [this.LOCK_KEY]: {
        tabId: tabId,
        timestamp: Date.now()
      }
    });

    return true;
  }

  // Release the lock when we're done saving data
  async releaseLock(tabId) {
    const result = await chrome.storage.local.get(this.LOCK_KEY);
    const lock = result[this.LOCK_KEY];

    // Make sure we actually own this lock before releasing it
    if (lock?.tabId === tabId) {
      await chrome.storage.local.set({
        [this.LOCK_KEY]: {
          tabId: null,
          timestamp: null
        }
      });
    }
    return true;
  }

  // Save new data and merge it with existing records to avoid duplicates
  async saveData(dataType, newData) {
    if (!['contacts', 'deals', 'tasks'].includes(dataType)) {
      return { success: false, error: 'Invalid data type' };
    }

    const currentData = await this.getAllData();
    const existingRecords = currentData[dataType] || [];

    // Merge new records with existing ones, removing duplicates
    const mergedData = this.mergeRecords(existingRecords, newData);

    // Save the merged data back to storage
    currentData[dataType] = mergedData;
    currentData.lastSync = Date.now();

    await chrome.storage.local.set({
      [this.STORAGE_KEY]: currentData
    });

    return {
      success: true,
      added: newData.length,
      total: mergedData.length
    };
  }

  // Combine old and new records using IDs to prevent duplicates
  mergeRecords(existing, incoming) {
    const recordMap = new Map();

    // First, put all existing records into a map
    existing.forEach(record => {
      recordMap.set(record.id, record);
    });

    // Then add or update with the new records
    incoming.forEach(record => {
      if (record.id) {
        // If record exists, update it; otherwise add it as new
        recordMap.set(record.id, {
          ...recordMap.get(record.id),
          ...record,
          updatedAt: Date.now()
        });
      }
    });

    return Array.from(recordMap.values());
  }

  // Remove a specific record by its ID
  async deleteRecord(dataType, recordId) {
    if (!['contacts', 'deals', 'tasks'].includes(dataType)) {
      return { success: false, error: 'Invalid data type' };
    }

    const currentData = await this.getAllData();
    const records = currentData[dataType] || [];
    
    const filteredRecords = records.filter(r => r.id !== recordId);
    
    if (filteredRecords.length === records.length) {
      return { success: false, error: 'Record not found' };
    }

    currentData[dataType] = filteredRecords;
    currentData.lastSync = Date.now();

    await chrome.storage.local.set({
      [this.STORAGE_KEY]: currentData
    });

    return { success: true };
  }

  // Wipe out all stored contacts, deals, and tasks
  async clearAllData() {
    await chrome.storage.local.set({
      [this.STORAGE_KEY]: {
        contacts: [],
        deals: [],
        tasks: [],
        lastSync: Date.now()
      }
    });
    return { success: true };
  }

  // Get info about when we last synced and how many records we have
  async getSyncStatus() {
    const data = await this.getAllData();
    return {
      lastSync: data.lastSync,
      counts: {
        contacts: data.contacts?.length || 0,
        deals: data.deals?.length || 0,
        tasks: data.tasks?.length || 0
      }
    };
  }
}
