import React from 'react';
import { AIcon, IconRoute, IconBolt, IconWheelchair } from './icons.jsx';
import { ROUTE_TYPES, routeTypeLabel } from '../utils/routeTypes.js';

const ROUTE_TYPE_ICONS = {
  shortest: IconRoute,
  fastest: IconBolt,
  accessible: IconWheelchair,
};

// A 3-way segmented control for choosing how routes get computed. Shown both
// in the search overlay (so the choice applies to the next destination you
// pick) and in the active route panel (so you can switch mode for the
// current route without re-searching from scratch).
export default function RouteTypeSelector({ C, glass, routeType, onChange, compact = false }) {
  return (
    <div
      role="radiogroup"
      aria-label="Route type"
      style={{ display: 'flex', gap: 4, ...glass, borderRadius: 14, padding: 4 }}
    >
      {ROUTE_TYPES.map((type) => {
        const Icon = ROUTE_TYPE_ICONS[type];
        const active = routeType === type;
        return (
          <button
            key={type}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(type)}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: compact ? '8px 6px' : '10px 8px',
              minHeight: 44,
              border: 'none',
              borderRadius: 10,
              background: active ? C.accentBtn : 'transparent',
              color: active ? 'white' : C.textMid,
              fontSize: compact ? 11 : 12,
              fontWeight: 600,
              fontFamily: 'Sora',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            <AIcon icon={Icon} size={14} />
            <span>{routeTypeLabel(type)}</span>
          </button>
        );
      })}
    </div>
  );
}