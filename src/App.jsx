import { useState, useEffect, useMemo } from 'react';
import './styles/theme.css';
import './styles/theme.css';
import './styles/Common.css';
import './styles/Sidebar.css';
import './App.css';
import './styles/RightSidebar.css';
import { parseCoordinate, degreesToMils, milsToDegrees } from './Utilities';
import BallisticsSimulationDisplay from './BallisticsSimulationDisplay';
import { simulateTrajectory, objectiveFunction, goldenSectionSearch, rangeCalculation, mortarParameters } from './Calculations';

import Sidebar from './Sidebar';
import FireMissionTab from './tabs/FireMissionTab';
import AdjustFireTab from './tabs/AdjustFireTab';
import SheafTab from './tabs/SheafTab';
import { applyAdjustments as applyAdjustmentsController } from './controllers/AdjustFireController';
import RightSidebar from './RightSidebar';


/* ---------- UI & App ---------- */

export default function App() {
  const [mortarEasting, setMortarEasting] = useState('');
  const [mortarNorthing, setMortarNorthing] = useState('');
  const [targetEasting, setTargetEasting] = useState('');
  const [targetNorthing, setTargetNorthing] = useState('');
  const [originalTargetEasting, setOriginalTargetEasting] = useState(null); // Store original coordinates
  const [originalTargetNorthing, setOriginalTargetNorthing] = useState(null);
  const [adjustBearing, setAdjustBearing] = useState(''); // Optional bearing for adjustments
  const [bearingUnit, setBearingUnit] = useState('degrees'); // 'degrees' or 'mils'


  const [mortarElev, setMortarElev] = useState(0);
  const [targetElev, setTargetElev] = useState(0);

  // Precise target coordinates in meters (float), used for calculations
  const [targetEastingPrecise, setTargetEastingPrecise] = useState(null);
  const [targetNorthingPrecise, setTargetNorthingPrecise] = useState(null);

  const [tab, setTab] = useState('direct'); // 'direct', 'adjust', or 'sheaf'
  const [fireAdjustments, setFireAdjustments] = useState({ add: 0, drop: 0, left: 0, right: 0 });



  const [mortars, setMortars] = useState([
    { id: 1, easting: '', northing: '', elevation: 0, label: 'Mortar 1' }
  ]);
  // Right sidebar state
  const [rightOpen, setRightOpen] = useState(false);
  const [rightTab, setRightTab] = useState('adjust');

  const [sheafType, setSheafType] = useState('open'); // 'open', 'closed', 'linear', 'rectangular'
  const [sheafSpread, setSheafSpread] = useState(50); // meters between mortars

  // Sheaf-specific target and attitude
  const [sheafTargetEasting, setSheafTargetEasting] = useState('');
  const [sheafTargetNorthing, setSheafTargetNorthing] = useState('');
  const [sheafTargetElev, setSheafTargetElev] = useState(''); // optional target elevation for sheaf
  const [sheafAttitude, setSheafAttitude] = useState(''); // bearing/attitude for sheaf orientation
  const [sheafAttitudeUnit, setSheafAttitudeUnit] = useState('degrees'); // 'degrees' | 'mils'
  const [activeMortarIndex, setActiveMortarIndex] = useState(0);

  const [solutions, setSolutions] = useState([]); // per-ring solutions
  const [chosenIndex, setChosenIndex] = useState(0);
  const [bestSolution, setBestSolution] = useState(null);
  const [solutionReason, setSolutionReason] = useState(''); // New state for showing why indirect was chosen

  // Parse coordinate inputs is now imported from Utilities.jsx

  const mortarEastingParsed = parseCoordinate(mortarEasting);
  const mortarNorthingParsed = parseCoordinate(mortarNorthing);
  const targetEastingParsed = parseCoordinate(targetEasting);
  const targetNorthingParsed = parseCoordinate(targetNorthing);

  // Check if coordinates are valid
  const mortarValid = mortarEastingParsed !== null && mortarNorthingParsed !== null;
  const targetValid = targetEastingParsed !== null && targetNorthingParsed !== null;

  // Stable auto-bearing: fixed to original target; does not change with add/drop or deflection
  const autoBearingDeg = useMemo(() => {
    if (!mortarValid || originalTargetEasting === null || originalTargetNorthing === null) return null;
    const { bearingDeg } = rangeCalculation(
      mortarEastingParsed, mortarNorthingParsed, mortarElev || 0,
      originalTargetEasting, originalTargetNorthing, targetElev || 0
    );
    return bearingDeg;
  }, [mortarValid, originalTargetEasting, originalTargetNorthing, mortarEastingParsed, mortarNorthingParsed, mortarElev, targetElev]);

  // Store original target coordinates and precise copy when they first become valid
  useEffect(() => {
    if (targetValid && (originalTargetEasting === null || originalTargetNorthing === null)) {
      setOriginalTargetEasting(targetEastingParsed);
      setOriginalTargetNorthing(targetNorthingParsed);
      setTargetEastingPrecise(targetEastingParsed);
      setTargetNorthingPrecise(targetNorthingParsed);
    }
  }, [targetValid, targetEastingParsed, targetNorthingParsed, originalTargetEasting, originalTargetNorthing]);


  // Reset original and precise coordinates when target coordinates are manually changed
  useEffect(() => {
    if (targetValid) {
      if (originalTargetEasting !== null && originalTargetNorthing !== null) {
        const expectedEasting = originalTargetEasting;
        const expectedNorthing = originalTargetNorthing;
        const tolerance = 10;

        if (Math.abs(targetEastingParsed - expectedEasting) > tolerance ||
            Math.abs(targetNorthingParsed - expectedNorthing) > tolerance) {
          // User edited inputs; update original and precise copies
          setOriginalTargetEasting(targetEastingParsed);
          setOriginalTargetNorthing(targetNorthingParsed);
          setTargetEastingPrecise(targetEastingParsed);
          setTargetNorthingPrecise(targetNorthingParsed);
        }
      }
    } else {
      setOriginalTargetEasting(null);
      setOriginalTargetNorthing(null);
      setTargetEastingPrecise(null);
      setTargetNorthingPrecise(null);
    }
  }, [targetEasting, targetNorthing]);

  // Run solution search whenever inputs change
  useEffect(() => {
    setSolutions([]);
    setChosenIndex(0);
    setBestSolution(null);
    setSolutionReason(''); // Reset reason

    if (!mortarValid || !targetValid) return;

    // Calculate range and bearing using precise coords when available
    const targetE = targetEastingPrecise ?? targetEastingParsed;
    const targetN = targetNorthingPrecise ?? targetNorthingParsed;
    const { horizontalDistance, bearingDeg } = rangeCalculation(
      mortarEastingParsed, mortarNorthingParsed, mortarElev || 0,
      targetE, targetN, targetElev || 0
    );

    const heightLauncher = mortarElev || 0;
    const heightTarget = targetElev || 0;

    const found = [];

    // For each ring, run the golden-section searches for direct & indirect
    Object.entries(mortarParameters).forEach(([label, params]) => {
      // wrap objective to close over current targetRange/heights and params
      const obj = angleDeg => objectiveFunction(angleDeg, horizontalDistance, heightLauncher, heightTarget,
        params.mass, params.drag, params.velocity);

      // direct (0..45)
      let directAngle = null, directObjVal = null, directTof = null;
      try {
        directAngle = goldenSectionSearch(0.0, 45.0, obj, 0.01);
        directObjVal = obj(directAngle);
        const sim = simulateTrajectory(directAngle, horizontalDistance, heightLauncher, heightTarget,
          params.mass, params.drag, params.velocity);
        directTof = sim.timeOfFlight;
      } catch (e) {
        directAngle = null;
      }

      // indirect (45..90)
      let indirectAngle = null, indirectObjVal = null, indirectTof = null;
      try {
        indirectAngle = goldenSectionSearch(45.0, 90.0, obj, 0.01);
        indirectObjVal = obj(indirectAngle);
        const sim2 = simulateTrajectory(indirectAngle, horizontalDistance, heightLauncher, heightTarget,
          params.mass, params.drag, params.velocity);
        indirectTof = sim2.timeOfFlight;
      } catch (e) {
        indirectAngle = null;
      }

      found.push({
        label,
        params,
        horizontalDistance,
        bearingDeg,
        direct: directAngle ? {
          angleDeg: directAngle,
          angleMils: Math.round(degreesToMils(directAngle)),
          tof: directTof,
          obj: directObjVal
        } : null,
        indirect: indirectAngle ? {
          angleDeg: indirectAngle,
          angleMils: Math.round(degreesToMils(indirectAngle)),
          tof: indirectTof,
          obj: indirectObjVal
        } : null
      });
    });

    // sort by best (smallest objective among both solutions)
    found.sort((a, b) => {
      const aBest = Math.min(a.direct ? a.direct.obj : Infinity, a.indirect ? a.indirect.obj : Infinity);
      const bBest = Math.min(b.direct ? b.direct.obj : Infinity, b.indirect ? b.indirect.obj : Infinity);
      return aBest - bBest;
    });

    setSolutions(found);
    setChosenIndex(0);

    // Set best solution for display - MODIFIED TO PREFER INDIRECT FIRE AND ENFORCE 800 MIL MINIMUM LIMIT
    if (found.length > 0) {
      const best = found[0];

      // M252 has 800 mil minimum elevation limit
      const MIN_ELEVATION_MILS = 800;

      // Check if solutions meet minimum elevation requirements
      const directValid = best.direct && best.direct.angleMils >= MIN_ELEVATION_MILS;
      const indirectValid = best.indirect && best.indirect.angleMils >= MIN_ELEVATION_MILS;

      let useIndirect = true;
      let reason = '';

      if (indirectValid && directValid) {
        // Both are valid, prefer indirect with tolerance check
        const indirectObj = best.indirect.obj;
        const directObj = best.direct.obj;

        // Additional check: prefer indirect for longer ranges (>1000m) even with higher tolerance
        const isLongRange = best.horizontalDistance > 1000;
        const tolerance = isLongRange ? 2.0 : 1.5; // More forgiving for long range

        useIndirect = indirectObj <= directObj * tolerance;

        if (useIndirect) {
          if (indirectObj <= directObj) {
            reason = 'Indirect fire chosen - better accuracy than direct';
          } else if (isLongRange) {
            reason = 'Indirect fire chosen - preferred for long range targets (>1000m)';
          } else {
            reason = 'Indirect fire chosen - standard mortar doctrine';
          }
        } else {
          reason = 'Direct fire chosen - indirect fire accuracy too poor';
        }
      } else if (indirectValid && !directValid) {
        // Only indirect is valid (direct below elevation limit)
        useIndirect = true;
        reason = `Indirect fire chosen - direct fire below 800 mil minimum (${best.direct ? best.direct.angleMils : 'N/A'} mils)`;
      } else if (!indirectValid && directValid) {
        // Only direct is valid (indirect below elevation limit)
        useIndirect = false;
        reason = `Direct fire chosen - indirect fire below 800 mil minimum (${best.indirect ? best.indirect.angleMils : 'N/A'} mils)`;
      } else if (indirectValid) {
        // Default to indirect if available
        useIndirect = true;
        reason = 'Indirect fire chosen - only viable solution';
      } else if (directValid) {
        // Fallback to direct if it's the only option
        useIndirect = false;
        reason = 'Direct fire chosen - only viable solution';
      } else {
        // Neither solution is valid - this shouldn't happen but handle gracefully
        useIndirect = best.indirect !== null;
        reason = 'Warning: Selected solution below 800 mil minimum elevation';
      }

      setBestSolution({
        ring: best.label,
        type: useIndirect ? 'Indirect' : 'Direct',
        solution: useIndirect ? best.indirect : best.direct,
        bearingMils: (() => {
          // Always use current geometry (precise target) so bearing matches shown range
          const targetE = targetEastingPrecise ?? targetEastingParsed;
          const targetN = targetNorthingPrecise ?? targetNorthingParsed;
          const { bearingDeg } = rangeCalculation(
            mortarEastingParsed, mortarNorthingParsed, mortarElev || 0,
            targetE, targetN, targetElev || 0
          );
          return Math.round(bearingDeg * 17.7778);
        })(),
        range: best.horizontalDistance,
        elevationExceeded: (useIndirect ? best.indirect?.angleMils : best.direct?.angleMils) < MIN_ELEVATION_MILS
      });

      setSolutionReason(reason);
    }
  }, [mortarEasting, mortarNorthing, targetEasting, targetNorthing, mortarElev, targetElev]);

  // Update Firing Solution card when user changes ring selection
  useEffect(() => {
    if (!solutions || solutions.length === 0) { setBestSolution(null); setSolutionReason(''); return; }
    const idx = Math.min(Math.max(0, chosenIndex || 0), solutions.length - 1);
    const best = solutions[idx];
    if (!best) { setBestSolution(null); setSolutionReason(''); return; }

    const MIN_ELEVATION_MILS = 800;

    const directValid = best.direct && best.direct.angleMils >= MIN_ELEVATION_MILS;
    const indirectValid = best.indirect && best.indirect.angleMils >= MIN_ELEVATION_MILS;

    let useIndirect = true;
    let reason = '';

    if (indirectValid && directValid) {
      const indirectObj = best.indirect.obj;
      const directObj = best.direct.obj;
      const isLongRange = best.horizontalDistance > 1000;
      const tolerance = isLongRange ? 2.0 : 1.5;
      useIndirect = indirectObj <= directObj * tolerance;
      if (useIndirect) {
        if (indirectObj <= directObj) {
          reason = 'Indirect fire chosen - better accuracy than direct';
        } else if (isLongRange) {
          reason = 'Indirect fire chosen - preferred for long range targets (>1000m)';
        } else {
          reason = 'Indirect fire chosen - standard mortar doctrine';
        }
      } else {
        reason = 'Direct fire chosen - indirect fire accuracy too poor';
      }
    } else if (indirectValid && !directValid) {
      useIndirect = true;
      reason = `Indirect fire chosen - direct fire below 800 mil minimum (${best.direct ? best.direct.angleMils : 'N/A'} mils)`;
    } else if (!indirectValid && directValid) {
      useIndirect = false;
      reason = `Direct fire chosen - indirect fire below 800 mil minimum (${best.indirect ? best.indirect.angleMils : 'N/A'} mils)`;
    } else if (indirectValid) {
      useIndirect = true;
      reason = 'Indirect fire chosen - only viable solution';
    } else if (directValid) {
      useIndirect = false;
      reason = 'Direct fire chosen - only viable solution';
    } else {
      useIndirect = best.indirect !== null;
      reason = 'Warning: Selected solution below 800 mil minimum elevation';
    }

    setBestSolution({
      ring: best.label,
      type: useIndirect ? 'Indirect' : 'Direct',
      solution: useIndirect ? best.indirect : best.direct,
      bearingMils: (() => {
        const targetE = targetEastingPrecise ?? targetEastingParsed;
        const targetN = targetNorthingPrecise ?? targetNorthingParsed;
        const { bearingDeg } = rangeCalculation(
          mortarEastingParsed, mortarNorthingParsed, mortarElev || 0,
          targetE, targetN, targetElev || 0
        );
        return Math.round(bearingDeg * 17.7778);
      })(),
      range: best.horizontalDistance,
      elevationExceeded: (useIndirect ? best.indirect?.angleMils : best.direct?.angleMils) < MIN_ELEVATION_MILS
    });

    setSolutionReason(reason);
  }, [solutions, chosenIndex, adjustBearing, bearingUnit, mortarEastingParsed, mortarNorthingParsed, targetEastingParsed, targetNorthingParsed, targetEastingPrecise, targetNorthingPrecise, mortarElev, targetElev]);

  // Functions for managing mortars in sheaf tab
  const addMortar = () => {
    const nextIndex = mortars.length; // new mortar will be at the end
    const newId = (mortars.length ? Math.max(...mortars.map(m => m.id)) : 0) + 1;
    setMortars([...mortars, {
      id: newId,
      easting: '',
      northing: '',
      elevation: 0,
      label: `Mortar ${newId}`
    }]);
    setActiveMortarIndex(nextIndex);
  };

  const deleteMortar = (id) => {
    if (mortars.length > 1) {
      const delIndex = mortars.findIndex(m => m.id === id);
      const newMortars = mortars.filter(m => m.id !== id);
      setMortars(newMortars);
      // Adjust active index to remain valid and natural
      let newActive = activeMortarIndex;
      if (delIndex !== -1) {
        if (activeMortarIndex > delIndex) newActive = activeMortarIndex - 1;
        else if (activeMortarIndex === delIndex) newActive = Math.max(0, activeMortarIndex - 1);
      }
      if (newActive >= newMortars.length) newActive = Math.max(0, newMortars.length - 1);
      setActiveMortarIndex(newActive);
    }
  };

  const updateMortar = (id, field, value) => {
    setMortars(mortars.map(m =>
      m.id === id ? { ...m, [field]: value } : m
    ));
  };

  // Calculate sheaf distribution
  const calculateSheafDistribution = () => {
    if (mortars.length < 1) return [];

    // Choose base target for sheaf: sheaf-specific if valid, otherwise main target (precise if available)
    const sheafTargetEParsed = parseCoordinate(sheafTargetEasting);
    const sheafTargetNParsed = parseCoordinate(sheafTargetNorthing);
    const sheafElevParsed = sheafTargetElev === '' ? null : Number(sheafTargetElev);

    // All-or-nothing: if any of E/N/Elev is missing, fallback entirely to left sidebar target
    const hasFullSheafTarget = sheafTargetEParsed != null && sheafTargetNParsed != null && sheafElevParsed != null && !isNaN(sheafElevParsed);

    const baseTargetE = hasFullSheafTarget ? sheafTargetEParsed : (targetEastingPrecise ?? targetEastingParsed);
    const baseTargetN = hasFullSheafTarget ? sheafTargetNParsed : (targetNorthingPrecise ?? targetNorthingParsed);
    const baseTargetElev = hasFullSheafTarget ? sheafElevParsed : (targetElev || 0);

    if (baseTargetE == null || baseTargetN == null) return [];

    // Determine sheaf orientation bearing (degrees)
    let sheafBearingDeg = null;
    const attNum = Number(sheafAttitude);
    if (!isNaN(attNum) && sheafAttitude !== '') {
      sheafBearingDeg = sheafAttitudeUnit === 'mils' ? milsToDegrees(attNum) : attNum;
    } else if (mortarValid) {
      const { bearingDeg } = rangeCalculation(
        mortarEastingParsed, mortarNorthingParsed, mortarElev || 0,
        baseTargetE, baseTargetN, baseTargetElev
      );
      sheafBearingDeg = bearingDeg;
    } else {
      sheafBearingDeg = 0; // default orientation if none provided
    }

    // Normalize to [0, 360)
    sheafBearingDeg = ((sheafBearingDeg % 360) + 360) % 360;

    const bearingRad = sheafBearingDeg * Math.PI / 180;
    const perpBearingRad = bearingRad + Math.PI / 2;

    return mortars.map((mortar, index) => {
      const mE = parseCoordinate(mortar.easting);
      const mN = parseCoordinate(mortar.northing);

      if (mE == null || mN == null) return null;

      let targetAdjustmentE = 0;
      let targetAdjustmentN = 0;

      switch (sheafType) {
        case 'open': {
          // Spread perpendicular to bearing, alternating sides
          const openOffset = Math.floor(index / 2) * sheafSpread * (index % 2 === 0 ? 1 : -1);
          targetAdjustmentE = openOffset * Math.sin(perpBearingRad);
          targetAdjustmentN = openOffset * Math.cos(perpBearingRad);
          break;
        }
        case 'closed': {
          // Tight spacing perpendicular to bearing
          const closedOffset = (index - (mortars.length - 1) / 2) * (sheafSpread / 2);
          targetAdjustmentE = closedOffset * Math.sin(perpBearingRad);
          targetAdjustmentN = closedOffset * Math.cos(perpBearingRad);
          break;
        }
        case 'linear': {
          // Spread along the bearing line
          const linearOffset = (index - (mortars.length - 1) / 2) * sheafSpread;
          targetAdjustmentE = linearOffset * Math.sin(bearingRad);
          targetAdjustmentN = linearOffset * Math.cos(bearingRad);
          break;
        }
        case 'rectangular': {
          // 2D grid pattern
          const cols = Math.ceil(Math.sqrt(mortars.length));
          const row = Math.floor(index / cols);
          const col = index % cols;
          const rectOffsetE = (col - (cols - 1) / 2) * sheafSpread * Math.sin(perpBearingRad);
          const rectOffsetN = (col - (cols - 1) / 2) * sheafSpread * Math.cos(perpBearingRad);
          const rectOffsetE2 = (row - (Math.ceil(mortars.length / cols) - 1) / 2) * sheafSpread * Math.sin(bearingRad);
          const rectOffsetN2 = (row - (Math.ceil(mortars.length / cols) - 1) / 2) * sheafSpread * Math.cos(bearingRad);
          targetAdjustmentE = rectOffsetE + rectOffsetE2;
          targetAdjustmentN = rectOffsetN + rectOffsetN2;
          break;
        }
        default:
          break;
      }

      const adjustedTargetE = baseTargetE + targetAdjustmentE;
      const adjustedTargetN = baseTargetN + targetAdjustmentN;

      const { horizontalDistance, bearingDeg: mortarBearing } = rangeCalculation(
        mE, mN, mortar.elevation || 0,
        adjustedTargetE, adjustedTargetN, baseTargetElev
      );

      return {
        mortar,
        targetE: adjustedTargetE,
        targetN: adjustedTargetN,
        range: horizontalDistance,
        bearing: mortarBearing,
        bearingMils: Math.round(degreesToMils(mortarBearing))
      };
    }).filter(Boolean);
  };

  // Fire adjustment button helper
  // Use controller to apply adjustments and update target inputs
  function applyAdjustmentsAndRecalcController() {
    const { targetEastingOut, targetNorthingOut, targetEastingPrecise: tE, targetNorthingPrecise: tN } = applyAdjustmentsController({
      mortarValid,
      targetValid,
      originalTargetEasting,
      originalTargetNorthing,
      fireAdjustments,
      adjustBearing,
      bearingUnit,
      mortarEastingParsed,
      mortarNorthingParsed,
      mortarElev,
      targetElev,
      targetEastingStr: targetEasting,
      targetNorthingStr: targetNorthing,
    });
    setTargetEasting(targetEastingOut);
    setTargetNorthing(targetNorthingOut);
    if (typeof tE === 'number' && typeof tN === 'number') {
      setTargetEastingPrecise(tE);
      setTargetNorthingPrecise(tN);
    }
  }

  return (
    <div className="app-root">
      <Sidebar
        mortarEasting={mortarEasting} setMortarEasting={setMortarEasting}
        mortarNorthing={mortarNorthing} setMortarNorthing={setMortarNorthing}
        targetEasting={targetEasting} setTargetEasting={setTargetEasting}
        targetNorthing={targetNorthing} setTargetNorthing={setTargetNorthing}
        mortarElev={mortarElev} setMortarElev={setMortarElev}
        targetElev={targetElev} setTargetElev={setTargetElev}
        tab={tab} setTab={setTab}
        bestSolution={bestSolution} solutionReason={solutionReason}
        mortarValid={mortarValid} targetValid={targetValid}
        mortarEastingParsed={mortarEastingParsed} mortarNorthingParsed={mortarNorthingParsed}
        targetEastingParsed={targetEastingParsed} targetNorthingParsed={targetNorthingParsed}
        solutions={solutions} chosenIndex={chosenIndex} setChosenIndex={setChosenIndex}
        adjustBearing={adjustBearing} setAdjustBearing={setAdjustBearing}
        bearingUnit={bearingUnit} setBearingUnit={setBearingUnit}
        fireAdjustments={fireAdjustments} setFireAdjustments={setFireAdjustments}
        mortars={mortars} addMortar={addMortar} deleteMortar={deleteMortar} updateMortar={updateMortar}
        sheafType={sheafType} setSheafType={setSheafType}
        sheafSpread={sheafSpread} setSheafSpread={setSheafSpread}
        calculateSheafDistribution={calculateSheafDistribution}
        setOpenTools={setRightOpen}
        setToolsTab={setRightTab}
        renderFireMissionTab={() => (
          <FireMissionTab
            mortarValid={mortarValid} targetValid={targetValid}
            mortarEastingParsed={mortarEastingParsed} mortarNorthingParsed={mortarNorthingParsed}
            targetEastingParsed={targetEastingParsed} targetNorthingParsed={targetNorthingParsed}
            mortarElev={mortarElev} targetElev={targetElev}
            solutions={solutions} chosenIndex={chosenIndex} setChosenIndex={setChosenIndex}
          />
        )}
        renderAdjustFireTab={() => (
          <AdjustFireTab
            mortarValid={mortarValid} targetValid={targetValid}
            mortarEastingParsed={mortarEastingParsed} mortarNorthingParsed={mortarNorthingParsed}
            targetEastingParsed={targetEastingParsed} targetNorthingParsed={targetNorthingParsed}
            mortarElev={mortarElev} targetElev={targetElev}
            fireAdjustments={fireAdjustments} setFireAdjustments={setFireAdjustments}
            adjustBearing={adjustBearing} setAdjustBearing={setAdjustBearing}
            bearingUnit={bearingUnit} setBearingUnit={setBearingUnit}
            autoBearingDeg={autoBearingDeg}
            onApply={applyAdjustmentsAndRecalcController}
          />
        )}
        renderSheafTab={() => (
          <SheafTab
            mortars={mortars}
            addMortar={addMortar} deleteMortar={deleteMortar} updateMortar={updateMortar}
            targetValid={targetValid}
            sheafType={sheafType} setSheafType={setSheafType}
            sheafSpread={sheafSpread} setSheafSpread={setSheafSpread}
            sheafTargetEasting={sheafTargetEasting} setSheafTargetEasting={setSheafTargetEasting}
            sheafTargetNorthing={sheafTargetNorthing} setSheafTargetNorthing={setSheafTargetNorthing}
            sheafTargetElev={sheafTargetElev} setSheafTargetElev={setSheafTargetElev}
            sheafAttitude={sheafAttitude} setSheafAttitude={setSheafAttitude}
            sheafAttitudeUnit={sheafAttitudeUnit} setSheafAttitudeUnit={setSheafAttitudeUnit}
            activeMortarIndex={activeMortarIndex} setActiveMortarIndex={setActiveMortarIndex}
            calculateSheafDistribution={calculateSheafDistribution}
          />
        )}
        onResetAll={() => {
          setMortarEasting('');
          setMortarNorthing('');
          setTargetEasting('');
          setTargetNorthing('');
          setAdjustBearing('');
          setFireAdjustments({ add: 0, drop: 0, left: 0, right: 0 });
          setSolutions([]);
          setChosenIndex(0);
          setBestSolution(null);
          setSolutionReason('');
        }}
      />

      <BallisticsSimulationDisplay
        mortarValid={mortarValid}
        targetValid={targetValid}
        mortarEastingParsed={mortarEastingParsed}
        mortarNorthingParsed={mortarNorthingParsed}
        targetEastingParsed={targetEastingParsed}
        targetNorthingParsed={targetNorthingParsed}
        targetEastingPrecise={targetEastingPrecise}
        targetNorthingPrecise={targetNorthingPrecise}
        mortarElev={mortarElev}
        targetElev={targetElev}
        solutions={solutions}
        chosenIndex={chosenIndex}
        bestSolution={bestSolution}
        solutionReason={solutionReason}
      />

      {/* Right launcher button - hidden when sidebar open */}
      <div className={rightOpen ? 'right-launcher hidden' : 'right-launcher'}>
        <button onClick={() => { setRightTab('adjust'); setRightOpen(true); }}>🔧 Tools</button>
      </div>

      <RightSidebar
        open={rightOpen}
        activeTab={rightTab}
        setActiveTab={setRightTab}
        onClose={() => setRightOpen(false)}
        renderAdjustFireTab={() => (
          <AdjustFireTab
            mortarValid={mortarValid} targetValid={targetValid}
            mortarEastingParsed={mortarEastingParsed} mortarNorthingParsed={mortarNorthingParsed}
            targetEastingParsed={targetEastingParsed} targetNorthingParsed={targetNorthingParsed}
            mortarElev={mortarElev} targetElev={targetElev}
            fireAdjustments={fireAdjustments} setFireAdjustments={setFireAdjustments}
            adjustBearing={adjustBearing} setAdjustBearing={setAdjustBearing}
            bearingUnit={bearingUnit} setBearingUnit={setBearingUnit}
            autoBearingDeg={autoBearingDeg}
            onApply={applyAdjustmentsAndRecalcController}
          />
        )}
        renderSheafTab={() => (
          <SheafTab
            mortars={mortars}
            addMortar={addMortar} deleteMortar={deleteMortar} updateMortar={updateMortar}
            targetValid={targetValid}
            sheafType={sheafType} setSheafType={setSheafType}
            sheafSpread={sheafSpread} setSheafSpread={setSheafSpread}
            sheafTargetEasting={sheafTargetEasting} setSheafTargetEasting={setSheafTargetEasting}
            sheafTargetNorthing={sheafTargetNorthing} setSheafTargetNorthing={setSheafTargetNorthing}
            sheafTargetElev={sheafTargetElev} setSheafTargetElev={setSheafTargetElev}
            sheafAttitude={sheafAttitude} setSheafAttitude={setSheafAttitude}
            sheafAttitudeUnit={sheafAttitudeUnit} setSheafAttitudeUnit={setSheafAttitudeUnit}
            activeMortarIndex={activeMortarIndex} setActiveMortarIndex={setActiveMortarIndex}
            calculateSheafDistribution={calculateSheafDistribution}
          />
        )}
      />
    </div>
  );
}