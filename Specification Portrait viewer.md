
# Product Requirements Document: Portrait Viewer Web Application

**Version:** 1.1
**Date:** 2025-04-27 *(Updated)*
**Author:** [Your Name/Team Name - Placeholder]
**Status:** In Progress *(Updated)*

---

## Table of Contents
1. Introduction
2. Goals and Objectives
3. Scope
4. User Personas / Target Audience
5. Functional Requirements
6. Non-Functional Requirements
7. Design and UX Requirements
8. Technical Requirements / System Architecture
9. Data Requirements
10. Release Criteria & Current Status *(Updated)*
11. Open Questions & Decisions *(Updated)*
12. Future Considerations / Roadmap

---

## 1. Introduction

* **1.1. Overview:** This document outlines the requirements for a web application designed to display user profiles ("portraits") registered via the Portrait protocol smart contracts deployed on the Base Sepolia test network. The application will aggregate data from the blockchain and a dedicated API to present a browsable gallery of users.
* **1.2. Purpose:** To provide a simple and accessible way for users to discover and view existing Portrait profiles on the Base Sepolia testnet, increasing visibility for the Portrait protocol and its users within the Base ecosystem.
* **1.3. Definitions/Glossary:**
    * **Portrait:** A decentralized identity protocol.
    * **Portrait ID:** A unique identifier (likely an NFT) representing a user's profile on the Portrait protocol.
    * **Base Sepolia:** A test network for the Base Layer 2 blockchain.
    * **RPC:** Remote Procedure Call - used to interact with the blockchain.
    * **API:** Application Programming Interface - used to fetch data from the Portrait service and the application's own backend.
    * **IPFS:** InterPlanetary File System - used for decentralized storage, likely hosting profile pictures.
    * **CID:** Content Identifier - a unique hash representing content stored on IPFS.

---

## 2. Goals and Objectives

* **2.1. Business Goals:**
    * Increase awareness and adoption of the Portrait protocol.
    * Provide a useful utility for the Base Sepolia testnet community.
    * Showcase the potential of decentralized identity applications.
* **2.2. Product Goals:**
    * Successfully display all discoverable Portrait profiles from Base Sepolia.
    * Provide an intuitive browsing experience for users.
    * Ensure data displayed is reasonably up-to-date (refreshed daily).
    * Handle a significant number of profiles (up to 100,000) gracefully.
* **2.3. Success Metrics:**
    * Number of unique visitors to the web application.
    * Successful daily completion rate of the backend data fetching job.
    * User feedback on usability and performance.
    * Ability to display the target number of profiles (100K) without significant performance degradation.

---

## 3. Scope

* **3.1. In Scope:**
    * Backend service (`fetch-job.js`) for daily data aggregation from Base Sepolia contracts and the Portrait API.
    * Caching mechanism for the aggregated data (local JSON files: `cache.json`, `meta.json`).
    * Backend API (`api.js`) to serve the cached data to the frontend with pagination.
    * Frontend web application displaying portraits in a list or grid.
    * Display of username, profile picture, and a link to the full Portrait profile for each user.
    * Implementation of pagination or infinite scrolling on the frontend (`react-infinite-scroll-component` used).
    * Basic responsive design for desktop and mobile viewing.
* **3.2. Out of Scope:**
    * Support for networks other than Base Sepolia (e.g., Base mainnet, other EVM chains).
    * User registration or login functionality.
    * Ability for users to create or edit Portrait profiles via this application.
    * Real-time data updates (data is refreshed daily).
    * Advanced filtering, sorting, or searching of profiles (beyond basic display).
    * Displaying detailed Portrait profile content beyond username, picture, and link.

---

## 4. User Personas / Target Audience

* **Primary:**
    * **Web3 Explorers/Testers:** Individuals active on the Base Sepolia testnet looking to explore applications and protocols.
    * **Portrait Users (Testnet):** Users who have created a Portrait on Base Sepolia and want to see it listed or browse others.
    * **Developers:** Building on Base or integrating with Portrait, using the app for reference or discovery.
* **Secondary:**
    * **Community Members:** Interested in the Base ecosystem and new projects.

---

## 5. Functional Requirements

