import React from 'react';

export default function SheafTab({
  mortars, addMortar, deleteMortar, updateMortar,
  targetValid, sheafType, setSheafType,
  sheafSpread, setSheafSpread,
  calculateSheafDistribution,
}) {
  return (
    <div className="tab-content">
      <div className="input-section">
        <h4>Sheaf Configuration</h4>
        <div className="sheaf-controls">
          <div className="sheaf-type-selector">
            <label>Distribution Type</label>
            <select value={sheafType} onChange={e => setSheafType(e.target.value)}>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
              <option value="linear">Linear</option>
              <option value="rectangular">Rectangular</option>
            </select>
          </div>
          <div className="sheaf-spread">
            <label>Spread (meters)</label>
            <input type="number" value={sheafSpread} onChange={e => setSheafSpread(Number(e.target.value))} min="10" max="200" />
          </div>
        </div>
        <div className="sheaf-description">
          <small>
            {sheafType === 'open' && 'Open: Mortars spread perpendicular to target bearing, alternating sides'}
            {sheafType === 'closed' && 'Closed: Tight spacing perpendicular to target bearing'}
            {sheafType === 'linear' && 'Linear: Mortars spread along the target bearing line'}
            {sheafType === 'rectangular' && 'Rectangular: 2D grid pattern around target'}
          </small>
        </div>
      </div>

      <div className="input-section">
        <h4>Mortar Positions</h4>
        <div className="mortars-list">
          {mortars.map((mortar) => (
            <div key={mortar.id} className="mortar-item">
              <div className="mortar-header">
                <input value={mortar.label} onChange={e => updateMortar(mortar.id, 'label', e.target.value)} className="mortar-label" />
                {mortars.length > 1 && (
                  <button onClick={() => deleteMortar(mortar.id)} className="delete-mortar">✕</button>
                )}
              </div>
              <div className="mortar-coordinates">
                <div className="coordinate-input">
                  <label>Easting</label>
                  <input value={mortar.easting} onChange={e => updateMortar(mortar.id, 'easting', e.target.value)} placeholder="048" />
                </div>
                <div className="coordinate-input">
                  <label>Northing</label>
                  <input value={mortar.northing} onChange={e => updateMortar(mortar.id, 'northing', e.target.value)} placeholder="120" />
                </div>
                <div className="elevation-input">
                  <label>Elevation (m)</label>
                  <input type="number" value={mortar.elevation} onChange={e => updateMortar(mortar.id, 'elevation', Number(e.target.value))} />
                </div>
              </div>
            </div>
          ))}
        </div>
        <button onClick={addMortar} className="add-mortar-btn">+ Add Mortar</button>
      </div>

      {targetValid && (
        <div className="input-section">
          <h4>Sheaf Distribution Results</h4>
          <div className="sheaf-results">
            {calculateSheafDistribution().map((result) => (
              <div key={result.mortar.id} className="sheaf-result-item">
                <div className="result-header"><strong>{result.mortar.label}</strong></div>
                <div className="result-data">
                  <div>Target: {Math.round(result.targetE)}, {Math.round(result.targetN)}</div>
                  <div>Range: {result.range.toFixed(1)}m</div>
                  <div>Bearing: {result.bearing.toFixed(1)}° / {result.bearingMils} mils</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

