# Shorty: notes

A baby emperor penguin plush wearing a red fleece vest with a purple zipper and collar.

## Measurements

- Height: **6¼ in**, measured from the ground to the top of his head fur.
- The model is built 4.0 units tall in `shorty.js` and scaled by `HEIGHT_INCHES / MODEL_HEIGHT`.
  To correct the height, change `HEIGHT_INCHES` only; every proportion stays the same.

## Look decisions

These were settled by comparing the model with photos of the real plush.

**Head**
- Not a sphere: narrower side to side than front to back, a little wider at the cheeks.
- Black head with two cream patches on the sides of the face. A black stripe runs down the forehead
  between the patches, and black surrounds the beak, reaching a little into the patches.
- Under the beak the black is a narrow band; below it the cream patches join into a white chin.
- Eyes are glossy black beads set back on the sides of the head, inside the cream patches, with clear
  white between each eye and the black center.
- Head fur is soft, rounded clumps lying back toward the back of the head, never spiky, and never
  crossing into the cream patches.

**Beak**
- Soft gray felt bill, flat and wide, thicker through the middle than at the corners.
- A mouth slit separates the upper bill from the lower bill; the lower bill is its own part (`jaw`).

**Body and fur**
- Chest and flippers are a mid gray made of mixed gray and white fibers, with a gradient.
  The chest should be at least as dark as the flippers.
- Flippers are rounded paddles with long, soft, plush hair combed toward the tips.
- The chest shows only through the open collar and the armholes. Near the chin the chest hair is
  brushed upward and mixes gray and cream, so the border with the white chin is ragged and uneven,
  not a straight line.
- Feet are black and wide but hidden under the vest (`footL`, `footR` exist with `visible = false`).

**Vest**
- Big and baggy: a puffy bell shape, widest near the hem, resting on the ground over his feet,
  with soft horizontal creases.
- Stand-up collar with purple binding, open in a V that closes at the zipper slider partway down.
- Chunky purple zipper; the pull tab has a small rectangular hole near the bottom.
- Oval armholes with rolled red edges, extending further down than up so the gray body shows
  around and below each flipper. Flippers attach to the body, not the vest, centered in the opening.
- Chest patch on his left side: a dark green patch with cream scribbles that suggest lettering.
  It deliberately does **not** reproduce the real brand logo.

## Posable parts

`body`, `neck`, `head`, `beak`, `jaw`, `flipperL`, `flipperR`, `footL`, `footR`.
Flippers pivot at the shoulder; the head pivots at the neck.
