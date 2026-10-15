import { useMemo, useState } from 'react';
import newCemeteryMap from '../../../../anothermap.json';
import './CPDOAnalytics.css';

const COLORS = { occupied: '#ed8956', available: '#1687c9', maintenance: '#8491aa', other: '#aa85bf' };
const NAME = { old: 'Old Cemetery', new: 'New Cemetery' };
const NEW_MAPPED_SECTIONS = new Set((newCemeteryMap.features || [])
  .filter(feature => feature.geometry?.type === 'Polygon' && feature.properties?.name)
  .map(feature => String(feature.properties.name).trim().toLowerCase())).size;

function summarize(rows) {
  const counts = { occupied: 0, available: 0, maintenance: 0, other: 0, total: rows.length };
  rows.forEach(row => { const status = String(row.status || '').toLowerCase(); counts[Object.hasOwn(counts, status) ? status : 'other']++; });
  counts.rate = counts.total ? Math.round(counts.occupied / counts.total * 100) : 0;
  return counts;
}

function Legend() {
  return <div className="cpdo-legend">{Object.entries(COLORS).map(([name, color]) => <span key={name}><i style={{ background: color }} />{name}</span>)}</div>;
}

function Donut({ counts, label }) {
  const occupied = counts.total ? counts.occupied / counts.total * 100 : 0;
  const available = counts.total ? occupied + counts.available / counts.total * 100 : 0;
  const maintenance = counts.total ? available + counts.maintenance / counts.total * 100 : 0;
  const fill = counts.total ? `conic-gradient(${COLORS.occupied} 0 ${occupied}%, ${COLORS.available} ${occupied}% ${available}%, ${COLORS.maintenance} ${available}% ${maintenance}%, ${COLORS.other} ${maintenance}% 100%)` : 'var(--border)';
  return <div className="cpdo-donut" style={{ '--fill': fill }} role="img" aria-label={counts.total ? `${label}: ${counts.occupied} of ${counts.total} occupied` : `${label}: no registered units`}><div><strong>{counts.total ? `${counts.rate}%` : '—'}</strong><small>{counts.total ? 'occupied' : 'no records'}</small></div></div>;
}

