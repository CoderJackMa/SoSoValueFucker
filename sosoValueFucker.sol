// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IOriginalContract {
    function claim(
        address account,
        uint256 ticket,
        bytes memory signature
    ) external returns (uint256 amount);
}

contract SosoValueFucker {
    address public constant ORIGINAL_CONTRACT = 0x6EF3c884Ac0fF45A8E2275F52787471d46E82f1C;

    function uint2str(uint256 _i) internal pure returns (string memory) {
        if (_i == 0) {
            return "0";
        }
        uint256 j = _i;
        uint256 length;
        while (j != 0) {
            length++;
            j /= 10;
        }
        bytes memory bstr = new bytes(length);
        uint256 k = length;
        j = _i;
        while (j != 0) {
            k = k-1;
            uint8 temp = uint8(48 + j % 10);
            bytes1 b1 = bytes1(temp);
            bstr[k] = b1;
            j /= 10;
        }
        return string(bstr);
    }

    function claimFucker(
        address account,
        uint256 ticket,
        bytes memory signature
    ) external returns (uint256) {
        // 调用原合约的 claim 方法
        uint256 amount = IOriginalContract(ORIGINAL_CONTRACT).claim(
            account,
            ticket,
            signature
        );

        // 检查返回值是否为 4700 * 10^8 (470000000000)
        require(
            amount == 470000000000,
            string(abi.encodePacked("Invalid claim amount: ", uint2str(amount)))
        );

        // 如果检查通过，返回结果
        return amount;
    }
}
