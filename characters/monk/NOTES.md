# Monk: notes

A squirrel monkey plush. The model is currently Monk **without his fleece**. The blue pullover will be
added back as its own layer once the body and head are right. The earlier pullover work (posture with
the fleece on, collar, V-neck and trim) is saved outside the repo for reference.

## Measurements

- Height: **7¾ in** (measured), from the ground to the top of his head, sitting.
- From the ruler photos:
  - Head: cap about 2½–2⅔ in wide, about 3 in across the sideburns, about 2⅗ in deep.
  - The head runs from the bottom of the muzzle (about 4¾ in up) to the top, about 3 in.
  - Eyes about 0.9 in apart, center to center; each about ½ in across.
  - Muzzle about 1¾–1⅞ in wide and 1½ in tall.
  - Ears about 1 in cups.
  - Shoulders at about 3¼ in; arms about 1⅛ in thick.
- The model is built in real inches. After building, `monk.js` measures the top of the head and scales
  the whole model so it comes out at `HEIGHT_INCHES`. To correct the height, change `HEIGHT_INCHES` only.

## Posture

- He leans forward onto his arms. The body is a pear shape, widest at the hips, and shifts forward as
  it rises (`ZC`), so the back slopes and the chest and head sit well ahead of the hips.
- The arms are fairly short. There are no visible shoulders: each arm starts inside the chest and
  grows smoothly out of the body, then angles forward (about 13°) and a little outward down to the hands,
  which rest flat on the ground with the fingers forward. He leans on them.
- Brown haunches sit at his sides, with long pink feet splayed out and forward.
- The head sits right on the body, ahead of the shoulders, with no visible neck.
- The tail comes out low at the back and curls around his right side on the ground.

## Look decisions

**Body**
- Golden-brown shaggy fur.
- A shaggy cream bib runs from under the chin down the throat and narrows to a V pointing down between
  the arms. Its edges are ragged.
- Arms: the top third is body brown, blending into the body; the lower two thirds are a bright mustard
  yellow, with a ragged line between the two.
- Paws are warm pinkish-beige mittens with toe bumps, a small thumb on the inner side, and stitched
  creases. The hands come straight out of the ends of the arms. The feet are fairly long (about 1½ in) and narrow.
- Tail: long and thick, brown for the first half and black for the second half.

**Head**
- Big, about as deep as it is wide, with a round dome.
- Tan cap with a fairly low hairline. A peach mask has two rounded lobes over the eyes, with a short
  widow's peak of tan between them that stops above the eyes. Peach continues down the cheeks to the muzzle.
- Eyes are big doll eyes: a large black pupil inside a smoky clear ring, close together, sitting right on
  top of the muzzle.
- Sideburns are long, wispy beige yarn with a hint of lavender on the cheeks, from beside the eyes back
  toward the ears and down the jaw, swept back. Cream locks hang under the jaw onto the bib.
- Ears are pinched cups (about ⅞ in) on the back sides of the head, a little above eye level, sticking
  out to the sides. Each is squeezed top-to-bottom into a wide, low cup, with a small opening inside a
  thick rolled rim, facing out and a little forward. The skin is the same pink as the paws and face,
  a touch darker on the back. A cream yarn fringe runs all the way around the rim, top included.

**Muzzle**
- Gray felt shield, about 1⅝ in wide: broad across the top just under the eyes, with rounded corners,
  tapering to a rounded chin that tucks back underneath. The front leans forward at the top. It sticks
  out about ½ in past the eyes and grows out of the lower face.
- Stitched pentagon nose outline high on the muzzle, pointing down. No smile.

## Posable parts

`body`, `torso`, `neck`, `head`, `muzzle`, `earL`, `earR`, `armL`, `armR`, `forearmL`, `forearmR`,
`handL`, `handR`, `legL`, `legR`, `footL`, `footR`, `tail`.
The torso (upper body, arms and head) pivots at the hips. The arms pivot at the shoulder, the forearms
at mid-arm, the head at the neck, the legs at the hip, and the tail at its base.

## Test animation (Wiggle)

`idle(t)` loops every 7 seconds. He sits back slightly and raises his left arm up, forward and out at
the shoulder, with the elbow bent so the forearm stands upright and the palm faces forward. He waves
by rocking the forearm side to side from the elbow, the hand following a beat behind, then lowers the
arm back to the ground. Meanwhile his head tilts and turns, his ears twitch and his tail sways.

## Next up: put the blue fleece back on

The body and head are settled for now. The next step is to re-add his fleece pullover as a separate layer
over this body, and to make it switchable.

**Toggle button.** Add a **Fleece** button to Monk's viewer toolbar, next to **Wiggle**, that shows and hides
the pullover. Plan:
- Build every pullover piece (body shell, sleeves, collar, trim, chest patch) inside one `fleece` group in
  `monk.js`, and return it from `buildMonk()` (for example as `outfits: { fleece }`). The sleeves should be
  children of the arm groups so they follow the arms when he waves.
- Add `<button id="t-fleece" aria-pressed="true">Fleece</button>` to `characters/monk/index.html`, and wire it
  in that page's script to set `fleece.visible`. Keep `shared/viewer.js` generic: Shorty has no outfit toggle.
- While the fleece is on, the fur under it can stay as is. Hide any hair that pokes through, if needed, rather
  than reshaping the body.

**Reference.** `archive/monk-fleece-v1.js` is the first version of Monk, built wearing the pullover. That
version had a different, more hunched posture, so reuse its pullover techniques, not its numbers:
- Shell: elliptical sections around a spine, with an open V-neck (`gap`), soft folds (`wrinkle`), and the
  front hanging loose over the chest (`BAG`) so the V sits in front of the sleeves.
- Trim: narrow teal strips (about ⅕ in, `TRIM_W`) down both edges of the V, the wearer's right lapping over
  the left at the bottom, with a stitch line.
- Collar: a short teal band, a little higher at the back (`COL_H`), open at the front, with small points
  folding out.
- Sleeves: baggy, with the fleece bunched in rolls at the cuffs and the paws coming out.
- Chest patch on his left, next to the V: a small landscape over scribbled red-and-cream marks that suggest
  lettering. It must not reproduce the real brand name or logo.

**Look notes from the photos with the fleece on.** Muted royal-blue fleece (the renderer brightens colors,
so pick darker values than the photo). The pullover is roomy and comes down over the haunches at the back.
The arms stay mostly covered by the sleeves, with the cuffs bunched just above the paws. Wearing it, he
looks a little more hunched, because the fleece bulks up his back and shoulders, but the body underneath
doesn't change.

**How the model was checked.** During development, renders were compared with the reference photos by
drawing the model's orthographic outline over each photo at the same inches-per-pixel scale, and with
side-by-side head close-ups. Those scripts and the photos were kept outside the repo.