export default function CPDOAnalytics({ groundPlots, columbariumSlots, cemeterySections }) {
  const [activeCemetery, setActiveCemetery] = useState('old');
  const data = useMemo(() => {
    const cemetery = ['old', 'new'].map(code => ({ code,
      ground: summarize(groundPlots.filter(row => (row.cemetery_code || 'old') === code)),
      niches: summarize(columbariumSlots.filter(row => (row.cemeteryMap || row.cemetery_code || 'old') === code)) }));
    const group = (rows, getCode, getName) => {
      const map = new Map();
      rows.forEach(row => { const code = getCode(row) || 'old'; const name = getName(row) || 'Unassigned'; const key = `${code}:${name}`; if (!map.has(key)) map.set(key, { key, code, name, rows: [] }); map.get(key).rows.push(row); });
      return [...map.values()].map(row => ({ ...row, counts: summarize(row.rows) })).sort((a, b) => b.counts.total - a.counts.total || a.name.localeCompare(b.name));
    };
    const ground = group(groundPlots, row => row.cemetery_code, row => row.section_name || row.section);
    const niches = group(columbariumSlots, row => row.cemeteryMap || row.cemetery_code, row => row.section);
    const makeZoneCounts = () => ({ active: 0, planned: 0, maintenance: 0, inactive: 0 });
    const zonesByCemetery = { old: makeZoneCounts(), new: makeZoneCounts() };
    cemeterySections.forEach(zone => {
      const props = zone.properties || zone;
      const code = props.cemetery_code || props.cemetery || 'old';
      const zones = zonesByCemetery[code] || zonesByCemetery.old;
      if (props.is_active === false) zones.inactive++;
      else zones[Object.hasOwn(zones, props.status) ? props.status : 'planned']++;
    });
    return { cemetery, ground, niches, zonesByCemetery };
  }, [groundPlots, columbariumSlots, cemeterySections]);
  const selectedCemetery = data.cemetery.find(row => row.code === activeCemetery) || data.cemetery[0];
  const ground = selectedCemetery.ground;
  const niches = selectedCemetery.niches;
  const activeZones = data.zonesByCemetery[activeCemetery];
  const zoneTotal = Object.values(activeZones).reduce((sum, count) => sum + count, 0);
  const activeGround = data.ground.filter(row => row.code === activeCemetery);
  const activeNiches = data.niches.filter(row => row.code === activeCemetery);
  const largestGround = Math.max(1, ...activeGround.map(row => row.counts.total));
  const largestNiche = Math.max(1, ...activeNiches.map(row => row.counts.total));
  const ranked = activeGround.filter(row => row.counts.total >= 5).sort((a, b) => b.counts.rate - a.counts.rate || b.counts.occupied - a.counts.occupied).slice(0, 5);
  const zoneColors = { active: '#1687c9', planned: '#e9af58', maintenance: '#8491aa', inactive: '#aa85bf' };
  let progress = 0;
  const zoneGradient = Object.entries(activeZones).map(([name, count]) => { const start = progress; progress += zoneTotal ? count / zoneTotal * 100 : 0; return `${zoneColors[name]} ${start}% ${progress}%`; }).join(', ');

  return <div className="cpdo-analytics">
    <div className="cpdo-intro"><div><span className="cpdo-eyebrow">CAPACITY OVERVIEW</span><h2>{NAME[activeCemetery]} analytics</h2><p>Recorded plots, apartment niches, and planning sections for the selected cemetery.</p></div><div className="cpdo-intro-actions"><div className="cpdo-cemetery-switcher" role="tablist" aria-label="Select cemetery analytics">{['old', 'new'].map(code => <button key={code} type="button" role="tab" aria-selected={activeCemetery === code} className={activeCemetery === code ? 'active' : ''} onClick={() => setActiveCemetery(code)}>{NAME[code]}</button>)}</div><span className="cpdo-live">{NAME[activeCemetery]}</span></div></div>
    <div className="cpdo-kpis">
      <div><span>Ground plots</span><strong>{ground.total.toLocaleString()}</strong><small>{ground.available.toLocaleString()} available</small></div>
      <div><span>Apartment niches</span><strong>{niches.total.toLocaleString()}</strong><small>{niches.available.toLocaleString()} available</small></div>
      <div><span>Saved sections</span><strong>{zoneTotal}</strong><small>{activeCemetery === 'new' ? `${NEW_MAPPED_SECTIONS} mapped areas` : 'Registered sections'}</small></div>
      <div className="cpdo-kpi-highlight"><span>Ground occupancy</span><strong>{ground.rate}%</strong><small>{ground.occupied} of {ground.total} occupied</small></div>
    </div>
    <div className="cpdo-grid">
      <section className="planning-card cpdo-panel cpdo-compare"><header><span className="cpdo-eyebrow">{NAME[activeCemetery].toUpperCase()}</span><h3>{NAME[activeCemetery]} inventory</h3><p>Occupied share of the selected cemetery's registered inventory.</p></header><div className="cpdo-cemeteries"><div className="cpdo-cemetery"><h4>{NAME[activeCemetery]}</h4><p className="cpdo-map-count">{activeCemetery === 'new' ? `${NEW_MAPPED_SECTIONS} mapped areas in the public map` : 'Registered cemetery inventory'}</p><div className="cpdo-donut-pair">{[['Ground plots', ground], ['Apartment niches', niches]].map(([label, counts]) => <div key={label}><Donut counts={counts} label={`${NAME[activeCemetery]} ${label}`} /><b>{label}</b><span>{counts.total ? `${counts.occupied} / ${counts.total} occupied` : 'No registered units'}</span><small>{counts.total ? `${counts.available} available` : activeCemetery === 'new' && label === 'Ground plots' ? 'Map layout only' : 'No inventory yet'}</small></div>)}</div></div></div><Legend /></section>
      <section className="planning-card cpdo-panel cpdo-zone-panel"><header><span className="cpdo-eyebrow">ZONING</span><h3>{NAME[activeCemetery]} section status</h3><p>Current state of saved planning sections.</p></header>{zoneTotal ? <><div className="cpdo-zone-donut" style={{ '--fill': `conic-gradient(${zoneGradient})` }}><div><strong>{zoneTotal}</strong><small>sections</small></div></div><div className="cpdo-zone-key">{Object.entries(activeZones).map(([name, count]) => <div key={name}><i style={{ background: zoneColors[name] }} /><span>{name}</span><b>{count}</b></div>)}</div></> : <p className="cpdo-empty">No saved sections yet.</p>}</section>
      <section className="planning-card cpdo-panel cpdo-ground-panel"><header><span className="cpdo-eyebrow">GROUND INVENTORY</span><h3>{NAME[activeCemetery]} plots by section</h3><p>Status counts, ordered by total plots.</p></header>{activeGround.length ? <div className="cpdo-ground-chart">{activeGround.map(row => <div className="cpdo-ground-row" key={row.key}><div className="cpdo-row-name"><b>{row.name}</b><small>{NAME[activeCemetery]}</small></div><div className="cpdo-ground-area"><div className="cpdo-ground-bar" style={{ width: `${row.counts.total / largestGround * 100}%` }} role="img" aria-label={`${row.name}: ${row.counts.occupied} occupied, ${row.counts.available} available, ${row.counts.maintenance} maintenance`}>{Object.entries(COLORS).map(([status, color]) => row.counts[status] > 0 && <span key={status} title={`${row.counts[status]} ${status}`} style={{ width: `${row.counts[status] / row.counts.total * 100}%`, background: color }} />)}</div></div><b className="cpdo-row-count">{row.counts.total}</b></div>)}</div> : <p className="cpdo-empty">No recorded ground plots yet.</p>}<Legend /></section>
      <section className="planning-card cpdo-panel cpdo-niche-panel"><header><span className="cpdo-eyebrow">APARTMENT INVENTORY</span><h3>{NAME[activeCemetery]} niches by section</h3><p>Recorded slot counts by building section.</p></header>{activeNiches.length ? <div className="cpdo-niche-chart">{activeNiches.map(row => <div className="cpdo-niche-column" key={row.key} title={`${row.name}: ${row.counts.occupied} occupied, ${row.counts.available} available`}><b>{row.counts.total}</b><div className="cpdo-niche-bar" style={{ height: `${Math.max(8, row.counts.total / largestNiche * 100)}%` }}>{Object.entries(COLORS).map(([status, color]) => row.counts[status] > 0 && <span key={status} style={{ height: `${row.counts[status] / row.counts.total * 100}%`, background: color }} />)}</div><div className="cpdo-niche-name"><strong>{row.name}</strong><small>{NAME[activeCemetery]}</small></div></div>)}</div> : <p className="cpdo-empty">No recorded apartment niches yet.</p>}<Legend /></section>
      <section className="planning-card cpdo-panel cpdo-ranked"><header><span className="cpdo-eyebrow">PRIORITY VIEW</span><h3>Most occupied ground sections</h3><p>Sections with at least five recorded plots.</p></header>{ranked.length ? <div className="cpdo-rank-list">{ranked.map((row, index) => <div key={row.key}><span>{String(index + 1).padStart(2, '0')}</span><div><b>{row.name}</b><small>{NAME[row.code]} / {row.counts.occupied} of {row.counts.total} plots</small></div><strong>{row.counts.rate}%</strong></div>)}</div> : <p className="cpdo-empty">No section has at least five recorded plots yet.</p>}</section>
    </div>
    <p className="cpdo-method">Occupancy = occupied / total recorded units. Maintenance and other statuses remain in the denominator. Charts show recorded inventory, not projected capacity.</p>
  </div>;
}
