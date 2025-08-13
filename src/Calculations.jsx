// Physics and search calculations, and basic ballistic helpers

export const g_const = 9.81; // gravity (m/s^2)

export function simulateTrajectory(angleDeg, targetRange, heightLauncher, heightTarget,
  projectileMass = 23, projectileAirDrag = 0.0043, projectileVelocity = 212.5) {
  const angleRad = angleDeg * (Math.PI / 180);
  let vx0 = projectileVelocity * Math.cos(angleRad);
  let vy0 = projectileVelocity * Math.sin(angleRad);
  let x = 0;
  let y = heightLauncher;
  const dt = 0.0333; // ~30 FPS
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

export function objectiveFunction(angleDeg, targetRange, heightLauncher, heightTarget,
  projectileMass, projectileAirDrag, projectileVelocity) {
  const { x: distanceTraveled, y: finalHeight } = simulateTrajectory(
    angleDeg, targetRange, heightLauncher, heightTarget,
    projectileMass, projectileAirDrag, projectileVelocity);

  return Math.abs(distanceTraveled - targetRange) + Math.abs(finalHeight - heightTarget);
}

export function goldenSectionSearch(lowerBound, upperBound, objectiveFunc, tol = 0.001) {
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

// Range/bearing from UTM coordinates
export function rangeCalculation(eastingLauncher, northingLauncher, heightLauncher,
  eastingTarget, northingTarget, heightTarget) {
  const deltaEasting = eastingTarget - eastingLauncher;
  const deltaNorthing = northingTarget - northingLauncher;
  const horizontalDistance = Math.sqrt(deltaEasting * deltaEasting + deltaNorthing * deltaNorthing);

  const bearingRad = Math.atan2(deltaEasting, deltaNorthing);
  let bearingDeg = bearingRad * (180 / Math.PI); // radians -> degrees
  if (bearingDeg < 0) bearingDeg += 360;

  return { horizontalDistance, bearingDeg, heightLauncher, heightTarget };
}

// Mortar parameter set
export const mortarParameters = {
  'M252 Base': { mass: 4.06, drag: 0.0004620, velocity: 66 },
  'M252 1 Ring': { mass: 4.06, drag: 0.0004620, velocity: 101.046 },
  'M252 2 Rings': { mass: 4.06, drag: 0.0004620, velocity: 137.61 },
  'M252 3 Rings': { mass: 4.06, drag: 0.0004620, velocity: 167.706 },
  'M252 4 Rings': { mass: 4.06, drag: 0.0004620, velocity: 196.482 }
};

