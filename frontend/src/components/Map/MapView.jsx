import React, { useEffect, useState, useRef, useContext } from "react";
import { Marker } from "react-leaflet";
import L from "leaflet";
import Modal from "react-modal";
import html2pdf from "html2pdf.js";
import ReactMarkdown from "react-markdown";
// import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  MapContainer,
  TileLayer,
  GeoJSON,
  Polyline,
  Polygon,
  useMap,
} from "react-leaflet";
import jsPDF from "jspdf";
import { generateGridLines, generateGridCells } from "./utils";
import "./index.css";
import { Context } from "./contexts/Context";
// Modal.setAppElement("#root");

// --- Utilities ---
function normalizeDistrictName(name) {
  // Lowercase, remove spaces, special chars for robust matching
  return name
    ? name
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/[^a-z]/g, "")
    : "";
}
// Returns [lat, lng] centroid for a Polygon (just outer ring)

// Build a polygon with Rajasthan as a "hole"
function getMaskPolygon(districtsGeoJson) {
  // World bounds (covers all, so mask works for any region)
  const world = [
    [-90, -180],
    [-90, 180],
    [90, 180],
    [90, -180],
    [-90, -180],
  ];

  // Collect all Rajasthan's district outer boundaries
  let holes = [];
  districtsGeoJson.features.forEach((feature) => {
    let geom = feature.geometry;
    if (geom.type === "Polygon") {
      // Leaflet needs [lat, lng]
      holes.push(geom.coordinates[0].map(([lng, lat]) => [lat, lng]));
    } else if (geom.type === "MultiPolygon") {
      geom.coordinates.forEach((polygon) => {
        holes.push(polygon[0].map(([lng, lat]) => [lat, lng]));
      });
    }
  });

  return [world, ...holes];
}

// function getDistrictColor(
//   districtName,
//   carbonStock,
//   carbonDistrictListNorm,
//   min,
//   max
// ) {
//   const normName = normalizeDistrictName(districtName);
//   let carbonValue = 0;
//   for (let [k, v] of Object.entries(carbonStock)) {
//     if (normalizeDistrictName(k) === normName) {
//       carbonValue = v;
//       break;
//     }
//   }
//   let norm = (carbonValue - min) / (max - min + 1e-6);
//   norm = Math.max(0, Math.min(1, norm));

//   // Color stops
//   const red = "#f44336";
//   const yellow = "#ffeb3b";
//   const green = "#2ecc40";

//   function hex2rgb(hex) {
//     hex = hex.replace("#", "");
//     if (hex.length === 3)
//       hex = hex
//         .split("")
//         .map((c) => c + c)
//         .join("");
//     const int = parseInt(hex, 16);
//     return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
//   }
//   function blend(hex1, hex2, t) {
//     const rgb1 = hex2rgb(hex1);
//     const rgb2 = hex2rgb(hex2);
//     const rgb = rgb1.map((c, i) => Math.round(c + (rgb2[i] - c) * t));
//     return `rgb(${rgb.join(",")})`;
//   }
//   if (norm < 0.5) {
//     // Red to Yellow
//     return blend(red, yellow, norm * 2);
//   } else {
//     // Yellow to Green
//     return blend(yellow, green, (norm - 0.5) * 2);
//   }
// }

// function getDistrictColor(
//   districtName,
//   carbonStock,
//   carbonDistrictListNorm,
//   min,
//   max
// ) {
//   const normName = normalizeDistrictName(districtName);
//   let carbonValue = 0;
//   for (let [k, v] of Object.entries(carbonStock)) {
//     if (normalizeDistrictName(k) === normName) {
//       carbonValue = v;
//       break;
//     }
//   }
//   let norm = (carbonValue - min) / (max - min + 1e-6);
//   norm = Math.max(0, Math.min(1, norm));

//   // Green-dominated, but colorful
//   const stops = [
//     "#2ecc40", // Orange
//     "#FF00A0", // Magenta
//     "#00BFFF", // Blue
//     "#b5e48c", // Light Green
//     "#18b34a", // Vibrant Green
//     "#FFEB3B", // Yellow
//     "#01530c"  // Dark Green (deepest, final stop)
//   ];

//   function hex2rgb(hex) {
//     hex = hex.replace("#", "");
//     if (hex.length === 3)
//       hex = hex
//         .split("")
//         .map((c) => c + c)
//         .join("");
//     const int = parseInt(hex, 16);
//     return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
//   }
//   function blend(rgb1, rgb2, t) {
//     return `rgb(${rgb1.map((c, i) => Math.round(c + (rgb2[i] - c) * t)).join(",")})`;
//   }

//   const N = stops.length - 1;
//   const scaled = norm * N;
//   const idx = Math.floor(scaled);
//   const localT = scaled - idx;

//   const c1 = hex2rgb(stops[Math.max(0, Math.min(idx, N - 1))]);
//   const c2 = hex2rgb(stops[Math.max(0, Math.min(idx + 1, N))]);
//   return blend(c1, c2, localT);
// }

