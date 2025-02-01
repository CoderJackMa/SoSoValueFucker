const axios = require('axios');
const Web3 = require('web3');

// 配置项
const CONFIG = {
    SLEEP_TIME: 200,
    PRIVATE_KEY: '这里填写你的私钥',
    GAS_PRICE_GWEI: '0.5'  // 添加 gas price 配置，单位 gwei
};


// 添加统一的日志输出方法
const log = (message) => {
    const now = new Date().toLocaleTimeString('zh-CN', { 
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3
    });
    console.log(`[${now}] ${message}`);
};

let globalAuthToken = null;
let tokenData = {};
const web3 = new Web3('https://mainnet.base.org');

const account = web3.eth.accounts.privateKeyToAccount(CONFIG.PRIVATE_KEY);
const WALLET_ADDRESS = account.address;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function getAuthToken(walletAddress) {
  try {
    const response = await axios.post('https://ssi-gw.sosovalue.com/indices/index-wallet-do/login', {
      walletAddress,
      invitationOrigin: null,
      invitationCode: null
    }, {
      headers: {
        'accept': 'application/json, text/plain, */*',
        'content-type': 'application/json;charset=UTF-8',
        'origin': 'https://ssi.sosovalue.com',
        'referer': 'https://ssi.sosovalue.com/',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36'
      }
    });

    globalAuthToken = response.data.data.authToken; // 只保存 authToken
    return globalAuthToken;
  } catch (error) {
    console.error('获取 auth token 失败:', error);
    throw error;
  }
}

async function checkEligibility() {
  try {
    if (!globalAuthToken) {
      throw new Error('请先获取 authToken');
    }

    const response = await axios.get('https://ssi-gw.sosovalue.com/indices/index-airdrop-activity-do/airdrop/eligibilityWithToken', {
      headers: {
        'accept': 'application/json, text/plain, */*',
        'authorization': `Bearer ${globalAuthToken}`,
        'origin': 'https://ssi.sosovalue.com',
        'referer': 'https://ssi.sosovalue.com/',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36'
      }
    });

    // 保存 data 中的 token 到全局对象
    if (response.data && response.data.data && response.data.data.token) {
      tokenData = response.data.data.token;
      console.log('token 数据已保存:', tokenData);

      tokenData = JSON.parse(tokenData);
    }

    return tokenData;
  } catch (error) {
    console.error('检查资格失败:', error);
    throw error;
  }
}

async function simulateClaim() {
  try {
    const contractAddress = '0x4190e02240f16BE4CC03c7151DEeDd23c08a3d4e';
    const abi = [{
      "inputs": [
        {"internalType": "address","name": "account","type": "address"},
        {"internalType": "uint256","name": "ticket","type": "uint256"},
        {"internalType": "bytes","name": "signature","type": "bytes"}
      ],
      "name": "claim",
      "outputs": [{"internalType": "uint256","name": "amount","type": "uint256"}],
      "stateMutability": "nonpayable",
      "type": "function"
    }];

    const contract = new web3.eth.Contract(abi, contractAddress);
    
    try {
      // 模拟调用，添加 from 参数
      const result = await contract.methods.claim(
        tokenData.account,
        tokenData.ticket,
        tokenData.signature
      ).call({
        from: WALLET_ADDRESS  // 添加 from 参数
      });

      // 转换为代币数量（8位小数）
      const tokenAmount = Number(result) / Math.pow(10, 8);
      log(`模拟调用结果: ${tokenAmount}`);

      // 检查是否为目标数量
      if (tokenAmount === 4700) {
        // 如果是目标数量，发送实际交易
        const tx = {
          from: WALLET_ADDRESS,
          to: contractAddress,
          gas: 300000,
          gasPrice: web3.utils.toWei(CONFIG.GAS_PRICE_GWEI, 'gwei'),
          data: contract.methods.claim(
            tokenData.account,
            tokenData.ticket,
            tokenData.signature
          ).encodeABI()
        };

        const signedTx = await web3.eth.accounts.signTransaction(tx, CONFIG.PRIVATE_KEY);
        const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
        
        log(`交易成功! 交易哈希: ${receipt.transactionHash}`);
        return {
          decimal: tokenAmount.toString(),
          txHash: receipt.transactionHash
        };
      }

      // 如果不是目标数量，返回结果继续循环
      return {
        decimal: tokenAmount.toString()
      };

    } catch (error) {
      log(`模拟调用失败: ${error.message}`);
      throw error;
    }
  } catch (error) {
    throw error;
  }
}

async function simulateClaimUntilTarget() {
  try {
    while (true) {
      try {
        const result = await simulateClaim();
        
        // 如果有交易哈希，说明交易已成功，退出循环
        if (result.txHash) {
          log('找到目标数量并完成交易!');
          return result;
        }
        
        // 否则继续循环
        await sleep(CONFIG.SLEEP_TIME);
      } catch (error) {
        log(`本轮模拟失败，等待下一轮...`);
        await sleep(CONFIG.SLEEP_TIME);
        continue;
      }
    }
  } catch (error) {
    log(`循环模拟失败: ${error.message}`);
    throw error;
  }
}

// 初始化函数：只执行一次 authToken 和签名获取
async function initialize() {
  try {
    // 获取 authToken
    const token = await getAuthToken(WALLET_ADDRESS);
    log('认证 token 已获取');

    // 获取签名数据
    const eligibilityResult = await checkEligibility();
    log('签名数据已获取');

    // 开始循环模拟 claim
    log('开始循环模拟 claim...');
    return simulateClaimUntilTarget();
  } catch (error) {
    log(`初始化失败: ${error.message}`);
    throw error;
  }
}

// 执行程序
initialize()
  .then(finalResult => {
    log('执行完成!');
    log(`最终结果: ${JSON.stringify(finalResult)}`);
  })
  .catch(error => {
    log(`程序执行错误: ${error.message}`);
  });
