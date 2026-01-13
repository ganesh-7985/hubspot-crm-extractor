// Service Worker acts as the brain of the extension
// It handles messages between the popup and content scripts, and manages data storage
import { StorageManager } from '../storage/storage-manager.js';

const storageManager = new StorageManager();

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse);
  return true; // Keep the connection open for async responses
});

async function handleMessage(message, sender) {
  const { type, payload } = message;

  switch (type) {
    case 'EXTRACT_DATA':
      return await handleExtractData(sender.tab?.id);

    case 'SAVE_EXTRACTED_DATA':
      return await handleSaveData(payload);

    case 'GET_ALL_DATA':
      return await storageManager.getAllData();

    case 'DELETE_RECORD':
      return await storageManager.deleteRecord(payload.dataType, payload.id);

    case 'CLEAR_ALL_DATA':
      return await storageManager.clearAllData();

    case 'GET_SYNC_STATUS':
      return await storageManager.getSyncStatus();

    case 'EXPORT_DATA':
      return await handleExportData(payload.format);

    case 'EXTRACTION_STATUS':
      // Send extraction progress updates to the popup
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
    // Tell the content script on the current tab to start extracting data
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
    // Get a lock to prevent multiple tabs from saving at the same time
    const lockAcquired = await storageManager.acquireLock(tabId);
    if (!lockAcquired) {
      return { success: false, error: 'Another extraction is in progress' };
    }

    const result = await storageManager.saveData(dataType, data);
    await storageManager.releaseLock(tabId);
    
    return result;
  } catch (error) {
    await storageManager.releaseLock(tabId);
    return { success: false, error: error.message };
  }
}

async function handleExportData(format) {
  try {
    const data = await storageManager.getAllData();
    
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
  
  // Build CSV sections for contacts
  if (data.contacts?.length) {
    sections.push('=== CONTACTS ===');
    sections.push('ID,Name,Email,Phone,Owner');
    data.contacts.forEach(c => {
      sections.push(`"${c.id}","${c.name}","${c.email}","${c.phone}","${c.owner}"`);
    });
  }
  
  // Build CSV sections for deals
  if (data.deals?.length) {
    sections.push('\n=== DEALS ===');
    sections.push('ID,Name,Amount,Stage,Close Date');
    data.deals.forEach(d => {
      sections.push(`"${d.id}","${d.name}","${d.amount}","${d.stage}","${d.closeDate}"`);
    });
  }
  
  // Build CSV sections for tasks
  if (data.tasks?.length) {
    sections.push('\n=== TASKS ===');
    sections.push('ID,Title,Due Date,Type,Associated Record');
    data.tasks.forEach(t => {
      sections.push(`"${t.id}","${t.title}","${t.dueDate}","${t.type}","${t.record}"`);
    });
  }
  
  return sections.join('\n');
}

// Watch for storage changes and notify all tabs so they stay in sync
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.hubspot_data) {
    // Let everyone know the data has been updated
    chrome.runtime.sendMessage({
      type: 'DATA_UPDATED',
      payload: changes.hubspot_data.newValue
    }).catch(() => {});
  }
});

// Set things up when the extension is first installed
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('HubSpot CRM Extractor installed');
    // Create empty storage structure
    storageManager.initializeStorage();
  }
});
