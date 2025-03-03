// src/utils/mathUtils.js

/**
 * Calculate cosine similarity between two vectors
 * @param {Array} vector1 - First vector of numbers
 * @param {Array} vector2 - Second vector of numbers
 * @returns {number} Similarity score between 0 and 1
 */
function calculateSimilarity(vector1, vector2) {
  if (vector1.length !== vector2.length) {
    throw new Error('Vectors must have the same length');
  }
  
  // Calculate dot product
  let dotProduct = 0;
  for (let i = 0; i < vector1.length; i++) {
    dotProduct += vector1[i] * vector2[i];
  }
  
  // Calculate magnitudes
  const magnitude1 = Math.sqrt(vector1.reduce((sum, val) => sum + val * val, 0));
  const magnitude2 = Math.sqrt(vector2.reduce((sum, val) => sum + val * val, 0));
  
  // Handle zero magnitudes
  if (magnitude1 === 0 || magnitude2 === 0) {
    return 0;
  }
  
  // Calculate cosine similarity
  return dotProduct / (magnitude1 * magnitude2);
}

/**
 * Normalize a vector to have values between 0 and 1
 * @param {Array} vector - Vector of numbers
 * @returns {Array} Normalized vector
 */
function normalizeVector(vector) {
  const min = Math.min(...vector);
  const max = Math.max(...vector);
  
  if (max === min) {
    return vector.map(() => 0.5);
  }
  
  return vector.map(val => (val - min) / (max - min));
}

/**
 * Calculate Jaccard similarity between two sets
 * Useful for comparing sets of genres, tags, etc.
 * @param {Set|Array} set1 - First set
 * @param {Set|Array} set2 - Second set
 * @returns {number} Similarity score between 0 and 1
 */
function calculateJaccardSimilarity(set1, set2) {
  const set1Array = Array.isArray(set1) ? set1 : Array.from(set1);
  const set2Array = Array.isArray(set2) ? set2 : Array.from(set2);
  
  // Convert to Sets for efficient operations
  const a = new Set(set1Array);
  const b = new Set(set2Array);
  
  // Calculate intersection size
  const intersection = new Set([...a].filter(x => b.has(x)));
  
  // Calculate union size
  const union = new Set([...a, ...b]);
  
  // Handle empty sets
  if (union.size === 0) {
    return 0;
  }
  
  // Return Jaccard similarity
  return intersection.size / union.size;
}

/**
 * Calculate Pearson correlation coefficient between two vectors
 * @param {Array} vector1 - First vector of numbers
 * @param {Array} vector2 - Second vector of numbers
 * @returns {number} Correlation coefficient between -1 and 1
 */
function calculatePearsonCorrelation(vector1, vector2) {
  if (vector1.length !== vector2.length) {
    throw new Error('Vectors must have the same length');
  }
  
  const n = vector1.length;
  
  // Calculate means
  const mean1 = vector1.reduce((sum, val) => sum + val, 0) / n;
  const mean2 = vector2.reduce((sum, val) => sum + val, 0) / n;
  
  // Calculate numerator and denominators
  let numerator = 0;
  let denom1 = 0;
  let denom2 = 0;
  
  for (let i = 0; i < n; i++) {
    const diff1 = vector1[i] - mean1;
    const diff2 = vector2[i] - mean2;
    
    numerator += diff1 * diff2;
    denom1 += diff1 * diff1;
    denom2 += diff2 * diff2;
  }
  
  // Handle zero denominators
  if (denom1 === 0 || denom2 === 0) {
    return 0;
  }
  
  // Calculate correlation
  return numerator / Math.sqrt(denom1 * denom2);
}

module.exports = {
  calculateSimilarity,
  normalizeVector,
  calculateJaccardSimilarity,
  calculatePearsonCorrelation
};
