# E2E Test Infra: Hubqa

## Test Philosophy
- Opaque-box, requirement-driven. No dependency on implementation internals.
- Methodology: Category-Partition + Boundary Value Analysis (BVA) + Pairwise Combinatorial Testing + Real-World Workload Testing.

## Feature Inventory
| # | Feature | Source (requirement) | Tier 1 (Coverage) | Tier 2 (Boundary) | Tier 3 (Pairwise) | Tier 4 (Workload) |
|---|---------|---------------------|:----------------:|:-----------------:|:-----------------:|:-----------------:|
| 1 | Auth & Security | R1 (Security Hardening), R3 | 5 cases | 5 cases | ✓ | ✓ |
| 2 | Password Reset & Profile | R3 (Complete & Functional API), R5 | 5 cases | 5 cases | ✓ | |
| 3 | Channel Connections | R5 (Competitive Feature Set) | 5 cases | 5 cases | ✓ | ✓ |
| 4 | Webhook Verification | R1, R5 | 5 cases | 5 cases | ✓ | ✓ |
| 5 | WhatsApp Webhook | R5 | 5 cases | 5 cases | ✓ | |
| 6 | Comment-to-DM Automation | R5 | 5 cases | 5 cases | ✓ | ✓ |
| 7 | Interactive Inbox | R3, R4 | 5 cases | 5 cases | ✓ | ✓ |
| 8 | Subscriber Management | R3 | 5 cases | 5 cases | ✓ | ✓ |
| 9 | Broadcasting | R3, R5 | 5 cases | 5 cases | ✓ | |
| 10| Team Management | R5 | 5 cases | 5 cases | ✓ | |
| 11| Dashboard Analytics | R3, R4 | 5 cases | 5 cases | ✓ | ✓ |
| 12| Health Check & System | R3, R1 | 5 cases | 5 cases | ✓ | |

## Test Architecture
- **Test Runner**: Jest + Supertest running in the context of the NestJS API application.
- **Test Invocation**: `npm run test:e2e` inside `backend/`.
- **Mocks & Hooks**:
  - Facebook Graph API calls are intercepted/mocked dynamically.
  - SMTP/Email sending for password resets is mocked.
  - Rate limiting is verified via rapid concurrent requests.
- **Directory Layout**:
  - `backend/test/` contains all `.e2e-spec.ts` test files.

## Test Case Tiers

### Tier 1 - Feature Coverage (Happy Paths)
#### Feature 1: Auth & Security
1. Register user successfully.
2. Login with correct credentials.
3. Access dashboard endpoints with valid JWT token.
4. Access public endpoints without JWT token.
5. Check that CORS headers are present on valid origin.

#### Feature 2: Password Reset & Profile
6. Request password reset token with valid email.
7. Reset password with valid token.
8. Login with the new password.
9. Fetch profile of logged-in user.
10. Update profile name and details.

#### Feature 3: Channel Connections
11. Facebook OAuth callback completes successfully.
12. Fetch list of connected pages.
13. Save channel settings.
14. Delete a connected page/channel.
15. Check channel details retrieval.

#### Feature 4: Webhook Verification
16. Process facebook webhook verification request (GET validation).
17. Process facebook message event webhook (POST valid signature).
18. Process facebook comment event webhook (POST valid signature).
19. Verify webhook deduplication of duplicate request ID.
20. Check webhook processing logging.

#### Feature 5: WhatsApp Webhook
21. Process WhatsApp verification request (GET).
22. Process WhatsApp text message event webhook (POST).
23. Process WhatsApp media event webhook (POST).
24. Process WhatsApp message status update webhook (POST).
25. Verify WhatsApp subscriber creation from webhook message.

#### Feature 6: Comment-to-DM Automation
26. Create a Comment-to-DM auto-reply rule.
27. Verify comment webhook triggers comment rule matching.
28. Verify rule execution triggers Facebook Graph API mock to post comment public reply.
29. Verify rule execution triggers Facebook Graph API mock to send comment private DM.
30. Retrieve execution logs for Comment-to-DM rule.

