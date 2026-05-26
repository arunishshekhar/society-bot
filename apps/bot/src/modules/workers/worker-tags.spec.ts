import { deriveWorkerTags } from './worker-tags';

describe('deriveWorkerTags', () => {
  it('uses category and useful note tokens as tags', () => {
    expect(deriveWorkerTags('AC Repair', 'Fixed geyser wiring quickly')).toEqual([
      'ac',
      'repair',
      'fixed',
      'geyser',
      'wiring',
      'quickly',
    ]);
  });
});
