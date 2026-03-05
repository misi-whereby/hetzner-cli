// Re-export from new location for backward compatibility

// Auction client (public API, no auth)
export {
  fetchAuctionServers,
  filterAuctionServers,
  sortAuctionServers,
} from "./auction/client.js";
export { HetznerRobotClient } from "./robot/client.js";
