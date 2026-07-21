---
name: phinite-agents
description: >
  Use this skill when the user asks to run, invoke, or talk to a Phinite agent;
  asks "what agents do I have", "what agents are available", "list Phinite agents",
  "find an agent that can do X", "ask Phinite", or routes a domain-specific
  question to a specialized AI agent on the Phinite platform.
metadata:
  version: "3.1.0"
---

# STOP — render before you reply

**Every `call_agent` reply must be checked against the render table below BEFORE
you write anything back to the user.**

If it matches a row: **build the artifact first**, then write one or two short
lines of chat around it. Do **not** answer in prose and then offer to make a UI.
Do **not** re-type the agent's data as a bulleted list — a bullet list of items,
options, or prices is always the wrong answer.

Bullet lists and one-line summaries are the two failure modes. Neither is
acceptable when the reply has structure.

## The render table

| If the reply contains | Build |
|---|---|
| 2+ items, products, variants, listings, results, or offers | **Card grid** |
| The agent asks the user to choose or supply anything | **Choice form** — never a bullet list |
| A cart, order, bill, line items, quantities, prices, totals | **Cart / invoice** |
| Metrics, series, breakdowns, anything countable | **KPI tiles + table + chart** |
| One record with many fields | **Detail card** |
| 2+ options weighed on the same attributes | **Comparison table** |
| Stages, progress, or order/ticket status | **Stepper** |
| Dated or timed entries (itinerary, schedule, slots) | **Schedule** |

**Stay in plain text only for:** a direct answer, a confirmation, a single fact,
a yes/no, one open-ended question that lists no options, or an error. Never wrap
a one-line answer in a UI.

## Two rules that override everything

**1. Never flatten.** If the reply has line items, quantities, prices, IDs, or
repeated fields, render **all of them**. Your output must be *richer* than the
agent's plain text, never poorer. The user should never need to expand the raw
tool output to see what the agent actually said.

**2. Never invent.** Show only what the agent returned. A missing field is left
out of the layout entirely — no placeholders, no `N/A`, no sample rows, no stock
images, no guessed prices. Show the totals the agent gave; only compute a sum if
every component is present, and never silently "correct" its arithmetic.

## Build small

Write the **smallest markup that does the job** — a component, not a page. How
long the reply takes is set almost entirely by how much you type, so:

- **Use the classes below; never repeat inline `style=` per item.** Style once,
  then each card is ~5 short tags and each table row is one line. This is the
  single biggest saving when there are many items.
- **Copy only the CSS you use** — the tokens plus the few rules your component
  needs, not the whole block.
- **One component per reply.** No page header, subtitle, intro paragraph, or
  wrapper sections unless they carry meaning.
- **Skip anything decorative** — no chart when the table already shows it, no
  summary tiles above a three-row table, no icons.
- Prefer a plain `<table>` over cards when the data is uniform; it is smaller to
  write and easier to scan.

**Small means less markup per item — never less content.** Dropping items,
merging rows, or truncating a list to save time is wrong (see *Never flatten*).
Ten products still get ten cards; each card is just tiny.

---

# Base styles

Paste this into every artifact, unchanged. It is the whole design system.

