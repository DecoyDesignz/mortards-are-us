import React from 'react';

// Utilities: general helpers used across the app
export function degreesToMils(degrees) {
  return degrees * 17.7777777778;
}

export function milsToDegrees(mils) {
  return mils / 17.7777777778;
}

// Parse coordinate inputs to full UTM values
export function parseCoordinate(input) {
  if (!input || isNaN(Number(input))) return null;
  const num = Number(input);

  const inputStr = input.toString();

  if (inputStr.length <= 5) {
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

export default {};

