/**
 * The driver photographs.
 *
 * The pipeline now writes formula1.com's season-and-team image for each driver
 * (see pipeline/photos.py), already at 1000 pixels wide on a transparent
 * background, so a URL from there is used as it comes.
 *
 * The older OpenF1 URL can still turn up for a reserve driver F1 has no 2026
 * image for. That one ends in /1col/, F1's 93-pixel thumbnail, and the same
 * path serves /9col/ at 997 pixels: the swap is kept for those.
 *
 * These are Formula One Licensing BV's images, used here on Ernesto's call
 * while the project is local. If it ever ships publicly they are the first
 * thing to replace: the slot at public/drivers/<surname>.png already exists
 * for exactly that.
 */
export function bigPhoto(url: string): string {
  return url.includes("/1col/") ? url.replace("/1col/", "/9col/") : url;
}

/**
 * The figure F1 serves when it has no photograph of a driver: a grey outline
 * in the same pose and proportions as the real portraits, and the same for
 * everybody. The blind test stands this in front of the subject until the
 * answer is given. A silhouette of the real photo was the first version, and
 * it was a giveaway: a driver's hair and shape identify him from across a
 * room, which is the entire point of a silhouette and the opposite of the
 * point of the game.
 */
export const GHOST =
  "https://media.formula1.com/image/upload/c_lfill,w_1000/q_auto/common/f1/2026/fallback/driver/2026fallbackdriverright.webp";
