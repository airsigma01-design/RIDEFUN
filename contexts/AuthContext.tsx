"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface User {
  id: string;
  email: string;
  name?: string;
  lastName?: string;
  personalPhone?: string;
  emergencyPhone?: string;
  bikeModel?: string;
  photoUrl?: string;
  isAdmin?: boolean;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (
    email: string, 
    password: string, 
    name: string,
    lastName: string,
    personalPhone: string,
    emergencyPhone: string,
    bikeModel: string
  ) => Promise<boolean>;
  updateProfile: (updates: Partial<User>) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Check local storage on mount to maintain session
    const storedUser = localStorage.getItem("rideflow_auth");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    // Simple route protection
    if (!isLoading && !user && pathname !== "/login" && pathname !== "/") {
      router.push("/login");
    }
  }, [user, isLoading, pathname, router]);

  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      // Check custom_users table
      const { data, error } = await supabase
        .from('custom_users')
        .select('*')
        .eq('email', email)
        .single();

      if (error || !data) {
        console.error("User not found or query error", error);
        setIsLoading(false);
        return false;
      }

      // Very simple custom password check (as requested for table-only logic)
      if (data.password === password) {
        const sessionUser: User = {
          id: data.id,
          email: data.email,
          name: data.name,
          lastName: data.last_name,
          personalPhone: data.phone,
          emergencyPhone: data.emergency_phone,
          bikeModel: data.bike_model,
          photoUrl: data.photo_url,
          isAdmin: data.is_admin
        };
        setUser(sessionUser);
        localStorage.setItem("rideflow_auth", JSON.stringify(sessionUser));
        setIsLoading(false);
        return true;
      }

      setIsLoading(false);
      return false;
    } catch (e) {
      console.error(e);
      setIsLoading(false);
      return false;
    }
  };

  const register = async (
    email: string, 
    password: string, 
    name: string,
    lastName: string,
    personalPhone: string,
    emergencyPhone: string,
    bikeModel: string
  ): Promise<boolean> => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('custom_users')
        .insert([
          {
            email,
            password,
            name,
            last_name: lastName,
            phone: personalPhone,
            emergency_phone: emergencyPhone,
            bike_model: bikeModel,
            is_admin: false
          }
        ])
        .select()
        .single();

      if (error || !data) {
        console.error("Registration error", error);
        setIsLoading(false);
        return false;
      }

      const sessionUser: User = {
        id: data.id,
        email: data.email,
        name: data.name,
        lastName: data.last_name,
        personalPhone: data.phone,
        emergencyPhone: data.emergency_phone,
        bikeModel: data.bike_model,
        photoUrl: data.photo_url,
        isAdmin: data.is_admin
      };

      setUser(sessionUser);
      localStorage.setItem("rideflow_auth", JSON.stringify(sessionUser));
      setIsLoading(false);
      return true;
    } catch (e) {
      console.error(e);
      setIsLoading(false);
      return false;
    }
  };

  const updateProfile = async (updates: Partial<User>): Promise<boolean> => {
    if (!user) return false;
    
    try {
      // Map JS properties to DB columns
      const dbUpdates: any = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.lastName !== undefined) dbUpdates.last_name = updates.lastName;
      if (updates.personalPhone !== undefined) dbUpdates.phone = updates.personalPhone;
      if (updates.emergencyPhone !== undefined) dbUpdates.emergency_phone = updates.emergencyPhone;
      if (updates.bikeModel !== undefined) dbUpdates.bike_model = updates.bikeModel;
      if (updates.photoUrl !== undefined) dbUpdates.photo_url = updates.photoUrl;

      const { error } = await supabase
        .from('custom_users')
        .update(dbUpdates)
        .eq('id', user.id);

      if (error) {
        console.error("Update error", error);
        return false;
      }

      const updatedUser = { ...user, ...updates };
      setUser(updatedUser);
      localStorage.setItem("rideflow_auth", JSON.stringify(updatedUser));
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("rideflow_auth");
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, updateProfile, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
