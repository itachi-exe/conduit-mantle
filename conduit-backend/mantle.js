import { createPublicClient, http, formatUnits } from "viem";
import { mantle } from "viem/chains";

const RPC_URL = process.env.MANTLE_RPC_URL || "https://rpc.mantle.xyz";

const client = createPublicClient({
  chain: mantle,
  transport: http(RPC_URL),
});

// Real, live Mantle mainnet heartbeat, proves this isn't a static page.
export async function getChainHeartbeat() {
  const [blockNumber, block, gasPrice] = await Promise.all([
    client.getBlockNumber(),
    client.getBlock(),
    client.getGasPrice(),
  ]);

  return {
    chainId: mantle.id,
    blockNumber: blockNumber.toString(),
    blockTimestamp: Number(block.timestamp),
    gasPriceGwei: Number(formatUnits(gasPrice, 9)).toFixed(3),
    rpcUrl: RPC_URL,
  };
}
