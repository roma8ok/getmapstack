// A, B, C - the markers on the map, the list in the panel, the matrix axes and the
// optimised visiting order all name the same point, so they all name it from here.
export const pointLabel = (i) => String.fromCharCode(65 + i);

export function createPoints(map, maplibregl, onChange) {
  const markers = [];
  // Each tool keeps its own points. Visiting a one-point tool must not cost you the
  // five markers you placed for the matrix: coming back finds them where you left them.
  const saved = new Map();
  let max = Infinity;
  let toolId = null;

  const rebuildLabels = () => {
    markers.forEach((m, i) => {
      m.getElement().textContent = pointLabel(i);
    });
  };

  const place = (lngLat) => {
    const el = document.createElement("div");
    el.className = "marker";
    const marker = new maplibregl.Marker({ element: el, draggable: true })
      .setLngLat(lngLat)
      .addTo(map);
    // dragend, not drag: firing a request on every movement would send one request per
    // pixel of the gesture.
    marker.on("dragend", onChange);
    markers.push(marker);
  };

  const removeAll = () => markers.splice(0).forEach((m) => m.remove());

  const list = () =>
    markers.map((m) => {
      const { lat, lng } = m.getLngLat();
      return { lat: +lat.toFixed(6), lon: +lng.toFixed(6) };
    });

  const add = (lngLat) => {
    // A tool that takes no points at all sets max to 0, and the map click handler is
    // wired regardless of which tool is active - so this has to refuse rather than
    // evict from an empty list.
    if (max === 0) return;
    if (markers.length >= max) markers.shift().remove();
    place(lngLat);
    rebuildLabels();
    onChange();
  };

  map.on("click", (e) => add(e.lngLat));

  return {
    list,
    clear() {
      removeAll();
      onChange();
    },
    // The only correction available before this was starting over, which on a
    // twenty-point route is a poor trade for one mis-click.
    removeAt(i) {
      const [marker] = markers.splice(i, 1);
      if (!marker) return;
      marker.remove();
      rebuildLabels();
      onChange();
    },
    // Called on every tool switch. Parks the outgoing tool's points under its id and
    // restores the incoming tool's own set, capped by what that tool accepts.
    // slice(0, Infinity) returns the whole array, so an unbounded tool needs no
    // special case.
    useTool(id, nextMax) {
      if (toolId !== null) saved.set(toolId, list());
      removeAll();
      toolId = id;
      max = nextMax ?? Infinity;
      for (const p of (saved.get(id) || []).slice(0, max)) {
        place({ lng: p.lon, lat: p.lat });
      }
      rebuildLabels();
    },
  };
}
