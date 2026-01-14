// Content script for HubSpot CRM Extractor
// Combines all extraction modules into a single bundle for Chrome Extension compatibility

class StatusIndicator {
  constructor() {
    this.container = null;
    this.shadowRoot = null;
    this.isVisible = false;
  }

  createContainer() {
    // Create a shadow DOM container for isolated styling
    if (this.container) return;

    this.container = document.createElement('div');
    this.container.id = 'hubspot-extractor-status';
    this.container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    this.shadowRoot = this.container.attachShadow({ mode: 'closed' });

    const styles = document.createElement('style');
    styles.textContent = `
      .status-indicator {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 16px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        font-size: 14px;
        font-weight: 500;
        animation: slideIn 0.3s ease-out;
        max-width: 320px;
      }
      @keyframes slideIn {
        from { opacity: 0; transform: translateX(20px); }
        to { opacity: 1; transform: translateX(0); }
      }
      @keyframes slideOut {
        from { opacity: 1; transform: translateX(0); }
        to { opacity: 0; transform: translateX(20px); }
      }
      .status-indicator.hiding {
        animation: slideOut 0.3s ease-in forwards;
      }
      .status-indicator.extracting {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
      }
      .status-indicator.success {
        background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
        color: white;
      }
      .status-indicator.error {
        background: linear-gradient(135deg, #eb3349 0%, #f45c43 100%);
        color: white;
      }
      .status-indicator.warning {
        background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        color: white;
      }
      .spinner {
        width: 20px;
        height: 20px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top-color: white;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      .message { flex: 1; line-height: 1.4; }
      .close-btn {
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: white;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        transition: background 0.2s;
      }
      .close-btn:hover {
        background: rgba(255, 255, 255, 0.3);
      }
    `;

    this.shadowRoot.appendChild(styles);
    document.body.appendChild(this.container);
  }

  show(message, type = 'info') {
    this.createContainer();
    // Display status message to user

    const icons = {
      extracting: '<div class="spinner"></div>',
      success: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
      error: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`,
      warning: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`
    };

    const indicator = document.createElement('div');
    indicator.className = `status-indicator ${type}`;
    indicator.innerHTML = `
      ${icons[type] || icons.extracting}
      <span class="message">${this.escapeHtml(message)}</span>
      <button class="close-btn" aria-label="Close">×</button>
    `;

    const existingIndicator = this.shadowRoot.querySelector('.status-indicator');
    if (existingIndicator) existingIndicator.remove();

    this.shadowRoot.appendChild(indicator);
    this.isVisible = true;

    indicator.querySelector('.close-btn').addEventListener('click', () => this.hide());

    chrome.runtime.sendMessage({
      type: 'EXTRACTION_STATUS',
      payload: { status: type, message }
    }).catch(() => {});
  }

