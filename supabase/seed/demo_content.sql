-- =====================================================================
-- MF Website · DEMO CONTENT (5 blog posts, 6 projects, sample comments)
-- Paste into Supabase → SQL Editor → Run. Safe to run more than once.
-- Everything here is tagged 'demo'. Remove it all later with
-- supabase/seed/remove_demo_content.sql
-- =====================================================================

-- ---------------------------- BLOG POSTS ----------------------------
insert into public.posts (title, slug, excerpt, content, category_id, author_id, tags, status, published_at, featured, allow_comments)
values
(
  'XLOOKUP vs VLOOKUP: Why You Should Switch Today',
  'xlookup-vs-vlookup',
  'VLOOKUP served us well for decades, but XLOOKUP is faster to write, harder to break and far more flexible. Here is how to switch.',
  $md$
If you still use **VLOOKUP** every day, you are working harder than you need to. XLOOKUP fixes almost every VLOOKUP pain point in a single function.

## The problem with VLOOKUP

VLOOKUP has three classic weaknesses:

- It can only look to the **right** of the lookup column.
- It uses a **column number**, so inserting a column silently breaks your formula.
- It defaults to *approximate match*, which gives wrong answers if you forget `FALSE`.

## XLOOKUP in one line

```text
=XLOOKUP(lookup_value, lookup_array, return_array, [if_not_found])
```

For example, to find an employee's department by ID:

```text
=XLOOKUP(A2, Employees[ID], Employees[Department], "Not found")
```

## Side-by-side comparison

| Feature | VLOOKUP | XLOOKUP |
| --- | --- | --- |
| Look left | ❌ | ✅ |
| Safe when columns move | ❌ | ✅ |
| Exact match by default | ❌ | ✅ |
| Custom "not found" text | ❌ (needs IFERROR) | ✅ |
| Search from bottom | ❌ | ✅ |

## Pro tip: return several columns at once

Point `return_array` at more than one column and XLOOKUP spills the whole row:

```text
=XLOOKUP(A2, Employees[ID], Employees[[Name]:[Salary]])
```

> **Tip:** XLOOKUP works in Excel 2021, Microsoft 365 and Google Sheets. For older Excel versions, use `INDEX` + `MATCH`.

## Conclusion

Start using XLOOKUP in new workbooks today. Your formulas will be shorter, safer and easier for teammates to read.
$md$,
  (select id from public.blog_categories where slug = 'excel'),
  (select id from public.authors where slug = 'muhammad-fazal'),
  array['XLOOKUP', 'Formulas', 'Excel', 'demo'],
  'published', now() - interval '2 days', true, true
),
(
  'Automate Leave Requests with Google Sheets and Apps Script',
  'automate-leave-requests-apps-script',
  'Build a simple leave management system: a Google Form, a Sheet and 30 lines of Apps Script that email approvals automatically.',
  $md$
Paper leave forms get lost, approvals get delayed and nobody knows how many days are left. Let's fix that with free Google tools.

## What we will build

1. A **Google Form** where staff request leave.
2. A **Google Sheet** that collects every request.
3. An **Apps Script** that emails the manager and updates the balance.

## Step 1: Create the form

Add these fields: *Name*, *Email*, *Leave type*, *Start date*, *End date* and *Reason*. Link the form to a new spreadsheet.

## Step 2: Add the script

Open **Extensions → Apps Script** and paste:

```javascript
function onFormSubmit(e) {
  const r = e.namedValues;
  const days = (new Date(r['End date']) - new Date(r['Start date'])) / 86400000 + 1;

  MailApp.sendEmail({
    to: 'manager@example.com',
    subject: `Leave request: ${r['Name']} (${days} days)`,
    htmlBody: `<b>${r['Name']}</b> requested <b>${r['Leave type']}</b>
               from ${r['Start date']} to ${r['End date']}.<br>
               Reason: ${r['Reason']}`,
  });
}
```

## Step 3: Add a trigger

In Apps Script, open **Triggers → Add trigger** and choose `onFormSubmit` → *From spreadsheet* → *On form submit*.

## Results

At one institute this replaced a paper register completely:

- Approval time dropped from **2 days to under 2 hours**
- Leave balances are always up to date
- Zero lost forms

> Want this set up for your team? Book a free consultation from the button at the top of the page.
$md$,
  (select id from public.blog_categories where slug = 'automation'),
  (select id from public.authors where slug = 'muhammad-fazal'),
  array['Apps Script', 'Google Sheets', 'Automation', 'demo'],
  'published', now() - interval '6 days', false, true
),
(
  '10 Excel Shortcuts That Save Hours Every Week',
  '10-excel-shortcuts',
  'Stop reaching for the mouse. These ten shortcuts cover 80% of daily spreadsheet work.',
  $md$
Most people use Excel with the mouse. Learning a handful of shortcuts is the fastest productivity boost you can get.

## The essential ten

| Shortcut | What it does |
| --- | --- |
| `Ctrl + Arrow` | Jump to the edge of your data |
| `Ctrl + Shift + Arrow` | Select to the edge of your data |
| `Ctrl + T` | Turn a range into a Table |
| `Ctrl + ;` | Insert today's date |
| `F4` | Lock a cell reference ($A$1) |
| `Alt + =` | AutoSum |
| `Ctrl + 1` | Format cells |
| `Ctrl + Shift + L` | Toggle filters |
| `Ctrl + D` | Fill down |
| `F2` | Edit the active cell |

## How to actually remember them

Pick **two** shortcuts per week and force yourself to use them. After a month, they become muscle memory.

## Bonus: Flash Fill

Type the result you want once, then press `Ctrl + E`. Excel guesses the pattern for the whole column, perfect for splitting names or formatting phone numbers.
$md$,
  (select id from public.blog_categories where slug = 'excel'),
  (select id from public.authors where slug = 'muhammad-fazal'),
  array['Shortcuts', 'Productivity', 'Excel', 'demo'],
  'published', now() - interval '12 days', false, true
),
(
  'Using ChatGPT and Claude to Write Better Spreadsheet Formulas',
  'ai-for-spreadsheet-formulas',
  'AI assistants are great formula partners if you give them the right context. Here is the prompt template I teach in class.',
  $md$
Generative AI tools like **Claude** and **ChatGPT** can write, explain and fix formulas in seconds, but only if you ask well.

## The prompt template

```text
I use [Excel 365 / Google Sheets].
My data is in columns: A = Date, B = Product, C = Region, D = Sales.
Data starts in row 2 and ends around row 5,000.
I want: [the result you need].
Please give one formula and explain each part simply.
```

## Why context matters

Without column names and the app version, AI often suggests functions you don't have, or the wrong ranges.

## Three great uses

1. **Explain** a scary formula you inherited from a colleague.
2. **Convert** VLOOKUP formulas into XLOOKUP.
3. **Generate** Apps Script code for small automations.

## Always verify

AI can be confidently wrong. Test every formula on a few rows where you already know the answer.

> In my training sessions, students who use this template solve formula problems about **3× faster**.
$md$,
  (select id from public.blog_categories where slug = 'ai-tools'),
  (select id from public.authors where slug = 'muhammad-fazal'),
  array['AI', 'Prompt Engineering', 'Formulas', 'demo'],
  'published', now() - interval '18 days', false, true
),
(
  'Build a Live Sales Dashboard in Google Sheets',
  'google-sheets-sales-dashboard',
  'Turn a messy sales log into a clean, auto-updating dashboard with QUERY, SPARKLINE and a few charts.',
  $md$
A good dashboard answers the boss's questions before they ask them. Here's how to build one in Google Sheets without any add-ons.

## 1. Keep raw data separate

Put every sale on a sheet called **Data** with one row per sale. Never type on the dashboard sheet directly.

## 2. Summarise with QUERY

```sql
=QUERY(Data!A:E,
  "select C, sum(E) where A >= date '2026-01-01'
   group by C order by sum(E) desc label sum(E) 'Sales'", 1)
```

## 3. Add sparklines

```text
=SPARKLINE(FILTER(Data!E:E, Data!C:C = A2), {"charttype","column"})
```

## 4. KPI cards

Use big, bold cells for **Total sales**, **Orders** and **Average order value**, then add a chart below.

## 5. Share view-only

Share the dashboard as *Viewer* so nobody breaks the formulas, while the data sheet keeps updating.
$md$,
  (select id from public.blog_categories where slug = 'google-sheets'),
  (select id from public.authors where slug = 'muhammad-fazal'),
  array['Dashboard', 'QUERY', 'Google Sheets', 'demo'],
  'published', now() - interval '25 days', false, true
)
on conflict (slug) do nothing;

