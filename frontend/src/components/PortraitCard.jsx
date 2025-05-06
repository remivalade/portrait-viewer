// frontend/src/components/PortraitCard.jsx
import React from 'react';

const PortraitCard = ({ portrait }) => {
  // --- Use avatar_image directly provided by the updated API ---
  const avatarSrc = portrait.avatar_image;

  return (
    <a
      href={portrait.profile_url}
      target="_blank"
      rel="noopener noreferrer"
      title={`View ${portrait.username || 'profile'}'s profile`}
      className="card block p-4 rounded-lg bg-gray-800/60 shadow transition
                 hover:shadow-[0_0_15px_rgba(255,255,255,0.4)]
                 hover:scale-105 hover:border-purple-400/50 border border-transparent
                 group"
    >
      {/* Avatar */}
      <div className="w-24 h-24 mx-auto mb-3 overflow-hidden rounded-full bg-gray-700/40 flex items-center justify-center text-gray-500">
        <img
          key={avatarSrc || '/default-avatar.png'}
          // Use the avatar_image from the API, or the default placeholder
          src={avatarSrc || '/default-avatar.png'} // <-- Use avatarSrc
          alt={portrait.username ? `${portrait.username}'s avatar` : 'Portrait avatar'}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={e => {
            // Fallback logic
            if (e.target.src !== '/default-avatar.png') {
              e.target.onerror = null;
              e.target.src = '/default-avatar.png';
            } else {
              e.target.style.display = 'none';
            }
          }}
        />
      </div>

      {/* Username */}
      <p className="text-center text-sm font-medium text-purple-300 truncate group-hover:text-purple-200">
        {portrait.username || '[No Username]'}
      </p>
    </a>
  );
};

export default PortraitCard;