#### Feature 7: Interactive Inbox
31. Retrieve active inbox conversation list.
32. Retrieve messages thread for a specific conversation.
33. Send message to subscriber in conversation (calls Graph API mock).
34. Mark conversation as read.
35. Filter inbox conversations by channel.

#### Feature 8: Subscriber Management
36. Create new subscriber manually.
37. Fetch subscriber details by ID.
38. Update subscriber tags and notes.
39. Delete subscriber.
40. Search/filter subscribers.

#### Feature 9: Broadcasting
41. Create a broadcast draft.
42. Schedule broadcast to be sent.
43. Cancel a scheduled broadcast.
44. Execute broadcast immediately to target segment.
45. View broadcast execution metrics.

#### Feature 10: Team Management
46. Invite a team member by email.
47. Accept team invitation and register.
48. Retrieve list of team members.
49. Update team member role.
50. Revoke/delete team member.

#### Feature 11: Dashboard Analytics
51. Fetch KPI metrics (conversations, subscribers, response rate).
52. Fetch daily analytics with default date range.
53. Filter daily analytics by custom date range.
54. Fetch channel distribution statistics.
55. Fetch rules execution success/failure rate.

#### Feature 12: Health Check & System
56. GET `/health` returns status ok.
57. Health check returns status of database connection.
58. Fetch API documentation or config limits.
59. Request rate limiting config options.
60. Verify logout invalidates backend session/token representation.

---

### Tier 2 - Boundary & Corner Cases (Validation & Errors)
#### Feature 1: Auth & Security
61. Register with duplicate email returns 400.
62. Register with short password returns 400.
63. Login with incorrect password returns 401.
64. Access dashboard `/dashboard/*` without JWT token returns 401.
65. Rate limiting: 16 login attempts within 10 seconds returns 429.

#### Feature 2: Password Reset & Profile
66. Request password reset for non-existent email returns 404.
67. Reset password with expired token returns 400.
68. Reset password with malformed token returns 400.
69. Update profile with invalid field types returns 400.
70. Request reset link repeatedly limits token creation rate.

#### Feature 3: Channel Connections
71. Connect channel with empty Page ID returns 400.
72. Connect channel with expired Facebook access token returns 400.
73. Connect already connected Facebook Page returns 409/400.
74. Attempt to edit non-existent channel returns 404.
75. Retrieve page details with malformed token handles error gracefully.

#### Feature 4: Webhook Verification
76. GET webhook verification with invalid verify token returns 403.
77. POST facebook webhook without signature header returns 401.
78. POST facebook webhook with invalid signature returns 401.
79. POST webhook with empty payload returns 400.
80. POST webhook with extremely large payload rejects or returns 400.

#### Feature 5: WhatsApp Webhook
81. GET WhatsApp verification with invalid verify token returns 403.
82. POST WhatsApp webhook with malformed JSON structure returns 400.
83. POST WhatsApp webhook event from unsupported message type ignores event gracefully.
84. POST WhatsApp webhook event with empty status update ignores event.
85. Webhook receiver handles network timeout to db database.

#### Feature 6: Comment-to-DM Automation
86. Create rule with empty trigger keyword returns 400.
87. Create rule with extremely long public reply text rejects.
88. Comment webhook contains keyword with different casing / whitespace (verify fuzzy matching).
89. Comment webhook from page's own comment doesn't trigger loop.
90. Attempt to trigger rule with deactivated channel fails.

#### Feature 7: Inbox & Messaging
91. Send message to invalid subscriber ID returns 400.
92. Send message with empty content returns 400.
93. Send message when channel token has been revoked handles error and marks channel invalid.
94. Fetch messages thread of non-existent conversation returns 404.
95. Paginate conversation list beyond maximum range returns empty array.

#### Feature 8: Subscriber Management
96. Create subscriber with malformed email or phone number returns 400.
97. Update non-existent subscriber returns 404.
98. Attempt to delete non-existent subscriber returns 404.
99. Search subscriber with empty search string returns all.
100. Add duplicate tags to subscriber doesn't duplicate tag entries.

#### Feature 9: Broadcasting
101. Schedule broadcast in the past returns 400.
102. Create broadcast with invalid segment target returns 400.
103. Create broadcast with empty message content returns 400.
104. Cancel already sent broadcast returns 400.
105. Fetch non-existent broadcast returns 404.

