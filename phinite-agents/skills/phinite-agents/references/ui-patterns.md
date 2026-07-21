# UI patterns for Phinite agent replies

How to turn an agent's text reply into a clean, self-contained artifact.
Read this **before** building. Skim to the component you need, copy the skeleton,
fill it with the agent's data.

---

## Non-negotiables

1. **Only the agent's data.** No invented prices, rows, dates, ratings, or sample
   values. Missing field → omit the element. No `N/A` padding, no placeholders.
2. **No external code.** No CDNs, web fonts, or chart libraries — inline
   everything. **Images are the exception:** render the image URLs the agent
   returned, always with a graceful fallback (see *Images* below).
3. **One artifact per reply**, and only when the reply clears the trigger bar in
   `SKILL.md`. A one-line answer stays a one-line answer.
4. **Both themes.** The viewer can toggle light/dark; both must look deliberate.
5. **No horizontal page scroll.** Wide tables/charts scroll inside their own box.

---

## Base: tokens + reset

Paste this once at the top of every artifact. It is the whole design system.

```html
<style>
:root{
  --bg:#fff; --surface:#fff; --raised:#f6f7f9;
  --text:#14161a; --muted:#5b636e; --border:#e3e6eb;
  --accent:#4f46e5; --pos:#0e8a5f; --neg:#c53434; --warn:#a76a12;
  --c1:#4f46e5; --c2:#0ea5a4; --c3:#e08a1e; --c4:#c0468c; --c5:#3b82f6;
  --r:12px; --gap:16px;
  --shadow:0 1px 2px rgba(16,24,40,.06),0 1px 3px rgba(16,24,40,.10);
}
@media (prefers-color-scheme:dark){:root{
  --bg:#0f1115; --surface:#161920; --raised:#1c202a;
  --text:#e8eaee; --muted:#98a1ae; --border:#282d38;
  --accent:#8f8bf7; --pos:#3ddc97; --neg:#ff6b6b; --warn:#e3b341;
  --c1:#8f8bf7; --c2:#2dd4bf; --c3:#f0b429; --c4:#f472b6; --c5:#60a5fa;
  --shadow:0 1px 2px rgba(0,0,0,.45);
}}
:root[data-theme="light"]{
  --bg:#fff; --surface:#fff; --raised:#f6f7f9;
  --text:#14161a; --muted:#5b636e; --border:#e3e6eb;
  --accent:#4f46e5; --pos:#0e8a5f; --neg:#c53434; --warn:#a76a12;
  --c1:#4f46e5; --c2:#0ea5a4; --c3:#e08a1e; --c4:#c0468c; --c5:#3b82f6;
  --shadow:0 1px 2px rgba(16,24,40,.06),0 1px 3px rgba(16,24,40,.10);
}
:root[data-theme="dark"]{
  --bg:#0f1115; --surface:#161920; --raised:#1c202a;
  --text:#e8eaee; --muted:#98a1ae; --border:#282d38;
  --accent:#8f8bf7; --pos:#3ddc97; --neg:#ff6b6b; --warn:#e3b341;
  --c1:#8f8bf7; --c2:#2dd4bf; --c3:#f0b429; --c4:#f472b6; --c5:#60a5fa;
  --shadow:0 1px 2px rgba(0,0,0,.45);
}
*{box-sizing:border-box}
body{margin:0;padding:24px;background:var(--bg);color:var(--text);
 font:15px/1.55 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.wrap{max-width:960px;margin:0 auto}
h1{font-size:20px;margin:0 0 4px;letter-spacing:-.01em}
.sub{color:var(--muted);font-size:13px;margin:0 0 20px}
.card{background:var(--surface);border:1px solid var(--border);
 border-radius:var(--r);padding:16px;box-shadow:var(--shadow)}
.grid{display:grid;gap:var(--gap);grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}
.scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
table{width:100%;border-collapse:collapse;font-size:14px}
th,td{text-align:left;padding:10px 12px;border-bottom:1px solid var(--border)}
th{color:var(--muted);font-size:12px;font-weight:600;letter-spacing:.03em;text-transform:uppercase}
tr:last-child td{border-bottom:0}
.num{text-align:right;font-variant-numeric:tabular-nums}
.badge{display:inline-block;padding:3px 9px;border-radius:999px;font-size:12px;
 font-weight:600;background:var(--raised);color:var(--muted);border:1px solid var(--border)}
.badge.pos{color:var(--pos)} .badge.neg{color:var(--neg)} .badge.warn{color:var(--warn)}
.chip{display:inline-block;padding:2px 8px;margin:2px 4px 2px 0;border-radius:6px;
 font-size:12px;background:var(--raised);color:var(--muted);border:1px solid var(--border)}
a{color:var(--accent)}
.thumb{aspect-ratio:4/3;background:var(--raised);border-radius:8px;
 overflow:hidden;margin:0 0 12px}
.thumb img{width:100%;height:100%;object-fit:cover;display:block}
.hero{aspect-ratio:16/9;background:var(--raised);border-radius:var(--r);
 overflow:hidden;margin:0 0 16px}
.hero img{width:100%;height:100%;object-fit:cover;display:block}
</style>
```

