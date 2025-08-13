import { rangeCalculation } from '../Calculations';

// Pure helper to update fire adjustments immutably
export function adjustFireState(prev, type, amount) {
  const next = { ...prev };
  const val = (next[type] || 0) + amount;

  // Range pair netting
  if (type === 'add') {
    const net = (next.add || 0) + amount - (next.drop || 0);
    if (net >= 0) { next.add = net; next.drop = 0; } else { next.add = 0; next.drop = -net; }
  } else if (type === 'drop') {
    const net = (next.add || 0) - ((next.drop || 0) + amount);
    if (net >= 0) { next.add = net; next.drop = 0; } else { next.add = 0; next.drop = -net; }
  }

  // Deflection pair netting
  if (type === 'right') {
    const net = (next.right || 0) + amount - (next.left || 0);
    if (net >= 0) { next.right = net; next.left = 0; } else { next.right = 0; next.left = -net; }
  } else if (type === 'left') {
    const net = (next.right || 0) - ((next.left || 0) + amount);
    if (net >= 0) { next.right = net; next.left = 0; } else { next.right = 0; next.left = -net; }
  }

  // Ensure non-negative integers
  next.add = Math.max(0, Math.round(next.add || 0));
  next.drop = Math.max(0, Math.round(next.drop || 0));
  next.left = Math.max(0, Math.round(next.left || 0));
  next.right = Math.max(0, Math.round(next.right || 0));
  return next;
}

// Compute new target coordinates strings from current state and adjustments
export function applyAdjustments({
  mortarValid,
  targetValid,
  originalTargetEasting,
  originalTargetNorthing,
  fireAdjustments,
  adjustBearing,
  bearingUnit, // 'degrees' | 'mils'
  mortarEastingParsed,
  mortarNorthingParsed,
  mortarElev = 0,
  targetElev = 0,
  targetEastingStr,
  targetNorthingStr,
}) {
  if (!mortarValid || !targetValid || originalTargetEasting === null || originalTargetNorthing === null) {
    return { targetEastingOut: targetEastingStr, targetNorthingOut: targetNorthingStr };
  }

  const rangeAdjustment = (fireAdjustments.add || 0) - (fireAdjustments.drop || 0);
  const deflectionAdjustment = (fireAdjustments.right || 0) - (fireAdjustments.left || 0);

  let newEasting, newNorthing;

  if (adjustBearing && !isNaN(Number(adjustBearing))) {
    let bearingValue = Number(adjustBearing);
    if (bearingUnit === 'mils') {
      bearingValue = bearingValue / 17.7778; // to degrees
    }
    const bearingRad = bearingValue * Math.PI / 180;
    newEasting = originalTargetEasting + rangeAdjustment * Math.sin(bearingRad);
    newNorthing = originalTargetNorthing + rangeAdjustment * Math.cos(bearingRad);
    const perpBearingRad = bearingRad + Math.PI / 2;
    newEasting += deflectionAdjustment * Math.sin(perpBearingRad);
    newNorthing += deflectionAdjustment * Math.cos(perpBearingRad);
  } else {
    const { horizontalDistance, bearingDeg } = rangeCalculation(
      mortarEastingParsed, mortarNorthingParsed, mortarElev || 0,
      originalTargetEasting, originalTargetNorthing, targetElev || 0
    );
    const newRange = horizontalDistance + rangeAdjustment;
    const bearingRad = bearingDeg * Math.PI / 180;
    newEasting = mortarEastingParsed + newRange * Math.sin(bearingRad);
    newNorthing = mortarNorthingParsed + newRange * Math.cos(bearingRad);
    const perpBearingRad = bearingRad + Math.PI / 2;
    newEasting += deflectionAdjustment * Math.sin(perpBearingRad);
    newNorthing += deflectionAdjustment * Math.cos(perpBearingRad);
  }

  // Format to preserve the original user input precision/format
  // If user makes 10m-level adjustments but original input was 3-digit (100m),
  // elevate precision to 4 digits so the UI reflects 10m steps.
  const originalLength = (targetEastingStr?.length || targetNorthingStr?.length || 0);
  const rangeAdjAbs = Math.abs((fireAdjustments.add || 0) - (fireAdjustments.drop || 0));
  const defAdjAbs = Math.abs((fireAdjustments.right || 0) - (fireAdjustments.left || 0));
  const anyAdj = (rangeAdjAbs !== 0) || (defAdjAbs !== 0);
  // Elevate to at least 4 digits (10 m precision) whenever any adjustment is applied,
  // so distance arithmetic (e.g., +200m) is reflected accurately.
  const desiredLength = Math.max(originalLength, anyAdj ? 4 : 0);

  const formatCoordinate = (coord) => {
    const len = desiredLength;
    if (len <= 5) {
      if (len === 3) {
        return Math.round(coord / 100).toString().padStart(3, '0');
      } else if (len === 4) {
        return Math.round(coord / 10).toString().padStart(4, '0');
      } else if (len === 5) {
        return Math.round(coord).toString().padStart(5, '0');
      }
      return Math.round(coord / 100).toString().padStart(3, '0');
    }
    return Math.round(coord).toString();
  };

  return {
    targetEastingOut: formatCoordinate(newEasting),
    targetNorthingOut: formatCoordinate(newNorthing),
    targetEastingPrecise: newEasting,
    targetNorthingPrecise: newNorthing,
  };
}

