# Security Specification & Payload-First TDD (`security_spec.md`)

## 1. Data Invariants
1. **Identity Integrity**: Every mutable operational document (`branches`, `couriers`, `roles`, `staff_users`, `applications`, `sale_submissions`, `postage_trackings`, `system_settings`) must store `ownerUid == request.auth.uid` on creation, and `ownerUid` is immutable on updates.
2. **Verified Auth & Zero Blanket Reads**: No unauthenticated or unverified (`email_verified != true`) request may read or write any document. `allow list` never uses `get()` or `exists()` and always enforces `resource.data.ownerUid == request.auth.uid` or bootstrapped admin email verification.
3. **PII Isolation**: User email is stored in `/users/{userId}/private/{docId}` restricted exclusively to `isOwner(userId)` or `isAdmin()`. Customer PII inside `/applications/{applicationId}` and staff email inside `/staff_users/{staffId}` are readable only by the verified owner or admin.
4. **No Self-Assigned Privilege Escalation**: `/users/{userId}` creates force `roleId` to a valid bounded non-privileged default unless created by an admin, and users cannot create/modify `/admins/{userId}`.
5. **Temporal Integrity**: `createdAt` must equal `request.time` on `create` and remain immutable; `updatedAt` must equal `request.time` on `create` and `update`.
6. **Strict Schema & Size Guards**: Every `create` checks `hasAll()` + `hasOnly()`; every `update` validates `isValidEntity(incoming())` + `affectedKeys().hasOnly()`; every string and list enforces `.size()` bounds; every path ID enforces `^[a-zA-Z0-9_\-]+$` (`<= 128`).

## 2. The "Dirty Dozen" Attack Payloads
1. **Unauthenticated Write**: Creating `/applications/app-evil` with `request.auth == null`. -> **Expected: PERMISSION_DENIED**.
2. **Unverified Email Spoof**: Reading `/applications/app-1` with `email: "khallegacyconstruction@gmail.com"` and `email_verified: false`. -> **Expected: PERMISSION_DENIED**.
3. **Owner UID Spoofing**: Creating `/applications/app-2` with `ownerUid: "someone-else"` while signed in as `uid-attacker`. -> **Expected: PERMISSION_DENIED**.
4. **Shadow / Ghost Field Injection**: Creating `/branches/br-1` with an undeclared extra key `isAdmin: true`. -> **Expected: PERMISSION_DENIED**.
5. **Self-Admin Escalation**: Writing `/admins/uid-attacker` with `{ uid: "uid-attacker", role: "admin" }`. -> **Expected: PERMISSION_DENIED**.
6. **PII Cross-User Read**: User A reading `/users/userB/private/info`. -> **Expected: PERMISSION_DENIED**.
7. **Blanket List Scraping**: User A listing `/applications` without owning those records. -> **Expected: PERMISSION_DENIED** (unless owner or verified admin).
8. **Immutable Field Tampering**: Updating `/applications/app-1` attempting to alter `ownerUid` or `createdAt`. -> **Expected: PERMISSION_DENIED**.
9. **Client Timestamp Forgery**: Creating `/couriers/cur-1` with `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time`. -> **Expected: PERMISSION_DENIED**.
10. **Path ID Poisoning**: Writing `/branches/invalid..path..150chars...` exceeding 128 chars or containing invalid characters. -> **Expected: PERMISSION_DENIED**.
11. **Denial-of-Wallet String Overflow**: Creating `/applications/app-3` with a 500KB `customerName` string. -> **Expected: PERMISSION_DENIED**.
12. **Type Poisoning on Update**: Updating `/postage_trackings/post-1` setting `status: 12345` (number instead of enum string). -> **Expected: PERMISSION_DENIED**.
