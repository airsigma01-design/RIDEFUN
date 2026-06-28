"use client";

import { useState, useRef, useEffect } from "react";
import { X, Upload, Camera, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AnimatedButton } from "@/components/ui/animated-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function EditProfileModal({ isOpen, onClose }: EditProfileModalProps) {
  const { user, updateProfile } = useAuth();
  
  const [firstName, setFirstName] = useState(user?.name || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const [bikeModel, setBikeModel] = useState(user?.bikeModel || "");
  const [personalPhone, setPersonalPhone] = useState(user?.personalPhone || "");
  const [emergencyPhone, setEmergencyPhone] = useState(user?.emergencyPhone || "");
  const [photoUrl, setPhotoUrl] = useState<string | null>(user?.photoUrl || null);
  
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setFirstName(user.name || "");
      setLastName(user.lastName || "");
      setBikeModel(user.bikeModel || "");
      setPersonalPhone(user.personalPhone || "");
      setEmergencyPhone(user.emergencyPhone || "");
      setPhotoUrl(user.photoUrl || null);
    }
  }, [user, isOpen]);

  if (!isOpen) return null;

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 256;
        const MAX_HEIGHT = 256;
        let width = img.width;
        let height = img.height;

        const size = Math.min(width, height);
        const offsetX = (width - size) / 2;
        const offsetY = (height - size) / 2;

        canvas.width = MAX_WIDTH;
        canvas.height = MAX_HEIGHT;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, offsetX, offsetY, size, size, 0, 0, MAX_WIDTH, MAX_HEIGHT);
          const compressedBase64 = canvas.toDataURL("image/jpeg", 0.7);
          setPhotoUrl(compressedBase64);
        }
      };
      if (event.target?.result) {
        img.src = event.target.result as string;
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    await new Promise(res => setTimeout(res, 600));

    updateProfile({
      name: firstName,
      lastName,
      bikeModel,
      personalPhone,
      emergencyPhone,
      ...(photoUrl ? { photoUrl } : {})
    });
    
    setIsSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4 py-10">
        <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0a0a0a]/90 backdrop-blur-xl shadow-[0_0_40px_-10px_rgba(255,255,255,0.1)] relative flex flex-col">
        
        <div className="p-5 border-b border-white/5 flex items-center justify-between shrink-0">
          <h2 className="text-xl font-bold text-white">Edit Profile</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <form id="profile-form" onSubmit={handleSave} className="space-y-6">
            
            <div className="flex flex-col items-center justify-center space-y-4">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="relative w-28 h-28 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center overflow-hidden cursor-pointer hover:border-emerald-500/50 transition-colors group"
              >
                {photoUrl ? (
                  <img src={photoUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="w-8 h-8 text-gray-400 group-hover:text-white transition-colors animate-pulse" />
                )}
                
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Upload className="w-6 h-6 text-white" />
                </div>
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handlePhotoUpload} 
                accept="image/*" 
                className="hidden" 
              />
              <p className="text-xs text-gray-400 text-center">Click to upload photo<br/>(Will be displayed on map)</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName" className="text-gray-300">First Name</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="bg-black/50 border-white/10 text-white focus-visible:ring-emerald-500 h-11"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName" className="text-gray-300">Last Name</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="bg-black/50 border-white/10 text-white focus-visible:ring-emerald-500 h-11"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bikeModel" className="text-gray-300">Bike Model</Label>
              <Input
                id="bikeModel"
                value={bikeModel}
                onChange={(e) => setBikeModel(e.target.value)}
                className="bg-black/50 border-white/10 text-white focus-visible:ring-emerald-500 h-11"
                placeholder="e.g. Kawasaki Ninja"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="personalPhone" className="text-gray-300">Personal Phone</Label>
                <Input
                  id="personalPhone"
                  type="tel"
                  value={personalPhone}
                  onChange={(e) => setPersonalPhone(e.target.value)}
                  className="bg-black/50 border-white/10 text-white focus-visible:ring-emerald-500 h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emergencyPhone" className="text-gray-300">Emergency Phone</Label>
                <Input
                  id="emergencyPhone"
                  type="tel"
                  value={emergencyPhone}
                  onChange={(e) => setEmergencyPhone(e.target.value)}
                  className="bg-black/50 border-white/10 text-white focus-visible:ring-emerald-500 h-11"
                />
              </div>
            </div>
            
          </form>
        </div>

        <div className="p-5 border-t border-white/5 shrink-0">
          <AnimatedButton 
            type="submit" 
            form="profile-form" 
            disabled={isSaving}
            className="w-full bg-white/10 text-white font-bold h-12 hover:bg-white/20 border border-white/20 backdrop-blur-md rounded-xl transition-all shadow-lg"
          >
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Save Profile"}
          </AnimatedButton>
        </div>

        </div>

      </div>
    </div>
  );
}
