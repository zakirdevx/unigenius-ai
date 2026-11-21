// Tests for the GPA calculator maths (it lives in the client folder but has no React in it).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  academicProgress, gradeCalculator, gradeFor, gradeForPoints, overallCgpa, requiredGpa, semesterGpa, standing, subjectResult,
} from '../../client/src/utils/gpa.js';

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} !== ${b}`);

test('percentages map to letter grades and points', () => {
  assert.deepEqual(gradeFor(92), { grade: 'A', points: 4 });
  assert.deepEqual(gradeFor(84.9), { grade: 'A-', points: 3.67 });
  assert.deepEqual(gradeFor(49), { grade: 'F', points: 0 });
  assert.deepEqual(gradeFor(85, 'simple'), { grade: 'B', points: 3 });
  assert.equal(gradeForPoints(3.5), 'A-');
});

test('a subject uses obtained marks, else expected marks (estimated)', () => {
  const done = subjectResult({ credits: '3', obtained: '45', total: '50' });
  assert.equal(done.grade, 'A');
  assert.equal(done.estimated, false);
  const planned = subjectResult({ credits: '3', obtained: '', expected: '75' });
  assert.equal(planned.grade, 'B+');
  assert.equal(planned.estimated, true);
  assert.equal(subjectResult({ credits: '3', obtained: '', expected: '' }).counted, false);
  assert.equal(subjectResult({ credits: '', obtained: '90' }).counted, false);
});

test('semester GPA is credit-weighted, and "current" ignores estimated subjects', () => {
  const subjects = [
    { credits: '3', obtained: '90' }, // A = 4.0
    { credits: '3', obtained: '72' }, // B = 3.0
    { credits: '3', obtained: '', expected: '50' }, // D = 1.0 (estimated)
  ];
  near(semesterGpa(subjects, 'standard', 'current').gpa, 3.5);
  near(semesterGpa(subjects, 'standard', 'projected').gpa, (12 + 9 + 3) / 9);
  assert.equal(semesterGpa([], 'standard').gpa, null);
});

test('overall CGPA combines semesters and an earlier record', () => {
  const sems = [{ subjects: [{ credits: '3', obtained: '90' }] }, { subjects: [{ credits: '3', obtained: '72' }] }];
  near(overallCgpa(sems, null).gpa, 3.5);
  const withPrior = overallCgpa(sems, { cgpa: '3.0', credits: '6' });
  near(withPrior.gpa, (3 * 6 + 12 + 9) / 12);
  assert.equal(withPrior.credits, 12);
});

test('required GPA for a target CGPA', () => {
  const r = requiredGpa({ currentCredits: 60, currentPoints: 180, targetCgpa: 3.2, remainingCredits: 30 });
  near(r.required, 3.6);
  assert.equal(r.possible, true);
  near(r.maxCgpa, (180 + 120) / 90);
  const no = requiredGpa({ currentCredits: 60, currentPoints: 180, targetCgpa: 3.9, remainingCredits: 15 });
  assert.equal(no.possible, false);
  const done = requiredGpa({ currentCredits: 60, currentPoints: 300, targetCgpa: 3.0, remainingCredits: 30 });
  assert.equal(done.alreadySecured, true);
  assert.equal(requiredGpa({ currentCredits: 1, currentPoints: 1, targetCgpa: 3, remainingCredits: 0 }), null);
});

test('grade calculator finds the score needed in the remaining work', () => {
  const items = [
    { weight: '10', score: '80' }, // quizzes: 8
    { weight: '30', score: '70' }, // midterm: 21
    { weight: '60', score: '' }, // final: not done
  ];
  const r = gradeCalculator(items, 85);
  near(r.earned, 29);
  near(r.remainingWeight, 60);
  near(r.needed, ((85 - 29) / 60) * 100);
  assert.equal(r.possible, true);
  assert.equal(gradeCalculator(items, 95).possible, false); // needs 110% -> impossible
  const all = gradeCalculator([{ weight: '100', score: '90' }], 85);
  assert.equal(all.needed, null);
  assert.equal(all.possible, true);
});

test('academic progress counts only finished, passed credits', () => {
  const sems = [{ subjects: [{ credits: '3', obtained: '90' }, { credits: '3', obtained: '30' }, { credits: '3', obtained: '', expected: '80' }] }];
  const p = academicProgress(sems, { credits: '30' }, { totalCredits: '130', perSemester: '18' });
  assert.equal(p.completed, 33);
  assert.equal(p.remaining, 97);
  assert.equal(p.semestersLeft, 6);
  assert.equal(standing(3.8).label, 'Excellent');
  assert.equal(standing(1.5).tone, 'bad');
  assert.equal(standing(null).label, 'No data yet');
});
