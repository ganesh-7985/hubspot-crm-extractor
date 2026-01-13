/**
 * Content Script for HubSpot CRM Extractor
 * 
 * DOM Selection Strategy:
 * -----------------------
 * 1. CSS Selectors (Primary): Used for main table structures and common elements
 *    - More readable and maintainable
 *    - Better performance than XPath
 *    - HubSpot uses consistent class naming patterns
 * 
 * 2. Data Attributes (Secondary): Used when available (data-test-id, data-selenium-test)
 *    - More stable across HubSpot updates
 *    - HubSpot adds these for their own testing
 * 
 * 3. XPath (Fallback): Used for complex traversals when CSS isn't sufficient
 *    - Text content matching
 *    - Complex parent-child relationships
 * 
 * Handling Dynamic Content:
 * -------------------------
 * - HubSpot uses React with lazy loading
 * - We use MutationObserver to detect when content loads
 * - Implement retry logic with exponential backoff
 * - Wait for specific table/list elements before extraction
 * 
 * View Detection:
 * ---------------
 * - URL pattern matching (contacts, deals, tasks paths)
 * - DOM structure analysis for view-specific elements
 */

import { ContactsExtractor } from './extractors/contacts-extractor.js';
import { DealsExtractor } from './extractors/deals-extractor.js';
import { TasksExtractor } from './extractors/tasks-extractor.js';
import { StatusIndicator } from './ui/status-indicator.js';

class HubSpotExtractor {
  constructor() {
    this.statusIndicator = new StatusIndicator();
    this.extractors = {
      contacts: new ContactsExtractor(),
      deals: new DealsExtractor(),
      tasks: new TasksExtractor()
    };
    this.mutationObserver = null;
    this.domChangeTimeout = null;
  }

  /**
   * Initialize the content script
   */
  init() {
    // Listen for messages from service worker
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message).then(sendResponse);
      return true;
    });

    // Set up DOM change detection for re-extraction prompts
    this.setupDOMChangeDetection();

    console.log('[HubSpot Extractor] Content script initialized');
  }

  /**
   * Handle incoming messages
   */
  async handleMessage(message) {
    const { type } = message;

    switch (type) {
      case 'START_EXTRACTION':
        return await this.startExtraction();
      case 'CHECK_VIEW':
        return this.detectCurrentView();
      default:
        return { success: false, error: 'Unknown message type' };
    }
  }

  /**
   * Detect which HubSpot view the user is currently on
   */
  detectCurrentView() {
    const url = window.location.href;
    const pathname = window.location.pathname;

    // URL-based detection
    if (pathname.includes('/contacts/') || url.includes('objectTypeId=0-1')) {
      return { view: 'contacts', detected: true };
    }
    if (pathname.includes('/deals/') || url.includes('objectTypeId=0-3')) {
      return { view: 'deals', detected: true };
    }
    if (pathname.includes('/tasks/') || pathname.includes('/tasks')) {
      return { view: 'tasks', detected: true };
    }

    // DOM-based detection as fallback
    const pageTitle = document.querySelector('h1, [data-test-id="page-title"]');
    if (pageTitle) {
      const titleText = pageTitle.textContent.toLowerCase();
      if (titleText.includes('contact')) return { view: 'contacts', detected: true };
      if (titleText.includes('deal')) return { view: 'deals', detected: true };
      if (titleText.includes('task')) return { view: 'tasks', detected: true };
    }

    return { view: null, detected: false };
  }

  /**
   * Start the extraction process
   */
  async startExtraction() {
    const viewInfo = this.detectCurrentView();
    
    this.statusIndicator.show('extracting', `Detecting view...`);

    if (!viewInfo.detected) {
      this.statusIndicator.show('error', 'Not on a HubSpot list view. Navigate to Contacts, Deals, or Tasks.');
      return { success: false, error: 'Not on a supported HubSpot view' };
    }

    const { view } = viewInfo;
    this.statusIndicator.show('extracting', `Extracting ${view}...`);

    try {
      // Wait for content to be fully loaded
      await this.waitForContent(view);

      // Extract data based on view
      const extractor = this.extractors[view];
      const data = await extractor.extract();

      if (!data || data.length === 0) {
        this.statusIndicator.show('warning', `No ${view} found on this page`);
        return { success: true, view, data: [], count: 0 };
      }

      // Send data to service worker for storage
      const saveResult = await chrome.runtime.sendMessage({
        type: 'SAVE_EXTRACTED_DATA',
        payload: {
          dataType: view,
          data: data,
          tabId: await this.getTabId()
        }
      });

      if (saveResult.success) {
        this.statusIndicator.show('success', `Extracted ${data.length} ${view}`);
        
        // Auto-hide after 3 seconds
        setTimeout(() => this.statusIndicator.hide(), 3000);
        
        return { success: true, view, count: data.length };
      } else {
        throw new Error(saveResult.error || 'Failed to save data');
      }

    } catch (error) {
      console.error('[HubSpot Extractor] Extraction error:', error);
      this.statusIndicator.show('error', `Error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Wait for dynamic content to load
   */
  async waitForContent(view) {
    const selectors = {
      contacts: '[data-test-id="table"], .private-table, table[data-selenium-test]',
      deals: '[data-test-id="table"], .private-table, .deal-board, table',
      tasks: '[data-test-id="table"], .private-table, .tasks-table, table'
    };

    const selector = selectors[view];
    const maxWait = 10000; // 10 seconds max
    const interval = 500;
    let elapsed = 0;

    while (elapsed < maxWait) {
      const element = document.querySelector(selector);
      if (element && element.querySelector('tr, .table-row, [data-test-id="table-row"]')) {
        return true;
      }
      await this.sleep(interval);
      elapsed += interval;
    }

    // Even if table not found, try extraction anyway
    return true;
  }

  /**
   * Set up MutationObserver to detect DOM changes
   */
  setupDOMChangeDetection() {
    const targetNode = document.body;
    const config = { childList: true, subtree: true };

    this.mutationObserver = new MutationObserver((mutations) => {
      // Debounce DOM change detection
      clearTimeout(this.domChangeTimeout);
      this.domChangeTimeout = setTimeout(() => {
        this.checkForSignificantChanges(mutations);
      }, 1000);
    });

    this.mutationObserver.observe(targetNode, config);
  }

  /**
   * Check if DOM changes warrant a re-extraction prompt
   */
  checkForSignificantChanges(mutations) {
    const significantSelectors = [
      '[data-test-id="table"]',
      '.private-table',
      'table tbody'
    ];

    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            for (const selector of significantSelectors) {
              if (node.matches?.(selector) || node.querySelector?.(selector)) {
                // Significant change detected - could prompt user here
                console.log('[HubSpot Extractor] Table content changed');
                return;
              }
            }
          }
        }
      }
    }
  }

  /**
   * Get current tab ID
   */
  async getTabId() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'GET_TAB_ID' }, (response) => {
        resolve(response?.tabId || Date.now());
      });
    });
  }

  /**
   * Utility sleep function
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const extractor = new HubSpotExtractor();
    extractor.init();
  });
} else {
  const extractor = new HubSpotExtractor();
  extractor.init();
}
