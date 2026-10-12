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
      style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', animation: 'fadeIn .2s ease' }}
      onClick={onClose}
    >
      <div
        role="dialog" aria-modal="true" aria-labelledby="settings-dialog-title" ref={panelRef}
        style={{ ...glassSolid, borderRadius: 24, padding: '20px', margin: '0 20px', maxWidth: 360, width: '100%', maxHeight: 'calc(100vh - 40px)', overflowY: 'auto', animation: 'modalIn .3s ease' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 id="settings-dialog-title" style={{ fontSize: 17, fontWeight: 700, color: C.text, margin: 0, fontFamily: "'Space Grotesk',sans-serif" }}>
            Settings
          </h2>
          <button
            onClick={onClose} aria-label="Close settings"
            style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: C.card, color: C.textMid, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <AIcon icon={IconX} size={18} />
          </button>
        </div>

        {/* Text size */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <AIcon icon={IconTextSize} size={16} color={C.accent} />
            <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Text size</span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {TEXT_SCALES.map((opt) => (
              <button
                key={opt.key}
                onClick={() => onTextScaleChange(opt.key)}
                aria-pressed={textScaleKey === opt.key}
                style={{
                  flex: 1, minHeight: 44, padding: '8px 6px', borderRadius: 10,
                  border: `1px solid ${textScaleKey === opt.key ? C.accentBtn : C.cardBorder}`,
                  background: textScaleKey === opt.key ? C.accentBtn : C.card,
                  color: textScaleKey === opt.key ? 'white' : C.textMid,
                  fontSize: 12, fontWeight: 600, fontFamily: 'Sora', cursor: 'pointer',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* High contrast */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AIcon icon={IconContrast} size={16} color={C.accent} />
              <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>High contrast</span>
            </div>
            <span
              role="switch" aria-checked={highContrast}
              onClick={() => onHighContrastChange(!highContrast)}
              style={{
                width: 44, height: 26, borderRadius: 13, position: 'relative', cursor: 'pointer',
                background: highContrast ? C.accentBtn : C.cardBorder, transition: 'background 0.2s', flexShrink: 0,
              }}
            >
              <span style={{
                position: 'absolute', top: 3, left: highContrast ? 21 : 3, width: 20, height: 20, borderRadius: '50%',
                background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }} />
            </span>
          </label>
          <div style={{ fontSize: 11, color: C.textLight, marginTop: 6, lineHeight: 1.4 }}>
            Maximizes contrast between text and backgrounds across the app.
          </div>
        </div>

        {/* Voice narration */}
        <div>
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: voiceEnabled ? 10 : 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AIcon icon={voiceEnabled ? IconVolume : IconVolumeOff} size={16} color={C.accent} />
              <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Voice directions</span>
            </div>
            <span
              role="switch" aria-checked={voiceEnabled}
              onClick={() => onVoiceEnabledChange(!voiceEnabled)}
              style={{
                width: 44, height: 26, borderRadius: 13, position: 'relative', cursor: 'pointer',
                background: voiceEnabled ? C.accentBtn : C.cardBorder, transition: 'background 0.2s', flexShrink: 0,
              }}
            >
              <span style={{
                position: 'absolute', top: 3, left: voiceEnabled ? 21 : 3, width: 20, height: 20, borderRadius: '50%',
                background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }} />
            </span>
          </label>
          {voiceEnabled && (
            <div>
              <input
                type="range" min="0" max="100" value={voiceVolume}
                onChange={(e) => onVoiceVolumeChange(Number(e.target.value))}
                aria-label="Voice volume"
                style={{ width: '100%', accentColor: C.accent }}
              />
              <div style={{ fontSize: 11, color: C.textLight, textAlign: 'right' }}>{voiceVolume}%</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}