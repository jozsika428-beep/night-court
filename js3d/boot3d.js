// Loads the 3D view and tells main.js it is ready. If anything here fails, main.js falls back to 2D.
import { Camera3D, S } from './camera3d.js';
import { World3D, UNIT_VIS } from './world3d.js';
import { Input3D } from './input3d.js';

const NC = globalThis.NC;
function webgl() { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } }
if (webgl()) {
  NC.three = { Camera3D, World3D, Input3D, S, UNIT_VIS };
  window.dispatchEvent(new Event('nc3d-ready'));
} else {
  NC.no3d = 'WebGL is not available on this device';
  window.dispatchEvent(new Event('nc3d-failed'));
}
