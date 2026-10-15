import { useState, useEffect } from 'react';

export default function GravePanel({ grave, onClose, mapRef, onApply, graveData = [], columbariumSlots = [], onNavigateRoute, isNavigating = false, onSaveGrave, isGraveSaved = () => false, saveBusy = false }) {
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= 768 : false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!grave) return null;

  // Standard cemetery stacks have four floors; ground plots use their saved layout.
  const defaultFloors = grave.isPlotStack && !grave.isGroundPlotStack ? 4 : 1;
  const floorCount = Math.max(1, Number(grave.floors || grave.estimated_stack_height || defaultFloors));
  const floorLabels = Array.from({ length: floorCount }, (_, index) => floorCount - index);
  const normalizeSectionName = (section) => {
    if (!section) return '';
    const text = String(section).trim();
    if (/^[A-Za-z]$/.test(text)) return `Section ${text.toUpperCase()}`;
    const upper = text.replace(/^(sec(?:tion)?\s*)/i, 'Section ');
    const match = upper.match(/^Section\s*([A-Za-z])$/i);
    if (match) return `Section ${match[1].toUpperCase()}`;
    return upper;
  };

  const stackId = grave.id || grave.grave_id; // The ID of the stack, e.g., "Section A-new-C1"
  const cemeteryMapContext = grave.cemeteryMap || grave.cemetery_map || 'old';
  const sectionName = normalizeSectionName(grave.section || (grave.id ? grave.id.split('-C')[0] : ''));
  const columnNumber = grave.column || (grave.id ? parseInt(String(grave.id).split('-C').pop(), 10) : undefined);

  // If the selected item matches a columbarium slot id, prefer that data
  // For a stack, we don't have a single matchedColumbarium, but rather 4 slots.
  // The grave object itself should contain the stack info.
  const displayStatus = grave.status || 'available'; // This will be 'available' for the stack
  const displayName = grave.name; // This will be 'Multi-level Plot'
  const displayDates = grave.dates;
  const displayLocation = grave.location;

  const statusBadge = {
    available: 'badge-green',
    occupied: 'badge-red',
    reserved: 'badge-red',
  };

  const mobileCenterStyles = {};

  if (grave.isPlotStack) {
    return (
      <div className={`grave-panel ${grave ? 'show' : ''}`} style={{ width: isMobile ? '90%' : '320px', maxWidth: '350px', zIndex: 99999, ...mobileCenterStyles }}>
        <div className="gp-header">
          <div>
            <div className="gp-id">{stackId}</div>
          <div className="gp-name">Multi-level Plot ({floorCount} Floor{floorCount === 1 ? '' : 's'})</div>
          </div>
          <button className="gp-close" onClick={onClose}>✕</button>
        </div>
        <div className="gp-body" style={{ padding: '16px', overflowY: 'auto', maxHeight: '60vh' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>Select a floor level to view:</div>
          <div className="gp-floor-grid" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {floorLabels.map(floor => {
              // Construct the standard slot ID for each floor
              const slotId = grave.isGroundPlotStack
                ? `${stackId}-F${floor}`
                : `${sectionName}-F${floor}-C${columnNumber}`;
              
              const floorRecord = (!grave.isGroundPlotStack && columbariumSlots.find(s => 
                normalizeSectionName(s.section) === sectionName &&
                Number(s.floor) === floor &&
                Number(s.col) === columnNumber &&
                s.cemeteryMap === cemeteryMapContext
              )) || {
                id: slotId,
                grave_id: slotId,
                status: 'available',
                name: '— Available —',
                dates: '—',
                location: `${grave.location} - Floor ${floor}`,
                latlng: grave.latlng,
                cemeteryMap: grave.cemeteryMap
              };
              
              const saveTarget = { ...floorRecord, cemeteryMap: cemeteryMapContext, floor, latlng: floorRecord.latlng || grave.latlng, location: floorRecord.location || grave.location };
              return (
                <div key={floor} style={{ 
                  padding: '12px', 
                  background: 'var(--bg-card)', 
                  border: '1px solid var(--border)', 
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '14px' }}>Floor {floor}</div>
                    <span className={`badge ${statusBadge[floorRecord.status] || 'badge-green'}`} style={{ fontSize: '10px' }}>
                      {floorRecord.status === 'reserved' ? 'UNAVAILABLE' : floorRecord.status.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {floorRecord.status === 'occupied'
                      ? `Occupant: ${floorRecord.name}`
                      : floorRecord.status === 'reserved'
                        ? 'Slot unavailable'
                        : 'Empty slot ready for assignment'}
                  </div>
                  {onSaveGrave && floorRecord.status === 'occupied' && <button className="btn btn-ghost btn-sm" disabled={saveBusy || isGraveSaved(saveTarget)} onClick={() => onSaveGrave(saveTarget)}>{isGraveSaved(saveTarget) ? 'Saved' : 'Save to My Loved Ones'}</button>}
                </div>
              );
            })}
          </div>
        </div>
        <div className="gp-footer">
          <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
            <button className="btn btn-primary btn-sm" style={{ flex: 1, background: '#4285F4', borderColor: '#4285F4', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }} onClick={() => { if(onNavigateRoute) onNavigateRoute(grave); }}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M21.71 11.29l-9-9a.996.996 0 0 0-1.41 0l-9 9a.996.996 0 0 0 0 1.41l9 9c.39.39 1.02.39 1.41 0l9-9a.996.996 0 0 0 0-1.41zM14 14.5V12h-4v3H8v-4c0-.55.45-1 1-1h5V7.5l3.5 3.5-3.5 3.5z"/></svg>
              Directions
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`grave-panel ${grave ? 'show' : ''}`} style={isMobile ? { width: '90%', maxWidth: '350px', zIndex: 99999, ...mobileCenterStyles } : {}}>
      <div className="gp-header">
        <div>
          <div className="gp-id">Grave {grave.grave_id}</div>
          <div className="gp-name">{displayName}</div>
        </div>
        <button className="gp-close" onClick={onClose}>✕</button>
      </div>
      <div className="gp-body">
        <div className="gp-row">
          <span className="gp-label">Status</span>
          <span className="gp-val"><span className={`badge ${statusBadge[displayStatus]}`}>{displayStatus === 'reserved' ? 'UNAVAILABLE' : displayStatus.toUpperCase()}</span></span>
        </div>
        <div className="gp-row">
          <span className="gp-label">Dates</span>
          <span className="gp-val">{displayDates}</span>
        </div>
        <div className="gp-row">
          <span className="gp-label">Location</span>
          <span className="gp-val">{displayLocation}</span>
        </div>
        <div className="gp-row">
          <span className="gp-label">Plot Type</span>
          <span className="gp-val">Standard (2 × 1 m)</span>
        </div>
      </div>
      <div className="gp-footer">
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', width: '100%' }}>
          <button className="btn btn-primary btn-sm" style={{ flex: 1, background: '#4285F4', borderColor: '#4285F4', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }} onClick={() => { if(onNavigateRoute) onNavigateRoute(grave); }}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M21.71 11.29l-9-9a.996.996 0 0 0-1.41 0l-9 9a.996.996 0 0 0 0 1.41l9 9c.39.39 1.02.39 1.41 0l9-9a.996.996 0 0 0 0-1.41zM14 14.5V12h-4v3H8v-4c0-.55.45-1 1-1h5V7.5l3.5 3.5-3.5 3.5z"/></svg>
            Directions
          </button>
          {onSaveGrave && <button className="btn btn-ghost btn-sm" disabled={saveBusy || isGraveSaved(grave)} onClick={() => onSaveGrave(grave)}>{isGraveSaved(grave) ? 'Saved to My Loved Ones' : 'Save to My Loved Ones'}</button>}
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ width: '100%' }}>Close</button>
        </div>
      </div>
    </div>
  );
}
