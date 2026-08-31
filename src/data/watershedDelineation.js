/**
 * Watershed Delineation Layer
 *
 * Click-driven watershed boundary and upstream river network overlay
 * using the mghydro.com Global Watersheds API (MERIT-Basins data).
 *
 * Unlike the raster ecological layers, this is a vector overlay that
 * renders GeoJSON polygons and polylines via Cesium.GeoJsonDataSource.
 * It does NOT use the globe guard — entities render on top of both
 * Google 3D Tiles and the Cesium globe surface.
 *
 * API docs: https://mghydro.com/watersheds/help.html
 * Data source: MERIT-Hydro / MERIT-Basins (University of Tokyo), 90m resolution
 */

import * as Cesium from 'cesium';

// ── API endpoints ──────────────────────────────────────────────────────
const API_BASE = 'https://mghydro.com/app';
const WATERSHED_URL = `${API_BASE}/watershed_api`;
const RIVERS_URL = `${API_BASE}/upstream_rivers_api`;
const FLOWPATH_URL = `${API_BASE}/flowpath_api`;

// ── Visual styling ─────────────────────────────────────────────────────
const WATERSHED_FILL = Cesium.Color.fromCssColorString('#2196F3').withAlpha(0.12);
const WATERSHED_OUTLINE = Cesium.Color.fromCssColorString('#1565C0');
const WATERSHED_OUTLINE_WIDTH = 3;

// River colors by Strahler stream order (higher = larger river)
const RIVER_COLORS = {
  1: Cesium.Color.fromCssColorString('#90CAF9'),  // headwater streams
  2: Cesium.Color.fromCssColorString('#64B5F6'),
  3: Cesium.Color.fromCssColorString('#42A5F5'),
  4: Cesium.Color.fromCssColorString('#2196F3'),
  5: Cesium.Color.fromCssColorString('#1E88E5'),
  6: Cesium.Color.fromCssColorString('#1565C0'),  // major rivers
};
const RIVER_DEFAULT_COLOR = Cesium.Color.fromCssColorString('#1976D2');

const RIVER_WIDTHS = { 1: 1, 2: 1.5, 3: 2, 4: 2.5, 5: 3, 6: 4 };
const RIVER_DEFAULT_WIDTH = 2;

const FLOWPATH_COLOR = Cesium.Color.fromCssColorString('#FF7043');
const FLOWPATH_WIDTH = 3;

const OUTLET_COLOR = Cesium.Color.fromCssColorString('#F44336');
const CLICK_MARKER_COLOR = Cesium.Color.fromCssColorString('#FFEB3B');

// ── State ──────────────────────────────────────────────────────────────
let clickHandler = null;
let watershedSource = null;
let riversSource = null;
let flowpathSource = null;
let markerEntity = null;
let outletEntity = null;
let labelEntity = null;
let isEnabled = false;
let isLoading = false;
let lastResult = null;
let lastError = null;
let abortController = null;

// ── Helpers ────────────────────────────────────────────────────────────

function streamColor(order) {
  return RIVER_COLORS[order] || RIVER_DEFAULT_COLOR;
}

function streamWidth(order) {
  return RIVER_WIDTHS[order] || RIVER_DEFAULT_WIDTH;
}

async function fetchGeoJSON(url, lat, lng, precision, signal) {
  const params = new URLSearchParams({
    lat: lat.toFixed(4),
    lng: lng.toFixed(4),
    precision,
  });
  const res = await fetch(`${url}?${params}`, { signal });
  if (!res.ok) {
    if (res.status === 404) throw new Error('No watershed found — point may be over ocean or outside coverage.');
    if (res.status === 400) throw new Error('Invalid coordinates.');
    throw new Error(`API returned ${res.status}`);
  }
  return res.json();
}

