const fs = require('fs');
const path = require('path');
const wabt = require('wabt');
const rimraf = require('rimraf');

if (process.argv.lastIndexOf('--help') > 1) {
	process.stdout.write(`The build stuff\n`);
	process.exit(1);
}

// const watch = (process.argv.lastIndexOf('-w') > 1);

process.chdir(__dirname);

const cleanup = () => new Promise(
	(resolve, reject) => {
		rimraf(
			'build/**',
			{
				ignore: ['build/', 'build/lib/']
			},
			(error) => {
				if (error) {
					reject(error);
				} else {
					resolve();
				}
			}
		)
	}
);

const makeDir = (dirname) => new Promise(
	(resolve, reject) => {
		fs.mkdir(dirname, (error) => {
			if (error && error.code !== 'EEXIST') {
				reject(error);
			} else {
				resolve();
			}
		})
	}
);

const compileWasm = (from, into) => new Promise(
	(resolve, reject) => {
		fs.readFile(from, (readError, buf) => {
			if (readError) {
				return reject(readError);
			}
			let code;
			try {
				const wasmModule = wabt.parseWast(from, buf);
				const result = wasmModule.toBinary({ log: true });
				code = result.buffer;
				//console.log(result.log);
				wasmModule.destroy();
			} catch (e) {
				return reject(e);
			}
			fs.writeFile(into, code, (writeError) => {
				if (writeError) {
					return reject(writeError);
				}
				resolve();
			});
		});
	}
);

const copy = (from, into) => new Promise(
	(resolve, reject) => {
		(fs.createReadStream(from)
			.pipe(fs.createWriteStream(into))
			.on('error', reject)
			.on('finish', resolve)
		);
	}
);

const build = () => (Promise
	.resolve()
	.then(() => cleanup())
	.then(() => makeDir('build'))
	.then(() => makeDir('build/lib'))
	.then(() => Promise.all([
		compileWasm('source/lib/particles.wast', 'build/lib/particles.wasm'),
		copy('source/index.html', 'build/index.html'),
		copy(require.resolve('systemjs/dist/system-production'), 'build/lib/system.js'),
		copy('source/lib/points.fragment.glsl', 'build/lib/points.fragment.glsl'),
		copy('source/lib/points.vertex.glsl', 'build/lib/points.vertex.glsl'),
		copy('source/lib/edges.fragment.glsl', 'build/lib/edges.fragment.glsl'),
		copy('source/lib/edges.vertex.glsl', 'build/lib/edges.vertex.glsl'),
	]))
);


(build()
	.catch(e => {
		console.error(e);
		process.exit(1);
	})
);
