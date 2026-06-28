"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { ShinyText } from "@/components/ui/shiny-text";
import { AnimatedButton } from "@/components/ui/animated-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { MapPin } from "lucide-react";

export default function LoginPage() {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [personalPhone, setPersonalPhone] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [bikeModel, setBikeModel] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login, register, isLoading } = useAuth();
  const router = useRouter();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    let success = false;
    
    if (isLoginMode) {
      success = await login(email, password);
    } else {
      success = await register(
        email, 
        password, 
        firstName, 
        lastName, 
        personalPhone, 
        emergencyPhone, 
        bikeModel
      );
    }

    if (success) {
      router.push("/dashboard");
    } else {
      setError(isLoginMode ? "Invalid email or password" : "User already exists or registration failed");
    }
  };

  return (
    <AuroraBackground>
      <div className="z-10 w-full max-w-md px-4">
        <SpotlightCard className="flex-col items-stretch text-left">
          <div className="mb-8 flex flex-col items-center justify-center space-y-4 text-center">
            <div className="rounded-full bg-white/10 p-2 ring-1 ring-white/20">
              <MapPin className="h-4 w-4 text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              {isLoginMode ? "Welcome Back to " : "Join "}
              <ShinyText text="RideFlow" />
            </h1>
            <p className="text-sm text-gray-400">
              {isLoginMode ? "Sign in to manage and join real-time group rides" : "Create an account to start riding with your group"}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-6">
            {!isLoginMode && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="text-gray-300">First Name</Label>
                    <Input
                      id="firstName"
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="bg-black/50 border-white/20 text-white focus-visible:ring-emerald-500"
                      required={!isLoginMode}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="text-gray-300">Last Name</Label>
                    <Input
                      id="lastName"
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="bg-black/50 border-white/20 text-white focus-visible:ring-emerald-500"
                      required={!isLoginMode}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="personalPhone" className="text-gray-300">Personal Phone</Label>
                    <Input
                      id="personalPhone"
                      type="tel"
                      value={personalPhone}
                      onChange={(e) => setPersonalPhone(e.target.value)}
                      className="bg-black/50 border-white/20 text-white focus-visible:ring-emerald-500"
                      required={!isLoginMode}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emergencyPhone" className="text-gray-300">Emergency Phone</Label>
                    <Input
                      id="emergencyPhone"
                      type="tel"
                      value={emergencyPhone}
                      onChange={(e) => setEmergencyPhone(e.target.value)}
                      className="bg-black/50 border-white/20 text-white focus-visible:ring-emerald-500"
                      required={!isLoginMode}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bikeModel" className="text-gray-300">What bike are you riding?</Label>
                  <Input
                    id="bikeModel"
                    type="text"
                    placeholder="e.g. Royal Enfield Classic 350"
                    value={bikeModel}
                    onChange={(e) => setBikeModel(e.target.value)}
                    className="bg-black/50 border-white/20 text-white placeholder:text-gray-600 focus-visible:ring-emerald-500"
                    required={!isLoginMode}
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-300">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-black/50 border-white/20 text-white placeholder:text-gray-500 focus-visible:ring-emerald-500"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-300">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-black/50 border-white/20 text-white placeholder:text-gray-500 focus-visible:ring-emerald-500"
                required
              />
            </div>

            {error && (
              <div className="text-sm text-red-400">
                {error}
              </div>
            )}

            <AnimatedButton
              type="submit"
              disabled={isLoading}
              className="w-full bg-white text-black hover:bg-gray-200"
            >
              {isLoading ? "Processing..." : isLoginMode ? "Sign In" : "Create Account"}
            </AnimatedButton>

            <div className="text-center mt-4">
              <button 
                type="button" 
                onClick={() => {
                  setIsLoginMode(!isLoginMode);
                  setError("");
                }}
                className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                {isLoginMode ? "Need an account? Register here" : "Already have an account? Sign in"}
              </button>
            </div>
          </form>
        </SpotlightCard>
      </div>
    </AuroraBackground>
  );
}
