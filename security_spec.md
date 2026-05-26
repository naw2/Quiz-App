# Firebase Security Specification

## Data Invariants
1. A Student profile (`students/{studentId}`) can only be created by the authenticated user whose `uid` equals `{studentId}`.
2. A Student profile's `email` must match the user's authenticated auth token email, and email verification must be valid (`email_verified == true`).
3. Only the student themselves can read or update their own profile.
4. XP edits can only increase or update XP, level, and maxStreak, preventing self-assigned roles or administrative fields.
5. Quiz attempts (`quiz_attempts/{attemptId}`) are immutable (cannot be modified or deleted once submitted).
6. A `quiz_attempts/{attemptId}` document's `studentId` must strictly match the authenticated user's `uid`.
7. Timestamps (`createdAt`, `completedAt`) must strictly match the server time (`request.time`).

---

## The "Dirty Dozen" Malicious Payloads
These payloads must be rejected with `PERMISSION_DENIED` by the Firestore Security Rules.

1. **Identity Spoofing (Student Profile Creation)**: Attempting to create a profile for another user ID.
   - *Payload*: `students/victim_uid` with `{ id: "victim_uid", name: "Attacker", email: "attacker@example.com", ... }`
2. **Email Spoofing (Student Profile Creation)**: Attempting to use a verified admin's email or an unverified email to register as a student.
   - *Payload*: `{ email: "victim_vetted@example.com", ... }`
3. **Ghost Fields Injection**: Attempting to inject a field like `isAdmin: true` into the student profile.
   - *Payload*: `{ id: "user_uid", name: "Student", email: "test@example.com", isAdmin: true, ... }`
4. **XSS/Poisoning Name Attack**: Attempting to register with an extremely long or malicious characters name.
   - *Payload*: `{ name: "A" * 10000, ... }`
5. **Unauthorized Multi-Profile Read**: Attempting to read overall student list without direct ownership.
   - *Query*: `getDocs(collection(db, 'students'))` with no filter.
6. **XP Privilege Escalation (Self-Setting XP)**: Setting arbitrary high XP on profile update.
   - *Payload*: `{ xp: 9999999, level: 99, ... }`
7. **Negative XP / Decrementing XP Attack**: Decrementing XP to break invariants.
   - *Payload*: `{ xp: -50, ... }`
8. **Quiz Attempt Hijack**: Creating a quiz attempt with a victim's user ID.
   - *Payload*: `quiz_attempts/hacked_attempt` with `{ studentId: "victim_uid", ... }`
9. **Quiz Attempt Post-Complete Modification**: Modifying accuracy, score, or XP after completing a quiz.
   - *Payload*: `updateDoc(doc(db, 'quiz_attempts', 'my_attempt'), { score: 10 })`
10. **Quiz Attempt Deletion**: Deleting completed quizzes to clear historical trails.
    - *Action*: `deleteDoc(doc(db, 'quiz_attempts', 'my_attempt'))`
11. **Spoofed Creation Timestamp**: Utilizing a client-side timestamp for `createdAt`.
    - *Payload*: `{ createdAt: "2020-01-01T00:00:00Z" }`
12. **Denial of Wallet Long ID Poisoning**: Registering a document with a massive garbage-string ID.
    - *Action*: Creating `students/garbage_id_of_length_2048`

---

## Test Verification Setup
We will test these using a mock runner or in our live verification suites.
Our security rules must safely block each of these vectors!
