/**
 * KML Overlay Layer
 *
 * Generic KML/KMZ file overlay. Users toggle the layer on, pick (or
 * drag-and-drop) a .kml or .kmz file, and see its placemarks, lines,
 * and polygons rendered on the globe.  Works with exports from Google
 * Earth, Google My Maps, QGIS, ArcGIS, and any other KML source.
 *
 * Internally the KML is converted to GeoJSON via @tmcw/togeojson and
 * rendered through Cesium.GeoJsonDataSource — the same proven pipeline
 * used by the watershed and ecoregion layers.
 */

import * as Cesium from 'cesium';
import { kml as kmlToGeoJson } from '@tmcw/togeojson';

// ── Visual styling ─────────────────────────────────────────────────────
const DEFAULT_FILL = Cesium.Color.fromCssColorString('#E53935').withAlpha(0.25);
const DEFAULT_STROKE = Cesium.Color.fromCssColorString('#E53935');
const STROKE_WIDTH = 2;
const MARKER_COLOR = Cesium.Color.fromCssColorString('#E53935');
const MARKER_SIZE = 10;

// ── Module state ───────────────────────────────────────────────────────
let viewer = null;
let geoJsonSource = null;
let controlsContainer = null;
let statusEl = null;
let fileInputEl = null;

// ── KML → GeoJSON loading ──────────────────────────────────────────────

/**
 * Parse KML text to GeoJSON, following any NetworkLinks by fetching
 * the remote KML through our Vite proxy.
 */
async function kmlTextToGeoJson(kmlText) {
  const parser = new DOMParser();
  const kmlDoc = parser.parseFromString(kmlText, 'application/xml');

  const parseError = kmlDoc.querySelector('parsererror');
  if (parseError) throw new Error('Invalid KML: XML parse error');

  // Check for NetworkLink — Google My Maps exports a wrapper KML
  // whose actual data lives at a remote URL.
  const networkLinks = kmlDoc.querySelectorAll('NetworkLink');
  if (networkLinks.length > 0) {
    const allFeatures = [];
    for (const nl of networkLinks) {
      const href = nl.querySelector('Link > href')?.textContent?.trim();
      if (!href) continue;
      console.log('[kml-overlay] Following NetworkLink:', href);
      setStatus('loading', 'Fetching linked KML data…');
      const resp = await fetch('/api/google/kml?url=' + encodeURIComponent(href));
      if (!resp.ok) throw new Error(`NetworkLink fetch failed: ${resp.status}`);
      const linkedText = await resp.text();
      // Recurse — the linked KML could itself contain NetworkLinks
      const linkedGeoJson = await kmlTextToGeoJson(linkedText);
      if (linkedGeoJson.features) {
        allFeatures.push(...linkedGeoJson.features);
      }
    }
    return { type: 'FeatureCollection', features: allFeatures };
  }

  // No NetworkLinks — convert directly
  return kmlToGeoJson(kmlDoc);
}

async function loadKmlFile(file) {
  // Remove previous data source
  if (geoJsonSource) {
    viewer.dataSources.remove(geoJsonSource, true);
    geoJsonSource = null;
  }

  setStatus('loading', `Loading ${file.name}…`);

  try {
    let kmlText;

    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'kmz') {
      // KMZ is a zip — extract the first .kml inside
      const { default: JSZip } = await import('jszip');
      const zip = await JSZip.loadAsync(file);
      const kmlEntry = Object.keys(zip.files).find(n => n.endsWith('.kml'));
      if (!kmlEntry) throw new Error('No .kml found inside the KMZ');
      kmlText = await zip.files[kmlEntry].async('text');
    } else {
      kmlText = await file.text();
    }

    // Parse KML XML and convert to GeoJSON
    const geoJson = await kmlTextToGeoJson(kmlText);

    if (!geoJson.features?.length) {
      setStatus('error', 'No features found in this KML');
      return;
    }

    // Load via GeoJsonDataSource — same proven path as watershed layer
    geoJsonSource = new Cesium.GeoJsonDataSource('kml-overlay');
    await geoJsonSource.load(geoJson, {
      fill: DEFAULT_FILL,
      stroke: DEFAULT_STROKE,
      strokeWidth: STROKE_WIDTH,
      markerColor: MARKER_COLOR,
      markerSize: MARKER_SIZE,
      clampToGround: true,
    });

    // Ensure point entities render above 3D tiles
    for (const entity of geoJsonSource.entities.values) {
      if (entity.billboard) {
        entity.billboard.disableDepthTestDistance = Number.POSITIVE_INFINITY;
        entity.billboard.heightReference = Cesium.HeightReference.CLAMP_TO_GROUND;
      }
      if (entity.label) {
        entity.label.disableDepthTestDistance = Number.POSITIVE_INFINITY;
        entity.label.heightReference = Cesium.HeightReference.CLAMP_TO_GROUND;
      }
    }

    viewer.dataSources.add(geoJsonSource);
    viewer.flyTo(geoJsonSource);

    const count = geoJson.features.length;
    setStatus('ok', `${count} feature${count !== 1 ? 's' : ''} loaded`);
  } catch (err) {
    console.warn('[kml-overlay] Load failed:', err);
    setStatus('error', err.message || 'Load failed');
  }
}

