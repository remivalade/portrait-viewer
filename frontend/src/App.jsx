// frontend/src/App.jsx

import React, { useState, useEffect, useCallback } from 'react';
import InfiniteScroll from 'react-infinite-scroll-component';
import PortraitCard from './components/PortraitCard';
import SkeletonCard from './components/SkeletonCard';

// Define API URL using Vite env variable or fallback
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/portraits';
const ITEMS_PER_PAGE = 60;

// --- ADDED: Fisher-Yates Shuffle Function ---
function shuffleArray(array) {
  let currentIndex = array.length, randomIndex;
  // While there remain elements to shuffle.
  while (currentIndex !== 0) {
    // Pick a remaining element.
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }
  return array;
}
// --- End Shuffle Function ---

// Make sure the 'function App() {' line and the closing '}' bracket are present
function App() {
  // --- State variables ---
  const [portraits, setPortraits] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalPortraits, setTotalPortraits] = useState(0);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // --- Fetch logic (for subsequent pages - NO shuffle here) ---
  const fetchPortraits = useCallback(async (currentPage) => {
    // Guard clause moved here to prevent multiple fetches if already loading
    // This check might be redundant if loadMore also checks isLoading, but belt-and-suspenders
    if (isLoading && currentPage > 1) return; // Allow initial fetch even if loading is set

    setIsLoading(true); // Set loading true when fetch starts
    // Don't reset error here if we want to show previous error while loading next page potentially?
    // Let's keep resetting for now:
    setError(null);

    console.log(`Fetching page: ${currentPage}`);
    try {
      const response = await fetch(`${API_URL}?page=${currentPage}&limit=${ITEMS_PER_PAGE}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      console.log(`Data received for page ${currentPage}:`, data);

      // Append unshuffled portraits for subsequent pages
      setPortraits(prevPortraits => [...prevPortraits, ...data.portraits]);
      // Only update total if it's not set or potentially changes (though it shouldn't change often)
      if (totalPortraits === 0) setTotalPortraits(data.total);

      const currentTotalItems = portraits.length + data.portraits.length; // Use state length before update + new items
      console.log(`Current items after fetch page ${currentPage}: ${currentTotalItems}, Total available: ${data.total}`);
      setHasMore(currentTotalItems < data.total);

    } catch (e) {
      console.error("Failed to fetch portraits:", e);
      setError(`Failed to load portraits: ${e.message}. Please try refreshing.`);
      setHasMore(false);
    } finally {
      // Only set loading false if it's not the initial mount potentially?
      // No, always set false after fetch attempt completes.
      setIsLoading(false);
    }
  // Adjust dependencies - include totalPortraits if needed by logic inside
  }, [isLoading, portraits.length, totalPortraits]);

  // --- Initial fetch (useEffect runs once on mount) ---
  useEffect(() => {
    const fetchAndShuffleFirstPage = async () => {
       // Reset state for initial load
       setPortraits([]);
       setPage(1);
       setHasMore(true);
       setError(null);
       setTotalPortraits(0);
       setIsLoading(true); // Set loading true for initial fetch

       console.log(`Fetching page: 1 for initial load`);
       try {
         const response = await fetch(`${API_URL}?page=1&limit=${ITEMS_PER_PAGE}`);
         if (!response.ok) {
           throw new Error(`HTTP error! status: ${response.status}`);
         }
         const data = await response.json();
         console.log('Initial data received:', data);

         // --- Shuffle the first batch of portraits ---
         const shuffledPortraits = shuffleArray([...data.portraits]); // Create copy before shuffling
         // --- End Shuffle ---

         setPortraits(shuffledPortraits); // Set state with shuffled data
         setTotalPortraits(data.total); // Set total from first fetch

         const currentTotalItems = shuffledPortraits.length;
         console.log(`Initial items: ${currentTotalItems}, Total available: ${data.total}`);
         setHasMore(currentTotalItems < data.total); // Set hasMore based on initial fetch

       } catch (e) {
         console.error("Failed to fetch initial portraits:", e);
         setError(`Failed to load portraits: ${e.message}. Please try refreshing.`);
         setHasMore(false); // Stop loading on error
       } finally {
         setIsLoading(false); // Set loading false after fetch attempt completes
       }
    };

    fetchAndShuffleFirstPage(); // Call the async function

    // Empty dependency array ensures this runs only once on mount
  }, []);

  // --- Load more logic ---
  const loadMore = () => {
    // Prevent loading more if already loading or no more items
    if (!isLoading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage); // Update page number state
      fetchPortraits(nextPage); // Call fetch for the next page
    }
  };

  // --- Skeleton component helper ---
  // Calculate count based on whether it's initial load or subsequent load
  const skeletonCount = isLoading && portraits.length === 0 ? ITEMS_PER_PAGE : 12;
  const Skeletons = () => (
    Array.from({ length: skeletonCount }).map((_, index) => (
      <SkeletonCard key={`skeleton-${index}`} />
    ))
  );

  // --- ** THE RETURN STATEMENT MUST BE INSIDE THE FUNCTION ** ---
  return (
    // Main container: Constrains content width, adds padding/spacing
    // Background is now applied to <body> via index.css
    <div className="max-w-screen-lg mx-auto px-4 py-8">
      <header className="text-center mb-12">
        {/* Updated Title with Script Font */}
        <h1 className="text-4xl font-bold text-gray-800 mb-2 font-script">Discover new portraits!</h1>
        {/* Create Button */}
        <a
            href="https://portrait.so/" // Link to the main Portrait site
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-2 mt-4 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 text-gray-800 rounded-lg shadow-sm font-medium transition-colors duration-150"
        >
            <svg className="w-5 h-5" viewBox="0 0 58 58" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fill="currentColor" fillRule="evenodd" d="M40 8.5H18A9.5 9.5 0 0 0 8.5 18v22a9.5 9.5 0 0 0 9.5 9.5h22a9.5 9.5 0 0 0 9.5-9.5V18A9.5 9.5 0 0 0 40 8.5ZM18 0C8.059 0 0 8.059 0 18v22c0 9.941 8.059 18 18 18h22c9.941 0 18-8.059 18-18V18c0-9.941-8.059-18-18-18H18Z" clipRule="evenodd"></path>
            </svg>
            <span>Create Your Own Portrait</span>
        </a>
      </header>

      {/* Display error message if fetch failed */}
      {error && !isLoading && (
        <div className="text-center text-red-600 bg-red-100 p-4 rounded-md border border-red-300">
          <p><strong>Error:</strong> {error}</p>
        </div>
      )}

      {/* Infinite Scroll Container - Render only if no error */}
      {!error && (
        <InfiniteScroll
          dataLength={portraits.length}
          next={loadMore}
          hasMore={hasMore && !error}
          loader={
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 mt-6">
              <Skeletons />
            </div>
          }
          endMessage={
            !isLoading && !error && portraits.length > 0 && portraits.length >= totalPortraits ? (
              <p className="text-center text-gray-500 mt-8 py-4">
                <b>Yay! You have seen it all</b>
              </p>
            ) : null
          }
          style={{ overflow: 'visible' }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {portraits.map((portrait) => (
              <PortraitCard key={portrait.id} portrait={portrait} />
            ))}
          </div>
        </InfiniteScroll>
      )}

      {/* Show initial loading skeletons only when loading, portraits are empty, and no error */}
      {isLoading && portraits.length === 0 && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 mt-6">
          <Skeletons />
        </div>
      )}

      {/* --- Centered Counter Display --- */}
      {totalPortraits > 0 && !isLoading && (
           <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-10 p-2 px-3 rounded-lg bg-white/20 backdrop-blur-md border border-white/10 text-gray-900 text-xs shadow-lg">
             {portraits.length} / {totalPortraits} Portraits
           </div>
      )}
      {/* --- "Made by" Box --- */}
        <div className="fixed bottom-4 right-4 z-10 p-2 rounded-lg bg-white/30 backdrop-blur-md border border-white/20 shadow-md flex items-center space-x-2">
            <img
                src="https://irys.portrait.host/FEQnDav4onGWwukVL1-p1ytDMaZu6Cai0AxvUPMRemw"
                alt="remivalade profile picture"
                className="w-6 h-6 rounded-full border border-white/30"
            />
            <a
                href="https://portrait.so/remivalade"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-gray-800 hover:text-black font-medium"
                title="View remivalade's Portrait profile"
            >
                made by remivalade
            </a>
        </div>
      {/* --- End of Added elements --- */}

    </div> // End of main container div
  ); // End of return statement

} // End of App function

export default App; // Export the component