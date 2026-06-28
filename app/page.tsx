"use client";

import { AuroraBackground } from "@/components/ui/aurora-background";
import { ShinyText } from "@/components/ui/shiny-text";
import { AnimatedButton } from "@/components/ui/animated-button";
import { Navbar } from "@/components/layouts/Navbar";
import FadeContent from "@/components/ui/FadeContent";
import StarBorder from "@/components/ui/StarBorder";
import SideRays from "@/components/ui/SideRays";
import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Map } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen text-white relative overflow-hidden">
      {/* Background Image Layer */}
      <div className="absolute inset-0 z-0">
        {/* Desktop Background */}
        <div className="hidden md:block absolute inset-0">
          <Image 
            src="/Baground.png"
            alt="RideFlow Desktop Background"
            fill
            priority
            className="object-cover object-center"
            sizes="100vw"
            quality={100}
          />
        </div>
        {/* Mobile Background */}
        <div className="block md:hidden absolute inset-0">
          <Image 
            src="/PhoneBg.png"
            alt="RideFlow Mobile Background"
            fill
            priority
            className="object-cover object-center"
            sizes="100vw"
            quality={100}
          />
        </div>
        {/* Subtle dark overlay for premium feel and text readability */}
        <div className="absolute inset-0 bg-black/60" />
      </div>

      <div className="absolute inset-0 pointer-events-none z-0">
        <SideRays
          speed={2.5}
          rayColor1="#10b981"
          rayColor2="#3b82f6"
          intensity={1.5}
          spread={2.5}
          origin="top-right"
          tilt={0}
          saturation={1.5}
          blend={0.5}
          falloff={1.6}
          opacity={0.3}
        />
      </div>
      
      <div className="relative z-10">
        <Navbar />
      </div>
      
      <main className="relative z-0">
        <AuroraBackground className="h-screen">
          <FadeContent blur={true} duration={1200} ease="ease-out" initialOpacity={0} className="z-10 flex flex-col items-center justify-center text-center px-4 max-w-4xl mx-auto mt-20">
            <div className="inline-flex items-center space-x-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 mb-8">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-sm font-medium text-gray-300">RideFlow v1.0 is live</span>
            </div>
            
            <h1 className="text-3xl md:text-5xl font-bold tracking-tighter mb-4">
              Experience the Future of <br className="hidden md:block" />
              <ShinyText text="Group Navigation" className="font-extrabold" />
            </h1>
            
            <p className="text-base md:text-lg text-gray-400 mb-8 max-w-2xl mx-auto leading-relaxed">
              A premium, real-time group ride platform. Synchronize routes, see live traffic, 
              and ride together with unparalleled precision.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-6">
              <Link href="/login">
                <StarBorder as="div" color="#10b981" speed="3s">
                  <div className="flex items-center font-bold text-base px-2">
                    Create Ride <ArrowRight className="ml-2 h-4 w-4" />
                  </div>
                </StarBorder>
              </Link>
              <Link href="/login">
                <AnimatedButton size="lg" variant="outline" className="h-[48px] px-6 text-base font-semibold bg-transparent border-white/20 text-white hover:bg-white/10">
                  Join Ride <Map className="ml-2 h-4 w-4" />
                </AnimatedButton>
              </Link>
            </div>
          </FadeContent>
        </AuroraBackground>
      </main>
    </div>
  );
}
