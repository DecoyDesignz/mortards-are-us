import React, { useEffect, useRef } from 'react';
import { g_const, rangeCalculation } from './Calculations';

export default function BallisticsSimulationDisplay({
  mortarValid,
  targetValid,
  mortarEastingParsed,
  mortarNorthingParsed,
  targetEastingParsed,
  targetNorthingParsed,
  targetEastingPrecise,
  targetNorthingPrecise,
  mortarElev,
  targetElev,
  solutions,
  chosenIndex,
  bestSolution,
  solutionReason,
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    // background
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    if (mortarValid && targetValid) {
      const targetE = targetEastingPrecise ?? targetEastingParsed;
      const targetN = targetNorthingPrecise ?? targetNorthingParsed;
      const { horizontalDistance, bearingDeg } = rangeCalculation(
        mortarEastingParsed, mortarNorthingParsed, mortarElev || 0,
        targetE, targetN, targetElev || 0
      );

      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(60, H - 60);
      ctx.lineTo(W - 60, H - 60);
      ctx.stroke();

      // points
      ctx.fillStyle = '#0f0';
      ctx.beginPath(); ctx.arc(60, H - 60, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f55';
      ctx.beginPath(); ctx.arc(W - 60, H - 60, 6, 0, Math.PI * 2); ctx.fill();

      // labels
      ctx.fillStyle = '#fff';
      ctx.font = '12px monospace';
      ctx.fillText(`Range: ${horizontalDistance.toFixed(1)} m`, 64, H - 72);
      ctx.fillText(`Brg: ${bearingDeg.toFixed(2)}° / ${(bearingDeg*17.778).toFixed(1)} mils`, 64, H - 56);

      if (solutions && solutions.length && solutions[chosenIndex]) {
        const item = solutions[chosenIndex];
        const drawSolution = (sol, color) => {
          if (!sol) return;
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
          const scaleX = (W - 140) / Math.max(item.horizontalDistance, 1);
          const minY = Math.min(...pts.map(p => p.y));
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

        drawSolution(item.direct, '#0ff');
        drawSolution(item.indirect, '#ffb400');
        ctx.fillStyle = '#fff';
        ctx.font = '13px monospace';
        ctx.fillText(`${item.label}  (click list to choose)`, 68, 20);
      }
    } else {
      ctx.fillStyle = '#666';
      ctx.font = '14px sans-serif';
      ctx.fillText('Enter Mortar & Target coordinates on the left to compute firing solution.', 20, H / 2 - 10);
      ctx.fillText('Choose a ring from the list to visualize direct (cyan) and indirect (orange) arcs.', 20, H / 2 + 10);
    }
  }, [mortarValid, targetValid, mortarElev, targetElev, solutions, chosenIndex, mortarEastingParsed, mortarNorthingParsed, targetEastingParsed, targetNorthingParsed, targetEastingPrecise, targetNorthingPrecise]);

  return (
    <div className="canvas-container">
      <canvas ref={canvasRef} width={1400} height={700} />
      {bestSolution && (
        <div className="best-solution best-solution-global">
          <h3>FIRING SOLUTION</h3>
          {solutionReason && (
            <div className="solution-reason"><small>{solutionReason}</small></div>
          )}
          <div className="solution-grid">
            <div className="solution-item"><span className="label">RING:</span><span className="value">{bestSolution.ring}</span></div>
            <div className="solution-item"><span className="label">TYPE:</span><span className="value">{bestSolution.type}</span></div>
            <div className="solution-item"><span className="label">ELEVATION:</span><span className="value">{bestSolution.solution.angleMils} MILS</span></div>
            <div className="solution-item"><span className="label">BEARING:</span><span className="value">{bestSolution.bearingMils} MILS</span></div>
            <div className="solution-item"><span className="label">RANGE:</span><span className="value">{bestSolution.range.toFixed(0)} M</span></div>
            <div className="solution-item"><span className="label">TOF:</span><span className="value">{bestSolution.solution.tof.toFixed(1)} S</span></div>
          </div>
        </div>
      )}
    </div>
  );
}

