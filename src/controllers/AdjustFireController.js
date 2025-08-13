import { rangeCalculation } from '../Calculations';

// Pure helper to update fire adjustments immutably
export function adjustFireState(prev, type, amount) {
  return {
    ...prev,
    [type]: Math.max(0, (prev[type] || 0) + amount),
  };
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
  const originalLength = (targetEastingStr?.length || targetNorthingStr?.length || 0);
  const formatCoordinate = (coord) => {
    if (originalLength <= 5) {
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
    }
    return Math.round(coord).toString();
  };

  return {
    targetEastingOut: formatCoordinate(newEasting),
    targetNorthingOut: formatCoordinate(newNorthing),
  };
}

