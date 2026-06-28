"use client";

import React, { useEffect, useRef, useState } from 'react';
import '@tomtom-international/web-sdk-maps/dist/maps.css';

interface TomTomMapProps {
  center?: [number, number]; // [longitude, latitude]
  zoom?: number;
  markers?: Array<{ 
    id: string; 
    lng: number; 
    lat: number; 
    color?: string; 
    label?: string;
    profile?: {
      name: string;
      bike: string;
      emergency: string;
      photoUrl?: string;
    };
  }>;
  routes?: any[]; // GeoJSON FeatureCollection array
  friendRoutes?: any[]; // GeoJSON FeatureCollection array for friends (purple)
  activeRouteIndex?: number;
  onRouteChange?: (index: number) => void;
  recenterToggle?: number;
  isNavigating?: boolean;
  bearing?: number;
}

export function TomTomMap({ 
  center = [-122.4194, 37.7749], // San Francisco default
  zoom = 13,
  markers = [],
  routes = [],
  friendRoutes = [],
  activeRouteIndex = 0,
  onRouteChange,
  recenterToggle,
  isNavigating = false,
  bearing = 0
}: TomTomMapProps) {
  const mapElement = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const [tt, setTt] = useState<any>(null);
  const markersRef = useRef<any[]>([]);

  useEffect(() => {
    // Dynamic import to prevent SSR issues with TomTom SDK
    import('@tomtom-international/web-sdk-maps').then((ttMaps) => {
      setTt(ttMaps);
      
      if (mapElement.current && !map) {
        const apiKey = process.env.NEXT_PUBLIC_TOMTOM_API_KEY;
        if (!apiKey) {
          console.error("TomTom API key is missing");
          return;
        }

        const newMap = ttMaps.map({
          key: apiKey,
          container: mapElement.current,
          center: center,
          zoom: zoom,
          stylesVisibility: {
            trafficIncidents: true,
            trafficFlow: true,
          }
        });

        newMap.on('load', () => {
          setMap(newMap);
        });

        return () => {
          newMap.remove();
        };
      }
    });
  }, []); // Initialize once

  // Update map camera based on navigation state
  useEffect(() => {
    if (!map || !center) return;

    if (isNavigating) {
      // Live Google Maps-style navigation camera
      map.easeTo({ // easeTo is smoother for continuous tracking than flyTo
        center: center,
        zoom: 16,
        pitch: 60, // Forward-looking tilt
        bearing: bearing || 0, // Follow travel direction
        padding: { top: 0, bottom: window.innerHeight * 0.4, left: 0, right: 0 }, // Position marker near bottom
        duration: 1000,
        easing: (t: number) => t // Linear easing for continuous movement
      });
    } else if (!recenterToggle) {
      // Default overview behavior
      map.flyTo({ 
        center: center, 
        zoom: zoom,
        pitch: 0,
        bearing: 0,
        padding: { top: 0, bottom: 0, left: 0, right: 0 },
        speed: 1.5 
      });
    }
  }, [map, center, zoom, isNavigating, bearing]);

  // Handle Recenter Toggle (Forces 2D Top-Down View like Google Maps)
  useEffect(() => {
    if (map && center && recenterToggle && !isNavigating) {
      map.flyTo({ center: center, zoom: zoom, pitch: 0, bearing: 0, speed: 1.5 });
    }
  }, [recenterToggle, map, center, zoom, isNavigating]);

  // Handle Markers
  useEffect(() => {
    if (map && tt) {
      // Clear old markers
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];

      markers.forEach(m => {
        // Create custom marker element
        const el = document.createElement('div');
        el.className = 'marker';
        
        if (m.profile?.photoUrl) {
          // If user has a photo, display it
          el.style.backgroundImage = `url(${m.profile.photoUrl})`;
          el.style.backgroundSize = 'cover';
          el.style.backgroundPosition = 'center';
          el.style.width = '32px';
          el.style.height = '32px';
          el.style.borderRadius = '50%';
          el.style.border = `2px solid ${m.color || '#3b82f6'}`;
          el.style.boxShadow = `0 0 10px ${m.color || '#3b82f6'}`;
        } else {
          // Default glowing dot
          el.style.backgroundColor = m.color || '#3b82f6';
          el.style.width = '24px';
          el.style.height = '24px';
          el.style.borderRadius = '50%';
          el.style.border = '3px solid white';
          el.style.boxShadow = `0 0 15px ${m.color || '#3b82f6'}`;
          
          if (m.label) {
            el.innerHTML = `<span style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); color:white; font-size:10px; font-weight:bold;">${m.label.substring(0,1).toUpperCase()}</span>`;
          }
        }

        const marker = new tt.Marker({ element: el })
          .setLngLat([m.lng, m.lat])
          .addTo(map);

        if (m.profile) {
          const popup = new tt.Popup({ offset: 15 }).setHTML(`
            <div style="padding: 4px; font-family: var(--font-sans);">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                ${m.profile?.photoUrl ? 
                  `<img src="${m.profile.photoUrl}" style="width:24px; height:24px; border-radius:50%; object-fit:cover;" />` 
                  : `<div style="width:24px; height:24px; border-radius:50%; background:#3b82f6; display:flex; align-items:center; justify-content:center; color:white; font-weight:bold; font-size:10px;">${m.label?.substring(0,1).toUpperCase() || 'U'}</div>`
                }
                <strong style="font-size: 14px; color: #1f2937;">${m.profile.name}</strong>
              </div>
              <div style="font-size: 11px; color: #4b5563; margin-bottom: 4px;">
                🏍 ${m.profile.bike}
              </div>
              <div style="font-size: 11px; color: #ef4444; font-weight: 500;">
                📞 SOS: ${m.profile.emergency}
              </div>
            </div>
          `);
          marker.setPopup(popup);
        }
          
        markersRef.current.push(marker);
      });
    }
  }, [map, tt, markers]);

  // Handle Routes
  useEffect(() => {
    if (!map || routes.length === 0) return;

    // Remove existing route layers and sources
    for (let i = 0; i < 5; i++) {
      if (map.getLayer(`route-casing-${i}`)) map.removeLayer(`route-casing-${i}`);
      if (map.getLayer(`route-layer-${i}`)) map.removeLayer(`route-layer-${i}`);
      if (map.getLayer(`route-hit-${i}`)) map.removeLayer(`route-hit-${i}`);
      if (map.getSource(`route-source-${i}`)) map.removeSource(`route-source-${i}`);
    }

    // Custom double click state
    let lastRouteClickTime: Record<number, number> = {};

    // Remove existing friend routes
    for (let i = 0; i < 10; i++) {
      if (map.getLayer(`friend-casing-${i}`)) map.removeLayer(`friend-casing-${i}`);
      if (map.getLayer(`friend-layer-${i}`)) map.removeLayer(`friend-layer-${i}`);
      if (map.getSource(`friend-source-${i}`)) map.removeSource(`friend-source-${i}`);
    }

    // Add friend routes (light purple, lower opacity so map doesn't get cluttered)
    friendRoutes.forEach((routeGeoJson, index) => {
      map.addSource(`friend-source-${index}`, {
        type: 'geojson',
        data: routeGeoJson
      });

      map.addLayer({
        id: `friend-casing-${index}`,
        type: 'line',
        source: `friend-source-${index}`,
        paint: {
          'line-color': '#d8b4fe', // Light purple for casing
          'line-width': 6,
          'line-opacity': 0.2
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' }
      });

      map.addLayer({
        id: `friend-layer-${index}`,
        type: 'line',
        source: `friend-source-${index}`,
        paint: {
          'line-color': '#c084fc', // Bright but light purple
          'line-width': 4,
          'line-opacity': 0.4 // High transparency
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' }
      });
    });

    // Add new routes
    // Render inactive routes first so the active route is on top
    routes.forEach((routeGeoJson, index) => {
      const isActive = index === activeRouteIndex;
      
      map.addSource(`route-source-${index}`, {
        type: 'geojson',
        data: routeGeoJson
      });

      // Casing layer (Outline for premium look)
      map.addLayer({
        id: `route-casing-${index}`,
        type: 'line',
        source: `route-source-${index}`,
        paint: {
          'line-color': isActive ? '#1d4ed8' : '#4b5563', // Darker blue for active outline
          'line-width': isActive ? 10 : 6,
          'line-opacity': isActive ? 0.35 : 0.2 // Lower opacity so traffic shows through
        },
        layout: {
          'line-cap': 'round',
          'line-join': 'round'
        }
      });

      map.addLayer({
        id: `route-layer-${index}`,
        type: 'line',
        source: `route-source-${index}`,
        paint: {
          'line-color': isActive ? '#3b82f6' : '#6b7280', // Primary blue
          'line-width': isActive ? 6 : 4,
          'line-opacity': isActive ? 0.55 : 0.3 // Lower opacity so traffic shows through
        },
        layout: {
          'line-cap': 'round',
          'line-join': 'round'
        }
      });

      // Invisible Hit Layer for easier clicking
      map.addLayer({
        id: `route-hit-${index}`,
        type: 'line',
        source: `route-source-${index}`,
        paint: {
          'line-color': 'transparent',
          'line-width': 30 // Massive hit area
        },
        layout: {
          'line-cap': 'round',
          'line-join': 'round'
        }
      });

      // Make lines clickable
      if (onRouteChange && !isActive) {
        map.on('click', `route-hit-${index}`, (e: any) => {
          onRouteChange(index);
        });
        map.on('mouseenter', `route-hit-${index}`, () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', `route-hit-${index}`, () => {
          map.getCanvas().style.cursor = '';
        });
      }
    });

  }, [map, routes, activeRouteIndex]);

  return (
    <div 
      ref={mapElement} 
      className="absolute inset-0 w-full h-full"
      style={{ background: '#000' }} // Prevent white flash before map loads
    />
  );
}
