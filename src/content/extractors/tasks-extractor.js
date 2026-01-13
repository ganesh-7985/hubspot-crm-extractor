/**
 * Tasks Extractor
 * Extracts task data from HubSpot Tasks list view
 * 
 * Target fields: title, due date, task type, associated record
 */

export class TasksExtractor {
  constructor() {
    this.tableSelectors = [
      '[data-test-id="table"]',
      '[data-selenium-test="table"]',
      '.private-table',
      '.tasks-table',
      'table.table',
      'table'
    ];

    this.rowSelectors = [
      '[data-test-id="table-row"]',
      '[data-selenium-test="table-row"]',
      '[data-test-id="task-row"]',
      'tbody tr',
      'tr[data-row-id]'
    ];

    // Task list view selectors (non-table view)
    this.listSelectors = [
      '.tasks-list',
      '[data-test-id="tasks-list"]',
      '.task-items'
    ];
  }

  /**
   * Extract all tasks from the current page
   */
  async extract() {
    const tasks = [];

    // Check for list view first
    const list = this.findList();
    if (list) {
      return this.extractFromList(list);
    }

    // Table view extraction
    const table = this.findTable();
    if (!table) {
      console.warn('[Tasks Extractor] No table or list found');
      return tasks;
    }

    const rows = this.getRows(table);
    console.log(`[Tasks Extractor] Found ${rows.length} rows`);

    for (const row of rows) {
      try {
        const task = this.extractTaskFromRow(row);
        if (task && task.id) {
          tasks.push(task);
        }
      } catch (error) {
        console.warn('[Tasks Extractor] Error extracting row:', error);
      }
    }

    return tasks;
  }

  /**
   * Find the tasks table element
   */
  findTable() {
    for (const selector of this.tableSelectors) {
      const table = document.querySelector(selector);
      if (table) return table;
    }
    return null;
  }

  /**
   * Find tasks list (non-table view)
   */
  findList() {
    for (const selector of this.listSelectors) {
      const list = document.querySelector(selector);
      if (list) return list;
    }
    return null;
  }

  /**
   * Get all data rows from the table
   */
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

  /**
   * Extract tasks from list view
   */
  extractFromList(list) {
    const tasks = [];
    
    const itemSelectors = [
      '[data-test-id="task-item"]',
      '.task-item',
      '[data-selenium-test="task-item"]',
      '.task-row'
    ];

    let items = [];
    for (const selector of itemSelectors) {
      items = list.querySelectorAll(selector);
      if (items.length > 0) break;
    }

    items.forEach(item => {
      try {
        const task = this.extractTaskFromListItem(item);
        if (task && task.id) {
          tasks.push(task);
        }
      } catch (error) {
        console.warn('[Tasks Extractor] Error extracting list item:', error);
      }
    });

    console.log(`[Tasks Extractor] Found ${tasks.length} tasks from list`);
    return tasks;
  }

  /**
   * Extract task from a list item
   */
  extractTaskFromListItem(item) {
    const id = item.getAttribute('data-task-id') ||
               item.getAttribute('data-test-id') ||
               this.generateId(item);

    const titleElement = item.querySelector(
      '[data-test-id="task-title"],' +
      '.task-title,' +
      'a[href*="/task/"],' +
      'h4, h5, .title'
    );
    const title = titleElement?.textContent?.trim() || 'Untitled Task';

    const dueDateElement = item.querySelector(
      '[data-test-id="due-date"],' +
      '.due-date,' +
      '[data-property="hs_task_due_date"]'
    );
    const dueDate = this.extractDate(dueDateElement?.textContent || '');

    const typeElement = item.querySelector(
      '[data-test-id="task-type"],' +
      '.task-type,' +
      '[data-property="hs_task_type"]'
    );
    const type = typeElement?.textContent?.trim() || this.inferTaskType(item);

    const recordElement = item.querySelector(
      '[data-test-id="associated-record"],' +
      '.associated-record,' +
      'a[href*="/contact/"],' +
      'a[href*="/deal/"],' +
      'a[href*="/company/"]'
    );
    const record = recordElement?.textContent?.trim() || '';

    return {
      id,
      title,
      dueDate,
      type,
      record,
      extractedAt: Date.now()
    };
  }

  /**
   * Extract task data from a table row
   */
  extractTaskFromRow(row) {
    const cells = row.querySelectorAll('td, [role="cell"]');
    if (cells.length < 2) return null;

    const rowId = row.getAttribute('data-row-id') || 
                  row.getAttribute('data-test-id') ||
                  this.generateId(row);

    const title = this.extractTitle(row, cells);
    const dueDate = this.extractDueDate(row, cells);
    const type = this.extractType(row, cells);
    const record = this.extractAssociatedRecord(row, cells);

    return {
      id: rowId,
      title: title || 'Untitled Task',
      dueDate: dueDate || '',
      type: type || '',
      record: record || '',
      extractedAt: Date.now()
    };
  }

