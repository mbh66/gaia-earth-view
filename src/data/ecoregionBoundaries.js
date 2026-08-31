/**
 * Ecoregion Boundaries Layer
 *
 * Click-driven bioregion identification overlay using the Esri-hosted
 * RESOLVE Ecoregions 2017 FeatureServer (846 terrestrial ecoregions,
 * 14 biomes, 8 biogeographic realms).
 *
 * Like the watershed layer, this is a vector overlay that renders
 * GeoJSON polygons via Cesium.GeoJsonDataSource. It does NOT use the
 * globe guard — entities render on top of both Google 3D Tiles and
 * the Cesium globe surface.
 *
 * Data: RESOLVE Ecoregions 2017 (Dinerstein et al., BioScience 2017)
 * API:  ArcGIS FeatureServer (Esri Living Atlas, public, no auth)
 * Ref:  https://ecoregions2017.appspot.com
 */

import * as Cesium from 'cesium';

// ── API endpoint ───────────────────────────────────────────────────────
const FEATURE_SERVER =
  'https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/' +
  'Resolve_Ecoregions/FeatureServer/0/query';

// ── Biome color palette ────────────────────────────────────────────────
// One fill color per biome number, loosely following the RESOLVE map's
// palette. Semi-transparent so 3D terrain and imagery remain legible.
const BIOME_FILLS = {
  1:  '#1B5E20', // Tropical & Subtropical Moist Broadleaf Forests
  2:  '#558B2F', // Tropical & Subtropical Dry Broadleaf Forests
  3:  '#33691E', // Tropical & Subtropical Coniferous Forests
  4:  '#2E7D32', // Temperate Broadleaf & Mixed Forests
  5:  '#1B5E20', // Temperate Conifer Forests
  6:  '#827717', // Boreal Forests/Taiga
  7:  '#9E9D24', // Tropical & Subtropical Grasslands, Savannas & Shrublands
  8:  '#F9A825', // Temperate Grasslands, Savannas & Shrublands
  9:  '#E65100', // Flooded Grasslands & Savannas
  10: '#4E342E', // Montane Grasslands & Shrublands
  11: '#37474F', // Tundra
  12: '#BF360C', // Mediterranean Forests, Woodlands & Scrub
  13: '#FF8F00', // Deserts & Xeric Shrublands
  14: '#006064', // Mangroves
};
const DEFAULT_FILL = '#4CAF50';
const FILL_ALPHA = 0.25;

const OUTLINE_COLOR = Cesium.Color.fromCssColorString('#E0E0E0');
const OUTLINE_WIDTH = 2;

const CLICK_MARKER_COLOR = Cesium.Color.fromCssColorString('#FFEB3B');

// ── NNH status → readable badge ───────────────────────────────────────
const NNH_BADGES = {
  'Half Protected':        '🛡️ Half Protected',
  'Nature Could Reach Half': '🌱 Could Reach Half',
  'Nature Could Recover':  '🔄 Could Recover',
  'Nature Imperiled':      '⚠️ Imperiled',
};

// ── State ──────────────────────────────────────────────────────────────
let clickHandler = null;
let ecoregionSource = null;
let markerEntity = null;
let isEnabled = false;
let isLoading = false;
let lastResult = null;
let lastError = null;
let abortController = null;

// ── Helpers ────────────────────────────────────────────────────────────

function biomeFill(biomeNum) {
  const hex = BIOME_FILLS[biomeNum] || DEFAULT_FILL;
  return Cesium.Color.fromCssColorString(hex).withAlpha(FILL_ALPHA);
}

function clearResults(viewer) {
  if (ecoregionSource) {
    viewer.dataSources.remove(ecoregionSource, true);
    ecoregionSource = null;
  }
  if (markerEntity) {
    viewer.entities.remove(markerEntity);
    markerEntity = null;
  }
  lastResult = null;
}

