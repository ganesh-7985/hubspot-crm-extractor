import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, 
  DollarSign, 
  CheckSquare, 
  Search, 
  Trash2, 
  Download, 
  RefreshCw,
  Clock,
  AlertCircle,
  X
} from 'lucide-react';
import ContactsTab from './components/ContactsTab';
import DealsTab from './components/DealsTab';
import TasksTab from './components/TasksTab';

const TABS = [
  { id: 'contacts', label: 'Contacts', icon: Users },
  { id: 'deals', label: 'Deals', icon: DollarSign },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare },
];

function App() {
  const [activeTab, setActiveTab] = useState('contacts');
  const [data, setData] = useState({ contacts: [], deals: [], tasks: [], lastSync: null });
  const [searchQuery, setSearchQuery] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);

  // Load data on mount
  useEffect(() => {
    loadData();
    
    // Listen for real-time updates
    const handleMessage = (message) => {
      if (message.type === 'DATA_UPDATED') {
        setData(message.payload);
      }
      if (message.type === 'EXTRACTION_STATUS_UPDATE') {
        if (message.payload.status === 'success') {
          setIsExtracting(false);
          showNotification('Extraction completed!', 'success');
          loadData();
        } else if (message.payload.status === 'error') {
          setIsExtracting(false);
          setError(message.payload.message);
        }
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  const loadData = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_ALL_DATA' });
      if (response) {
        setData(response);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  };

  const handleExtract = async () => {
    setIsExtracting(true);
    setError(null);
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab?.url?.includes('hubspot.com')) {
        setError('Please navigate to HubSpot CRM first');
        setIsExtracting(false);
        return;
      }

      const response = await chrome.tabs.sendMessage(tab.id, { type: 'START_EXTRACTION' });
      
      if (response?.success) {
        showNotification(`Extracted ${response.count} ${response.view}`, 'success');
        loadData();
      } else {
        setError(response?.error || 'Extraction failed');
      }
    } catch (err) {
      setError('Could not connect to HubSpot page. Make sure you are on a HubSpot list view.');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleDelete = async (dataType, id) => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'DELETE_RECORD',
        payload: { dataType, id }
      });
      
      if (response?.success) {
        loadData();
        showNotification('Record deleted', 'success');
      }
    } catch (err) {
      setError('Failed to delete record');
    }
  };

  const handleExport = async (format) => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'EXPORT_DATA',
        payload: { format }
      });
      
      if (response?.success) {
        // Create download
        const blob = new Blob([response.data], { 
          type: format === 'json' ? 'application/json' : 'text/csv' 
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = response.filename;
        a.click();
        URL.revokeObjectURL(url);
        showNotification(`Exported as ${format.toUpperCase()}`, 'success');
      }
    } catch (err) {
      setError('Export failed');
    }
  };

  const handleClearAll = async () => {
    if (confirm('Are you sure you want to delete all extracted data?')) {
      try {
        await chrome.runtime.sendMessage({ type: 'CLEAR_ALL_DATA' });
        loadData();
        showNotification('All data cleared', 'success');
      } catch (err) {
        setError('Failed to clear data');
      }
    }
  };

  const showNotification = (message, type) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const formatLastSync = (timestamp) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const getFilteredData = useCallback((items) => {
    if (!searchQuery.trim()) return items;
    const query = searchQuery.toLowerCase();
    return items.filter(item => 
      Object.values(item).some(val => 
        String(val).toLowerCase().includes(query)
      )
    );
  }, [searchQuery]);

  const totalRecords = data.contacts.length + data.deals.length + data.tasks.length;

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-4">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold flex items-center gap-2">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
            </svg>
            HubSpot Extractor
          </h1>
          <span className="text-xs bg-white/20 px-2 py-1 rounded">
            {totalRecords} records
          </span>
        </div>
        
        {/* Extract Button */}
        <button
          onClick={handleExtract}
          disabled={isExtracting}
          className="w-full bg-white text-orange-600 font-semibold py-2 px-4 rounded-lg hover:bg-orange-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isExtracting ? 'animate-spin' : ''}`} />
          {isExtracting ? 'Extracting...' : 'Extract Now'}
        </button>
        
        {/* Last Sync */}
        <div className="flex items-center gap-1 mt-2 text-xs text-orange-100">
          <Clock className="w-3 h-3" />
          Last sync: {formatLastSync(data.lastSync)}
        </div>
      </header>

      {/* Error/Notification Banner */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 flex-1">{error}</p>
          <button onClick={() => setError(null)}>
            <X className="w-4 h-4 text-red-400 hover:text-red-600" />
          </button>
        </div>
      )}
      
      {notification && (
        <div className={`p-3 text-sm ${
          notification.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'
        }`}>
          {notification.message}
        </div>
      )}

      {/* Search Bar */}
      <div className="p-3 border-b bg-white">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search all records..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b bg-white">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const count = data[tab.id]?.length || 0;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 px-2 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${
                activeTab === tab.id 
                  ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50/50' 
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                activeTab === tab.id ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-500'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'contacts' && (
          <ContactsTab 
            contacts={getFilteredData(data.contacts)} 
            onDelete={(id) => handleDelete('contacts', id)} 
          />
        )}
        {activeTab === 'deals' && (
          <DealsTab 
            deals={getFilteredData(data.deals)} 
            onDelete={(id) => handleDelete('deals', id)} 
          />
        )}
        {activeTab === 'tasks' && (
          <TasksTab 
            tasks={getFilteredData(data.tasks)} 
            onDelete={(id) => handleDelete('tasks', id)} 
          />
        )}
      </div>

      {/* Footer Actions */}
      <footer className="border-t bg-white p-3">
        <div className="flex gap-2">
          <button
            onClick={() => handleExport('json')}
            disabled={totalRecords === 0}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            JSON
          </button>
          <button
            onClick={() => handleExport('csv')}
            disabled={totalRecords === 0}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            CSV
          </button>
          <button
            onClick={handleClearAll}
            disabled={totalRecords === 0}
            className="flex items-center justify-center gap-1.5 py-2 px-3 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </footer>
    </div>
  );
}

export default App;
