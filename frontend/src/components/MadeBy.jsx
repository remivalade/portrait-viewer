import React, { useState } from 'react';
import PropTypes from 'prop-types';

/**
 * MadeBy Component
 *
 * A fixed "Made By" badge that expands on click to show a profile card.
 *
 * Usage:
 * <MadeBy isDarkMode={true} />
 *
 * Dependencies:
 * - Tailwind CSS
 * - React
 */
const MadeBy = ({ isDarkMode = false }) => {
  const [isOpen, setIsOpen] = useState(false);

  // Inline SVGs to make the component self-contained
  const LinkedInIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-5 h-5 block" fill="currentColor">
       <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
    </svg>
  );

  const XIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-5 h-5 block" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  );

  // Chevron Icon
  const ChevronIcon = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
    </svg>
  );

  return (
    <div
      onClick={() => setIsOpen(prev => !prev)}
      className={`fixed bottom-4 right-4 z-10 rounded-lg shadow-lg transition-all duration-300 ease-in-out overflow-hidden cursor-pointer
                 ${isDarkMode ? 'bg-gray-900/80 backdrop-blur-md' : 'bg-white/85 backdrop-blur-md'}
                 hover:ring-2 hover:ring-purple-500/50`}
    >
      {!isOpen ? (
        <div className="flex items-center space-x-2 p-2 group">
            <img src="https://irys.portrait.host/FEQnDav4onGWwukVL1-p1ytDMaZu6Cai0AxvUPMRemw" alt="remivalade profile picture" className="w-6 h-6 rounded-full border border-gray-600/50"/>
            <span className={`text-xs font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`} title="Show info">made by remivalade</span>
            <ChevronIcon className={`h-4 w-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} transition-transform duration-200`} />
        </div>
      ) : (
        <div className="p-4 w-48 flex flex-col items-center text-center">
            <div className="flex items-center justify-between w-full mb-3">
              <img src="https://irys.portrait.host/FEQnDav4onGWwukVL1-p1ytDMaZu6Cai0AxvUPMRemw" alt="remivalade profile picture" className="w-16 h-16 rounded-full border-2 border-gray-600/70 shadow-md"/>
              <ChevronIcon className={`h-4 w-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} transition-transform duration-200 rotate-180`} />
            </div>
            <p className={`text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>Hi, I'm Rémi.</p>
            <p className={`text-xs mb-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>I hope you like what you see there.</p>
            <div className="flex items-center justify-center space-x-4 mb-4">
                <a
                   href="https://www.linkedin.com/in/remivalade/"
                   onClick={e => e.stopPropagation()}
                   target="_blank"
                   rel="noopener noreferrer"
                   title="Rémi Valade on LinkedIn"
                   className="p-1 rounded-md border border-transparent hover:border-purple-400/50 transition-all duration-200 ease-in-out hover:scale-110 block text-gray-400 hover:text-[#0077b5]"
                >
                    <LinkedInIcon />
                </a>
                <a
                   href="https://x.com/remivalade"
                   onClick={e => e.stopPropagation()}
                   target="_blank"
                   rel="noopener noreferrer"
                   title="Rémi Valade on X"
                   className="p-1 rounded-md border border-transparent hover:border-purple-400/50 transition-all duration-200 ease-in-out hover:scale-110 block text-gray-400 hover:text-black dark:hover:text-white"
                >
                    <XIcon />
                </a>
            </div>
            <a
                href="https://portrait.so/remivalade"
                onClick={e => e.stopPropagation()}
                target="_blank"
                rel="noopener noreferrer"
                className="relative inline-flex items-center justify-center w-full px-3 py-1.5 border border-gray-600 text-gray-100 hover:text-white text-xs rounded-md shadow-sm overflow-hidden group bg-gradient-to-r from-purple-500 via-orange-500 to-yellow-500 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/20"
            >
               <span className="absolute top-0 right-0 w-10 h-full -mt-1 bg-white opacity-20 rotate-12 transform translate-x-12 transition-all duration-700 group-hover:-translate-x-56 ease-out"></span>
               <span className="relative z-10">Check my Portrait</span>
            </a>
        </div>
      )}
    </div>
  );
};

MadeBy.propTypes = {
    isDarkMode: PropTypes.bool
};

export default MadeBy;
