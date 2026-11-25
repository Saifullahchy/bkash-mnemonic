# Business rules and the tests that prove them

Every rule below is checked by an automated test. Run them all with `npm test` in `api/`.
File names are under `tests/`; "journeys" means `integration/businessJourneys.test.ts`.

## 1. Campaign lifecycle

| Rule                                                                                                                                     | Test                                                           |
| ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| A campaign is **draft** until published, **scheduled** before its start, **live** between start and end, **ended** from its end time on. | `unit/core.test.ts` › getCampaignLifecycle                     |
| Start time is included, end time is excluded (live until the last millisecond before the end).                                           | `integration/campaigns.test.ts`, journeys › scheduled campaign |
| A scheduled campaign goes live by itself at its start time — no admin action.                                                            | journeys › scheduled campaign                                  |
| Drafts never appear publicly: not listed, no detail page, nobody can join.                                                               | journeys › drafts                                              |
| "Valid until" shows the last live day (an end of 1 Dec 00:00 shows "30 Nov").                                                            | `unit/core.test.ts` › validUntilLabel                          |
| Publishing needs a banner; a campaign people joined can't be unpublished or deleted.                                                     | `integration/adminCampaigns.test.ts` › publishing lifecycle    |

## 2. What the offer site shows

| Rule                                                                                                                                                            | Test                                                    |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Home page lists campaigns that are published, **Active**, **Show on home page** and live now; ordered by sort order, then soonest end.                          | `integration/campaigns.test.ts`                         |
| **Active off** (paused): gone from the list, detail page, shared links and "Your Sharing Activity"; counts are kept and counting resumes when switched back on. | journeys › pausing a live campaign                      |
| **Show on home page off** (unlisted): not on the home page or in "Your Sharing Activity", but direct and shared links work and opens/shares count.              | journeys › unlisted campaign                            |
| An ended campaign's detail page and old shared links still open and say "ended"; they just stop counting.                                                       | journeys › start to finish, `integration/opens.test.ts` |
| "Your Sharing Activity" shows only live, home-listed campaigns. After a campaign ends it disappears there (its data stays for admins).                          | journeys › start to finish                              |
| "People sharing today" counts participants active since midnight in Bangladesh.                                                                                 | `integration/statsAndContent.test.ts`                   |

## 3. Joining and sharing

| Rule                                                                                                         | Test                                                           |
| ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| Log in with a mobile number only (normalised to 01XXXXXXXXX); the same number is the same person.            | `integration/auth.test.ts`                                     |
| One personal link per person per campaign; asking again returns the same link (even with parallel requests). | `integration/shareLinks.test.ts`, journeys › several campaigns |
| You can only join (get a link) or press Share while the campaign is live.                                    | `integration/shareLinks.test.ts`, journeys › start to finish   |
| A Share/Copy press counts at most once per minute (double clicks don't inflate shares).                      | `integration/shareLinks.test.ts`, journeys › ranking basis     |

## 4. Counting link opens (the core rule)

| Rule                                                                                                                         | Test                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Each different friend who opens a link adds +1 (30 friends → 30).                                                            | `integration/opens.test.ts` › counting                                    |
| The same person never counts twice on one link: refresh, re-open, incognito, cleared cookies, parallel clicks.               | `integration/opens.test.ts` › one link never counts the same person twice |
| Bots and link previews (WhatsApp, Facebook, …) never count.                                                                  | `integration/opens.test.ts` › bots                                        |
| The page must really be shown first: opens need a single-use token from the landing page, 2 s to 10 min old.                 | `integration/opens.test.ts` › open tokens, `unit/security.test.ts`        |
| The owner opening their own link never counts (logged in, logged out, other browser, private window).                        | `integration/opens.test.ts` › self-opens                                  |
| One phone can boost at most **3** different people's links **per campaign** (a 4th doesn't count; another campaign is fine). | `integration/opens.test.ts`, journeys › several campaigns                 |
| At most **5** counted opens per link per network per hour; at most **50** per link per 10 minutes.                           | `integration/opens.test.ts` › count-boosting caps                         |
| Opens stop counting the moment the campaign ends, even with a page opened just before.                                       | journeys › start to finish, `integration/opens.test.ts` › eligibility     |
| **Count link opens off**: the offer still shows and shares still count, but opens never count.                               | journeys › count link opens switched off                                  |
| The same friend can count once on each campaign; each campaign's totals are separate and a person's totals are the sum.      | journeys › several campaigns                                              |
| Every rejected open is kept with its reason (bot, self-open, duplicate, cap, ended…) for the audit trail.                    | journeys › start to finish, `integration/adminParticipants.test.ts`       |