* **FR1 (Backend - Daily Job):** The system shall have a backend job scheduled to run once daily. *(Status: Implemented in `fetch-job.js`)*
* **FR2 (Backend - Data Fetching):** The daily job must fetch all current `portraitId`s from the `PortraitIdRegistryV2` contract on Base Sepolia. *(Status: Implemented)*
* **FR3 (Backend - Data Fetching):** The daily job must fetch the corresponding usernames for all fetched `portraitId`s from the `PortraitNameRegistry` contract. *(Status: Implemented)*
* **FR4 (Backend - Data Fetching):** The daily job must query the Portrait API (`https://api.portrait.so/api/v2/user/latestportrait?name={username}`) for each username to retrieve profile picture details. *(Status: Implemented)*
* **FR5 (Backend - Data Processing):** The daily job must parse the API response to extract the username and profile picture CID. *(Status: Implemented)*
* **FR6 (Backend - Data Processing):** The daily job must construct the full image URL using the extracted CID and a confirmed IPFS gateway prefix (`https://ipfs.io/ipfs/` currently used). *(Status: Implemented)*
* **FR7 (Backend - Data Processing):** The daily job must construct the full profile URL (`https://portrait.so/{username}`). *(Status: Implemented)*
* **FR8 (Backend - Caching):** The daily job must store the processed data (username, imageUrl, profileUrl, id) in a cache/database (`cache.json`). *(Status: Implemented)*
* **FR9 (Backend - API):** The system shall provide a backend API endpoint (e.g., `/api/portraits`). *(Status: Implemented in `api.js`)*
* **FR10 (Backend - API):** The API endpoint must serve the cached portrait data. *(Status: Implemented, reads `cache.json`)*
* **FR11 (Backend - API):** The API endpoint must support pagination (accept `page` and `limit` query parameters). *(Status: Implemented)*
* **FR12 (Frontend - Data Display):** The web application shall display portraits fetched from the backend API in a list or grid format. *(Status: Basic grid implemented in `App.jsx`)*
* **FR13 (Frontend - Data Display):** Each displayed portrait must show the user's profile picture and username. *(Status: Implemented)*
* **FR14 (Frontend - Interaction):** Each displayed portrait must be a clickable link directing the user to the full Portrait profile URL. *(Status: Implemented)*
* **FR15 (Frontend - Scalability):** The frontend must implement pagination or infinite scrolling to handle potentially large numbers of portraits efficiently. *(Status: Infinite scroll implemented using `react-infinite-scroll-component`)*

---

## 6. Non-Functional Requirements

* **6.1. Performance:**
    * Frontend page load time for the initial batch of portraits should be under 3 seconds. *(Status: To be tested/optimized)*
    * Backend API response time for paginated data should be under 500ms (leveraging the cache). *(Status: Implemented, but needs optimization - currently reads file on each request)*
    * The daily backend job should complete within a reasonable timeframe (e.g., under 1-2 hours, depending on scale and rate limits). *(Status: Current delay 1.2s/API call. Needs monitoring at scale)*
* **6.2. Scalability:**
    * The backend architecture (job, cache, API) must be designed to handle data for up to 100,000 portraits. *(Status: Job logic handles batching. API needs optimization for large cache file)*.
    * The frontend must render and scroll smoothly even with a large dataset loaded incrementally. *(Status: Infinite scroll implemented. Performance TBD)*
* **6.3. Reliability/Availability:**
    * The frontend application should aim for high availability (e.g., 99.9% uptime).
    * The daily backend job must be robust against transient errors and log persistent errors. *(Status: Basic console logging implemented)*. Partial success is acceptable.
* **6.4. Security:**
    * Standard web security practices should be applied (e.g., HTTPS, protection against common web vulnerabilities). *(Status: CORS enabled on API)*.
    * No user authentication or sensitive data handling is in scope.
* **6.5. Usability:**
    * The interface should be intuitive and easy to navigate. *(Status: Basic structure exists. Needs styling/refinement)*.
    * The application must be responsive and usable on common desktop and mobile screen sizes. *(Status: Needs implementation/testing, Tailwind CSS setup helps)*.
    * Adherence to basic accessibility principles.
* **6.6. Maintainability:**
    * Backend and frontend code should be well-structured, commented, and follow standard coding practices. *(Status: Initial code exists. Ongoing effort)*.
    * Configuration (RPC URL, contract addresses, API endpoint) should be easily manageable. *(Status: Mostly hardcoded constants in scripts)*.

---

## 7. Design and UX Requirements

* **7.1. Layout:** A clean grid or list layout for displaying portraits. *(Status: Basic grid layout implemented)*.
* **7.2. Responsiveness:** The layout must adapt fluidly to different screen sizes. *(Status: To be implemented using Tailwind CSS)*.
* **7.3. Visual Style:** Simple, clean visual design. *(Updated)* Specific guidelines: Use pastel colors, emphasize simplicity and minimalism, leverage negative space, incorporate subtle 3D effects or other small effects for pleasantness.
* **7.4. Loading States:** Clear visual indicators when data is being loaded. *(Status: Basic "Loading..." text exists. Needs refinement e.g., skeleton loaders)*.
* **7.5. Error States:** Display user-friendly messages if data cannot be loaded from the backend API. *(Status: To be implemented)*.

