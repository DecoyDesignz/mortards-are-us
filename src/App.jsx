import React, { useState, useEffect, useRef } from 'react';
import './App.css';

/* ---------- integrated artillery calculations ---------- */

const g_const = 9.81; // gravity for these functions (m/s^2)

function degreesToMils(degrees) {
  return degrees * 17.7777777778;
}

// Enhanced simulateTrajectory function
function simulateTrajectory(angleDeg, targetRange, heightLauncher, heightTarget,
    projectileMass = 23, projectileAirDrag = 0.0043, projectileVelocity = 212.5) {
  const angleRad = angleDeg * (Math.PI / 180);
  let vx0 = projectileVelocity * Math.cos(angleRad);
  let vy0 = projectileVelocity * Math.sin(angleRad);
  let x = 0;
  let y = heightLauncher;
  const dt = 0.0333; // Match 30 FPS (33.3ms)
  const tMax = 100;

  let timeOfFlight = 0;

  for (let step = 0; step < tMax / dt; step++) {
    timeOfFlight += dt;

    const v = Math.sqrt(vx0 * vx0 + vy0 * vy0);
    const dragForce = (v !== 0) ? projectileAirDrag * v * v : 0;
    const ax = (v !== 0) ? -dragForce * vx0 / (projectileMass * v) : 0;
    const ay = (v !== 0) ? -g_const - (dragForce * vy0 / (projectileMass * v)) : -g_const;

    vx0 += ax * dt;
    vy0 += ay * dt;
    x += vx0 * dt;
    y += vy0 * dt;

    if (x >= targetRange && y <= heightTarget) {
      break;
    }
  }

  return { x, y, timeOfFlight };
}

function objectiveFunction(angleDeg, targetRange, heightLauncher, heightTarget,
  projectileMass, projectileAirDrag, projectileVelocity) {
  const { x: distanceTraveled, y: finalHeight } = simulateTrajectory(
    angleDeg, targetRange, heightLauncher, heightTarget,
    projectileMass, projectileAirDrag, projectileVelocity);

  return Math.abs(distanceTraveled - targetRange) + Math.abs(finalHeight - heightTarget);
}

function goldenSectionSearch(lowerBound, upperBound, objectiveFunc, tol = 0.001) {
  const phi = (1 + Math.sqrt(5)) / 2;
  let c = upperBound - (upperBound - lowerBound) / phi;
  let d = lowerBound + (upperBound - lowerBound) / phi;

  while (Math.abs(c - d) > tol) {
    if (objectiveFunc(c) < objectiveFunc(d)) {
      upperBound = d;
    } else {
      lowerBound = c;
    }
    c = upperBound - (upperBound - lowerBound) / phi;
    d = lowerBound + (upperBound - lowerBound) / phi;
  }

  return (upperBound + lowerBound) / 2;
}

// Function to calculate the range and bearing from UTM coordinates
function rangeCalculation(eastingLauncher, northingLauncher, heightLauncher,
                          eastingTarget, northingTarget, heightTarget) {
  const deltaEasting = eastingTarget - eastingLauncher;
  const deltaNorthing = northingTarget - northingLauncher;
  const horizontalDistance = Math.sqrt(deltaEasting * deltaEasting + deltaNorthing * deltaNorthing);

  const bearingRad = Math.atan2(deltaEasting, deltaNorthing);
  let bearingDeg = bearingRad * (180 / Math.PI);
  if (bearingDeg < 0) {
    bearingDeg += 360;
  }

  return { horizontalDistance, bearingDeg, heightLauncher, heightTarget };
}

