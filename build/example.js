System.register(["lib/particles.js"], function (exports_1, context_1) {
    "use strict";
    var __moduleName = context_1 && context_1.id;
    var particles_js_1, canvasElement;
    return {
        setters: [
            function (particles_js_1_1) {
                particles_js_1 = particles_js_1_1;
            }
        ],
        execute: function () {
            console.log('Hello from entry!');
            canvasElement = document.querySelector('canvas#a');
            if (canvasElement) {
                const particles = new particles_js_1.Particles(canvasElement);
                const resize = () => {
                    particles.resize(canvasElement.getBoundingClientRect());
                };
                window.addEventListener('resize', resize, false);
                resize();
            }
        }
    };
});
