(() => {
	const editorStyle = document.createElement('style');
	editorStyle.textContent = `
		.image-editor-backdrop { position: fixed; inset: 0; z-index: 5000; display: grid; place-items: center; padding: 1rem; background: rgba(15, 23, 42, .62); }
		.image-editor-dialog { width: min(100%, 520px); max-height: calc(100vh - 2rem); overflow: auto; padding: 1.25rem; border-radius: 10px; background: #fff; color: #182235; box-shadow: 0 20px 60px rgba(15, 23, 42, .3); font-family: inherit; }
		.image-editor-dialog h2 { margin: 0; font-size: 1.1rem; }
		.image-editor-dialog p { margin: .3rem 0 1rem; color: #687791; font-size: .75rem; }
		.image-editor-canvas-wrap { display: grid; place-items: center; min-height: 220px; padding: .75rem; border-radius: 7px; background: #172033; }
		.image-editor-canvas { display: block; max-width: 100%; cursor: grab; touch-action: none; }
		.image-editor-canvas:active { cursor: grabbing; }
		.image-editor-zoom { display: flex; align-items: center; gap: .65rem; margin: 1rem 0 .25rem; color: #536580; font-size: .75rem; }
		.image-editor-zoom input { flex: 1; accent-color: #2468e8; }
		.image-editor-actions { display: flex; justify-content: flex-end; gap: .5rem; margin-top: 1rem; }
		.image-editor-actions button { border: 0; border-radius: 6px; padding: .6rem .85rem; font: inherit; font-size: .75rem; cursor: pointer; }
		.image-editor-cancel { background: #eef1f5; color: #536174; }
		.image-editor-use { background: #2468e8; color: #fff; }
	`;
	document.head.appendChild(editorStyle);

	const createFile = (canvas, sourceFile, width, height) => new Promise(resolve => {
		canvas.toBlob(blob => resolve(new File([blob], `${sourceFile.name.replace(/\.[^.]+$/, '')}.jpg`, { type: 'image/jpeg', lastModified: Date.now() })), 'image/jpeg', .9);
	}, 'image/jpeg');

	const editImage = (file, options) => new Promise(resolve => {
		const image = new Image();
		const backdrop = document.createElement('div');
		backdrop.className = 'image-editor-backdrop';
		backdrop.innerHTML = `
			<div class="image-editor-dialog" role="dialog" aria-modal="true" aria-labelledby="imageEditorTitle">
				<h2 id="imageEditorTitle">Adjust image</h2>
				<p>Drag to reposition the image and use the slider to zoom.</p>
				<div class="image-editor-canvas-wrap"><canvas class="image-editor-canvas"></canvas></div>
				<label class="image-editor-zoom">Zoom <input type="range" min="1" max="3" step=".01" value="1" aria-label="Image zoom"></label>
				<div class="image-editor-actions"><button type="button" class="image-editor-cancel">Cancel</button><button type="button" class="image-editor-use">Use image</button></div>
			</div>`;
		document.body.appendChild(backdrop);
		const canvas = backdrop.querySelector('canvas');
		const zoomInput = backdrop.querySelector('input');
		const context = canvas.getContext('2d');
		const previewWidth = Math.min(460, Math.max(260, window.innerWidth - 70));
		const previewHeight = previewWidth / options.aspectRatio;
		const cropWidth = Math.min(options.maxWidth, 1200);
		const cropHeight = Math.round(cropWidth / options.aspectRatio);
		canvas.width = previewWidth;
		canvas.height = previewHeight;
		let zoom = 1;
		let offsetX = 0;
		let offsetY = 0;
		let pointerStart;

		const draw = () => {
			const scale = Math.max(canvas.width / image.width, canvas.height / image.height) * zoom;
			const width = image.width * scale;
			const height = image.height * scale;
			const maxOffsetX = Math.max(0, (width - canvas.width) / 2);
			const maxOffsetY = Math.max(0, (height - canvas.height) / 2);
			offsetX = Math.max(-maxOffsetX, Math.min(maxOffsetX, offsetX));
			offsetY = Math.max(-maxOffsetY, Math.min(maxOffsetY, offsetY));
			context.clearRect(0, 0, canvas.width, canvas.height);
			context.drawImage(image, (canvas.width - width) / 2 + offsetX, (canvas.height - height) / 2 + offsetY, width, height);
		};

		image.onload = () => { draw(); };
		image.onerror = () => { backdrop.remove(); resolve(null); };
		image.src = URL.createObjectURL(file);
		zoomInput.addEventListener('input', () => { zoom = Number(zoomInput.value); draw(); });
		canvas.addEventListener('pointerdown', event => { pointerStart = { x: event.clientX, y: event.clientY }; canvas.setPointerCapture(event.pointerId); });
		canvas.addEventListener('pointermove', event => {
			if (!pointerStart) return;
			offsetX += event.clientX - pointerStart.x;
			offsetY += event.clientY - pointerStart.y;
			pointerStart = { x: event.clientX, y: event.clientY };
			draw();
		});
		canvas.addEventListener('pointerup', () => { pointerStart = null; });
		const finish = result => { URL.revokeObjectURL(image.src); backdrop.remove(); resolve(result); };
		backdrop.querySelector('.image-editor-cancel').addEventListener('click', () => finish(null));
		backdrop.querySelector('.image-editor-use').addEventListener('click', async () => {
			const output = document.createElement('canvas');
			output.width = cropWidth;
			output.height = cropHeight;
			const scale = Math.max(canvas.width / image.width, canvas.height / image.height) * zoom;
			const width = image.width * scale;
			const height = image.height * scale;
			const sourceX = (canvas.width - width) / 2 + offsetX;
			const sourceY = (canvas.height - height) / 2 + offsetY;
			const outputContext = output.getContext('2d');
			outputContext.drawImage(image, (0 - sourceX) / scale, (0 - sourceY) / scale, canvas.width / scale, canvas.height / scale, 0, 0, cropWidth, cropHeight);
			finish(await createFile(output, file, cropWidth, cropHeight));
		});
	});

	const processInput = async input => {
		const options = {
			aspectRatio: Number(input.dataset.aspectRatio || 1),
			maxWidth: Number(input.dataset.maxWidth || 800)
		};
		const files = [...input.files];
		if (!files.length) return;
		const processed = [];
		for (const file of files) {
			if (file.type === 'image/svg+xml') processed.push(file);
			else if (file.type.startsWith('image/')) {
				const result = await editImage(file, options);
				if (!result) { input.value = ''; return; }
				processed.push(result);
			}
		}
		const transfer = new DataTransfer();
		processed.forEach(file => transfer.items.add(file));
		input.files = transfer.files;
		input.dispatchEvent(new Event('imageprocessed', { bubbles: true }));
	};

	document.addEventListener('DOMContentLoaded', () => {
		document.querySelectorAll('input[data-image-editor]').forEach(input => input.addEventListener('change', () => processInput(input)));
	});
})();
