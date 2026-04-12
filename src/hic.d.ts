// HTML-in-Canvas API type augmentations
// These APIs only exist behind chrome://flags/#canvas-draw-element

interface HTMLCanvasElement {
  requestPaint?(): void;
  captureElementImage?(element: Element): Transferable;
  getElementTransform?(element: Element, drawTransform?: DOMMatrix): string;
}

interface WebGL2RenderingContext {
  texElementImage2D?(
    target: number,
    level: number,
    internalformat: number,
    format: number,
    type: number,
    source: Element,
  ): void;
}

interface CanvasRenderingContext2D {
  drawElementImage?(
    element: Element,
    dx: number,
    dy: number,
  ): DOMMatrix;
  drawElementImage?(
    element: Element,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ): DOMMatrix;
  drawElementImage?(
    element: Element,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ): DOMMatrix;
}

interface HTMLElementEventMap {
  paint: PaintEvent;
}

interface PaintEvent extends Event {
  readonly changedElements: readonly Element[];
}
