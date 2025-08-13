import React from 'react';


export default function FireMissionTab({
  mortarValid, targetValid,
  solutions, chosenIndex, setChosenIndex,
}) {
  if (!mortarValid || !targetValid) {
    return (
      <div className="tab-content">
        <div className="warning">Enter both mortar and target coordinates to compute firing solutions</div>
      </div>
    );
  }

  return (
    <div className="tab-content">
      <div className="solutions-list">
        <h4>Available Solutions</h4>
        {solutions.length === 0 ? (
          <div className="no-solution">No viable solution found (target may be out of range)</div>
        ) : (
          <>
            <select
              className="solution-select"
              value={chosenIndex}
              onChange={e => setChosenIndex(Number(e.target.value))}
            >
              {solutions.map((s, idx) => (
                <option key={s.label} value={idx}>
                  {s.label} — err {(Math.min(s.direct ? s.direct.obj : Infinity, s.indirect ? s.indirect.obj : Infinity)).toFixed(2)}
                </option>
              ))}
            </select>

            {/* Details for selected solution only */}
            {solutions[chosenIndex] && (
              <div className="solution-row chosen">
                <div className="solution-header">
                  <div className="ring-name">{solutions[chosenIndex].label}</div>
                  <div className="error-value">{(Math.min(solutions[chosenIndex].direct ? solutions[chosenIndex].direct.obj : Infinity, solutions[chosenIndex].indirect ? solutions[chosenIndex].indirect.obj : Infinity)).toFixed(2)} err</div>
                </div>
                <div className="solution-details">
                  {solutions[chosenIndex].direct && (
                    <div className={`direct-fire ${solutions[chosenIndex].direct.angleMils < 800 ? 'elevation-exceeded' : ''}`}>
                      Direct: {solutions[chosenIndex].direct.angleDeg.toFixed(2)}° / {solutions[chosenIndex].direct.angleMils} mils — tof {solutions[chosenIndex].direct.tof ? solutions[chosenIndex].direct.tof.toFixed(2) + 's' : 'n/a'}
                      {solutions[chosenIndex].direct.angleMils < 800 && <span className="limit-warning"> (800 mil minimum)</span>}
                    </div>
                  )}
                  {solutions[chosenIndex].indirect && (
                    <div className={`indirect-fire ${solutions[chosenIndex].indirect.angleMils < 800 ? 'elevation-exceeded' : ''}`}>
                      Indirect: {solutions[chosenIndex].indirect.angleDeg.toFixed(2)}° / {solutions[chosenIndex].indirect.angleMils} mils — tof {solutions[chosenIndex].indirect.tof ? solutions[chosenIndex].indirect.tof.toFixed(2) + 's' : 'n/a'}
                      {solutions[chosenIndex].indirect.angleMils < 800 && <span className="limit-warning"> (800 mil minimum)</span>}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

