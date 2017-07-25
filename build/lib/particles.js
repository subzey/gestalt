/// <reference path="protocol.ts" />
System.register([], function (exports_1, context_1) {
    "use strict";
    var __moduleName = context_1 && context_1.id;
    var fetchAndCompile, createProgram, Particles;
    return {
        setters: [],
        execute: function () {
            console.log('Hello from lib!');
            fetchAndCompile = (gl, url, flavor) => ((fetch(url)
                .then((response) => response.text())
                .then((source) => {
                const shader = gl.createShader(flavor);
                gl.shaderSource(shader, source);
                gl.compileShader(shader);
                console.groupCollapsed(url);
                console.log(source);
                console.log(gl.getShaderInfoLog(shader));
                console.groupEnd();
                return shader;
            })));
            createProgram = (gl, vertexShaderUrl, fragmentShaderUrl) => ((Promise
                .all([
                fetchAndCompile(gl, vertexShaderUrl, gl.VERTEX_SHADER),
                fetchAndCompile(gl, fragmentShaderUrl, gl.FRAGMENT_SHADER),
            ])
                .then((shaders) => {
                const program = gl.createProgram();
                gl.attachShader(program, shaders[0]);
                gl.attachShader(program, shaders[1]);
                gl.linkProgram(program);
                return program;
            })));
            Particles = class Particles {
                constructor(canvas) {
                    this._size = { width: 300, height: 150 };
                    this._canvas = canvas;
                    this._boundRafCallback = this._rafCallback.bind(this);
                    this._canvas.addEventListener('webglcontextlost', (e) => {
                        this._webgl = null;
                        this._pointsProgram = null;
                        this._edgesProgram = null;
                        e.preventDefault(); // Plz do not crash thx
                    }, false);
                    this._canvas.addEventListener('webglcontextrestored', () => {
                        this._initContext();
                    });
                    this._initWorker();
                    this._initContext();
                }
                resize(size) {
                    this._size = size;
                }
                _initContext() {
                    const gl = this._canvas.getContext('webgl') || this._canvas.getContext('experimental-webgl');
                    this._webgl = gl;
                    if (!gl) {
                        return; // That's all, folks!
                    }
                    Promise.all([
                        createProgram(gl, 'lib/points.vertex.glsl', 'lib/points.fragment.glsl'),
                        createProgram(gl, 'lib/edges.vertex.glsl', 'lib/edges.fragment.glsl'),
                    ]).then((programs) => {
                        this._pointsProgram = programs[0];
                        this._edgesProgram = programs[1];
                        this._requestFrame();
                    });
                    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
                    gl.clearColor(0, 0, 0, 1);
                }
                _initWorker() {
                    this._worker = null;
                    const worker = new Worker('lib/worker.js');
                    worker.addEventListener('message', (e) => {
                        if (e.data.type === 'draw') {
                            this._draw(e.data);
                        }
                        else if (e.data.type === 'ready') {
                            this._worker = worker;
                            this._requestFrame();
                        }
                    });
                }
                _requestFrame() {
                    if (this._pending) {
                        return; // Already requested
                    }
                    this._canvas.ownerDocument.defaultView.requestAnimationFrame(this._boundRafCallback);
                    this._pending = true;
                }
                _rafCallback(timestamp) {
                    if (!this._webgl || !this._worker) {
                        // We're not ready yet
                        this._pending = false;
                        return;
                    }
                    const request = {
                        timestamp,
                        type: 'compute',
                        width: this._size.width,
                        height: this._size.height,
                    };
                    this._worker.postMessage(request);
                }
                _draw(data) {
                    this._pending = false;
                    this._requestFrame();
                    const gl = this._webgl;
                    if (!gl) {
                        return; // Do nothing until context is restored
                    }
                    if (this._canvas.width !== data.width || this._canvas.height !== data.height) {
                        this._canvas.width = data.width;
                        this._canvas.height = data.height;
                        gl.viewport(0, 0, data.width, data.height);
                        console.log(data.width, data.height);
                    }
                    gl.clear(gl.COLOR_BUFFER_BIT);
                    gl.bufferData(gl.ARRAY_BUFFER, data.buffer, gl.DYNAMIC_DRAW);
                    if (this._edgesProgram && data.edgesCount) {
                        gl.useProgram(this._edgesProgram);
                        const coordsAttribLocation = gl.getAttribLocation(this._pointsProgram, 'coords');
                        gl.vertexAttribPointer(coordsAttribLocation, // index
                        2, // size (X and Y)
                        gl.FLOAT, // float32 each
                        false, // normalized. Has no effect on float
                        0, // stride: default
                        data.edgesPtr);
                        gl.enableVertexAttribArray(coordsAttribLocation);
                        gl.vertexAttrib2f(gl.getAttribLocation(this._edgesProgram, 'screenSize'), data.width, data.height);
                        gl.drawArrays(gl.TRIANGLES, 0, data.edgesCount);
                    }
                    if (this._pointsProgram) {
                        gl.useProgram(this._pointsProgram);
                        const sizeAttribLocation = gl.getAttribLocation(this._pointsProgram, 'size');
                        const coordsAttribLocation = gl.getAttribLocation(this._pointsProgram, 'coords');
                        const stride = 20;
                        gl.vertexAttribPointer(sizeAttribLocation, // index
                        1, // size
                        gl.FLOAT, // float32
                        false, // normalized. Has no effect on float
                        stride, // stride: 5 * 4 bytes between
                        data.pointsPtr);
                        gl.vertexAttribPointer(coordsAttribLocation, // index
                        2, // size (X and Y)
                        gl.FLOAT, // float32 each
                        false, // normalized. Has no effect on float
                        stride, // stride: 5 * 4 bytes between
                        data.pointsPtr + 4);
                        gl.enableVertexAttribArray(sizeAttribLocation);
                        gl.enableVertexAttribArray(coordsAttribLocation);
                        gl.vertexAttrib2f(gl.getAttribLocation(this._pointsProgram, 'screenSize'), data.width, data.height);
                        gl.drawArrays(gl.POINTS, 0, data.pointsCount);
                    }
                }
            };
            exports_1("Particles", Particles);
        }
    };
});
