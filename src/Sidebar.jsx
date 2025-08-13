import React from 'react';
import { parseCoordinate, degreesToMils } from './Utilities';
import { rangeCalculation } from './Calculations';

export default function Sidebar(props) {
  // This component renders the entire left panel (inputs, tabs, results).
  // It expects all the necessary state and callbacks to be passed via props
  // to avoid circular imports and keep App.jsx thin.
  const {
    mortarEasting, setMortarEasting,
    mortarNorthing, setMortarNorthing,
    targetEasting, setTargetEasting,
    targetNorthing, setTargetNorthing,
    mortarElev, setMortarElev,
    targetElev, setTargetElev,
    tab, setTab,
    bestSolution, solutionReason,
    mortarValid, targetValid,
    mortarEastingParsed, mortarNorthingParsed,
    targetEastingParsed, targetNorthingParsed,
    solutions, chosenIndex, setChosenIndex,
    // Adjust fire specific
    adjustBearing, setAdjustBearing,
    bearingUnit, setBearingUnit,

    fireAdjustments, setFireAdjustments,
    applyAdjustmentsAndRecalc,
    // Sheaf
    mortars, addMortar, deleteMortar, updateMortar,
    sheafType, setSheafType,
    sheafSpread, setSheafSpread,
    calculateSheafDistribution,
    rangeCalculationFn
  } = props;

  const rc = rangeCalculationFn || rangeCalculation;

  return (
    <div className="sidebar">
      <div className="header">
        <h1>M252 Mortar Calculator</h1>
        <p>Artillery Fire Mission Computer</p>
      </div>



      {/* Mortar position */}
      <div className="input-section">
        <h3>Mortar Position</h3>
        <div className="coordinate-row">
          <div className="coordinate-input">
            <label>Easting</label>
            <input value={mortarEasting} onChange={e => setMortarEasting(e.target.value)} placeholder="048 (= 4800m)" />
          </div>
          <div className="coordinate-input">
            <label>Northing</label>
            <input value={mortarNorthing} onChange={e => setMortarNorthing(e.target.value)} placeholder="120 (= 12000m)" />
          </div>
        </div>
        <div className="elevation-input">
          <label>Elevation (m)</label>
          <input type="number" value={mortarElev} onChange={e => setMortarElev(Number(e.target.value))} />
        </div>
      </div>

      {/* Target position */}
      <div className="input-section">
        <h3>Target Position</h3>
        <div className="coordinate-row">
          <div className="coordinate-input">
            <label>Easting</label>
            <input value={targetEasting} onChange={e => setTargetEasting(e.target.value)} placeholder="050 (= 5000m)" />
          </div>
          <div className="coordinate-input">
            <label>Northing</label>
            <input value={targetNorthing} onChange={e => setTargetNorthing(e.target.value)} placeholder="110 (= 11000m)" />
          </div>
        </div>
        <div className="elevation-input">
          <label>Elevation (m)</label>
          <input type="number" value={targetElev} onChange={e => setTargetElev(Number(e.target.value))} />
        </div>
      </div>

      {/* Tab content */}
      {props.renderFireMissionTab?.()}

      <div className="actions">
        <button className="reset-btn" onClick={props.onResetAll}>Reset All</button>
      </div>
    </div>
  );
}