/* ---------- mortar parameter set ---------- */
const mortarParameters = {
  'M252 Base': { mass: 4.06, drag: 0.0004620, velocity: 66 },
  'M252 1 Ring': { mass: 4.06, drag: 0.0004620, velocity: 101.046 },
  'M252 2 Rings': { mass: 4.06, drag: 0.0004620, velocity: 137.61 },
  'M252 3 Rings': { mass: 4.06, drag: 0.0004620, velocity: 167.706 },
  'M252 4 Rings': { mass: 4.06, drag: 0.0004620, velocity: 196.482 }
};

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

  const [tab, setTab] = useState('direct'); // 'direct', 'adjust', or 'sheaf'
  const [fireAdjustments, setFireAdjustments] = useState({ add: 0, drop: 0, left: 0, right: 0 });

  const [mortars, setMortars] = useState([
    { id: 1, easting: '', northing: '', elevation: 0, label: 'Mortar 1' }
  ]);
  const [sheafType, setSheafType] = useState('open'); // 'open', 'closed', 'linear', 'rectangular'
  const [sheafSpread, setSheafSpread] = useState(50); // meters between mortars

  const [solutions, setSolutions] = useState([]); // per-ring solutions
  const [chosenIndex, setChosenIndex] = useState(0);
  const [bestSolution, setBestSolution] = useState(null);
  const [solutionReason, setSolutionReason] = useState(''); // New state for showing why indirect was chosen

  const canvasRef = useRef(null);

  // Parse coordinate inputs to full UTM values
  function parseCoordinate(input) {
    if (!input || isNaN(Number(input))) return null;
    const num = Number(input);
    
    // Handle different UTM coordinate formats:
    // 3-digit: 048 = 48,800m (grid square with 100m precision)
    // 4-digit: 0482 = 48,200m (grid square with 10m precision) 
    // 5-digit: 04825 = 48,250m (grid square with 1m precision)
    // 6+ digits: Full UTM coordinate (use as-is)
    
    const inputStr = input.toString();
    
    if (inputStr.length <= 5) {
      // Short format - treat as grid coordinates
      if (inputStr.length === 3) {
        return num * 100; // 048 -> 4800m
      } else if (inputStr.length === 4) {
        return Math.floor(num / 10) * 100 + (num % 10) * 10; // 0482 -> 4820m
      } else if (inputStr.length === 5) {
        return Math.floor(num / 100) * 100 + (num % 100); // 04825 -> 4825m
      }
      return num * 100; // fallback for 1-2 digits
    } else {
      // Long format - treat as full UTM coordinates
      return num;
    }
  }

  const mortarEastingParsed = parseCoordinate(mortarEasting);
  const mortarNorthingParsed = parseCoordinate(mortarNorthing);
  const targetEastingParsed = parseCoordinate(targetEasting);
  const targetNorthingParsed = parseCoordinate(targetNorthing);

  // Check if coordinates are valid
  const mortarValid = mortarEastingParsed !== null && mortarNorthingParsed !== null;
  const targetValid = targetEastingParsed !== null && targetNorthingParsed !== null;

  // Store original target coordinates when they first become valid
  useEffect(() => {
    if (targetValid && (originalTargetEasting === null || originalTargetNorthing === null)) {
      setOriginalTargetEasting(targetEastingParsed);
      setOriginalTargetNorthing(targetNorthingParsed);
    }
  }, [targetValid, targetEastingParsed, targetNorthingParsed, originalTargetEasting, originalTargetNorthing]);

  // Reset original coordinates when target coordinates are manually changed
  useEffect(() => {
    if (targetValid) {
      // Check if the current coordinates are significantly different from what would result from adjustments
      if (originalTargetEasting !== null && originalTargetNorthing !== null) {
        const expectedEasting = originalTargetEasting;
        const expectedNorthing = originalTargetNorthing;
        const tolerance = 10; // 10 meter tolerance for coordinate parsing differences
        
        if (Math.abs(targetEastingParsed - expectedEasting) > tolerance || 
            Math.abs(targetNorthingParsed - expectedNorthing) > tolerance) {
          // Coordinates were manually changed, update the original
          setOriginalTargetEasting(targetEastingParsed);
          setOriginalTargetNorthing(targetNorthingParsed);
        }
      }
    } else {
      // Target coordinates cleared, reset original
      setOriginalTargetEasting(null);
      setOriginalTargetNorthing(null);
    }
  }, [targetEasting, targetNorthing]);

  // Run solution search whenever inputs change
  useEffect(() => {
    setSolutions([]);
    setChosenIndex(0);
    setBestSolution(null);
    setSolutionReason(''); // Reset reason
    
    if (!mortarValid || !targetValid) return;

    // Calculate range and bearing using UTM coordinates
    const { horizontalDistance, bearingDeg } = rangeCalculation(
      mortarEastingParsed, mortarNorthingParsed, mortarElev || 0,
      targetEastingParsed, targetNorthingParsed, targetElev || 0
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
        bearingMils: Math.round(best.bearingDeg * 17.7778),
        range: best.horizontalDistance,
        elevationExceeded: (useIndirect ? best.indirect?.angleMils : best.direct?.angleMils) < MIN_ELEVATION_MILS
      });
      
      setSolutionReason(reason);
    }
  }, [mortarEasting, mortarNorthing, targetEasting, targetNorthing, mortarElev, targetElev]);

  // Functions for managing mortars in sheaf tab
  const addMortar = () => {
    const newId = Math.max(...mortars.map(m => m.id)) + 1;
    setMortars([...mortars, { 
      id: newId, 
      easting: '', 
      northing: '', 
      elevation: 0, 
      label: `Mortar ${newId}` 
    }]);
  };

  const deleteMortar = (id) => {
    if (mortars.length > 1) {
      setMortars(mortars.filter(m => m.id !== id));
    }
  };

  const updateMortar = (id, field, value) => {
    setMortars(mortars.map(m => 
      m.id === id ? { ...m, [field]: value } : m
    ));
  };

  // Calculate sheaf distribution
  const calculateSheafDistribution = () => {
    if (!targetValid || mortars.length < 2) return [];
    
    const { bearingDeg } = rangeCalculation(
      mortarEastingParsed, mortarNorthingParsed, mortarElev || 0,
      targetEastingParsed, targetNorthingParsed, targetElev || 0
    );
    
    const bearingRad = bearingDeg * Math.PI / 180;
    const perpBearingRad = bearingRad + Math.PI / 2;
    
    return mortars.map((mortar, index) => {
      const mortarEastingParsed = parseCoordinate(mortar.easting);
      const mortarNorthingParsed = parseCoordinate(mortar.northing);
      
      if (!mortarEastingParsed || !mortarNorthingParsed) return null;
      
      let targetAdjustmentE = 0;
      let targetAdjustmentN = 0;
      
      switch (sheafType) {
        case 'open':
          // Spread perpendicular to bearing, alternating sides
          const openOffset = Math.floor(index / 2) * sheafSpread * (index % 2 === 0 ? 1 : -1);
          targetAdjustmentE = openOffset * Math.sin(perpBearingRad);
          targetAdjustmentN = openOffset * Math.cos(perpBearingRad);
          break;
          
        case 'closed':
          // Tight spacing perpendicular to bearing
          const closedOffset = (index - (mortars.length - 1) / 2) * (sheafSpread / 2);
          targetAdjustmentE = closedOffset * Math.sin(perpBearingRad);
          targetAdjustmentN = closedOffset * Math.cos(perpBearingRad);
          break;
          
        case 'linear':
          // Spread along the bearing line
          const linearOffset = (index - (mortars.length - 1) / 2) * sheafSpread;
          targetAdjustmentE = linearOffset * Math.sin(bearingRad);
          targetAdjustmentN = linearOffset * Math.cos(bearingRad);
          break;
          
        case 'rectangular':
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
      
      const adjustedTargetE = targetEastingParsed + targetAdjustmentE;
      const adjustedTargetN = targetNorthingParsed + targetAdjustmentN;
      
      const { horizontalDistance, bearingDeg: mortarBearing } = rangeCalculation(
        mortarEastingParsed, mortarNorthingParsed, mortar.elevation || 0,
        adjustedTargetE, adjustedTargetN, targetElev || 0
      );
      
      return {
        mortar,
        targetE: adjustedTargetE,
        targetN: adjustedTargetN,
        range: horizontalDistance,
        bearing: mortarBearing,
        bearingMils: Math.round(mortarBearing * 17.7778)
      };
    }).filter(Boolean);
  };

  // Fire adjustment button helper
  const adjustFire = (type, amount) => {
    setFireAdjustments(prev => ({
      ...prev,
      [type]: Math.max(0, prev[type] + amount)
    }));
  };

  function applyAdjustmentsAndRecalc() {
    if (!mortarValid || !targetValid || originalTargetEasting === null || originalTargetNorthing === null) return;
    
    // Calculate range adjustment (Add = farther from mortar, Drop = closer to mortar)
    const rangeAdjustment = (fireAdjustments.add || 0) - (fireAdjustments.drop || 0);
    
    // Calculate deflection adjustment (Left = negative, Right = positive)
    const deflectionAdjustment = (fireAdjustments.right || 0) - (fireAdjustments.left || 0);
    
    let newEasting, newNorthing;
    let adjustmentBearing;
    
    if (adjustBearing && !isNaN(Number(adjustBearing))) {
      // Custom bearing provided - use it for adjustments
      let bearingValue = Number(adjustBearing);
      if (bearingUnit === 'mils') {
        bearingValue = bearingValue / 17.7778; // Convert mils to degrees
      }
      adjustmentBearing = bearingValue;
      
      const bearingRad = adjustmentBearing * Math.PI / 180;
      
      // Apply adjustments using custom bearing FROM ORIGINAL COORDINATES
      newEasting = originalTargetEasting + rangeAdjustment * Math.sin(bearingRad);
      newNorthing = originalTargetNorthing + rangeAdjustment * Math.cos(bearingRad);
      
      // Apply deflection adjustment perpendicular to custom bearing
      const perpBearingRad = bearingRad + Math.PI / 2;
      newEasting += deflectionAdjustment * Math.sin(perpBearingRad);
      newNorthing += deflectionAdjustment * Math.cos(perpBearingRad);
      
    } else {
      // No custom bearing - maintain mortar-to-target bearing, only adjust range
      const { horizontalDistance, bearingDeg } = rangeCalculation(
        mortarEastingParsed, mortarNorthingParsed, mortarElev || 0,
        originalTargetEasting, originalTargetNorthing, targetElev || 0
      );
      adjustmentBearing = bearingDeg;
      
      // Calculate new range (original + adjustment)
      const newRange = horizontalDistance + rangeAdjustment;
      
      // Keep the same bearing, just change the range FROM MORTAR POSITION
      const bearingRad = bearingDeg * Math.PI / 180;
      newEasting = mortarEastingParsed + newRange * Math.sin(bearingRad);
      newNorthing = mortarNorthingParsed + newRange * Math.cos(bearingRad);
      
      // Apply deflection adjustment perpendicular to original bearing
      const perpBearingRad = bearingRad + Math.PI / 2;
      newEasting += deflectionAdjustment * Math.sin(perpBearingRad);
      newNorthing += deflectionAdjustment * Math.cos(perpBearingRad);
    }

    // Calculate original and new ranges for comparison
    const originalRange = rangeCalculation(
      mortarEastingParsed, mortarNorthingParsed, mortarElev || 0,
      originalTargetEasting, originalTargetNorthing, targetElev || 0
    ).horizontalDistance;
    
    const newRange = rangeCalculation(
      mortarEastingParsed, mortarNorthingParsed, mortarElev || 0,
      newEasting, newNorthing, targetElev || 0
    ).horizontalDistance;
    
    // Convert back to input format
    const formatCoordinate = (coord) => {
      // Try to maintain the original input format
      const originalLength = targetEasting.length || targetNorthing.length;
      
      if (originalLength <= 5) {
        // Short format - convert back to grid coordinates
        if (originalLength === 3) {
          return Math.floor(coord / 100).toString().padStart(3, '0');
        } else if (originalLength === 4) {
          const hundreds = Math.floor(coord / 100) * 10;
          const tens = Math.floor((coord % 100) / 10);
          return (hundreds + tens).toString().padStart(4, '0');
        } else if (originalLength === 5) {
          const hundreds = Math.floor(coord / 100) * 100;
          const remainder = coord % 100;
          return (hundreds + remainder).toString().padStart(5, '0');
        }
        return Math.floor(coord / 100).toString().padStart(3, '0');
      } else {
        // Long format - use full coordinates
        return Math.round(coord).toString();
      }
    };

    setTargetEasting(formatCoordinate(newEasting));
    setTargetNorthing(formatCoordinate(newNorthing));
  }

  // Canvas drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    
    // black background
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    // If mortar/target present, draw baseline and points
    if (mortarValid && targetValid) {
      const { horizontalDistance, bearingDeg } = rangeCalculation(
        mortarEastingParsed, mortarNorthingParsed, mortarElev || 0,
        targetEastingParsed, targetNorthingParsed, targetElev || 0
      );

      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(60, H - 60);
      ctx.lineTo(W - 60, H - 60);
      ctx.stroke();

      // mortar left, target right
      ctx.fillStyle = '#0f0';
      ctx.beginPath(); ctx.arc(60, H - 60, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f55';
      ctx.beginPath(); ctx.arc(W - 60, H - 60, 6, 0, Math.PI * 2); ctx.fill();

      // label ranges & bearing
      ctx.fillStyle = '#fff';
      ctx.font = '12px monospace';
      ctx.fillText(`Range: ${horizontalDistance.toFixed(1)} m`, 64, H - 72);
      ctx.fillText(`Brg: ${bearingDeg.toFixed(2)}° / ${(bearingDeg*17.778).toFixed(1)} mils`, 64, H - 56);

      // draw arcs for chosen solutions
      if (solutions && solutions.length && solutions[chosenIndex]) {
        const item = solutions[chosenIndex];
        // draw both if present
        const drawSolution = (sol, color) => {
          if (!sol) return;
          // simulate and produce points (x in meters)
          const pts = [];
          let vx = item.params.velocity * Math.cos(sol.angleDeg * Math.PI / 180);
          let vy = item.params.velocity * Math.sin(sol.angleDeg * Math.PI / 180);
          let x = 0;
          let y = mortarElev || 0;
          const dt = 0.0333;
          for (let step = 0; step < 5000; step++) {
            const v = Math.hypot(vx, vy);
            const dragForce = (v !== 0) ? item.params.drag * v * v : 0;
            const ax = (v !== 0) ? -dragForce * vx / (item.params.mass * v) : 0;
            const ay = (v !== 0) ? -g_const - (dragForce * vy / (item.params.mass * v)) : -g_const;
            vx += ax * dt;
            vy += ay * dt;
            x += vx * dt;
            y += vy * dt;
            pts.push({ x, y });
            if (x > item.horizontalDistance * 1.2 || y < (Math.min(mortarElev, targetElev) - 200)) break;
          }
          // map to canvas
          const scaleX = (W - 140) / Math.max(item.horizontalDistance, 1);
          // find top/bottom for vertical scale
          const minY = Math.min(...pts.map(p => p.y));
          const maxY = Math.max(...pts.map(p => p.y));
          const spanY = Math.max(1, Math.abs(minY - (targetElev || 0)) + 1);
          const scaleY = (H - 160) / spanY;

          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          for (let i = 0; i < pts.length; i++) {
            const px = 60 + pts[i].x * scaleX;
            const py = H - 60 - (pts[i].y - Math.min(mortarElev, targetElev)) * scaleY;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          ctx.stroke();
        };

        drawSolution(item.direct, '#0ff');   // direct = cyan
        drawSolution(item.indirect, '#ffb400'); // indirect = orange
        ctx.fillStyle = '#fff';
        ctx.font = '13px monospace';
        ctx.fillText(`${item.label}  (click list to choose)`, 68, 20);
      }
    } else {
      // draw helper text
      ctx.fillStyle = '#666';
      ctx.font = '14px sans-serif';
      ctx.fillText('Enter Mortar & Target coordinates on the left to compute firing solution.', 20, H / 2 - 10);
      ctx.fillText('Choose a ring from the list to visualize direct (cyan) and indirect (orange) arcs.', 20, H / 2 + 10);
    }
  }, [mortarValid, targetValid, mortarElev, targetElev, solutions, chosenIndex, mortarEasting, mortarNorthing, targetEasting, targetNorthing]);

  return (
    <div className="app-root">
      <div className="sidebar">
        <div className="header">
          <h1>M252 Mortar Calculator</h1>
          <p>Artillery Fire Mission Computer</p>
        </div>

        {bestSolution && (
          <div className="best-solution">
            <h3>FIRING SOLUTION</h3>
            {solutionReason && (
              <div className="solution-reason">
                <small>💡 {solutionReason}</small>
              </div>
            )}
            <div className="solution-grid">
              <div className="solution-item">
                <span className="label">RING:</span>
                <span className="value">{bestSolution.ring}</span>
              </div>
              <div className="solution-item">
                <span className="label">TYPE:</span>
                <span className="value">{bestSolution.type}</span>
              </div>
              <div className="solution-item">
                <span className="label">ELEVATION:</span>
                <span className="value">{bestSolution.solution.angleMils} MILS</span>
              </div>
              <div className="solution-item">
                <span className="label">BEARING:</span>
                <span className="value">{bestSolution.bearingMils} MILS</span>
              </div>
              <div className="solution-item">
                <span className="label">RANGE:</span>
                <span className="value">{bestSolution.range.toFixed(0)} M</span>
              </div>
              <div className="solution-item">
                <span className="label">TOF:</span>
                <span className="value">{bestSolution.solution.tof.toFixed(1)} S</span>
              </div>
            </div>
          </div>
        )}

        <div className="input-section">
          <h3>Mortar Position</h3>
          <div className="coordinate-row">
            <div className="coordinate-input">
              <label>Easting</label>
              <input 
                value={mortarEasting} 
                onChange={e => setMortarEasting(e.target.value)} 
                placeholder="048 (= 4800m)" 
              />
            </div>
            <div className="coordinate-input">
              <label>Northing</label>
              <input 
                value={mortarNorthing} 
                onChange={e => setMortarNorthing(e.target.value)} 
                placeholder="120 (= 12000m)" 
              />
            </div>
          </div>
          <div className="elevation-input">
            <label>Elevation (m)</label>
            <input 
              type="number" 
              value={mortarElev} 
              onChange={e => setMortarElev(Number(e.target.value))} 
            />
          </div>
        </div>

        <div className="input-section">
          <h3>Target Position</h3>
          <div className="coordinate-row">
            <div className="coordinate-input">
              <label>Easting</label>
              <input 
                value={targetEasting} 
                onChange={e => setTargetEasting(e.target.value)} 
                placeholder="050 (= 5000m)" 
              />
            </div>
            <div className="coordinate-input">
              <label>Northing</label>
              <input 
                value={targetNorthing} 
                onChange={e => setTargetNorthing(e.target.value)} 
                placeholder="110 (= 11000m)" 
              />
            </div>
          </div>
          <div className="elevation-input">
            <label>Elevation (m)</label>
            <input 
              type="number" 
              value={targetElev} 
              onChange={e => setTargetElev(Number(e.target.value))} 
            />
          </div>
        </div>

        <div className="tabs">
          <button className={tab === 'direct' ? 'active' : ''} onClick={() => setTab('direct')}>
            Direct Fire
          </button>
          <button className={tab === 'adjust' ? 'active' : ''} onClick={() => setTab('adjust')}>
            Adjust Fire
          </button>
          <button className={tab === 'sheaf' ? 'active' : ''} onClick={() => setTab('sheaf')}>
            Sheaf Distribution
          </button>
        </div>

        {tab === 'direct' && (
          <div className="tab-content">
            {(!mortarValid || !targetValid) && (
              <div className="warning">Enter both mortar and target coordinates to compute firing solutions</div>
            )}
            {mortarValid && targetValid && (
              <>
                {(() => {
                  const { horizontalDistance, bearingDeg } = rangeCalculation(
                    mortarEastingParsed, mortarNorthingParsed, mortarElev || 0,
                    targetEastingParsed, targetNorthingParsed, targetElev || 0
                  );
                  return (
                    <div className="target-info">
                      <div>Range: {horizontalDistance.toFixed(1)} m</div>
                      <div>Bearing: {bearingDeg.toFixed(2)}° / {(bearingDeg*17.7778).toFixed(2)} mils</div>
                    </div>
                  );
                })()}
                <div className="solutions-list">
                  <h4>Available Solutions</h4>
                  {solutions.length === 0 && (
                    <div className="no-solution">No viable solution found (target may be out of range)</div>
                  )}
                  {solutions.map((s, idx) => (
                    <div 
                      key={s.label} 
                      className={`solution-row ${idx === chosenIndex ? 'chosen' : ''}`} 
                      onClick={() => setChosenIndex(idx)}
                    >
                      <div className="solution-header">
                        <div className="ring-name">{s.label}</div>
                        <div className="error-value">
                          {(Math.min(s.direct ? s.direct.obj : Infinity, s.indirect ? s.indirect.obj : Infinity)).toFixed(2)} err
                        </div>
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
              </>
            )}
          </div>
        )}

        {tab === 'adjust' && (
          <div className="tab-content">
            <div className="input-section">
              <h4>Adjustment Bearing (optional)</h4>
              <div className="bearing-input-row">
                <div className="bearing-input">
                  <input 
                    value={adjustBearing} 
                    onChange={e => setAdjustBearing(e.target.value)} 
                    placeholder="Leave blank for auto"
                  />
                </div>
                <div className="bearing-unit-selector">
                  <select value={bearingUnit} onChange={e => setBearingUnit(e.target.value)}>
                    <option value="degrees">Degrees</option>
                    <option value="mils">Mils</option>
                  </select>
                </div>
              </div>
              <small className="bearing-help">
                {mortarValid && targetValid && (() => {
                  const { bearingDeg } = rangeCalculation(
                    mortarEastingParsed, mortarNorthingParsed, mortarElev || 0,
                    targetEastingParsed, targetNorthingParsed, targetElev || 0
                  );
                  return `Default: ${bearingDeg.toFixed(1)}° / ${(bearingDeg * 17.7778).toFixed(1)} mils (mortar to target)`;
                })()}
              </small>
            </div>
            
            <div className="input-section">
              <h4>Fire Adjustments (meters)</h4>
              <div className="fire-adjustments">
                <div className="adjustment-group">
                  <label>Add (farther) - {fireAdjustments.add}m</label>
                  <div className="adjustment-buttons">
                    {[10, 50].map(amount => (
                      <button key={amount} onClick={() => adjustFire('add', amount)}>+{amount}</button>
                    ))}
                    {[10, 50].map(amount => (
                      <button key={`-${amount}`} onClick={() => adjustFire('add', -amount)}>-{amount}</button>
                    ))}
                    <button onClick={() => setFireAdjustments(prev => ({...prev, add: 0}))}>Clear</button>
                  </div>
                </div>
                
                <div className="adjustment-group">
                  <label>Drop (closer) - {fireAdjustments.drop}m</label>
                  <div className="adjustment-buttons">
                    {[10, 50].map(amount => (
                      <button key={amount} onClick={() => adjustFire('drop', amount)}>+{amount}</button>
                    ))}
                    {[10, 50].map(amount => (
                      <button key={`-${amount}`} onClick={() => adjustFire('drop', -amount)}>-{amount}</button>
                    ))}
                    <button onClick={() => setFireAdjustments(prev => ({...prev, drop: 0}))}>Clear</button>
                  </div>
                </div>
                
                <div className="adjustment-group">
                  <label>Left - {fireAdjustments.left}m</label>
                  <div className="adjustment-buttons">
                    {[10, 50].map(amount => (
                      <button key={amount} onClick={() => adjustFire('left', amount)}>+{amount}</button>
                    ))}
                    {[10, 50].map(amount => (
                      <button key={`-${amount}`} onClick={() => adjustFire('left', -amount)}>-{amount}</button>
                    ))}
                    <button onClick={() => setFireAdjustments(prev => ({...prev, left: 0}))}>Clear</button>
                  </div>
                </div>
                
                <div className="adjustment-group">
                  <label>Right - {fireAdjustments.right}m</label>
                  <div className="adjustment-buttons">
                    {[10, 50].map(amount => (
                      <button key={amount} onClick={() => adjustFire('right', amount)}>+{amount}</button>
                    ))}
                    {[10, 50].map(amount => (
                      <button key={`-${amount}`} onClick={() => adjustFire('right', -amount)}>-{amount}</button>
                    ))}
                    <button onClick={() => setFireAdjustments(prev => ({...prev, right: 0}))}>Clear</button>
                  </div>
                </div>
              </div>
              <button className="apply-btn" onClick={applyAdjustmentsAndRecalc}>
                Apply Fire Adjustments
              </button>
            </div>
          </div>
        )}

        {tab === 'sheaf' && (
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
                  <input 
                    type="number" 
                    value={sheafSpread} 
                    onChange={e => setSheafSpread(Number(e.target.value))} 
                    min="10" 
                    max="200"
                  />
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
                      <input 
                        value={mortar.label} 
                        onChange={e => updateMortar(mortar.id, 'label', e.target.value)}
                        className="mortar-label"
                      />
                      {mortars.length > 1 && (
                        <button 
                          onClick={() => deleteMortar(mortar.id)}
                          className="delete-mortar"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    <div className="mortar-coordinates">
                      <div className="coordinate-input">
                        <label>Easting</label>
                        <input 
                          value={mortar.easting} 
                          onChange={e => updateMortar(mortar.id, 'easting', e.target.value)} 
                          placeholder="048"
                        />
                      </div>
                      <div className="coordinate-input">
                        <label>Northing</label>
                        <input 
                          value={mortar.northing} 
                          onChange={e => updateMortar(mortar.id, 'northing', e.target.value)} 
                          placeholder="120"
                        />
                      </div>
                      <div className="elevation-input">
                        <label>Elevation (m)</label>
                        <input 
                          type="number" 
                          value={mortar.elevation} 
                          onChange={e => updateMortar(mortar.id, 'elevation', Number(e.target.value))} 
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={addMortar} className="add-mortar-btn">
                + Add Mortar
              </button>
            </div>

            {targetValid && (
              <div className="input-section">
                <h4>Sheaf Distribution Results</h4>
                <div className="sheaf-results">
                  {calculateSheafDistribution().map((result, index) => (
                    <div key={result.mortar.id} className="sheaf-result-item">
                      <div className="result-header">
                        <strong>{result.mortar.label}</strong>
                      </div>
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
        )}

        <div className="actions">
          <button 
            className="reset-btn" 
            onClick={() => { 
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
          >
            Reset All
          </button>
        </div>
      </div>

      <div className="canvas-container">
        <canvas ref={canvasRef} width={1200} height={600} />
      </div>
    </div>
  );
}