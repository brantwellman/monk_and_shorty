# Monk & Shorty

3D models of two stuffed animals, built entirely in code with [three.js](https://threejs.org/).
There are no 3D model files or images: each character is generated from shapes, curves and
procedural textures when the page loads.

| Character | Status | Viewer |
|---|---|---|
| **Shorty**, a baby emperor penguin in a red fleece vest (6¼ in) | done | `characters/shorty/` |
| **Monk**, a squirrel monkey (7¾ in); his blue fleece pullover comes next | in progress | `characters/monk/` |

## Viewing a model

The pages use JavaScript modules, which browsers won't load from a plain file on disk, so serve the
folder with any small web server and open it in a browser:

```sh
cd monk_and_shorty
python3 -m http.server 8000
# then open http://localhost:8000
```

three.js loads from the jsDelivr CDN, so an internet connection is needed.

In the viewer: drag to orbit, scroll or pinch to zoom, right-drag to pan. The toolbar has preset
views (front, 3/4, side, back, top), **Spin**, **Wiggle** (a quick test animation) and **Ruler**
(an inch ruler and 1-inch grid, with the character's real height marked).

## Layout

```
index.html                 gallery page linking to each character
shared/
  viewer.js                renderer, lights, orbit camera, ground, inch ruler, toolbar wiring
  viewer.css               page styles shared by every viewer
  fur.js                   fur surface material, short fuzz layers, long plush hair strands
  textures.js              seeded random numbers and procedural canvas textures
characters/
  shorty/
    shorty.js              builds Shorty; returns his root, posable parts, height, and pose hooks
    index.html             Shorty's viewer page
    NOTES.md               measurements and the look decisions behind the numbers
  monk/
    monk.js                builds Monk, same shape of module as Shorty's
    index.html             Monk's viewer page
    NOTES.md               Monk's measurements and look decisions
    archive/
      monk-fleece-v1.js    first version, modeled wearing the fleece; reference for re-adding it
```

## How a character module works

Each character exports a build function that returns:

```js
{
  root,        // THREE.Group holding the whole character, standing on y = 0, facing +z
  parts,       // named groups to pose or animate, e.g. head, neck, flipperL
  height,      // real height in inches; the viewer scales the camera and ruler to it
  resetPose(), // return every part to its rest pose
  idle(t),     // a simple test animation, driven by time in seconds
}
```

Models are built in inches with y up and +z toward the front. The viewer page passes this object to
`createViewer()` from `shared/viewer.js`.

## Adding a character

1. Copy `characters/shorty/` to `characters/<name>/` and rename the module.
2. Replace the model code, reusing `shared/fur.js` for fur and hair.
3. Set its colors (`--swatch`, `--accent`) and title in its `index.html`.
4. Add it to the gallery list in the top-level `index.html` and the table above.
5. Record its measurements and look decisions in its own `NOTES.md`.

## Animating later

Every movable piece is its own group in `parts`, with its pivot where it bends (Shorty's flippers
pivot at the shoulder, his head at the neck, and his lower bill is a separate `jaw`). An animation
script can import a character module, build it, and rotate those parts over time without touching
the model code. The `idle(t)` function in each module is a small working example.