```html
<style>
:root{
  --bg:#fff; --surface:#fff; --raised:#f6f7f9;
  --text:#14161a; --muted:#5b636e; --border:#e3e6eb;
  --accent:#4f46e5; --pos:#0e8a5f; --neg:#c53434; --warn:#a76a12;
  --c1:#4f46e5; --c2:#0ea5a4; --c3:#e08a1e; --c4:#c0468c; --c5:#3b82f6;
  --r:12px; --shadow:0 1px 2px rgba(16,24,40,.06),0 1px 3px rgba(16,24,40,.10);
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --bg:#0f1115; --surface:#161920; --raised:#1c202a;
  --text:#e8eaee; --muted:#98a1ae; --border:#282d38;
  --accent:#8f8bf7; --pos:#3ddc97; --neg:#ff6b6b; --warn:#e3b341;
  --c1:#8f8bf7; --c2:#2dd4bf; --c3:#f0b429; --c4:#f472b6; --c5:#60a5fa;
  --shadow:0 1px 2px rgba(0,0,0,.45);
}}
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
.grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}
.scroll{overflow-x:auto}
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
.thumb{aspect-ratio:4/3;background:var(--raised);border-radius:8px;overflow:hidden;margin:0 0 12px}
.thumb img{width:100%;height:100%;object-fit:cover;display:block}
a{color:var(--accent)}
.opt{display:inline-block;margin:0 8px 8px 0;cursor:pointer}
.opt input{position:absolute;opacity:0;width:0}
.opt span{display:inline-block;padding:7px 14px;border:1px solid var(--border);
 border-radius:999px;background:var(--raised);font-size:14px}
.opt input:checked+span{background:var(--accent);color:#fff;border-color:var(--accent)}
.opt input:focus-visible+span{outline:2px solid var(--accent);outline-offset:2px}
.btn{padding:9px 16px;border:0;border-radius:8px;background:var(--accent);
 color:#fff;font:inherit;font-weight:600;cursor:pointer}
.card h3{margin:0 0 6px;font-size:15px}
.price{font-size:20px;font-weight:650;font-variant-numeric:tabular-nums}
.was{color:var(--muted);text-decoration:line-through;font-size:13px;margin-left:6px}
.var{color:var(--muted);font-size:12px}
.cap{color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.03em}
.kpi{font-size:26px;font-weight:650;font-variant-numeric:tabular-nums;margin-top:4px}
.tot{display:flex;justify-content:space-between;padding:10px 0 0;
 border-top:1px solid var(--border);font-size:17px;font-weight:700}
.lbl{display:block;font-size:13px;color:var(--muted);margin:0 0 6px}
.inp{padding:9px 11px;border:1px solid var(--border);border-radius:8px;
 background:var(--raised);color:var(--text);font:inherit}
fieldset{border:0;padding:0;margin:0 0 16px}
legend{font-size:13px;color:var(--muted);padding:0 0 6px}
</style>
```

**Images:** use the URLs the agent returned. Always wrap in a fixed-ratio
`.thumb` and add `onerror="this.closest('.thumb').remove()"` so a blocked image
collapses cleanly instead of leaving a broken icon. Never invent an image URL.

---

# Examples

## 1. Products / variants → card grid

The agent lists items with prices and stock. **Never** a bullet list.

```html
<div class="wrap">
  <h1>Classic Tee</h1>
  <div class="grid">

    <article class="card">
      <div class="thumb"><img src="IMAGE_URL" alt="Blue / Medium"
           onerror="this.closest('.thumb').remove()"></div>
      <h3>Blue / Medium</h3>
      <div><span class="price">$2.60</span><span class="was">$3.20</span></div>
      <span class="badge pos">In stock</span>
    </article>

  </div>
</div>
```

That is the whole card — repeat only those five lines per item. Every item must
look identical in structure; omit a line when the agent didn't give that value.

Rules: same fields in every card; omit a field the item doesn't have (don't leave
a gap); price is the visual anchor; only show a struck-through list price if the
agent gave one; `--pos` for in stock, `--warn` for limited, `--neg` for out.

## 2. Agent asks the user to choose → choice form

When the agent names options ("Blue, Red, Black" / "S, M, L"), they must be
**clickable**. Ask for everything outstanding in one form, then send the answers
back in a **single** `call_agent` carrying `task_id`.

```html
<form class="card wrap" id="f" onsubmit="return false">
  <fieldset>
    <legend>Color *</legend>
    <label class="opt"><input type="radio" name="Color" value="Blue" required><span>Blue</span></label>
    <label class="opt"><input type="radio" name="Color" value="Red"><span>Red</span></label>
    <label class="opt"><input type="radio" name="Color" value="Black"><span>Black</span></label>
  </fieldset>

  <fieldset>
    <legend>Size *</legend>
    <label class="opt"><input type="radio" name="Size" value="Small" required><span>Small</span></label>
    <label class="opt"><input type="radio" name="Size" value="Medium"><span>Medium</span></label>
  </fieldset>

  <label class="lbl" for="q">Quantity *</label>
  <input class="inp" id="q" name="Quantity" type="number" min="1" value="1" required
         style="width:110px;margin-bottom:16px">

  <button type="button" class="btn" onclick="cp()">Copy for Claude</button>
  <span id="ok" class="var"></span>
</form>
<script>
function cp(){
  const vals={};
  document.querySelectorAll('#f input,#f select,#f textarea').forEach(e=>{
    if((e.type==='radio'||e.type==='checkbox') && !e.checked) return;
    const v=(e.value||'').trim(); if(!v||!e.name) return;
    vals[e.name]=vals[e.name]?vals[e.name]+', '+v:v;
  });
  const out=Object.keys(vals).map(k=>k+': '+vals[k]).join('\n');
  navigator.clipboard.writeText(out);
  document.getElementById('ok').textContent = out ? 'Copied — paste it back in chat' : 'Nothing filled in yet';
}
</script>
```

