// Refactored Somnia Auto Swap Bot (Tanpa UI, Full Otomatis)
// -----------------------------------------
import "dotenv/config";
import { ethers } from "ethers";

const RPC_URL = process.env.RPC_URL_SOMNIA_TESTNET;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const USDTG_ADDRESS = process.env.USDTG_ADDRESS;
const NIA_ADDRESS = process.env.NIA_ADDRESS;
const ROUTER_ADDRESS = "0xb98c15a0dC1e271132e341250703c7e94c059e8D";
const WSTT_ADDRESS = "0xf22ef0085f6511f70b01a68f360dcc56261f768a";

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

const ERC20ABI = [
  "function decimals() view returns (uint8)",
  "function balanceOf(address owner) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)"
];

const ROUTER_ABI = [
  "function swapExactETHForTokens(uint256 amountOutMin, address[] path, address to, uint256 deadline) public payable returns (uint256[])",
  "function swapExactTokensForETH(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) public returns (uint256[])",
  "function getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[])"
];

const routerContract = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, wallet);

function getRandomNumber(min, max, decimals = 4) {
  const random = Math.random() * (max - min) + min;
  return parseFloat(random.toFixed(decimals));
}

function getRandomDelay() {
  return Math.random() * (20000 - 10000) + 10000;
}

async function getAmountOut(amountIn, path) {
  try {
    const amounts = await routerContract.getAmountsOut(amountIn, path);
    return amounts[amounts.length - 1];
  } catch (err) {
    console.error("Error getAmountsOut:", err.message);
    return ethers.parseEther("0");
  }
}

async function approveToken(tokenAddress, amount) {
  const tokenContract = new ethers.Contract(tokenAddress, ERC20ABI, wallet);
  const decimals = await tokenContract.decimals();
  const amountIn = ethers.parseUnits(amount.toString(), decimals);
  const allowance = await tokenContract.allowance(wallet.address, ROUTER_ADDRESS);
  if (allowance < amountIn) {
    const tx = await tokenContract.approve(ROUTER_ADDRESS, ethers.MaxUint256);
    await tx.wait();
    console.log(`Approved ${tokenAddress}`);
  }
}

async function autoSwapSTTtoUSDTG() {
  const sttAmount = getRandomNumber(0.01, 0.05);
  const amountIn = ethers.parseEther(sttAmount.toString());
  const path = [WSTT_ADDRESS, USDTG_ADDRESS];
  const amountOutMin = await getAmountOut(amountIn, path);
  const slippage = amountOutMin * BigInt(95) / BigInt(100);
  const deadline = Math.floor(Date.now() / 1000) + 60 * 10;

  const tx = await routerContract.swapExactETHForTokens(
    slippage,
    path,
    wallet.address,
    deadline,
    { value: amountIn, gasLimit: 300000 }
  );
  await tx.wait();
  console.log(`SWAP STT -> USDTg: ${sttAmount} STT`);
}

async function autoSwapUSDTGtoSTT() {
  const usdtAmount = getRandomNumber(0.04, 0.2);
  const tokenContract = new ethers.Contract(USDTG_ADDRESS, ERC20ABI, wallet);
  const decimals = await tokenContract.decimals();
  const amountIn = ethers.parseUnits(usdtAmount.toString(), decimals);
  const path = [USDTG_ADDRESS, WSTT_ADDRESS];
  const amountOutMin = await getAmountOut(amountIn, path);
  const slippage = amountOutMin * BigInt(95) / BigInt(100);
  const deadline = Math.floor(Date.now() / 1000) + 60 * 10;

  await approveToken(USDTG_ADDRESS, usdtAmount);
  const tx = await routerContract.swapExactTokensForETH(
    amountIn,
    slippage,
    path,
    wallet.address,
    deadline,
    { gasLimit: 300000 }
  );
  await tx.wait();
  console.log(`SWAP USDTg -> STT: ${usdtAmount} USDTg`);
}

async function runLoop(iterations = 10) {
  for (let i = 0; i < iterations; i++) {
    try {
      const direction = i % 2 === 0 ? "STT_TO_USDTG" : "USDTG_TO_STT";
      if (direction === "STT_TO_USDTG") {
        await autoSwapSTTtoUSDTG();
      } else {
        await autoSwapUSDTGtoSTT();
      }
    } catch (err) {
      console.error("Swap error:", err.message);
    }
    const delay = getRandomDelay();
    console.log(`Waiting ${Math.floor(delay / 1000)} seconds...`);
    await new Promise(res => setTimeout(res, delay));
  }
  console.log("Swap loop finished.");
}

runLoop(10);
