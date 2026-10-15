import { useMemo, useState } from 'react';
import { memorialLabel } from './ApartmentNicheWall.jsx';
import './StaffDashboard.css';

const statuses = ['available', 'occupied', 'reserved'];
export default function StaffDashboard({ slots, groundPlots = [], groundPlotError = '', cemetery, onCemeteryChange, onSection, onReview, onRecords, onMap, onNiches }) {
  const [attentionPage, setAttentionPage] = useState(0);
  const data = useMemo(() => {
    const totals = { available: 0, occupied: 0, reserved: 0, total: 0 };
    const sections = new Map();
    const attention = [];
    slots.filter(slot => slot.cemeteryMap === cemetery).forEach(slot => {
      totals.total++;
      if (statuses.includes(slot.status)) totals[slot.status]++;
      const key = slot.section || 'Unspecified section';
      if (!sections.has(key)) sections.set(key, { name: key, available: 0, occupied: 0, reserved: 0, total: 0 });
      const group = sections.get(key); group.total++;
      if (statuses.includes(slot.status)) group[slot.status]++;
      if (slot.status === 'occupied') {
        const people = String(slot.name || '').split(/,\s*(?!\d)/).filter(Boolean).map(name => memorialLabel({ name }));
        const missingName = !people.length || people.some(person => !person.name);
        const missingDate = !people.length || people.some(person => !person.deathDate);
        if (missingName || missingDate) attention.push({ slot, reason: [missingName && 'Name not recorded', missingDate && 'Death date not recorded'].filter(Boolean).join(' · ') });
      }
    });
    const plots = groundPlots.filter(plot => (plot.cemetery_code || plot.cemetery?.code || 'old') === cemetery);
    const plotTotals = { available: 0, occupied: 0, reserved: 0, maintenance: 0, total: plots.length };
    const plotSections = new Map();
    plots.forEach(plot => {
      const status = String(plot.status || '').toLowerCase();
      if (Object.hasOwn(plotTotals, status) && status !== 'total') plotTotals[status]++;
      const name = plot.section_name || plot.section || 'Unspecified section';
      const section = plotSections.get(name) || { name, total: 0, available: 0, occupied: 0, reserved: 0, maintenance: 0 };
      section.total++;
      if (Object.hasOwn(section, status) && status !== 'total') section[status]++;
      plotSections.set(name, section);
    });
    const maintenancePlots = plots.filter(plot => String(plot.status || '').toLowerCase() === 'maintenance');
    const groundOccupancyRate = plots.length ? Math.round((plotTotals.occupied / plots.length) * 100) : 0;
    const groundStatusRows = [
      { label: 'Available', value: plotTotals.available, tone: 'available' },
      { label: 'Occupied', value: plotTotals.occupied, tone: 'occupied' },
      { label: 'Reserved', value: plotTotals.reserved, tone: 'reserved' },
      { label: 'Maintenance', value: plotTotals.maintenance, tone: 'maintenance' },
    ];
    const spaceTotals = {
      total: totals.total + plotTotals.total,
      available: totals.available + plotTotals.available,
      occupied: totals.occupied + plotTotals.occupied,
      reserved: totals.reserved + plotTotals.reserved,
      maintenance: plotTotals.maintenance,
    };
    return {
      totals,
      attention,
      sections: [...sections.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
      plotTotals,
      plotSections: [...plotSections.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
      maintenancePlots,
      groundOccupancyRate,
      groundStatusRows,
      spaceTotals,
    };
  }, [slots, groundPlots, cemetery]);
  const page = Math.min(attentionPage, Math.max(0, Math.ceil(data.attention.length / 5) - 1));
  const cards = [
    ['Available niches', data.totals.available, `${data.totals.total.toLocaleString()} total niche records`, 'available'],
    ['Occupied niches', data.totals.occupied, 'Recorded as occupied', 'occupied'],
    ['Reserved niches', data.totals.reserved, 'Set aside for assignment', 'reserved'],
    ['Available ground plots', data.plotTotals.available, `${data.plotTotals.total.toLocaleString()} total ground plots`, 'ground'],
    ['Plots under maintenance', data.plotTotals.maintenance, 'Ground plots requiring follow-up', 'attention'],
  ];
  return <div className="staff-dashboard">
    <header className="staff-dash-header"><div><span className="staff-eyebrow">CEMETERY OPERATIONS</span><h1>Cemetery Staff Dashboard</h1><p>Track plot and niche availability, and follow up on maintenance records.</p></div><div className="staff-cemetery-toggle" role="group" aria-label="Dashboard cemetery">{['old', 'new'].map(value => <button type="button" key={value} aria-pressed={cemetery === value} onClick={() => { onCemeteryChange(value); setAttentionPage(0); }}>{value === 'old' ? 'Old' : 'New'} Cemetery</button>)}</div></header>
    <div className="staff-scope">{cemetery === 'old' ? 'Old' : 'New'} Cemetery · {data.totals.total.toLocaleString()} niches · {data.plotTotals.total.toLocaleString()} ground plots · {data.sections.length} niche sections · {data.plotSections.length} ground plot sections</div>
    <div className="staff-stat-grid">{cards.map(([label, value, caption, tone]) => <article key={label} className={`staff-stat ${tone}`}><h2>{label}</h2><strong>{value.toLocaleString()}</strong><p>{caption}</p></article>)}</div>
    <section className="staff-space-summary" aria-label="Combined cemetery space overview">
      <div className="staff-space-summary-heading"><div><span className="staff-section-kicker">CEMETERY CAPACITY</span><h2>All cemetery spaces</h2><p>Combined view of apartment niches and ground plots in the selected cemetery.</p></div><strong>{data.spaceTotals.total.toLocaleString()} <small>total spaces</small></strong></div>
      <div className="staff-space-summary-grid">
        <div className="staff-space-summary-item total"><span>Total spaces</span><strong>{data.spaceTotals.total.toLocaleString()}</strong><small>{data.totals.total.toLocaleString()} niches + {data.plotTotals.total.toLocaleString()} ground plots</small></div>
        <div className="staff-space-summary-item available"><span>Available</span><strong>{data.spaceTotals.available.toLocaleString()}</strong><small>Niches and plots ready for assignment</small></div>
        <div className="staff-space-summary-item occupied"><span>Occupied</span><strong>{data.spaceTotals.occupied.toLocaleString()}</strong><small>Currently assigned or in use</small></div>
        <div className="staff-space-summary-item reserved"><span>Reserved</span><strong>{data.spaceTotals.reserved.toLocaleString()}</strong><small>Set aside for future assignment</small></div>
      </div>
      <p className="staff-space-summary-note">Maintenance count is based on ground plot records only; niche maintenance is tracked separately when available.</p>
    </section>
    <div className="staff-dash-grid">
      <section className="staff-dash-card"><div className="staff-card-heading"><div><h2>Availability by section</h2><p>Select a section to open its apartment niches.</p></div><span>{data.totals.total ? Math.round(data.totals.occupied / data.totals.total * 100) : 0}% occupied</span></div>
        <div className="staff-chart-legend">{statuses.map(status => <span key={status}><i className={status} />{status}</span>)}</div>
        <div className="staff-section-list">{data.sections.map(section => <button type="button" key={section.name} className="staff-section-row" onClick={() => onSection(section.name, cemetery)} aria-label={`${section.name}: ${section.available} available, ${section.occupied} occupied, ${section.reserved} reserved`}>
          <div className="staff-section-title"><strong>{section.name}</strong><span>{section.available} available / {section.total} total →</span></div>
          <div className="staff-section-bar" aria-hidden="true">{statuses.map(status => <span key={status} className={status} style={{ width: `${section.total ? section[status] / section.total * 100 : 0}%` }} />)}</div>
          <div className="staff-section-counts">{statuses.map(status => <span key={status}>{section[status]} {status}</span>)}</div>
        </button>)}</div>
        {!data.sections.length && <p className="staff-empty">No niche records loaded for this cemetery.</p>}
      </section>
      <section className="staff-dash-card"><div className="staff-card-heading"><div><h2>Needs attention</h2><p>Missing information in occupied niche records.</p></div><span>{data.attention.length}</span></div>
        {data.attention.slice(page * 5, page * 5 + 5).map(({ slot, reason }) => <article className="staff-attention-row" key={slot.id}><div><strong>{memorialLabel(slot).name || 'Name not recorded'}</strong><small>{slot.section} · Floor {slot.floor} · {slot.id}</small><p>{reason}</p></div><button type="button" className="btn btn-ghost btn-sm" onClick={() => onReview(slot)}>Review Record</button></article>)}
        {!data.attention.length && <p className="staff-empty">{data.totals.total ? 'No missing names or death dates detected in the loaded occupied records.' : 'Load niche records to see items for review.'}</p>}
        {data.attention.length > 5 && <div className="staff-attention-pages"><button className="btn btn-ghost btn-sm" disabled={!page} onClick={() => setAttentionPage(page - 1)}>Previous</button><span>{page + 1} / {Math.ceil(data.attention.length / 5)}</span><button className="btn btn-ghost btn-sm" disabled={(page + 1) * 5 >= data.attention.length} onClick={() => setAttentionPage(page + 1)}>Next</button></div>}
        <p className="staff-dash-note">Dates are checked from existing record text. Review flagged records to confirm completeness.</p>
      </section>
    </div>
    <section className="staff-dash-card staff-ground-overview">
      <div className="staff-card-heading"><div><span className="staff-section-kicker">SPACE UTILIZATION</span><h2>Ground plot operations</h2><p>Capacity and maintenance status for recorded ground plots.</p></div><span>{data.plotTotals.total.toLocaleString()} plots</span></div>
      {groundPlotError && <p className="staff-data-error" role="status">{groundPlotError}</p>}
      {!groundPlotError && data.plotTotals.total > 0 ? <>
        <div className="staff-ground-summary">
          <div className="staff-ground-progress" aria-label={`${data.groundOccupancyRate}% of ground plots occupied`}>
            <div className="staff-ground-progress-ring" style={{ '--ground-occupancy': `${data.groundOccupancyRate}%` }}><strong>{data.groundOccupancyRate}%</strong><span>occupied</span></div>
            <div className="staff-ground-summary-copy"><strong>{data.plotTotals.occupied.toLocaleString()} of {data.plotTotals.total.toLocaleString()} plots in use</strong><span>{data.plotTotals.available.toLocaleString()} spaces remain available for future assignments.</span></div>
          </div>
          <div className="staff-ground-status-list">{data.groundStatusRows.map(({ label, value, tone }) => <div className="staff-ground-status" key={label}><div><i className={tone} /><span>{label}</span></div><strong>{value.toLocaleString()}</strong><small>{Math.round((value / data.plotTotals.total) * 100)}%</small></div>)}</div>
        </div>
        <div className="staff-ground-metrics">
          {data.groundStatusRows.map(({ label, value, tone }) => <div key={label} className={`staff-ground-metric ${tone}`}><span>{label}</span><strong>{value.toLocaleString()}</strong><small>{Math.round((value / data.plotTotals.total) * 100)}% of capacity</small></div>)}
        </div>
        {data.maintenancePlots.length > 0 && <div className="staff-maintenance-list">
          <h3>Ground plots flagged for maintenance</h3>
          {data.maintenancePlots.slice(0, 5).map(plot => <div className="staff-maintenance-row" key={plot.id || plot.plot_id}>
            <div><strong>{plot.plot_id || 'Plot record'}</strong><span>{plot.section_name || plot.section || 'Unspecified section'}{plot.location_description ? ` · ${plot.location_description}` : ''}</span></div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onMap(cemetery)}>View map</button>
          </div>)}
        </div>}
        {!data.maintenancePlots.length && <div className="staff-maintenance-empty"><span aria-hidden="true">✓</span><div><strong>All ground plots are operational</strong><p>No ground plots are currently marked for maintenance.</p></div></div>}
      </> : !groundPlotError && <p className="staff-empty">No ground plot records are available for this cemetery.</p>}
    </section>
    <section className="staff-quick-actions" aria-label="Quick actions"><button type="button" onClick={() => onRecords(cemetery)}><strong>Find a Record →</strong><span>Search names and filter burial records</span></button><button type="button" onClick={() => onNiches(cemetery)}><strong>Open Apartment Niches →</strong><span>Browse sections and floors</span></button><button type="button" onClick={() => onMap(cemetery)}><strong>Open Cemetery Map →</strong><span>View the selected cemetery</span></button></section>
  </div>;
}
