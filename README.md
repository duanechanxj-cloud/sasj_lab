# SASJ Science Lab Management — HOD Prototype v0.6

This folder is a **static GitHub Pages-ready prototype** for demonstrating the intended SASJ Science Lab Management workflow. It does not require Python or a server for the HOD demo.

## Demo login
Choose any role and use password: `demo`

Roles:
- Science Teacher
- Science HOD / SH
- Lab Technician
- System Admin

## v0.6 schedule changes
- Lab Schedule is now calendar-date based rather than showing only abstract Odd/Even day names.
- The app automatically derives Odd/Even Week from a timetable reference Monday.
- Pre-assigned (unconfirmed) sessions are blue. Confirmed sessions are green. Pending requests are translucent orange.
- Unconfirmed pre-assigned sessions are automatically treated as released after 2:00 PM on the previous day. This does not affect approved ad hoc/event bookings.
- The demo includes pre-confirmed sessions and two pending requests, including one conflict example.
- Create Booking and amendment workflows now use actual dates.

## Major v0.6 demo features
- Cleaned SASJ crest and white SASJ-blue brand block
- Role-specific dashboards
- Current P3–P5 pre-assigned Lab 1 / Lab 2 schedule
- Odd/Even and Day/Week schedule views
- Clear schedule legend:
  - Green = confirmed
  - Orange = pre-assigned, confirmation required
  - Translucent orange = pending request
  - `!` = a pending request overlaps an existing booking
- Every schedule booking is clickable
- Pre-assigned session confirmation with activity, sets, apparatus and special requests
- Booking cancellation requires typing `delete` and takes effect immediately
- Teacher date/time amendments create pending approval requests
- HOD/SH, Lab Technician and System Admin can directly change scheduling, but the app blocks any change that would create a confirmed booking conflict
- Create Booking page for ad-hoc sessions and special-event/workshop/PSLE use
- Booking Status is integrated below Lab Schedule with search/status filters
- Pending requests can be submitted against occupied slots for review, but cannot be approved until the clash is resolved
- HOD/SH, Lab Technician and System Admin can approve all request types
- Pending Requests and Inventory Alerts dashboard cards are clickable for privileged roles
- Admin/Lab Technician turnaround-gap warnings show affected Odd/Even day, time and lab
- Inventory search/filtering, demo photos, kit component shortages, phone-camera upload and client-side compression
- Inventory category dropdown: Apparatus, Expendables, Sparkle Kit, Others
- Science teacher roster with class links (maximum two teachers per class)
- Timetable Organizer remains a core workflow for future timetable changes

## Prototype-only / not production yet
- Login uses the demo password and is not secure authentication.
- Data is stored in each browser's local storage, not a shared online database.
- Timetable files selected on GitHub Pages are not actually parsed. The page demonstrates the future online Python workflow.
- Scheduled auto-release and email delivery are not running in this static prototype.
- New photos uploaded during the demo stay in that browser/device; bundled demo photos are visible to everyone.

## Publish to GitHub Pages
1. Upload **the contents of this folder** to the repository root. `index.html` must be at the top level.
2. Commit and push to `main`.
3. GitHub repository → **Settings → Pages**.
4. Under Build and deployment choose **Deploy from a branch**.
5. Select `main` and `/ (root)`.
6. Save and wait for the Pages URL.
7. Test on both a laptop and phone before sharing it with the HOD.

## Suggested HOD demo
1. Log in as **Science Teacher** (`demo`).
2. Open Lab Schedule and explain the colour legend.
3. Click an orange pre-assigned session, enter an activity such as `5.6`, special requests, then confirm it and show that it turns green.
4. Use **Create Booking** to submit an ad-hoc request.
5. Show the intentionally seeded conflicting pending request and the `!` warning on the existing booking.
6. Log in as **Lab Technician** or **HOD/SH**, open the pending request and show that approval is blocked until the existing conflict is resolved.
7. Show Booking Status below the schedule and the Amend Booking search flow.
8. Open Inventory to show demo photos, missing kit components and the Add Inventory Item form.
9. Log in as HOD/SH or System Admin and show the Science Teacher Roster and Timetable Organizer.

## Important
GitHub Pages is being used only for a public prototype. Do not add real passwords, API keys, confidential student data or other sensitive school information.
