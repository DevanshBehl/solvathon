// ============================================
// Hostel Configuration
// ============================================

/** Valid hostel identifiers */
export type HostelId = 'A' | 'C' | 'D1' | 'D2';

/** Hostel configuration entry */
export interface HostelConfig {
  name: string;
  totalFloors: number;
  color: string;
  description: string;
}

/** Hardcoded hostel configuration — source of truth */
export const HOSTEL_CONFIG: Record<HostelId, HostelConfig> = {
  A: {
    name: 'Hostel A',
    totalFloors: 15,
    color: '#3b82f6', // Accent blue
    description: 'Main academic hostel with 15 floors',
  },
  C: {
    name: 'Hostel C',
    totalFloors: 16,
    color: '#22c55e', // Online green
    description: 'Central hostel complex with 16 floors',
  },
  D1: {
    name: 'Hostel D1',
    totalFloors: 16,
    color: '#f59e0b', // Warning amber
    description: 'D-block tower 1 with 16 floors',
  },
  D2: {
    name: 'Hostel D2',
    totalFloors: 16,
    color: '#a855f7', // Purple accent
    description: 'D-block tower 2 with 16 floors',
  },
};

/** All hostel IDs */
export const ALL_HOSTEL_IDS: HostelId[] = ['A', 'C', 'D1', 'D2'];

/** Validate if a string is a valid HostelId */
export function isValidHostelId(id: string): id is HostelId {
  return ALL_HOSTEL_IDS.includes(id as HostelId);
}
