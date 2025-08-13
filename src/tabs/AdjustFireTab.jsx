import React from 'react';
import { rangeCalculation } from '../Calculations';
import { adjustFireState } from '../controllers/AdjustFireController';

export default function AdjustFireTab({
  mortarValid, targetValid,
  mortarEastingParsed, mortarNorthingParsed,
  targetEastingParsed, targetNorthingParsed,
  targetEastingPrecise, targetNorthingPrecise,
  mortarElev, targetElev,
  fireAdjustments, setFireAdjustments,
  adjustBearing, setAdjustBearing, bearingUnit, setBearingUnit,
  autoBearingDeg,
  onApply,
}) {
  const [step, setStep] = React.useState(10);
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
                  // Keep Adjust Fire auto bearing consistent with the app-level stabilized value
                  const bearingDeg = (typeof autoBearingDeg === 'number') ? autoBearingDeg : (() => {
                    const targetE = targetEastingPrecise ?? targetEastingParsed;
                    const targetN = targetNorthingPrecise ?? targetNorthingParsed;
                    const { bearingDeg } = rangeCalculation(
                      mortarEastingParsed, mortarNorthingParsed, mortarElev || 0,
                      targetE, targetN, targetElev || 0
                    );
                    return bearingDeg;
                  })();
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
              <div className="step-input-row">
                <label className="step-label">Step</label>
                <input
                  type="number"
                  step={5}
                  value={step}
                  onChange={e => setStep(Math.max(1, Number(e.target.value)||0))}
                  className="bearing-input step-input"
                  placeholder="10"
                />
                <span className="step-unit">m</span>
              </div>
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
                <button className="dpad-btn dpad-up" onClick={() => adjustFire('add', step)}>+{step}</button>
                <button className="dpad-btn dpad-left" onClick={() => adjustFire('left', step)}>+{step}</button>
                <button className="dpad-btn dpad-center" onClick={() => setFireAdjustments({ add: 0, drop: 0, left: 0, right: 0 })}>RESET</button>
                <button className="dpad-btn dpad-right" onClick={() => adjustFire('right', step)}>+{step}</button>
                <button className="dpad-btn dpad-down" onClick={() => adjustFire('drop', step)}>+{step}</button>
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