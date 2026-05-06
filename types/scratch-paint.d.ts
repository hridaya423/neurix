declare module "scratch-paint/dist/scratch-paint.js" {
  import type { ComponentType } from "react";
  import type { Reducer } from "redux";

  export type ScratchPaintFormat = "svg" | "png" | "jpg";

  export type ScratchPaintProps = {
    image?: string;
    imageId?: string;
    imageFormat?: ScratchPaintFormat;
    name?: string;
    rotationCenterX?: number;
    rotationCenterY?: number;
    rtl?: boolean;
    fontInlineFn?: (svgString: string) => string;
    onUpdateImage?: (
      isVector: boolean,
      image: string | ImageData,
      rotationCenterX: number,
      rotationCenterY: number,
    ) => void;
    onUpdateName?: (name: string) => void;
    zoomLevelId?: string;
  };

  const PaintEditor: ComponentType<ScratchPaintProps>;
  export const ScratchPaintReducer: Reducer;
  export default PaintEditor;
}
