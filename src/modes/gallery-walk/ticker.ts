import type { Photo } from '../../types';
import { formatExif } from '../../lib/photos';

/**
 * Creates ticker DOM elements for both wings.
 */
export function createTickerDom(
  canvas: HTMLCanvasElement,
  photos: Photo[],
): { westDom: HTMLElement; eastDom: HTMLElement } {
  function makeTicker(id: string, startIndex: number): HTMLElement {
    const dom = document.createElement('div');
    dom.id = id;
    dom.style.cssText = 'position:absolute;left:-9999px;overflow:hidden;width:1280px;height:40px;background:#0a0a0b;';

    const content = document.createElement('div');
    content.className = 'gallery-ticker-content';

    // Build ticker text — duplicate for seamless loop
    let text = '';
    for (let i = 0; i < photos.length; i++) {
      const idx = (startIndex + i) % photos.length;
      const photo = photos[idx];
      const title = photo.title || `Photograph ${idx + 1}`;
      const exif = formatExif(photo);
      text += `  \u25C6  ${title}  \u00B7  ${exif}`;
    }
    // Duplicate for seamless marquee
    content.textContent = text + text;
    content.style.animation = 'gallery-marquee 60s linear infinite';

    dom.appendChild(content);
    canvas.appendChild(dom);
    return dom;
  }

  return {
    westDom: makeTicker('gallery-ticker-west', 0),
    eastDom: makeTicker('gallery-ticker-east', Math.floor(photos.length / 2)),
  };
}
