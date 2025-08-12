import React, { useState, useEffect, useRef } from 'react';
import * as mgrs from 'mgrs';
import './App.css';

/* ---------- user-supplied projectile code (adapted) ---------- */

const g_const = 9.81; // gravity for these functions (m/s^2)

function degreesToMils(degrees) {
  return degrees * 17.7777777778;
}

// simulateTrajectory as provided (uses dt = 0.0333)
function simulateTrajectory(angleDeg, targetRange, heightLauncher, heightTarget,
    projectileMass = 23, projectileAirDrag = 0.0043, projectileVelocity = 212.5) {
  const angleRad = angleDeg * (Math.PI / 180);
  let vx0 = projectileVelocity * Math.cos(angleRad);
  let vy0 = projectileVelocity * Math.sin(angleRad);
  let x = 0;
  let y = heightLauncher;
  const dt = 0.0333;
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

/* ---------- end - user code ---------- */

/* ---------- helper geodesy & geometry ---------- */
const R_earth = 6371000;
const toRad = d => d * Math.PI / 180;
const toDeg = r => r * 180 / Math.PI;

function haversineMeters(aLatLng, bLatLng) {
  const dLat = toRad(bLatLng[0] - aLatLng[0]);
  const dLon = toRad(bLatLng[1] - aLatLng[1]);
  const lat1 = toRad(aLatLng[0]);
  const lat2 = toRad(bLatLng[0]);
  const sinDlat = Math.sin(dLat / 2) ** 2;
  const sinDlon = Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(sinDlat + Math.cos(lat1) * Math.cos(lat2) * sinDlon),
    Math.sqrt(1 - (sinDlat + Math.cos(lat1) * Math.cos(lat2) * sinDlon)));
  return R_earth * c;
}

