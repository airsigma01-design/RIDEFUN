"use client";

import { Navbar } from "@/components/layouts/Navbar";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { AnimatedButton } from "@/components/ui/animated-button";
import { Map, Users, Plus, QrCode, Trash2, Navigation2 } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

export default function DashboardPage() {
  const [joinCode, setJoinCode] = useState("");
  const [myRides, setMyRides] = useState<any[]>([]);
  const [loadingRides, setLoadingRides] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user?.id) {
      fetchRides();
    }
  }, [user]);

  const fetchRides = async () => {
    try {
      const { data, error } = await supabase
        .from('rides')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error(error);
      } else {
        setMyRides(data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingRides(false);
    }
  };

  const handleDeleteRide = async (rideId: string) => {
    if (!confirm("Are you sure you want to delete this ride?")) return;
    try {
      const { error } = await supabase
        .from('rides')
        .delete()
        .eq('id', rideId);
      
      if (error) {
        alert("Failed to delete ride.");
        console.error(error);
      } else {
        setMyRides(prev => prev.filter(r => r.id !== rideId));
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <>
      <Navbar />
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        <div className="mb-12">
          <h1 className="text-2xl font-bold tracking-tight mb-2">Welcome Back</h1>
          <p className="text-gray-400">Manage your rides or join an existing one.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Create Ride Card */}
          <SpotlightCard className="flex flex-col items-start text-left p-8 border border-white/5 bg-white/[0.02]">
            <div className="rounded-full bg-emerald-500/10 p-3 ring-1 ring-emerald-500/20 mb-6">
              <Map className="h-5 w-5 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold mb-3">Create Ride</h2>
            <p className="text-gray-400 mb-8 flex-1">
              Start a new group ride. Set a destination, invite friends, and navigate together in real-time.
            </p>
            
            <Link href="/ride/create" className="w-full">
              <AnimatedButton className="w-full h-12 bg-white text-black hover:bg-gray-200">
                <Plus className="mr-2 h-5 w-5" /> Start New Ride
              </AnimatedButton>
            </Link>
          </SpotlightCard>

          {/* Join Ride Card */}
          <SpotlightCard className="flex flex-col items-start text-left p-8 border border-white/5 bg-white/[0.02]">
            <div className="rounded-full bg-blue-500/10 p-3 ring-1 ring-blue-500/20 mb-6">
              <Users className="h-5 w-5 text-blue-400" />
            </div>
            <h2 className="text-xl font-bold mb-3">Join Ride</h2>
            <p className="text-gray-400 mb-8 flex-1">
              Got an invite? Enter the ride code or scan a QR code to sync up with your group instantly.
            </p>
            
            <div className="w-full space-y-4">
              <div className="flex space-x-2">
                <Input
                  placeholder="Enter Ride Code"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  className="h-12 bg-black/50 border-white/10 text-white placeholder:text-gray-600 focus-visible:ring-blue-500"
                />
                <Link href={joinCode ? `/ride/${joinCode}` : "#"} className={joinCode ? "" : "pointer-events-none opacity-50"}>
                  <AnimatedButton className="h-12 bg-white text-black hover:bg-gray-200">
                    Join
                  </AnimatedButton>
                </Link>
              </div>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-[#09090b] px-2 text-gray-500">Or</span>
                </div>
              </div>
              <AnimatedButton variant="outline" className="w-full h-12 bg-transparent border-white/10 text-white hover:bg-white/5">
                <QrCode className="mr-2 h-5 w-5" /> Scan QR Code
              </AnimatedButton>
            </div>
          </SpotlightCard>
        </div>

        {/* MY RIDES SECTION */}
        <div className="mt-16">
          <h2 className="text-xl font-bold tracking-tight mb-6">My Ride History</h2>
          
          {loadingRides ? (
            <p className="text-gray-500">Loading rides...</p>
          ) : myRides.length === 0 ? (
            <div className="p-8 border border-white/5 bg-white/[0.02] rounded-2xl text-center">
              <p className="text-gray-400">You haven't created any rides yet.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myRides.map((ride) => (
                <div key={ride.id} className="p-5 border border-white/5 bg-white/[0.02] rounded-2xl flex flex-col hover:bg-white/[0.04] transition-colors relative group">
                  <div className="flex justify-between items-start mb-3">
                    <div className="bg-emerald-500/10 p-2 rounded-lg text-emerald-400">
                      <Navigation2 className="w-5 h-5" />
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider ${ride.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-800 text-gray-400'}`}>
                      {ride.status}
                    </span>
                  </div>
                  
                  <h3 className="font-bold text-white mb-1 line-clamp-1">{ride.destination_name}</h3>
                  <p className="text-xs text-gray-500 mb-4 flex-1">
                    Created {new Date(ride.created_at).toLocaleDateString()} • {ride.privacy}
                  </p>
                  
                  <div className="flex space-x-2 mt-auto">
                    <Link href={`/ride/${ride.id}?destName=${encodeURIComponent(ride.destination_name)}&destLat=${ride.dest_lat}&destLng=${ride.dest_lng}&limit=${ride.member_limit}&privacy=${ride.privacy}`} className="flex-1">
                      <AnimatedButton className="w-full h-9 bg-white/10 text-white text-xs hover:bg-white/20">
                        View Ride
                      </AnimatedButton>
                    </Link>
                    <button 
                      onClick={() => handleDeleteRide(ride.id)}
                      className="w-9 h-9 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500/20 transition-colors"
                      title="Delete Ride"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
