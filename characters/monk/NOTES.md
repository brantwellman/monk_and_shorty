# Monk: notes

A squirrel monkey plush in a blue fleece pullover. The body and head are modeled without clothes; the pullover
is a separate layer over them, shown or hidden with the **Fleece** button on his viewer page.

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

## Fleece pullover

Built in `monk.js` as its own layer over the body; the body and head are unchanged underneath.

**Switching it.** `buildMonk()` returns `outfits.fleece`. Setting `outfits.fleece.visible` shows or hides every
piece. The pieces over the torso live in one `fleece` group inside the torso, so they lean with it. The sleeves are
children of the arm and forearm groups (`sleeveUpperL/R`, `sleeveLowerL/R`), so they follow the arms when he waves.
While the fleece is on, the long hair on his arms is hidden, because it would poke through the sleeves and out of the
cuffs; the trunk hair stays. The **Fleece** button is wired in `characters/monk/index.html`, so `shared/viewer.js`
stays generic.

**Shell.** Elliptical sections around the body's own forward-leaning center line (`ZC`), each pushed out from the
body surface by a gap that differs at the sides (`SIDE_G`), back (`BACK_G`) and front (`FRONT_G`). The gap is
biggest across the upper back (about ⅝ in) and snug around his hips (about ¼ in), so it doesn't flare at the sides. Soft slanted folds and a nubbly pile (`fleeceMat`: small soft nubs
used as both a light color variation and a bump, sized so each nub is a few hundredths of an inch) give the fleece
look. Across the back it is a little baggy (`wrinkle`): one soft roll of fleece at mid-back with a crease above it.
- Hem (`hemY`): level all the way around, about 1⅜ in up: over his legs at the sides and just above his tail at
  the back, so it is the same length everywhere rather than longer at the back.
- Collar seam (`topY`): high and snug around the neck (about 5 in up at the front, 5¼ at the back), so the collar
  sits right under his chin.

**Placket.** A quarter-length opening down the front, not a V. Below `P_BOT` (about 3⅝ in up) the fleece is closed.
Above it a rectangular opening (`P_W`, about ½ in across) is filled by two teal strips, each sewn to one edge and
lying across it, the wearer's right on top of the left. The bottom of the top strip is square, with a stitched box.
There is no snap: it stays shut on its own. Toward the collar it is left open, so the opening spreads (`P_SPREAD`) and the top of each strip
folds back on itself into a teal lapel that widens up to the collar (`FOLD_Y`, `LAPEL`). His fur shows in the opening.

**Collar.** A narrow teal band (about ⅕ in, `COL_H`), a little taller at the back, where it leans in toward his
nape. There are no separate collar points: at the front the collar is flapped open along with the placket, its
ends turning out and down onto the lapels.

**Sleeves.** Roomy but not baggy (about ⅔ in radius over the arm), with the fleece pushed up into three wobbly
rolls at the cuff and a short skirt over the wrist.

**Chest patch.** On his left, beside the placket: a little landscape over scribbled red-and-cream strokes that only
suggest lettering. The strokes are random on purpose, so no real name or logo can be read.

**Teal fabric.** The collar and placket are woven cloth, not fleece. The threads are too fine to see at his size, so
the look comes from soft tonal mottling and a faint diagonal twill (`wovenMap`), a crinkled bump, and no shine.

**Color.** Muted royal blue fleece (`0x1e3c68`) and teal (`0x0c7a69`). The renderer brightens colors, so these are
darker than the photos.

**How it was checked.** Same method as the body: the model's orthographic outline was traced over a side photo and
a front photo of him wearing the fleece at the same inches-per-pixel scale, and renders were compared side by side
with front, side and back photos. Those scripts and the photos were kept outside the repo.
