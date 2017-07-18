/// <reference path="protocol.ts" />

interface DrawStruct {
	buffer: ArrayBuffer;
	pointsPtr: number;
	pointsCount: number;
	edgesPtr: number;
	edgesCount: number;
	width: number;
	height: number;
}

console.log('Hello from lib!');


const fetchAndCompile = (gl: WebGLRenderingContext, url: string, flavor: number): Promise<WebGLShader> => (
	(fetch(url)
		.then((response: Response) => response.text())
		.then((source: string) => {
			const shader = gl.createShader(flavor) as WebGLShader;
			gl.shaderSource(shader, source);
			gl.compileShader(shader);
			console.group(url);
			console.log(source);
			console.log(gl.getShaderInfoLog(shader));
			console.groupEnd();
			return shader;
		})
	)
);

const createProgram = (gl: WebGLRenderingContext, vertexShaderUrl: string, fragmentShaderUrl: string): Promise<WebGLProgram> => (
	(Promise
		.all([
			fetchAndCompile(gl, vertexShaderUrl, gl.VERTEX_SHADER),
			fetchAndCompile(gl, fragmentShaderUrl, gl.FRAGMENT_SHADER),
		])
		.then((shaders: [WebGLShader, WebGLShader]) => {
			const program = gl.createProgram() as WebGLProgram;
			gl.attachShader(program, shaders[0]);
			gl.attachShader(program, shaders[1]);
			gl.linkProgram(program);
			return program;
		})
	)
);

interface Size {
	width: number;
	height: number;
}

export class Particles {
	private readonly _canvas: HTMLCanvasElement;
	private readonly _boundRafCallback: (timestamp: number) => void;
	private _webgl: WebGLRenderingContext | null;
	private _pending: Boolean;
	private _worker: Worker | null;
	private _pointsProgram: WebGLProgram | null;
	private _edgesProgram: WebGLProgram | null;
	private _size: Size;

	constructor(canvas: HTMLCanvasElement) {
		this._size = { width: 300, height: 150 };
		this._canvas = canvas;
		this._boundRafCallback = this._rafCallback.bind(this);

		this._canvas.addEventListener('webglcontextlost', (e: Event) => {
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

	public resize(size: Size) {
		this._size = size;
	}

	private _initContext(): void {
		const gl = this._canvas.getContext('webgl') || this._canvas.getContext('experimental-webgl');
		this._webgl = gl;

		if (!gl) {
			return; // That's all, folks!
		}

		Promise.all([
			createProgram(gl, 'lib/points.vertex.glsl', 'lib/points.fragment.glsl'),
			createProgram(gl, 'lib/edges.vertex.glsl', 'lib/edges.fragment.glsl'),
		]).then((programs: [WebGLProgram, WebGLProgram]) => {
			this._pointsProgram = programs[0];
			this._edgesProgram = programs[1];
			this._requestFrame();
		});

		gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
		gl.clearColor(0, 0, 0, 1);
	}

	private _initWorker(): void {
		this._worker = null;
		const worker = new Worker('lib/worker.js');
		worker.addEventListener('message', (e: ProtocolMessageEvent<WorkerResponse>) => {
			if (e.data.type === 'draw') {
				this._draw(e.data);
			} else if (e.data.type === 'ready') {
				this._worker = worker;
				this._requestFrame();
			}
		});
	}

	private _requestFrame(): void {
		if (this._pending) {
			return; // Already requested
		}
		this._canvas.ownerDocument.defaultView.requestAnimationFrame(this._boundRafCallback);
		this._pending = true;
	}

	private _rafCallback(timestamp: number): void {
		if (!this._webgl || !this._worker) {
			// We're not ready yet
			this._pending = false;
			return;
		}
		const request: WorkerRequestCompute = {
			timestamp,
			type: 'compute',
			width: this._size.width,
			height: this._size.height,
		};
		this._worker.postMessage(request);
	}

	private _draw(data: DrawStruct): void {
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

		if (this._pointsProgram) {
			gl.useProgram(this._pointsProgram);

			const sizeAttribLocation = gl.getAttribLocation(this._pointsProgram, 'size');
			const coordsAttribLocation = gl.getAttribLocation(this._pointsProgram, 'coords');
			const stride = 20;

			gl.vertexAttribPointer(
				sizeAttribLocation, // index
				1, // size
				gl.FLOAT, // float32
				false, // normalized. Has no effect on float
				stride, // stride: 5 * 4 bytes between
				data.pointsPtr
			);
			gl.vertexAttribPointer(
				coordsAttribLocation, // index
				2, // size (X and Y)
				gl.FLOAT, // float32 each
				false, // normalized. Has no effect on float
				stride, // stride: 5 * 4 bytes between
				data.pointsPtr + 4
			);

			gl.enableVertexAttribArray(sizeAttribLocation);
			gl.enableVertexAttribArray(coordsAttribLocation);

			gl.vertexAttrib2f(gl.getAttribLocation(this._pointsProgram, 'screenSize'), data.width, data.height);

			gl.drawArrays(gl.POINTS, 0, data.pointsCount);
		}

		if (this._edgesProgram && data.edgesCount) {
			gl.useProgram(this._edgesProgram);

			const coordsAttribLocation = gl.getAttribLocation(this._pointsProgram, 'coords');

			gl.vertexAttribPointer(
				coordsAttribLocation, // index
				2, // size (X and Y)
				gl.FLOAT, // float32 each
				false, // normalized. Has no effect on float
				0, // stride: default
				data.edgesPtr
			);

			gl.enableVertexAttribArray(coordsAttribLocation);
			gl.vertexAttrib2f(gl.getAttribLocation(this._pointsProgram, 'screenSize'), data.width, data.height);
			gl.drawArrays(gl.TRIANGLES, 0, data.edgesCount);
		}
	}
}