Rhythm: 8px spacing steps, one radius (`--r`), one shadow. Don't introduce new
colors — `--c1..--c5` are the only categorical series colors.

---

## Images

Agents return real image URLs (product photos, thumbnails, avatars). **Use them** —
an ecommerce grid without pictures is a worse answer.

The contract for every image:

```html
<div class="thumb">
  <img src="IMAGE_URL_FROM_REPLY" alt="Descriptive name" loading="lazy"
       onerror="this.closest('.thumb').remove()">
</div>
```

Why each part matters:

- **`.thumb` / `.hero` wrapper** with a fixed `aspect-ratio` — reserves the space
  before the image loads, so cards never jump or end up different heights.
- **`object-fit:cover`** — mixed source dimensions still line up in a grid.
- **`onerror` removes the slot** — some viewers block remote images under a strict
  CSP. Dropping the slot leaves a clean typographic card instead of a broken-image
  icon and a hole in the layout. **Never** swap in a placeholder image.
- **`alt`** — real text from the reply (the item name), never `"image"`.
- **`loading="lazy"`** — a grid of 20 products shouldn't block first paint.

Rules: only URLs the agent actually returned; never invent, guess, or reuse an
image across items; one image per item (use the first if several are given);
never make an image the only carrier of information — the name, price, and
attributes must be readable with images off.

---

## Card grid — multiple comparable items

**Use when** the reply lists 3+ products, listings, offers, or results.

**Anatomy:** title (link if a URL was given) → price/primary value → 2–4
attribute chips → one-line description → action link.

**Anatomy:** image (if the reply gave one) → title → price/primary value → 2–4
attribute chips → one-line description.

**Rules**
- **Show the agent's image** in a `.thumb` slot at the top of the card. Fixed
  `aspect-ratio` keeps every card the same height even if one image is missing.
- Price is the visual anchor: largest non-title text, tabular numerals.
- Same fields in every card. If one item lacks a field, that card just omits it —
  don't invent it and don't leave a gap.
- Clamp descriptions to 2 lines so cards align.

```html
<div class="grid">
  <article class="card">
    <div class="thumb">
      <img src="IMAGE_URL" alt="Item name" loading="lazy"
           onerror="this.closest('.thumb').remove()">
    </div>
    <h3 style="margin:0 0 6px;font-size:15px"><a href="URL">Item name</a></h3>
    <div style="font-size:20px;font-weight:650;font-variant-numeric:tabular-nums">₹1,299</div>
    <div style="margin:8px 0"><span class="chip">Attr</span><span class="chip">Attr</span></div>
    <p style="margin:0;color:var(--muted);font-size:13px;
       display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">
      Description from the reply.</p>
  </article>
</div>
```

---

## Detail card — one record, many fields

**Use when** the reply describes a single entity (an order, profile, booking, ticket).

Optional `.hero` image (if the reply gave one), then title + status badge, then a
two-column definition list. Group related fields; don't render a 20-row flat list.

```html
<div class="card">
  <div class="hero">
    <img src="IMAGE_URL" alt="Record title" onerror="this.closest('.hero').remove()">
  </div>
  <div style="display:flex;justify-content:space-between;align-items:start;gap:12px">
    <h2 style="margin:0;font-size:17px">Record title</h2>
    <span class="badge pos">Confirmed</span>
  </div>
  <dl style="display:grid;grid-template-columns:auto 1fr;gap:8px 20px;margin:16px 0 0;font-size:14px">
    <dt style="color:var(--muted)">Field</dt><dd style="margin:0">Value</dd>
  </dl>
</div>
```

