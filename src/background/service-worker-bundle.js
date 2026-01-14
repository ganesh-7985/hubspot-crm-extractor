// Service Worker for HubSpot CRM Extractor
// Handles message passing, storage operations, and cross-tab coordination

const LOCK_TIMEOUT = 30000;
const STORAGE_KEY = 'hubspot_data';
const LOCK_KEY = 'extraction_lock';

async function initializeStorage() {
  // Check if storage already has data structure
  const existing = await getAllData();
  if (!existing || !existing.contacts) {
    await chrome.storage.local.set({
      [STORAGE_KEY]: {
        contacts: [],
        deals: [],
        tasks: [],
        lastSync: null
      },
      [LOCK_KEY]: {
        tabId: null,
        timestamp: null
      }
    });
  }
  return { success: true };
}

async function getAllData() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] || {
    contacts: [],
    deals: [],
    tasks: [],
    lastSync: null
  };
}

/**
 * Acquire a mutex lock for the given tab to prevent race conditions.
 * @param {number} tabId
 * @returns {Promise<boolean>}
 */
async function acquireLock(tabId) {
  // Try to acquire mutex lock for this tab to prevent race conditions
  const result = await chrome.storage.local.get(LOCK_KEY);
  const lock = result[LOCK_KEY] || { tabId: null, timestamp: null };
  const now = Date.now();
  
  // Check if lock is expired or available
  const elapsed = lock.timestamp ? now - lock.timestamp : LOCK_TIMEOUT + 1;
  if (elapsed < LOCK_TIMEOUT) {
    return false;
  }

  // Acquire the lock
  await chrome.storage.local.set({
    [LOCK_KEY]: {
      tabId: tabId,
      timestamp: now
    }
  });

  return true;
}

/**
 * Release the mutex lock for the given tab.
 * @param {number} tabId
 * @returns {Promise<boolean>}
 */
async function releaseLock(tabId) {
  const result = await chrome.storage.local.get(LOCK_KEY);
  const lock = result[LOCK_KEY];

  if (lock?.tabId === tabId) {
    await chrome.storage.local.set({
      [LOCK_KEY]: {
        tabId: null,
        timestamp: null
      }
    });
  }
  return true;
}

/**
 * Merge existing records with incoming records, deduplicating by ID.
 * @param {Array} existing
 * @param {Array} incoming
 * @param {string} type
 * @returns {Array}
 */
function mergeRecords(existing, incoming, type) {
  // Create a map for efficient deduplication by ID
  const recordMap = new Map(existing.map(item => [item.id, item]));

  // Only add new items that don't already exist
  incoming.forEach(item => {
    if (!recordMap.has(item.id)) {
      recordMap.set(item.id, {
        ...recordMap.get(item.id),
        ...item,
        updatedAt: Date.now()
      });
    }
  });

  return Array.from(recordMap.values());
}

/**
 * Save data to storage, deduplicating by ID.
 * @param {string} dataType
 * @param {Array} newData
 * @returns {Promise<{success: boolean, added: number, total: number}>}
 */
async function saveData(dataType, newData) {
  if (!['contacts', 'deals', 'tasks'].includes(dataType)) {
    return { success: false, error: 'Invalid data type' };
  }

  const currentData = await getAllData();
  const existingRecords = currentData[dataType] || [];

  const mergedData = mergeRecords(existingRecords, newData, dataType);

  currentData[dataType] = mergedData;
  currentData.lastSync = Date.now();

  await chrome.storage.local.set({
    [STORAGE_KEY]: currentData
  });

  return {
    success: true,
    added: newData.length,
    total: mergedData.length
  };
}

/**
 * Delete a record from storage by ID.
 * @param {string} dataType
 * @param {string} recordId
 * @returns {Promise<{success: boolean, error: string}>}
 */
async function deleteRecord(dataType, recordId) {
  if (!['contacts', 'deals', 'tasks'].includes(dataType)) {
    return { success: false, error: 'Invalid data type' };
  }

  const currentData = await getAllData();
  const records = currentData[dataType] || [];
  
  const filteredRecords = records.filter(r => r.id !== recordId);
  
  if (filteredRecords.length === records.length) {
    return { success: false, error: 'Record not found' };
  }

  currentData[dataType] = filteredRecords;
  currentData.lastSync = Date.now();

  await chrome.storage.local.set({
    [STORAGE_KEY]: currentData
  });

  return { success: true };
}

/**
 * Clear all data from storage.
 * @returns {Promise<{success: boolean}>}
 */