  hide() {
    if (!this.isVisible || !this.shadowRoot) return;
    const indicator = this.shadowRoot.querySelector('.status-indicator');
    if (indicator) {
      indicator.classList.add('hiding');
      setTimeout(() => {
        indicator.remove();
        this.isVisible = false;
      }, 300);
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

class ContactsExtractor {
  constructor() {
    this.tableSelectors = [
      '[data-test-id="table"]',
      '[data-selenium-test="table"]',
      '.private-table',
      'table.table',
      'table'
    ];
    this.rowSelectors = [
      '[data-test-id="table-row"]',
      '[data-selenium-test="table-row"]',
      'tbody tr',
      'tr[data-row-id]'
    ];
  }

  async extract() {
    const contacts = [];
    const table = this.findTable();
    if (!table) return contacts;

    const rows = this.getRows(table);
    console.log(`[Contacts Extractor] Found ${rows.length} rows`);

    for (const row of rows) {
      try {
        const contact = this.extractContactFromRow(row);
        if (contact && contact.id) contacts.push(contact);
      } catch (error) {
        console.warn('[Contacts Extractor] Error:', error);
      }
    }
    return contacts;
  }

  findTable() {
    for (const selector of this.tableSelectors) {
      const table = document.querySelector(selector);
      if (table) return table;
    }
    return null;
  }

  getRows(table) {
    for (const selector of this.rowSelectors) {
      const rows = table.querySelectorAll(selector);
      if (rows.length > 0) {
        return Array.from(rows).filter(row => {
          return !row.closest('thead') && 
                 !row.querySelector('th') &&
                 row.querySelectorAll('td, [role="cell"]').length > 0;
        });
      }
    }
    return [];
  }

  extractContactFromRow(row) {
    const cells = row.querySelectorAll('td, [role="cell"]');
    if (cells.length < 2) return null;

    const rowId = row.getAttribute('data-row-id') || 
                  row.getAttribute('data-test-id') ||
                  this.generateId(row);

    return {
      id: rowId,
      name: this.extractName(row, cells) || 'Unknown',
      email: this.extractEmail(row, cells) || '',
      phone: this.extractPhone(row, cells) || '',
      owner: this.extractOwner(row, cells) || '',
      extractedAt: Date.now()
    };
  }

  extractName(row, cells) {
    const selectors = ['[data-test-id="contact-name"]', 'a[href*="/contact/"]', '.private-link'];
    for (const selector of selectors) {
      const el = row.querySelector(selector);
      if (el?.textContent?.trim()) return el.textContent.trim();
    }
    const link = row.querySelector('td a');
    if (link?.textContent?.trim()) return link.textContent.trim();
    return cells[0]?.textContent?.trim();
  }

  extractEmail(row, cells) {
    const mailLink = row.querySelector('a[href^="mailto:"]');
    if (mailLink) return mailLink.getAttribute('href').replace('mailto:', '');
    
    const emailPattern = /[\w.-]+@[\w.-]+\.\w+/;
    for (const cell of cells) {
      const match = cell.textContent?.match(emailPattern);
      if (match) return match[0];
    }
    return null;
  }

  extractPhone(row, cells) {
    const telLink = row.querySelector('a[href^="tel:"]');
    if (telLink) return telLink.getAttribute('href').replace('tel:', '');
    
    const phonePattern = /[\d\s\-\(\)\+]{7,}/;
    for (const cell of cells) {
      const text = cell.textContent?.trim();
      if (text && this.looksLikePhone(text)) {
        const match = text.match(phonePattern);
        if (match) return match[0].trim();
      }
    }
    return null;
  }

  extractOwner(row, cells) {
    const selectors = ['[data-test-id="owner"]', '[data-test-id="contact-owner"]'];
    for (const selector of selectors) {
      const el = row.querySelector(selector);
      if (el?.textContent?.trim()) return el.textContent.trim();
    }
    
    const headers = document.querySelectorAll('th, [role="columnheader"]');
    let ownerIndex = -1;
    headers.forEach((header, index) => {
      if (header.textContent?.toLowerCase().includes('owner')) ownerIndex = index;
    });
    if (ownerIndex >= 0 && cells[ownerIndex]) {
      return cells[ownerIndex].textContent?.trim() || '';
    }
    return null;
  }

  looksLikePhone(str) {
    const digits = str.replace(/\D/g, '');
    return digits.length >= 7 && digits.length <= 15;
  }

  generateId(row) {
    const text = row.textContent?.substring(0, 100) || '';
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash = hash & hash;
    }
    return `contact-${Math.abs(hash)}`;
  }
}

class DealsExtractor {
  constructor() {
    this.tableSelectors = [
      '[data-test-id="table"]',
      '[data-selenium-test="table"]',
      '.private-table',
      'table'
    ];
    this.rowSelectors = [
      '[data-test-id="table-row"]',
      '[data-selenium-test="table-row"]',
      'tbody tr'
    ];
  }

  async extract() {
    const deals = [];
    const board = document.querySelector('.deal-board, [data-test-id="deal-board"]');
    if (board) return this.extractFromBoard(board);

    const table = this.findTable();
    if (!table) return deals;

    const rows = this.getRows(table);
    console.log(`[Deals Extractor] Found ${rows.length} rows`);

    for (const row of rows) {
      try {
        const deal = this.extractDealFromRow(row);
        if (deal && deal.id) deals.push(deal);
      } catch (error) {
        console.warn('[Deals Extractor] Error:', error);
      }
    }
    return deals;
  }

  findTable() {
    for (const selector of this.tableSelectors) {
      const table = document.querySelector(selector);
      if (table) return table;
    }
    return null;
  }

  getRows(table) {
    for (const selector of this.rowSelectors) {
      const rows = table.querySelectorAll(selector);
      if (rows.length > 0) {
        return Array.from(rows).filter(row => {
          return !row.closest('thead') && !row.querySelector('th');
        });
      }
    }
    return [];
  }

  extractFromBoard(board) {
    const deals = [];
    const cards = board.querySelectorAll('[data-test-id="deal-card"], .deal-card, .pipeline-card');
    
    const columns = board.querySelectorAll('[data-test-id="pipeline-column"], .pipeline-column');
    const stageMap = new Map();
    
    columns.forEach(col => {
      const header = col.querySelector('[data-test-id="column-header"], .column-header, h3, h4');
      const stageName = header?.textContent?.trim() || 'Unknown';
      col.querySelectorAll('[data-test-id="deal-card"], .deal-card').forEach(card => {
        stageMap.set(card, stageName);
      });
    });

    cards.forEach(card => {
      const id = card.getAttribute('data-deal-id') || this.generateId(card);
      const nameEl = card.querySelector('[data-test-id="deal-name"], .deal-name, a[href*="/deal/"], h4');
      const amountEl = card.querySelector('[data-test-id="deal-amount"], .deal-amount');
      
      deals.push({
        id,
        name: nameEl?.textContent?.trim() || 'Unknown Deal',
        amount: this.extractAmount(amountEl?.textContent || card.textContent),
        stage: stageMap.get(card) || 'Unknown',
        closeDate: '',
        extractedAt: Date.now()
      });
    });

    return deals;
  }

  extractDealFromRow(row) {
    const cells = row.querySelectorAll('td, [role="cell"]');
    if (cells.length < 2) return null;

    const rowId = row.getAttribute('data-row-id') || this.generateId(row);

    return {
      id: rowId,
      name: this.extractName(row, cells) || 'Unknown Deal',
      amount: this.extractAmountFromRow(row, cells),
      stage: this.extractStage(row, cells) || '',
      closeDate: this.extractCloseDate(row, cells) || '',
      extractedAt: Date.now()
    };
  }

  extractName(row, cells) {
    const selectors = ['[data-test-id="deal-name"]', 'a[href*="/deal/"]', '.private-link'];
    for (const selector of selectors) {
      const el = row.querySelector(selector);
      if (el?.textContent?.trim()) return el.textContent.trim();
    }
    return cells[0]?.textContent?.trim();
  }

  extractAmountFromRow(row, cells) {
    const el = row.querySelector('[data-test-id="amount"], [data-property="amount"]');
    if (el?.textContent) return this.extractAmount(el.textContent);
    
    for (const cell of cells) {
      const amount = this.extractAmount(cell.textContent);
      if (amount !== null) return amount;
    }
    return null;
  }

  extractAmount(text) {
    if (!text) return null;
    const match = text.match(/[\$€£¥]?\s*[\d,]+\.?\d*/);
    if (match) {
      const num = parseFloat(match[0].replace(/[^\d.]/g, ''));
      if (!isNaN(num)) return num;
    }
    return null;
  }

  extractStage(row, cells) {
    const el = row.querySelector('[data-test-id="stage"], [data-test-id="deal-stage"]');
    if (el?.textContent?.trim()) return el.textContent.trim();
    
    const headers = document.querySelectorAll('th, [role="columnheader"]');
    let idx = -1;
    headers.forEach((h, i) => {
      if (h.textContent?.toLowerCase().includes('stage')) idx = i;
    });
    if (idx >= 0 && cells[idx]) return cells[idx].textContent?.trim();
    return null;
  }

  extractCloseDate(row, cells) {
    const el = row.querySelector('[data-test-id="close-date"], [data-property="closedate"]');
    if (el?.textContent?.trim()) return el.textContent.trim();
    
    const headers = document.querySelectorAll('th, [role="columnheader"]');
    let idx = -1;
    headers.forEach((h, i) => {
      const t = h.textContent?.toLowerCase() || '';
      if (t.includes('close') && t.includes('date')) idx = i;
    });
    if (idx >= 0 && cells[idx]) return cells[idx].textContent?.trim();
    return null;
  }

  generateId(element) {
    const text = element.textContent?.substring(0, 100) || '';
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash = hash & hash;
    }
    return `deal-${Math.abs(hash)}`;
  }
}

class TasksExtractor {
  constructor() {
    this.tableSelectors = [
      '[data-test-id="table"]',
      '.private-table',
      '.tasks-table',
      'table'
    ];
    this.rowSelectors = [
      '[data-test-id="table-row"]',
      '[data-test-id="task-row"]',
      'tbody tr'
    ];
  }

