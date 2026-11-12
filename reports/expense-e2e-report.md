# Expense (bill) E2E Report

- Date: 12/11/2026, 9:50:19 pm IST
- Project: https://qxirmjvbufxxlkogelfj.supabase.co
- Booking used: FY26-OCT-0052
- Vehicle used: PY01VF1255
- Cases: 21 | Passed: 21 | Failed: 0
- Leftover test rows: 0 | Leftover files: 0 | Cleanup errors: 0

| # | Test case | Result | Detail |
|---|---|---|---|
| 1 | type: fuel | ✅ PASS | no=EXP-2611-0001, deleted |
| 2 | type: toll | ✅ PASS | no=EXP-2611-0001, deleted |
| 3 | type: parking | ✅ PASS | no=EXP-2611-0001, deleted |
| 4 | type: bata | ✅ PASS | no=EXP-2611-0001, deleted |
| 5 | type: food | ✅ PASS | no=EXP-2611-0001, deleted |
| 6 | type: maintenance | ✅ PASS | no=EXP-2611-0001, deleted |
| 7 | type: repair | ✅ PASS | no=EXP-2611-0001, deleted |
| 8 | type: permit | ✅ PASS | no=EXP-2611-0001, deleted |
| 9 | type: insurance | ✅ PASS | no=EXP-2611-0001, deleted |
| 10 | type: misc | ✅ PASS | no=EXP-2611-0001, deleted |
| 11 | status: pending -> pending | ✅ PASS | stored=pending, deleted |
| 12 | status: approved -> approved | ✅ PASS | stored=approved, deleted |
| 13 | status: rejected -> rejected | ✅ PASS | stored=rejected, deleted |
| 14 | status: draft -> pending | ✅ PASS | stored=pending, deleted |
| 15 | status: submitted -> pending | ✅ PASS | stored=pending, deleted |
| 16 | flow: approve then reject | ✅ PASS | pending -> approved -> rejected, deleted |
| 17 | receipt: jpg upload + bill | ✅ PASS | uploaded, signed, saved, deleted |
| 18 | receipt: png upload + bill | ✅ PASS | uploaded, signed, saved, deleted |
| 19 | receipt: pdf upload + bill | ✅ PASS | uploaded, signed, saved, deleted |
| 20 | receipt: webp rejected by bucket | ✅ PASS | mime type image/webp is not supported |
| 21 | receipt: >10MB rejected by bucket | ✅ PASS | The object exceeded the maximum allowed size |
