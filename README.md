# Weekly To-Do List

> Draft notes & quick reference. Full documentation will be structured later.

---

## Scheduled Job / Cron Configuration (Web Push Notifications)

For automated dispatch of daily morning briefings and pre-task reminders in production, configure an external scheduler (e.g. cron-job.org, EasyCron, system crontab, or cloud scheduler):

### Endpoint Details
- **URL**: `https://<your-domain>/api/cron/notifications`
- **HTTP Methods**: `GET` or `POST`
- **Authentication**:
  - **Option 1 (Query parameter - recommended for simple webhook callers)**:
    ```
    https://<your-domain>/api/cron/notifications?secret=YOUR_CRON_SECRET
    ```
  - **Option 2 (Authorization header)**:
    ```http
    Authorization: Bearer YOUR_CRON_SECRET
    ```

### Recommended Interval
- **Every 5 minutes** (`*/5 * * * *`).
- *Rationale*: Pre-task reminders fire with configurable lead time (e.g. 15 minutes before scheduled task time). A 5-minute cron frequency ensures accurate alerts while database-level idempotency prevents duplicate notifications.

### Local Testing (CLI)
To run the notification dispatcher locally without an external scheduler:
```bash
npm run notifications:dispatch
# Optional flags:
npm run notifications:dispatch -- --force-morning   # Simulate 08:00 AM morning check
npm run notifications:dispatch -- --dry-run          # Evaluate matching without sending pushes
```

### Required Environment Variables
```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY="your-vapid-public-key"
VAPID_PRIVATE_KEY="your-vapid-private-key"
VAPID_SUBJECT="mailto:notifications@weeklytodo.com"
CRON_SECRET="your-secure-cron-secret-token"
```
*(To generate new VAPID keys run `npm run webpush:keys`)*
