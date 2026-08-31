# God's Eye View — Ecological Data Layers

## Fork Changes from bilawalsidhu/gods-eye-view (now Gaia Earth View)

This document describes all modifications made to add ecological data layers to the Gaia Earth View (GEV) Cesium application. These layers implement Stage 1 of the Bank of Nature spatial intelligence layer: satellite-derived ecological data rendered as raster imagery overlays.

## Problem: Imagery Layers and Google 3D Tiles

GEV uses Google Photorealistic 3D Tiles as its default surface. The Cesium globe is hidden (`viewer.scene.globe.show = false`) because the 3D tileset provides its own opaque terrain. Cesium `ImageryLayer` objects render on the globe surface, so they are invisible in two ways: the globe is hidden, and even if shown, the 3D tiles occlude it.

The solution is a "globe guard" module that, when any ecological layer is toggled on, hides the 3D tileset, shows the Cesium globe, and adds an OpenStreetMap base layer for geographic context. When all ecological layers are toggled off, it restores photoreal mode.

---

## New Files

### 1. `src/data/ecoLayerGlobeGuard.js`

Manages the rendering mode switch between Google 3D Tiles and the Cesium globe when ecological layers are active.

**Exports:**
- `initGlobeGuard(viewer)` — snapshot current globe/tileset state
- `ecoLayerEnabled(viewer)` — called by each eco layer's `enable()`. On first activation: hides 3D tileset, shows globe, adds OSM base layer at imagery index 0
- `ecoLayerDisabled(viewer)` — called by each eco layer's `disable()`. When active count reaches zero: removes OSM base, restores globe and tileset to previous state

**Key detail:** acquires the Google 3D tileset reference from `window.__godsEyeView.tileset` (set in `main.js` at line ~315). If called before that global is populated, it retries on each `ecoLayerEnabled` call.

### 2. `src/data/ndviVegetation.js`

MODIS Terra Normalized Difference Vegetation Index, 8-day composite.

| Field | Value |
|---|---|
| Layer ID | `eco-ndvi` |
| Display name | Vegetation (NDVI) |
| Icon | 🌿 |
| Data source | NASA GIBS WMTS — `MODIS_Terra_NDVI_8Day` |
| Provider | `Cesium.WebMapTileServiceImageryProvider` |
| WMTS endpoint | `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/wmts.cgi?TIME={date}` |
| TileMatrixSet | `GoogleMapsCompatible_Level9` |
| Format | `image/png` |
| Date offset | 10 days ago (composites have ~10-day latency) |
| Alpha | 0.7 |
| Update interval | 1 hour |
| Auth required | No |

### 3. `src/data/soilMoisture.js`

SMAP L4 Analyzed Surface Soil Moisture at 9 km resolution.

| Field | Value |
|---|---|
| Layer ID | `eco-soil-moisture` |
| Display name | Soil Moisture |
| Icon | 🌱 |
| Data source | NASA GIBS WMTS — `SMAP_L4_Analyzed_Surface_Soil_Moisture` |
| Provider | `Cesium.WebMapTileServiceImageryProvider` |
| WMTS endpoint | `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/wmts.cgi?TIME={date}` |
| TileMatrixSet | `GoogleMapsCompatible_Level9` |
| Format | `image/png` |
| Date offset | 3 days ago |
| Alpha | 0.7 |
| Update interval | 1 hour |
| Auth required | No |

### 4. `src/data/deforestationAlerts.js`

OPERA DIST-ALERT-HLS vegetation disturbance detection at 30 m resolution. Covers deforestation, fire damage, and land clearing from Harmonized Landsat Sentinel-2 data.

| Field | Value |
|---|---|
| Layer ID | `eco-deforestation` |
| Display name | Deforestation Alerts |
| Icon | 🪓 |
| Data source | NASA GIBS WMTS — `OPERA_L3_DIST-ALERT-HLS_Color_Index` |
| Provider | `Cesium.WebMapTileServiceImageryProvider` |
| WMTS endpoint | `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/wmts.cgi?TIME={date}` |
| TileMatrixSet | `GoogleMapsCompatible_Level12` |
| Format | `image/png` |
| Date offset | 5 days ago |
| Alpha | 0.8 |
| Update interval | 1 hour |
| Auth required | No |

**Note:** Global Forest Watch tiles (`tiles.globalforestwatch.org`) were evaluated first but return 403 — they require authentication. OPERA DIST-ALERT-HLS on GIBS is the free, auth-free alternative.

### 5. `src/data/surfaceWater.js`

