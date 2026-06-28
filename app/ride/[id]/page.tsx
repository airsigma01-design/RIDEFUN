"use client";

import { useState, useEffect, useRef } from "react";
import { TomTomMap } from "@/components/features/TomTomMap";
import { Navigation, Clock, Share2, PhoneOff, Users, Plus, AlertTriangle, X, QrCode, LocateFixed, CornerUpLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import FadeContent from "@/components/ui/FadeContent";
import SideRays from "@/components/ui/SideRays";
import StarBorder from "@/components/ui/StarBorder";
import { AnimatedButton } from "@/components/ui/animated-button";
import { supabase } from "@/lib/supabase";

// Haversine formula to calculate distance between two coordinates in miles
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 3958.8; // Radius of the Earth in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c; 
}

function calculateMeetupPoint(riders: {lat: number, lng: number}[]) {
  if (riders.length === 0) return null;
  let sumLat = 0;
  let sumLng = 0;
  riders.forEach(r => {
    sumLat += r.lat;
    sumLng += r.lng;
  });
  return {
    lat: sumLat / riders.length,
    lng: sumLng / riders.length
  };
}

export default function RideNavigationPage() {
  const { user, isLoading } = useAuth();
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const destName = searchParams.get('destName') || "Destination";
  const destLatStr = searchParams.get('destLat');
  const destLngStr = searchParams.get('destLng');
  const memberLimit = searchParams.get('limit') || "4";
  const privacy = searchParams.get('privacy') || "public";

  // State
  const [eta, setEta] = useState("--");
  const [distance, setDistance] = useState("--");
  const [speed, setSpeed] = useState("0 mph");
  const [destination] = useState(destName);
  const [isNavigating, setIsNavigating] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  const [mapCenter, setMapCenter] = useState<[number, number]>([-122.4783, 37.8199]);
  const [mapZoom, setMapZoom] = useState(12); // Overview zoom
  const [mapMarkers, setMapMarkers] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [routeSummaries, setRouteSummaries] = useState<any[]>([]);
  const [friendRoutes, setFriendRoutes] = useState<any[]>([]);
  const [activeRouteIndex, setActiveRouteIndex] = useState(0);
  const [recenterToggle, setRecenterToggle] = useState(0);
  const [mapBearing, setMapBearing] = useState<number>(0);

  // Multiplayer State
  const [localLocation, setLocalLocation] = useState<{lat: number, lng: number} | null>(null);
  const [otherRiders, setOtherRiders] = useState<any[]>([]);
  const channelRef = useRef<any>(null);
  
  // Routing optimization
  const lastRoutedLocationRef = useRef<{lat: number, lng: number} | null>(null);
  const lastRidersCountRef = useRef<number>(0);

  // Modals & Notifications
  const [showSos, setShowSos] = useState(false);
  const [showSosMenu, setShowSosMenu] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showExpandedQr, setShowExpandedQr] = useState(false);
  const [joinRequest, setJoinRequest] = useState<string | null>(null);
  
  // Break Point & Waypoint State
  const [globalBreakPoint, setGlobalBreakPoint] = useState<{lat: number, lng: number, createdBy: string, name: string} | null>(null);
  const [isRoutingToBreak, setIsRoutingToBreak] = useState(false);
  const [isSelectingBreakPoint, setIsSelectingBreakPoint] = useState(false);
  const [customWaypoint, setCustomWaypoint] = useState<{lat: number, lng: number} | null>(null);

  // Dynamic Destination State
  const [globalDestination, setGlobalDestination] = useState<{lat: number, lng: number, name: string} | null>(null);
  const [isEditingDestination, setIsEditingDestination] = useState(false);

  // Audio Ref
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  // Restore Navigation State on Mount
  useEffect(() => {
    if (typeof window !== "undefined" && params?.id) {
      const savedState = sessionStorage.getItem(`navigating_${params.id}`);
      if (savedState === "true") {
        setIsNavigating(true);
      }
    }
  }, [params?.id]);

  // Update ETA and Distance when active route changes
  useEffect(() => {
    if (routeSummaries.length > activeRouteIndex) {
      const bestRoute = routeSummaries[activeRouteIndex];
      setEta(Math.round(bestRoute.travelTimeInSeconds / 60) + " mins");
      setDistance((bestRoute.lengthInMeters / 1000).toFixed(1) + " km");
    }
  }, [activeRouteIndex, routeSummaries]);

  // Simulate Private Join Request for Admins
  useEffect(() => {
    if (user?.isAdmin && privacy === "private") {
      const timer = setTimeout(() => {
        setJoinRequest("Alex on a Kawasaki Ninja wants to join.");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [user, privacy]);

  // 1. Supabase Realtime Presence
  useEffect(() => {
    if (!user || !params?.id) return;
    const channelId = `ride_${params.id}`;
    
    // Create the channel
    const newChannel = supabase.channel(channelId, {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    newChannel
      .on('presence', { event: 'sync' }, () => {
        const state = newChannel.presenceState();
        const riders: any[] = [];
        for (const key in state) {
          if (key !== user.id) {
            riders.push(state[key][0]); // Get latest presence for this user
          }
        }
        setOtherRiders(riders);
      })
      .on('broadcast', { event: 'break_point' }, (payload) => {
        // Someone declared a break point
        setGlobalBreakPoint(payload.payload);
        // Play notification sound
        if (audioRef.current) audioRef.current.play().catch(e => console.log(e));
      })
      .on('broadcast', { event: 'end_break_point' }, () => {
        // Break ended globally by the creator
        setGlobalBreakPoint(null);
        setIsRoutingToBreak(false);
      })
      .on('broadcast', { event: 'update_destination' }, (payload) => {
        // Host updated destination
        setGlobalDestination(payload.payload);
      })
      .on('broadcast', { event: 'end_ride_all' }, () => {
        // Host ended the ride for everyone
        alert("The host has ended the ride for everyone.");
        setIsNavigating(false);
        if (params?.id) {
          sessionStorage.removeItem(`navigating_${params.id}`);
        }
        router.push("/dashboard");
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log("Connected to Realtime Presence & Broadcasts");
        }
      });

    channelRef.current = newChannel;

    return () => {
      supabase.removeChannel(newChannel);
    };
  }, [user, params?.id]);

  // 2. Geolocation Tracking
  useEffect(() => {
    if (!user) return;
    let watchId: number;

    if (navigator.geolocation) {
      // Get initial fast location
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLat = position.coords.latitude;
          const userLng = position.coords.longitude;
          setLocalLocation({ lat: userLat, lng: userLng });
          setMapCenter([userLng, userLat]);
        },
        (error) => {
          console.error("Error getting location", error);
          // Fallback if desktop GPS fails (SF)
          const fallbackLat = 37.7749;
          const fallbackLng = -122.4194;
          setLocalLocation({ lat: fallbackLat, lng: fallbackLng });
          setMapCenter([fallbackLng, fallbackLat]);
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
      );

      // Watch location continuously
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const newLat = position.coords.latitude;
          const newLng = position.coords.longitude;
          const s = position.coords.speed;
          const heading = position.coords.heading;
          
          setLocalLocation({ lat: newLat, lng: newLng });
          
          if (s !== null) {
            setSpeed(Math.round(s * 2.23694) + " mph");
          }
          if (isNavigating) {
            setMapCenter([newLng, newLat]);
            if (heading !== null && !isNaN(heading)) {
              setMapBearing(heading);
            }
          }
          
          // Broadcast location to friends via Presence
          if (channelRef.current) {
            channelRef.current.track({
              id: user.id,
              lat: newLat,
              lng: newLng,
              name: user.name,
              lastName: user.lastName,
              bikeModel: user.bikeModel,
              photoUrl: user.photoUrl,
              updatedAt: new Date().toISOString()
            });
          }
        },
        (error) => console.error("Error watching location", error),
        { enableHighAccuracy: true, maximumAge: 0 }
      );
    }

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [user, isNavigating]);

  // 3. Map Markers & Routing Logic
  useEffect(() => {
    if (!localLocation || !user) return;
    
    // Use Break Point or Global Destination if they exist
    const isBreakActive = isRoutingToBreak && globalBreakPoint;
    const destLat = isBreakActive ? globalBreakPoint.lat : (globalDestination ? globalDestination.lat : (destLatStr ? parseFloat(destLatStr) : 37.8199));
    const destLng = isBreakActive ? globalBreakPoint.lng : (globalDestination ? globalDestination.lng : (destLngStr ? parseFloat(destLngStr) : -122.4783));
    const activeDestinationName = globalDestination ? globalDestination.name : destination;

    // --- Smart Meetup Point Calculation ---
    const validOtherRiders = otherRiders.filter(r => r.lat && r.lng);
    
    // Smart Radius Clustering (15km)
    const CLUSTER_RADIUS_MILES = 9.32; // ~15 km
    const AUTO_CLEAR_RADIUS_MILES = 0.186; // ~300 meters

    const clusterFriends = validOtherRiders.filter(r => {
      const dist = calculateDistance(localLocation.lat, localLocation.lng, r.lat, r.lng);
      return dist <= CLUSTER_RADIUS_MILES;
    });

    const allClusterLocs = [localLocation, ...clusterFriends.map(r => ({ lat: r.lat, lng: r.lng }))];
    const meetup = clusterFriends.length > 0 ? calculateMeetupPoint(allClusterLocs) : null;
    
    let hasMeetupWaypoint = false;
    if (meetup && !isBreakActive) {
      let maxDist = 0;
      allClusterLocs.forEach(loc => {
         const d = calculateDistance(loc.lat, loc.lng, meetup.lat, meetup.lng);
         if (d > maxDist) maxDist = d;
      });
      // Auto-clear meetup if all cluster members are within 300m of the meetup center
      if (maxDist > AUTO_CLEAR_RADIUS_MILES) {
         hasMeetupWaypoint = true;
      }
    }

    // --- Build Markers ---
    const newMarkers: any[] = [
      { 
        id: 'start', 
        lng: localLocation.lng, 
        lat: localLocation.lat, 
        color: '#3b82f6', 
        label: user.name || "Me",
        profile: {
          name: `${user.name} ${user.lastName || ""}`,
          bike: user.bikeModel || "Unknown",
          emergency: user.emergencyPhone || "None",
          photoUrl: user.photoUrl
        }
      },
      { id: 'end', lng: destLng, lat: destLat, color: '#10b981', label: "D" }
    ];

    validOtherRiders.forEach(r => {
      newMarkers.push({
        id: r.id,
        lng: r.lng,
        lat: r.lat,
        color: '#a855f7', // Purple for friends
        label: r.name || "R",
        profile: {
          name: `${r.name || ""} ${r.lastName || ""}`,
          bike: r.bikeModel || "Unknown",
          emergency: "Hidden",
          photoUrl: r.photoUrl
        }
      });
    });

    if (hasMeetupWaypoint && meetup) {
      newMarkers.push({ id: 'meetup', lng: meetup.lng, lat: meetup.lat, color: '#f59e0b', label: "M" });
    }

    setMapMarkers(newMarkers);

    // --- Routing Logic ---
    const needsReroute = () => {
      if (!lastRoutedLocationRef.current) return true;
      if (validOtherRiders.length !== lastRidersCountRef.current) return true;
      const dist = calculateDistance(localLocation.lat, localLocation.lng, lastRoutedLocationRef.current.lat, lastRoutedLocationRef.current.lng);
      return dist > 0.3; // Re-route if moved > 0.3 miles to prevent API spam
    };

    if (needsReroute()) {
      const fetchRoutes = async () => {
        try {
          const apiKey = process.env.NEXT_PUBLIC_TOMTOM_API_KEY;

          // Helper to fetch main route with or without meetup point
          const fetchMainRoute = async (includeMeetup: boolean) => {
             let routeUrl = `https://api.tomtom.com/routing/1/calculateRoute/${localLocation.lat},${localLocation.lng}`;
             if (includeMeetup && meetup) {
                routeUrl += `:${meetup.lat},${meetup.lng}`;
             }
             if (customWaypoint) {
                routeUrl += `:${customWaypoint.lat},${customWaypoint.lng}`;
             }
             const altParam = (includeMeetup || customWaypoint) ? '' : '&maxAlternatives=2';
             routeUrl += `:${destLat},${destLng}/json?key=${apiKey}${altParam}`;
             
             const res = await fetch(routeUrl);
             if (res.ok) {
                const data = await res.json();
                if (data.routes && data.routes.length > 0) return data;
             }
             return null;
          };

          let data = await fetchMainRoute(hasMeetupWaypoint);
          
          // FALLBACK: If routing to meetup point failed (e.g. centroid is in water), fallback to direct route
          if (!data && hasMeetupWaypoint) {
             console.warn("Meetup routing failed. Falling back to direct route.");
             data = await fetchMainRoute(false);
          }

          if (data && data.routes && data.routes.length > 0) {
            setRouteError(null);
            
            const summaries = data.routes.map((r: any) => r.summary);
            setRouteSummaries(summaries);

            const routeGeoJsons = data.routes.map((r: any) => {
              let allPoints: any[] = [];
              r.legs.forEach((leg: any) => {
                 allPoints = allPoints.concat(leg.points.map((p: any) => [p.longitude, p.latitude]));
              });
              return {
                type: 'Feature',
                properties: {},
                geometry: {
                  type: 'LineString',
                  coordinates: allPoints
                }
              };
            });
            setRoutes(routeGeoJsons);
          } else {
            setRouteError("Route calculation failed. Destination is likely too far away.");
          }
          
          // Fetch friend routes with fallback
          if (validOtherRiders.length > 0) {
             const fRoutes: any[] = [];
             await Promise.all(validOtherRiders.map(async (rider) => {
               let fUrl = `https://api.tomtom.com/routing/1/calculateRoute/${rider.lat},${rider.lng}`;
               // Only route this friend to the local meetup point if they are within our 15km cluster
               // Otherwise, just route them straight to the destination
               const isRiderInCluster = clusterFriends.some(cf => cf.id === rider.id);
               const shouldRouteToMeetup = hasMeetupWaypoint && meetup && isRiderInCluster;

               if (shouldRouteToMeetup) fUrl += `:${meetup.lat},${meetup.lng}`;
               fUrl += `:${destLat},${destLng}/json?key=${apiKey}`;
               
               let friendPts = null;
               try {
                 const fRes = await fetch(fUrl);
                 if (fRes.ok) {
                   const fData = await fRes.json();
                   if (fData.routes && fData.routes.length > 0) {
                      const rLegs = fData.routes[0].legs;
                      let allPts: any[] = [];
                      rLegs.forEach((leg: any) => {
                        allPts = allPts.concat(leg.points.map((p: any) => [p.longitude, p.latitude]));
                      });
                      friendPts = allPts;
                   }
                 }
               } catch (e) {
                 console.error("Friend routing error", e);
               }

               // FALLBACK: Draw straight line if TomTom fails to route them (e.g. they are in the water or non-routable area)
               if (!friendPts) {
                  friendPts = [
                     [rider.lng, rider.lat],
                     (shouldRouteToMeetup) ? [meetup.lng, meetup.lat] : [destLng, destLat],
                     [destLng, destLat] // Finish at destination
                  ];
               }

               fRoutes.push({
                  type: 'Feature',
                  properties: {},
                  geometry: { type: 'LineString', coordinates: friendPts }
               });
             }));
             setFriendRoutes(fRoutes);
          } else {
             setFriendRoutes([]);
          }
        } catch (err) {
          console.error("Routing error", err);
          setRouteError("Network error while calculating route.");
        }
      };

      fetchRoutes();
      lastRoutedLocationRef.current = localLocation;
      lastRidersCountRef.current = validOtherRiders.length;
    }
  }, [localLocation, otherRiders, user, destLatStr, destLngStr, globalDestination, customWaypoint, isRoutingToBreak, globalBreakPoint]);

  const handleStartNavigation = () => {
    setIsNavigating(true);
    setMapZoom(16); // Zoom in closely for navigation
    if (params?.id) {
      sessionStorage.setItem(`navigating_${params.id}`, "true");
    }
  };

  const handleSos = (category: string) => {
    if (!audioRef.current) {
      audioRef.current = new Audio('https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg');
    }
    audioRef.current.play();
    
    if (navigator.vibrate) {
      navigator.vibrate([500, 200, 500, 200, 500]);
    }

    alert(`SOS Alert Sent: ${category}`);
    setShowSos(false);
  };

  const handleMapClick = (lat: number, lng: number) => {
    if (!isSelectingBreakPoint) return;
    
    // Broadcast the Break Point
    if (channelRef.current && user) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'break_point',
        payload: {
          lat,
          lng,
          createdBy: user.name || "Rider",
          name: "Custom Break Point"
        }
      });
      // Set locally
      setGlobalBreakPoint({ lat, lng, createdBy: user.name || "Rider", name: "Custom Break Point" });
      setIsRoutingToBreak(true); // Automatically opt creator in
      setIsSelectingBreakPoint(false);
    }
  };

  const handleMapDoubleClick = (lat: number, lng: number) => {
    // Set a custom waypoint for the route
    setCustomWaypoint({ lat, lng });
  };

  const handleEndBreak = () => {
    setIsRoutingToBreak(false); // Restore personal routing
    if (globalBreakPoint?.createdBy === user?.name && channelRef.current) {
       channelRef.current.send({
         type: 'broadcast',
         event: 'end_break_point'
       });
       setGlobalBreakPoint(null);
    }
  };

  const activeDestinationName = globalDestination ? globalDestination.name : destination;

  const handleEndRide = () => {
    if (user?.isAdmin) {
      if (confirm("You are the host. Do you want to end this ride for EVERYONE?")) {
        if (channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'end_ride_all'
          });
        }
      }
    } else {
      if (!confirm("Are you sure you want to end this ride?")) return;
    }
    
    setIsNavigating(false);
    if (params?.id) {
      sessionStorage.removeItem(`navigating_${params.id}`);
    }
    router.push("/dashboard");
  };

  if (!user) return null;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      {/* Map layer (Bottom-most) */}
      <div className="absolute inset-0 z-0">
        <TomTomMap 
          center={mapCenter}
          zoom={mapZoom} 
          markers={
            globalBreakPoint 
            ? [...mapMarkers, { id: 'break', lat: globalBreakPoint.lat, lng: globalBreakPoint.lng, label: "Break", color: "#f43f5e" }] 
            : mapMarkers
          }
          routes={routes}
          friendRoutes={friendRoutes}
          activeRouteIndex={activeRouteIndex}
          onRouteChange={(idx) => setActiveRouteIndex(idx)}
          recenterToggle={recenterToggle}
          isNavigating={isNavigating}
          bearing={mapBearing}
          onMapClick={(lat, lng) => {
            if (isEditingDestination) {
              // Update destination globally
              if (channelRef.current) {
                channelRef.current.send({
                  type: 'broadcast',
                  event: 'update_destination',
                  payload: { lat, lng, name: "Custom Destination" }
                });
              }
              setGlobalDestination({ lat, lng, name: "Custom Destination" });
              setIsEditingDestination(false);
            } else {
              handleMapClick(lat, lng);
            }
          }}
          onMapDoubleClick={handleMapDoubleClick}
        />
      </div>

      {/* Side Rays for premium look */}
      <div className="absolute inset-0 pointer-events-none z-10 opacity-40">
        <SideRays
          speed={1.5}
          rayColor1="#10b981"
          rayColor2="#0ea5e9"
          intensity={1.0}
          spread={2}
          origin="top-right"
        />
      </div>

      {/* SELECTING BREAK POINT OVERLAY */}
      {isSelectingBreakPoint && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 bg-black/80 backdrop-blur-md text-white px-6 py-3 rounded-full shadow-2xl border border-white/20 flex items-center space-x-3 pointer-events-auto cursor-pointer" onClick={() => setIsSelectingBreakPoint(false)}>
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
          <p className="font-semibold text-sm">Tap anywhere on the map to set Break Point</p>
          <X className="w-4 h-4 text-gray-400" />
        </div>
      )}

      {/* EDITING DESTINATION OVERLAY */}
      {isEditingDestination && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 bg-blue-900/90 backdrop-blur-md text-white px-6 py-3 rounded-full shadow-2xl border border-blue-400/50 flex items-center space-x-3 pointer-events-auto cursor-pointer" onClick={() => setIsEditingDestination(false)}>
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
          <p className="font-semibold text-sm">Tap anywhere on the map to set a new Destination</p>
          <X className="w-4 h-4 text-blue-200" />
        </div>
      )}

      {/* BREAK POINT NOTIFICATION (OPT-IN) */}
      {globalBreakPoint && !isRoutingToBreak && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-40 w-full max-w-sm pointer-events-none">
          <div className="pointer-events-auto rounded-2xl border border-white/40 bg-white/60 backdrop-blur-xl p-4 shadow-2xl flex flex-col items-center text-center animate-in slide-in-from-top-10 duration-500">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-2 shadow-inner">
              <span className="text-xl">☕</span>
            </div>
            <p className="text-slate-900 font-bold mb-1">{globalBreakPoint.createdBy} requested a break!</p>
            <p className="text-slate-600 text-xs font-medium mb-4">Click below to sync your route to the break point.</p>
            <div className="flex space-x-3 w-full">
              <button onClick={() => setIsRoutingToBreak(true)} className="flex-1 bg-red-500 text-white rounded-xl py-2.5 text-sm font-bold hover:bg-red-600 transition-colors shadow-md">Join Break</button>
              <button onClick={() => setGlobalBreakPoint(null)} className="flex-1 bg-white/50 text-slate-600 border border-black/10 rounded-xl py-2.5 text-sm font-bold hover:bg-white/80 transition-colors shadow-sm">Dismiss</button>
            </div>
          </div>
        </div>
      )}

      {/* ACTIVE BREAK MODE BAR */}
      {globalBreakPoint && isRoutingToBreak && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-40 w-full max-w-sm pointer-events-none">
          <div className="pointer-events-auto rounded-2xl border border-red-500/50 bg-red-50/90 backdrop-blur-xl p-3 shadow-2xl flex items-center justify-between animate-in slide-in-from-top-10 duration-500">
            <div className="flex items-center space-x-3">
               <span className="text-2xl">☕</span>
               <div>
                  <p className="text-red-700 font-black text-sm uppercase tracking-wide">Break Active</p>
                  <p className="text-red-500/80 text-[10px] font-bold">Routing to {globalBreakPoint.createdBy}'s break</p>
               </div>
            </div>
            <button onClick={handleEndBreak} className="bg-red-500 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-red-600 shadow-md">
               End Break
            </button>
          </div>
        </div>
      )}

      {/* TOP LEFT: Compact Stats Panel */}
      <FadeContent blur={true} duration={1000} delay={0.2} ease="ease-out" initialOpacity={0} className="absolute top-4 left-4 right-16 md:right-auto z-20 pointer-events-none">
        <div className="pointer-events-auto rounded-xl border border-white/40 bg-white/30 px-3 py-2 shadow-xl backdrop-blur-md flex items-center space-x-3 md:space-x-6 overflow-hidden">
          <div className="flex-1 min-w-0 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-0.5">Dest</p>
              <h2 className="text-sm font-bold text-slate-900 line-clamp-2 whitespace-normal">{activeDestinationName}</h2>
            </div>
            {user.isAdmin && (
              <button onClick={() => setIsEditingDestination(true)} className="ml-2 p-1.5 rounded-full hover:bg-black/10 transition-colors text-slate-500 hover:text-slate-900">
                 <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
            )}
          </div>
          <div className="h-6 w-px bg-black/20 shrink-0"></div>
          <div className="flex items-center space-x-1.5 shrink-0">
            <Clock className="w-3.5 h-3.5 text-blue-600 hidden sm:block" />
            <div>
              <p className="text-[10px] text-slate-600 leading-none">ETA</p>
              <p className="text-xs font-semibold text-slate-900 leading-tight">{eta}</p>
            </div>
          </div>
          <div className="flex items-center space-x-1.5 shrink-0">
            <Navigation className="w-3.5 h-3.5 text-purple-600 hidden sm:block" />
            <div>
              <p className="text-[10px] text-slate-600 leading-none">Dist</p>
              <p className="text-xs font-semibold text-slate-900 leading-tight">{distance}</p>
            </div>
          </div>
        </div>
        
        {/* Error Message Display */}
        {routeError && (
          <div className="mt-2 pointer-events-auto rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 shadow-2xl backdrop-blur-xl">
            <p className="text-xs font-semibold text-red-400">{routeError}</p>
          </div>
        )}
      </FadeContent>

      {/* MOBILE TURN INSTRUCTION CARD (Only when navigating) */}
      {isNavigating && (
        <div className="absolute top-4 left-4 right-4 z-30 md:hidden animate-in slide-in-from-top fade-in duration-500">
          <div className="rounded-2xl border border-white/40 bg-white/40 backdrop-blur-md shadow-xl p-4 flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0 border border-blue-500/30">
              <CornerUpLeft className="w-6 h-6 text-blue-600" strokeWidth={3} />
            </div>
            <div>
              <p className="text-2xl font-black text-slate-900 tracking-tight leading-none mb-1">250 m</p>
              <p className="text-sm font-medium text-slate-600 leading-tight">Turn left onto <span className="text-slate-800">Sahara Road</span></p>
            </div>
          </div>
        </div>
      )}

      {/* MIDDLE LEFT: Real-time Speedometer */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 z-20 pointer-events-none">
        <div className="pointer-events-auto flex items-center justify-center w-14 h-14 md:w-16 md:h-16 rounded-full bg-white/30 border border-white/40 shadow-xl backdrop-blur-md transition-all">
          <div className="text-center">
            <span className="block text-base md:text-lg font-bold text-slate-900 leading-none">{speed.split(' ')[0]}</span>
            <span className="block text-[9px] md:text-[10px] text-slate-600 uppercase font-semibold">mph</span>
          </div>
        </div>
      </div>

      <FadeContent blur={true} duration={1000} delay={0.4} ease="ease-out" initialOpacity={0} className="absolute right-4 top-1/4 md:top-1/2 md:-translate-y-1/2 z-20 pointer-events-none flex flex-col items-end space-y-3">
        {/* Members Count */}
        <button 
          onClick={() => setShowMembers(true)}
          className="pointer-events-auto flex items-center justify-center h-10 px-3 rounded-full bg-white/30 border border-white/40 backdrop-blur-md space-x-1.5 hover:bg-white/40 transition-all mb-4 shadow-lg" 
          title={privacy === "private" ? "Private Ride" : "Public Ride"}
        >
          <Users className="w-3.5 h-3.5 text-blue-600" />
          <span className="text-xs font-bold text-slate-900">{1 + otherRiders.length}/{memberLimit}</span>
        </button>

        {/* Recenter Button */}
        <button 
          onClick={() => setRecenterToggle(Date.now())}
          className="pointer-events-auto flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-full bg-white/30 border border-white/40 text-emerald-600 backdrop-blur-md transition-all hover:bg-white/40 shadow-lg"
          title="Recenter Map (2D)"
        >
          <LocateFixed className="w-4 h-4 md:w-5 md:h-5" />
        </button>

        {/* SOS Button */}
        <button 
          onClick={() => setShowSosMenu(true)}
          className="pointer-events-auto flex h-12 w-12 md:h-14 md:w-14 items-center justify-center rounded-full bg-red-100 border border-red-200 text-red-600 backdrop-blur-md transition-all hover:bg-red-200 shadow-xl mt-4"
        >
          <AlertTriangle className="w-5 h-5 md:w-6 md:h-6" />
        </button>

      </FadeContent>

      {/* BOTTOM CENTER: Start Ride Button */}
      {/* BOTTOM CENTER: Start Ride Button */}
      {!isNavigating && (
        <div className="absolute bottom-10 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:right-auto md:w-auto z-20 flex justify-center pointer-events-none">
          <StarBorder color="#10b981" speed="4s" className="p-[1px] pointer-events-auto rounded-full">
            <AnimatedButton onClick={handleStartNavigation} className="h-12 px-8 bg-black/80 text-white backdrop-blur-md border border-white/20 font-black text-base hover:bg-black/90 rounded-full shadow-2xl">
              Start Navigating
            </AnimatedButton>
          </StarBorder>
        </div>
      )}

      {/* ADMIN MOCK NOTIFICATION: Join Request */}
      {joinRequest && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 w-full max-w-sm">
          <div className="rounded-xl border border-purple-500/30 bg-[#0a0a0a]/90 backdrop-blur-xl p-4 shadow-2xl flex flex-col">
            <p className="text-white text-sm mb-3">🔔 <strong>Join Request:</strong> {joinRequest}</p>
            <div className="flex space-x-3">
              <button onClick={() => setJoinRequest(null)} className="flex-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg py-2 text-sm font-bold hover:bg-emerald-500/30">Accept</button>
              <button onClick={() => setJoinRequest(null)} className="flex-1 bg-white/5 text-gray-400 border border-white/10 rounded-lg py-2 text-sm hover:bg-white/10">Decline</button>
            </div>
          </div>
        </div>
      )}

      {/* MEMBERS MODAL */}
      {showMembers && (
        <div className="absolute inset-0 z-50 flex items-start justify-end bg-black/20 backdrop-blur-sm p-4 md:p-6">
          <div className="w-full max-w-sm rounded-2xl border border-white/40 bg-white/60 backdrop-blur-xl shadow-2xl relative flex flex-col max-h-full">
            <div className="p-5 border-b border-black/10 flex items-center justify-between shrink-0">
              <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase flex items-center">
                <Users className="w-5 h-5 mr-2 text-blue-600" /> Riders <span className="ml-2 text-emerald-600 font-bold">{1 + otherRiders.length}/{memberLimit}</span>
              </h2>
              <button onClick={() => setShowMembers(false)} className="text-slate-500 hover:text-slate-900 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-2 overflow-y-auto flex-1">
              {/* Current User */}
              <div className="p-3 mb-2 rounded-xl bg-white/40 border border-white/50 flex items-center space-x-4 shadow-sm">
                <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold shrink-0 overflow-hidden shadow-inner">
                  {user.photoUrl ? (
                    <img src={user.photoUrl} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    user.name ? user.name.substring(0, 1) : "U"
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{user.name} {user.lastName}</p>
                  <p className="text-[11px] text-slate-600 truncate">🏍 {user.bikeModel || "Unknown Bike"}</p>
                  {user.isAdmin && <span className="inline-block px-1.5 py-0.5 rounded-sm bg-purple-100 text-purple-700 border border-purple-200 text-[9px] font-bold mt-1 uppercase shadow-sm">Admin</span>}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold text-emerald-600">{distance}</p>
                  <p className="text-[10px] text-slate-500 font-medium">to {isRoutingToBreak ? "Break" : "Dest"}</p>
                </div>
              </div>

              {/* Other Real-time Riders */}
              {otherRiders.map((rider, idx) => {
                let distToMe = "--";
                if (localLocation && rider.lat && rider.lng) {
                   // Calculate distance in km
                   const miles = calculateDistance(localLocation.lat, localLocation.lng, rider.lat, rider.lng);
                   const km = miles * 1.60934;
                   distToMe = km.toFixed(1) + " km";
                }
                return (
                  <div key={rider.id || idx} className="p-3 mb-2 rounded-xl bg-purple-50 border border-purple-200/50 flex items-center space-x-4 animate-in fade-in duration-300 shadow-sm">
                    <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center text-white font-bold shrink-0 overflow-hidden shadow-inner">
                      {rider.photoUrl ? (
                        <img src={rider.photoUrl} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        rider.name ? rider.name.substring(0, 1) : "R"
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{rider.name} {rider.lastName}</p>
                      <p className="text-[11px] text-slate-600 truncate">🏍 {rider.bikeModel || "Unknown Bike"}</p>
                      <span className="inline-flex items-center space-x-1 mt-1 bg-white px-1.5 py-0.5 rounded-full border border-black/5 shadow-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span className="text-[9px] text-slate-700 font-bold uppercase">Live</span>
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-purple-600">{distToMe}</p>
                      <p className="text-[10px] text-slate-500 font-medium">from you</p>
                    </div>
                  </div>
                );
              })}

              {otherRiders.length === 0 && (
                <div className="p-3 rounded-xl border border-dashed border-black/20 bg-white/30 flex items-center space-x-4 opacity-70">
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center shrink-0 border border-black/5"></div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-600">Waiting for riders...</p>
                  </div>
                </div>
              )}
            </div>

            {/* Share / Invite Section embedded at the bottom */}
            <div className="p-4 border-t border-black/10 bg-white/20 rounded-b-2xl shrink-0">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Invite Riders</h3>
              <div className="flex items-center space-x-4">
                <div 
                  onClick={() => setShowExpandedQr(true)}
                  className="w-16 h-16 bg-white rounded-md flex items-center justify-center shrink-0 cursor-pointer hover:bg-gray-50 transition-colors border border-black/10 shadow-sm"
                  title="Click to expand QR code"
                >
                  <QrCode className="w-12 h-12 text-black" />
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <p className="text-[10px] text-slate-600 leading-tight">Have your friends scan this QR code or share the link below to sync routes.</p>
                  <div className="flex items-center space-x-2 bg-white/50 border border-black/10 rounded-md p-1.5 shadow-inner">
                    <input type="text" readOnly value={typeof window !== 'undefined' ? window.location.href : ''} className="flex-1 min-w-0 bg-transparent text-slate-700 font-medium text-[10px] outline-none px-1" />
                    <button 
                      onClick={() => {
                        const url = typeof window !== 'undefined' ? window.location.href : '';
                        const text = `Hey! I'm heading to ${destination}. Join my live ride on RideFlow here: ${url}`;
                        window.open(`whatsapp://send?text=${encodeURIComponent(text)}`);
                      }} 
                      className="shrink-0 bg-green-100 hover:bg-green-200 text-green-700 px-3 py-1 rounded text-[10px] font-bold transition-colors flex items-center space-x-1 border border-green-200 shadow-sm"
                      title="Share via WhatsApp"
                    >
                      <Share2 className="w-3 h-3" />
                      <span>WhatsApp</span>
                    </button>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(typeof window !== 'undefined' ? window.location.href : '');
                        alert("Link Copied!");
                      }} 
                      className="shrink-0 bg-slate-200 hover:bg-slate-300 text-slate-700 px-2 py-1 rounded text-[10px] font-bold transition-colors border border-slate-300 shadow-sm"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* End Ride Button */}
            {isNavigating && (
              <div className="p-4 border-t border-black/10 bg-white/40 rounded-b-2xl shrink-0 flex justify-center">
                <button 
                  onClick={handleEndRide}
                  className="w-full flex items-center justify-center space-x-2 bg-red-100 hover:bg-red-200 text-red-600 border border-red-200 rounded-xl py-3 text-sm font-bold transition-all shadow-sm"
                >
                  <PhoneOff className="w-4 h-4" />
                  <span>End Ride</span>
                </button>
              </div>
            )}

          </div>
        </div>
      )}

      {/* EXPANDED QR CODE MODAL */}
      {showExpandedQr && (
        <div 
          className="absolute inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md px-4"
          onClick={() => setShowExpandedQr(false)} // Close on background tap
        >
          <div 
            className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-2xl relative flex flex-col items-center animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()} // Prevent closing when tapping inside the modal
          >
            <button 
              onClick={() => setShowExpandedQr(false)} 
              className="absolute top-4 right-4 text-gray-400 hover:text-black transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <h2 className="text-2xl font-black text-black mb-2 text-center tracking-tight">Scan to Join</h2>
            <p className="text-gray-500 text-sm text-center mb-8 font-medium">Point your camera at the screen to instantly sync routes.</p>
            <div className="w-56 h-56 md:w-64 md:h-64 bg-black rounded-2xl flex items-center justify-center text-white p-4">
               <QrCode className="w-full h-full text-white" />
            </div>
            <p className="mt-8 text-xs font-bold text-gray-400 uppercase tracking-widest">RideFlow Secure Share</p>
          </div>
        </div>
      )}

      {/* SOS / BREAK MENU */}
      {showSosMenu && (
        <div 
          className="absolute inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm px-4"
          onClick={() => setShowSosMenu(false)}
        >
          <div 
            className="w-full max-w-sm rounded-3xl bg-white/70 backdrop-blur-xl border border-white/50 p-6 shadow-2xl relative flex flex-col animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={() => setShowSosMenu(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-800 transition-colors">
              <X className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-black text-slate-900 mb-6 tracking-tight flex items-center">
              <AlertTriangle className="w-6 h-6 text-red-500 mr-2" /> Actions
            </h2>
            
            <div className="space-y-3">
              <button 
                onClick={() => {
                  setShowSosMenu(false);
                  setIsSelectingBreakPoint(true);
                }}
                className="w-full flex items-center p-4 bg-orange-100 hover:bg-orange-200 rounded-2xl transition-colors border border-orange-200 shadow-sm"
              >
                <div className="w-12 h-12 rounded-xl bg-orange-500 flex items-center justify-center text-2xl shrink-0 mr-4 shadow-inner">☕</div>
                <div className="text-left">
                  <p className="font-bold text-orange-900">Take a Break</p>
                  <p className="text-xs text-orange-700 font-medium">Select a hotel or cafe on the map</p>
                </div>
              </button>

              <button 
                onClick={() => {
                  setShowSosMenu(false);
                  setShowSos(true); // Open actual emergency SOS
                }}
                className="w-full flex items-center p-4 bg-red-100 hover:bg-red-200 rounded-2xl transition-colors border border-red-200 shadow-sm"
              >
                <div className="w-12 h-12 rounded-xl bg-red-500 flex items-center justify-center text-2xl shrink-0 mr-4 shadow-inner">🚨</div>
                <div className="text-left">
                  <p className="font-bold text-red-900">Emergency SOS</p>
                  <p className="text-xs text-red-700 font-medium">Alert group immediately</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
