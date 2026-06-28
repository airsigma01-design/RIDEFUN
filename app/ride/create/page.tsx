"use client";

import { useState, useEffect, useRef } from "react";
import { Navbar } from "@/components/layouts/Navbar";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { AnimatedButton } from "@/components/ui/animated-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Navigation2, Search, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

interface Suggestion {
  id: string;
  address: {
    freeformAddress: string;
  };
  position: {
    lat: number;
    lon: number;
  };
}

export default function CreateRidePage() {
  const [rideName, setRideName] = useState("");
  const [destination, setDestination] = useState("");
  const [memberLimit, setMemberLimit] = useState("4");
  const [privacy, setPrivacy] = useState<"public" | "private">("public");
  const [selectedCoords, setSelectedCoords] = useState<{lat: number, lon: number} | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const router = useRouter();
  const { user } = useAuth();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch suggestions from TomTom API
  useEffect(() => {
    if (!destination || destination.length < 3) {
      setSuggestions([]);
      return;
    }

    // Only search if the user hasn't just selected a suggestion (we can assume this if suggestions are hidden)
    if (!showSuggestions && suggestions.length > 0) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const apiKey = process.env.NEXT_PUBLIC_TOMTOM_API_KEY;
        const res = await fetch(`https://api.tomtom.com/search/2/search/${encodeURIComponent(destination)}.json?key=${apiKey}&limit=5`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data.results || []);
          setShowSuggestions(true);
        }
      } catch (err) {
        console.error("Error fetching TomTom suggestions:", err);
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [destination]);

  const handleSelectSuggestion = (suggestion: Suggestion) => {
    setDestination(suggestion.address.freeformAddress);
    setSelectedCoords(suggestion.position);
    setShowSuggestions(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    if (!user) {
      alert("Please login first.");
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.from('rides').insert([{
        user_id: user.id,
        destination_name: destination,
        dest_lat: selectedCoords?.lat || 0,
        dest_lng: selectedCoords?.lon || 0,
        member_limit: parseInt(memberLimit) || 4,
        privacy: privacy,
        status: 'active'
      }]).select().single();

      if (error || !data) {
        console.error("Error creating ride", error);
        alert("Failed to create ride.");
        setIsLoading(false);
        return;
      }

      const rideId = data.id;
      
      const query = new URLSearchParams();
      query.set('limit', memberLimit);
      query.set('privacy', privacy);
      if (selectedCoords) {
        query.set('destLat', selectedCoords.lat.toString());
        query.set('destLng', selectedCoords.lon.toString());
        query.set('destName', destination);
      }
      
      router.push(`/ride/${rideId}?${query.toString()}`);
    } catch (err) {
      console.error(err);
      setIsLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="container mx-auto px-4 py-20 max-w-2xl">
        <SpotlightCard className="flex flex-col items-stretch text-left p-8 md:p-12 border border-white/5 bg-white/[0.02]">
          <div className="mb-8 flex flex-col items-center justify-center text-center">
            <div className="rounded-full bg-emerald-500/10 p-3 ring-1 ring-emerald-500/20 mb-4">
              <Navigation2 className="h-5 w-5 text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight mb-2">Create New Ride</h1>
            <p className="text-gray-400 text-sm">Set up your journey and invite others.</p>
          </div>

          <form onSubmit={handleCreate} className="space-y-6 w-full">
            <div className="space-y-2">
              <Label htmlFor="rideName" className="text-gray-300">Ride Name</Label>
              <Input
                id="rideName"
                value={rideName}
                onChange={(e) => setRideName(e.target.value)}
                placeholder="e.g. Weekend Coastal Cruise"
                className="h-12 bg-black/50 border-white/20 text-white placeholder:text-gray-600 focus-visible:ring-emerald-500"
                required
              />
            </div>

            <div className="space-y-2 relative" ref={dropdownRef}>
              <Label htmlFor="destination" className="text-gray-300">Destination</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                <Input
                  id="destination"
                  value={destination}
                  onChange={(e) => {
                    setDestination(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => {
                    if (suggestions.length > 0) setShowSuggestions(true);
                  }}
                  placeholder="Search destination..."
                  className="h-12 pl-10 pr-10 bg-black/50 border-white/20 text-white placeholder:text-gray-600 focus-visible:ring-emerald-500"
                  required
                  autoComplete="off"
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500 animate-spin" />
                )}
              </div>
              
              {/* Autocomplete Dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-2 rounded-xl border border-white/10 bg-[#0a0a0a] shadow-xl overflow-hidden backdrop-blur-xl">
                  <ul className="max-h-60 overflow-auto">
                    {suggestions.map((suggestion) => (
                      <li
                        key={suggestion.id}
                        onClick={() => handleSelectSuggestion(suggestion)}
                        className="px-4 py-3 flex items-start space-x-3 cursor-pointer hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                      >
                        <Search className="w-4 h-4 text-emerald-500 mt-1 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-white">{suggestion.address.freeformAddress}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="members" className="text-gray-300">Member Limit</Label>
              <Input
                id="members"
                type="number"
                min="1"
                max="100"
                value={memberLimit}
                onChange={(e) => setMemberLimit(e.target.value)}
                placeholder="How many people are coming?"
                className="h-12 bg-black/50 border-white/20 text-white placeholder:text-gray-600 focus-visible:ring-emerald-500"
                required
              />
            </div>

            <div className="space-y-3 pt-2">
              <Label className="text-gray-300">Ride Privacy</Label>
              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => setPrivacy("public")}
                  className={`flex-1 h-12 rounded-xl border ${privacy === "public" ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400" : "bg-black/50 border-white/10 text-gray-400"} transition-all`}
                >
                  Public
                </button>
                <button
                  type="button"
                  onClick={() => setPrivacy("private")}
                  className={`flex-1 h-12 rounded-xl border ${privacy === "private" ? "bg-purple-500/20 border-purple-500/50 text-purple-400" : "bg-black/50 border-white/10 text-gray-400"} transition-all`}
                >
                  Private (Approval Req)
                </button>
              </div>
            </div>

            <AnimatedButton
              type="submit"
              disabled={isLoading || !destination}
              className="w-full h-12 bg-emerald-500 text-black font-bold text-base hover:bg-emerald-400 mt-4 disabled:opacity-50"
            >
              {isLoading ? "Creating..." : "Start Ride"}
            </AnimatedButton>
          </form>
        </SpotlightCard>
      </div>
    </>
  );
}
