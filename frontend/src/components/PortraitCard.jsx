// frontend/src/components/PortraitCard.jsx
import React from 'react';

const PortraitCard = ({ portrait }) => {
  // -------------------------------------------------------------------------
  // Build the avatar URL – accept either a full URL or a bare Arweave tx-id
  // -------------------------------------------------------------------------
  let avatarSrc = null;

  if (portrait.image_url) {
    avatarSrc = portrait.image_url;                       // IPFS / HTTP
  } else if (portrait.image_arweave_tx) {
    avatarSrc = portrait.image_arweave_tx.startsWith('http')
      ? portrait.image_arweave_tx                         // already a URL
      : `https://arweave.net/${portrait.image_arweave_tx}`; // bare tx-id
  }
  // (If neither exists, we’ll fall back to /default-avatar.png later)

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <a
      href={portrait.profile_url}
      target="_blank"
      rel="noopener noreferrer"
      title={`View ${portrait.username}'s profile`}
      className="card block p-4 rounded-lg bg-gray-800/60 shadow transition
                 hover:shadow-[0_0_15px_rgba(255,255,255,0.4)]
                 hover:scale-105 hover:border-purple-400/50 border border-transparent
                 group"
    >
      {/* Avatar ------------------------------------------------------------- */}
      <div className="w-24 h-24 mx-auto mb-3 overflow-hidden rounded-full bg-gray-700/40">
        <img
          key={avatarSrc || '/default-avatar.png'}
          src={avatarSrc || '/default-avatar.png'}
          alt={`${portrait.username}'s avatar`}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={e => {
            if (e.target.src !== '/default-avatar.png') {
              e.target.onerror = null;
              e.target.src = '/default-avatar.png';
            } else {
              e.target.style.display = 'none';
            }
          }}
        />
      </div>

      {/* Username ----------------------------------------------------------- */}
      <p className="text-center text-sm font-medium text-purple-300 truncate
                    group-hover:text-purple-200">
        {portrait.username}
      </p>
    </a>
  );
};

export default PortraitCard;
