# Exam Portal TODO

## Project Setup
- [ ] Supabase project create
- [ ] Database schema run (users, classes, exams, results, banners, sessions)
- [ ] Storage buckets (exam-banners, result-pdfs, exam-pdfs)
- [ ] Admin user seed

## Public Pages (No Login)
- [ ] Home
- [ ] Services
- [ ] About Us
- [ ] Contact Us
- [ ] Result search (roll no + optional DOB/mobile)
- [ ] Result view + PDF download
- [ ] Result list + Excel/PDF download
- [ ] Upcoming exam dates page + PDF download

## Auth (Student/Staff/Admin)
- [ ] Login page
- [ ] Register page
- [ ] Forgot password
- [ ] Role-based routing (student/staff/admin)

## Admin Panel
- [ ] Dashboard
- [ ] Result entry (single)
- [ ] Result import (Excel/CSV)
- [ ] Result validation + duplicate checks
- [ ] Exam date create/update
- [ ] Exam date PDF export
- [ ] Class management (year/session like 2026, 2027)
- [ ] Banner upload (2 images)
- [ ] Audit fields (created_at, created_by) on all tables

## Staff Panel
- [ ] Result entry (single)
- [ ] Result import (Excel/CSV)
- [ ] View exam dates
- [ ] No delete/publish permissions

## Security & QA
- [ ] Rate limit result search
- [ ] CAPTCHA on search
- [ ] Input validation
- [ ] Basic tests (result search, download)

## Notes
- Student can view/download results without login.
