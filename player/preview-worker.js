// Module worker for preview compilation (new Worker(url, { type: 'module' })); the protocol
// lives in player/compile.js and the page side in player/preview-client.js. The worker keeps
// its own public-mode sample cache; replies transfer their buffers.
import { handlePreviewMessage, previewTransfer } from './compile.js';

const ctx = { cache: new Map() };
self.onmessage = async ({ data }) => {
  const reply = await handlePreviewMessage(data, ctx);
  try {
    self.postMessage(reply, previewTransfer(reply));
  } catch (e) { // a reply that cannot be cloned still answers its request
    self.postMessage({ id: data?.id, ok: false, errors: [`preview reply could not be sent: ${e?.message ?? e}`] });
  }
};
