import { EX_OFF } from './scene';

const ROOM_W = 12;
const ROOM_D = 10;
const PASSAGE_W = 3;

/**
 * Creates the kiosk SVG floor plan DOM element.
 * Returns the element and an update function for the player dot.
 */
export function createKioskDom(
  canvas: HTMLCanvasElement,
): { dom: HTMLElement; updatePosition: (x: number, z: number) => void } {
  const dom = document.createElement('div');
  dom.id = 'gallery-kiosk';
  dom.style.cssText = 'position:absolute;left:-9999px;overflow:hidden;width:400px;height:300px;background:#1a1815;padding:16px;';

  const title = document.createElement('div');
  title.style.cssText = 'font-family:"Playfair Display",Georgia,serif;font-size:14px;color:#e8e4df;text-align:center;margin-bottom:8px;';
  title.textContent = 'Gallery Map';

  // SVG floor plan — scale: 1m = ~10px in SVG viewbox
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', '0 0 300 140');
  svg.setAttribute('width', '368');
  svg.setAttribute('height', '172');
  svg.style.cssText = 'display:block;margin:0 auto;';

  // West wing room
  const westRoom = document.createElementNS(svgNS, 'rect');
  westRoom.setAttribute('x', '10');
  westRoom.setAttribute('y', '10');
  westRoom.setAttribute('width', '120');
  westRoom.setAttribute('height', '100');
  westRoom.setAttribute('fill', 'none');
  westRoom.setAttribute('stroke', '#5a4f42');
  westRoom.setAttribute('stroke-width', '2');

  // East wing room
  const eastRoom = document.createElementNS(svgNS, 'rect');
  eastRoom.setAttribute('x', '160');
  eastRoom.setAttribute('y', '10');
  eastRoom.setAttribute('width', '120');
  eastRoom.setAttribute('height', '100');
  eastRoom.setAttribute('fill', 'none');
  eastRoom.setAttribute('stroke', '#5a4f42');
  eastRoom.setAttribute('stroke-width', '2');

  // Passage
  const passage = document.createElementNS(svgNS, 'rect');
  passage.setAttribute('x', '130');
  passage.setAttribute('y', '35');
  passage.setAttribute('width', '30');
  passage.setAttribute('height', '40');
  passage.setAttribute('fill', '#1a1815');
  passage.setAttribute('stroke', '#5a4f42');
  passage.setAttribute('stroke-width', '1');

  // Labels
  const westLabel = document.createElementNS(svgNS, 'text');
  westLabel.setAttribute('x', '70');
  westLabel.setAttribute('y', '130');
  westLabel.setAttribute('text-anchor', 'middle');
  westLabel.setAttribute('fill', '#5a5650');
  westLabel.setAttribute('font-size', '10');
  westLabel.setAttribute('font-family', 'Inter, sans-serif');
  westLabel.textContent = 'West Wing';

  const eastLabel = document.createElementNS(svgNS, 'text');
  eastLabel.setAttribute('x', '220');
  eastLabel.setAttribute('y', '130');
  eastLabel.setAttribute('text-anchor', 'middle');
  eastLabel.setAttribute('fill', '#5a5650');
  eastLabel.setAttribute('font-size', '10');
  eastLabel.setAttribute('font-family', 'Inter, sans-serif');
  eastLabel.textContent = 'East Wing';

  // Player dot
  const dot = document.createElementNS(svgNS, 'circle');
  dot.setAttribute('r', '4');
  dot.setAttribute('fill', '#e05050');
  dot.setAttribute('cx', '70');
  dot.setAttribute('cy', '90'); // default: near entrance
  dot.style.cssText = 'transition: cx 500ms ease, cy 500ms ease;';

  // Blinking animation
  const animate = document.createElementNS(svgNS, 'animate');
  animate.setAttribute('attributeName', 'opacity');
  animate.setAttribute('values', '1;0.3;1');
  animate.setAttribute('dur', '1.5s');
  animate.setAttribute('repeatCount', 'indefinite');
  dot.appendChild(animate);

  svg.append(westRoom, eastRoom, passage, westLabel, eastLabel, dot);
  dom.append(title, svg);
  canvas.appendChild(dom);

  // Map world coords to SVG coords
  function updatePosition(worldX: number, worldZ: number) {
    // World X: west wing center=0, east wing center=EX_OFF
    // World Z: -ROOM_D/2 (north) to +ROOM_D/2 (south)
    // SVG: west wing 10-130 x, east wing 160-280 x, y 10-110
    let svgX: number;
    if (worldX < ROOM_W / 2 + PASSAGE_W / 2) {
      // West wing or passage left
      svgX = 10 + ((worldX + ROOM_W / 2) / ROOM_W) * 120;
    } else {
      // East wing
      svgX = 160 + ((worldX - EX_OFF + ROOM_W / 2) / ROOM_W) * 120;
    }
    const svgY = 10 + ((worldZ + ROOM_D / 2) / ROOM_D) * 100;

    // Use style properties (not setAttribute) so CSS transitions fire
    (dot.style as any).cx = `${Math.max(10, Math.min(290, svgX))}px`;
    (dot.style as any).cy = `${Math.max(10, Math.min(110, svgY))}px`;
  }

  return { dom, updatePosition };
}
