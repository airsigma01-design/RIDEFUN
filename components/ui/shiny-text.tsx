"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ShinyTextProps {
  text: string;
  className?: string;
}

export function ShinyText({ text, className }: ShinyTextProps) {
  return (
    <motion.span
      className={cn(
        "bg-clip-text text-transparent bg-gradient-to-r from-gray-400 via-white to-gray-400 animate-pulse bg-[length:200%_auto]",
        className
      )}
      initial={{ backgroundPosition: "200% center" }}
      animate={{ backgroundPosition: "-200% center" }}
      transition={{
        repeat: Infinity,
        duration: 3,
        ease: "linear",
      }}
    >
      {text}
    </motion.span>
  );
}
