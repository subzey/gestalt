/// <reference path="protocol.ts" />

console.log('Hello from worker!');

(fetch('particles.wasm')
	.then(response => response.arrayBuffer())
	.then(WebAssembly.compile)
	.then(wasmModule => WebAssembly.instantiate(wasmModule, {
		console,
		config: {
			density: 0.00015,
			speed: 40,
			distance: 100,
		}
	}))
	.then(wasmInstance => {
		const exports = wasmInstance.exports;

		self.addEventListener('message', (e: ProtocolMessageEvent<WorkerRequest>) => {

			exports.compute(e.data.width, e.data.height, e.data.timestamp);

			// const arrayBuffer = new ArrayBuffer(2 * 5 * 4); // 2 elements with 5 float32 fields (4 bytes each)
			// const f32Array = new Float32Array(arrayBuffer);

			// f32Array[0] = 2; // pointSize, css pixels
			// f32Array[1] = 10; // x, css pixels
			// f32Array[2] = 10; // x, css pixels


			// f32Array[5 + 0] = 8; // pointSize, css pixels
			// f32Array[5 + 1] = 100; // x, css pixels
			// f32Array[5 + 2] = 100; // x, css pixels

			const pointsCount: number = exports.pointsCount();
			const edgesCount: number = exports.edgesCount();
			const edgesPtr: number = exports.edgesPtr();

			const message: WorkerResponseDraw = {
				type: 'draw',
				buffer: (exports.mem as WebAssembly.Memory).buffer.slice(0, edgesPtr + edgesCount * 8),
				pointsPtr: 0,
				pointsCount: pointsCount,
				edgesPtr: edgesPtr,
				edgesCount: edgesCount,
				width: e.data.width,
				height: e.data.height,
			};

			(self as any as Worker).postMessage( // Sorry for the mess.
 				message, [message.buffer]
			);
		});

		(self as any as Worker).postMessage({ type: 'ready' } as WorkerResponseReady);
	})
);

