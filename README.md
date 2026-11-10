# PVC Card Maker

A simple web studio for making **PVC licence and ID cards**. Pick a template, type the
details, drag them into place, then print at exact card size.

Built with Next.js 15 + Tailwind. Everything you create is stored **inside your browser**,
so there is no database to set up and nothing is uploaded anywhere.

The cards the app offers come from the **`card-templates/`** folder. Six RTO designs ship
with it — Alipore, Hooghly, Kasba, Kolkata, Salt Lake and South 24 Parganas — and you add
your own by dropping files in there.

---

## What you can do

| | |
|---|---|
| **Sign in** | A username and password guard the whole app. You can change them from inside the app once a small database is connected — see below. |
| **Choose a template** | Every card in `card-templates/` shows up here. Each has separate **front** and **back** artwork stored as SVG. |
| **Fill in the form** | The form is generated from the template, so each card asks for exactly the right details. |
| **See it live** | The preview shows the real card as you type. |
| **Drag things around** | Click any detail on the preview and drag it. Use the corner dots to resize, or the arrow keys to nudge — see [keyboard shortcuts](#keyboard-shortcuts). |
| **Restyle anything** | Font, size, **weight** (Light → Black), *italic*, colour, alignment, letter spacing, line height, UPPERCASE, rotation, background and borders. |
| **Add photos & signatures** | Upload a photo, signature or QR image into any image box. |
| **Crop before it lands** | Every picture opens in a cropper first — drag out the area you want, turn it in 90° steps, or snap it to the shape of the box. |
| **Add your own items** | On any card, drop in extra **text**, **pictures**, a **QR code** generated from a link, or a **signature you draw** — without touching the template. |
| **Items list** | A panel lists everything on the side you are looking at, so you can pick a detail by name, hide one you don't need, or delete something you added. |
| **Undo anything** | **Ctrl+Z** steps back through moves, restyles and edits; **Ctrl+Y** puts them back. |
| **Print an A4 sheet** | Lay many cards on one A4 page, choose fronts, backs or both, adjust how many fit across and down, the gaps and the margins, and print them all in one go. |
| **Fixed template images** | Give an image box a picture in the designer (logo, emblem, hologram) and it appears on every card made from that template. |
| **Print** | Print at exact CR80 size (85.6 × 54 mm), or on an A4 sheet with cut marks. |
| **Export** | Download each side as a 300 DPI PNG or as a vector SVG. The fonts travel inside the file, so it looks the same anywhere. |
| **Manage templates** | Add, edit, duplicate or delete templates. Upload new front/back SVG artwork at any time. |
| **Keep a card for good** | **Keep for good** in the designer writes your card into `card-templates/`, so clearing your browser cannot lose it. Available when you run the app on your own computer. |
| **Import text from artwork** | If your SVG still has real text in it, one click turns every word into an editable, draggable detail — same position, font, size and colour. |
| **Add details in bulk** | Press **List** in the designer, paste your labels one per line, and get a box for each. |
| **Draw lines** | In the template designer's **Details**, choose **Line**. Set its length, line width, colour and angle, or drag either endpoint to stretch and turn it while the other end stays fixed. Lines are saved with the template and included in prints and exports. |
| **Backup** | Download everything to one file and restore it on another computer — either merged into what you have, or replacing it. |

---

## Running it on your own computer

```bash
npm install
npm run dev
```

Open <http://localhost:3000> and sign in with **admin** / **pvc2024**.

To use your own sign-in details locally, copy `.env.example` to `.env.local` and edit it.

`npm run dev` and `npm run build` both rebuild the built-in cards from `card-templates/`
first. After adding or changing a file there, restart the dev server — or run
`npm run templates` on its own.

---

## Putting it online with Vercel

1. Push this folder to a GitHub repository.
2. Go to [vercel.com](https://vercel.com) → **Add New… → Project** → pick that repository.
3. Vercel detects Next.js automatically — just press **Deploy**.
4. Open **Settings → Environment Variables** and add these three, then redeploy:

| Name | What to put | Why |
|---|---|---|
| `APP_USERNAME` | the username you want | your sign-in name |
| `APP_PASSWORD` | a strong password | your sign-in password |
| `AUTH_SECRET` | a long random string (32+ characters) | signs the login cookie |

> **All three are required once deployed.** Without them the sign-in page explains
> what is missing and refuses to let anyone in — it will *not* fall back to
> `admin` / `pvc2024`. Those defaults exist only for `npm run dev` on your own
> machine, and since this source is readable by anyone, a live site that relied on
> them could be opened by anyone too.

Generate a secret with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

---

## Changing your password later

Out of the box the password lives in `APP_PASSWORD`, so changing it means editing
that variable in Vercel and redeploying.

If you would rather change it **inside the app**, add a small free database — this
is a one-off, five-minute job:

1. In your Vercel project open **Storage → Marketplace → Upstash for Redis** →
   **Create**. Accept the free plan and connect it to this project. Vercel adds
   `KV_REST_API_URL` and `KV_REST_API_TOKEN` for you.
2. Add one more variable yourself, **`RECOVERY_KEY`** — a long random string, kept
   somewhere safe. This is your spare key for a forgotten password.
3. Redeploy.

You then get:

- **Backup → Change your password** — change the username and password while signed
  in. It applies everywhere at once.
- **Forgotten your password?** on the sign-in page — asks for your `RECOVERY_KEY`,
  then lets you set a new password without being signed in.

Passwords are stored hashed (scrypt, with a unique salt), never in plain text.
Sign-in is limited to 10 tries per 15 minutes, and password reset to 5 per hour,
per IP address.

If you skip this, both options simply explain that they are switched off — nothing
breaks.

> **Keep `RECOVERY_KEY` safe.** Anyone who has it can set a new password. If you
> lose both it and your password, you can still reset `APP_PASSWORD` in Vercel and
> clear the stored credentials from Upstash.

---

## Where your cards are stored

Templates and cards live in your browser's local database (IndexedDB) on the computer you
use. That means:

- Nothing is sent to a server — your data stays private.
- Cards made on your laptop **won't** appear on your phone.
- Clearing "site data" for the site erases them.

So use **Backup → Download backup file** regularly. To move to a new computer, download the
backup there and use **Replace everything**.

---

## Adding a built-in card

Whatever sits in the **`card-templates/`** folder becomes the set of cards the app
offers — on your computer *and* on your live site. There is a shorter guide in
[`card-templates/README.md`](card-templates/README.md).

> **The filename decides the card's identity.** `kasba-rto-front.svg` becomes the card
> **Kasba RTO** with the internal id `tpl_kasba_rto`. Keep that name stable — it is what
> ties saved cards to their template.

### 1. Draw the artwork

Draw the **front** and the **back** in Illustrator, Inkscape, Figma or Canva and export
each as an **SVG**.

- Use a canvas of **85.6 × 54 mm**, or set the SVG `viewBox` to `0 0 856 540`
  (10 units = 1 mm). `0 0 1011 638` works too — artwork is scaled to fit either way.
- Leave blank space where the name, photo, dates and so on will sit.
- **Keep "Outline text" switched off** in Figma's SVG export, so the words stay as real
  text. If an effect (background blur, an unusual blend mode, a texture fill) forces
  Figma to flatten the frame into a picture, remove that effect first — otherwise you
  get one huge bitmap with nothing editable inside it.

### 2. Drop the pair into `card-templates/`

Name them so they pair up, then restart:

```
my-card-front.svg
my-card-back.svg
```

```bash
npm run templates   # or just restart `npm run dev`, which does this for you
```

A card with no back gets a blank one for now, so you can start with just a front.

### 3. Add the details

Open the card in **Templates** and give it the boxes people will fill in:

- **Import text from artwork** turns words already in your design into editable details,
  in the same place, font, size and colour. It tells you how many it can see, and says so
  if the artwork was flattened.
- **List** takes your labels pasted one per line and makes a box for each — the way to go
  when the text was outlined.
- **Text** / **Image** add them one at a time.
- An image box left empty asks for a photo on every card; **Upload from computer** pins a
  fixed picture (logo, emblem, hologram) onto every card made from the template.
- Give each detail a clear **label** — that is the wording the person filling the card sees.

### 4. Make it permanent

A card you build in the app lives in your browser, so clearing site data would take it
with it. Two ways to keep it for good:

- **Keep for good** (top right) writes the card straight into `card-templates/` and
  rebuilds, in one press. It appears only when the app can write its own files — that is,
  when you are running it on your own computer. Press it again after any change; renaming
  the card moves its file rather than leaving two behind.
- **Save to app** downloads the `.json` for you to move into `card-templates/` yourself,
  then restart. This is the route to use from the hosted site, where the app's own files
  are read-only.

Either way a `.json` beats an SVG pair of the same name, so you can delete the two SVGs
once you have saved one.

To publish: `git add -A`, `git commit -m "Add my template"`, `git push`. Vercel redeploys
by itself. To remove a card, delete its files and restart — it disappears from every
browser the next time the app is opened.

---

## Swapping in newer artwork

Redrawn a card? You do not need to rebuild it or ask anyone to clear their browser.

1. Export the new SVG exactly as above.
2. **Save it over the old file, keeping the filename identical.**
3. `npm run templates` (or restart the dev server). For the live site, commit and push.

> **If a `.json` for that card is sitting in the folder, your new SVG is ignored.** The
> build says so — `. Using the .json for "Kasba RTO" (SVG pair ignored)`. Either open the
> card in the designer, upload the new artwork there and press **Save to app** for a fresh
> `.json`, or delete the `.json` to hand control back to the SVG pair. Watch the build
> output and check your card is listed as coming `from …-front.svg`.

Each build stamps a card with a fingerprint of its artwork, size, name and details. Next
time anyone opens **My cards**, **Templates** or **Backup**, the app compares fingerprints
and quietly refreshes any card whose file has changed — in place, keeping the same id.
Saved cards keep every value you typed and every box you moved, and simply show the new
artwork.

Two things worth knowing before you do it:

| Watch out for | What happens |
|---|---|
| **Renaming the file** | `kasba-rto-front.svg` → `kasba-rto-v2-front.svg` reads as a *different* card. The old one is deleted from every browser, and cards built on it report **Template missing**. Overwrite in place instead. |
| **Edits you made to a built-in in the app** | A refresh replaces the shipped card wholesale, so in-app tweaks to it are lost. Press **Duplicate** on the template first if you want to keep them — copies are not built-in and are never touched. |

Changing only the positions or the details — not the artwork — works the same way: edit in
the designer, **Save to app**, and replace the `.json` in `card-templates/`. Typed values
survive as long as a detail keeps its **key**; per-card restyling is tied to the detail's
id, so details you delete and recreate come back with default styling.

Need to undo an experiment? **Backup → Reinstall built-in templates** puts the shipped
versions back without touching templates you made yourself.

---

## Doing it yourself from the command line

Everything above, without touching the app — the routine to follow when someone hands you
a batch of SVGs. Commands are PowerShell; on macOS or Linux only the copying differs
(`cp new/Alipore-front.svg card-templates/alipore-rto-front.svg`).

### 1. Look at what you were given

```powershell
$new = "C:\path\to\the\new\svgs"
Get-ChildItem $new -Filter *.svg | ForEach-Object {
  $t = Get-Content $_.FullName -Raw
  [pscustomobject]@{
    KB      = [math]::Round($_.Length / 1KB)
    ViewBox = [regex]::Match($t, 'viewBox="([^"]+)"').Groups[1].Value
    Text    = ([regex]::Matches($t, '<text')).Count
    Images  = ([regex]::Matches($t, 'data:image')).Count
    Active  = ([regex]::Matches($t, '<script|\son\w+\s*=')).Count
    File    = $_.Name
  }
} | Format-Table -AutoSize
```

| Column | What you want | Why it matters |
|---|---|---|
| `ViewBox` | `0 0 856 540` or `0 0 1011 638` | Any other shape gets stretched to card size. |
| `Text` | either is fine | `0` means the artwork was outlined, so add details with **List**. Above `0`, **Import text from artwork** will do it for you. |
| `Active` | `0` | `<script>` or an `onload=` handler has no business in card artwork. |
| `KB` | under a few thousand | Every card is downloaded by the browser; the whole set is fetched at runtime. |

### 2. Decide each file's name before you copy anything

**This is the step that matters.** The filename becomes the card's id, so reusing a name
updates that card, while a new name creates a new one. Cards already saved by people
follow the id.

| Keep this name | To update this card |
|---|---|
| `alipore-rto-front.svg` / `alipore-rto-back.svg` | Alipore RTO (`tpl_alipore_rto`) |
| `hooghly-rto-front.svg` / `hooghly-rto-back.svg` | Hooghly RTO (`tpl_hooghly_rto`) |
| `kasba-rto-front.svg` / `kasba-rto-back.svg` | Kasba RTO (`tpl_kasba_rto`) |
| `kolkata-rto-front.svg` / `kolkata-rto-back.svg` | Kolkata RTO (`tpl_kolkata_rto`) |
| `salt-lake-rto-front.svg` / `salt-lake-rto-back.svg` | Salt Lake RTO (`tpl_salt_lake_rto`) |
| `south-24-parganas-rto-front.svg` / `south-24-parganas-rto-back.svg` | South 24 Parganas RTO (`tpl_south_24_parganas_rto`) |

Adding a card instead? Pick a name nothing else uses — `my-card-front.svg` and
`my-card-back.svg` become **My Card** with the id `tpl_my_card`.

### 3. Copy them in

Spell the mapping out rather than relying on sort order, and check each copy landed:

```powershell
$map = @{
  "Alipore-front.svg"   = "alipore-rto-front.svg"
  "Alipore-back.svg"    = "alipore-rto-back.svg"
  # ...one line per file
}
foreach ($pair in $map.GetEnumerator() | Sort-Object Value) {
  $from = Get-ChildItem $new -Filter "*$($pair.Key)" | Select-Object -First 1
  if (-not $from) { "MISSING SOURCE: $($pair.Key)"; continue }
  $to = Join-Path "card-templates" $pair.Value
  Copy-Item $from.FullName $to -Force
  $ok = (Get-FileHash $from.FullName).Hash -eq (Get-FileHash $to).Hash
  "{0} {1,-24} <- {2}" -f $(if ($ok) { "OK  " } else { "FAIL" }), $pair.Value, $from.Name
}
```

### 4. Rebuild

```powershell
npm run templates
```

Read the output. Each card should say `from <your>-front.svg`. Two lines mean trouble:
`! Ignored …` (the name does not end in `-front.svg` / `-back.svg`) and
`. Using the .json for … (SVG pair ignored)` — see the warning above.

### 5. Check the ids survived and the fingerprints moved

```powershell
node -e "for (const c of require('./public/builtin-templates.json')) console.log(c.id.padEnd(20), c.contentHash, c.name)"
```

Run it before and after. **The ids must be identical** — a changed id means you renamed a
card by accident and orphaned everyone's saved cards. **The fingerprints must differ** for
the cards you touched, since that is what tells browsers to refresh; an unchanged
fingerprint means the file never actually landed.

### 6. Confirm they are still valid SVG

The build happily writes out a truncated file, so check before trusting it:

```powershell
Get-ChildItem card-templates\*.svg | ForEach-Object {
  try { (New-Object System.Xml.XmlDocument).Load($_.FullName); "OK   $($_.Name)" }
  catch { "FAIL $($_.Name) - $($_.Exception.Message)" }
}
```

### 7. Commit

```powershell
git add card-templates
git commit -m "Update card artwork"
git push
```

`public/builtin-templates.json` is rebuilt on every `npm run dev` and `npm run build`, and
is deliberately left out of git — never commit it.

---

## Keyboard shortcuts

These work in the card editor and the template designer, whenever you are not typing in a box.

| Key | What it does |
|---|---|
| **Arrow keys** | Nudge the selected item by 0.2 mm |
| **Shift + arrow** | Move it a whole 1 mm |
| **Alt + arrow** | Fine-tune by 0.05 mm |
| **Delete** / **Backspace** | Remove the selection |
| **Esc** | Deselect |
| **Ctrl+Z** | Undo (**⌘Z** on a Mac) |
| **Ctrl+Shift+Z** or **Ctrl+Y** | Redo |

---

## Printing tips

In the browser print dialog:

- **Margins:** None
- **Scale:** 100% (turn off "Fit to page")
- **Background graphics:** on

**A4 sheet** is the fastest way to produce cards: choose whether to lay out fronts, backs
or both, pick how many fit across and down (or press **Fill the page**), tighten the gaps
and margins, and print them all together. It tells you how many land on a sheet and how
many sheets you need. Cut marks show where to trim. The on-screen zoom never affects the
print — cards always come out at a true 85.6 × 54 mm.

**One card** prints a single card on card-sized paper, for dedicated card printers.

To print several cards at once, tick **Add to sheet** on each one in **My cards**, then
press **Print N on one sheet**.

---

## Project layout

```
card-templates/           your card artwork — drop SVG pairs or .json files here
scripts/
  build-templates.mjs     turns that folder into public/builtin-templates.json
public/
  fonts/                  the fonts the app ships, so cards look the same everywhere
src/
  app/
    login/                sign-in screen, with "forgotten your password?"
    api/auth/             login, logout, change password, reset password, status
    (app)/dashboard/      your saved cards
    (app)/templates/      template list and the template designer
    api/templates/builtin writes a card into card-templates/ when run locally
    (app)/cards/[id]/     the card editor (form + live preview + styling)
    (app)/settings/       backup, restore and your password
    print/[id]/           final preview, A4 sheet layout and printing
  components/
    CardCanvas.tsx        renders a card and handles dragging/resizing
    CardDetailsForm.tsx   the form built from the template's details
    StylePanel.tsx        font, colour, position and box controls
    ElementToolbar.tsx    add text, a picture, a QR code or a signature
    LayerList.tsx         everything on this side, to pick, hide or delete
    ImageCropper.tsx      crop, turn and fit a picture before it goes in
    SignaturePad.tsx      draw a signature with the mouse or a finger
    SheetControls.tsx     how many cards fit on the A4 sheet
    SheetPreview.tsx      what that sheet will look like
    TemplatePicker.tsx    template chooser
    AppShell.tsx          the navigation around every page
    ChangePasswordPanel.tsx, ForgotPasswordForm.tsx, ColourField.tsx, ConfirmDialog.tsx
  lib/
    types.ts              data model
    db.ts                 browser database (IndexedDB)
    seed-templates.ts     loads the built-in cards the build script produced
    render.ts             SVG sanitising and style → CSS
    export.ts             SVG and 300 DPI PNG export
    embed-fonts.ts        packs the font bytes into exported SVGs
    fonts.ts              works out which weights a font can really draw
    import-text.ts        turns text in your artwork into editable details
    image.ts, qr.ts       picture handling and QR generation
    sheet.ts              how many cards fit on a page
    shortcuts.ts          keyboard handling
    auth.ts, credentials.ts, kv.ts   sign-in, hashed passwords, optional storage
  middleware.ts           keeps every page behind the login
```
