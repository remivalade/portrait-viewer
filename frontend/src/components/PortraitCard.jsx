// frontend/src/components/PortraitCard.jsx
import React from 'react';
import { useTheme } from '../ThemeContext';

const PortraitCard = ({ portrait }) => {
  const { isDarkMode } = useTheme();
  const avatarSrc = portrait.avatar_image;

  return (
    <a
      href={portrait.profile_url}
      target="_blank"
      rel="noopener noreferrer"
      title={`View ${portrait.username || 'profile'}'s profile`}
      className={`card block p-4 rounded-lg transition-[transform,shadow,border-color] duration-300 ease-in-out hover:duration-1000
                 ${isDarkMode 
                   ? 'bg-gray-800/60 hover:shadow-[0_0_15px_rgba(147,51,234,0.4)] hover:border-purple-400/50 border border-transparent'
                   : 'portrait-card-light bg-white/85 hover:border-purple-400/50 border border-gray-200/50'
                 }
                 hover:scale-105 group`}
    >
      {/* Avatar */}
      <div className={`w-24 h-24 mx-auto mb-3 overflow-hidden rounded-full flex items-center justify-center transition-colors duration-300 ease-in-out hover:duration-1000
                      ${isDarkMode ? 'bg-gray-700/40' : 'bg-gray-100'}`}>
        <img
          key={avatarSrc || '/default-avatar.png'}
          src={avatarSrc || '/default-avatar.png'}
          alt={portrait.username ? `${portrait.username}'s avatar` : 'Portrait avatar'}
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

      {/* Username */}
      <p className={`text-center text-sm font-medium truncate transition-colors duration-300 ease-in-out hover:duration-1000
                    ${isDarkMode 
                      ? 'text-gray-200 group-hover:text-purple-600'
                      : 'text-gray-700 group-hover:text-purple-600'}`}>
        {portrait.username || '[No Username]'}
      </p>
    </a>
  );
};

export default PortraitCard;