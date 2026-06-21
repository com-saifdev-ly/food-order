import { useState } from 'react';

export default function Avatar({ 
  src, 
  alt, 
  className = '', 
  fallbackSrc = '/assets/user.svg',
  size = 'medium', // small, medium, large
  onClick = null
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  const imageSrc = hasError ? fallbackSrc : src;
  const showLoading = isLoading && !hasError;

  const sizeClass = `Avatar Avatar--${size}`;
  const combinedClassName = `${sizeClass} ${className}`.trim();

  return (
    <div 
      className={combinedClassName}
      onClick={onClick}
      style={onClick ? { cursor: 'pointer' } : undefined}
    >
      {showLoading && (
        <div className="Avatar-loading">
          <div className="Avatar-spinner"></div>
        </div>
      )}
      <img
        src={imageSrc}
        alt={alt}
        className="Avatar-image"
        onLoad={handleLoad}
        onError={handleError}
      />
    </div>
  );
}
