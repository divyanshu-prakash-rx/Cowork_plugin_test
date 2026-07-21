---
name: phinite-agents
description: >
  Use this skill when the user asks to run, invoke, or talk to a Phinite agent;
  asks "what agents do I have", "what agents are available", "list Phinite agents",
  "find an agent that can do X", "ask Phinite", or routes a domain-specific
  question to a specialized AI agent on the Phinite platform.
metadata:
  version: "4.0.0"
---

# Render before you reply

Check every `call_agent` reply against this table **before** writing anything.
If it matches, **build the UI first**, then add one or two short lines of chat.
Never re-type the agent's data as a bulleted list or a one-line summary.

| If the reply contains | Build |
|---|---|
| 2+ items, products, variants, listings, offers | **Card grid** |
| The agent asks the user to choose or supply anything | **Choice form** |
| A cart, order, bill, line items, prices, totals | **Cart / invoice** |
| Metrics, series, breakdowns | **Tiles + table** (chart only if it adds shape) |
| One record with many fields | **Detail card** |
| Options weighed on the same attributes | **Comparison table** |
| Stages or order/ticket status | **Stepper** |
| Dated or timed entries | **Schedule** |

Plain text only for: a direct answer, a confirmation, a single fact, a yes/no,
one open question with no options, or an error.

## Four rules

1. **Embed it inline.** The UI is an inline artifact in your reply. Never write
   or link a separate `.html` file, and never tell the user to open one.
2. **Never flatten.** Render every item, row, price and id the agent returned.
   Your output is *richer* than its plain text, never poorer.
3. **Never invent.** Only what the agent returned. A missing field is left out —
   no placeholders, no `N/A`, no stock images, no guessed values or totals.
4. **Build small.** Use the classes below; never repeat inline `style=` per item.
   One component, no decorative headers or wrappers. Small means less markup per
   item — **never fewer items**.

## Always give actions

The user should **click, not type**. Every UI ends in obvious next steps.

Add a button for each action the agent makes possible — add to cart, checkout,
pick this option, see more, confirm, cancel. A button copies the exact message
the user would otherwise type, so they just paste it back.

```html
<div id="ok" class="var"></div>
<script>function say(t){navigator.clipboard.writeText(t);
ok.textContent='Copied — paste to continue: '+t}</script>
```

Then `<button class="btn" onclick="say('Add 1 × Blue/Medium to my cart')">Add to cart</button>`.

Rules: label buttons with the action, not "click here". Only offer actions the
agent can actually do. Put the primary action first; make secondary ones
`.btn.alt`. Every card or row that can be acted on gets its own button.

# Base styles

