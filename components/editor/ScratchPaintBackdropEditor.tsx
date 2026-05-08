"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import { IntlProvider } from "react-intl";
import { Provider } from "react-redux";
import { combineReducers, createStore } from "redux";
import type { Reducer, Store } from "redux";

type ScratchPaintFormat = "svg" | "png" | "jpg";

type ScratchPaintProps = {
  image?: string;
  imageId?: string;
  imageFormat?: ScratchPaintFormat;
  name?: string;
  rotationCenterX?: number;
  rotationCenterY?: number;
  rtl?: boolean;
  fontInlineFn?: (svgString: string) => string;
  onUpdateImage?: (isVector: boolean, image: string | ImageData, rotationCenterX: number, rotationCenterY: number) => void;
  onUpdateName?: (name: string) => void;
  zoomLevelId?: string;
};

type ScratchPaintModule = {
  default: ComponentType<ScratchPaintProps>;
  ScratchPaintReducer: Reducer;
};

type PaintBundle = {
  PaintEditor: ComponentType<ScratchPaintProps>;
  store: Store;
};

type ReactDomFindDOMNode = (componentOrElement: unknown) => Element | Text | null;

type ReactDomCompat = {
  default?: ReactDomCompat;
  findDOMNode?: ReactDomFindDOMNode;
  __DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE?: {
    findDOMNode?: ReactDomFindDOMNode;
  };
};

type ScratchPaintBackdropEditorProps = {
  image: string;
  imageFormat: ScratchPaintFormat;
  imageId: string;
  name: string;
  rotationCenterX: number;
  rotationCenterY: number;
  assetLabel?: string;
  onRename: (name: string) => void;
  onChange: (payload: {
    image: string;
    imageFormat: ScratchPaintFormat;
    rotationCenterX: number;
    rotationCenterY: number;
  }) => void;
};

function imageDataToDataUrl(image: ImageData) {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d");
  context?.putImageData(image, 0, 0);
  return canvas.toDataURL("image/png");
}

function inlineScratchPaintFonts(svgString: string) {
  return svgString;
}

async function ensureReactDomFindDOMNode() {
  await import("react-dom/client");

  const reactDomModule = (await import("react-dom")) as ReactDomCompat;
  const reactDom = reactDomModule.default ?? reactDomModule;
  if (typeof reactDom.findDOMNode === "function") return;

  const findDOMNode = reactDom.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE?.findDOMNode;
  if (typeof findDOMNode === "function") {
    reactDom.findDOMNode = findDOMNode;
  }
}

export function ScratchPaintBackdropEditor({
  image,
  imageFormat,
  imageId,
  name,
  rotationCenterX,
  rotationCenterY,
  assetLabel = "Backdrop",
  onRename,
  onChange,
}: ScratchPaintBackdropEditorProps) {
  const [paintBundle, setPaintBundle] = useState<PaintBundle | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const lastImageRef = useRef(image);

  useEffect(() => {
    lastImageRef.current = image;
  }, [image]);

  useEffect(() => {
    let isMounted = true;

    const loadScratchPaint = async () => {
      try {
        await ensureReactDomFindDOMNode();
        const paintModule = (await import("scratch-paint/dist/scratch-paint.js")) as ScratchPaintModule;
        if (!isMounted) return;
        setPaintBundle({
          PaintEditor: paintModule.default,
          store: createStore(combineReducers({ scratchPaint: paintModule.ScratchPaintReducer })),
        });
      } catch (error) {
        if (!isMounted) return;
        setLoadError(error instanceof Error ? error.message : "Unable to load Scratch Paint.");
      }
    };

    loadScratchPaint();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loadError) {
    return <div className="scratch-paint-host scratch-paint-status">Scratch Paint failed to load: {loadError}</div>;
  }

  if (!paintBundle) {
    return <div className="scratch-paint-host scratch-paint-status">Loading Scratch Paint...</div>;
  }

  const { PaintEditor, store } = paintBundle;

  return (
    <div className="scratch-paint-host">
      <Provider store={store}>
        <IntlProvider defaultLocale="en" locale="en" messages={{ "paint.paintEditor.costume": assetLabel }}>
          <PaintEditor
            image={image}
            imageFormat={imageFormat}
            imageId={imageId}
            name={name}
            rotationCenterX={rotationCenterX}
            rotationCenterY={rotationCenterY}
            rtl={false}
            fontInlineFn={inlineScratchPaintFonts}
            zoomLevelId={imageId}
            onUpdateName={onRename}
            onUpdateImage={(isVector, nextImage, nextRotationCenterX, nextRotationCenterY) => {
              const nextFormat = isVector ? "svg" : "png";
              const serializedImage = typeof nextImage === "string" ? nextImage : imageDataToDataUrl(nextImage);
              if (serializedImage === lastImageRef.current) return;
              lastImageRef.current = serializedImage;
              onChange({
                image: serializedImage,
                imageFormat: nextFormat,
                rotationCenterX: nextRotationCenterX,
                rotationCenterY: nextRotationCenterY,
              });
            }}
          />
        </IntlProvider>
      </Provider>
    </div>
  );
}
