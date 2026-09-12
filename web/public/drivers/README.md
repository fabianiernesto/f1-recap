# Driver photos

One image per driver, named after his surname, lower case, letters only:

    hamilton.png
    verstappen.png
    hulkenberg.png     <- no umlaut, no punctuation

Drop the file in and it appears on its own: on the pit wall, and on the blind
test the moment the answer is given. Nothing to wire up. Any of `.png`,
`.webp`, `.jpg`, `.avif` works.

With no file the driver is drawn as a helmet in his team's colour with his car
number on the shell. That is not a broken state and it does not need fixing in
a hurry: a numbered helmet is how anybody tells cars apart at speed, and it is
ours to draw.

Requirements:

- head and shoulders, roughly square or slightly portrait
- a licence that allows commercial use, or a photo Ernesto owns
- **not** the headshots on `media.formula1.com`. They belong to Formula One
  Licensing BV, which is the same reason the F1 logo came off the front door
  and the UI sounds are synthesised instead of sampled.

The crop is `object-position: 50% 18%`, so faces sit near the top of the frame
and a normal press portrait lands correctly without editing.
