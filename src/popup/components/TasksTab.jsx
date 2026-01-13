import React from 'react';
import { CheckSquare, Calendar, Tag, Link2, Trash2 } from 'lucide-react';

function TasksTab({ tasks, onDelete }) {
  if (!tasks || tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400">
        <CheckSquare className="w-12 h-12 mb-3 opacity-50" />
        <p className="text-sm">No tasks extracted yet</p>
        <p className="text-xs mt-1">Navigate to HubSpot Tasks and click "Extract Now"</p>
      </div>
    );
  }

  const getTypeColor = (type) => {
    const typeLower = type?.toLowerCase() || '';
    if (typeLower.includes('call')) {
      return 'bg-blue-100 text-blue-700';
    }
    if (typeLower.includes('email')) {
      return 'bg-purple-100 text-purple-700';
    }
    if (typeLower.includes('meeting')) {
      return 'bg-green-100 text-green-700';
    }
    if (typeLower.includes('follow')) {
      return 'bg-yellow-100 text-yellow-700';
    }
    return 'bg-slate-100 text-slate-600';
  };

  const getDueDateStyle = (dueDate) => {
    if (!dueDate) return '';
    const dueLower = dueDate.toLowerCase();
    if (dueLower.includes('overdue') || dueLower.includes('yesterday')) {
      return 'text-red-600 font-medium';
    }
    if (dueLower.includes('today')) {
      return 'text-orange-600 font-medium';
    }
    return 'text-slate-500';
  };

  return (
    <div className="divide-y divide-slate-100">
      {tasks.map((task) => (
        <div 
          key={task.id} 
          className="p-3 hover:bg-slate-50 transition-colors group"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-slate-800 flex items-start gap-1.5">
                <CheckSquare className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                <span className="line-clamp-2">{task.title}</span>
              </h3>
              
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {task.type && (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded ${getTypeColor(task.type)}`}>
                    <Tag className="w-3 h-3" />
                    {task.type}
                  </span>
                )}
                
                {task.dueDate && (
                  <span className={`inline-flex items-center gap-1 text-xs ${getDueDateStyle(task.dueDate)}`}>
                    <Calendar className="w-3 h-3" />
                    {task.dueDate}
                  </span>
                )}
              </div>
              
              {task.record && (
                <p className="mt-1.5 text-xs text-slate-400 flex items-center gap-1.5 truncate">
                  <Link2 className="w-3 h-3 flex-shrink-0" />
                  {task.record}
                </p>
              )}
            </div>
            
            <button
              onClick={() => onDelete(task.id)}
              className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
              title="Delete task"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default TasksTab;
