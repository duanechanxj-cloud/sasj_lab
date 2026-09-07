# SASJ Science Lab Management — HOD Prototype v0.8

Static GitHub Pages-ready prototype. Demo password: `demo` for all roles.

## New in v0.8
- Transparent SASJ crest so branding works cleanly on different backgrounds.
- **Teacher Deployment** replaces the flat teacher roster and groups Science teachers by P3/P4/P5/P6. A teacher appears in every level they teach.
- Headcount cards and deployment warnings help HOD/SH review Science manpower.
- HOD/SH and System Admin can create special/non-mainstream groups: ad hoc classes, pullout groups, supplementary classes, E2K, workshops and other programmes. These do not enter the mainstream baseline allocation automatically.
- Lab Technician dashboard includes **Today / Tomorrow** operational lab-session views.
- Released pre-assigned slots are surfaced as available opportunities.
- Inventory now includes a phone-friendly **Stocktake Mode** and CSV export.
- Administration includes preloaded **MOE Primary School academic calendars for 2026 and 2027**, with term dates, vacations and scheduled school holidays.
- HOD/Admin can add school-specific **Lab Block-out Dates** for PSLE, maintenance, examinations and events. Block-outs are treated as hard scheduling conflicts.
- Administration includes an audit trail and prototype JSON backup export.

## Existing core functions retained
- Actual-date Lab Schedule with Odd/Even logic.
- Blue pre-assigned sessions, green confirmed bookings, translucent orange pending requests.
- 2:00 PM previous-day release rule for unconfirmed pre-assigned sessions.
- Create/amend/cancel workflows and conflict blocking.
- Booking Status integrated below Lab Schedule.
- Inventory, photos, kit-component shortages and mobile camera workflow.
- Timetable Organizer remains a core future production function.

## Prototype limitations
The site remains a browser-local demonstration: demo authentication, no shared Supabase database yet, no production timetable parser execution, and no scheduled cloud jobs.

## Publish
Upload the contents of this folder to the root of the existing GitHub Pages repository and push to `main`. The Pages URL remains unchanged.

## v0.8 addition
- HOD/SH and System Admin can create new Science teacher records directly in Teacher Deployment
- Teacher creation supports name, optional school email, active/inactive status, levels, mainstream class links and deployment notes