---

## Form — the agent needs input

**Use when** the agent asks for 2+ pieces of information.

**Rules**
- One field per thing asked. Choose the input type from what's asked: `email`,
  `tel`, `number`, `date`, `<select>` when the agent listed options, `<textarea>`
  for free text. Never ask for anything the agent didn't ask for.
- Mark required fields; label every input (`<label for>`).
- End with a **Copy for Claude** button. The artifact cannot message the
  conversation, so the button copies a `key: value` block the user pastes back —
  then you call `call_agent` with those values (carrying `task_id`).

```html
<form class="card" id="f" onsubmit="return false">
  <label for="q1" style="display:block;font-size:13px;color:var(--muted);margin:0 0 4px">Label *</label>
  <input id="q1" name="Label" required
    style="width:100%;padding:9px 11px;border:1px solid var(--border);border-radius:8px;
           background:var(--raised);color:var(--text);font:inherit;margin-bottom:14px">
  <button type="button" onclick="cp()"
    style="padding:9px 16px;border:0;border-radius:8px;background:var(--accent);
           color:#fff;font:inherit;font-weight:600;cursor:pointer">Copy for Claude</button>
  <span id="ok" style="margin-left:10px;color:var(--pos);font-size:13px"></span>
</form>
<script>
function cp(){
  const out=[...document.querySelectorAll('#f input,#f select,#f textarea')]
    .filter(e=>e.value.trim()).map(e=>`${e.name}: ${e.value.trim()}`).join('\n');
  navigator.clipboard.writeText(out);
  document.getElementById('ok').textContent='Copied — paste it back in chat';
}
</script>
```

---

## Invoice / receipt — money

**Use when** the reply has line items, amounts, tax, or a total.

**Anatomy:** header (invoice/order id, dates, parties) → line-item table
(description, qty, unit price, amount) → totals block, right-aligned → status badge.

**Rules**
- Every amount comes from the reply. Compute a subtotal **only** if every line
  amount is present; otherwise show only the totals the agent gave.
- Never "fix" the agent's math. If the numbers don't add up, render them as given
  and say so in chat.
- Keep the currency symbol/code exactly as the agent wrote it.
- Grand total is the only bolded, largest number.

```html
<div class="card">
  <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px">
    <div><h2 style="margin:0;font-size:17px">Invoice #1234</h2>
      <div style="color:var(--muted);font-size:13px">Issued 12 Jun 2026</div></div>
    <span class="badge pos">Paid</span>
  </div>
  <div class="scroll" style="margin:18px 0">
    <table>
      <thead><tr><th>Description</th><th class="num">Qty</th>
        <th class="num">Unit</th><th class="num">Amount</th></tr></thead>
      <tbody><tr><td>Item</td><td class="num">2</td>
        <td class="num">500.00</td><td class="num">1,000.00</td></tr></tbody>
    </table>
  </div>
  <div style="margin-left:auto;max-width:280px;font-size:14px">
    <div style="display:flex;justify-content:space-between;padding:6px 0">
      <span style="color:var(--muted)">Subtotal</span><span class="num">1,000.00</span></div>
    <div style="display:flex;justify-content:space-between;padding:10px 0 0;
      border-top:1px solid var(--border);font-size:17px;font-weight:700">
      <span>Total</span><span class="num">1,180.00</span></div>
  </div>
</div>
```

---

## Data — KPI tiles + table + chart

**Use when** the reply has metrics, a series, or a breakdown.

Order: **tiles** (the headline numbers) → **chart** (the shape) → **table** (the
exact values). Always include the table — it is the proof the chart is honest and
it makes the artifact accessible.

```html
<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">
  <div class="card">
    <div style="color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.03em">Metric</div>
    <div style="font-size:26px;font-weight:650;font-variant-numeric:tabular-nums;margin-top:4px">1,284</div>
    <div style="font-size:13px;color:var(--pos)">+12% vs last month</div>
  </div>
</div>
```

Only show a delta (`+12%`) if the agent gave it. Green/red is `--pos`/`--neg`;
never color a number that has no stated direction.

### Charts — hand-written inline SVG

Pick one: **bar** for categories, **line** for time series, **donut** for a
single share of a whole. Max 2 charts. Never a chart for fewer than 3 points.

