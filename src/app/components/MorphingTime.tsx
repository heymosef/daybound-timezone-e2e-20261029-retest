import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "./ui/utils";

interface MorphingTimeProps {
  children: string; // The time string to morph
  className?: string;
  // Optional: Pass use24Hour if we want to change behavior based on format
}

// Spring transition for snappy but smooth movement
const springTransition = {
  type: "tween" as const,
  duration: 0.25,
  ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
};

export const MorphingTime: React.FC<MorphingTimeProps> = ({
  children,
  className,
}) => {
  // Split the string into characters
  const characters = children.split("");

  return (
    <div className={cn("inline-flex overflow-hidden relative", className)}>
      {/* We use a layout group to ensure smooth spacing changes if characters change width (e.g. 1 vs 8) */}
      <AnimatePresence mode="popLayout" initial={false}>
        {characters.map((char, index) => {
          // Key by index AND char to trigger animation only when char changes at that position
          const key = `${index}-${char}`;
          
          return (
            <motion.span
              key={key}
              initial={{ 
                y: "60%", 
                opacity: 0, 
              }}
              animate={{ 
                y: "0%", 
                opacity: 1, 
              }}
              exit={{ 
                y: "-60%", 
                opacity: 0, 
                position: "absolute" // Take out of flow immediately
              }}
              transition={springTransition}
              className="inline-block whitespace-pre text-center"
              style={{
                // Ensure digits have consistent width if possible, or let layout handle it.
                // For monospace fonts, this is automatic.
                minWidth: char === " " ? "0.3em" : "auto"
              }}
            >
              {char}
            </motion.span>
          );
        })}
      </AnimatePresence>
    </div>
  );
};