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
  const [showMembers, setShowMembers] = useState(false);
  const [showExpandedQr, setShowExpandedQr] = useState(false);
  const [joinRequest, setJoinRequest] = useState<string | null>(null);

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
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log("Connected to Realtime Presence");
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
    
    const destLat = destLatStr ? parseFloat(destLatStr) : 37.8199;
    const destLng = destLngStr ? parseFloat(destLngStr) : -122.4783;

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

    const validOtherRiders = otherRiders.filter(r => r.lat && r.lng);
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
          let routeUrl = `https://api.tomtom.com/routing/1/calculateRoute/${localLocation.lat},${localLocation.lng}`;
          
          // Smart Meetup Point Calculation
          const allRiderLocs = [localLocation, ...validOtherRiders.map(r => ({ lat: r.lat, lng: r.lng }))];
          const meetup = validOtherRiders.length > 0 ? calculateMeetupPoint(allRiderLocs) : null;
          
          let hasMeetupWaypoint = false;
          if (meetup) {
            let maxDist = 0;
            allRiderLocs.forEach(loc => {
               const d = calculateDistance(loc.lat, loc.lng, meetup.lat, meetup.lng);
               if (d > maxDist) maxDist = d;
            });
            // Only use meetup point if riders are reasonably spread out (> 0.5 miles from center)
            if (maxDist > 0.5) {
               routeUrl += `:${meetup.lat},${meetup.lng}`;
               hasMeetupWaypoint = true;
            }
          }
          
          routeUrl += `:${destLat},${destLng}/json?key=${apiKey}&maxAlternatives=2`;
          
          const res = await fetch(routeUrl);
          if (res.ok) {
            const data = await res.json();
            if (data.routes && data.routes.length > 0) {
              setRouteError(null);
              const bestRoute = data.routes[0].summary;
              setEta(Math.round(bestRoute.travelTimeInSeconds / 60) + " mins");
              setDistance((bestRoute.lengthInMeters / 1609.34).toFixed(1) + " mi");
  
              const routeGeoJsons = data.routes.map((r: any) => {
                let allPoints: any[] = [];
                // Combine points across multiple legs (e.g. if we have a meetup waypoint)
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
              
              // Optional: Add a visual marker for the meetup point
              if (hasMeetupWaypoint && meetup) {
                setMapMarkers(prev => [
                  ...prev, 
                  { id: 'meetup', lng: meetup.lng, lat: meetup.lat, color: '#f59e0b', label: "M" }
                ]);
              }
            } else {
              setRouteError("No route found. Try a closer destination.");
            }
          } else {
            setRouteError("Route calculation failed. Destination is likely too far away.");
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
  }, [localLocation, otherRiders, user, destLatStr, destLngStr]);

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

  const handleEndRide = () => {
    if (confirm("Are you sure you want to end this ride?")) {
      setIsNavigating(false);
      if (params?.id) {
        sessionStorage.removeItem(`navigating_${params.id}`);
      }
      router.push("/dashboard");
    }
  };

  if (!user) return null;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      {/* Map layer (Bottom-most) */}
      <div className="absolute inset-0 z-0">
        <TomTomMap 
          center={mapCenter}
          zoom={mapZoom} 
          markers={mapMarkers}
          routes={routes}
          activeRouteIndex={activeRouteIndex}
          onRouteChange={(idx) => setActiveRouteIndex(idx)}
          recenterToggle={recenterToggle}
          isNavigating={isNavigating}
          bearing={mapBearing}
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

      {/* TOP LEFT: Compact Stats Panel */}
      <FadeContent blur={true} duration={1000} delay={0.2} ease="ease-out" initialOpacity={0} className="absolute top-4 left-4 right-16 md:right-auto z-20 pointer-events-none">
        <div className="pointer-events-auto rounded-xl border border-white/10 bg-black/80 px-3 py-2 shadow-2xl backdrop-blur-xl flex items-center space-x-3 md:space-x-6 overflow-hidden">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-0.5">Dest</p>
            <h2 className="text-sm font-bold text-white line-clamp-2 whitespace-normal">{destination}</h2>
          </div>
          <div className="h-6 w-px bg-white/10 shrink-0"></div>
          <div className="flex items-center space-x-1.5 shrink-0">
            <Clock className="w-3.5 h-3.5 text-blue-400 hidden sm:block" />
            <div>
              <p className="text-[10px] text-gray-400 leading-none">ETA</p>
              <p className="text-xs font-semibold text-white leading-tight">{eta}</p>
            </div>
          </div>
          <div className="flex items-center space-x-1.5 shrink-0">
            <Navigation className="w-3.5 h-3.5 text-purple-400 hidden sm:block" />
            <div>
              <p className="text-[10px] text-gray-400 leading-none">Dist</p>
              <p className="text-xs font-semibold text-white leading-tight">{distance}</p>
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
          <div className="rounded-2xl border border-white/10 bg-[#0a0a0a]/95 backdrop-blur-xl shadow-2xl p-4 flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0 border border-blue-500/30">
              <CornerUpLeft className="w-6 h-6 text-blue-400" strokeWidth={3} />
            </div>
            <div>
              <p className="text-2xl font-black text-white tracking-tight leading-none mb-1">250 m</p>
              <p className="text-sm font-medium text-gray-400 leading-tight">Turn left onto <span className="text-gray-200">Sahara Road</span></p>
            </div>
          </div>
        </div>
      )}

      {/* MIDDLE LEFT: Real-time Speedometer */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 z-20 pointer-events-none">
        <div className="pointer-events-auto flex items-center justify-center w-14 h-14 md:w-16 md:h-16 rounded-full bg-black/80 border border-white/10 shadow-[0_0_20px_-5px_rgba(255,255,255,0.2)] backdrop-blur-xl transition-all">
          <div className="text-center">
            <span className="block text-base md:text-lg font-bold text-white leading-none">{speed.split(' ')[0]}</span>
            <span className="block text-[9px] md:text-[10px] text-gray-400 uppercase">mph</span>
          </div>
        </div>
      </div>

      {/* RIGHT CONTROLS: Members, Add, SOS, Cancel */}
      <FadeContent blur={true} duration={1000} delay={0.4} ease="ease-out" initialOpacity={0} className="absolute right-4 top-1/4 md:top-1/2 md:-translate-y-1/2 z-20 pointer-events-none flex flex-col items-end space-y-3">
        {/* Members Count */}
        <button 
          onClick={() => setShowMembers(true)}
          className="pointer-events-auto flex items-center justify-center h-10 px-3 rounded-full bg-black/80 border border-white/10 backdrop-blur-xl space-x-1.5 hover:bg-white/10 transition-all mb-4" 
          title={privacy === "private" ? "Private Ride" : "Public Ride"}
        >
          <Users className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-xs font-bold text-white">{1 + otherRiders.length}/{memberLimit}</span>
        </button>

        {/* Recenter Button */}
        <button 
          onClick={() => setRecenterToggle(Date.now())}
          className="pointer-events-auto flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-full bg-black/80 border border-white/10 text-emerald-400 backdrop-blur-xl transition-all hover:bg-white/10"
          title="Recenter Map (2D)"
        >
          <LocateFixed className="w-4 h-4 md:w-5 md:h-5" />
        </button>

        {/* SOS Button */}
        <button 
          onClick={() => setShowSos(true)}
          className="pointer-events-auto flex h-12 w-12 md:h-14 md:w-14 items-center justify-center rounded-full bg-red-500/20 border border-red-500/30 text-red-500 backdrop-blur-xl transition-all hover:bg-red-500/30 shadow-[0_0_20px_-5px_rgba(239,68,68,0.5)] mt-4"
        >
          <AlertTriangle className="w-5 h-5 md:w-6 md:h-6" />
        </button>

      </FadeContent>

      {/* BOTTOM CENTER: Start Ride Button */}
      {!isNavigating && (
        <div className="absolute bottom-10 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:right-auto md:w-auto z-20 flex justify-center">
          <StarBorder color="#ffffff" speed="4s" className="p-[1px]">
            <AnimatedButton onClick={handleStartNavigation} className="h-12 px-8 bg-white/10 text-white backdrop-blur-xl border border-white/20 font-semibold text-base hover:bg-white/20 rounded-full shadow-lg">
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
        <div className="absolute inset-0 z-50 flex items-start justify-end bg-black/60 backdrop-blur-sm p-4 md:p-6">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0a0a0a] shadow-2xl relative flex flex-col max-h-full">
            <div className="p-5 border-b border-white/5 flex items-center justify-between shrink-0">
              <h2 className="text-xl font-black text-white tracking-tight uppercase flex items-center">
                <Users className="w-5 h-5 mr-2 text-blue-400" /> Riders <span className="ml-2 text-emerald-400 font-bold">{1 + otherRiders.length}/{memberLimit}</span>
              </h2>
              <button onClick={() => setShowMembers(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-2 overflow-y-auto flex-1">
              {/* Current User */}
              <div className="p-3 mb-2 rounded-xl bg-white/5 border border-white/5 flex items-center space-x-4">
                <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold shrink-0 overflow-hidden">
                  {user.photoUrl ? (
                    <img src={user.photoUrl} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    user.name ? user.name.substring(0, 1) : "U"
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{user.name} {user.lastName}</p>
                  <p className="text-[11px] text-gray-400 truncate">🏍 {user.bikeModel || "Unknown Bike"}</p>
                  {user.isAdmin && <span className="inline-block px-1.5 py-0.5 rounded-sm bg-purple-500/20 text-purple-400 text-[9px] font-bold mt-1 uppercase">Admin</span>}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold text-emerald-400">{distance}</p>
                  <p className="text-[10px] text-gray-500">to Dest</p>
                </div>
              </div>

              {/* Other Real-time Riders */}
              {otherRiders.map((rider, idx) => {
                let distToMe = "--";
                if (localLocation && rider.lat && rider.lng) {
                   const miles = calculateDistance(localLocation.lat, localLocation.lng, rider.lat, rider.lng);
                   distToMe = miles.toFixed(1) + " mi";
                }
                return (
                  <div key={rider.id || idx} className="p-3 mb-2 rounded-xl bg-purple-500/5 border border-purple-500/20 flex items-center space-x-4 animate-in fade-in duration-300">
                    <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center text-white font-bold shrink-0 overflow-hidden">
                      {rider.photoUrl ? (
                        <img src={rider.photoUrl} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        rider.name ? rider.name.substring(0, 1) : "R"
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{rider.name} {rider.lastName}</p>
                      <p className="text-[11px] text-gray-400 truncate">🏍 {rider.bikeModel || "Unknown Bike"}</p>
                      <span className="inline-flex items-center space-x-1 mt-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span className="text-[9px] text-emerald-500 font-bold uppercase">Live</span>
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-purple-400">{distToMe}</p>
                      <p className="text-[10px] text-gray-500">from you</p>
                    </div>
                  </div>
                );
              })}

              {otherRiders.length === 0 && (
                <div className="p-3 rounded-xl border border-dashed border-white/10 flex items-center space-x-4 opacity-50">
                  <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center shrink-0"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-400">Waiting for riders...</p>
                  </div>
                </div>
              )}
            </div>

            {/* Share / Invite Section embedded at the bottom */}
            <div className="p-4 border-t border-white/5 bg-white/5 rounded-b-2xl shrink-0">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Invite Riders</h3>
              <div className="flex items-center space-x-4">
                <div 
                  onClick={() => setShowExpandedQr(true)}
                  className="w-16 h-16 bg-white rounded-md flex items-center justify-center shrink-0 cursor-pointer hover:bg-gray-200 transition-colors border border-gray-300"
                  title="Click to expand QR code"
                >
                  <QrCode className="w-12 h-12 text-black" />
                </div>
                <div className="flex-1 space-y-2">
                  <p className="text-[10px] text-gray-400 leading-tight">Have your friends scan this QR code or share the link below to sync routes.</p>
                  <div className="flex items-center space-x-2 bg-black border border-white/10 rounded-md p-1.5">
                    <input type="text" readOnly value={typeof window !== 'undefined' ? window.location.href : ''} className="flex-1 bg-transparent text-gray-400 text-[10px] outline-none px-1" />
                    <button 
                      onClick={() => {
                        const url = typeof window !== 'undefined' ? window.location.href : '';
                        const text = `Hey! I'm heading to ${destination}. Join my live ride on RideFlow here: ${url}`;
                        window.open(`whatsapp://send?text=${encodeURIComponent(text)}`);
                      }} 
                      className="bg-green-500/20 hover:bg-green-500/30 text-green-400 px-3 py-1 rounded text-[10px] font-bold transition-colors flex items-center space-x-1"
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
                      className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 px-2 py-1 rounded text-[10px] font-bold transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* End Ride Button */}
            {isNavigating && (
              <div className="p-4 border-t border-white/5 bg-black/50 rounded-b-2xl shrink-0 flex justify-center">
                <button 
                  onClick={handleEndRide}
                  className="w-full flex items-center justify-center space-x-2 bg-red-500/20 hover:bg-red-500/30 text-red-500 border border-red-500/30 rounded-xl py-3 text-sm font-bold transition-all"
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
    </div>
  );
}
