// Map layouts. Only Blackwater Fords is playable in this build.
(function (NC) {
  NC.MAPS = {
    blackwater: {
      name: 'Blackwater Fords', playable: true,
      desc: 'A dark river with three shallow fords. Hold the crossings.',
      fortress: [{ x: 800, y: 2150 }, { x: 800, y: 250 }],
      // build plots around each fortress (offsets for side 0, mirrored for side 1)
      basePlots: [[-250, -60], [-150, -200], [150, -200], [250, -60], [-290, 110], [290, 110]],
      outposts: [
        { name: 'Mirefield Village', type: 'village',   x: 300,  y: 1760, plots: [[-80, 50], [80, 50]] },
        { name: 'Rotting Graveyard', type: 'graveyard', x: 1300, y: 1700, plots: [[-80, 50], [80, 50]] },
        { name: 'Ashford Village',   type: 'village',   x: 1300, y: 640,  plots: [[80, -50], [-80, -50]] },
        { name: "Saint's Rest",      type: 'graveyard', x: 300,  y: 700,  plots: [[80, -50], [-80, -50]] },
        { name: 'Drowned Shrine',    type: 'shrine',    x: 800,  y: 1200, plots: [], bonus: 0.15 }
      ]
    },
    velmoor: { name: 'Ruins of Velmoor', playable: false, desc: 'A broken city split by a river, with bridges to hold.' },
    steppe:  { name: 'The Ashen Steppe', playable: false, desc: 'Wide plains with many villages to capture.' }
  };
})(globalThis.NC = globalThis.NC || {});