function clearResults(viewer) {
  if (watershedSource) {
    viewer.dataSources.remove(watershedSource, true);
    watershedSource = null;
  }
  if (riversSource) {
    viewer.dataSources.remove(riversSource, true);
    riversSource = null;
  }
  if (flowpathSource) {
    viewer.dataSources.remove(flowpathSource, true);
    flowpathSource = null;
  }
  if (markerEntity) {
    viewer.entities.remove(markerEntity);
    markerEntity = null;
  }
  if (outletEntity) {
    viewer.entities.remove(outletEntity);
    outletEntity = null;
  }
  if (labelEntity) {
    viewer.entities.remove(labelEntity);
    labelEntity = null;
  }
  lastResult = null;
}

async function delineateWatershed(viewer, lat, lng) {
  // Cancel any in-flight request
  if (abortController) {
    abortController.abort();
  }
  abortController = new AbortController();
  const { signal } = abortController;

  // Clear previous results
  clearResults(viewer);
  isLoading = true;
  lastError = null;

  // Drop a marker at the clicked point
  markerEntity = viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(lng, lat),
    point: {
      pixelSize: 10,
      color: CLICK_MARKER_COLOR,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 2,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
    label: {
      text: 'Delineating watershed…',
      font: '13px sans-serif',
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 2,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      pixelOffset: new Cesium.Cartesian2(0, -16),
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  });

  // Auto-select precision: low for wide view, high for close-in
  const cameraHeight = viewer.camera.positionCartographic.height;
  const precision = cameraHeight < 50000 ? 'high' : 'low';

  try {
    // Fetch watershed boundary and upstream rivers in parallel
    const [watershedGeoJSON, riversGeoJSON, flowpathGeoJSON] = await Promise.all([
      fetchGeoJSON(WATERSHED_URL, lat, lng, precision, signal),
      fetchGeoJSON(RIVERS_URL, lat, lng, precision, signal).catch(() => null),
      fetchGeoJSON(FLOWPATH_URL, lat, lng, precision, signal).catch(() => null),
    ]);

    if (signal.aborted) return;

    // ── Render watershed boundary ──────────────────────────────────
    watershedSource = new Cesium.GeoJsonDataSource('watershed-boundary');
    await watershedSource.load(watershedGeoJSON, {
      fill: WATERSHED_FILL,
      stroke: WATERSHED_OUTLINE,
      strokeWidth: WATERSHED_OUTLINE_WIDTH,
      clampToGround: true,
    });
    viewer.dataSources.add(watershedSource);

    // Extract area from properties
    const feature = watershedGeoJSON.features?.[0];
    const areaKm2 = feature?.properties?.area_km2;
    const outletLat = feature?.properties?.outlet_lat;
    const outletLng = feature?.properties?.outlet_lng;

    // Update the click marker label with area
    if (markerEntity && markerEntity.label) {
      const areaText = areaKm2
        ? `Watershed: ${Number(areaKm2).toLocaleString()} km²`
        : 'Watershed delineated';
      markerEntity.label.text = areaText;
    }

    // Mark the outlet point
    if (outletLat != null && outletLng != null) {
      outletEntity = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(outletLng, outletLat),
        point: {
          pixelSize: 12,
          color: OUTLET_COLOR,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: 'Outlet',
          font: '12px sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -16),
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
    }

    // ── Render upstream rivers ─────────────────────────────────────
    if (riversGeoJSON && riversGeoJSON.features?.length) {
      riversSource = new Cesium.GeoJsonDataSource('upstream-rivers');
      await riversSource.load(riversGeoJSON, {
        stroke: RIVER_DEFAULT_COLOR,
        strokeWidth: RIVER_DEFAULT_WIDTH,
        clampToGround: true,
      });

      // Style each river segment by Strahler stream order
      const entities = riversSource.entities.values;
      for (let i = 0; i < entities.length; i++) {
        const entity = entities[i];
        const order = entity.properties?.sorder?.getValue?.() ?? entity.properties?.sorder;
        if (entity.polyline) {
          entity.polyline.material = streamColor(order);
          entity.polyline.width = streamWidth(order);
        }
      }

      viewer.dataSources.add(riversSource);
    }

    // ── Render downstream flowpath ─────────────────────────────────
    if (flowpathGeoJSON && flowpathGeoJSON.features?.length) {
      flowpathSource = new Cesium.GeoJsonDataSource('downstream-flowpath');
      await flowpathSource.load(flowpathGeoJSON, {
        stroke: FLOWPATH_COLOR,
        strokeWidth: FLOWPATH_WIDTH,
        clampToGround: true,
      });
      viewer.dataSources.add(flowpathSource);
    }

    lastResult = {
      lat,
      lng,
      areaKm2,
      precision,
      riverCount: riversGeoJSON?.features?.length ?? 0,
      hasFlowpath: !!flowpathGeoJSON?.features?.length,
    };
  } catch (err) {
    if (err.name === 'AbortError') return;
    lastError = err.message;
    // Update label to show error
    if (markerEntity && markerEntity.label) {
      markerEntity.label.text = `Error: ${err.message}`;
      markerEntity.label.fillColor = Cesium.Color.fromCssColorString('#FF5252');
    }
    console.warn('[Watershed] Delineation failed:', err.message);
  } finally {
    isLoading = false;
  }
}

// ── Layer module (GEV data layer contract) ─────────────────────────────

const watershedDelineationLayer = {
  id: 'eco-watershed',
  name: 'Watershed Delineation',
  icon: '🏞️',
  source: 'mghydro.com / MERIT-Basins (Univ. of Tokyo)',
  description: 'Click any point to delineate its upstream watershed boundary and river network. Uses MERIT-Hydro data at 90m resolution.',
  updateInterval: 0, // click-driven, not polled

  init(viewer) {
    // Nothing to pre-load — the layer is click-driven
  },

  enable(viewer) {
    if (isEnabled) return;
    isEnabled = true;

    // Install click handler
    clickHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    clickHandler.setInputAction((click) => {
      // Don't intercept clicks on existing GEV entities (planes, ships, etc.)
      const picked = viewer.scene.pick(click.position);
      if (picked && picked.id) {
        const entity = picked.id;
        // Allow clicks on our own marker/outlet (no-op) but skip
        // everything else so GEV's native selection still works
        if (entity === markerEntity || entity === outletEntity) return;
        // If it's a non-watershed entity, let GEV handle it
        const isWatershedEntity = watershedSource?.entities.contains(entity)
          || riversSource?.entities.contains(entity)
          || flowpathSource?.entities.contains(entity);
        if (!isWatershedEntity) return;
      }

      // Convert screen position to cartographic
      const cartesian = viewer.scene.pickPosition(click.position)
        || viewer.camera.pickEllipsoid(click.position, viewer.scene.globe.ellipsoid);
      if (!cartesian) return;

      const carto = Cesium.Cartographic.fromCartesian(cartesian);
      const lat = Cesium.Math.toDegrees(carto.latitude);
      const lng = Cesium.Math.toDegrees(carto.longitude);

      delineateWatershed(viewer, lat, lng);
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  },

  disable(viewer) {
    if (!isEnabled) return;
    isEnabled = false;

    // Cancel any in-flight request
    if (abortController) {
      abortController.abort();
      abortController = null;
    }

    // Remove click handler
    if (clickHandler) {
      clickHandler.destroy();
      clickHandler = null;
    }

    // Clear all drawn entities
    clearResults(viewer);
    isLoading = false;
    lastError = null;
  },

  update(_viewer) {
    // No periodic updates — entirely click-driven
  },

  destroy(viewer) {
    this.disable(viewer);
  },

  getStats() {
    if (isLoading) {
      return { count: 0, lastUpdate: null, error: null, status: 'Delineating…' };
    }
    if (lastError) {
      return { count: 0, lastUpdate: null, error: lastError };
    }
    if (lastResult) {
      const parts = [`${lastResult.areaKm2?.toLocaleString() ?? '?'} km²`];
      if (lastResult.riverCount > 0) parts.push(`${lastResult.riverCount} river segments`);
      if (lastResult.hasFlowpath) parts.push('flowpath');
      return {
        count: 1,
        lastUpdate: new Date().toISOString(),
        error: null,
        detail: parts.join(', '),
      };
    }
    return { count: 0, lastUpdate: null, error: null, status: 'Click map to delineate' };
  },
};

export default watershedDelineationLayer;