function bearingDeg(aLatLng, bLatLng) {
  const lat1 = toRad(aLatLng[0]);
  const lat2 = toRad(bLatLng[0]);
  const dLon = toRad(bLatLng[1] - aLatLng[1]);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// Offset latlng by north/east meters
function offsetLatLng(latlng, northMeters = 0, eastMeters = 0) {
  if (!latlng) return null;
  const lat = latlng[0];
  const dLat = (northMeters / 6378137) * (180 / Math.PI);
  const dLon = (eastMeters / (6378137 * Math.cos((lat * Math.PI) / 180))) * (180 / Math.PI);
  return [lat + dLat, latlng[1] + dLon];
}

/* ---------- mortar parameter set (your values) ---------- */
const mortarParameters = {
  'M252 Base': { mass: 4.06, drag: 0.0004620, velocity: 66 },
  'M252 1 Ring': { mass: 4.06, drag: 0.0004620, velocity: 101.046 },
  'M252 2 Rings': { mass: 4.06, drag: 0.0004620, velocity: 137.61 },
  'M252 3 Rings': { mass: 4.06, drag: 0.0004620, velocity: 167.706 },
  'M252 4 Rings': { mass: 4.06, drag: 0.0004620, velocity: 196.482 }
};

/* ---------- UI & App ---------- */

export default function App() {
  const [zone, setZone] = useState('33TWN');
  const [coordDigits, setCoordDigits] = useState(6);

  const [mortarInput, setMortarInput] = useState('');
  const [targetInput, setTargetInput] = useState('');
  const [observerInput, setObserverInput] = useState('');

  const [mortarElev, setMortarElev] = useState(0);
  const [targetElev, setTargetElev] = useState(0);

  const [tab, setTab] = useState('direct'); // 'direct' or 'adjust'
  const [cardinalOffset, setCardinalOffset] = useState({ north: 0, east: 0, south: 0, west: 0 });

  const [solutions, setSolutions] = useState([]); // per-ring solutions
  const [chosenIndex, setChosenIndex] = useState(0);

  const canvasRef = useRef(null);

  // Convert numeric-or-full input to lat/lon via MGRS
  function coordInputToLatLng(zoneStr, userInput) {
    if (!userInput) return null;
    const raw = userInput.trim();
    let mgrsString;
    // if contains letters, treat as full MGRS
    if (/[A-Za-z]/.test(raw)) {
      mgrsString = raw.replace(/\s+/g, '');
    } else {
      mgrsString = (zoneStr || '').trim() + raw;
    }
    try {
      const p = mgrs.toPoint(mgrsString); // [lon, lat]
      return [p[1], p[0]];
    } catch (e) {
      // invalid mgrs
      return null;
    }
  }

  const mortarLatLng = coordInputToLatLng(zone, mortarInput);
  const targetLatLng = coordInputToLatLng(zone, targetInput);
  const observerLatLng = coordInputToLatLng(zone, observerInput);

  // run solution search whenever inputs change (direct-fire mode or after apply adjust)
  useEffect(() => {
    setSolutions([]);
    setChosenIndex(0);
    if (!mortarLatLng || !targetLatLng) return;
    const horizontalDistance = haversineMeters(mortarLatLng, targetLatLng);
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
        bearingDeg: bearingDeg(mortarLatLng, targetLatLng),
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mortarInput, targetInput, mortarElev, targetElev, zone]);

  // apply adjust-fire: observer or cardinal offsets -> update targetInput and then the useEffect will recalc
  function applyAdjustmentsAndRecalc() {
    if (!targetLatLng) return;
    // observer mode: if observer provided, compute observer->target bearing & range and then move target by that vector
    if (observerLatLng) {
      // compute bearing & range from observer to target
      const obsBrg = bearingDeg(observerLatLng, targetLatLng);
      const obsRange = haversineMeters(observerLatLng, targetLatLng);
      // shift target further along same vector relative to mortar?
      // We'll compute new target as target offset by the observer->target vector (north/east)
      const north = Math.cos(toRad(obsBrg)) * obsRange;
      const east = Math.sin(toRad(obsBrg)) * obsRange;
      const newTarget = offsetLatLng(targetLatLng, north, east);
      try {
        const full = mgrs.forward([newTarget[1], newTarget[0]], coordDigits);
        const numeric = full.replace(/^[A-Z]+\s*/i, '').replace(/\s+/g, '');
        setTargetInput(numeric);
      } catch (e) {
        console.warn('failed to build MGRS for adjusted target', e);
      }
      return;
    }

    // Cardinal offsets: north/east/south/west meters
    const ns = (cardinalOffset.north || 0) - (cardinalOffset.south || 0);
    const ew = (cardinalOffset.east || 0) - (cardinalOffset.west || 0);
    if (ns !== 0 || ew !== 0) {
      const newTarget = offsetLatLng(targetLatLng, ns, ew);
      try {
        const full = mgrs.forward([newTarget[1], newTarget[0]], coordDigits);
        const numeric = full.replace(/^[A-Z]+\s*/i, '').replace(/\s+/g, '');
        setTargetInput(numeric);
      } catch (e) {
        console.warn('failed to build MGRS for adjusted target', e);
      }
    }
  }

  // Canvas drawing: draw mortar/target & arcs for chosen ring (direct + indirect)
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
    if (mortarLatLng && targetLatLng) {
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
      const range = haversineMeters(mortarLatLng, targetLatLng);
      const brg = bearingDeg(mortarLatLng, targetLatLng);
      ctx.fillStyle = '#fff';
      ctx.font = '12px monospace';
      ctx.fillText(`Range: ${range.toFixed(1)} m`, 64, H - 72);
      ctx.fillText(`Brg: ${brg.toFixed(2)}° / ${(brg*17.778).toFixed(1)} mils`, 64, H - 56);

      // draw arcs for chosen solutions
      if (solutions && solutions.length && solutions[chosenIndex]) {
        const item = solutions[chosenIndex];
        // draw both if present
        const drawSolution = (sol, color) => {
          if (!sol) return;
          // simulate and produce points (x in meters)
          const pts = [];
          let vx = item.params.velocity * Math.cos(toRad(sol.angleDeg));
          let vy = item.params.velocity * Math.sin(toRad(sol.angleDeg));
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
      ctx.fillText('Enter Mortar & Target grids on the left (4/6/8/10 digits or full MGRS).', 20, H / 2 - 10);
      ctx.fillText('Choose a ring from the list to visualize direct (cyan) and indirect (orange) arcs.', 20, H / 2 + 10);
    }
  }, [mortarLatLng, targetLatLng, mortarElev, targetElev, solutions, chosenIndex, coordDigits, cardinalOffset, observerLatLng]);

  // helper to show numeric-only part of MGRS
  function displayGridNumeric(latlng, digits) {
    if (!latlng) return '';
    try {
      const full = mgrs.forward([latlng[1], latlng[0]], digits);
      const numeric = full.replace(/^[A-Z0-9]{0,6}\s*/i, '').replace(/\s+/g, '');
      return numeric;
    } catch (e) {
      return '';
    }
  }

  return (
    <div className="app-root" style={{ color: '#eee' }}>
      <div className="sidebar">
        <h2>Artillery Calculator</h2>
        <hr />

        <label>Mortar grid (numeric-only or full MGRS)</label>
        <input value={mortarInput} onChange={e => setMortarInput(e.target.value)} placeholder="e.g. 123456 or 33TWN123456..." />
        <label>Mortar elevation (m)</label>
        <input type="number" value={mortarElev} onChange={e => setMortarElev(Number(e.target.value))} />

        <label>Target grid (numeric-only or full MGRS)</label>
        <input value={targetInput} onChange={e => setTargetInput(e.target.value)} placeholder="e.g. 654321" />
        <label>Target elevation (m)</label>
        <input type="number" value={targetElev} onChange={e => setTargetElev(Number(e.target.value))} />

        <div style={{ marginTop: 8 }}>
          <strong>Displayed grids (numeric part):</strong>
          <div>Mortar: {displayGridNumeric(mortarLatLng, coordDigits)}</div>
          <div>Target: {displayGridNumeric(targetLatLng, coordDigits)}</div>
        </div>

        <hr />

        <div className="tabs">
          <button className={tab === 'direct' ? 'active' : ''} onClick={() => setTab('direct')}>Direct Fire</button>
          <button className={tab === 'adjust' ? 'active' : ''} onClick={() => setTab('adjust')}>Adjust Fire</button>
        </div>

        {tab === 'direct' && (
          <>
            <h3>Direct Fire Results</h3>
            {!mortarLatLng || !targetLatLng && <div className="warn">Enter both mortar and target grids to compute</div>}
            {mortarLatLng && targetLatLng && (
              <>
                <div>Range: {haversineMeters(mortarLatLng, targetLatLng).toFixed(1)} m</div>
                <div>Bearing: {bearingDeg(mortarLatLng, targetLatLng).toFixed(2)}° / {(bearingDeg(mortarLatLng, targetLatLng)*17.7778).toFixed(2)} mils</div>
                <hr />
                <div><strong>Ring solutions (best-first):</strong></div>
                <div className="solutions-list">
                  {solutions.length === 0 && <div>No viable solution found (target may be out of range).</div>}
                  {solutions.map((s, idx) => (
                    <div key={s.label} className={`solution-row ${idx === chosenIndex ? 'chosen' : ''}`} onClick={() => setChosenIndex(idx)}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <div><strong>{s.label}</strong></div>
                        <div style={{ color: '#aaa' }}>{(Math.min(s.direct ? s.direct.obj : Infinity, s.indirect ? s.indirect.obj : Infinity)).toFixed(2)} err</div>
                      </div>
                      <div style={{ fontSize: 13 }}>
                        {s.direct && <span style={{ color: '#0ff' }}>Direct: {s.direct.angleDeg.toFixed(2)}° / {s.direct.angleMils} mils — tof {s.direct.tof ? s.direct.tof.toFixed(2) + ' s' : 'n/a'} </span>}
                        <br />
                        {s.indirect && <span style={{ color: '#ffb400' }}>Indirect: {s.indirect.angleDeg.toFixed(2)}° / {s.indirect.angleMils} mils — tof {s.indirect.tof ? s.indirect.tof.toFixed(2) + ' s' : 'n/a'}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {tab === 'adjust' && (
          <>
            <h3>Adjust Fire</h3>
            <label>Observer grid (optional)</label>
            <input value={observerInput} onChange={e => setObserverInput(e.target.value)} placeholder="observer grid or full MGRS" />
            <div style={{ marginTop: 8 }}>
              <strong>Cardinal offsets to apply to target (meters)</strong>
              <div className="cardinals">
                <div><label>N</label><input type="number" value={cardinalOffset.north} onChange={e => setCardinalOffset({...cardinalOffset, north: Number(e.target.value)})} /></div>
                <div><label>E</label><input type="number" value={cardinalOffset.east} onChange={e => setCardinalOffset({...cardinalOffset, east: Number(e.target.value)})} /></div>
                <div><label>S</label><input type="number" value={cardinalOffset.south} onChange={e => setCardinalOffset({...cardinalOffset, south: Number(e.target.value)})} /></div>
                <div><label>W</label><input type="number" value={cardinalOffset.west} onChange={e => setCardinalOffset({...cardinalOffset, west: Number(e.target.value)})} /></div>
              </div>
              <button onClick={applyAdjustmentsAndRecalc}>Apply Adjustments (observer / cardinal)</button>
            </div>
          </>
        )}

        <div style={{ marginTop: 10 }}>
          <button onClick={() => { setMortarInput(''); setTargetInput(''); setObserverInput(''); setSolutions([]); setChosenIndex(0); }}>Reset</button>
        </div>
      </div>

      <div className="canvas-container">
        <canvas ref={canvasRef} width={1100} height={500} />
      </div>
    </div>
  );
}