  async extract() {
    const tasks = [];
    const table = this.findTable();
    if (!table) return tasks;

    const rows = this.getRows(table);
    console.log(`[Tasks Extractor] Found ${rows.length} rows`);

    for (const row of rows) {
      try {
        const task = this.extractTaskFromRow(row);
        if (task && task.id) tasks.push(task);
      } catch (error) {
        console.warn('[Tasks Extractor] Error:', error);
      }
    }
    return tasks;
  }

  findTable() {
    for (const selector of this.tableSelectors) {
      const table = document.querySelector(selector);
      if (table) return table;
    }
    return null;
  }

  getRows(table) {
    for (const selector of this.rowSelectors) {
      const rows = table.querySelectorAll(selector);
      if (rows.length > 0) {
        return Array.from(rows).filter(row => {
          return !row.closest('thead') && !row.querySelector('th');
        });
      }
    }
    return [];
  }

  extractTaskFromRow(row) {
    const cells = row.querySelectorAll('td, [role="cell"]');
    if (cells.length < 2) return null;

    const rowId = row.getAttribute('data-row-id') || this.generateId(row);

    return {
      id: rowId,
      title: this.extractTitle(row, cells) || 'Untitled Task',
      dueDate: this.extractDueDate(row, cells) || '',
      type: this.extractType(row, cells) || this.inferTaskType(row),
      record: this.extractAssociatedRecord(row, cells) || '',
      extractedAt: Date.now()
    };
  }