#### Feature 10: Team Management
106. Invite already invited or registered team member returns 400/409.
107. Accept invitation with invalid token returns 400.
108. Update team member to invalid role returns 400.
109. Owner attempts to downgrade their own role returns 400.
110. Non-owner team member attempts to invite others returns 403.

#### Feature 11: Dashboard Analytics
111. Query analytics with start date after end date returns 400.
112. Query analytics with future dates handles gracefully.
113. Query analytics with malformed date strings returns 400.
114. Fetch analytics for a channel the user does not own returns 403.
115. Zero data state: dashboard KPIs return 0s instead of crashing.

#### Feature 12: Health Check & System
116. CORS: Check that CORS rejects origin not in allowed list.
117. Rate limiting: Hit /health 100 times in 1 second returns 429.
118. Access db status when db connection is closed returns 503.
119. JWT validation fails with signature mismatch.
120. Check headers contain standard secure headers (X-Content-Type-Options, etc.).

---

### Tier 3 - Cross-Feature Combinations (Pairwise Coverage)
121. **Auth + Channels**: User registers, logs in, connects a channel, verifies channel persists, then logs out.
122. **Auth + Rules + Inbox**: Login, create a Comment-to-DM rule, log out, receive webhook comment, rule triggers, user logs back in, and verifies a new conversation thread is visible in their inbox.
123. **Channels + Rules + Webhooks**: Connect Facebook Page, create a rule for that Page, send facebook comment webhook event for that Page, verify rule execution, then delete the channel and send webhook again to verify rule no longer runs.
124. **Webhooks + Subscribers + Inbox**: Webhook message comes in for new user, verify new subscriber created, verify new thread created in inbox with the message content.
125. **Broadcasts + Subscribers + Inbox**: Create subscriber, create campaign/broadcast targeting their segment, execute broadcast, verify subscriber has the broadcast message in their inbox thread.
126. **Team + Channels**: Owner connects channel, invites member as agent, agent logs in and verifies they can view the channel, but cannot delete it (403).
127. **Rules + Analytics**: Trigger comment webhook which matches rule, verify rule execution count incremented in dashboard analytics.
128. **Auth + Password Reset + Inbox**: Trigger password reset, reset password, login, view inbox and send message to verify session is valid.
129. **Subscribers + Rules + Broadcasts**: Create subscriber with tag 'promo', execute broadcast targeting 'promo', verify send succeeds, then trigger keyword webhook to add tag 'vip' and run a VIP-only rule.
130. **CORS + Auth + Security**: Send login request from invalid origin (rejected by CORS), then from valid origin (accepted), and verify token cannot be used from unauthorized origin.

---

### Tier 4 - Real-World Application Scenarios
131. **E2E SaaS Trial Workflow**: A new business owner registers for Hubqa, connects their Facebook Page, invites their support agent, creates an "Auto-Coupon" Comment-to-DM rule for a promotion, and verifies the system works.
132. **High-Volume Campaign Execution**: Create 100 subscribers, split them into tags "vip" and "lead", schedule a broadcast for "vip", trigger immediate broadcast, check delivery status, and verify analytics update correctly.
133. **Customer Support Escalation**: Customer comments on page -> Comment-to-DM triggers and sends coupon -> Customer responds in private message asking a question -> Support agent logs in, opens inbox, views thread, replies to customer, and marks thread as resolved.
134. **Security Compromise Recovery**: Account owner detects unauthorized access -> Requests password reset link -> Resets password (invalidating all active JWT tokens/sessions) -> Logs in and updates profile settings.
135. **Multi-Channel Auto-Reply Campaign**: Business runs Facebook and WhatsApp simultaneously. Configures rule "order_now". Send facebook comment webhook -> gets DM. Send WhatsApp message "order_now" -> gets WhatsApp auto-reply message. Check analytics to verify counts for both platforms.

## Coverage Thresholds
- Tier 1: 60 test cases
- Tier 2: 60 test cases
- Tier 3: 10 test cases
- Tier 4: 5 test cases
- **Total: 135 test cases**
