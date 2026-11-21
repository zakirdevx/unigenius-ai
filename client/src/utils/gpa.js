// GPA / CGPA maths. Pure functions (no React), so they are easy to test.

// Each row: [minimum percentage, letter grade, grade points]. Rows are checked from the top.
export const SCALES = {
  standard: {
    name: 'University 4.0 scale (A = 85+)',
    rows: [[85, 'A', 4], [80, 'A-', 3.67], [75, 'B+', 3.33], [71, 'B', 3], [68, 'B-', 2.67], [64, 'C+', 2.33], [61, 'C', 2], [58, 'C-', 1.67], [54, 'D+', 1.33], [50, 'D', 1], [0, 'F', 0]],
  },
  simple: {
    name: 'Simple 4.0 scale (A = 90+)',
    rows: [[90, 'A', 4], [80, 'B', 3], [70, 'C', 2], [60, 'D', 1], [0, 'F', 0]],
  },
};

export const MAX_POINTS = 4;

/** A number from an input box, or null if it is empty / not a valid non-negative number. */
export function num(value) {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(String(value).trim());
  return Number.isFinite(n) && n >= 0 ? n : null;
}

const round = (n, digits = 2) => Math.round(n * 10 ** digits) / 10 ** digits;
export const fmt = (n, digits = 2) => (n === null || n === undefined || Number.isNaN(n) ? '–' : round(n, digits).toFixed(digits));

export function gradeFor(percent, scaleId = 'standard') {
  const rows = (SCALES[scaleId] || SCALES.standard).rows;
  const row = rows.find(([min]) => percent >= min) || rows[rows.length - 1];
  return { grade: row[1], points: row[2] };
}

/** The letter grade that is closest to (not above) a GPA, for "you need about a B+". */
export function gradeForPoints(points, scaleId = 'standard') {
  const rows = (SCALES[scaleId] || SCALES.standard).rows;
  const sorted = [...rows].sort((a, b) => a[2] - b[2]);
  const row = sorted.find((r) => r[2] >= points - 1e-9) || sorted[sorted.length - 1];
  return row[1];
}

/**
 * One subject: { credits, obtained, total, expected }.
 * Uses the obtained marks; if they are empty it uses the expected marks and marks the result as estimated.
 */
export function subjectResult(subject, scaleId = 'standard') {
  const credits = num(subject.credits);
  const total = num(subject.total) || 100;
  const obtained = num(subject.obtained);
  const expected = num(subject.expected);
  const marks = obtained !== null ? obtained : expected;
  if (!credits || marks === null) return { credits: credits || 0, counted: false, estimated: false };
  const percent = Math.min(100, (marks / total) * 100);
  const { grade, points } = gradeFor(percent, scaleId);
  return { credits, percent, grade, points, counted: true, estimated: obtained === null };
}

/** Semester GPA. mode "current" = only finished subjects, "projected" = also use expected marks. */
export function semesterGpa(subjects, scaleId = 'standard', mode = 'projected') {
  let credits = 0;
  let points = 0;
  for (const s of subjects) {
    const r = subjectResult(s, scaleId);
    if (!r.counted || (mode === 'current' && r.estimated)) continue;
    credits += r.credits;
    points += r.points * r.credits;
  }
  return { gpa: credits > 0 ? points / credits : null, credits, points };
}

/** Overall CGPA of all semesters, plus an optional earlier record { cgpa, credits }. */
export function overallCgpa(semesters, prior, scaleId = 'standard', mode = 'projected') {
  let credits = 0;
  let points = 0;
  const priorCgpa = num(prior?.cgpa);
  const priorCredits = num(prior?.credits);
  if (priorCgpa !== null && priorCredits) {
    credits += priorCredits;
    points += priorCgpa * priorCredits;
  }
  for (const sem of semesters) {
    const r = semesterGpa(sem.subjects, scaleId, mode);
    credits += r.credits;
    points += r.points;
  }
  return { gpa: credits > 0 ? points / credits : null, credits, points };
}

/** What GPA is needed in the remaining credits to reach the target CGPA. */
export function requiredGpa({ currentCredits, currentPoints, targetCgpa, remainingCredits }) {
  if (!remainingCredits || remainingCredits <= 0) return null;
  const required = (targetCgpa * (currentCredits + remainingCredits) - currentPoints) / remainingCredits;
  const maxCgpa = (currentPoints + MAX_POINTS * remainingCredits) / (currentCredits + remainingCredits);
  const minCgpa = currentPoints / (currentCredits + remainingCredits);
  return {
    required: Math.max(0, required),
    alreadySecured: required <= 0,
    possible: required <= MAX_POINTS + 1e-9,
    maxCgpa,
    minCgpa,
  };
}

/** Grade calculator: items { weight, score } where score is a percentage (empty = not done yet). */
export function gradeCalculator(items, targetPercent) {
  let earned = 0;
  let gradedWeight = 0;
  let totalWeight = 0;
  for (const it of items) {
    const w = num(it.weight) || 0;
    totalWeight += w;
    const score = num(it.score);
    if (score !== null) {
      gradedWeight += w;
      earned += (w * Math.min(100, score)) / 100;
    }
  }
  const remainingWeight = Math.max(0, totalWeight - gradedWeight);
  const needed = remainingWeight > 0 ? ((targetPercent - earned) / remainingWeight) * 100 : null;
  return {
    earned,
    gradedWeight,
    totalWeight,
    remainingWeight,
    currentPercent: gradedWeight > 0 ? (earned / gradedWeight) * 100 : null,
    needed, // average % needed in the remaining work (null when everything is graded)
    possible: needed === null ? earned >= targetPercent : needed <= 100 + 1e-9,
    alreadySecured: needed !== null && needed <= 0,
  };
}

/** Credits finished (failed subjects do not count), progress to the degree and a plain-words standing. */
export function academicProgress(semesters, prior, { totalCredits, perSemester }, scaleId = 'standard') {
  let completed = num(prior?.credits) || 0;
  for (const sem of semesters) {
    for (const s of sem.subjects) {
      const r = subjectResult(s, scaleId);
      if (r.counted && !r.estimated && r.points > 0) completed += r.credits;
    }
  }
  const total = num(totalCredits) || 0;
  const remaining = Math.max(0, total - completed);
  const per = num(perSemester) || 0;
  return {
    completed,
    total,
    remaining,
    percent: total > 0 ? Math.min(100, (completed / total) * 100) : 0,
    semestersLeft: per > 0 ? Math.ceil(remaining / per) : null,
  };
}

export function standing(cgpa) {
  if (cgpa === null || cgpa === undefined) return { label: 'No data yet', tone: 'mute' };
  if (cgpa >= 3.7) return { label: 'Excellent', tone: 'good' };
  if (cgpa >= 3.0) return { label: 'Very good', tone: 'good' };
  if (cgpa >= 2.0) return { label: 'Good standing', tone: 'brand' };
  return { label: 'Needs improvement (below 2.0)', tone: 'bad' };
}
