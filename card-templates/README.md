# Your card templates

Whatever is in this folder becomes the set of cards the app offers - on your computer
*and* on your live site.

## Two ways to add a card

### A. Just drop in two SVGs (easiest)

Name them so they pair up, then restart the app:

```
my-card-front.svg
my-card-back.svg
```

The card is named from the filename, so `kasba-rto-front.svg` becomes **Kasba RTO**.
Add the details (name, dates, photo) in the app afterwards.

### B. A finished template file

In the app, set up the details and positions, then keep the card for good:

- **Keep for good** (top right) writes the `.json` in here for you and rebuilds. It only
  shows up when you are running the app on your own computer.
- **Save to app** downloads the `.json` instead, for you to move in by hand - use this
  from the live site, where the app cannot write its own files.

A `.json` beats an SVG pair of the same name, so once you have saved one you can delete
the two SVGs.

## Adding the details

Your artwork usually already prints the labels ("Owner Name", "Chassis No."). You only
need boxes for the **values**. In the template designer press **List**, paste your labels
one per line, and drag each box onto the right spot.

If your SVG still has real text in it, **Import text from artwork** turns those words into
editable boxes automatically. That only works when the text was exported as text - if the
design was flattened to a picture, use **List** instead.

## Replacing artwork with a newer version

Save the new SVG over the old one, **keeping the filename exactly the same**, then
restart. The app notices the file changed and refreshes that card everywhere - no need
to clear site data. Cards people have already made keep their details and positions,
and just pick up the new artwork.

Rename the file instead (`kasba-rto-front.svg` to `kasba-rto-v2-front.svg`) and it counts
as a brand new card: the old one is removed, and anything built on it says
**Template missing**. So overwrite in place.

Careful if you have already pressed **Save to app** for that card: the `.json` here wins,
and your new SVG is ignored. The build tells you - `. Using the .json for "Kasba RTO"
(SVG pair ignored)`. Either upload the new artwork in the designer and save a fresh
`.json`, or delete the `.json` to go back to the SVG pair.

One catch: refreshing replaces the shipped card completely, so any changes you made to it
inside the app go too. Press **Duplicate** on the template first if you want to keep them -
copies are yours and are never overwritten.

## Notes

- To remove a card, delete its files here and restart.
- Changes need a restart (`Ctrl+C`, then `npm run dev`) or a redeploy to show up.
  `npm run templates` rebuilds them without restarting anything else.
- Cards should be 85.6 x 54 mm. A viewBox of `0 0 856 540` or `0 0 1011 638` both work -
  the artwork is scaled to fit.
- **Backup -> Reinstall built-in templates** in the app puts the shipped versions back.

## Publishing

```bash
git add -A
git commit -m "Add my card template"
git push
```

Vercel redeploys on its own.
