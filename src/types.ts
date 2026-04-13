// --- Photo manifest types ---

export interface PhotoExif {
  focalLength: string;
  aperture: string;
  shutterSpeed: string;
  iso: string;
}

export interface Photo {
  id: string;
  src: string;
  thumb: string;
  medium: string;
  full: string;
  lqip: string;
  width: number;
  height: number;
  exif: PhotoExif;
  title: string;
  description: string;
}

export interface PhotoManifest {
  photos: Photo[];
}

// --- Mode system types ---

export interface ModeContext {
  gl: WebGL2RenderingContext;
  canvas: HTMLCanvasElement;
  photos: Photo[];
  size: { w: number; h: number };
  dpr: number;
  requestDraw: () => void;
  setAnimating: (animating: boolean) => void;
  openDetail: (photoIndex: number) => void;
  setModePaint: (cb: ((changedElements: readonly Element[]) => void) | null) => void;
}

export interface ModeImpl {
  paint(dt: number): void;
  isAnimating?(): boolean;
  onPointer?(ev: PointerEvent): void;
  onKeydown?(ev: KeyboardEvent): void;
  onWheel?(ev: WheelEvent): void;
  onResize?(size: { w: number; h: number }): void;
  destroy(): void;
}

export type ModeFactory = (ctx: ModeContext) => ModeImpl;

export type ModeName =
  | 'album'
  | 'slideshow'
  | 'print-table'
  | 'film-strip'
  | 'wall-exhibition'
  | 'stacked-prints'
  | 'collage';

export const MODE_LABELS: Record<ModeName, string> = {
  album: 'Album',
  slideshow: 'Slideshow',
  'print-table': 'Prints',
  'film-strip': 'Strip',
  'wall-exhibition': 'Wall',
  'stacked-prints': 'Stack',
  collage: 'Collage',
};

export const MODE_ORDER: ModeName[] = [
  'album',
  'slideshow',
  'print-table',
  'film-strip',
  'wall-exhibition',
  'stacked-prints',
  'collage',
];