-- Sample comments (approved) with an author reply
insert into public.comments (post_id, name, email, body, status, is_admin, created_at)
select p.id, 'Rahim Uddin', 'rahim@example.com', 'This saved me so much time! I switched all my reports to XLOOKUP today. 🙌', 'approved', false, now() - interval '1 day'
from public.posts p
where p.slug = 'xlookup-vs-vlookup'
  and not exists (select 1 from public.comments c where c.post_id = p.id and c.name = 'Rahim Uddin');

insert into public.comments (post_id, parent_id, name, email, body, status, is_admin, created_at)
select c.post_id, c.id, 'Muhammad Fazal', 'admin@example.com', 'Great to hear, Rahim! Try the multi-column trick next, it is a real time saver.', 'approved', true, now() - interval '20 hours'
from public.comments c
join public.posts p on p.id = c.post_id
where p.slug = 'xlookup-vs-vlookup' and c.name = 'Rahim Uddin'
  and not exists (select 1 from public.comments r where r.parent_id = c.id);

insert into public.comments (post_id, name, email, body, status, is_admin, created_at)
select p.id, 'Nusrat Jahan', 'nusrat@example.com', 'Can this also send a confirmation email to the employee after approval?', 'approved', false, now() - interval '3 days'
from public.posts p
where p.slug = 'automate-leave-requests-apps-script'
  and not exists (select 1 from public.comments c where c.post_id = p.id and c.name = 'Nusrat Jahan');

