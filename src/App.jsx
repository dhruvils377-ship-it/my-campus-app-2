import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  AIcon, DataIcon,
  IconMapPin, IconDoorExit, IconArrowUp, IconShare2, IconCheck, IconSun, IconMoon,
  IconCircleDot, IconStar, IconSunrise, IconCurrentLocation, IconMap2, IconSatellite,
  IconWorld, IconMicrophone, IconX, IconChartBar,
  IconAmbulance, IconArrowLeft, IconArrowRight,
} from './components/icons.jsx';
import { getTimeOfDay, getColorScheme, MAP_TILES, applyHighContrast } from './utils/theme.js';
import {
  escapeHtml, buildRoadSnappedGraph, ALIASES, haversine, calcBearing,
  dijkstra, buildSteps, extractLocations,
} from './utils/geo.js';
import { ROUTE_TYPES, buildStairsEdgeSet, getEdgeWeightFn, routeTypeLabel } from './utils/routeTypes.js';
import { CAMPUS_CENTER, EXPLORE_SPOTS, SAFE_ZONES, SOS_ICON_IMG, SHARE_ICON, FOOTPRINT_ICON } from './data/campusStatic.js';
import { MAX_CREW, normalizeNameForCompare, cleanCrewName, isDuplicateName, isCrewFull } from './utils/crew.js';
import LostModal from './components/LostModal.jsx';
import CrewPanel from './components/CrewPanel.jsx';
import ManualLocationPicker from './components/ManualLocationPicker.jsx';
import RouteTypeSelector from './components/RouteTypeSelector.jsx';
import SettingsPanel, { TEXT_SCALES } from './components/SettingsPanel.jsx';
import { IconSettings } from './components/icons.jsx';

if (!document.getElementById('leaflet-css')) {
  const css = document.createElement('link');
  css.id = 'leaflet-css'; css.rel = 'stylesheet';
  css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  document.head.appendChild(css);
}
if (!document.getElementById('app-fonts')) {
  const f = document.createElement('link');
  f.id = 'app-fonts'; f.rel = 'stylesheet';
  f.href = 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Sora:wght@400;500;600;700&display=swap';
  document.head.appendChild(f);
}
if (!document.getElementById('preload-bg')) {
  const style = document.createElement('style');
  style.id = 'preload-bg';
  const hour = new Date().getHours();
  let bg = '#d3fcbd';
  if (hour >= 12 && hour < 17) bg = '#e8ddd4';
  else if (hour < 8 || hour >= 17) bg = '#1a1a1a';
  style.textContent = `body,html,#root{background:${bg}!important;margin:0;padding:0;}`;
  document.head.appendChild(style);
}


