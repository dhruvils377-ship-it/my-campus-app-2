import React from 'react';
import { AIcon, IconNavigation } from './icons.jsx';

// The "Feeling lost?" prompt — triggered by a swipe-down gesture at the top
// of the map (see App.jsx). Kept as its own component since its props are a
// clean, small surface: the theme object, a couple of glass-panel styles,
// visibility, and two callbacks. No routing/GPS state lives in here.
export default function LostModal({ show, C, glassSolid, modalRef, onClose, onGoToMainGate }) {
  if (!show) return null;
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)',
        animation: 'fadeIn .2s ease', pointerEvents: 'auto',
      }}
      onClick={onClose}
    >
      <div
        role="dialog" aria-modal="true" aria-labelledby="lost-dialog-title" ref={modalRef}
        style={{ ...glassSolid, borderRadius: 24, padding: '24px', margin: '0 20px', maxWidth: 320, animation: 'modalIn .3s ease' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <AIcon icon={IconNavigation} size={40} color={C.accent} />
        </div>
        <h2
          id="lost-dialog-title"
          style={{ fontSize: 18, fontWeight: 700, color: C.text, textAlign: 'center', marginBottom: 8, marginTop: 0, fontFamily: "'Space Grotesk',sans-serif" }}
        >
          Feeling lost?
        </h2>
        <div style={{ fontSize: 13, color: C.textMid, textAlign: 'center', marginBottom: 16, lineHeight: 1.5 }}>
          Try searching for a landmark near you, or tap below to navigate to the Main Gate.
        </div>
        <button
          onClick={onGoToMainGate}
          style={{
            width: '100%', padding: '14px', background: C.accentBtn, border: 'none', borderRadius: 14,
            color: 'white', fontSize: 15, fontWeight: 600, fontFamily: 'Sora', cursor: 'pointer',
            boxShadow: `0 4px 14px ${C.shadow}`, marginBottom: 8,
          }}
        >
          Take me to Main Gate
        </button>
        <button
          onClick={onClose}
          style={{
            width: '100%', padding: '12px', background: 'transparent', border: `1px solid ${C.cardBorder}`,
            borderRadius: 14, color: C.textMid, fontSize: 14, fontFamily: 'Sora', cursor: 'pointer',
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}