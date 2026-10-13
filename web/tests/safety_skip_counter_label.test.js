import test from 'node:test';
import assert from 'node:assert/strict';
import { formatRecentWindow, safetySkipCounterLabel } from '../modules/utils.js';

const NOW = Date.parse('2026-10-12T11:30:00.000Z');
const HOUR = 3600 * 1000;
const ago = (ms) => new Date(NOW - ms).toISOString();

test('formatRecentWindow prints the span it was given, never a wider one', () => {
    assert.equal(formatRecentWindow(0), '');
    assert.equal(formatRecentWindow(-5), '');
    assert.equal(formatRecentWindow(Number.NaN), '');
    assert.equal(formatRecentWindow(40 * 60 * 1000), '40 min');
    assert.equal(formatRecentWindow(77 * 60 * 1000), '1h 17m');
    assert.equal(formatRecentWindow(2 * HOUR), '2h');
    assert.equal(formatRecentWindow(25 * HOUR), '25h');
});

test('a tail that reaches back a full day is labelled as 24h', () => {
    const entries = [
        { type: 'safety_mode_skip', ts: ago(2 * HOUR) },
        { type: 'other', ts: ago(30 * HOUR) },
    ];
    assert.equal(
        safetySkipCounterLabel(entries, NOW),
        '1 safety check(s) waved through in the last 24h (audited; full window covered).',
    );
});

test('a zero count over a full day is a fact, not a missing reading', () => {
    const entries = [
        { type: 'other', ts: ago(1 * HOUR) },
        { type: 'other', ts: ago(30 * HOUR) },
    ];
    assert.equal(
        safetySkipCounterLabel(entries, NOW),
        'No safety checks waved through in the last 24h (audited; full window covered).',
    );
});

test('a short tail is labelled by the window it covered, not by 24h', () => {
    // The reported case: a 2000-row tail covering 77 minutes held 42 of the day's
    // ~1250 events. Calling that "the last 24h" undercounts 30-fold.
    const entries = [
        { type: 'safety_mode_skip', ts: ago(10 * 60 * 1000) },
        { type: 'other', ts: ago(77 * 60 * 1000) },
    ];
    assert.equal(
        safetySkipCounterLabel(entries, NOW),
        '1 safety check(s) waved through in the last 1h 17m (audited; recent events window '
        + '— a full 24h was not covered, so the 24h count may be higher).',
    );
});

test('a short tail with no skips says which window came up empty', () => {
    const entries = [
        { type: 'other', ts: ago(5 * 60 * 1000) },
        { type: 'other', ts: ago(70 * 60 * 1000) },
    ];
    assert.equal(
        safetySkipCounterLabel(entries, NOW),
        'No safety checks waved through in the last 1h 10m (recent events window '
        + '— a full 24h was not covered).',
    );
});

test('a skip older than 24h does not count even when the tail covers it', () => {
    const entries = [
        { type: 'safety_mode_skip', ts: ago(26 * HOUR) },
        { type: 'other', ts: ago(30 * HOUR) },
    ];
    assert.equal(
        safetySkipCounterLabel(entries, NOW),
        'No safety checks waved through in the last 24h (audited; full window covered).',
    );
});

test('an empty or unreadable tail admits it instead of printing a zero', () => {
    assert.equal(
        safetySkipCounterLabel([], NOW),
        'No recent events to audit, so no safety-check count is available.',
    );
    assert.equal(
        safetySkipCounterLabel(null, NOW),
        'No recent events to audit, so no safety-check count is available.',
    );
    assert.equal(
        safetySkipCounterLabel([{ type: 'other', ts: 'not-a-date' }], NOW),
        'No recent event carries a readable timestamp, so no safety-check count is available.',
    );
});

test('rows with no timestamp still let the readable ones define the window', () => {
    const entries = [
        { type: 'safety_mode_skip', ts: '' },
        { type: 'safety_mode_skip', ts: ago(3 * 60 * 1000) },
        { type: 'other', ts: ago(45 * 60 * 1000) },
    ];
    assert.equal(
        safetySkipCounterLabel(entries, NOW),
        '1 safety check(s) waved through in the last 45 min (audited; recent events window '
        + '— a full 24h was not covered, so the 24h count may be higher).',
    );
});