export default function App(){
  const mapDiv=useRef(null),mapRef=useRef(null),playerRef=useRef(null);
  const tileLayerRef=useRef(null),labelLayerRef=useRef(null);
  // "Map" mode draws its own clean flat vector map (ground shape, building
  // boxes, road lines) from your own data instead of loading real-world
  // OpenStreetMap tiles — no unrelated businesses, road names, or texture
  // clutter, just your campus. Satellite/Hybrid still use real photo tiles,
  // since a flat "satellite" view wouldn't mean anything. These refs track
  // the flat layers so they can be cleanly removed when switching away from
  // Map mode, the same way tileLayerRef/labelLayerRef track real tiles.
  const flatGroundRef=useRef(null),flatBuildingsRef=useRef([]),flatRoadsRef=useRef([]);
  const routeLayers=useRef([]),destMarker=useRef(null),watchId=useRef(null),isFollowing=useRef(true);
  // Alternate-route polylines (the dimmed, clickable lines for route types
  // other than the currently active one) and the endpoints they were drawn
  // for, so a click can rebuild the full route object without re-deriving
  // start/end from the map.
  const altRouteLayers=useRef([]);
  const routeEndpointsRef=useRef(null); // {fromKey, toKey}
  const activeStepLayerRef=useRef(null);
  const footstepsRef=useRef([]),walkingHistory=useRef([]),lastGpsPos=useRef(null);

  const [leaflet,setLeaflet]=useState(null);
  const [gpsPos,setGpsPos]=useState(null);
  const [showLocModal,setShowLocModal]=useState(true);
  const [sheetVisible,setSheetVisible]=useState(true);
  const [locLabel,setLocLabel]=useState('');
  const [route,setRoute]=useState(null);
  const [stepIdx,setStepIdx]=useState(0);
  const [showSearch,setShowSearch]=useState(false);
  const [query,setQuery]=useState('');
  const [suggestions,setSuggestions]=useState([]);
  const [recentRoutes,setRecentRoutes]=useState([]);
  const [offCentre,setOffCentre]=useState(false);
  const [searchVisible,setSearchVisible]=useState(false);
  const [routeVisible,setRouteVisible]=useState(false);
  const [bottomVisible,setBottomVisible]=useState(false);
  const [favorites,setFavorites]=useState([]);
  const [showLostModal,setShowLostModal]=useState(false);
  const [touchStart,setTouchStart]=useState(null);
  const [activeTab,setActiveTab]=useState('nearby');
  const [totalDistance,setTotalDistance]=useState(0);
  const [totalSteps,setTotalSteps]=useState(0);
  // Two-step confirm, same pattern as crew delete: first tap arms it, a
  // second tap within 3s actually clears distance/steps.
  const [statsResetConfirm,setStatsResetConfirm]=useState(false);
  const statsResetTimer=useRef(null);
  const [userTheme,setUserTheme]=useState('auto');
  const [timeOfDay,setTimeOfDay]=useState(getTimeOfDay());
  const [mapMode,setMapMode]=useState('hybrid');
  // ── Accessibility/settings ──────────────────────────────────────────────
  const [showSettings,setShowSettings]=useState(false);
  const [textScaleKey,setTextScaleKey]=useState('medium');
  const [highContrast,setHighContrast]=useState(false);
  const [voiceEnabled,setVoiceEnabled]=useState(false);
  const [voiceVolume,setVoiceVolume]=useState(80);
  const settingsPanelRef=useRef(null);
  const lastNarratedStepRef=useRef(null);
  const [fabOpen,setFabOpen]=useState(false);
  const [fabTab,setFabTab]=useState('sos');
  const [sharecopied,setShareCopied]=useState(false);
  const [panicActive,setPanicActive]=useState(false);
  const [meetMeCopied,setMeetMeCopied]=useState(false);
  const [isListening,setIsListening]=useState(false);
  const [searchMessage,setSearchMessage]=useState('');
  const [emergencyMessage,setEmergencyMessage]=useState('');
  const recognitionRef=useRef(null);

    // ── Manual location: searchable building-list picker ────────────────────
  const [showManualPicker,setShowManualPicker]=useState(false);
  const [manualQuery,setManualQuery]=useState('');
  const manualPickerRef=useRef(null);

  // ── My Crew: a locally-stored list of trusted names. Sharing a location or
  // meet point can be aimed at one of these people; the share text names them
  // and includes an expiry so a stale link reads as stale. This is NOT real
  // access control (there's no backend/accounts, so anyone with the link can
  // still open it) — it's a lightweight, honest step up from "share with
  // literally anyone," matching the no-backend approach we agreed on.
  const [crew,setCrew]=useState([]);
  const [newCrewName,setNewCrewName]=useState('');
  const [selectedCrewId,setSelectedCrewId]=useState(null);
  // Two-step delete: tapping × the first time arms a confirm state on that
  // chip; a second tap within 3s actually deletes. Tapping anywhere else, or
  // letting the timer lapse, cancels — so one accidental tap can't wipe a name.
  const [confirmDeleteId,setConfirmDeleteId]=useState(null);
  const confirmDeleteTimer=useRef(null);
  // Inline rename: clicking a chip's name (not the × ) turns it into a text
  // field instead of forcing delete-and-re-add for a typo.
  const [editingCrewId,setEditingCrewId]=useState(null);
  const [editingCrewValue,setEditingCrewValue]=useState('');
  // Whether the selected crew member's name gets woven into the outgoing
  // share text. Off by default: the name is for YOUR reference (who this
  // share is meant for), not something that should automatically ride along
  // in a message that could get forwarded, screenshotted, or land in a group
  // chat. On-by-default was the leak the last review caught.
  const [includeNameInShare,setIncludeNameInShare]=useState(false);

  // Toast replaces window.alert() so failures match the app's own visual
  // language instead of a jarring native browser popup.
  const [toast,setToast]=useState(null);
  // Every localStorage write in the app used to be a bare try{}catch{} —
  // if storage was full or blocked (private browsing, some locked-down
  // browsers), favorites/crew/stats would silently fail to save with zero
  // indication anything was wrong. This wraps every write so failure surfaces
  // once (not on every single GPS tick, which would spam the toast) and the
  // person actually finds out their data isn't persisting on this device.
  const storageWarnedRef=useRef(false);
  const safeStorageSet=(key,value)=>{
    try{
      localStorage.setItem(key,value);
      return true;
    }catch{
      if(!storageWarnedRef.current){
        storageWarnedRef.current=true;
        setToast("Your data isn't saving on this device (storage is full or blocked).");
      }
      return false;
    }
  };
  useEffect(()=>{
    if(!toast)return;
    const t=setTimeout(()=>setToast(null),3200);
    return()=>clearTimeout(t);
  },[toast]);

  // Panic mode requires a deliberate ~900ms hold rather than a single tap,
  // so a pocket bump or stray tap can't trigger a false emergency alert.
  const [panicHolding,setPanicHolding]=useState(false);
  const panicHoldTimer=useRef(null);

  const [mapTileError,setMapTileError]=useState(false);

  // Refs for the focus-trap hook below: each modal's outer container, so we
  // can find its focusable children and cycle Tab within them.
  const searchModalRef=useRef(null),locModalRef=useRef(null),lostModalRef=useRef(null),fabPanelRef=useRef(null),searchInputRef=useRef(null);

  // Phone/browser back-button support: treat any open overlay as one "layer"
  // on top of the app. Opening an overlay pushes a single history entry;
  // closing it (via its own X/backdrop) consumes that entry with
  // history.back() so the stack doesn't grow; pressing the actual back
  // button fires popstate, which closes whichever overlay is open instead
  // of leaving the app.
  const overlayHistoryPushed=useRef(false);
  const anyOverlayOpen=showSearch||showLocModal||showLostModal||fabOpen||showSettings||showManualPicker;
  const prevAnyOverlayOpen=useRef(false);
  useEffect(()=>{
    if(anyOverlayOpen&&!prevAnyOverlayOpen.current){
      window.history.pushState({overlay:true},'');
      overlayHistoryPushed.current=true;
    }else if(!anyOverlayOpen&&prevAnyOverlayOpen.current&&overlayHistoryPushed.current){
      overlayHistoryPushed.current=false;
      if(window.history.state&&window.history.state.overlay)window.history.back();
    }
    prevAnyOverlayOpen.current=anyOverlayOpen;
  },[anyOverlayOpen]);
  useEffect(()=>{
    function onPopState(){
      overlayHistoryPushed.current=false;
      if(showSearch){closeSearch();return;}
      if(fabOpen){setFabOpen(false);return;}
      if(showSettings){setShowSettings(false);return;}
      if(showLostModal){setShowLostModal(false);return;}
      if(showManualPicker){setShowManualPicker(false);return;}
      if(showLocModal){handleDontAllow();return;}
    }
    window.addEventListener('popstate',onPopState);
    return()=>window.removeEventListener('popstate',onPopState);
  },[showSearch,fabOpen,showSettings,showLostModal,showLocModal,showManualPicker]);

  // Generic Escape-to-close + Tab focus-trap + focus-restore for any modal.
  // `active` is the boolean open-state; `containerRef` points at the modal's
  // outer element; `onClose` is called on Escape or on browser/back button.
  function useFocusTrap(active,containerRef,onClose){
    const prevFocus=useRef(null);
    useEffect(()=>{
      if(!active)return;
      prevFocus.current=document.activeElement;
      const container=containerRef.current;
      const getFocusables=()=>container?Array.from(container.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')).filter(el=>!el.disabled):[];
      const focusables=getFocusables();
      if(focusables.length)focusables[0].focus();
      function onKeyDown(e){
        if(e.key==='Escape'){e.preventDefault();onClose();return;}
        if(e.key==='Tab'){
          const items=getFocusables();
          if(!items.length)return;
          const first=items[0],last=items[items.length-1];
          if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
          else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
        }
      }
      document.addEventListener('keydown',onKeyDown);
      return()=>{
        document.removeEventListener('keydown',onKeyDown);
        if(prevFocus.current&&typeof prevFocus.current.focus==='function')prevFocus.current.focus();
      };
    },[active]);
  }


  // Campus dataset (buildings + road graph, ~50KB) loads as its own chunk
  // after first paint instead of shipping inline in the JS bundle.
  const [campusData,setCampusData]=useState(null);
  const [datasetError,setDatasetError]=useState(false);
  useEffect(()=>{
    let cancelled=false;
    import('./data/campusData.json')
      .then(mod=>{if(!cancelled)setCampusData(mod.default||mod);})
      .catch(err=>{console.error('Failed to load campus dataset:',err);if(!cancelled)setDatasetError(true);});
    return()=>{cancelled=true;};
  },[]);

  const BUILDINGS=useMemo(()=>{
    if(!campusData)return {};
    return { ...campusData.legacyBuildings, ...campusData.osmBuildings };
  },[campusData]);

  const {GRAPH,ALL_NODES}=useMemo(()=>{
    if(!campusData||Object.keys(BUILDINGS).length===0)return {GRAPH:{},ALL_NODES:{}};
    const {graph,allCoords}=buildRoadSnappedGraph(BUILDINGS,campusData.roadNodes,campusData.roadEdges,{snapMax:140});
    return {GRAPH:graph,ALL_NODES:allCoords};
  },[campusData,BUILDINGS]);

  const dataReady=campusData!==null && Object.keys(BUILDINGS).length>0;
  const geolocationSupported=typeof navigator!=='undefined'&&!!navigator.geolocation;

  // Route type: which of the 3 dijkstra weightings (see routeTypes.js) to
  // use for every route computed below. Defaults to 'shortest' since that's
  // the only mode guaranteed to differ from the others without real stairs
  // data tagged for this campus — see the honest caveat in routeTypes.js.
  const [routeType,setRouteType]=useState('shortest');
  const stairsEdgeSet=useMemo(()=>buildStairsEdgeSet(),[]);
  const routeEdgeWeightFn=useMemo(()=>getEdgeWeightFn(routeType,stairsEdgeSet),[routeType,stairsEdgeSet]);
  const ALL_ROUTE_TYPES=['shortest','fastest','accessible'];

  // "Auto" was time-of-day only, ignoring the device's own dark-mode setting.
  // If someone has their OS/browser set to dark, Auto now honors that during
  // daytime hours too (falls into the dark scheme) instead of showing a light
  // morning/afternoon look regardless of their system preference. Time-of-day
  // still governs which flavor of dark you get in the evening.
  const [prefersDarkOS,setPrefersDarkOS]=useState(()=>
    typeof window!=='undefined'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  useEffect(()=>{
    if(typeof window==='undefined'||!window.matchMedia)return;
    const mq=window.matchMedia('(prefers-color-scheme: dark)');
    const onChange=e=>setPrefersDarkOS(e.matches);
    if(mq.addEventListener)mq.addEventListener('change',onChange);
    else if(mq.addListener)mq.addListener(onChange);
    return()=>{
      if(mq.removeEventListener)mq.removeEventListener('change',onChange);
      else if(mq.removeListener)mq.removeListener(onChange);
    };
  },[]);

  const C=useMemo(()=>{
    const base=(userTheme==='auto'&&prefersDarkOS&&timeOfDay!=='evening')
      ? getColorScheme('dark',timeOfDay)
      : getColorScheme(userTheme,timeOfDay);
    return applyHighContrast(base,highContrast);
  },[userTheme,timeOfDay,prefersDarkOS,highContrast]);

  useEffect(()=>{
    const interval=setInterval(()=>{
      const newTime=getTimeOfDay();
      if(newTime!==timeOfDay)setTimeOfDay(newTime);
    },60000);
    return()=>clearInterval(interval);
  },[timeOfDay]);

  useEffect(()=>{
    if(!showLocModal)setTimeout(()=>setBottomVisible(true),300);
  },[showLocModal]);

  useEffect(()=>{
    try{
      const saved=localStorage.getItem('campus-nav-favorites');
      if(saved)setFavorites(JSON.parse(saved));
      else setFavorites(['library','central canteen','gym','pu gate-1']);
      const savedDistance=localStorage.getItem('campus-nav-distance');
      const savedSteps=localStorage.getItem('campus-nav-steps');
      if(savedDistance)setTotalDistance(parseFloat(savedDistance));
      if(savedSteps)setTotalSteps(parseInt(savedSteps));
      const savedCrew=localStorage.getItem('campus-nav-crew');
      if(savedCrew)setCrew(JSON.parse(savedCrew));
      const savedRecent=localStorage.getItem('campus-nav-recent');
      if(savedRecent)setRecentRoutes(JSON.parse(savedRecent));
      const savedSettings=localStorage.getItem('campus-nav-settings');
      if(savedSettings){
        const s=JSON.parse(savedSettings);
        if(s.textScaleKey)setTextScaleKey(s.textScaleKey);
        if(typeof s.highContrast==='boolean')setHighContrast(s.highContrast);
        if(typeof s.voiceEnabled==='boolean')setVoiceEnabled(s.voiceEnabled);
        if(typeof s.voiceVolume==='number')setVoiceVolume(s.voiceVolume);
        if(s.routeType)setRouteType(s.routeType);
      }
    }catch{}
  },[]);

  // Persists accessibility/route-type settings whenever any of them change —
  // separate from the load effect above so this doesn't need its own
  // duplicated try/catch per setting.
  useEffect(()=>{
    safeStorageSet('campus-nav-settings',JSON.stringify({textScaleKey,highContrast,voiceEnabled,voiceVolume,routeType}));
  },[textScaleKey,highContrast,voiceEnabled,voiceVolume,routeType]);

  const placePlayer=useCallback((lat,lng,hdg=0)=>{
    if(!mapRef.current||!window.L)return;
    const Lx=window.L;

    // ── Player marker: high-tech navigator pointer with cyber glow & radar sweep ──
    const html=`<div style="width:72px;height:72px;position:relative;display:flex;align-items:center;justify-content:center;">
      <div style="position:absolute;inset:4px;border-radius:50%;border:2px solid rgba(0,210,255,0.45);background:radial-gradient(circle, rgba(0,210,255,0.18) 0%, rgba(99,102,241,0.08) 55%, transparent 75%);animation:sonarPulse 2.4s cubic-bezier(0.2,0.8,0.2,1) infinite;pointer-events:none;"></div>
      <svg width="72" height="72" viewBox="0 0 100 100" style="filter:drop-shadow(0 4px 14px rgba(0,210,255,0.55)) drop-shadow(0 2px 6px rgba(0,0,0,0.45));overflow:visible;">
        <defs>
          <radialGradient id="navRadarGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#00F0FF" stop-opacity="0.35"/>
            <stop offset="60%" stop-color="#6366F1" stop-opacity="0.15"/>
            <stop offset="100%" stop-color="#6366F1" stop-opacity="0"/>
          </radialGradient>
          <linearGradient id="navArrowL" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#00F5FF"/>
            <stop offset="50%" stop-color="#00D2FF"/>
            <stop offset="100%" stop-color="#0284C7"/>
          </linearGradient>
          <linearGradient id="navArrowR" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#38BDF8"/>
            <stop offset="60%" stop-color="#0284C7"/>
            <stop offset="100%" stop-color="#0369A1"/>
          </linearGradient>
          <linearGradient id="navRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#00F5FF"/>
            <stop offset="50%" stop-color="#818CF8"/>
            <stop offset="100%" stop-color="#00E5FF"/>
          </linearGradient>
          <linearGradient id="navBeam" x1="50%" y1="100%" x2="50%" y2="0%">
            <stop offset="0%" stop-color="#00F5FF" stop-opacity="0"/>
            <stop offset="100%" stop-color="#00F5FF" stop-opacity="0.45"/>
          </linearGradient>
        </defs>
        <!-- Outer compass tech ring with tick marks -->
        <circle cx="50" cy="50" r="46" fill="url(#navRadarGlow)" stroke="url(#navRingGrad)" stroke-width="1.8" stroke-dasharray="3,6" opacity="0.85"/>
        <circle cx="50" cy="50" r="38" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="0.8" stroke-dasharray="1,4" opacity="0.6"/>
        
        <!-- Rotating Navigation Group -->
        <g class="compass-needle" style="transform-origin:50px 50px;transform:rotate(${hdg}deg);transition:transform 0.35s cubic-bezier(0.2,0,0,1);">
          <!-- Heading beam vision cone -->
          <polygon points="50,50 24,4 76,4" fill="url(#navBeam)"/>
          
          <!-- Beveled 3D Chevron Arrow with high-contrast dual tone -->
          <polygon points="50,12 50,48 28,58" fill="url(#navArrowL)" filter="drop-shadow(0 1px 2px rgba(0,0,0,0.3))"/>
          <polygon points="50,12 72,58 50,48" fill="url(#navArrowR)" filter="drop-shadow(0 1px 2px rgba(0,0,0,0.3))"/>
          <!-- Sharp center spine highlight -->
          <line x1="50" y1="12" x2="50" y2="48" stroke="#FFFFFF" stroke-width="1.2" stroke-linecap="round" opacity="0.95"/>
          <!-- Neon accent wing edges -->
          <line x1="50" y1="12" x2="28" y2="58" stroke="rgba(255,255,255,0.7)" stroke-width="0.8"/>
          <line x1="50" y1="12" x2="72" y2="58" stroke="rgba(255,255,255,0.7)" stroke-width="0.8"/>
        </g>
        
        <!-- Central crystal core indicator -->
        <circle cx="50" cy="50" r="10" fill="#0A0F1D" stroke="url(#navRingGrad)" stroke-width="2.2"/>
        <circle cx="50" cy="50" r="5" fill="#00F5FF"/>
        <circle cx="48" cy="48" r="1.8" fill="#FFFFFF" opacity="0.9"/>
      </svg>
    </div>`;

    if(!playerRef.current){
      const icon=Lx.divIcon({className:'',html,iconSize:[72,72],iconAnchor:[36,36]});
      playerRef.current=Lx.marker([lat,lng],{icon,zIndexOffset:1000}).addTo(mapRef.current);
    }else{
      playerRef.current.setLatLng([lat,lng]);
      const el=playerRef.current.getElement();
      if(el){const needle=el.querySelector('.compass-needle');if(needle)needle.style.transform=`rotate(${hdg}deg)`;}
    }

    const lastPos=walkingHistory.current[walkingHistory.current.length-1];
    const distanceMoved=lastPos?haversine(lastPos,{lat,lng}):0;
    if(distanceMoved>3||!lastPos){
      walkingHistory.current.push({lat,lng,time:Date.now()});
      if(walkingHistory.current.length>15)walkingHistory.current.shift();

      // ── Footprint trail: alternates left / right behind the player ─────────
      const isLeft=footstepsRef.current.length%2===0;
      const footstepHtml=`<div style="opacity:0.75;animation:fadeInFoot 0.3s ease;transform:rotate(${hdg}deg) ${isLeft?'translateX(-4px)':'translateX(4px)'};filter:drop-shadow(0 1px 3px rgba(0,0,0,0.2));"><img src="${FOOTPRINT_ICON}" width="20" height="20" style="object-fit:contain;display:block;" alt="footprint"/></div>`;
      const footIcon=Lx.divIcon({className:'',html:footstepHtml,iconSize:[20,20],iconAnchor:[10,10]});
      const footMarker=Lx.marker([lat,lng],{icon:footIcon,zIndexOffset:100}).addTo(mapRef.current);
      footstepsRef.current.push(footMarker);
      if(footstepsRef.current.length>15){const old=footstepsRef.current.shift();old.remove();}
    }
    if(isFollowing.current)mapRef.current.panTo([lat,lng],{animate:true,duration:0.5});
  },[C]);

  useEffect(()=>{
    if(route)setTimeout(()=>setRouteVisible(true),50);
    else setRouteVisible(false);
  },[route]);

  useEffect(()=>{
    if(!route||!route.steps||!route.steps.length)return;
    const currentStep=route.steps[stepIdx];
    if(!currentStep)return;
    if(stepIdx>0)vibrate([100,50,100]);

    // Animate navigator pointer to follow current step node along the route path
    const nodeKey=currentStep.key||currentStep.nextKey;
    const nodeCoord=ALL_NODES[nodeKey]||(BUILDINGS[nodeKey]?{lat:BUILDINGS[nodeKey].lat,lng:BUILDINGS[nodeKey].lng}:null);
    if(nodeCoord){
      // Calculate heading towards the next point in the step if available
      let hdg=0;
      if(currentStep.deg!==undefined&&currentStep.deg!==0){
        hdg=currentStep.deg;
      }else if(currentStep.nextKey&&ALL_NODES[currentStep.nextKey]){
        hdg=Math.round(calcBearing(nodeCoord,ALL_NODES[currentStep.nextKey]));
      }
      placePlayer(nodeCoord.lat,nodeCoord.lng,hdg);
      if(mapRef.current){
        mapRef.current.panTo([nodeCoord.lat,nodeCoord.lng],{animate:true,duration:0.6});
      }
    }

    // Highlight the active segment polyline between step.key and step.nextKey
    if(mapRef.current&&window.L){
      if(activeStepLayerRef.current){
        activeStepLayerRef.current.remove();
        activeStepLayerRef.current=null;
      }
      if(currentStep.key&&currentStep.nextKey&&route.path){
        const startI=route.path.indexOf(currentStep.key);
        const endI=route.path.indexOf(currentStep.nextKey);
        if(startI!==-1&&endI!==-1&&startI<endI){
          const subPath=route.path.slice(startI,endI+1);
          const subCoords=subPath.map(k=>[ALL_NODES[k].lat,ALL_NODES[k].lng]);
          activeStepLayerRef.current=window.L.polyline(subCoords,{
            color:'#00F5FF',
            weight:8,
            opacity:0.95,
            dashArray:'8,8',
            lineCap:'round',
          }).addTo(mapRef.current);
        }
      }
    }
  },[stepIdx,route,ALL_NODES,BUILDINGS,placePlayer]);

  // Voice narration: reads the current turn instruction aloud using the
  // browser's built-in speech synthesis (no external API/key needed). Only
  // fires when voice is turned on in Settings, and only once per step (a
  // ref tracks the last narrated step so re-renders that don't change the
  // step — e.g. a theme switch — don't repeat the same instruction).
  useEffect(()=>{
    if(!voiceEnabled||!route||!route.steps||!route.steps.length)return;
    if(typeof window==='undefined'||!window.speechSynthesis)return;
    const currentStep=route.steps[stepIdx];
    if(!currentStep)return;
    const stepSignature=`${route.destName}|${stepIdx}`;
    if(lastNarratedStepRef.current===stepSignature)return;
    lastNarratedStepRef.current=stepSignature;
    const text=currentStep.isArrival?currentStep.instruction:`${currentStep.instruction}, ${currentStep.dist} meters`;
    const utterance=new SpeechSynthesisUtterance(text);
    utterance.volume=Math.max(0,Math.min(1,voiceVolume/100));
    window.speechSynthesis.cancel(); // don't stack utterances if steps change quickly
    window.speechSynthesis.speak(utterance);
  },[stepIdx,route,voiceEnabled,voiceVolume]);

  // Stop any in-progress narration immediately if voice gets turned off
  // mid-route, and reset the "already narrated" tracking when a route ends
  // so the first step of the NEXT route always gets announced.
  useEffect(()=>{
    if(!voiceEnabled&&typeof window!=='undefined'&&window.speechSynthesis){
      window.speechSynthesis.cancel();
    }
  },[voiceEnabled]);
  useEffect(()=>{
    if(!route)lastNarratedStepRef.current=null;
  },[route]);

  useEffect(()=>{
    if(window.L){setLeaflet(window.L);return;}
    const s=document.createElement('script');
    s.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.onload=()=>setLeaflet(window.L);
    s.onerror=()=>{
      console.error('Failed to load Leaflet');
      setToast("Couldn't load the map. Check your connection and reload the page.");
    };
    document.head.appendChild(s);
  },[]);

  useEffect(()=>{
    if(!leaflet||!mapDiv.current||mapRef.current)return;
    const map=leaflet.map(mapDiv.current,{
      center:[CAMPUS_CENTER.lat,CAMPUS_CENTER.lng],
      zoom:17,zoomControl:false,attributionControl:true,
      zoomAnimation:true,fadeAnimation:true,markerZoomAnimation:true,
      scrollWheelZoom:true,
      wheelDebounceTime:60,
      wheelPxPerZoomLevel:90,
      smoothWheelZoom:true,
      touchZoom:true,
      dragging:true,
    });
    leaflet.control.zoom({position:'bottomright'}).addTo(map);
    map.on('dragstart zoomstart',()=>{isFollowing.current=false;setOffCentre(true);});
    mapRef.current=map;
    return()=>{if(mapRef.current){mapRef.current.remove();mapRef.current=null;}};
  },[leaflet]);

  // Kept as a safety net for the satellite/hybrid transitions in case any
  // flat-map layer refs are ever populated again — currently a no-op since
  // nothing draws into flatGroundRef/flatBuildingsRef/flatRoadsRef anymore
  // (the "Map" mode uses real tiles again, not a custom flat vector map).
  const clearFlatMap=useCallback(()=>{
    if(flatGroundRef.current){flatGroundRef.current.remove();flatGroundRef.current=null;}
    flatBuildingsRef.current.forEach(b=>b.remove());flatBuildingsRef.current=[];
    flatRoadsRef.current.forEach(r=>r.remove());flatRoadsRef.current=[];
  },[]);

  useEffect(()=>{
    if(!mapRef.current||!window.L)return;
    const Lx=window.L;
    const map=mapRef.current;
    if(tileLayerRef.current){tileLayerRef.current.remove();tileLayerRef.current=null;}
    if(labelLayerRef.current){labelLayerRef.current.remove();labelLayerRef.current=null;}
    setMapTileError(false);
    const wireTileEvents=layer=>{layer.on('tileerror',()=>setMapTileError(true));return layer;};
    if(mapMode==='satellite'){
      clearFlatMap();
      tileLayerRef.current=wireTileEvents(Lx.tileLayer(MAP_TILES.satellite.url,{maxZoom:20,subdomains:MAP_TILES.satellite.subdomains,attribution:'© Google',keepBuffer:4,updateWhenIdle:false}).addTo(map));
    }else if(mapMode==='hybrid'){
      clearFlatMap();
      tileLayerRef.current=wireTileEvents(Lx.tileLayer(MAP_TILES.hybrid.satellite,{maxZoom:20,subdomains:MAP_TILES.hybrid.subdomains,attribution:'© Google',keepBuffer:4,updateWhenIdle:false}).addTo(map));
      labelLayerRef.current=Lx.tileLayer(MAP_TILES.hybrid.labels,{subdomains:MAP_TILES.hybrid.subdomains,maxZoom:20,keepBuffer:4,updateWhenIdle:false}).addTo(map);
    }else{
      // "Map" mode: real OpenStreetMap tiles — the full, freely-pannable
      // world map, not restricted to campus.
      clearFlatMap();
      let tileConfig=userTheme==='auto'?MAP_TILES.standard[timeOfDay]:MAP_TILES.standard[userTheme];
      tileLayerRef.current=wireTileEvents(Lx.tileLayer(tileConfig.url,{maxZoom:20,attribution:'© OpenStreetMap contributors',keepBuffer:4,updateWhenIdle:false}).addTo(map));
    }
  },[mapMode,userTheme,timeOfDay,leaflet,clearFlatMap]);

  useEffect(()=>()=>{
    if(watchId.current)navigator.geolocation.clearWatch(watchId.current);
    footstepsRef.current.forEach(f=>f.remove());
    footstepsRef.current=[];walkingHistory.current=[];
  },[]);


  const dismissSheet=(cb)=>{
    setSheetVisible(false);
    setTimeout(()=>{setShowLocModal(false);if(cb)cb();},380);
  };

  const handleAllowGPS=()=>{setLocLabel('GPS active');dismissSheet(()=>startGPS());};
  const handleAllowOnce=()=>{
    const pos={lat:CAMPUS_CENTER.lat,lng:CAMPUS_CENTER.lng};
    setGpsPos(pos);setLocLabel('PU Campus');
    placePlayer(pos.lat,pos.lng,0);
    if(mapRef.current)mapRef.current.flyTo([pos.lat,pos.lng],17,{animate:true,duration:1});
    dismissSheet(null);
  };
  const handleDontAllow=()=>{
    const pos=BUILDINGS['pu gate-1']||CAMPUS_CENTER;
    setGpsPos(pos);setLocLabel('PU Gate-1');
    placePlayer(pos.lat,pos.lng,0);
    if(mapRef.current)mapRef.current.flyTo([pos.lat,pos.lng],17,{animate:true,duration:1});
    dismissSheet(null);
  };

  // ── Manual location: opens the searchable building-list picker from the
  // location sheet; selecting a building sets gpsPos directly. ───────────
  const openManualPicker=()=>{
    dismissSheet(()=>{setManualQuery('');setShowManualPicker(true);});
  };

  const closeManualPicker=()=>setShowManualPicker(false);

  const selectManualLocation=(key)=>{
    const b=BUILDINGS[key];
    if(!b)return;
    const pos={lat:b.lat,lng:b.lng};
    setGpsPos(pos);
    setLocLabel(`Set: ${b.name}`);
    placePlayer(pos.lat,pos.lng,0);
    if(mapRef.current)mapRef.current.flyTo([pos.lat,pos.lng],17,{animate:true,duration:0.8});
    setShowManualPicker(false);
  };

  const startGPS=()=>{
    if(!navigator.geolocation){setToast('GPS is not supported on this device.');setLocLabel('GPS not available');return;}
    setLocLabel('Getting GPS location...');
    watchId.current=navigator.geolocation.watchPosition(
      pos=>{
        const{latitude:lat,longitude:lng,heading}=pos.coords;
        const newPos={lat,lng};
        if(lastGpsPos.current&&lastGpsPos.current.lat&&lastGpsPos.current.lng){
          const distanceMoved=haversine(lastGpsPos.current,newPos);
          if(distanceMoved>2&&distanceMoved<100){
            setTotalDistance(prev=>{const nT=prev+distanceMoved;safeStorageSet('campus-nav-distance',nT.toString());return nT;});
            const steps=Math.round(distanceMoved/0.75);
            setTotalSteps(prev=>{const nT=prev+steps;safeStorageSet('campus-nav-steps',nT.toString());return nT;});
          }
        }
        lastGpsPos.current=newPos;
        setGpsPos(newPos);setLocLabel('GPS active');
        placePlayer(lat,lng,heading||0);
      },
      err=>{
        console.warn('GPS error:',err);
        const messages={
          1:'Location access was denied. Enable it in your browser\'s site settings to use live GPS.',
          2:'Location is unavailable right now. This works best outdoors with a clear view of the sky.',
          3:'Location took too long to respond. Check your GPS/network signal and try again.',
        };
        const label={1:'Location access denied',2:'Location unavailable',3:'Location timed out'}[err.code]||'GPS error';
        setLocLabel(label);
        setToast(messages[err.code]||'Could not get your location.');
        const pos={lat:CAMPUS_CENTER.lat,lng:CAMPUS_CENTER.lng};
        setGpsPos(pos);placePlayer(pos.lat,pos.lng,0);
        if(mapRef.current)mapRef.current.flyTo([pos.lat,pos.lng],17);
      },
      {enableHighAccuracy:true,maximumAge:1500,timeout:12000}
    );
  };

  const clearAltRoutes=useCallback(()=>{
    altRouteLayers.current.forEach(l=>l.remove());
    altRouteLayers.current=[];
  },[]);

  const drawRoute=useCallback((path)=>{
    if(!mapRef.current||!window.L||!path||path.length<2)return;
    const Lx=window.L;
    clearAltRoutes();
    routeLayers.current.forEach(l=>l.remove());
    routeLayers.current=[];
    const coords=path.map(k=>[ALL_NODES[k].lat,ALL_NODES[k].lng]);
    const glow=Lx.polyline(coords,{color:C.accentLight.replace('0.12','0.22').replace('0.18','0.22'),weight:22,opacity:1}).addTo(mapRef.current);
    const casing=Lx.polyline(coords,{color:C.routeCasing,weight:10,opacity:0.9}).addTo(mapRef.current);
    const core=Lx.polyline(coords,{color:C.accent,weight:5,opacity:1}).addTo(mapRef.current);
    routeLayers.current=[glow,casing,core];
    // only mark real named waypoints (not every road vertex) to avoid clutter
    path.slice(1,-1).filter(k=>BUILDINGS[k]).forEach(k=>{
      const dot=Lx.circleMarker([ALL_NODES[k].lat,ALL_NODES[k].lng],{radius:5,color:C.routeCasing,fillColor:C.accent,fillOpacity:1,weight:2}).addTo(mapRef.current);
      routeLayers.current.push(dot);
    });
    if(destMarker.current)destMarker.current.remove();
    const dest=BUILDINGS[path[path.length-1]];
    const pinHtml=`<div style="position:relative;width:40px;height:52px;display:flex;align-items:center;justify-content:center;">
      <div style="position:absolute;bottom:0;left:6px;width:28px;height:12px;border-radius:50%;background:radial-gradient(ellipse, rgba(255,59,48,0.5) 0%, rgba(255,59,48,0) 70%);animation:sonarPulse 2s cubic-bezier(0,0,0.2,1) infinite;"></div>
      <div style="animation:destBeacon 2s ease-in-out infinite;transform-origin:20px 48px;">
        <svg width="40" height="52" viewBox="0 0 40 52" style="overflow:visible;">
          <defs>
            <linearGradient id="destGradL" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#FF6B6B"/>
              <stop offset="50%" stop-color="#EE2A35"/>
              <stop offset="100%" stop-color="#C0081C"/>
            </linearGradient>
            <linearGradient id="destGradR" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#FF8E8E"/>
              <stop offset="60%" stop-color="#FF3848"/>
              <stop offset="100%" stop-color="#D9162A"/>
            </linearGradient>
            <linearGradient id="destRim" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#FFE600"/>
              <stop offset="100%" stop-color="#FF9500"/>
            </linearGradient>
            <radialGradient id="destCore" cx="40%" cy="35%" r="60%">
              <stop offset="0%" stop-color="#FFFFFF"/>
              <stop offset="50%" stop-color="#FFD1D5"/>
              <stop offset="100%" stop-color="#FFA8B0"/>
            </radialGradient>
          </defs>
          <!-- Pin Body with faceted jewel effect -->
          <path d="M20 2C10.1 2 2 10.1 2 20c0 14 18 30 18 30s18-16 18-30C38 10.1 29.9 2 20 2z" fill="url(#destGradL)" stroke="rgba(255,255,255,0.85)" stroke-width="1.6"/>
          <path d="M20 2C29.9 2 38 10.1 38 20c0 14-18 30-18 30V2z" fill="url(#destGradR)" opacity="0.6"/>
          <!-- Glowing Target Ring -->
          <circle cx="20" cy="20" r="10.5" fill="#1C1B29" stroke="url(#destRim)" stroke-width="2"/>
          <circle cx="20" cy="20" r="6" fill="url(#destCore)"/>
          <circle cx="20" cy="20" r="2.2" fill="#D9162A"/>
        </svg>
      </div>
    </div>`;
    const pinIcon=Lx.divIcon({className:'',html:pinHtml,iconSize:[40,52],iconAnchor:[20,50]});
    destMarker.current=Lx.marker([dest.lat,dest.lng],{icon:pinIcon}).addTo(mapRef.current);
    mapRef.current.fitBounds(Lx.latLngBounds(coords),{padding:[100,70],animate:true});
    isFollowing.current=false;setOffCentre(false);
  },[C,BUILDINGS,ALL_NODES,clearAltRoutes]);

  // Computes every OTHER route type's path for the same trip and draws each
  // as a thin, dashed, semi-transparent line the person can click to swap
  // it in as the active route. Paths identical to the active one (common
  // between shortest/fastest without real stairs data) are skipped so
  // there's nothing to click that wouldn't visibly change anything.
  const drawAlternateRoutes=useCallback((fromKey,toKey,activeType,activePath)=>{
    if(!mapRef.current||!window.L)return;
    clearAltRoutes();
    routeEndpointsRef.current={fromKey,toKey};
    const Lx=window.L;
    const activeKeySet=activePath.join('|');
    ALL_ROUTE_TYPES.filter(t=>t!==activeType).forEach(t=>{
      const weightFn=getEdgeWeightFn(t,stairsEdgeSet);
      const altPath=dijkstra(GRAPH,ALL_NODES,BUILDINGS,fromKey,toKey,weightFn);
      if(!altPath||altPath.join('|')===activeKeySet)return; // same road, nothing to offer
      const coords=altPath.map(k=>[ALL_NODES[k].lat,ALL_NODES[k].lng]);
      // Wide, near-invisible line first so there's a generous tap/click target,
      // then the visible dashed line on top of it.
      const hitArea=Lx.polyline(coords,{color:'#000',weight:16,opacity:0.02,interactive:true}).addTo(mapRef.current);
      const visible=Lx.polyline(coords,{color:C.textLight,weight:4,opacity:0.55,dashArray:'2,10'}).addTo(mapRef.current);
      [hitArea,visible].forEach(layer=>{
        layer.on('click',()=>selectAlternativeRoute(t,fromKey,toKey));
        layer.on('mouseover',()=>visible.setStyle({opacity:0.9,weight:5}));
        layer.on('mouseout',()=>visible.setStyle({opacity:0.55,weight:4}));
      });
      altRouteLayers.current.push(hitArea,visible);
    });
  },[C,BUILDINGS,ALL_NODES,GRAPH,stairsEdgeSet,clearAltRoutes]);

  // Promotes an alternate route to the active one: recomputes its path
  // fresh (cheap — same dijkstra call used everywhere else), redraws it as
  // the highlighted main route, and redraws the remaining types as the new
  // set of clickable alternates.
  const selectAlternativeRoute=useCallback((newType,fromKey,toKey)=>{
    const weightFn=getEdgeWeightFn(newType,stairsEdgeSet);
    const path=dijkstra(GRAPH,ALL_NODES,BUILDINGS,fromKey,toKey,weightFn);
    if(!path){
      setToast(newType==='accessible'?'No stairs-free route is available for this destination.':'That route option is not available for this destination.');
      return;
    }
    const result=buildSteps(BUILDINGS,ALL_NODES,path);
    setRouteType(newType);
    setRoute(prev=>({...result,path,destName:BUILDINGS[toKey].name,startName:BUILDINGS[fromKey].name,routeType:newType,isEmergency:prev?.isEmergency,isPanic:prev?.isPanic}));
    setStepIdx(0);
    drawRoute(path);
    drawAlternateRoutes(fromKey,toKey,newType,path);
    vibrate(30);
  },[GRAPH,ALL_NODES,BUILDINGS,stairsEdgeSet,drawRoute,drawAlternateRoutes]);

  const findNearestBuilding=(pos)=>{
    let best=null,bestD=Infinity;
    for(const[k,b]of Object.entries(BUILDINGS)){const d=haversine(pos,b);if(d<bestD){bestD=d;best=k;}}
    return best;
  };

  const findNearestExit = useCallback(() => {
    const exits = ['pu gate-1', 'pu gate-3'];
    const currentPos = gpsPos || BUILDINGS['pu gate-1'];
    const startKey = findNearestBuilding(currentPos);
    let nearestExit = null;
    let shortestDistance = Infinity;
    exits.forEach(exit => {
      const path = dijkstra(GRAPH, ALL_NODES, BUILDINGS, startKey, exit, routeEdgeWeightFn);
      if (path) {
        const result = buildSteps(BUILDINGS, ALL_NODES, path);
        if (result.total < shortestDistance) {
          shortestDistance = result.total;
          nearestExit = { exit, path, ...result };
        }
      }
    });
    if (nearestExit) {
      setRoute({
        ...nearestExit,
        path: nearestExit.path,
        destName: BUILDINGS[nearestExit.exit].name,
        startName: BUILDINGS[startKey].name,
        isEmergency: true
      });
      setStepIdx(0);
      drawRoute(nearestExit.path);
      setFabOpen(false);
      vibrate([200, 100, 200]);
    }
  }, [gpsPos, drawRoute, GRAPH, ALL_NODES, BUILDINGS, routeEdgeWeightFn]);

  const startPanicHold=()=>{
    if(panicHoldTimer.current)return;
    setPanicHolding(true);
    vibrate(20);
    panicHoldTimer.current=setTimeout(()=>{
      panicHoldTimer.current=null;
      setPanicHolding(false);
      activatePanicMode();
    },900);
  };
  const cancelPanicHold=()=>{
    setPanicHolding(false);
    if(panicHoldTimer.current){clearTimeout(panicHoldTimer.current);panicHoldTimer.current=null;}
  };

  const activatePanicMode = useCallback(() => {
    setPanicActive(true);
    setEmergencyMessage('Emergency route started. Share your location with a trusted contact or call local emergency services.');
    vibrate([300, 100, 300, 100, 300]);
    if (gpsPos) {
      const emergencyText = `🆘 EMERGENCY - I need help!\nLocation: ${gpsPos.lat.toFixed(6)}, ${gpsPos.lng.toFixed(6)}\nView: https://www.google.com/maps?q=${gpsPos.lat},${gpsPos.lng}`;
      if (navigator.share) {
        navigator.share({ title: '🆘 EMERGENCY', text: emergencyText }).catch(() => {});
      } else {
        navigator.clipboard.writeText(emergencyText);
      }
    }
    const currentPos = gpsPos || BUILDINGS['pu gate-1'];
    const startKey = findNearestBuilding(currentPos);
    let nearestSafeZone = null;
    let shortestDistance = Infinity;
    SAFE_ZONES.forEach(zone => {
      const path = dijkstra(GRAPH, ALL_NODES, BUILDINGS, startKey, zone.key, routeEdgeWeightFn);
      if (path) {
        const result = buildSteps(BUILDINGS, ALL_NODES, path);
        if (result.total < shortestDistance) {
          shortestDistance = result.total;
          nearestSafeZone = { zone: zone.key, path, ...result };
        }
      }
    });
    if (nearestSafeZone) {
      setRoute({
        ...nearestSafeZone,
        path: nearestSafeZone.path,
        destName: BUILDINGS[nearestSafeZone.zone].name,
        startName: BUILDINGS[startKey].name,
        isPanic: true
      });
      setStepIdx(0);
      drawRoute(nearestSafeZone.path);
    }
    setFabOpen(false);
    // No fixed auto-dismiss timer: the banner previously vanished after 30s
    // even though the emergency route (and the emergency itself) could still
    // be ongoing. It now stays until the person taps Dismiss or exits the
    // route (see exitRoute below), matching how long the situation actually
    // lasts instead of an arbitrary countdown.
  }, [gpsPos, drawRoute, GRAPH, ALL_NODES, BUILDINGS, routeEdgeWeightFn]);

  const generateMeetPoint = useCallback(() => {
    if (!gpsPos) return null;
    const nearestKey = findNearestBuilding(gpsPos);
    const landmark = BUILDINGS[nearestKey];
    const distance = Math.round(haversine(gpsPos, landmark));
    const eta = Math.ceil(distance / 80);
    const meetMessage = `📍 Meet me at ${landmark.name}\n\nI'm ${distance}m away, arriving in ~${eta} min\n\nLocation: ${landmark.lat.toFixed(5)}, ${landmark.lng.toFixed(5)}\nView: https://www.google.com/maps?q=${landmark.lat},${landmark.lng}`;
    return { location: landmark.name, distance, eta, message: meetMessage, coordinates: { lat: landmark.lat, lng: landmark.lng } };
  }, [gpsPos, BUILDINGS]);

  // ── My Crew helpers ──────────────────────────────────────────────────────
  // MAX_CREW / normalizeNameForCompare / cleanCrewName / isDuplicateName /
  // isCrewFull now live in src/utils/crew.js (see crew.test.js for coverage) —
  // pulled in via the import at the top of this file.
  const persistCrew=(updated)=>{
    setCrew(updated);
    try{localStorage.setItem('campus-nav-crew',JSON.stringify(updated));}
    catch{setToast("Your crew list couldn't be saved on this device.");}
  };

  const addCrewMember=()=>{
    const name=cleanCrewName(newCrewName);
    if(!name)return;
    if(isCrewFull(crew,MAX_CREW)){setToast(`Your crew is capped at ${MAX_CREW} people.`);return;}
    if(isDuplicateName(crew,name)){setToast(`"${name}" is already in your crew.`);return;}
    const member={id:Date.now().toString(),name};
    persistCrew([...crew,member]);
    setNewCrewName('');
    vibrate(30);
  };

  // Delete is two taps: first tap arms confirmDeleteId and starts a 3s window;
  // a second tap on the same chip within that window deletes for real. Any
  // other tap (another chip, elsewhere) or a lapsed timer cancels — so the
  // single stray tap that used to nuke a name silently now can't.
  const requestRemoveCrewMember=(id)=>{
    if(confirmDeleteId===id){
      if(confirmDeleteTimer.current){clearTimeout(confirmDeleteTimer.current);confirmDeleteTimer.current=null;}
      setConfirmDeleteId(null);
      const updated=crew.filter(c=>c.id!==id);
      persistCrew(updated);
      if(selectedCrewId===id)setSelectedCrewId(null);
      vibrate(40);
      return;
    }
    setConfirmDeleteId(id);
    vibrate(20);
    if(confirmDeleteTimer.current)clearTimeout(confirmDeleteTimer.current);
    confirmDeleteTimer.current=setTimeout(()=>{setConfirmDeleteId(null);confirmDeleteTimer.current=null;},3000);
  };
  const cancelRemoveCrewMember=()=>{
    if(confirmDeleteTimer.current){clearTimeout(confirmDeleteTimer.current);confirmDeleteTimer.current=null;}
    setConfirmDeleteId(null);
  };

  // Inline rename: tapping a chip's name (not its × ) swaps it for a text
  // field, so a typo doesn't mean delete-and-re-add.
  const startEditCrew=(member)=>{
    cancelRemoveCrewMember();
    setEditingCrewId(member.id);
    setEditingCrewValue(member.name);
  };
  const saveEditCrew=()=>{
    const name=cleanCrewName(editingCrewValue);
    if(!name){setEditingCrewId(null);return;}
    if(isDuplicateName(crew,name,editingCrewId)){setToast(`"${name}" is already in your crew.`);return;}
    persistCrew(crew.map(c=>c.id===editingCrewId?{...c,name}:c));
    setEditingCrewId(null);
    setEditingCrewValue('');
  };
  const cancelEditCrew=()=>{setEditingCrewId(null);setEditingCrewValue('');};

  const shareMeetPoint = useCallback(() => {
    const meetPoint = generateMeetPoint();
    if (!meetPoint) return;
    const recipient=crew.find(c=>c.id===selectedCrewId);
    const expiresAt=new Date(Date.now()+30*60000).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
    // Recipient's name is a local note to YOU about who this is for. It only
    // rides along in the actual message text if includeNameInShare is on —
    // otherwise the outgoing text stays generic, so a forwarded/screenshotted
    // message doesn't out who you were sharing with.
    const greeting=(recipient&&includeNameInShare)?`Hey ${recipient.name} — `:'';
    const message=`${greeting}${meetPoint.message}\n\n(This link is only meant for you — treat it as private. Expires ${expiresAt})`;
    if (navigator.share) {
      navigator.share({ title: '📍 Meet Me Here', text: message }).catch(() => {});
    } else {
      navigator.clipboard.writeText(message).then(() => {
        setMeetMeCopied(true);
        setTimeout(() => setMeetMeCopied(false), 2000);
      });
    }
    vibrate(100);
  }, [generateMeetPoint, crew, selectedCrewId, includeNameInShare]);

  const persistRecentRoutes=(updated)=>{
    setRecentRoutes(updated);
    try{localStorage.setItem('campus-nav-recent',JSON.stringify(updated));}catch{setToast("Recent routes couldn't be saved on this device.");}
  };

  const speakFeedback=(text)=>{
    if(typeof window==='undefined'||!window.speechSynthesis)return;
    try{
      if(window.speechSynthesis.paused)window.speechSynthesis.resume();
      window.speechSynthesis.cancel();
      const u=new SpeechSynthesisUtterance(text);
      u.lang='en-IN';
      u.rate=1.0;
      u.volume=Math.max(0.2,Math.min(1,(voiceVolume||80)/100));
      u.onerror=()=>{try{window.speechSynthesis.cancel();}catch{}};
      window.speechSynthesis.speak(u);
    }catch(e){console.warn('Voice feedback synthesis error:',e);}
  };

  const handleSearch=(queryText,fromVoice=false)=>{
    // Always release any pending voice recognition immediately to prevent deadlocks
    setIsListening(false);
    if(recognitionRef.current){
      try{recognitionRef.current.abort();}catch{}
      recognitionRef.current=null;
    }

    const cleanText=(queryText||'').replace(/[.?!,]+$/,'').trim();
    if(!cleanText){
      setSearchMessage('Please enter or speak a destination.');
      return;
    }

    let {source,destination}=extractLocations(BUILDINGS,cleanText);
    let fallbackUsed=false;

    // If destination is not recognized, attempt intelligent keyword matching or connect to proper campus endpoint
    if(!destination){
      fallbackUsed=true;
      const lowerQuery=cleanText.toLowerCase().replace(/[^a-z0-9\s]/g,' ');
      const words=lowerQuery.split(/\s+/).filter(w=>w.length>=3);
      
      // Check for alias keyword matches
      for(const word of words){
        for(const [alias,key] of Object.entries(ALIASES)){
          if((alias.includes(word)||word.includes(alias))&&BUILDINGS[key]){
            destination=key;
            break;
          }
        }
        if(destination)break;
      }

      // Check building keys and names
      if(!destination){
        for(const word of words){
          for(const [key,bldg] of Object.entries(BUILDINGS)){
            const bName=(bldg?.name||'').toLowerCase();
            if((key.includes(word)||bName.includes(word))&&BUILDINGS[key]){
              destination=key;
              break;
            }
          }
          if(destination)break;
        }
      }

      // If completely non-existent / not found, connect to a prominent campus endpoint
      // so there is never a deadlock or need to reload!
      if(!destination){
        const startCandidate=source||(gpsPos?findNearestBuilding(gpsPos):'pu gate-1');
        // If starting at or near Main Gate, route to Central Canteen; otherwise route to Main Gate
        if(startCandidate==='pu gate-1'||startCandidate==='main gate'){
          destination=BUILDINGS['central canteen']?'central canteen':BUILDINGS['library']?'library':Object.keys(BUILDINGS)[0];
        }else{
          destination=BUILDINGS['pu gate-1']?'pu gate-1':BUILDINGS['central canteen']?'central canteen':Object.keys(BUILDINGS)[0];
        }
      }
    }

    const startKey=source||(gpsPos?findNearestBuilding(gpsPos):'pu gate-1');
    if(startKey===destination){
      // If already at destination, connect to the other primary hub
      destination=startKey==='pu gate-1'?'central canteen':'pu gate-1';
      fallbackUsed=true;
    }

    let path=dijkstra(GRAPH,ALL_NODES,BUILDINGS,startKey,destination,routeEdgeWeightFn);
    if(!path){
      // If no path to that specific point, connect to Main Gate or Central Canteen
      const safeFallback=BUILDINGS['pu gate-1']?'pu gate-1':'central canteen';
      const fallbackPath=dijkstra(GRAPH,ALL_NODES,BUILDINGS,startKey,safeFallback,routeEdgeWeightFn);
      if(fallbackPath){
        destination=safeFallback;
        path=fallbackPath;
        fallbackUsed=true;
      }else{
        const msg=routeType==='accessible'?'No stairs-free route available. Try standard walking mode.':'Walking route is currently unavailable for this path.';
        setSearchMessage(msg);
        if(fromVoice)speakFeedback(msg);
        return;
      }
    }

    const result=buildSteps(BUILDINGS,ALL_NODES,path);
    setRoute({
      ...result,
      path,
      destName:BUILDINGS[destination]?.name||'Destination',
      startName:BUILDINGS[startKey]?.name||'Start',
      routeType,
      fallbackFrom:fallbackUsed?cleanText:null,
      toKey:destination,
      fromKey:startKey
    });
    setStepIdx(0);
    drawRoute(path);
    drawAlternateRoutes(startKey,destination,routeType,path);
    setShowSearch(false);
    setSearchVisible(false);
    setQuery('');
    setSuggestions([]);
    setSearchMessage('');
    persistRecentRoutes([{fromKey:startKey,toKey:destination,from:BUILDINGS[startKey]?.name||startKey,to:BUILDINGS[destination]?.name||destination},...recentRoutes.slice(0,4)]);

    if(fallbackUsed){
      const spokenMsg=`I could not find ${cleanText}. Connecting you to ${BUILDINGS[destination]?.name||'Main Gate'}.`;
      setToast(`Couldn't find "${cleanText}". Connected to ${BUILDINGS[destination]?.name||'Main Gate'}.`);
      if(fromVoice||voiceEnabled)speakFeedback(spokenMsg);
    }else{
      if(fromVoice||voiceEnabled){
        speakFeedback(`Navigating to ${BUILDINGS[destination]?.name}, about ${result.total} meters away.`);
      }
    }
  };

  // Routes straight to a known BUILDINGS key — used by search suggestion clicks,
  // Nearby spots, and Favorites, so we never depend on re-parsing a display name
  // (which breaks on names containing " - ", commas, etc.)
  const selectDestination=(destKey)=>{
    if(!BUILDINGS[destKey])return;
    const startKey=gpsPos?findNearestBuilding(gpsPos):'pu gate-1';
    if(startKey===destKey){setSearchMessage('You are already at this location. Choose another destination.');return;}
    const path=dijkstra(GRAPH,ALL_NODES,BUILDINGS,startKey,destKey,routeEdgeWeightFn);
    if(!path){setSearchMessage(routeType==='accessible'?'No stairs-free route is available to this destination.':'A walking route is not available for this destination yet.');return;}
    const result=buildSteps(BUILDINGS,ALL_NODES,path);
    setRoute({...result,path,destName:BUILDINGS[destKey].name,startName:BUILDINGS[startKey].name,routeType});
    setStepIdx(0);drawRoute(path);
    drawAlternateRoutes(startKey,destKey,routeType,path);
    setShowSearch(false);setSearchVisible(false);setQuery('');setSuggestions([]);setSearchMessage('');
    persistRecentRoutes([{fromKey:startKey,toKey:destKey,from:BUILDINGS[startKey].name,to:BUILDINGS[destKey].name},...recentRoutes.slice(0,4)]);
  };

  // Replays a recent route by its stored keys instead of re-parsing display
  // names — the same key path as selectDestination, but keeps the ORIGINAL
  // start point rather than recomputing "nearest building to me" fresh, since
  // that's what "recent" is meant to reproduce.
  const routeBetweenKeys=(fromKey,toKey)=>{
    if(!BUILDINGS[fromKey]||!BUILDINGS[toKey]){setSearchMessage('This recent route is no longer available.');return;}
    if(fromKey===toKey){setSearchMessage('You are already at this location. Choose another destination.');return;}
    const path=dijkstra(GRAPH,ALL_NODES,BUILDINGS,fromKey,toKey,routeEdgeWeightFn);
    if(!path){setSearchMessage(routeType==='accessible'?'No stairs-free route is available to this destination.':'A walking route is not available for this destination yet.');return;}
    const result=buildSteps(BUILDINGS,ALL_NODES,path);
    setRoute({...result,path,destName:BUILDINGS[toKey].name,startName:BUILDINGS[fromKey].name,routeType});
    setStepIdx(0);drawRoute(path);
    drawAlternateRoutes(fromKey,toKey,routeType,path);
    setShowSearch(false);setSearchVisible(false);setQuery('');setSuggestions([]);setSearchMessage('');
    persistRecentRoutes([{fromKey,toKey,from:BUILDINGS[fromKey].name,to:BUILDINGS[toKey].name},...recentRoutes.filter(r=>!(r.fromKey===fromKey&&r.toKey===toKey)).slice(0,4)]);
  };

  // Switches route type for the CURRENTLY ACTIVE route without needing a
  // fresh search. Deliberately computes the weight function directly from
  // `newType` here rather than calling setRouteType() and letting the
  // memoized `routeEdgeWeightFn` pick it up — React state updates aren't
  // synchronous, so recomputing the route in the same tick as setRouteType()
  // would still see the OLD routeEdgeWeightFn from this render's closure,
  // silently drawing the wrong route type. Computing fresh here avoids that.
  const changeActiveRouteType=(newType)=>{
    setRouteType(newType);
    if(!route||!route.path||route.path.length<2)return;
    const fromKey=route.path[0],toKey=route.path[route.path.length-1];
    const weightFn=getEdgeWeightFn(newType,stairsEdgeSet);
    const path=dijkstra(GRAPH,ALL_NODES,BUILDINGS,fromKey,toKey,weightFn);
    if(!path){
      setToast(newType==='accessible'?'No stairs-free route is available for this destination.':'That route option is not available for this destination.');
      return;
    }
    const result=buildSteps(BUILDINGS,ALL_NODES,path);
    setRoute(prev=>({...result,path,destName:BUILDINGS[toKey].name,startName:BUILDINGS[fromKey].name,routeType:newType,isEmergency:prev?.isEmergency,isPanic:prev?.isPanic}));
    setStepIdx(0);
    drawRoute(path);
    drawAlternateRoutes(fromKey,toKey,newType,path);
  };

  const openSearch=()=>{
    setSearchMessage('');
    setShowSearch(true);
    setTimeout(()=>{
      setSearchVisible(true);
      if(searchInputRef.current) searchInputRef.current.focus();
    },50);
  };
  const closeSearch=()=>{setSearchVisible(false);setTimeout(()=>{setShowSearch(false);setQuery('');setSuggestions([]);setSearchMessage('');},300);};

  useFocusTrap(showSearch,searchModalRef,closeSearch);
  useFocusTrap(showLocModal,locModalRef,handleDontAllow);
  useFocusTrap(showLostModal,lostModalRef,()=>setShowLostModal(false));
  useFocusTrap(fabOpen,fabPanelRef,()=>setFabOpen(false));
  useFocusTrap(showSettings,settingsPanelRef,()=>setShowSettings(false));
  useFocusTrap(showManualPicker,manualPickerRef,closeManualPicker);

  // The input box itself updates instantly (no typing lag); only the scan
  // over BUILDINGS for suggestions is debounced, so fast typers don't
  // re-filter the whole list on every single keystroke.
  const queryDebounceTimer=useRef(null);
  const handleQueryChange=(val)=>{
    setQuery(val);
    setSearchMessage('');
    if(queryDebounceTimer.current)clearTimeout(queryDebounceTimer.current);
    if(!val.trim()){setSuggestions([]);return;}
    queryDebounceTimer.current=setTimeout(()=>{
      const lv=val.toLowerCase();
      setSuggestions(Object.entries(BUILDINGS).filter(([k,b])=>b.name.toLowerCase().includes(lv)||k.includes(lv)).slice(0,6).map(([k,b])=>({key:k,name:b.name})));
    },150);
  };
  useEffect(()=>()=>{if(queryDebounceTimer.current)clearTimeout(queryDebounceTimer.current);},[]);

  const exitRoute=()=>{
    setRouteVisible(false);
    setTimeout(()=>{
      setRoute(null);setStepIdx(0);
      clearAltRoutes();
      routeEndpointsRef.current=null;
      if(activeStepLayerRef.current){activeStepLayerRef.current.remove();activeStepLayerRef.current=null;}
      routeLayers.current.forEach(l=>l.remove());routeLayers.current=[];
      if(destMarker.current){destMarker.current.remove();destMarker.current=null;}
      footstepsRef.current.forEach(f=>f.remove());footstepsRef.current=[];
      walkingHistory.current=[];isFollowing.current=true;
      if(mapRef.current&&gpsPos)mapRef.current.flyTo([gpsPos.lat,gpsPos.lng],17);
      setPanicActive(false); // clear the banner along with the emergency route it described
    },300);
  };

  const reCentre=()=>{
    if(!mapRef.current||!gpsPos)return;
    mapRef.current.flyTo([gpsPos.lat,gpsPos.lng],17,{animate:true,duration:0.8});
    isFollowing.current=true;setOffCentre(false);
  };

  const vibrate=(pattern)=>{if('vibrate' in navigator)navigator.vibrate(pattern);};

  const requestResetStats=()=>{
    if(statsResetConfirm){
      if(statsResetTimer.current){clearTimeout(statsResetTimer.current);statsResetTimer.current=null;}
      setStatsResetConfirm(false);
      setTotalDistance(0);setTotalSteps(0);
      safeStorageSet('campus-nav-distance','0');
      safeStorageSet('campus-nav-steps','0');
      vibrate(40);
      return;
    }
    setStatsResetConfirm(true);
    if(statsResetTimer.current)clearTimeout(statsResetTimer.current);
    statsResetTimer.current=setTimeout(()=>{setStatsResetConfirm(false);statsResetTimer.current=null;},3000);
  };


  const toggleFavorite=(key)=>{
    const newFavorites=favorites.includes(key)?favorites.filter(f=>f!==key):[...favorites,key];
    setFavorites(newFavorites);
    safeStorageSet('campus-nav-favorites',JSON.stringify(newFavorites));
    vibrate(50);
  };

  const shareLocation=()=>{
    if(!gpsPos)return;
    const text=`I'm at Parul University campus!\nLocation: ${gpsPos.lat.toFixed(6)}, ${gpsPos.lng.toFixed(6)}\nView on map: https://www.google.com/maps?q=${gpsPos.lat},${gpsPos.lng}`;
    if(navigator.share){navigator.share({title:'My Location - Campus Navigator',text}).catch(()=>{});}
    else{
      navigator.clipboard.writeText(text).then(()=>{setShareCopied(true);setTimeout(()=>setShareCopied(false),2000);}).catch(()=>setToast("Couldn't copy your location. Try again."));
    }
    vibrate(100);
  };
  const toggleVoiceSearch=()=>{
    if(isListening){
      if(recognitionRef.current){
        try{recognitionRef.current.abort();}catch{}
      }
      setIsListening(false);
      return;
    }
    startVoiceSearch();
  };

  const startVoiceSearch=()=>{
    // On mobile devices (iOS/Android), SpeechRecognition requires HTTPS or localhost
    if(typeof window!=='undefined'&&window.location.protocol==='http:'&&window.location.hostname!=='localhost'&&window.location.hostname!=='127.0.0.1'){
      setToast('Microphone on phones requires HTTPS. Deploying to Vercel provides HTTPS automatically!');
    }
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){
      setToast('Microphone audio recognition is not supported on this browser. Try Chrome, Edge, or Safari.');
      return;
    }
    if(recognitionRef.current){
      try{recognitionRef.current.abort();}catch{}
    }
    openSearch();
    // On mobile touchscreens, blurring the keyboard prevents the virtual keyboard from hijacking speech
    if(searchInputRef.current){
      try{searchInputRef.current.blur();}catch{}
    }
    try{
      const r=new SR();
      // Use user's device language or default to en-IN for Indian English campus dialect
      r.lang=navigator.language||'en-IN';
      r.interimResults=true;
      r.continuous=false;
      r.maxAlternatives=1;
      recognitionRef.current=r;
      let speechHandled=false;
      let lastSpokenText='';

      r.onstart=()=>{
        setIsListening(true);
        setSearchMessage('');
        vibrate(30);
      };
      r.onresult=(e)=>{
        const transcript=Array.from(e.results).map(x=>x[0].transcript).join('');
        lastSpokenText=transcript;
        setQuery(transcript);
        if(e.results[e.results.length-1].isFinal&&transcript.trim()){
          speechHandled=true;
          setIsListening(false);
          try{r.stop();}catch{}
          handleSearch(transcript,true);
        }
      };
      r.onerror=(e)=>{
        setIsListening(false);
        const messages={
          'not-allowed':'Microphone access was denied. Please tap "Allow" when your phone asks for microphone permission.',
          'no-speech':"Didn't hear any speech. Tap the microphone and try speaking again.",
          'audio-capture':'No microphone was detected on this device.',
          'network':'Voice recognition needs a network connection.',
        };
        setToast(messages[e.error]||'Voice search ran into a problem. Try speaking again or typing.');
      };
      r.onend=()=>{
        setIsListening(false);
        if(!speechHandled&&lastSpokenText.trim()){
          speechHandled=true;
          handleSearch(lastSpokenText,true);
        }
      };
      r.start();
    }catch(err){
      console.warn('SpeechRecognition start failed:',err);
      setIsListening(false);
      setToast('Microphone could not start. Please check microphone permissions and try again.');
    }
  };
  const shareWhatsApp=()=>{
    if(!gpsPos)return;
    const text=encodeURIComponent(`📍 My location at Parul University:\nhttps://www.google.com/maps?q=${gpsPos.lat},${gpsPos.lng}`);
    window.open(`https://wa.me/?text=${text}`,'_blank');
    vibrate(50);
  };

  const handleTouchStart=(e)=>setTouchStart({x:e.touches[0].clientX,y:e.touches[0].clientY,time:Date.now()});
  const handleTouchEnd=(e)=>{
    if(!touchStart)return;
    const touchEnd={x:e.changedTouches[0].clientX,y:e.changedTouches[0].clientY,time:Date.now()};
    const deltaX=touchEnd.x-touchStart.x,deltaY=touchEnd.y-touchStart.y,deltaTime=touchEnd.time-touchStart.time;
    if(deltaTime>300)return;
    const absX=Math.abs(deltaX),absY=Math.abs(deltaY);
    if(deltaY<-100&&absY>absX&&touchStart.y>window.innerHeight-200&&!showSearch&&!route){openSearch();vibrate(50);}
    if(deltaY>100&&absY>absX&&touchStart.y<200&&!showSearch&&!route){setShowLostModal(true);vibrate([50,50,50]);}
    setTouchStart(null);
  };

  const step=route?.steps[stepIdx];
  const distLeft=route?.steps.slice(stepIdx).reduce((s,x)=>s+x.dist,0)||0;
  const routeProgress=route?((stepIdx)/(route.steps.length-1||1))*100:0;

  // Numeric CSS `zoom` value for the selected text size (see SettingsPanel.jsx
  // for why zoom rather than a token-based rem scale, and why it's applied
  // to a wrapper around the UI chrome rather than the whole <main>, so the
  // Leaflet map div itself — and its click/tap coordinate math — is unaffected.
  const textScale=TEXT_SCALES.find(t=>t.key===textScaleKey)?.value||1;

  const glass={background:C.card,border:`1px solid ${C.cardBorder}`,borderRadius:20,backdropFilter:'blur(16px)',WebkitBackdropFilter:'blur(16px)',boxShadow:`0 4px 24px ${C.shadow}`,transition:'all 0.6s ease'};
  const glassSolid={background:C.cardSolid,border:`1px solid ${C.cardBorder}`,borderRadius:20,backdropFilter:'blur(20px)',WebkitBackdropFilter:'blur(20px)',boxShadow:`0 4px 28px ${C.shadow}`,transition:'all 0.6s ease'};

  const CSS=`
    body,html{background:${C.bgGrad1}!important;margin:0;padding:0;font-family:'Sora',sans-serif;}
    @keyframes fadeInFoot{0%{opacity:0;transform:scale(0.5)}100%{opacity:0.75;transform:scale(1)}}
    @keyframes ping{0%{transform:scale(1);opacity:.8}100%{transform:scale(2.2);opacity:0}}
    @keyframes bounce{0%,100%{transform:translate(-50%,-90%)}50%{transform:translate(-50%,-100%)}}
    @keyframes iosSlideUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}
    @keyframes iosSlideDown{from{transform:translateY(0);opacity:1}to{transform:translateY(100%);opacity:0}}
    @keyframes modalIn{from{opacity:0;transform:scale(0.93) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)}}
    @keyframes slideUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
    @keyframes slideDown{from{opacity:1;transform:translateY(0)}to{opacity:0;transform:translateY(24px)}}
    @keyframes searchIn{from{opacity:0;transform:translateX(-16px)}to{opacity:1;transform:translateX(0)}}
    @keyframes searchOut{from{opacity:1;transform:translateX(0)}to{opacity:0;transform:translateX(-16px)}}
    @keyframes fadeIn{from{opacity:0}to{opacity:1}}
    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes aiconIn{from{opacity:0;transform:scale(.5)}to{opacity:1;transform:scale(1)}}
    @keyframes aiconPulse{0%,100%{opacity:1}50%{opacity:.35}}
    .aicon{animation:aiconIn .25s ease both;transition:transform .15s ease;}
    button:active .aicon,.aicon:active{transform:scale(0.82);}
    .aicon-spin{animation:aiconIn .25s ease both,spin .8s linear infinite;}
    .aicon-pulse{animation:aiconIn .25s ease both,aiconPulse 1.1s ease-in-out infinite;}
    @keyframes aiconThemeFlip{from{transform:rotate(-90deg) scale(.4);opacity:0}to{transform:rotate(0) scale(1);opacity:1}}
    .aicon-theme{animation:aiconThemeFlip .35s ease both;}
    .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;}
    @keyframes fabPop{from{opacity:0;transform:scale(0.7) translateY(20px)}to{opacity:1;transform:scale(1) translateY(0)}}
    @keyframes fabItemIn{from{opacity:0;transform:translateY(10px) scale(0.9)}to{opacity:1;transform:translateY(0) scale(1)}}
    @keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(231,76,60,0.5)}50%{box-shadow:0 0 0 10px rgba(231,76,60,0)}}
    @keyframes panicPulse{0%,100%{box-shadow:0 0 0 0 rgba(231,76,60,0.8),0 0 30px rgba(231,76,60,0.5)}50%{box-shadow:0 0 0 20px rgba(231,76,60,0),0 0 50px rgba(231,76,60,0.8)}}
    @keyframes audioPulse{0%{transform:scale(1);box-shadow:0 0 0 0 rgba(231,76,60,0.7)}70%{transform:scale(1.08);box-shadow:0 0 0 12px rgba(231,76,60,0)}100%{transform:scale(1);box-shadow:0 0 0 0 rgba(231,76,60,0)}}
    @keyframes audioWave{0%{transform:scaleY(0.3);opacity:0.6}100%{transform:scaleY(1.3);opacity:1}}
    @keyframes sonarPulse{0%{transform:scale(0.8);opacity:0.95}100%{transform:scale(1.95);opacity:0}}
    @keyframes destBeacon{0%,100%{transform:scale(1);filter:drop-shadow(0 6px 14px rgba(255,107,107,0.7))}50%{transform:scale(1.08) translateY(-3px);filter:drop-shadow(0 12px 22px rgba(255,107,107,0.95))}}
    @keyframes grainShift{0%{transform:translate(0,0)}25%{transform:translate(-2%,-2%)}50%{transform:translate(2%,-4%)}75%{transform:translate(-3%,2%)}100%{transform:translate(1%,3%)}}
    .leaflet-container{background:${C.bgGrad1}!important;transition:background 0.6s ease;}
    .leaflet-tile-pane{transition:opacity 0.25s ease;}
    .leaflet-zoom-animated{transition:transform 0.25s cubic-bezier(0,0,0.25,1);}
    .leaflet-control-zoom{border:none!important;}
    .leaflet-control-zoom a{width:40px!important;height:40px!important;line-height:40px!important;background:rgba(255,255,255,0.75)!important;color:${C.accent}!important;font-size:18px!important;border:1px solid rgba(255,255,255,0.8)!important;border-radius:12px!important;margin-bottom:6px!important;display:flex!important;align-items:center!important;justify-content:center!important;backdrop-filter:blur(10px)!important;}
    .leaflet-control-zoom a:hover{background:rgba(255,255,255,0.92)!important;}
    .leaflet-control-attribution{font:11px/1.3 'Sora',sans-serif!important;background:rgba(255,255,255,.82)!important;color:#263238!important;padding:2px 5px!important;}
    ::-webkit-scrollbar{width:3px;}
    ::-webkit-scrollbar-thumb{background:${C.accentLight.replace('0.12','0.2').replace('0.18','0.25')};border-radius:4px;}
    .chip{padding:7px 14px;background:${C.card};border:1px solid ${C.cardBorder};border-radius:20px;font-family:'Sora',sans-serif;font-size:12px;color:${C.textMid};cursor:pointer;white-space:nowrap;font-weight:500;transition:all .18s;flex-shrink:0;backdrop-filter:blur(8px);}
    .chip:hover{background:${C.cardSolid};color:${C.accent};}
    .tab{flex:1;padding:9px 6px;border:1px solid ${C.cardBorder};background:${C.card};color:${C.textMid};border-radius:12px;font-family:'Sora',sans-serif;font-size:13px;cursor:pointer;transition:all .15s;backdrop-filter:blur(8px);}
    .tab:hover{background:${C.cardSolid};color:${C.accent};}
    .tab.on{background:${C.accentBtn};border-color:${C.accentBtn};color:white;font-weight:600;}
    .spot-card{background:${C.card};border:1px solid ${C.cardBorder};border-radius:16px;padding:12px 8px;display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;transition:all .2s;backdrop-filter:blur(10px);flex:1;min-width:64px;}
    .spot-card:hover{background:${C.cardSolid};transform:translateY(-2px);box-shadow:0 6px 20px ${C.shadow};}
    input{font-family:'Sora',sans-serif;}
    input::placeholder{color:${C.textLight};}
    .grain-overlay{pointer-events:none;position:fixed;inset:-50%;width:200%;height:200%;z-index:9999;opacity:0.035;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");animation:grainShift 0.4s steps(1) infinite;}
    .fab-btn{cursor:pointer;border:none;font-family:'Sora',sans-serif;transition:all 0.2s;}
    .fab-tab{flex:1;padding:8px 4px;border:none;border-radius:10px;font-family:'Sora',sans-serif;font-size:12px;font-weight:600;cursor:pointer;transition:all 0.2s;}
    button:focus-visible,input:focus-visible,[role="button"]:focus-visible{outline:3px solid ${C.accent};outline-offset:3px;}
    button:disabled{opacity:.5;cursor:not-allowed!important;}
    .map-app button{min-height:44px;}
    .spot-card{min-height:72px;border:1px solid ${C.cardBorder};font-family:'Sora',sans-serif;color:${C.text};}
    @media (max-width:680px){
      .map-app .top-search-bar{top:96px!important;left:12px!important;right:12px!important;max-width:none!important;transform:none!important;}
    }
    @media (min-width:681px){
      .map-app .top-search-bar{top:96px!important;left:50%!important;transform:translateX(-50%)!important;width:calc(100% - 28px)!important;max-width:620px!important;right:auto!important;}
      .map-app .top-location-badge-wrap{top:14px!important;right:14px!important;}
    }
    @media (max-width:520px){
      .map-app{height:100dvh!important;}
      .map-app .top-controls{top:max(10px,env(safe-area-inset-top))!important;left:10px!important;gap:6px!important;}
      .map-app .top-search-bar{top:92px!important;left:10px!important;right:10px!important;}
      .map-app .bottom-panel{padding:0 10px max(12px,env(safe-area-inset-bottom))!important;}
      .map-app .map-fab{right:10px!important;bottom:190px!important;}
      .map-app .recenter{right:76px!important;}
    }
    @media (prefers-reduced-motion:reduce){
      *,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important;}
      .grain-overlay{display:none!important;}
    }
  `;

  return(
    <main className="map-app" aria-label="Campus Navigator"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{position:'relative',width:'100%',height:'100dvh',fontFamily:"'Sora',sans-serif",overflow:'hidden',background:`linear-gradient(135deg,${C.bgGrad1} 0%,${C.bgGrad2} 100%)`,transition:'background 0.6s ease'}}>
      <style>{CSS}</style>
      <div className="grain-overlay"/>
      <div ref={mapDiv} style={{position:'absolute',inset:0,zIndex:0,background:C.bgGrad1}}/>

      {/* Everything below is app UI chrome (search, panels, buttons, modals).
          pointerEvents: 'none' ensures that mouse wheel scrolling, clicks, and drag events
          pass through freely to the underlying Leaflet map. Interactive controls inside
          this wrapper explicitly re-enable pointerEvents: 'auto'. */}
      <div style={{position:'absolute',inset:0,zoom:textScale,pointerEvents:'none'}}>
      {toast&&(
        <div role="alert" style={{position:'fixed',top:16,left:'50%',transform:'translateX(-50%)',zIndex:200,maxWidth:'88%',background:'rgba(30,30,34,0.94)',color:'white',padding:'12px 18px',borderRadius:14,fontSize:13,fontWeight:500,fontFamily:'Sora',boxShadow:'0 6px 20px rgba(0,0,0,0.3)',animation:'fadeIn .2s ease',textAlign:'center'}}>
          {toast}
        </div>
      )}

      {mapTileError&&(
        <div role="alert" style={{position:'fixed',top:16,left:'50%',transform:'translateX(-50%)',zIndex:199,maxWidth:'88%',background:'#c0392b',color:'white',padding:'10px 16px',borderRadius:14,fontSize:12,fontWeight:600,fontFamily:'Sora',boxShadow:'0 6px 20px rgba(0,0,0,0.3)',display:'flex',alignItems:'center',gap:10}}>
          <span>Map tiles failed to load — check your connection.</span>
          <button onClick={()=>window.location.reload()} style={{background:'rgba(255,255,255,0.25)',border:'none',borderRadius:8,color:'white',fontSize:12,fontWeight:700,padding:'4px 10px',cursor:'pointer',flexShrink:0}}>Retry</button>
        </div>
      )}

      <div style={{position:'absolute',top:0,left:0,right:0,height:80,zIndex:1,pointerEvents:'none',background:`linear-gradient(to bottom,${C.bgGrad1}88,transparent)`,transition:'background 0.6s ease'}}/>
      <div style={{position:'absolute',bottom:0,left:0,right:0,height:80,zIndex:1,pointerEvents:'none',background:`linear-gradient(to top,${C.bgGrad2}88,transparent)`,transition:'background 0.6s ease'}}/>

      {panicActive && (
          <div role="status" aria-live="assertive" style={{position:'absolute',top:0,left:0,right:0,zIndex:25,background:'linear-gradient(135deg,rgba(231,76,60,0.15),rgba(192,57,43,0.1))',padding:'12px 20px',borderBottom:`3px solid #e74c3c`,backdropFilter:'blur(10px)',animation:'fadeIn 0.3s ease'}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{width:12,height:12,borderRadius:'50%',background:'#e74c3c',animation:'pulse 1s infinite'}}/>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:700,color:'#e74c3c',letterSpacing:'0.05em',display:'flex',alignItems:'center',gap:6}}><AIcon icon={IconAmbulance} size={15} pulse color="#e74c3c"/> PANIC MODE ACTIVE</div>
              <div style={{fontSize:12,color:C.textMid}}>{emergencyMessage}</div>
            </div>
            <button onClick={()=>setPanicActive(false)}
              style={{padding:'6px 12px',background:'rgba(231,76,60,0.2)',border:`1px solid #e74c3c`,borderRadius:8,color:'#e74c3c',fontSize:11,fontWeight:600,cursor:'pointer'}}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="top-controls" style={{position:'absolute',top:14,left:14,zIndex:40,display:'flex',flexDirection:'column',gap:7,pointerEvents:'auto'}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{...glass,borderRadius:24,padding:'4px',display:'flex',gap:4,overflow:'hidden',position:'relative'}}>
            <div style={{position:'absolute',top:4,left:userTheme==='auto'?4:userTheme==='light'?'calc(33.33% + 2px)':'calc(66.66% + 0px)',width:'calc(33.33% - 2px)',height:'calc(100% - 8px)',background:C.accent,borderRadius:20,transition:'left 0.35s cubic-bezier(0.34,1.56,0.64,1)',zIndex:0,boxShadow:`0 2px 8px ${C.shadow}`}}/>
            {[
              ['auto',userTheme==='auto'&&timeOfDay==='morning'?IconSunrise:userTheme==='auto'&&timeOfDay==='afternoon'?IconSun:userTheme==='auto'&&timeOfDay==='evening'?IconMoon:IconCurrentLocation,'Auto'],
              ['light',IconSun,'Light'],
              ['dark',IconMoon,'Dark']
            ].map(([t,Icon,label])=>(
              <button key={t} onClick={()=>setUserTheme(t)} aria-pressed={userTheme===t}
                style={{position:'relative',zIndex:1,padding:'7px 14px',background:'transparent',color:userTheme===t?'white':C.textMid,border:'none',borderRadius:20,fontSize:11,fontWeight:userTheme===t?600:500,cursor:'pointer',fontFamily:'Sora',transition:'color 0.2s',display:'flex',alignItems:'center',gap:5}}>
                <AIcon icon={Icon} size={14} className="aicon-theme"/><span>{label}</span>
              </button>
            ))}
          </div>
          <button
            onClick={()=>{setShowSettings(true);vibrate(30);}}
            aria-label="Open settings" title="Open Settings"
            style={{...glassSolid,borderRadius:20,padding:'7px 14px',border:`1px solid ${C.cardBorder}`,cursor:'pointer',fontSize:12,fontWeight:600,fontFamily:'Sora',color:C.text,display:'flex',alignItems:'center',gap:6,boxShadow:`0 2px 10px ${C.shadow}`,height:38}}>
            <AIcon icon={IconSettings} size={16} color={C.accent}/>
            <span>Settings</span>
          </button>
        </div>
        <div style={{...glass,borderRadius:18,padding:'3px 4px',display:'inline-flex',gap:3,width:'fit-content'}}>
          {[['standard',IconMap2,'Map'],['satellite',IconSatellite,'Satellite'],['hybrid',IconWorld,'Hybrid']].map(([mode,Icon,label])=>(
            <button key={mode} onClick={()=>{setMapMode(mode);vibrate(30);}} aria-pressed={mapMode===mode}
              style={{padding:'6px 12px',background:mapMode===mode?C.accent:'transparent',color:mapMode===mode?'white':C.textMid,border:'none',borderRadius:14,fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'Sora',transition:'all 0.2s',display:'flex',alignItems:'center',gap:5}}>
              <AIcon icon={Icon} size={13}/><span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {!showLocModal&&!route&&(
        <div className="top-location-badge-wrap" style={{position:'absolute',top:14,right:14,zIndex:35,display:'flex',gap:8,alignItems:'center',pointerEvents:'auto'}}>
          <div className="top-location-badge" onClick={()=>{setShowLocModal(true);setSheetVisible(true);}}
            style={{...glass,borderRadius:20,padding:'6px 14px',display:'flex',alignItems:'center',gap:7,cursor:'pointer',animation:'fadeIn .5s ease'}}>
            <div style={{width:7,height:7,borderRadius:'50%',background:gpsPos?C.accent:C.peach,flexShrink:0}}/>
            <span style={{fontSize:11,color:C.textMid,fontWeight:500,maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{locLabel||'Set location'}</span>
          </div>
        </div>
      )}

      {!route&&!showSearch&&!showLocModal&&!showManualPicker&&(
        <div className="top-search-bar" style={{position:'absolute',top:96,right:14,left:14,zIndex:60,animation:'slideUp .4s cubic-bezier(0.34,1.2,0.64,1)',maxWidth:620,margin:'0 auto',pointerEvents:'auto'}}>
          <div role="button" tabIndex={0} aria-label="Open destination search" onClick={openSearch} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openSearch();}}}
            style={{width:'100%',display:'flex',alignItems:'center',gap:14,...glass,padding:'14px 18px',cursor:'pointer',textAlign:'left',borderRadius:30,boxSizing:'border-box',boxShadow:`0 4px 20px ${C.shadow}`}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill={C.textLight}><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
            <span style={{flex:1,color:C.textLight,fontSize:15,fontWeight:500,userSelect:'none'}}>Where do you want to go?</span>
            <button type="button" aria-label={isListening?'Stop voice search':'Start voice search'} onClick={e=>{e.stopPropagation();toggleVoiceSearch();}}
              style={{width:38,height:38,borderRadius:'50%',background:isListening?'#e74c3c':C.accentBtn,border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,boxShadow:isListening?'0 0 16px rgba(231,76,60,0.65)':`0 3px 14px ${C.shadow}`,transition:'all 0.2s',animation:isListening?'audioPulse 1.2s infinite':'none'}}>
              <span><AIcon icon={isListening?IconCircleDot:IconMicrophone} size={18} pulse={isListening} color="white"/></span>
            </button>
          </div>
        </div>
      )}

      {route&&(
        <div style={{position:'absolute',bottom:0,left:0,right:0,zIndex:20,padding:'0 12px 20px',animation:routeVisible?'slideUp .4s cubic-bezier(0.34,1.2,0.64,1)':'slideDown .3s ease forwards',maxWidth:700,margin:'0 auto',pointerEvents:'auto'}}>
          <div style={{...glassSolid,borderRadius:24,overflow:'hidden'}}>
            <div style={{height:3,background:C.accentLight}}>
              <div style={{height:'100%',background:route.isPanic?'linear-gradient(90deg,#e74c3c,#c0392b)':route.isEmergency?'linear-gradient(90deg,#e67e22,#d35400)':`linear-gradient(90deg,${C.accent},${C.peach})`,width:`${routeProgress}%`,transition:'width 0.5s ease',borderRadius:3}}/>
            </div>
            <div style={{padding:'16px 16px 8px'}}>
              {route.isPanic && (
                <div style={{background:'rgba(231,76,60,0.1)',border:`1px solid #e74c3c`,borderRadius:12,padding:'10px 12px',marginBottom:10,display:'flex',alignItems:'center',gap:8}}>
                  <AIcon icon={IconAmbulance} size={16} pulse color="#e74c3c"/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,fontWeight:700,color:'#e74c3c'}}>PANIC MODE - Navigating to Safe Zone</div>
                    <div style={{fontSize:12,color:C.textMid}}>Share your location with a trusted contact or call emergency services.</div>
                  </div>
                </div>
              )}
              {route.isEmergency && !route.isPanic && (
                <div style={{background:'rgba(230,126,34,0.1)',border:`1px solid #e67e22`,borderRadius:12,padding:'8px 12px',marginBottom:10,display:'flex',alignItems:'center',gap:8}}>
                  <AIcon icon={IconDoorExit} size={14} color="#e67e22"/>
                  <div style={{fontSize:11,fontWeight:600,color:'#e67e22'}}>Emergency Exit Route</div>
                </div>
              )}
              {route.fallbackFrom && (
                <div style={{background:C.accentLight,border:`1px solid ${C.accent}40`,borderRadius:14,padding:'10px 14px',marginBottom:12,display:'flex',flexDirection:'column',gap:8}}>
                  <div style={{fontSize:12,color:C.text,fontWeight:600}}>
                    Couldn't find "{route.fallbackFrom}" · Connected to {route.destName}
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                    <span style={{fontSize:11,color:C.textLight}}>Alternative hubs:</span>
                    {[
                      ['pu gate-1','Main Gate'],
                      ['central canteen','Central Canteen'],
                      ['library','Library']
                    ].filter(([k])=>k!==route.toKey&&BUILDINGS[k]).slice(0,3).map(([k,name])=>(
                      <button key={k} onClick={()=>selectDestination(k)}
                        style={{padding:'4px 9px',borderRadius:10,background:C.cardSolid,border:`1px solid ${C.cardBorder}`,fontSize:11,fontWeight:600,color:C.accent,cursor:'pointer'}}>
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                <div>
                  <div style={{fontSize:11,color:C.textLight,fontWeight:500,textTransform:'uppercase',letterSpacing:'0.05em'}}>Navigating to</div>
                  <div style={{fontSize:18,fontWeight:700,color:C.text,letterSpacing:'-0.3px',fontFamily:"'Space Grotesk',sans-serif"}}>{route.destName}</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:22,fontWeight:700,color:route.isPanic?'#e74c3c':route.isEmergency?'#e67e22':C.accent,fontFamily:"'Space Grotesk',sans-serif"}}>{distLeft}m</div>
                  <div style={{fontSize:12,color:C.textLight}}>~{Math.ceil(distLeft/80)} min walk</div>
                </div>
              </div>
              <div style={{marginBottom:10}}>
                <RouteTypeSelector C={C} glass={glass} routeType={routeType} onChange={changeActiveRouteType} compact/>
              </div>
              {step&&(
                <div style={{display:'flex',alignItems:'center',gap:12,...glass,padding:'12px 14px',borderRadius:16,marginBottom:10}}>
                  <div style={{width:44,height:44,borderRadius:14,background:route.isPanic?'linear-gradient(135deg,#e74c3c,#c0392b)':route.isEmergency?'linear-gradient(135deg,#e67e22,#d35400)':`linear-gradient(135deg,${C.accent},${C.accentDark})`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,boxShadow:`0 3px 12px ${C.shadow}`}}>
                    {step.isArrival
                      ? <AIcon icon={IconMapPin} size={22} color="white"/>
                      : <span style={{display:'inline-flex',transform:`rotate(${step.deg}deg)`}}><AIcon icon={IconArrowUp} size={22} color="white"/></span>}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:15,fontWeight:600,color:C.text}}>{step.instruction}</div>
                    <div style={{fontSize:12,color:C.textLight,marginTop:2}}>towards {step.towards} · {step.dist}m</div>
                  </div>
                </div>
              )}
              <div style={{display:'flex',gap:8}}>
                <button onClick={()=>setStepIdx(Math.max(0,stepIdx-1))} disabled={stepIdx===0}
                  style={{flex:1,padding:'10px',border:`1px solid ${C.cardBorder}`,borderRadius:12,background:C.card,color:stepIdx===0?C.textLight:C.accent,cursor:stepIdx===0?'default':'pointer',fontSize:13,fontWeight:600,fontFamily:'Sora',backdropFilter:'blur(8px)',display:'flex',alignItems:'center',justifyContent:'center',gap:5}}><AIcon icon={IconArrowLeft} size={14}/> Prev</button>
                <button onClick={()=>setStepIdx(Math.min(route.steps.length-1,stepIdx+1))} disabled={stepIdx>=route.steps.length-1}
                  style={{flex:2,padding:'10px',border:'none',borderRadius:12,background:stepIdx>=route.steps.length-1?C.cardSolid:route.isPanic?'#e74c3c':route.isEmergency?'#e67e22':C.accentBtn,color:stepIdx>=route.steps.length-1?C.textLight:'white',cursor:stepIdx>=route.steps.length-1?'default':'pointer',fontSize:13,fontWeight:600,fontFamily:'Sora',boxShadow:stepIdx>=route.steps.length-1?'none':`0 3px 12px ${C.shadow}`,display:'flex',alignItems:'center',justifyContent:'center',gap:5}}>Next <AIcon icon={IconArrowRight} size={14}/></button>
                <button onClick={exitRoute}
                  style={{flex:1,padding:'10px',border:`1px solid ${C.peach}30`,borderRadius:12,background:`${C.peach}15`,color:C.peach,cursor:'pointer',fontSize:13,fontWeight:600,fontFamily:'Sora',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}><AIcon icon={IconX} size={14}/> Exit</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {!route&&!showLocModal&&bottomVisible&&(
        <div style={{position:'absolute',bottom:0,left:0,right:0,zIndex:20,padding:'0 12px 20px',animation:'slideUp .5s cubic-bezier(0.34,1.2,0.64,1)',maxWidth:700,margin:'0 auto',pointerEvents:'auto'}}>
          <div style={{...glassSolid,borderRadius:24,padding:'16px'}}>
            <div style={{display:'flex',gap:6,marginBottom:14}}>
              {['nearby','favorites','stats'].map(tab=>(
                <button key={tab} className={`tab${activeTab===tab?' on':''}`} onClick={()=>setActiveTab(tab)} style={{display:'flex',alignItems:'center',justifyContent:'center',gap:5}}>
                  <AIcon icon={tab==='nearby'?IconMapPin:tab==='favorites'?IconStar:IconChartBar} size={14}/>
                  {tab==='nearby'?'Nearby':tab==='favorites'?'Saved':'Stats'}
                </button>
              ))}
            </div>
            {activeTab==='nearby'&&(
              <div
                className="scroll-x"
                onWheel={(e)=>{
                  if(e.deltaY!==0){
                    e.currentTarget.scrollLeft += e.deltaY;
                  }
                }}
                style={{display:'flex',gap:8,overflowX:'auto',paddingBottom:8,scrollBehavior:'smooth'}}>
                {EXPLORE_SPOTS.map(spot=>(
                  <div key={spot.key} className="spot-card" role="button" tabIndex={0}
                    onClick={()=>selectDestination(spot.key)}
                    onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectDestination(spot.key);}}}>
                    <DataIcon iconKey={spot.icon} size={22}/>
                    <span style={{fontSize:11,fontWeight:600,color:C.text,textAlign:'center'}}>{spot.label}</span>
                    <span style={{fontSize:10,color:C.textLight}}>{spot.dist}</span>
                  </div>
                ))}
              </div>
            )}
            {activeTab==='favorites'&&(
              <div>
                {favorites.length===0?(
                  <div style={{textAlign:'center',color:C.textLight,fontSize:13,padding:'16px 0'}}>No saved places yet. Tap the bookmark on any spot to save it!</div>
                ):(
                  <div
                    className="scroll-x"
                    onWheel={(e)=>{
                      if(e.deltaY!==0){
                        e.currentTarget.scrollLeft += e.deltaY;
                      }
                    }}
                    style={{display:'flex',gap:8,overflowX:'auto',paddingBottom:8,scrollBehavior:'smooth'}}>
                    {favorites.map(key=>{
                      const b=BUILDINGS[key];
                      if(!b)return null;
                      return(
                        <div key={key} className="spot-card" role="button" tabIndex={0}
                          onClick={()=>selectDestination(key)}
                          onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectDestination(key);}}}>
                          <AIcon icon={IconStar} size={22} color={C.accent}/>
                          <span style={{fontSize:11,fontWeight:600,color:C.text,textAlign:'center'}}>{b.name.split(' ').slice(0,2).join(' ')}</span>
                          <button onClick={e=>{e.stopPropagation();toggleFavorite(key);}} aria-label={`Remove ${b.name} from favorites`}
                            style={{background:'none',border:'none',cursor:'pointer',color:C.peach,fontSize:10,minHeight:44,minWidth:44,padding:'0 8px',display:'flex',alignItems:'center',justifyContent:'center'}}>remove</button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            {activeTab==='stats'&&(
              <div>
                <div style={{display:'flex',gap:12,marginBottom:10}}>
                  <div style={{flex:1,...glass,borderRadius:16,padding:'12px',textAlign:'center'}}>
                    <div style={{fontSize:24,fontWeight:700,color:C.accent,fontFamily:"'Space Grotesk',sans-serif"}}>{(totalDistance/1000).toFixed(2)}</div>
                    <div style={{fontSize:11,color:C.textLight}}>km walked</div>
                  </div>
                  <div style={{flex:1,...glass,borderRadius:16,padding:'12px',textAlign:'center'}}>
                    <div style={{fontSize:24,fontWeight:700,color:C.peach,fontFamily:"'Space Grotesk',sans-serif"}}>{totalSteps.toLocaleString()}</div>
                    <div style={{fontSize:11,color:C.textLight}}>steps today</div>
                  </div>
                  <div style={{flex:1,...glass,borderRadius:16,padding:'12px',textAlign:'center'}}>
                    <div style={{fontSize:24,fontWeight:700,color:C.text,fontFamily:"'Space Grotesk',sans-serif"}}>{recentRoutes.length}</div>
                    <div style={{fontSize:11,color:C.textLight}}>routes</div>
                  </div>
                </div>
                {(totalDistance>0||totalSteps>0)&&(
                  <button onClick={requestResetStats} style={{width:'100%',padding:'10px',minHeight:44,border:`1px solid ${statsResetConfirm?'#e74c3c':C.cardBorder}`,borderRadius:12,background:statsResetConfirm?'rgba(231,76,60,0.12)':'transparent',color:statsResetConfirm?'#e74c3c':C.textMid,fontSize:12,fontWeight:600,fontFamily:'Sora',cursor:'pointer'}}>
                    {statsResetConfirm?'Tap again to confirm reset':'Reset walking stats'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {offCentre&&!showSearch&&(
        <button onClick={reCentre}
          style={{position:'absolute',bottom:route?200:180,right:80,zIndex:20,...glassSolid,border:`1px solid ${C.accent}40`,borderRadius:16,padding:'10px 14px',cursor:'pointer',display:'flex',alignItems:'center',gap:8,fontSize:12,fontWeight:600,color:C.accent,fontFamily:'Sora',animation:'fadeIn .3s ease',pointerEvents:'auto'}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill={C.accent}><path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06A8.994 8.994 0 0 0 20.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/></svg>
          Re-center
        </button>
      )}

      {!showSearch&&!showLocModal&&(
        <div style={{position:'absolute',bottom:route?220:200,right:14,zIndex:30,pointerEvents:'auto'}}>
          {fabOpen&&(
            <div role="dialog" aria-modal="true" aria-label={fabTab==='sos'?'Emergency SOS':'Share Location'} ref={fabPanelRef} style={{position:'absolute',bottom:80,right:14,zIndex:30,width:320,maxWidth:'calc(100vw - 28px)',maxHeight:'calc(100vh - 120px)',display:'flex',flexDirection:'column',animation:'fabPop 0.35s cubic-bezier(0.34,1.56,0.64,1)'}}>
              <div style={{...glassSolid,borderRadius:24,overflow:'hidden',padding:0,display:'flex',flexDirection:'column',maxHeight:'100%',boxShadow:`0 8px 32px ${C.shadow}`}}>
                <div style={{padding:'14px 16px 10px',background:`linear-gradient(135deg,${fabTab==='sos'?'#e74c3c':'#2980b9'},${fabTab==='sos'?'#c0392b':'#1f6a9e'})`,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <img src={fabTab==='sos' ? SOS_ICON_IMG : SHARE_ICON} width="22" height="22" style={{objectFit:"contain",display:"block"}} alt={fabTab==='sos'?'SOS':'Share'}/>
                    <h2 style={{color:'white',fontWeight:700,fontSize:15,fontFamily:"'Space Grotesk',sans-serif",margin:0}}>{fabTab==='sos'?'Emergency SOS':'Share Location'}</h2>
                  </div>
                  <button onClick={()=>setFabOpen(false)} aria-label="Close panel" className="fab-btn" style={{width:40,height:40,borderRadius:'50%',background:'rgba(255,255,255,0.2)',color:'white',fontSize:18,display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
                </div>
                <div style={{display:'flex',gap:6,padding:'10px 12px 6px',background:C.cardSolid}}>
                  <button className="fab-tab" onClick={()=>setFabTab('sos')}
                    style={{background:fabTab==='sos'?'#e74c3c':'transparent',color:fabTab==='sos'?'white':C.textMid,border:`1px solid ${fabTab==='sos'?'#e74c3c':C.cardBorder}`,display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                    <AIcon icon={IconAmbulance} size={16}/> SOS
                  </button>
                  <button className="fab-tab" onClick={()=>setFabTab('share')}
                    style={{background:fabTab==='share'?C.accentBtn:'transparent',color:fabTab==='share'?'white':C.textMid,border:`1px solid ${fabTab==='share'?C.accentBtn:C.cardBorder}`,display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                    <AIcon icon={IconShare2} size={16}/> Share
                  </button>
                </div>
                {fabTab==='sos'&&(
                  <div style={{padding:'8px 12px 14px'}}>
                    <button
                      onPointerDown={panicActive?undefined:startPanicHold}
                      onPointerUp={cancelPanicHold}
                      onPointerLeave={cancelPanicHold}
                      onPointerCancel={cancelPanicHold}
                      onKeyDown={e=>{if((e.key==='Enter'||e.key===' ')&&!panicHolding&&!panicActive){e.preventDefault();startPanicHold();}}}
                      onKeyUp={e=>{if(e.key==='Enter'||e.key===' ')cancelPanicHold();}}
                      className="fab-btn" aria-pressed={panicActive}
                      style={{position:'relative',overflow:'hidden',width:'100%',padding:'16px',background:'linear-gradient(135deg,#e74c3c,#c0392b)',borderRadius:14,color:'white',fontSize:15,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',gap:10,marginBottom:10,animation:panicActive?'panicPulse 1.5s infinite':'pulse 2s infinite',border:panicActive?'3px solid #fff':'none'}}>
                      <div style={{position:'absolute',left:0,top:0,bottom:0,width:panicHolding?'100%':'0%',background:'rgba(255,255,255,0.35)',transition:panicHolding?'width 0.9s linear':'width 0.15s ease'}}/>
                      <span style={{position:'relative',display:'flex',alignItems:'center',gap:10}}>
                        <img src={SOS_ICON_IMG} width="24" height="24" style={{objectFit:"contain",flexShrink:0}} alt="SOS"/> {panicActive ? 'HELP ACTIVATED' : panicHolding ? 'KEEP HOLDING...' : 'HOLD FOR PANIC MODE'}
                      </span>
                    </button>
                    <button onClick={findNearestExit} className="fab-btn"
                      style={{width:'100%',padding:'14px',background:'linear-gradient(135deg,#e67e22,#d35400)',borderRadius:14,color:'white',fontSize:14,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
                      <AIcon icon={IconDoorExit} size={18}/> Navigate to Nearest Exit
                    </button>
                  </div>
                )}
                {fabTab==='share'&&(()=>{
                  const meetPoint=generateMeetPoint();
                  return (
                  <div className="scroll-y" style={{padding:'8px 12px 14px',overflowY:'auto',maxHeight:'calc(100vh - 220px)'}}>
                    <CrewPanel
                      C={C} glass={glass}
                      crew={crew} newCrewName={newCrewName} setNewCrewName={setNewCrewName}
                      selectedCrewId={selectedCrewId} setSelectedCrewId={setSelectedCrewId}
                      confirmDeleteId={confirmDeleteId}
                      editingCrewId={editingCrewId} editingCrewValue={editingCrewValue} setEditingCrewValue={setEditingCrewValue}
                      includeNameInShare={includeNameInShare} setIncludeNameInShare={setIncludeNameInShare}
                      onAddCrewMember={addCrewMember} onRequestRemoveCrewMember={requestRemoveCrewMember}
                      onStartEditCrew={startEditCrew} onSaveEditCrew={saveEditCrew} onCancelEditCrew={cancelEditCrew}
                    />
                    <div style={{...glass,borderRadius:14,padding:'12px 14px',marginBottom:10}}>
                      <div style={{fontSize:11,color:C.textLight,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:4}}>Your location</div>
                      <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:2}}>{locLabel||'PU Campus'}</div>
                      <div style={{fontSize:11,color:C.textLight,fontFamily:"'Space Grotesk',sans-serif"}}>
                        {gpsPos?`${gpsPos.lat.toFixed(5)}, ${gpsPos.lng.toFixed(5)}`:'Location not set'}
                      </div>
                    </div>
                    {meetPoint && (
                      <div style={{...glass,borderRadius:14,padding:'12px 14px',marginBottom:10,background:`linear-gradient(135deg,${C.accent}15,${C.accent}08)`}}>
                        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                          <div style={{fontSize:12,color:C.accent,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em',display:'flex',alignItems:'center',gap:6}}><AIcon icon={IconMapPin} size={14}/> Meet Me Point</div>
                          <div style={{fontSize:11,color:C.textLight}}>~{meetPoint.eta} min</div>
                        </div>
                        <div style={{fontSize:14,fontWeight:600,color:C.text,marginBottom:4}}>{meetPoint.location}</div>
                        <div style={{fontSize:11,color:C.textMid,marginBottom:8}}>{meetPoint.distance}m from your current position{crew.find(c=>c.id===selectedCrewId)?` · sharing with ${crew.find(c=>c.id===selectedCrewId).name}`:''}</div>
                        <button onClick={shareMeetPoint} className="fab-btn"
                          style={{width:'100%',padding:'10px',background:C.accentBtn,borderRadius:10,color:'white',fontSize:13,fontWeight:600,display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                          {meetMeCopied ? <><AIcon icon={IconCheck} size={16}/> Copied!</> : <><AIcon icon={IconShare2} size={16} className="aicon-share"/> Share Meeting Point</>}
                        </button>
                      </div>
                    )}
                    <div style={{display:'flex',flexDirection:'column',gap:8}}>
                      {[
                        {label:'Copy link',sublabel:'Copy Google Maps link',icon:'link',action:()=>{shareLocation();},color:C.accent},
                        {label:'WhatsApp',sublabel:'Send via WhatsApp',icon:'message',action:shareWhatsApp,color:'#25D366'},
                        {label:'Native share',sublabel:'More share options',icon:'mobile',action:()=>{
                          if(!gpsPos)return;
                          const text=`My location at Parul University:\nhttps://www.google.com/maps?q=${gpsPos.lat},${gpsPos.lng}`;
                          if(navigator.share)navigator.share({title:'My Location',text}).catch(()=>{});
                          else setToast("Sharing isn't supported on this browser.");
                          vibrate(50);
                        },color:'#8e44ad'},
                      ].map((opt,i)=>(
                        <button key={i} onClick={opt.action} className="fab-btn"
                          style={{display:'flex',alignItems:'center',gap:12,padding:'11px 14px',background:opt.color+'15',border:`1px solid ${opt.color}30`,borderRadius:14,textAlign:'left',animation:`fabItemIn 0.2s ease both`,animationDelay:`${i*0.05}s`}}>
                          <div style={{width:38,height:38,borderRadius:11,background:opt.color,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,color:'white'}}><DataIcon iconKey={opt.icon} size={18}/></div>
                          <div>
                            <div style={{fontSize:13,fontWeight:600,color:C.text,display:'flex',alignItems:'center',gap:5}}>{i===0&&sharecopied?<><AIcon icon={IconCheck} size={14}/> Copied!</>:opt.label}</div>
                            <div style={{fontSize:11,color:C.textLight}}>{opt.sublabel}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                  );
                })()}
              </div>
            </div>
          )}
          <button
            onClick={()=>{setFabOpen(!fabOpen);vibrate(fabOpen?30:[50,30,50]);}}
            style={{width:56,height:56,borderRadius:'50%',background:fabOpen?C.accent:panicActive?'linear-gradient(135deg,#c0392b,#8b0000)':'linear-gradient(135deg,#e74c3c,#c0392b)',border:`2px solid ${fabOpen?C.accent+'60':panicActive?'rgba(255,255,255,0.4)':'rgba(255,255,255,0.25)'}`,boxShadow:fabOpen?`0 4px 20px ${C.shadow}`:panicActive?'0 4px 30px rgba(231,76,60,0.6)':'0 4px 20px rgba(231,76,60,0.45)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.3s cubic-bezier(0.34,1.56,0.64,1)',transform:fabOpen?'rotate(45deg) scale(1.05)':'rotate(0deg) scale(1)',animation:fabOpen?'none':panicActive?'panicPulse 1.5s infinite':'pulse 3s infinite'}}>
            {fabOpen?(
              <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            ):(
              <img src={SOS_ICON_IMG} width="28" height="28" style={{objectFit:"contain",display:"block"}} alt="SOS"/>
            )}
          </button>
        </div>
      )}

      </div>

      <LostModal
        show={showLostModal}
        C={C}
        glassSolid={glassSolid}
        modalRef={lostModalRef}
        onClose={()=>setShowLostModal(false)}
        onGoToMainGate={()=>{setShowLostModal(false);handleSearch('pu gate-1');}}
      />
      <SettingsPanel
        show={showSettings}
        C={C} glassSolid={glassSolid} glass={glass}
        panelRef={settingsPanelRef}
        onClose={()=>setShowSettings(false)}
        textScaleKey={textScaleKey} onTextScaleChange={setTextScaleKey}
        highContrast={highContrast} onHighContrastChange={setHighContrast}
        voiceEnabled={voiceEnabled} onVoiceEnabledChange={setVoiceEnabled}
        voiceVolume={voiceVolume} onVoiceVolumeChange={setVoiceVolume}
      />
      <ManualLocationPicker
        show={showManualPicker}
        C={C}
        BUILDINGS={BUILDINGS}
        query={manualQuery}
        onQueryChange={setManualQuery}
        onSelect={selectManualLocation}
        onClose={closeManualPicker}
        panelRef={manualPickerRef}
      />

      {showLocModal&&(
        <div style={{position:'fixed',inset:0,zIndex:160,display:'flex',flexDirection:'column',justifyContent:'flex-end',animation:'fadeIn .25s ease',pointerEvents:'auto'}}>
          <div aria-hidden="true" style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.28)',backdropFilter:'blur(4px)',WebkitBackdropFilter:'blur(4px)'}} onClick={handleDontAllow}/>
          <div role="dialog" aria-modal="true" aria-labelledby="location-dialog-title" ref={locModalRef} style={{position:'relative',zIndex:10,background:'rgba(242,242,247,0.97)',borderRadius:'20px 20px 0 0',paddingBottom:34,backdropFilter:'blur(40px)',WebkitBackdropFilter:'blur(40px)',boxShadow:'0 -2px 20px rgba(0,0,0,0.15)',animation:sheetVisible?'iosSlideUp .42s cubic-bezier(0.32,0.72,0,1)':'iosSlideDown .35s cubic-bezier(0.32,0.72,0,1) forwards'}}>
            <div style={{width:36,height:5,borderRadius:3,background:'rgba(60,60,67,0.18)',margin:'10px auto 0'}}/>
            <div style={{display:'flex',alignItems:'center',gap:12,padding:'18px 24px 0'}}>
              <div style={{width:48,height:48,borderRadius:12,background:`linear-gradient(135deg,${C.accent},${C.accentDark})`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,boxShadow:`0 2px 8px ${C.shadow}`}}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
              </div>
              <div>
                <div style={{fontSize:15,fontWeight:700,color:'#000',letterSpacing:'-0.2px',fontFamily:"'Space Grotesk',sans-serif"}}>Campus Navigator</div>
                <div style={{fontSize:12,color:'rgba(60,60,67,0.55)',marginTop:1}}>Parul University</div>
              </div>
            </div>
            <h2 id="location-dialog-title" style={{fontSize:19,fontWeight:700,color:'#000',textAlign:'center',padding:'16px 28px 6px',letterSpacing:'-0.3px',lineHeight:1.25,fontFamily:"'Space Grotesk',sans-serif",margin:0}}>Use your location for navigation?</h2>
            <div style={{fontSize:13,color:'rgba(60,60,67,0.65)',textAlign:'center',padding:'0 28px 14px',lineHeight:1.55}}>Your location is used to show your position on the campus map and provide accurate walking directions.</div>
            <div style={{margin:'0 16px 18px',height:120,borderRadius:16,overflow:'hidden',position:'relative',background:`linear-gradient(135deg,${C.bgGrad1},${C.bgGrad2})`,border:'0.5px solid rgba(0,0,0,0.1)'}}>
              <div style={{position:'absolute',inset:0,backgroundImage:`linear-gradient(${C.accentLight.replace('0.12','0.07')} 1px,transparent 1px),linear-gradient(90deg,${C.accentLight.replace('0.12','0.07')} 1px,transparent 1px)`,backgroundSize:'22px 22px'}}/>
              <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-55%)',width:44,height:44,borderRadius:'50%',border:'1.5px solid rgba(0,122,255,0.3)',animation:'ping 2s infinite'}}/>
              <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-90%)',animation:'bounce 2.5s ease-in-out infinite'}}>
                <svg width="22" height="30" viewBox="0 0 22 30"><path d="M11 0C4.9 0 0 4.9 0 11c0 8.25 11 19 11 19S22 19.25 22 11C22 4.9 17.1 0 11 0z" fill="#007AFF"/><circle cx="11" cy="11" r="4.5" fill="white"/></svg>
              </div>
            </div>
            <div style={{height:.5,background:'rgba(60,60,67,0.12)',margin:'0 16px 12px'}}/>
            {!dataReady&&!datasetError&&(
              <div role="status" aria-live="polite" style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,padding:'0 28px 12px',fontSize:13,color:'rgba(60,60,67,0.65)'}}>
                <span aria-hidden="true" style={{width:14,height:14,borderRadius:'50%',border:'2px solid rgba(0,122,255,0.25)',borderTopColor:'#007AFF',animation:'spin .8s linear infinite',display:'inline-block'}}/>
                Loading campus map data…
              </div>
            )}
            {datasetError&&(
              <div role="alert" style={{padding:'0 28px 12px',fontSize:13,color:'#FF3B30',textAlign:'center',lineHeight:1.4}}>Couldn't load campus map data. Check your connection and reload the page.</div>
            )}
            <button onClick={handleAllowGPS} disabled={!dataReady||!geolocationSupported} aria-disabled={!dataReady||!geolocationSupported} style={{display:'block',width:'calc(100% - 32px)',margin:'0 16px 10px',padding:'16px',background:'#007AFF',border:'none',borderRadius:14,fontFamily:'-apple-system,BlinkMacSystemFont,sans-serif',fontSize:17,fontWeight:600,color:'white',cursor:(dataReady&&geolocationSupported)?'pointer':'default',letterSpacing:-.2,boxShadow:'0 4px 14px rgba(0,122,255,0.3)',opacity:(dataReady&&geolocationSupported)?1:0.5}}>{geolocationSupported?'Use live GPS':'Live GPS not available on this device'}</button>
            <button onClick={openManualPicker} disabled={!dataReady} aria-disabled={!dataReady} style={{display:'block',width:'calc(100% - 32px)',margin:'0 16px 10px',padding:'16px',background:'rgba(120,120,128,0.12)',border:'none',borderRadius:14,fontFamily:'-apple-system,BlinkMacSystemFont,sans-serif',fontSize:17,fontWeight:400,color:'#007AFF',cursor:dataReady?'pointer':'default',letterSpacing:-.2,opacity:dataReady?1:0.5}}>Set my location manually</button>
            <button onClick={handleDontAllow} disabled={!dataReady} aria-disabled={!dataReady} style={{display:'block',width:'calc(100% - 32px)',margin:'0 16px',padding:'16px',background:'rgba(120,120,128,0.12)',border:'none',borderRadius:14,fontFamily:'-apple-system,BlinkMacSystemFont,sans-serif',fontSize:17,fontWeight:400,color:'#FF3B30',cursor:dataReady?'pointer':'default',letterSpacing:-.2,opacity:dataReady?1:0.5}}>Start at Main Gate</button>
            <div style={{fontSize:12,color:'rgba(60,60,67,0.55)',textAlign:'center',padding:'12px 28px 0',lineHeight:1.4}}>Live GPS is only used while this app is open. The alternative options use a clearly marked starting point.</div>
          </div>
        </div>
      )}

      {showSearch&&(
        <div role="dialog" aria-modal="true" aria-label="Destination search" ref={searchModalRef}
          style={{
            position:'fixed',
            inset:0,
            zIndex:150,
            display:'flex',
            flexDirection:'column',
            background:C.bgGrad1,
            animation:searchVisible?'searchIn .25s ease':'searchOut .25s ease forwards',
            transition:'background 0.6s ease',
            pointerEvents:'auto',
            touchAction:'pan-y',
            overscrollBehavior:'contain'
          }}>
          <h2 className="sr-only">Search for a destination</h2>
          <div style={{padding:'54px 16px 12px',display:'flex',alignItems:'center',gap:12,maxWidth:700,width:'100%',margin:'0 auto'}}>
            <button aria-label="Close search" onClick={closeSearch} style={{width:40,height:40,borderRadius:'50%',...glass,display:'flex',alignItems:'center',justifyContent:'center',border:'none',cursor:'pointer',flexShrink:0}}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill={C.textMid}><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
            </button>
            <div style={{flex:1,display:'flex',alignItems:'center',gap:10,...glassSolid,padding:'8px 12px 8px 16px',borderRadius:20,border:isListening?'1.5px solid #e74c3c':`1px solid ${C.cardBorder}`,boxShadow:isListening?'0 0 14px rgba(231,76,60,0.25)':'none',transition:'border 0.2s, box-shadow 0.2s'}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill={C.textLight}><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
              <input ref={searchInputRef} autoFocus={!isListening} aria-label="Search campus destinations" aria-describedby="search-help" value={query} onChange={e=>handleQueryChange(e.target.value)}
                onKeyDown={e=>{if(e.key==='Enter'&&query.trim())handleSearch(query);}}
                placeholder={isListening?"Listening... Speak your destination":"Search or speak (e.g. 'canteen')..."}
                style={{flex:1,border:'none',background:'transparent',fontSize:15,color:C.text,outline:'none',minWidth:0}}/>
              {query&&(
                <button type="button" aria-label="Clear text" onClick={()=>{setQuery('');setSuggestions([]);setSearchMessage('');}}
                  style={{border:'none',background:'transparent',cursor:'pointer',padding:4,color:C.textLight,display:'flex',alignItems:'center'}}>
                  <AIcon icon={IconX} size={15}/>
                </button>
              )}
              <button
                type="button"
                aria-label={isListening?'Stop voice input':'Speak through microphone'}
                title={isListening?'Stop listening':'Speak destination'}
                onClick={toggleVoiceSearch}
                style={{
                  width:36,
                  height:36,
                  borderRadius:'50%',
                  background:isListening?'#e74c3c':C.accentBtn,
                  border:'none',
                  cursor:'pointer',
                  display:'flex',
                  alignItems:'center',
                  justifyContent:'center',
                  flexShrink:0,
                  boxShadow:isListening?'0 0 12px rgba(231,76,60,0.6)':`0 2px 8px ${C.shadow}`,
                  transition:'all 0.2s',
                  animation:isListening?'audioPulse 1.2s infinite':'none',
                }}>
                <AIcon icon={isListening?IconCircleDot:IconMicrophone} size={18} pulse={isListening} color="white"/>
              </button>
            </div>
          </div>
          <div id="search-help" style={{position:'absolute',width:1,height:1,overflow:'hidden',clip:'rect(0 0 0 0)'}}>Type or speak a destination name to start directions.</div>
          <div className="scroll-y" style={{flex:1,overflowY:'auto',padding:'0 16px 20px',maxWidth:700,width:'100%',margin:'0 auto',touchAction:'pan-y',overscrollBehavior:'contain'}}>
            {isListening&&(
              <div style={{
                margin:'8px 0 14px',
                padding:'14px 16px',
                borderRadius:16,
                background:'linear-gradient(135deg, rgba(231,76,60,0.14), rgba(230,126,34,0.08))',
                border:'1px solid rgba(231,76,60,0.3)',
                display:'flex',
                flexDirection:'column',
                alignItems:'center',
                gap:8,
                animation:'slideUp 0.2s ease',
              }}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <span style={{width:9,height:9,borderRadius:'50%',background:'#e74c3c',boxShadow:'0 0 8px #e74c3c'}}/>
                  <span style={{fontSize:12,fontWeight:700,color:'#e74c3c',letterSpacing:'0.04em',textTransform:'uppercase'}}>
                    Listening to Microphone...
                  </span>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:4,height:24,padding:'2px 0'}}>
                  {[12,22,16,26,10,20,14,24,11].map((h,idx)=>(
                    <span key={idx} style={{
                      width:3.5,
                      height:`${h}px`,
                      borderRadius:2,
                      background:'#e74c3c',
                      animation:'audioWave 0.5s ease-in-out infinite alternate',
                      animationDelay:`${idx*0.07}s`
                    }}/>
                  ))}
                </div>
                <div style={{fontSize:14,color:C.text,fontWeight:600,textAlign:'center',minHeight:20}}>
                  {query?`"${query}"`:'Speak now, e.g. "Navigate me to Parul Canteen"'}
                </div>
                <div style={{fontSize:11,color:C.textLight,textAlign:'center'}}>
                  Or say: <span style={{color:C.accent,fontWeight:600}}>"Take me to Library"</span> · <span style={{color:C.accent,fontWeight:600}}>"Where is Dominos"</span>
                </div>
                <button type="button" onClick={toggleVoiceSearch}
                  style={{marginTop:2,padding:'5px 12px',borderRadius:16,border:'1px solid rgba(231,76,60,0.4)',background:'rgba(231,76,60,0.12)',color:'#e74c3c',fontSize:11,fontWeight:600,cursor:'pointer'}}>
                  Tap to Stop
                </button>
              </div>
            )}
            <div style={{marginBottom:12,marginTop:4}}>
              <RouteTypeSelector C={C} glass={glass} routeType={routeType} onChange={setRouteType} compact/>
            </div>
            {searchMessage&&<div className="search-message" role="status" aria-live="polite">{searchMessage}</div>}
            {suggestions.length>0&&suggestions.map((s,i)=>(
              <button key={s.key} onClick={()=>selectDestination(s.key)}
                style={{width:'100%',border:'none',textAlign:'left',display:'flex',alignItems:'center',gap:12,...glass,padding:'14px 16px',borderRadius:14,marginBottom:8,cursor:'pointer',animation:`slideUp ${0.05+i*0.04}s ease`}}>
                <div style={{width:36,height:36,borderRadius:10,background:C.accentLight,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill={C.accent}><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                </div>
                <span style={{fontSize:14,color:C.text,fontWeight:500}}>{s.name}</span>
              </button>
            ))}
            {!query&&(
              <>
                <div style={{fontSize:12,fontWeight:600,color:C.textLight,marginBottom:10,letterSpacing:'0.05em',textTransform:'uppercase'}}>Quick Access</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:20}}>
                  <button type="button" onClick={toggleVoiceSearch} className="chip"
                    style={{display:'inline-flex',alignItems:'center',gap:6,background:isListening?'rgba(231,76,60,0.18)':C.accentLight,color:isListening?'#e74c3c':C.accent,borderColor:isListening?'#e74c3c':'transparent',fontWeight:600}}>
                    <AIcon icon={IconMicrophone} size={15} pulse={isListening} color={isListening?'#e74c3c':C.accent}/>
                    {isListening?'Listening...':'Speak Destination'}
                  </button>
                  {EXPLORE_SPOTS.slice(0,7).map(spot=>(
                    <button key={spot.key} onClick={()=>selectDestination(spot.key)} className="chip" style={{display:'inline-flex',alignItems:'center',gap:5}}><DataIcon iconKey={spot.icon} size={15}/> {spot.label}</button>
                  ))}
                </div>
                {recentRoutes.length>0&&(
                  <>
                    <div style={{fontSize:12,fontWeight:600,color:C.textLight,marginBottom:10,letterSpacing:'0.05em',textTransform:'uppercase'}}>Recent</div>
                    {recentRoutes.map((r,i)=>(
                      <button key={i} onClick={()=>routeBetweenKeys(r.fromKey,r.toKey)}
                        style={{width:'100%',border:'none',textAlign:'left',display:'flex',alignItems:'center',gap:12,...glass,padding:'12px 16px',borderRadius:14,marginBottom:8,cursor:'pointer'}}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill={C.textLight}><path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18z"/></svg>
                        <div style={{flex:1}}>
                          <div style={{fontSize:12,color:C.textLight}}>From {r.from}</div>
                          <div style={{fontSize:13,color:C.text,fontWeight:500,display:'flex',alignItems:'center',gap:5}}><AIcon icon={IconArrowRight} size={13}/> {r.to}</div>
                        </div>
                      </button>
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}