// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

contract VendingMachineLedger {
    struct VendReceipt {
        address requester;
        bytes32 queryHash;
        bytes32 resultHash;
        uint256 totalPriceMicrousd;
        string category;
        string provider;
        uint64 createdAt;
    }

    uint256 public vendCount;
    mapping(uint256 => VendReceipt) private receipts;

    event VendRecorded(
        uint256 indexed vendId,
        address indexed requester,
        bytes32 indexed queryHash,
        bytes32 resultHash,
        uint256 totalPriceMicrousd,
        string category,
        string provider
    );

    function recordVend(
        bytes32 queryHash,
        bytes32 resultHash,
        uint256 totalPriceMicrousd,
        string calldata category,
        string calldata provider
    ) external returns (uint256 vendId) {
        vendId = ++vendCount;

        receipts[vendId] = VendReceipt({
            requester: msg.sender,
            queryHash: queryHash,
            resultHash: resultHash,
            totalPriceMicrousd: totalPriceMicrousd,
            category: category,
            provider: provider,
            createdAt: uint64(block.timestamp)
        });

        emit VendRecorded(
            vendId,
            msg.sender,
            queryHash,
            resultHash,
            totalPriceMicrousd,
            category,
            provider
        );
    }

    function getReceipt(uint256 vendId) external view returns (VendReceipt memory) {
        return receipts[vendId];
    }
}
