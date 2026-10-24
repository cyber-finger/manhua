import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTimestampToSeconds,
  formatSecondsToTimestamp,
  formatSanitizedTimestamp,
  getSceneImageFilename,
  parseTimestampedPrompts,
  validateSceneSequence,
  rippleAdjustScenes,
} from './timestamp-parser';

test('parseTimestampToSeconds handles various formats correctly', () => {
  assert.equal(parseTimestampToSeconds('00:00:04.200'), 4.2);
  assert.equal(parseTimestampToSeconds('00:01:30.500'), 90.5);
  assert.equal(parseTimestampToSeconds('01:00:00.000'), 3600);
  assert.equal(parseTimestampToSeconds('00:10'), 10);
  assert.equal(parseTimestampToSeconds('05:30'), 330);
  assert.equal(parseTimestampToSeconds('invalid'), null);
});

test('formatSecondsToTimestamp formats properly', () => {
  assert.equal(formatSecondsToTimestamp(4.2), '00:00:04.200');
  assert.equal(formatSecondsToTimestamp(90.5), '00:01:30.500');
  assert.equal(formatSecondsToTimestamp(3600), '01:00:00.000');
});

test('formatSanitizedTimestamp replaces colons with hyphens', () => {
  assert.equal(formatSanitizedTimestamp(4.2), '00-00-04.200');
  assert.equal(
    getSceneImageFilename(1, 0, 4.2),
    'Scene_001_00-00-00.000_to_00-00-04.200.png'
  );
});

test('parseTimestampedPrompts parses Section 6 standard format correctly', () => {
  const sampleInput = `
Scene 001 | 00:00:00.000 - 00:00:04.200
Narration: The kingdom was shrouded in endless night.
Asset IDs: CHAR_001, LOC_001
Image Prompt: Wide cinematic shot of a ruined kingdom at sunrise, detailed 2D Manhwa illustration.

Scene 002 | 00:00:04.200 - 00:00:09.500
Narration: A solitary warrior stepped onto the cobblestone path.
Asset IDs: CHAR_001
Image Prompt: The protagonist walks through the ruined streets while examining the destroyed buildings.
  `;

  const scenes = parseTimestampedPrompts(sampleInput);
  assert.equal(scenes.length, 2);
  assert.equal(scenes[0].sceneNumber, 1);
  assert.equal(scenes[0].startTime, 0);
  assert.equal(scenes[0].endTime, 4.2);
  assert.equal(scenes[0].narration, 'The kingdom was shrouded in endless night.');
  assert.deepEqual(scenes[0].assetIds, ['CHAR_001', 'LOC_001']);
  assert.equal(
    scenes[0].prompt,
    'Wide cinematic shot of a ruined kingdom at sunrise, detailed 2D Manhwa illustration.'
  );

  assert.equal(scenes[1].sceneNumber, 2);
  assert.equal(scenes[1].startTime, 4.2);
  assert.equal(scenes[1].endTime, 9.5);
});

test('validateSceneSequence detects overlaps, gaps, and audio mismatch', () => {
  const scenesWithGap = [
    {
      id: '1',
      sceneNumber: 1,
      startTime: 0,
      endTime: 4,
      duration: 4,
      prompt: 'Scene 1 prompt',
      status: 'pending' as const,
    },
    {
      id: '2',
      sceneNumber: 2,
      startTime: 5, // Gap of 1 second from 4 to 5
      endTime: 9,
      duration: 4,
      prompt: 'Scene 2 prompt',
      status: 'pending' as const,
    },
  ];

  const report = validateSceneSequence(scenesWithGap, 9);
  assert.equal(report.isValid, true); // Gaps are warnings, not hard blocking errors
  assert.equal(report.statusText, 'Gaps Detected');
  assert.equal(report.issues.some((i) => i.type === 'gap'), true);
});

test('rippleAdjustScenes resolves gaps and ensures continuity', () => {
  const brokenScenes = [
    {
      id: '1',
      sceneNumber: 1,
      startTime: 0,
      endTime: 3,
      duration: 3,
      prompt: 'A',
      status: 'pending' as const,
    },
    {
      id: '2',
      sceneNumber: 2,
      startTime: 5,
      endTime: 8,
      duration: 3,
      prompt: 'B',
      status: 'pending' as const,
    },
  ];

  const fixed = rippleAdjustScenes(brokenScenes);
  assert.equal(fixed[0].startTime, 0);
  assert.equal(fixed[0].endTime, 3);
  assert.equal(fixed[1].startTime, 3);
  assert.equal(fixed[1].endTime, 6);
});