// ── UI helpers ─────────────────────────────────────────────────────────

function setStatus(state, text) {
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.className = 'kml-status kml-status-' + state;
}

function handleFiles(files) {
  const file = files[0];
  if (!file) return;
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext !== 'kml' && ext !== 'kmz') {
    setStatus('error', 'Please select a .kml or .kmz file');
    return;
  }
  loadKmlFile(file);
}

function buildControls() {
  const row = document.querySelector('[data-layer-id="google-mymaps"]');
  if (!row || controlsContainer) return;

  controlsContainer = document.createElement('div');
  controlsContainer.className = 'kml-controls';
  controlsContainer.innerHTML = `
    <div class="kml-input-row">
      <label class="kml-file-label">
        <input type="file" class="kml-file-input" accept=".kml,.kmz" />
        <span class="kml-file-btn">Choose KML file…</span>
      </label>
    </div>
    <div class="kml-drop-zone">or drag &amp; drop here</div>
    <div class="kml-status"></div>
  `;

  if (!document.getElementById('kml-layer-styles')) {
    const style = document.createElement('style');
    style.id = 'kml-layer-styles';
    style.textContent = `
      .kml-controls {
        padding: 4px 8px 6px 32px;
      }
      .kml-input-row {
        display: flex;
        align-items: center;
      }
      .kml-file-input {
        display: none;
      }
      .kml-file-btn {
        display: inline-block;
        padding: 3px 10px;
        font-size: 11px;
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 3px;
        background: rgba(255,255,255,0.08);
        color: #e0e0e0;
        cursor: pointer;
        white-space: nowrap;
      }
      .kml-file-btn:hover {
        background: rgba(255,255,255,0.15);
      }
      .kml-drop-zone {
        margin-top: 4px;
        padding: 6px;
        font-size: 10px;
        color: rgba(255,255,255,0.35);
        text-align: center;
        border: 1px dashed rgba(255,255,255,0.15);
        border-radius: 3px;
        transition: border-color 0.15s, color 0.15s;
      }
      .kml-drop-zone.drag-over {
        border-color: rgba(100,180,255,0.5);
        color: #90caf9;
      }
      .kml-status {
        font-size: 10px;
        margin-top: 2px;
        min-height: 14px;
        line-height: 14px;
      }
      .kml-status-loading { color: #90caf9; }
      .kml-status-ok      { color: #a5d6a7; }
      .kml-status-error   { color: #ef9a9a; }
    `;
    document.head.appendChild(style);
  }

  fileInputEl = controlsContainer.querySelector('.kml-file-input');
  statusEl = controlsContainer.querySelector('.kml-status');
  const dropZone = controlsContainer.querySelector('.kml-drop-zone');

  fileInputEl.addEventListener('change', () => {
    if (fileInputEl.files.length) handleFiles(fileInputEl.files);
  });

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    handleFiles(e.dataTransfer.files);
  });

  row.appendChild(controlsContainer);
}

function removeControls() {
  if (controlsContainer) {
    controlsContainer.remove();
    controlsContainer = null;
    fileInputEl = null;
    statusEl = null;
  }
}

// ── Layer contract ─────────────────────────────────────────────────────

const kmlOverlayLayer = {
  id: 'google-mymaps',
  name: 'KML Overlay',
  icon: '📌',
  source: 'KML/KMZ file (user-supplied)',
  updateInterval: 0,

  init(v) {
    viewer = v;
  },

  enable() {
    buildControls();
  },

  disable() {
    if (geoJsonSource && viewer) {
      viewer.dataSources.remove(geoJsonSource, true);
      geoJsonSource = null;
    }
    removeControls();
  },

  update() {},

  destroy() {
    this.disable();
    viewer = null;
  },

  getStats() {
    const count = geoJsonSource ? geoJsonSource.entities.values.length : 0;
    return { count };
  },
};

export default kmlOverlayLayer;
