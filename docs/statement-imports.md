# Statement imports

In Settings, open **Import Statement** under **Import from other apps**. Review the valid/skipped counts and paid/received totals, choose a payment profile, then confirm. Nothing is saved while selecting or previewing a file.

Supported formats:

- Paytm XLSX: reads the **Passbook Payment History** transaction table, even when the first sheet is Summary. Signed amounts determine income/expense alongside the explicit payment direction. Real transaction times and provider references are retained.
- Slice XLSX: finds the DATE / DETAILS / REF NO. / TRANSACTION TYPE / DEBIT / CREDIT / BALANCE table after account metadata. Balance values and opening/closing summary rows are excluded. The source does not supply transaction times; these entries use 00:00, with a visible warning.
- CSV/XLS/XLSX tables: require an actual Date, Description/Details and Amount (with explicit type/sign) or Debit/Credit columns. All workbook sheets are inspected. Positive amounts without a direction are skipped rather than assumed to be expenses.
- JSON: accepts a transaction array, or an object containing `transactions`, `expenses` or `items`. Each entry needs a valid date, description, amount and explicit `type` of `expense`/`income` (or signed amount/debit/credit). Imported records are personal entries on the selected profile; arbitrary payer IDs and splits from another app are not recreated.
- Google Pay original text PDF: recognizes the provider's Date & time / Transaction details / Amount statement layout. Each entry must contain a date, time, payment direction, UPI transaction reference and rupee amount. Headers, branding, pagination and total values are excluded.

PDF files are sent over the app's authenticated HTTPS connection to the existing SplitTrack backend for text extraction. No new frontend native dependency is needed. XLSX/CSV/JSON decoding stays on the device. The endpoint is `POST /api/import/statement/pdf` with `{base64}` and returns `{pages: string[]}`. Limits are 3 MB and 100 pages for PDFs; other statement files are limited to 10 MB. The parser accepts at most 5,000 candidate entries per import.

Scanned/image PDFs, encrypted PDFs, other providers' PDF layouts, unknown date formats, invalid amounts and non-INR rows are not guessed. Export the original text statement or a CSV/XLSX table when an unsupported-format error appears.

No rows are removed simply because their date, merchant and amount match another entry. Each transaction reference is retained in notes without importing account numbers, UPI addresses, emails, or phone numbers. Confirming the same statement again is a new import and can add those entries again. Pending entries use the app's existing durable queue and synchronize when connected.

The preview reports valid and skipped rows, ignored headers/summary rows, income/expense totals and up to eight row-level validation problems. Provider summary totals are checked when available; any mismatch is shown for review. Missing or invalid dates never become today's date. Categorization is a suggested keyword-based classification; source amounts and direction remain authoritative.

Regression fixtures in `scripts/statement-import.test.mjs` are synthetic examples of the provider layouts. Customer statements and extracted personal data must never be added as fixtures.