function getDistrictColor(
  districtName,
  carbonStock,
  carbonDistrictListNorm,
  min,
  max
) {
  const normName = normalizeDistrictName(districtName);
  let carbonValue = 0;
  for (let [k, v] of Object.entries(carbonStock)) {
    if (normalizeDistrictName(k) === normName) {
      carbonValue = v;
      break;
    }
  }
  let norm = (carbonValue - min) / (max - min + 1e-6);
  norm = Math.max(0, Math.min(1, norm));

  // Full-green gradient: light to dark
  const stops = [
    "#d9f99d", // Mint/Lime
    "#a7e957", // Spring Green
    "#70c47f", // Leaf Green
    "#32a852", // Grass Green
    "#168039", // Emerald
    "#10602b", // Pine Green
    "#013a12", // Dark Forest Green
  ];

  function hex2rgb(hex) {
    hex = hex.replace("#", "");
    if (hex.length === 3)
      hex = hex
        .split("")
        .map((c) => c + c)
        .join("");
    const int = parseInt(hex, 16);
    return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
  }
  function blend(rgb1, rgb2, t) {
    return `rgb(${rgb1
      .map((c, i) => Math.round(c + (rgb2[i] - c) * t))
      .join(",")})`;
  }

  const N = stops.length - 1;
  const scaled = norm * N;
  const idx = Math.floor(scaled);
  const localT = scaled - idx;

  const c1 = hex2rgb(stops[Math.max(0, Math.min(idx, N - 1))]);
  const c2 = hex2rgb(stops[Math.max(0, Math.min(idx + 1, N))]);
  return blend(c1, c2, localT);
}

const rajasthanCenter = [27.0238, 74.2179];

function getGeoJsonBounds(geojson) {
  // Returns [[southWestLat, southWestLng], [northEastLat, northEastLng]]
  let coords = [];
  geojson.features.forEach((feature) => {
    const geom = feature.geometry;
    if (geom.type === "Polygon") {
      coords.push(...geom.coordinates.flat());
    } else if (geom.type === "MultiPolygon") {
      geom.coordinates.forEach((polygon) => coords.push(...polygon.flat()));
    }
  });
  let lats = coords.map((c) => c[1]);
  let lngs = coords.map((c) => c[0]);
  return [
    [Math.min(...lats), Math.min(...lngs)],
    [Math.max(...lats), Math.max(...lngs)],
  ];
}

// export default function MapView() {
const BASE_URL = process.env.REACT_APP_BASE_URL || process.env.REACT_APP_API_URL;

