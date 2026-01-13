import React from 'react';
import { User, Mail, Phone, UserCircle, Trash2 } from 'lucide-react';

function ContactsTab({ contacts, onDelete }) {
  if (!contacts || contacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400">
        <User className="w-12 h-12 mb-3 opacity-50" />
        <p className="text-sm">No contacts extracted yet</p>
        <p className="text-xs mt-1">Navigate to HubSpot Contacts and click "Extract Now"</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100">
      {contacts.map((contact) => (
        <div 
          key={contact.id} 
          className="p-3 hover:bg-slate-50 transition-colors group"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-slate-800 truncate flex items-center gap-1.5">
                <User className="w-4 h-4 text-slate-400 flex-shrink-0" />
                {contact.name}
              </h3>
              
              <div className="mt-1.5 space-y-1">
                {contact.email && (
                  <p className="text-xs text-slate-500 flex items-center gap-1.5 truncate">
                    <Mail className="w-3 h-3 flex-shrink-0" />
                    <a 
                      href={`mailto:${contact.email}`} 
                      className="hover:text-orange-600 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {contact.email}
                    </a>
                  </p>
                )}
                
                {contact.phone && (
                  <p className="text-xs text-slate-500 flex items-center gap-1.5">
                    <Phone className="w-3 h-3 flex-shrink-0" />
                    <a 
                      href={`tel:${contact.phone}`}
                      className="hover:text-orange-600 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {contact.phone}
                    </a>
                  </p>
                )}
                
                {contact.owner && (
                  <p className="text-xs text-slate-400 flex items-center gap-1.5">
                    <UserCircle className="w-3 h-3 flex-shrink-0" />
                    Owner: {contact.owner}
                  </p>
                )}
              </div>
            </div>
            
            <button
              onClick={() => onDelete(contact.id)}
              className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
              title="Delete contact"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default ContactsTab;
