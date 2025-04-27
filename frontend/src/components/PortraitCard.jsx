// frontend/src/components/PortraitCard.jsx

import React from 'react';

// Basic fallback image in SVG format
const FallbackAvatar = () => (
  <svg className="w-full h-full text-gray-400" fill="currentColor" viewBox="0 0 24 24">
    <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);


const PortraitCard = ({ portrait }) => {
  const [imgError, setImgError] = React.useState(false);

  const handleImageError = () => {
    setImgError(true);
  };

  // Use a slightly lighter pastel background, e.g., lavender tint
  // Added subtle transition for hover effects
  return (
    <a
      href={portrait.profileUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="card block bg-purple-50 hover:bg-purple-100 p-4 rounded-lg shadow hover:shadow-md transition-all duration-200 ease-in-out transform hover:-translate-y-1"
      title={`View ${portrait.username}'s profile on Portrait.so`}
    >
      <div className="w-24 h-24 mx-auto mb-3 overflow-hidden rounded-full bg-gray-200 border-2 border-purple-200">
        {imgError ? (
          <FallbackAvatar />
        ) : (
          <img
            src={portrait.imageUrl}
            alt={`${portrait.username}'s profile picture`}
            className="w-full h-full object-cover"
            onError={handleImageError}
            loading="lazy" // Add lazy loading for images
          />
        )}
      </div>
      <p className="text-center text-sm font-medium text-purple-800 truncate">
        {portrait.username}
      </p>
    </a>
  );
};

export default PortraitCard;