export default function MapView({
  districts,
  selectedDistrict,
  setSelectedDistrict,
  selectedSoilType = "",
  setSelectedSoilType, // <--- add this!
  // soilTypeMap = {},
  selectedSpecies = "", // <---- NEW PROP
  highlightDistricts = [], // <-- ADD HIGHLIGHT DISTRICTS PROP
  onCellSelect
}) {
  // REMOVE local state for districts and selectedDistrict, keep everything else as is!
  // ...

  // const [districts, setDistricts] = useState(null);
  // const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [gridLines, setGridLines] = useState(null);
  const [gridCells, setGridCells] = useState(null);
  const [soilData, setSoilData] = useState(null);
  const [cultivableMap, setCultivableMap] = useState({});
  const [carbonTimeSeries, setCarbonTimeSeries] = useState({});
  const [yearList, setYearList] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [lowCarbonDistricts, setLowCarbonDistricts] = useState([]);
  const [plan, setPlan] = useState(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState(null);
  const [selectedCell, setSelectedCell] = useState(null); // for grid index/lat/lng
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [soilDataLoading, setSoilDataLoading] = useState(false);
  const [hoveredDistrict, setHoveredDistrict] = useState(null); // for tooltip
  const [hoveredPosition, setHoveredPosition] = useState(null); // for tooltip

  const {
    askOfficerAI,
    setAskOfficerAI,
    isSoilDataGenerated,
    setIsSoilDataGenerated,
    isPlanGenerated,
    setIsPlanGenerated,
    isOpen,
    setIsOpen,
    selectedCellInfo,
    setSelectedCellInfo,
    setLastPlanInfo
  } = useContext(Context);

  const mapRef = useRef();
  const pdfRef = useRef();
  const pdfContentRef = useRef();
  const sidebarRef = useRef();

  // Props: highlightDistricts (array of district names with selected soil type)
  const highlightDistrictsNorm = highlightDistricts
    ? highlightDistricts.map(normalizeDistrictName)
    : [];

  // DEBUG STATE
  const [debugMisses, setDebugMisses] = useState([]);

  // useEffect(() => {
  //   fetch(process.env.PUBLIC_URL + "/districts.geojson")
  //     .then((res) => res.json())
  //     .then(setDistricts);
  // }, []);
  useEffect(() => {
    fetch(`${BASE_URL}/api/cultivable_grids/`)
      .then((res) => res.json())
      .then(setCultivableMap);
  }, []);

  useEffect(() => {
    const sidebarElem = sidebarRef.current;
    if (!sidebarElem) return;

    // Attach wheel event that only scrolls the sidebar, not the map
    function handleWheel(e) {
      // Check if there's actually something to scroll
      const canScroll = sidebarElem.scrollHeight > sidebarElem.clientHeight;
      if (!canScroll) return;

      // Prevent scroll events from reaching the map
      e.stopPropagation();
      // Only preventDefault if scrolling is possible in this direction
      // So native scroll bar still works
      const atTop = sidebarElem.scrollTop === 0;
      const atBottom =
        sidebarElem.scrollTop + sidebarElem.clientHeight >=
        sidebarElem.scrollHeight;
      if ((atTop && e.deltaY < 0) || (atBottom && e.deltaY > 0)) {
        // Allow scroll to bubble if can't scroll more in that direction
        return;
      }
      e.preventDefault();
    }

    sidebarElem.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      sidebarElem.removeEventListener("wheel", handleWheel);
    };
  }, []);

  useEffect(() => {
    fetch(
      `${BASE_URL}/api/district_carbon_timeseries/?start_year=2024&end_year=2034`
    )
      .then((res) => res.json())
      .then((data) => {
        setCarbonTimeSeries(data);
        const years = Object.keys(data)
          .map(Number)
          .sort((a, b) => a - b);
        setYearList(years);
        setSelectedYear(years[0]);
      });
  }, []);

  const [colorMinMax, setColorMinMax] = useState([0, 1]);
  useEffect(() => {
    if (Object.keys(carbonTimeSeries).length) {
      let all = [];
      for (const year of Object.keys(carbonTimeSeries)) {
        all.push(...Object.values(carbonTimeSeries[year]));
      }
      const min = Math.min(...all.filter((v) => v > 0));
      const max = Math.max(...all.filter((v) => v > 0));
      setColorMinMax([min, max]);
    }
  }, [carbonTimeSeries]);

  useEffect(() => {
    if (selectedDistrict && selectedDistrict.geometry) {
      setGridLines(generateGridLines(selectedDistrict.geometry, 0.05));
      setGridCells(generateGridCells(selectedDistrict.geometry, 0.05));
    } else {
      setGridLines(null);
      setGridCells(null);
    }
  }, [selectedDistrict]); // <- Dependency: props.selectedDistrict

  useEffect(() => {
    if (!carbonTimeSeries[selectedYear]) return;
    const entries = Object.entries(carbonTimeSeries[selectedYear]).filter(
      ([k, v]) => v > 0
    );
    if (!entries.length) {
      setLowCarbonDistricts([]);
      return;
    }
    // Sort by carbon stock ascending
    entries.sort((a, b) => a[1] - b[1]);
    const numLow = Math.ceil(entries.length * 0.1); // 10%
    const lowList = entries.slice(0, numLow).map(([k]) => k);
    setLowCarbonDistricts(lowList);
  }, [carbonTimeSeries, selectedYear]);

  // For animation: autoplay years
  useEffect(() => {
    if (!isPlaying) return;
    if (!yearList.length) return;
    let i = yearList.indexOf(selectedYear);
    if (i === -1) i = 0;
    if (i === yearList.length - 1) {
      setIsPlaying(false);
      return;
    }
    const timer = setTimeout(() => {
      setSelectedYear(yearList[i + 1]);
    }, 900);
    return () => clearTimeout(timer);
  }, [isPlaying, selectedYear, yearList]);

  const onDistrictClick = (e) => {
    const feature = e.target.feature;
    setSelectedDistrict(feature);
    setGridLines(generateGridLines(feature.geometry, 0.05));
    setGridCells(generateGridCells(feature.geometry, 0.05));
  };

  const backToAll = () => {
    setSelectedDistrict(null);
    setGridLines(null);
    setSoilData(null);
    setSelectedSoilType(""); // <-- CLEAR SOIL FILTER ALSO!
  };

  // --- DEBUGGING: Robust matching for tooltip, color ---

  const onCellClick = (cell, index) => {
    const centerLat = (cell[0][0] + cell[2][0]) / 2;
    const centerLng = (cell[0][1] + cell[2][1]) / 2;
    const city = selectedDistrict?.properties?.district || "";
  
    // Create the data payload
    const cellInfoPayload = {
        index,
        centerLat,
        centerLng,
        city,
        selectedYear: selectedYear,
        findCarbonValue: findCarbonValue, // assuming 'selectedYear' is in MapView's state
        selectedDistrictName: selectedDistrict?.properties?.district || ""
    };
  
    // Call the parent function instead of handling it here
    if (onCellSelect) {
      onCellSelect(cellInfoPayload);
    }
  };
  

  const geoDistricts =
    districts && districts.features
      ? districts.features.map((f) => f.properties.district)
      : [];
  const carbonDistricts =
    selectedYear && carbonTimeSeries[selectedYear]
      ? Object.keys(carbonTimeSeries[selectedYear])
      : [];
  const geoDistrictsNorm = geoDistricts.map(normalizeDistrictName);
  const carbonDistrictsNorm = carbonDistricts.map(normalizeDistrictName);

  // Identify mismatched districts (for debugging UI)
  const misses = geoDistricts
    .map((d, i) => ({
      orig: d,
      norm: normalizeDistrictName(d),
      matched: carbonDistrictsNorm.includes(normalizeDistrictName(d)),
    }))
    .filter((d) => !d.matched);

  useEffect(() => {
    setDebugMisses(misses);
    // Debug info:
    console.log("GeoJSON district list:", geoDistricts);
    console.log("Carbon district list:", carbonDistricts);
    if (misses.length > 0) {
      console.warn(
        "Districts in geojson not found in carbon data:",
        misses.map((d) => d.orig)
      );
    }
  }, [districts, carbonTimeSeries, selectedYear]);

  const geoJsonLayerRef = useRef();

  useEffect(() => {
    if (geoJsonLayerRef.current) {
      geoJsonLayerRef.current.setStyle((feature) => ({
        fillColor: getDistrictColor(
          feature.properties.NAME_2 ||
            feature.properties.district ||
            feature.properties.name,
          carbonTimeSeries[selectedYear],
          carbonDistrictsNorm
        ),
        color: "white",
        weight: 1,
        fillOpacity: 0.75,
        cursor: "pointer",
      }));
    }
  }, [selectedYear, carbonTimeSeries, districts, carbonDistrictsNorm]);

  // Defensive checks
  // if (!districts || !selectedYear || !carbonTimeSeries[selectedYear])
  //   return <div>Loading Map...</div>;
  if (!districts || !selectedYear || !carbonTimeSeries[selectedYear])
    return (
      <div
        style={{
          minHeight: "100vh",
          minWidth: "auto",
          background: "#f7fafd",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          zIndex: 99999,
        }}
      >
        <div className="custom-spinner" />
        <span
          style={{
            marginTop: 18,
            color: "#1976d2",
            fontSize: 20,
            fontWeight: 600,
          }}
        >
          Loading Map...
        </span>
        {/* Optionally, add your project logo or an animated SVG */}
        <style>
          {`
          .custom-spinner {
            border: 7px solid #f3f3f3;
            border-top: 7px solid #1976d2;
            border-radius: 50%;
            width: 64px;
            height: 64px;
            animation: spin 1.2s linear infinite;
          }
          @keyframes spin {
            0% { transform: rotate(0deg);}
            100% { transform: rotate(360deg);}
          }
        `}
        </style>
      </div>
    );

  const rajasthanBounds =
    districts && districts.features ? getGeoJsonBounds(districts) : null;

  // --- For robust color and tooltip ---
  function findCarbonValue(districtName) {
    const normName = normalizeDistrictName(districtName);
    for (let [k, v] of Object.entries(carbonTimeSeries[selectedYear])) {
      if (normalizeDistrictName(k) === normName) return v;
    }
    return 0;
  }

  function getFeatureStyle(feature) {
    const dname = normalizeDistrictName(
      feature.properties.NAME_2 ||
        feature.properties.district ||
        feature.properties.name
    );

    const isSpeciesFilter = !!selectedSpecies;
    const isSoilFilter = !!selectedSoilType;
    const isHighlighted = highlightDistrictsNorm.includes(dname);

    if ((isSoilFilter || isSpeciesFilter) && !isHighlighted) {
      return {
        fillColor: "#eee",
        color: "#bbb",
        fillOpacity: 0.3,
        weight: 0.7,
        cursor: "not-allowed",
      };
    }

    if ((isSoilFilter || isSpeciesFilter) && isHighlighted) {
      return {
        fillColor: "#6fcf97",
        color: "#219150",
        fillOpacity: 0.92,
        weight: 2.2,
        cursor: "pointer",
      };
    }

    // default carbon coloring
    return {
      fillColor: getDistrictColor(
        feature.properties.NAME_2 ||
          feature.properties.district ||
          feature.properties.name,
        carbonTimeSeries[selectedYear],
        carbonDistrictsNorm,
        colorMinMax[0],
        colorMinMax[1]
      ),
      color: "white",
      weight: 1,
      fillOpacity: 0.75,
      cursor: "pointer",
    };
  }

  const selectedDistrictName = selectedDistrict?.properties?.district || "";

  async function generatePlan() {
    setPlanLoading(true);
    setPlanError(null);
    setPlan(null);
    try {
      const payload = {
        sidebar_data: soilData, // Already loaded data for this cell
        district: selectedDistrict?.properties?.district || "",
        grid_id: selectedCell?.index ?? "", // Use grid index, fallback empty
        year: selectedYear,
        lat: selectedCell?.centerLat ?? null, // Use center lat
        lng: selectedCell?.centerLng ?? null, // Use center lng
        query: "afforestation guidelines",
      };
      const res = await fetch(`${BASE_URL}/api/generate_plan/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setPlan(data.plan);
      setPlanModalOpen(true);
      setIsPlanGenerated(true);
      setIsSoilDataGenerated(false); // OPEN MODAL after plan is ready
      
      // Store plan information for future regeneration
      setLastPlanInfo({
        district: selectedDistrict?.properties?.district || "",
        grid_id: selectedCell?.index ?? "",
        year: selectedYear,
        lat: selectedCell?.centerLat ?? null,
        lng: selectedCell?.centerLng ?? null,
        hasInfo: true
      });
    } catch (err) {
      setPlanError(err.message || "API error");
    }
    setPlanLoading(false);
  }

  function downloadPlanAsPDF() {
    // this function is downloading the pdf in correct format , as shown in modal
    const element = pdfContentRef.current;
    if (!element) {
      alert("PDF content not ready");
      return;
    }
    html2pdf(element, {
      margin: 0.5,
      filename: "Ecological-Plan.pdf",
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: "in", format: "a4", orientation: "portrait" },
    });
  }

  // function useMapControl(planModalOpen) {
  //   // Custom hook to control map interactions , used when summary modal is open then to avoid map zoom in and out during modal scroll for detailed summary
  //   // This hook disables map interactions when the plan modal is open
  //   const map = useMap();
  //   React.useEffect(() => {
  //     if (planModalOpen) {
  //       // Disable scroll zoom & dragging
  //       map.scrollWheelZoom.disable();
  //       map.dragging.disable();
  //       map.doubleClickZoom.disable();
  //       map.boxZoom.disable();
  //       map.keyboard.disable();
  //       // Mobile: disable touch zoom
  //       if (map.tap) map.tap.disable();
  //     } else {
  //       // Enable back
  //       map.scrollWheelZoom.enable();
  //       map.dragging.enable();
  //       map.doubleClickZoom.enable();
  //       map.boxZoom.enable();
  //       map.keyboard.enable();
  //       if (map.tap) map.tap.enable();
  //     }
  //   }, [planModalOpen, map]);
  //   return null;
  // }

  // function MapControlDisabler({ planModalOpen }) {
  //   useMapControl(planModalOpen);
  //   return null;
  // }

  // Calculate low carbon districts (lowest 10%)

  function useMapControl(planModalOpen, soilDataOpen) {
    const map = useMap();
    React.useEffect(() => {
      if (planModalOpen || soilDataOpen) {
        map.scrollWheelZoom.disable();
        map.dragging.disable();
        map.doubleClickZoom.disable();
        map.boxZoom.disable();
        map.keyboard.disable();
        if (map.tap) map.tap.disable();
      } else {
        map.scrollWheelZoom.enable();
        map.dragging.enable();
        map.doubleClickZoom.enable();
        map.boxZoom.enable();
        map.keyboard.enable();
        if (map.tap) map.tap.enable();
      }
    }, [planModalOpen, soilDataOpen, map]);
    return null;
  }

  // Usage:
  function MapControlDisabler({ planModalOpen, soilDataOpen }) {
    useMapControl(planModalOpen, soilDataOpen);
    return null;
  }

  // Returns [lat, lng] centroid for a Polygon (just outer ring)
  function getPolygonCentroid(coords) {
    // Supports GeoJSON Polygon coordinates: [[ [lng,lat], ... ]]
    let area = 0,
      x = 0,
      y = 0;
    const points = coords[0];
    for (let i = 0, len = points.length, j = len - 1; i < len; j = i++) {
      const [lng1, lat1] = points[i];
      const [lng2, lat2] = points[j];
      const f = lng1 * lat2 - lng2 * lat1;
      x += (lng1 + lng2) * f;
      y += (lat1 + lat2) * f;
      area += f;
    }
    area = area / 2;
    x = x / (6 * area);
    y = y / (6 * area);
    return [y, x]; // [lat, lng]
  }
  // ---- SOIL TYPES ----
  const SOIL_TYPE_COLORS = {
    Alluvial: "#E5D68A", // Yellow Sand
    Sandy: "#F4A460", // Sandy Brown
    Clay: "#B0A2B0", // Light Purple-Gray
    Calcareous: "#BCC6CC", // Light Blue-Gray
    "Sandy Loam": "#E8C07D", // Pale Gold
    Loamy: "#90EE90", // Light Green
    Gravelly: "#8B7B8B", // Grayish
    "Saline/Alkaline": "#E0D7EC", // Very Light Purple
    "Red Loam": "#ED6A5A", // Reddish
    "Clay Loam": "#C3B091", // Taupe Brown
  };
  // ---- SPECIES ----
  const SPECIES_COLORS = {
    Amla: "#50A2A7", // Blueish Green
    Babool: "#E56B70", // Coral Pink
    Banayan: "#8C5E3C", // Brown
    Ber: "#F6B352", // Apricot
    Khejri: "#4E3629", // Deep Brown
    Neem: "#7CB518", // Leaf Green
    Peepal: "#FFD23F", // Yellow
    Rohida: "#B4656F", // Dusty Rose
  };

  return (
    <div
      style={{
        height: "100vh",
        width: "auto",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* ---- YEAR SLIDER ---- */}
      <div
        style={{
          position: "absolute",
          top: 22,
          right: 35,
          // zIndex: 2000,
          background: "#fff",
          padding: 16,
          borderRadius: 14,
          boxShadow: "0 2px 10px #0002",
          minWidth: 300,
          maxWidth: 360,
          display: "flex",
          alignItems: "center",
          display: "none",
        }}
      >
        <b style={{ fontSize: 16, marginRight: 12 }}>Year:</b>
        <input
          type="range"
          min={Math.min(...yearList)}
          max={Math.max(...yearList)}
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          step={1}
          style={{ flex: 1 }}
        />
        <span style={{ fontWeight: 600, fontSize: 17, marginLeft: 10 }}>
          {selectedYear}
        </span>
        <button
          style={{
            marginLeft: 12,
            background: "#1976d2",
            color: "#fff",
            borderRadius: 6,
            border: "none",
            fontWeight: "bold",
            padding: "7px 15px",
            cursor: "pointer",
          }}
          onClick={() => setIsPlaying((v) => !v)}
        >
          {isPlaying ? "Pause" : "▶"}
        </button>
      </div>

      {/* Hidden div for PDF export */}
      {/* <div style={{ display: "none" }}>
        <div id="plan-pdf-content" ref={pdfContentRef}>
          <ReactMarkdown
            children={plan}
            components={{
              h1: ({ node, ...props }) => (
                <h1
                  style={{
                    color: "#1976d2",
                    borderBottom: "1px solid #ddd",
                    paddingBottom: 4,
                  }}
                  {...props}
                >
                  {props.children && props.children.length > 0 ? (
                    props.children
                  ) : (
                    <span aria-label="Empty heading">Untitled</span>
                  )}
                </h1>
              ),
              h2: ({ node, ...props }) => (
                <h2
                  style={{
                    color: "#47bb55",
                    borderBottom: "1px solid #eee",
                    paddingBottom: 3,
                    marginTop: 18,
                  }}
                  {...props}
                >
                  {props.children && props.children.length > 0 ? (
                    props.children
                  ) : (
                    <span aria-label="Empty heading">Untitled</span>
                  )}
                </h2>
              ),
              h3: ({ node, ...props }) => (
                <h3 style={{ color: "#333", marginTop: 15 }} {...props}>
                  {props.children && props.children.length > 0 ? (
                    props.children
                  ) : (
                    <span aria-label="Empty heading">Untitled</span>
                  )}
                </h3>
              ),
              li: ({ node, ...props }) => (
                <li style={{ marginBottom: 2 }} {...props} />
              ),
              strong: ({ node, ...props }) => (
                <strong style={{ color: "#2ecc40" }} {...props} />
              ),
              // ...other customizations
            }}
          />
        </div>
      </div> */}
      <div style={{ display: "none" }}>
  <div id="plan-pdf-content" ref={pdfContentRef}>
    <ReactMarkdown
      children={plan}
      remarkPlugins={[remarkGfm]}   // <-- THIS IS THE MAGIC!
      components={{
        h1: ({ node, ...props }) => (
          <h1
            style={{
              color: "#1976d2",
              borderBottom: "1px solid #ddd",
              paddingBottom: 4,
            }}
            {...props}
          >
            {props.children && props.children.length > 0 ? (
              props.children
            ) : (
              <span aria-label="Empty heading">Untitled</span>
            )}
          </h1>
        ),
        h2: ({ node, ...props }) => (
          <h2
            style={{
              color: "#47bb55",
              borderBottom: "1px solid #eee",
              paddingBottom: 3,
              marginTop: 18,
            }}
            {...props}
          >
            {props.children && props.children.length > 0 ? (
              props.children
            ) : (
              <span aria-label="Empty heading">Untitled</span>
            )}
          </h2>
        ),
        h3: ({ node, ...props }) => (
          <h3 style={{ color: "#333", marginTop: 15 }} {...props}>
            {props.children && props.children.length > 0 ? (
              props.children
            ) : (
              <span aria-label="Empty heading">Untitled</span>
            )}
          </h3>
        ),
        li: ({ node, ...props }) => <li style={{ marginBottom: 2 }} {...props} />,
        strong: ({ node, ...props }) => <strong style={{ color: "#2ecc40" }} {...props} />,
        table: ({ node, ...props }) => <table className="markdown-table">{props.children}</table>,
        th: ({ node, ...props }) => <th>{props.children}</th>,
        td: ({ node, ...props }) => <td>{props.children}</td>,
      }}
    />
  </div>
</div>


      {/* <MapContainer
        center={rajasthanCenter}
        zoom={6.5}
        style={{ height: "100vh", width: "100vw" }}
        ref={mapRef}
      > */}

      {soilDataLoading && (
        <div
          style={{
            position: "fixed", // fixed to viewport
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "100%",
            height: "100vh",
            background: "rgba(255,255,255,0.5)", // semi-transparent white
            zIndex: 99999, // very high to overlay everything
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(2px)", // Optional: blur the map!
          }}
        >
          {/* Replace with your preferred loader */}
          <div
            style={{
              padding: 32,
              background: "transparent",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <div
              className="spinner-border text-primary"
              style={{ width: "3rem", height: "3rem", marginBottom: 20 }}
            />
            <div className="spinner-container">
              <div className="spinner"></div>
            </div>
          </div>
        </div>
      )}

      <MapContainer
        center={rajasthanCenter}
        zoom={6.5}
        minZoom={7} // used to not outzoom so that the user cant see the world map , only sticks to rajasthan
        // maxZoom={10}
        style={{ height: "100vh", width: "auto" }}
        ref={mapRef}
        maxBounds={rajasthanBounds}
        maxBoundsViscosity={1.0}
      >
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles © Esri"
        />

        {districts && (
          <Polygon
            positions={getMaskPolygon(districts)}
            pathOptions={{
              color: "#111",
              // fillColor: "rgba(172,227,232,255)",
              fillColor: "#E8F4EF",
              fillOpacity: 0.96,
              weight: 0,
            }}
            interactive={false}
          />
        )}

        {selectedDistrict === null ? (
          <GeoJSON
            key={
              selectedYear + "-" + (districts ? districts.features.length : 0)
            }
            data={districts}
            style={(feature) => {
              const dname = normalizeDistrictName(
                feature.properties.NAME_2 ||
                  feature.properties.district ||
                  feature.properties.name
              );
              const isSpeciesFilter = !!selectedSpecies;
              const isSoilFilter = !!selectedSoilType;
              const isHighlighted = highlightDistrictsNorm.includes(dname);
              // If soilType is selected and this district does not have it: fade it out!
              // if (selectedSoilType && !highlightDistrictsNorm.includes(dname)) {
              //   return {
              //     fillColor: "#eee",
              //     color: "#bbb",
              //     fillOpacity: 0.3,
              //     weight: 0.7,
              //     cursor: "not-allowed",
              //   };
              // }
              // // If soilType is selected and this district is a match: highlight
              // if (selectedSoilType && highlightDistrictsNorm.includes(dname)) {
              //   return {
              //     fillColor: "#6fcf97", // green highlight
              //     color: "#219150",
              //     fillOpacity: 0.92,
              //     weight: 2.2,
              //     cursor: "pointer",
              //   };
              // }

              // if (
              //   (isSoilFilter || isSpeciesFilter) &&
              //   !highlightDistrictsNorm.includes(dname)
              // ) {
              //   return {
              //     fillColor: "#eee",
              //     color: "#bbb",
              //     fillOpacity: 0.3,
              //     weight: 0.7,
              //     cursor: "not-allowed",
              //   };
              // }

              // if (selectedSpecies && highlightDistrictsNorm.includes(dname)) {
              //   return {
              //     fillColor: "#FFE066", // yellow for species
              //     color: "#FFD700",
              //     fillOpacity: 0.92,
              //     weight: 2.2,
              //     cursor: "pointer",
              //   };
              // }
              // if (selectedSoilType && highlightDistrictsNorm.includes(dname)) {
              //   return {
              //     fillColor: "#FF69B4", // pink for soil
              //     color: "#D72660",
              //     fillOpacity: 0.92,
              //     weight: 2.2,
              //     cursor: "pointer",
              //   };
              // }

              // 2. Color by SOIL type
              if (isSoilFilter && isHighlighted) {
                const color = SOIL_TYPE_COLORS[selectedSoilType] || "#FFA07A";
                return {
                  fillColor: color,
                  color: "#555",
                  fillOpacity: 0.92,
                  weight: 2.2,
                  cursor: "pointer",
                };
              }

              // 3. Color by SPECIES
              if (isSpeciesFilter && isHighlighted) {
                const color = SPECIES_COLORS[selectedSpecies] || "#FFD23F";
                return {
                  fillColor: color,
                  color: "#555",
                  fillOpacity: 0.92,
                  weight: 2.2,
                  cursor: "pointer",
                };
              }

              // // --- Muted style for non-highlighted when filter is active ---
              if (
                (isSoilFilter || isSpeciesFilter) &&
                !highlightDistrictsNorm.includes(dname)
              ) {
                return {
                  fillColor: "transparent",
                  color: "transparent",
                  fillOpacity: 0,
                  weight: 0,
                  cursor: "not-allowed",
                };
              }

              // if (
              //   (isSoilFilter || isSpeciesFilter) &&
              //   highlightDistrictsNorm.includes(dname)
              // ) {
              //   return {
              //     fillColor: "#6fcf97", // green highlight
              //     color: "#219150",
              //     fillOpacity: 0.92,
              //     weight: 2.2,
              //     cursor: "pointer",
              //   };
              // }
              // If no soil filter, use carbon color logic
              return {
                fillColor: getDistrictColor(
                  feature.properties.NAME_2 ||
                    feature.properties.district ||
                    feature.properties.name,
                  carbonTimeSeries[selectedYear],
                  carbonDistrictsNorm,
                  colorMinMax[0],
                  colorMinMax[1]
                ),
                color: "white",
                weight: 1,
                fillOpacity: 0.75,
                cursor: "pointer",
              };
            }}
            onEachFeature={(feature, layer) => {
              const districtName =
                feature.properties.district ||
                feature.properties.NAME_2 ||
                feature.properties.name;
              const value = findCarbonValue(districtName);
              const isLow = lowCarbonDistricts.includes(districtName);

              // Remove permanent: true!
              layer.bindTooltip(
                `
      <div style="font-size:15px;">
        <b>${districtName}</b><br/>
        ${value ? Math.round(value).toLocaleString() + " kg CO₂e" : ""}
        ${
          isLow
            ? '<span style="color:#f44336; font-size:13px;">Low Carbon</span>'
            : ""
        }
      </div>
    `,
                {
                  direction: "center",
                  className: "district-label",
                  opacity: 1,
                  sticky: true, // or try sticky: false, your preference
                }
              );

              layer.on({
                mouseover: (e) => {
                  e.target.setStyle({ fillOpacity: 0.95, weight: 2.5 });
                },
                mouseout: (e) => {
                  e.target.setStyle({ fillOpacity: 0.75, weight: 1 });
                },
                click: onDistrictClick,
              });
            }}
          />
        ) : (
          <>
            <GeoJSON
              data={selectedDistrict}
              style={{
                fillColor: "#6dd47e", // #6dd47e if you want to see old colors
                color: "#2f855a",
                weight: 3,
                fillOpacity: 0.15, // make opacity to 0.8 if you want to see old colors
              }}
              key={
                selectedYear +
                "-" +
                (districts ? districts.features.length : 0) +
                "-" +
                (selectedSoilType || "") +
                "-" +
                (selectedDistrict ? selectedDistrict.properties.district : "")
              }
            />
            {gridLines && (
              <>
                {gridLines.hLines.map((line, i) => (
                  <Polyline
                    key={"h" + i}
                    positions={line.map(([lat, lng]) => [lat, lng])}
                    pathOptions={{ color: "red", weight: 1, opacity: 0.5 }}
                  />
                ))}
                {gridLines.vLines.map((line, i) => (
                  <Polyline
                    key={"v" + i}
                    positions={line.map(([lat, lng]) => [lat, lng])}
                    pathOptions={{ color: "red", weight: 1, opacity: 0.5 }}
                  />
                ))}
              </>
            )}

            {gridCells &&
              gridCells.map(({ cell, index }) => {
                const cultivable = cultivableMap[index] !== 0;
                return (
                  <Polygon
                    key={index}
                    positions={cell}
                    pathOptions={{
                      color: cultivable ? "orange" : "#222",
                      weight: 1,
                      fillOpacity: cultivable ? 0.08 : 0.7,
                      fillColor: cultivable ? "#fffbe6" : "#222",
                      dashArray: cultivable ? null : "4 4",
                      opacity: 1,
                    }}
                    eventHandlers={
                      cultivable
                        ? { click: () => onCellClick(cell, index) }
                        : {}
                    }
                  />
                );
              })}

            <div
              style={{
                position: "absolute",
                top: 10,
                right: 10,
                zIndex: 1000,
              }}
            >
              <button
                onClick={backToAll}
                style={{
                  padding: "8px 18px",
                  fontWeight: "bold",
                  background: "#fff",
                  borderRadius: "6px",
                  border: "1px solid #888",
                }}
              >
                ⬅ Back to All Districts
              </button>
            </div>
          </>
        )}

        {/* ---- LEGEND FOR CARBON HEATMAP ---- */}
        <div
          style={{
            position: "absolute",
            bottom: 20,
            left: 20,
            zIndex: 999,
            padding: 10,
            background: "#fff",
            borderRadius: 8,
            boxShadow: "0 2px 6px #0002",
            minWidth: 170,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            Carbon Stock (kg CO₂e) — {selectedYear}
          </div>
          <div style={{ display: "flex", alignItems: "center" }}>
            {/* <div
              style={{
                width: 90,
                height: 16,
                background:
                  "linear-gradient(to right, #f44336 0%, #ffeb3b 50%, #2ecc40 100%)",
                borderRadius: 6,
                marginRight: 8,
              }}
            /> */}
            {/* <div
  style={{
    width: 150,
    height: 16,
    background:
      "linear-gradient(to right, #2ecc40 0%, #FF00A0 16%, #00BFFF 32%, #b5e48c 48%, #18b34a 64%, #FFEB3B 80%, #01530c 100%)",
    borderRadius: 8,
    marginRight: 8,
  }}
/> */}

            <div
              style={{
                width: 130,
                height: 16,
                background:
                  "linear-gradient(to right, #d9f99d 0%, #a7e957 17%, #70c47f 34%, #32a852 51%, #168039 68%, #10602b 84%, #013a12 100%)",
                borderRadius: 8,
                marginRight: 8,
              }}
            />

            <div style={{ fontSize: 13 }}>
              <span>
                {Math.round(
                  Math.min(
                    ...(Object.values(carbonTimeSeries[selectedYear]).filter(
                      (v) => v > 0
                    ) || [0])
                  )
                ).toLocaleString()}
              </span>
              {" - "}
              <span>
                {Math.round(
                  Math.max(
                    ...(Object.values(carbonTimeSeries[selectedYear]).filter(
                      (v) => v > 0
                    ) || [0])
                  )
                ).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* ----- Soil Data Loading----- */}

        {soilDataLoading ? (
          <div
            style={{
              position: "absolute",
              top: 60,
              right: 25,
              // left:0
              zIndex: 2000,
              background: "#fff",
              padding: 22,
              borderRadius: 14,
              // minWidth: 350,
              // maxWidth: 400,
              boxShadow: "0 2px 10px #0002",
              maxHeight: "80vh",
              overflowY: "auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          ></div>
        ) : (
          // deleted soil data and plan section
        <></>
        )}
        {/* Show Carbon stock in sidebar even if no soilData */}
        {/* {selectedDistrict && !soilData && (
          <div
            ref={sidebarRef}
            style={{
              position: "absolute",
              top: 60,
              right: 25,
              zIndex: 2000,
              background: "#fff",
              padding: 22,
              borderRadius: 14,
              minWidth: 350,
              maxWidth: 400,
              boxShadow: "0 2px 10px #0002",
              maxHeight: "80vh",
              overflowY: "auto",
            }}
            onWheel={(e) => {
              // Only prevent default if the sidebar can actually scroll
              const el = e.currentTarget;
              const atTop = el.scrollTop === 0;
              const atBottom =
                el.scrollTop + el.clientHeight >= el.scrollHeight;
              if (
                (e.deltaY < 0 && atTop) || // Trying to scroll up when already at top
                (e.deltaY > 0 && atBottom) // Trying to scroll down when already at bottom
              ) {
                // Let the event bubble to parent (map), so don't do anything
                return;
              }
              // Sidebar can scroll: prevent map from zooming
              e.stopPropagation();
              e.preventDefault();
            }}
          >
            <h3 style={{ margin: "0 0 12px 0", color: "#1976d2" }}>
              District Data
            </h3>
            <h4 style={{ color: "#47bb55", marginBottom: 8 }}>
              Carbon Stock Estimate ({selectedYear}):
            </h4>
            <div style={{ fontWeight: 600, marginBottom: 15 }}>
              {findCarbonValue(selectedDistrictName)
                ? Math.round(
                    findCarbonValue(selectedDistrictName)
                  ).toLocaleString() + " kg CO₂e"
                : "No data"}
            </div>
            <button
              style={{
                marginTop: 12,
                padding: "7px 18px",
                borderRadius: 7,
                background: "#eee",
                border: "1px solid #888",
                cursor: "pointer",
                fontWeight: "bold",
                float: "right",
              }}
              onClick={backToAll}
            >
              Close
            </button>
          </div>
        )} */}
        {/* <MapControlDisabler planModalOpen={planModalOpen} /> */}
        <MapControlDisabler
          planModalOpen={planModalOpen}
          soilDataOpen={!!soilData || soilDataLoading}
        />
      </MapContainer>
      {/* --- Debug: Show mismatched districts --- */}
      {debugMisses.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: 90,
            left: 15,
            zIndex: 4000,
            background: "#ffe2e2",
            border: "1px solid #f33",
            borderRadius: 8,
            padding: 13,
            minWidth: 200,
            maxWidth: 350,
            color: "#900",
            fontSize: 15,
          }}
        >
          <b>Warning: Districts in map not in carbon data:</b>
          <ul>
            {debugMisses.map((d) => (
              <li key={d.orig}>{d.orig}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}