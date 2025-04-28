// frontend/src/components/PortraitCard.jsx
import React from 'react';

// Basic fallback image in SVG format
const FallbackAvatar = () => (
  // Using dark text color directly as it's permanent dark mode
  <svg className="w-full h-full text-gray-500" fill="currentColor" viewBox="0 0 24 24">
    <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);


const PortraitCard = ({ portrait }) => {
  const [imgError, setImgError] = React.useState(false);

  const handleImageError = () => {
    setImgError(true);
  };

  // --- Styles for Permanent Dark Mode & Hover Glow ---
  return (
    <a
      href={portrait.profileUrl}
      target="_blank"
      rel="noopener noreferrer"
      // Apply dark styles directly, use arbitrary value for hover glow
      className="card block p-4 rounded-lg shadow transition-all duration-200 ease-in-out transform hover:-translate-y-1
                 bg-gray-800/60                        // Dark background
                 hover:shadow-[0_0_15px_rgba(255,255,255,0.5)]  // Dark hover glow (arbitrary value)
                 border border-transparent"                 // No complex hover border needed
      title={`View ${portrait.username}'s profile on Portrait.so`}
    >
      <div className="w-24 h-24 mx-auto mb-3 overflow-hidden rounded-full bg-gray-700 border-2 border-gray-600"> {/* Dark mode styles */}
        {imgError ? (
          <FallbackAvatar />
        ) : (
          <img
            src={portrait.imageUrl}
            alt={`${portrait.username}'s profile picture`}
            className="w-full h-full object-cover"
            onError={handleImageError}
            loading="lazy"
          />
        )}
      </div>
      <p className="text-center text-sm font-medium text-purple-300 truncate"> {/* Dark mode text color */}
        {portrait.username}
      </p>
    </a>
  );
};

export default PortraitCard;