```html
<style>
:root{--bg:#fff;--surface:#fff;--raised:#f6f7f9;--text:#14161a;--muted:#5b636e;
--border:#e3e6eb;--accent:#4f46e5;--pos:#0e8a5f;--neg:#c53434;--warn:#a76a12;
--r:12px;--shadow:0 1px 3px rgba(16,24,40,.10)}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#0f1115;
--surface:#161920;--raised:#1c202a;--text:#e8eaee;--muted:#98a1ae;--border:#282d38;
--accent:#8f8bf7;--pos:#3ddc97;--neg:#ff6b6b;--warn:#e3b341;--shadow:0 1px 2px rgba(0,0,0,.45)}}
:root[data-theme=dark]{--bg:#0f1115;--surface:#161920;--raised:#1c202a;--text:#e8eaee;
--muted:#98a1ae;--border:#282d38;--accent:#8f8bf7;--pos:#3ddc97;--neg:#ff6b6b;
--warn:#e3b341;--shadow:0 1px 2px rgba(0,0,0,.45)}
*{box-sizing:border-box}
body{margin:0;padding:20px;background:var(--bg);color:var(--text);
font:15px/1.55 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.wrap{max-width:900px;margin:0 auto}
h1{font-size:19px;margin:0 0 4px}
.sub{color:var(--muted);font-size:13px;margin:0 0 18px}
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);
padding:14px;box-shadow:var(--shadow)}
.card h3{margin:0 0 6px;font-size:15px}
.grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(230px,1fr))}
.scroll{overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:14px}
th,td{text-align:left;padding:9px 11px;border-bottom:1px solid var(--border)}
th{color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.03em}
tr:last-child td{border-bottom:0}
.num{text-align:right;font-variant-numeric:tabular-nums}
.price{font-size:19px;font-weight:650;font-variant-numeric:tabular-nums}
.was{color:var(--muted);text-decoration:line-through;font-size:13px;margin-left:6px}
.var,.cap{color:var(--muted);font-size:12px}
.cap{text-transform:uppercase;letter-spacing:.03em}
.kpi{font-size:25px;font-weight:650;font-variant-numeric:tabular-nums}
.tot{display:flex;justify-content:space-between;padding:10px 0 0;
border-top:1px solid var(--border);font-size:17px;font-weight:700}
.badge{display:inline-block;padding:3px 9px;border-radius:999px;font-size:12px;
font-weight:600;background:var(--raised);color:var(--muted);border:1px solid var(--border)}
.badge.pos{color:var(--pos)}.badge.neg{color:var(--neg)}.badge.warn{color:var(--warn)}
.thumb{aspect-ratio:4/3;background:var(--raised);border-radius:8px;overflow:hidden;margin:0 0 10px}
.thumb img{width:100%;height:100%;object-fit:cover;display:block}
.opt{display:inline-block;margin:0 8px 8px 0;cursor:pointer}
.opt input{position:absolute;opacity:0;width:0}
.opt span{display:inline-block;padding:7px 14px;border:1px solid var(--border);
border-radius:999px;background:var(--raised);font-size:14px}
.opt input:checked+span{background:var(--accent);color:#fff;border-color:var(--accent)}
.opt input:focus-visible+span{outline:2px solid var(--accent);outline-offset:2px}
.btn{margin-top:10px;padding:8px 14px;border:0;border-radius:8px;background:var(--accent);
color:#fff;font:inherit;font-weight:600;cursor:pointer}
.btn.alt{background:var(--raised);color:var(--text);border:1px solid var(--border)}
.lbl{display:block;font-size:13px;color:var(--muted);margin:0 0 6px}
.inp{padding:9px 11px;border:1px solid var(--border);border-radius:8px;
background:var(--raised);color:var(--text);font:inherit}
fieldset{border:0;padding:0;margin:0 0 14px}
legend{font-size:13px;color:var(--muted);padding:0 0 6px}
a{color:var(--accent)}
</style>
```

Copy only the rules you use. **Images:** use the URLs the agent returned, wrapped
in `.thumb`, with `onerror="this.closest('.thumb').remove()"` so a blocked image
collapses cleanly. Never invent an image URL.

# Components

**Card grid** — repeat these few lines per item, identical structure each time:

```html
<article class="card">
  <div class="thumb"><img src="URL" alt="Blue / Medium"
       onerror="this.closest('.thumb').remove()"></div>
  <h3>Blue / Medium</h3>
  <div><span class="price">$2.60</span><span class="was">$3.20</span></div>
  <span class="badge pos">In stock</span>
  <button class="btn" onclick="say('Add 1 × Blue/Medium to my cart')">Add to cart</button>
</article>
```

**Choice form** — when the agent names options they must be clickable. 2–5 options
→ chips; 6+ → `<select>`; many allowed → checkboxes; quantity → `number`; open
text → `input`. Ask only what the agent asked; if its list ends in "etc." add an
**Other** chip. Gather everything in one form, then send answers back in a single
`call_agent` with `task_id`.

```html
<form class="card" id="f" onsubmit="return false">
  <fieldset><legend>Color *</legend>
    <label class="opt"><input type="radio" name="Color" value="Blue" required><span>Blue</span></label>
    <label class="opt"><input type="radio" name="Color" value="Red"><span>Red</span></label>
  </fieldset>
  <label class="lbl" for="q">Quantity *</label>
  <input class="inp" id="q" name="Quantity" type="number" min="1" value="1" style="width:100px">
  <button type="button" class="btn" onclick="cp()">Done — copy answers</button>
</form>
<script>function cp(){const v={};
document.querySelectorAll('#f input,#f select,#f textarea').forEach(e=>{
 if((e.type=='radio'||e.type=='checkbox')&&!e.checked)return;
 const x=(e.value||'').trim(); if(x&&e.name)v[e.name]=v[e.name]?v[e.name]+', '+x:x});
say(Object.keys(v).map(k=>k+': '+v[k]).join(', '))}</script>
```

