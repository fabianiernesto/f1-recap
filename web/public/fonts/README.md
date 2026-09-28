# Brand fonts

Ernesto's text face is **Agrandir** (Pangram Pangram). It is not a Google font
and it is not in this repo. Until its files are here the site uses Space
Grotesk, the closest free face, through the same `--font-body` variable.

To switch the real thing on, drop the files in this folder with these names:

    agrandir-regular.woff2
    agrandir-medium.woff2
    agrandir-bold.woff2

`app/globals.css` already declares `@font-face` rules for them and lists
"Agrandir" ahead of the stand-in in the body stack, so nothing else changes.
A missing file fails silently and the stand-in stays.

# Latin Condensed

The winner's name on the cream spread of the home is set in **Latin
Condensed**, the face of the LinkedIn cards. It is not on this machine and it
is not a Google font. Until its file is here the name falls back to
Instrument Serif. Drop it in this folder as:

    latin-condensed.woff2   (or latin-condensed.ttf)

`app/globals.css` already declares the `@font-face` and lists it first on
`.spread-name`. A missing file fails silently.


# TT Commons Pro

The home is set in **TT Commons Pro** (TypeType), one family for titles,
sentences and labels. It is not a Google font and it is not in this repo.
Until its files are here the home uses Plus Jakarta Sans, the closest free
geometric grotesk. Drop the files in this folder as:

    tt-commons-pro-regular.woff2   (or .ttf)
    tt-commons-pro-medium.woff2    (or .ttf)
    tt-commons-pro-bold.woff2      (or .ttf)

`app/globals.css` already declares the `@font-face` rules and lists the
family first on the home. A missing file fails silently.
