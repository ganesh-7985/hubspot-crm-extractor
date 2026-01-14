// Extracts contact data from HubSpot Contacts list view

export class ContactsExtractor {
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
    if (!table) {
      console.warn('[Contacts Extractor] No table found');
      return contacts;
    }

    const rows = this.getRows(table);
    console.log(`[Contacts Extractor] Found ${rows.length} rows`);

    for (const row of rows) {
      try {
        const contact = this.extractContactFromRow(row);
        if (contact && contact.id) {
          contacts.push(contact);
        }
      } catch (error) {
        console.warn('[Contacts Extractor] Error extracting row:', error);
      }
    }

    await this.handlePagination(contacts);

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

    const name = this.extractName(row, cells);
    const email = this.extractEmail(row, cells);
    const phone = this.extractPhone(row, cells);
    const owner = this.extractOwner(row, cells);

    return {
      id: rowId,
      name: name || 'Unknown',
      email: email || '',
      phone: phone || '',
      owner: owner || '',
      extractedAt: Date.now()
    };
  }

  extractName(row, cells) {
    const nameSelectors = [
      '[data-test-id="contact-name"]',
      '[data-selenium-test="contact-name"]',
      'a[href*="/contact/"]',
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

  extractEmail(row, cells) {
    const emailSelectors = [
      '[data-test-id="email"]',
      '[data-selenium-test="email"]',
      'a[href^="mailto:"]',
      '[data-property="email"]'
    ];

    for (const selector of emailSelectors) {
      const element = row.querySelector(selector);
      if (element) {
        const href = element.getAttribute('href');
        if (href?.startsWith('mailto:')) {
          return href.replace('mailto:', '');
        }
        if (element.textContent?.includes('@')) {
          return element.textContent.trim();
        }
      }
    }

    // Search all cells for email pattern
    const emailPattern = /[\w.-]+@[\w.-]+\.\w+/;
    for (const cell of cells) {
      const text = cell.textContent;
      const match = text?.match(emailPattern);
      if (match) return match[0];
    }

    return null;
  }

  extractPhone(row, cells) {
    const phoneSelectors = [
      '[data-test-id="phone"]',
      '[data-selenium-test="phone"]',
      'a[href^="tel:"]',
      '[data-property="phone"]'
    ];

    for (const selector of phoneSelectors) {
      const element = row.querySelector(selector);
      if (element) {
        const href = element.getAttribute('href');
        if (href?.startsWith('tel:')) {
          return href.replace('tel:', '');
        }
        const text = element.textContent?.trim();
        if (text && this.looksLikePhone(text)) {
          return text;
        }
      }
    }

    // Search cells for phone pattern
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
    const ownerSelectors = [
      '[data-test-id="owner"]',
      '[data-test-id="contact-owner"]',
      '[data-selenium-test="owner"]',
      '[data-property="hubspot_owner_id"]',
      '.owner-cell'
    ];

    for (const selector of ownerSelectors) {
      const element = row.querySelector(selector);
      if (element?.textContent?.trim()) {
        return element.textContent.trim();
      }
    }

    // Look for column with "owner" in header
    const headers = document.querySelectorAll('th, [role="columnheader"]');
    let ownerIndex = -1;
    headers.forEach((header, index) => {
      if (header.textContent?.toLowerCase().includes('owner')) {
        ownerIndex = index;
      }
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
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `contact-${Math.abs(hash)}`;
  }

  async handlePagination(contacts) {
    const nextButton = document.querySelector(
      '[data-test-id="pagination-next"],' +
      '[aria-label="Next page"],' +
      '.pagination-next,' +
      'button[data-selenium-test="pagination-button-next"]'
    );

    // Full pagination could be implemented by clicking next and re-extracting
    if (nextButton && !nextButton.disabled) {
      console.log('[Contacts Extractor] More pages available');
    }
  }
}
