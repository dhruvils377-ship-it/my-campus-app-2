import React from 'react';
import { AIcon, IconCheck } from './icons.jsx';
import { MAX_CREW } from '../utils/crew.js';

// The "My Crew" editor block from the Share panel: add/rename/remove crew
// members, pick who a share is "for", and toggle whether their name rides
// along in the outgoing message text. Pulled out on its own because it has
// the cleanest prop boundary of any panel in the app — no GPS/routing state
// leaks into it, only crew data and a handful of callbacks.
export default function CrewPanel({
  C, glass,
  crew, newCrewName, setNewCrewName,
  selectedCrewId, setSelectedCrewId,
  confirmDeleteId,
  editingCrewId, editingCrewValue, setEditingCrewValue,
  includeNameInShare, setIncludeNameInShare,
  onAddCrewMember, onRequestRemoveCrewMember,
  onStartEditCrew, onSaveEditCrew, onCancelEditCrew,
}) {
  return (
    <div style={{ ...glass, borderRadius: 14, padding: '12px 14px', marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: C.textLight, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          My Crew
        </div>
        {crew.length > 0 && (
          <div style={{ fontSize: 10, color: C.textLight }}>tap name to edit · tap × twice to remove</div>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8, maxHeight: 112, overflowY: 'auto', paddingRight: 2 }}>
        {crew.map((c) => {
          if (editingCrewId === c.id) {
            return (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 4px 4px 10px', borderRadius: 16, background: C.cardSolid, border: `1px solid ${C.accent}` }}>
                <input
                  autoFocus value={editingCrewValue}
                  onChange={(e) => setEditingCrewValue(e.target.value.slice(0, 30))}
                  onKeyDown={(e) => { if (e.key === 'Enter') onSaveEditCrew(); if (e.key === 'Escape') onCancelEditCrew(); }}
                  style={{ width: 80, border: 'none', background: 'transparent', color: C.text, fontSize: 12, fontWeight: 600, outline: 'none' }}
                />
                <button onClick={onSaveEditCrew} aria-label="Save name" style={{ width: 44, height: 44, minHeight: 44, minWidth: 44, borderRadius: '50%', border: 'none', background: 'transparent', color: C.accentBtn, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ width: 22, height: 22, borderRadius: '50%', background: C.accentBtn, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <AIcon icon={IconCheck} size={12} />
                  </span>
                </button>
                <button onClick={onCancelEditCrew} aria-label="Cancel edit" style={{ width: 44, height: 44, minHeight: 44, minWidth: 44, borderRadius: '50%', border: 'none', background: 'transparent', color: C.textMid, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ width: 22, height: 22, borderRadius: '50%', border: `1px solid ${C.cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</span>
                </button>
              </div>
            );
          }
          const isConfirming = confirmDeleteId === c.id;
          return (
            <div
              key={c.id} role="button" tabIndex={0}
              onClick={() => { if (!isConfirming) setSelectedCrewId(c.id === selectedCrewId ? null : c.id); }}
              onKeyDown={(e) => { if (e.key === 'Enter' && !isConfirming) setSelectedCrewId(c.id === selectedCrewId ? null : c.id); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '6px 6px 6px 12px', borderRadius: 16, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: isConfirming ? 'rgba(231,76,60,0.12)' : selectedCrewId === c.id ? C.accentBtn : C.card,
                color: isConfirming ? '#e74c3c' : selectedCrewId === c.id ? 'white' : C.text,
                border: `1px solid ${isConfirming ? '#e74c3c' : selectedCrewId === c.id ? C.accentBtn : C.cardBorder}`,
              }}
            >
              <span onClick={(e) => { e.stopPropagation(); if (!isConfirming) onStartEditCrew(c); }} style={{ textDecoration: isConfirming ? 'line-through' : 'none' }}>
                {isConfirming ? `Remove ${c.name}?` : c.name}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); onRequestRemoveCrewMember(c.id); }}
                aria-label={isConfirming ? `Confirm remove ${c.name}` : `Remove ${c.name}`}
                style={{ width: 18, height: 18, minHeight: 0, padding: 0, border: 'none', background: 'transparent', color: 'inherit', opacity: isConfirming ? 1 : 0.65, fontSize: 13, cursor: 'pointer', fontWeight: 700 }}
              >
                {isConfirming ? <AIcon icon={IconCheck} size={13} /> : '×'}
              </button>
            </div>
          );
        })}
        {crew.length === 0 && <span style={{ fontSize: 12, color: C.textLight }}>No one added yet.</span>}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: crew.length > 0 ? 10 : 0 }}>
        <input
          value={newCrewName}
          onChange={(e) => setNewCrewName(e.target.value.slice(0, 30))}
          onKeyDown={(e) => { if (e.key === 'Enter') onAddCrewMember(); }}
          disabled={crew.length >= MAX_CREW}
          placeholder={crew.length >= MAX_CREW ? `Crew is full (max ${MAX_CREW})` : 'Add a name...'}
          style={{ flex: 1, padding: '8px 10px', borderRadius: 10, border: `1px solid ${C.cardBorder}`, background: C.card, color: C.text, fontSize: 12, outline: 'none', opacity: crew.length >= MAX_CREW ? 0.6 : 1 }}
        />
        <button
          onClick={onAddCrewMember} disabled={crew.length >= MAX_CREW}
          style={{ padding: '8px 12px', minHeight: 44, borderRadius: 10, border: 'none', background: C.accentBtn, color: 'white', fontSize: 12, fontWeight: 600, cursor: crew.length >= MAX_CREW ? 'default' : 'pointer', opacity: crew.length >= MAX_CREW ? 0.6 : 1 }}
        >
          Add
        </button>
      </div>

      {crew.length > 0 && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: C.textMid, cursor: 'pointer' }}>
          <input
            type="checkbox" checked={includeNameInShare}
            onChange={(e) => setIncludeNameInShare(e.target.checked)}
            style={{ width: 14, height: 14, accentColor: C.accent, cursor: 'pointer' }}
          />
          Include their name in the shared message
        </label>
      )}
    </div>
  );
}