async function clearAllData() {
  await chrome.storage.local.set({
    [STORAGE_KEY]: {
      contacts: [],
      deals: [],
      tasks: [],
      lastSync: Date.now()
    }
  });
  return { success: true };
}

/**
 * Get the current sync status.
 * @returns {Promise<{lastSync: number, counts: {contacts: number, deals: number, tasks: number}}>}
 */
async function getSyncStatus() {
  const data = await getAllData();
  return {
    lastSync: data.lastSync,
    counts: {
      contacts: data.contacts?.length || 0,
      deals: data.deals?.length || 0,
      tasks: data.tasks?.length || 0
    }
  };
}

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse);
  return true;
});

/**
 * Handle incoming messages from popup and content scripts.
 * @param {object} message
 * @param {object} sender
 * @returns {Promise<object>}
 */
async function handleMessage(message, sender) {
  const { type, payload } = message;

  switch (type) {
    case 'EXTRACT_DATA':
      return await handleExtractData(payload, sender.tab?.id);

    case 'SAVE_EXTRACTED_DATA':
      return await handleSaveData(payload);

    case 'GET_ALL_DATA':
      return await getAllData();

    case 'DELETE_RECORD':
      return await deleteRecord(payload.dataType, payload.id);

    case 'CLEAR_ALL_DATA':
      return await clearAllData();

    case 'GET_SYNC_STATUS':
      return await getSyncStatus();

    case 'EXPORT_DATA':
      return await handleExportData(payload.format);

    case 'EXTRACTION_STATUS':
      chrome.runtime.sendMessage({
        type: 'EXTRACTION_STATUS_UPDATE',
        payload: payload
      }).catch(() => {});
      return { success: true };

    default:
      return { success: false, error: 'Unknown message type' };
  }
}

/**
 * Handle extract data request.
 * @param {object} payload
 * @param {number} tabId
 * @returns {Promise<object>}
 */
async function handleExtractData(payload, tabId) {
  if (!tabId) {
    return { success: false, error: 'No active tab found' };
  }

  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      type: 'START_EXTRACTION'
    });
    return response;
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Handle save data request.
 * @param {object} payload
 * @returns {Promise<object>}
 */
async function handleSaveData(payload) {
  const { dataType, data, tabId } = payload;
  
  try {
    const lockAcquired = await acquireLock(tabId);
    if (!lockAcquired) {
      return { success: false, error: 'Another extraction is in progress' };
    }

    const result = await saveData(dataType, data);
    await releaseLock(tabId);
    
    return result;
  } catch (error) {
    await releaseLock(tabId);
    return { success: false, error: error.message };
  }
}

async function handleExportData(format) {
  try {
    const data = await getAllData();
    
    if (format === 'json') {
      return {
        success: true,
        data: JSON.stringify(data, null, 2),
        filename: `hubspot-export-${Date.now()}.json`
      };
    } else if (format === 'csv') {
      const csvData = convertToCSV(data);
      return {
        success: true,
        data: csvData,
        filename: `hubspot-export-${Date.now()}.csv`
      };
    }
    
    return { success: false, error: 'Invalid export format' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function convertToCSV(data) {
  const sections = [];
  
  if (data.contacts?.length) {
    sections.push('=== CONTACTS ===');
    sections.push('ID,Name,Email,Phone,Owner');
    data.contacts.forEach(c => {
      sections.push(`"${c.id || ''}","${c.name || ''}","${c.email || ''}","${c.phone || ''}","${c.owner || ''}"`);
    });
  }
  
  if (data.deals?.length) {
    sections.push('\n=== DEALS ===');
    sections.push('ID,Name,Amount,Stage,Close Date');
    data.deals.forEach(d => {
      sections.push(`"${d.id || ''}","${d.name || ''}","${d.amount || ''}","${d.stage || ''}","${d.closeDate || ''}"`);
    });
  }
  
  if (data.tasks?.length) {
    sections.push('\n=== TASKS ===');
    sections.push('ID,Title,Due Date,Type,Associated Record');
    data.tasks.forEach(t => {
      sections.push(`"${t.id || ''}","${t.title || ''}","${t.dueDate || ''}","${t.type || ''}","${t.record || ''}"`);
    });
  }
  
  return sections.join('\n');
}

// Broadcast storage changes to all tabs for real-time sync
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.hubspot_data) {
    chrome.runtime.sendMessage({
      type: 'DATA_UPDATED',
      payload: changes.hubspot_data.newValue
    }).catch(() => {});
  }
});

// Initialize storage when extension is first installed
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('HubSpot CRM Extractor installed');
    initializeStorage();
  }
});