The `!e.checked` guard matters — without it every option is copied, not the chosen one.

**Cart / invoice** — one `<tr>` per line item; never merge or drop rows. Keep the
cart id and variant text.

```html
<div class="card">
  <h1>Your cart</h1><p class="sub">cart_1cf221341ffc</p>
  <div class="scroll"><table>
    <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Unit</th><th class="num">Subtotal</th></tr></thead>
    <tbody><tr><td>Classic Tee<div class="var">Blue / Medium</div></td>
      <td class="num">2</td><td class="num">$2.60</td><td class="num">$5.20</td></tr></tbody>
  </table></div>
  <div class="tot"><span>Total</span><span class="num">$5.20</span></div>
  <button class="btn" onclick="say('Checkout my cart')">Checkout</button>
  <button class="btn alt" onclick="say('Add more items to my cart')">Keep shopping</button>
</div>
```

**Data** — tiles then table: `<div class="card"><div class="cap">Orders</div><div
class="kpi">1,284</div></div>`. Add a chart only when the shape matters, as
hand-written inline SVG (no libraries): plot x 40→470, baseline y=170, `h =
v/max*140`, `y = 170-h`; bars as `<rect>`, series as `<polyline>`.

**Others** — *Detail card*: title + badge + two-column `<dl>`. *Comparison*: rows
= attributes, columns = options. *Stepper*: `<ol>` with a dot per stage (`--pos`
done, `--accent` current, `--border` pending). *Schedule*: grouped by day, time
left, entry right.

# Quality

One clear focal point per view; one radius, shadow and accent throughout;
right-aligned tabular numbers; both themes deliberate; fluid to phone width with
wide tables in `.scroll`; labels and visible focus on every input; no gradients,
no emoji icons, no borders where spacing will do.

# Tools

| Tool | Use it to |
|------|-----------|
| `discover_agents` | Find agents matching a need. Args: `query`, `status`, `limit`. |
| `list_agents` | List every published agent (no args). |
| `call_agent` | Send a message to an agent. |

Both search tools return `registry_id`, `name`, `description`, `skills`,
`status`, `flow_id`. Use **`registry_id`** for `call_agent`. If
`discover_agents` finds nothing relevant, fall back to `list_agents`.

Route domain questions straight to the matching agent without asking which one.
Never answer from your own knowledge what belongs to an agent's domain.

## `call_agent`

| Argument | Required | Notes |
|---|---|---|
| `registry_id` | yes | Agent id from discover/list |
| `message` | yes | The task as plain text |
| `task_id` | no | From a previous reply — pass back to continue |

The reply is text, ending with `task_id`, `context_id` and `state` once a task
has started. Only `task_id` is passed back (there is no `context_id` argument).

1. **First call** — `registry_id` + `message`, no `task_id`.
2. **If it needs credentials** — the reply says setup is required and includes a
   link, with **no `task_id`**. Show the user the link; after they confirm, call
   again with the same `registry_id` and `message`. **Repeat until a `task_id`
   appears.**
3. **Once you have a `task_id`** — pass it on every later call to that agent.
   Never drop it mid-conversation; it is the agent's memory.
4. **New subject** — omit `task_id` to start fresh.

# Auth and errors

Authentication is **OAuth** — the user signs in when connecting the plugin;
there is no key to paste.

- `401` / connect prompt → tell the user to connect the plugin and sign in, then retry.
- Credential-setup link → step 2 above.
- `TASK_STATE_FAILED` / `TASK_STATE_REJECTED` → tell the user, offer to retry.
- `Unknown registry` / missing args → re-check `registry_id` against list/discover.
- Anything else → relay verbatim.
