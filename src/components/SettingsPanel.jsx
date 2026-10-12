import React from 'react';
import { AIcon, IconTextSize, IconContrast, IconVolume, IconVolumeOff, IconX } from './icons.jsx';

const TEXT_SCALES = [
  { key: 'small', label: 'Small', value: 0.9 },
  { key: 'medium', label: 'Medium', value: 1 },
  { key: 'large', label: 'Large', value: 1.15 },
];

// Settings modal: text size, high-contrast mode, and voice narration for
// turn-by-turn directions. Text size is applied as a CSS `zoom` on the app's
// UI chrome (search bar, panels, bottom sheet) via a wrapping style the
// caller applies — NOT on the Leaflet map div itself, since zooming the map
// container would throw off tap/click coordinates for the actual map
// interactions. `zoom` is broadly supported in Chromium/WebKit browsers
// (Chrome, Edge, Safari 15.4+); it's a pragmatic one-line way to scale an
// entire UI's text+layout together rather than converting every hardcoded
// px font-size in the app to a token-based scale, which would be a much
// larger refactor for the same practical result.
export { TEXT_SCALES };

export default function SettingsPanel({
  C, glassSolid, glass, panelRef,
  show, onClose,
  textScaleKey, onTextScaleChange,
  highContrast, onHighContrastChange,
  voiceEnabled, onVoiceEnabledChange,
  voiceVolume, onVoiceVolumeChange,
}) {
  if (!show) return null;
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 150,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
        animation: 'fadeIn .2s ease', pointerEvents: 'auto'
      }}
      onClick={onClose}
    >
      <div
        role="dialog" aria-modal="true" aria-labelledby="settings-dialog-title" ref={panelRef}
        style={{
          ...glassSolid, borderRadius: 24, padding: '24px', margin: '0 16px',
          maxWidth: 380, width: '100%', maxHeight: 'calc(100vh - 40px)', overflowY: 'auto',
          animation: 'modalIn .25s ease', boxShadow: `0 16px 48px rgba(0,0,0,0.4)`
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: C.accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AIcon icon={IconContrast} size={18} color={C.accent} />
            </div>
            <div>
              <h2 id="settings-dialog-title" style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: 0, fontFamily: "'Space Grotesk',sans-serif" }}>
                Settings & Preferences
              </h2>
              <div style={{ fontSize: 11, color: C.textLight }}>Accessibility, audio & map display</div>
            </div>
          </div>
          <button
            onClick={onClose} aria-label="Close settings"
            style={{ width: 38, height: 38, borderRadius: '50%', border: 'none', background: C.card, color: C.textMid, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
          >
            <AIcon icon={IconX} size={18} />
          </button>
        </div>

        {/* Text size */}
        <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${C.cardBorder}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <AIcon icon={IconTextSize} size={16} color={C.accent} />
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Text size & scaling</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {TEXT_SCALES.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => onTextScaleChange(opt.key)}
                aria-pressed={textScaleKey === opt.key}
                style={{
                  flex: 1, minHeight: 44, padding: '10px 8px', borderRadius: 12,
                  border: `1.5px solid ${textScaleKey === opt.key ? C.accentBtn : C.cardBorder}`,
                  background: textScaleKey === opt.key ? C.accentBtn : C.card,
                  color: textScaleKey === opt.key ? 'white' : C.textMid,
                  fontSize: 13, fontWeight: 600, fontFamily: 'Sora', cursor: 'pointer',
                  boxShadow: textScaleKey === opt.key ? `0 4px 12px ${C.shadow}` : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* High contrast */}
        <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${C.cardBorder}` }}>
          <div
            onClick={() => onHighContrastChange(!highContrast)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AIcon icon={IconContrast} size={16} color={C.accent} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>High contrast mode</div>
                <div style={{ fontSize: 11, color: C.textLight, marginTop: 2 }}>
                  Maximizes contrast between routes, labels & backgrounds
                </div>
              </div>
            </div>
            <button
              type="button"
              role="switch" aria-checked={highContrast}
              onClick={(e) => { e.stopPropagation(); onHighContrastChange(!highContrast); }}
              style={{
                width: 48, height: 28, borderRadius: 14, position: 'relative', cursor: 'pointer', border: 'none',
                background: highContrast ? C.accentBtn : 'rgba(120,120,128,0.28)', transition: 'background 0.2s', flexShrink: 0, padding: 0
              }}
            >
              <span style={{
                position: 'absolute', top: 3, left: highContrast ? 23 : 3, width: 22, height: 22, borderRadius: '50%',
                background: 'white', transition: 'left 0.2s cubic-bezier(0.34,1.56,0.64,1)', boxShadow: '0 2px 5px rgba(0,0,0,0.3)', display: 'block'
              }} />
            </button>
          </div>
        </div>

        {/* Voice narration */}
        <div style={{ marginBottom: 12 }}>
          <div
            onClick={() => onVoiceEnabledChange(!voiceEnabled)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none', marginBottom: voiceEnabled ? 12 : 0 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AIcon icon={voiceEnabled ? IconVolume : IconVolumeOff} size={16} color={C.accent} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Spoken voice guidance</div>
                <div style={{ fontSize: 11, color: C.textLight, marginTop: 2 }}>
                  Speaks walking directions and audio route updates
                </div>
              </div>
            </div>
            <button
              type="button"
              role="switch" aria-checked={voiceEnabled}
              onClick={(e) => { e.stopPropagation(); onVoiceEnabledChange(!voiceEnabled); }}
              style={{
                width: 48, height: 28, borderRadius: 14, position: 'relative', cursor: 'pointer', border: 'none',
                background: voiceEnabled ? C.accentBtn : 'rgba(120,120,128,0.28)', transition: 'background 0.2s', flexShrink: 0, padding: 0
              }}
            >
              <span style={{
                position: 'absolute', top: 3, left: voiceEnabled ? 23 : 3, width: 22, height: 22, borderRadius: '50%',
                background: 'white', transition: 'left 0.2s cubic-bezier(0.34,1.56,0.64,1)', boxShadow: '0 2px 5px rgba(0,0,0,0.3)', display: 'block'
              }} />
            </button>
          </div>
          {voiceEnabled && (
            <div style={{ background: C.card, borderRadius: 14, padding: '12px 14px', marginTop: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 500, color: C.textMid, marginBottom: 8 }}>
                <span>Voice volume</span>
                <span style={{ fontWeight: 700, color: C.accent }}>{voiceVolume}%</span>
              </div>
              <input
                type="range" min="10" max="100" value={voiceVolume}
                onChange={(e) => onVoiceVolumeChange(Number(e.target.value))}
                aria-label="Voice volume"
                style={{ width: '100%', accentColor: C.accent, cursor: 'pointer' }}
              />
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            width: '100%', minHeight: 44, marginTop: 16, padding: '12px',
            background: C.accentBtn, color: 'white', border: 'none', borderRadius: 14,
            fontSize: 14, fontWeight: 600, fontFamily: 'Sora', cursor: 'pointer',
            boxShadow: `0 4px 14px ${C.shadow}`
          }}
        >
          Done
        </button>
      </div>
    </div>
  );
}