Plot area used below: x from 40→470, baseline y=170, max bar height 140.
Scale every value as `h = round(v / max * 140)`, `y = 170 - h`.

**Bar**
```html
<svg viewBox="0 0 480 200" role="img" aria-label="Revenue by month"
     style="width:100%;height:auto;display:block">
  <line x1="40" y1="170" x2="470" y2="170" stroke="var(--border)"/>
  <rect x="52" y="60" width="34" height="110" rx="4" fill="var(--c1)"/>
  <text x="69" y="187" text-anchor="middle" font-size="11" fill="var(--muted)">Jan</text>
</svg>
```

**Line** — `x = 40 + i*(430/(n-1))`, `y = 170 - v/max*140`:
```html
<polyline fill="none" stroke="var(--c1)" stroke-width="2.5"
          stroke-linejoin="round" points="40,120 147,90 254,101 361,58 470,44"/>
```

**Donut** — r=60 so circumference ≈ 377; dash = `377 * fraction`:
```html
<svg viewBox="0 0 180 180" role="img" aria-label="Share" style="width:180px;height:auto">
  <circle cx="90" cy="90" r="60" fill="none" stroke="var(--raised)" stroke-width="22"/>
  <circle cx="90" cy="90" r="60" fill="none" stroke="var(--c1)" stroke-width="22"
          stroke-dasharray="245 377" transform="rotate(-90 90 90)" stroke-linecap="round"/>
  <text x="90" y="97" text-anchor="middle" font-size="26" font-weight="650"
        fill="var(--text)">65%</text>
</svg>
```

Rules: start bar/line axes at zero, label axes only when the unit isn't obvious,
give every chart a `role="img"` + `aria-label`, and use `--c1..--c5` in order.

---

## Comparison table — options weighed on the same attributes

Rows = attributes, columns = options (attributes are easier to scan down).
First column sticky-ish and muted. Only mark a "best" option if the agent said
so — never decide a winner yourself.

```html
<div class="card scroll">
  <table>
    <thead><tr><th></th><th>Option A</th><th>Option B</th></tr></thead>
    <tbody><tr><td style="color:var(--muted)">Price</td>
      <td class="num">₹999</td><td class="num">₹1,499</td></tr></tbody>
  </table>
</div>
```

---

## Stepper — process or order status

Use when the reply describes stages. Three states only: **done**, **current**,
**pending**. Never guess which stage is current — use the agent's wording.

```html
<ol class="card" style="list-style:none;margin:0;padding:16px 16px 16px 8px">
  <li style="display:flex;gap:12px;padding:0 0 18px;position:relative">
    <span style="flex:0 0 12px;height:12px;margin-top:5px;border-radius:50%;
      background:var(--pos)"></span>
    <div><div style="font-weight:600;font-size:14px">Order placed</div>
      <div style="color:var(--muted);font-size:13px">12 Jun, 10:04</div></div>
  </li>
</ol>
```
`--pos` = done, `--accent` = current, `--border` = pending.

---

## Schedule — dated or timed entries

Group by day (day as a small sticky heading), time in a fixed-width left column,
entry on the right. Keep chronological order exactly as given.

```html
<div class="card">
  <div style="font-size:12px;text-transform:uppercase;letter-spacing:.03em;
    color:var(--muted);margin-bottom:10px">Mon, 12 Jun</div>
  <div style="display:grid;grid-template-columns:74px 1fr;gap:10px 14px;font-size:14px">
    <div class="num" style="color:var(--muted)">09:30</div><div>Entry title</div>
  </div>
</div>
```

---

## Craft checklist

Before publishing, confirm:

- [ ] Every value on screen came from the agent's reply.
- [ ] No external code (fonts, scripts, stylesheets). Images are only URLs the
      agent returned, each wrapped in a fixed-ratio slot with an `onerror` fallback.
- [ ] The card still makes sense with images off.
- [ ] Readable in **both** light and dark; the theme toggle works.
- [ ] At 360px wide nothing overflows the page; wide tables scroll in `.scroll`.
- [ ] Numbers are right-aligned and tabular; currency/units match the reply.
- [ ] One idea per artifact — not a dashboard of everything.
- [ ] Any chart is paired with its numbers in a table.
- [ ] The chat message still answers the question on its own.