JRC Global Surface Water occurrence layer (v1.4, 2021 update). Static dataset covering 1984–present from the full Landsat archive. Pixel intensity encodes percentage of time water was present.

| Field | Value |
|---|---|
| Layer ID | `eco-surface-water` |
| Display name | Surface Water |
| Icon | 💧 |
| Data source | EC JRC / Google — Global Surface Water |
| Provider | `Cesium.UrlTemplateImageryProvider` |
| Tile URL | `https://storage.googleapis.com/global-surface-water/tiles2021/occurrence/{z}/{x}/{y}.png` |
| Zoom range | 0–13 |
| Alpha | 0.7 |
| Update interval | 0 (static dataset) |
| Auth required | No |

---

## Modified Files

### `src/data/localLayers.js`

Added imports for all four ecological layer modules and appended them to the default export array after the existing `fires` layer:

```javascript
import surfaceWaterLayer from './surfaceWater.js';
import ndviLayer from './ndviVegetation.js';
import soilMoistureLayer from './soilMoisture.js';
import deforestationLayer from './deforestationAlerts.js';

export default [
  datacenters,
  dams,
  submarineCablesLayer,
  fires,
  surfaceWaterLayer,
  ndviLayer,
  soilMoistureLayer,
  deforestationLayer,
];
```

### `src/data/layerState.js`

Added four token entries for URL hash state persistence. These appear before the existing `earthquakes` entry:

```javascript
Object.freeze({ id: 'eco-deforestation', token: 'k', disposition: 'enabled-only' }),
Object.freeze({ id: 'eco-ndvi', token: 'n', disposition: 'enabled-only' }),
Object.freeze({ id: 'eco-soil-moisture', token: 'j', disposition: 'enabled-only' }),
Object.freeze({ id: 'eco-surface-water', token: 'h', disposition: 'enabled-only' }),
```

Tokens `k`, `n`, `j`, `h` are unique single characters not used by other layers.

### `vite.config.js`

No changes. All four data sources are public, auth-free endpoints — no proxy middleware needed.

---

## Layer Module Pattern

Each ecological layer follows the GEV data layer contract:

```javascript
{
  id: string,          // unique identifier, prefixed 'eco-'
  name: string,        // display name in the UI panel
  icon: string,        // emoji icon
  source: string,      // attribution string
  updateInterval: ms,  // poll interval (0 = static)

  init(viewer),        // create imagery provider and layer, set show=false
  enable(viewer),      // set show=true, call ecoLayerEnabled(viewer)
  disable(viewer),     // set show=false, call ecoLayerDisabled(viewer)
  update(viewer),      // rebuild provider with fresh date, swap imagery layer
  destroy(viewer),     // clean up, call ecoLayerDisabled if enabled
  getStats(),          // return { count, lastUpdate, error }
}
```

The `enable`/`disable` hooks call `ecoLayerEnabled`/`ecoLayerDisabled` from the globe guard to coordinate the rendering mode switch.

---

## Architecture Notes

**GIBS WMTS integration:** Three of four layers use `Cesium.WebMapTileServiceImageryProvider` with NASA GIBS KVP-style WMTS. The TIME parameter is appended directly to the base URL (`wmts.cgi?TIME=YYYY-MM-DD`). Each layer calculates its own date offset to account for data processing latency.

**JRC tiles:** Surface Water uses `Cesium.UrlTemplateImageryProvider` with standard XYZ tiles from Google Cloud Storage — a different provider pattern from the GIBS layers.

**Rendering mode switching:** The globe guard uses a reference count. First eco layer activation triggers the switch from photoreal to globe mode. Last eco layer deactivation restores photoreal. The OSM base layer is created and destroyed dynamically (not hidden/shown) to avoid orphan layers in the imagery stack.

**No interaction with mapStackController:** The globe guard operates independently of GEV's `mapStackController`. If the user manually switches to a globe-based base map (OSM, Bing), the guard's snapshot/restore logic preserves whatever state was active when eco layers were toggled.

---

## Status

The layers register in the GEV UI and toggle on/off. The globe guard now handles both `globe.show` and `tileset.show` to prevent 3D tile occlusion. After the latest globe guard rewrite, a rebuild (`npm run build`) and preview restart are needed to verify visual rendering of the tile data.

## Future Work (Stage 2+)

Per the Bank of Nature document, subsequent stages would add: biodiversity indices (GBIF), air quality (Sentinel-5P), carbon stock estimates, and bioregional boundary overlays. These would follow the same module pattern and globe guard integration.
