import React, { useMemo, useRef, useEffect } from 'react';
import { groupBuildingsByCategory, searchBuildings } from '../utils/buildingCategories.js';

// Full-screen searchable, categorized building list — the "Set My Location
// Manually" flow. Replaces the old drag-a-pin picker: tapping a name is a
// single reliable action, no map-drag coordination needed.
export default function ManualLocationPicker({
  show, C, BUILDINGS, query, onQueryChange, onSelect, onClose, panelRef,
}) {
  const inputRef = useRef(null);
  useEffect(() => { if (show) setTimeout(() => inputRef.current?.focus(), 50); }, [show]);

  const sections = useMemo(() => groupBuildingsByCategory(BUILDINGS), [BUILDINGS]);
  const searchResults = useMemo(() => searchBuildings(BUILDINGS, query), [BUILDINGS, query]);
  const isSearching = query.trim().length > 0;

  if (!show) return null;

  return (
    <div role="dialog" aria-modal="true" aria-label="Set my location" ref={panelRef}
      style={{ position: 'fixed', inset: 0, zIndex: 55, display: 'flex', flexDirection: 'column',
        background: C.bgGrad1, animation: 'searchIn .25s ease' }}>
      <div style={{ padding: '54px 16px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button aria-label="Back" onClick={onClose}
          style={{ width: 40, height: 40, borderRadius: '50%', background: C.card,
            border: `1px solid ${C.cardBorder}`, display: 'flex', alignItems: 'center',
            justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill={C.textMid}>
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
          </svg>
        </button>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text, fontFamily: "'Space Grotesk',sans-serif" }}>
            Set My Location
          </div>
          <div style={{ fontSize: 12, color: C.textLight }}>Pick where you are on campus</div>
        </div>
      </div>

      <div style={{ padding: '0 16px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: C.cardSolid,
          border: `1px solid ${C.cardBorder}`, borderRadius: 20, padding: '12px 16px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill={C.textLight}>
            <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
          </svg>
          <input ref={inputRef} value={query} onChange={e => onQueryChange(e.target.value)}
            placeholder="Search buildings..." aria-label="Search buildings"
            style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 15, color: C.text, outline: 'none' }} />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 24px' }}>
        {isSearching ? (
          searchResults.length === 0 ? (
            <div style={{ textAlign: 'center', color: C.textLight, fontSize: 13, padding: '24px 0' }}>
              No matching place found.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {searchResults.map(item => (
                <BuildingButton key={item.key} item={item} C={C} onClick={() => onSelect(item.key)} />
              ))}
            </div>
          )
        ) : (
          sections.map(section => (
            <div key={section.cat} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.textLight, marginBottom: 10,
                letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                {section.label}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {section.items.map(item => (
                  <BuildingButton key={item.key} item={item} C={C} onClick={() => onSelect(item.key)} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function BuildingButton({ item, C, onClick }) {
  return (
    <button onClick={onClick}
      style={{ textAlign: 'left', padding: '13px 14px', background: C.card,
        border: `1px solid ${C.cardBorder}`, borderRadius: 14, color: C.text,
        fontSize: 13, fontWeight: 600, fontFamily: 'Sora', cursor: 'pointer',
        minHeight: 44, display: 'flex', alignItems: 'center' }}>
      {item.name}
    </button>
  );
}