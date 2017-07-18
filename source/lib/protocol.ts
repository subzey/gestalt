interface WorkerResponseReady {
	type: 'ready';
}

interface WorkerResponseDraw {
	type: 'draw';
	buffer: ArrayBuffer;
	pointsPtr: number;
	pointsCount: number;
	edgesPtr: number;
	edgesCount: number;
	width: number;
	height: number;
}

type WorkerResponse = WorkerResponseDraw | WorkerResponseReady;

interface WorkerRequestCompute {
	type: 'compute';
	width: number;
	height: number;
	timestamp: number;
}

type WorkerRequest = WorkerRequestCompute;

interface ProtocolMessageEvent<T> extends MessageEvent {
	data: T;
};
