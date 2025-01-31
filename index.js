const axios = require('axios');
const Web3 = require('web3');

// 配置项
const CONFIG = {
    SLEEP_TIME: 200,
    PRIVATE_KEY: '这里填写你的私钥'
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
    const contractAddress = '0xbd33cD4e1B65f8A5c2cA55D160316f9A9f119AE5';
    const abi = [{
      "inputs": [
        {"internalType": "address","name": "account","type": "address"},
        {"internalType": "uint256","name": "ticket","type": "uint256"},
        {"internalType": "bytes","name": "signature","type": "bytes"}
      ],
      "name": "claimFucker",
      "outputs": [{"internalType": "uint256","name": "","type": "uint256"}],
      "stateMutability": "nonpayable",
      "type": "function"
    }];

    const contract = new web3.eth.Contract(abi, contractAddress);
    
    // 模拟交易
    try {
      const result = await contract.methods.claimFucker(
        tokenData.account,
        tokenData.ticket,
        tokenData.signature
      ).call();

      // 如果模拟成功，立即发送实际交易
      const tx = {
        from: WALLET_ADDRESS,
        to: contractAddress,
        gas: 300000, // 设置适当的 gas 限制
        data: contract.methods.claimFucker(
          tokenData.account,
          tokenData.ticket,
          tokenData.signature
        ).encodeABI()
      };

      // 获取 gas price
      const gasPrice = await web3.eth.getGasPrice();
      tx.gasPrice = gasPrice * 2;

      // 签名并发送交易
      const signedTx = await web3.eth.accounts.signTransaction(tx, CONFIG.PRIVATE_KEY);
      const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
      
      log(`交易成功! 交易哈希: ${receipt.transactionHash}`);
      return {
        decimal: (Number(result) / Math.pow(10, 8)).toString(),
        txHash: receipt.transactionHash
      };
    } catch (error) {
      // 捕获 revert 错误信息
      if (error.message.includes('revert')) {
        log(`模拟失败: ${error.message}`);
      }
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
        log(`代币数量: ${result.decimal}`);
        
        if (result.decimal === '4700') {
          log('交易成功执行!');
          return result;
        }
      } catch (error) {
        // 如果是 revert 错误，继续循环
        if (error.message.includes('revert')) {
          await sleep(CONFIG.SLEEP_TIME);
          continue;
        }
        throw error;
      }
      
      await sleep(CONFIG.SLEEP_TIME);
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