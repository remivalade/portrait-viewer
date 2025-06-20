// frontend/src/components/PortraitCard.jsx
import React from 'react';
import { useTheme } from '../ThemeContext';

const PortraitCard = ({ portrait, size = 'medium', className = '' }) => {
  const { isDarkMode } = useTheme();
  const avatarSrc = portrait.avatar_image;

  // Size configurations - all sizes maintain square proportions
  const sizeConfig = {
    small: {
      container: 'col-span-1 aspect-square',
      text: 'text-xs'
    },
    medium: {
      container: 'col-span-1 aspect-square',
      text: 'text-sm'
    },
    large: {
      container: 'col-span-2 aspect-square',
      text: 'text-base'
    }
  };

  const config = sizeConfig[size];

  return (
    <a
      href={portrait.profile_url}
      target="_blank"
      rel="noopener noreferrer"
      title={`View ${portrait.username || 'profile'}'s profile`}
      className={`${config.container} ${className} group relative block rounded-xl overflow-hidden transition-[transform,shadow,border-color] duration-300 ease-in-out hover:scale-105
        ${isDarkMode 
          ? 'bg-gray-800/60 hover:shadow-[0_0_15px_rgba(147,51,234,0.4)] hover:border-purple-400/50 border border-transparent'
          : 'portrait-card-light bg-white/85 hover:border-purple-400/50 border border-gray-200/50'
        }`}
    >
      {/* Full-bleed Avatar */}
      <img
        key={avatarSrc || '/default-avatar.png'}
        src={avatarSrc || '/default-avatar.png'}
        alt={portrait.username ? `${portrait.username}'s avatar` : 'Portrait avatar'}
        className="absolute inset-0 w-full h-full object-cover"
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
      {/* Username Overlay */}
      <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/70 via-black/30 to-transparent px-2 py-1 flex items-end">
        <span className={`w-full truncate ${config.text} font-medium text-white drop-shadow`}>{portrait.username || '[No Username]'}</span>
      </div>
    </a>
  );
};

export default PortraitCard;