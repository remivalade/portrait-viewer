// frontend/src/components/SkeletonCard.jsx

import React from 'react';

const SkeletonCard = () => {
  return (
    <div className="bg-gray-100 p-4 rounded-lg shadow animate-pulse">
      <div className="w-24 h-24 mx-auto rounded-full bg-gray-300 mb-3"></div>
      <div className="h-4 bg-gray-300 rounded w-3/4 mx-auto"></div>
    </div>
  );
};

export default SkeletonCard;