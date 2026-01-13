import React from 'react';
import { DollarSign, TrendingUp, Calendar, Trash2 } from 'lucide-react';

function DealsTab({ deals, onDelete }) {
  if (!deals || deals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400">
        <DollarSign className="w-12 h-12 mb-3 opacity-50" />
        <p className="text-sm">No deals extracted yet</p>
        <p className="text-xs mt-1">Navigate to HubSpot Deals and click "Extract Now"</p>
      </div>
    );
  }

  const formatAmount = (amount) => {
    if (amount === null || amount === undefined) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStageColor = (stage) => {
    const stageLower = stage?.toLowerCase() || '';
    if (stageLower.includes('won') || stageLower.includes('closed')) {
      return 'bg-green-100 text-green-700';
    }
    if (stageLower.includes('lost')) {
      return 'bg-red-100 text-red-700';
    }
    if (stageLower.includes('negotiation') || stageLower.includes('proposal')) {
      return 'bg-yellow-100 text-yellow-700';
    }
    if (stageLower.includes('qualified') || stageLower.includes('decision')) {
      return 'bg-blue-100 text-blue-700';
    }
    return 'bg-slate-100 text-slate-600';
  };

  return (
    <div className="divide-y divide-slate-100">
      {deals.map((deal) => (
        <div 
          key={deal.id} 
          className="p-3 hover:bg-slate-50 transition-colors group"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-slate-800 truncate flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-green-500 flex-shrink-0" />
                {deal.name}
              </h3>
              
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {deal.amount !== null && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 text-xs font-medium rounded">
                    {formatAmount(deal.amount)}
                  </span>
                )}
                
                {deal.stage && (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded ${getStageColor(deal.stage)}`}>
                    <TrendingUp className="w-3 h-3" />
                    {deal.stage}
                  </span>
                )}
              </div>
              
              {deal.closeDate && (
                <p className="mt-1.5 text-xs text-slate-400 flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 flex-shrink-0" />
                  Close: {deal.closeDate}
                </p>
              )}
            </div>
            
            <button
              onClick={() => onDelete(deal.id)}
              className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
              title="Delete deal"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default DealsTab;
