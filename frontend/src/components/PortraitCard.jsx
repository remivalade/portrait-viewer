// frontend/src/components/PortraitCard.jsx
import React from 'react';

// Basic fallback image in SVG format
const FallbackAvatar = () => (
  <svg className="w-full h-full text-gray-500" fill="currentColor" viewBox="0 0 24 24">
    <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);


const PortraitCard = ({ portrait }) => {
  // Removed the imgError state as we'll handle missing sources directly
  // const [imgError, setImgError] = React.useState(false);
  // const handleImageError = () => { setImgError(true); }; // Keep onError logic on img tag though

  // --- Determine Avatar Source ---
  let avatarSrc = null;
  if (portrait.image_url) {
      // Prefer IPFS image_url if available
      avatarSrc = portrait.image_url;
      console.log(`Using IPFS image for ${portrait.username}: ${avatarSrc}`); // Optional logging
  } else if (portrait.image_arweave_tx) {
      // Fallback to Arweave transaction ID if IPFS is missing
      avatarSrc = `https://irys.portrait.host/${portrait.image_arweave_tx}`;
      console.log(`Using Arweave image for ${portrait.username}: ${avatarSrc}`); // Optional logging
  } else {
      console.log(`No image source found for ${portrait.username}`); // Optional logging
  }
  // If neither is present, avatarSrc remains null
  // --- End Determine Avatar Source ---


  // Styles for Permanent Dark Mode & Hover Glow
  return (
    <a
      href={portrait.profile_url}
      target="_blank"
      rel="noopener noreferrer"
      className="card block p-4 rounded-lg shadow transition-all duration-200 ease-in-out transform hover:-translate-y-1
                 bg-gray-800/60
                 hover:shadow-[0_0_15px_rgba(255,255,255,0.5)]
                 border border-transparent"
      title={`View ${portrait.username}'s profile on Portrait.so`}
    >
      <div className="w-24 h-24 mx-auto mb-3 overflow-hidden rounded-full bg-gray-700 border-2 border-gray-600 flex items-center justify-center"> {/* Added flex center for fallback */}
        {/* --- Conditionally render image or fallback --- */}
        {avatarSrc ? (
          <img
            src={avatarSrc} // Use the determined source URL
            alt={`${portrait.username}'s profile picture`}
            className="w-full h-full object-cover"
            // Keep onError to handle cases where the URL is valid but image fails to load
            onError={(e) => {
                // Optionally hide the broken image and show fallback,
                // or let the browser show its broken image icon.
                // For simplicity, let's rely on the background + FallbackAvatar if needed below
                // Or we could add state back:
                // if (!imgError) setImgError(true); // Re-introduce imgError state if needed
                e.target.style.display='none'; // Hide broken img
            }}
            loading="lazy"
          />
        ) : (
          // If no avatarSrc determined, show FallbackAvatar immediately
          <FallbackAvatar />
        )}
        {/* --- End Conditional Render --- */}
      </div>
      <p className="text-center text-sm font-medium text-purple-300 truncate">
        {portrait.username}
      </p>
    </a>
  );
};

export default PortraitCard;