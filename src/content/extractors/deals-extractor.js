// Extracts deal data from HubSpot Deals list view

export class DealsExtractor {
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

    this.boardSelectors = [
      '.deal-board',
      '[data-test-id="deal-board"]',
      '.pipeline-board'
    ];
  }

  async extract() {
    const deals = [];
    
    // Check if we're in kanban board view first
    const board = this.findBoard();
    if (board) {
      return this.extractFromBoard(board);
    }

    // Fall back to table view if no board found
    const table = this.findTable();
    if (!table) {
      console.warn('[Deals Extractor] No table or board found');
      return deals;
    }

    const rows = this.getRows(table);
    console.log(`[Deals Extractor] Found ${rows.length} rows`);

    // Extract data from each table row
    for (const row of rows) {
      try {
        const deal = this.extractDealFromRow(row);
        if (deal && deal.id) {
          deals.push(deal);
        }
      } catch (error) {
        console.warn('[Deals Extractor] Error extracting row:', error);
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

  findBoard() {
    for (const selector of this.boardSelectors) {
      const board = document.querySelector(selector);
      if (board) return board;
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

  extractFromBoard(board) {
    const deals = [];
    
    // Find all deal cards in the kanban board
    const cardSelectors = [
      '[data-test-id="deal-card"]',
      '.deal-card',
      '[data-selenium-test="deal-card"]',
      '.pipeline-card'
    ];

    let cards = [];
    for (const selector of cardSelectors) {
      cards = board.querySelectorAll(selector);
      if (cards.length > 0) break;
    }

    // Map each card to its stage/column
    const columns = board.querySelectorAll(
      '[data-test-id="pipeline-column"],' +
      '.pipeline-column,' +
      '[data-stage-id]'
    );

    const stageMap = new Map();
    columns.forEach(col => {
      const stageHeader = col.querySelector(
        '[data-test-id="column-header"],' +
        '.column-header,' +
        'h3, h4'
      );
      const stageName = stageHeader?.textContent?.trim() || 'Unknown Stage';
      
      const colCards = col.querySelectorAll('[data-test-id="deal-card"], .deal-card, .pipeline-card');
      colCards.forEach(card => stageMap.set(card, stageName));
    });

    cards.forEach(card => {
      try {
        const deal = this.extractDealFromCard(card, stageMap.get(card));
        if (deal && deal.id) {
          deals.push(deal);
        }
      } catch (error) {
        console.warn('[Deals Extractor] Error extracting card:', error);
      }
    });

    console.log(`[Deals Extractor] Found ${deals.length} deals from board`);
    return deals;
  }

  extractDealFromCard(card, stageName) {
    const id = card.getAttribute('data-deal-id') ||
               card.getAttribute('data-test-id') ||
               this.generateId(card);

    const nameElement = card.querySelector(
      '[data-test-id="deal-name"],' +
      '.deal-name,' +
      'a[href*="/deal/"],' +
      'h4, h5'
    );
    const name = nameElement?.textContent?.trim() || 'Unknown Deal';

    const amountElement = card.querySelector(
      '[data-test-id="deal-amount"],' +
      '.deal-amount,' +
      '[data-property="amount"]'
    );
    const amount = this.extractAmount(amountElement?.textContent || card.textContent);

    const closeDateElement = card.querySelector(
      '[data-test-id="close-date"],' +
      '.close-date,' +
      '[data-property="closedate"]'
    );
    const closeDate = this.extractDate(closeDateElement?.textContent || '');

    return {
      id,
      name,
      amount,
      stage: stageName || 'Unknown',
      closeDate,
      extractedAt: Date.now()
    };
  }

  extractDealFromRow(row) {
    const cells = row.querySelectorAll('td, [role="cell"]');
    if (cells.length < 2) return null;

    const rowId = row.getAttribute('data-row-id') || 
                  row.getAttribute('data-test-id') ||
                  this.generateId(row);

    const name = this.extractName(row, cells);
    const amount = this.extractAmountFromRow(row, cells);
    const stage = this.extractStage(row, cells);
    const closeDate = this.extractCloseDate(row, cells);

    return {
      id: rowId,
      name: name || 'Unknown Deal',
      amount: amount,
      stage: stage || '',
      closeDate: closeDate || '',
      extractedAt: Date.now()
    };
  }

  extractName(row, cells) {
    const nameSelectors = [
      '[data-test-id="deal-name"]',
      '[data-selenium-test="deal-name"]',
      'a[href*="/deal/"]',
      '[data-test-id="name-cell"]',
      '.private-link'
    ];

    for (const selector of nameSelectors) {
      const element = row.querySelector(selector);
      if (element?.textContent?.trim()) {
        return element.textContent.trim();
      }
    }

    const firstLink = row.querySelector('td a, [role="cell"] a');
    if (firstLink?.textContent?.trim()) {
      return firstLink.textContent.trim();
    }

    if (cells[0]?.textContent?.trim()) {
      return cells[0].textContent.trim();
    }

    return null;
  }

  extractAmountFromRow(row, cells) {
    const amountSelectors = [
      '[data-test-id="amount"]',
      '[data-selenium-test="amount"]',
      '[data-property="amount"]'
    ];

    for (const selector of amountSelectors) {
      const element = row.querySelector(selector);
      if (element?.textContent) {
        return this.extractAmount(element.textContent);
      }
    }

    for (const cell of cells) {
      const amount = this.extractAmount(cell.textContent);
      if (amount !== null) return amount;
    }

    return null;
  }

  extractAmount(text) {
    if (!text) return null;
    
    // Match various currency formats like $1,234.56 or €1.234,56
    const patterns = [
      /[\$€£¥]\s*[\d,]+\.?\d*/,
      /[\d,]+\.?\d*\s*[\$€£¥]/,
      /[\d,]+\.?\d*/
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        // Strip currency symbols and convert to number
        const numStr = match[0].replace(/[^\d.,]/g, '').replace(',', '');
        const num = parseFloat(numStr);
        if (!isNaN(num)) return num;
      }
    }

    return null;
  }

  extractStage(row, cells) {
    const stageSelectors = [
      '[data-test-id="stage"]',
      '[data-test-id="deal-stage"]',
      '[data-selenium-test="stage"]',
      '[data-property="dealstage"]',
      '.stage-cell'
    ];

    for (const selector of stageSelectors) {
      const element = row.querySelector(selector);
      if (element?.textContent?.trim()) {
        return element.textContent.trim();
      }
    }

    const headers = document.querySelectorAll('th, [role="columnheader"]');
    let stageIndex = -1;
    headers.forEach((header, index) => {
      if (header.textContent?.toLowerCase().includes('stage')) {
        stageIndex = index;
      }
    });

    if (stageIndex >= 0 && cells[stageIndex]) {
      return cells[stageIndex].textContent?.trim() || '';
    }

    return null;
  }

  extractCloseDate(row, cells) {
    const dateSelectors = [
      '[data-test-id="close-date"]',
      '[data-test-id="closedate"]',
      '[data-selenium-test="close-date"]',
      '[data-property="closedate"]'
    ];

    for (const selector of dateSelectors) {
      const element = row.querySelector(selector);
      if (element?.textContent?.trim()) {
        return this.extractDate(element.textContent);
      }
    }

    const headers = document.querySelectorAll('th, [role="columnheader"]');
    let dateIndex = -1;
    headers.forEach((header, index) => {
      const text = header.textContent?.toLowerCase() || '';
      if (text.includes('close') && text.includes('date')) {
        dateIndex = index;
      }
    });

    if (dateIndex >= 0 && cells[dateIndex]) {
      return this.extractDate(cells[dateIndex].textContent);
    }

    return null;
  }

  extractDate(text) {
    if (!text) return '';
    
    const trimmed = text.trim();
    
    // Try to match common date formats
    const datePatterns = [
      /\d{4}-\d{2}-\d{2}/,           // ISO: 2024-01-15
      /\d{1,2}\/\d{1,2}\/\d{2,4}/,   // US: 1/15/2024
      /\d{1,2}-\d{1,2}-\d{2,4}/,     // Alt: 15-01-2024
      /[A-Za-z]+\s+\d{1,2},?\s+\d{4}/ // Written: January 15, 2024
    ];

    for (const pattern of datePatterns) {
      const match = trimmed.match(pattern);
      if (match) {
        return match[0];
      }
    }

    return trimmed.substring(0, 20);
  }

  generateId(element) {
    const text = element.textContent?.substring(0, 100) || '';
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `deal-${Math.abs(hash)}`;
  }
}
