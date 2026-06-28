"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { AnimatedButton } from "@/components/ui/animated-button";
import { ShinyText } from "@/components/ui/shiny-text";
import { MapPin, User, Settings, LogOut, ChevronDown } from "lucide-react";
import { EditProfileModal } from "@/components/features/EditProfileModal";

export function Navbar() {
  const { user, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 flex h-20 items-center justify-between px-6 border-b border-white/10 bg-black/40 backdrop-blur-md">
      <Link href="/" className="flex items-center space-x-2">
        <div className="rounded-full bg-white/10 p-2 ring-1 ring-white/20">
          <MapPin className="h-5 w-5 text-emerald-400" />
        </div>
        <span className="text-xl font-bold tracking-tight">
          <ShinyText text="RideFlow" />
        </span>
      </Link>

      <div className="hidden md:flex items-center space-x-8 text-sm font-medium text-gray-300">
        <Link href="#features" className="hover:text-white transition-colors">Features</Link>
        <Link href="#pricing" className="hover:text-white transition-colors">Pricing</Link>
        <Link href="#about" className="hover:text-white transition-colors">About</Link>
      </div>

      <div className="flex items-center space-x-4">
        {user ? (
          <div className="relative">
            <button 
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center space-x-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full py-1.5 pl-1.5 pr-3 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm overflow-hidden shrink-0">
                {user.photoUrl ? (
                  <img src={user.photoUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  user.name ? user.name.substring(0, 1).toUpperCase() : <User className="w-4 h-4" />
                )}
              </div>
              <span className="text-sm font-medium text-white max-w-[100px] truncate hidden sm:block">
                {user.name}
              </span>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>

            {/* Dropdown Menu */}
            {showDropdown && (
              <div className="absolute right-0 mt-2 w-48 rounded-xl border border-white/10 bg-[#0a0a0a] shadow-xl overflow-hidden backdrop-blur-xl z-50">
                <div className="p-3 border-b border-white/5">
                  <p className="text-sm font-bold text-white truncate">{user.name} {user.lastName}</p>
                  <p className="text-xs text-gray-400 truncate">{user.email}</p>
                </div>
                <div className="p-1">
                  <Link href="/dashboard" onClick={() => setShowDropdown(false)} className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                    <MapPin className="w-4 h-4" /> <span>Dashboard</span>
                  </Link>
                  <button onClick={() => { setShowDropdown(false); setShowProfileModal(true); }} className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                    <Settings className="w-4 h-4" /> <span>Edit Profile</span>
                  </button>
                  <button onClick={() => { setShowDropdown(false); logout(); }} className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors">
                    <LogOut className="w-4 h-4" /> <span>Logout</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            <Link href="/login" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">
              Login
            </Link>
            <Link href="/login">
              <AnimatedButton size="sm">Get Started</AnimatedButton>
            </Link>
          </>
        )}
      </div>
    </nav>
    <EditProfileModal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} />
    </>
  );
}
