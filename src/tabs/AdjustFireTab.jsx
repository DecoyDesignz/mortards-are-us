import React from 'react';
import { rangeCalculation } from '../Calculations';
import { adjustFireState } from '../controllers/AdjustFireController';

export default function AdjustFireTab({
  mortarValid, targetValid,
  mortarEastingParsed, mortarNorthingParsed,
  targetEastingParsed, targetNorthingParsed,
  mortarElev, targetElev,
  fireAdjustments, setFireAdjustments,
  adjustBearing, setAdjustBearing, bearingUnit, setBearingUnit,
  onApply,
}) {
  const adjustFire = (type, amount) => {
    setFireAdjustments(prev => adjustFireState(prev, type, amount));
  };

  return (
    <div className="tab-content">
      <div className="input-section">
        <h4>Adjustment Bearing</h4>
        <div className="bearing-input-container">
          <div className="bearing-input-group">
            <input value={adjustBearing} onChange={e => setAdjustBearing(e.target.value)} placeholder="Auto-calculated" className="bearing-input" />
            <select value={bearingUnit} onChange={e => setBearingUnit(e.target.value)} className="bearing-unit-select">
              <option value="degrees">DEG</option>
              <option value="mils">MILS</option>
            </select>
          </div>
          {mortarValid && targetValid && (
            <div className="bearing-info">
              <div className="info-text">
                {(() => {
                  const { bearingDeg } = rangeCalculation(
                    mortarEastingParsed, mortarNorthingParsed, mortarElev || 0,
                    targetEastingParsed, targetNorthingParsed, targetElev || 0
                  );
                  return `Auto: ${bearingDeg.toFixed(1)}° / ${(bearingDeg * 17.7778).toFixed(1)} mils`;
                })()}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="input-section">
        <h4>Fire Adjustments</h4>
        <div className="unified-fire-adjustment">
          <div className="adjustment-category unified-adjustments">
            <div className="category-header">
              <div className="category-title">FIRE CONTROL</div>
              <div className="net-adjustments">
                <div className="net-range">Range: {(fireAdjustments.add || 0) - (fireAdjustments.drop || 0)}m</div>
                <div className="net-deflection">Deflection: {(fireAdjustments.right || 0) - (fireAdjustments.left || 0)}m</div>
              </div>
            </div>

            <div className="unified-adjustment-layout">
              <div className="range-values">
                <div className="adjustment-value-display range-add">
                  <div className="adjustment-label">ADD</div>
                  <div className="adjustment-value">{fireAdjustments.add}m</div>
                </div>
                <div className="adjustment-value-display range-drop">
                  <div className="adjustment-label">DROP</div>
                  <div className="adjustment-value">{fireAdjustments.drop}m</div>
                </div>
              </div>

              <div className="deflection-values">
                <div className="adjustment-value-display deflection-left">
                  <div className="adjustment-label">LEFT</div>
                  <div className="adjustment-value">{fireAdjustments.left}m</div>
                </div>
                <div className="adjustment-value-display deflection-right">
                  <div className="adjustment-label">RIGHT</div>
                  <div className="adjustment-value">{fireAdjustments.right}m</div>
                </div>
              </div>

              <div className="unified-dpad-container">
                <button className="dpad-btn dpad-up" onClick={() => adjustFire('add', 50)}>ADD<br/>+50</button>
                <button className="dpad-btn dpad-left" onClick={() => adjustFire('left', 50)}>LEFT<br/>+50</button>
                <button className="dpad-btn dpad-center" onClick={() => setFireAdjustments({ add: 0, drop: 0, left: 0, right: 0 })}>RESET</button>
                <button className="dpad-btn dpad-right" onClick={() => adjustFire('right', 50)}>RIGHT<br/>+50</button>
                <button className="dpad-btn dpad-down" onClick={() => adjustFire('drop', 50)}>DROP<br/>+50</button>

                <button className="dpad-mini mini-up" onClick={() => adjustFire('add', 10)}>+10</button>
                <button className="dpad-mini mini-left" onClick={() => adjustFire('left', 10)}>+10</button>
                <button className="dpad-mini mini-right" onClick={() => adjustFire('right', 10)}>+10</button>
                <button className="dpad-mini mini-down" onClick={() => adjustFire('drop', 10)}>+10</button>
              </div>
            </div>

            <div className="adjustment-actions">
              <button className="apply-adjustments-btn" onClick={onApply} disabled={!mortarValid || !targetValid}>APPLY ADJUSTMENTS</button>
              <button className="clear-all-btn" onClick={() => setFireAdjustments({ add: 0, drop: 0, left: 0, right: 0 })}>RESET ALL</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

