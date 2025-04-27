// frontend/src/App.jsx

import React, { useState, useEffect, useCallback } from 'react';
import InfiniteScroll from 'react-infinite-scroll-component';
import PortraitCard from './components/PortraitCard';
import SkeletonCard from './components/SkeletonCard';

// Define API URL using Vite env variable or fallback
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/portraits';
const ITEMS_PER_PAGE = 60;

// Make sure the 'function App() {' line and the closing '}' bracket are present
function App() {
  // --- State variables ---
  const [portraits, setPortraits] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalPortraits, setTotalPortraits] = useState(0);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // --- Fetch logic ---
  const fetchPortraits = useCallback(async (currentPage) => {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);

    console.log(`Fetching page: ${currentPage}`);
    try {
      const response = await fetch(`${API_URL}?page=${currentPage}&limit=${ITEMS_PER_PAGE}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      console.log('Data received:', data);

      setPortraits(prevPortraits => [...prevPortraits, ...data.portraits]);
      setTotalPortraits(data.total);

      const currentTotalItems = portraits.length + data.portraits.length;
      console.log(`Current items: ${currentTotalItems}, Total available: ${data.total}`);
      setHasMore(currentTotalItems < data.total);

    } catch (e) {
      console.error("Failed to fetch portraits:", e);
      setError(`Failed to load portraits: ${e.message}. Please try refreshing.`);
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, portraits.length]); // Dependencies for useCallback

  // --- Initial fetch ---
  useEffect(() => {
    setPortraits([]);
    setPage(1);
    setHasMore(true);
    setError(null);
    setTotalPortraits(0);
    fetchPortraits(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty array for initial load

  // --- Load more logic ---
  const loadMore = () => {
    if (!isLoading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchPortraits(nextPage);
    }
  };

  // --- Skeleton component helper ---
  const skeletonCount = isLoading && portraits.length === 0 ? ITEMS_PER_PAGE : 12;
  const Skeletons = () => (
    Array.from({ length: skeletonCount }).map((_, index) => (
      <SkeletonCard key={`skeleton-${index}`} />
    ))
  );

  // --- ** THE RETURN STATEMENT MUST BE INSIDE THE FUNCTION ** ---
  return (
    // Apply max-width, centering, padding, and font directly here
    <div className="max-w-screen-lg mx-auto px-4 py-8 font-sans bg-gradient-to-br from-purple-50 via-white to-blue-50 min-h-screen">
      <header className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-800 mb-2 text-red-500 text-6xl">Portrait Gallery</h1>
        <p className="text-lg text-gray-600">Discover Profiles on Base Sepolia</p>
        {totalPortraits > 0 && !isLoading && ( // Show count when not initially loading
          <p className="text-sm text-gray-500 mt-1">Displaying {portraits.length} of {totalPortraits} Portraits</p>
        )}
         {isLoading && portraits.length === 0 && ( // Show loading text initially
            <p className="text-sm text-gray-500 mt-1">Loading total count...</p>
         )}
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
          hasMore={hasMore && !error} // Stop if error occurred
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

    </div> // End of main container div
  ); // End of return statement

} // <--- ** MAKE SURE THIS CLOSING BRACE IS HERE **

export default App; // Export the component