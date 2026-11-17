import React from "react";
import { Composition } from "remotion";
import "./fonts";
import { Showcase } from "./Showcase";
import { ShowcasePC, ThumbnailPC } from "./pc/ShowcasePC";
import { Thumbnail } from "./Thumbnail";
import { Teaser, TEASER_END, TEASER_FPS, TEASER_PROPS } from "./Teaser";
import { END, OUT_FPS, SCALE } from "./time";

export const Root: React.FC = () => (
  <>
    <Composition id="Showcase" component={Showcase} durationInFrames={END * SCALE} fps={OUT_FPS} width={1080} height={1920} />
    <Composition id="Thumbnail" component={Thumbnail} durationInFrames={1} fps={OUT_FPS} width={1080} height={1920} />
    <Composition id="ShowcasePC" component={ShowcasePC} durationInFrames={END * SCALE} fps={OUT_FPS} width={1920} height={1080} />
    <Composition id="ThumbnailPC" component={ThumbnailPC} durationInFrames={1} fps={OUT_FPS} width={1920} height={1080} />
    <Composition id="Teaser" component={Teaser} defaultProps={TEASER_PROPS} durationInFrames={TEASER_END} fps={TEASER_FPS} width={1080} height={1350} />
  </>
);