---

## 8. Technical Requirements / System Architecture

* **8.1. Platform:** Web Application.
* **8.2. Technology Stack:** *(Updated)*
    * **Frontend:** React 19 with Vite, using `react-infinite-scroll-component`. Styling with Tailwind CSS. Code in `frontend/` directory.
    * **Backend (Job):** Node.js script (`backend/fetch-job.js`) using `viem` (blockchain interaction) and `axios` (API calls).
    * **Backend (API):** Node.js with Express.js (`backend/api.js`) serving cached data.
    * **Cache/Database:** Local JSON files (`backend/cache.json` for data, `backend/meta.json` for sync state).
* **8.3. Integrations:**
    * Base Sepolia RPC Endpoint: (Using `https://sepolia.base.org` and others).
    * Portrait Smart Contracts (Base Sepolia):
        * `PortraitIdRegistryV2`: `0x3cDc03BEb79ba3b9FD3b687C67BFDE70AFf46eBF`
        * `PortraitNameRegistry`: `0xc788716466009AD7219c78d8e547819f6092ec8F`
        * `PortraitStateRegistry`: `0x320C9E64c9a68492A1EB830e64EE881D75ac5efd`
    * Portrait API: `https://api.portrait.so/api/v2/user/latestportrait?name={username}` *(Note: Switched to HTTPS)*.
    * IPFS Gateway: `https://ipfs.io/ipfs/` *(Status: Currently used, performance/reliability TBD)*.
* **8.4. Deployment:** *(Updated)* (To be decided, e.g., Vercel, Netlify recommended for Frontend given Vite/React nature).

---

## 9. Data Requirements

* **9.1. Data Sources:**
    * Base Sepolia Blockchain (via RPC).
    * Portrait API.
* **9.2. Data Formats:**
    * Blockchain calls return standard Solidity types.
    * Portrait API returns JSON.
    * Cached data structure: Array of objects: `{ id: number, username: string, imageUrl: string, profileUrl: string }`.
* **9.3. Data Migration:** Not applicable.
* **9.4. Data Privacy & Retention:** Only publicly available data is handled. Cache is overwritten daily.

---

## 10. Release Criteria & Current Status *(Updated Section Title)*

* **Current Status Summary:**
    * Backend data fetching job (`fetch-job.js`) is implemented and functional.
    * Backend API (`api.js`) is implemented and serves data with pagination, but needs performance optimization (cache read).
    * Frontend (`App.jsx`) displays data using infinite scroll, but requires styling, responsiveness implementation, and UI/UX refinement.
* **Release Criteria (Original):**
    * **10.1. Functionality:** All functional requirements (FR1-FR15) are implemented and tested.
    * **10.2. Data:** Daily job successfully fetches, processes, and caches data. Frontend correctly displays cached data via the backend API.
    * **10.3. Performance:** Frontend loads and scrolls acceptably under simulated load. API response times meet targets (API optimization needed).
    * **10.4. Reliability:** Daily job runs successfully for several consecutive days and handles simulated errors gracefully (Basic logging exists).
    * **10.5. Responsiveness:** UI displays correctly on target desktop and mobile resolutions.
    * **10.6. Testing:** Key user flows are tested. Major bugs are fixed.

---

## 11. Open Questions & Decisions *(Updated Section Title)*

* **OQ1:** What is the official or recommended public IPFS gateway URL prefix?
    * *Status:* Still technically open. Currently using `https://ipfs.io/ipfs/`.
    * *Decision:* Proceed with `https://ipfs.io/ipfs/` for now, monitor performance.
* **OQ2:** Are there documented rate limits for the `https://api.portrait.so` endpoint?
    * *Status:* Unknown. `fetch-job.js` implements a 1.2s delay between calls.
    * *Decision:* Proceed with current delay. Investigate further (contact devs or test) if issues arise.
* **OQ3:** How should persistent errors encountered during the daily data fetch be reported or monitored?
    * *Status:* Basic console logging implemented in `fetch-job.js`.
    * *Decision:* Console logging is sufficient for the current phase.

---

## 12. Future Considerations / Roadmap

* Support for Base Mainnet and potentially other networks.
* User search functionality.
* Filtering or sorting options.
* Displaying more profile details.
* Real-time updates using event listeners.
* *(New)* Optimize backend API performance (in-memory cache).
* *(New)* Refine frontend UI/UX (styling, loading/error states, responsiveness).

---