-- ----------------------------- PROJECTS -----------------------------
insert into public.projects (title, slug, summary, content, category_id, tools, tags, client, project_date, live_url, preview_type, preview_url, problem, solution, results, featured, status, sort_order)
values
(
  'Dua After Salah: Android App',
  'dua-after-salah-app',
  'A simple, ad-light Android app with authentic duas to read after each prayer, published on Google Play.',
  $md$
## Features

- Duas for after every prayer with Arabic, transliteration and meaning
- Large, readable typography and night mode
- Works fully offline
$md$,
  (select id from public.project_categories where slug = 'mobile-apps'),
  array['Android', 'Java', 'Material Design'], array['App', 'Islamic', 'demo'],
  'Personal project', date '2024-03-15',
  'https://play.google.com/store/search?q=Dua%20After%20Salah&c=apps',
  'app', null,
  'People wanted a clean, distraction-free way to read the right duas after salah, without heavy ads.',
  'Designed and built a lightweight Android app with an offline dua library, clear typography and night mode.',
  'Published on Google Play with positive user reviews.',
  true, 'published', 1
),
(
  'Leave Management System (Apps Script)',
  'leave-management-apps-script',
  'Google Form + Sheets + Apps Script system that routes leave requests, emails approvals and tracks balances automatically.',
  '',
  (select id from public.project_categories where slug = 'automation'),
  array['Google Apps Script', 'Google Sheets', 'Google Forms', 'Gmail'], array['ERP', 'HR', 'demo'],
  'As-Sunnah Skill Development Institute', date '2025-02-10',
  null, 'none', null,
  'Leave requests were handled on paper. Approvals took days and nobody knew remaining balances.',
  'Built a form-driven workflow: requests land in a Sheet, Apps Script emails the approver, and balances update on approval.',
  E'• Approval time cut from 2 days to under 2 hours\n• Zero lost requests\n• Real-time leave balances for every staff member',
  true, 'published', 2
),
(
  'Student Database & Admin Dashboard',
  'student-database-dashboard',
  'A central Google Sheets database for 1,200+ students with search, attendance tracking and a live admin dashboard.',
  '',
  (select id from public.project_categories where slug = 'google-sheets'),
  array['Google Sheets', 'QUERY', 'Apps Script', 'Looker Studio'], array['Dashboard', 'Education', 'demo'],
  'Training institute', date '2025-06-01',
  null, 'none', null,
  'Student records lived in many separate files, so reporting took hours every month.',
  'Merged everything into one structured database with validation, a search panel and an auto-updating dashboard.',
  E'• Monthly reporting went from 6 hours to 10 minutes\n• One source of truth for 1,200+ students',
  true, 'published', 3
),
(
  'Stock Management Tracker',
  'stock-management-tracker',
  'Excel inventory tracker with stock-in / stock-out logs, low-stock alerts and a printable monthly summary.',
  '',
  (select id from public.project_categories where slug = 'excel'),
  array['Excel', 'XLOOKUP', 'Pivot Tables', 'Conditional Formatting'], array['Inventory', 'Template', 'demo'],
  'Small retail shop', date '2024-11-20',
  null, 'none', null,
  'The shop tracked stock in a notebook and often ran out of best-selling items.',
  'Created an Excel template with transaction logs, automatic balances and red alerts when items fall below minimum stock.',
  'Stock-outs dropped noticeably in the first month and the owner gets a one-page summary for ordering.',
  false, 'published', 4
),
(
  'Corporate Website (WordPress)',
  'corporate-website-wordpress',
  'Responsive business website built with WordPress and Elementor for an international Fiverr client.',
  '',
  (select id from public.project_categories where slug = 'websites'),
  array['WordPress', 'Elementor', 'UI/UX'], array['Fiverr', 'Business', 'demo'],
  'Fiverr client', date '2023-08-05',
  'https://example.com', 'website', 'https://example.com',
  'The client needed a modern site that their team could update without a developer.',
  'Designed a clean, responsive site in Elementor with reusable templates and a short handover video.',
  'Delivered on time with a 5-star review.',
  false, 'published', 5
),
(
  'Training Presentation Template',
  'training-presentation-template',
  'A clean PowerPoint template system used for MS Office classroom training, with consistent layouts and icons.',
  '',
  (select id from public.project_categories where slug = 'powerpoint'),
  array['PowerPoint', 'Slide Master', 'Design'], array['Template', 'Training', 'demo'],
  'Classroom training', date '2025-09-12',
  null, 'none', null,
  'Training slides looked different in every class, which made materials hard to maintain.',
  'Built a master template with fixed layouts, color theme and an icon set.',
  'New lessons are now prepared about twice as fast with a consistent look.',
  false, 'published', 6
)
on conflict (slug) do nothing;
