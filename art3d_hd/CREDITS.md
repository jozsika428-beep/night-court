# art3d_hd — credits and licences

All HD models are generated assets processed on our own machine. No paid service, account, login or API key was used.

| Step | Tool | Licence | Output rights |
|---|---|---|---|
| Concept images | FLUX.1-schnell (Black Forest Labs), via the public Hugging Face Space `black-forest-labs/FLUX.1-schnell`, anonymous | Apache-2.0 | Free to use, including commercially |
| Image-to-3D (Vael) | TRELLIS.2 (Microsoft), via the public Space `microsoft/TRELLIS.2`, anonymous | MIT (code and weights) | No restriction on outputs |
| Image-to-3D (all others) | TripoSR (Stability AI + Tripo AI), run locally on CPU from `stabilityai/TripoSR` (not gated) | MIT | No restriction on outputs |
| Skeleton and animation | Quaternius "Man" rig and animations, retargeted | CC0 | Public domain |
| Processing | Blender 4.2 (bake, decimate, unwrap, rig and weights, export) | GPL (the tool only; outputs are ours) | — |
| Compression | KTX-Software 4.4.2 (toktx), glTF-Transform | Apache-2.0 / MIT | — |

Not used, and why:
- Hunyuan3D-2 / 2.1: the Tencent Hunyuan Community licence excludes the EU, UK and South Korea.
- Stable Fast 3D: Stability Community licence, and the Space returned errors.
- Higher quotas on Hugging Face ZeroGPU need a logged-in account or token. We did not create one.
