// Phase 0 Security Rules Verification Spec (Dirty Dozen Assertions)
// Note: Designed for verification against Firebase Rules Emulator when available.
export interface SecurityTestCase {
  id: number;
  name: string;
  collection: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  expected: 'PERMISSION_DENIED';
  description: string;
}

export const DIRTY_DOZEN_SECURITY_TESTS: SecurityTestCase[] = [
  {
    id: 1,
    name: 'Unauthenticated Write',
    collection: 'applications',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    description: 'Reject writes when request.auth is null.',
  },
  {
    id: 2,
    name: 'Unverified Email Admin Spoof',
    collection: 'applications',
    operation: 'get',
    expected: 'PERMISSION_DENIED',
    description: 'Reject access when email_verified is false even if email matches admin.',
  },
  {
    id: 3,
    name: 'Owner UID Spoofing',
    collection: 'applications',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    description: 'Reject create when incoming ownerUid differs from request.auth.uid.',
  },
  {
    id: 4,
    name: 'Shadow Ghost Field Injection',
    collection: 'branches',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    description: 'Reject create containing undeclared fields via keys().hasOnly().',
  },
  {
    id: 5,
    name: 'Self-Admin Escalation',
    collection: 'admins',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    description: 'Reject all client writes to /admins/{userId}.',
  },
  {
    id: 6,
    name: 'Cross-User Private PII Read',
    collection: 'users/other/private',
    operation: 'get',
    expected: 'PERMISSION_DENIED',
    description: 'Reject reading another user private PII document.',
  },
  {
    id: 7,
    name: 'Blanket List Scraping',
    collection: 'applications',
    operation: 'list',
    expected: 'PERMISSION_DENIED',
    description: 'Reject unfiltered list queries from non-admin users.',
  },
  {
    id: 8,
    name: 'Immutable Owner/CreatedAt Tampering',
    collection: 'applications',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    description: 'Reject updates attempting to mutate ownerUid or createdAt.',
  },
  {
    id: 9,
    name: 'Client Timestamp Forgery',
    collection: 'couriers',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    description: 'Reject create when createdAt/updatedAt do not equal request.time.',
  },
  {
    id: 10,
    name: 'Path ID Poisoning',
    collection: 'branches',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    description: 'Reject document IDs failing ^[a-zA-Z0-9_\\-]+$ or exceeding 128 chars.',
  },
  {
    id: 11,
    name: 'Denial-of-Wallet String Overflow',
    collection: 'applications',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    description: 'Reject strings exceeding strict .size() limits.',
  },
  {
    id: 12,
    name: 'Value Type Poisoning on Update',
    collection: 'postage_trackings',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    description: 'Reject updates with wrong field types via isValidPostageTracking(incoming()).',
  },
];