Control by question type: 2–5 named options → radio chips; 6+ → `<select>`; many
allowed → checkboxes; quantity/budget → `number`; date → `date`; open text →
`input`/`textarea`. If the agent's list ends in "etc.", add an **Other** chip
with a free-text field. Ask for **only** what the agent asked for.

The `!e.checked` guard matters — without it every radio option gets copied
instead of the chosen one.

## 3. Cart / order / invoice

Render **every** line item. Carry the cart/order id through. Keep variant text
("Blue / Medium") under the item name.

```html
<div class="card wrap">
  <h1>Your cart</h1>
  <p class="sub">cart_1cf221341ffc</p>

  <div class="scroll">
    <table>
      <thead><tr><th>Item</th><th class="num">Qty</th>
        <th class="num">Unit</th><th class="num">Subtotal</th></tr></thead>
      <tbody>
        <tr><td>Classic Tee<div class="var">Blue / Medium</div></td>
          <td class="num">2</td><td class="num">$2.60</td><td class="num">$5.20</td></tr>
      </tbody>
    </table>
  </div>

  <div class="tot"><span>Total</span><span class="num">$5.20</span></div>
</div>
```

One `<tr>` per line item — four short cells. Never merge or drop rows.

## 4. Data → KPI tiles + chart + table

Order: tiles (headline numbers) → chart (the shape) → table (exact values).
Always include the table; it proves the chart is honest.

```html
<div class="grid">
  <div class="card"><div class="cap">Orders</div><div class="kpi">1,284</div></div>
</div>
```

Charts are hand-written inline SVG — no libraries. Plot area x 40→470, baseline
y=170, max height 140. For each value: `h = round(v/max*140)`, `y = 170 - h`.

```html
<svg viewBox="0 0 480 200" role="img" aria-label="Orders by month"
     style="width:100%;height:auto;display:block">
  <line x1="40" y1="170" x2="470" y2="170" stroke="var(--border)"/>
  <rect x="52" y="60" width="34" height="110" rx="4" fill="var(--c1)"/>
  <text x="69" y="187" text-anchor="middle" font-size="11" fill="var(--muted)">Jan</text>
</svg>
```

Line chart: `x = 40 + i*(430/(n-1))`, `y = 170 - v/max*140`, drawn as a
`<polyline>`. Bar for categories, line for time series, donut for a single share.
Only show a delta (`+12%`) if the agent gave one; never color a number that has
no stated direction.

## 5. Other shapes

- **Detail card** — title + status badge, then a two-column `<dl>` of fields.
- **Comparison table** — rows = attributes, columns = options. Only mark a winner
  if the agent named one.
- **Stepper** — an `<ol>` with a coloured dot per stage: `--pos` done,
  `--accent` current, `--border` pending. Use the agent's wording for the state.
- **Schedule** — group by day; time in a fixed-width left column, entry right.

---

# Quality bar

The interface *is* the answer — build something worth looking at.

- **Hierarchy.** One thing matters most per view; make it largest or most
  saturated and let the rest recede. If everything is emphasised, nothing is.
- **One system.** A single radius, shadow, spacing rhythm, type scale, accent.
- **Details.** Align to a grid, right-align numbers with tabular figures, prefer
  whitespace over borders, give text room.
- **Both themes** look deliberate, not one inverted into the other.
- **Responsive** to phone width; wide tables/charts scroll in `.scroll` so the
  page never scrolls sideways.