  /**
   * Extract task title
   */
  extractTitle(row, cells) {
    const titleSelectors = [
      '[data-test-id="task-title"]',
      '[data-test-id="title"]',
      '[data-selenium-test="task-title"]',
      'a[href*="/task/"]',
      '[data-test-id="name-cell"]',
      '.private-link'
    ];

    for (const selector of titleSelectors) {
      const element = row.querySelector(selector);
      if (element?.textContent?.trim()) {
        return element.textContent.trim();
      }
    }

    // Checkbox might be first, so try second cell
    const firstLink = row.querySelector('td a, [role="cell"] a');
    if (firstLink?.textContent?.trim()) {
      return firstLink.textContent.trim();
    }

    // Try first non-checkbox cell
    for (const cell of cells) {
      const text = cell.textContent?.trim();
      if (text && text.length > 2 && !cell.querySelector('input[type="checkbox"]')) {
        return text;
      }
    }

    return null;
  }

  /**
   * Extract due date
   */
  extractDueDate(row, cells) {
    const dateSelectors = [
      '[data-test-id="due-date"]',
      '[data-test-id="dueDate"]',
      '[data-selenium-test="due-date"]',
      '[data-property="hs_task_due_date"]'
    ];

    for (const selector of dateSelectors) {
      const element = row.querySelector(selector);
      if (element?.textContent?.trim()) {
        return this.extractDate(element.textContent);
      }
    }

    // Look for column with "due" in header
    const headers = document.querySelectorAll('th, [role="columnheader"]');
    let dateIndex = -1;
    headers.forEach((header, index) => {
      const text = header.textContent?.toLowerCase() || '';
      if (text.includes('due')) {
        dateIndex = index;
      }
    });

    if (dateIndex >= 0 && cells[dateIndex]) {
      return this.extractDate(cells[dateIndex].textContent);
    }

    // Search all cells for date patterns
    for (const cell of cells) {
      const date = this.extractDate(cell.textContent);
      if (date && date !== cell.textContent?.trim()) {
        return date;
      }
    }

    return null;
  }

  /**
   * Extract task type
   */
  extractType(row, cells) {
    const typeSelectors = [
      '[data-test-id="task-type"]',
      '[data-test-id="type"]',
      '[data-selenium-test="task-type"]',
      '[data-property="hs_task_type"]'
    ];

    for (const selector of typeSelectors) {
      const element = row.querySelector(selector);
      if (element?.textContent?.trim()) {
        return element.textContent.trim();
      }
    }

    // Look for column with "type" in header
    const headers = document.querySelectorAll('th, [role="columnheader"]');
    let typeIndex = -1;
    headers.forEach((header, index) => {
      if (header.textContent?.toLowerCase().includes('type')) {
        typeIndex = index;
      }
    });

    if (typeIndex >= 0 && cells[typeIndex]) {
      return cells[typeIndex].textContent?.trim() || '';
    }

    // Infer type from content
    return this.inferTaskType(row);
  }

  /**
   * Infer task type from content
   */
  inferTaskType(element) {
    const text = element.textContent?.toLowerCase() || '';
    
    if (text.includes('call') || text.includes('phone')) return 'Call';
    if (text.includes('email') || text.includes('mail')) return 'Email';
    if (text.includes('meeting') || text.includes('meet')) return 'Meeting';
    if (text.includes('follow') || text.includes('up')) return 'Follow-up';
    
    return 'To-do';
  }

  /**
   * Extract associated record
   */
  extractAssociatedRecord(row, cells) {
    const recordSelectors = [
      '[data-test-id="associated-record"]',
      '[data-test-id="associations"]',
      '[data-selenium-test="associated-record"]',
      'a[href*="/contact/"]',
      'a[href*="/deal/"]',
      'a[href*="/company/"]'
    ];

    for (const selector of recordSelectors) {
      const element = row.querySelector(selector);
      if (element?.textContent?.trim()) {
        return element.textContent.trim();
      }
    }

    // Look for column with "associated" or "record" in header
    const headers = document.querySelectorAll('th, [role="columnheader"]');
    let recordIndex = -1;
    headers.forEach((header, index) => {
      const text = header.textContent?.toLowerCase() || '';
      if (text.includes('associated') || text.includes('record') || text.includes('contact') || text.includes('company')) {
        recordIndex = index;
      }
    });

    if (recordIndex >= 0 && cells[recordIndex]) {
      return cells[recordIndex].textContent?.trim() || '';
    }

    return null;
  }

  /**
   * Extract and normalize date
   */
  extractDate(text) {
    if (!text) return '';
    
    const trimmed = text.trim();
    
    // Handle relative dates
    const lowerText = trimmed.toLowerCase();
    if (lowerText === 'today') return 'Today';
    if (lowerText === 'tomorrow') return 'Tomorrow';
    if (lowerText === 'yesterday') return 'Yesterday';
    if (lowerText.includes('overdue')) return trimmed;

    // Try to parse various date formats
    const datePatterns = [
      /\d{4}-\d{2}-\d{2}/,
      /\d{1,2}\/\d{1,2}\/\d{2,4}/,
      /\d{1,2}-\d{1,2}-\d{2,4}/,
      /[A-Za-z]+\s+\d{1,2},?\s+\d{4}/,
      /[A-Za-z]+\s+\d{1,2}/  // "Jan 15" format
    ];

    for (const pattern of datePatterns) {
      const match = trimmed.match(pattern);
      if (match) {
        return match[0];
      }
    }

    return trimmed.substring(0, 20);
  }

  /**
   * Generate unique ID
   */
  generateId(element) {
    const text = element.textContent?.substring(0, 100) || '';
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `task-${Math.abs(hash)}`;
  }
}
