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
