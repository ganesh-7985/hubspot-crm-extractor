# HubSpot CRM Extractor

A Chrome Extension that extracts Contacts, Deals, and Tasks from HubSpot CRM, stores them locally, and displays them in a modern popup dashboard.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)
![React](https://img.shields.io/badge/React-18-61dafb)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3-38bdf8)

## Features

- **Data Extraction**: Extract Contacts, Deals, and Tasks from HubSpot list views
- **Local Storage**: All data stored securely in chrome.storage.local
- **React Dashboard**: Beautiful popup UI with tabs, search, and filtering
- **Shadow DOM Feedback**: Visual extraction status indicator with style isolation
- **Export Options**: Export data as JSON or CSV
- **Real-time Sync**: Automatic updates across tabs via chrome.storage.onChanged
- **Deduplication**: Smart merging prevents duplicate records

## Installation

### Prerequisites
- Node.js 18+ and npm
- Google Chrome browser
- Free HubSpot CRM account

### Setup Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/hubspot-crm-extractor.git
   cd hubspot-crm-extractor
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the popup**
   ```bash
   npm run build
   ```

4. **Load in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right)
   - Click "Load unpacked"
   - Select the `hubspot-crm-extractor` folder

5. **Test the extension**
   - Navigate to [HubSpot CRM](https://app.hubspot.com)
   - Go to Contacts, Deals, or Tasks list view
   - Click the extension icon and press "Extract Now"

## Project Structure

```
hubspot-crm-extractor/
├── manifest.json              # Chrome Extension manifest (V3)
├── popup.html                 # Popup entry point
├── package.json               # Node.js dependencies
├── vite.config.js             # Vite build configuration
├── tailwind.config.js         # TailwindCSS configuration
├── icons/                     # Extension icons
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
├── src/
│   ├── background/
│   │   └── service-worker-bundle.js   # Service worker (message passing, storage)
│   ├── content/
│   │   ├── content-bundle.js          # Content script (DOM extraction)
│   │   ├── content-styles.css         # Content script styles
│   │   ├── extractors/
│   │   │   ├── contacts-extractor.js  # Contacts extraction logic
│   │   │   ├── deals-extractor.js     # Deals extraction logic
│   │   │   └── tasks-extractor.js     # Tasks extraction logic
│   │   └── ui/
│   │       └── status-indicator.js    # Shadow DOM status indicator
│   ├── popup/
│   │   ├── main.jsx                   # React entry point
│   │   ├── App.jsx                    # Main popup component
│   │   ├── index.css                  # TailwindCSS styles
│   │   └── components/
│   │       ├── ContactsTab.jsx        # Contacts list component
│   │       ├── DealsTab.jsx           # Deals list component
│   │       └── TasksTab.jsx           # Tasks list component
│   └── storage/
│       └── storage-manager.js         # Storage layer with deduplication
└── dist/                              # Built popup files
```

## DOM Selection Strategy

### Approach Overview

The extension uses a **layered selector strategy** prioritizing stability and maintainability:

| Priority | Method | Use Case |
|----------|--------|----------|
| 1st | Data Attributes | `[data-test-id]`, `[data-selenium-test]` - Most stable |
| 2nd | CSS Selectors | Class-based selectors for common patterns |
| 3rd | Semantic HTML | `table`, `tr`, `td`, links with specific hrefs |
| 4th | XPath | Complex traversals (fallback only) |

### Why This Approach?

1. **Data Attributes First**: HubSpot adds `data-test-id` and `data-selenium-test` attributes for their own testing. These are the most stable as they're unlikely to change during UI updates.

2. **CSS Selectors**: More readable and performant than XPath. We use multiple fallback selectors:
   ```javascript
   const tableSelectors = [
     '[data-test-id="table"]',      // Primary: data attribute
     '[data-selenium-test="table"]', // Secondary: selenium attribute
     '.private-table',               // Tertiary: class-based
     'table'                          // Fallback: semantic HTML
   ];
   ```

3. **Content-Based Extraction**: For fields like email and phone, we use pattern matching:
   ```javascript
   // Email pattern matching
   const emailPattern = /[\w.-]+@[\w.-]+\.\w+/;
   
   // Phone pattern matching
   const phonePattern = /[\d\s\-\(\)\+]{7,}/;
   ```

### Handling Dynamic Content

HubSpot uses React with lazy loading. Our strategy:

1. **Wait for Content**: Before extraction, we wait for table elements to appear:
   ```javascript
   async waitForContent(view) {
     const maxWait = 10000; // 10 seconds
     while (elapsed < maxWait) {
       const element = document.querySelector(selector);
       if (element?.querySelector('tr')) return true;
       await sleep(500);
     }
   }
   ```

2. **MutationObserver**: Detect DOM changes for re-extraction prompts (bonus feature)

3. **View Detection**: URL pattern + DOM analysis:
   ```javascript
   // URL-based
   if (pathname.includes('/contacts/')) return 'contacts';
   if (pathname.includes('/deals/')) return 'deals';
   if (pathname.includes('/tasks/')) return 'tasks';
   
   // DOM-based fallback
   const pageTitle = document.querySelector('h1');
   if (pageTitle.textContent.includes('Contact')) return 'contacts';
   ```

## Storage Schema

```javascript
{
  "hubspot_data": {
    "contacts": [
      {
        "id": "contact-123456",        // Unique identifier
        "name": "John Doe",            // Contact name
        "email": "john@example.com",   // Email address
        "phone": "+1-555-123-4567",    // Phone number
        "owner": "Sales Rep",          // Contact owner
        "extractedAt": 1704067200000,  // Extraction timestamp
        "updatedAt": 1704067200000     // Last update timestamp
      }
    ],
    "deals": [
      {
        "id": "deal-789012",
        "name": "Enterprise Deal",
        "amount": 50000,               // Numeric amount
        "stage": "Negotiation",
        "closeDate": "2024-03-15",
        "extractedAt": 1704067200000,
        "updatedAt": 1704067200000
      }
    ],
    "tasks": [
      {
        "id": "task-345678",
        "title": "Follow up call",
        "dueDate": "2024-01-20",
        "type": "Call",                // Call, Email, Meeting, To-do
        "record": "John Doe",          // Associated contact/deal
        "extractedAt": 1704067200000,
        "updatedAt": 1704067200000
      }
    ],
    "lastSync": 1704067200000          // Last extraction timestamp
  },
  "extraction_lock": {
    "tabId": null,                     // Tab holding the lock
    "timestamp": null                  // Lock acquisition time
  }
}
```

### Data Integrity Features

1. **Deduplication**: Records are merged by ID, updating existing records:
   ```javascript
   mergeRecords(existing, incoming) {
     const recordMap = new Map();
     existing.forEach(r => recordMap.set(r.id, r));
     incoming.forEach(r => {
       recordMap.set(r.id, { ...recordMap.get(r.id), ...r });
     });
     return Array.from(recordMap.values());
   }
   ```

2. **Race Condition Handling**: Mutex lock with timeout:
   ```javascript
   async acquireLock(tabId) {
     const lock = await getLock();
     if (lock?.tabId && Date.now() - lock.timestamp < 30000) {
       return false; // Lock held by another tab
     }
     await setLock(tabId);
     return true;
   }
   ```

3. **Update Tracking**: Each record has `extractedAt` and `updatedAt` timestamps

## API Reference

### Message Types (Service Worker)

| Type | Payload | Response | Description |
|------|---------|----------|-------------|
| `START_EXTRACTION` | - | `{ success, view, count }` | Trigger extraction |
| `SAVE_EXTRACTED_DATA` | `{ dataType, data, tabId }` | `{ success, added, total }` | Save extracted data |
| `GET_ALL_DATA` | - | `{ contacts, deals, tasks, lastSync }` | Get all stored data |
| `DELETE_RECORD` | `{ dataType, id }` | `{ success }` | Delete a record |
| `CLEAR_ALL_DATA` | - | `{ success }` | Clear all data |
| `EXPORT_DATA` | `{ format: 'json'|'csv' }` | `{ success, data, filename }` | Export data |

## Development

### Build Commands

```bash
# Development (with watch)
npm run dev

# Production build
npm run build

# Preview build
npm run preview
```

### Testing

1. Load the extension in Chrome
2. Navigate to HubSpot CRM
3. Open Contacts/Deals/Tasks list view
4. Click extension icon → "Extract Now"
5. Verify data appears in popup
6. Refresh page → verify data persists
7. Delete a record → verify removal

## Bonus Features Implemented

- [x] **Real-time sync**: `chrome.storage.onChanged` listener broadcasts updates
- [x] **CSV/JSON Export**: Download extracted data in either format
- [x] **Pagination detection**: Identifies when more pages are available
- [x] **DOM change detection**: MutationObserver watches for table changes

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Not on a HubSpot view" | Navigate to Contacts, Deals, or Tasks list page |
| No data extracted | Ensure the list has loaded completely before extraction |
| Extension not working | Check `chrome://extensions` for errors, reload extension |
| Popup not showing | Run `npm run build` and reload extension |

## Tech Stack

- **Chrome Extension**: Manifest V3, Service Worker, Content Scripts
- **Frontend**: React 18, TailwindCSS 3, Lucide Icons
- **Build**: Vite 5
- **Storage**: chrome.storage.local API
- **Isolation**: Shadow DOM for injected UI

## License

MIT License - See LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

**Note**: This extension uses DOM scraping and does not require HubSpot API integration. Use a free HubSpot CRM account for testing.
# hubspot-crm-extractor
