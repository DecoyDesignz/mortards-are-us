import React from 'react';
import { rangeCalculation } from '../Calculations';

export default function FireMissionTab({
  mortarValid, targetValid,
  mortarEastingParsed, mortarNorthingParsed,
  targetEastingParsed, targetNorthingParsed,
  mortarElev, targetElev,
  solutions, chosenIndex, setChosenIndex,
}) {
  if (!mortarValid || !targetValid) {
    return (
      <div className="tab-content">
        <div className="warning">Enter both mortar and target coordinates to compute firing solutions</div>
      </div>
    );
  }

  const { horizontalDistance, bearingDeg } = rangeCalculation(
    mortarEastingParsed, mortarNorthingParsed, mortarElev || 0,
    targetEastingParsed, targetNorthingParsed, targetElev || 0
  );

  return (
    <div className="tab-content">
      <div className="target-info">
        <div>Range: {horizontalDistance.toFixed(1)} m</div>
        <div>Bearing: {bearingDeg.toFixed(2)}° / {(bearingDeg*17.7778).toFixed(2)} mils</div>
      </div>
      <div className="solutions-list">
        <h4>Available Solutions</h4>
        {solutions.length === 0 && (
          <div className="no-solution">No viable solution found (target may be out of range)</div>
        )}
        {solutions.map((s, idx) => (
          <div key={s.label} className={`solution-row ${idx === chosenIndex ? 'chosen' : ''}`} onClick={() => setChosenIndex(idx)}>
            <div className="solution-header">
              <div className="ring-name">{s.label}</div>
              <div className="error-value">{(Math.min(s.direct ? s.direct.obj : Infinity, s.indirect ? s.indirect.obj : Infinity)).toFixed(2)} err</div>
            </div>
            <div className="solution-details">
              {s.direct && (
                <div className={`direct-fire ${s.direct.angleMils < 800 ? 'elevation-exceeded' : ''}`}>
                  Direct: {s.direct.angleDeg.toFixed(2)}° / {s.direct.angleMils} mils — tof {s.direct.tof ? s.direct.tof.toFixed(2) + 's' : 'n/a'}
                  {s.direct.angleMils < 800 && <span className="limit-warning"> (800 mil minimum)</span>}
                </div>
              )}
              {s.indirect && (
                <div className={`indirect-fire ${s.indirect.angleMils < 800 ? 'elevation-exceeded' : ''}`}>
                  Indirect: {s.indirect.angleDeg.toFixed(2)}° / {s.indirect.angleMils} mils — tof {s.indirect.tof ? s.indirect.tof.toFixed(2) + 's' : 'n/a'}
                  {s.indirect.angleMils < 800 && <span className="limit-warning"> (800 mil minimum)</span>}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