## 5. Ended campaigns — what is kept

| Rule                                                                                                        | Test                       |
| ----------------------------------------------------------------------------------------------------------- | -------------------------- |
| Admin campaign list shows it as **Ended** with its final participants, shares and opens.                    | journeys › start to finish |
| Leaderboard keeps the final ranking.                                                                        | journeys › start to finish |
| Participant detail keeps each link's opens, shares and rejected-open reasons.                               | journeys › start to finish |
| Excel exports (participants, leaderboard) include ended campaigns; the leaderboard sheet is marked "ended". | journeys › start to finish |
| Dashboard stops counting it as live but keeps its totals.                                                   | journeys › start to finish |

## 6. Ranking and winners

| Rule                                                                                             | Test                                                               |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Ranked by link opens (default) or shares (campaign setting); ties go to whoever got there first. | `integration/adminLeaderboard.test.ts`, journeys › ranking basis   |
| Winners can only be announced after the end, once, for the top N; never if nobody scored.        | `integration/adminLeaderboard.test.ts`, journeys › start to finish |
| Announced winners are frozen — later counter changes don't change them.                          | journeys › start to finish                                         |
| Flagged (suspicious) winners need an explicit confirmation.                                      | `integration/adminLeaderboard.test.ts`                             |

## 7. Fraud handling by admins

| Rule                                                                                                                                                                                                        | Test                                                                          |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Disqualifying someone removes them from the leaderboard and winners and stops counting their link; their history is kept; reinstating restores counting.                                                    | `integration/adminParticipants.test.ts`, journeys › disqualified participants |
| Voiding a link's opens sets them to 0 and fixes campaign and participant totals exactly. The voided people can't count again on that link (new friends can), and their phones still use up the 3-links cap. | `integration/adminParticipants.test.ts`                                       |
| Links whose opens come mostly from one network are flagged once.                                                                                                                                            | `integration/adminParticipants.test.ts`, `unit/security.test.ts`              |
| All counters can be rebuilt exactly from the raw records.                                                                                                                                                   | `integration/adminParticipants.test.ts` › counters stay consistent            |

## 8. Admin access, content and exports

| Rule                                                                                                                                                    | Test                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Admin login: secure cookie, lockout after 10 failed attempts, deactivated admins are refused immediately.                                               | `integration/adminAuth.test.ts`                                    |
| Support staff can read but not change campaigns, terms, participants or export personal data.                                                           | `adminCampaigns`, `adminContentExports`, `adminParticipants` tests |
| Terms: every save is a new version; Restore makes an old version current again (no copies); two admins can't overwrite each other; HTML is sanitised.   | `integration/adminContentExports.test.ts` › Terms                  |
| Exports stream .xlsx files, block spreadsheet formula injection, are logged and can be re-downloaded; custom exports combine datasets and pick columns. | `integration/adminContentExports.test.ts` › Excel exports          |
| Scheduled report is sent once per due run with the chosen data.                                                                                         | `integration/adminContentExports.test.ts` › Scheduled report       |

## 9. Platform safety

| Rule                                                                                                 | Test                                                       |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Rate limits per IP/phone/admin, shared across API instances (Redis); still serving if Redis is down. | `integration/app.test.ts`, `integration/hardening.test.ts` |
| CORS only for the configured sites; security headers; safe errors with request ids.                  | `integration/app.test.ts`                                  |
| Production refuses unsafe settings (http origins, shared secrets, disabled rate limits).             | `unit/config.test.ts`                                      |
