Gestalt is an experiment inspired by [particles.js](http://vincentgarreau.com/particles.js/).

Unlike the original particles.js:

:star2: It uses WebGL for rendering.

:star2: Computation of points and edges is done in a separate WebWorker thread.

:star2: That computation above is done using WebAssembly.

Yup, lots of Web- buzzwords. But the goal is to be CPU-lightweight and not to block the main loop.

Gestalt will not be a drop-in replacement of particles.js. In fact, I doubt it would be even production ready.

The work is far from being complete, [but you can see it live here](https://subzey.github.io/gestalt/build/).

If for some reason you want to build it, then `git clone`, `npm install`, `npm start`.
