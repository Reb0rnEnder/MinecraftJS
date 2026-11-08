// Web Worker entry: forwards messages to the MeshService.
import { MeshService } from './mesh-service.js';

const service = new MeshService((msg, transfer) => self.postMessage(msg, transfer || []));
self.onmessage = (e) => service.handle(e.data);
