// frontend/src/components/PortraitCard.jsx
import React from 'react';

const PortraitCard = ({ portrait }) => {
  // --- Simplified Avatar Source Logic ---
  let avatarSrc = null;
  if (portrait.image_url) { // 1. Check IPFS URL
      avatarSrc = portrait.image_url;
  } else if (portrait.image_arweave_tx) { // 2. Check (now full) Arweave URL
      avatarSrc = portrait.image_arweave_tx; // Use it directly
  }
  // NOTE: No need for a third 'else' here if using the onError fallback below
  // --- End Simplified Logic ---


  // --- Render Logic with Fallback ---
  return (
    <a
      href={portrait.profile_url}
      target="_blank"
      rel="noopener noreferrer"
      // Hover effects (scale, border, glow)
      className="card block p-4 rounded-lg shadow transition-all duration-200 ease-in-out
                 bg-gray-800/60 border border-transparent
                 hover:shadow-[0_0_15px_rgba(255,255,255,0.5)]
                 hover:scale-105
                 hover:border-purple-400/50
                 group"
      title={`View ${portrait.username}'s profile on Portrait.so`}
    >
      {/* Avatar container */}
      <div className="w-24 h-24 mx-auto mb-3 overflow-hidden rounded-full bg-gray-700 border-2 border-gray-600 group-hover:border-purple-400/70 transition-colors duration-200 flex items-center justify-center">
        {/* Use avatarSrc if available, otherwise render default directly via onError */}
        <img
          key={avatarSrc || '/default-avatar.png'} // Key changes if src changes
          src={avatarSrc || '/default-avatar.png'} // Use determined src, or default if null initially
          alt={`${portrait.username}'s avatar`}
          className="w-full h-full object-cover"
          onError={(e) => {
            // If the primary src (avatarSrc or initial default) fails, ensure it shows the static default
            if (e.target.src !== '/default-avatar.png') {
                e.target.onerror = null; // Prevent infinite loop
                e.target.src = '/default-avatar.png';
            } else {
                // If default fails, maybe hide or show placeholder text/icon
                e.target.style.display='none';
            }
          }}
          loading="lazy"
        />
      </div>
      {/* Username */}
      <p className="text-center text-sm font-medium text-purple-300 truncate group-hover:text-purple-200 transition-colors duration-200">
        {portrait.username}
      </p>
    </a>
  );
};

export default PortraitCard;