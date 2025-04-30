// frontend/src/components/PortraitCard.jsx
import React from 'react';

// --- REMOVED: FallbackAvatar SVG component definition ---

const PortraitCard = ({ portrait }) => {
  // Determine Avatar Source (logic remains the same)
  let avatarSrc = null;
  if (portrait.image_url) {
      avatarSrc = portrait.image_url;
  } else if (portrait.image_arweave_tx) {
      avatarSrc = `https://arweave.net/${portrait.image_arweave_tx}`;
  }
  // --- End Determine Avatar Source ---

  // Styles for Permanent Dark Mode & Hover Glow (remains the same)
  return (
    <a
      href={portrait.profile_Url}
      target="_blank"
      rel="noopener noreferrer"
      className="card block p-4 rounded-lg shadow transition-all duration-200 ease-in-out transform hover:-translate-y-1
                 bg-gray-800/60
                 hover:shadow-[0_0_15px_rgba(255,255,255,0.5)]
                 border border-transparent"
      title={`View ${portrait.username}'s profile on Portrait.so`}
    >
      {/* Container for the avatar image */}
      <div className="w-24 h-24 mx-auto mb-3 overflow-hidden rounded-full bg-gray-700 border-2 border-gray-600 flex items-center justify-center">
        {/* --- Updated Conditional Rendering --- */}
        {avatarSrc ? (
          // If we have a source URL (IPFS or Arweave)
          <img
            key={avatarSrc} // Add key to help React differentiate if src changes
            src={avatarSrc}
            alt={`${portrait.username}'s profile picture`}
            className="w-full h-full object-cover"
            // Updated onError: If primary src fails, try loading the default PNG
            onError={(e) => {
              // Prevent infinite loop if default also fails
              if (e.target.src !== '/default-avatar.png') {
                  e.target.onerror = null; // Prevent infinite loop
                  e.target.src = '/default-avatar.png';
                  console.warn(`Failed to load ${avatarSrc}, falling back to default.`); // Optional warning
              } else {
                 // If default fails, just hide (optional)
                 e.target.style.display='none';
              }
            }}
            loading="lazy"
          />
        ) : (
          // If no avatarSrc determined initially, render the default PNG directly
          <img
            src="/default-avatar.png" // Path relative to public folder
            alt="Default avatar"
            className="w-full h-full object-cover" // Style as needed
          />
        )}
        {/* --- End Updated Conditional Rendering --- */}
      </div>
      <p className="text-center text-sm font-medium text-purple-300 truncate">
        {portrait.username}
      </p>
    </a>
  );
};

export default PortraitCard;