console.log('Hello from entry!');
import { Particles } from 'lib/particles.js';
const canvasElement = document.querySelector('canvas#a' as 'canvas');
if (canvasElement) {
	const particles = new Particles(canvasElement);
	const resize = () => {
		particles.resize(canvasElement.getBoundingClientRect());
	}
	window.addEventListener('resize', resize, false);
	resize();
}
