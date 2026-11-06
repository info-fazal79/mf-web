-- =====================================================================
-- DEMO E-BOOKS (1 free, 1 paid) with chapters. Tagged 'demo'.
-- Run AFTER 0006_ebooks.sql. If a Row Level Security warning appears,
-- choose "Run without RLS". Remove later with remove_demo_content.sql.
-- =====================================================================

insert into public.ebooks (title, slug, subtitle, description, category_id, author_name, language, pages, format, access_mode, price, tags, featured, status, sort_order, published_at)
values
(
  'Excel Formulas Quick Guide',
  'excel-formulas-quick-guide',
  'The 20 formulas that solve 90% of everyday spreadsheet problems',
  $md$
A short, practical guide for students and office professionals. Every formula comes with a **real example** you can copy into your own workbook.

**What you will learn**

- SUM, AVERAGE, COUNT and their IF versions
- XLOOKUP and INDEX + MATCH
- Text and date formulas
- How to avoid the most common formula errors
$md$,
  (select id from public.ebook_categories where slug = 'excel'),
  'Muhammad Fazal', 'Bangla & English', 42, 'native', 'free_read', 0,
  array['Excel', 'Formulas', 'demo'], true, 'published', 1, now() - interval '3 days'
),
(
  'Google Sheets Automation Playbook',
  'google-sheets-automation-playbook',
  'Build leave, stock and sales systems with Sheets and Apps Script',
  $md$
Step-by-step blueprints for the automation systems I build for institutes and small businesses, with copy-ready Apps Script code.

**Inside the book**

- Planning a sheet-based system the right way
- Forms → Sheets → email approvals
- Live dashboards with QUERY and charts
- Scheduling scripts with triggers
$md$,
  (select id from public.ebook_categories where slug = 'automation'),
  'Muhammad Fazal', 'English', 86, 'native', 'paid', 199,
  array['Google Sheets', 'Apps Script', 'demo'], true, 'published', 2, now() - interval '1 day'
)
on conflict (slug) do nothing;

update public.ebooks set sale_price = 149 where slug = 'google-sheets-automation-playbook' and sale_price is null;

-- Chapters: free book
insert into public.ebook_chapters (ebook_id, title, content, position, is_preview)
select e.id, v.title, v.content, v.pos, v.preview
from public.ebooks e
cross join (values
  (0, 'Introduction: why formulas matter', $md$
Most spreadsheet work is repetitive: adding totals, finding values, cleaning text. **Formulas turn hours of manual work into seconds.**

## How to read this guide

Each chapter shows a formula, explains every part, and gives one real-world example. Open Excel or Google Sheets and try each one as you read.

> Tip: select any sentence in this reader to highlight it or add a note. Tap the speaker icon at the top to listen.

## ফর্মুলা কেন শিখবেন?

প্রতিদিনের অফিসের কাজের বেশিরভাগই একই রকম: যোগফল বের করা, তথ্য খোঁজা, লেখা পরিষ্কার করা। সঠিক ফর্মুলা জানলে ঘণ্টার কাজ কয়েক সেকেন্ডে হয়ে যায়।
$md$, true),
  (1, 'SUM, AVERAGE and COUNT', $md$
These three are the foundation of every report.

## SUM

```text
=SUM(B2:B50)
```

Adds every number in the range. Use **Alt + =** to insert it instantly.

## AVERAGE and COUNT

```text
=AVERAGE(B2:B50)
=COUNT(B2:B50)
=COUNTA(A2:A50)
```

`COUNT` counts numbers only, while `COUNTA` counts any non-empty cell.

## Conditional versions

```text
=SUMIF(C2:C50, "Dhaka", B2:B50)
=COUNTIFS(C2:C50, "Dhaka", D2:D50, ">=2026-01-01")
```

Use the **IFS** versions whenever you have more than one condition.
$md$, false),
  (2, 'XLOOKUP: finding anything', $md$
XLOOKUP replaces VLOOKUP, HLOOKUP and most INDEX + MATCH formulas.

## The pattern

```text
=XLOOKUP(what, where, return, [if_not_found])
```

## Example: find a student's grade

```text
=XLOOKUP(F2, Students[ID], Students[Grade], "No record")
```

## Common mistakes

1. Ranges of different sizes give a `#VALUE!` error.
2. Extra spaces in IDs cause "not found". Clean them with `TRIM`.
3. Numbers stored as text never match real numbers.
$md$, false)
) as v(pos, title, content, preview)
where e.slug = 'excel-formulas-quick-guide'
  and not exists (select 1 from public.ebook_chapters c where c.ebook_id = e.id);

-- Chapters: paid book (first chapter is a free preview)
insert into public.ebook_chapters (ebook_id, title, content, position, is_preview)
select e.id, v.title, v.content, v.pos, v.preview
from public.ebooks e
cross join (values
  (0, 'Chapter 1: Planning a sheet-based system', $md$
Before writing a single formula, decide **what goes in, what comes out, and who touches what**.

## The three-sheet rule

1. **Input**: a Google Form or a locked entry sheet
2. **Data**: raw rows only, never edited by hand
3. **Output**: dashboards and reports built with formulas

## Naming conventions

Use clear sheet names (`Data_Leave`, `Dash_Summary`) and named ranges. Future you will thank you.

> This chapter is a free preview. The next chapters contain the full Apps Script code.
$md$, true),
  (1, 'Chapter 2: Forms, Sheets and email approvals', $md$
## Connecting the form

Link your Google Form to the Data sheet, then open **Extensions → Apps Script**.

```javascript
function onFormSubmit(e) {
  const v = e.namedValues;
  MailApp.sendEmail('manager@example.com', `New request: ${v['Name']}`, JSON.stringify(v, null, 2));
}
```

## Approval links

Generate a unique approve / reject link per row so managers can respond from their phone.
$md$, false),
  (2, 'Chapter 3: Live dashboards with QUERY', $md$
## One formula, many answers

```sql
=QUERY(Data!A:F, "select B, count(A) group by B order by count(A) desc", 1)
```

Combine QUERY with charts and conditional formatting to build a dashboard that updates itself.
$md$, false),
  (3, 'Chapter 4: Triggers and scheduled reports', $md$
## Time-driven triggers

```javascript
function weeklyReport() {
  const sheet = SpreadsheetApp.getActive().getSheetByName('Dash_Summary');
  const pdf = sheet.getParent().getAs('application/pdf');
  MailApp.sendEmail('boss@example.com', 'Weekly report', 'Attached.', { attachments: [pdf] });
}
```

Set it to run every Monday at 9 AM from the **Triggers** page.
$md$, false)
) as v(pos, title, content, preview)
where e.slug = 'google-sheets-automation-playbook'
  and not exists (select 1 from public.ebook_chapters c where c.ebook_id = e.id);
