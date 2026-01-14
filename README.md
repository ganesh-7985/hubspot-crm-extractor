# HubSpot CRM Extractor

A Chrome Extension that extracts Contacts, Deals, and Tasks from HubSpot CRM using intelligent DOM scraping. All data is stored locally in your browser with a modern React-powered dashboard.

## Screenshots

![Extension Popup Interface](icons/img1.png)
*Extension popup showing extracted contacts, deals, and tasks with search and export functionality*

![Data Extraction in Action](icons/img2.png)
*Real-time extraction status indicator on HubSpot CRM pages*

## Demo Video

📹 **Watch the extension in action**: [YouTube Demo](https://youtu.be/qn2V4MEehEw)

## Features

### Core Functionality
- **Multi-Entity Extraction**: Extract Contacts, Deals, and Tasks from HubSpot list views
- **Intelligent DOM Scraping**: Layered selector strategy with fallback mechanisms
- **Local-First Storage**: All data stored in `chrome.storage.local` - no external servers

### User Experience
- **Modern React Dashboard**: Clean, responsive UI built with React 18 and TailwindCSS
- **Real-time Search**: Instant filtering across all extracted records
- **Visual Feedback**: Shadow DOM-isolated status indicators with progress tracking
- **Export Options**: Download data as JSON or CSV formats

### Data Integrity
- **Smart Deduplication**: Automatic record merging by unique ID
- **Race Condition Protection**: Mutex lock system prevents concurrent extraction conflicts
- **Real-time Sync**: Cross-tab synchronization using `chrome.storage.onChanged`
- **Timestamp Tracking**: Each record includes `extractedAt` and `updatedAt` fields

---

## Installation

### Setup Instructions

**1. Clone the Repository**
```bash
git clone https://github.com/ganesh-7985/hubspot-crm-extractor.git
cd hubspot-crm-extractor
```

**2. Install Dependencies**
```bash
npm install
```

This installs:
- React 18 and React DOM
- TailwindCSS 3 for styling
- Lucide React for icons
- Vite 5 as the build tool

**3. Build the Extension**
```bash
npm run build
```

This creates the `dist/` folder with the compiled popup interface.

**4. Load Extension in Chrome**

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **Load unpacked**
4. Select the `hubspot-crm-extractor` folder (not the `dist` folder)
5. The extension icon should appear in your Chrome toolbar

---


## Technical Documentation

### Architecture

The extension follows a **three-layer architecture** with clear separation of concerns:

#### 1. Service Worker (Background Script)

**Location**: `src/background/service-worker-bundle.js`

**Responsibilities**:
- Central message broker between popup and content scripts
- Storage operations with mutex lock mechanism
- Cross-tab synchronization via `chrome.storage.onChanged`
- Data export (JSON/CSV conversion)

**Key Functions**:
```javascript
acquireLock(tabId)          // Acquire extraction lock
releaseLock(tabId)          // Release extraction lock
mergeRecords(existing, new) // Deduplicate by ID
saveData(type, data)        // Save to chrome.storage.local
getAllData()                // Retrieve all stored data
```

**Message Handlers**:
- `EXTRACT_DATA` - Triggers content script extraction
- `SAVE_EXTRACTED_DATA` - Saves data with lock protection
- `GET_ALL_DATA` - Returns all stored records
- `DELETE_RECORD` - Removes single record
- `CLEAR_ALL_DATA` - Wipes all storage
- `EXPORT_DATA` - Generates JSON/CSV export

#### 2. Content Scripts

**Location**: `src/content/content-bundle.js`

**Responsibilities**:
- Inject into HubSpot pages matching host permissions
- Detect current view (Contacts/Deals/Tasks)
- Extract data using specialized extractors
- Display status indicator with Shadow DOM isolation

**Components**:

**StatusIndicator**
- Shadow DOM-based UI component
- Prevents style conflicts with HubSpot
- Shows extraction progress with animations
- Auto-hides after 3 seconds on success

**HubSpotExtractor** (Main Orchestrator)
- View detection via URL and DOM analysis
- Waits for dynamic content to load (10s timeout)
- Delegates to specialized extractors
- Sends extracted data to service worker

**ContactsExtractor**
- Extracts: Name, Email, Phone, Owner
- Pattern matching for email/phone detection
- Fallback selector chains for robustness

**DealsExtractor**
- Supports table and kanban board views
- Extracts: Name, Amount, Stage, Close Date
- Currency parsing with regex

**TasksExtractor**
- Extracts: Title, Due Date, Type, Associated Record
- Task type inference from content
- Column header mapping for field detection

#### 3. Popup UI (React Dashboard)

**Location**: `src/popup/`

**Responsibilities**:
- Display extracted data in tabbed interface
- Real-time search and filtering
- Export and delete operations
- Listen for storage changes (cross-tab sync)

**State Management**:
- React Hooks (`useState`, `useEffect`, `useCallback`)
- Chrome Storage API for persistence
- Real-time updates via `chrome.storage.onChanged`

### DOM Extraction Strategy

The extension uses a **layered selector strategy** with multiple fallback mechanisms to ensure robustness against HubSpot UI changes.

#### Selector Priority Hierarchy

| Priority | Method | Example |
|----------|--------|---------|
| **1st** | Data Attributes | `[data-test-id="table"]` |
| **2nd** | Selenium Attributes | `[data-selenium-test="table"]` |
| **3rd** | CSS Classes | `.private-table` |
| **4th** | Semantic HTML | `table`, `tbody`, `tr` |
| **5th** | Pattern Matching | Email/phone regex |

### Storage Schema

The extension uses `chrome.storage.local` API with the following schema:

```javascript
{
  "hubspot_data": {
    "contacts": [
      {
        "id": "contact-123456",        // Unique identifier (from data-row-id or generated)
        "name": "John Doe",            // Full name
        "email": "john@example.com",   // Email address
        "phone": "+1-555-123-4567",    // Phone number
        "owner": "Sales Rep",          // Contact owner
        "extractedAt": 1704067200000,  // Unix timestamp (first extraction)
        "updatedAt": 1704067200000     // Unix timestamp (last update)
      }
    ],
    "deals": [
      {
        "id": "deal-789012",           // Unique identifier
        "name": "Enterprise Deal",     // Deal name
        "amount": 50000,               // Numeric amount (parsed from currency)
        "stage": "Negotiation",        // Pipeline stage
        "closeDate": "2024-03-15",     // Close date (string)
        "extractedAt": 1704067200000,
        "updatedAt": 1704067200000
      }
    ],
    "tasks": [
      {
        "id": "task-345678",           // Unique identifier
        "title": "Follow up call",     // Task title
        "dueDate": "2024-01-20",       // Due date (string)
        "type": "Call",                // Task type: Call, Email, Meeting, To-do
        "record": "John Doe",          // Associated contact/deal name
        "extractedAt": 1704067200000,
        "updatedAt": 1704067200000
      }
    ],
    "lastSync": 1704067200000          // Last successful extraction timestamp
  },
  "extraction_lock": {
    "tabId": null,                     // Tab ID holding the lock (or null)
    "timestamp": null                  // Lock acquisition timestamp (or null)
  }
}
```
## Advanced Features

### Implemented Enhancements

**Real-time Multi-tab Sync**
- Uses `chrome.storage.onChanged` listener
- Broadcasts updates to all open popups
- Ensures data consistency across tabs

 **Dual Export Formats**
- JSON: Structured data with full schema
- CSV: Spreadsheet-compatible with sections

**Race Condition Prevention**
- Mutex lock with 30-second timeout
- Prevents concurrent extraction conflicts
- Automatic lock release on completion

**Smart Deduplication**
- Map-based ID merging
- Preserves existing data, updates with new
- Timestamp tracking for audit trail

**Shadow DOM Isolation**
- Status indicator uses closed shadow root
- Prevents style inheritance from HubSpot
- Animated transitions with CSS

**View Auto-detection**
- URL pattern matching
- Query parameter analysis
- DOM-based fallback detection

**Dynamic Content Handling**
- Waits for lazy-loaded content (10s timeout)
- Polls for table/board elements
- Handles React virtual scrolling

**Error Handling**
- Try-catch blocks throughout
- User-friendly error messages
- Graceful degradation

---
## Author

**Ganesh**  
GitHub: [@ganesh-7985](https://github.com/ganesh-7985)

---

## Repository

🔗 [https://github.com/ganesh-7985/hubspot-crm-extractor](https://github.com/ganesh-7985/hubspot-crm-extractor)

---
