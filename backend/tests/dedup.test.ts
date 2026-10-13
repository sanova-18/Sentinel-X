import { describe, it, expect } from 'vitest';
import { IncidentService } from '../src/services/incident.service.js';

describe('IncidentService Deduplication Tests', () => {
  it('should correctly flag retransmitted event IDs as duplicates', () => {
    const testEventId = 'evt_test_unique_12345';
    
    // First time seen -> not a duplicate
    const isDup1 = IncidentService.isDuplicateEvent(testEventId);
    expect(isDup1).toBe(false);

    // Second time seen -> duplicate!
    const isDup2 = IncidentService.isDuplicateEvent(testEventId);
    expect(isDup2).toBe(true);
  });
});
