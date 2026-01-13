/**
 * Service Worker for HubSpot CRM Extractor (Bundled)
 * Handles message passing between content scripts and popup
 * Manages storage operations and coordinates extraction across tabs
 */

// ============================================
// STORAGE MANAGER
// ============================================

const LOCK_TIMEOUT = 30000;
const STORAGE_KEY = 'hubspot_data';
const LOCK_KEY = 'extraction_lock';

async function initializeStorage() {
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

async function acquireLock(tabId) {
  const result = await chrome.storage.local.get(LOCK_KEY);
  const lock = result[LOCK_KEY];

  if (lock?.tabId && lock?.timestamp) {
    const elapsed = Date.now() - lock.timestamp;
    if (elapsed < LOCK_TIMEOUT) {
      return false;
    }
  }

  await chrome.storage.local.set({
    [LOCK_KEY]: {
      tabId: tabId,
      timestamp: Date.now()
    }
  });

  return true;
}

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

function mergeRecords(existing, incoming) {
  const recordMap = new Map();

  existing.forEach(record => {
    recordMap.set(record.id, record);
  });

  incoming.forEach(record => {
    if (record.id) {
      recordMap.set(record.id, {
        ...recordMap.get(record.id),
        ...record,
        updatedAt: Date.now()
      });
    }
  });

  return Array.from(recordMap.values());
}

async function saveData(dataType, newData) {
  if (!['contacts', 'deals', 'tasks'].includes(dataType)) {
    return { success: false, error: 'Invalid data type' };
  }

  const currentData = await getAllData();
  const existingRecords = currentData[dataType] || [];

  const mergedData = mergeRecords(existingRecords, newData);

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

// ============================================
// MESSAGE HANDLERS
// ============================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse);
  return true;
});

async function handleMessage(message, sender) {
  const { type, payload } = message;

  switch (type) {
    case 'EXTRACT_DATA':
      return await handleExtractData(sender.tab?.id);

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

async function handleExtractData(tabId) {
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

// ============================================
// STORAGE CHANGE LISTENER (Real-time sync)
// ============================================

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.hubspot_data) {
    chrome.runtime.sendMessage({
      type: 'DATA_UPDATED',
      payload: changes.hubspot_data.newValue
    }).catch(() => {});
  }
});

// ============================================
// INSTALLATION HANDLER
// ============================================

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('HubSpot CRM Extractor installed');
    initializeStorage();
  }
});
