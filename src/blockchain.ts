import * as Crypto from "crypto-js";
import { broadcastLatest } from "./p2p";

class Block {
    public index: number;
    public hash: string;
    public previousHash: string | null;
    public data: string;
    public timestamp: number;

    constructor (
        index: number,
        hash: string,
        previousHash: string | null,
        data: string,
        timestamp: number
    ) {
        this.index = index;
        this.hash = hash;
        this.previousHash = previousHash;
        this.data = data;
        this.timestamp = timestamp;
    }
}

// calculateBlockHash
const calculateBlockHash = (
    index: number,
    previousHash: string,
    timestamp: number,
    data: string
): string => Crypto.SHA256(index + previousHash + timestamp + data).toString();

const genesisBlock: Block = new Block(0, "2020202020202", null, "Genesis block", 123456);

let blockchain: Block[] = [genesisBlock];

const getBlockchain = (): Block[] => blockchain

const getLatestBlock = (): Block => blockchain[blockchain.length - 1];

const generateNextBlock = (data: string): Block => {
    const previousBlock: Block = getLatestBlock();
    const newIndex: number = previousBlock.index + 1;
    const newTimestamp: number = new Date().getTime() / 1000;
    const newHash: string = calculateBlockHash(
        newIndex,
        previousBlock.hash,
        newTimestamp,
        data
    );
    const newBlock: Block = new Block(
        newIndex,
        newHash,
        previousBlock.hash,
        data,
        newTimestamp
    );
    addBlock(newBlock)
    broadcastLatest()
    return newBlock;
}

const addBlock = (newBlock: Block): void => {
    if (isValidNewBlock(newBlock, getLatestBlock())) {
        blockchain.push(newBlock);
    }
}

const addBlockToChain = (newBlock: Block) => {
    if (isValidNewBlock(newBlock, getLatestBlock())) {
        blockchain.push(newBlock);
        return true
    }
    return false
}

const isValidBlockStructure = (block: Block): boolean => {
    return typeof block.index === 'number'
        && typeof block.hash === 'string'
        && typeof block.previousHash === 'string'
        && typeof block.timestamp === 'number'
        && typeof block.data === 'string';
};

const isValidNewBlock = (candidateBlock: Block, previousBlock: Block): boolean => {
    if (!isValidBlockStructure(candidateBlock)) {
        console.log("The candidate block structure is not valid");
        return false;
    }

    if (previousBlock.index + 1 !== candidateBlock.index) {
        return false;
    } else if (previousBlock.hash !== candidateBlock.previousHash) {
        return false;
    } else if (calculateBlockHash(
        candidateBlock.index,
        candidateBlock.previousHash,
        candidateBlock.timestamp,
        candidateBlock.data
    ) !== candidateBlock.hash) {
        return false;
    } else {
        return true;
    }
}

const isValidChain = (blockchainToValidate: Block[]): boolean => {
    const isValidGenesis = (block: Block): boolean => {
        return JSON.stringify(block) === JSON.stringify(genesisBlock);
    }

    if (!isValidGenesis(blockchainToValidate[0])) {
        return false;
    }

    for (let i = 1; i < blockchainToValidate.length; i++) {
        if (!isValidNewBlock(blockchainToValidate[i], blockchainToValidate[i - 1])) {
            return false;
        }
    }

    return true;
}

const replaceChain = (newChain: Block[]): void => {
    if (isValidChain(newChain) && newChain.length > blockchain.length) {
        console.log("Received blockchain is valid. Replacing current blockchain with received blockchain");
        blockchain = newChain;
        broadcastLatest()
    } else {
        console.log("Received blockchain is not valid. Do nothing");
    }
}

export { Block, getLatestBlock, getBlockchain, generateNextBlock, isValidBlockStructure, isValidNewBlock, isValidChain, replaceChain, addBlockToChain};