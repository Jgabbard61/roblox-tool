import React from 'react';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "destructive";
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className = "", variant = "default", ...props }, ref) => {
    const baseClasses = "relative w-full rounded-lg border p-4";
    const variantClasses = {
      default: "bg-gray-50 text-gray-900 border-gray-200 dark:bg-gray-900 dark:text-gray-100 dark:border-gray-800",
      destructive: "bg-red-50 text-red-900 border-red-200 dark:bg-red-950 dark:text-red-100 dark:border-red-900",
    };

    return (
      <div
        ref={ref}
        role="alert"
        className={`${baseClasses} ${variantClasses[variant]} ${className}`}
        {...props}
      />
    );
  }
);

Alert.displayName = "Alert";

export interface AlertTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

export const AlertTitle = React.forwardRef<HTMLHeadingElement, AlertTitleProps>(
  ({ className = "", ...props }, ref) => {
    return (
      <h5
        ref={ref}
        className={`mb-1 font-medium leading-none tracking-tight ${className}`}
        {...props}
      />
    );
  }
);

AlertTitle.displayName = "AlertTitle";

export interface AlertDescriptionProps extends React.HTMLAttributes<HTMLDivElement> {}

export const AlertDescription = React.forwardRef<HTMLDivElement, AlertDescriptionProps>(
  ({ className = "", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`text-sm [&_p]:leading-relaxed ${className}`}
        {...props}
      />
    );
  }
);

AlertDescription.displayName = "AlertDescription";