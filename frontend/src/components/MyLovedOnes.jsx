export default function MyLovedOnes({ saved, onView, onRemove }) {
  if (saved.loading) return <p role="status">Loading your saved graves...</p>;
  if (saved.error) return <div role="alert"><p>{saved.error}</p><button className="btn btn-ghost" onClick={saved.retry}>Try again</button></div>;
  return <section>
    <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>Your private list, saved to your account. Saved details reflect the time you added the grave.</p>
    {!saved.items.length ? <div className="service-card" style={{ padding: 24 }}><h3>No saved graves yet</h3><p>Find your loved one on the map, select their grave or floor, then choose Save to My Loved Ones.</p><button className="btn btn-primary" onClick={() => onView(null)}>Find a grave</button></div> :
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 270px), 1fr))', gap: 16 }}>
        {saved.items.map(item => <article className="service-card" key={item.id} style={{ padding: 20, overflowWrap: 'anywhere' }}>
          <h3 style={{ marginTop: 0 }}>{item.details.name}</h3>
          <p>{item.cemetery === 'new' ? 'New' : 'Old'} Cemetery · {item.grave_id}</p>
          <p style={{ color: 'var(--text-secondary)' }}>{item.details.location}{item.details.floor ? ` · Floor ${item.details.floor}` : ''}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button className="btn btn-primary" onClick={() => onView({ ...item.details, id: item.grave_id, grave_id: item.grave_id, cemeteryMap: item.cemetery, status: 'unknown' })}>View on map</button>
            <button className="btn btn-ghost" disabled={saved.busy} onClick={() => onRemove(item.id)}>Remove</button>
          </div>
        </article>)}
      </div>}
  </section>;
}
