"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const AnimatedButton = forwardRef<HTMLButtonElement, React.ComponentProps<typeof Button>>(
  ({ className, ...props }, ref) => {
    return (
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="w-full sm:w-auto"
      >
        <Button
          ref={ref}
          className={cn(
            "relative overflow-hidden transition-colors bg-white text-black hover:bg-gray-200",
            className
          )}
          {...props}
        >
          {props.children}
        </Button>
      </motion.div>
    );
  }
);
AnimatedButton.displayName = "AnimatedButton";
