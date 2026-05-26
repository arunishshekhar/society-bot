import { buildServiceMetadata, readServiceMetadata } from './service-metadata';

describe('service metadata helpers', () => {
  it('builds normalized metadata for storage', () => {
    expect(buildServiceMetadata(' Mon-Fri, 12-2pm ', 'phone')).toEqual({
      timing: 'Mon-Fri, 12-2pm',
      contactPreference: 'phone',
    });
  });

  it('defaults malformed metadata safely', () => {
    expect(readServiceMetadata(null)).toEqual({ contactPreference: 'telegram' });
    expect(readServiceMetadata({ contactPreference: 'phone', timing: 'Evenings' })).toEqual({
      contactPreference: 'phone',
      timing: 'Evenings',
    });
  });
});
