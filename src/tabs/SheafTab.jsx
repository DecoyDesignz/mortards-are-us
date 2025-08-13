import React from 'react';
import { degreesToMils, milsToDegrees } from '../Utilities';
import '../styles/sheaf.css';

export default function SheafTab({
  mortars, addMortar, deleteMortar, updateMortar,
  targetValid, sheafType, setSheafType,
  sheafSpread, setSheafSpread,
  sheafTargetEasting, setSheafTargetEasting,
  sheafTargetNorthing, setSheafTargetNorthing,
  sheafTargetElev, setSheafTargetElev,
  sheafAttitude, setSheafAttitude,
  sheafAttitudeUnit, setSheafAttitudeUnit,
  activeMortarIndex, setActiveMortarIndex,

  calculateSheafDistribution,
}) {
  const [showResults, setShowResults] = React.useState(true);
  const onAttitudeChange = (val) => {
    if (val === '') { setSheafAttitude(''); return; }
    let num = Number(val);
    if (isNaN(num)) { setSheafAttitude(val); return; }
    num = sheafAttitudeUnit === 'degrees'
      ? ((num % 360) + 360) % 360
      : ((num % 6400) + 6400) % 6400;
    setSheafAttitude(String(num));
  };

  const results = calculateSheafDistribution();

  const activeMortar = mortars[activeMortarIndex] || mortars[0];
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

        <div className="sheaf-target">
          <div className="coordinate-input">
            <label>Sheaf Target Easting</label>
            <input value={sheafTargetEasting} onChange={e => setSheafTargetEasting(e.target.value)} placeholder="(optional)" />
          </div>
          <div className="coordinate-input">
            <label>Sheaf Target Northing</label>
            <input value={sheafTargetNorthing} onChange={e => setSheafTargetNorthing(e.target.value)} placeholder="(optional)" />

        <div className="sheaf-elevation">
          <div className="elevation-input">
            <label>Sheaf Target Elevation (m)</label>
            <input type="number" value={sheafTargetElev} onChange={e => setSheafTargetElev(e.target.value)} placeholder="(optional)" />
          </div>
        </div>

          </div>
        </div>

        <h4 className="sheaf-attitude-header">Attitude</h4>

        <div className="bearing-input-container">
          <div className="bearing-input-group">
            <input className="bearing-input" value={sheafAttitude} onChange={e => onAttitudeChange(e.target.value)} placeholder="e.g. 90 or 1600" />
            <select className="bearing-unit-select" value={sheafAttitudeUnit} onChange={e => setSheafAttitudeUnit(e.target.value)}>
              <option value="degrees">DEG</option>
              <option value="mils">MILS</option>
            </select>
          </div>
        </div>
      </div>

      <div className="input-section">
        <h4>Mortar Positions</h4>
        <div className="sheaf-mortar-selector">
          <label>Select Mortar</label>
          <select className="solution-select" value={activeMortarIndex} onChange={e => setActiveMortarIndex(Number(e.target.value))}>
            {mortars.map((m, idx) => (
              <option key={m.id} value={idx}>{m.label || `Mortar ${idx + 1}`}</option>
            ))}
          </select>
        </div>

        {(() => {
          const mortar = mortars[activeMortarIndex] || mortars[0];
          if (!mortar) return null;
          return (
            <div className="mortar-item">
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
          );
        })()}

        <button onClick={addMortar} className="add-mortar-btn">+ Add Mortar</button>
      </div>

      {targetValid && showResults && (() => {
        const r = results[activeMortarIndex];
        if (!r) return null;
        return (
          <div className="input-section">
            <h4>Sheaf Distribution Results</h4>
            <div className="sheaf-results">
              <div className="sheaf-result-item">
                <div className="result-header"><strong>{r.mortar.label}</strong></div>
                <div className="result-data">
                  <div>Target: {Math.round(r.targetE)}, {Math.round(r.targetN)}</div>
                  <div>Range: {r.range.toFixed(1)}m</div>
                  <div>Bearing: {r.bearing.toFixed(1)}° / {r.bearingMils} mils</div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}