async function queryEcoregion(viewer, lat, lng) {
  // Cancel any in-flight request
  if (abortController) {
    abortController.abort();
  }
  abortController = new AbortController();
  const { signal } = abortController;

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
      text: 'Identifying ecoregion…',
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

  try {
    const params = new URLSearchParams({
      where: '1=1',
      geometry: `${lng.toFixed(5)},${lat.toFixed(5)}`,
      geometryType: 'esriGeometryPoint',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: 'ECO_NAME,BIOME_NAME,BIOME_NUM,REALM,NNH_NAME,ECO_ID',
      returnGeometry: 'true',
      f: 'geojson',
      resultRecordCount: '1',
    });

    const res = await fetch(`${FEATURE_SERVER}?${params}`, { signal });
    if (!res.ok) {
      if (res.status === 404) throw new Error('No ecoregion data at this location.');
      throw new Error(`FeatureServer returned ${res.status}`);
    }

    const geojson = await res.json();
    if (signal.aborted) return;

    const feature = geojson.features?.[0];
    if (!feature) {
      throw new Error('No ecoregion found — point may be over ocean.');
    }

    const props = feature.properties || {};
    const ecoName = props.ECO_NAME || 'Unknown ecoregion';
    const biomeName = props.BIOME_NAME || 'Unknown biome';
    const biomeNum = props.BIOME_NUM;
    const realm = props.REALM || 'Unknown realm';
    const nnh = props.NNH_NAME || '';

    // ── Render ecoregion polygon ─────────────────────────────────────
    const fill = biomeFill(biomeNum);
    ecoregionSource = new Cesium.GeoJsonDataSource('ecoregion-boundary');
    await ecoregionSource.load(geojson, {
      fill,
      stroke: OUTLINE_COLOR,
      strokeWidth: OUTLINE_WIDTH,
      clampToGround: true,
    });
    viewer.dataSources.add(ecoregionSource);

    // ── Update click marker label ────────────────────────────────────
    const nhhBadge = NNH_BADGES[nnh] || nnh;
    const labelLines = [ecoName, biomeName, `Realm: ${realm}`];
    if (nhhBadge) labelLines.push(nhhBadge);

    if (markerEntity && markerEntity.label) {
      markerEntity.label.text = labelLines.join('\n');
    }

    lastResult = {
      lat,
      lng,
      ecoName,
      biomeName,
      biomeNum,
      realm,
      nnh,
      ecoId: props.ECO_ID,
    };
  } catch (err) {
    if (err.name === 'AbortError') return;
    lastError = err.message;
    if (markerEntity && markerEntity.label) {
      markerEntity.label.text = `Error: ${err.message}`;
      markerEntity.label.fillColor = Cesium.Color.fromCssColorString('#FF5252');
    }
    console.warn('[Ecoregion] Query failed:', err.message);
  } finally {
    isLoading = false;
  }
}

// ── Layer module (GEV data layer contract) ─────────────────────────────

const ecoregionBoundariesLayer = {
  id: 'eco-ecoregion',
  name: 'Ecoregion Boundaries',
  icon: '🌍',
  source: 'RESOLVE Ecoregions 2017 · Esri Living Atlas',
  description:
    'Click any point to identify its terrestrial ecoregion, biome, ' +
    'biogeographic realm, and conservation status (Nature Needs Half).',
  updateInterval: 0, // click-driven, not polled

  init(viewer) {
    // Nothing to pre-load — click-driven
  },

  enable(viewer) {
    if (isEnabled) return;
    isEnabled = true;

    clickHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    clickHandler.setInputAction((click) => {
      // Don't intercept clicks on existing GEV entities
      const picked = viewer.scene.pick(click.position);
      if (picked && picked.id) {
        const entity = picked.id;
        if (entity === markerEntity) return;
        const isOurEntity = ecoregionSource?.entities.contains(entity);
        if (!isOurEntity) return;
      }

      const cartesian = viewer.scene.pickPosition(click.position)
        || viewer.camera.pickEllipsoid(click.position, viewer.scene.globe.ellipsoid);
      if (!cartesian) return;

      const carto = Cesium.Cartographic.fromCartesian(cartesian);
      const lat = Cesium.Math.toDegrees(carto.latitude);
      const lng = Cesium.Math.toDegrees(carto.longitude);

      queryEcoregion(viewer, lat, lng);
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  },

  disable(viewer) {
    if (!isEnabled) return;
    isEnabled = false;

    if (abortController) {
      abortController.abort();
      abortController = null;
    }

    if (clickHandler) {
      clickHandler.destroy();
      clickHandler = null;
    }

    clearResults(viewer);
    isLoading = false;
    lastError = null;
  },

  update(_viewer) {
    // No periodic updates — click-driven
  },

  destroy(viewer) {
    this.disable(viewer);
  },

  getStats() {
    if (isLoading) {
      return { count: 0, lastUpdate: null, error: null, status: 'Querying…' };
    }
    if (lastError) {
      return { count: 0, lastUpdate: null, error: lastError };
    }
    if (lastResult) {
      return {
        count: 1,
        lastUpdate: new Date().toISOString(),
        error: null,
        detail: `${lastResult.ecoName} · ${lastResult.biomeName}`,
      };
    }
    return { count: 0, lastUpdate: null, error: null, status: 'Click map to identify' };
  },
};

export default ecoregionBoundariesLayer;
