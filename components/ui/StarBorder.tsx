import React from 'react';
import './StarBorder.css';

interface StarBorderProps {
  as?: React.ElementType;
  className?: string;
  color?: string;
  speed?: string;
  children?: React.ReactNode;
}

const StarBorder = ({
  as: Component = 'div',
  className = '',
  color = 'magenta',
  speed = '5s',
  children,
  ...props
}: StarBorderProps & React.HTMLAttributes<HTMLElement>) => {
  return (
    <Component className={`star-border-container ${className}`} {...props}>
      <div 
        className="border-gradient-bottom" 
        style={{ animationDuration: speed, background: `radial-gradient(circle, ${color}, transparent 10%)` }}
      />
      <div 
        className="border-gradient-top" 
        style={{ animationDuration: speed, background: `radial-gradient(circle, ${color}, transparent 10%)` }}
      />
      <div className="inner-content">
        {children}
      </div>
    </Component>
  );
};

export default StarBorder;