  extractTitle(row, cells) {
    const selectors = ['[data-test-id="task-title"]', 'a[href*="/task/"]', '.private-link'];
    for (const selector of selectors) {
      const el = row.querySelector(selector);
      if (el?.textContent?.trim()) return el.textContent.trim();
    }
    
    for (const cell of cells) {
      const text = cell.textContent?.trim();
      if (text && text.length > 2 && !cell.querySelector('input[type="checkbox"]')) {
        return text;
      }
    }
    return null;
  }

  extractDueDate(row, cells) {
    const el = row.querySelector('[data-test-id="due-date"], [data-property="hs_task_due_date"]');
    if (el?.textContent?.trim()) return el.textContent.trim();
    
    const headers = document.querySelectorAll('th, [role="columnheader"]');
    let idx = -1;
    headers.forEach((h, i) => {
      if (h.textContent?.toLowerCase().includes('due')) idx = i;
    });
    if (idx >= 0 && cells[idx]) return cells[idx].textContent?.trim();
    return null;
  }

  extractType(row, cells) {
    const el = row.querySelector('[data-test-id="task-type"], [data-property="hs_task_type"]');
    if (el?.textContent?.trim()) return el.textContent.trim();
    
    const headers = document.querySelectorAll('th, [role="columnheader"]');
    let idx = -1;
    headers.forEach((h, i) => {
      if (h.textContent?.toLowerCase().includes('type')) idx = i;
    });
    if (idx >= 0 && cells[idx]) return cells[idx].textContent?.trim();
    return null;
  }

  inferTaskType(element) {
    const text = element.textContent?.toLowerCase() || '';
    if (text.includes('call')) return 'Call';
    if (text.includes('email')) return 'Email';
    if (text.includes('meeting')) return 'Meeting';
    if (text.includes('follow')) return 'Follow-up';
    return 'To-do';
  }

  extractAssociatedRecord(row, cells) {
    const el = row.querySelector('[data-test-id="associated-record"], a[href*="/contact/"], a[href*="/deal/"]');
    if (el?.textContent?.trim()) return el.textContent.trim();
    
    const headers = document.querySelectorAll('th, [role="columnheader"]');
    let idx = -1;
    headers.forEach((h, i) => {
      const t = h.textContent?.toLowerCase() || '';
      if (t.includes('associated') || t.includes('record') || t.includes('contact')) idx = i;
    });
    if (idx >= 0 && cells[idx]) return cells[idx].textContent?.trim();
    return null;
  }