- **Accessible** — semantic elements, a label per input, visible focus, real
  `alt` text, legible contrast.
- **Restraint** — no decorative gradients, no emoji as icons, no borders where
  spacing will do.

Build one artifact per reply, self-contained (inline CSS/JS, no CDNs, no
frameworks). On a follow-up, update the existing artifact rather than making a
new one.

---

# Authentication

The Phinite tools authenticate via **OAuth** — the user signs into their Phinite
account when they connect the plugin. There is no key to enter and nothing to
paste in chat.

If a tool returns an auth error (`401`, "unauthorized", or a connect/sign-in
prompt), tell the user to **connect the Phinite plugin and sign in**, then retry.

# Tools

| Tool | Use it to |
|------|-----------|
| `discover_agents` | Find agents matching what the user needs (natural-language search). |
| `list_agents` | List every published agent in the workspace. |
| `call_agent` | Send a message to an agent and get its reply. |

## Finding the right agent

- **`discover_agents`** — preferred for routing. Arguments:
  - `query` — natural-language description of what's needed (matched against agent
    name, description, and skills).
  - `status` (optional) — registry status filter, e.g. `LIVE`, `TEST`.
  - `limit` (optional) — max results (default 5).
- **`list_agents`** — no arguments; returns every published agent in the workspace.

Both return agent summaries with **`registry_id`**, `name`, `description`,
`skills`, `status`, `flow_id`. Use the **`registry_id`** as the agent identifier
for `call_agent`. If `discover_agents` returns nothing relevant, fall back to
`list_agents`.

## Talking to an agent — `call_agent`

| Argument | Required | Notes |
|----------|----------|-------|
| `registry_id` | yes | The agent's id from `discover_agents` / `list_agents` |
| `message` | yes | The user's question or task as plain text |
| `task_id` | no | The task id from a previous reply — pass it back to continue |

The reply is **text**. When the agent has started a task, the text ends with a
block like:

```
task_id: <id>
context_id: <id>
state: <TASK_STATE_...>
Pass task_id on the next call_agent to continue this conversation.
```

`task_id` is what keeps the conversation going. Getting it is the goal of the
opening exchange.

### How a conversation works (read carefully)

**1. First call** — send `registry_id` + `message` (no `task_id`). Read the reply.

**2. If the agent needs credentials / setup** — the reply will say it requires
credential setup and include a **link** (e.g. *"Open this link to connect tools
and save config: …"*), and there will be **no `task_id`** yet. Do this:
   - Show the user the link and ask them to complete it.
   - After they confirm they're done, **call `call_agent` again with the same
     `registry_id` and `message`**.
   - **Repeat** until the reply comes back **with a `task_id`**.

**3. Once you have a `task_id`** — pass it as `task_id` on **every** subsequent
`call_agent` to that agent for the rest of the conversation. Never drop it
mid-conversation; that's what keeps the agent's memory.

**4. New conversation** — when the user moves to a genuinely different subject,
**omit** `task_id` to start fresh (then repeat from step 1).

> Only `task_id` is passed back to continue — `call_agent` has no `context_id`
> argument (the server tracks context internally).

# Routing rules

- Route domain questions directly to the matching agent without asking which one.
- If it's unclear which agent fits, `discover_agents` (or `list_agents`), pick the
  best match by `registry_id`, then `call_agent`.
- Relay the agent's answer **completely and faithfully** — never drop or soften
  its content. "Faithfully" means rendering all of it in the right shape, not
  retyping it as prose. See the render table above.
- Never answer from your own knowledge what falls within an agent's domain.

# Error handling

- `401` / connect prompt → not signed in (or session expired); tell the user to
  connect the Phinite plugin and sign in, then retry.
- Agent reply asks for credential setup with a link → see "Talking to an agent"
  step 2 (user completes the link, then re-call until a `task_id` appears).
- Reply marked failed (`TASK_STATE_FAILED` / `TASK_STATE_REJECTED`) → inform the
  user and offer to retry.
- `Unknown registry` / `registry_id and message are required` → you passed a bad
  or missing `registry_id`; re-check it against `list_agents` / `discover_agents`.
- Other errors → relay the message verbatim.