  generateId(element) {
    const text = element.textContent?.substring(0, 100) || '';
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash = hash & hash;
    }
    return `task-${Math.abs(hash)}`;
  }
}

class HubSpotExtractor {
  constructor() {
    // Initialize status indicator and all data extractors
    this.statusIndicator = new StatusIndicator();
    this.extractors = {
      contacts: new ContactsExtractor(),
      deals: new DealsExtractor(),
      tasks: new TasksExtractor()
    };
  }

  init() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message).then(sendResponse);
      return true;
    });
    console.log('[HubSpot Extractor] Content script initialized');
  }

  async handleMessage(message) {
    if (message.type === 'START_EXTRACTION') {
      return await this.startExtraction();
    }
    if (message.type === 'CHECK_VIEW') {
      return this.detectCurrentView();
    }
    return { success: false, error: 'Unknown message type' };
  }

  detectCurrentView() {
    // Determine which HubSpot view we're on (contacts, deals, or tasks)
    const url = window.location.href;
    const pathname = window.location.pathname;

    // Check objectTypeId first (more reliable than pathname)
    if (url.includes('objectTypeId=0-1')) {
      return { view: 'contacts', detected: true };
    }
    if (url.includes('objectTypeId=0-3')) {
      return { view: 'deals', detected: true };
    }
    if (url.includes('objectTypeId=0-27')) {
      return { view: 'tasks', detected: true };
    }

    // Fall back to pathname check
    if (pathname.includes('/contacts/') && url.includes('/objects/0-1/')) {
      return { view: 'contacts', detected: true };
    }
    if (pathname.includes('/deals/') || url.includes('/objects/0-3/')) {
      return { view: 'deals', detected: true };
    }
    if (pathname.includes('/tasks/')) {
      return { view: 'tasks', detected: true };
    }

    const pageTitle = document.querySelector('h1, [data-test-id="page-title"]');
    if (pageTitle) {
      const titleText = pageTitle.textContent.toLowerCase();
      if (titleText.includes('contact')) return { view: 'contacts', detected: true };
      if (titleText.includes('deal')) return { view: 'deals', detected: true };
      if (titleText.includes('task')) return { view: 'tasks', detected: true };
    }

    return { view: null, detected: false };
  }

  async startExtraction() {
    const viewInfo = this.detectCurrentView();
    
    this.statusIndicator.show('extracting', 'Detecting view...');

    if (!viewInfo.detected) {
      this.statusIndicator.show('error', 'Not on a HubSpot list view. Navigate to Contacts, Deals, or Tasks.');
      return { success: false, error: 'Not on a supported HubSpot view' };
    }

    const { view } = viewInfo;
    this.statusIndicator.show('extracting', `Extracting ${view}...`);

    try {
      await this.waitForContent(view);

      const extractor = this.extractors[view];
      const data = await extractor.extract();

      if (!data || data.length === 0) {
        this.statusIndicator.show('warning', `No ${view} found on this page`);
        return { success: true, view, data: [], count: 0 };
      }

      const saveResult = await chrome.runtime.sendMessage({
        type: 'SAVE_EXTRACTED_DATA',
        payload: {
          dataType: view,
          data: data,
          tabId: Date.now()
        }
      });

      if (saveResult.success) {
        this.statusIndicator.show('success', `Extracted ${data.length} ${view}`);
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

  async waitForContent(view) {
    // Wait for dynamic content to load before extracting
    const selectors = {
      contacts: '[data-test-id="table"], .private-table, table',
      deals: '[data-test-id="table"], .private-table, .deal-board, table',
      tasks: '[data-test-id="table"], .private-table, .tasks-table, table'
    };

    const selector = selectors[view];
    const maxWait = 5000;
    const interval = 500;
    let elapsed = 0;

    while (elapsed < maxWait) {
      const element = document.querySelector(selector);
      if (element && element.querySelector('tr, .table-row, [data-test-id="table-row"]')) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
      elapsed += interval;
    }
    return true;
  }
}

// Initialize the extractor when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const extractor = new HubSpotExtractor();
    extractor.init();
  });
} else {
  const extractor = new HubSpotExtractor();
  extractor.init();
}
